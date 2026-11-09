// v709 — dados do cliente final e do envio (pedido do portal): pessoa física ou jurídica + endereço de entrega.
// Leitura pura: usada no navegador (validação na hora) e no servidor.
const so = (s) => String(s || "").replace(/\D/g, "");
const tx = (s, n = 120) => String(s ?? "").trim().slice(0, n);

export function cpfValido(v) {
  const c = so(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}
export function cnpjValido(v) {
  const c = so(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (n) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(c[i]) * p[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}
export const fmtCpf = (v) => { const c = so(v); return c.length === 11 ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : v || ""; };
export const fmtCnpj = (v) => { const c = so(v); return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v || ""; };
export const fmtCep = (v) => { const c = so(v); return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : v || ""; };
export const fmtFone = (v) => { const c = so(v); return c.length === 11 ? c.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : c.length === 10 ? c.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3") : v || ""; };
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

export const vazioClienteFinal = (tipo = "PF") => ({ tipo, nome: "", cpf: "", contato: "", cargo: "", razaoSocial: "", cnpj: "", ie: "",
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", whatsapp: "", email: "" });

// { erros: [..] } ou { dados } já limpo
export function validarClienteFinal(cf) {
  const c = cf || {};
  const tipo = c.tipo === "PJ" ? "PJ" : "PF";
  const erros = [];
  if (tipo === "PF") {
    if (tx(c.nome).split(/\s+/).filter(Boolean).length < 2) erros.push("Nome completo do cliente (nome e sobrenome).");
    if (!c.cpfNA && !cpfValido(c.cpf)) erros.push("CPF válido (ou marque \"Não se aplica\").");
  } else {
    if (!tx(c.contato)) erros.push("Contato (pessoa que está tratando).");
    if (!tx(c.cargo)) erros.push("Cargo do contato na empresa.");
    if (!tx(c.razaoSocial)) erros.push("Razão social.");
    if (!cnpjValido(c.cnpj)) erros.push("CNPJ válido.");
    if (!tx(c.ie)) erros.push("Inscrição estadual (ou ISENTO).");
  }
  if (so(c.cep).length !== 8) erros.push("CEP com 8 dígitos.");
  if (!tx(c.rua)) erros.push("Rua do endereço de entrega.");
  if (!tx(c.numero)) erros.push("Número (ou S/N).");
  if (!tx(c.bairro)) erros.push("Bairro.");
  if (!tx(c.cidade) || !/^[A-Za-z]{2}$/.test(String(c.uf || "").trim())) erros.push("Cidade e UF.");
  const w = so(c.whatsapp);
  if (w.length < 10 || w.length > 11) erros.push("WhatsApp com DDD.");
  if (!emailOk(c.email)) erros.push("E-mail válido.");
  if (erros.length) return { erros };
  const base = { tipo, cep: fmtCep(c.cep), rua: tx(c.rua).toUpperCase(), numero: tx(c.numero, 20).toUpperCase(), complemento: tx(c.complemento, 80).toUpperCase(),
    bairro: tx(c.bairro, 80).toUpperCase(), cidade: tx(c.cidade, 80).toUpperCase(), uf: String(c.uf).trim().toUpperCase(), whatsapp: fmtFone(w), email: tx(c.email).toLowerCase() };
  return { dados: tipo === "PF"
    ? { ...base, nome: tx(c.nome).toUpperCase(), cpf: c.cpfNA ? "NÃO SE APLICA" : fmtCpf(c.cpf), ...(c.cpfNA ? { cpfNA: true } : {}) }
    : { ...base, contato: tx(c.contato).toUpperCase(), cargo: tx(c.cargo, 60).toUpperCase(), razaoSocial: tx(c.razaoSocial).toUpperCase(), cnpj: fmtCnpj(c.cnpj),
        ie: /^isent/i.test(tx(c.ie)) ? "ISENTO" : tx(c.ie, 30).toUpperCase() } };
}

export const enderecoTxt = (c) => (c ? [`${c.rua}, ${c.numero}${c.complemento ? ` · ${c.complemento}` : ""}`, c.bairro, `${c.cidade}/${c.uf}`, `CEP ${c.cep}`].filter(Boolean).join(" · ") : "");
// linhas para mostrar (tela e impressão)
export function linhasClienteFinal(c) {
  if (!c) return [];
  return c.tipo === "PJ"
    ? [["Cliente (PJ)", c.razaoSocial], ["CNPJ", `${c.cnpj}${c.ie ? ` · IE ${c.ie}` : ""}`], ["Contato", `${c.contato}${c.cargo ? ` (${c.cargo})` : ""}`], ["Entrega", enderecoTxt(c)], ["WhatsApp", c.whatsapp], ["E-mail", c.email]]
    : [["Cliente (PF)", c.nome], ["CPF", c.cpf], ["Entrega", enderecoTxt(c)], ["WhatsApp", c.whatsapp], ["E-mail", c.email]];
}
