// v404 — Compras: FPP base de cada item de pedido, demanda de matéria-prima e levantamento.
import { prisma } from "./prisma";
import { elasticoCalc, faixaCalc, botaoUnit, nomeFaixaCompra, obsBotao, ehPecaAberta, ehRevenda } from "./fppAv";   // v410 · v512

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

// papéis de matéria-prima que a FPP descreve
// MALHA: artigo principal em kg (rendimento peças/kg). PLANO: tecido externo em m (consumo m/peça) + forro em m.
// v405 — aviamentos (gola, punho, elástico, faixa, botão e extras) sempre em unidades; botão compra em grosa (144).
export const GROSA = 144;
export const AVIAMENTOS = [
  { chave: "GOLA", campo: "gola", tipo: "MALHA", prefixo: "GOLA" },
  { chave: "PUNHO", campo: "punho", tipo: "MALHA", prefixo: "PUNHO" },
  { chave: "ELASTICO", campo: "elastico", tipo: "PLANO", prefixo: "ELÁSTICO" },
  { chave: "FAIXA", campo: "faixa", prefixo: "FAIXA" },
];
const nomeAv = (pref, v) => { const n = String(v || "").trim().toUpperCase(); return norm(n).startsWith(norm(pref)) ? n : `${pref} ${n}`; };
const ehSem = (v) => vazio(v) || /^SEM\b/.test(norm(v));
// v522 — gola viés sai do próprio tecido da peça: não é aviamento (não entra na compra nem no levantamento)
export const ehGolaVies = (v) => /\bVIES\b/.test(norm(v));

// campos que distinguem um artigo do outro (vazio = não distingue)
export const CAMPOS_ID = ["fornecedorId", "cor", "codigo"];

function paramValor(params, tipo, grupo, chave, overrides) {
  const path = `${grupo}:${chave}:valor`;
  if (overrides && !vazio(overrides[path])) return n0(overrides[path]) || 0;
  const row = params.find((p) => p.tipo === tipo && p.grupo === grupo && p.chave === chave)
    || params.find((p) => p.tipo === "COMUM" && p.grupo === grupo && p.chave === chave)
    || params.find((p) => p.grupo === grupo && p.chave === chave);   // v512 — acessório: aviamento do outro tipo
  return row ? Number(row.valor) || 0 : 0;
}

// v410 — parâmetro qualquer (valor ou campo do extra), com o override da ficha
function paramGet(params, tipo, grupo, chave, campo, overrides) {
  const path = `${grupo}:${chave}:${campo}`;
  if (overrides && !vazio(overrides[path])) return n0(overrides[path]) || 0;
  const row = params.find((p) => p.tipo === tipo && p.grupo === grupo && p.chave === chave)
    || params.find((p) => p.tipo === "COMUM" && p.grupo === grupo && p.chave === chave)
    || params.find((p) => p.grupo === grupo && p.chave === chave);   // v512
  if (!row) return 0;
  return campo === "valor" ? Number(row.valor) || 0 : Number(row.extra?.[campo]) || 0;
}

// matérias-primas da FPP com consumo por peça (na unidade de compra)
// ref diz onde o detalhe mora em entradas: { campo } | { campo, chave } | { campo, idx }
export function materiaisDaFpp(fpp, params = []) {
  const e = fpp.entradas || {};
  const r = fpp.resultados || {};
  const ov = fpp.overrides || {};
  if (ehRevenda(fpp.item, fpp.tipo)) return [];   // v512 — revenda: compra o produto pronto, sem matéria-prima
  const tipo = fpp.tipo === "PLANO" ? "PLANO" : "MALHA";
  const aberta = ehPecaAberta(fpp.item);   // v512 — acessório: forro e todos os aviamentos
  const rendCons = n0(r.rendCons) ?? paramValor(params, tipo, "PECA", fpp.item, ov);
  const out = [];
  const nomeP = String(e.nomeArtigo || "").trim();
  if (nomeP) {
    const consumo = tipo === "MALHA" ? (rendCons ? 1 / rendCons : 0) : rendCons;
    out.push({ papel: "PRINCIPAL", ref: { campo: "artigoDet" }, categoria: tipo === "MALHA" ? "MALHA" : "TECIDO", unidade: tipo === "MALHA" ? "KG" : "M",
      nome: nomeP.toUpperCase(), det: e.artigoDet || {}, consumoPorPeca: consumo, valorUnitario: n0(e.mpValor),
      base: tipo === "MALHA" ? `${String(rendCons).replace(".", ",")} peças/kg` : `${String(rendCons).replace(".", ",")} m/peça` });
  }
  const nomeF = String(e.nomeArtigoForro || "").trim();
  if ((tipo === "PLANO" || (aberta && e.forrada)) && nomeF && e.forrada !== false) {   // v411 — só peça forrada
    const cf = n0(e.consumoForro) || n0(r.consumoForro) || (tipo === "PLANO" ? paramValor(params, "PLANO", "CONST", "FORRO_FATOR", ov) * rendCons : 0);
    out.push({ papel: "FORRO", ref: { campo: "artigoForroDet" }, categoria: "TECIDO", unidade: "M", nome: nomeF.toUpperCase(), det: e.artigoForroDet || {},
      consumoPorPeca: cf, valorUnitario: n0(e.forroValor), base: `${String(r3(cf)).replace(".", ",")} m/peça` });
  }
  // v411 — matérias-primas adicionais: consumo (m/peça → metros) ou rendimento (peças/kg → kg)
  (Array.isArray(e.materiasExtras) ? e.materiasExtras : []).forEach((x, idx) => {
    const nome = String(x.nome || "").trim();
    const q = n0(x.qtd);
    if (!nome || !(q > 0)) return;
    const rend = x.modo === "RENDIMENTO";
    out.push({ papel: `MP${idx}`, ref: { campo: "materiasExtras", idx }, categoria: rend ? "MALHA" : "TECIDO", unidade: rend ? "KG" : "M", nome: nome.toUpperCase(), det: x.det || {},
      consumoPorPeca: rend ? 1 / q : q, valorUnitario: n0(x.custo), base: rend ? `${String(q).replace(".", ",")} peças/kg` : `${String(q).replace(".", ",")} m/peça` });
  });
  const avDet = e.aviamentosDet || {};
  const get = (g, k, c = "valor") => paramGet(params, tipo, g, k, c, ov);
  for (const a of AVIAMENTOS) {
    if (a.tipo && a.tipo !== tipo && !aberta) continue;
    const v = e[a.campo];
    if (ehSem(v)) continue;
    if (a.chave === "GOLA" && ehGolaVies(v)) continue;   // v522
    const det = avDet[a.chave] || {};
    // v410 — elástico e faixa com consumo por metro: a compra sai em metros
    if (a.chave === "ELASTICO") {
      const c = elasticoCalc(get, v);
      if (c.consumo > 0) {
        out.push({ papel: a.chave, ref: { campo: "aviamentosDet", chave: a.chave }, categoria: "AVIAMENTO", unidade: "M", nome: nomeAv(a.prefixo, v), det,
          consumoPorPeca: c.consumo, valorUnitario: c.metro || null, base: `${String(r3(c.consumo)).replace(".", ",")} m/peça`, obs: det.obs || null });
        continue;
      }
    }
    if (a.chave === "FAIXA") {
      const c = faixaCalc(get, v, e.faixaTipo);
      if (c.consumo > 0) {
        const nome = e.faixaTipo ? nomeFaixaCompra(e.faixaTipo, e.faixaCor) : nomeAv(a.prefixo, v);
        out.push({ papel: a.chave, ref: { campo: "aviamentosDet", chave: a.chave }, categoria: "AVIAMENTO", unidade: "M", nome, det,
          consumoPorPeca: c.consumo, valorUnitario: (c.montada ? c.metroFaixa : c.metro) || null, base: `${String(r3(c.consumo)).replace(".", ",")} m/peça · ${String(v).toUpperCase()}`, obs: det.obs || null });
        // v506 — faixa montada: o tactel entra como material próprio, com o mesmo consumo
        if (c.montada) out.push({ papel: "FAIXA_TACTEL", ref: { campo: "aviamentosDet", chave: a.chave }, categoria: "AVIAMENTO", unidade: "M", nome: `TACTEL ${String(e.faixaCor || "").toUpperCase()} P/ FAIXA`.replace(/\s+/g, " ").trim(), det,
          consumoPorPeca: c.consumo, valorUnitario: c.metroTactel || null, base: `${String(r3(c.consumo)).replace(".", ",")} m/peça · tactel da faixa montada`, obs: det.obs || null });
        continue;
      }
    }
    const q = n0(det.qtdPeca) || 1;
    const custoPeca = paramValor(params, tipo, a.chave, v, ov);
    out.push({ papel: a.chave, ref: { campo: "aviamentosDet", chave: a.chave }, categoria: "AVIAMENTO", unidade: "UN", nome: nomeAv(a.prefixo, v), det,
      consumoPorPeca: q, valorUnitario: custoPeca ? Math.round((custoPeca / q) * 10000) / 10000 : null, base: `${q} un/peça`, obs: det.obs || null });
  }
  const botoes = n0(e.botaoQtd);
  if (botoes > 0) {
    const det = avDet.BOTAO || {};
    out.push({ papel: "BOTAO", ref: { campo: "aviamentosDet", chave: "BOTAO" }, categoria: "AVIAMENTO", unidade: "UN", embalagem: GROSA,
      nome: e.botaoTipo ? `BOTÃO ${String(e.botaoTipo).toUpperCase()}` : "BOTÃO", det,   // v410 — tipo do botão
      consumoPorPeca: botoes, valorUnitario: botaoUnit(get, e.botaoTipo) || null, base: `${botoes} un/peça · grosa de ${GROSA}`, obs: [obsBotao(e.botaoTipo), det.obs].filter(Boolean).join(" · ") || null });   // v413
  }
  (Array.isArray(e.extrasAviamentos) ? e.extrasAviamentos : []).forEach((x, idx) => {
    if (vazio(x.desc)) return;
    const det = x.det || {};
    if (x.unidade) {   // v411 — aviamento adicional: unidade (M/UN), consumo por peça e R$ por unidade
      const qc = n0(x.consumo) || 0;
      if (!(qc > 0)) return;
      out.push({ papel: `EXTRA${idx}`, ref: { campo: "extrasAviamentos", idx }, categoria: "AVIAMENTO", unidade: x.unidade === "M" ? "M" : "UN", nome: String(x.desc).trim().toUpperCase(), det,
        consumoPorPeca: qc, valorUnitario: n0(x.preco), base: `${String(qc).replace(".", ",")} ${x.unidade === "M" ? "m" : "un"}/peça`, obs: det.obs || null });
      return;
    }
    const q = n0(det.qtdPeca) || 1;
    const vp = n0(x.valor);
    out.push({ papel: `EXTRA${idx}`, ref: { campo: "extrasAviamentos", idx }, categoria: "AVIAMENTO", unidade: "UN", nome: String(x.desc).trim().toUpperCase(), det,
      consumoPorPeca: q, valorUnitario: vp ? Math.round((vp / q) * 10000) / 10000 : null, base: `${q} un/peça`, obs: det.obs || null });
  });
  return out;
}

// ---------- cadastro automático do artigo a partir da FPP ----------
const chaveDet = (d) => ({
  fornecedorId: d.fornecedorId ? Number(d.fornecedorId) : null,
  cor: vazio(d.cor) ? null : norm(d.cor),
  codigo: vazio(d.codigo) ? null : norm(d.codigo),
});
const temAlgumDetalhe = (d) => d && ["fornecedorId", "cor", "codigo", "largura", "rendimento", "tipoMalha", "obs"].some((k) => !vazio(d[k]));

// procura o artigo idêntico (mesma categoria, nome e mesmos campos de identificação, vazio = vazio); senão cria
export async function artigoDaFpp(m, fpp, db = prisma) {
  const k = chaveDet(m.det || {});
  const cands = await db.artigo.findMany({ where: { ativo: true, categoria: m.categoria, unidade: m.unidade, nome: { equals: m.nome, mode: "insensitive" } },   // v410 — mesma unidade
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
    ...(m.det?.obs ? { especificacao: String(m.det.obs).toUpperCase() } : {}),
    ...dados, origem: "FPP", origemFppId: fpp.id,
  }, select: { id: true } });
  return novo.id;
}

// chamada depois de salvar a FPP: garante o cadastro de cada artigo e grava o id no detalhe
// v411 — listas (extrasAviamentos, materiasExtras): ref.idx
const lerDet = (e, ref) => (ref.idx != null ? (e[ref.campo]?.[ref.idx]?.det || {}) : ref.chave ? (e[ref.campo]?.[ref.chave] || {}) : (e[ref.campo] || {}));
function gravarDet(e, ref, det) {
  if (ref.idx != null) { const l = [...(e[ref.campo] || [])]; l[ref.idx] = { ...l[ref.idx], det }; return { ...e, [ref.campo]: l }; }
  if (ref.chave) return { ...e, [ref.campo]: { ...(e[ref.campo] || {}), [ref.chave]: det } };
  return { ...e, [ref.campo]: det };
}
export async function sincronizarArtigosFpp(fpp, db = prisma) {
  let novas = { ...(fpp.entradas || {}) };
  let mudou = false;
  const params = await db.fppParam.findMany({ where: { ativo: true }, select: { tipo: true, grupo: true, chave: true, valor: true, extra: true } });
  for (const m of materiaisDaFpp(fpp, params)) {
    // só cadastra quando alguém abriu o "+" e preencheu algo (FPP de proposta não enche o cadastro);
    // sem detalhe, o cadastro pelo nome acontece quando a FPP vira base de um pedido (demandaDoItem)
    if (!temAlgumDetalhe(m.det)) continue;
    const id = await artigoDaFpp(m, fpp, db);
    const atual = lerDet(novas, m.ref);
    if (atual.artigoId !== id) { novas = gravarDet(novas, m.ref, { ...atual, artigoId: id }); mudou = true; }
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
  const params = await db.fppParam.findMany({ where: { ativo: true }, select: { tipo: true, grupo: true, chave: true, valor: true, extra: true } });
  const mats = materiaisDaFpp(fpp, params);
  const ids = mats.map((m) => (m.det || {}).artigoId).filter(Boolean);
  const arts = ids.length ? await db.artigo.findMany({ where: { id: { in: ids } }, include: { fornecedor: { select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true } } } }) : [];
  const porId = Object.fromEntries(arts.map((a) => [a.id, a]));
  const out = [];
  for (const m of mats) {
    let artigoId = (m.det || {}).artigoId;
    if (!artigoId || !porId[artigoId]) {   // FPP antiga, sem detalhe: cadastra pelo nome
      artigoId = await artigoDaFpp(m, fpp, db);
      porId[artigoId] = await db.artigo.findUnique({ where: { id: artigoId }, include: { fornecedor: { select: { id: true, nome: true, nomeFantasia: true, razaoSocial: true } } } });
    }
    const a = porId[artigoId];
    out.push({ papel: m.papel, artigoId, nome: a.nome, categoria: a.categoria, unidade: m.unidade,
      fornecedorId: a.fornecedorId, fornecedor: a.fornecedor ? (a.fornecedor.nome || a.fornecedor.nomeFantasia || a.fornecedor.razaoSocial || null) : null, cor: a.cor, codigo: a.codigo,
      largura: a.largura != null ? Number(a.largura) : null, base: m.base,
      consumoPorPeca: Math.round(m.consumoPorPeca * 10000) / 10000, quantidade: r3(m.consumoPorPeca * qtd), valorUnitario: m.valorUnitario,
      embalagem: m.embalagem || null, obs: m.obs || null, equiparadoA: null });
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
  for (const l of linhas) if (!arts[l.artigoId]) arts[l.artigoId] = { artigoId: l.artigoId, nome: l.nome, categoria: l.categoria, unidade: l.unidade, embalagem: l.embalagem || null, fornecedorId: l.fornecedorId, fornecedor: l.fornecedor, cor: l.cor, codigo: l.codigo, largura: l.largura };
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
  const consolidado = Object.values(cons).map((c) => ({ ...c, quantidade: r3(c.quantidade),
    compra: c.embalagem ? Math.ceil(r3(c.quantidade) / c.embalagem) : null,   // v405 — botão: grosas inteiras
    valorEstimado: Math.round(c.valorEstimado * 100) / 100,
    pedidos: [...c.pedidos], juntados: [...c.juntados].map((id) => arts[id]) })).sort((a, b) => a.nome.localeCompare(b.nome));
  return { linhas, equiparacoes, consolidado };
}

// ---------- v406 — cruzamento com o estoque ----------
const efetivo = (d) => d.equiparadoA || d.artigoId;
// necessidade de um item por artigo efetivo
export function necessidade(item) {
  const n = {};
  for (const d of Array.isArray(item.demanda) ? item.demanda : []) n[efetivo(d)] = r3((n[efetivo(d)] || 0) + (Number(d.quantidade) || 0));
  return n;
}
const cabe = (nec, disp) => Object.entries(nec).every(([a, q]) => (disp[a] || 0) + 1e-9 >= q);
const tira = (nec, disp) => { for (const [a, q] of Object.entries(nec)) disp[a] = r3((disp[a] || 0) - q); };
const ordemEntrega = (a, b) => String(a.entrega ? new Date(a.entrega).toISOString() : "9999").localeCompare(String(b.entrega ? new Date(b.entrega).toISOString() : "9999")) || String(a.pedidoNumero).localeCompare(String(b.pedidoNumero));

// itens: [{ id, pedidoNumero, entrega, demanda }]; disponivel: { artigoId: qtd }
// 1º atende pedidos inteiros (todos os itens), em ordem de entrega; 2º, com o que sobrou, itens inteiros em ordem de entrega.
// Item nunca é atendido pela metade: ou sai 100% do estoque ou vai para compra.
export function cruzarEstoque(itens, disponivel) {
  const disp = Object.fromEntries(Object.entries(disponivel).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]));
  const comDemanda = itens.filter((i) => Object.keys(necessidade(i)).length);
  const pedidos = {};
  for (const i of comDemanda) (pedidos[i.pedidoNumero] ||= { pedidoNumero: i.pedidoNumero, entrega: i.entrega, itens: [] }).itens.push(i);
  const lista = Object.values(pedidos).sort(ordemEntrega);
  const atendidos = new Set();
  const completos = new Set();
  for (const p of lista) {
    const nec = {};
    for (const i of p.itens) for (const [a, q] of Object.entries(necessidade(i))) nec[a] = r3((nec[a] || 0) + q);
    if (cabe(nec, disp)) { tira(nec, disp); p.itens.forEach((i) => atendidos.add(i.id)); completos.add(p.pedidoNumero); }
  }
  for (const i of [...comDemanda].sort(ordemEntrega)) {
    if (atendidos.has(i.id)) continue;
    const nec = necessidade(i);
    if (cabe(nec, disp)) { tira(nec, disp); atendidos.add(i.id); }
  }
  return { atendidos: [...atendidos], completos: [...completos], sobra: disp };
}

// itens no levantamento de pedidos ainda em andamento
// v417 — fase do pedido no PCP do Maycon: só LEVANTAMENTO e COMPRAS estão em compras; programado, em produção ou concluído
//   já tem a matéria-prima comprada. Sem informação do PCP (não está no cronograma) → "FORA"
const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
// v421 — compra pendente no PCP (coluna Compras): casa o item pelo nome do produto
const compraPendente = (p, produto) => (Array.isArray(p.cronoCompras) ? p.cronoCompras : []).some((c) => !produto || semAc(c.produto) === semAc(produto));
export function faseCompraPcp(p) {
  if (compraPendente(p)) return "COMPRAS";
  const its = (Array.isArray(p.cronoItens) ? p.cronoItens : []).filter((i) => !i.complemento);
  const txt = (i) => `${i.situacao || ""} ${i.etapa || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (its.length) return its.some((i) => /LEVANTAMENTO|COMPRA/.test(txt(i))) ? "COMPRAS" : "PRODUCAO";
  const sit = String(p.cronoSituacao || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!sit || /NAO ESTA NO CRONOGRAMA/.test(sit)) return "FORA";
  return /LEVANTAMENTO|COMPRA/.test(sit) ? "COMPRAS" : "PRODUCAO";
}

// v418 — fase de um item no PCP (casado pelo código do item = itemCode); sem o item no PCP, vale a fase do pedido
export function faseItemPcp(p, chave) {
  const cod = String(chave || "").split("#")[0];
  const ci = (Array.isArray(p.cronoItens) ? p.cronoItens : []).find((x) => String(x.itemCode || "") === cod);
  if (!ci) return { fase: faseCompraPcp(p), coluna: null };
  if (compraPendente(p, ci.produto)) return { fase: "COMPRAS", coluna: "COMPRAS" };   // v421
  const t = `${ci.situacao || ""} ${ci.etapa || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  return { fase: /LEVANTAMENTO|COMPRA/.test(t) ? "COMPRAS" : "PRODUCAO", coluna: /LEVANTAMENTO/.test(t) ? "LEVANTAMENTO" : /COMPRA/.test(t) ? "COMPRAS" : String(ci.situacao || "").toUpperCase() };
}

// v496 — pedido de um item da avulsa: o do próprio item; o do cabeçalho só vale para avulsa antiga (itens sem o campo)
export function pedidoDoItemAvulsa(c, i) {
  const temCampo = (Array.isArray(c.itens) ? c.itens : []).some((x) => x && Object.prototype.hasOwnProperty.call(x, "pedidoRef"));
  if (temCampo) return i.pedidoRef || null;
  return c.destino === "PEDIDO" ? c.pedidoRef || null : null;
}
export const ehAvulsa = (num) => /^AV\d+$/.test(String(num || ""));   // v419 — itens de compra avulsa (pedidoNumero "AV<id>")
export async function pedidosDispensados(db = prisma) {
  return new Set((await db.compraDispensa.findMany({ select: { pedidoNumero: true } }).catch(() => [])).map((x) => x.pedidoNumero));
}

// v419 — compra avulsa → itens no levantamento (um por linha), com artigo achado ou criado pelo nome + unidade (+ fornecedor)
export async function sincronizarAvulsa(c, db = prisma) {
  const num = `AV${c.id}`;
  const atuais = await db.compraItem.findMany({ where: { pedidoNumero: num } });
  if (c.status === "CANCELADA") { await db.compraItem.deleteMany({ where: { pedidoNumero: num } }); return; }
  const statusDe = { ABERTA: "LEVANTAMENTO", COMPRADA: "OC", RECEBIDA: "ENTREGUE" }[c.status] || "LEVANTAMENTO";
  const its = (Array.isArray(c.itens) ? c.itens : []).filter((i) => i.nome && Number(i.quantidade) > 0);
  const chaves = new Set();
  for (const [idx, i] of its.entries()) {
    const chave = `ITEM${idx + 1}`; chaves.add(chave);
    const unidade = ["UN", "M", "KG", "PC"].includes(i.unidade) ? i.unidade : "UN";
    const forn = i.fornecedorId ? Number(i.fornecedorId) : null;
    let art = await db.artigo.findFirst({ where: { ativo: true, unidade, fornecedorId: forn, nome: { equals: i.nome, mode: "insensitive" } }, select: { id: true, categoria: true } });
    if (!art) art = await db.artigo.create({ data: { categoria: "OUTROS", nome: i.nome, unidade, fornecedorId: forn, origem: "AVULSA" }, select: { id: true, categoria: true } });
    const ref = pedidoDoItemAvulsa(c, i);   // v475 — pedido por item · v496 — sem herdar o do cabeçalho
    const destino = ref ? `PEDIDO ${ref}` : "OPERAÇÃO";
    const dados = { descricao: i.nome, quantidade: Number(i.quantidade), cliente: `AVULSA ${c.numero || `#${c.id}`} · ${destino}`,
      entrega: i.bomPara ? new Date(`${i.bomPara}T00:00:00Z`) : null, status: statusDe,
      demanda: [{ papel: "AVULSA", artigoId: art.id, nome: i.nome, categoria: art.categoria, unidade, fornecedorId: forn, fornecedor: i.fornecedorNome || null,
        cor: null, codigo: null, largura: null, consumoPorPeca: 1, quantidade: Number(i.quantidade), valorUnitario: null, embalagem: null, obs: i.obs || null, equiparadoA: null }] };
    const ex = atuais.find((x) => x.chave === chave);
    if (ex) { if (ex.status === "LEVANTAMENTO" || ["OC", "ENTREGUE", "LEVANTAMENTO"].includes(ex.status)) await db.compraItem.update({ where: { id: ex.id }, data: dados }); }
    else await db.compraItem.create({ data: { pedidoNumero: num, chave, ...dados } });
  }
  const sobra = atuais.filter((x) => !chaves.has(x.chave)).map((x) => x.id);
  if (sobra.length) await db.compraItem.deleteMany({ where: { id: { in: sobra } } });
}

// v522 — uma vez: tira a gola viés da demanda dos itens que ainda estão no levantamento
const K_VIES = "COMPRAS_GOLA_VIES_V522";
async function limparGolaVies(db) {
  if (await db.finConfig.findUnique({ where: { chave: K_VIES } }).catch(() => null)) return;
  const l = await db.compraItem.findMany({ where: { status: "LEVANTAMENTO" }, select: { id: true, demanda: true } });
  let n = 0;
  for (const i of l) {
    const d = Array.isArray(i.demanda) ? i.demanda : [];
    const f = d.filter((m) => !(m?.papel === "GOLA" && ehGolaVies(m.nome)));
    if (f.length !== d.length) { await db.compraItem.update({ where: { id: i.id }, data: { demanda: f } }); n++; }
  }
  await db.finConfig.create({ data: { chave: K_VIES, valor: JSON.stringify({ em: new Date().toISOString(), itens: n }) } }).catch(() => null);
}

export async function itensAbertos(db = prisma) {
  try { await limparGolaVies(db); } catch (e) { console.log("compras/gola viés:", e.message); }
  const dispensados = await pedidosDispensados(db);   // v419
  const itens = (await db.compraItem.findMany({ where: { status: "LEVANTAMENTO" }, orderBy: [{ entrega: "asc" }, { pedidoNumero: "asc" }] })).filter((i) => !dispensados.has(i.pedidoNumero));
  const peds = await db.pedidoVenda.findMany({ where: { numero: { in: [...new Set(itens.map((i) => i.pedidoNumero))] }, status: "ANDAMENTO" }, select: { numero: true, cronoItens: true, cronoSituacao: true, cronoCompras: true } });
  const porNum = Object.fromEntries(peds.map((p) => [p.numero, p]));
  // v417/v418 — item programado/em produção no PCP sai do levantamento
  return itens.filter((i) => ehAvulsa(i.pedidoNumero) || (porNum[i.pedidoNumero] && faseItemPcp(porNum[i.pedidoNumero], i.chave).fase !== "PRODUCAO"));
}

// reservas do estoque: itens atendidos pelo estoque cujo material ainda não seguiu para a produção.
// Libera sozinho quando o pedido saiu do andamento ou o item já está EM PRODUÇÃO/CONCLUÍDO no cronograma do Maycon.
export async function reservasEstoque(db = prisma) {
  const res = await db.compraItem.findMany({ where: { status: "ESTOQUE", reservaLiberada: false } });
  if (!res.length) return {};
  const peds = Object.fromEntries((await db.pedidoVenda.findMany({ where: { numero: { in: [...new Set(res.map((r) => r.pedidoNumero))] } }, select: { numero: true, status: true, cronoItens: true, cronoSituacao: true } })).map((p) => [p.numero, p]));
  const seguiu = (sit) => /PRODU|CONCLU|FATURAD/i.test(String(sit || ""));
  const out = {};
  for (const r of res) {
    const p = peds[r.pedidoNumero];
    const cod = r.chave.split("#")[0];
    const ci = p && Array.isArray(p.cronoItens) ? p.cronoItens.find((x) => String(x.itemCode || "") === cod) : null;
    if (!p || p.status !== "ANDAMENTO" || (ci ? seguiu(ci.situacao) : false)) { await db.compraItem.update({ where: { id: r.id }, data: { reservaLiberada: true } }); continue; }
    for (const [a, q] of Object.entries(necessidade(r))) out[a] = r3((out[a] || 0) + q);
  }
  return out;
}

export async function disponivelEstoque(artigoIds, db = prisma) {
  const ids = [...new Set(artigoIds.map(Number))];
  const arts = await db.artigo.findMany({ where: { id: { in: ids } }, select: { id: true, quantidade: true } });
  const reservas = await reservasEstoque(db);
  const saldo = Object.fromEntries(arts.map((a) => [a.id, Number(a.quantidade) || 0]));
  const disp = Object.fromEntries(ids.map((id) => [id, r3(Math.max(0, (saldo[id] || 0) - (reservas[id] || 0)))]));
  return { saldo, reservas, disponivel: disp };
}


// v469 — saiu da rota /api/compras/cruzar para ser usada também na geração do PIC
export async function simularCruzamento() {
  const itens = await itensAbertos();
  const lev = montarLevantamento(itens);
  const ids = lev.consolidado.map((c) => c.artigoId);
  const { saldo, reservas, disponivel } = await disponivelEstoque(ids);
  const { atendidos, completos, sobra } = cruzarEstoque(itens, disponivel);
  const at = new Set(atendidos);
  // por artigo: demanda, saldo, reservado, disponível, atendido pelo estoque, a comprar (demanda dos itens não atendidos − sobra)
  const artigos = lev.consolidado.map((c) => {
    let atendido = 0, paraCompra = 0;
    for (const i of itens) { const q = necessidade(i)[c.artigoId] || 0; if (at.has(i.id)) atendido += q; else paraCompra += q; }
    const comprar = r3(Math.max(0, paraCompra - (sobra[c.artigoId] || 0)));
    return { ...c, saldo: r3(saldo[c.artigoId] || 0), reservado: r3(reservas[c.artigoId] || 0), disponivel: r3(disponivel[c.artigoId] || 0),
      atendido: r3(atendido), paraCompra: r3(paraCompra), sobra: r3(sobra[c.artigoId] || 0), comprar, comprarEmb: c.embalagem && comprar ? Math.ceil(comprar / c.embalagem) : null };
  });
  const peds = {};
  for (const i of itens) {
    const p = (peds[i.pedidoNumero] ||= { numero: i.pedidoNumero, cliente: i.cliente, entrega: i.entrega, itens: [] });
    p.itens.push({ id: i.id, chave: i.chave, descricao: i.descricao, quantidade: Number(i.quantidade), fppNumero: i.fppNumero, atendido: at.has(i.id), semDemanda: !Object.keys(necessidade(i)).length,
      demanda: (i.demanda || []).map((d) => ({ nome: d.nome, cor: d.cor, codigo: d.codigo, fornecedor: d.fornecedor, quantidade: d.quantidade, unidade: d.unidade, artigoId: d.equiparadoA || d.artigoId })) });
  }
  const pedidos = Object.values(peds).map((p) => {
    const n = p.itens.filter((x) => !x.semDemanda);
    const a = n.filter((x) => x.atendido).length;
    return { ...p, completo: completos.includes(p.numero), situacao: !n.length ? "SEM DEMANDA" : a === n.length ? "COMPLETO" : a ? "PARCIAL" : "COMPRA" };
  }).sort((a, b) => String(a.entrega ? new Date(a.entrega).toISOString() : "9").localeCompare(String(b.entrega ? new Date(b.entrega).toISOString() : "9")));
  return { pedidos, artigos, atendidos, itens };
}


// ---------- v406 — integração com o PCP do Maycon (ele lê; nada é gravado no banco dele) ----------
const K_EXT = "COMPRAS|EXT_TOKEN";
export async function tokenExterno(db = prisma, renovar = false) {
  if (process.env.COMPRAS_EXT_TOKEN && process.env.COMPRAS_EXT_TOKEN.length >= 16) return process.env.COMPRAS_EXT_TOKEN;
  const atual = (await db.finConfig.findUnique({ where: { chave: K_EXT } }).catch(() => null))?.valor;
  if (atual && !renovar) return atual;
  const novo = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
  await db.finConfig.upsert({ where: { chave: K_EXT }, create: { chave: K_EXT, valor: novo }, update: { valor: novo } });
  return novo;
}

// itens liberados para programar, com o pedido completo (cabeçalho, grade, parâmetros da OP, FPP e materiais)
export async function liberadosParaPcp({ desde, pedido } = {}, db = prisma) {
  const where = { status: { in: ["ESTOQUE", "ENTREGUE"] }, liberadoEm: { not: null } };
  if (desde) where.liberadoEm = { gte: new Date(desde) };
  if (pedido) where.pedidoNumero = String(pedido);
  const itens = await db.compraItem.findMany({ where, orderBy: { liberadoEm: "asc" } });
  const peds = Object.fromEntries((await db.pedidoVenda.findMany({ where: { numero: { in: [...new Set(itens.map((i) => i.pedidoNumero))] } } })).map((p) => [p.numero, p]));
  const out = {};
  for (const i of itens) {
    const p = peds[i.pedidoNumero];
    if (!p) continue;
    const doPedido = itensDoPedido(p);
    const idx = doPedido.findIndex((x) => x.chave === i.chave);
    const bruto = idx >= 0 ? (p.itens || [])[idx] || {} : {};
    const o = (out[p.numero] ||= {
      pedido: p.numero, cliente: p.cliente, cnpj: p.cnpj, emissao: p.emissao, entrega: p.despacho, oc: p.oc, vendedor: p.vendedor, tipoPedido: p.tipoPedido,
      condicao: p.condicao, obs: p.obs, interno: p.interno, totalItens: doPedido.length, itens: [],
    });
    o.itens.push({
      chave: i.chave, codigo: bruto.codigo || i.chave.split("#")[0], descricao: bruto.descricao || i.descricao, quantidade: Number(i.quantidade),
      grade: bruto.grade || [], op: bruto.op || null, parametros: bruto.parametros || [],
      origemMaterial: i.status === "ESTOQUE" ? "ESTOQUE" : "OC", liberadoEm: i.liberadoEm, fppNumero: i.fppNumero,
      materiais: (i.demanda || []).map((d) => ({ nome: d.nome, categoria: d.categoria, fornecedor: d.fornecedor, cor: d.cor, codigo: d.codigo, quantidade: d.quantidade, unidade: d.unidade, obs: d.obs || null })),
    });
  }
  return Object.values(out).map((p) => ({ ...p, liberadosItens: p.itens.length, pedidoCompleto: p.itens.length >= p.totalItens }));
}
