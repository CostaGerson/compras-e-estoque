"use client";
// v576/v579 — acompanhamento público do dia (link do grupo do WhatsApp): rotas do dia em tempo real, demandas e lançamento
// de novas demandas de rota. Pensado para o celular; sem login (vale o link).
import React, { useEffect, useState } from "react";
import { DemandaForm } from "../../rotas";   // v582 — o mesmo formulário do sistema

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
  // v579 — o link é do dia: todas as rotas do dia e as demandas fora de rota
  const emAndamento = d.rotas.filter((r) => r.status === "EM_EXECUCAO").length;
  const todas = [...d.rotas.flatMap((r) => r.paradas), ...d.demandas];
  const atendidas = todas.filter((x) => x.status === "CONCLUIDA").length;

  return (
    <Tela>
      <div className="px-4 pt-4 pb-3" style={{ background: C.navy, color: "#fff" }}>
        <div className="flex items-center gap-2">
          <img src="/meridian-logo.svg" alt="Meridian" style={{ height: 20 }} />
          <span className="ml-auto text-[11px] flex items-center gap-1.5" style={{ color: "#B9C6D8" }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: emAndamento ? C.neon : "#98A2B3" }} /> ao vivo · atualiza a cada 30 s
          </span>
        </div>
        <div className="mt-3 text-lg font-bold">Rotas de {dBR(d.dia)}</div>
        <div className="text-xs mt-0.5" style={{ color: "#B9C6D8" }}>{d.rotas.length} rota(s){emAndamento ? ` · ${emAndamento} em andamento` : ""} · {atendidas} de {todas.length} demanda(s) atendida(s)</div>
      </div>

      {ok && <div className="mx-4 mt-3 p-3 rounded-lg text-sm" style={{ background: "#E7F6EC", color: C.green }}>{ok}</div>}

      {d.rotas.map((r) => <Rota key={r.id} r={r} />)}
      {!d.rotas.length && <Secao t="Rotas"><div className="text-sm" style={{ color: C.sub }}>Nenhuma rota montada neste dia ainda.</div></Secao>}

      <Secao t={`Demandas fora de rota · ${d.demandas.length}`}>
        {d.demandas.map((x) => {
          const [t, cor] = ST[x.status] || [x.status.toLowerCase(), C.sub];
          return (
            <div key={x.id} className="flex items-start gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="rounded-full mt-1.5 shrink-0" style={{ width: 8, height: 8, background: OBJ[x.objetivo]?.[1] || C.sub }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: C.text }}>{curto(x.nome)}{x.tarefa ? ` - ${frase(x.tarefa)}` : ""}{x.urgente ? " · URGENTE" : ""}</div>
                <div className="text-xs" style={{ color: C.sub }}>{OBJ[x.objetivo]?.[0]} · {x.frete ? "frete" : x.horario}</div>
              </div>
              <span className="text-xs font-semibold shrink-0" style={{ color: cor }}>{t}{x.status === "CONCLUIDA" && x.concluidaEm ? ` ${x.concluidaEm}` : ""}</span>
            </div>
          );
        })}
        {!d.demandas.length && <div className="text-sm" style={{ color: C.sub }}>Nenhuma demanda fora de rota.</div>}
      </Secao>

      <div className="h-24" />
      {!nova && <button onClick={() => { setNova(true); setOk(""); }} className="fixed flex items-center justify-center gap-2 rounded-full shadow-xl font-semibold text-white"
        style={{ right: 16, bottom: "calc(18px + env(safe-area-inset-bottom))", height: 54, padding: "0 22px", background: C.accent }}>＋ Nova demanda de rota</button>}
      {nova && <NovaDemanda token={token} dia={d.dia} usuarios={d.usuarios || []} motoristas={d.motoristas || []} onClose={() => setNova(false)} onOk={(m) => { setNova(false); setOk(m); ler(); }} />}
    </Tela>
  );
}

function Rota({ r }) {
  const feitas = r.paradas.filter((p) => p.status === "CONCLUIDA").length;
  const status = r.status === "EM_EXECUCAO" ? `em andamento · ${FASE[r.fase] || ""}` : r.status === "CONCLUIDO" ? `concluída${r.retornoEm ? ` · voltou ${r.retornoEm}` : ""}` : "ainda não saiu";
  const cor = r.status === "EM_EXECUCAO" ? C.accent : r.status === "CONCLUIDO" ? C.green : C.sub;
  return (
    <Secao t={<span className="flex items-center gap-2" style={{ textTransform: "none", letterSpacing: 0 }}><span className="text-sm font-bold" style={{ color: C.text }}>Rota R{r.id} · {r.motorista}</span><span className="text-xs font-semibold" style={{ color: cor }}>{status}</span></span>}>
      <div className="text-xs mb-2" style={{ color: C.sub }}>
        {feitas} de {r.paradas.length} parada(s){r.retornoPrevisto ? ` · volta prevista ~${r.retornoPrevisto}` : ""}{r.posicao ? ` · posição ${r.posicao.minAtras < 1 ? "agora" : `há ${r.posicao.minAtras} min`}` : ""}
        {r.posicao?.endereco ? <div className="truncate">📍 {r.posicao.endereco}</div> : null}
      </div>
      {r.paradas.map((p, i) => {
        const feita = p.status === "CONCLUIDA";
        return (
          <div key={p.id} className="flex gap-3">
            <div className="flex flex-col items-center" style={{ width: 14 }}>
              <span className="rounded-full mt-1 shrink-0" style={{ width: 12, height: 12, background: feita ? "#475467" : "#fff", border: `2px solid ${p.indo ? C.accent : feita ? "#475467" : "#C0C6D0"}` }} />
              {i < r.paradas.length - 1 && <div className="flex-1" style={{ width: 2, background: feita ? "#475467" : C.line, minHeight: 24 }} />}
            </div>
            <div className="flex-1 pb-2.5 min-w-0">
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
  );
}

function Tela({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "Montserrat, system-ui, sans-serif" }}>
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

// v582 — quem pede escolhe o próprio nome (usuários do sistema: a demanda fica no perfil dele e ele é avisado quando for
// atendida); depois abre o mesmo formulário de demanda de rota do sistema (cadastros, Google, horários, urgente, frete…)
function NovaDemanda({ token, dia, usuarios, motoristas, onClose, onOk }) {
  const [quem, setQuem] = useState(() => { try { const x = JSON.parse(localStorage.getItem("ce_acomp_quem") || "null"); return x && usuarios.some((u) => u.id === x.id) ? x : null; } catch { return null; } });
  const [busca, setBusca] = useState("");
  const sem = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ");
  const lista = usuarios.filter((u) => !busca.trim() || sem(nomeU(u)).includes(sem(busca.trim()))).slice(0, 30);
  const escolher = (u) => { const x = { id: u.id, nome: nomeU(u) }; setQuem(x); try { localStorage.setItem("ce_acomp_quem", JSON.stringify(x)); } catch {} };
  if (quem) return (
    <DemandaForm user={{ id: quem.id, nome: quem.nome, token }} inicial={{ data: dia >= hojeISO() ? dia : hojeISO(), horarioTipo: "MANHA" }} motoristas={motoristas}
      onClose={onClose} onOk={() => onOk(`Demanda lançada em nome de ${quem.nome}. Você recebe um aviso no sistema quando ela for atendida.`)} />
  );
  return (
    // v583 — tela cheia a partir do topo: o campo e a lista ficam acima do teclado
    <div className="fixed inset-0 z-50 flex items-start justify-center" style={{ background: C.panel }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full p-4 flex flex-col" style={{ background: C.panel, maxWidth: 560, height: "100dvh" }}>
        <div className="flex items-center mb-1"><div className="text-base font-bold flex-1" style={{ color: C.navy }}>Quem está pedindo?</div><button onClick={onClose} className="text-sm px-2" style={{ color: C.sub }}>Fechar</button></div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>Escolha seu nome: a demanda fica no seu perfil e você é avisado quando ela for atendida.</div>
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite seu nome" className="w-full rounded-lg px-3 py-2.5 outline-none mb-2" style={{ border: `1px solid ${C.line}`, fontSize: 16 }} />
        <div className="overflow-auto flex-1 -mx-1">
          {lista.map((u) => (
            <button key={u.id} onClick={() => escolher(u)} className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span className="rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ width: 30, height: 30, background: "#EAF0FB", color: C.navy }}>{(u.nome || "?")[0]}</span>
              <span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate" style={{ color: C.text }}>{nomeU(u)}</span><span className="block text-[11px]" style={{ color: C.sub }}>{u.setor}</span></span>
            </button>
          ))}
          {!lista.length && <div className="text-sm p-3" style={{ color: C.sub }}>Nenhum usuário com esse nome.</div>}
        </div>
      </div>
    </div>
  );
}
