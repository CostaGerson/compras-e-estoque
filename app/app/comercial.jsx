"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase, Calculator, Database, ExternalLink, Save, History, Lock, Unlock,
  Pencil, RotateCcw, ChevronDown, ChevronRight, X, FileText, Send, Search,
} from "lucide-react";

/* Paleta Meridian (igual ao restante do sistema) */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", yellow: "#C08401",
};

const CRM_URL = process.env.NEXT_PUBLIC_CRM_URL || "http://147.93.35.189:3001";

const brl = (n) => "R$ " + (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; };

/* ============================================================ */
export default function Comercial({ user, master }) {
  const [view, setView] = useState(null); // null = landing (2 cards) | "fpp"

  if (view === "fpp") {
    return (
      <div>
        <button onClick={() => setView(null)} className="flex items-center gap-1 mb-4 text-sm font-medium" style={{ color: C.accent }}>
          <ChevronRight size={15} style={{ transform: "rotate(180deg)" }} /> Comercial
        </button>
        <Fpp user={user} master={master} />
      </div>
    );
  }

  const Card = ({ icon: Ico, titulo, sub, onClick, badge }) => (
    <button onClick={onClick} className="flex-1 text-left rounded-2xl p-6 transition-shadow hover:shadow-lg"
      style={{ background: C.panel, border: `1px solid ${C.line}`, minHeight: 180 }}>
      <div className="flex items-center justify-center rounded-xl mb-4" style={{ width: 56, height: 56, background: C.accentSoft }}>
        <Ico size={28} style={{ color: C.accent }} />
      </div>
      <div className="text-lg font-bold flex items-center gap-2" style={{ color: C.text }}>{titulo}{badge}</div>
      <div className="text-sm mt-1" style={{ color: C.sub }}>{sub}</div>
    </button>
  );

  return (
    <div>
      <div className="text-sm mb-4" style={{ color: C.sub }}>Escolha uma área do comercial:</div>
      <div className="flex flex-col md:flex-row gap-4 max-w-3xl">
        <Card icon={Calculator} titulo="Orçamentação (FPP)" sub="Criar e gerenciar fichas de precificação e propostas" onClick={() => setView("fpp")} />
        <Card icon={Briefcase} titulo="CRM"
          sub="Abrir o CRM Meridian em uma nova aba"
          onClick={() => window.open(CRM_URL, "_blank", "noopener")}
          badge={<ExternalLink size={16} style={{ color: C.sub }} />} />
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

function personalizacaoVazia() { return { arte: "", peitoD: "", peitoE: "", mangaD: "", mangaE: "", costas: "" }; }
function fichaVazia(tipo) {
  return {
    tipo, item: "", nomeComercial: "", clienteNome: "", clienteId: null, qtde: "",
    negociacao: "",
    mpValor: "", forroValor: "",
    gola: "", punho: "", elastico: "", faixa: "", botaoQtd: "",
    faccao: "",
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
  const [aba, setAba] = useState("ficha");          // ficha | banco
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [clientes, setClientes] = useState([]);

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
    const aviamentos = golaOuElast + punho + faixa + botao;

    // Produção
    const producao = corte + prodPeca + num(f.faccao);

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

    return { mp, forro, linha, materiaPrima, aviamentos, producao, personalizacao, logistica, embalagem, custoProducao, opFin, custoFinal, roic, margem, totalItem };
  }, [params, tipo, f, over]);

  async function salvar() {
    if (!f.item) return setMsg("Selecione o ITEM.");
    setSalvando(true); setMsg("");
    const body = {
      tipo, item: f.item, nomeComercial: f.nomeComercial, clienteId: f.clienteId, clienteNome: f.clienteNome, qtde: num(f.qtde),
      negociacao: f.negociacao || null,
      condicaoPagamento: f.condPagamento, leadTime: num(f.leadTime),
      entradas: f, overrides: Object.keys(over).length ? over : null,
      resultados: r,
      custoProducao: r?.custoProducao, custoFinal: r?.custoFinal, valorProposto: num(f.valorProposto),
      margem: r?.margem, totalItem: r?.totalItem,
      criadoPorId: user?.id, criadoPorNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim(),
    };
    const url = editId ? `/api/fpp/${editId}` : "/api/fpp";
    const res = await fetch(url, { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSalvando(false);
    setMsg(res.ok ? (editId ? "Ficha atualizada ✓" : "Ficha salva ✓") : "Erro ao salvar.");
  }

  function carregarFicha(fpp) {
    const e = fpp.entradas || {};
    setF({ ...fichaVazia(fpp.tipo || "MALHA"), ...e, clienteNome: fpp.clienteNome ?? e.clienteNome, clienteId: fpp.clienteId ?? e.clienteId,
      negociacao: fpp.negociacao ?? e.negociacao ?? e.pregao ?? "" });
    setTipo(fpp.tipo || tipoDaPeca(e.item) || "MALHA");
    setOver(fpp.overrides || {});
    setEditId(fpp.id);
    setAba("ficha");
    setMsg("Editando ficha salva.");
  }
  function novaFicha() { setF(fichaVazia(tipo)); setOver({}); setEditId(null); setMsg(""); }

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setP = (tec, k, v) => setF((s) => ({ ...s, [tec]: { ...s[tec], [k]: v } }));

  if (!params) return <div className="text-sm" style={{ color: C.sub }}>Carregando parâmetros…</div>;

  return (
    <div>
      {/* topo: abas ficha/banco (o tipo é definido pela peça) */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2">
          <button onClick={() => setAba("ficha")} className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: aba === "ficha" ? C.accent : C.panel, color: aba === "ficha" ? "#fff" : C.sub, border: `1px solid ${aba === "ficha" ? C.accent : C.line}` }}>Ficha</button>
          <button onClick={() => setAba("banco")} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: aba === "banco" ? C.accent : C.panel, color: aba === "banco" ? "#fff" : C.sub, border: `1px solid ${aba === "banco" ? C.accent : C.line}` }}>
            <Database size={14} /> Banco de dados
          </button>
          <button onClick={() => setAba("salvas")} className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: aba === "salvas" ? C.accent : C.panel, color: aba === "salvas" ? "#fff" : C.sub, border: `1px solid ${aba === "salvas" ? C.accent : C.line}` }}>Salvas</button>
        </div>
        {aba === "ficha" && f.item && tipoDaPeca(f.item) && (
          <div className="flex items-center gap-2">
            {editId && <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "#FEF0C7", color: C.yellow, border: `1px solid ${C.yellow}` }}>Editando #{editId}</span>}
            {editId && <button onClick={novaFicha} className="text-xs px-2 py-1 rounded-md" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Nova ficha</button>}
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
              {tipo === "MALHA" ? "Malha · peças/kg" : "Plano · metros/peça"}
            </span>
          </div>
        )}
      </div>

      {aba === "banco" && <BancoParams params={params} master={master} user={user} onReload={() => fetch("/api/fpp/params").then((x) => x.json()).then(setParams)} />}

      {aba === "salvas" && <FichasSalvas master={master} onEditar={carregarFicha} />}

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
                <Inp label="Negociação" value={f.negociacao} onChange={(v) => set("negociacao", v.toUpperCase())} placeholder="Ex.: PE 045/2026 · BID 12 · DIRETA" />
                <div className="flex items-end gap-2 pb-1 md:col-span-2">
                  <Toggle on={modoOverride} onChange={(v) => { setModoOverride(v); if (!v) setOver({}); }} />
                  <span className="text-xs" style={{ color: C.sub }}>Alterar valores só nesta ficha</span>
                </div>
              </div>
            </Card>

            <Card title="Matéria-prima">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Inp label={tipo === "MALHA" ? "Custo do tecido (R$/kg)" : "Custo do tecido (R$/m)"} value={f.mpValor} onChange={(v) => set("mpValor", v)} />
                <Ref label={tipo === "MALHA" ? "Rendimento (peças/kg)" : "Consumo (m/peça)"} grupo="PECA" chave={f.item} campo="valor" pget={pget} over={over} setOver={setOver} modo={modoOverride} />
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
            </Card>

            <Card title="Produção">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Ref label="Corte" grupo="PECA" chave={f.item} campo="corte" pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                <Ref label={tipo === "MALHA" ? "Expedição" : "Acabamento"} grupo="PECA" chave={f.item} campo={tipo === "MALHA" ? "exped" : "acab"} pget={pget} over={over} setOver={setOver} modo={modoOverride} />
                <Inp label="Facção (R$/peça)" value={f.faccao} onChange={(v) => set("faccao", v)} />
              </div>
            </Card>

            <Card title="Personalização">
              {[["silk", "Silk / DTF / DTG"], ["bordado", "Bordado / Patch"], ["sublimacao", "Sublimação"]].map(([tec, lbl]) => (
                <div key={tec} className="mb-3">
                  <div className="text-xs font-semibold mb-1" style={{ color: C.text }}>{lbl}</div>
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
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, position: "sticky", top: 0 }} className="rounded-lg p-4">
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
              {msg && <div className="text-xs mt-2 text-center" style={{ color: msg.includes("✓") ? C.green : "#E5484D" }}>{msg}</div>}
            </div>
          </div>
        </div>
      )}
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
      <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{ background: os ? C.accentSoft : C.panel2, border: `1px solid ${os ? C.accent : C.line}` }}>
        {os ? <Unlock size={16} style={{ color: C.accent }} /> : <Lock size={16} style={{ color: C.sub }} />}
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: C.text }}>OPEN SOURCE</div>
          <div className="text-xs" style={{ color: C.sub }}>Desligado, o banco de dados fica imutável. Ligado, você pode redefinir o padrão — cada alteração fica no histórico com data.</div>
        </div>
        {master ? <Toggle on={os} onChange={setOs} /> : <span className="text-xs" style={{ color: C.sub }}>Só o financeiro edita</span>}
      </div>

      <div className="flex gap-2 mb-3">
        {["MALHA", "PLANO"].map((t) => (
          <button key={t} onClick={() => setTipo(t)} className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{ background: tipo === t ? C.text : C.panel, color: tipo === t ? "#fff" : C.sub, border: `1px solid ${tipo === t ? C.text : C.line}` }}>{t}</button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
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

/* ---------- Fichas salvas ---------- */
const COLS = [
  { k: "item", label: "Item", tipo: "txt" },
  { k: "nomeComercial", label: "Nome comercial", tipo: "txt" },
  { k: "clienteNome", label: "Cliente", tipo: "txt", cliente: true },
  { k: "negociacao", label: "Negociação", tipo: "txt" },
  { k: "qtde", label: "Qtde", tipo: "num", right: true },
  { k: "valorProposto", label: "Valor prop.", tipo: "num", right: true, master: true },
  { k: "margem", label: "Margem", tipo: "num", right: true, master: true },
  { k: "createdAt", label: "Data", tipo: "data" },
];

function FichasSalvas({ master, onEditar }) {
  const [lista, setLista] = useState(null);
  const [sort, setSort] = useState({ campo: "createdAt", dir: "desc" });
  const [filtroCliente, setFiltroCliente] = useState(null);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [aberta, setAberta] = useState(null);
  const [proposta, setProposta] = useState(null);

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

  let dados = filtroCliente ? lista.filter((f) => (f.clienteNome || "—") === filtroCliente) : lista;
  const q = busca.trim().toLowerCase();
  if (q) {
    dados = dados.filter((f) => {
      const alvo = [
        f.item, f.nomeComercial, f.clienteNome, f.negociacao, f.qtde,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm" style={{ color: C.sub }}>
          {filtroCliente ? (
            <button onClick={() => setFiltroCliente(null)} className="flex items-center gap-1" style={{ color: C.accent }}>
              <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Voltar · Cliente: <b>{filtroCliente}</b>
            </button>
          ) : `${q ? dados.length + " de " : ""}${lista.length} ficha(s)`}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} style={{ color: C.sub, position: "absolute", left: 8, top: 9 }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar em todas as FPPs…"
              className="pl-7 pr-2 py-1.5 rounded-md text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text, width: 240 }} />
          </div>
          {selecionadas.length > 0 && (
            <button onClick={gerarPropostaSelecionadas} className="px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
              Gerar proposta ({selecionadas.length})
            </button>
          )}
        </div>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.panel2, color: C.sub }} className="text-left">
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
                  else if (c.k === "valorProposto") v = v != null ? brl(v) : "—";
                  else if (c.k === "margem") v = v != null ? pct(v) : "—";
                  else v = v ?? "—";
                  if (c.cliente) return <td key={c.k} className="px-3 py-2"><button onClick={() => setFiltroCliente(f.clienteNome || "—")} className="font-medium" style={{ color: C.accent }}>{v}</button></td>;
                  return <td key={c.k} className={"px-3 py-2 " + (c.right ? "text-right" : "")} style={{ color: c.k === "item" ? C.text : C.sub, cursor: "pointer" }} onClick={() => onEditar && onEditar(f)}>{v}</td>;
                })}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setProposta([f])} title="Gerar proposta" className="p-1 rounded mr-1" style={{ color: C.accent }}><FileText size={15} /></button>
                  <button onClick={() => excluir(f.id)} title="Excluir" className="p-1 rounded" style={{ color: "#E5484D" }}><X size={15} /></button>
                </td>
              </tr>
            ))}
            {dados.length === 0 && <tr><td colSpan={cols.length + 2} className="px-3 py-4 text-center" style={{ color: C.sub }}>Nenhuma ficha.</td></tr>}
          </tbody>
        </table>
      </div>

      {aberta && <FichaDetalhe f={aberta} master={master} onClose={() => setAberta(null)} onProposta={() => { setProposta([aberta]); setAberta(null); }} />}
      {proposta && <ProposalModal fichas={proposta} onClose={() => setProposta(null)} />}
    </div>
  );
}

function FichaDetalhe({ f, master, onClose, onProposta }) {
  const r = f.resultados || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold" style={{ color: C.text }}>{f.nomeComercial || f.item}{f.negociacao ? ` · ${f.negociacao}` : ""}</div>
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
          <button onClick={onProposta} className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
            <FileText size={15} /> Gerar proposta
          </button>
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

function ProposalModal({ fichas, onClose }) {
  const cliente = fichas[0]?.clienteNome || "—";
  const totalGeral = fichas.reduce((s, f) => s + (f.totalItem || (f.valorProposto || 0) * (f.qtde || 0)), 0);
  const hoje = new Date().toLocaleDateString("pt-BR");
  const condicoes = [...new Set(fichas.map((f) => f.condicaoPagamento).filter(Boolean))].join(" | ");

  const [meta, setMeta] = useState(null);
  const [ownerId, setOwnerId] = useState("");
  const [stage, setStage] = useState("proposta");
  const [titulo, setTitulo] = useState(`Proposta ${cliente} · ${hoje}`);
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

  async function enviarCrm() {
    if (!ownerId) { setRes({ erro: "Selecione o dono da proposta." }); return; }
    setEnviando(true); setRes(null);
    const r = await fetch("/api/crm/proposta", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteNome: cliente, ownerId, stage, title: titulo, paymentTerms: condicoes, items }),
    });
    const d = await r.json(); setEnviando(false);
    setRes(r.ok ? { ok: true, url: d.url } : { erro: d.error || "Falha ao enviar." });
  }

  function imprimir() {
    const linhas = fichas.map((f, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${f.nomeComercial || f.item}</td>
        <td style="text-align:center">${f.qtde ?? "—"}</td>
        <td style="text-align:right">${(f.valorProposto || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        <td style="text-align:right">${((f.totalItem) || (f.valorProposto || 0) * (f.qtde || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
        <td>${f.condicaoPagamento || "—"}</td>
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
      <table><thead><tr><th>#</th><th>Item</th><th style="text-align:center">Qtde</th><th style="text-align:right">Valor unit.</th><th style="text-align:right">Total</th><th>Pagamento</th></tr></thead>
      <tbody>${linhas}</tbody></table>
      <div class="tot">Total geral: ${totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
      <div class="obs">Proposta gerada pelo sistema Meridian. Valores sujeitos a confirmação.</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold" style={{ color: C.text }}>Proposta · {cliente}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-3">
            {items.map((it, i) => (
              <div key={i} className="rounded-md p-2" style={{ border: `1px solid ${C.line}` }}>
                <div className="flex gap-2 items-center">
                  <input value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} className="flex-1 px-2 py-1 rounded text-sm font-medium" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
                  <span className="text-xs" style={{ color: C.sub }}>× {it.qty}</span>
                  <span className="text-sm font-medium" style={{ color: C.text }}>{brl((it.unit_price_cents || 0) / 100)}</span>
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
              <div className="text-xs mb-1" style={{ color: C.sub }}>Pagamento</div>
              <div className="px-2 py-1.5 rounded text-sm truncate" title={condicoes} style={{ background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>{condicoes || "—"}</div>
            </div>
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
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg p-4">
      <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>{title}</div>
      {children}
    </div>
  );
}
function Inp({ label, value, onChange, destaque }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal"
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
function Combo({ label, value, onChange, onPick, options, placeholder }) {
  const [open, setOpen] = useState(false);
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
  function digitar(v) { setQ(v); setSeed(v); setHi(0); setOpen(true); onChange?.(v); }
  function mover(dir) {
    if (!lista.length) return;
    const n = (hi + dir + lista.length) % lista.length;
    setHi(n); setQ(lista[n]); onChange?.(lista[n]);   // preenche ao vivo
  }
  function confirmar(o) {
    const alvo = o != null ? o : (lista[hi] || q);
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
