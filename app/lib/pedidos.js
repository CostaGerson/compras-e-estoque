// v316 — pedidos em andamento: PV + PP do KM Sistemas → previsão de receitas (entrada + parcelas após a NF)
import { prisma } from "@/lib/prisma";
import { lerPedidoPdf, lerCondicao } from "@/lib/pedidosLer";
import { sincronizar } from "@/lib/cronograma";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dUTC = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const somaDias = (s, n) => { const d = dUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const hojeISO = () => { const d = new Date(Date.now() - 3 * 3600e3); return d.toISOString().slice(0, 10); };   // Brasília
const CAMPOS = Object.fromEntries(["id", "numero", "cliente", "clienteCodigo", "cnpj", "emissao", "despacho", "condicao", "entradaValor", "vendedor", "tipoPedido", "oc",
  "freteTipo", "frete", "total", "qtd", "itens", "status", "nfNumero", "faturadoEm", "entregaPrevista", "cronoSituacao", "cronoEtapa", "cronoEm", "obs",
  "cronoPrazo", "cronoFimProgramado", "cronoConcluido", "cronoItens", "interno", "qtEntregar", "vlEntregar", "fonte",
  "criadoPorNome", "atualizadoPorNome", "createdAt", "updatedAt"].map((k) => [k, true]));
export const chaveEntrada = (numero) => `PED|${numero}|ENTRADA`;
// v323 — pedidos da NORT SPORTS são internos: não geram contas a receber nem entram na previsão de receitas
export const ehInterno = (cliente, cnpj) => String(cnpj || "").replace(/\D/g, "").startsWith("55116246") || /\bNORT\b/i.test(String(cliente || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

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
  // v325 — relatorio "Posicao Geral de Vendas": importa todos os pedidos em massa
  for (const l of lidos.filter((x) => x.tipo === "POSICAO")) {
    try { out.push({ nome: l.nome, ...(await aplicarPosicaoVendas(l, quem)) }); } catch (e) { out.push({ nome: l.nome, erro: e.message }); }
  }
  // PV primeiro, para o PP encontrar o pedido ja criado
  for (const l of [...lidos].filter((x) => x.tipo !== "POSICAO").sort((a, b) => (a.tipo === "PV" ? -1 : 1) - (b.tipo === "PV" ? -1 : 1))) {
    if (l.erro) { out.push({ nome: l.nome, erro: l.erro }); continue; }
    const atual = await prisma.pedidoVenda.findUnique({ where: { numero: l.numero } });
    const itensAtuais = Array.isArray(atual?.itens) ? atual.itens : [];
    if (l.tipo === "PV") {
      // mantém os parâmetros do PP que já estavam nos itens
      const itens = l.itens.map((i) => { const ant = itensAtuais.find((x) => x.codigo === i.codigo) || {}; return { ...ant, ...i, descricao: ant.descricaoPP || i.descricao }; });
      const dados = {
        cliente: l.cliente || atual?.cliente || "SEM CLIENTE", clienteCodigo: l.clienteCodigo || null, cnpj: l.cnpj || null,
        interno: ehInterno(l.cliente, l.cnpj) || !!atual?.interno,
        emissao: l.emissao ? dUTC(l.emissao) : null, despacho: l.despacho ? dUTC(l.despacho) : null,
        condicao: atual?.condicao && atual.condicao !== l.condicao && atual.pvPdf ? atual.condicao : (l.condicao || null),
        vendedor: l.vendedor || null, tipoPedido: l.tipoPedido || null, oc: l.oc || null, freteTipo: l.freteTipo || null, frete: l.frete ?? null,
        obs: atual?.obs || l.obs || null,
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
  // v321 — relê o Cronograma para casar os pedidos novos na hora
  try { await sincronizar({ forcar: true }); } catch {}
  // v320 — espelha no Lançar PP
  for (const n of [...new Set(out.filter((o) => o.numero).map((o) => o.numero))]) {
    try { await espelharPp(n); } catch (e) { out.push({ nome: `PP ${n}`, erro: `não espelhou no Lançar PP: ${e.message}` }); }
  }
  return out;
}

// ---------- v320 — espelho no "Lançar PP" ----------
// todo pedido subido (PV/PP) aparece no Lançar PP com os PDFs. PP criado aqui (origem PEDIDOS) tem os itens refeitos a cada upload;
// PP já salvo no editor (origem vazia) só ganha os PDFs e os campos que estiverem em branco.
const tipoDaPecaPP = (d) => {
  const n = String(d || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/CAMISETA|T-SHIRT|REGATA|BABY ?LOOK/.test(n)) return "CAMISETA";
  if (/\bPOLO\b/.test(n)) return "POLO";
  if (/CAMISA/.test(n)) return "CAMISA";
  if (/JAQUETA|MOLETOM|BLUSAO|CASACO|AGASALHO|COLETE|PARKA/.test(n)) return "JAQUETA";
  if (/CALCA|BERMUDA|SHORT|MACACAO/.test(n)) return "CALÇA";
  if (/JALECO/.test(n)) return "JALECO";
  if (/AVENTAL/.test(n)) return "AVENTAL";
  return "POLO";
};
const dataURL = (b64) => (b64 ? `data:application/pdf;base64,${b64}` : null);
const dBRs = (d) => (d ? iso(d).split("-").reverse().join("/") : null);
export async function espelharPp(numero) {
  const p = await prisma.pedidoVenda.findUnique({ where: { numero } });
  if (!p) return null;
  const pp = await prisma.pp.findUnique({ where: { numero }, select: { id: true, origem: true, clienteNome: true, clienteCnpj: true, oc: true, condicaoPagamento: true, dtDespacho: true, tipoPedido: true, vendedor: true, obs: true, valorTotal: true } });
  const cab = {
    clienteNome: p.cliente, clienteCnpj: p.cnpj ? p.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null, oc: p.oc, condicaoPagamento: p.condicao,
    dtDespacho: dBRs(p.despacho), prazoEntrega: dBRs(p.despacho), tipoPedido: p.tipoPedido, vendedor: p.vendedor, obs: p.obs, valorTotal: Number(p.total) || null,
  };
  const pdfs = { ...(p.pvPdf ? { arquivoPedidoPdf: dataURL(p.pvPdf) } : {}), ...(p.ppPdf ? { arquivoOpPdf: dataURL(p.ppPdf) } : {}) };
  const itens = (Array.isArray(p.itens) ? p.itens : []).map((it) => {
    const tipo = tipoDaPecaPP(it.descricao);
    const qtd = Number(it.qtd) || (it.grade || []).reduce((s, g) => s + (Number(g.qtd) || 0), 0);
    return { tipoPecaNome: tipo, codigo: it.codigo || null, descricao: it.descricao || null, quantidade: qtd,
      valorUnitario: it.preco ?? null, valorTotal: it.total ?? null,
      gradeJson: JSON.stringify((it.grade || []).map((g) => ({ tam: g.tam, qtd: String(g.qtd) }))),
      parametrosJson: JSON.stringify(Object.fromEntries((it.parametros || []).filter((x) => x.v).map((x) => [x.t, x.v]))) };
  });
  if (!pp) {
    return prisma.pp.create({ data: { numero, origem: "PEDIDOS", ...cab, ...pdfs, itens: { create: itens } }, select: { id: true } });
  }
  if (pp.origem === "PEDIDOS") {
    await prisma.ppItem.deleteMany({ where: { ppId: pp.id } });
    return prisma.pp.update({ where: { id: pp.id }, data: { ...cab, ...pdfs, itens: { create: itens } }, select: { id: true } });
  }
  const vazios = Object.fromEntries(Object.entries(cab).filter(([k, v]) => v != null && (pp[k] == null || pp[k] === "")));
  return prisma.pp.update({ where: { id: pp.id }, data: { ...vazios, ...pdfs }, select: { id: true } });
}

// v325 — aplica o relatório de Posição de Vendas: cria os pendentes que faltam e atualiza o saldo a faturar de todos
export async function aplicarPosicaoVendas(l, quem) {
  const conf = { totalPedRelatorio: l.totalPed, totalVleRelatorio: l.totalVle, lidos: l.pedidos.length,
    somaVle: r2(l.pedidos.reduce((s, p) => s + (p.vlEntregar || 0), 0)) };
  const nums = l.pedidos.map((p) => p.numero);
  const existentes = Object.fromEntries((await prisma.pedidoVenda.findMany({ where: { numero: { in: nums } },
    select: { id: true, numero: true, condicao: true, despacho: true, vendedor: true, pvPdf: true, fonte: true, cliente: true, status: true, faturadoEm: true } })).map((x) => [x.numero, x]));
  const ops = [], novos = [];
  let criados = 0, atualizados = 0, pendentesNovos = 0;
  for (const p of l.pedidos) {
    const at = existentes[p.numero];
    const interno = ehInterno(p.cliente, null);
    const comum = { qtEntregar: Math.round(p.qtEntregar || 0), vlEntregar: r2(p.vlEntregar || 0), vendedor: p.vendedor || null, interno };
    if (at) {
      const temPv = !!at.pvPdf;
      ops.push(prisma.pedidoVenda.update({ where: { id: at.id }, data: {
        ...comum,
        ...((p.vlEntregar || 0) <= 0.009 && at.status === "ANDAMENTO" ? { status: "FATURADO", faturadoEm: at.faturadoEm || dUTC(hojeISO()) } : {}),   // v347 — saldo a faturar zerado
        cliente: at.cliente && at.cliente !== "SEM CLIENTE" ? at.cliente : (p.cliente || at.cliente),
        condicao: (temPv && at.condicao) ? at.condicao : (at.condicao || p.condicao || null),
        despacho: at.despacho || (p.entrega ? dUTC(p.entrega) : null),
        fonte: at.fonte && at.fonte.includes("RELATORIO") ? at.fonte : (at.fonte ? `${at.fonte}+RELATORIO` : (temPv ? "PV+RELATORIO" : "RELATORIO")),
        atualizadoPorNome: quem,
      } }));
      atualizados++;
    } else {
      const pendente = (p.vlEntregar || 0) > 0.009;
      novos.push({ numero: p.numero, cliente: p.cliente || "SEM CLIENTE", emissao: p.emissao ? dUTC(p.emissao) : null,
        despacho: p.entrega ? dUTC(p.entrega) : null, condicao: p.condicao || null,
        total: r2(p.valor || 0), qtd: Math.round(p.qtd || 0), itens: [], status: pendente ? "ANDAMENTO" : "FATURADO",
        ...comum, fonte: "RELATORIO", criadoPorNome: quem });
      criados++; if (pendente) pendentesNovos++;
    }
  }
  if (novos.length) for (let i = 0; i < novos.length; i += 500) await prisma.pedidoVenda.createMany({ data: novos.slice(i, i + 500), skipDuplicates: true });
  for (let i = 0; i < ops.length; i += 100) await prisma.$transaction(ops.slice(i, i + 100));
  // v326 — todo pedido deve constar no Lançar PP: cria uma casca de PP para quem ainda não tem
  const espelhados = await espelharTodosPp(nums, quem);
  try { await sincronizar({ forcar: true }); } catch {}
  return { tipo: "POSICAO", criados, atualizados, pendentesNovos, ppCriados: espelhados, ...conf };
}

// cria em massa uma casca de PP (sem itens) para todo pedido que ainda não tem PP — o PV/PP preenchem depois
// v328 — garante uma casca de PP para TODO pedido do sistema que ainda não tem (auto no Lançar PP)
export async function garantirPpTodos(quem) {
  const nums = (await prisma.pedidoVenda.findMany({ select: { numero: true } })).map((x) => x.numero).filter(Boolean);
  if (!nums.length) return 0;
  return espelharTodosPp(nums, quem || "SISTEMA");
}

async function espelharTodosPp(numeros, quem) {
  const peds = await prisma.pedidoVenda.findMany({ where: { numero: { in: numeros } },
    select: { numero: true, cliente: true, cnpj: true, oc: true, condicao: true, despacho: true, tipoPedido: true, vendedor: true, obs: true, total: true } });
  const jaPp = new Set((await prisma.pp.findMany({ where: { numero: { in: numeros } }, select: { numero: true } })).map((x) => x.numero));
  const novos = peds.filter((p) => p.numero && !jaPp.has(p.numero)).map((p) => ({
    numero: p.numero, origem: "PEDIDOS", clienteNome: p.cliente || null,
    clienteCnpj: p.cnpj ? String(p.cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : null,
    oc: p.oc || null, condicaoPagamento: p.condicao || null, dtDespacho: dBRs(p.despacho), prazoEntrega: dBRs(p.despacho),
    tipoPedido: p.tipoPedido || null, vendedor: p.vendedor || null, obs: p.obs || null, valorTotal: p.total ?? null,
  }));
  if (novos.length) for (let i = 0; i < novos.length; i += 500) await prisma.pp.createMany({ data: novos.slice(i, i + 500), skipDuplicates: true });
  return novos.length;
}

// ---------- previsão de um pedido ----------
// entrada: lançada no contas a receber (fica de fora da previsão — já conta no a receber) ou pendente (entra na previsão);
// restante: parcelas após o faturamento — data = entrega do Cronograma, senão DT despacho do PV; se já passou, conta a partir de hoje
export function preverPedido(p, { hoje = hojeISO(), titulosEntrada = [] } = {}) {
  // v325 — quando veio da Posição de Vendas, a base é o saldo a faturar (Vl.à Entregar); senão, o total do pedido
  const base$ = p.vlEntregar != null ? r2(p.vlEntregar) : r2(p.total);
  const total = base$;
  const cond = lerCondicao(p.condicao);
  if (p.interno) return { interno: true, condicaoOk: true, entradaPct: 0, prazos: [], entrada: 0, entradaCalc: 0, entradaLancada: 0, entradaTitulos: [], restante: 0,
    base: iso(p.entregaPrevista) || iso(p.despacho), baseOrigem: p.entregaPrevista ? "CRONOGRAMA" : "DESPACHO", atrasado: false, reprogramar: null, pronto: !!p.cronoConcluido, parcelas: [] };
  const entradaCalc = r2(total * cond.entradaPct);
  const entrada = p.entradaValor != null ? r2(p.entradaValor) : entradaCalc;
  const lancadas = titulosEntrada.filter((t) => t.status !== "CANCELADO");
  const entradaLancada = r2(lancadas.reduce((s, t) => s + Number(t.valor), 0));
  const restante = r2(total - Math.max(entrada, entradaLancada));
  const baseOrig = iso(p.entregaPrevista) || iso(p.despacho);
  // v322 — vencido = data de entrega (programação do PCP ou DT despacho) já passou e o pedido não está concluído no PCP → pedir reprogramação
  const pronto = !!p.cronoConcluido;
  const atrasado = !pronto && !!baseOrig && baseOrig < hoje;
  const reprogramar = atrasado ? (p.entregaPrevista ? "PCP" : "DESPACHO") : null;
  // v330 — atrasado (ainda em andamento) conta na previsão: a base passa a ser hoje; só entregue/faturado (vlEntregar 0) fica de fora
  const base = !baseOrig || atrasado || (pronto && baseOrig < hoje) ? hoje : baseOrig;
  const desconsiderado = false;
  const parcelas = [];
  {
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
  }
  return {
    condicaoOk: cond.ok, entradaPct: cond.entradaPct, prazos: cond.prazos,
    entrada, entradaCalc, entradaLancada, entradaTitulos: lancadas.map((t) => ({ id: t.id, valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status })),
    restante, base, baseOrigem: p.entregaPrevista ? "CRONOGRAMA" : p.despacho ? "DESPACHO" : "HOJE", atrasado, reprogramar, pronto, desconsiderado, parcelas,
  };
}

// v347 — faturamento automático pela NF de saída: mesmo cliente (CNPJ, ou nome quando o pedido não tem CNPJ),
// emitida a partir da emissão do pedido, valor ±2% do total, do total + frete ou do saldo a faturar. Uma NF baixa um pedido só.
const soD = (s) => String(s || "").replace(/\D/g, "");
const PAL_FRACAS = new Set(["LTDA", "ME", "EPP", "SA", "S", "A", "S/A", "EIRELI", "DE", "DA", "DO", "DOS", "DAS", "E", "COMERCIO", "SERVICOS", "INDUSTRIA"]);
const palavras = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !PAL_FRACAS.has(w));
const mesmoNome = (a, b) => { const pa = palavras(a), pb = new Set(palavras(b)); return pa.length > 0 && pa.slice(0, 2).every((w) => pb.has(w)); };
export async function faturarPelasNfs() {
  const and = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false }, select: { id: true, numero: true, cliente: true, cnpj: true, emissao: true, total: true, frete: true, vlEntregar: true, obs: true } });
  if (!and.length) return [];
  const desde = new Date(Math.min(...and.map((p) => (p.emissao ? +p.emissao : Date.now() - 400 * 86400000))));
  const nfs = await prisma.finNfSaida.findMany({ where: { emissao: { gte: desde } }, select: { numero: true, emissao: true, valor: true, destCnpj: true, destNome: true }, orderBy: { emissao: "asc" } });
  const usadas = new Set((await prisma.pedidoVenda.findMany({ where: { nfNumero: { not: null } }, select: { nfNumero: true } })).map((x) => String(x.nfNumero).replace(/^0+/, "")));
  const feitos = [];
  for (const p of and) {
    const alvos = [Number(p.total), Number(p.total) + Number(p.frete || 0), p.vlEntregar != null ? Number(p.vlEntregar) : 0].filter((v) => v > 0);
    const em = p.emissao ? p.emissao.toISOString().slice(0, 10) : "0000-00-00";
    const nf = nfs.find((n) => !usadas.has(String(n.numero).replace(/^0+/, "")) && n.emissao.toISOString().slice(0, 10) >= em
      && (p.cnpj ? soD(n.destCnpj) === soD(p.cnpj) : mesmoNome(p.cliente, n.destNome))
      && alvos.some((v) => Math.abs(Number(n.valor) - v) <= v * 0.02));
    if (!nf) continue;
    usadas.add(String(nf.numero).replace(/^0+/, ""));
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: { status: "FATURADO", nfNumero: String(nf.numero), faturadoEm: nf.emissao,
      obs: [p.obs, `FATURADO AUTOMÁTICO PELA NF ${nf.numero} (${nf.emissao.toISOString().slice(0, 10).split("-").reverse().join("/")})`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" } });
    feitos.push({ numero: p.numero, nf: nf.numero });
  }
  return feitos;
}

// ---------- painel ----------
export async function listarPedidos({ competencia, todos = false } = {}) {
  // v317 — programação do Cronograma (no máximo a cada 10 min; erro não impede o painel)
  let crono = null; try { crono = await sincronizar(); } catch (e) { crono = { ok: false, erro: e.message }; }
  const hoje = hojeISO();
  const comp = competencia || hoje.slice(0, 7);
  // v347 — antes de listar: pedido em andamento que já tem NF de saída vira FATURADO sozinho
  let autoFaturados = [];
  try { autoFaturados = await faturarPelasNfs(); } catch (e) { console.log("pedidos/faturar:", e.message); }
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
  const nfs = cnpjs.length ? (await prisma.finNfSaida.findMany({ where: { emissao: { gte: new Date(Date.now() - 400 * 86400000) } }, select: { numero: true, emissao: true, valor: true, destCnpj: true } })).filter((n) => cnpjs.some((c) => soD(c) === soD(n.destCnpj))) : [];

  const pedidos = lista.map((p) => {
    const prev = preverPedido(p, { hoje, titulosEntrada: titsDe(p.numero) });
    const em = iso(p.emissao) || "0000-00-00";
    const alvo = [r2(p.total), prev.restante];
    const nfSugerida = p.status === "ANDAMENTO" && !p.interno ? nfs.find((n) => soD(n.destCnpj) === soD(p.cnpj) && iso(n.emissao) >= em && alvo.some((v) => v > 0 && Math.abs(Number(n.valor) - v) <= v * 0.02)) : null;
    const noMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) === comp).reduce((s, x) => s + x.valor, 0));
    const foraMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) > comp).reduce((s, x) => s + x.valor, 0));
    const antes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) < comp).reduce((s, x) => s + x.valor, 0));
    return { ...p, total: r2(p.total), entradaValor: p.entradaValor != null ? r2(p.entradaValor) : null, frete: p.frete != null ? r2(p.frete) : null,
      emissao: iso(p.emissao), despacho: iso(p.despacho), entregaPrevista: iso(p.entregaPrevista), faturadoEm: iso(p.faturadoEm), cronoPrazo: iso(p.cronoPrazo), cronoFimProgramado: iso(p.cronoFimProgramado),
      temPv: comPv.has(p.id), temPp: comPp.has(p.id),
      previsao: prev, noMes, foraMes, antes,
      nfSugerida: nfSugerida ? { numero: nfSugerida.numero, emissao: iso(nfSugerida.emissao), valor: r2(nfSugerida.valor) } : null };
  });
  const and = pedidos.filter((p) => p.status === "ANDAMENTO" && !p.interno);   // v323 — internos (NORT) fora dos totais
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
    qtdReprogPcp: and.filter((p) => p.previsao.reprogramar === "PCP").length,
    qtdReprogDespacho: and.filter((p) => p.previsao.reprogramar === "DESPACHO").length,
    qtdProntos: and.filter((p) => p.previsao.pronto).length,
    qtdSemCondicao: and.filter((p) => !p.previsao.condicaoOk).length,
    qtdSemPv: and.filter((p) => !p.temPv).length,
    qtdNfSugerida: and.filter((p) => p.nfSugerida).length,
    // por mês (próximos 6)
    porMes: (() => { const m = {}; for (const p of and) for (const x of p.previsao.parcelas) { const c = x.data.slice(0, 7); m[c] = r2((m[c] || 0) + x.valor); } return Object.entries(m).sort().map(([c, v]) => ({ competencia: c, valor: v })); })(),
  };
  resumo.qtdSemCrono = and.filter((p) => !p.entregaPrevista).length;
  resumo.qtdInternos = pedidos.filter((p) => p.status === "ANDAMENTO" && p.interno).length;
  return { resumo, pedidos, crono };
}

export async function atualizarPedido(id, b, quem) {
  const data = { atualizadoPorNome: quem };
  if (b.condicao !== undefined) data.condicao = String(b.condicao || "").toUpperCase().trim() || null;
  if (b.entradaValor !== undefined) data.entradaValor = b.entradaValor === null || b.entradaValor === "" ? null : r2(b.entradaValor);
  if (b.obs !== undefined) data.obs = b.obs || null;
  if (b.interno !== undefined) data.interno = !!b.interno;
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
  const p = await prisma.pedidoVenda.findUnique({ where: { id: Number(id) }, select: { numero: true, cliente: true, cnpj: true, total: true, condicao: true, entradaValor: true, emissao: true, despacho: true, entregaPrevista: true, interno: true } });
  if (!p) throw new Error("Pedido não encontrado.");
  if (p.interno) throw new Error("Pedido interno (NORT SPORTS): não gera conta a receber.");
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
