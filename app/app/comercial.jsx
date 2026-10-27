"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import Acompanhamento from "./acompanhamento";   // v381
import { elasticoCalc, faixaCalc, botaoUnit, faixaPedeCor, FAIXA_CORES, semAv, fmtNum, obsBotao, PECAS_ESPECIAIS, ehPecaAberta, ehRevenda } from "@/lib/fppAv";   // v410 · v512
import {
  Briefcase, Calculator, Database, ExternalLink, Save, History, Lock, Unlock,
  Pencil, RotateCcw, ChevronDown, ChevronRight, X, FileText, Send, Search, Printer, SlidersHorizontal, Copy, ArrowLeft, Layers, Users, Shirt, Handshake, Plus, Trash2,
} from "lucide-react";
import { alerta, confirmar } from "./dialogo";   // v424 — popups do sistema

/* Paleta Meridian (igual ao restante do sistema) */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "—");
// v513 — onde o usuário estava nas FPPs salvas (guia, negociação aberta, busca, ordem) sobrevive à edição e ao Voltar
const ssLer = (k, d) => { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const ssGravar = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };

const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL || "https://crm.meridianpro.com.br";   // v455 — domínio com https

const brl = (n) => "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };

/* ---------- volta para a operação: por peça ----------
   Sempre: reembolso de consumo, corte, expedição/acabamento e LOGÍSTICA BASE (frete e embalagem são externos, nunca voltam).
   Com "processo interno": facção (costura) e cada técnica de personalização. */
function calcVolta(params, tipo, e = {}, over = {}) {
  if (!params || !e?.item) return null;
  const o = over || {};
  const pg = (grupo, chave, campo = "valor") => {
    const t = params[tipo]?.[grupo] || params.COMUM?.[grupo] || [];
    const row = t.find((x) => x.chave === chave);
    if (!row) return 0;
    const path = `${grupo}:${chave}:${campo}`;
    if (o[path] != null && o[path] !== "") return num(o[path]);
    return campo === "valor" ? row.valor : (row.extra ? row.extra[campo] : 0);
  };
  const cg = (chave) => {
    const path = `CONST:${chave}:valor`;
    if (o[path] != null && o[path] !== "") return num(o[path]);
    const row = (params?.[tipo]?.CONST || []).find((x) => x.chave === chave) || (params?.COMUM?.CONST || []).find((x) => x.chave === chave);
    return row ? Number(row.valor) || 0 : 0;
  };
  const qt = Math.max(1, num(e.qtde));
  const perTec = (p) => (p ? (num(p.arte) / qt) + POS.reduce((s, [k]) => s + num(p[k]), 0) : 0);
  const aberta = ehPecaAberta(e.item), revenda = ehRevenda(e.item, tipo);   // v512
  const v = {
    corte: revenda ? 0 : aberta ? num(e.abCorte) : Number(pg("PECA", e.item, "corte")) || 0,
    silk: (e.silk?.interno ? perTec(e.silk) : 0) + persPorTecnica(e, params, true).silk,
    bordado: (e.bordado?.interno ? perTec(e.bordado) : 0) + persPorTecnica(e, params, true).bordado,
    sublimacao: (e.sublimacao?.interno ? perTec(e.sublimacao) : 0) + persPorTecnica(e, params, true).sublimacao,
    costura: !revenda && e.faccaoInterna ? num(e.faccao) : 0,
    acabamento: revenda ? 0 : aberta ? num(e.abAcab) : Number(tipo === "MALHA" ? pg("PECA", e.item, "exped") : pg("PECA", e.item, "acab")) || 0,
    logistica: cg("LOGISTICA_BASE"),
    consumo: revenda ? 0 : cg("REEMBOLSO_CONSUMO"),
  };
  v.personalizacao = v.silk + v.bordado + v.sublimacao;
  v.total = v.corte + v.personalizacao + v.costura + v.acabamento + v.logistica + v.consumo;
  return v;
}

/* clonar FPP: cria uma cópia salva com o nome "CÓPIA DE ..." e devolve a ficha nova */
const nomeCopia = (f) => `CÓPIA DE ${f.nomeComercial || f.item || "FPP"}`.toUpperCase();
async function clonarFpp(fpp, user, origemId) {
  const criador = { criadoPorId: user?.id ?? null, criadoPorNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim() || null };
  const confere = (d) => {
    if (!d?.id) throw new Error("A cópia não foi criada. Nada foi alterado.");
    if (origemId && d.id === origemId) throw new Error("A cópia voltou com o mesmo nº da original. Nada foi alterado.");
    return d;
  };
  if (fpp.id && !origemId) {   // FPP salva: o servidor copia direto do banco
    const r = await fetch(`/api/fpp/${fpp.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "clonar", ...criador }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Erro ao clonar. Nada foi alterado.");
    if (d.id === fpp.id) throw new Error("A cópia voltou com o mesmo nº da original. Nada foi alterado.");
    return confere(d);
  }
  const nome = nomeCopia(fpp);
  const body = {
    tipo: fpp.tipo, item: fpp.item, nomeComercial: nome, clienteId: fpp.clienteId ?? null, clienteNome: fpp.clienteNome ?? null,
    negociacao: fpp.negociacao ?? null, qtde: fpp.qtde ?? null, condicaoPagamento: fpp.condicaoPagamento ?? null, leadTime: fpp.leadTime ?? null,
    entradas: { ...(fpp.entradas || {}), nomeComercial: nome }, overrides: fpp.overrides || null, resultados: fpp.resultados || {},
    custoProducao: fpp.custoProducao ?? null, custoFinal: fpp.custoFinal ?? null, valorProposto: fpp.valorProposto ?? null,
    margem: fpp.margem ?? null, totalItem: fpp.totalItem ?? null,
    criadoPorId: user?.id ?? null, criadoPorNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim() || null,
  };
  const r = await fetch("/api/fpp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro ao clonar. Nada foi alterado.");
  return confere(d);
}

/* ============================================================ */
export default function Comercial({ user, master, fppInicial }) {
  const [view, setView] = useState(fppInicial?.id ? "fpp" : null); // null = landing (2 cards) | "fpp" | "acomp"
  const voltarFpp = useRef(null);   // v513 — o Voltar devolve para onde estava (negociação, lista, pedido…) antes de sair da FPP

  if (view === "acomp") {   // v381
    return (
      <div>
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button onClick={() => setView(null)} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          <button onClick={() => setView(null)} style={{ color: C.sub }}>Comercial</button>
          <ChevronRight size={13} style={{ color: C.sub }} />
          <span className="font-semibold" style={{ color: C.text }}>Acompanhamento</span>
        </div>
        <Acompanhamento user={user} />
      </div>
    );
  }

  if (view === "fpp") {
    return (
      <div>
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button onClick={() => { if (!voltarFpp.current?.()) setView(null); }} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          <button onClick={() => setView(null)} style={{ color: C.sub }}>Comercial</button>
          <ChevronRight size={13} style={{ color: C.sub }} />
          <span className="font-semibold" style={{ color: C.text }}>Orçamentação (FPP)</span>
        </div>
        <Fpp user={user} master={master} abrirId={fppInicial?.id} abrirVoltar={fppInicial?.voltar} voltarRef={voltarFpp} />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", maxWidth: 1100 }}>
        {[
          ["fpp", Calculator, "Orçamentação (FPP)", "Fichas de precificação, negociações e propostas", () => setView("fpp")],
          ["acomp", Layers, "Acompanhamento", "Seus pedidos e a situação de cada peça no PCP", () => setView("acomp")],
          ["crm", Briefcase, "CRM", "Abre o CRM Meridian em uma nova aba", () => window.open(CRM_URL, "_blank", "noopener")],
        ].map(([k, Ico, t, sub, go]) => (
          <button key={k} onClick={go} className="text-left rounded-2xl p-5 transition-shadow hover:shadow-lg" style={{ background: C.navy, color: "#fff" }}>
            <div className="flex items-center justify-between"><Ico size={26} style={{ color: C.accent }} />{k === "crm" && <ExternalLink size={15} style={{ color: "#9FB0C7" }} />}</div>
            <div className="text-lg font-bold mt-2">{t}</div>
            <div className="text-xs mt-1" style={{ color: "#9FB0C7" }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- CRM embutido ---------------- */

/* ============================================================
   FPP — Ficha de Precificação de Produtos
   ============================================================ */
const POS = [["peitoD", "Peito D"], ["peitoE", "Peito E"], ["mangaD", "Manga D"], ["mangaE", "Manga E"], ["costas", "Costas"]];
// v272 — personalização por aplicação: local + método (silk cobra R$/cor das Análises; os demais, valor digitado)
const LOCAIS_PERS = [["PEITO_E", "Peito esq."], ["PEITO_D", "Peito dir."], ["PEITO_C", "Peito central"], ["COSTAS_SUP", "Costas sup."], ["COSTAS_MEIO", "Costas meio"], ["COSTAS_INF", "Costas inf."], ["MANGA_D", "Manga dir."], ["MANGA_E", "Manga esq."]];
const METODOS_PERS = [["SILK", "Silk", true], ["BORDADO", "Bordado", true], ["DTF", "DTF", false], ["SUBLIMACAO", "Sublimação", false]];
const TEC_DO_METODO = { SILK: "silk", DTF: "silk", BORDADO: "bordado", SUBLIMACAO: "sublimacao" };
// v414 — FPP em "primeira maiúscula, demais minúsculas" (só na exibição; o valor gravado não muda)
const SIGLAS_SC = new Set(["DTF", "DTG", "MC", "ML", "PA", "PU", "PVC", "EVA", "NF", "OP", "FPP", "CNPJ", "LTDA", "ME", "EPP", "SA", "UV"]);
function sc(t) {
  const s0 = String(t ?? "");
  if (!s0.trim()) return s0;
  const low = s0.toLocaleLowerCase("pt-BR").replace(/r\$/g, "R$")
    .replace(/\p{L}+/gu, (w) => (SIGLAS_SC.has(w.toUpperCase()) ? w.toUpperCase() : w));
  const i = low.search(/\p{L}/u);
  return i < 0 ? low : low.slice(0, i) + low.charAt(i).toLocaleUpperCase("pt-BR") + low.slice(i + 1);
}
const nomeLocal = (k) => (LOCAIS_PERS.find((x) => x[0] === k) || [k, k])[1];
const nomeMetodo = (k) => (METODOS_PERS.find((x) => x[0] === k) || [k, k])[1];
const silkPorCorDe = (params) => Number(params?.OPERACIONAL?.silkPorCor) || 0.8;
// valor por peça de uma aplicação
function valorAplicacao(a, params) {
  if (!a) return 0;
  return a.metodo === "SILK" ? (Number(a.cores) || 0) * silkPorCorDe(params) : num(a.valor);
}
// soma por técnica (silk/bordado/sublimação), só internas ou todas
function persPorTecnica(e, params, soInternas) {
  const out = { silk: 0, bordado: 0, sublimacao: 0 };
  for (const a of Array.isArray(e?.personalizacoes) ? e.personalizacoes : []) {
    if (soInternas && !a.interno) continue;
    const t = TEC_DO_METODO[a.metodo] || "silk";
    out[t] += valorAplicacao(a, params);
  }
  return out;
}

// Condições de pagamento -> parcelas {frac, dias, tipo}. tipo boleto = incide juros de título.
const COND_PAGTO = {
  "ANTECIPADO TOTAL": [{ frac: 1, dias: 0, tipo: "ant" }],
  "50 PEDIDO / 50 ENTREGA": [{ frac: .5, dias: 0, tipo: "ant" }, { frac: .5, dias: 0, tipo: "entrega" }],
  "50 PEDIDO / 25 ENTREGA / 25 BOLETO 30D": [{ frac: .5, dias: 0, tipo: "ant" }, { frac: .25, dias: 0, tipo: "entrega" }, { frac: .25, dias: 30, tipo: "boleto" }],
  "BOLETO 30D": [{ frac: 1, dias: 30, tipo: "boleto" }],
  "BOLETO 60D": [{ frac: 1, dias: 60, tipo: "boleto" }],
  "BOLETO 90D": [{ frac: 1, dias: 90, tipo: "boleto" }],
  "BOLETO 120D": [{ frac: 1, dias: 120, tipo: "boleto" }],
  "BOLETO 30/60": [{ frac: .5, dias: 30, tipo: "boleto" }, { frac: .5, dias: 60, tipo: "boleto" }],
  "BOLETO 30/45/60": [{ frac: 1 / 3, dias: 30, tipo: "boleto" }, { frac: 1 / 3, dias: 45, tipo: "boleto" }, { frac: 1 / 3, dias: 60, tipo: "boleto" }],
  "BOLETO 30/60/90": [{ frac: 1 / 3, dias: 30, tipo: "boleto" }, { frac: 1 / 3, dias: 60, tipo: "boleto" }, { frac: 1 / 3, dias: 90, tipo: "boleto" }],
  "BOLETO 30/60/90/120": [{ frac: .25, dias: 30, tipo: "boleto" }, { frac: .25, dias: 60, tipo: "boleto" }, { frac: .25, dias: 90, tipo: "boleto" }, { frac: .25, dias: 120, tipo: "boleto" }],
};
const COND_LISTA = Object.keys(COND_PAGTO);
const MARGEM_SUGERIDA = 0.2;   // v294 — sugestão do valor proposto: 20% de margem de contribuição

// v294 — costura: só os tipos condizentes com o nome da peça (camiseta não oferece calça etc.)
const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
function costuraDaPeca(item, lista) {
  const d = semAc(item);
  if (!d) return lista;
  const pre = (...ps) => lista.filter((c) => ps.some((p) => c.k === p || c.k.startsWith(p + "_")));
  let l = null;
  if (/AVENTAL/.test(d)) l = pre("AVENTAL");
  else if (/TOUCA|MASCARA/.test(d)) l = pre("TOUCA");
  else if (/CALCA|BERMUDA|SHORT/.test(d)) l = pre(/JEANS/.test(d) ? "CALCA_JEANS" : /SOCIAL/.test(d) ? "CALCA_SOCIAL" : "CALCA_OPERACIONAL");
  else if (/JAQUETA|PARKA|CORTA.?VENTO/.test(d) || (/BLUSAO|AGASALHO/.test(d) && /BRIM|TACTEL|NYLON/.test(d))) l = pre("JAQUETA");
  else if (/JALECO|GUARDA.?PO/.test(d)) l = pre("JALECO_OPERACIONAL");
  else if (/POLO/.test(d)) l = pre("POLO");
  else if (/MOLETOM|AGASALHO|BLUSAO|CASACO/.test(d)) l = pre("MOLETOM");
  else if (/CAMISETA|BABY ?LOOK|REGATA|T-?SHIRT/.test(d)) l = pre(/\bML\b|MANGA LONGA/.test(d) ? "CAMISETA_ML" : /\bMC\b|MANGA CURTA/.test(d) ? "CAMISETA_MC" : "CAMISETA");
  else if (/CAMISA/.test(d)) l = pre("CAMISA_SOCIAL");
  return l && l.length ? l : lista;
}

// ----- Dias úteis (feriados nacionais/bancários do Brasil) -----
function pascoa(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}
function feriadosBR(y) {
  const p = pascoa(y), mov = (n) => { const x = new Date(p); x.setDate(x.getDate() + n); return x; };
  const set = new Set();
  // fixos nacionais (bancários): [mês0, dia]
  [[0, 1], [3, 21], [4, 1], [8, 7], [9, 12], [10, 2], [10, 15], [10, 20], [11, 25]].forEach(([m, dd]) => set.add(`${y}-${m}-${dd}`));
  // móveis: carnaval (seg/ter), sexta santa, corpus christi
  [mov(-48), mov(-47), mov(-2), mov(60)].forEach((x) => set.add(`${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`));
  return set;
}
function ehUtil(dt, fer) { const w = dt.getDay(); if (w === 0 || w === 6) return false; return !fer.has(`${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`); }
function addDiasUteis(base, n) {
  const fer = new Set(); [base.getFullYear(), base.getFullYear() + 1].forEach((a) => feriadosBR(a).forEach((v) => fer.add(v)));
  const dt = new Date(base); let add = 0;
  while (add < n) { dt.setDate(dt.getDate() + 1); if (ehUtil(dt, fer)) add++; }
  return dt;
}
// prazo em dias corridos = dias até o vencimento + 2 dias úteis de compensação
function prazoComComp(dias) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(hoje); venc.setDate(venc.getDate() + dias);
  const comp = addDiasUteis(venc, 2);
  return Math.round((comp - hoje) / 86400000);
}

function personalizacaoVazia() { return { arte: "", peitoD: "", peitoE: "", mangaD: "", mangaE: "", costas: "", interno: false }; }
function fichaVazia(tipo) {
  return {
    tipo, item: "", nomeComercial: "", clienteNome: "", clienteId: null, qtde: "",
    negociacao: "",
    nomeArtigo: "", nomeArtigoForro: "",
    artigoDet: null, artigoForroDet: null, aviamentosDet: {},   // v404 — fornecedor, cor, código, largura (+ rendimento e ramada/tubular na malha)
    mpValor: "", forroValor: "", consumoForro: "",   // v208: consumo do forro (m/peça) — vazio = estimado pelo fator
    gola: "", punho: "", elastico: "", faixa: "", botaoQtd: "",
    faixaTipo: "", faixaCor: "", botaoTipo: "",
    forrada: false, materiasExtras: [],   // v411 — forro só com peça forrada; matérias-primas adicionais [{ nome, det, custo, modo: CONSUMO|RENDIMENTO, qtd }]   // v410 — tipo da faixa (R$/m), cor do tactel/gorgurão, tipo do botão
    faccao: "", faccaoInterna: false,   // processo interno: o valor volta para a operação
    extrasAviamentos: [], extrasProducao: [],   // custos extras, já em R$ por peça: [{ desc, valor }]
    silk: personalizacaoVazia(), bordado: personalizacaoVazia(), sublimacao: personalizacaoVazia(),
    personalizacoes: [], arteTotal: "", faccaoTipo: "",   // v272
    freteVolume: "", embExt: "", embInt: "SIMPLES", formaEntrega: "",   // v450 — PROPRIA | TRANSPORTADORA | FRETEBRAS | RETIRADA
    opInvest: "NAO", opTitulo: "NAO", condPagamento: "ANTECIPADO TOTAL", leadTime: "", repassarTaxas: false, paramsAlterados: false,
    valorProposto: "", comissaoPct: "",   // v208: % de comissão do vendedor sobre o valor do pedido
    abRend: "", abCorte: "", abAcab: "",   // v512 — acessório malha/plano: rendimento ou consumo, corte e expedição/acabamento digitados
    custoRevenda: "", revendaFornecedor: "", revendaDescricao: "",   // v512 — produto revenda: preço de custo por peça
  };
}

function Fpp({ user, master, abrirId, abrirVoltar, voltarRef }) {
  const [params, setParams] = useState(null);       // banco de dados (padrão)
  const [tipo, setTipo] = useState("MALHA");        // derivado da peça escolhida
  const [f, setF] = useState(() => fichaVazia("MALHA"));
  const [over, setOver] = useState({});             // overrides só desta precificação {caminho: valor}
  const [modoOverride, setModoOverride] = useState(false);
  const [paramsLocaisOpen, setParamsLocaisOpen] = useState(false);
  const [aba, setAba] = useState(abrirId ? "ficha" : "salvas");   // v514 — Orçamentação abre nas FPPs salvas (negociações e guias); ficha | banco | salvas
  const [origem, setOrigem] = useState(null);       // v513 — de onde a ficha em edição foi aberta: { aba: "salvas" } | { externo: { v: "pedido", numero } }
  const voltarSalvas = useRef(null);                // v513 — Voltar dentro das salvas (negociação aberta → cards da guia)
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [editNum, setEditNum] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [negs, setNegs] = useState([]);
  const carregarNegs = () => fetch("/api/fpp/negociacoes").then((r) => r.json()).then((d) => setNegs(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { carregarNegs(); }, []);

  useEffect(() => { fetch("/api/fpp/params").then((r) => r.json()).then(setParams).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/clientes").then((r) => r.json()).then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  // lista única de peças (malha + plano) e o tipo de cada uma
  const pecasAll = useMemo(() => {
    if (!params) return [];
    return [
      ...PECAS_ESPECIAIS,   // v512 — acessório malha, acessório plano e produto revenda
      ...((params.MALHA?.PECA) || []).map((p) => ({ chave: p.chave, tipo: "MALHA" })),
      ...((params.PLANO?.PECA) || []).map((p) => ({ chave: p.chave, tipo: "PLANO" })),
    ].filter((p, i, l) => l.findIndex((x) => x.chave === p.chave) === i);
  }, [params]);
  const tipoDaPeca = (chave) => pecasAll.find((p) => p.chave === chave)?.tipo;

  // ao escolher/digitar a peça, o sistema define malha/plano sozinho
  function escolherPeca(chave) {
    const t = tipoDaPeca(chave);
    setF((s) => {
      const base = { ...s, item: chave };
      if (t && t !== tipo) { base.gola = ""; base.punho = ""; base.elastico = ""; base.faixa = ""; base.embExt = ""; }
      return base;
    });
    if (t) setTipo(t);
  }

  // helper: valor de um parâmetro considerando override desta ficha
  function pget(grupo, chave, campo = "valor") {
    if (!params) return 0;
    const t = params[tipo]?.[grupo] || params.COMUM?.[grupo] || [];
    // v512 — acessório/revenda: aviamento ou embalagem de qualquer tipo
    const row = t.find((x) => x.chave === chave) || [params.COMUM, params.MALHA, params.PLANO].map((g) => (g?.[grupo] || []).find((x) => x.chave === chave)).find(Boolean);
    if (!row) return 0;
    const path = `${grupo}:${chave}:${campo}`;
    if (over[path] != null && over[path] !== "") return num(over[path]);
    return campo === "valor" ? row.valor : (row.extra ? row.extra[campo] : 0);
  }
  function cget(chave) { // constante (tipo atual, senão COMUM)
    const path = `CONST:${chave}:valor`;
    if (over[path] != null && over[path] !== "") return num(over[path]);
    const row = (params?.[tipo]?.CONST || []).find((x) => x.chave === chave)
      || (params?.COMUM?.CONST || []).find((x) => x.chave === chave);
    return row ? row.valor : 0;
  }

  // v294 — costura: só tipos condizentes com a peça; com um único tipo possível, já escolhe
  const costuraOpcoes = useMemo(() => costuraDaPeca(f.item, params?.OPERACIONAL?.costura || []), [f.item, params]);
  useEffect(() => {
    if (!f.item || !costuraOpcoes.length) return;
    const atual = costuraOpcoes.find((c) => c.k === f.faccaoTipo);
    if (!atual && costuraOpcoes.length === 1) setF((s0) => ({ ...s0, faccaoTipo: costuraOpcoes[0].k, faccao: costuraOpcoes[0].semValor ? s0.faccao : String(costuraOpcoes[0].valor).replace(".", ",") }));
  }, [costuraOpcoes]);
  const golas = params?.MALHA?.GOLA || [];
  const punhos = params?.MALHA?.PUNHO || [];
  const elasticos = params?.PLANO?.ELASTICO || [];
  const aberta = ehPecaAberta(f.item), revenda = ehRevenda(f.item, tipo);   // v512
  const faixas = params?.[tipo]?.FAIXA || params?.COMUM?.FAIXA || [];
  const embExts = revenda ? [...new Map([...(params?.MALHA?.EMB_EXT || []), ...(params?.PLANO?.EMB_EXT || [])].map((g) => [g.chave, g])).values()] : (params?.[tipo]?.EMB_EXT || []);
  const embInts = params?.COMUM?.EMB_INT || [];
  const faixaTipos = params?.COMUM?.FAIXA_TIPO || [];   // v410
  const botaoTipos = params?.COMUM?.BOTAO || [];
  const getP = (g, k, c) => (g === "CONST" ? cget(k) : pget(g, k, c));

  // ---------------- CÁLCULO (fiel à planilha) ----------------
  const r = useMemo(() => {
    if (!params) return null;
    const isMalha = tipo === "MALHA";
    const qt = Math.max(1, num(f.qtde));
    // v512 — acessório: valores digitados na ficha; revenda: sem matéria-prima, aviamentos e produção
    const rendCons = revenda ? 0 : aberta ? num(f.abRend) : pget("PECA", f.item, "valor");           // rendimento(peças/kg) ou consumo(m/peça)
    const corte = revenda ? 0 : aberta ? num(f.abCorte) : pget("PECA", f.item, "corte");
    const prodPeca = revenda ? 0 : aberta ? num(f.abAcab) : isMalha ? pget("PECA", f.item, "exped") : pget("PECA", f.item, "acab");
    const volProp = (aberta || revenda ? 1 : pget("PECA", f.item, "volProp")) || 1;
    const reembolso = revenda ? 0 : cget("REEMBOLSO_CONSUMO");
    const linha = revenda ? 0 : cget("LINHA_CUSTO");

    // Matéria-prima (inclui o custo de linha fixo)
    let mp = 0;
    if (revenda) mp = 0;
    else if (isMalha) mp = (rendCons ? num(f.mpValor) / rendCons : 0) + reembolso;
    else mp = num(f.mpValor) * rendCons + reembolso;
    // Forro (plano)
    let forro = 0;
    const consumoForroEst = isMalha ? 0 : cget("FORRO_FATOR") * rendCons;
    const consumoForro = num(f.consumoForro) > 0 ? num(f.consumoForro) : consumoForroEst;   // v208: informado na ficha ou estimado
    if (!revenda && (!isMalha || aberta) && f.forrada) forro = num(f.forroValor) * consumoForro;   // v411 — só peça forrada
    const mpExtras = revenda ? 0 : custoMpExtras(f.materiasExtras);
    const custoRevenda = revenda ? num(f.custoRevenda) : 0;   // v512 — preço de custo do produto revendido
    const materiaPrima = mp + forro + mpExtras + linha;

    // Aviamentos (sem a linha, que já entrou na matéria-prima)
    // v410 — elástico e faixa por metro (consumo × R$/m); botão pelo tipo
    const elast = elasticoCalc(getP, f.elastico);
    const golaOuElast = aberta ? pget("GOLA", f.gola) + elast.valor : isMalha ? pget("GOLA", f.gola) : elast.valor;   // v512 — acessório: gola e elástico
    const punho = isMalha || aberta ? pget("PUNHO", f.punho) : 0;
    const fx = faixaCalc(getP, f.faixa, f.faixaTipo);
    const faixa = fx.valor;
    const botaoUn = botaoUnit(getP, f.botaoTipo);
    const botao = botaoUn * num(f.botaoQtd);
    const extrasAv = somaAvExtras(f.extrasAviamentos);   // v411
    const aviamentos = revenda ? 0 : golaOuElast + punho + faixa + botao + extrasAv;

    // Produção
    const extrasProd = somaExtras(f.extrasProducao);
    const producao = revenda ? 0 : corte + prodPeca + num(f.faccao) + extrasProd;

    // Personalização (arte rateada ÷ qtde + posições por peça)
    const perTec = (p) => (num(p.arte) / qt) + POS.reduce((s, [k]) => s + num(p[k]), 0);
    const pn = persPorTecnica(f, params, false);
    // v294 — arte/tela (silk) e programa (bordado) por aplicação: valor total do pedido, sempre terceirizado, rateado ÷ qtde
    const artesApl = (Array.isArray(f.personalizacoes) ? f.personalizacoes : []).reduce((s0, a) => s0 + num(a.arte), 0);
    const personalizacao = perTec(f.silk) + perTec(f.bordado) + perTec(f.sublimacao) + pn.silk + pn.bordado + pn.sublimacao + (num(f.arteTotal) + artesApl) / qt;

    // Logística
    const pcsPorVolume = pget("EMB_EXT", f.embExt, "und") * volProp || 1;
    const logistica = cget("LOGISTICA_BASE") + (num(f.freteVolume) / pcsPorVolume);

    // Embalagem
    const valEmb = pget("EMB_EXT", f.embExt, "valor");
    const undEmb = pget("EMB_EXT", f.embExt, "und") || 1;
    const fita = pget("EMB_EXT", f.embExt, "fita");
    const embExt = (valEmb / (undEmb * volProp)) + fita;
    const embInt = pget("EMB_INT", f.embInt);
    const embalagem = embExt + embInt;

    const custoProducao = custoRevenda + materiaPrima + aviamentos + producao + personalizacao + logistica + embalagem;

    // o que VOLTA para a operação (por peça)
    const volta = calcVolta(params, tipo, f, over);

    // Financeiro
    const vp = num(f.valorProposto);
    const imposto = cget("IMPOSTO");
    const leadTime = num(f.leadTime);
    // Investimento: juros sobre o custo de produção durante TODO o lead time
    const opInv = f.opInvest === "SIM" ? cget("OP_INVEST_TAXA") * (leadTime / 30) * custoProducao : 0;
    // Título: juros sobre cada parcela em boleto, pelo prazo da parcela + 2 dias úteis
    const cond = COND_PAGTO[f.condPagamento] || COND_PAGTO["ANTECIPADO TOTAL"];
    let opTit = 0;
    if (f.opTitulo === "SIM") {
      for (const p of cond) if (p.tipo === "boleto") opTit += vp * p.frac * cget("OP_TITULO_TAXA") * (prazoComComp(p.dias) / 30);
    }
    const opFin = opInv + opTit;
    const comissaoPct = num(f.comissaoPct) / 100;   // v208: comissão do vendedor (% do valor do pedido)
    const comissao = vp * comissaoPct;
    const custoFinal = custoProducao + opFin + imposto * vp + comissao;
    const roic = custoFinal ? (vp - custoFinal) / custoFinal : 0;
    const margem = vp ? (vp - custoFinal) / vp : 0;
    const totalItem = vp * num(f.qtde);
    // v294 — sugestão do valor proposto (20% de margem). Sem repassar: a empresa absorve título, investimento e comissão.
    //   Repassando: o preço cobre essas taxas e a margem de 20% fica preservada.
    let kTit = 0;
    if (f.opTitulo === "SIM") for (const p of cond) if (p.tipo === "boleto") kTit += p.frac * cget("OP_TITULO_TAXA") * (prazoComComp(p.dias) / 30);
    const denBase = 1 - imposto - MARGEM_SUGERIDA;
    const denRep = 1 - imposto - comissaoPct - kTit - MARGEM_SUGERIDA;
    const sugestaoBase = denBase > 0 ? custoProducao / denBase : null;
    const sugestaoRepasse = denRep > 0 ? (custoProducao + opInv) / denRep : null;
    const sugestao = f.repassarTaxas ? sugestaoRepasse : sugestaoBase;

    return { revenda, aberta, custoRevenda, mpExtras, elast, fx, botaoUn, rendCons, sugestao, sugestaoBase, sugestaoRepasse, consumoForro, consumoForroEst, comissao, comissaoPct, comissaoTotal: comissao * num(f.qtde), mp, forro, linha, materiaPrima, aviamentos, producao, personalizacao, logistica, embalagem, custoProducao, opFin, custoFinal, roic, margem, totalItem, volta, acabRotulo: isMalha ? "Expedição" : "Acabamento" };
  }, [params, tipo, f, over, aberta, revenda]);

  function montarBody() {
    return {
      tipo, item: f.item, nomeComercial: f.nomeComercial, clienteId: f.clienteId, clienteNome: f.clienteNome, qtde: num(f.qtde),
      negociacao: f.negociacao || null,
      condicaoPagamento: f.condPagamento, leadTime: num(f.leadTime),
      entradas: { ...f, paramsAlterados: !!(modoOverride || Object.keys(over).length) }, overrides: Object.keys(over).length ? over : null,
      resultados: r,
      custoProducao: r?.custoProducao, custoFinal: r?.custoFinal, valorProposto: num(f.valorProposto),
      margem: r?.margem, totalItem: r?.totalItem,
      criadoPorId: user?.id, criadoPorNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim(),
    };
  }
  async function salvar() {
    if (!f.item) return setMsg("Selecione o ITEM.");
    setSalvando(true); setMsg("");
    const body = montarBody();
    const url = editId ? `/api/fpp/${editId}` : "/api/fpp";
    const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const salvo = await res.json().catch(() => ({}));
    setSalvando(false);
    if (res.ok) carregarNegs();
    if (res.ok && !editId && salvo.id) { setEditId(salvo.id); setEditNum(salvo.numero); }   // salvar de novo atualiza esta, não cria outra
    setMsg(res.ok ? (editId ? `FPP ${fmtFpp(salvo.numero || editNum)} atualizada ✓` : `FPP ${fmtFpp(salvo.numero)} salva ✓`) : "Erro ao salvar.");
  }

  function carregarFicha(fpp, deOnde) {
    if (deOnde !== undefined) setOrigem(deOnde);   // v513
    if (fpp?.id) ssGravar("ce_fpp_ultima", fpp.id);
    const e = fpp.entradas || {};
    setF({ ...fichaVazia(fpp.tipo || "MALHA"), ...e, forrada: e.forrada ?? !!(e.nomeArtigoForro || num(e.forroValor) || num(e.consumoForro)), clienteNome: fpp.clienteNome ?? e.clienteNome, clienteId: fpp.clienteId ?? e.clienteId,
      negociacao: fpp.negociacao ?? e.negociacao ?? e.pregao ?? "" });
    setTipo(fpp.tipo || tipoDaPeca(e.item || fpp.item) || "MALHA");
    setOver(fpp.overrides || {});
    setModoOverride(!!(e.paramsAlterados || (fpp.overrides && Object.keys(fpp.overrides).length)));   // v294
    setEditId(fpp.id); setEditNum(fpp.numero);
    setAba("ficha");
    setMsg(`Editando a FPP ${fmtFpp(fpp.numero)} ✓`);
  }
  // v420 — aberta a partir da Gestão da produção: carrega a FPP para edição
  useEffect(() => { if (abrirId) fetch(`/api/fpp/${abrirId}`).then((r) => r.json()).then((x) => { if (x && x.id) carregarFicha(x, abrirVoltar ? { externo: abrirVoltar } : null); }).catch(() => {}); }, [abrirId]);
  // clona o que está na tela (inclusive alterações ainda não salvas) e passa a editar a cópia
  async function clonarAtual() {
    if (!f.item) return setMsg("Selecione o ITEM.");
    setSalvando(true); setMsg("");
    try {
      const nova = await clonarFpp(montarBody(), user, editId);
      setF((s) => ({ ...s, nomeComercial: nova.nomeComercial }));
      setEditId(nova.id); setEditNum(nova.numero);
      setMsg(`Cópia criada: FPP ${fmtFpp(nova.numero)} ✓ — você está editando a cópia.`);
      carregarNegs();
    } catch (e) { setMsg(e.message); alerta(`Não foi possível clonar: ${e.message}`); }
    setSalvando(false);
  }
  async function clonarSalva(fpp) {
    try { const nova = await clonarFpp(fpp, user); carregarFicha(nova, { aba: "salvas" }); carregarNegs(); setMsg(`Cópia criada: FPP ${fmtFpp(nova.numero)} ✓ — você está editando a cópia.`); }
    catch (e) { alerta(`Não foi possível clonar: ${e.message}`); }
  }
  function novaFicha() { setF(fichaVazia(tipo)); setOver({}); setModoOverride(false); setEditId(null); setEditNum(null); setMsg(""); }
  function criarFpp() { novaFicha(); setOrigem({ aba: "salvas" }); setAba("ficha"); }   // v514

  // v513 — Voltar: ficha aberta de algum lugar → volta para lá; dentro de uma negociação/cliente/peça → volta aos cards
  if (voltarRef) voltarRef.current = () => {
    if (aba === "ficha" && origem?.externo) { window.dispatchEvent(new CustomEvent("ce:ir", { detail: origem.externo })); return true; }
    if (aba === "ficha" && origem?.aba) { setAba(origem.aba); setOrigem(null); return true; }
    if (aba === "salvas" && voltarSalvas.current?.()) return true;
    if (aba === "ficha" || aba === "banco") { setAba("salvas"); return true; }   // v514 — ficha nova / banco → FPPs salvas
    return false;
  };

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setP = (tec, k, v) => setF((s) => ({ ...s, [tec]: { ...s[tec], [k]: v } }));
  const setAvDet = (k, d) => setF((s) => ({ ...s, aviamentosDet: { ...(s.aviamentosDet || {}), [k]: d } }));   // v405

  if (!params) return <div className="text-sm" style={{ color: C.sub }}>Carregando parâmetros…</div>;

  return (
    <div>
      {/* topo: abas ficha/banco (o tipo é definido pela peça) */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 flex-1" style={{ borderBottom: `1px solid ${C.line}` }}>
          {[["salvas", "Negociações e FPPs", Layers], ...(aba === "ficha" ? [["ficha", editId ? `FPP ${fmtFpp(editNum)}` : "Nova FPP", Calculator]] : []), ["banco", "Banco de dados", Database]].map(([k, t, Ico]) => (
            <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
              style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
              <Ico size={15} /> {t}
            </button>
          ))}
        </div>
        {aba !== "ficha" && (
          <button onClick={criarFpp} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
            <Plus size={15} /> Criar FPP
          </button>
        )}
        {aba === "ficha" && f.item && tipoDaPeca(f.item) && (
          <div className="flex items-center gap-2">
            {editId && <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: C.yellowSoft, color: C.yellow, border: `1px solid ${C.yellow}55` }}>Editando FPP {fmtFpp(editNum)}</span>}
            {editId && <button onClick={novaFicha} className="text-xs px-2 py-1 rounded-md" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Nova ficha</button>}
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
              {revenda ? "Revenda · preço de custo" : aberta ? (tipo === "MALHA" ? "Acessório malha · campos livres" : "Acessório plano · campos livres") : tipo === "MALHA" ? "Malha · peças/kg" : "Plano · metros/peça"}
            </span>
          </div>
        )}
      </div>

      {aba === "banco" && <BancoParams params={params} master={master} user={user} onReload={() => fetch("/api/fpp/params").then((x) => x.json()).then(setParams)} />}

      {aba === "salvas" && <FichasSalvas master={master} onEditar={(x) => carregarFicha(x, { aba: "salvas" })} onClonar={clonarSalva} voltarRef={voltarSalvas} />}

      {aba === "ficha" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* coluna de entradas */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Identificação">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Combo label="Item (peça)" value={f.item} options={pecasAll.map((p) => p.chave)}
                  onChange={escolherPeca} onPick={escolherPeca} placeholder="Digite a peça…" />
                <Inp label="Nome comercial do item" value={f.nomeComercial} onChange={(v) => set("nomeComercial", v)} />
                <ClienteCombo clientes={clientes} value={f.clienteNome}
                  onType={(v) => setF((s) => ({ ...s, clienteNome: v, clienteId: null }))}
                  onPick={(c) => setF((s) => ({ ...s, clienteNome: c.razaoSocial || c.nomeFantasia || "", clienteId: c.id }))}
                  onCreated={(c) => { setClientes((l) => [c, ...l]); setF((s) => ({ ...s, clienteNome: c.razaoSocial, clienteId: c.id })); }} />
                <Inp label="Qtde" value={f.qtde} onChange={(v) => set("qtde", v)} />
                <Combo label="Negociação" value={f.negociacao} options={negs} livre
                  onChange={(v) => set("negociacao", String(v || "").toUpperCase())} onPick={(v) => set("negociacao", String(v || "").toUpperCase())}
                  placeholder="Escolha ou digite uma nova…" />
                {/* v294 — "alterar parâmetros" na altura do campo de negociação; a ficha fica marcada com ! na lista */}
                <div className="flex items-center gap-2 md:col-span-3 flex-wrap self-end" style={{ minHeight: 34 }}>
                  <Toggle on={modoOverride} onChange={(v) => { setModoOverride(v); if (!v) { setOver({}); setParamsLocaisOpen(false); } }} />
                  <span className="text-xs font-semibold" style={{ color: modoOverride ? C.accent : C.sub }}>Alterar parâmetros</span>
                  {modoOverride && <span title="Ficha com parâmetros alterados" className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ width: 18, height: 18, background: C.red, color: "#fff" }}>!</span>}
                  {modoOverride && (
                    <button onClick={() => setParamsLocaisOpen(true)} className="ml-1 flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
                      style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
                      <SlidersHorizontal size={13} /> Ajustar todos os parâmetros
                      {Object.keys(over).length > 0 && <span className="ml-1 px-1.5 rounded-full" style={{ background: C.accent, color: "#fff" }}>{Object.keys(over).length}</span>}
                    </button>
                  )}
                </div>
              </div>
            </Card>

            {revenda && (
              <Card title="Produto revenda">
                {/* v512 — revenda: só o preço de custo do produto pronto; o resto (personalização, lead time, logística, financeiro) segue igual */}
                <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr) 160px" }}>
                  <Inp full text label="Descrição do produto" value={f.revendaDescricao} onChange={(v) => set("revendaDescricao", v.toUpperCase())} placeholder="ex.: BONÉ TRUCKER, GARRAFA TÉRMICA…" />
                  <Inp full text label="Fornecedor" value={f.revendaFornecedor} onChange={(v) => set("revendaFornecedor", v.toUpperCase())} />
                  <Inp full label="Preço de custo (R$/peça)" value={f.custoRevenda} onChange={(v) => set("custoRevenda", v)} destaque />
                </div>
                <div className="text-[11px] mt-2" style={{ color: C.sub }}>Sem matéria-prima, aviamentos e produção: o custo do produto entra direto no custo da peça.</div>
              </Card>
            )}

            {!revenda && <Card title="Matéria-prima">
              {/* v411 — linhas na mesma grade: artigo · custo · consumo/rendimento · (forrada) */}
              <div className="space-y-3">
                <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 150px" + (tipo === "PLANO" || aberta ? " 120px" : "") }}>
                  <ArtigoNomeDet label={tipo === "MALHA" ? "Artigo (malha)" : "Artigo (tecido externo)"} nome={f.nomeArtigo} det={f.artigoDet} categoria={tipo === "MALHA" ? "MALHA" : "TECIDO"}
                    onNome={(v) => set("nomeArtigo", v.toUpperCase())} onDet={(d) => set("artigoDet", d)} />
                  <Inp full label={tipo === "MALHA" ? "Custo (R$/kg)" : "Custo (R$/m)"} value={f.mpValor} onChange={(v) => set("mpValor", v)} />
                  {aberta
                    ? <Inp full label={tipo === "MALHA" ? "Rendimento (pç/kg)" : "Consumo (m/peça)"} value={f.abRend} onChange={(v) => set("abRend", v)} />
                    : <Ref full label={tipo === "MALHA" ? "Rendimento (pç/kg)" : "Consumo (m/peça)"} grupo="PECA" chave={f.item} campo="valor" pget={pget} over={over} setOver={setOver} modo={modoOverride} />}
                  {(tipo === "PLANO" || aberta) && (
                    <div>
                      <div className="text-xs mb-1" style={{ color: C.sub }}>Peça forrada</div>
                      <div className="flex items-center" style={{ minHeight: 34 }}><Toggle on={!!f.forrada} onChange={(v) => set("forrada", v)} /></div>
                    </div>
                  )}
                </div>
                {(tipo === "PLANO" || aberta) && f.forrada && (
                  <div className="grid gap-3 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 150px 120px" }}>
                    <ArtigoNomeDet label="Artigo (forro)" nome={f.nomeArtigoForro} det={f.artigoForroDet} categoria="TECIDO"
                      onNome={(v) => set("nomeArtigoForro", v.toUpperCase())} onDet={(d) => set("artigoForroDet", d)} />
                    <Inp full label="Custo do forro (R$/m)" value={f.forroValor} onChange={(v) => set("forroValor", v)} />
                    <Inp full label="Consumo (m/peça)" value={f.consumoForro} onChange={(v) => set("consumoForro", v)}
                      placeholder={r && r.consumoForroEst ? `estimado ${(r.consumoForroEst || 0).toFixed(2).replace(".", ",")}` : ""} />
                    <div />
                  </div>
                )}
                <MpExtras lista={f.materiasExtras} onChange={(l) => set("materiasExtras", l)} cols={tipo === "PLANO" || aberta} />
              </div>
            </Card>}

            {!revenda && <Card title="Aviamentos">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {(tipo === "MALHA" || aberta) && (
                  <>
                    <AvComDet valor={f.gola} det={f.aviamentosDet?.GOLA} onDet={(d) => setAvDet("GOLA", d)}><Combo label="Gola" value={f.gola} onChange={(v) => set("gola", v)} options={golas.map((g) => g.chave)} placeholder="Digite…" /></AvComDet>
                    <AvComDet valor={f.punho} det={f.aviamentosDet?.PUNHO} onDet={(d) => setAvDet("PUNHO", d)}><Combo label="Punho" value={f.punho} onChange={(v) => set("punho", v)} options={punhos.map((g) => g.chave)} placeholder="Digite…" /></AvComDet>
                  </>
                )}
                {(tipo === "PLANO" || aberta) && (
                  <div>
                    <AvComDet valor={f.elastico} det={f.aviamentosDet?.ELASTICO} onDet={(d) => setAvDet("ELASTICO", d)}><Combo label="Elástico" value={f.elastico} onChange={(v) => set("elastico", v)} options={elasticos.map((g) => g.chave)} placeholder="Digite…" /></AvComDet>
                    <AvMetro c={r?.elast} />
                  </div>
                )}
                <div>
                  <AvComDet valor={f.faixa} det={f.aviamentosDet?.FAIXA} onDet={(d) => setAvDet("FAIXA", d)}><Combo label="Faixa refletiva (aplicação)" value={f.faixa} onChange={(v) => set("faixa", v)} options={faixas.map((g) => g.chave)} placeholder="Digite…" /></AvComDet>
                  {!semAv(f.faixa) && (
                    <div className="flex gap-2 mt-2">
                      <SelAv label="Tipo de faixa" value={f.faixaTipo} onChange={(v) => setF((s0) => ({ ...s0, faixaTipo: v, faixaCor: faixaPedeCor(v) ? (s0.faixaCor || "") : "" }))} options={faixaTipos.map((g) => g.chave)} />
                      {faixaPedeCor(f.faixaTipo) && <SelAv label={/PRONTA/i.test(f.faixaTipo) ? "Cor do gorgurão" : "Cor do tactel"} value={f.faixaCor} onChange={(v) => set("faixaCor", v)} options={FAIXA_CORES} />}
                    </div>
                  )}
                  <AvMetro c={r?.fx} semTipo={!semAv(f.faixa) && !f.faixaTipo} />
                </div>
                <div>
                  <AvComDet valor={f.botaoQtd} botao det={f.aviamentosDet?.BOTAO} onDet={(d) => setAvDet("BOTAO", d)}><Inp label="Qtde de botões" value={f.botaoQtd} onChange={(v) => set("botaoQtd", v)} /></AvComDet>
                  {num(f.botaoQtd) > 0 && <div className="mt-2"><SelAv label="Tipo de botão" value={f.botaoTipo} onChange={(v) => set("botaoTipo", v)} options={botaoTipos.map((g) => g.chave)} /></div>}
                  {num(f.botaoQtd) > 0 && obsBotao(f.botaoTipo) && <div className="text-[11px] mt-1 font-semibold" style={{ color: /^NÃO/.test(obsBotao(f.botaoTipo)) ? C.green : C.red }}>Obs.: {obsBotao(f.botaoTipo).toLowerCase()}</div>}
                  {num(f.botaoQtd) > 0 && r && <div className="text-[11px] mt-1" style={{ color: C.sub }}>{f.botaoQtd} un × R$ {fmtNum(r.botaoUn, 2)} = <b style={{ color: C.text }}>R$ {fmtNum(r.botaoUn * num(f.botaoQtd), 2)}/pç</b></div>}
                </div>
              </div>
              <AvExtras lista={f.extrasAviamentos} onChange={(l) => set("extrasAviamentos", l)} />
            </Card>}

            {!revenda && <Card title="Produção">
              {/* v294 — linha da costura: tipo de peça (só os condizentes) · valor da facção (fixo, salvo com "alterar parâmetros") · terceirizado ⇄ interno */}
              <div className="flex flex-wrap items-end gap-3 mb-3">
                {(params?.OPERACIONAL?.costura || []).length > 0 && (
                  <div className="flex-1" style={{ minWidth: 220 }}>
                    <div className="text-xs mb-1" style={{ color: C.sub }}>Costura · tipo de peça</div>
                    <select value={f.faccaoTipo || ""} onChange={(e) => {
                      const c = (params.OPERACIONAL.costura || []).find((x) => x.k === e.target.value);
                      setF((s0) => ({ ...s0, faccaoTipo: e.target.value, faccao: c && !c.semValor ? String(c.valor).replace(".", ",") : "" }));
                    }} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }}>
                      <option value="">Escolha…</option>
                      {costuraOpcoes.map((c) => <option key={c.k} value={c.k}>{c.n}{c.semValor ? " (sem valor na análise)" : ""}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <div className="text-xs mb-1 flex items-center gap-1" style={{ color: C.sub }}>Facção (R$/peça){modoOverride && <Pencil size={11} />}</div>
                  {modoOverride || !(params?.OPERACIONAL?.costura || []).length || costuraOpcoes.find((c) => c.k === f.faccaoTipo)?.semValor || !f.faccaoTipo ? (
                    <input value={f.faccao} onChange={(e) => set("faccao", e.target.value)} inputMode="decimal"
                      className="px-2 py-1.5 rounded text-sm" style={{ width: 110, background: "#fff", border: `1px ${modoOverride ? "dashed" : "solid"} ${modoOverride ? C.accent : C.line}`, color: C.text }} />
                  ) : (
                    <div className="px-2 py-1.5 rounded text-sm tabular-nums" style={{ width: 110, background: C.panel2, border: `1px solid ${C.line}`, color: C.text }} title="Valor da análise da costura · use Alterar parâmetros para mudar">{num(f.faccao) ? brl(num(f.faccao)) : "—"}</div>
                  )}
                </div>
                <SeletorOrigem interno={!!f.faccaoInterna} onChange={(v) => set("faccaoInterna", v)} />
              </div>
              <div className="flex flex-wrap gap-3">
                {aberta ? (
                  <>
                    <Inp label="Corte (R$/peça)" value={f.abCorte} onChange={(v) => set("abCorte", v)} />
                    <Inp label={tipo === "MALHA" ? "Expedição (R$/peça)" : "Acabamento (R$/peça)"} value={f.abAcab} onChange={(v) => set("abAcab", v)} />
                  </>
                ) : (
                  <>
                    <Ref label="Corte" grupo="PECA" chave={f.item} campo="corte" pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                    <Ref label={tipo === "MALHA" ? "Expedição" : "Acabamento"} grupo="PECA" chave={f.item} campo={tipo === "MALHA" ? "exped" : "acab"} pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                  </>
                )}
              </div>
              {params?.OPERACIONAL?.meses?.length > 0 && (
                <div className="text-[11px] mt-2" style={{ color: C.sub }}>
                  Corte, {tipo === "MALHA" ? "expedição" : "acabamento"} e costura: Análises operacionais de {params.OPERACIONAL.meses.map((m) => m.slice(5, 7) + "/" + m.slice(2, 4)).join(", ")}. Atualiza sozinho a cada mês completo novo.
                </div>
              )}
              <ExtrasCustos lista={f.extrasProducao} onChange={(l) => set("extrasProducao", l)} />
            </Card>}

            <Card title="Personalização">
              {/* v272 — aplicações: + → local → método (silk: nº de cores × R$/cor das Análises; bordado/DTF/sublimação: valor digitado) */}
              <PersAplicacoes lista={f.personalizacoes || []} onChange={(l) => set("personalizacoes", l)} params={params} qtde={num(f.qtde)} />
              {num(f.arteTotal) > 0 && <div className="mt-2"><ArteInp label="Arte / tela (R$ total, formato anterior)" value={f.arteTotal || ""} onChange={(v) => set("arteTotal", v)} qtde={num(f.qtde)} /></div>}
              {["silk", "bordado", "sublimacao"].some((tec) => f[tec] && (num(f[tec].arte) || POS.some(([k]) => num(f[tec][k])))) && <div className="text-[11px] mt-3 mb-1 font-semibold" style={{ color: C.sub }}>Valores antigos desta ficha (formato anterior):</div>}
              {[["silk", "Silk / DTF / DTG"], ["bordado", "Bordado / Patch"], ["sublimacao", "Sublimação"]].filter(([tec]) => f[tec] && (num(f[tec].arte) || POS.some(([k]) => num(f[tec][k])))).map(([tec, lbl]) => (
                <div key={tec} className="mb-3">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="text-xs font-semibold" style={{ color: C.text }}>{lbl}</div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: f[tec].interno ? C.accent : C.sub }}>
                      <Toggle on={!!f[tec].interno} onChange={(v) => setP(tec, "interno", v)} /> Processo interno
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <ArteInp label="Arte (total)" value={f[tec].arte} onChange={(v) => setP(tec, "arte", v)} qtde={num(f.qtde)} />
                    {POS.map(([k, l]) => <Inp key={k} label={l} value={f[tec][k]} onChange={(v) => setP(tec, k, v)} />)}
                  </div>
                </div>
              ))}
            </Card>

            {/* v294 — lead time previsto logo depois da personalização */}
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
              <div className="text-sm font-bold" style={{ color: C.navy }}>Lead time previsto</div>
              <div className="flex items-center gap-2">
                <input value={f.leadTime} onChange={(e) => set("leadTime", e.target.value)} inputMode="numeric" className="px-2 py-1.5 rounded text-sm" style={{ width: 80, background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
                <span className="text-xs" style={{ color: C.sub }}>dias</span>
              </div>
              {num(f.leadTime) > 0 && <span className="text-xs" style={{ color: C.sub }}>entrega prevista em {new Date(Date.now() + num(f.leadTime) * 86400000).toLocaleDateString("pt-BR")}</span>}
            </div>

            <Card title="Logística e embalagem">
              <div className="grid gap-3" style={{ gridTemplateColumns: "150px minmax(0,1.4fr) minmax(0,1fr)" }}>
                <Inp full label="Frete por volume (R$)" value={f.freteVolume} onChange={(v) => set("freteVolume", v)} />
                <Combo label="Embalagem externa" value={f.embExt} onChange={(v) => set("embExt", v)} options={embExts.map((g) => g.chave)} placeholder="Digite…" />
                <Combo label="Embalagem interna" value={f.embInt} onChange={(v) => set("embInt", v)} options={embInts.map((g) => g.chave)} placeholder="Digite…" />
              </div>
              {/* v450 — forma de entrega: define a tarefa depois do faturamento (rota própria, transportadora, Fretebras ou retirada) */}
              <div className="mt-3">
                <div className="text-xs mb-1" style={{ color: C.sub }}>Forma de entrega</div>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                  {[["PROPRIA", "Própria"], ["TRANSPORTADORA", "Transportadora"], ["FRETEBRAS", "Fretebras"], ["RETIRADA", "Retirada"]].map(([k, t]) => (
                    <button key={k} type="button" onClick={() => set("formaEntrega", f.formaEntrega === k ? "" : k)} className="flex-1 px-2 py-1.5 text-xs font-semibold"
                      style={{ background: f.formaEntrega === k ? C.accent : "#fff", color: f.formaEntrega === k ? "#fff" : C.sub }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>Frete e embalagem são sempre externos — não voltam para a operação. Só a logística base volta.</div>
            </Card>

            <Card title="Operação financeira">
              {/* v294 — ordem: condição de pagamento › operações (investimento / título) e comissão › valor proposto (sugestão 20%) */}
              <div className="flex flex-wrap items-end gap-4">
                <div style={{ width: 260 }}><Combo label="Condição de pagamento" value={f.condPagamento} onChange={(v) => set("condPagamento", v)} options={COND_LISTA} placeholder="Digite…" /></div>
                <div className="flex items-center gap-2" style={{ minHeight: 34 }}>
                  <Toggle on={f.opInvest === "SIM"} onChange={(v) => set("opInvest", v ? "SIM" : "NAO")} />
                  <span className="text-xs" style={{ color: C.sub }}>Op. investimento</span>
                </div>
                <div className="flex items-center gap-2" style={{ minHeight: 34 }}>
                  <Toggle on={f.opTitulo === "SIM"} onChange={(v) => set("opTitulo", v ? "SIM" : "NAO")} />
                  <span className="text-xs" style={{ color: C.sub }}>Op. título</span>
                </div>
                <Inp label="Comissão do vendedor (%)" value={f.comissaoPct} onChange={(v) => set("comissaoPct", v)} placeholder="ex.: 3" />
              </div>
              {num(f.comissaoPct) > 0 && r && <div className="text-xs mt-1" style={{ color: C.sub }}>Comissão: <b style={{ color: C.text }}>{brl(r.comissao)}</b>/peça · <b style={{ color: C.text }}>{brl(r.comissaoTotal)}</b> no pedido</div>}
              <div className="flex flex-wrap items-end gap-4 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <Inp label="Valor proposto (R$)" value={f.valorProposto} onChange={(v) => set("valorProposto", v)} destaque placeholder={r?.sugestao ? brl(r.sugestao).replace("R$ ", "") : ""} />
                <div className="flex items-center gap-2" style={{ minHeight: 34 }}>
                  <Toggle on={!!f.repassarTaxas} onChange={(v) => set("repassarTaxas", v)} />
                  <span className="text-xs" style={{ color: f.repassarTaxas ? C.accent : C.sub }}>Repassar taxas financeiras</span>
                </div>
                {r?.sugestao != null && (
                  <div className="text-xs pb-2" style={{ color: C.sub }}>
                    Sugestão ({Math.round(MARGEM_SUGERIDA * 100)}% de margem{f.repassarTaxas ? ", com título, investimento e comissão repassados" : ""}): <b style={{ color: C.navy }}>{brl(r.sugestao)}</b>
                    <button onClick={() => set("valorProposto", r.sugestao.toFixed(2).replace(".", ","))} className="ml-2 font-semibold underline" style={{ color: C.accent }}>usar</button>
                    {f.repassarTaxas && r.sugestaoBase != null && <span className="ml-2">(sem repasse: {brl(r.sugestaoBase)})</span>}
                  </div>
                )}
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>
                Investimento: juros sobre o custo durante todo o lead time. Título: juros por parcela em boleto (prazo + 2 dias úteis), conforme a condição de pagamento.
                Sem repassar, a empresa absorve título, investimento e comissão (a margem real fica abaixo de {Math.round(MARGEM_SUGERIDA * 100)}%); repassando, o preço sugerido cobre essas taxas e preserva a margem.
              </div>
            </Card>
          </div>

          {/* coluna de resultados */}
          <div className="space-y-4">
            <div style={{ position: "sticky", top: 0, maxHeight: "calc(100vh - 16px)", overflowY: "auto" }} className="space-y-4">
            <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg p-4">
              <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Resultados</div>
              {r && (
                <div className="space-y-1.5 text-sm">
                  {r.revenda ? <Lin l="Custo do produto (revenda)" v={brl(r.custoRevenda)} /> : (
                    <>
                      <Lin l="Matéria-prima" v={brl(r.materiaPrima)} />
                      <Lin l="Aviamentos" v={brl(r.aviamentos)} />
                      <Lin l="Produção" v={brl(r.producao)} />
                    </>
                  )}
                  <Lin l="Personalização" v={brl(r.personalizacao)} />
                  <Lin l="Logística" v={brl(r.logistica)} />
                  <Lin l="Embalagem" v={brl(r.embalagem)} />
                  <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
                  <Lin l="Custo de produção" v={brl(r.custoProducao)} forte />
                  <Lin l="Operação financeira" v={brl(r.opFin)} />
                  {r.comissao > 0 && <Lin l={`Comissão vendedor (${(r.comissaoPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`} v={brl(r.comissao)} />}
                  <Lin l="Custo final" v={brl(r.custoFinal)} forte />
                  <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
                  <Lin l="ROIC" v={pct(r.roic)} cor={r.roic >= 0.3 ? C.green : r.roic >= 0.16 ? C.yellow : "#E5484D"} />
                  {(() => {
                    const m = r.margem;
                    const cor = m >= 0.4 ? C.green : m >= 0.3 ? C.green : m >= 0.16 ? C.yellow : "#E5484D";
                    const soft = m >= 0.3 ? C.greenSoft : m >= 0.16 ? "#FEF6E7" : "#FDECEC";
                    return (
                      <div className="rounded-md px-3 py-2 my-1 flex items-center justify-between" style={{ background: soft, border: `1px solid ${cor}` }}>
                        <span className="text-xs font-bold tracking-wide" style={{ color: cor }}>Margem de contribuição</span>
                        <span style={{ color: cor, fontWeight: 800, fontSize: 20, lineHeight: 1 }}>{pct(m)}</span>
                      </div>
                    );
                  })()}
                  <Lin l="Valor proposto" v={brl(num(f.valorProposto))} forte />
                  <Lin l="Total do item" v={brl(r.totalItem)} forte cor={C.accent} />
                </div>
              )}
              <div className="text-[11px] mt-3" style={{ color: C.sub }}>Mínimo venda 16% · boa venda 30% · excelente 40%</div>
              <button onClick={salvar} disabled={salvando} className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold"
                style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
                <Save size={15} /> {salvando ? "Salvando…" : editId ? "Atualizar ficha" : "Salvar ficha"}
              </button>
              {editId && (
                <button onClick={clonarAtual} disabled={salvando} title="Cria uma cópia desta FPP (com o que está na tela) e passa a editar a cópia"
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold"
                  style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, opacity: salvando ? 0.6 : 1 }}>
                  <Copy size={15} /> Clonar FPP
                </button>
              )}
              {msg && <div className="text-xs mt-2 text-center" style={{ color: msg.includes("✓") ? C.green : "#E5484D" }}>{msg}</div>}
            </div>
            {r && <VoltaOperacao volta={r.volta} qtde={num(f.qtde)} acabRotulo={r.acabRotulo} />}
            </div>
          </div>
        </div>
      )}

      {paramsLocaisOpen && (
        <ParamsLocaisModal params={params} tipo={tipo} f={f} pget={pget} cget={cget} over={over} setOver={setOver} onClose={() => setParamsLocaisOpen(false)} />
      )}
    </div>
  );
}

/* ---------- quanto volta para a operação (por peça e no total da FPP) ---------- */
const AREAS_VOLTA = [
  ["corte", "Corte"], ["silk", "Personalização · Silk/DTF"], ["bordado", "Personalização · Bordado"], ["sublimacao", "Personalização · Sublimação"],
  ["costura", "Costura (facção interna)"], ["acabamento", "Expedição / acabamento"], ["logistica", "Logística base"], ["consumo", "Custos de produção (reembolso de consumo)"],
];
function VoltaOperacao({ volta, qtde, acabRotulo }) {
  if (!volta) return null;
  const q = Math.max(0, Number(qtde) || 0);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
      <div className="text-sm font-bold mb-1" style={{ color: C.navy }}>Volta para a operação</div>
      <div className="text-[11px] mb-2" style={{ color: C.sub }}>Valores previstos nesta FPP que custeiam a operação interna{q ? ` · ${q.toLocaleString("pt-BR")} peça(s)` : ""}</div>
      <table className="w-full text-xs">
        <thead><tr style={{ color: C.sub }}><th className="text-left font-semibold py-1">Área</th><th className="text-right font-semibold">Por peça</th><th className="text-right font-semibold">Total</th></tr></thead>
        <tbody>
          {AREAS_VOLTA.filter(([k]) => volta[k] > 0).map(([k, l]) => (
            <tr key={k} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="py-1">{k === "acabamento" ? acabRotulo || l : l}</td>
              <td className="text-right">{brl(volta[k])}</td>
              <td className="text-right font-semibold">{brl(volta[k] * q)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.line}` }}>
            <td className="py-1.5 font-bold" style={{ color: C.navy }}>Total</td>
            <td className="text-right font-bold" style={{ color: C.navy }}>{brl(volta.total)}</td>
            <td className="text-right font-bold" style={{ color: C.accent }}>{brl(volta.total * q)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Parâmetros só desta ficha (override local de TODOS os parâmetros) ---------- */
function ParamsLocaisModal({ params, tipo, f, over, setOver, onClose }) {
  const rawPeca = (campo) => {
    const row = (params[tipo]?.PECA || []).find((x) => x.chave === f.item);
    if (!row) return 0;
    return campo === "valor" ? row.valor : (row.extra ? row.extra[campo] : 0);
  };
  const rawGrp = (grupo, chave, campo = "valor") => {
    const arr = params[tipo]?.[grupo] || params.COMUM?.[grupo] || [];
    const row = arr.find((x) => x.chave === chave);
    if (!row) return 0;
    return campo === "valor" ? row.valor : (row.extra ? row.extra[campo] : 0);
  };

  function Campo({ label, path, base }) {
    const v = over[path] != null && over[path] !== "" ? over[path] : "";
    return (
      <div className="flex items-center gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="text-sm flex-1" style={{ color: C.text }}>{label}</div>
        <input value={v} placeholder={String(base)} inputMode="decimal"
          onChange={(e) => setOver((s) => ({ ...s, [path]: e.target.value }))}
          className="w-24 px-2 py-1 rounded text-sm" style={{ background: "#fff", border: `1px dashed ${C.accent}`, color: C.text }} />
        {v !== "" && <button onClick={() => setOver((s) => { const n = { ...s }; delete n[path]; return n; })} title="Limpar override"
          className="p-1 rounded" style={{ color: C.sub }}><X size={13} /></button>}
      </div>
    );
  }
  function Secao({ titulo, children }) {
    return (
      <div className="mb-3">
        <div className="text-xs font-bold mb-1" style={{ color: C.sub }}>{sc(titulo)}</div>
        <div className="rounded-lg px-3" style={{ border: `1px solid ${C.line}`, background: C.panel }}>{children}</div>
      </div>
    );
  }

  const isMalha = tipo === "MALHA";
  const constTipo = params[tipo]?.CONST || [];
  const constComum = params.COMUM?.CONST || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-lg max-h-[85vh] overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3 sticky top-0" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.text }}>Parâmetros só desta ficha</div>
            <div className="text-[11px]" style={{ color: C.sub }}>Altera qualquer valor apenas nesta precificação. Não mexe no banco de dados.</div>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4">
          {!f.item && <div className="text-sm mb-3" style={{ color: "#E5484D" }}>Selecione a peça (item) para ver os parâmetros.</div>}

          {f.item && (
            <Secao titulo={`Peça · ${f.item}`}>
              <Campo label={isMalha ? "Rendimento (peças/kg)" : "Consumo (m/peça)"} path={`PECA:${f.item}:valor`} base={rawPeca("valor")} />
              <Campo label="Corte" path={`PECA:${f.item}:corte`} base={rawPeca("corte")} />
              <Campo label={isMalha ? "Expedição" : "Acabamento"} path={`PECA:${f.item}:${isMalha ? "exped" : "acab"}`} base={rawPeca(isMalha ? "exped" : "acab")} />
              <Campo label="Proporção de volume" path={`PECA:${f.item}:volProp`} base={rawPeca("volProp") || 1} />
            </Secao>
          )}

          <Secao titulo="Aviamentos">
            {isMalha && f.gola && <Campo label={`Gola · ${f.gola}`} path={`GOLA:${f.gola}:valor`} base={rawGrp("GOLA", f.gola)} />}
            {isMalha && f.punho && <Campo label={`Punho · ${f.punho}`} path={`PUNHO:${f.punho}:valor`} base={rawGrp("PUNHO", f.punho)} />}
            {!isMalha && f.elastico && !semAv(f.elastico) && <>
              <Campo label={`Elástico · ${f.elastico} · consumo (m/peça)`} path={`ELASTICO:${f.elastico}:consumo`} base={rawGrp("ELASTICO", f.elastico, "consumo")} />
              <Campo label={`Elástico · ${f.elastico} · R$/m`} path={`ELASTICO:${f.elastico}:valorMetro`} base={rawGrp("ELASTICO", f.elastico, "valorMetro")} />
            </>}
            {f.faixa && !semAv(f.faixa) && <Campo label={`Faixa · ${f.faixa} · consumo (m/peça)`} path={`FAIXA:${f.faixa}:consumo`} base={rawGrp("FAIXA", f.faixa, "consumo")} />}
            {f.faixa && !semAv(f.faixa) && f.faixaTipo && <Campo label={`${f.faixaTipo} · ${/MONTADA/i.test(f.faixaTipo) ? "faixa " : ""}R$/m`} path={`FAIXA_TIPO:${f.faixaTipo}:valor`} base={rawGrp("FAIXA_TIPO", f.faixaTipo)} />}
            {f.faixa && !semAv(f.faixa) && /MONTADA/i.test(f.faixaTipo || "") && <Campo label={`${f.faixaTipo} · tactel R$/m`} path={`FAIXA_TIPO:${f.faixaTipo}:tactel`} base={rawGrp("FAIXA_TIPO", f.faixaTipo, "tactel") || 0} />}   {/* v506 */}
            {num(f.botaoQtd) > 0 && f.botaoTipo && <Campo label={`Botão ${f.botaoTipo} · R$/un`} path={`BOTAO:${f.botaoTipo}:valor`} base={rawGrp("BOTAO", f.botaoTipo)} />}
            {!f.gola && !f.punho && !f.elastico && (!f.faixa || f.faixa === "SEM FAIXA") &&
              <div className="text-xs py-2" style={{ color: C.sub }}>Nenhum aviamento selecionado nesta ficha.</div>}
          </Secao>

          {f.embExt && (
            <Secao titulo={`Embalagem externa · ${f.embExt}`}>
              <Campo label="Valor da embalagem" path={`EMB_EXT:${f.embExt}:valor`} base={rawGrp("EMB_EXT", f.embExt, "valor")} />
              <Campo label="Unidades por embalagem" path={`EMB_EXT:${f.embExt}:und`} base={rawGrp("EMB_EXT", f.embExt, "und")} />
              <Campo label="Fita" path={`EMB_EXT:${f.embExt}:fita`} base={rawGrp("EMB_EXT", f.embExt, "fita")} />
            </Secao>
          )}
          {f.embInt && (
            <Secao titulo={`Embalagem interna · ${f.embInt}`}>
              <Campo label="Valor" path={`EMB_INT:${f.embInt}:valor`} base={rawGrp("EMB_INT", f.embInt, "valor")} />
            </Secao>
          )}

          {constTipo.length > 0 && (
            <Secao titulo={`Constantes · ${tipo}`}>
              {constTipo.map((row) => <Campo key={row.id} label={row.rotulo || row.chave} path={`CONST:${row.chave}:valor`} base={row.valor} />)}
            </Secao>
          )}
          {constComum.length > 0 && (
            <Secao titulo="Constantes gerais">
              {constComum.map((row) => <Campo key={row.id} label={row.rotulo || row.chave} path={`CONST:${row.chave}:valor`} base={row.valor} />)}
            </Secao>
          )}

          <div className="flex justify-between items-center mt-2">
            <button onClick={() => setOver({})} className="text-xs px-3 py-1.5 rounded-md" style={{ color: C.sub, border: `1px solid ${C.line}` }}>Limpar todos os ajustes</button>
            <button onClick={onClose} className="text-sm px-4 py-1.5 rounded-md font-semibold" style={{ background: C.accent, color: "#fff" }}>Aplicar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Banco de dados / OPEN SOURCE ---------- */
function BancoParams({ params, master, user, onReload }) {
  const [os, setOs] = useState(false);
  const [tipo, setTipo] = useState("MALHA");
  const grupos = params[tipo] || {};
  const rotulos = {
    PECA: tipo === "MALHA" ? "Peças — rendimento (peças/kg), corte, expedição, proporção volume" : "Peças — consumo (m/peça), corte, acabamento, proporção volume",
    GOLA: "Golas", PUNHO: "Punhos", ELASTICO: "Elásticos — consumo (m/peça) × R$/m = R$/peça", FAIXA: "Faixas refletivas — aplicação: consumo (m/peça); o R$/m vem do tipo de faixa",
    EMB_EXT: "Embalagens externas (valor, und/emb, fita)", CONST: "Constantes do cálculo",
  };
  const ordem = ["PECA", "GOLA", "PUNHO", "ELASTICO", "FAIXA", "EMB_EXT", "CONST"];
  return (
    <div>
      <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: os ? C.accentSoft : C.panel2, border: `1px solid ${os ? C.accent : C.line}` }}>
        {os ? <Unlock size={16} style={{ color: C.accent }} /> : <Lock size={16} style={{ color: C.sub }} />}
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: C.navy }}>Atualização de parâmetros gerais</div>
          <div className="text-xs" style={{ color: C.sub }}>Desligado, o banco de dados fica imutável. Ligado, você redefine o padrão para todas as FPPs daqui em diante — cada alteração fica no histórico com data.</div>
        </div>
        {master ? <Toggle on={os} onChange={setOs} /> : <span className="text-xs" style={{ color: C.sub }}>Só o financeiro edita</span>}
      </div>

      <div className="flex gap-2 mb-3">
        {["MALHA", "PLANO"].map((t) => (
          <button key={t} onClick={() => setTipo(t)} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: tipo === t ? C.navy : C.panel, color: tipo === t ? "#fff" : C.sub, border: `1px solid ${tipo === t ? C.navy : C.line}` }}>{sc(t)}</button>
        ))}
      </div>

      {ordem.filter((g) => grupos[g]).map((g) => (
        <React.Fragment key={g}>
          <GrupoParam grupo={g} rotulo={rotulos[g] || g} linhas={grupos[g]} os={os} user={user} onReload={onReload} />
          {/* v412 — tipos de faixa (R$/m) logo abaixo das faixas */}
          {g === "FAIXA" && params.COMUM?.FAIXA && params.COMUM?.FAIXA_TIPO && <TabelaFaixa aplic={params.COMUM.FAIXA} tipos={params.COMUM.FAIXA_TIPO} />}
          {g === "FAIXA" && params.COMUM?.FAIXA_TIPO && <GrupoParam grupo="FAIXA_TIPO" rotulo="Tipos de faixa refletiva — R$/m (vale para malha e plano)" linhas={params.COMUM.FAIXA_TIPO} os={os} user={user} onReload={onReload} />}
        </React.Fragment>
      ))}
      {params.COMUM?.BOTAO && <GrupoParam grupo="BOTAO" rotulo="Botões — R$/unidade" linhas={params.COMUM.BOTAO} os={os} user={user} onReload={onReload} />}
      {params.COMUM?.EMB_INT && <GrupoParam grupo="EMB_INT" rotulo="Embalagens internas" linhas={params.COMUM.EMB_INT} os={os} user={user} onReload={onReload} />}
      {params.COMUM?.CONST && <GrupoParam grupo="CONST" rotulo="Constantes gerais (imposto, operação financeira)" linhas={params.COMUM.CONST} os={os} user={user} onReload={onReload} />}
    </div>
  );
}

function GrupoParam({ grupo, rotulo, linhas, os, user, onReload }) {
  const [aberto, setAberto] = useState(grupo === "CONST");
  const [histId, setHistId] = useState(null);
  const campos = grupo === "PECA"
    ? [["valor", "Valor"], ["corte", "Corte"], ["exped", "Exped."], ["acab", "Acab."], ["volProp", "Prop. vol."]]
    : grupo === "EMB_EXT" ? [["valor", "Valor emb."], ["und", "Und/emb"], ["fita", "Fita"]]
    : grupo === "ELASTICO" ? [["consumo", "Consumo (m/pç)"], ["valorMetro", "R$/m"], ["valor", "R$/peça"]]   // v410
    : grupo === "FAIXA" ? [["consumo", "Consumo (m/pç)"]]   // v505 — R$/peça = consumo × R$/m do tipo (sem valor fixo)
    : grupo === "FAIXA_TIPO" ? [["valor", "Faixa R$/m"], ["tactel", "Tactel R$/m"]]   // v506 — tactel só nas montadas
    : grupo === "BOTAO" ? [["valor", "R$/un"]]
    : [["valor", "Valor"]];

  return (
    <div className="mb-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
      <button onClick={() => setAberto((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2 text-left" style={{ background: C.panel2 }}>
        {aberto ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="text-sm font-semibold" style={{ color: C.text }}>{rotulo}</span>
        <span className="text-xs ml-auto" style={{ color: C.sub }}>{linhas.length} itens</span>
      </button>
      {aberto && (
        <div style={{ background: C.panel }}>
          {linhas.map((row) => <LinhaParam key={row.id} row={row} campos={campos} os={os} user={user} onReload={onReload} onHist={() => setHistId(row.id)} />)}
        </div>
      )}
      {histId && <HistModal paramId={histId} onClose={() => setHistId(null)} />}
    </div>
  );
}

function LinhaParam({ row, campos, os, user, onReload, onHist }) {
  const validos = campos.filter(([k]) => k === "valor" ? true : (row.extra && row.extra[k] != null) || (k === "tactel" && /MONTADA/i.test(String(row.chave || ""))));   // v506
  const [ed, setEd] = useState(() => { const o = {}; validos.forEach(([k]) => { o[k] = k === "valor" ? row.valor : row.extra?.[k] ?? 0; }); return o; });
  const [saving, setSaving] = useState(false);
  const mudou = validos.some(([k]) => num(ed[k]) !== Number(k === "valor" ? row.valor : row.extra?.[k] ?? 0));

  async function salvarPadrao() {
    if (!os || !mudou) return;
    if (!(await confirmar(`Redefinir o padrão de "${row.rotulo || row.chave}"? Fica no histórico.`))) return;
    setSaving(true);
    const body = { usuarioId: user?.id, usuarioNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim() };
    if (num(ed.valor) !== Number(row.valor)) body.valor = num(ed.valor);
    const extra = {};
    validos.forEach(([k]) => { if (k !== "valor") extra[k] = num(ed[k]); });
    if (Object.keys(extra).length) body.extra = extra;
    await fetch(`/api/fpp/params/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false); onReload && onReload();
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 flex-wrap" style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="text-sm flex-1 min-w-[180px]" style={{ color: C.text }}>{row.rotulo || sc(row.chave)}</div>
      {validos.map(([k, lbl]) => (
        <div key={k} className="flex flex-col">
          <span className="text-[10px]" style={{ color: C.sub }}>{lbl}</span>
          <input value={ed[k] ?? ""} disabled={!os} onChange={(e) => setEd((s) => ({ ...s, [k]: e.target.value }))}
            className="w-20 px-2 py-1 rounded text-sm" style={{ background: os ? "#fff" : C.panel2, border: `1px solid ${C.line}`, color: C.text }} />
        </div>
      ))}
      {os && <button onClick={salvarPadrao} disabled={!mudou || saving} title="Redefinir padrão"
        className="p-1.5 rounded" style={{ background: mudou ? C.accent : C.panel2, color: mudou ? "#fff" : C.sub }}><RotateCcw size={14} /></button>}
      <button onClick={onHist} title="Histórico" className="p-1.5 rounded" style={{ background: C.panel2, color: C.sub }}><History size={14} /></button>
    </div>
  );
}

function HistModal({ paramId, onClose }) {
  const [hist, setHist] = useState(null);
  useEffect(() => { fetch(`/api/fpp/params/${paramId}`).then((r) => r.json()).then(setHist); }, [paramId]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold" style={{ color: C.text }}>Histórico de alterações</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-auto">
          {!hist ? <div className="text-sm" style={{ color: C.sub }}>Carregando…</div>
            : hist.length === 0 ? <div className="text-sm" style={{ color: C.sub }}>Nenhuma alteração registrada.</div>
            : hist.map((h) => (
              <div key={h.id} className="py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div style={{ color: C.text }}>
                  <b>{h.campo}</b>: {h.deNum ?? "—"} → <b style={{ color: C.accent }}>{h.paraNum ?? "—"}</b>
                </div>
                <div className="text-xs" style={{ color: C.sub }}>
                  {new Date(h.createdAt).toLocaleString("pt-BR")} · {h.usuarioNome || "—"}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

/* Gera e BAIXA a FPP como PDF (usa entradas + resultados salvos). Mesmo layout para 1 ou várias. */
async function imprimirFicha(f, master) {
  const { jsPDF } = await import("jspdf");
  const e = f.entradas || {};
  const r = f.resultados || {};
  const isMalha = (f.tipo || e.tipo) === "MALHA";
  const brlp = (n) => "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctp = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, M = 14; let y = 16;

  // cabeçalho
  doc.setFillColor(0, 30, 65); doc.rect(0, 0, W, 8, "F");
  doc.setFontSize(18); doc.setTextColor(0, 30, 65); doc.setFont(undefined, "bold");
  doc.text("MERIDIAN", M, y);
  doc.setFontSize(11); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "normal");
  doc.text("Ficha de Precificação (FPP)", M + 46, y);
  doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  doc.text(`${f.numero ? `FPP ${fmtFpp(f.numero)} · ` : ""}${new Date().toLocaleDateString("pt-BR")}`, W - M, y - 3, { align: "right" });
  if (f.negociacao) { doc.setTextColor(255, 107, 26); doc.setFont(undefined, "bold"); doc.text(String(f.negociacao), W - M, y + 2, { align: "right" }); doc.setFont(undefined, "normal"); }
  y += 6; doc.setDrawColor(255, 107, 26); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); doc.setLineWidth(0.2); y += 7;

  const sec = (t) => { doc.setFontSize(9); doc.setTextColor(102, 112, 133); doc.setFont(undefined, "bold"); doc.text(t.toUpperCase(), M, y); y += 1.5; doc.setDrawColor(228, 231, 236); doc.line(M, y, W - M, y); y += 4.5; doc.setFont(undefined, "normal"); };
  const row = (k, v, opt = {}) => {
    doc.setFontSize(9.5); doc.setTextColor(102, 112, 133); doc.setFont(undefined, "normal"); doc.text(String(k), M, y);
    const c = opt.cor || [31, 39, 51]; doc.setTextColor(c[0], c[1], c[2]); doc.setFont(undefined, opt.forte ? "bold" : "normal");
    doc.text(String(v == null ? "—" : v), W - M, y, { align: "right" }); doc.setFont(undefined, "normal"); y += 6;
  };

  sec("Identificação");
  row("Item (peça)", f.item);
  row("Nome comercial", f.nomeComercial || "—");
  row("Cliente", f.clienteNome || "—");
  row("Negociação", f.negociacao || "—");
  row("Quantidade", f.qtde ?? "—");
  row("Tipo", f.tipo || (isMalha ? "MALHA" : "PLANO"));
  row("Cond. pagamento", f.condicaoPagamento || e.condPagamento || "—");
  row("Lead time", f.leadTime != null ? f.leadTime + " dias" : "—");
  y += 2;

  const revendaP = ehRevenda(f.item, f.tipo), abertaP = ehPecaAberta(f.item);   // v512
  if (revendaP) {
    sec("Produto revenda");
    row("Descrição", e.revendaDescricao || "—");
    row("Fornecedor", e.revendaFornecedor || "—");
    row("Preço de custo (R$/peça)", e.custoRevenda || "—");
    y += 2;
    sec("Personalização");
  } else {
  sec("Matéria-prima");
  if (abertaP) row(isMalha ? "Rendimento (pç/kg)" : "Consumo (m/peça)", e.abRend || "—");
  if (isMalha) row("Artigo (malha)", e.nomeArtigo || "—");
  else { row("Artigo (tecido externo)", e.nomeArtigo || "—"); if ((e.forrada ?? !!(e.nomeArtigoForro || num(e.forroValor)))) row("Artigo (forro)", e.nomeArtigoForro || "—"); }
  row(isMalha ? "Custo do tecido (R$/kg)" : "Custo do tecido (R$/m)", e.mpValor || "—");
  for (const x of (Array.isArray(e.materiasExtras) ? e.materiasExtras : []).filter((x) => x.nome)) row(`MP adicional: ${String(x.nome).toUpperCase()}`, `R$ ${x.custo || "—"} · ${x.qtd || "—"} ${x.modo === "RENDIMENTO" ? "pç/kg" : "m/peça"}`);   // v411
  if (!isMalha && (e.forrada ?? !!(e.nomeArtigoForro || num(e.forroValor)))) row("Custo do forro (R$/m)", e.forroValor || "—");
  if (!isMalha && (e.forrada ?? !!(e.nomeArtigoForro || num(e.forroValor)))) row("Consumo do forro (m/peça)", e.consumoForro || (r.consumoForroEst != null ? `${Number(r.consumoForroEst).toFixed(2).replace(".", ",")} (estimado)` : "—"));
  y += 2;

  sec("Aviamentos e produção");
  if (isMalha || abertaP) { row("Gola", e.gola || "—"); row("Punho", e.punho || "—"); }
  if (!isMalha || abertaP) row("Elástico", e.elastico || "—");
  if (abertaP) { row("Corte (R$/peça)", e.abCorte || "—"); row(isMalha ? "Expedição (R$/peça)" : "Acabamento (R$/peça)", e.abAcab || "—"); }
  row("Faixa refletiva", e.faixa || "—");
  row("Qtde de botões", e.botaoQtd || "—");
  row("Facção (R$/peça)", e.faccao || "—");
  for (const x of (Array.isArray(e.extrasAviamentos) ? e.extrasAviamentos : []).filter((x) => x.unidade && x.desc))   // v411
    row(`Aviamento: ${String(x.desc).toUpperCase()}`, `${x.consumo || "—"} ${x.unidade === "M" ? "m" : "un"}/peça × R$ ${x.preco || "—"}`);
  for (const [rot, l] of [["Extra aviamento", (e.extrasAviamentos || []).filter((x) => !x.unidade)], ["Extra produção", e.extrasProducao]])
    for (const x of (Array.isArray(l) ? l : []).filter((x) => num(x.valor))) row(`${rot}: ${String(x.desc || "SEM DESCRIÇÃO").toUpperCase()} (R$/peça)`, String(x.valor));
  }
  const POS2 = [["peitoD", "Peito D"], ["peitoE", "Peito E"], ["mangaD", "Manga D"], ["mangaE", "Manga E"], ["costas", "Costas"]];
  const pp = [];
  for (const [tec, lbl] of [["silk", "Silk/DTF"], ["bordado", "Bordado"], ["sublimacao", "Sublimação"]]) {
    const p = e[tec] || {}; const pos = POS2.filter(([k]) => Number(p[k]) > 0).map(([, l]) => l);
    if (pos.length || Number(p.arte) > 0) pp.push(`${lbl}${pos.length ? " (" + pos.join(", ") + ")" : ""}`);
  }
  for (const a of Array.isArray(e.personalizacoes) ? e.personalizacoes : []) pp.push(`${nomeMetodo(a.metodo)}${a.metodo === "SILK" ? ` ${a.cores || 1} cor(es)` : ""} (${nomeLocal(a.local)})`);
  row("Personalização", pp.join(" · ") || "—");
  y += 2;

  if (master) {
    sec("Composição de custo");
    if (revendaP) row("Custo do produto (revenda)", brlp(r.custoRevenda));
    else { row("Matéria-prima", brlp(r.materiaPrima)); row("Aviamentos", brlp(r.aviamentos)); row("Produção", brlp(r.producao)); }
    row("Personalização", brlp(r.personalizacao));
    row("Logística", brlp(r.logistica));
    row("Embalagem", brlp(r.embalagem));
    row("Custo de produção", brlp(r.custoProducao), { forte: true });
    row("Operação financeira", brlp(r.opFin));
    if (Number(r.comissao) > 0) row(`Comissão vendedor (${(Number(r.comissaoPct) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)`, `${brlp(r.comissao)} · total ${brlp(r.comissaoTotal)}`);
    row("Custo final", brlp(f.custoFinal ?? r.custoFinal), { forte: true });
    row("ROIC", pctp(r.roic));
    // margem de contribuição destacada
    doc.setFillColor(255, 240, 230); doc.rect(M, y - 4, W - 2 * M, 7, "F");
    doc.setDrawColor(255, 107, 26); doc.rect(M, y - 4, W - 2 * M, 7);
    doc.setFontSize(10); doc.setTextColor(255, 107, 26); doc.setFont(undefined, "bold");
    doc.text("MARGEM DE CONTRIBUIÇÃO", M + 2, y + 0.6);
    doc.text(pctp(f.margem ?? r.margem), W - M - 2, y + 0.6, { align: "right" });
    doc.setFont(undefined, "normal"); y += 8;
    row("Valor proposto", brlp(f.valorProposto), { forte: true });
    row("Total do item", brlp(f.totalItem), { forte: true, cor: [255, 107, 26] });
  } else {
    doc.setFontSize(9); doc.setTextColor(102, 112, 133); doc.text("Valores visíveis somente para o financeiro.", M, y); y += 6;
  }

  y += 4; doc.setDrawColor(228, 231, 236); doc.line(M, y, W - M, y); y += 4;
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  const criada = f.createdAt ? new Date(f.createdAt).toLocaleString("pt-BR") : "—";
  doc.text(`FPP criada por ${f.criadoPorNome || "—"} em ${criada}. Gerado pelo sistema Meridian.`, M, y);

  const nome = `FPP - ${f.item || "item"} - ${f.clienteNome || "cliente"}`.replace(/[\\/:*?"<>|]+/g, "").slice(0, 80);
  doc.save(nome + ".pdf");
}

/* ---------- Fichas salvas ---------- */
const COLS = [
  { k: "numero", label: "Nº", tipo: "num" },
  { k: "item", label: "Item", tipo: "txt" },
  { k: "nomeComercial", label: "Nome comercial", tipo: "txt" },
  { k: "clienteNome", label: "Cliente", tipo: "txt", cliente: true },
  { k: "negociacao", label: "Negociação", tipo: "txt" },
  { k: "qtde", label: "Qtde", tipo: "num", right: true },
  { k: "valorProposto", label: "Valor prop.", tipo: "num", right: true, master: true },
  { k: "margem", label: "Margem", tipo: "num", right: true, master: true },
  { k: "totalItem", label: "Valor total", tipo: "num", right: true, master: true },
  { k: "createdAt", label: "Data", tipo: "data" },
];

// guias da aba Salvas: cada uma agrupa as FPPs em cards
const GUIAS_FPP = [
  { k: "todas", label: "Todas", Ico: Layers },
  { k: "negociacao", label: "Negociação", Ico: Handshake, chave: (f) => f.negociacao || "SEM NEGOCIAÇÃO" },
  { k: "cliente", label: "Cliente", Ico: Users, chave: (f) => f.clienteNome || "SEM CLIENTE" },
  { k: "peca", label: "Peça", Ico: Shirt, chave: (f) => f.item || "SEM PEÇA" },
];
// números gerenciais: valor total = preço × qtde; margem de contribuição = (preço − custo final) × qtde
const valorFpp = (f) => Number(f.totalItem) || (Number(f.valorProposto) || 0) * (Number(f.qtde) || 0);
const mcFpp = (f) => (f.valorProposto != null && f.custoFinal != null ? (Number(f.valorProposto) - Number(f.custoFinal)) * (Number(f.qtde) || 0) : 0);
// CMV = todos os custos exceto o imposto: custo de produção + custo financeiro
const cmvFpp = (f) => {
  const q = Number(f.qtde) || 0;
  if (f.custoProducao != null) return (Number(f.custoProducao) + (Number(f.resultados?.opFin) || 0)) * q;
  return (Number(f.custoFinal) || 0) * q;
};
// volta para a operação da FPP inteira: calculado das entradas da ficha com os parâmetros atuais × quantidade
let PARAMS_VOLTA = null;
function voltaFpp(f) {
  const tipo = f.tipo || "MALHA";
  const v = calcVolta(PARAMS_VOLTA, tipo, { ...(f.entradas || {}), item: f.entradas?.item || f.item, qtde: f.entradas?.qtde ?? f.qtde }, f.overrides || {});
  const q = Number(f.qtde) || 0;
  if (!v) return null;
  const o = {}; for (const [k] of AREAS_VOLTA) o[k] = (Number(v[k]) || 0) * q;
  o.total = (Number(v.total) || 0) * q;
  return o;
}
function somaFpps(l) {
  const t = { n: l.length, valor: 0, pecas: 0, mc: 0, cmv: 0, volta: { total: 0 }, semVolta: 0 };
  for (const [k] of AREAS_VOLTA) t.volta[k] = 0;
  for (const f of l) {
    t.valor += valorFpp(f); t.pecas += Number(f.qtde) || 0; t.mc += mcFpp(f); t.cmv += cmvFpp(f);
    const v = voltaFpp(f);
    if (v) for (const k of Object.keys(t.volta)) t.volta[k] += v[k] || 0;
  }
  t.mcPct = t.valor ? t.mc / t.valor : 0;
  t.cmvPct = t.valor ? t.cmv / t.valor : 0;
  t.mcPeca = t.pecas ? t.mc / t.pecas : 0;
  t.precoMedio = t.pecas ? t.valor / t.pecas : 0;
  t.mcPecaPct = t.precoMedio ? t.mcPeca / t.precoMedio : 0;
  return t;
}
const corMc = (p) => (p >= 0.3 ? C.green : p >= 0.16 ? C.yellow : C.red);
const nPt = (n) => (Number(n) || 0).toLocaleString("pt-BR");
function KpiFpp({ rotulo, valor, sub, cor }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold" style={{ color: C.sub }}>{rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor || C.navy }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}
const guiaFpp = (k) => GUIAS_FPP.find((g) => g.k === k);

// v294 — ficha com parâmetros alterados (para análises futuras)
const paramsAlterados = (f) => !!(f?.entradas?.paramsAlterados || (f?.overrides && Object.keys(f.overrides).length));
function AlertaParams() {
  return <span title="Parâmetros alterados nesta ficha" className="inline-flex items-center justify-center rounded-full text-[10px] font-bold ml-1.5 align-middle" style={{ width: 16, height: 16, background: C.red, color: "#fff" }}>!</span>;
}
function FichasSalvas({ master, onEditar, onClonar, voltarRef }) {
  const [lista, setLista] = useState(null);
  const [, setPv] = useState(0);
  useEffect(() => { fetch("/api/fpp/params").then((r) => r.json()).then((p) => { PARAMS_VOLTA = p; setPv((x) => x + 1); }).catch(() => {}); }, []);
  // v513 — guia, card aberto, busca e ordem ficam salvos na sessão: editar uma FPP e voltar devolve ao mesmo lugar
  const nav0 = useMemo(() => ssLer("ce_fpp_nav", {}), []);
  const [sort, setSort] = useState(nav0.sort || { campo: "createdAt", dir: "desc" });
  const [guia, setGuia] = useState(nav0.guia || "todas");
  const [filtro, setFiltro] = useState(nav0.filtro || null);          // { guia, valor } — card aberto
  const [clonando, setClonando] = useState(null);
  const [busca, setBusca] = useState(nav0.busca || "");
  useEffect(() => { ssGravar("ce_fpp_nav", { sort, guia, filtro, busca }); }, [sort, guia, filtro, busca]);
  if (voltarRef) voltarRef.current = () => { if (filtro) { setFiltro(null); setBusca(""); return true; } return false; };
  const [destaque, setDestaque] = useState(null);   // v513 — FPP que acabou de ser editada: rola até ela e pisca
  const rolou = useRef(false);
  const editar = (f) => { ssGravar("ce_fpp_ultima", f.id); onEditar && onEditar(f); };
  const [sel, setSel] = useState(() => new Set());
  const [aberta, setAberta] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);

  function carregar() { fetch("/api/fpp").then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => setLista([])); }
  useEffect(carregar, []);
  useEffect(() => {
    if (!lista || rolou.current) return;
    rolou.current = true;
    const id = ssLer("ce_fpp_ultima", null);
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-fpp="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      setDestaque(id); setTimeout(() => setDestaque(null), 2500);
    });
  }, [lista]);

  async function excluir(id) {
    if (!(await confirmar("Excluir esta ficha?"))) return;
    await fetch(`/api/fpp/${id}`, { method: "DELETE" });
    setAberta(null); setSel((s) => { const n = new Set(s); n.delete(id); return n; }); carregar();
  }

  function ordenar(campo, tipo) {
    setSort((s) => {
      if (s.campo === campo) return { campo, dir: s.dir === "asc" ? "desc" : "asc" };
      return { campo, dir: tipo === "data" ? "desc" : "asc" }; // data começa recente->antigo
    });
  }

  if (!lista) return <div className="text-sm" style={{ color: C.sub }}>Carregando…</div>;

  let dados = filtro ? lista.filter((f) => guiaFpp(filtro.guia).chave(f) === filtro.valor) : lista;
  const q = busca.trim().toLowerCase();
  // cards da guia (negociação / cliente / peça)
  const g = guiaFpp(guia);
  const cards = g.chave && !filtro ? Object.values(lista.reduce((acc, f) => {
    const k = g.chave(f);
    const c = (acc[k] ||= { valor: k, n: 0, total: 0, qtd: 0, mc: 0, cmv: 0, volta: 0, ultima: null, clientes: new Set(), pecas: new Set(), negs: new Set() });
    c.n++; c.total += valorFpp(f); c.qtd += Number(f.qtde) || 0; c.mc += mcFpp(f); c.cmv += cmvFpp(f); c.volta += voltaFpp(f)?.total || 0;
    if (!c.ultima || f.createdAt > c.ultima) c.ultima = f.createdAt;
    if (f.clienteNome) c.clientes.add(f.clienteNome); if (f.item) c.pecas.add(f.item); if (f.negociacao) c.negs.add(f.negociacao);
    return acc;
  }, {})).filter((c) => !q || c.valor.toLowerCase().includes(q)).sort((a, b) => (a.ultima < b.ultima ? 1 : -1)) : null;
  const abrirCard = (valor) => { setFiltro({ guia, valor }); setBusca(""); };
  async function clonar(f) {
    if (!onClonar) return;
    setClonando(f.id);
    await onClonar(f);
    setClonando(null);
  }
  if (q) {
    dados = dados.filter((f) => {
      const alvo = [
        fmtFpp(f.numero), f.item, f.nomeComercial, f.clienteNome, f.negociacao, f.qtde,
        f.condicaoPagamento, f.leadTime, f.criadoPorNome,
        f.valorProposto != null ? brl(f.valorProposto) : "",
        f.margem != null ? pct(f.margem) : "",
        f.createdAt ? new Date(f.createdAt).toLocaleDateString("pt-BR") : "",
      ].map((x) => String(x ?? "").toLowerCase()).join(" ");
      return alvo.includes(q);
    });
  }
  const col = COLS.find((c) => c.k === sort.campo) || COLS[COLS.length - 1];
  dados = [...dados].sort((a, b) => {
    let x = a[sort.campo], y = b[sort.campo];
    if (col.tipo === "num") { x = x == null ? -Infinity : Number(x); y = y == null ? -Infinity : Number(y); }
    else if (col.tipo === "data") { x = new Date(x).getTime(); y = new Date(y).getTime(); }
    else { x = String(x || "").toLowerCase(); y = String(y || "").toLowerCase(); }
    if (x < y) return sort.dir === "asc" ? -1 : 1;
    if (x > y) return sort.dir === "asc" ? 1 : -1;
    return 0;
  });

  const selecionadas = lista.filter((f) => sel.has(f.id));
  const cols = COLS.filter((c) => !c.master || master);

  function toggle(id) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  function gerarPropostaSelecionadas() {
    if (selecionadas.length === 0) return;
    const nomes = [...new Set(selecionadas.map((f) => f.clienteNome || "—"))];
    if (nomes.length > 1) { alerta("Selecione FPPs de um mesmo cliente para gerar a proposta."); return; }
    setProposta(selecionadas);
  }

  async function imprimirSelecionadas() {
    if (!selecionadas.length) return;
    setImprimindo(true);
    for (const f of selecionadas) {
      await imprimirFicha(f, master);
      await new Promise((r) => setTimeout(r, 400)); // evita o navegador bloquear downloads em sequência
    }
    setImprimindo(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">   {/* v516 — mais espaço entre voltar, proposta e as guias */}
        <div className="text-sm flex items-center gap-4 flex-wrap" style={{ color: C.sub }}>
          {filtro ? (
            <button onClick={() => setFiltro(null)} className="flex items-center gap-1" style={{ color: C.accent }}>
              <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Voltar · {guiaFpp(filtro.guia).label}: <b>{filtro.valor}</b> · {dados.length} ficha(s)
            </button>
          ) : null}
          {filtro && dados.length > 0 ? (
            <button onClick={() => setProposta(dados)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
              <Send size={13} /> Proposta {filtro.guia === "negociacao" ? "da negociação inteira" : `de todas (${dados.length})`}
            </button>
          ) : cards ? `${cards.length} ${g.label.toLowerCase()}(s) · ${lista.length} ficha(s)` : `${q ? dados.length + " de " : ""}${lista.length} ficha(s)`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ color: C.sub, position: "absolute", left: 8, top: 9 }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={cards ? `Buscar ${g.label.toLowerCase()}…` : "Buscar em todas as FPPs…"}
              className="pl-7 pr-2 py-1.5 rounded-md text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text, width: 240 }} />
          </div>
          {selecionadas.length > 0 && (
            <>
              <button onClick={imprimirSelecionadas} disabled={imprimindo} title="Baixa 1 PDF por FPP selecionada"
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, opacity: imprimindo ? 0.6 : 1 }}>
                <Printer size={15} /> {imprimindo ? "Gerando…" : `Imprimir FPPs (${selecionadas.length})`}
              </button>
              <button onClick={gerarPropostaSelecionadas} className="px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
                Gerar proposta ({selecionadas.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        {GUIAS_FPP.map((x) => (
          <button key={x.k} onClick={() => { setGuia(x.k); setFiltro(null); setBusca(""); }} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
            style={{ color: guia === x.k ? C.accent : C.sub, borderBottom: `2px solid ${guia === x.k ? C.accent : "transparent"}`, marginBottom: -1 }}><x.Ico size={15} /> {x.label}</button>
        ))}
      </div>
      {(() => {
        const t = somaFpps(cards ? lista : dados);
        // dados gerenciais completos só dentro de uma negociação; nas demais visões, só nº de FPPs e MC média por peça
        const completo = filtro?.guia === "negociacao";
        const mcPeca = <KpiFpp rotulo="MC média por peça" valor={<>{brl(t.mcPeca)} <span className="text-sm">· {pct(t.mcPecaPct)}</span></>} cor={corMc(t.mcPecaPct)} />;
        if (!completo) return (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 220px))" }}>
            <KpiFpp rotulo="FPPs" valor={nPt(t.n)} sub={filtro ? filtro.valor : "todas as salvas"} />
            {master && mcPeca}
          </div>
        );
        const etapas = AREAS_VOLTA.filter(([k]) => t.volta[k] > 0);
        return (
          <div className="mb-4">
            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `repeat(${master ? 6 : 2}, minmax(0, 1fr))` }}>
              <KpiFpp rotulo="FPPs" valor={nPt(t.n)} sub={filtro.valor} />
              <KpiFpp rotulo="Peças" valor={nPt(t.pecas)} />
              {master && <KpiFpp rotulo="Valor total" valor={brl(t.valor)} sub={`preço médio ${brl(t.precoMedio)}/peça`} />}
              {master && <KpiFpp rotulo="CMV total" valor={brl(t.cmv)} sub={`${pct(t.cmvPct)} do valor · sem imposto`} />}
              {master && <KpiFpp rotulo="Margem de contribuição" valor={brl(t.mc)} sub={`${pct(t.mcPct)} do valor`} cor={corMc(t.mcPct)} />}
              {master && <KpiFpp rotulo="MC média por peça" valor={brl(t.mcPeca)} sub={`${pct(t.mcPecaPct)} do preço`} cor={corMc(t.mcPecaPct)} />}
            </div>
            {master && (
              <div className="rounded-xl p-4 flex flex-wrap items-stretch gap-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="pr-4" style={{ borderRight: `1px solid ${C.line}`, minWidth: 190 }}>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>Volta para a operação</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: C.accent }}>{brl(t.volta.total)}</div>
                  <div className="text-xs" style={{ color: C.sub }}>{t.pecas ? `${brl(t.volta.total / t.pecas)} por peça` : ""}</div>
                </div>
                <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                  {etapas.map(([k, l]) => (
                    <div key={k} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
                      <div className="text-[11px] leading-tight" style={{ color: C.sub }}>{l.replace("Personalização · ", "Personalização ").replace(" (reembolso de consumo)", "").replace(" (facção interna)", "")}</div>
                      <div className="text-sm font-bold mt-0.5" style={{ color: C.navy }}>{brl(t.volta[k])}</div>
                      <div className="text-[10px]" style={{ color: C.sub }}>{t.pecas ? `${brl(t.volta[k] / t.pecas)}/peça` : ""}</div>
                    </div>
                  ))}
                  {!etapas.length && <div className="text-xs self-center" style={{ color: C.sub }}>Nada volta para a operação nestas FPPs.</div>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {cards && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {cards.map((c) => (
            <button key={c.valor} onClick={() => abrirCard(c.valor)} className="text-left rounded-xl p-4 transition-shadow hover:shadow-lg"
              style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-sm font-bold" style={{ color: C.navy }}>{c.valor}</div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: C.accentSoft, color: C.accent }}>{c.n} FPP(s)</span>
              </div>
              {master && guia !== "negociacao" && (
                <div className="text-xs mb-2"><div style={{ color: C.sub }}>MC média por peça</div>
                  <div className="font-bold text-sm" style={{ color: corMc(c.total ? c.mc / c.total : 0) }}>{brl(c.qtd ? c.mc / c.qtd : 0)} · {pct(c.total ? c.mc / c.total : 0)}</div></div>
              )}
              {master && guia === "negociacao" && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-2">
                  <div><div style={{ color: C.sub }}>Valor total</div><div className="font-bold text-sm" style={{ color: C.navy }}>{brl(c.total)}</div></div>
                  <div><div style={{ color: C.sub }}>Peças</div><div className="font-bold text-sm" style={{ color: C.navy }}>{nPt(c.qtd)}</div></div>
                  <div><div style={{ color: C.sub }}>Margem de contrib.</div><div className="font-bold text-sm" style={{ color: corMc(c.total ? c.mc / c.total : 0) }}>{brl(c.mc)}</div></div>
                  <div><div style={{ color: C.sub }}>MC %</div><div className="font-bold text-sm" style={{ color: corMc(c.total ? c.mc / c.total : 0) }}>{pct(c.total ? c.mc / c.total : 0)}</div></div>
                  <div><div style={{ color: C.sub }}>CMV total</div><div className="font-bold text-sm" style={{ color: C.navy }}>{brl(c.cmv)}</div></div>
                  <div><div style={{ color: C.sub }}>MC média/peça</div><div className="font-bold text-sm" style={{ color: corMc(c.total ? c.mc / c.total : 0) }}>{brl(c.qtd ? c.mc / c.qtd : 0)} · {pct(c.total ? c.mc / c.total : 0)}</div></div>
                  <div className="col-span-2"><div style={{ color: C.sub }}>Volta para a operação</div><div className="font-bold text-sm" style={{ color: C.accent }}>{brl(c.volta)}</div></div>
                </div>
              )}
              {!master && <div className="text-xs mb-2" style={{ color: C.sub }}>{nPt(c.qtd)} peça(s)</div>}
              <div className="text-[11px] pt-2 flex flex-wrap gap-x-3" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
                {guia !== "cliente" && c.clientes.size > 0 && <span>{c.clientes.size} cliente(s)</span>}
                {guia !== "peca" && c.pecas.size > 0 && <span>{c.pecas.size} peça(s) diferentes</span>}
                {guia !== "negociacao" && c.negs.size > 0 && <span>{c.negs.size} negociação(ões)</span>}
                <span>Última: {c.ultima ? new Date(c.ultima).toLocaleDateString("pt-BR") : "—"}</span>
              </div>
            </button>
          ))}
          {cards.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Nada encontrado.</div>}
        </div>
      )}

      {!cards && <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.panel2, color: C.sub }} className="text-left text-xs uppercase tracking-wide">
              <th className="px-2 py-2 w-8"></th>
              {cols.map((c) => (
                <th key={c.k} onClick={() => ordenar(c.k, c.tipo)} className={"px-3 py-2 font-medium cursor-pointer select-none " + (c.right ? "text-right" : "")}>
                  {c.label}{sort.campo === c.k ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {dados.map((f) => (
              <tr key={f.id} data-fpp={f.id} style={{ borderTop: `1px solid ${C.line}`, background: destaque === f.id ? C.accentSoft : undefined, transition: "background .6s" }}>
                <td className="px-2 py-2"><input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} /></td>
                {cols.map((c) => {
                  let v = f[c.k];
                  if (c.k === "createdAt") v = new Date(v).toLocaleDateString("pt-BR");
                  else if (c.k === "numero") return <td key={c.k} className="px-3 py-2 font-bold tabular-nums whitespace-nowrap" style={{ color: C.navy, cursor: "pointer" }} onClick={() => editar(f)}>{fmtFpp(v)}{paramsAlterados(f) && <AlertaParams />}</td>;
                  else if (c.k === "totalItem") return <td key={c.k} className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: C.navy, cursor: "pointer" }} onClick={() => editar(f)}>{brl(valorFpp(f))}</td>;
                  else if (c.k === "valorProposto") v = v != null ? brl(v) : "—";
                  else if (c.k === "margem") v = v != null ? pct(v) : "—";
                  else v = v ?? "—";
                  if (c.cliente) return <td key={c.k} className="px-3 py-2"><button onClick={() => { setGuia("cliente"); setFiltro({ guia: "cliente", valor: guiaFpp("cliente").chave(f) }); }} className="font-medium" style={{ color: C.accent }}>{typeof v === "string" ? sc(v) : v}</button></td>;
                  if (typeof v === "string" && /[A-ZÀ-Ý]{3}/.test(v) && !/^R\$/.test(v)) v = sc(v);   // v414
                  return <td key={c.k} className={"px-3 py-2 " + (c.right ? "text-right" : "")} style={{ color: c.k === "item" ? C.text : C.sub, cursor: "pointer" }} onClick={() => editar(f)}>{v}</td>;
                })}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => imprimirFicha(f, master)} title="Imprimir FPP (PDF)" className="p-1 rounded mr-1" style={{ color: C.text }}><Printer size={15} /></button>
                  <button onClick={() => setProposta([f])} title="Gerar proposta" className="p-1 rounded mr-1" style={{ color: C.accent }}><FileText size={15} /></button>
                  <button onClick={() => clonar(f)} disabled={clonando === f.id} title="Clonar FPP (abre a cópia para edição)" className="p-1 rounded mr-1" style={{ color: C.blue, opacity: clonando === f.id ? 0.5 : 1 }}><Copy size={15} /></button>
                  <button onClick={() => excluir(f.id)} title="Excluir" className="p-1 rounded" style={{ color: "#E5484D" }}><X size={15} /></button>
                </td>
              </tr>
            ))}
            {dados.length === 0 && <tr><td colSpan={cols.length + 2} className="px-3 py-4 text-center" style={{ color: C.sub }}>Nenhuma ficha.</td></tr>}
          </tbody>
        </table>
      </div>}

      {aberta && <FichaDetalhe f={aberta} master={master} onClose={() => setAberta(null)} onProposta={() => { setProposta([aberta]); setAberta(null); }} />}
      {proposta && <ProposalModal fichas={proposta} onClose={() => setProposta(null)} />}
    </div>
  );
}

function FichaDetalhe({ f, master, onClose, onProposta }) {
  const r = f.resultados || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>{f.numero ? `FPP ${fmtFpp(f.numero)} · ` : ""}{f.nomeComercial || f.item}{f.negociacao ? ` · ${f.negociacao}` : ""}{paramsAlterados(f) && <AlertaParams />}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 text-sm space-y-1.5">
          <Lin l="Item (peça)" v={f.item} />
          <Lin l="Cliente" v={f.clienteNome || "—"} />
          <Lin l="Quantidade" v={f.qtde ?? "—"} />
          <Lin l="Cond. pagamento" v={f.condicaoPagamento || "—"} />
          <Lin l="Lead time" v={f.leadTime != null ? f.leadTime + " dias" : "—"} />
          <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
          {master ? (
            <>
              <Lin l="Custo de produção" v={r.custoProducao != null ? brl(r.custoProducao) : "—"} />
              <Lin l="Operação financeira" v={r.opFin != null ? brl(r.opFin) : "—"} />
              <Lin l="Custo final" v={f.custoFinal != null ? brl(f.custoFinal) : "—"} forte />
              <Lin l="ROIC" v={r.roic != null ? pct(r.roic) : "—"} />
              <Lin l="Margem" v={f.margem != null ? pct(f.margem) : "—"} />
              <Lin l="Valor proposto" v={f.valorProposto != null ? brl(f.valorProposto) : "—"} forte />
              <Lin l="Total do item" v={f.totalItem != null ? brl(f.totalItem) : "—"} forte cor={C.accent} />
            </>
          ) : <div className="text-xs" style={{ color: C.sub }}>Valores visíveis só para o financeiro.</div>}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
          <div className="text-xs" style={{ color: C.sub }}>Criada por {f.criadoPorNome || "—"} em {new Date(f.createdAt).toLocaleString("pt-BR")}</div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => imprimirFicha(f, master)} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
              <Printer size={15} /> Imprimir FPP
            </button>
            <button onClick={onProposta} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
              <FileText size={15} /> Gerar proposta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Proposta no padrão Meridian/CRM a partir de uma ou várias FPPs (mesmo cliente) */
/* monta a linha de detalhes do item (faixa, personalização) a partir da FPP */
function detalhesItem(f) {
  const e = f.entradas || {};
  const parts = [];
  if (e.faixa && e.faixa !== "SEM FAIXA") parts.push([e.faixa, e.faixaTipo, faixaPedeCor(e.faixaTipo) ? e.faixaCor : ""].filter(Boolean).join(" · "));
  for (const [tec, lbl] of [["silk", "SILK"], ["bordado", "BORDADO"], ["sublimacao", "SUBLIMAÇÃO"]]) {
    const p = e[tec] || {};
    const pos = POS.filter(([k]) => Number(p[k]) > 0).map(([, l]) => l);
    if (pos.length) parts.push(`${lbl} ${pos.join(" / ")}`);
  }
  // v272 — aplicações novas agrupadas por método
  const porMet = {};
  for (const a of Array.isArray(e.personalizacoes) ? e.personalizacoes : []) (porMet[a.metodo] ||= []).push(`${nomeLocal(a.local).toUpperCase()}${a.metodo === "SILK" ? ` ${a.cores || 1}C` : ""}`);
  for (const [m, l] of Object.entries(porMet)) parts.push(`${nomeMetodo(m).toUpperCase()} ${l.join(" / ")}`);
  return parts.join(" · ");
}

// texto de um campo que pode variar por item: igual em todos → só o valor; diferente → "ITEM: valor · ITEM: valor"
function porItem(fichas, valor) {
  const vs = fichas.map(valor);
  const unicos = [...new Set(vs.filter(Boolean))];
  if (unicos.length <= 1) return unicos[0] || "";
  return fichas.map((f, i) => (vs[i] ? `${f.nomeComercial || f.item}: ${vs[i]}` : null)).filter(Boolean).join(" · ");
}
const leadTxt = (f) => (Number(f.leadTime) > 0 ? `${Number(f.leadTime)} DIAS` : "");

function ProposalModal({ fichas, onClose }) {
  const clientes = [...new Set(fichas.map((f) => f.clienteNome).filter(Boolean))];
  const [cliente, setCliente] = useState(clientes[0] || "—");
  const hoje = new Date().toLocaleDateString("pt-BR");
  const negs = [...new Set(fichas.map((f) => f.negociacao).filter(Boolean))];
  const [condicoes, setCondicoes] = useState(() => porItem(fichas, (f) => f.condicaoPagamento));
  const [prazo, setPrazo] = useState(() => {
    const t = porItem(fichas, leadTxt);
    if (!t) return "";
    return t.includes(":") ? `APÓS APROVAÇÃO — ${t}` : `${t} APÓS APROVAÇÃO`;
  });
  const leadMax = Math.max(0, ...fichas.map((f) => Number(f.leadTime) || 0));

  const [meta, setMeta] = useState(null);
  const [ownerId, setOwnerId] = useState("");
  const [stage, setStage] = useState("proposta");
  const [titulo, setTitulo] = useState(`Proposta ${clientes[0] || ""}${negs.length === 1 ? ` · ${negs[0]}` : ""} · ${hoje}`);
  const [enviando, setEnviando] = useState(false);
  const [res, setRes] = useState(null);

  useEffect(() => {
    fetch("/api/crm/meta").then((r) => r.json()).then((d) => {
      setMeta(d);
      if (d.users) {
        const igor = d.users.find((u) => /igor/i.test(u.full_name || "") || /igor/i.test(u.login || ""));
        setOwnerId(igor ? igor.id : d.users[0]?.id || "");
      }
      if (d.stages && d.stages.includes("proposta")) setStage("proposta");
    }).catch(() => setMeta({ error: true }));
  }, []);

  const [items, setItems] = useState(() => fichas.map((f) => ({
    description: f.nomeComercial || f.item,
    details: detalhesItem(f),
    qty: f.qtde || 0,
    unit_price_cents: Math.round((f.valorProposto || 0) * 100),
  })));
  const setItem = (i, k, v) => setItems((arr) => arr.map((it, j) => j === i ? { ...it, [k]: v } : it));
  const totalGeral = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price_cents) || 0), 0) / 100;

  async function enviarCrm() {
    if (!ownerId) { setRes({ erro: "Selecione o dono da proposta." }); return; }
    setEnviando(true); setRes(null);
    const r = await fetch("/api/crm/proposta", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteNome: cliente, ownerId, stage, title: titulo, paymentTerms: condicoes || null, deliveryTerms: prazo || null, leadTimeDias: leadMax || null,
        notes: [negs.length ? `NEGOCIAÇÃO ${negs.join(", ")}` : "", `FPP ${fichas.map((f) => fmtFpp(f.numero)).join(", ")}`].filter(Boolean).join(" · "),
        items,
      }),
    });
    const d = await r.json().catch(() => ({})); setEnviando(false);
    setRes(r.ok ? { ok: true, url: d.url, dealUrl: d.dealUrl } : { erro: d.error || "Falha ao enviar." });
    if (r.ok && d.url) window.open(d.url, "_blank", "noopener");   // v519 — abre a proposta criada (com os itens)
  }

  function imprimir() {
    const R = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const linhas = items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${it.description}</b>${it.details ? `<div style="color:#667085;font-size:11px">${it.details}</div>` : ""}</td>
        <td style="text-align:center">${it.qty ?? "—"}</td>
        <td style="text-align:right">${R((it.unit_price_cents || 0) / 100)}</td>
        <td style="text-align:right">${R(((it.unit_price_cents || 0) * (Number(it.qty) || 0)) / 100)}</td>
        <td>${leadTxt(fichas[i] || {}) || "—"}</td>
      </tr>`).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Proposta ${cliente}</title>
      <style>
        body{font-family:Montserrat,Arial,sans-serif;color:#1F2733;padding:32px}
        .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FF6B1A;padding-bottom:12px;margin-bottom:20px}
        .marca{font-size:22px;font-weight:800;color:#001E41}
        h1{font-size:16px;margin:0 0 4px}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
        th,td{border:1px solid #E4E7EC;padding:8px}
        th{background:#001E41;color:#fff;text-align:left}
        .tot{text-align:right;font-size:15px;font-weight:800;margin-top:16px;color:#001E41}
        .obs{color:#667085;font-size:12px;margin-top:24px}
      </style></head><body>
      <div class="top"><div class="marca">MERIDIAN</div><div style="text-align:right"><h1>Proposta comercial</h1><div style="color:#667085;font-size:12px">${hoje}</div></div></div>
      <div><b>Cliente:</b> ${cliente}</div>
      <table><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qtde</th><th style="text-align:right">Valor unit.</th><th style="text-align:right">Total</th><th>Prazo</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <div class="tot">Total geral: ${totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
      ${condicoes ? `<div style="margin-top:12px"><b>Condição de pagamento:</b> ${condicoes}</div>` : ""}
      ${prazo ? `<div style="margin-top:4px"><b>Entrega:</b> ${prazo}</div>` : ""}
      <div class="obs">Proposta gerada pelo sistema Meridian. Valores sujeitos a confirmação.</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-2xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>   {/* v518 — mais larga: valores não vazam a borda */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>Proposta · {cliente} · {fichas.length} item(ns)</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-md p-2" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex gap-2 items-center flex-wrap">
                  <input value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} className="flex-1 min-w-0 px-2 py-1 rounded text-sm font-medium" title={it.description} style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
                  <span className="text-xs whitespace-nowrap" style={{ color: C.sub }}>{fmtFpp(fichas[i]?.numero)} · {nPt(it.qty)} ×</span>
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: C.text }}>{brl((it.unit_price_cents || 0) / 100)}</span>
                  <span className="text-sm font-bold whitespace-nowrap ml-auto" style={{ color: C.navy }}>= {brl(((it.unit_price_cents || 0) * (Number(it.qty) || 0)) / 100)}</span>
                </div>
                <input value={it.details || ""} placeholder="Detalhes (tecido · cor · faixa · personalização…)" onChange={(e) => setItem(i, "details", e.target.value)} className="w-full mt-1 px-2 py-1 rounded text-xs" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.sub }} />
              </div>
            ))}
          </div>
          <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Total geral: {brl(totalGeral)}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <div className="md:col-span-3">
              <div className="text-xs mb-1" style={{ color: C.sub }}>Título da proposta</div>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Dono (CRM)</div>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }}>
                {(meta?.users || []).map((u) => <option key={u.id} value={u.id}>{u.full_name || u.login}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Etapa do funil</div>
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }}>
                {(meta?.stages || ["proposta"]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Cliente</div>
              {clientes.length > 1 ? (
                <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.yellow}`, color: C.text }}>
                  {clientes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : <div className="px-2 py-1.5 rounded text-sm truncate" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>{cliente}</div>}
            </div>
            <div className="md:col-span-3">
              <div className="text-xs mb-1" style={{ color: C.sub }}>Condição de pagamento</div>
              <input value={condicoes} onChange={(e) => setCondicoes(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
            </div>
            <div className="md:col-span-3">
              <div className="text-xs mb-1" style={{ color: C.sub }}>Prazo de entrega (lead time)</div>
              <input value={prazo} onChange={(e) => setPrazo(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
            </div>
            {clientes.length > 1 && <div className="md:col-span-3 text-xs" style={{ color: C.yellow }}>As FPPs têm {clientes.length} clientes diferentes — a proposta sai para o cliente escolhido.</div>}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={imprimir} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}>
              <FileText size={15} /> PDF / impressão
            </button>
            <button onClick={enviarCrm} disabled={enviando || !ownerId} className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: enviando ? 0.6 : 1 }}>
              <Send size={15} /> {enviando ? "Enviando…" : "Enviar ao CRM"}
            </button>
          </div>
          {res?.ok && <div className="text-xs mt-2 text-right" style={{ color: C.green }}>
            Proposta criada no CRM ✓ {res.url && <a href={res.url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "underline" }}>abrir a proposta</a>}{res.dealUrl && <> · <a href={res.dealUrl} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "underline" }}>abrir o negócio</a></>}
            <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>No CRM, abra a proposta pela lista do negócio — o botão PROPOSTA de lá cria uma nova em branco.</div>
          </div>}
          {res?.erro && <div className="text-xs mt-2 text-right" style={{ color: "#E5484D" }}>{res.erro}</div>}
          {meta?.error && <div className="text-xs mt-1 text-right" style={{ color: C.sub }}>CRM indisponível — só PDF disponível.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- pequenos componentes ---------- */
// v272 — lista de aplicações de personalização da FPP
// v517 — campo de arte/tela/programa: ao sair do campo com valor novo, pede confirmação de que é o valor TOTAL de arte (rateado pela qtde)
function ArteInput({ value, onChange, qtde, rotulo = "arte", className, style, title }) {
  const ini = useRef(value);
  async function sair() {
    const antes = ini.current;
    if (String(value ?? "") === String(antes ?? "") || !(num(value) > 0)) return;
    const q = Math.max(1, Number(qtde) || 1);
    const ok = await confirmar(`Confirma que ${brl(num(value))} é de fato o valor de ${rotulo}?\n\nEle é o valor TOTAL do pedido e será dividido pela quantidade total (${q} peça${q > 1 ? "s" : ""}) = ${brl(num(value) / q)} por peça.${!(Number(qtde) > 0) ? "\n\nAtenção: a qtde da ficha ainda não foi preenchida." : ""}`, { titulo: "Confirmar valor de arte" });
    if (!ok) { onChange(antes ?? ""); return; }
    ini.current = value;
  }
  return <input value={value || ""} onFocus={() => { ini.current = value; }} onChange={(e) => onChange(e.target.value)} onBlur={sair} inputMode="decimal" className={className} style={style} title={title} />;
}

function PersAplicacoes({ lista, onChange, params, qtde }) {
  const pc = silkPorCorDe(params);
  const add = () => onChange([...lista, { local: "PEITO_E", metodo: "SILK", cores: 1, valor: "", interno: true }]);
  const mud = (i, k, v) => onChange(lista.map((a, j) => {
    if (j !== i) return a;
    const n = { ...a, [k]: v };
    if (k === "metodo") n.interno = (METODOS_PERS.find((x) => x[0] === v) || [])[2] ?? false;
    return n;
  }));
  const sel = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
  return (
    <div>
      {/* v414 — grade fixa (colunas alinhadas entre as aplicações); lixeira fora do bloco cinza */}
      {lista.map((a, i) => {
        const temArte = a.metodo === "SILK" || a.metodo === "DTF" || a.metodo === "BORDADO";
        const lbl = (t, el) => <label className="block min-w-0"><div className="text-[11px] mb-1" style={{ color: C.sub }}>{t}</div>{el}</label>;
        return (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div className="flex-1 grid gap-3 items-end p-3 rounded-lg" style={{ background: C.panel2, gridTemplateColumns: "minmax(110px,1fr) minmax(110px,1fr) 110px 120px 210px 130px" }}>
              {lbl("Local", <select value={a.local} onChange={(e) => mud(i, "local", e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={sel}>
                {LOCAIS_PERS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>)}
              {lbl("Método", <select value={a.metodo} onChange={(e) => mud(i, "metodo", e.target.value)} className="w-full px-2 py-1.5 rounded text-sm" style={sel}>
                {METODOS_PERS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>)}
              {a.metodo === "SILK"
                ? lbl("Cores", <select value={a.cores || 1} onChange={(e) => mud(i, "cores", Number(e.target.value))} className="w-full px-2 py-1.5 rounded text-sm" style={sel}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} cor{n > 1 ? "es" : ""}</option>)}
                  </select>)
                : lbl(a.metodo === "BORDADO" ? "R$/aplicação" : "R$/peça", <input value={a.valor || ""} onChange={(e) => mud(i, "valor", e.target.value)} inputMode="decimal" className="w-full px-2 py-1.5 rounded text-sm" style={sel} />)}
              {lbl("Valor/peça", <div className="py-1.5 text-sm font-semibold whitespace-nowrap" style={{ color: C.text }}>{brl(valorAplicacao(a, params))}{a.metodo === "SILK" && <span className="text-[11px] font-normal" style={{ color: C.sub }}> ({a.cores || 1} × {brl(pc)})</span>}</div>)}
              {lbl("Origem", <SeletorOrigem interno={!!a.interno} onChange={(v) => mud(i, "interno", v)} />)}
              {temArte
                ? lbl(`${a.metodo === "BORDADO" ? "Programa" : "Arte / tela"} (R$ total)`, <>
                    <ArteInput value={a.arte || ""} onChange={(v) => mud(i, "arte", v)} qtde={qtde} rotulo={a.metodo === "BORDADO" ? "programa de bordado" : "arte / tela"} className="w-full px-2 py-1.5 rounded text-sm" style={sel}
                      title={`Sempre terceirizado · rateado ÷ ${qtde || 1} peça(s)`} />
                    {num(a.arte) > 0 && <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>+{brl(num(a.arte) / Math.max(1, qtde || 1))}/pç</div>}
                  </>)
                : <div />}
            </div>
            <button type="button" onClick={() => onChange(lista.filter((_, j) => j !== i))} className="p-1.5 rounded shrink-0" style={{ color: C.sub }} title="Remover"><Trash2 size={15} /></button>
          </div>
        );
      })}
      <button type="button" onClick={add} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: "#fff" }}>
        <Plus size={13} /> Aplicação
      </button>
    </div>
  );
}

/* v294 — seletor terceirizado (esquerda, laranja) ⇄ interno (direita, azul) */
function SeletorOrigem({ interno, onChange }) {
  const cor = interno ? C.blue : C.accent;
  return (
    <div className="flex items-center gap-2 text-xs select-none" style={{ minHeight: 34 }}>
      <button type="button" onClick={() => onChange(false)} className="font-semibold" style={{ color: !interno ? C.accent : C.sub }}>Terceirizado</button>
      <button type="button" onClick={() => onChange(!interno)} title={interno ? "Interno: o valor volta para a operação" : "Terceirizado"}
        style={{ width: 44, height: 24, borderRadius: 12, background: cor, position: "relative", transition: "background .15s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: interno ? 23 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
      </button>
      <button type="button" onClick={() => onChange(true)} className="font-semibold" style={{ color: interno ? C.blue : C.sub }}>Interno</button>
    </div>
  );
}

/* v404 — nome do artigo + botão "+" com o detalhe (fornecedor, cor, código, largura; malha: rendimento e ramada/tubular).
   v405 — aviamentos também: fornecedor, cor, código, qtd por peça e observação (sempre em unidades; botão compra em grosa de 144).
   Preenchido, o artigo entra no cadastro de Artigos com origem FPP ao salvar a ficha. Campo vazio não distingue um artigo do outro. */
let _fornCache = null;
function resumoDet(d, categoria, botao) {
  return [d.fornecedorNome && sc(d.fornecedorNome), d.cor && sc(d.cor), d.codigo, d.largura ? `${d.largura} m larg.` : null,
    categoria === "MALHA" && d.rendimento ? `${d.rendimento} m/kg` : null, categoria === "MALHA" && d.tipoMalha ? d.tipoMalha.toLowerCase() : null,
    categoria === "AVIAMENTO" && !botao && d.qtdPeca && String(d.qtdPeca) !== "1" ? `${d.qtdPeca} un/peça` : null, d.obs ? `obs: ${String(d.obs).toLocaleLowerCase("pt-BR")}` : null].filter(Boolean);
}
function DetBotao({ det, categoria, nome, onDet, botao, titulo, semQtd }) {
  const [aberto, setAberto] = useState(false);
  const d = det || {};
  const resumo = resumoDet(d, categoria, botao);
  const cheio = categoria === "AVIAMENTO" ? !!(d.fornecedorId && d.cor) : !!(d.fornecedorId && d.cor && d.codigo && d.largura && (categoria !== "MALHA" || (d.rendimento && d.tipoMalha)));
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} title={titulo || "Fornecedor, cor, código e detalhes para compras"}
        className="px-2 rounded text-sm font-bold self-stretch" style={{ minWidth: 30, background: resumo.length ? (cheio ? C.greenSoft : C.accentSoft) : C.panel2, color: resumo.length ? (cheio ? C.green : C.accent) : C.sub, border: `1px solid ${resumo.length ? (cheio ? C.green : C.accent) : C.line}` }}>+</button>
      {aberto && <ArtigoDetModal nome={nome} det={d} categoria={categoria} botao={botao} semQtd={semQtd} onClose={() => setAberto(false)} onSalvar={(x) => { onDet(x); setAberto(false); }} />}
    </>
  );
}
function ResumoDet({ det, categoria, botao }) {
  const r = resumoDet(det || {}, categoria, botao);
  return r.length ? <div className="text-[11px] mt-0.5 truncate" style={{ color: C.sub }} title={r.join(" · ")}>{r.join(" · ")}</div> : null;
}
function ArtigoNomeDet({ label, nome, det, categoria, onNome, onDet }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <div className="flex gap-1">
        <input value={sc(nome || "")} onChange={(e) => onNome(e.target.value)} placeholder="Nome do artigo"
          className="px-2 py-1.5 rounded text-sm w-full" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
        <DetBotao det={det} categoria={categoria} nome={nome} onDet={onDet} />
      </div>
      <ResumoDet det={det} categoria={categoria} />
    </div>
  );
}
// aviamento escolhido no combo + "+" (só aparece com um aviamento escolhido)
function AvComDet({ children, valor, det, onDet, botao }) {
  const tem = valor && !/^SEM\b/i.test(String(valor).trim()) && (!botao || Number(String(valor).replace(",", ".")) > 0);
  return (
    <div>
      <div className="flex gap-1 items-end"><div className="flex-1 min-w-0">{children}</div>{tem && <DetBotao det={det} categoria="AVIAMENTO" nome={botao ? "BOTÃO" : valor} onDet={onDet} botao={botao} />}</div>
      {tem && <ResumoDet det={det} categoria="AVIAMENTO" botao={botao} />}
    </div>
  );
}
// v407 — fornecedor: busca pelo nome (comercial, fantasia ou razão social); não cadastrado → cria o cadastro só com o nome
const nomeForn = (f) => f.nome || f.nomeFantasia || f.razaoSocial || (f.cnpjs?.[0]?.razaoSocial) || `Fornecedor ${f.id}`;
function FornecedorCombo({ forns, id, nome, onPick, onCriado }) {
  const [q, setQ] = useState(nome || "");
  const [open, setOpen] = useState(false);
  const [criando, setCriando] = useState(false);
  const nq = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const hay = (f) => [f.nome, f.nomeFantasia, f.razaoSocial, ...(f.cnpjs || []).map((c) => `${c.razaoSocial || ""} ${c.cnpj}`)].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const lista = forns.filter((f) => !nq || hay(f).includes(nq)).sort((a, b) => nomeForn(a).localeCompare(nomeForn(b))).slice(0, 40);
  const exato = forns.some((f) => nomeForn(f).toUpperCase().trim() === nq);
  async function criar() {
    setCriando(true);
    const r = await fetch("/api/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: q.trim().toUpperCase() }) });
    const f = await r.json().catch(() => ({}));
    setCriando(false);
    if (!r.ok) return alerta(f.error || "Não foi possível cadastrar.");
    setQ(nomeForn(f)); setOpen(false); onCriado(f);
  }
  return (
    <div className="col-span-2" style={{ position: "relative" }}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Fornecedor {id ? "" : <span style={{ color: C.sub }}>· digite para buscar</span>}</div>
      <input value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); if (id) onPick(null); }} placeholder="Nome do fornecedor"
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${id ? C.green : open ? C.accent : C.line}`, color: C.text }} />
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((f) => (
            <button key={f.id} type="button" onMouseDown={(e) => { e.preventDefault(); setQ(nomeForn(f)); setOpen(false); onPick(f); }}
              className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text, background: f.id === id ? C.accentSoft : "#fff" }}>
              {nomeForn(f)}{f.razaoSocial && f.razaoSocial !== nomeForn(f) ? <span className="text-xs" style={{ color: C.sub }}> · {f.razaoSocial}</span> : null}
            </button>
          ))}
          {!lista.length && !nq && <div className="px-3 py-2 text-xs" style={{ color: C.sub }}>Nenhum fornecedor cadastrado.</div>}
          {nq && !exato && (
            <button type="button" disabled={criando} onMouseDown={(e) => { e.preventDefault(); criar(); }} className="flex items-center gap-1 w-full text-left px-3 py-2 text-sm font-semibold" style={{ color: C.accent, borderTop: `1px solid ${C.line}` }}>
              <Plus size={14} /> {criando ? "Cadastrando…" : `Cadastrar “${q.trim().toUpperCase()}” (só o nome)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function ArtigoDetModal({ nome, det, categoria, botao, semQtd, onClose, onSalvar }) {
  const [x, setX] = useState({ fornecedorId: det.fornecedorId || "", fornecedorNome: det.fornecedorNome || "", cor: det.cor || "", codigo: det.codigo || "", largura: det.largura || "", rendimento: det.rendimento || "", tipoMalha: det.tipoMalha || "", qtdPeca: det.qtdPeca || "", obs: det.obs || "" });
  const [forns, setForns] = useState(_fornCache || []);
  useEffect(() => { if (!_fornCache) fetch("/api/fornecedores").then((r) => r.json()).then((l) => { _fornCache = Array.isArray(l) ? l : []; setForns(_fornCache); }).catch(() => {}); }, []);
  const s = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const av = categoria === "AVIAMENTO";
  const campo = (lbl, k, ph, span) => (
    <label className={`block ${span ? "col-span-2" : ""}`}><div className="text-xs mb-1" style={{ color: C.sub }}>{lbl}</div>
      <input value={x[k]} onChange={(e) => s(k, ["cor", "codigo", "obs"].includes(k) ? e.target.value.toUpperCase() : e.target.value)} placeholder={ph || ""}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} /></label>
  );
  const salvar = () => {
    const out = { ...(det.artigoId ? { artigoId: det.artigoId } : {}) };
    for (const [k, v] of Object.entries(x)) if (String(v).trim() !== "") out[k] = typeof v === "string" ? v.trim() : v;
    if (categoria !== "MALHA") { delete out.rendimento; delete out.tipoMalha; }
    if (av) delete out.largura; else delete out.qtdPeca;
    if (botao || semQtd) delete out.qtdPeca;
    onSalvar(Object.keys(out).length ? out : null);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>{categoria === "MALHA" ? "Malha" : av ? "Aviamento" : "Tecido"} · {nome || "sem nome"}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <FornecedorCombo forns={forns} id={x.fornecedorId} nome={x.fornecedorNome}
            onPick={(f) => setX((o) => ({ ...o, fornecedorId: f ? f.id : "", fornecedorNome: f ? nomeForn(f) : "" }))}
            onCriado={(f) => { _fornCache = [...(_fornCache || []), f]; setForns(_fornCache); setX((o) => ({ ...o, fornecedorId: f.id, fornecedorNome: nomeForn(f) })); }} />
          {campo("Cor", "cor", "ex.: CINZA")}
          {campo("Código", "codigo", "ex.: 8047")}
          {!av && campo("Largura (m)", "largura", "ex.: 1,60")}
          {categoria === "MALHA" && campo("Rendimento da malha (m/kg)", "rendimento", "ex.: 2,8")}
          {av && !botao && !semQtd && campo("Qtd por peça (un)", "qtdPeca", "1")}
          {botao && <div className="text-xs self-end pb-2" style={{ color: C.sub }}>Qtd por peça = Qtde de botões. Compra em grosa (144), arredondada para cima.</div>}
          {categoria === "MALHA" && (
            <div className="col-span-2"><div className="text-xs mb-1" style={{ color: C.sub }}>Tipo da malha</div>
              <div className="flex gap-2">{["RAMADA", "TUBULAR"].map((t) => (
                <button key={t} type="button" onClick={() => s("tipoMalha", x.tipoMalha === t ? "" : t)} className="flex-1 py-1.5 rounded text-sm font-semibold"
                  style={{ background: x.tipoMalha === t ? C.accent : C.panel2, color: x.tipoMalha === t ? "#fff" : C.sub, border: `1px solid ${x.tipoMalha === t ? C.accent : C.line}` }}>{t === "RAMADA" ? "Ramada" : "Tubular"}</button>
              ))}</div></div>
          )}
          {campo("Observação", "obs", "info para compras", true)}
          <div className="col-span-2 text-[11px]" style={{ color: C.sub }}>Ao salvar a FPP, o artigo entra no cadastro de Artigos (origem: FPP). Campo em branco não separa este artigo de outro com o mesmo nome — compras pode juntar os volumes.</div>
          <button onClick={salvar} className="col-span-2 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Aplicar</button>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-xl p-4">
      <div className="text-sm font-bold mb-3" style={{ color: C.navy }}>{title}</div>
      {children}
    </div>
  );
}
/* custos extras (aviamentos / produção): sem limite de linhas, sempre em R$ por peça */
const somaExtras = (l) => (Array.isArray(l) ? l : []).reduce((s, x) => s + num(x?.valor), 0);
// v411 — matérias-primas adicionais: artigo (+ detalhe) · custo · consumo (m/peça) ou rendimento (peças/kg)
function custoMpExtras(l) {
  return (Array.isArray(l) ? l : []).reduce((s0, x) => {
    const q = num(x?.qtd), c = num(x?.custo);
    return s0 + (x?.modo === "RENDIMENTO" ? (q ? c / q : 0) : c * q);
  }, 0);
}
function MpExtras({ lista, onChange, cols }) {
  const l = Array.isArray(lista) ? lista : [];
  const alt = (i, k, v) => onChange(l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const grid = { gridTemplateColumns: "minmax(0,1fr) 150px 150px" + (cols ? " 120px" : " 28px") };
  const sel = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
  return (
    <div>
      {l.map((x, i) => {
        const rend = x.modo === "RENDIMENTO";
        return (
          <div key={i} className="grid gap-3 items-start mb-3" style={grid}>
            <ArtigoNomeDet label={`Matéria-prima adicional ${i + 1}`} nome={x.nome} det={x.det} categoria={rend ? "MALHA" : "TECIDO"}
              onNome={(v) => alt(i, "nome", v.toUpperCase())} onDet={(d) => alt(i, "det", d)} />
            <Inp full label={rend ? "Custo (R$/kg)" : "Custo (R$/m)"} value={x.custo ?? ""} onChange={(v) => alt(i, "custo", v)} />
            <div>
              <select value={rend ? "RENDIMENTO" : "CONSUMO"} onChange={(e) => alt(i, "modo", e.target.value)} className="text-xs mb-1 rounded px-1" style={{ ...sel, height: 18, padding: "0 2px" }}>
                <option value="CONSUMO">Consumo (m/peça)</option><option value="RENDIMENTO">Rendimento (pç/kg)</option>
              </select>
              <input value={x.qtd ?? ""} onChange={(e) => alt(i, "qtd", e.target.value)} inputMode="decimal" className="w-full px-2 py-1.5 rounded text-sm" style={sel} />
            </div>
            <div className="flex items-end justify-between gap-1" style={{ minHeight: 54 }}>
              <span className="text-[11px] pb-2" style={{ color: C.sub }}>{brl(custoMpExtras([x]))}/pç</span>
              <button onClick={() => onChange(l.filter((_, j) => j !== i))} title="Remover" className="p-1 pb-2" style={{ color: C.red }}><X size={15} /></button>
            </div>
          </div>
        );
      })}
      <button onClick={() => onChange([...l, { nome: "", custo: "", modo: "CONSUMO", qtd: "" }])} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
        <Plus size={14} /> Adicionar matéria-prima
      </button>
    </div>
  );
}
// v411 — aviamentos adicionais: nome (+ fornecedor, cor, código) · unidade por peça (m/un) · consumo · R$ por unidade
//   linha antiga (só R$/peça) continua valendo até ser editada
const avExtraNorm = (x) => (x?.unidade ? x : { ...x, unidade: "UN", consumo: x?.det?.qtdPeca || (num(x?.valor) ? 1 : ""), preco: num(x?.valor) ? String(Math.round((num(x.valor) / (num(x?.det?.qtdPeca) || 1)) * 10000) / 10000).replace(".", ",") : "" });
const custoAvExtra = (x) => (x?.unidade ? num(x.consumo) * num(x.preco) : num(x?.valor));
const somaAvExtras = (l) => (Array.isArray(l) ? l : []).reduce((s0, x) => s0 + custoAvExtra(x), 0);
function AvExtras({ lista, onChange }) {
  const l = Array.isArray(lista) ? lista : [];
  const alt = (i, k, v) => onChange(l.map((x, j) => {
    if (j !== i) return x;
    const n = { ...avExtraNorm(x), [k]: v };
    delete n.valor;
    if (n.det) { const { qtdPeca, ...d } = n.det; n.det = Object.keys(d).length ? d : null; }
    return n;
  }));
  const grid = { gridTemplateColumns: "minmax(0,1fr) 110px 110px 120px 80px 24px" };
  const sel = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
  return (
    <div className="mt-4">
      {l.length > 0 && (
        <div className="space-y-2 mb-2">
          <div className="text-xs font-semibold" style={{ color: C.sub }}>Aviamentos adicionais</div>
          <div className="grid gap-2 text-xs" style={{ ...grid, color: C.sub }}>
            <span>Aviamento</span><span>Unidade</span><span>Consumo/peça</span><span>R$ por un/m</span><span>R$/pç</span><span />
          </div>
          {l.map((x0, i) => {
            const x = avExtraNorm(x0);
            return (
              <div key={i}>
                <div className="grid gap-2 items-center" style={grid}>
                  <div className="flex gap-1">
                    <input value={sc(x.desc || "")} onChange={(e) => alt(i, "desc", e.target.value.toUpperCase())} placeholder="Ex.: zíper, etiqueta, velcro…"
                      className="w-full px-2 py-1.5 rounded text-sm" style={sel} />
                    {x.desc ? <DetBotao det={x.det} categoria="AVIAMENTO" nome={x.desc} semQtd onDet={(d) => alt(i, "det", d)} /> : null}
                  </div>
                  <select value={x.unidade} onChange={(e) => alt(i, "unidade", e.target.value)} className="px-2 py-1.5 rounded text-sm" style={sel}>
                    <option value="UN">Unidades</option><option value="M">Metros</option>
                  </select>
                  <input value={x.consumo ?? ""} onChange={(e) => alt(i, "consumo", e.target.value)} inputMode="decimal" placeholder={x.unidade === "M" ? "m/peça" : "un/peça"}
                    className="w-full px-2 py-1.5 rounded text-sm" style={sel} />
                  <input value={x.preco ?? ""} onChange={(e) => alt(i, "preco", e.target.value)} inputMode="decimal" placeholder={x.unidade === "M" ? "R$/m" : "R$/un"}
                    className="w-full px-2 py-1.5 rounded text-sm" style={sel} />
                  <span className="text-sm tabular-nums" style={{ color: C.text }}>{brl(custoAvExtra(x))}</span>
                  <button onClick={() => onChange(l.filter((_, j) => j !== i))} title="Remover" className="p-1 rounded" style={{ color: C.red }}><X size={15} /></button>
                </div>
                {x.desc && <ResumoDet det={x.det} categoria="AVIAMENTO" botao />}
              </div>
            );
          })}
          <div className="text-xs" style={{ color: C.sub }}>Adicionais: <b style={{ color: C.navy }}>{brl(somaAvExtras(l))}</b> por peça</div>
        </div>
      )}
      <button onClick={() => onChange([...l, { desc: "", unidade: "UN", consumo: "", preco: "" }])} className="flex items-center gap-1 text-xs font-semibold mt-2" style={{ color: C.accent }}>
        <Plus size={14} /> Adicionar aviamento
      </button>
    </div>
  );
}
function ExtrasCustos({ lista, onChange, comDet }) {
  const l = Array.isArray(lista) ? lista : [];
  const cols = comDet ? "1fr 160px 30px 28px" : "1fr 160px 28px";
  const alt = (i, k, v) => onChange(l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="mt-3">
      {l.length > 0 && (
        <div className="space-y-2 mb-2">
          <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: cols, color: C.sub }}>
            <span>Custo extra (descrição)</span><span>Valor (R$ por peça)</span><span />{comDet && <span />}
          </div>
          {l.map((x, i) => (
            <React.Fragment key={i}>
            <div className="grid gap-2 items-center" style={{ gridTemplateColumns: cols }}>
              <input value={sc(x.desc || "")} onChange={(e) => alt(i, "desc", e.target.value.toUpperCase())} placeholder="Ex.: zíper, etiqueta, lavagem…"
                className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
              <input value={x.valor ?? ""} onChange={(e) => alt(i, "valor", e.target.value)} inputMode="decimal" placeholder="0,00 por peça"
                className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
              {comDet && (x.desc ? <DetBotao det={x.det} categoria="AVIAMENTO" nome={x.desc} onDet={(d) => alt(i, "det", d)} /> : <span />)}
              <button onClick={() => onChange(l.filter((_, j) => j !== i))} title="Remover" className="p-1 rounded" style={{ color: C.red }}><X size={15} /></button>
            </div>
            {comDet && x.desc && <ResumoDet det={x.det} categoria="AVIAMENTO" />}
            </React.Fragment>
          ))}
          <div className="text-xs" style={{ color: C.sub }}>Extras: <b style={{ color: C.navy }}>{brl(somaExtras(l))}</b> por peça</div>
        </div>
      )}
      <button onClick={() => onChange([...l, { desc: "", valor: "" }])} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
        <Plus size={14} /> Adicionar custo extra (R$ por peça)
      </button>
    </div>
  );
}
// v410 — select simples (tipo de faixa, cor, tipo de botão)
function SelAv({ label, value, onChange, options }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-1.5 rounded text-sm"
        style={{ background: "#fff", border: `1px solid ${value ? C.line : C.accent}`, color: C.text }}>
        <option value="">Escolha…</option>
        {options.map((o) => <option key={o} value={o}>{sc(o)}</option>)}
      </select>
    </div>
  );
}
// v410 — conta do aviamento por metro, embaixo do campo
function AvMetro({ c, semTipo }) {
  if (!c || (!c.valor && !c.consumo)) return null;
  return (
    <div className="text-[11px] mt-1" style={{ color: C.sub }}>
      {c.porMetro
        ? c.montada
          ? <>{fmtNum(c.consumo, 2)} m × (faixa R$ {fmtNum(c.metroFaixa, 2)} + tactel R$ {fmtNum(c.metroTactel, 2)})/m = <b style={{ color: C.text }}>R$ {fmtNum(c.valor, 2)}/pç</b></>
          : <>{fmtNum(c.consumo, 2)} m × R$ {fmtNum(c.metro, 2)}/m = <b style={{ color: C.text }}>R$ {fmtNum(c.valor, 2)}/pç</b></>
        : c.falta !== undefined
          ? <>R$ {fmtNum(c.valor, 2)}/pç <span style={{ color: C.accent }}>· {c.falta === "TIPO" || semTipo ? "escolha o tipo de faixa" : c.falta === "CONSUMO" ? "aplicação sem consumo (m/peça) no banco de dados" : c.falta === "TACTEL" ? "faixa montada sem o R$/m do tactel no banco de dados" : "tipo de faixa sem R$/m no banco de dados"}</span></>
          : <>R$ {fmtNum(c.valor, 2)}/pç <span style={{ color: C.accent }}>· {semTipo ? "escolha o tipo de faixa" : "sem consumo ou R$/m no banco de dados"}</span></>}
    </div>
  );
}
// v517 — Inp de arte (mesmo visual), com a confirmação do ArteInput
function ArteInp({ label, value, onChange, qtde, full }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <ArteInput value={value} onChange={onChange} qtde={qtde} className={`px-2 py-1.5 rounded text-sm ${full ? "w-full" : "w-36"}`} style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
    </div>
  );
}
function Inp({ label, value, onChange, destaque, text, placeholder, full }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={text ? "text" : "decimal"} placeholder={placeholder || ""}
        className={`px-2 py-1.5 rounded text-sm ${text || full ? "w-full" : "w-36"}`} style={{ background: "#fff", border: `1px solid ${destaque ? C.accent : C.line}`, color: C.text }} />
    </div>
  );
}
/* Toggle estilo iPhone */
function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => !disabled && onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 13, background: on ? C.accent : "#CBD2DA", position: "relative", transition: "background .15s", opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.3)" }} />
    </button>
  );
}

/* Autocomplete com teclado:
   - Tab / ↓ correm a lista pra baixo (Shift+Tab / ↑ pra cima), preenchendo o campo ao vivo;
   - Enter ou clicar fora confirmam a opção atual e fecham;
   - com a lista fechada, o Tab é nativo → pula pro próximo campo. */
function Combo({ label, value, onChange, onPick, options, placeholder, livre }) {
  const [open, setOpen] = useState(false);
  const [navegou, setNavegou] = useState(false);
  const [q, setQ] = useState(value || "");
  const [seed, setSeed] = useState("");     // texto digitado que filtra (não muda ao navegar → a lista não "afunila")
  const [hi, setHi] = useState(0);          // índice destacado
  useEffect(() => { setQ(value || ""); }, [value]);
  const lista = (options || []).filter((o) => o.toLowerCase().includes((seed || "").toLowerCase()));

  function abrir() {
    setSeed("");
    const i = (options || []).findIndex((o) => o === q);
    setHi(i >= 0 ? i : 0);
    setOpen(true);
  }
  function digitar(v) { setQ(v); setSeed(v); setHi(0); setOpen(true); setNavegou(false); onChange?.(v); }
  function mover(dir) {
    if (!lista.length) return;
    const n = (hi + dir + lista.length) % lista.length;
    setHi(n); setQ(lista[n]); setNavegou(true); onChange?.(lista[n]);   // preenche ao vivo
  }
  function confirmar(o) {
    const alvo = o != null ? o : (livre && !navegou ? q : (lista[hi] || q));
    setQ(alvo); setSeed(alvo); setOpen(false); (onPick || onChange)?.(alvo);
  }
  function onKey(e) {
    if (!open) return;                       // fechado → deixa o Tab pular de campo (nativo)
    if (e.key === "Tab") { e.preventDefault(); mover(e.shiftKey ? -1 : 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
    else if (e.key === "Enter") { e.preventDefault(); confirmar(); }
    else if (e.key === "Escape") { setOpen(false); }
  }
  return (
    <div style={{ position: "relative" }}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input value={sc(q)} placeholder={placeholder} onChange={(e) => digitar(e.target.value)} onKeyDown={onKey}
        onFocus={abrir} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${open ? C.accent : C.line}`, color: C.text }} />
      {open && lista.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((o, idx) => (
            <button key={o} tabIndex={-1} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => { e.preventDefault(); confirmar(o); }}
              className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text, background: idx === hi ? C.accentSoft : "#fff" }}>{sc(o)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Cliente: busca no banco e permite cadastrar na hora só com o nome */
function ClienteCombo({ clientes, value, onType, onPick, onCreated }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");
  const [seed, setSeed] = useState("");
  const [hi, setHi] = useState(0);
  const [criando, setCriando] = useState(false);
  useEffect(() => { setQ(value || ""); }, [value]);
  const nome = (c) => c.razaoSocial || c.nomeFantasia || "";
  const lista = clientes.filter((c) => nome(c).toLowerCase().includes((seed || "").toLowerCase())).slice(0, 30);
  const exato = clientes.some((c) => nome(c).toLowerCase() === (q || "").trim().toLowerCase());
  async function criar() {
    setCriando(true);
    const res = await fetch("/api/clientes/rapido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ razaoSocial: q }) });
    const c = await res.json(); setCriando(false); setOpen(false);
    if (res.ok) { setQ(c.razaoSocial); onCreated?.(c); }
  }
  function digitar(v) { setQ(v); setSeed(v); setHi(0); setOpen(true); onType?.(v); }
  function mover(dir) {
    if (!lista.length) return;
    const n = (hi + dir + lista.length) % lista.length;
    setHi(n); setQ(nome(lista[n])); onType?.(nome(lista[n]));
  }
  function confirmar(c) { const alvo = c || lista[hi]; if (!alvo) return; setQ(nome(alvo)); setSeed(nome(alvo)); setOpen(false); onPick?.(alvo); }
  function onKey(e) {
    if (!open || !lista.length) return;
    if (e.key === "Tab") { e.preventDefault(); mover(e.shiftKey ? -1 : 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); mover(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); mover(-1); }
    else if (e.key === "Enter") { e.preventDefault(); confirmar(); }
    else if (e.key === "Escape") { setOpen(false); }
  }
  return (
    <div style={{ position: "relative" }}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Cliente</div>
      <input value={sc(q)} placeholder="Buscar cliente…" onChange={(e) => digitar(e.target.value)} onKeyDown={onKey}
        onFocus={() => { setSeed(q || ""); setHi(0); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${open ? C.accent : C.line}`, color: C.text }} />
      {open && (q || "").trim() !== "" && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((c, idx) => (
            <button key={c.id} tabIndex={-1} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => { e.preventDefault(); confirmar(c); }}
              className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text, background: idx === hi ? C.accentSoft : "#fff" }}>{sc(nome(c))}</button>
          ))}
          {!exato && (
            <button tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); criar(); }} disabled={criando} className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.accent, borderTop: lista.length ? `1px solid ${C.line}` : 0 }}>
              {criando ? "Registrando…" : `+ Registrar "${q.trim().toUpperCase()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, children }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }}>
        {children}
      </select>
    </div>
  );
}
// campo que mostra valor puxado do banco; permite override só nesta ficha
function Ref({ label, grupo, chave, campo, pget, over, setOver, modo, full }) {
  const path = `${grupo}:${chave}:${campo}`;
  const base = pget(grupo, chave, campo);
  const val = over[path] != null && over[path] !== "" ? over[path] : "";
  return (
    <div>
      <div className="text-xs mb-1 flex items-center gap-1" style={{ color: C.sub }}>{label}{modo && <Pencil size={11} />}</div>
      {modo ? (
        <input value={val} placeholder={String(base)} onChange={(e) => setOver((s) => ({ ...s, [path]: e.target.value }))} inputMode="decimal"
          className={`${full ? "w-full" : "w-36"} px-2 py-1.5 rounded text-sm`} style={{ background: "#fff", border: `1px dashed ${C.accent}`, color: C.text }} />
      ) : (
        <div className={`${full ? "w-full" : "w-36"} px-2 py-1.5 rounded text-sm`} style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>{base || "—"}</div>
      )}
    </div>
  );
}
function Lin({ l, v, forte, cor }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: C.sub }}>{l}</span>
      <span style={{ color: cor || C.text, fontWeight: forte ? 700 : 500 }}>{v}</span>
    </div>
  );
}

// v505 — R$/peça de cada aplicação de faixa em cada tipo (consumo × R$/m), só para conferência
function TabelaFaixa({ aplic, tipos }) {
  const ap = aplic.filter((a) => !/^SEM\b/i.test(String(a.chave || "")));
  const cons = (a) => num(a.extra?.consumo);
  const mt = (t) => num(t.valor) + (/MONTADA/i.test(String(t.chave || "")) ? num(t.extra?.tactel) : 0);   // v506
  return (
    <div className="mb-2 rounded-lg overflow-x-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
      <div className="px-4 py-2 text-sm font-semibold" style={{ background: C.panel2, color: C.text }}>Faixa refletiva — R$/peça = consumo da aplicação × R$/m do tipo</div>
      <table className="w-full text-xs" data-sem-ordenar>
        <thead><tr style={{ color: C.sub }}><th className="px-3 py-1.5 text-left">Aplicação (consumo)</th>{tipos.map((t) => <th key={t.id} className="px-2 py-1.5 text-center">{t.rotulo || sc(t.chave)}<div className="font-normal">R$ {fmtNum(mt(t), 2)}/m{/MONTADA/i.test(String(t.chave || "")) ? ` (faixa ${fmtNum(t.valor, 2)} + tactel ${fmtNum(t.extra?.tactel, 2)})` : ""}</div></th>)}</tr></thead>
        <tbody>{ap.map((a) => (
          <tr key={a.id} style={{ borderTop: `1px solid ${C.line}` }}>
            <td className="px-3 py-1.5">{a.rotulo || sc(a.chave)} <span style={{ color: C.sub }}>({fmtNum(cons(a), 2)} m)</span></td>
            {tipos.map((t) => { const v = cons(a) * mt(t); return <td key={t.id} className="px-2 py-1.5 text-center font-semibold" style={{ color: v ? C.text : C.sub }}>{v ? `R$ ${fmtNum(v, 2)}` : "—"}</td>; })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
