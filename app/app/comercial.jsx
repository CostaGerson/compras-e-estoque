"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase, Calculator, Database, ExternalLink, Save, History, Lock, Unlock,
  Pencil, RotateCcw, ChevronDown, ChevronRight, X,
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
  const [sub, setSub] = useState("crm");
  const subs = [
    { k: "crm", label: "CRM", icon: Briefcase },
    { k: "fpp", label: "FPP", icon: Calculator },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-4">
        {subs.map((s) => {
          const Ico = s.icon; const on = sub === s.k;
          return (
            <button key={s.k} onClick={() => setSub(s.k)} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ background: on ? C.accent : C.panel, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>
              <Ico size={15} /> {s.label}
            </button>
          );
        })}
      </div>
      {sub === "crm" && <CrmEmbed />}
      {sub === "fpp" && <Fpp user={user} master={master} />}
    </div>
  );
}

/* ---------------- CRM embutido ---------------- */
function CrmEmbed() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
        <div className="text-sm font-semibold" style={{ color: C.text }}>CRM Meridian</div>
        <a href={CRM_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-medium" style={{ color: C.accent }}>
          Abrir em nova aba <ExternalLink size={14} />
        </a>
      </div>
      <iframe src={CRM_URL} title="CRM Meridian" style={{ width: "100%", height: "calc(100vh - 220px)", border: 0 }} />
      <div className="px-4 py-2 text-xs" style={{ color: C.sub, borderTop: `1px solid ${C.line}` }}>
        Se a área acima ficar em branco, o CRM está bloqueando exibição embutida — use "Abrir em nova aba".
      </div>
    </div>
  );
}

/* ============================================================
   FPP — Ficha de Precificação de Produtos
   ============================================================ */
const POS = [["peitoD", "Peito D"], ["peitoE", "Peito E"], ["mangaD", "Manga D"], ["mangaE", "Manga E"], ["costas", "Costas"]];

function personalizacaoVazia() { return { arte: "", peitoD: "", peitoE: "", mangaD: "", mangaE: "", costas: "" }; }
function fichaVazia(tipo) {
  return {
    tipo, item: "", clienteNome: "", clienteId: null, qtde: "",
    mpValor: "", forroValor: "",
    gola: "", punho: "", elastico: "", faixa: "", botaoQtd: "",
    faccao: "",
    silk: personalizacaoVazia(), bordado: personalizacaoVazia(), sublimacao: personalizacaoVazia(),
    freteVolume: "", embExt: "", embInt: "SIMPLES",
    opInvest: "NAO", opTitulo: "NAO", prazoPagamento: "",
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
    const prazo = num(f.prazoPagamento);
    const imposto = cget("IMPOSTO");
    const opInv = f.opInvest === "SIM" ? (cget("OP_INVEST_TAXA") * prazo / 30) * custoProducao : 0;
    const opTit = f.opTitulo === "SIM" ? cget("OP_TITULO_TAXA") * prazo / 30 * vp : 0;
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
      tipo, item: f.item, clienteId: f.clienteId, clienteNome: f.clienteNome, qtde: num(f.qtde),
      entradas: f, overrides: Object.keys(over).length ? over : null,
      resultados: r,
      custoProducao: r?.custoProducao, custoFinal: r?.custoFinal, valorProposto: num(f.valorProposto),
      margem: r?.margem, totalItem: r?.totalItem,
      criadoPorId: user?.id, criadoPorNome: `${user?.nome || ""} ${user?.sobrenome || ""}`.trim(),
    };
    const res = await fetch("/api/fpp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSalvando(false);
    setMsg(res.ok ? "Ficha salva ✓" : "Erro ao salvar.");
  }

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
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
            {tipo === "MALHA" ? "Malha · peças/kg" : "Plano · metros/peça"}
          </span>
        )}
      </div>

      {aba === "banco" && <BancoParams params={params} master={master} user={user} onReload={() => fetch("/api/fpp/params").then((x) => x.json()).then(setParams)} />}

      {aba === "salvas" && <FichasSalvas master={master} />}

      {aba === "ficha" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* coluna de entradas */}
          <div className="lg:col-span-2 space-y-4">
            <Card title="Identificação">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Combo label="Item (peça)" value={f.item} options={pecasAll.map((p) => p.chave)}
                  onChange={escolherPeca} onPick={escolherPeca} placeholder="Digite a peça…" />
                <ClienteCombo clientes={clientes} value={f.clienteNome}
                  onType={(v) => setF((s) => ({ ...s, clienteNome: v, clienteId: null }))}
                  onPick={(c) => setF((s) => ({ ...s, clienteNome: c.razaoSocial || c.nomeFantasia || "", clienteId: c.id }))}
                  onCreated={(c) => { setClientes((l) => [c, ...l]); setF((s) => ({ ...s, clienteNome: c.razaoSocial, clienteId: c.id })); }} />
                <Inp label="Qtde" value={f.qtde} onChange={(v) => set("qtde", v)} />
                <div className="flex items-end gap-2 pb-1">
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
                <Inp label="Prazo pagamento (dias)" value={f.prazoPagamento} onChange={(v) => set("prazoPagamento", v)} />
                <Inp label="Valor proposto (R$)" value={f.valorProposto} onChange={(v) => set("valorProposto", v)} destaque />
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
                  <Lin l="Margem de contribuição" v={pct(r.margem)} />
                  <Lin l="Valor proposto" v={brl(num(f.valorProposto))} forte />
                  <Lin l="Total do item" v={brl(r.totalItem)} forte cor={C.accent} />
                </div>
              )}
              <div className="text-[11px] mt-3" style={{ color: C.sub }}>Mínimo venda 16% · boa venda 30% · excelente 40%</div>
              <button onClick={salvar} disabled={salvando} className="w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold"
                style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
                <Save size={15} /> {salvando ? "Salvando…" : "Salvar ficha"}
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
function FichasSalvas({ master }) {
  const [lista, setLista] = useState(null);
  const [aberta, setAberta] = useState(null);
  function carregar() { fetch("/api/fpp").then((r) => r.json()).then((d) => setLista(Array.isArray(d) ? d : [])).catch(() => setLista([])); }
  useEffect(carregar, []);
  async function excluir(id) {
    if (!confirm("Excluir esta ficha?")) return;
    await fetch(`/api/fpp/${id}`, { method: "DELETE" });
    setAberta(null); carregar();
  }
  if (!lista) return <div className="text-sm" style={{ color: C.sub }}>Carregando…</div>;
  if (lista.length === 0) return <div className="text-sm" style={{ color: C.sub }}>Nenhuma ficha salva ainda.</div>;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: C.panel2, color: C.sub }} className="text-left">
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium">Tipo</th>
            <th className="px-3 py-2 font-medium text-right">Qtde</th>
            {master && <th className="px-3 py-2 font-medium text-right">Valor prop.</th>}
            {master && <th className="px-3 py-2 font-medium text-right">Margem</th>}
            <th className="px-3 py-2 font-medium">Data</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((f) => (
            <tr key={f.id} style={{ borderTop: `1px solid ${C.line}`, cursor: "pointer" }} onClick={() => setAberta(f)}>
              <td className="px-3 py-2 font-medium" style={{ color: C.text }}>{f.item}</td>
              <td className="px-3 py-2" style={{ color: C.sub }}>{f.clienteNome || "—"}</td>
              <td className="px-3 py-2" style={{ color: C.sub }}>{f.tipo}</td>
              <td className="px-3 py-2 text-right" style={{ color: C.text }}>{f.qtde ?? "—"}</td>
              {master && <td className="px-3 py-2 text-right" style={{ color: C.text }}>{f.valorProposto != null ? brl(f.valorProposto) : "—"}</td>}
              {master && <td className="px-3 py-2 text-right" style={{ color: C.text }}>{f.margem != null ? pct(f.margem) : "—"}</td>}
              <td className="px-3 py-2" style={{ color: C.sub }}>{new Date(f.createdAt).toLocaleDateString("pt-BR")}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={(e) => { e.stopPropagation(); excluir(f.id); }} className="p-1 rounded" style={{ color: "#E5484D" }}><X size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {aberta && <FichaDetalhe f={aberta} master={master} onClose={() => setAberta(null)} />}
    </div>
  );
}

function FichaDetalhe({ f, master, onClose }) {
  const r = f.resultados || {};
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-lg w-full max-w-md" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold" style={{ color: C.text }}>{f.item} · {f.tipo}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 text-sm space-y-1.5">
          <Lin l="Cliente" v={f.clienteNome || "—"} />
          <Lin l="Quantidade" v={f.qtde ?? "—"} />
          <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
          {master ? (
            <>
              <Lin l="Custo de produção" v={r.custoProducao != null ? brl(r.custoProducao) : "—"} />
              <Lin l="Custo final" v={f.custoFinal != null ? brl(f.custoFinal) : "—"} forte />
              <Lin l="ROIC" v={r.roic != null ? pct(r.roic) : "—"} />
              <Lin l="Margem" v={f.margem != null ? pct(f.margem) : "—"} />
              <Lin l="Valor proposto" v={f.valorProposto != null ? brl(f.valorProposto) : "—"} forte />
              <Lin l="Total do item" v={f.totalItem != null ? brl(f.totalItem) : "—"} forte cor={C.accent} />
            </>
          ) : <div className="text-xs" style={{ color: C.sub }}>Valores visíveis só para o financeiro.</div>}
          <div style={{ borderTop: `1px solid ${C.line}` }} className="my-2" />
          <div className="text-xs" style={{ color: C.sub }}>Criada por {f.criadoPorNome || "—"} em {new Date(f.createdAt).toLocaleString("pt-BR")}</div>
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

/* Autocomplete: vai filtrando as opções conforme digita */
function Combo({ label, value, onChange, onPick, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || "");
  useEffect(() => { setQ(value || ""); }, [value]);
  const lista = (options || []).filter((o) => o.toLowerCase().includes((q || "").toLowerCase()));
  function pick(o) { setQ(o); setOpen(false); (onPick || onChange)?.(o); }
  return (
    <div style={{ position: "relative" }}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input value={q} placeholder={placeholder} onChange={(e) => { setQ(e.target.value); setOpen(true); onChange?.(e.target.value); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
      {open && lista.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((o) => (
            <button key={o} onMouseDown={() => pick(o)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" style={{ color: C.text }}>{o}</button>
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
  const [criando, setCriando] = useState(false);
  useEffect(() => { setQ(value || ""); }, [value]);
  const nome = (c) => c.razaoSocial || c.nomeFantasia || "";
  const lista = clientes.filter((c) => nome(c).toLowerCase().includes((q || "").toLowerCase())).slice(0, 30);
  const exato = clientes.some((c) => nome(c).toLowerCase() === (q || "").trim().toLowerCase());
  async function criar() {
    setCriando(true);
    const res = await fetch("/api/clientes/rapido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ razaoSocial: q }) });
    const c = await res.json(); setCriando(false); setOpen(false);
    if (res.ok) { setQ(c.razaoSocial); onCreated?.(c); }
  }
  return (
    <div style={{ position: "relative" }}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Cliente</div>
      <input value={q} placeholder="Buscar cliente…" onChange={(e) => { setQ(e.target.value); setOpen(true); onType?.(e.target.value); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 180)}
        className="w-full px-2 py-1.5 rounded text-sm" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.text }} />
      {open && (q || "").trim() !== "" && (
        <div className="absolute z-30 mt-1 w-full rounded-md shadow-lg max-h-56 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {lista.map((c) => (
            <button key={c.id} onMouseDown={() => { setQ(nome(c)); setOpen(false); onPick?.(c); }} className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.text }}>{nome(c)}</button>
          ))}
          {!exato && (
            <button onMouseDown={criar} disabled={criando} className="block w-full text-left px-3 py-1.5 text-sm" style={{ color: C.accent, borderTop: lista.length ? `1px solid ${C.line}` : 0 }}>
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
