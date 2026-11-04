// v640 — regra de consolidação de artigos do estoque (somar dois itens num só)
//   só junta quando: mesmo artigo interno, mesmo fornecedor, mesma largura/rendimento/gramatura e mesma cor e código.
//   Aviamentos e outros não têm artigo interno: vale o nome do artigo da NF.
const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const val = (v) => (v == null || v === "" ? "" : (Number(v) || 0).toFixed(3));

export const semInterno = (cat) => !["TECIDO", "MALHA"].includes(String(cat || "").toUpperCase());
export const internoDe = (a) => (semInterno(a?.categoria) ? a?.nome : a?.artigoInterno) || "";

// fornecedor: pelo nome (o mesmo fornecedor pode ter cadastros duplicados); sem nome, pelo id
export const chaveFornecedor = (a) => (a?.fornecedor?.nome && a.fornecedor.nome.trim() ? "n:" + norm(a.fornecedor.nome) : "i:" + (a?.fornecedorId || "0"));

export function chaveConsolidacao(a) {
  const interno = norm(internoDe(a));
  if (!interno) return null;   // tecido/malha sem artigo interno: não consolida
  return [chaveFornecedor(a), interno, val(a.largura), val(a.rendimento), val(a.gramatura), norm(a.cor), norm(a.codigo)].join("|");
}

export function gruposDuplicados(artigos) {
  const mapa = {};
  for (const a of artigos || []) { const k = chaveConsolidacao(a); if (k) (mapa[k] = mapa[k] || []).push(a); }
  return Object.values(mapa).filter((g) => g.length > 1);
}

// o que impede a consolidação de dois artigos (para a API recusar)
export function motivoNaoConsolida(a, b) {
  if (!internoDe(a) || !internoDe(b)) return "Artigo sem artigo interno.";
  const dif = [];
  if (chaveFornecedor(a) !== chaveFornecedor(b)) dif.push("fornecedor");
  if (norm(internoDe(a)) !== norm(internoDe(b))) dif.push(semInterno(a.categoria) ? "artigo" : "artigo interno");
  if (val(a.largura) !== val(b.largura)) dif.push("largura");
  if (val(a.rendimento) !== val(b.rendimento) || val(a.gramatura) !== val(b.gramatura)) dif.push("rendimento/gramatura");
  if (norm(a.cor) !== norm(b.cor)) dif.push("cor");
  if (norm(a.codigo) !== norm(b.codigo)) dif.push("código");
  return dif.length ? `Não dá para consolidar: ${dif.join(", ")} diferente(s).` : null;
}
