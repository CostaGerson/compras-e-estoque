// v696 — Solicitação de lançamento gerada pela skill "lancamento-pedido-meridian" (PDF) → dados do pedido.
// Puro (sem Prisma): ler o texto do PDF, converter condição de pagamento e prazo, montar os itens do editor.
import { num, somaDias } from "./pedidoLanc";

const semAc = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const dig = (s) => String(s || "").replace(/\D/g, "");
const brParaIso = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const vazio = (v) => { const t = semAc(v); return !t || t === "—" || t === "-" || t === "A DEFINIR" || t === "NAO TEM" || t === "NAO" || t === "SEM OC" || t === "N/A"; };

export const ehSolicitacao = (texto) => /SOLICITA[ÇC][ÃA]O DE LAN[ÇC]AMENTO/i.test(String(texto || ""));

// rótulos do cabeçalho do documento (ordem do PDF; cada valor vai até o próximo rótulo)
const CABEC = ["CLIENTE", "E-MAIL DO CLIENTE", "CONDIÇÃO DE PAGAMENTO", "FPP", "OC", "PRAZO DE ENTREGA", "VENDEDOR", "DADOS DE FATURAMENTO",
  "RAZÃO SOCIAL", "CNPJ", "INSCR. ESTADUAL", "INSCRIÇÃO ESTADUAL", "ENDEREÇO"];
// rótulos conhecidos dos cards (o PDF cola rótulo e valor: "TECIDOMalha PV")
const ROT_PECA = ["VALOR TOTAL DA PEÇA", "VALOR UNITÁRIO", "COR DO TECIDO", "TECIDO", "PERSONALIZAÇÃO", "GRADE"];

// separa "ROTULOValor" quando o rótulo é desconhecido: maior trecho em maiúsculas seguido de Maiúscula+minúscula
function partirRotulo(linha) {
  const l = String(linha || "").trim();
  if (l.includes("\t")) { const [r, ...v] = l.split("\t"); if (r.trim() && v.join(" ").trim()) return { rotulo: r.replace(/:\s*$/, "").trim(), valor: v.join(" ").replace(/\s+/g, " ").trim() }; }
  for (const r of ROT_PECA) if (semAc(l).startsWith(semAc(r)) && semAc(l) !== semAc(r)) {
    // conta os caracteres do rótulo na linha original (acentos não mudam o tamanho com NFC)
    return { rotulo: r, valor: l.slice(r.length).replace(/^[:\s]+/, "").trim() };
  }
  const m = l.match(/^([A-ZÀ-Ü0-9][A-ZÀ-Ü0-9 .\/()ºª-]*?)\s*:?\s*([A-ZÀ-Ü0-9][a-zà-ü].*|[a-zà-ü\d].*)$/);
  if (m && m[1].trim().length >= 3) return { rotulo: m[1].trim(), valor: m[2].trim() };
  const d = l.match(/^([A-ZÀ-Ü][A-ZÀ-Ü .\/()-]+?)\s*:\s*(.+)$/);
  if (d) return { rotulo: d[1].trim(), valor: d[2].trim() };
  return null;
}

// grade "P: 6M: 24G: 34GG: 32XG: 8G1: 6" (tamanhos colados) → [{ tam, qtd }]
export function lerGrade(txt) {
  const out = [];
  const re = /(BL\s+[A-Z0-9]+|\d{1,2}\s*ANOS?|[A-Z]{1,5}\d?|\d{1,2})\s*:\s*(\d+)/gi;
  let m;
  while ((m = re.exec(String(txt || "")))) {
    let tam = m[1].toUpperCase().replace(/\s*ANOS?$/, "").replace(/\s+/g, " ").trim();
    out.push({ tam, qtd: Number(m[2]) });
  }
  return out;
}

export function lerSolicitacao(texto) {
  // o PDF pode vir com "\t" entre rótulo e valor da mesma linha (leitura do servidor) ou colado (leitura padrão)
  const t = String(texto || "").replace(/\r/g, "").replace(/ +/g, " ").replace(/ ?\t ?/g, "\t");
  const linhas = t.split("\n").map((l) => l.trim()).filter(Boolean);
  const out = { cabecalho: {}, faturamento: {}, pecas: [], avisos: [] };

  out.data = brParaIso((t.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1]);
  out.vendedor = ((t.match(/Vendedor:\s*([^\n]+)/i) || [])[1] || "").trim() || null;

  // ---------- cabeçalho: rótulo numa linha, valor na(s) seguinte(s) ----------
  const iPeca = linhas.findIndex((l) => /^\d+\.\s+\S/.test(l) && /·/.test(l));
  const cab = iPeca >= 0 ? linhas.slice(0, iPeca) : linhas;
  const ehRot = (l) => CABEC.find((r) => semAc(l) === semAc(r) || semAc(l) === semAc(r) + ":");
  for (let i = 0; i < cab.length; i++) {
    const r = ehRot(cab[i]);
    if (!r || r === "DADOS DE FATURAMENTO") continue;
    const vals = [];
    for (let j = i + 1; j < cab.length && !ehRot(cab[j]); j++) vals.push(cab[j]);
    out.cabecalho[semAc(r)] = vals.join(" ").trim();
  }
  const c = out.cabecalho;
  out.cliente = c["CLIENTE"] || null;
  out.email = (c["E-MAIL DO CLIENTE"] || "").match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || null;
  out.condicao = c["CONDICAO DE PAGAMENTO"] || null;
  out.fppTexto = c["FPP"] || null;
  out.fpps = [...new Set((out.fppTexto || "").match(/\d+/g) || [])].map(Number);
  out.oc = vazio(c["OC"]) ? "" : c["OC"];
  out.prazoTexto = c["PRAZO DE ENTREGA"] || null;
  if (!out.vendedor && c["VENDEDOR"]) out.vendedor = c["VENDEDOR"];
  out.faturamento = {
    razaoSocial: c["RAZAO SOCIAL"] || null,
    cnpj: dig(c["CNPJ"]).length >= 11 ? dig(c["CNPJ"]) : null,
    ie: c["INSCR. ESTADUAL"] || c["INSCRICAO ESTADUAL"] || null,
    endereco: c["ENDERECO"] || null,
  };
  if (vazio(out.faturamento.ie)) out.faturamento.ie = /ISENT/i.test(out.faturamento.ie || "") ? "ISENTO" : null;

  // ---------- peças ----------
  const fim = linhas.findIndex((l, k) => k > iPeca && /^TOTAL GERAL/i.test(l));
  const corpo = iPeca >= 0 ? linhas.slice(iPeca, fim >= 0 ? fim : undefined) : [];
  let atual = null;
  for (let k = 0; k < corpo.length; k++) {
    const l = corpo[k];
    const h = l.match(/^(\d+)\.\s+(.+?)\s*·\s*(.*)$/);
    if (h) { atual = { n: Number(h[1]), categoria: h[2].trim(), modelo: h[3].trim(), campos: [], grade: [] }; out.pecas.push(atual); continue; }
    if (!atual) continue;
    if (/^Layout enviado/i.test(l)) { atual.temLayout = true; continue; }
    if (/^GRADE\s*:?/i.test(l)) {
      let g = l.replace(/^GRADE\s*:?/i, "");
      while (k + 1 < corpo.length && !/^\d+\.\s+.+·/.test(corpo[k + 1]) && /\w+\s*:\s*\d/.test(corpo[k + 1])) g += " " + corpo[++k];
      atual.grade = lerGrade(g);
      continue;
    }
    const p = partirRotulo(l);
    if (p) atual.campos.push(p);
    else if (atual.campos.length) atual.campos[atual.campos.length - 1].valor += " " + l;   // valor quebrado em duas linhas
  }
  for (const pc of out.pecas) {
    const pega = (r) => pc.campos.find((x) => semAc(x.rotulo) === semAc(r))?.valor || null;
    pc.tecido = pega("TECIDO");
    pc.cor = pega("COR DO TECIDO");
    pc.personalizacao = pega("PERSONALIZAÇÃO");
    const vu = pega("VALOR UNITÁRIO");
    pc.valorUnitario = vu && /\d/.test(vu) ? num(vu) : null;
    const vt = pega("VALOR TOTAL DA PEÇA");
    pc.valorTotal = vt && /\d/.test(vt) ? num(vt) : null;
    pc.fpp = (pega("FPP") || "").match(/\d+/)?.[0] ? Number(pega("FPP").match(/\d+/)[0]) : null;
    pc.config = pc.campos.filter((x) => !["TECIDO", "COR DO TECIDO", "PERSONALIZACAO", "VALOR UNITARIO", "VALOR TOTAL DA PECA", "FPP"].includes(semAc(x.rotulo)));
    pc.qtd = pc.grade.reduce((s, g) => s + g.qtd, 0);
  }

  // ---------- totais e observações ----------
  const tot = t.match(/TOTAL GERAL DO PEDIDO\s*(\d+)\s*pe[çc]as?\s*R?\$?\s*([\d.]+,\d{2})/i);
  out.totalPecas = tot ? Number(tot[1]) : null;
  out.valorTotal = tot ? num(tot[2]) : null;
  const ob = t.match(/Observa[çc][õo]es:\s*([\s\S]*?)(?:\n?Campos "A DEFINIR"|$)/i);
  out.observacoes = ob && !vazio(ob[1]) ? ob[1].replace(/\s+/g, " ").trim() : "";

  // ---------- conferências ----------
  const somaQ = out.pecas.reduce((s, p) => s + p.qtd, 0);
  if (out.totalPecas != null && somaQ !== out.totalPecas) out.avisos.push(`A soma das grades (${somaQ} pç) não bate com o total do documento (${out.totalPecas} pç).`);
  for (const p of out.pecas) {
    if (p.valorUnitario != null && p.valorTotal != null && Math.abs(p.valorUnitario * p.qtd - p.valorTotal) > 0.05)
      out.avisos.push(`Peça ${p.n}: ${p.qtd} × valor unitário não fecha com o valor total da peça do documento.`);
  }
  return out;
}

// ---------- condição de pagamento → { entrada, parcelas: [{ dias, tipo, base, valor }] } ----------
// "Boleto 30 dias" · "30/60/90" · "28 DDL" · "50% entrada e 50% na entrega" · "30% antecipado 30% entrega e 40% 30d" · "à vista"
export function condicaoParaPagamento(txt, total = 0, emissao = null) {
  const s = semAc(txt);
  const vazioP = { entrada: null, parcelas: [] };
  if (!s) return vazioP;
  const tipoDe = (seg) => (/UTE|\bDU\b/.test(seg) ? "UTEIS" : "CORRIDOS");
  const baseDe = (seg) => (/ENTREGA/.test(seg) ? "ENTREGA" : /PEDIDO|EMISS|FECHAMENTO/.test(seg) ? "EMISSAO" : "NF");
  const r2 = (n) => Math.round(n * 100) / 100;
  // com percentuais: cada trecho "X% …"
  if (/\d+(?:[.,]\d+)?\s*%/.test(s)) {
    const partes = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*%((?:(?!\d+(?:[.,]\d+)?\s*%).)*)/g)];
    let entrada = null; const parcelas = [];
    for (const [, pctTxt, resto] of partes) {
      const pct = num(pctTxt) / 100;
      const valor = total > 0 ? r2(total * pct) : "";
      const ds = (resto.match(/\d+/g) || []).map(Number);
      if (/ANTECIP|ENTRADA|SINAL|PEDIDO|FECHAMENTO|\bATO\b/.test(resto) && !ds.length) {
        if (valor === "") parcelas.push({ dias: 0, tipo: "CORRIDOS", base: "EMISSAO", valor: "" });
        else entrada = { data: emissao, valor: r2((entrada ? num(entrada.valor) : 0) + valor) };
        continue;
      }
      if (/ENTREGA/.test(resto) && !ds.length) { parcelas.push({ dias: 0, tipo: "CORRIDOS", base: "ENTREGA", valor }); continue; }
      const lista = ds.length ? ds : [0];
      lista.forEach((d) => parcelas.push({ dias: d, tipo: tipoDe(resto), base: baseDe(resto), valor: valor === "" ? "" : r2(valor / lista.length) }));
    }
    // valores com vírgula (como no editor); a última parcela fica livre e absorve o arredondamento
    const fmtV = (v) => (v === "" ? "" : String(v.toFixed(2)).replace(".", ","));
    if (parcelas.length && total > 0) parcelas[parcelas.length - 1].valor = "";
    return { entrada: entrada ? { ...entrada, valor: fmtV(entrada.valor) } : null, parcelas: parcelas.map((x) => ({ ...x, valor: x.valor === "" ? "" : fmtV(x.valor) })) };
  }
  if (/A VISTA|AVISTA|ANTECIPADO/.test(s) && !/\d/.test(s)) return { entrada: null, parcelas: [{ dias: 0, tipo: "CORRIDOS", base: /ANTECIP/.test(s) ? "EMISSAO" : "NF", valor: "" }] };
  // só prazos: "30/60/90", "30, 60 e 90 dias", "boleto 30 dias", "28 ddl"
  const ds = (s.match(/\d+/g) || []).map(Number).filter((d) => d <= 400);
  if (!ds.length) return vazioP;
  const lista = /^(ENTRADA|ATO)\b/.test(s.replace(/^BOLETO\s*/, "")) ? [0, ...ds] : ds;   // "entrada + 30/60": a entrada sem valor vira parcela de 0 dia
  return { entrada: null, parcelas: lista.map((d, i) => ({ dias: d, tipo: tipoDe(s), base: d === 0 && i === 0 && lista.length > ds.length ? "EMISSAO" : baseDe(s), valor: "" })) };
}

// ---------- prazo de entrega → { prazoDias, prazoTipo, data } ----------
export function prazoParaDias(txt, emissao) {
  const s = semAc(txt);
  if (!s || vazio(txt)) return null;
  const iso = brParaIso(txt);
  if (iso && emissao) {
    const d = Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(String(emissao).slice(0, 10) + "T00:00:00Z")) / 86400000);
    return { prazoDias: Math.max(0, d), prazoTipo: "CORRIDOS", data: iso, passou: d < 0 };
  }
  const m = s.match(/(\d+)\s*(DIAS?|DU|DD|D)\b/) || s.match(/^(\d+)$/);
  if (m) return { prazoDias: Number(m[1]), prazoTipo: /UTE|\bDU\b/.test(s) ? "UTEIS" : "CORRIDOS", data: null };
  if (/HOJE|IMEDIAT/.test(s)) return { prazoDias: 0, prazoTipo: "CORRIDOS", data: emissao };
  return null;
}

// ---------- endereço "Rua X, 121 — Bairro, Cidade/UF CEP 00000-000" → campos do cadastro ----------
export function partirEndereco(txt) {
  const s = String(txt || "").replace(/\s+/g, " ").trim();
  if (!s) return {};
  const cep = dig((s.match(/CEP\s*([\d.\-]{8,10})/i) || [])[1]) || null;
  const semCep = s.replace(/,?\s*CEP\s*[\d.\-]{8,10}/i, "").trim();
  const cid = semCep.match(/,?\s*([^,—–-]+?)\s*[\/-]\s*([A-Z]{2})\s*$/);
  const municipio = cid ? cid[1].trim() : null, uf = cid ? cid[2] : null;
  const antes = cid ? semCep.slice(0, cid.index).trim() : semCep;
  const [rua, bairro] = antes.split(/\s+[—–]\s+|\s+-\s+/);
  const rn = String(rua || "").match(/^(.*?),\s*(\S+)(?:,\s*(.*))?$/);
  return { logradouro: rn ? rn[1].trim() : (rua || "").trim() || null, numero: rn ? rn[2] : null, complemento: rn && rn[3] ? rn[3].trim() : null,
    bairro: bairro ? bairro.replace(/^,\s*/, "").trim() : null, municipio, uf, cep };
}

// ---------- categoria do documento → tipo de peça do sistema ----------
export function tipoDaCategoria(cat, tipos) {
  const n = semAc(cat);
  const t = /CAMISETA|T-SHIRT|REGATA|BABY ?LOOK/.test(n) ? "CAMISETA" : /\bPOLO\b/.test(n) ? "POLO" : /CAMISA/.test(n) ? "CAMISA"
    : /JAQUETA|MOLETOM|BLUSAO|CASACO|AGASALHO|COLETE|PARKA|SUETER/.test(n) ? "JAQUETA" : /CALCA|BERMUDA|SHORT|MACACAO/.test(n) ? "CALÇA"
    : /JALECO/.test(n) ? "JALECO" : /AVENTAL/.test(n) ? "AVENTAL" : null;
  return t && tipos.includes(t) ? t : null;
}

// rótulo do documento → parâmetro de produção do tipo de peça (GOLA → GOLA DA CAMISETA, CÓS DA CALÇA → COS DA CALÇA…)
export function parametroDoRotulo(rotulo, comps) {
  const r = semAc(rotulo).replace(/\s+(DA|DO|DE)\s+(CAMISETA|CAMISA|POLO|JAQUETA|CALCA|BERMUDA|JALECO|AVENTAL|MOLETOM)$/, "");
  const base = r.replace(/S$/, "");
  const C = comps.map((c) => ({ c, n: semAc(c) }));
  const exato = C.find((x) => x.n === semAc(rotulo)) || C.find((x) => x.n === r);
  if (exato) return exato.c;
  const ini = C.find((x) => x.n.startsWith(r + " ") || x.n.startsWith(base + " ") || x.n === base);
  return ini ? ini.c : null;
}

// peça lida do documento → item do editor (sem FPP; a FPP é aplicada depois, se existir)
export function pecaParaItem(pc, { componentes, tamanhos, modo = "camposDoc" } = {}) {
  const tipos = Object.keys(componentes || {});
  const tipo = tipoDaCategoria(pc.categoria, tipos) || "";
  const comps = componentes?.[tipo] || [];
  const parametros = {};
  const extra = [];
  const por = (k, v) => { if (!v) return; parametros[k] = parametros[k] ? `${parametros[k]} · ${String(v).toUpperCase()}` : String(v).toUpperCase(); };
  for (const { rotulo, valor } of pc.config || []) {
    const r = semAc(rotulo);
    if (/^BOLSOS?\b/.test(r) && comps.includes("BOLSO DIANTEIRO")) {   // calça/bermuda: separa dianteiro × traseiro
      if (vazio(valor) || /^NAO/.test(semAc(valor))) { por("BOLSO DIANTEIRO", "NÃO TEM"); por("BOLSO TRASEIRO", "NÃO TEM"); continue; }
      for (const seg of String(valor).split(/[,;]|\s+e\s+/i).map((x) => x.trim()).filter(Boolean)) {
        const sg = semAc(seg);
        if (/DIANT|FRENTE|FACA/.test(sg)) por("BOLSO DIANTEIRO", seg); else if (/TRAS/.test(sg)) por("BOLSO TRASEIRO", seg); else extra.push(`BOLSO: ${seg}`);
      }
      continue;
    }
    const p = parametroDoRotulo(rotulo, comps);
    if (p && p !== "TECIDO") por(p, valor); else extra.push(`${rotulo}: ${valor}`);
  }
  if (pc.personalizacao) {
    const pz = String(pc.personalizacao).replace(/^SIM\s*[—–-]\s*/i, "");
    parametros["PERSONALIZAÇÃO"] = /^N[ÃA]O\b/i.test(pc.personalizacao) ? "NÃO TEM" : pz.toUpperCase();
  }
  if (extra.length) { const ke = comps.find((c) => /^EXTRA/.test(semAc(c))) || "EXTRA"; por(ke, extra.join(" · ")); }
  if (pc.tecido || pc.cor) parametros.TECIDO = [pc.tecido, pc.cor].filter((x) => x && !vazio(x)).join(" · ").toUpperCase();
  // grade: os tamanhos do sistema primeiro (na ordem), os demais do documento depois (G1…G4, infantil, babylook)
  const doc = new Map(pc.grade.map((g) => [String(g.tam).toUpperCase(), g.qtd]));
  const base = (tamanhos || []).map((t) => ({ tam: t, qtd: doc.has(t) ? String(doc.get(t)) : "" }));
  const outros = [...doc.entries()].filter(([t]) => !(tamanhos || []).includes(t)).map(([tam, q]) => ({ tam, qtd: String(q) }));
  const descricao = [pc.categoria, pc.modelo].filter(Boolean).join(" ").toUpperCase();
  return {
    tipoPecaNome: tipo, codigo: "", descricao, valorUnitario: pc.valorUnitario != null ? pc.valorUnitario.toFixed(2).replace(".", ",") : "",
    grade: [...base, ...outros], parametros, fotoBase64: "", fppId: null, fppNumero: null, fpp: null, anexos: [],
    _doc: { tecido: pc.tecido, cor: pc.cor },
  };
}

// cor do documento × cores da FPP (para FPP com várias cores do mesmo tecido)
export function corNaFpp(cor, rf) {
  const c = semAc(cor);
  if (!c || !rf || !(rf.cores || []).length) return null;
  return (rf.cores.find((x) => semAc(x.cor) === c) || rf.cores.find((x) => semAc(x.cor).includes(c) || c.includes(semAc(x.cor))))?.cor || null;
}

export { brParaIso, somaDias };
