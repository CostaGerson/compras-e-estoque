// v316 — pedidos em andamento: PV + PP do KM Sistemas → previsão de receitas (entrada + parcelas após a NF)
import { prisma } from "@/lib/prisma";
import { lerPedidoPdf, lerCondicao } from "@/lib/pedidosLer";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const somaDias = (s, n) => { const d = dUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const hojeISO = () => { const d = new Date(Date.now() - 3 * 3600e3); return d.toISOString().slice(0, 10); };   // Brasília
const CAMPOS = Object.fromEntries(["id", "numero", "cliente", "clienteCodigo", "cnpj", "emissao", "despacho", "condicao", "entradaValor", "vendedor", "tipoPedido", "oc",
  "freteTipo", "frete", "total", "qtd", "itens", "status", "nfNumero", "faturadoEm", "entregaPrevista", "cronoSituacao", "cronoEtapa", "cronoEm", "obs",
  "criadoPorNome", "atualizadoPorNome", "createdAt", "updatedAt"].map((k) => [k, true]));
export const chaveEntrada = (numero) => `PED|${numero}|ENTRADA`;

// ---------- importação ----------
export async function importarArquivos(arquivos, quem) {
  const lidos = [];
  for (const a of arquivos || []) {
    try {
      const b64 = String(a.base64 || "").replace(/^data:[^,]+,/, "");
      const r = await lerPedidoPdf(Buffer.from(b64, "base64"));
      lidos.push({ nome: a.nome, b64, ...r });
    } catch (e) { lidos.push({ nome: a.nome, erro: e.message }); }
  }
  const out = [];
  // PV primeiro, para o PP encontrar o pedido já criado
  for (const l of [...lidos].sort((a, b) => (a.tipo === "PV" ? -1 : 1) - (b.tipo === "PV" ? -1 : 1))) {
    if (l.erro) { out.push({ nome: l.nome, erro: l.erro }); continue; }
    const atual = await prisma.pedidoVenda.findUnique({ where: { numero: l.numero } });
    const itensAtuais = Array.isArray(atual?.itens) ? atual.itens : [];
    if (l.tipo === "PV") {
      // mantém os parâmetros do PP que já estavam nos itens
      const itens = l.itens.map((i) => { const ant = itensAtuais.find((x) => x.codigo === i.codigo) || {}; return { ...ant, ...i, descricao: ant.descricaoPP || i.descricao }; });
      const dados = {
        cliente: l.cliente || atual?.cliente || "SEM CLIENTE", clienteCodigo: l.clienteCodigo || null, cnpj: l.cnpj || null,
        emissao: l.emissao ? dUTC(l.emissao) : null, despacho: l.despacho ? dUTC(l.despacho) : null,
        condicao: atual?.condicao && atual.condicao !== l.condicao && atual.pvPdf ? atual.condicao : (l.condicao || null),
        vendedor: l.vendedor || null, tipoPedido: l.tipoPedido || null, oc: l.oc || null, freteTipo: l.freteTipo || null, frete: l.frete ?? null,
        total: r2(l.total), qtd: Math.round(l.qtdTotal || itens.reduce((s, i) => s + (i.qtd || 0), 0)), itens, pvPdf: l.b64, atualizadoPorNome: quem,
      };
      if (atual) await prisma.pedidoVenda.update({ where: { id: atual.id }, data: dados });
      else await prisma.pedidoVenda.create({ data: { numero: l.numero, ...dados, criadoPorNome: quem } });
      out.push({ nome: l.nome, tipo: "PV", numero: l.numero, cliente: dados.cliente, total: dados.total, novo: !atual });
    } else {
      const itens = [...itensAtuais];
      for (const it of l.itens) {
        const k = itens.findIndex((x) => (it.codigo && x.codigo === it.codigo));
        const pp = { op: it.op, seq: it.seq, parametros: it.parametros, descricaoPP: it.descricao, qtdPP: it.qtd };
        if (k >= 0) itens[k] = { ...itens[k], ...pp, descricao: it.descricao || itens[k].descricao };
        else itens.push({ codigo: it.codigo || null, descricao: it.descricao, qtd: it.qtd || 0, ...pp });
      }
      const dados = { itens, ppPdf: l.b64, atualizadoPorNome: quem };
      if (atual) await prisma.pedidoVenda.update({ where: { id: atual.id }, data: { ...dados, despacho: atual.despacho || (l.despacho ? dUTC(l.despacho) : null) } });
      else await prisma.pedidoVenda.create({ data: { numero: l.numero, cliente: l.cliente || "SEM CLIENTE", emissao: l.emissao ? dUTC(l.emissao) : null,
        despacho: l.despacho ? dUTC(l.despacho) : null, total: 0, qtd: l.itens.reduce((s, i) => s + (i.qtd || 0), 0), ...dados, criadoPorNome: quem } });
      out.push({ nome: l.nome, tipo: "PP", numero: l.numero, cliente: l.cliente || atual?.cliente, itens: l.itens.length, novo: !atual, semPv: !atual?.pvPdf });
    }
  }
  return out;
}

// ---------- previsão de um pedido ----------
// entrada: lançada no contas a receber (fica de fora da previsão — já conta no a receber) ou pendente (entra na previsão);
// restante: parcelas após o faturamento — data = entrega do Cronograma, senão DT despacho do PV; se já passou, conta a partir de hoje
export function preverPedido(p, { hoje = hojeISO(), titulosEntrada = [] } = {}) {
  const total = r2(p.total);
  const cond = lerCondicao(p.condicao);
  const entradaCalc = r2(total * cond.entradaPct);
  const entrada = p.entradaValor != null ? r2(p.entradaValor) : entradaCalc;
  const lancadas = titulosEntrada.filter((t) => t.status !== "CANCELADO");
  const entradaLancada = r2(lancadas.reduce((s, t) => s + Number(t.valor), 0));
  const restante = r2(total - Math.max(entrada, entradaLancada));
  const baseOrig = iso(p.entregaPrevista) || iso(p.despacho);
  const atrasado = !!baseOrig && baseOrig < hoje;
  const base = !baseOrig || atrasado ? hoje : baseOrig;
  const parcelas = [];
  if (entrada > 0 && entradaLancada + 0.01 < entrada) {
    const em = iso(p.emissao);
    parcelas.push({ tipo: "ENTRADA", data: em && em > hoje ? em : hoje, valor: r2(entrada - entradaLancada), pendente: true });
  }
  const prazos = cond.prazos.length ? cond.prazos : (restante > 0 ? [0] : []);
  if (restante > 0.009 && prazos.length) {
    const cada = r2(restante / prazos.length);
    prazos.forEach((d, i) => parcelas.push({ tipo: "PARCELA", n: i + 1, de: prazos.length, dias: d, data: somaDias(base, d),
      valor: i === prazos.length - 1 ? r2(restante - cada * (prazos.length - 1)) : cada }));
  }
  return {
    condicaoOk: cond.ok, entradaPct: cond.entradaPct, prazos: cond.prazos,
    entrada, entradaCalc, entradaLancada, entradaTitulos: lancadas.map((t) => ({ id: t.id, valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status })),
    restante, base, baseOrigem: p.entregaPrevista ? "CRONOGRAMA" : p.despacho ? "DESPACHO" : "HOJE", atrasado, parcelas,
  };
}

// ---------- painel ----------
export async function listarPedidos({ competencia, todos = false } = {}) {
  const hoje = hojeISO();
  const comp = competencia || hoje.slice(0, 7);
  const lista = await prisma.pedidoVenda.findMany({ where: todos ? {} : { status: "ANDAMENTO" }, orderBy: [{ despacho: "asc" }, { numero: "asc" }], select: CAMPOS });
  // PDFs: só se existem (sem carregar o conteúdo)
  const ids = lista.map((p) => p.id);
  const comPv = new Set(ids.length ? (await prisma.pedidoVenda.findMany({ where: { id: { in: ids }, pvPdf: { not: null } }, select: { id: true } })).map((x) => x.id) : []);
  const comPp = new Set(ids.length ? (await prisma.pedidoVenda.findMany({ where: { id: { in: ids }, ppPdf: { not: null } }, select: { id: true } })).map((x) => x.id) : []);
  // entradas já lançadas no contas a receber
  const numeros = lista.map((p) => p.numero);
  const tits = numeros.length ? await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", OR: [{ chaveImport: { in: numeros.map(chaveEntrada) } }, ...numeros.map((n) => ({ titulo: { contains: `PEDIDO ${n}` } }))] },
    select: { id: true, titulo: true, chaveImport: true, valor: true, vencimento: true, status: true },
  }) : [];
  const titsDe = (n) => tits.filter((t) => t.chaveImport === chaveEntrada(n) || (t.titulo || "").includes(`PEDIDO ${n}`));
  // NF de saída que pode ser o faturamento do pedido (mesmo CNPJ, depois da emissão, valor ±2%)
  const cnpjs = [...new Set(lista.map((p) => p.cnpj).filter(Boolean))];
  const nfs = cnpjs.length ? await prisma.finNfSaida.findMany({ where: { destCnpj: { in: cnpjs } }, select: { numero: true, emissao: true, valor: true, destCnpj: true } }) : [];

  const pedidos = lista.map((p) => {
    const prev = preverPedido(p, { hoje, titulosEntrada: titsDe(p.numero) });
    const em = iso(p.emissao) || "0000-00-00";
    const alvo = [r2(p.total), prev.restante];
    const nfSugerida = p.status === "ANDAMENTO" ? nfs.find((n) => n.destCnpj === p.cnpj && iso(n.emissao) >= em && alvo.some((v) => v > 0 && Math.abs(Number(n.valor) - v) <= v * 0.02)) : null;
    const noMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) === comp).reduce((s, x) => s + x.valor, 0));
    const foraMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) > comp).reduce((s, x) => s + x.valor, 0));
    const antes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) < comp).reduce((s, x) => s + x.valor, 0));
    return { ...p, total: r2(p.total), entradaValor: p.entradaValor != null ? r2(p.entradaValor) : null, frete: p.frete != null ? r2(p.frete) : null,
      emissao: iso(p.emissao), despacho: iso(p.despacho), entregaPrevista: iso(p.entregaPrevista), faturadoEm: iso(p.faturadoEm),
      temPv: comPv.has(p.id), temPp: comPp.has(p.id),
      previsao: prev, noMes, foraMes, antes,
      nfSugerida: nfSugerida ? { numero: nfSugerida.numero, emissao: iso(nfSugerida.emissao), valor: r2(nfSugerida.valor) } : null };
  });
  const and = pedidos.filter((p) => p.status === "ANDAMENTO");
  const soma = (l, f) => r2(l.reduce((s, p) => s + f(p), 0));
  const resumo = {
    competencia: comp, hoje,
    qtdPedidos: and.length, pecas: and.reduce((s, p) => s + (p.qtd || 0), 0),
    totalAndamento: soma(and, (p) => p.total),
    entradasLancadas: soma(and, (p) => p.previsao.entradaLancada),
    aReceberPrevisto: soma(and, (p) => p.previsao.parcelas.reduce((s, x) => s + x.valor, 0)),
    noMes: soma(and, (p) => p.noMes), foraMes: soma(and, (p) => p.foraMes), antes: soma(and, (p) => p.antes),
    entradasPendentes: soma(and, (p) => p.previsao.parcelas.filter((x) => x.pendente).reduce((s, x) => s + x.valor, 0)),
    qtdEntradasPendentes: and.filter((p) => p.previsao.parcelas.some((x) => x.pendente)).length,
    qtdAtrasados: and.filter((p) => p.previsao.atrasado).length,
    qtdSemCondicao: and.filter((p) => !p.previsao.condicaoOk).length,
    qtdSemPv: and.filter((p) => !p.temPv).length,
    qtdNfSugerida: and.filter((p) => p.nfSugerida).length,
    // por mês (próximos 6)
    porMes: (() => { const m = {}; for (const p of and) for (const x of p.previsao.parcelas) { const c = x.data.slice(0, 7); m[c] = r2((m[c] || 0) + x.valor); } return Object.entries(m).sort().map(([c, v]) => ({ competencia: c, valor: v })); })(),
  };
  return { resumo, pedidos };
}

export async function atualizarPedido(id, b, quem) {
  const data = { atualizadoPorNome: quem };
  if (b.condicao !== undefined) data.condicao = String(b.condicao || "").toUpperCase().trim() || null;
  if (b.entradaValor !== undefined) data.entradaValor = b.entradaValor === null || b.entradaValor === "" ? null : r2(b.entradaValor);
  if (b.obs !== undefined) data.obs = b.obs || null;
  if (b.despacho !== undefined) data.despacho = b.despacho ? dUTC(b.despacho) : null;
  if (b.status !== undefined) {
    if (!["ANDAMENTO", "FATURADO", "CANCELADO"].includes(b.status)) throw new Error("Status inválido.");
    data.status = b.status;
    if (b.status === "FATURADO") { data.nfNumero = b.nfNumero || null; data.faturadoEm = b.faturadoEm ? dUTC(b.faturadoEm) : dUTC(hojeISO()); }
    if (b.status === "ANDAMENTO") { data.nfNumero = null; data.faturadoEm = null; }
  }
  return prisma.pedidoVenda.update({ where: { id: Number(id) }, data, select: { id: true } });
}

// lança a conta a receber da entrada (uma vez por pedido)
export async function lancarEntrada(id, { vencimento, valor } = {}, quem) {
  const p = await prisma.pedidoVenda.findUnique({ where: { id: Number(id) }, select: { numero: true, cliente: true, cnpj: true, total: true, condicao: true, entradaValor: true, emissao: true, despacho: true, entregaPrevista: true } });
  if (!p) throw new Error("Pedido não encontrado.");
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chaveEntrada(p.numero) }, select: { id: true, status: true } });
  if (ja && ja.status !== "CANCELADO") throw new Error("A entrada deste pedido já está no contas a receber.");
  const prev = preverPedido(p);
  const v = r2(valor ?? prev.entrada - prev.entradaLancada);
  if (!(v > 0)) throw new Error("Sem valor de entrada para lançar (confira a condição de pagamento).");
  const venc = vencimento || iso(p.emissao) || hojeISO();
  const venda = await prisma.finConta.findUnique({ where: { codigo: "1111000" }, select: { id: true } }).catch(() => null);
  const dados = { tipo: "RECEBER", titulo: `PEDIDO ${p.numero} - ENTRADA`, parceiro: p.cliente, documento: p.cnpj || null, numeroDoc: p.numero,
    emissao: p.emissao || null, valor: v, vencimento: dUTC(venc), competencia: venc.slice(0, 7), previsao: false,
    rateio: venda ? [{ contaId: venda.id, pct: 100 }] : [], forma: "PEDIDO", chaveImport: chaveEntrada(p.numero), criadoPorNome: quem,
    observacao: `ENTRADA DO PEDIDO ${p.numero} · CONDIÇÃO ${p.condicao || "—"}` };
  if (ja) return prisma.finTitulo.update({ where: { id: ja.id }, data: { ...dados, status: "ABERTO", chaveImport: undefined } });
  return prisma.finTitulo.create({ data: dados });
}

export async function pdfDoPedido(id, tipo) {
  const p = await prisma.pedidoVenda.findUnique({ where: { id: Number(id) }, select: { numero: true, pvPdf: true, ppPdf: true } });
  const b = tipo === "PP" ? p?.ppPdf : p?.pvPdf;
  return b ? { nome: `${tipo} ${p.numero}.pdf`, buf: Buffer.from(b, "base64") } : null;
}
export const excluirPedido = (id) => prisma.pedidoVenda.delete({ where: { id: Number(id) } });
