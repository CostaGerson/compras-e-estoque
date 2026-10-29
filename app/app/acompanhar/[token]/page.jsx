"use client";
// v576 — acompanhamento público da rota (link do grupo do WhatsApp): rota em tempo real, demandas do dia e lançamento
// de novas demandas de rota. Pensado para o celular; sem login (vale o link).
import React, { useEffect, useState } from "react";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20", blue: "#5BA4E6", neon: "#D6FF00" };
const OBJ = { COLETA: ["Coleta", "#FFA463"], ENTREGA: ["Entrega", "#5BA4E6"], COLETA_ENTREGA: ["Coleta e entrega", "linear-gradient(90deg, #5BA4E6 0 50%, #FF8A3D 50% 100%)"], COMPRA: ["Compra", "#E0A800"], RETORNO: ["Retorno", "#FF6B1A"] };
const FASE = { INDO: "a caminho", NA_PARADA: "na parada", SAINDO: "saindo da fábrica", VOLTANDO: "voltando à fábrica", FIM_PARADAS: "paradas concluídas" };
const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "");
const frase = (t) => { const s = String(t || "").trim().toLowerCase(); return s ? s[0].toUpperCase() + s.slice(1) : ""; };
const curto = (n) => { const p = String(n || "").trim().split(/\s+/); return p.length > 1 && p[0].length <= 3 ? `${p[0]} ${p[1]}` : p[0] || ""; };
const ST = { ABERTA: ["aberta", C.sub], NO_BLOCO: ["em rota (montagem)", C.sub], EM_EXECUCAO: ["em rota", C.accent], CONCLUIDA: ["atendida", C.green] };

export default function Acompanhar({ params }) {
  const token = params.token;
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState(false);
  const [ok, setOk] = useState("");
  const ler = () => fetch(`/api/acompanhar/${token}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.error) setErro(j.error); else { setD(j); setErro(""); } }).catch(() => setErro("Sem conexão. Tentando de novo…"));
  useEffect(() => { ler(); const t = setInterval(ler, 30000); return () => clearInterval(t); }, []);

  if (erro && !d) return <Tela><div className="p-6 text-center text-sm" style={{ color: C.red }}>{erro}</div></Tela>;
  if (!d) return <Tela><div className="p-6 text-center text-sm" style={{ color: C.sub }}>Carregando…</div></Tela>;
  const r = d.rota;
  const feitas = r.paradas.filter((p) => p.status === "CONCLUIDA").length;
  const status = r.status === "EM_EXECUCAO" ? `em andamento · ${FASE[r.fase] || ""}` : r.status === "CONCLUIDO" ? `concluída${r.retornoEm ? ` · voltou ${r.retornoEm}` : ""}` : r.status === "MONTAGEM" ? "ainda não saiu" : "cancelada";

  return (
    <Tela>
      <div className="px-4 pt-4 pb-3" style={{ background: C.navy, color: "#fff" }}>
        <div className="flex items-center gap-2">
          <img src="/meridian-logo.svg" alt="Meridian" style={{ height: 20 }} />
          <span className="ml-auto text-[11px] flex items-center gap-1.5" style={{ color: "#B9C6D8" }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: r.status === "EM_EXECUCAO" ? C.neon : "#98A2B3" }} /> ao vivo · atualiza a cada 30 s
          </span>
        </div>
        <div className="mt-3 text-lg font-bold">Rota R{r.id} · {r.motorista}</div>
        <div className="text-sm" style={{ color: "#D8E0EC" }}>{dBR(d.dia)} · {status}</div>
        <div className="text-xs mt-1" style={{ color: "#B9C6D8" }}>
          {feitas} de {r.paradas.length} parada(s) atendida(s){r.retornoPrevisto ? ` · volta prevista ~${r.retornoPrevisto}` : ""}
          {r.posicao ? ` · posição ${r.posicao.minAtras < 1 ? "agora" : `há ${r.posicao.minAtras} min`}` : ""}
        </div>
        {r.posicao?.endereco && <div className="text-xs mt-0.5 truncate" style={{ color: "#B9C6D8" }}>📍 {r.posicao.endereco}</div>}
      </div>

      {ok && <div className="mx-4 mt-3 p-3 rounded-lg text-sm" style={{ background: "#E7F6EC", color: C.green }}>{ok}</div>}

      <Secao t="Paradas da rota">
        {r.paradas.map((p, i) => {
          const feita = p.status === "CONCLUIDA";
          return (
            <div key={p.id} className="flex gap-3">
              <div className="flex flex-col items-center" style={{ width: 18 }}>
                <span className="rounded-full mt-1 shrink-0" style={{ width: 12, height: 12, background: feita ? "#475467" : "#fff", border: `2px solid ${p.indo ? C.accent : feita ? "#475467" : "#C0C6D0"}` }} />
                {i < r.paradas.length - 1 && <div className="flex-1 relative" style={{ width: 2, background: feita ? "#475467" : C.line, minHeight: 28 }}>
                  {r.paradas[i + 1]?.indo && <span className="ce-desce absolute" style={{ left: -5 }}><Seta /></span>}
                </div>}
              </div>
              <div className="flex-1 pb-3 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: feita ? C.sub : C.text }}>
                  <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: OBJ[p.objetivo]?.[1] || C.sub }} />
                  <span className="truncate" style={{ textDecoration: feita ? "line-through" : "none" }}>{curto(p.nome)}{p.tarefa ? ` - ${frase(p.tarefa)}` : ""}</span>
                </div>
                <div className="text-xs" style={{ color: p.indo ? C.accent : C.sub }}>
                  {OBJ[p.objetivo]?.[0]} · {feita ? `atendida ${p.concluidaEm || ""}` : p.indo ? `a caminho · chega ~${p.eta || "?"}` : p.eta ? `previsão ~${p.eta}` : p.horario}
                </div>
              </div>
            </div>
          );
        })}
        {!r.paradas.length && <div className="text-sm" style={{ color: C.sub }}>Rota sem paradas.</div>}
      </Secao>

      <Secao t={`Outras demandas do dia · ${d.demandas.length}`}>
        {d.demandas.map((x) => {
          const [t, cor] = ST[x.status] || [x.status.toLowerCase(), C.sub];
          return (
            <div key={x.id} className="flex items-start gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="rounded-full mt-1.5 shrink-0" style={{ width: 8, height: 8, background: OBJ[x.objetivo]?.[1] || C.sub }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: C.text }}>{curto(x.nome)}{x.tarefa ? ` - ${frase(x.tarefa)}` : ""}{x.urgente ? " · URGENTE" : ""}</div>
                <div className="text-xs" style={{ color: C.sub }}>{OBJ[x.objetivo]?.[0]} · {x.frete ? "frete" : x.horario}{x.rota ? ` · rota R${x.rota}` : ""}</div>
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: cor }}>{t}{x.status === "CONCLUIDA" && x.concluidaEm ? ` ${x.concluidaEm}` : ""}</span>
            </div>
          );
        })}
        {!d.demandas.length && <div className="text-sm" style={{ color: C.sub }}>Nenhuma outra demanda neste dia.</div>}
      </Secao>

      <div className="h-24" />
      {!nova && <button onClick={() => { setNova(true); setOk(""); }} className="fixed flex items-center justify-center gap-2 rounded-full shadow-xl font-semibold text-white"
        style={{ right: 16, bottom: "calc(18px + env(safe-area-inset-bottom))", height: 54, padding: "0 22px", background: C.accent }}>＋ Nova demanda de rota</button>}
      {nova && <NovaDemanda token={token} dia={d.dia} onClose={() => setNova(false)} onOk={(m) => { setNova(false); setOk(m); ler(); }} />}
    </Tela>
  );
}

function Tela({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Montserrat, system-ui, sans-serif" }}>
      <style>{`@keyframes ce-desce { 0% { top: -4px; opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } 100% { top: calc(100% - 8px); opacity: 0 } } .ce-desce { animation: ce-desce 2.2s linear infinite }`}</style>
      <div className="mx-auto" style={{ maxWidth: 560 }}>{children}</div>
    </div>
  );
}
function Secao({ t, children }) {
  return (
    <div className="mx-4 mt-3 rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.sub }}>{t}</div>
      {children}
    </div>
  );
}
function Seta() {
  return <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: "rotate(90deg)" }}><path d="M1 1 L11 6 L1 11 L3.5 6 Z" fill={C.neon} stroke="#1E1F21" strokeWidth="1" strokeLinejoin="round" /></svg>;
}

function NovaDemanda({ token, dia, onClose, onOk }) {
  const hoje = hojeISO();
  const [f, setF] = useState(() => {
    let nome = ""; try { nome = localStorage.getItem("ce_acomp_nome") || ""; } catch {}
    return { nome, objetivo: "ENTREGA", data: dia >= hoje ? dia : hoje, horarioTipo: "MANHA", destinoNome: "", endereco: "", tarefa: "", contato: "", telefone: "", obs: "" };
  });
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const enviar = async () => {
    setSt(true); setErro("");
    try { localStorage.setItem("ce_acomp_nome", f.nome.trim()); } catch {}
    try {
      const r = await fetch(`/api/acompanhar/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Erro ao lançar.");
      onOk(`Demanda lançada para ${dBR(f.data)}${j.semMapa ? " (endereço não localizado no mapa — a logística confere)" : ""}.`);
    } catch (e) { setErro(e.message); setSt(false); }
  };
  const inp = "w-full rounded-lg px-3 py-2.5 outline-none";
  const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontSize: 16 };
  const Seg = ({ k, opts }) => (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0,1fr))` }}>
      {opts.map(([v, t]) => <button key={v} type="button" onClick={() => set(k, v)} className="rounded-lg py-2 text-xs font-semibold" style={{ background: f[k] === v ? C.navy : "#fff", color: f[k] === v ? "#fff" : C.sub, border: `1px solid ${f[k] === v ? C.navy : C.line}` }}>{t}</button>)}
    </div>
  );
  const pronto = f.nome.trim().length >= 2 && f.destinoNome.trim() && f.endereco.trim() && f.tarefa.trim() && f.data;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-2xl p-4 overflow-auto" style={{ background: C.panel, maxWidth: 560, maxHeight: "92vh" }}>
        <div className="flex items-center mb-3"><div className="text-base font-bold flex-1" style={{ color: C.navy }}>Nova demanda de rota</div><button onClick={onClose} className="text-sm px-2" style={{ color: C.sub }}>Fechar</button></div>
        <div className="space-y-3">
          <L t="Seu nome"><input value={f.nome} onChange={(e) => set("nome", e.target.value)} className={inp} style={inpS} placeholder="Quem está pedindo" /></L>
          <L t="Tipo"><Seg k="objetivo" opts={[["COLETA", "Coleta"], ["ENTREGA", "Entrega"], ["COLETA_ENTREGA", "Col. e entr."], ["COMPRA", "Compra"]]} /></L>
          <div className="grid grid-cols-2 gap-2">
            <L t="Data"><input type="date" min={hoje} value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} style={inpS} /></L>
            <L t="Período"><Seg k="horarioTipo" opts={[["MANHA", "Manhã"], ["TARDE", "Tarde"], ["LIVRE", "Livre"]]} /></L>
          </div>
          <L t="Onde (empresa ou pessoa)"><input value={f.destinoNome} onChange={(e) => set("destinoNome", e.target.value)} className={inp} style={inpS} placeholder="Ex.: Ematex" /></L>
          <L t="Endereço"><input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} className={inp} style={inpS} placeholder="Rua, número, bairro, cidade - UF" /></L>
          <L t="O que fazer lá"><input value={f.tarefa} onChange={(e) => set("tarefa", e.target.value)} className={inp} style={inpS} placeholder="Ex.: buscar amostras" /></L>
          <div className="grid grid-cols-2 gap-2">
            <L t="Contato (opcional)"><input value={f.contato} onChange={(e) => set("contato", e.target.value)} className={inp} style={inpS} /></L>
            <L t="Telefone (opcional)"><input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} inputMode="tel" className={inp} style={inpS} /></L>
          </div>
          <L t="Observação (opcional)"><input value={f.obs} onChange={(e) => set("obs", e.target.value)} className={inp} style={inpS} /></L>
        </div>
        {erro && <div className="mt-3 p-2 rounded text-sm" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
        <button disabled={!pronto || st} onClick={enviar} className="w-full mt-4 rounded-xl py-3.5 font-bold text-white" style={{ background: C.accent, opacity: !pronto || st ? 0.5 : 1 }}>{st ? "Lançando…" : "Lançar demanda"}</button>
        <div className="h-3" />
      </div>
    </div>
  );
}
function L({ t, children }) { return <label className="block"><div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>; }
