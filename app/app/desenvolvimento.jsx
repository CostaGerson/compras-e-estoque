"use client";
// v168 — Sugestões de melhoria
//  · SugestaoBotao: lâmpada ao lado do Sair, para qualquer usuário descrever uma melhoria
//  · Desenvolvimento (só o master): julgar cada sugestão — acatar (depois que a alteração subiu) ou recusar com motivo.
//    O autor recebe mensagem do sistema e e-mail.
import React, { useState, useEffect } from "react";
import { Lightbulb, X, Send, Loader2, CheckCircle2, XCircle, Clock, RotateCcw, Search, Eye } from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na operação.");
  return j;
};
const dataHora = (s) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const ST = {
  NOVA: ["Nova", C.blue, C.blueSoft, Lightbulb],
  EM_ANALISE: ["Em análise", C.yellow, C.yellowSoft, Clock],
  ACATADA: ["Acatada", C.green, C.greenSoft, CheckCircle2],
  RECUSADA: ["Recusada", C.red, C.redSoft, XCircle],
};
function Chip({ status }) {
  const [t, c, bg, Ico] = ST[status] || ST.NOVA;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: c, background: bg }}><Ico size={12} /> {t}</span>;
}
function Janela({ titulo, onClose, children, rodape, largura = 560 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onMouseDown={onClose}>
      <div className="rounded-xl w-full max-h-[88vh] flex flex-col shadow-2xl" style={{ background: C.panel, maxWidth: largura }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Lightbulb size={18} style={{ color: C.accent }} />
          <div className="font-semibold flex-1" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {rodape && <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>{rodape}</div>}
      </div>
    </div>
  );
}
const btn = (bg, cor, extra = {}) => ({ background: bg, color: cor, ...extra });

/* ---------- botão + tela central de sugestão ---------- */
export function SugestaoBotao({ user, tela }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)} title="Sugerir uma melhoria no sistema" className="flex items-center justify-center rounded-full"
        style={{ width: 30, height: 30, background: C.accentSoft, color: C.accent }}>
        <Lightbulb size={16} />
      </button>
      {aberto && <SugestaoModal user={user} tela={tela} onClose={() => setAberto(false)} />}
    </>
  );
}

function SugestaoModal({ user, tela, onClose }) {
  const [texto, setTexto] = useState("");
  const [st, setSt] = useState(null);          // null | "enviando" | { ok, msg }
  const [minhas, setMinhas] = useState(null);
  const [verMinhas, setVerMinhas] = useState(false);
  const carregar = () => api(`/api/sugestoes?u=${user.id}`).then((j) => setMinhas(j.sugestoes.filter((s) => s.usuarioId === user.id))).catch(() => setMinhas([]));
  useEffect(() => { carregar(); }, []);
  const enviar = async () => {
    setSt("enviando");
    try {
      await api("/api/sugestoes", "POST", { usuarioId: user.id, texto, tela });
      setSt({ ok: true, msg: "Sugestão enviada! Você recebe uma mensagem e um e-mail quando ela for analisada." });
      setTexto(""); carregar();
    } catch (e) { setSt({ ok: false, msg: e.message }); }
  };
  return (
    <Janela titulo="Sugerir uma melhoria" onClose={onClose} largura={620}
      rodape={<>
        <button onClick={() => setVerMinhas((v) => !v)} className="mr-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.blue }}>
          <Eye size={14} /> {verMinhas ? "Escrever sugestão" : `Minhas sugestões${minhas ? ` (${minhas.length})` : ""}`}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={btn(C.panel, C.sub, { border: `1px solid ${C.line}` })}>Fechar</button>
        {!verMinhas && <button onClick={enviar} disabled={st === "enviando" || texto.trim().length < 10} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-1.5"
          style={btn(C.accent, "#fff", { opacity: st === "enviando" || texto.trim().length < 10 ? 0.5 : 1 })}>
          {st === "enviando" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar sugestão
        </button>}
      </>}>
      {!verMinhas ? (
        <>
          <p className="text-sm mb-3" style={{ color: C.sub }}>
            Descreva o que você gostaria que o sistema fizesse melhor: o que acontece hoje, o que deveria acontecer e onde.
            {tela ? <> Você está em <b style={{ color: C.text }}>{tela}</b>.</> : null}
          </p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus rows={8} maxLength={4000}
            placeholder="Ex.: na tela de contas a pagar, poder filtrar pelo fornecedor e exportar a lista em Excel…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}`, color: C.text, background: "#fff", resize: "vertical" }} />
          <div className="text-[11px] text-right" style={{ color: C.sub }}>{texto.length}/4000</div>
          {st && st !== "enviando" && <div className="text-sm mt-2 px-3 py-2 rounded-lg" style={{ background: st.ok ? C.greenSoft : C.redSoft, color: st.ok ? C.green : C.red }}>{st.msg}</div>}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {!minhas && <div className="text-sm" style={{ color: C.sub }}>Carregando…</div>}
          {minhas && !minhas.length && <div className="text-sm" style={{ color: C.sub }}>Você ainda não enviou sugestões.</div>}
          {(minhas || []).map((s) => (
            <div key={s.id} className="rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold" style={{ color: C.sub }}>#{s.id}</span><Chip status={s.status} /><span className="text-[11px] ml-auto" style={{ color: C.sub }}>{dataHora(s.createdAt)}</span></div>
              <div className="text-sm whitespace-pre-wrap" style={{ color: C.text }}>{s.texto}</div>
              {s.resposta && <div className="text-xs mt-2 px-2 py-1.5 rounded" style={{ background: s.status === "RECUSADA" ? C.redSoft : C.greenSoft, color: s.status === "RECUSADA" ? C.red : C.green }}>{s.status === "RECUSADA" ? "Motivo" : "Observação"}: {s.resposta}</div>}
            </div>
          ))}
        </div>
      )}
    </Janela>
  );
}

/* ---------- Desenvolvimento (master) ---------- */
const FILTROS = [["ABERTAS", "Em aberto"], ["NOVA", "Novas"], ["EM_ANALISE", "Em análise"], ["ACATADA", "Acatadas"], ["RECUSADA", "Recusadas"], ["TODAS", "Todas"]];

export default function Desenvolvimento({ user }) {
  const [l, setL] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("ABERTAS");
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState(null);   // { s, tipo: ACATAR | RECUSAR }
  const [aviso, setAviso] = useState("");
  const carregar = () => api(`/api/sugestoes?u=${user.id}`).then((j) => { setL(j.sugestoes); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const conta = (k) => (l || []).filter((s) => (k === "TODAS" ? true : k === "ABERTAS" ? ["NOVA", "EM_ANALISE"].includes(s.status) : s.status === k)).length;
  const lista = (l || []).filter((s) => (filtro === "TODAS" ? true : filtro === "ABERTAS" ? ["NOVA", "EM_ANALISE"].includes(s.status) : s.status === filtro))
    .filter((s) => !busca || `${s.texto} ${s.usuarioNome} ${s.tela || ""} #${s.id}`.toUpperCase().includes(busca.toUpperCase()));
  const simples = async (s, tipo) => {
    try { await api(`/api/sugestoes/${s.id}`, "PATCH", { usuarioId: user.id, acao: tipo }); carregar(); }
    catch (e) { setErro(e.message); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Desenvolvimento</div>
          <div className="text-xs" style={{ color: C.sub }}>Sugestões de melhoria dos usuários. Acate depois que a alteração subir, ou recuse com o motivo — o autor recebe mensagem e e-mail.</div>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}`, width: 220 }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTROS.map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={filtro === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t} ({conta(k)})</button>
        ))}
      </div>
      {aviso && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!l && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
      {l && !lista.length && <div className="rounded-xl p-8 text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Nenhuma sugestão aqui.</div>}
      <div className="flex flex-col gap-3">
        {lista.map((s) => (
          <div key={s.id} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${(ST[s.status] || ST.NOVA)[1]}` }}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-bold" style={{ color: C.sub }}>#{s.id}</span>
              <Chip status={s.status} />
              <span className="text-sm font-semibold" style={{ color: C.text }}>{s.usuarioNome}</span>
              {s.setor && <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: C.panel2, color: C.sub }}>{s.setor}</span>}
              {s.tela && <span className="text-[11px]" style={{ color: C.sub }}>em {s.tela}</span>}
              <span className="text-[11px] ml-auto" style={{ color: C.sub }}>{dataHora(s.createdAt)}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap" style={{ color: C.text }}>{s.texto}</div>
            {s.resposta && <div className="text-xs mt-2 px-2 py-1.5 rounded" style={{ background: s.status === "RECUSADA" ? C.redSoft : C.greenSoft, color: s.status === "RECUSADA" ? C.red : C.green }}>
              {s.status === "RECUSADA" ? "Motivo da recusa" : "Observação"}: {s.resposta}</div>}
            {s.respondidoEm && <div className="text-[11px] mt-1" style={{ color: C.sub }}>{s.status === "ACATADA" ? "Acatada" : "Recusada"} por {s.respondidoPor} em {dataHora(s.respondidoEm)}</div>}
            <div className="flex flex-wrap gap-2 mt-3">
              {s.status === "NOVA" && <button onClick={() => simples(s, "ANALISE")} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1" style={btn(C.yellowSoft, C.yellow)}><Clock size={13} /> Em análise</button>}
              {["NOVA", "EM_ANALISE"].includes(s.status) && <>
                <button onClick={() => setAcao({ s, tipo: "ACATAR" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1" style={btn(C.green, "#fff")}><CheckCircle2 size={13} /> Acatado</button>
                <button onClick={() => setAcao({ s, tipo: "RECUSAR" })} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1" style={btn(C.redSoft, C.red)}><XCircle size={13} /> Recusar</button>
              </>}
              {["ACATADA", "RECUSADA"].includes(s.status) && <button onClick={() => simples(s, "REABRIR")} className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1" style={btn(C.panel2, C.sub)}><RotateCcw size={13} /> Reabrir</button>}
            </div>
          </div>
        ))}
      </div>
      {acao && <Decidir user={user} {...acao} onClose={() => setAcao(null)} onFeito={(m) => { setAcao(null); setAviso(m); setTimeout(() => setAviso(""), 7000); carregar(); }} />}
    </div>
  );
}

function Decidir({ user, s, tipo, onClose, onFeito }) {
  const [resp, setResp] = useState("");
  const [conf, setConf] = useState(false);
  const [st, setSt] = useState(null);
  const acatar = tipo === "ACATAR";
  const pode = acatar ? conf : resp.trim().length >= 5;
  const enviar = async () => {
    setSt("enviando");
    try {
      const r = await api(`/api/sugestoes/${s.id}`, "PATCH", { usuarioId: user.id, acao: tipo, resposta: resp });
      const em = r.avisos?.email === true ? "e-mail enviado" : `e-mail ${r.avisos?.email || "não enviado"}`;
      onFeito(`Sugestão #${s.id} ${acatar ? "acatada" : "recusada"} · ${r.avisos?.mensagem ? "mensagem enviada" : "sem mensagem (é sua)"} · ${em}.`);
    } catch (e) { setSt(e.message); }
  };
  return (
    <Janela titulo={acatar ? `Acatar a sugestão #${s.id}` : `Recusar a sugestão #${s.id}`} onClose={onClose}
      rodape={<>
        <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={btn(C.panel, C.sub, { border: `1px solid ${C.line}` })}>Cancelar</button>
        <button onClick={enviar} disabled={!pode || st === "enviando"} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-1.5"
          style={btn(acatar ? C.green : C.red, "#fff", { opacity: !pode || st === "enviando" ? 0.5 : 1 })}>
          {st === "enviando" ? <Loader2 size={14} className="animate-spin" /> : acatar ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {acatar ? "Confirmar acatamento" : "Recusar e avisar"}
        </button>
      </>}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{s.usuarioNome} · {dataHora(s.createdAt)}</div>
      <div className="text-sm rounded-lg p-3 mb-4 whitespace-pre-wrap" style={{ background: C.panel2, color: C.text }}>{s.texto}</div>
      {acatar ? (
        <>
          <label className="flex items-start gap-2 text-sm mb-3" style={{ color: C.text }}>
            <input type="checkbox" checked={conf} onChange={(e) => setConf(e.target.checked)} className="mt-1" />
            <span>A alteração <b>já subiu</b> para o sistema. O autor vai receber uma mensagem e um e-mail avisando que a sugestão foi acatada.</span>
          </label>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Observação para o autor (opcional)</div>
          <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}` }}
            placeholder="Ex.: ficou na tela de contas a pagar, botão Exportar." />
        </>
      ) : (
        <>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Justificativa da recusa (obrigatória — o autor recebe por mensagem e e-mail)</div>
          <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={4} autoFocus className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
        </>
      )}
      {typeof st === "string" && st !== "enviando" && <div className="text-sm mt-2" style={{ color: C.red }}>{st}</div>}
    </Janela>
  );
}
