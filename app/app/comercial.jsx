"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase, Calculator, Database, ExternalLink, Save, History, Lock, Unlock,
  Pencil, RotateCcw, ChevronDown, ChevronRight, X, FileText, Send, Search, Printer, SlidersHorizontal, Copy, ArrowLeft, Layers, Users, Shirt, Handshake, Plus,
} from "lucide-react";

/* Paleta Meridian (igual ao restante do sistema) */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "—");

const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL || "http://147.93.35.189:3001";

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
  const v = {
    corte: Number(pg("PECA", e.item, "corte")) || 0,
    silk: e.silk?.interno ? perTec(e.silk) : 0,
    bordado: e.bordado?.interno ? perTec(e.bordado) : 0,
    sublimacao: e.sublimacao?.interno ? perTec(e.sublimacao) : 0,
    costura: e.faccaoInterna ? num(e.faccao) : 0,
    acabamento: Number(tipo === "MALHA" ? pg("PECA", e.item, "exped") : pg("PECA", e.item, "acab")) || 0,
    logistica: cg("LOGISTICA_BASE"),
    consumo: cg("REEMBOLSO_CONSUMO"),
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
export default function Comercial({ user, master }) {
  const [view, setView] = useState(null); // null = landing (2 cards) | "fpp"

  if (view === "fpp") {
    return (
      <div>
        <div className="flex items-center gap-1 text-sm mb-4 flex-wrap">
          <button onClick={() => setView(null)} className="flex items-center gap-1 mr-2 px-2 py-1 rounded" style={{ color: C.accent }}><ArrowLeft size={15} /> Voltar</button>
          <button onClick={() => setView(null)} style={{ color: C.sub }}>Comercial</button>
          <ChevronRight size={13} style={{ color: C.sub }} />
          <span className="font-semibold" style={{ color: C.text }}>Orçamentação (FPP)</span>
        </div>
        <Fpp user={user} master={master} />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", maxWidth: 820 }}>
        {[
          ["fpp", Calculator, "Orçamentação (FPP)", "Fichas de precificação, negociações e propostas", () => setView("fpp")],
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
    mpValor: "", forroValor: "",
    gola: "", punho: "", elastico: "", faixa: "", botaoQtd: "",
    faccao: "", faccaoInterna: false,   // processo interno: o valor volta para a operação
    extrasAviamentos: [], extrasProducao: [],   // custos extras, já em R$ por peça: [{ desc, valor }]
    silk: personalizacaoVazia(), bordado: personalizacaoVazia(), sublimacao: personalizacaoVazia(),
    freteVolume: "", embExt: "", embInt: "SIMPLES",
    opInvest: "NAO", opTitulo: "NAO", condPagamento: "ANTECIPADO TOTAL", leadTime: "",
    valorProposto: "",
  };
}

function Fpp({ user, master }) {
  const [params, setParams] = useState(null);       // banco de dados (padrão)
  const [tipo, setTipo] = useState("MALHA");        // derivado da peça escolhida
  const [f, setF] = useState(() => fichaVazia("MALHA"));
  const [over, setOver] = useState({});             // overrides só desta precificação {caminho: valor}
  const [modoOverride, setModoOverride] = useState(false);
  const [paramsLocaisOpen, setParamsLocaisOpen] = useState(false);
  const [aba, setAba] = useState("ficha");          // ficha | banco
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
      ...((params.MALHA?.PECA) || []).map((p) => ({ chave: p.chave, tipo: "MALHA" })),
      ...((params.PLANO?.PECA) || []).map((p) => ({ chave: p.chave, tipo: "PLANO" })),
    ];
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
    const row = t.find((x) => x.chave === chave);
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

  const golas = params?.MALHA?.GOLA || [];
  const punhos = params?.MALHA?.PUNHO || [];
  const elasticos = params?.PLANO?.ELASTICO || [];
  const faixas = params?.[tipo]?.FAIXA || [];
  const embExts = params?.[tipo]?.EMB_EXT || [];
  const embInts = params?.COMUM?.EMB_INT || [];

  // ---------------- CÁLCULO (fiel à planilha) ----------------
  const r = useMemo(() => {
    if (!params) return null;
    const isMalha = tipo === "MALHA";
    const qt = Math.max(1, num(f.qtde));
    const rendCons = pget("PECA", f.item, "valor");           // rendimento(peças/kg) ou consumo(m/peça)
    const corte = pget("PECA", f.item, "corte");
    const prodPeca = isMalha ? pget("PECA", f.item, "exped") : pget("PECA", f.item, "acab");
    const volProp = pget("PECA", f.item, "volProp") || 1;
    const reembolso = cget("REEMBOLSO_CONSUMO");
    const linha = cget("LINHA_CUSTO");

    // Matéria-prima (inclui o custo de linha fixo)
    let mp = 0;
    if (isMalha) mp = (rendCons ? num(f.mpValor) / rendCons : 0) + reembolso;
    else mp = num(f.mpValor) * rendCons + reembolso;
    // Forro (plano)
    let forro = 0;
    if (!isMalha) forro = num(f.forroValor) * (cget("FORRO_FATOR") * rendCons);
    const materiaPrima = mp + forro + linha;

    // Aviamentos (sem a linha, que já entrou na matéria-prima)
    const golaOuElast = isMalha ? pget("GOLA", f.gola) : pget("ELASTICO", f.elastico);
    const punho = isMalha ? pget("PUNHO", f.punho) : 0;
    const faixa = pget("FAIXA", f.faixa);
    const botao = cget("BOTAO_UNIT") * num(f.botaoQtd);
    const extrasAv = somaExtras(f.extrasAviamentos);
    const aviamentos = golaOuElast + punho + faixa + botao + extrasAv;

    // Produção
    const extrasProd = somaExtras(f.extrasProducao);
    const producao = corte + prodPeca + num(f.faccao) + extrasProd;

    // Personalização (arte rateada ÷ qtde + posições por peça)
    const perTec = (p) => (num(p.arte) / qt) + POS.reduce((s, [k]) => s + num(p[k]), 0);
    const personalizacao = perTec(f.silk) + perTec(f.bordado) + perTec(f.sublimacao);

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

    const custoProducao = materiaPrima + aviamentos + producao + personalizacao + logistica + embalagem;

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
    const custoFinal = custoProducao + opFin + imposto * vp;
    const roic = custoFinal ? (vp - custoFinal) / custoFinal : 0;
    const margem = vp ? (vp - custoFinal) / vp : 0;
    const totalItem = vp * num(f.qtde);

    return { mp, forro, linha, materiaPrima, aviamentos, producao, personalizacao, logistica, embalagem, custoProducao, opFin, custoFinal, roic, margem, totalItem, volta, acabRotulo: isMalha ? "Expedição" : "Acabamento" };
  }, [params, tipo, f, over]);

  function montarBody() {
    return {
      tipo, item: f.item, nomeComercial: f.nomeComercial, clienteId: f.clienteId, clienteNome: f.clienteNome, qtde: num(f.qtde),
      negociacao: f.negociacao || null,
      condicaoPagamento: f.condPagamento, leadTime: num(f.leadTime),
      entradas: f, overrides: Object.keys(over).length ? over : null,
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

  function carregarFicha(fpp) {
    const e = fpp.entradas || {};
    setF({ ...fichaVazia(fpp.tipo || "MALHA"), ...e, clienteNome: fpp.clienteNome ?? e.clienteNome, clienteId: fpp.clienteId ?? e.clienteId,
      negociacao: fpp.negociacao ?? e.negociacao ?? e.pregao ?? "" });
    setTipo(fpp.tipo || tipoDaPeca(e.item) || "MALHA");
    setOver(fpp.overrides || {});
    setEditId(fpp.id); setEditNum(fpp.numero);
    setAba("ficha");
    setMsg(`Editando a FPP ${fmtFpp(fpp.numero)} ✓`);
  }
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
    } catch (e) { setMsg(e.message); alert(`Não foi possível clonar: ${e.message}`); }
    setSalvando(false);
  }
  async function clonarSalva(fpp) {
    try { const nova = await clonarFpp(fpp, user); carregarFicha(nova); carregarNegs(); setMsg(`Cópia criada: FPP ${fmtFpp(nova.numero)} ✓ — você está editando a cópia.`); }
    catch (e) { alert(`Não foi possível clonar: ${e.message}`); }
  }
  function novaFicha() { setF(fichaVazia(tipo)); setOver({}); setEditId(null); setEditNum(null); setMsg(""); }

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setP = (tec, k, v) => setF((s) => ({ ...s, [tec]: { ...s[tec], [k]: v } }));

  if (!params) return <div className="text-sm" style={{ color: C.sub }}>Carregando parâmetros…</div>;

  return (
    <div>
      {/* topo: abas ficha/banco (o tipo é definido pela peça) */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 flex-1" style={{ borderBottom: `1px solid ${C.line}` }}>
          {[["ficha", "Ficha", Calculator], ["banco", "Banco de dados", Database], ["salvas", "Salvas", Layers]].map(([k, t, Ico]) => (
            <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
              style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
              <Ico size={15} /> {t}
            </button>
          ))}
        </div>
        {aba === "ficha" && f.item && tipoDaPeca(f.item) && (
          <div className="flex items-center gap-2">
            {editId && <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{ background: C.yellowSoft, color: C.yellow, border: `1px solid ${C.yellow}55` }}>Editando FPP {fmtFpp(editNum)}</span>}
            {editId && <button onClick={novaFicha} className="text-xs px-2 py-1 rounded-md" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Nova ficha</button>}
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
              {tipo === "MALHA" ? "Malha · peças/kg" : "Plano · metros/peça"}
            </span>
          </div>
        )}
      </div>

      {aba === "banco" && <BancoParams params={params} master={master} user={user} onReload={() => fetch("/api/fpp/params").then((x) => x.json()).then(setParams)} />}

      {aba === "salvas" && <FichasSalvas master={master} onEditar={carregarFicha} onClonar={clonarSalva} />}

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
                <div className="flex items-center gap-2 pb-1 md:col-span-2 flex-wrap">
                  <Toggle on={modoOverride} onChange={(v) => { setModoOverride(v); if (!v) { setOver({}); setParamsLocaisOpen(false); } }} />
                  <span className="text-xs" style={{ color: C.sub }}>Parâmetros só desta ficha</span>
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

            <Card title="Matéria-prima">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Inp label={tipo === "MALHA" ? "Artigo (malha)" : "Artigo (tecido externo)"} value={f.nomeArtigo} onChange={(v) => set("nomeArtigo", v.toUpperCase())} text placeholder="Nome do artigo" />
                <Inp label={tipo === "MALHA" ? "Custo do tecido (R$/kg)" : "Custo do tecido (R$/m)"} value={f.mpValor} onChange={(v) => set("mpValor", v)} />
                <Ref label={tipo === "MALHA" ? "Rendimento (peças/kg)" : "Consumo (m/peça)"} grupo="PECA" chave={f.item} campo="valor" pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                {tipo === "PLANO" && <Inp label="Artigo (forro)" value={f.nomeArtigoForro} onChange={(v) => set("nomeArtigoForro", v.toUpperCase())} text placeholder="Nome do artigo do forro" />}
                {tipo === "PLANO" && <Inp label="Custo do forro (R$/m)" value={f.forroValor} onChange={(v) => set("forroValor", v)} />}
              </div>
            </Card>

            <Card title="Aviamentos">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {tipo === "MALHA" ? (
                  <>
                    <Combo label="Gola" value={f.gola} onChange={(v) => set("gola", v)} options={golas.map((g) => g.chave)} placeholder="Digite…" />
                    <Combo label="Punho" value={f.punho} onChange={(v) => set("punho", v)} options={punhos.map((g) => g.chave)} placeholder="Digite…" />
                  </>
                ) : (
                  <Combo label="Elástico" value={f.elastico} onChange={(v) => set("elastico", v)} options={elasticos.map((g) => g.chave)} placeholder="Digite…" />
                )}
                <Combo label="Faixa refletiva" value={f.faixa} onChange={(v) => set("faixa", v)} options={faixas.map((g) => g.chave)} placeholder="Digite…" />
                <Inp label="Qtde de botões" value={f.botaoQtd} onChange={(v) => set("botaoQtd", v)} />
              </div>
              <ExtrasCustos lista={f.extrasAviamentos} onChange={(l) => set("extrasAviamentos", l)} />
            </Card>

            <Card title="Produção">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Ref label="Corte" grupo="PECA" chave={f.item} campo="corte" pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                <Ref label={tipo === "MALHA" ? "Expedição" : "Acabamento"} grupo="PECA" chave={f.item} campo={tipo === "MALHA" ? "exped" : "acab"} pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                <div>
                  <Inp label="Facção (R$/peça)" value={f.faccao} onChange={(v) => set("faccao", v)} />
                  <div className="flex items-center gap-1.5 mt-1 text-[11px]" style={{ color: f.faccaoInterna ? C.accent : C.sub }}>
                    <Toggle on={!!f.faccaoInterna} onChange={(v) => set("faccaoInterna", v)} /> Processo interno
                  </div>
                </div>
              </div>
              <ExtrasCustos lista={f.extrasProducao} onChange={(l) => set("extrasProducao", l)} />
            </Card>

            <Card title="Personalização">
              {[["silk", "Silk / DTF / DTG"], ["bordado", "Bordado / Patch"], ["sublimacao", "Sublimação"]].map(([tec, lbl]) => (
                <div key={tec} className="mb-3">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="text-xs font-semibold" style={{ color: C.text }}>{lbl}</div>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: f[tec].interno ? C.accent : C.sub }}>
                      <Toggle on={!!f[tec].interno} onChange={(v) => setP(tec, "interno", v)} /> Processo interno
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    <Inp label="Arte (total)" value={f[tec].arte} onChange={(v) => setP(tec, "arte", v)} />
                    {POS.map(([k, l]) => <Inp key={k} label={l} value={f[tec][k]} onChange={(v) => setP(tec, k, v)} />)}
                  </div>
                </div>
              ))}
            </Card>

            <Card title="Logística e embalagem">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Inp label="Frete por volume (R$)" value={f.freteVolume} onChange={(v) => set("freteVolume", v)} />
                <Combo label="Embalagem externa" value={f.embExt} onChange={(v) => set("embExt", v)} options={embExts.map((g) => g.chave)} placeholder="Digite…" />
                <Combo label="Embalagem interna" value={f.embInt} onChange={(v) => set("embInt", v)} options={embInts.map((g) => g.chave)} placeholder="Digite…" />
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>Frete e embalagem são sempre externos — não voltam para a operação. Só a logística base volta.</div>
            </Card>

            <Card title="Operação financeira">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-end gap-2 pb-1">
                  <Toggle on={f.opInvest === "SIM"} onChange={(v) => set("opInvest", v ? "SIM" : "NAO")} />
                  <span className="text-xs" style={{ color: C.sub }}>Op. investimento</span>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Toggle on={f.opTitulo === "SIM"} onChange={(v) => set("opTitulo", v ? "SIM" : "NAO")} />
                  <span className="text-xs" style={{ color: C.sub }}>Op. título</span>
                </div>
                <Combo label="Condição de pagamento" value={f.condPagamento} onChange={(v) => set("condPagamento", v)} options={COND_LISTA} placeholder="Digite…" />
                <Inp label="Valor proposto (R$)" value={f.valorProposto} onChange={(v) => set("valorProposto", v)} destaque />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <Inp label="Lead time (dias)" value={f.leadTime} onChange={(v) => set("leadTime", v)} />
              </div>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>
                Investimento: juros sobre o custo durante todo o lead time. Título: juros por parcela em boleto (prazo + 2 dias úteis), conforme a condição de pagamento.
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
                  <Lin l="Matéria-prima" v={brl(r.materiaPrima)} />
                  <Lin l="Aviamentos" v={brl(r.aviamentos)} />
                  <Lin l="Produção" v={brl(r.producao)} />
                  <Lin l="Personalização" v={brl(r.personalizacao)} />
                  <Lin l="Logística" v={brl(r.logistica)} />
                  <Lin l="Embalagem" v={brl(r.embalagem)} />
                  <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
                  <Lin l="Custo de produção" v={brl(r.custoProducao)} forte />
                  <Lin l="Operação financeira" v={brl(r.opFin)} />
                  <Lin l="Custo final" v={brl(r.custoFinal)} forte />
                  <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
                  <Lin l="ROIC" v={pct(r.roic)} cor={r.roic >= 0.3 ? C.green : r.roic >= 0.16 ? C.yellow : "#E5484D"} />
                  {(() => {
                    const m = r.margem;
                    const cor = m >= 0.4 ? C.green : m >= 0.3 ? C.green : m >= 0.16 ? C.yellow : "#E5484D";
                    const soft = m >= 0.3 ? C.greenSoft : m >= 0.16 ? "#FEF6E7" : "#FDECEC";
                    return (
                      <div className="rounded-md px-3 py-2 my-1 flex items-center justify-between" style={{ background: soft, border: `1px solid ${cor}` }}>
                        <span className="text-xs font-bold tracking-wide" style={{ color: cor }}>MARGEM DE CONTRIBUIÇÃO</span>
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
        <div className="text-xs font-bold uppercase mb-1" style={{ color: C.sub }}>{titulo}</div>
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
            {!isMalha && f.elastico && <Campo label={`Elástico · ${f.elastico}`} path={`ELASTICO:${f.elastico}:valor`} base={rawGrp("ELASTICO", f.elastico)} />}
            {f.faixa && f.faixa !== "SEM FAIXA" && <Campo label={`Faixa · ${f.faixa}`} path={`FAIXA:${f.faixa}:valor`} base={rawGrp("FAIXA", f.faixa)} />}
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
    GOLA: "Golas", PUNHO: "Punhos", ELASTICO: "Elásticos", FAIXA: "Faixas refletivas",
    EMB_EXT: "Embalagens externas (valor, und/emb, fita)", CONST: "Constantes do cálculo",
  };
  const ordem = ["PECA", "GOLA", "PUNHO", "ELASTICO", "FAIXA", "EMB_EXT", "CONST"];
  return (
    <div>
      <div className="flex items-center gap-3 mb-3 p-3 rounded-xl" style={{ background: os ? C.accentSoft : C.panel2, border: `1px solid ${os ? C.accent : C.line}` }}>
        {os ? <Unlock size={16} style={{ color: C.accent }} /> : <Lock size={16} style={{ color: C.sub }} />}
        <div className="flex-1">
          <div className="text-sm font-bold" style={{ color: C.navy }}>ATUALIZAÇÃO DE PARÂMETROS GERAIS</div>
          <div className="text-xs" style={{ color: C.sub }}>Desligado, o banco de dados fica imutável. Ligado, você redefine o padrão para todas as FPPs daqui em diante — cada alteração fica no histórico com data.</div>
        </div>
        {master ? <Toggle on={os} onChange={setOs} /> : <span className="text-xs" style={{ color: C.sub }}>Só o financeiro edita</span>}
      </div>

      <div className="flex gap-2 mb-3">
        {["MALHA", "PLANO"].map((t) => (
          <button key={t} onClick={() => setTipo(t)} className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: tipo === t ? C.navy : C.panel, color: tipo === t ? "#fff" : C.sub, border: `1px solid ${tipo === t ? C.navy : C.line}` }}>{t}</button>
        ))}
      </div>

      {ordem.filter((g) => grupos[g]).map((g) => (
        <GrupoParam key={g} grupo={g} rotulo={rotulos[g] || g} linhas={grupos[g]} os={os} user={user} onReload={onReload} />
      ))}
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
  const validos = campos.filter(([k]) => k === "valor" ? true : (row.extra && row.extra[k] != null));
  const [ed, setEd] = useState(() => { const o = {}; validos.forEach(([k]) => { o[k] = k === "valor" ? row.valor : row.extra[k]; }); return o; });
  const [saving, setSaving] = useState(false);
  const mudou = validos.some(([k]) => num(ed[k]) !== Number(k === "valor" ? row.valor : row.extra[k]));

  async function salvarPadrao() {
    if (!os || !mudou) return;
    if (!confirm(`Redefinir o padrão de "${row.rotulo || row.chave}"? Fica no histórico.`)) return;
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
      <div className="text-sm flex-1 min-w-[180px]" style={{ color: C.text }}>{row.rotulo || row.chave}</div>
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

  sec("Matéria-prima");
  if (isMalha) row("Artigo (malha)", e.nomeArtigo || "—");
  else { row("Artigo (tecido externo)", e.nomeArtigo || "—"); row("Artigo (forro)", e.nomeArtigoForro || "—"); }
  row(isMalha ? "Custo do tecido (R$/kg)" : "Custo do tecido (R$/m)", e.mpValor || "—");
  if (!isMalha) row("Custo do forro (R$/m)", e.forroValor || "—");
  y += 2;

  sec("Aviamentos e produção");
  if (isMalha) { row("Gola", e.gola || "—"); row("Punho", e.punho || "—"); } else row("Elástico", e.elastico || "—");
  row("Faixa refletiva", e.faixa || "—");
  row("Qtde de botões", e.botaoQtd || "—");
  row("Facção (R$/peça)", e.faccao || "—");
  for (const [rot, l] of [["Extra aviamento", e.extrasAviamentos], ["Extra produção", e.extrasProducao]])
    for (const x of (Array.isArray(l) ? l : []).filter((x) => num(x.valor))) row(`${rot}: ${String(x.desc || "SEM DESCRIÇÃO").toUpperCase()} (R$/peça)`, String(x.valor));
  const POS2 = [["peitoD", "Peito D"], ["peitoE", "Peito E"], ["mangaD", "Manga D"], ["mangaE", "Manga E"], ["costas", "Costas"]];
  const pp = [];
  for (const [tec, lbl] of [["silk", "Silk/DTF"], ["bordado", "Bordado"], ["sublimacao", "Sublimação"]]) {
    const p = e[tec] || {}; const pos = POS2.filter(([k]) => Number(p[k]) > 0).map(([, l]) => l);
    if (pos.length || Number(p.arte) > 0) pp.push(`${lbl}${pos.length ? " (" + pos.join(", ") + ")" : ""}`);
  }
  row("Personalização", pp.join(" · ") || "—");
  y += 2;

  if (master) {
    sec("Composição de custo");
    row("Matéria-prima", brlp(r.materiaPrima));
    row("Aviamentos", brlp(r.aviamentos));
    row("Produção", brlp(r.producao));
    row("Personalização", brlp(r.personalizacao));
    row("Logística", brlp(r.logistica));
    row("Embalagem", brlp(r.embalagem));
    row("Custo de produção", brlp(r.custoProducao), { forte: true });
    row("Operação financeira", brlp(r.opFin));
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
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor || C.navy }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}
const guiaFpp = (k) => GUIAS_FPP.find((g) => g.k === k);

function FichasSalvas({ master, onEditar, onClonar }) {
  const [lista, setLista] = useState(null);
  const [, setPv] = useState(0);
  useEffect(() => { fetch("/api/fpp/params").then((r) => r.json()).then((p) => { PARAMS_VOLTA = p; setPv((x) => x + 1); }).catch(() => {}); }, []);
  const [sort, setSort] = useState({ campo: "createdAt", dir: "desc" });
  const [guia, setGuia] = useState("todas");
  const [filtro, setFiltro] = useState(null);          // { guia, valor } — card aberto
  const [clonando, setClonando] = useState(null);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [aberta, setAberta] = useState(null);
  const [proposta, setProposta] = useState(null);
  const [imprimindo, setImprimindo] = useState(false);

  function carregar() { fetch("/api/fpp").then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => setLista([])); }
  useEffect(carregar, []);

  async function excluir(id) {
    if (!confirm("Excluir esta ficha?")) return;
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
    if (nomes.length > 1) { alert("Selecione FPPs de um mesmo cliente para gerar a proposta."); return; }
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
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm" style={{ color: C.sub }}>
          {filtro ? (
            <button onClick={() => setFiltro(null)} className="flex items-center gap-1" style={{ color: C.accent }}>
              <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Voltar · {guiaFpp(filtro.guia).label}: <b>{filtro.valor}</b> · {dados.length} ficha(s)
            </button>
          ) : null}
          {filtro && dados.length > 0 ? (
            <button onClick={() => setProposta(dados)} className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
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
        return (
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <KpiFpp rotulo="FPPs" valor={nPt(t.n)} sub={filtro ? filtro.valor : "todas as salvas"} />
            <KpiFpp rotulo="Peças" valor={nPt(t.pecas)} />
            {master && <KpiFpp rotulo="Valor total" valor={brl(t.valor)} sub={`preço médio ${brl(t.precoMedio)}/peça`} />}
            {master && <KpiFpp rotulo="CMV total" valor={brl(t.cmv)} sub={`${pct(t.cmvPct)} do valor · sem imposto`} />}
            {master && <KpiFpp rotulo="Margem de contribuição" valor={<>{brl(t.mc)} <span className="text-sm">· {pct(t.mcPct)}</span></>} cor={corMc(t.mcPct)} />}
            {master && <KpiFpp rotulo="MC média por peça" valor={<>{brl(t.mcPeca)} <span className="text-sm">· {pct(t.mcPecaPct)}</span></>} cor={corMc(t.mcPecaPct)} />}
            {master && (
              <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>Volta para a operação</div>
                <div className="text-xl font-bold mt-1" style={{ color: C.accent }}>{brl(t.volta.total)}</div>
                <div className="text-xs mb-1" style={{ color: C.sub }}>{t.pecas ? `${brl(t.volta.total / t.pecas)}/peça` : ""}</div>
                {AREAS_VOLTA.filter(([k]) => t.volta[k] > 0).map(([k, l]) => (
                  <div key={k} className="flex justify-between gap-2 text-[11px]" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 2 }}>
                    <span style={{ color: C.sub }}>{l.replace("Personalização · ", "Pers. ").replace(" (reembolso de consumo)", "")}</span><b style={{ color: C.navy }}>{brl(t.volta[k])}</b>
                  </div>
                ))}
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
              {master && (
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
              <tr key={f.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-2 py-2"><input type="checkbox" checked={sel.has(f.id)} onChange={() => toggle(f.id)} /></td>
                {cols.map((c) => {
                  let v = f[c.k];
                  if (c.k === "createdAt") v = new Date(v).toLocaleDateString("pt-BR");
                  else if (c.k === "numero") return <td key={c.k} className="px-3 py-2 font-bold tabular-nums whitespace-nowrap" style={{ color: C.navy, cursor: "pointer" }} onClick={() => onEditar && onEditar(f)}>{fmtFpp(v)}</td>;
                  else if (c.k === "totalItem") return <td key={c.k} className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: C.navy, cursor: "pointer" }} onClick={() => onEditar && onEditar(f)}>{brl(valorFpp(f))}</td>;
                  else if (c.k === "valorProposto") v = v != null ? brl(v) : "—";
                  else if (c.k === "margem") v = v != null ? pct(v) : "—";
                  else v = v ?? "—";
                  if (c.cliente) return <td key={c.k} className="px-3 py-2"><button onClick={() => { setGuia("cliente"); setFiltro({ guia: "cliente", valor: guiaFpp("cliente").chave(f) }); }} className="font-medium" style={{ color: C.accent }}>{v}</button></td>;
                  return <td key={c.k} className={"px-3 py-2 " + (c.right ? "text-right" : "")} style={{ color: c.k === "item" ? C.text : C.sub, cursor: "pointer" }} onClick={() => onEditar && onEditar(f)}>{v}</td>;
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
          <div className="text-sm font-bold" style={{ color: C.navy }}>{f.numero ? `FPP ${fmtFpp(f.numero)} · ` : ""}{f.nomeComercial || f.item}{f.negociacao ? ` · ${f.negociacao}` : ""}</div>
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
  if (e.faixa && e.faixa !== "SEM FAIXA") parts.push(e.faixa);
  for (const [tec, lbl] of [["silk", "SILK"], ["bordado", "BORDADO"], ["sublimacao", "SUBLIMAÇÃO"]]) {
    const p = e[tec] || {};
    const pos = POS.filter(([k]) => Number(p[k]) > 0).map(([, l]) => l);
    if (pos.length) parts.push(`${lbl} ${pos.join(" / ")}`);
  }
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
    setRes(r.ok ? { ok: true, url: d.url } : { erro: d.error || "Falha ao enviar." });
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
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>Proposta · {cliente} · {fichas.length} item(ns)</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-md p-2" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex gap-2 items-center">
                  <input value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} className="flex-1 px-2 py-1 rounded text-sm font-medium" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
                  <span className="text-xs whitespace-nowrap" style={{ color: C.sub }}>{fmtFpp(fichas[i]?.numero)} · {nPt(it.qty)} ×</span>
                  <span className="text-sm font-medium whitespace-nowrap" style={{ color: C.text }}>{brl((it.unit_price_cents || 0) / 100)}</span>
                  <span className="text-sm font-bold whitespace-nowrap" style={{ color: C.navy }}>= {brl(((it.unit_price_cents || 0) * (Number(it.qty) || 0)) / 100)}</span>
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
            Proposta criada no CRM ✓ {res.url && <a href={res.url} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "underline" }}>abrir no CRM</a>}
          </div>}
          {res?.erro && <div className="text-xs mt-2 text-right" style={{ color: "#E5484D" }}>{res.erro}</div>}
          {meta?.error && <div className="text-xs mt-1 text-right" style={{ color: C.sub }}>CRM indisponível — só PDF disponível.</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- pequenos componentes ---------- */
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
function ExtrasCustos({ lista, onChange }) {
  const l = Array.isArray(lista) ? lista : [];
  const alt = (i, k, v) => onChange(l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="mt-3">
      {l.length > 0 && (
        <div className="space-y-2 mb-2">
          <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: "1fr 160px 28px", color: C.sub }}>
            <span>Custo extra (descrição)</span><span>Valor (R$ por peça)</span><span />
          </div>
          {l.map((x, i) => (
            <div key={i} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 160px 28px" }}>
              <input value={x.desc || ""} onChange={(e) => alt(i, "desc", e.target.value.toUpperCase())} placeholder="Ex.: ZÍPER, ETIQUETA, LAVAGEM…"
                className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
              <input value={x.valor ?? ""} onChange={(e) => alt(i, "valor", e.target.value)} inputMode="decimal" placeholder="0,00 por peça"
                className="w-full px-2 py-1.5 rounded text-sm text-right" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
              <button onClick={() => onChange(l.filter((_, j) => j !== i))} title="Remover" className="p-1 rounded" style={{ color: C.red }}><X size={15} /></button>
            </div>
          ))}
          <div className="text-xs text-right" style={{ color: C.sub }}>Extras: <b style={{ color: C.navy }}>{brl(somaExtras(l))}</b> por peça</div>
        </div>
      )}
      <button onClick={() => onChange([...l, { desc: "", valor: "" }])} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}>
        <Plus size={14} /> Adicionar custo extra (R$ por peça)
      </button>
    </div>
  );
}
function Inp({ label, value, onChange, destaque, text, placeholder }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode={text ? "text" : "decimal"} placeholder={placeholder || ""}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${destaque ? C.accent : C.line}`, color: C.text }} />
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
      <input value={q} placeholder={placeholder} onChange={(e) => digitar(e.target.value)} onKeyDown={onKey}
        onFocus={abrir} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${open ? C.accent : C.line}`, color: C.text }} />
      {open && lista.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((o, idx) => (
            <button key={o} tabIndex={-1} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => { e.preventDefault(); confirmar(o); }}
              className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text, background: idx === hi ? C.accentSoft : "#fff" }}>{o}</button>
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
      <input value={q} placeholder="Buscar cliente…" onChange={(e) => digitar(e.target.value)} onKeyDown={onKey}
        onFocus={() => { setSeed(q || ""); setHi(0); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${open ? C.accent : C.line}`, color: C.text }} />
      {open && (q || "").trim() !== "" && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((c, idx) => (
            <button key={c.id} tabIndex={-1} onMouseEnter={() => setHi(idx)} onMouseDown={(e) => { e.preventDefault(); confirmar(c); }}
              className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text, background: idx === hi ? C.accentSoft : "#fff" }}>{nome(c)}</button>
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
function Ref({ label, grupo, chave, campo, pget, over, setOver, modo }) {
  const path = `${grupo}:${chave}:${campo}`;
  const base = pget(grupo, chave, campo);
  const val = over[path] != null && over[path] !== "" ? over[path] : "";
  return (
    <div>
      <div className="text-xs mb-1 flex items-center gap-1" style={{ color: C.sub }}>{label}{modo && <Pencil size={11} />}</div>
      {modo ? (
        <input value={val} placeholder={String(base)} onChange={(e) => setOver((s) => ({ ...s, [path]: e.target.value }))} inputMode="decimal"
          className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px dashed ${C.accent}`, color: C.text }} />
      ) : (
        <div className="px-2 py-1.5 rounded text-sm" style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>{base || "—"}</div>
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
