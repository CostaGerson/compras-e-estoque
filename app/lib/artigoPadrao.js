// v1143 — padronização dos artigos (sem duplicar o mesmo artigo com nomes diferentes)
//   Mesma ordem do catálogo (cartelas): o NOME é só o artigo; fornecedor e cor ficam nos campos próprios.
//   Ao cadastrar um artigo novo: maiúsculas, espaços únicos, sem o nome do fornecedor e sem a cor dentro do nome.
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const chaveNome = (s) => semAc(s).toUpperCase().replace(/[^A-Z0-9%]+/g, " ").trim();
const IGNORA_FORN = new Set(["LTDA", "ME", "EPP", "SA", "S", "A", "EIRELI", "COMERCIO", "INDUSTRIA", "TEXTIL", "TEXTEIS", "MALHAS", "TECIDOS", "DE", "DA", "DO", "E", "IND", "COM", "MATRIZ", "FILIAL"]);
export function nomePadrao(nome, { fornecedor, cor } = {}) {
  let n = String(nome || "").toLocaleUpperCase("pt-BR").replace(/\s+/g, " ").trim();
  const tira = (txt) => {
    const t = String(txt || "").toLocaleUpperCase("pt-BR").trim();
    if (!t || t.length < 2) return;
    const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    n = n.replace(new RegExp(`(^|[\\s\\-·/,(])${esc}(?=$|[\\s\\-·/,)])`, "gi"), " ");
  };
  // cor: inteira (ex.: "AZUL ROYAL") e, se vier com código entre parênteses, também sem ele
  if (cor) { tira(cor); tira(String(cor).replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ")); }
  // fornecedor: nome inteiro e as palavras que o identificam (DOPTEX, NANETE…)
  if (fornecedor) {
    tira(fornecedor);
    for (const w of String(fornecedor).toLocaleUpperCase("pt-BR").split(/[\s\-·/,.]+/)) if (w.length >= 4 && !IGNORA_FORN.has(semAc(w))) tira(w);
  }
  n = n.replace(/\(\s*\)/g, " ").replace(/\s*[-·/,]\s*(?=[-·/,]|$)/g, " ").replace(/^\s*[-·/,]+\s*/, "").replace(/\s+/g, " ").trim();
  return n || String(nome || "").toLocaleUpperCase("pt-BR").trim();
}
// fornecedores parecidos com o texto digitado (impede cadastrar o mesmo fornecedor com outro nome)
export function fornecedoresParecidos(texto, forns, nomeDe = (f) => f.nome) {
  const toks = chaveNome(texto).split(" ").filter((w) => w.length >= 3 && !IGNORA_FORN.has(w));
  const k = chaveNome(texto).replace(/\s/g, "");
  if (!k) return [];
  return forns.filter((f) => {
    const nomes = [nomeDe(f), f.nome, f.nomeFantasia, f.razaoSocial].filter(Boolean).map(chaveNome);
    return nomes.some((h) => { const hc = h.replace(/\s/g, ""); return hc === k || (k.length >= 4 && (hc.includes(k) || k.includes(hc))) || toks.some((w) => h.split(" ").includes(w)); });
  });
}
