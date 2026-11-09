// v699 — Dados unitários: dados personalizados peça a peça (nome, tipo sanguíneo…), cada um num local da peça.
// Estrutura guardada no item do pedido (PpItem.dadosUnitarios):
//   { campos: [{ id, local, rotulo }], linhas: [{ tam, valores: { [campoId]: texto } }], linkId?, linkToken? }
// Leitura pura (sem banco): usada no navegador e no servidor.

export const LOCAIS_DADO = [
  ["FRENTE", ["PEITO ESQUERDO", "PEITO DIREITO", "PEITO CENTRAL", "CENTRAL", "BARRA ESQUERDA", "BARRA DIREITA", "BARRA CENTRAL"]],
  ["COSTAS", ["SUPERIOR ESQUERDO", "SUPERIOR DIREITO", "SUPERIOR CENTRAL", "CENTRAL", "BARRA ESQUERDA", "BARRA DIREITA", "BARRA CENTRAL"]],
];
export const LOCAIS_LISTA = LOCAIS_DADO.flatMap(([lado, l]) => l.map((x) => `${lado} ${x}`));

export const novoCampo = (n = 0) => ({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, local: n ? "FRENTE PEITO DIREITO" : "COSTAS SUPERIOR CENTRAL", rotulo: n ? "TIPO SANGUÍNEO" : "NOME" });
export const vazioDU = () => ({ campos: [novoCampo(0)], linhas: [] });
export const temDU = (du) => !!(du && Array.isArray(du.campos) && du.campos.length);

// tamanhos aceitos na lista (adulto, numeração, infantil, babylook, G1–G4)
const TAMS_BASE = ["PP", "P", "M", "G", "GG", "XG", "EXG", "EXGG", "XGG", "G1", "G2", "G3", "G4", "U", "UN", "UNICO", "ÚNICO"];
const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
export function normTam(t) {
  let x = semAcento(t).toUpperCase().replace(/\s+/g, " ").trim();
  x = x.replace(/^BABY ?LOOK ?/, "BL ").replace(/^BL(?=[A-Z0-9])/, "BL ");
  if (x === "UNICO" || x === "UN") x = "U";
  if (x === "XGG") x = "EXGG";
  return x;
}
const ehTam = (t, extras = []) => {
  const x = normTam(t);
  if (!x) return false;
  if (TAMS_BASE.includes(x) || extras.map(normTam).includes(x)) return true;
  if (/^\d{1,2}$/.test(x)) return true;                     // infantil / numeração
  if (/^BL (PP|P|M|G|GG|XG|EXG|G\d)$/.test(x)) return true;  // babylook
  return false;
};

const RE_SANGUE = /(?:^|[\s\-–,;:/|])\(?\s*(AB|A|B|O|0)\s*([+-]|POS(?:ITIVO)?|NEG(?:ATIVO)?)\s*\)?\s*$/i;
export function normSangue(tipo, fator) {
  const t = String(tipo).toUpperCase() === "0" ? "O" : String(tipo).toUpperCase();
  const f = /^(\+|POS)/i.test(fator) ? "+" : "-";
  return t + f;
}
const ehRotuloSangue = (r) => /SANG|TIPO|FATOR|ABO|RH\b/i.test(semAcento(r));
const VAZIO = /^(SEM NOME|SEM DADO|SEM|S\/ ?NOME|-+|—|N\/A|NAO|NÃO)$/i;

// Uma linha da lista → { tam, valores } ou { erro }
export function lerLinha(txt, campos, tamanhosExtras = []) {
  let s = String(txt || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  // numeração da lista: "1-", "12 -", "7)", "3.", "#4"
  s = s.replace(/^#?\s*\d{1,4}\s*[-–.):]+\s*/, "").replace(/^#?\d{1,4}\s+(?=\()/, "");
  let tam = null;
  // tamanho entre parênteses / colchetes
  const mp = s.match(/[([]\s*([A-Za-zÀ-ú0-9 ]{1,10}?)\s*[)\]]/);
  if (mp && ehTam(mp[1], tamanhosExtras)) { tam = normTam(mp[1]); s = (s.slice(0, mp.index) + " " + s.slice(mp.index + mp[0].length)).trim(); }
  else {
    // tamanho solto no começo: "G Leandro A+", "GG - Reis"
    const mi = s.match(/^((?:BL|BABY ?LOOK)\s*[A-Za-z0-9]{1,3}|[A-Za-z]{1,4}\d?|\d{1,2})(?=$|[\s\-–:;,])/i);
    if (mi && ehTam(mi[1], tamanhosExtras)) { tam = normTam(mi[1]); s = s.slice(mi[0].length).trim(); }
    else {
      // tamanho solto no fim: "Leandro A+ - G"
      const mf = s.match(/[\s\-–:;,]((?:BL\s*)?[A-Za-z]{1,4}\d?|\d{1,2})$/i);
      if (mf && ehTam(mf[1], tamanhosExtras) && !RE_SANGUE.test(s)) { tam = normTam(mf[1]); s = s.slice(0, mf.index).trim(); }
    }
  }
  if (!tam) return { erro: "tamanho não encontrado", texto: txt };
  s = s.replace(/^[\s\-–:;,.]+/, "").replace(/[\s;,.]+$/, "").trim();

  const valores = {};
  const cs = Array.isArray(campos) ? campos : [];
  if (cs.length <= 1) { if (cs[0]) valores[cs[0].id] = VAZIO.test(s) ? "" : s; return { tam, valores }; }
  // vários dados: o tipo sanguíneo é reconhecido no fim; o resto vai pelos separadores " - ", "|", ";", "/"
  let resto = s;
  const iSangue = cs.findIndex((c) => ehRotuloSangue(c.rotulo));
  if (iSangue >= 0) {
    const m = resto.match(RE_SANGUE);
    if (m) { valores[cs[iSangue].id] = normSangue(m[1], m[2]); resto = resto.slice(0, m.index).replace(/[\s\-–:;,/|]+$/, "").trim(); }
    else valores[cs[iSangue].id] = "";
  }
  const outros = cs.filter((_, k) => k !== iSangue);
  const partes = outros.length > 1 ? resto.split(/\s*(?:\||;|\/|\s[-–]\s)\s*/).map((x) => x.trim()).filter((x) => x !== "") : [resto];
  outros.forEach((c, k) => {
    const v = k === outros.length - 1 ? partes.slice(k).join(" ") : partes[k] || "";
    valores[c.id] = VAZIO.test(v.trim()) ? "" : v.trim();
  });
  return { tam, valores };
}

// Texto inteiro (colado do WhatsApp, planilha…) → linhas + o que não deu para ler
export function lerLista(texto, campos, tamanhosExtras = []) {
  const linhas = [], erros = [];
  String(texto || "").split(/\r?\n/).forEach((l, i) => {
    const r = lerLinha(l, campos, tamanhosExtras);
    if (!r) return;
    if (r.erro) erros.push({ linha: i + 1, texto: l.trim(), motivo: r.erro });
    else linhas.push({ tam: r.tam, valores: r.valores });
  });
  return { linhas, erros };
}

// peças por tamanho (na ordem da grade, extras no fim)
export function contarPorTam(linhas, ordem = []) {
  const c = {};
  for (const l of linhas || []) if (l && l.tam) c[l.tam] = (c[l.tam] || 0) + 1;
  const ks = [...ordem.filter((t) => c[t]), ...Object.keys(c).filter((t) => !ordem.includes(t))];
  return ks.map((t) => ({ tam: t, qtd: c[t] }));
}

// grade do item a partir da lista: os tamanhos da lista recebem a contagem; os demais ficam zerados
export function gradeDaLista(gradeAtual, linhas) {
  const cont = Object.fromEntries(contarPorTam(linhas).map((x) => [x.tam, x.qtd]));
  const g = (gradeAtual || []).map((x) => ({ ...x, qtd: cont[x.tam] ? String(cont[x.tam]) : "" }));
  const tem = new Set(g.map((x) => x.tam));
  for (const [t, q] of Object.entries(cont)) if (!tem.has(t)) g.push({ tam: t, qtd: String(q) });
  return g;
}

// confere a lista com a grade do item: { ok, dif: { tam: lista - grade } }
export function conferirComGrade(du, grade) {
  if (!temDU(du) || !(du.linhas || []).length) return { ok: true, dif: {} };
  const cont = Object.fromEntries(contarPorTam(du.linhas).map((x) => [x.tam, x.qtd]));
  const dif = {};
  const ts = new Set([...Object.keys(cont), ...(grade || []).filter((g) => Number(g.qtd) > 0).map((g) => g.tam)]);
  for (const t of ts) { const d = (cont[t] || 0) - (Number((grade || []).find((g) => g.tam === t)?.qtd) || 0); if (d) dif[t] = d; }
  return { ok: !Object.keys(dif).length, dif };
}

// limpa o que vem do navegador
export function limparDU(du) {
  if (!temDU(du)) return null;
  const campos = du.campos.slice(0, 12).map((c, i) => ({ id: String(c.id || `c${i}`).slice(0, 30), local: String(c.local || "").toUpperCase().slice(0, 60), rotulo: String(c.rotulo || `DADO ${i + 1}`).toUpperCase().slice(0, 40) }));
  const ids = new Set(campos.map((c) => c.id));
  const linhas = (Array.isArray(du.linhas) ? du.linhas : []).slice(0, 5000).filter((l) => l && l.tam).map((l) => ({
    tam: normTam(l.tam).slice(0, 12),
    valores: Object.fromEntries(Object.entries(l.valores || {}).filter(([k]) => ids.has(k)).map(([k, v]) => [k, String(v ?? "").slice(0, 120)])),
  }));
  return { campos, linhas, ...(du.linkId ? { linkId: Number(du.linkId) || null, linkToken: String(du.linkToken || "").slice(0, 40) || null } : {}) };
}
