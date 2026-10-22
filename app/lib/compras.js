// v404 — Compras: FPP base de cada item de pedido, demanda de matéria-prima e levantamento.
import { prisma } from "./prisma";

export const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const vazio = (v) => v == null || String(v).trim() === "";
const n0 = (v) => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// papéis de matéria-prima que a FPP descreve hoje
// MALHA: artigo principal em kg (rendimento peças/kg). PLANO: tecido externo em m (consumo m/peça) + forro em m.
export const PAPEIS = {
  PRINCIPAL: { nomeCampo: "nomeArtigo", detCampo: "artigoDet", valorCampo: "mpValor" },
  FORRO: { nomeCampo: "nomeArtigoForro", detCampo: "artigoForroDet", valorCampo: "forroValor" },
};

// campos que distinguem um artigo do outro (vazio = não distingue)
export const CAMPOS_ID = ["fornecedorId", "cor", "codigo"];

function paramValor(params, tipo, grupo, chave, overrides) {
  const path = `${grupo}:${chave}:valor`;
  if (overrides && !vazio(overrides[path])) return n0(overrides[path]) || 0;
  const row = params.find((p) => p.tipo === tipo && p.grupo === grupo && p.chave === chave)
    || params.find((p) => p.tipo === "COMUM" && p.grupo === grupo && p.chave === chave);
  return row ? Number(row.valor) || 0 : 0;
}

// matérias-primas da FPP com consumo por peça (na unidade de compra)
export function materiaisDaFpp(fpp, params = []) {
  const e = fpp.entradas || {};
  const r = fpp.resultados || {};
  const ov = fpp.overrides || {};
  const tipo = fpp.tipo === "PLANO" ? "PLANO" : "MALHA";
  const rendCons = n0(r.rendCons) ?? paramValor(params, tipo, "PECA", fpp.item, ov);
  const out = [];
  const nomeP = String(e.nomeArtigo || "").trim();
  if (nomeP) {
    const consumo = tipo === "MALHA" ? (rendCons ? 1 / rendCons : 0) : rendCons;
    out.push({ papel: "PRINCIPAL", categoria: tipo === "MALHA" ? "MALHA" : "TECIDO", unidade: tipo === "MALHA" ? "KG" : "M",
      nome: nomeP.toUpperCase(), det: e.artigoDet || {}, consumoPorPeca: consumo, valorUnitario: n0(e.mpValor),
      base: tipo === "MALHA" ? `${String(rendCons).replace(".", ",")} peças/kg` : `${String(rendCons).replace(".", ",")} m/peça` });
  }
  const nomeF = String(e.nomeArtigoForro || "").trim();
  if (tipo === "PLANO" && nomeF) {
    const cf = n0(e.consumoForro) || n0(r.consumoForro) || paramValor(params, "PLANO", "CONST", "FORRO_FATOR", ov) * rendCons;
    out.push({ papel: "FORRO", categoria: "TECIDO", unidade: "M", nome: nomeF.toUpperCase(), det: e.artigoForroDet || {},
      consumoPorPeca: cf, valorUnitario: n0(e.forroValor), base: `${String(r3(cf)).replace(".", ",")} m/peça` });
  }
  return out;
}

// ---------- cadastro automático do artigo a partir da FPP ----------
const chaveDet = (d) => ({
  fornecedorId: d.fornecedorId ? Number(d.fornecedorId) : null,
  cor: vazio(d.cor) ? null : norm(d.cor),
  codigo: vazio(d.codigo) ? null : norm(d.codigo),
});
const temAlgumDetalhe = (d) => d && ["fornecedorId", "cor", "codigo", "largura", "rendimento", "tipoMalha"].some((k) => !vazio(d[k]));

// procura o artigo idêntico (mesma categoria, nome e mesmos campos de identificação, vazio = vazio); senão cria
export async function artigoDaFpp(m, fpp, db = prisma) {
  const k = chaveDet(m.det || {});
  const cands = await db.artigo.findMany({ where: { ativo: true, categoria: m.categoria, nome: { equals: m.nome, mode: "insensitive" } },
    select: { id: true, fornecedorId: true, cor: true, codigo: true, origem: true } });
  const igual = cands.find((a) => (a.fornecedorId || null) === k.fornecedorId && (a.cor ? norm(a.cor) : null) === k.cor && (a.codigo ? norm(a.codigo) : null) === k.codigo);
  const d = m.det || {};
  const dados = {
    ...(n0(d.largura) != null ? { largura: n0(d.largura) } : {}),
    ...(m.categoria === "MALHA" && n0(d.rendimento) != null ? { rendimento: n0(d.rendimento) } : {}),
    ...(m.categoria === "MALHA" && ["RAMADA", "TUBULAR"].includes(d.tipoMalha) ? { tipoMalha: d.tipoMalha } : {}),
    ...(m.valorUnitario != null ? { valorUnitario: m.valorUnitario } : {}),
  };
  if (igual) {
    if (Object.keys(dados).length) await db.artigo.update({ where: { id: igual.id }, data: dados });
    return igual.id;
  }
  const novo = await db.artigo.create({ data: {
    categoria: m.categoria, nome: m.nome, unidade: m.unidade, fornecedorId: k.fornecedorId, cor: k.cor, codigo: k.codigo,
    ...dados, origem: "FPP", origemFppId: fpp.id,
  }, select: { id: true } });
  return novo.id;
}

// chamada depois de salvar a FPP: garante o cadastro de cada artigo e grava o id no detalhe
export async function sincronizarArtigosFpp(fpp, db = prisma) {
  const e = fpp.entradas || {};
  let mudou = false;
  const novas = { ...e };
  for (const m of materiaisDaFpp(fpp)) {
    const campoDet = PAPEIS[m.papel].detCampo;
    // só cadastra quando alguém abriu o "+" e preencheu algo (FPP de proposta não enche o cadastro);
    // sem detalhe, o cadastro pelo nome acontece quando a FPP vira base de um pedido (demandaDoItem)
    if (!temAlgumDetalhe(m.det)) continue;
    const id = await artigoDaFpp(m, fpp, db);
    if ((novas[campoDet] || {}).artigoId !== id) { novas[campoDet] = { ...(novas[campoDet] || {}), artigoId: id }; mudou = true; }
  }
  if (mudou) await db.fpp.update({ where: { id: fpp.id }, data: { entradas: novas } });
  return mudou;
}

// ---------- itens dos pedidos ----------
export function itensDoPedido(p) {
  const vistos = {};
  return (Array.isArray(p.itens) ? p.itens : []).map((it, i) => {
    const cod = String(it.codigo || `ITEM${i + 1}`).trim();
    vistos[cod] = (vistos[cod] || 0) + 1;
    const qtd = Number(it.qtd) || (it.grade || []).reduce((s, g) => s + (Number(g.qtd) || 0), 0);
    return { chave: vistos[cod] > 1 ? `${cod}#${vistos[cod]}` : cod, codigo: it.codigo || null, descricao: it.descricao || "", qtd, preco: n0(it.preco), grade: it.grade || [] };
  });
}

// ---------- sugestão de FPP ----------
const PARADAS = new Set(["DE", "DA", "DO", "COM", "E", "EM", "SEM", "PARA", "C/", "S/", "-", "/", "MC", "ML"]);
const tokens = (s) => new Set(norm(s).replace(/[^A-Z0-9 ]/g, " ").split(" ").filter((t) => t.length > 1 && !PARADAS.has(t)));
function similaridade(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
const soDig = (s) => String(s || "").replace(/\D/g, "");

// fpps: lista completa; clientes: [{id, cnpj, razaoSocial, nomeFantasia}]
export function sugerirFpps(item, pedido, fpps, clientes, max = 5) {
  const cnpj = soDig(pedido.cnpj);
  const cli = cnpj ? clientes.find((c) => soDig(c.cnpj) === cnpj) : null;
  const nomeCli = norm(pedido.cliente);
  const doCliente = (f) => (cli && f.clienteId === cli.id)
    || (nomeCli && f.clienteNome && (norm(f.clienteNome) === nomeCli || (cli && [cli.razaoSocial, cli.nomeFantasia].some((n) => n && norm(n) === norm(f.clienteNome)))))
    || (nomeCli && f.clienteNome && similaridade(f.clienteNome, pedido.cliente) >= 0.8);
  const base = fpps.filter(doCliente);
  const pontua = (f) => {
    const nome = Math.max(similaridade(item.descricao, f.nomeComercial || ""), similaridade(item.descricao, f.item || "") * 0.8);
    const vp = Number(f.valorProposto) || 0;
    const preco = Number(item.preco) || 0;
    const valor = vp && preco ? Math.max(0, 1 - Math.abs(vp - preco) / preco) : 0;
    return { nome, valor, score: nome * 60 + valor * 40 };
  };
  return base.map((f) => ({ f, ...pontua(f) }))
    .filter((x) => x.nome > 0 || x.valor > 0.9)
    .sort((a, b) => b.score - a.score || new Date(b.f.createdAt) - new Date(a.f.createdAt))
    .slice(0, max)
    .map(({ f, nome, valor, score }) => ({ id: f.id, numero: f.numero, item: f.item, nomeComercial: f.nomeComercial, negociacao: f.negociacao,
      valorProposto: f.valorProposto, createdAt: f.createdAt, score: Math.round(score), nome: Math.round(nome * 100), valor: Math.round(valor * 100) }));
}

// ---------- demanda ----------
export async function demandaDoItem(fpp, qtd, db = prisma) {
  const params = await db.fppParam.findMany({ where: { ativo: true }, select: { tipo: true, grupo: true, chave: true, valor: true } });
  const mats = materiaisDaFpp(fpp, params);
  const ids = mats.map((m) => (m.det || {}).artigoId).filter(Boolean);
  const arts = ids.length ? await db.artigo.findMany({ where: { id: { in: ids } }, include: { fornecedor: { select: { id: true, nome: true } } } }) : [];
  const porId = Object.fromEntries(arts.map((a) => [a.id, a]));
  const out = [];
  for (const m of mats) {
    let artigoId = (m.det || {}).artigoId;
    if (!artigoId || !porId[artigoId]) {   // FPP antiga, sem detalhe: cadastra pelo nome
      artigoId = await artigoDaFpp(m, fpp, db);
      porId[artigoId] = await db.artigo.findUnique({ where: { id: artigoId }, include: { fornecedor: { select: { id: true, nome: true } } } });
    }
    const a = porId[artigoId];
    out.push({ papel: m.papel, artigoId, nome: a.nome, categoria: a.categoria, unidade: m.unidade,
      fornecedorId: a.fornecedorId, fornecedor: a.fornecedor?.nome || null, cor: a.cor, codigo: a.codigo,
      largura: a.largura != null ? Number(a.largura) : null, base: m.base,
      consumoPorPeca: Math.round(m.consumoPorPeca * 10000) / 10000, quantidade: r3(m.consumoPorPeca * qtd), valorUnitario: m.valorUnitario, equiparadoA: null });
  }
  return out;
}

// ---------- levantamento: equiparação e consolidado ----------
// A (menos detalhado) pode juntar ao B quando: mesma categoria, mesmo nome, e todo campo preenchido em A é igual em B,
// com B tendo ao menos um campo a mais preenchido.
export function podeEquiparar(a, b) {
  if (a.artigoId === b.artigoId || a.categoria !== b.categoria || norm(a.nome) !== norm(b.nome) || a.unidade !== b.unidade) return false;
  let aMais = 0;
  for (const k of CAMPOS_ID) {
    const va = vazio(a[k]) ? null : norm(a[k]), vb = vazio(b[k]) ? null : norm(b[k]);
    if (va != null && va !== vb) return false;
    if (va == null && vb != null) aMais++;
  }
  return aMais > 0;
}

export function montarLevantamento(itens) {
  const linhas = [];
  for (const it of itens) (Array.isArray(it.demanda) ? it.demanda : []).forEach((d, idx) => linhas.push({ ...d, itemId: it.id, idx, pedidoNumero: it.pedidoNumero, chave: it.chave, descricao: it.descricao, cliente: it.cliente, entrega: it.entrega, qtdPecas: Number(it.quantidade) }));
  // artigos distintos que aparecem
  const arts = {};
  for (const l of linhas) if (!arts[l.artigoId]) arts[l.artigoId] = { artigoId: l.artigoId, nome: l.nome, categoria: l.categoria, unidade: l.unidade, fornecedorId: l.fornecedorId, fornecedor: l.fornecedor, cor: l.cor, codigo: l.codigo, largura: l.largura };
  const lista = Object.values(arts);
  // sugestões: para cada artigo sem equiparação aceita, os mais detalhados compatíveis
  const equiparacoes = [];
  for (const a of lista) {
    const pendentes = linhas.filter((l) => l.artigoId === a.artigoId && !l.equiparadoA);
    if (!pendentes.length) continue;
    const alvos = lista.filter((b) => podeEquiparar(a, b));
    if (alvos.length) equiparacoes.push({ de: a, para: alvos, quantidade: r3(pendentes.reduce((s, l) => s + l.quantidade, 0)), linhas: pendentes.length });
  }
  // consolidado: pelo artigo efetivo (equiparado ou o próprio)
  const cons = {};
  for (const l of linhas) {
    const efetivo = l.equiparadoA || l.artigoId;
    const a = arts[efetivo] || arts[l.artigoId];
    const c = (cons[efetivo] ||= { ...a, artigoId: efetivo, quantidade: 0, pedidos: new Set(), itens: 0, juntados: new Set(), valorEstimado: 0 });
    c.quantidade += l.quantidade; c.pedidos.add(l.pedidoNumero); c.itens++;
    if (l.equiparadoA) c.juntados.add(l.artigoId);
    if (l.valorUnitario) c.valorEstimado += l.quantidade * l.valorUnitario;
  }
  const consolidado = Object.values(cons).map((c) => ({ ...c, quantidade: r3(c.quantidade), valorEstimado: Math.round(c.valorEstimado * 100) / 100,
    pedidos: [...c.pedidos], juntados: [...c.juntados].map((id) => arts[id]) })).sort((a, b) => a.nome.localeCompare(b.nome));
  return { linhas, equiparacoes, consolidado };
}
