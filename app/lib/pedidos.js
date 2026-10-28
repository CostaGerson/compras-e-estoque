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
  "cronoPrazo", "cronoFimProgramado", "cronoConcluido", "cronoItens", "interno", "qtEntregar", "vlEntregar", "fonte", "nfsFaturadas", "kmNfs", "faturamentoPendente",
  "criadoPorNome", "atualizadoPorNome", "createdAt", "updatedAt"].map((k) => [k, true]));
export const chaveEntrada = (numero) => `PED|${numero}|ENTRADA`;
// v323 — pedidos da NORT SPORTS são internos: não geram contas a receber nem entram na previsão de receitas
export const ehInterno = (cliente, cnpj) => String(cnpj || "").replace(/\D/g, "").startsWith("55116246") || /\bNORT\b/i.test(String(cliente || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

// ---------- v391 — faturado só com as contas da NF lançadas ----------
const semZ = (n) => String(n || "").trim().replace(/^0+(?=\d)/, "");
const nfsDe = (s) => String(s || "").split(/[,\s]+/).map(semZ).filter(Boolean);
// todas as NFs têm conta a receber lançada? (movimento fiscal LANÇADA com parcelas, ou título a receber com o nº da NF no documento)
export async function contasLancadas(nums, cnpj) {
  const lista = [...new Set((nums || []).map(semZ).filter(Boolean))];
  if (!lista.length) return false;
  const doc = String(cnpj || "").replace(/\D/g, "");
  const fDoc = doc.length === 14 ? { documento: { startsWith: doc.slice(0, 8) } } : doc ? { documento: doc } : {};   // v554 — mesma empresa (matriz/filial)
  for (const n of lista) {
    const fn = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", numero: n, acao: "LANCADA", ...fDoc }, select: { parcelas: true } });
    if (fn.some((x) => Array.isArray(x.parcelas) && x.parcelas.some((y) => y.tituloId))) continue;
    const ts = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: { not: "CANCELADO" }, OR: [{ numeroDoc: { contains: n } }, { titulo: { contains: `NF ${n}` } }], ...fDoc }, select: { numeroDoc: true, titulo: true } });
    if (ts.some((t) => new RegExp(`(^|\\D)0*${n}(\\D|$)`).test(String(t.numeroDoc || "")) || new RegExp(`NF\\s*0*${n}(\\D|$)`).test(String(t.titulo || "")))) continue;
    return false;
  }
  return true;
}
// v402 — em lote: quais NFs (nº + CNPJ do cliente) já têm conta a receber lançada — para tirar da previsão o que já foi faturado
export async function nfsComContas(pares) {
  const nums = [...new Set(pares.map((x) => semZ(x.nf)).filter(Boolean))];
  const ok = new Set();
  if (!nums.length) return ok;
  const docOk = (doc, cnpj) => !doc || !cnpj || String(doc).replace(/\D/g, "") === String(cnpj).replace(/\D/g, "");
  const fn = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", acao: "LANCADA", numero: { in: nums } }, select: { numero: true, documento: true, parcelas: true } });
  const ts = await prisma.finTitulo.findMany({ where: { tipo: "RECEBER", status: { not: "CANCELADO" }, OR: nums.map((n) => ({ numeroDoc: { contains: n } })) }, select: { numeroDoc: true, documento: true } });
  for (const { nf, cnpj } of pares) {
    const n = semZ(nf);
    if (fn.some((x) => x.numero === n && docOk(x.documento, cnpj) && Array.isArray(x.parcelas) && x.parcelas.some((y) => y.tituloId))
      || ts.some((t) => docOk(t.documento, cnpj) && new RegExp(`(^|\\D)0*${n}(\\D|$)`).test(String(t.numeroDoc || "")))) ok.add(`${n}|${String(cnpj || "").replace(/\D/g, "")}`);
  }
  return ok;
}
// NFs do pedido com valor (casadas pelos itens no faturamento parcial, ou as do KM), sem repetir
export function nfsDoPedido(p) {
  const m = new Map();
  for (const n of [...(Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []), ...(Array.isArray(p.kmNfs) ? p.kmNfs : [])]) {
    const k = semZ(n.numero); if (k && !m.has(k)) m.set(k, Number(n.valor) || 0);
  }
  return [...m.entries()].map(([nf, valor]) => ({ nf, valor }));
}

// fatura já (contas lançadas) ou deixa pendente em andamento — "dados" é o que iria junto com status FATURADO
export async function faturarOuPendurar(id, cnpj, dados, origem) {
  const nums = nfsDe(dados.nfNumero);
  if (await contasLancadas(nums, cnpj)) {
    return prisma.pedidoVenda.update({ where: { id }, data: { ...dados, status: "FATURADO", faturamentoPendente: null } });
  }
  const { status, obs, atualizadoPorNome, ...resto } = dados;
  const pend = { ...resto, faturadoEm: dados.faturadoEm ? new Date(dados.faturadoEm).toISOString().slice(0, 10) : null, origem, em: hojeISO() };
  // saldo a faturar fica como estava: enquanto as contas não existem, o valor segue na previsão do pedido
  return prisma.pedidoVenda.update({ where: { id }, data: { faturamentoPendente: pend,
    ...(dados.nfsFaturadas ? { nfsFaturadas: dados.nfsFaturadas } : {}), ...(atualizadoPorNome ? { atualizadoPorNome } : {}) } });
}
// pendentes cujas contas já foram lançadas → FATURADO
export async function efetivarFaturamentos() {
  const l = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", NOT: { faturamentoPendente: { equals: null } } }, select: { id: true, cnpj: true, obs: true, faturamentoPendente: true } });
  const feitos = [];
  for (const p of l) {
    const f = p.faturamentoPendente || {};
    if (!(await contasLancadas(nfsDe(f.nfNumero), p.cnpj))) continue;
    await prisma.pedidoVenda.update({ where: { id: p.id }, data: { status: "FATURADO", nfNumero: f.nfNumero || null, faturadoEm: f.faturadoEm ? dUTC(f.faturadoEm) : dUTC(hojeISO()),
      vlEntregar: 0, qtEntregar: 0, faturamentoPendente: null, atualizadoPorNome: "SISTEMA",
      obs: [p.obs, `FATURADO: NF ${f.nfNumero} COM CONTAS LANÇADAS (${f.origem || "—"})`].filter(Boolean).join(" · ").slice(0, 1000) } });
    feitos.push(p.id);
  }
  return feitos;
}

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
  return aplicarLidos(lidos, quem);
}

// v386 — aplica PVs/OPs já lidos (PDF ou banco do KM) — mesmo fluxo para os dois
export async function aplicarLidos(lidos0, quem) {
  const out = [];
  // v552 — pedido na lixeira não é recriado por PDF de PV/PP nem pelo relatório de vendas
  const excl = await (await import("@/lib/pedidoLixeira")).numerosExcluidos();
  const lidos = (lidos0 || []).map((x) => (x.tipo === "POSICAO" ? { ...x, pedidos: (x.pedidos || []).filter((p) => !excl.has(String(p.numero))) } : x))
    .filter((x) => { if (x.tipo !== "POSICAO" && x.numero && excl.has(String(x.numero))) { out.push({ nome: x.nome, numero: x.numero, erro: `pedido ${x.numero} está na lixeira (excluído) — restaure para importar` }); return false; } return true; });
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
        vendedor: l.vendedor || null, tipoPedido: l.tipoPedido || null, oc: l.oc || null, freteTipo: l.freteTipo || atual?.freteTipo || null, frete: l.frete ?? atual?.frete ?? null,
        obs: atual?.obs || l.obs || null,
        total: r2(l.total), qtd: Math.round(l.qtdTotal || itens.reduce((s, i) => s + (i.qtd || 0), 0)), itens, ...(l.b64 ? { pvPdf: l.b64 } : {}), atualizadoPorNome: quem,
      };
      if (atual) await prisma.pedidoVenda.update({ where: { id: atual.id }, data: dados });
      else await prisma.pedidoVenda.create({ data: { numero: l.numero, ...dados, criadoPorNome: quem } });
      out.push({ nome: l.nome, tipo: "PV", numero: l.numero, cliente: dados.cliente, total: dados.total, novo: !atual });
    } else {
      const itens = [...itensAtuais];
      for (const it of l.itens) {
        const k = itens.findIndex((x) => (it.codigo && x.codigo === it.codigo));
        const pp = { op: it.op, seq: it.seq, parametros: it.parametros, descricaoPP: it.descricao, qtdPP: it.qtd, ...(it.kmOps ? { kmOps: it.kmOps } : {}) };
        if (k >= 0) itens[k] = { ...itens[k], ...pp, descricao: it.descricao || itens[k].descricao };
        else itens.push({ codigo: it.codigo || null, descricao: it.descricao, qtd: it.qtd || 0, ...pp });
      }
      const dados = { itens, ...(l.b64 ? { ppPdf: l.b64 } : {}), atualizadoPorNome: quem };
      if (atual) await prisma.pedidoVenda.update({ where: { id: atual.id }, data: { ...dados, despacho: atual.despacho || (l.despacho ? dUTC(l.despacho) : null) } });
      else await prisma.pedidoVenda.create({ data: { numero: l.numero, cliente: l.cliente || "SEM CLIENTE", emissao: l.emissao ? dUTC(l.emissao) : null,
        despacho: l.despacho ? dUTC(l.despacho) : null, total: 0, qtd: l.itens.reduce((s, i) => s + (i.qtd || 0), 0), ...dados, criadoPorNome: quem } });
      out.push({ nome: l.nome, tipo: "PP", numero: l.numero, cliente: l.cliente || atual?.cliente, itens: l.itens.length, novo: !atual, semPv: !atual?.pvPdf && !l.fonteKm });
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
export async function aplicarPosicaoVendas(l0, quem) {
  const excl = await (await import("@/lib/pedidoLixeira")).numerosExcluidos();   // v552
  const l = { ...l0, pedidos: (l0.pedidos || []).filter((p) => !excl.has(String(p.numero))) };
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
        // v391 — saldo zerado no relatório não fatura sozinho: só com a NF e as contas lançadas (NF do KM / movimento fiscal)
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
  const entradaCalc = r2(r2(p.total) * cond.entradaPct);   // v403 — entrada é % do pedido (não do saldo a faturar)
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
    // v403 — diferença de centavos (arredondamento entre total do PV e soma dos itens) não vira "entrada a lançar"
    const tolEnt = Math.max(1, entrada * 0.005);
    if (entrada > 0 && entradaLancada + tolEnt < entrada) {
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
// v372 — lê do XML da NF de saída o que interessa para casar com o pedido
export function lerNfItens(xml) {
  const t = String(xml || "");
  const tag = (src, k) => (src.match(new RegExp(`<${k}>([^<]*)</${k}>`)) || [])[1] || "";
  const dest = (t.match(/<dest>([\s\S]*?)<\/dest>/) || [])[1] || "";
  const itens = [...t.matchAll(/<det nItem="\d+">([\s\S]*?)<\/det>/g)].map((m) => ({
    codigo: tag(m[1], "cProd").trim(), descricao: tag(m[1], "xProd").trim(), qtd: Number(tag(m[1], "qCom")) || 0, valor: Number(tag(m[1], "vProd")) || 0, cfop: tag(m[1], "CFOP"),
  }));
  const inf = tag(t, "infCpl");
  const oc = ((inf.match(/Pedido de Compra:\s*([^|]*)/i) || [])[1] || "").split("/").map((x) => x.trim()).filter(Boolean);
  return { numero: tag(t, "nNF").replace(/^0+(?=\d)/, ""), emissao: tag(t, "dhEmi").slice(0, 10), cnpj: soD(tag(dest, "CNPJ") || tag(dest, "CPF")), nome: tag(dest, "xNome"),
    valorProd: itens.reduce((a, i) => a + i.valor, 0), valorNf: Number(tag(t, "vNF")) || itens.reduce((a, i) => a + i.valor, 0), itens, oc };
}
const normOc = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+/, "");
const codBase = (c) => String(c || "").trim().toUpperCase();

// v375 — nome do produto comparável entre NF e PCP: sem acento, sem o tamanho no fim, palavras ≥ 2 letras
const SEM_PALAVRA = new Set(["COM", "DE", "DA", "DO", "DAS", "DOS", "EM", "PV"]);
const TAM = /^(PP|P|M|G|GG|XG|XGG|XXG|XXGG|EG|EGG|EXG|G[1-6]|LXG|ESPECIAL|UNICO|U|\d{1,2})$/;
function palavrasProd(s) {
  let t = String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const partes = t.split(/\s+-\s+/); if (partes.length > 1 && TAM.test(partes[partes.length - 1].trim())) partes.pop();
  return new Set(partes.join(" ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 2 && !SEM_PALAVRA.has(w)));
}
const simProd = (a, b) => { const A = palavrasProd(a), B = palavrasProd(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size); };

// v374 — peças do pedido: do PV/relatório; sem isso, a soma de peças do PCP (sem complementos)
const pecasDoPedido = (p) => Number(p.qtd) || (Array.isArray(p.cronoItens) ? p.cronoItens.reduce((a, i) => a + (Number(i.pecas ?? i.qtd) || 0), 0) : 0) || Number(p.qtEntregar) || 0;

// v372 — NF ↔ pedido pelos ITENS: mesmo cliente (CNPJ) + códigos dos produtos (+ O.C. quando houver). Soma as quantidades das NFs:
// tudo entregue → FATURADO; parte → continua em andamento com o saldo a faturar (vlEntregar/qtEntregar) e as NFs anotadas.
export async function faturarPelasNfsItens() {
  // v374 — pedido fechado pela regra antiga (só valor ±2%) volta a ser conferido pelas peças: faturamento parcial não pode sumir do em andamento
  const velhos = (await prisma.pedidoVenda.findMany({ where: { status: "FATURADO", atualizadoPorNome: "SISTEMA", obs: { contains: "FATURADO AUTOMÁTICO PELA NF" } },
    select: { id: true, obs: true, nfsFaturadas: true } })).filter((p) => !(Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length));
  for (const p of velhos) await prisma.pedidoVenda.update({ where: { id: p.id }, data: { status: "ANDAMENTO", nfNumero: null, faturadoEm: null,
    obs: String(p.obs || "").split(" · ").filter((x) => !x.startsWith("FATURADO AUTOMÁTICO PELA NF")).join(" · ") || null } });
  // v375 — uma vez: desfaz as baixas por peças (v374) dos pedidos sem PV para refazer pelos produtos do PCP
  const K375 = "PEDIDOS|REFAZ_V375";
  if (!(await prisma.finConfig.findUnique({ where: { chave: K375 } }).catch(() => null))) {
    const lp = await prisma.pedidoVenda.findMany({ select: { id: true, status: true, itens: true, total: true, obs: true, nfsFaturadas: true } });
    for (const p of lp) {
      const temCod = (Array.isArray(p.itens) ? p.itens : []).some((i) => i.codigo);
      if (temCod || !(Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length)) continue;
      await prisma.pedidoVenda.update({ where: { id: p.id }, data: { nfsFaturadas: [], vlEntregar: Number(p.total), qtEntregar: null,
        ...(p.status === "FATURADO" ? { status: "ANDAMENTO", nfNumero: null, faturadoEm: null } : {}),
        obs: String(p.obs || "").split(" · ").filter((x) => !/^(PARCIALMENTE FATURADO|FATURADO PELA\(S\) NF)/.test(x)).join(" · ") || null } });
    }
    await prisma.finConfig.upsert({ where: { chave: K375 }, create: { chave: K375, valor: new Date().toISOString() }, update: { valor: new Date().toISOString() } });
  }
  const and = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false },
    select: { id: true, numero: true, cliente: true, cnpj: true, emissao: true, total: true, qtd: true, itens: true, oc: true, obs: true, nfsFaturadas: true, vlEntregar: true, qtEntregar: true, cronoItens: true } });
  if (!and.length) return [];
  const todosPv = await prisma.pedidoVenda.findMany({ select: { id: true, status: true, nfNumero: true, oc: true, cnpj: true, nfsFaturadas: true } });   // Json: filtra aqui, não no banco
  const usadas = new Set(todosPv.flatMap((p) => (Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []).map((n) => n.chave)));
  // v375 — NF já usada para fechar outro pedido (nº gravado à mão ou pela regra por valor) não é reaproveitada
  const nfFechada = new Set(todosPv.filter((p) => p.status === "FATURADO" && p.nfNumero).flatMap((p) => String(p.nfNumero).split(/[,\s]+/)).filter(Boolean).map((n) => n.replace(/^0+/, "")));
  // v375 — O.C. → pedido (todos os status): NF com a O.C. de um pedido já faturado/fora da lista não vai para outro pedido
  const ocDe = new Map(); for (const p of todosPv) if (p.oc) ocDe.set(normOc(p.oc), p);
  const desde = new Date(Math.min(...and.map((p) => (p.emissao ? +p.emissao : Date.now() - 400 * 864e5))));
  const notas = await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", temXml: true, emissao: { gte: desde }, OR: [{ motivo: null }, { NOT: { motivo: { contains: "CANCELAD" } } }] },   // v374.1 — NOT sozinho descartava motivo nulo (as lançadas)
    select: { chave: true, chaveRegistro: true, xml: true, acao: true, natureza: true }, orderBy: { emissao: "asc" } });
  const feitos = [];
  for (const fn of notas) {
    const ch = fn.chave || fn.chaveRegistro;
    if (usadas.has(ch) || !/VENDA/i.test(fn.natureza || "VENDA")) continue;
    const nf = lerNfItens(fn.xml);
    if (!nf.itens.length || nfFechada.has(nf.numero)) continue;
    const ocs = nf.oc.map(normOc).filter(Boolean);
    const dono = ocs.map((o) => ocDe.get(o)).find(Boolean);
    if (dono && dono.status !== "ANDAMENTO") continue;   // a O.C. é de um pedido já faturado/cancelado
    let melhor = null;
    for (const p of and) {
      if (p.status === "FATURADO") continue;
      const pc = soD(p.cnpj);
      const mesmoCliente = pc && nf.cnpj ? pc === nf.cnpj : mesmoNome(p.cliente, nf.nome);
      if (!mesmoCliente) continue;
      if (p.emissao && iso(p.emissao) > nf.emissao) continue;
      if (dono && dono.id !== p.id) continue;   // v375 — a O.C. da NF é de outro pedido
      const itens = Array.isArray(p.itens) ? p.itens : [];
      const pedido = {}; for (const i of itens) if (i.codigo) pedido[codBase(i.codigo)] = (pedido[codBase(i.codigo)] || 0) + (Number(i.qtd) || 0);
      const ja = {}; for (const n of Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : []) for (const [c, q] of Object.entries(n.itens || {})) ja[c] = (ja[c] || 0) + q;
      let casados = 0, cabem = 0;
      const porCod = {};
      // v375 — sem códigos do PV: cada item da NF vai para o produto do PCP com o nome mais parecido (a chave é o item do PCP)
      const pcp = !Object.keys(pedido).length && Array.isArray(p.cronoItens) ? p.cronoItens.filter((i) => !i.complemento && Number(i.pecas ?? i.qtd) > 0) : [];
      if (pcp.length) {
        for (const i of pcp) { const k = `PCP:${i.itemCode || i.produto}`; pedido[k] = (pedido[k] || 0) + Number(i.pecas ?? i.qtd); }
        for (const i of nf.itens) {
          let best = null, sc = 0;
          for (const q of pcp) { const v = simProd(i.descricao, q.produto); if (v > sc) { sc = v; best = q; } }
          const k = best && sc >= 0.6 ? `PCP:${best.itemCode || best.produto}` : `?${codBase(i.codigo)}`;
          porCod[k] = (porCod[k] || 0) + i.qtd;
        }
      } else for (const i of nf.itens) porCod[codBase(i.codigo)] = (porCod[codBase(i.codigo)] || 0) + i.qtd;
      for (const [c, q] of Object.entries(porCod)) if (pedido[c] != null) { casados++; if (q <= (pedido[c] - (ja[c] || 0)) + 0.001) cabem++; }
      const ocOk = ocs.length && p.oc && ocs.some((o) => normOc(p.oc).includes(o) || o.includes(normOc(p.oc)));
      // v374 — pedido sem itens do PV (veio do relatório): confere pelas PEÇAS (pedido ou PCP) e pelo valor
      let porPecas = null;
      if (!Object.keys(pedido).length) {   // sem PV e sem produtos do PCP: só peças/valor
        const qtdPed = pecasDoPedido(p);
        const lst = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
        const jaPecas = lst.reduce((a, n) => a + (Number(n.pecas) || 0), 0), jaValor = lst.reduce((a, n) => a + (Number(n.valor) || 0), 0);
        const nfPecas = nf.itens.reduce((a, i) => a + i.qtd, 0);
        const saldo = Number(p.total) - jaValor;
        const valorOk = [nf.valorNf, nf.valorProd].some((v) => saldo > 0 && v <= saldo * 1.02 + 0.01 && v >= saldo * 0.5);
        const pecasCabem = qtdPed > 0 && nfPecas <= qtdPed - jaPecas + 0.001;
        if (!(valorOk || pecasCabem) && !ocOk) continue;
        if (qtdPed > 0 && !pecasCabem) continue;   // mais peças do que o pedido tem: não é este
        porPecas = { qtdPed };
        const score = (ocOk ? 100 : 0) + (valorOk ? 20 : 0) + (pecasCabem ? 15 : 0) - Math.abs(saldo - nf.valorNf) / Math.max(1, saldo);
        if (!melhor || score > melhor.score) melhor = { p, score, porCod, pedido, ja, porPecas };
        continue;
      }
      if (!casados && !ocOk) continue;
      // v375 — pelo PCP exige que tudo da NF caiba no saldo dos produtos (senão a NF é de outro pedido)
      if (pcp.length && (casados < Object.keys(porCod).length || cabem < casados) && !ocOk) continue;
      const score = (ocOk ? 100 : 0) + cabem * 10 + casados - (casados < Object.keys(porCod).length ? 5 : 0);
      if (!melhor || score > melhor.score) melhor = { p, score, porCod, pedido, ja, modo: pcp.length ? "PCP" : "PV" };
    }
    if (!melhor) continue;
    const { p, porCod, pedido, porPecas, modo } = melhor;
    // valor faturado: total da NF (com frete) quando cabe no pedido; senão só os produtos
    const lista0 = Array.isArray(p.nfsFaturadas) ? p.nfsFaturadas : [];
    const jaV = lista0.reduce((a, n) => a + (Number(n.valor) || 0), 0);
    const vNf = jaV + nf.valorNf <= Number(p.total) + 0.01 ? nf.valorNf : nf.valorProd;
    const lista = [...lista0, { chave: ch, numero: nf.numero, emissao: nf.emissao, valor: r2(vNf), modo: modo || (porPecas ? "PECAS" : "PV"), pecas: nf.itens.reduce((a, i) => a + i.qtd, 0), itens: porCod }];
    const fat = {}; for (const n of lista) for (const [c, q] of Object.entries(n.itens || {})) fat[c] = (fat[c] || 0) + q;
    const valorFat = r2(lista.reduce((a, n) => a + (Number(n.valor) || 0), 0));
    const pecasFat = lista.reduce((a, n) => a + (Number(n.pecas) || 0), 0);
    const codsPedido = Object.keys(pedido);
    // pedido com códigos: só fecha quando TODAS as quantidades foram entregues; sem códigos, pelo valor (±2%)
    const completo = codsPedido.length ? codsPedido.every((c) => (fat[c] || 0) + 0.001 >= pedido[c])
      : porPecas?.qtdPed > 0 ? pecasFat + 0.001 >= porPecas.qtdPed : valorFat >= Number(p.total) * 0.98;
    const nums = lista.map((n) => n.numero).join(", ");
    const dataBR = (s) => s.split("-").reverse().join("/");
    const qtdTotal = codsPedido.length ? Number(p.qtd) || codsPedido.reduce((a, c) => a + pedido[c], 0) : porPecas?.qtdPed || Number(p.qtd) || 0;
    const data = completo
      ? { status: "FATURADO", nfNumero: nums.slice(0, 190), faturadoEm: dUTC(nf.emissao), nfsFaturadas: lista, vlEntregar: 0, qtEntregar: 0,
          obs: [p.obs, `FATURADO PELA(S) NF ${nums} (${dataBR(nf.emissao)}) — ${porPecas ? "peças conferidas com o pedido/PCP" : modo === "PCP" ? "produtos conferidos com o PCP" : "itens conferidos com o pedido"}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" }
      : { nfsFaturadas: lista, vlEntregar: r2(Math.max(0, Number(p.total) - valorFat)), qtEntregar: Math.max(0, qtdTotal - pecasFat),
          obs: [String(p.obs || "").replace(/ · PARCIALMENTE FATURADO[^·]*/g, ""), `PARCIALMENTE FATURADO: NF ${nums} — ${pecasFat} de ${qtdTotal || "?"} peças, R$ ${valorFat.toFixed(2).replace(".", ",")}`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" };
    if (completo) await faturarOuPendurar(p.id, p.cnpj, data, "NF PELOS ITENS");   // v391
    else await prisma.pedidoVenda.update({ where: { id: p.id }, data });
    Object.assign(p, data);
    usadas.add(ch);
    feitos.push({ numero: p.numero, nf: nf.numero, completo });
  }
  return feitos;
}

export async function faturarPelasNfs() {
  // v372 — primeiro pelos itens das NFs (faturamento total ou parcial); depois a regra antiga por valor para as NFs sem XML
  await efetivarFaturamentos().catch((e) => console.log("pedidos/efetivar:", e.message));   // v391 — pendentes com contas já lançadas
  const porItens = await faturarPelasNfsItens().catch((e) => { console.log("pedidos/faturar itens:", e.message); return []; });
  const porKm = await faturarPelasNfsKm().catch((e) => { console.log("pedidos/faturar km:", e.message); return []; });   // v554
  const and = (await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false }, select: { id: true, numero: true, cliente: true, cnpj: true, emissao: true, total: true, frete: true, vlEntregar: true, obs: true, nfsFaturadas: true, faturamentoPendente: true } }))
    .filter((p) => !(Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length) && !p.faturamentoPendente);   // v391 — pendente de contas: já tem NF   // já casado pelos itens: não usa a regra por valor
  if (!and.length) return [];
  const desde = new Date(Math.min(...and.map((p) => (p.emissao ? +p.emissao : Date.now() - 400 * 86400000))));
  // v374 — NF com XML no movimento fiscal é tratada pelos itens/peças (acima); aqui só as que não têm XML
  const comXml = new Set((await prisma.fiscalNota.findMany({ where: { tipo: "SAIDA", temXml: true, emissao: { gte: desde } }, select: { chave: true } })).map((x) => x.chave).filter(Boolean));
  const nfs = (await prisma.finNfSaida.findMany({ where: { emissao: { gte: desde } }, select: { chave: true, numero: true, emissao: true, valor: true, destCnpj: true, destNome: true }, orderBy: { emissao: "asc" } }))
    .filter((n) => !comXml.has(n.chave));
  const usadas = new Set((await prisma.pedidoVenda.findMany({ select: { nfNumero: true, nfsFaturadas: true, faturamentoPendente: true } }))
    .flatMap((x) => [...String(x.nfNumero || "").split(/[,\s]+/), ...String(x.faturamentoPendente?.nfNumero || "").split(/[,\s]+/), ...(Array.isArray(x.nfsFaturadas) ? x.nfsFaturadas.map((n) => n.numero) : [])]).filter(Boolean).map((n) => String(n).replace(/^0+/, "")));
  const feitos = [];
  for (const p of and) {
    const alvos = [Number(p.total), Number(p.total) + Number(p.frete || 0), p.vlEntregar != null ? Number(p.vlEntregar) : 0].filter((v) => v > 0);
    const em = p.emissao ? p.emissao.toISOString().slice(0, 10) : "0000-00-00";
    const nf = nfs.find((n) => !usadas.has(String(n.numero).replace(/^0+/, "")) && n.emissao.toISOString().slice(0, 10) >= em
      && (p.cnpj ? soD(n.destCnpj) === soD(p.cnpj) : mesmoNome(p.cliente, n.destNome))
      && alvos.some((v) => Math.abs(Number(n.valor) - v) <= v * 0.02));
    if (!nf) continue;
    usadas.add(String(nf.numero).replace(/^0+/, ""));
    await faturarOuPendurar(p.id, p.cnpj, { status: "FATURADO", nfNumero: String(nf.numero), faturadoEm: nf.emissao, vlEntregar: 0, qtEntregar: 0,
      obs: [p.obs, `FATURADO PELO VALOR DA NF ${nf.numero} (${nf.emissao.toISOString().slice(0, 10).split("-").reverse().join("/")})`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" }, "NF PELO VALOR");   // v391
    feitos.push({ numero: p.numero, nf: nf.numero });
  }
  return [...porItens, ...porKm, ...feitos];
}

// v554 — equivalência pelo KM: as NFs de saída que o próprio KM liga ao pedido (kmNfs do pedido e livsaida com o nº do pedido).
// Somando o valor do pedido (ou o KM sem saldo a entregar), o pedido é faturado — FATURADO se as contas da(s) NF(s) já estão
// lançadas no movimento de saída; senão fica "NF sem contas" até as contas entrarem.
export async function faturarPelasNfsKm() {
  const and = await prisma.pedidoVenda.findMany({ where: { status: "ANDAMENTO", interno: false },
    select: { id: true, numero: true, cnpj: true, total: true, frete: true, vlEntregar: true, obs: true, kmNfs: true, faturamentoPendente: true, nfsFaturadas: true } });
  if (!and.length) return [];
  const km = await prisma.kmNfSaida.findMany({ where: { pedido: { in: and.map((p) => p.numero) }, canceladaEm: null }, select: { numero: true, emissao: true, valor: true, pedido: true } }).catch(() => []);
  const feitos = [];
  for (const p of and) {
    const m = new Map();
    for (const n of Array.isArray(p.kmNfs) ? p.kmNfs : []) if (n?.numero && !n.cancelada) m.set(semZ(n.numero), { numero: semZ(n.numero), emissao: n.emissao ? String(n.emissao).slice(0, 10) : null, valor: Number(n.valor) || 0 });
    for (const n of km.filter((x) => x.pedido === p.numero)) m.set(semZ(n.numero), { numero: semZ(n.numero), emissao: n.emissao ? n.emissao.toISOString().slice(0, 10) : null, valor: Number(n.valor) || 0 });
    const nfs = [...m.values()];
    if (!nfs.length) continue;
    const soma = r2(nfs.reduce((a, n) => a + n.valor, 0));
    const tot = Number(p.total) || 0;
    const completo = (tot > 0 && soma >= tot * 0.98) || (p.vlEntregar != null && Number(p.vlEntregar) <= 0.01);
    if (!completo) continue;
    const nums = nfs.map((n) => n.numero).join(", ");
    const ult = nfs.map((n) => n.emissao).filter(Boolean).sort().pop() || hojeISO();
    if (p.faturamentoPendente && String(p.faturamentoPendente.nfNumero || "") === nums && !(await contasLancadas(nfs.map((n) => n.numero), p.cnpj))) continue;   // já pendente com as mesmas NFs
    await faturarOuPendurar(p.id, p.cnpj, { status: "FATURADO", nfNumero: nums.slice(0, 190), faturadoEm: dUTC(ult), vlEntregar: 0, qtEntregar: 0,
      obs: [p.obs, `FATURADO PELA(S) NF ${nums} LIGADA(S) AO PEDIDO NO KM (R$ ${soma.toFixed(2).replace(".", ",")})`].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: "SISTEMA" }, "NF DO KM");
    feitos.push({ numero: p.numero, nf: nums, completo: true });
  }
  return feitos;
}

// ---------- painel ----------
export async function listarPedidos({ competencia, todos = false, comOcultos = false } = {}) {
  // v317 — programação do Cronograma (no máximo a cada 10 min; erro não impede o painel)
  let crono = null; try { crono = await sincronizar(); } catch (e) { crono = { ok: false, erro: e.message }; }
  const hoje = hojeISO();
  const comp = competencia || hoje.slice(0, 7);
  // v347 — antes de listar: pedido em andamento que já tem NF de saída vira FATURADO sozinho
  let autoFaturados = [];
  try { autoFaturados = await faturarPelasNfs(); } catch (e) { console.log("pedidos/faturar:", e.message); }
  const lista0 = await prisma.pedidoVenda.findMany({ where: todos ? {} : { status: "ANDAMENTO" }, orderBy: [{ despacho: "asc" }, { numero: "asc" }], select: CAMPOS });
  // v389 — o PCP do Maycon é a referência: pedido antigo (antes da integração com o KM) em andamento que não está no Cronograma não aparece
  const desdeKm = process.env.KM_ENTRADA_DESDE || "2026-10-22";
  // v397 — "antigo" = já estava no sistema antes da integração (ou veio na 1ª carga); pedido que o KM trouxe depois aparece mesmo com data antiga
  const novoNoKm = (p) => p.createdAt && new Date(p.createdAt) >= KM_INICIO;
  const foraPcp = (p) => p.status === "ANDAMENTO" && p.cronoSituacao === "NÃO ESTÁ NO CRONOGRAMA" && !novoNoKm(p) && (!p.emissao || iso(p.emissao) < desdeKm);
  const ocultos = lista0.filter(foraPcp);
  // v393 — comOcultos: a tela recebe os antigos fora do PCP marcados (oculto) para listá-los ao clicar no aviso; ficam fora dos totais
  const lista = todos ? lista0 : comOcultos ? lista0.map((p) => (foraPcp(p) ? { ...p, oculto: true } : p)) : lista0.filter((p) => !foraPcp(p));
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

  // v402 — faturamento parcial: o que já foi faturado E tem conta a receber lançada sai da previsão (senão duplica o recebível)
  const pares = lista.filter((p) => p.status === "ANDAMENTO").flatMap((p) => nfsDoPedido(p).map((x) => ({ nf: x.nf, cnpj: p.cnpj })));
  let comContas = new Set(); try { comContas = await nfsComContas(pares); } catch (e) { console.log("pedidos/nfs com contas:", e.message); }
  const pedidos = lista.map((p0) => {
    const nfsP = p0.status === "ANDAMENTO" ? nfsDoPedido(p0) : [];
    const lancadas = nfsP.filter((x) => comContas.has(`${x.nf}|${String(p0.cnpj || "").replace(/\D/g, "")}`));
    const faturadoLancado = r2(lancadas.reduce((a, x) => a + x.valor, 0));
    const baseKm = p0.vlEntregar != null ? Number(p0.vlEntregar) : Number(p0.total);
    const base = faturadoLancado > 0 ? r2(Math.max(0, Math.min(baseKm, Number(p0.total) - faturadoLancado))) : baseKm;
    const p = faturadoLancado > 0 ? { ...p0, vlEntregar: base } : p0;
    const prev = preverPedido(p, { hoje, titulosEntrada: titsDe(p.numero) });
    const em = iso(p.emissao) || "0000-00-00";
    const alvo = [r2(p.total), prev.restante];
    const nfSugerida = p.status === "ANDAMENTO" && !p.interno ? nfs.find((n) => soD(n.destCnpj) === soD(p.cnpj) && iso(n.emissao) >= em && alvo.some((v) => v > 0 && Math.abs(Number(n.valor) - v) <= v * 0.02)) : null;
    const noMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) === comp).reduce((s, x) => s + x.valor, 0));
    const foraMes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) > comp).reduce((s, x) => s + x.valor, 0));
    const antes = r2(prev.parcelas.filter((x) => x.data.slice(0, 7) < comp).reduce((s, x) => s + x.valor, 0));
    return { ...p, total: r2(p.total), vlEntregar: p.vlEntregar != null ? r2(p.vlEntregar) : null,
      faturadoLancado, nfsComContas: lancadas.map((x) => x.nf), nfsSemContas: nfsP.filter((x) => !lancadas.includes(x)).map((x) => x.nf),   // v402   // v393 — Decimal → número (o card somava texto e dava 0)
      entradaValor: p.entradaValor != null ? r2(p.entradaValor) : null, frete: p.frete != null ? r2(p.frete) : null,
      emissao: iso(p.emissao), despacho: iso(p.despacho), entregaPrevista: iso(p.entregaPrevista), faturadoEm: iso(p.faturadoEm), cronoPrazo: iso(p.cronoPrazo), cronoFimProgramado: iso(p.cronoFimProgramado),
      // v388 — vindo do KM conta como PV/PP (o PDF é só um dos meios); os links continuam só quando há PDF
      pdfPv: comPv.has(p.id), pdfPp: comPp.has(p.id),
      temPv: comPv.has(p.id) || String(p.fonte || "").includes("KM"),
      temPp: comPp.has(p.id) || (Array.isArray(p.itens) && p.itens.some((i) => (i.kmOps && i.kmOps.length) || (i.parametros && i.parametros.length))),
      previsao: prev, noMes, foraMes, antes,
      nfSugerida: nfSugerida ? { numero: nfSugerida.numero, emissao: iso(nfSugerida.emissao), valor: r2(nfSugerida.valor) } : null };
  });
  const and = pedidos.filter((p) => p.status === "ANDAMENTO" && !p.interno && !p.oculto);   // v323 — internos (NORT) fora dos totais
  const soma = (l, f) => r2(l.reduce((s, p) => s + f(p), 0));
  const resumo = {
    competencia: comp, hoje,
    // v378 — mesmo critério do painel de previsão: o que AINDA falta faturar (saldo), não o total bruto do pedido
    qtdPedidos: and.filter((p) => (p.vlEntregar != null ? Number(p.vlEntregar) : Number(p.total)) > 0.009).length,
    qtdSemSaldo: and.filter((p) => (p.vlEntregar != null ? Number(p.vlEntregar) : Number(p.total)) <= 0.009).length,
    pecas: and.reduce((s, p) => s + (p.qtEntregar != null ? Number(p.qtEntregar) : (p.qtd || 0)), 0),
    totalAndamento: soma(and, (p) => (p.vlEntregar != null ? p.vlEntregar : p.total)),
    totalBruto: soma(and, (p) => p.total),
    entradasLancadas: soma(and, (p) => p.previsao.entradaLancada),
    aReceberPrevisto: soma(and, (p) => p.previsao.parcelas.reduce((s, x) => s + x.valor, 0)),
    noMes: soma(and, (p) => p.noMes), foraMes: soma(and, (p) => p.foraMes), antes: soma(and, (p) => p.antes),
    entradasPendentes: soma(and, (p) => p.previsao.parcelas.filter((x) => x.pendente).reduce((s, x) => s + x.valor, 0)),
    qtdEntradasPendentes: and.filter((p) => p.previsao.parcelas.some((x) => x.pendente)).length,
    qtdAtrasados: and.filter((p) => p.previsao.atrasado).length,
    qtdReprogPcp: and.filter((p) => p.previsao.reprogramar === "PCP").length,
    qtdReprogDespacho: and.filter((p) => p.previsao.reprogramar === "DESPACHO").length,
    qtdProntos: and.filter((p) => p.previsao.pronto).length,
    // v390 — concluídos no PCP: com NF parcial emitida no KM × sem NF nenhuma (faturar)
    qtdProntosComNf: and.filter((p) => p.previsao.pronto && Array.isArray(p.kmNfs) && p.kmNfs.length).length,
    qtdProntosSemNf: and.filter((p) => p.previsao.pronto && !(Array.isArray(p.kmNfs) && p.kmNfs.length)).length,
    qtdSemCondicao: and.filter((p) => !p.previsao.condicaoOk).length,
    qtdSemPv: and.filter((p) => !p.temPv).length,
    qtdNfSugerida: and.filter((p) => p.nfSugerida).length,
    // por mês (próximos 6)
    porMes: (() => { const m = {}; for (const p of and) for (const x of p.previsao.parcelas) { const c = x.data.slice(0, 7); m[c] = r2((m[c] || 0) + x.valor); } return Object.entries(m).sort().map(([c, v]) => ({ competencia: c, valor: v })); })(),
  };
  resumo.qtdSemCrono = and.filter((p) => !p.entregaPrevista).length;
  resumo.qtdNfSemContas = and.filter((p) => p.faturamentoPendente).length;   // v391 — NF emitida, contas não lançadas
  resumo.qtdForaPcp = ocultos.length;   // v389 — antigos fora do PCP, ocultos
  resumo.foraPcp = ocultos.map((p) => p.numero);
  resumo.qtdInternos = pedidos.filter((p) => p.status === "ANDAMENTO" && p.interno && !p.oculto).length;
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

// v386 — entrada automática (pedido vindo do KM): lança a conta a receber da entrada na data de emissão, com crítica para conferir.
// · já existe e foi lançada pelo KM, em aberto, com valor diferente → atualiza o valor e volta a crítica
// · entrada cancelada à mão não volta; pedido interno / sem entrada na condição não lança
export const QUEM_KM = "KM (AUTOMÁTICO)";
// v397 — fim da 1ª carga do KM (22/10/2026 13:09): o que foi criado depois é pedido novo de verdade
export const KM_INICIO = new Date(process.env.KM_INICIO || "2026-10-22T16:15:00Z");
export async function entradaAutomatica(numero) {
  const p = await prisma.pedidoVenda.findUnique({ where: { numero }, select: { id: true, numero: true, status: true, interno: true, total: true, condicao: true, entradaValor: true, emissao: true, criadoPorNome: true, createdAt: true } });
  if (!p || p.interno || p.status !== "ANDAMENTO" || p.criadoPorNome !== QUEM_KM) return null;   // só pedido cadastrado pelo KM (os antigos, do PDF, ficam como estão)
  // só pedidos emitidos depois que a integração começou (os antigos que chegaram na 1ª carga podem já ter a entrada recebida)
  // v397 — pedido criado pelo KM depois da 1ª carga (a data de emissão pode ser anterior: o PV às vezes é lançado com data de dias atrás)
  if (!p.createdAt || new Date(p.createdAt) < KM_INICIO) return null;
  // entrada lançada à mão com outro título ("PEDIDO 26080045 …") também conta
  const mao = await prisma.finTitulo.findFirst({ where: { tipo: "RECEBER", titulo: { contains: `PEDIDO ${p.numero}` }, NOT: { chaveImport: chaveEntrada(p.numero) } }, select: { id: true } });
  if (mao) return null;
  const prev = preverPedido({ ...p, vlEntregar: null });
  const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chaveEntrada(p.numero) }, select: { id: true, status: true, valor: true, criadoPorNome: true } });
  if (ja) {
    if (ja.status === "ABERTO" && ja.criadoPorNome === QUEM_KM && prev.entrada > 0 && Math.abs(Number(ja.valor) - prev.entrada) > 0.009) {
      await prisma.finTitulo.update({ where: { id: ja.id }, data: { valor: prev.entrada, atualizadoPorNome: QUEM_KM,
        critica: `ENTRADA DO PEDIDO ${p.numero} MUDOU NO KM (${Number(ja.valor).toFixed(2)} → ${prev.entrada.toFixed(2)}) — CONFIRA VALOR E DATA` } });
      return "ATUALIZADA";
    }
    return null;
  }
  if (!(prev.entrada > 0)) return null;
  const t = await lancarEntrada(p.id, {}, QUEM_KM);
  await prisma.finTitulo.update({ where: { id: t.id }, data: { critica: `ENTRADA LANÇADA AUTOMATICAMENTE PELO PEDIDO ${p.numero} DO KM (CONDIÇÃO ${p.condicao || "—"}) — CONFIRA VALOR E DATA` } });
  return "LANCADA";
}
