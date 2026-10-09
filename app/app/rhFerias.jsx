"use client";
// v169 — RH › Plano de férias: linha do tempo do ano, lançamento individual e coletivo, saldo por período aquisitivo e alertas
import React, { useState, useEffect } from "react";
import { Loader2, Plus, Users2, AlertTriangle, CheckCircle2, Trash2, Palmtree, ChevronLeft, ChevronRight } from "lucide-react";
import { ModalContas as Modal, CoresContas as C } from "./contas";
import { DEPTOS } from "@/lib/matriz";

const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na operação.");
  return j;
};
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeDepto = (k) => (DEPTOS.find(([d]) => d === k)?.[1] || k || "—").replace(/^\d+\.\s*/, "");
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const somaDia = (s, n) => new Date(dUTC(s).getTime() + n * 86400000).toISOString().slice(0, 10);
const diasEntre = (a, b) => Math.round((dUTC(b) - dUTC(a)) / 86400000) + 1;
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const NIVEL = { ALTO: [C.red, C.redSoft], MEDIO: [C.yellow, C.yellowSoft], BAIXO: [C.blue, C.blueSoft] };
const inp = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };

export default function PlanoFerias({ user, onMudou }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null);   // { coletiva?, ferias? , pessoaId?, inicio? }
  const [aviso, setAviso] = useState("");
  const carregar = () => api(`/api/rh/ferias?u=${user.id}&ano=${ano}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { setD(null); carregar(); }, [ano]);
  const ok = (m) => { setModal(null); setAviso(m); setTimeout(() => setAviso(""), 6000); carregar(); onMudou?.(); };

  const ini = `${ano}-01-01`, nDias = diasEntre(ini, `${ano}-12-31`);
  const pos = (s) => Math.max(0, Math.min(100, ((diasEntre(ini, s) - 1) / nDias) * 100));
  const H = hojeISO();
  const grupos = d ? Object.entries(d.pessoas.reduce((a, p) => { (a[p.depto] ||= []).push(p); return a; }, {})).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) : [];
  const temSobre = (depto, a, b) => (d?.sobreposicoes || []).some((s) => s.depto === depto && s.inicio <= b && s.fim >= a);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <button onClick={() => setAno(ano - 1)} className="px-2 py-1.5" style={{ color: C.sub }}><ChevronLeft size={16} /></button>
          <span className="px-2 font-bold" style={{ color: C.navy }}>{ano}</span>
          <button onClick={() => setAno(ano + 1)} className="px-2 py-1.5" style={{ color: C.sub }}><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Lançar férias</button>
        <button onClick={() => setModal({ coletiva: true })} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.panel, color: C.navy, border: `1px solid ${C.line}` }}><Users2 size={15} /> Férias coletivas</button>
        <div className="text-xs flex-1" style={{ color: C.sub, minWidth: 240 }}>Os dias de férias saem da assiduidade, da pontualidade e da crítica do ponto. Alerta quando mais de {d?.limiteSetor || 30}% de um setor sai junto.</div>
      </div>
      {aviso && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
      {d && <>
        {/* resumo */}
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[["De férias agora", d.agora.length, C.blue], ["Começam em 30 dias", d.proximas.length, C.navy], ["Períodos lançados no ano", d.ferias.length, C.text],
            ["Férias coletivas", d.coletivas.length, C.text], ["Alertas importantes", d.alertas.filter((a) => a.nivel === "ALTO").length, d.alertas.some((a) => a.nivel === "ALTO") ? C.red : C.green]].map(([r, v, c]) => (
            <div key={r} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}><div className="text-xs" style={{ color: C.sub }}>{r}</div><div className="text-2xl font-bold" style={{ color: c }}>{v}</div></div>
          ))}
        </div>

        {/* linha do tempo */}
        <div className="rounded-xl p-4 mb-4 overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div style={{ minWidth: 860 }}>
            <div className="flex text-[10px] font-semibold mb-1" style={{ color: C.sub }}>
              <div style={{ width: 190 }} />
              <div className="flex-1 relative flex">{MESES.map((m) => <div key={m} className="flex-1 text-center" style={{ borderLeft: `1px solid ${C.line}` }}>{m}</div>)}</div>
              <div style={{ width: 70 }} className="text-right">saldo</div>
            </div>
            {grupos.map(([depto, ps]) => (
              <div key={depto} className="mb-2">
                <div className="text-[11px] font-bold py-1" style={{ color: C.navy }}>{nomeDepto(depto)} <span style={{ color: C.sub, fontWeight: 400 }}>· {ps.length}</span></div>
                {ps.map((p) => {
                  const fs = d.ferias.filter((f) => f.pessoaId === p.id);
                  const s = d.saldos[p.id];
                  return (
                    <div key={p.id} className="flex items-center text-xs" style={{ height: 26 }}>
                      <button onClick={() => setModal({ pessoaId: p.id })} title="Lançar férias para esta pessoa" className="truncate text-left hover:underline" style={{ width: 190, color: C.text }}>{p.nome}</button>
                      <div className="flex-1 relative h-full" style={{ background: `repeating-linear-gradient(90deg, transparent, transparent calc(100%/12 - 1px), ${C.line} calc(100%/12 - 1px), ${C.line} calc(100%/12))` }}>
                        {H.startsWith(String(ano)) && <div className="absolute top-0 bottom-0" style={{ left: `${pos(H)}%`, width: 2, background: C.accent, opacity: 0.6 }} />}
                        {fs.map((f) => {
                          const a = f.inicio < ini ? ini : f.inicio, b = f.fim > `${ano}-12-31` ? `${ano}-12-31` : f.fim;
                          const conflito = temSobre(depto, a, b);
                          return (
                            <button key={f.id} onClick={() => setModal({ ferias: f })} title={`${dBR(f.inicio)} a ${dBR(f.fim)} · ${f.dias} dias${f.abono ? ` + ${f.abono} vendidos` : ""} · ${f.tipo === "COLETIVA" ? "coletiva" : "individual"} · ${f.status === "CONFIRMADA" ? "confirmada" : "planejada"}${conflito ? " · sobreposição no setor" : ""}`}
                              className="absolute rounded text-[9px] font-bold text-white overflow-hidden px-1"
                              style={{ left: `${pos(a)}%`, width: `${Math.max(0.6, pos(somaDia(b, 1)) - pos(a))}%`, top: 4, bottom: 4,
                                background: f.tipo === "COLETIVA" ? C.navy : C.accent, opacity: f.status === "CONFIRMADA" ? 1 : 0.65, outline: conflito ? `2px solid ${C.red}` : "none" }}>{f.dias}d</button>
                          );
                        })}
                      </div>
                      <div style={{ width: 70, color: !s ? C.sub : s.vencidas.length ? C.red : C.text }} className="text-right font-semibold" title={s ? `${s.periodos.length} período(s) aquisitivo(s) desde ${dBR(s.admissao)}` : "sem admissão"}>{s ? `${s.saldo} d` : "—"}</div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!d.pessoas.length && <div className="text-sm text-center py-6" style={{ color: C.sub }}>Nenhum funcionário ativo na Matriz.</div>}
            <div className="flex flex-wrap gap-4 text-[11px] mt-2" style={{ color: C.sub }}>
              <span className="flex items-center gap-1"><span style={{ width: 14, height: 8, background: C.accent, borderRadius: 2 }} /> individual</span>
              <span className="flex items-center gap-1"><span style={{ width: 14, height: 8, background: C.navy, borderRadius: 2 }} /> coletiva</span>
              <span className="flex items-center gap-1"><span style={{ width: 14, height: 8, background: C.accent, opacity: 0.65, borderRadius: 2 }} /> planejada (cor clara) · confirmada (cor cheia)</span>
              <span className="flex items-center gap-1"><span style={{ width: 14, height: 8, outline: `2px solid ${C.red}`, borderRadius: 2 }} /> sobreposição acima do limite no setor</span>
              <span>saldo = dias de férias já adquiridos e ainda não usados</span>
            </div>
          </div>
        </div>

        {/* alertas */}
        <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} style={{ color: C.accent }} /><div className="font-bold text-sm" style={{ color: C.navy }}>Análise do plano · {ano}</div></div>
          {!d.alertas.length && <div className="text-xs flex items-center gap-1" style={{ color: C.green }}><CheckCircle2 size={14} /> Plano sem pendências.</div>}
          <div className="flex flex-col gap-1.5">
            {d.alertas.map((a, i) => { const [c, bg] = NIVEL[a.nivel]; return <div key={i} className="text-xs rounded-lg px-2.5 py-2" style={{ background: bg, color: C.text, borderLeft: `3px solid ${c}` }}>{a.texto}</div>; })}
          </div>
        </div>
      </>}
      {modal && d && <FeriasModal user={user} d={d} {...modal} onClose={() => setModal(null)} onOk={ok} />}
    </div>
  );
}

function FeriasModal({ user, d, coletiva: novaColetiva, ferias, pessoaId: pInicial, onClose, onOk }) {
  const coletiva = novaColetiva || ferias?.tipo === "COLETIVA";
  const [f, setF] = useState({
    pessoaId: ferias?.pessoaId || pInicial || "", inicio: ferias?.inicio || "", dias: ferias?.dias || 30, abono: ferias?.abono || 0,
    status: ferias?.status || "PLANEJADA", obs: ferias?.obs || "", todaColetiva: true,
  });
  const [sel, setSel] = useState(new Set());
  const [erro, setErro] = useState("");
  const [st, setSt] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const fim = f.inicio && f.dias ? somaDia(f.inicio, Number(f.dias) - 1) : "";
  const s = !coletiva && f.pessoaId ? d.saldos[f.pessoaId] : null;
  const deptos = [...new Set(d.pessoas.map((p) => p.depto))];
  const dow = f.inicio ? new Date(`${f.inicio}T12:00:00Z`).getUTCDay() : null;
  const salvar = async () => {
    setSt(true); setErro("");
    try {
      const body = { id: ferias?.id, inicio: f.inicio, fim, status: f.status, abono: f.abono, obs: f.obs, todaColetiva: f.todaColetiva };
      if (coletiva && !ferias) Object.assign(body, { coletiva: true, pessoas: [...sel] }); else body.pessoaId = f.pessoaId;
      const r = await api("/api/rh/ferias", "POST", { usuarioId: user.id, ferias: body });
      onOk(coletiva && !ferias ? `Férias coletivas lançadas para ${r.n} pessoa(s).` : "Férias salvas.");
    } catch (e) { setSt(false); setErro(e.message); }
  };
  const excluir = async () => {
    if (!confirm(ferias.coletivaId && f.todaColetiva ? "Excluir estas férias coletivas de todos?" : "Excluir este período de férias?")) return;
    try { await api("/api/rh/ferias", "DELETE", { usuarioId: user.id, id: ferias.id, todaColetiva: f.todaColetiva }); onOk("Férias excluídas."); } catch (e) { setErro(e.message); }
  };
  const marcar = (ids, on) => setSel((x) => { const n = new Set(x); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });
  return (
    <Modal titulo={ferias ? "Editar férias" : coletiva ? "Férias coletivas" : "Lançar férias"} icone={Palmtree} onClose={onClose} largura={coletiva && !ferias ? 760 : 560}
      rodape={<>
        {ferias && <button onClick={excluir} className="mr-auto text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} disabled={st || !f.inicio || (coletiva && !ferias ? !sel.size : !f.pessoaId)} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: st || !f.inicio ? 0.5 : 1 }}>Salvar</button>
      </>}>
      {!coletiva || ferias ? (
        <label className="block text-xs mb-3" style={{ color: C.sub }}>Funcionário
          <select value={f.pessoaId} onChange={(e) => set("pessoaId", e.target.value)} disabled={!!ferias?.coletivaId} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}>
            <option value="">— escolha —</option>
            {d.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome} · {nomeDepto(p.depto)}</option>)}
          </select>
        </label>
      ) : (
        <div className="mb-3">
          <div className="text-xs mb-1" style={{ color: C.sub }}>Quem entra ({sel.size})</div>
          <div className="flex flex-wrap gap-1 mb-2">
            <button onClick={() => marcar(d.pessoas.map((p) => p.id), sel.size < d.pessoas.length)} className="px-2 py-1 rounded text-[11px] font-semibold" style={{ background: C.navy, color: "#fff" }}>{sel.size < d.pessoas.length ? "Todos" : "Nenhum"}</button>
            {deptos.map((dp) => { const ids = d.pessoas.filter((p) => p.depto === dp).map((p) => p.id); const tudo = ids.every((i) => sel.has(i));
              return <button key={dp} onClick={() => marcar(ids, !tudo)} className="px-2 py-1 rounded text-[11px] font-semibold" style={tudo ? { background: C.accent, color: "#fff" } : { background: C.panel2, color: C.text }}>{nomeDepto(dp)}</button>; })}
          </div>
          <div className="grid gap-1 rounded-lg p-2" style={{ gridTemplateColumns: "repeat(3, 1fr)", border: `1px solid ${C.line}`, maxHeight: 180, overflowY: "auto" }}>
            {d.pessoas.map((p) => <label key={p.id} className="flex items-center gap-1.5 text-xs truncate"><input type="checkbox" checked={sel.has(p.id)} onChange={(e) => marcar([p.id], e.target.checked)} /> {p.nome}</label>)}
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 mb-2">
        <label className="text-xs" style={{ color: C.sub }}>Início<input type="date" value={f.inicio} onChange={(e) => set("inicio", e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Dias corridos<input type="number" min={1} max={30} value={f.dias} onChange={(e) => set("dias", e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Fim<div className="mt-1 px-2 py-1.5 rounded-lg text-sm" style={{ background: C.panel2 }}>{dBR(fim)}</div></label>
      </div>
      {dow !== null && [5, 6, 0].includes(dow) && <div className="text-[11px] mb-2" style={{ color: C.red }}>Começa numa {["domingo", "", "", "", "", "sexta", "sábado"][dow]}: a CLT proíbe iniciar nos 2 dias antes do repouso semanal ou de feriado.</div>}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {!coletiva && <label className="text-xs" style={{ color: C.sub }}>Dias vendidos (abono, até 10)<input type="number" min={0} max={10} value={f.abono} onChange={(e) => set("abono", e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></label>}
        <label className="text-xs" style={{ color: C.sub }}>Situação
          <select value={f.status} onChange={(e) => set("status", e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}>
            <option value="PLANEJADA">Planejada</option><option value="CONFIRMADA">Confirmada (aviso dado)</option>
          </select>
        </label>
      </div>
      <label className="block text-xs mb-2" style={{ color: C.sub }}>Observação<input value={f.obs} onChange={(e) => set("obs", e.target.value)} className="w-full mt-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} /></label>
      {ferias?.coletivaId && <label className="flex items-center gap-2 text-xs" style={{ color: C.text }}><input type="checkbox" checked={f.todaColetiva} onChange={(e) => set("todaColetiva", e.target.checked)} /> aplicar a todos destas férias coletivas</label>}
      {s && <div className="text-xs mt-3 rounded-lg p-2" style={{ background: C.panel2, color: C.sub }}>
        Admissão {dBR(s.admissao)} · saldo de <b style={{ color: C.text }}>{s.saldo} dia(s)</b> adquirido(s)
        {s.periodos.filter((x) => x.completo && x.saldo > 0).map((x) => <div key={x.n}>{x.n}º período ({dBR(x.inicio)}–{dBR(x.fim)}): {x.saldo} dia(s), gozar até {dBR(x.limite)}</div>)}
      </div>}
      {!coletiva && f.pessoaId && !s && <div className="text-xs mt-3" style={{ color: C.yellow }}>Sem data de admissão: cadastre na Matriz de pessoal para calcular o saldo.</div>}
      {erro && <div className="text-sm mt-2" style={{ color: C.red }}>{erro}</div>}
    </Modal>
  );
}
