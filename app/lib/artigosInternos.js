// v625 — artigos internos (tipo do material): o nome interno de malha e tecido plano é sempre um destes tipos.
// O levantamento casa demanda × estoque pelo TIPO + COR (+ CÓDIGO quando a demanda tem código), não pelo fornecedor/nome da NF.
// Lista editável em Cadastros › Artigos › Artigos internos (tabela ArtigoTipoInterno; esta é a carga inicial).
export const TIPOS_INICIAIS = {
  MALHA: ["PV", "PP", "ALGODAO 30.1 PENTEADO", "ALGODAO 30.1 CARDADO", "DRY FIT POLIESTER", "DRY FIT POLIESTER COM ELASTANO", "DRY FIT FURADINHO", "POLIAMIDA",
    "POLIAMIDA COM ELASTANO", "PIQUET P.A", "PIQUET P.V", "ALGODÃO EGÍPCIO 100%", "ALGODÃO EGÍPCIO COM ELASTANO", "VISCOSE", "MODAL", "MOLETOM 2CB", "MOLETOM 3CB",
    "HELANCA POLIESTER", "HELANCA CACHARREL"],
  TECIDO: ["BRIM PESADO ALGODAO", "BRIM LEVE ALGODAO", "BRIM MISTO ALGODAO E POLIESTER", "BRIM POLIESTER", "RIPSTOP", "RIPSTOP FLEX", "TACTEL", "BEMBER", "JEANS ALGODAO",
    "JEANS COM ELASTANO", "FURADINHO FORRO", "AMERICANO CRU", "ECOBAG", "CAMISARIA SEMPRIGUAL", "CAMISARIA UNIOFFICE", "CAMISARIA DOPFILL", "CAMISARIA COMFORT PLUS",
    "CAMISARIA CEDROVIP", "CAMISARIA CEDROFIL", "CAMISARIA BRISTOL", "CAMISARIA LONDON", "CAMISARIA AMELIE", "CAMISARIA COTTON", "CAMISARIA IBIZA", "WR REPELENTE"],
};
export const CATS_TIPO = ["MALHA", "TECIDO"];
// normaliza para comparar: sem acento, maiúsculo, pontuação vira espaço ("P.A" → "P A" → "PA"), sem as palavras "MALHA"/"TECIDO"
export const normTipo = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/\bC\//g, "COM ").replace(/(\d)\s+CB\b/g, "$1CB").replace(/(\b[A-Z])\.(?=[A-Z]\b)/g, "$1").replace(/[^A-Z0-9%]+/g, " ").replace(/\b(MALHA|TECIDO|PLANO)\b/g, " ").replace(/\s+/g, " ").trim();
const toks = (s) => new Set(normTipo(s).split(" ").filter(Boolean));

// tipo de um texto (artigo interno ou nome da NF/FPP): igual a um tipo, ou o tipo mais longo cujas palavras estão todas no texto
export function tipoDoTexto(txt, tipos) {
  const n = normTipo(txt); if (!n) return null;
  const exato = tipos.find((t) => normTipo(t.nome) === n); if (exato) return exato;
  const tk = toks(txt);
  const cands = tipos.filter((t) => { const tt = [...toks(t.nome)]; return tt.length && tt.every((x) => tk.has(x)); });
  const pos = (t) => { const ord = n.split(" "); return Math.min(...[...toks(t.nome)].map((x) => ord.indexOf(x))); };   // empate: o que aparece primeiro no texto
  return cands.sort((a, b) => toks(b.nome).size - toks(a.nome).size || pos(a) - pos(b))[0] || null;
}
// tipo de um artigo: pelo artigo interno; senão pelo nome
export function tipoDoArtigo(a, tipos) {
  const ts = tipos.filter((t) => t.categoria === a.categoria);
  if (!ts.length) return null;
  return tipoDoTexto(a.artigoInterno, ts) || tipoDoTexto(a.nome, ts);
}
const cmp = (s) => normTipo(s);
// demanda (artigo da FPP) × artigo do estoque: mesma categoria e tipo, mesma cor, e o mesmo código quando a demanda tem código
export function casaEstoque(dem, est, tipos) {
  if (!CATS_TIPO.includes(dem.categoria) || dem.categoria !== est.categoria) return false;
  const a = tipoDoArtigo(dem, tipos), b = tipoDoArtigo(est, tipos);
  if (!a || !b || a.nome !== b.nome) return false;
  if (cmp(dem.cor) !== cmp(est.cor)) return false;
  if (cmp(dem.codigo) && cmp(dem.codigo) !== cmp(est.codigo)) return false;
  if (dem.unidade && est.unidade && dem.unidade !== est.unidade) return false;
  return true;
}
// lista do banco (carrega a inicial na primeira vez)
export async function tiposInternos(db) {
  let l = await db.artigoTipoInterno.findMany({ where: { ativo: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }] }).catch(() => null);
  if (l && !l.length && !(await db.artigoTipoInterno.count().catch(() => 1))) {
    await db.artigoTipoInterno.createMany({ data: Object.entries(TIPOS_INICIAIS).flatMap(([categoria, ns]) => ns.map((nome) => ({ categoria, nome }))), skipDuplicates: true }).catch(() => null);
    l = await db.artigoTipoInterno.findMany({ where: { ativo: true }, orderBy: [{ categoria: "asc" }, { nome: "asc" }] }).catch(() => []);
  }
  return l?.length ? l : Object.entries(TIPOS_INICIAIS).flatMap(([categoria, ns]) => ns.map((nome, i) => ({ id: -i - 1, categoria, nome })));
}
