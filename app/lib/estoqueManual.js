// v1152 — entrada manual de estoque (inventário) com etiqueta Zebra por volume
//   Tecido plano é pesado: metragem = peso (kg) × 1000 ÷ (gramatura g/m² × largura m)
import { prisma } from "@/lib/prisma";
import { nomePadrao, chaveNome } from "@/lib/artigoPadrao";

export const TIPOS_ESTOQUE = ["MALHA", "TECIDO", "AVIAMENTO", "INSUMOS SILK", "INSUMOS SUBLIMAÇÃO", "INSUMOS DTF", "INSUMOS BORDADO", "PEÇAS PRONTAS", "OUTROS"];   // v1153 — + OUTROS · v1156 — + PEÇAS PRONTAS
export const TIPOS_TECIDO = ["BRIM LEVE", "BRIM PESADO", "BRIM MISTO LEVE", "BRIM MISTO PESADO", "BRIM NÃO IDENTIFICADO", "RIPSTOP", "OXFORD", "GABARDINE", "TACTEL", "CAMISARIA", "NYLON PARAQUEDAS", "NYLON IMPERMEÁVEL", "TACTEL REPELENTE À ÁGUA", "TWO WAY", "MATELASSÊ", "BEMBER", "AMERICANO CRU", "ECOBAG", "JEANS", "OUTROS"];
export const UNIDADES_MANUAL = [["KG", "Quilo (kg)"], ["M", "Metro"], ["L", "Litro"], ["CONE", "Cone"], ["UN", "Unidade"], ["PCT", "Pacote"]];
export const ORIGENS = ["ESTOQUE PRÉVIO MERIDIAN", "W3"];
const K_GRAM = "ESTQ|GRAMATURAS";
const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v) => { if (v == null || v === "") return null; const t = String(v).trim(); const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : null; };
const up = (s) => String(s || "").trim().toLocaleUpperCase("pt-BR") || null;

// v1155 — padrões definidos pelo Igor (27/11/2026); o que for salvo na tela de gramaturas vale por cima
//   brim leve 200 · pesado 235 (médias dos catálogos: 200 e 255) · não identificado = média dos dois · mistos iguais · ripstop 230
export const GRAMATURAS_INICIAIS = { "BRIM LEVE": 200, "BRIM PESADO": 235, "BRIM MISTO LEVE": 200, "BRIM MISTO PESADO": 235, "BRIM NÃO IDENTIFICADO": 217.5, "RIPSTOP": 230,
  // v1164 — médias das cartelas (Doptel/Andes, Expansione, Santista, Doptex), confirmadas pelo Igor
  "TACTEL": 110, "CAMISARIA": 130, "JEANS": 365, "ECOBAG": 189, "OXFORD": 155, "TACTEL REPELENTE À ÁGUA": 155 };
export async function gramaturasPadrao() {
  const c = await prisma.finConfig.findUnique({ where: { chave: K_GRAM } }).catch(() => null);
  let salvo = {}; try { salvo = JSON.parse(c?.valor || "{}"); } catch {}
  return { ...GRAMATURAS_INICIAIS, ...Object.fromEntries(Object.entries(salvo).filter(([, v]) => Number(v) > 0)) };   // v1164 — salvo vazio não apaga o padrão
}
export async function salvarGramaturas(g) {
  const atual = await gramaturasPadrao();
  for (const t of TIPOS_TECIDO.filter((x) => x !== "OUTROS")) if (g?.[t] !== undefined) { const v = num(g[t]); if (v > 0) atual[t] = v; else delete atual[t]; }
  const valor = JSON.stringify(atual);
  await prisma.finConfig.upsert({ where: { chave: K_GRAM }, create: { chave: K_GRAM, valor }, update: { valor } });
  return atual;
}
export const metrosDoPeso = (pesoKg, gramatura, larguraM) => (pesoKg > 0 && gramatura > 0 && larguraM > 0 ? r3((pesoKg * 1000) / (gramatura * larguraM)) : null);
const catDe = (tipo) => (tipo === "MALHA" ? "MALHA" : tipo === "TECIDO" ? "TECIDO" : tipo === "AVIAMENTO" ? "AVIAMENTO" : "OUTROS");

export async function entradaManual(b, quem) {
  const tipo = TIPOS_ESTOQUE.includes(b.tipo) ? b.tipo : null;
  if (!tipo) return { error: "Escolha o tipo." };
  const tecido = tipo === "TECIDO";
  const tipoTecido = tecido ? (TIPOS_TECIDO.includes(b.tipoTecido) ? b.tipoTecido : null) : null;
  if (tecido && !tipoTecido) return { error: "Escolha o nome do tecido." };
  const nome = String(b.nome || "").trim();
  if (!nome) return { error: "Informe o nome do artigo." };
  const fornecedorId = Number(b.fornecedorId) || null;
  if (!fornecedorId) return { error: "Escolha o fornecedor na lista." };
  const cor = up(b.cor);
  if (!cor) return { error: "Informe a cor." };
  const largura = num(b.largura);   // metros
  const construcao = tipo === "MALHA" ? (["TUBULAR", "RAMADA"].includes(b.construcao) ? b.construcao : null) : null;
  if (tipo === "MALHA" && !construcao) return { error: "Malha: escolha a construção (tubular ou ramada)." };
  const origem = up(b.origem);
  if (!origem) return { error: "Informe a origem (estoque prévio Meridian, W3 ou outra)." };
  let unidade = UNIDADES_MANUAL.some((u) => u[0] === b.unidade) ? b.unidade : null;
  let quantidade = num(b.quantidade), pesoKg = null, gramatura = null, unidadesPacote = null;
  if (tecido) {
    // tecido plano: pesado → metragem pela gramatura padrão do tipo (OUTROS: gramatura informada)
    pesoKg = num(b.pesoKg);
    if (!(pesoKg > 0)) return { error: "Tecido: informe o peso (kg)." };
    if (!(largura > 0)) return { error: "Tecido: informe a largura (m)." };
    const gp = await gramaturasPadrao();
    gramatura = tipoTecido === "OUTROS" ? num(b.gramatura) : num(b.gramatura) || gp[tipoTecido] || null;
    if (!(gramatura > 0)) return { error: tipoTecido === "OUTROS" ? "Tecido OUTROS: informe a gramatura (g/m²)." : `Sem gramatura padrão para ${tipoTecido}: informe a gramatura (g/m²).` };
    quantidade = metrosDoPeso(pesoKg, gramatura, largura); unidade = "M";
  } else {
    if (tipo === "MALHA") gramatura = num(b.gramatura) > 0 ? num(b.gramatura) : null;   // v1164 — malha: gramatura opcional
    if (!unidade) return { error: "Escolha a unidade de medida." };
    if (!(quantidade > 0)) return { error: "Informe a quantidade." };
    if (unidade === "PCT") { unidadesPacote = Math.round(num(b.unidadesPacote) || 0); if (!(unidadesPacote > 0)) return { error: "Pacote: informe quantas unidades há dentro." }; }
  }
  const forn = await prisma.fornecedor.findUnique({ where: { id: fornecedorId }, select: { id: true, nome: true, nomeFantasia: true } });
  if (!forn) return { error: "Fornecedor não encontrado." };
  const categoria = catDe(tipo);
  const nomeStd = nomePadrao(nome, { fornecedor: forn.nomeFantasia || forn.nome, cor });
  const codigo = up(b.codigo);
  // mesmo artigo (nome normalizado, fornecedor, cor, unidade): soma; senão cria no padrão
  const kn = chaveNome(nomeStd);
  const cands = await prisma.artigo.findMany({ where: { ativo: true, categoria, fornecedorId, unidade } });
  let art = cands.find((a) => chaveNome(a.nome) === kn && chaveNome(a.cor) === chaveNome(cor) && (!codigo || !a.codigo || chaveNome(a.codigo) === chaveNome(codigo)));
  const somado = !!art;
  if (art) {
    art = await prisma.artigo.update({ where: { id: art.id }, data: { quantidade: r3(Number(art.quantidade || 0) + quantidade),
      ...(!art.codigo && codigo ? { codigo } : {}), ...(!art.largura && largura ? { largura } : {}), ...(!art.tipoEstoque ? { tipoEstoque: tipo } : {}), ...(tecido && !art.tipoTecido ? { tipoTecido } : {}),
      ...(gramatura && !art.gramatura ? { gramatura } : {}), ...(construcao && !art.tipoMalha ? { tipoMalha: construcao } : {}) } });
  } else {
    art = await prisma.artigo.create({ data: { categoria, fornecedorId, nome: nomeStd, artigoInterno: nomeStd, cor, codigo, largura, unidade, quantidade,
      tipoMalha: construcao, gramatura: gramatura || num(b.gramatura), tipoEstoque: tipo, tipoTecido, origem: "MANUAL", criadoPorId: Number(b.usuarioId) || null } });
  }
  await prisma.estoqueMovimentacao.create({ data: { artigoId: art.id, tipo: "ENTRADA", quantidade, usuarioId: Number(b.usuarioId) || null,
    observacao: `Entrada manual · origem ${origem}${pesoKg ? ` · ${pesoKg} kg × ${gramatura} g/m² × ${largura} m` : ""}${unidadesPacote ? ` · ${unidadesPacote} un/pacote` : ""}`.slice(0, 300) } });
  const vol = await prisma.estoqueVolume.create({ data: { artigoId: art.id, quantidade, unidade, origem, unidadesPacote, pesoKg, gramatura, entradaEm: new Date(), criadoPorNome: quem || null } });
  try { const { checarEstoqueMinimo } = await import("@/lib/estoqueMinimo"); await checarEstoqueMinimo(prisma, art.id, Number(b.usuarioId) || null).catch(() => null); } catch {}
  return { ok: true, artigoId: art.id, somado,
    etiqueta: { codigo: `VOL${String(vol.id).padStart(7, "0")}`, tipo: tecido ? `TECIDO · ${tipoTecido}` : tipo, artigo: art.artigoInterno || art.nome, cor: art.cor, codigoArtigo: art.codigo,
      fornecedor: forn.nomeFantasia || forn.nome, largura: art.largura != null ? Number(art.largura) : largura, construcao, quantidade, unidade, unidadesPacote, pesoKg, gramatura, origem, entrada: vol.entradaEm } };
}
