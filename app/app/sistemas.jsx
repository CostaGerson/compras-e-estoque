"use client";
// v907 — Gestão › Sistemas do grupo Meridian: o ERP no centro, ligado por fibras óticas luminosas ao PCP (Maycon),
//   ao CRM (Pedro) e ao dashboard NORT Sports (Gerson). Clicar no card abre o sistema; a bolinha mostra se a integração
//   está ativa e o card traz a última leitura.
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";

const SIS = [
  { chave: "PCP", nome: "PCP · Cronograma", dono: "Maycon", desc: "Programação de corte, costura, personalização e expedição", url: "https://pcp.meridianpro.com.br", x: 17, y: 24, cor: "#3B82F6" },
  { chave: "CRM", nome: "CRM Meridian", dono: "Pedro", desc: "Clientes, oportunidades e propostas comerciais", url: "https://crm.meridianpro.com.br", x: 83, y: 24, cor: "#38E1D1" },
  { chave: "NORT", nome: "Dashboard NORT Sports", dono: "Gerson", desc: "Loja NORT: vendas, peças prontas e encomendas", url: "https://dashboard.nortsports.com.br", x: 22, y: 82, cor: "#EE6500" },
  // v1076 — portal da Loja Way aberto dentro do ERP (acesso interno: despacho e etiqueta de envio)
  { chave: "PORTAL", nome: "Portal Loja Way", dono: "Meridian", desc: "Pedidos e financeiro da Way: despacho, etiqueta, contas a pagar e a receber e análise mensal", interno: true, x: 78, y: 82, cor: "#A78BFA" },
  // v1083 — Portal NORT (dentro do ERP): contas a receber dos clientes finais da NORT e a pagar à Meridian (custo das FPPs)
  { chave: "PORTAL_NORT", nome: "Portal NORT", dono: "Meridian", desc: "Financeiro da NORT: a receber dos clientes finais e a pagar à Meridian, com análise mensal", interno: true, x: 50, y: 90, cor: "#F97316" },
];
const ERP = { x: 50, y: 47 };
const quando = (s) => {
  if (!s) return "sem leitura";
  const d = new Date(s), min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
};

const CSS = `
.sx-wrap{position:relative;border-radius:18px;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#13305a 0%,#0a1b36 45%,#050d1c 100%);width:100%;aspect-ratio:12/7;min-height:520px}
.sx-wrap:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(120,190,255,.10) 1px,transparent 1px);background-size:26px 26px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 80%)}
.sx-fibra{fill:none;stroke-linecap:round}
.sx-pulso{stroke-dasharray:2 26;animation:sxFluxo 1.6s linear infinite}
.sx-pulso.r{animation-direction:reverse;animation-duration:2.3s}
@keyframes sxFluxo{to{stroke-dashoffset:-56}}
.sx-respira{animation:sxResp 3.2s ease-in-out infinite}
@keyframes sxResp{0%,100%{opacity:.55}50%{opacity:1}}
.sx-anel{transform-origin:center;transform-box:fill-box;animation:sxGira 18s linear infinite}
.sx-anel.b{animation-duration:28s;animation-direction:reverse}
@keyframes sxGira{to{transform:rotate(360deg)}}
.sx-esporo{position:absolute;border-radius:50%;pointer-events:none;filter:blur(.4px);animation:sxSobe linear infinite}
@keyframes sxSobe{0%{transform:translateY(0) translateX(0);opacity:0}10%{opacity:.9}90%{opacity:.7}100%{transform:translateY(-220px) translateX(30px);opacity:0}}
.sx-card{position:absolute;transform:translate(-50%,-50%);width:min(280px,40%);border-radius:16px;padding:14px 16px;cursor:pointer;text-align:left;
  background:linear-gradient(160deg,rgba(18,44,84,.82),rgba(8,22,46,.9));backdrop-filter:blur(6px);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
.sx-card:hover{transform:translate(-50%,-50%) translateY(-4px) scale(1.02)}
.sx-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.sx-dot.on{background:#22E58B;box-shadow:0 0 0 0 rgba(34,229,139,.7);animation:sxPing 1.8s ease-out infinite}
.sx-dot.off{background:#5B6B82}
@keyframes sxPing{0%{box-shadow:0 0 0 0 rgba(34,229,139,.65)}100%{box-shadow:0 0 0 10px rgba(34,229,139,0)}}
@media (prefers-reduced-motion: reduce){.sx-pulso,.sx-respira,.sx-anel,.sx-esporo,.sx-dot.on{animation:none}}
`;

export default function Sistemas({ user, onVoltar, onPortal }) {
  const [st, setSt] = useState(null);
  const [lendo, setLendo] = useState(false);
  const ler = () => { setLendo(true); fetch(`/api/sistemas?u=${user.id}`, { cache: "no-store" }).then((r) => r.json()).then((j) => setSt(Object.fromEntries((j.sistemas || []).map((s) => [s.chave, s])))).catch(() => setSt({})).finally(() => setLendo(false)); };
  useEffect(() => { ler(); const t = setInterval(ler, 60000); return () => clearInterval(t); }, []);
  // esporos luminosos (aleatórios, fixos por montagem)
  const esporos = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ l: Math.random() * 100, t: 55 + Math.random() * 45, s: 2 + Math.random() * 3.5, d: 7 + Math.random() * 9, a: -Math.random() * 12,
    c: ["#5EEAD4", "#60A5FA", "#A7F3D0", "#93C5FD", "#FDBA74"][i % 5] })), []);
  // caminho curvo da fibra entre o ERP e cada sistema (coordenadas 0–100 × 0–60 do viewBox)
  const ponto = (p) => ({ x: p.x * 12, y: p.y * 7 });
  const curva = (a, b, k) => { const A = ponto(a), B = ponto(b), mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2; return `M${A.x},${A.y} Q${mx + k},${my - Math.abs(k) * 0.6} ${B.x},${B.y}`; };
  const E = ponto(ERP);
  return (
    <div>
      <style>{CSS}</style>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={onVoltar} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ border: "1px solid #E4E7EC", color: "#001E41", background: "#fff" }}><ArrowLeft size={15} /> Gestão</button>
        <div className="text-lg font-bold flex-1" style={{ color: "#0C2342" }}>Sistemas do grupo Meridian</div>
        <button onClick={ler} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: "1px solid #E4E7EC", color: "#3D6799", background: "#fff" }}><RefreshCw size={13} className={lendo ? "animate-spin" : ""} /> Atualizar</button>
      </div>
      <div className="sx-wrap">
        {esporos.map((e, i) => <span key={i} className="sx-esporo" style={{ left: `${e.l}%`, top: `${e.t}%`, width: e.s, height: e.s, background: e.c, boxShadow: `0 0 ${e.s * 3}px ${e.c}`, animationDuration: `${e.d}s`, animationDelay: `${e.a}s` }} />)}
        <svg viewBox="0 0 1200 700" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <defs>
            <filter id="sxBrilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <radialGradient id="sxNucleo"><stop offset="0%" stopColor="#E6F6FF" /><stop offset="35%" stopColor="#60A5FA" /><stop offset="100%" stopColor="#0C2342" stopOpacity="0" /></radialGradient>
          </defs>
          {SIS.map((s, i) => {
            const k = [-140, 140, -90, 90, 0][i] || 0, d = curva(ERP, s, k), on = s.interno || !!st?.[s.chave]?.ativo;
            return (
              <g key={s.chave}>
                <path d={d} className="sx-fibra" stroke={s.cor} strokeOpacity={on ? 0.22 : 0.1} strokeWidth="14" filter="url(#sxBrilho)" />
                <path d={d} className="sx-fibra sx-respira" stroke={s.cor} strokeOpacity={on ? 0.75 : 0.25} strokeWidth="2.2" />
                {on && <path d={d} className="sx-fibra sx-pulso" stroke="#F1FBFF" strokeWidth="3" filter="url(#sxBrilho)" />}
                {on && <path d={d} className="sx-fibra sx-pulso r" stroke={s.cor} strokeWidth="2.5" />}
                {on && [0, 1, 2].map((j) => <circle key={j} r="4.5" fill="#F1FBFF" filter="url(#sxBrilho)"><animateMotion dur={`${2.6 + j * 0.4}s`} begin={`${j * 0.85}s`} repeatCount="indefinite" path={d} keyPoints={j % 2 ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear" /></circle>)}
              </g>);
          })}
          {/* núcleo do ERP */}
          <circle cx={E.x} cy={E.y} r="150" fill="url(#sxNucleo)" opacity=".35" className="sx-respira" />
          <circle cx={E.x} cy={E.y} r="96" fill="none" stroke="#60A5FA" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="4 10" className="sx-anel" />
          <circle cx={E.x} cy={E.y} r="118" fill="none" stroke="#5EEAD4" strokeOpacity=".25" strokeWidth="1" strokeDasharray="1 7" className="sx-anel b" />
          <circle cx={E.x} cy={E.y} r="74" fill="#0C2342" stroke="#3B82F6" strokeWidth="2" filter="url(#sxBrilho)" />
        </svg>
        {/* ERP no centro */}
        <div style={{ position: "absolute", left: `${ERP.x}%`, top: `${ERP.y}%`, transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
          <img src="/meridian-emblema.svg" alt="" style={{ width: 54, height: 54, margin: "0 auto", filter: "drop-shadow(0 0 10px rgba(96,165,250,.9))" }} />
          <div style={{ color: "#F1F6FE", fontWeight: 800, letterSpacing: 3, fontSize: 15, marginTop: 4 }}>ERP</div>
          <div style={{ color: "#93C5FD", fontSize: 10, letterSpacing: 2 }}>MERIDIAN</div>
        </div>
        {/* sistemas */}
        {SIS.map((s) => {
          const x = st?.[s.chave], on = s.interno || !!x?.ativo;
          return (
            <button key={s.chave} className="sx-card" onClick={() => (s.interno ? onPortal?.(s.chave) : window.open(s.url, "_blank", "noopener"))} title={`Abrir ${s.nome}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, border: `1px solid ${s.cor}66`, boxShadow: `0 0 28px ${s.cor}${on ? "55" : "22"}, inset 0 0 24px ${s.cor}18` }}>
              <div className="flex items-center gap-2">
                <span className={`sx-dot ${st || s.interno ? (on ? "on" : "off") : "off"}`} title={on ? "Integração ativa" : "Integração inativa"} />
                <span style={{ color: "#F1F6FE", fontWeight: 800, fontSize: 15 }} className="flex-1">{s.nome}</span>
                {!s.interno && <ExternalLink size={14} style={{ color: s.cor }} />}
              </div>
              <div style={{ color: "#AFC3E0", fontSize: 11.5, marginTop: 4, lineHeight: 1.35 }}>{s.desc}</div>
              <div className="flex items-center gap-2" style={{ marginTop: 10, fontSize: 11 }}>
                <span style={{ color: s.cor, fontWeight: 700, letterSpacing: 1 }}>{s.dono.toUpperCase()}</span>
                <span style={{ color: "#5B6B82" }}>·</span>
                <span style={{ color: on ? "#A7F3D0" : "#8193AD" }}>{s.interno ? "abre dentro do ERP" : !st ? "verificando…" : `${on ? "integração ativa" : "integração inativa"} · última leitura ${quando(x?.ultima)}`}</span>
              </div>
              {x?.detalhe && <div style={{ color: "#6F86A6", fontSize: 10.5, marginTop: 3 }}>{x.detalhe}</div>}
            </button>);
        })}
      </div>
    </div>
  );
}

// v1076 — Portal Way pelo ERP: escolhe o cliente do portal (Loja Way primeiro) e abre o portal em tela cheia, em modo interno
export function PortalInterno({ user, tamanhos, onVoltar, Portal, nort = false }) {   // v1083 — nort: Portal NORT (só o financeiro)
  const [cs, setCs] = useState(null);
  const [id, setId] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (nort) {
      fetch("/api/portal?nort=1", { cache: "no-store", headers: { "x-usuario-id": String(user.id) } }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Sem acesso."); return j; })
        .then((j) => { setCs([]); setId(j.id); }).catch((e) => setErro(e.message));
      return;
    }
    fetch("/api/portal?clientes=1", { cache: "no-store", headers: { "x-usuario-id": String(user.id) } }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Sem acesso."); return j.clientes; })
      .then((l) => { setCs(l); const way = l.find((c) => /\bWAY\b/.test(c.nome)); if (way || l.length === 1) setId((way || l[0]).id); }).catch((e) => setErro(e.message));
  }, []);
  if (id) return <div className="fixed inset-0 z-[45]" style={{ background: "#F5F6F8" }}><Portal key={id} user={user} tamanhos={tamanhos} interno={id} onSair={onVoltar} soFinanceiro={nort} /></div>;
  return (
    <div className="rounded-xl p-6 max-w-lg" style={{ background: "#fff", border: "1px solid #E4E7EC" }}>
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm font-semibold mb-3" style={{ color: "#001E41" }}><ArrowLeft size={15} /> Sistemas</button>
      {erro ? <div style={{ color: "#D92D20" }}>{erro}</div> : !cs ? "Carregando…" : !cs.length ? "Nenhum cliente com portal cadastrado." : <>
        <div className="font-bold mb-2" style={{ color: "#0C2342" }}>Abrir o portal de qual cliente?</div>
        {cs.map((c) => <button key={c.id} onClick={() => setId(c.id)} className="block w-full text-left px-3 py-2 rounded-lg mb-1.5 font-semibold" style={{ border: "1px solid #E4E7EC" }}>{c.nome}</button>)}
      </>}
    </div>
  );
}
