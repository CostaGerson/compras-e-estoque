"use client";
// v169 — Tarefas (demandas entre setores), Agenda (mensal/semanal) e status das pessoas
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, X, Loader2, Play, Square, CheckCircle2, Repeat, Paperclip, Lock, Globe, ListChecks, Link2, Trash2, Pencil, Upload,
  ChevronLeft, ChevronRight, Search, Clock, RotateCcw, CalendarDays, Users2, Flag, FileText,
} from "lucide-react";
import { SETORES_TAREFA, NOME_SETOR_TAREFA, setorTarefaDe } from "@/lib/acesso";
import { TIPOS_REC, DIAS_SEMANA, ORDINAIS, descreverRecorrencia } from "@/lib/recorrencia";
import { alerta, confirmar } from "./dialogo";   // v424 — popups do sistema

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#D99A00", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", cinza: "#98A2B3", cinzaSoft: "#F2F4F7",
};
export const TIPO = { ROTINA: ["Rotina", C.blue, C.blueSoft], URGENTE: ["Urgente", C.red, C.redSoft], PADRAO: ["Padrão", C.cinza, C.cinzaSoft] };
export const STATUS_P = { DISPONIVEL: ["Disponível", C.green], OCUPADO: ["Ocupado", C.yellow], REUNIAO: ["Em reunião", C.navy], INATIVO: ["Inativo", C.cinza] };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro na operação.");
  return j;
};
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(file); });
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const somaDia = (s, n) => new Date(dUTC(s).getTime() + n * 86400000).toISOString().slice(0, 10);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const duracao = (seg) => { seg = Math.max(0, Math.round(seg || 0)); const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60); return h ? `${h}h${String(m).padStart(2, "0")}` : m ? `${m} min` : `${seg % 60}s`; };
const inp = "w-full rounded-lg px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };

// relógio que avança a cada segundo
function useAgora(ms = 1000) { const [t, setT] = useState(Date.now()); useEffect(() => { const i = setInterval(() => setT(Date.now()), ms); return () => clearInterval(i); }, [ms]); return t; }

function Janela({ titulo, icone: Ico = Flag, onClose, children, rodape, largura = 640, gaveta }) {
  // v226 — gaveta: painel que desliza da direita (como o detalhe de tarefa do Asana)
  if (gaveta) return (
    <div className="fixed inset-0 z-50 flex justify-end anim-fundo" style={{ background: "rgba(30,31,33,.25)" }} onMouseDown={onClose}>
      <div className="h-full w-full flex flex-col shadow-2xl anim-gaveta" style={{ background: C.panel, maxWidth: largura }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid #EDEAE9` }}>
          <div className="font-semibold flex-1 truncate text-sm" style={{ color: "#6D6E6F" }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid #EDEAE9` }}>{rodape}</div>}
      </div>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fundo" style={{ background: "rgba(0,30,65,.45)" }} onMouseDown={onClose}>
      <div className="rounded-xl w-full flex flex-col shadow-2xl anim-modal" style={{ background: C.panel, maxWidth: largura, maxHeight: "92vh" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Ico size={18} style={{ color: C.accent }} /><div className="font-semibold flex-1 truncate" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2, borderRadius: "0 0 12px 12px" }}>{rodape}</div>}
      </div>
    </div>
  );
}
const Btn = ({ cor = C.accent, fundo, children, ...p }) => <button {...p} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${p.className || ""}`} style={{ background: fundo || cor, color: fundo ? cor : "#fff", opacity: p.disabled ? 0.5 : 1, ...(p.style || {}) }}>{children}</button>;
function ChipTipo({ tipo }) { const [t, c, bg] = TIPO[tipo] || TIPO.PADRAO; return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: bg, color: c }}>{t.toUpperCase()}</span>; }
export function Bolinha({ status, size = 9 }) { const c = (STATUS_P[status] || STATUS_P.INATIVO)[1]; return <span className="inline-block rounded-full shrink-0" style={{ width: size, height: size, background: c, boxShadow: "0 0 0 2px #fff" }} />; }

/* ======================= status da própria pessoa (topo) ======================= */
export function StatusPessoa({ user }) {
  const [eu, setEu] = useState(null);
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  const agora = useAgora(30000);
  const carregar = () => api(`/api/equipe?u=${user.id}`).then((j) => setEu(j.equipe.find((x) => x.id === user.id) || null)).catch(() => {});
  useEffect(() => { carregar(); }, [agora]);
  useEffect(() => { const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); }; document.addEventListener("mousedown", f); return () => document.removeEventListener("mousedown", f); }, []);
  const mudar = async (s) => { setMenu(false); await api("/api/equipe", "PATCH", { usuarioId: user.id, status: s }).catch(() => {}); carregar(); };
  if (!eu) return null;
  const [rot, cor] = STATUS_P[eu.status];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setMenu((m) => !m)} title={typeof eu.detalhe === "string" ? eu.detalhe : eu.detalhe?.titulo || rot} className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: C.panel2, color: cor }}>
        <Bolinha status={eu.status} /> {rot}
      </button>
      {menu && (
        <div className="absolute right-0 top-9 z-40 rounded-xl shadow-xl p-1 w-60" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          {eu.status === "OCUPADO" && eu.detalhe && <div className="px-3 py-2 text-[11px]" style={{ color: C.sub }}>Trabalhando em <b style={{ color: C.text }}>{eu.detalhe.titulo}</b> — o status volta ao normal quando você pausa (■) ou conclui.</div>}
          <button onClick={() => mudar("DISPONIVEL")} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"><Bolinha status="DISPONIVEL" /> Disponível</button>
          <button onClick={() => mudar("REUNIAO")} className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-gray-50"><Bolinha status="REUNIAO" /> Em reunião</button>
          <div className="px-3 py-1.5 text-[10px]" style={{ color: C.sub }}>Ocupado entra sozinho ao dar play numa demanda. Inativo: fora do expediente (seg a sex, 7h às 18h) ou de férias.</div>
        </div>
      )}
    </div>
  );
}

/* ======================= quem está fazendo o quê ======================= */
function EquipeAgora({ equipe, onAbrir }) {
  const agora = useAgora();
  const ord = { OCUPADO: 0, REUNIAO: 1, DISPONIVEL: 2, INATIVO: 3 };
  const l = [...equipe].sort((a, b) => ord[a.status] - ord[b.status] || a.nome.localeCompare(b.nome));
  return (
    <div className="rounded-xl p-3 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-2"><Users2 size={15} style={{ color: C.accent }} /><span className="text-sm font-bold" style={{ color: C.navy }}>Equipe agora</span>
        {Object.entries(STATUS_P).map(([k, [t]]) => <span key={k} className="text-[11px] flex items-center gap-1 ml-2" style={{ color: C.sub }}><Bolinha status={k} size={7} /> {t} {l.filter((x) => x.status === k).length}</span>)}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {l.map((p) => (
          <button key={p.id} onClick={() => p.detalhe?.tarefaId && onAbrir(p.detalhe.tarefaId)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-left" style={{ background: C.panel2, minWidth: 150, maxWidth: 220, cursor: p.detalhe?.tarefaId ? "pointer" : "default" }}>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: C.text }}><Bolinha status={p.status} /> <span className="truncate">{p.nome}</span></div>
            <div className="text-[10px] truncate" style={{ color: C.sub }}>
              {p.status === "OCUPADO" ? `${p.detalhe.titulo} · ${duracao((agora - new Date(p.detalhe.desde)) / 1000)}`
                : p.status === "REUNIAO" ? `em reunião${p.detalhe?.desde ? ` há ${duracao((agora - new Date(p.detalhe.desde)) / 1000)}` : ""}`
                : p.status === "INATIVO" ? p.detalhe : NOME_SETOR_TAREFA[p.setorTarefa]}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ======================= Tarefas ======================= */
export default function Tarefas({ user, natureza = "GERAL", projetoId = null, embutido = false }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [setor, setSetor] = useState("TODOS");
  const [escopo, setEscopo] = useState("todas");
  const [ver, setVer] = useState("ABERTAS");
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(null);
  const [abrir, setAbrir] = useState(null);
  const agora = useAgora();
  const carregar = () => api(`/api/tarefas?u=${user.id}&escopo=${escopo}${projetoId ? `&projeto=${projetoId}` : ""}&de=${somaDia(hojeISO(), -365)}&ate=${somaDia(hojeISO(), 60)}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [escopo, projetoId]);
  useEffect(() => { const i = setInterval(carregar, 60000); return () => clearInterval(i); }, [escopo, projetoId]);
  const P = Object.fromEntries((d?.projetos || []).map((p) => [p.id, p]));
  const H = hojeISO();
  const lista = (d?.tarefas || []).filter((t) => (natureza === "GERAL" || t.natureza === natureza) && (setor === "TODOS" || t.setor === setor)
    && (ver === "TODAS" || (ver === "ABERTAS" ? t.status !== "CONCLUIDA" : t.status === "CONCLUIDA"))
    && (!busca || `${t.titulo} ${t.descricao || ""} ${t.responsavelNome} ${t.criadoPorNome} #${t.id}`.toUpperCase().includes(busca.toUpperCase())))
    .filter((t) => ver !== "ABERTAS" || t.prazo <= somaDia(H, 30) || t.serieId === null);   // rotinas: só os próximos 30 dias
  const grupos = ver === "ABERTAS" ? [
    ["Atrasadas", lista.filter((t) => t.prazo < H), C.red], ["Hoje", lista.filter((t) => t.prazo === H), C.accent],
    ["Próximos 7 dias", lista.filter((t) => t.prazo > H && t.prazo <= somaDia(H, 7)), C.navy], ["Depois", lista.filter((t) => t.prazo > somaDia(H, 7)), C.sub],
  ] : [["", lista.slice().reverse(), C.sub]];
  const acao = async (t, a, extra = {}) => { try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: a, ...extra }); carregar(); } catch (e) { alerta(e.message); } };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex-1 min-w-[240px]">
          {!embutido && <div className="text-lg font-bold" style={{ color: C.navy }}>Tarefas</div>}
          <div className="text-xs" style={{ color: C.sub }}>Demandas entre os setores · rotina <b style={{ color: C.blue }}>azul</b> · urgente <b style={{ color: C.red }}>vermelho</b> · padrão <b style={{ color: C.cinza }}>cinza</b></div>
        </div>
        <div className="relative"><Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 200 }} /></div>
        <Btn onClick={() => setForm({ prazo: H, setor: setorTarefaDe(user), responsavelId: user.id, projetoId, natureza: natureza === "PESSOAL" ? "PESSOAL" : "FUNCIONAL", publica: natureza !== "PESSOAL" })}><Plus size={14} /> Nova demanda</Btn>
      </div>
      {d && <EquipeAgora equipe={d.equipe} onAbrir={(id) => setAbrir(id)} />}
      <div className="flex flex-wrap gap-2 mb-3">
        {[["TODOS", "Todos os setores"], ...SETORES_TAREFA].map(([k, t]) => (
          <button key={k} onClick={() => setSetor(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={setor === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>
            {t} {d && <span style={{ opacity: 0.7 }}>{(d.tarefas || []).filter((x) => (k === "TODOS" || x.setor === k) && x.status !== "CONCLUIDA" && x.prazo <= somaDia(H, 30)).length}</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {[["todas", "Visíveis para mim"], ["minhas", "Para mim"], ["criadas", "Que eu pedi"]].map(([k, t]) => <button key={k} onClick={() => setEscopo(k)} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={escopo === k ? { background: C.accent, color: "#fff" } : { background: C.panel2, color: C.text }}>{t}</button>)}
        <span className="w-3" />
        {[["ABERTAS", "Em aberto"], ["CONCLUIDAS", "Concluídas"], ["TODAS", "Todas"]].map(([k, t]) => <button key={k} onClick={() => setVer(k)} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={ver === k ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}>{t}</button>)}
      </div>
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
      {d && (
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          {grupos.filter(([, l]) => l.length).map(([t, l, cor]) => (
            <div key={t}>
              {t && <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase" style={{ color: cor }}>{t} · {l.length}</div>}
              {l.map((x) => <LinhaTarefa key={x.id} t={x} proj={P[x.projetoId]} user={user} H={H} agora={agora} onAbrir={() => setAbrir(x.id)} onAcao={acao} />)}
            </div>
          ))}
          {!lista.length && <div className="px-4 py-10 text-center text-sm" style={{ color: C.sub }}>Nenhuma demanda aqui.</div>}
        </div>
      )}
      {form && <TarefaForm user={user} inicial={form} usuarios={d?.usuarios || []} projetos={d?.projetos || []} onClose={() => setForm(null)} onOk={() => { setForm(null); carregar(); }} />}
      {abrir && <TarefaDetalhe user={user} id={abrir} usuarios={d?.usuarios || []} projetos={d?.projetos || []} onClose={() => setAbrir(null)} onMudou={carregar} />}
    </div>
  );
}

export function LinhaTarefa({ t, proj, user, H, agora, onAbrir, onAcao, compacta }) {
  const [, cor] = TIPO[t.tipo] || TIPO.PADRAO;
  const meu = t.responsavelId === user.id;
  const rodando = !!t.sessaoAberta;
  const feitas = (t.subtarefas || []).filter((s) => s.feita).length;
  const atrasada = t.status !== "CONCLUIDA" && t.prazo < H;
  return (
    <div onClick={onAbrir} className="anim-entrar flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}`, borderLeft: `4px solid ${cor}`, transition: "background .15s" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: C.text, textDecoration: t.status === "CONCLUIDA" ? "line-through" : "none" }}>{t.titulo}</span>
          <ChipTipo tipo={t.tipo} />
          {!t.publica && <Lock size={12} style={{ color: C.sub }} title="Privada" />}
          {t.natureza === "PESSOAL" && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#F3E8FF", color: "#7E3AF2" }}>PESSOAL</span>}
          {proj && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: C.sub }}><span className="rounded-[3px]" style={{ width: 10, height: 10, background: proj.cor }} />{proj.nome}</span>}
          {t.serieId && <Repeat size={12} style={{ color: C.blue }} title={t.recorrenciaTexto} />}
          {t.bloqueada && <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: C.yellow }}><Link2 size={11} /> aguardando</span>}
        </div>
        <div className="text-[11px] flex flex-wrap gap-x-3" style={{ color: C.sub }}>
          <span style={{ color: atrasada ? C.red : C.sub, fontWeight: atrasada ? 700 : 400 }}>{dBR(t.prazo)}{t.hora ? ` · ${t.hora}${t.horaFim ? `–${t.horaFim}` : ""}` : ""}</span>
          <span>{NOME_SETOR_TAREFA[t.setor]}</span>
          {!compacta && <span>{t.responsavelNome}{t.criadoPorId !== t.responsavelId ? ` · pedido por ${t.criadoPorNome}` : ""}</span>}
          {t.subtarefas?.length > 0 && <span className="flex items-center gap-0.5"><ListChecks size={11} /> {feitas}/{t.subtarefas.length}</span>}
          {t.nArquivos > 0 && <span className="flex items-center gap-0.5"><Paperclip size={11} /> {t.nArquivos}</span>}
          {(t.tempoTotal > 0 || rodando) && <span className="flex items-center gap-0.5"><Clock size={11} /> {duracao(t.tempoTotal + (rodando ? (agora - new Date(t.sessaoAberta.inicio)) / 1000 : 0))}</span>}
        </div>
      </div>
      {meu && t.status !== "CONCLUIDA" && (
        <button onClick={(e) => { e.stopPropagation(); onAcao(t, rodando ? "stop" : "play"); }} disabled={!rodando && t.bloqueada} title={rodando ? "Encerrar (pausar)" : t.bloqueada ? "Aguardando dependências" : "Iniciar o trabalho"}
          className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, background: rodando ? C.yellow : C.greenSoft, color: rodando ? "#fff" : C.green, opacity: !rodando && t.bloqueada ? 0.4 : 1 }}>
          {rodando ? <Square size={12} fill="#fff" /> : <Play size={13} fill={C.green} />}
        </button>
      )}
      {t.status === "CONCLUIDA" && <CheckCircle2 size={18} style={{ color: C.green }} />}
    </div>
  );
}

/* ======================= formulário (nova / editar) ======================= */
export function TarefaForm({ user, inicial, usuarios, projetos = [], onClose, onOk }) {
  const ed = !!inicial.id;
  const criador = ed ? inicial.criadoPorId : user.id;
  const [f, setF] = useState({
    hora: inicial.hora || "", horaFim: inicial.horaFim || "", natureza: inicial.natureza === "PESSOAL" ? "PESSOAL" : "FUNCIONAL", projetoId: inicial.projetoId || "",
    titulo: inicial.titulo || "", descricao: inicial.descricao || "", setor: inicial.setor || setorTarefaDe(user), responsavelId: inicial.responsavelId || "",
    prazo: inicial.prazo || hojeISO(), tipo: inicial.tipo === "URGENTE" ? "URGENTE" : "PADRAO", publica: inicial.publica !== false,
    rec: { tipo: "NENHUMA", ...(inicial.recorrencia || {}) }, subtarefas: inicial.subtarefas || [], dependencias: inicial.dependencias || [], aplicarSerie: false,
  });
  const [todos, setTodos] = useState(false);
  const [nova, setNova] = useState("");
  const [arqs, setArqs] = useState([]);
  const [publicas, setPublicas] = useState(null);
  const [buscaDep, setBuscaDep] = useState("");
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setRec = (k, v) => setF((x) => ({ ...x, rec: { ...x.rec, [k]: v } }));
  useEffect(() => { api(`/api/tarefas?u=${user.id}&escopo=todas&pendentes=1`).then((j) => setPublicas(j.tarefas.filter((t) => t.publica && t.id !== inicial.id))).catch(() => setPublicas([])); }, []);
  const doSetor = usuarios.filter((u) => u.setorTarefa === f.setor);
  const lista = todos || !doSetor.length ? usuarios : doSetor;
  const recorrente = f.rec.tipo && f.rec.tipo !== "NENHUMA";
  // v226 — atribuída por outra pessoa: funcional e pública · pessoal: sempre privada e para quem cria
  const atribuida = !!f.responsavelId && Number(f.responsavelId) !== criador;
  const pessoal = f.natureza === "PESSOAL" && !atribuida;
  const publicaFinal = atribuida ? true : pessoal ? false : f.publica;
  const setNatureza = (n) => setF((x) => ({ ...x, natureza: n, ...(n === "PESSOAL" ? { responsavelId: criador, publica: false } : {}) }));
  const dPrazo = f.prazo ? dUTC(f.prazo) : new Date();
  const salvar = async () => {
    setSt(true); setErro("");
    const t = { titulo: f.titulo, descricao: f.descricao, setor: f.setor, responsavelId: Number(f.responsavelId), prazo: f.prazo, tipo: recorrente ? (f.tipo === "URGENTE" ? "URGENTE" : "ROTINA") : f.tipo,
      publica: publicaFinal, subtarefas: f.subtarefas, dependencias: f.dependencias, recorrencia: recorrente ? f.rec : null, aplicarSerie: f.aplicarSerie,
      hora: f.hora || null, horaFim: f.horaFim || null, natureza: pessoal ? "PESSOAL" : "FUNCIONAL", projetoId: Number(f.projetoId) || null };
    try {
      const r = ed ? await api(`/api/tarefas/${inicial.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: t }) : await api("/api/tarefas", "POST", { usuarioId: user.id, tarefa: t });
      const id = r.tarefa?.id;
      for (const a of arqs) if (id) await api(`/api/tarefas/${id}/arquivos`, "POST", { usuarioId: user.id, nome: a.name, mime: a.type, conteudo: await readB64(a) });
      onOk();
    } catch (e) { setSt(false); setErro(e.message); }
  };
  const depsSel = (publicas || []).filter((t) => f.dependencias.includes(t.id));
  const depsOpc = (publicas || []).filter((t) => !f.dependencias.includes(t.id) && buscaDep && `${t.titulo} ${t.responsavelNome} #${t.id}`.toUpperCase().includes(buscaDep.toUpperCase())).slice(0, 8);
  return (
    <Janela titulo={ed ? `Editar demanda #${inicial.id}` : "Nova demanda"} onClose={onClose} largura={720}
      rodape={<>
        {erro && <span className="text-xs mr-auto" style={{ color: C.red }}>{erro}</span>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} disabled={st || !f.titulo.trim() || !f.responsavelId || !f.prazo} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff", opacity: st || !f.titulo.trim() || !f.responsavelId ? 0.5 : 1 }}>
          {st && <Loader2 size={14} className="animate-spin" />} {ed ? "Salvar" : "Criar demanda"}
        </button>
      </>}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-xs" style={{ color: C.sub }}>Natureza
          <div className="flex gap-1 mt-1">
            {[["FUNCIONAL", "Funcional"], ["PESSOAL", "Pessoal"]].map(([k, t]) => {
              const off = k === "PESSOAL" && atribuida;
              const sel = (pessoal ? "PESSOAL" : "FUNCIONAL") === k;
              return <button key={k} disabled={off} onClick={() => setNatureza(k)} title={off ? "Demanda para outra pessoa é sempre funcional e pública" : ""}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold" style={sel ? { background: k === "PESSOAL" ? "#7E3AF2" : "#4573D2", color: "#fff", transition: "all .18s" } : { background: C.panel2, color: off ? C.cinza : C.text, transition: "all .18s" }}>{t}</button>;
            })}
          </div>
        </div>
        <label className="text-xs" style={{ color: C.sub }}>Projeto
          <div className="flex items-center gap-2 mt-1">
            {f.projetoId && <span className="rounded-[4px] shrink-0" style={{ width: 14, height: 14, background: (projetos.find((p) => p.id === Number(f.projetoId)) || {}).cor }} />}
            <select value={f.projetoId} onChange={(e) => set("projetoId", e.target.value)} className={inp} style={inpS}>
              <option value="">— sem projeto —</option>
              {projetos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="text-xs" style={{ color: C.sub }}>Setor
          <select value={f.setor} onChange={(e) => { set("setor", e.target.value); set("responsavelId", ""); }} className={`${inp} mt-1`} style={inpS}>{SETORES_TAREFA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
        </label>
        <label className="text-xs" style={{ color: C.sub }}>Colaborador
          <select value={f.responsavelId} disabled={pessoal} onChange={(e) => set("responsavelId", e.target.value)} className={`${inp} mt-1`} style={inpS}>
            <option value="">— escolha —</option>
            {lista.map((u) => <option key={u.id} value={u.id}>{u.nome}{u.id === user.id ? " (eu)" : ""}{todos ? ` · ${NOME_SETOR_TAREFA[u.setorTarefa]}` : ""}</option>)}
          </select>
          <span className="flex items-center gap-1 mt-0.5 text-[10px]"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> mostrar pessoas de todos os setores</span>
        </label>
      </div>
      <label className="block text-xs mb-3" style={{ color: C.sub }}>Demanda
        <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus placeholder="O que precisa ser feito" className={`${inp} mt-1`} style={inpS} />
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={3} placeholder="Detalhes (opcional)" className={`${inp} mt-1`} style={{ ...inpS, resize: "vertical" }} />
      </label>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <label className="text-xs" style={{ color: C.sub }}>{recorrente ? "Primeira data" : "Data limite"}<input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Horário (opcional)<input type="time" value={f.hora} onChange={(e) => set("hora", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Até<input type="time" value={f.horaFim} disabled={!f.hora} onChange={(e) => set("horaFim", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-xs" style={{ color: C.sub }}>Status
          <div className="flex gap-1 mt-1">
            {(recorrente ? [["ROTINA", "Rotina"], ["URGENTE", "Urgente"]] : [["PADRAO", "Padrão"], ["URGENTE", "Urgente"]]).map(([k, t]) => {
              const sel = recorrente ? (k === "URGENTE" ? f.tipo === "URGENTE" : f.tipo !== "URGENTE") : f.tipo === k;
              const [, c, bg] = TIPO[k];
              return <button key={k} onClick={() => set("tipo", k === "ROTINA" ? "PADRAO" : k)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold" style={sel ? { background: c, color: "#fff" } : { background: bg, color: c }}>{t}</button>;
            })}
          </div>
        </div>
        <div className="text-xs" style={{ color: C.sub }}>Visibilidade
          <div className="flex gap-1 mt-1">
            <button disabled={atribuida || pessoal} onClick={() => set("publica", true)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={publicaFinal ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}><Globe size={12} /> Pública</button>
            <button disabled={atribuida || pessoal} onClick={() => set("publica", false)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={!publicaFinal ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}><Lock size={12} /> Privada</button>
          </div>
        </div>
      </div>
      {(atribuida || pessoal || !publicaFinal) && <div className="text-[11px] mb-3 -mt-1" style={{ color: C.sub }}>
        {atribuida ? "Demanda para outra pessoa: sempre funcional e pública." : pessoal ? "Pessoal: sempre privada — só você enxerga." : "Privada: só o colaborador que recebe enxerga a demanda."}</div>}

      {/* recorrência */}
      {/* v283 — recorrência também na edição: marcar uma avulsa como rotina, trocar a regra (vale desta em diante) ou deixar de repetir */}
      {(
        <div className="rounded-lg p-3 mb-3" style={{ background: C.panel2 }}>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Repeat size={14} style={{ color: C.blue }} />
            <select value={f.rec.tipo} onChange={(e) => setRec("tipo", e.target.value)} className="rounded-lg px-2 py-1 text-xs outline-none" style={inpS}>{TIPOS_REC.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            {["SEMANAL", "QUINZENAL", "MENSAL_NTH"].includes(f.rec.tipo) && f.rec.tipo === "MENSAL_NTH" && (
              <select value={f.rec.n ?? Math.min(4, Math.ceil(dPrazo.getUTCDate() / 7))} onChange={(e) => setRec("n", Number(e.target.value))} className="rounded-lg px-2 py-1 text-xs outline-none" style={inpS}>{ORDINAIS.map(([n, t]) => <option key={n} value={n}>{t}</option>)}</select>
            )}
            {["SEMANAL", "QUINZENAL", "MENSAL_NTH"].includes(f.rec.tipo) && (
              <select value={f.rec.dow ?? dPrazo.getUTCDay()} onChange={(e) => setRec("dow", Number(e.target.value))} className="rounded-lg px-2 py-1 text-xs outline-none" style={inpS}>{DIAS_SEMANA.map((t, i) => <option key={i} value={i}>{t}</option>)}</select>
            )}
            {["MENSAL_DIA", "ANUAL"].includes(f.rec.tipo) && <>dia <input type="number" min={1} max={31} value={f.rec.dia ?? dPrazo.getUTCDate()} onChange={(e) => setRec("dia", Number(e.target.value))} className="w-14 rounded-lg px-2 py-1 text-xs outline-none" style={inpS} /></>}
            {f.rec.tipo === "ANUAL" && <select value={f.rec.mes ?? dPrazo.getUTCMonth() + 1} onChange={(e) => setRec("mes", Number(e.target.value))} className="rounded-lg px-2 py-1 text-xs outline-none" style={inpS}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>}
            {recorrente && <>até <input type="date" value={f.rec.ate || ""} onChange={(e) => setRec("ate", e.target.value)} className="rounded-lg px-2 py-1 text-xs outline-none" style={inpS} /><span style={{ color: C.sub }}>(vazio = sem fim)</span></>}
          </div>
          {recorrente && f.rec.tipo !== "DIARIA" && <label className="flex items-center gap-2 text-xs mt-2" style={{ color: C.text }}>
            <input type="checkbox" checked={!!f.rec.uteis} onChange={(e) => setRec("uteis", e.target.checked)} /> Só em dias úteis — se cair em sábado, domingo ou feriado, passa para o próximo dia útil</label>}
          {recorrente && f.rec.tipo === "DIARIA" && <label className="flex items-center gap-2 text-xs mt-2" style={{ color: C.text }}>
            <input type="checkbox" checked={!!f.rec.uteis} onChange={(e) => setRec("uteis", e.target.checked)} /> Pular também os feriados nacionais</label>}
          {ed && inicial.serieId && <div className="text-[11px] mt-1.5" style={{ color: C.sub }}>Mudar a repetição vale desta ocorrência em diante · "Não se repete" encerra a rotina depois desta.</div>}
          {ed && !inicial.serieId && recorrente && <div className="text-[11px] mt-1.5" style={{ color: C.sub }}>Esta demanda vira a primeira ocorrência da rotina.</div>}
          {recorrente && <div className="text-[11px] mt-1.5" style={{ color: C.blue }}>Repete {descreverRecorrencia({ ...f.rec, dow: f.rec.dow ?? dPrazo.getUTCDay(), dia: f.rec.dia ?? dPrazo.getUTCDate(), n: f.rec.n ?? Math.min(4, Math.ceil(dPrazo.getUTCDate() / 7)), mes: f.rec.mes ?? dPrazo.getUTCMonth() + 1 })} · vira rotina (azul) automaticamente.</div>}
        </div>
      )}
      {ed && inicial.serieId && <label className="flex items-center gap-2 text-xs mb-3" style={{ color: C.text }}><input type="checkbox" checked={f.aplicarSerie} onChange={(e) => set("aplicarSerie", e.target.checked)} /> aplicar também às próximas ocorrências da rotina ({inicial.recorrenciaTexto})</label>}

      {/* subtarefas */}
      <div className="mb-3">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><ListChecks size={13} /> Subtarefas</div>
        {f.subtarefas.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm py-0.5">
            <input type="checkbox" checked={!!s.feita} onChange={(e) => set("subtarefas", f.subtarefas.map((x, j) => (j === i ? { ...x, feita: e.target.checked } : x)))} />
            <span className="flex-1" style={{ textDecoration: s.feita ? "line-through" : "none" }}>{s.texto}</span>
            <button onClick={() => set("subtarefas", f.subtarefas.filter((_, j) => j !== i))} style={{ color: C.sub }}><X size={13} /></button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && nova.trim()) { set("subtarefas", [...f.subtarefas, { texto: nova.trim(), feita: false }]); setNova(""); } }} placeholder="Adicionar subtarefa e Enter" className="flex-1 rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
          <Btn fundo={C.panel2} cor={C.text} onClick={() => { if (nova.trim()) { set("subtarefas", [...f.subtarefas, { texto: nova.trim(), feita: false }]); setNova(""); } }}><Plus size={12} /></Btn>
        </div>
      </div>

      {/* dependências */}
      <div className="mb-3">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><Link2 size={13} /> Depende da conclusão de (demandas públicas de qualquer pessoa)</div>
        {depsSel.map((t) => <div key={t.id} className="flex items-center gap-2 text-xs py-0.5"><span className="font-semibold">#{t.id}</span><span className="flex-1 truncate">{t.titulo}</span><span style={{ color: C.sub }}>{t.responsavelNome} · {dBR(t.prazo)}</span><button onClick={() => set("dependencias", f.dependencias.filter((x) => x !== t.id))} style={{ color: C.sub }}><X size={13} /></button></div>)}
        <div className="relative">
          <input value={buscaDep} onChange={(e) => setBuscaDep(e.target.value)} placeholder={publicas ? "Buscar demanda pública…" : "carregando…"} className="w-full rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
          {depsOpc.length > 0 && <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg shadow-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            {depsOpc.map((t) => <button key={t.id} onClick={() => { set("dependencias", [...f.dependencias, t.id]); setBuscaDep(""); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50">#{t.id} {t.titulo} <span style={{ color: C.sub }}>· {t.responsavelNome} · {dBR(t.prazo)}</span></button>)}
          </div>}
        </div>
      </div>

      {/* arquivos (na criação; depois, pelo detalhe) */}
      {!ed && (
        <div>
          <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><Paperclip size={13} /> Arquivos</div>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ background: C.panel2, color: C.text }}><Upload size={12} /> anexar
            <input type="file" multiple className="hidden" onChange={(e) => { setArqs((a) => [...a, ...e.target.files]); e.target.value = ""; }} />
          </label>
          {arqs.map((a, i) => <div key={i} className="flex items-center gap-2 text-xs py-0.5"><FileText size={12} /> <span className="flex-1 truncate">{a.name}</span><button onClick={() => setArqs((x) => x.filter((_, j) => j !== i))} style={{ color: C.sub }}><X size={12} /></button></div>)}
        </div>
      )}
    </Janela>
  );
}

/* ======================= detalhe ======================= */
export function TarefaDetalhe({ user, id, usuarios, projetos = [], onClose, onMudou }) {
  const [t, setT] = useState(null);
  const [erro, setErro] = useState("");
  const [editar, setEditar] = useState(false);
  const [concluir, setConcluir] = useState(false);
  const [retorno, setRetorno] = useState("");
  const agora = useAgora();
  const carregar = () => api(`/api/tarefas/${id}?u=${user.id}`).then(setT).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, [id]);
  const acao = async (a, extra = {}) => { try { await api(`/api/tarefas/${id}`, "PATCH", { usuarioId: user.id, acao: a, ...extra }); await carregar(); onMudou?.(); } catch (e) { alerta(e.message); } };
  const excluir = async () => { if (!(await confirmar("Excluir esta demanda?"))) return; try { await api(`/api/tarefas/${id}`, "DELETE", { usuarioId: user.id }); onMudou?.(); onClose(); } catch (e) { alerta(e.message); } };
  const anexar = async (fs) => { for (const f of fs) { try { await api(`/api/tarefas/${id}/arquivos`, "POST", { usuarioId: user.id, nome: f.name, mime: f.type, conteudo: await readB64(f) }); } catch (e) { alerta(e.message); } } carregar(); onMudou?.(); };
  const tirarArq = async (a) => { if (!(await confirmar(`Excluir ${a.nome}?`))) return; try { await api(`/api/tarefas/${id}/arquivos`, "DELETE", { usuarioId: user.id, arquivoId: a.id }); carregar(); } catch (e) { alerta(e.message); } };
  if (editar && t) return <TarefaForm user={user} inicial={t} usuarios={usuarios} projetos={projetos} onClose={() => setEditar(false)} onOk={() => { setEditar(false); carregar(); onMudou?.(); }} />;
  const proj = t?.projetoId ? projetos.find((p) => p.id === t.projetoId) : null;
  const Linha = ({ k, children }) => <div className="flex items-center py-2 text-sm" style={{ borderBottom: "1px solid #F2F0F0" }}><div className="w-44 shrink-0" style={{ color: "#6D6E6F" }}>{k}</div><div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap" style={{ color: "#1E1F21" }}>{children}</div></div>;
  const meu = t && t.responsavelId === user.id;
  const rodando = !!t?.sessaoAberta;
  return (
    <Janela gaveta titulo={t ? `Demanda #${t.id}` : "Demanda"} onClose={onClose} largura={700}
      rodape={t && <>
        {t.podeEditar && <button onClick={excluir} className="mr-auto text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
        {t.serieId && t.podeEditar && <Btn fundo={C.blueSoft} cor={C.blue} onClick={async () => (await confirmar("Encerrar a rotina? As próximas ocorrências em aberto são canceladas.")) && acao("encerrarSerie")}><Repeat size={12} /> Encerrar rotina</Btn>}
        {t.podeEditar && <Btn fundo={C.panel} cor={C.text} onClick={() => setEditar(true)} style={{ border: `1px solid ${C.line}` }}><Pencil size={12} /> Editar</Btn>}
        {meu && t.status !== "CONCLUIDA" && <Btn cor={rodando ? C.yellow : C.green} disabled={!rodando && t.bloqueada} onClick={() => acao(rodando ? "stop" : "play")}>{rodando ? <><Square size={11} fill="#fff" /> Encerrar</> : <><Play size={12} fill="#fff" /> Iniciar</>}</Btn>}
        {t.status !== "CONCLUIDA" ? (meu || t.podeEditar) && <Btn onClick={() => setConcluir(true)}><CheckCircle2 size={13} /> Concluir</Btn>
          : t.podeEditar && <Btn fundo={C.panel2} cor={C.text} onClick={() => acao("reabrir")}><RotateCcw size={12} /> Reabrir</Btn>}
      </>}>
      {erro && <div className="p-3 rounded-lg text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!t && !erro && <Loader2 size={18} className="animate-spin" style={{ color: C.sub }} />}
      {t && <>
        {/* v226 — layout do detalhe no estilo Asana */}
        <div className="text-2xl font-bold mb-4" style={{ color: "#1E1F21", textDecoration: t.status === "CONCLUIDA" ? "line-through" : "none" }}>{t.titulo.charAt(0) + t.titulo.slice(1).toLowerCase()}</div>
        <div className="mb-4">
          <Linha k="Responsável"><b>{t.responsavelNome}</b>{t.criadoPorId !== t.responsavelId && <span className="text-xs" style={{ color: C.sub }}>pedido por {t.criadoPorNome} em {dBR(t.createdAt)}</span>}</Linha>
          <Linha k="Data de conclusão"><span style={{ color: t.status !== "CONCLUIDA" && t.prazo < hojeISO() ? C.red : t.prazo === hojeISO() ? C.green : "#1E1F21", fontWeight: 600 }}>{t.prazo === hojeISO() ? "Hoje" : dBR(t.prazo)}</span>{t.hora && <span className="flex items-center gap-1"><Clock size={13} /> {t.hora}{t.horaFim ? `–${t.horaFim}` : ""}</span>}{t.recorrenciaTexto && <span className="flex items-center gap-1 text-xs" style={{ color: C.blue }}><Repeat size={12} /> {t.recorrenciaTexto}</span>}</Linha>
          <Linha k="Projeto">{proj ? <span className="flex items-center gap-1.5"><span className="rounded-[4px]" style={{ width: 12, height: 12, background: proj.cor }} />{proj.nome}</span> : <span style={{ color: C.sub }}>—</span>}</Linha>
          <Linha k="Natureza"><span className="px-2 py-0.5 rounded text-xs font-semibold" style={t.natureza === "PESSOAL" ? { background: "#F3E8FF", color: "#7E3AF2" } : { background: "#EAF0FB", color: "#4573D2" }}>{t.natureza === "PESSOAL" ? "Pessoal" : "Funcional"}</span><span className="flex items-center gap-1 text-xs" style={{ color: C.sub }}>{t.publica ? <><Globe size={12} /> pública</> : <><Lock size={12} /> privada</>}</span></Linha>
          <Linha k="Prioridade"><ChipTipo tipo={t.tipo} /></Linha>
          <Linha k="Setor">{NOME_SETOR_TAREFA[t.setor]}</Linha>
        </div>
        {t.descricao && <div className="text-sm whitespace-pre-wrap mb-3 p-3 rounded-lg" style={{ background: C.panel2 }}>{t.descricao}</div>}
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg" style={{ border: `1px solid ${rodando ? C.yellow : C.line}`, background: rodando ? C.yellowSoft : C.panel }}>
          <Clock size={16} style={{ color: rodando ? C.yellow : C.sub }} />
          <div className="text-sm"><b>{duracao(t.tempoTotal + (rodando ? (agora - new Date(t.sessaoAberta.inicio)) / 1000 : 0))}</b> de trabalho registrado{rodando && <span style={{ color: C.yellow }}> · em andamento há {duracao((agora - new Date(t.sessaoAberta.inicio)) / 1000)}</span>}</div>
          <div className="text-[11px] ml-auto" style={{ color: C.sub }}>{t.sessoes.length} sessão(ões)</div>
        </div>
        {t.deps.length > 0 && <div className="mb-3">
          <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><Link2 size={13} /> Depende de</div>
          {t.deps.map((x) => <div key={x.id} className="text-xs flex items-center gap-2 py-0.5">{x.status === "CONCLUIDA" ? <CheckCircle2 size={13} style={{ color: C.green }} /> : <Clock size={13} style={{ color: C.yellow }} />}<span>#{x.id} {x.titulo}</span><span style={{ color: C.sub }}>· {x.responsavelNome} · {dBR(x.prazo)}</span></div>)}
          {t.bloqueada && <div className="text-[11px] mt-1" style={{ color: C.yellow }}>O play libera quando todas estiverem concluídas.</div>}
        </div>}
        {t.dependentes?.length > 0 && <div className="mb-3 text-xs" style={{ color: C.sub }}>Esperando por esta: {t.dependentes.map((x) => `#${x.id} ${x.titulo} (${x.responsavelNome})`).join(" · ")}</div>}
        {t.subtarefas.length > 0 && <div className="mb-3">
          <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><ListChecks size={13} /> Subtarefas {t.subtarefas.filter((s) => s.feita).length}/{t.subtarefas.length}</div>
          {t.subtarefas.map((s, i) => <label key={i} className="flex items-center gap-2 text-sm py-0.5"><input type="checkbox" checked={!!s.feita} disabled={!(meu || t.podeEditar)} onChange={(e) => acao("subtarefa", { indice: i, feita: e.target.checked })} /><span style={{ textDecoration: s.feita ? "line-through" : "none" }}>{s.texto}</span></label>)}
        </div>}
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1 flex items-center gap-2" style={{ color: C.sub }}><Paperclip size={13} /> Arquivos ({t.arquivos.length})
            {(meu || t.podeEditar) && <label className="text-[11px] font-semibold cursor-pointer" style={{ color: C.accent }}>+ anexar<input type="file" multiple className="hidden" onChange={(e) => { anexar([...e.target.files]); e.target.value = ""; }} /></label>}
          </div>
          {t.arquivos.map((a) => <div key={a.id} className="flex items-center gap-2 text-xs py-0.5"><FileText size={12} style={{ color: C.accent }} /><a href={`/api/tarefas/${t.id}/arquivos?u=${user.id}&arquivo=${a.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate" style={{ color: C.blue }}>{a.nome}</a><span style={{ color: C.sub }}>{a.criadoPorNome}</span><button onClick={() => tirarArq(a)} style={{ color: C.sub }}><Trash2 size={12} /></button></div>)}
        </div>
        {t.status === "CONCLUIDA" && <div className="rounded-lg p-3 text-sm mb-2" style={{ background: C.greenSoft }}><div className="text-[11px] font-semibold mb-1" style={{ color: C.green }}>CONCLUÍDA por {t.concluidaPorNome} em {dBR(t.concluidaEm)}</div>{t.retorno && <div className="whitespace-pre-wrap">{t.retorno}</div>}</div>}
        {t.sessoes.length > 0 && <details className="text-xs" style={{ color: C.sub }}><summary className="cursor-pointer">Histórico de trabalho</summary>
          {t.sessoes.map((s) => <div key={s.id} className="py-0.5">{s.usuarioNome} · {new Date(s.inicio).toLocaleString("pt-BR")} → {s.fim ? new Date(s.fim).toLocaleTimeString("pt-BR") : "agora"} · {duracao(s.fim ? s.segundos : (agora - new Date(s.inicio)) / 1000)}</div>)}
        </details>}
        {concluir && <div className="mt-3 p-3 rounded-lg" style={{ border: `1px solid ${C.green}` }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Retorno (o que foi feito — opcional; quem pediu recebe uma mensagem)</div>
          <textarea value={retorno} onChange={(e) => setRetorno(e.target.value)} rows={3} className={inp} style={inpS} />
          <div className="flex justify-end gap-2 mt-2"><Btn fundo={C.panel2} cor={C.text} onClick={() => setConcluir(false)}>Cancelar</Btn><Btn cor={C.green} onClick={async () => { await acao("concluir", { retorno }); setConcluir(false); }}><CheckCircle2 size={13} /> Concluir</Btn></div>
        </div>}
      </>}
    </Janela>
  );
}

/* ======================= Agenda (v226 — estilo Asana) ======================= */
// Paleta inspirada no Asana (a fonte continua a do sistema)
const A = {
  fundo: "#FFFFFF", fundo2: "#F9F8F8", linha: "#EDEAE9", texto: "#1E1F21", sub: "#6D6E6F", azul: "#4573D2", azulSoft: "#EAF0FB",
  cardAzul: "#9EBEF8", cardAzulBorda: "#8AB0F5", cardVerm: "#F6B2AE", cardVermBorda: "#EE9590", cardBranco: "#FFFFFF", cardBrancoBorda: "#D5D2D1",
};
export const CORES_PROJ = ["#4573D2", "#5DA283", "#E8384F", "#FD612C", "#F1BD6C", "#9E47FF", "#4ECBC4", "#E362E3", "#8D84E8", "#FC979A", "#AECF55", "#6D6E6F"];
const SEM_SEG = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const inicioSemanaSeg = (s) => somaDia(s, -((dUTC(s).getUTCDay() + 6) % 7));   // segunda-feira
const iniciais = (n) => String(n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("");
function AvatarMini({ foto, nome, size = 22 }) {
  return foto ? <img src={foto} alt="" className="rounded-full shrink-0 object-cover" style={{ width: size, height: size }} />
    : <span className="rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ width: size, height: size, background: "#C7C4C4", color: "#fff" }}>{iniciais(nome)}</span>;
}
const corCard = (t) => t.tipo === "URGENTE" ? [A.cardVerm, A.cardVermBorda] : t.tipo === "ROTINA" ? [A.cardAzul, A.cardAzulBorda] : [A.cardBranco, A.cardBrancoBorda];
const horaTxt = (t) => (t.hora ? `${t.hora}${t.horaFim ? `–${t.horaFim}` : ""}` : "");

function CardAgenda({ t, proj, foto, onClick, onDragStart, onConcluir, onMenu }) {
  // v228 — card do tamanho fixo do Asana: título cortado numa linha; no hover o conteúdo desliza e aparece o check
  const [bg, bd] = corCard(t);
  const feita = t.status === "CONCLUIDA";
  return (
    <div draggable={t.podeEditar} onDragStart={onDragStart} onClick={onClick} onContextMenu={(e) => { e.preventDefault(); onMenu?.(e.clientX, e.clientY); }}
      title={`${t.titulo}${t.hora ? ` · ${horaTxt(t)}` : ""}`}
      className="card-asana group relative rounded-md flex items-center overflow-hidden cursor-pointer select-none shrink-0"
      style={{ height: 36, background: bg, border: `1px solid ${bd}`, color: A.texto, opacity: feita ? 0.6 : 1 }}>
      <button onClick={(e) => { e.stopPropagation(); onConcluir?.(); }} title={feita ? "Reabrir" : "Concluir"}
        className={`absolute left-1.5 flex items-center justify-center rounded-full ${feita ? "" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"}`}
        style={{ width: 18, height: 18, border: `1.5px solid ${feita ? "#5DA283" : "#6D6E6F"}`, background: feita ? "#5DA283" : "rgba(255,255,255,.7)", transition: "all .18s ease" }}>
        <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke={feita ? "#fff" : "#6D6E6F"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className={`flex items-center gap-1.5 min-w-0 flex-1 pl-2 pr-1 ${feita ? "translate-x-5" : "group-hover:translate-x-5"}`} style={{ transition: "transform .18s ease" }}>
        <AvatarMini foto={foto} nome={t.responsavelNome} size={20} />
        <span className="truncate text-[12.5px] leading-none" style={{ textDecoration: feita ? "line-through" : "none" }}>
          {t.hora && <b className="mr-1">{t.hora}</b>}{t.titulo.charAt(0) + t.titulo.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="flex items-center gap-1 pr-2 shrink-0">
        {t.sessaoAberta && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.yellow }} />}
        {t.natureza === "PESSOAL" && <Lock size={10} style={{ color: A.sub }} />}
        {proj && <span className="rounded-[3px]" title={proj.nome} style={{ width: 11, height: 11, background: proj.cor }} />}
      </div>
    </div>
  );
}

// menu do botão direito sobre o card
function MenuCard({ x, y, t, onClose, onAbrir, onConcluir, onExcluir }) {
  useEffect(() => { const f = () => onClose(); window.addEventListener("click", f); window.addEventListener("scroll", f, true); return () => { window.removeEventListener("click", f); window.removeEventListener("scroll", f, true); }; }, []);
  const feita = t.status === "CONCLUIDA";
  const It = ({ cor, children, onClick }) => <button onClick={(e) => { e.stopPropagation(); onClose(); onClick(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50" style={{ color: cor || A.texto }}>{children}</button>;
  return (
    <div className="fixed z-[60] rounded-lg shadow-xl py-1 anim-modal" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
      style={{ left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 200), top: Math.min(y, (typeof window !== "undefined" ? window.innerHeight : 800) - 140), width: 190, background: "#fff", border: `1px solid ${A.linha}` }}>
      <div className="px-3 py-1.5 text-[11px] truncate" style={{ color: A.sub }}>{t.titulo}</div>
      <It onClick={onAbrir}><FileText size={14} /> Abrir</It>
      <It onClick={onConcluir} cor={feita ? A.texto : "#3F8A5F"}><CheckCircle2 size={14} /> {feita ? "Reabrir" : "Concluir"}</It>
      <It onClick={onExcluir} cor={C.red}><Trash2 size={14} /> Excluir</It>
    </div>
  );
}

function ProjetoForm({ user, inicial, onClose, onOk }) {
  const [f, setF] = useState({ nome: inicial?.nome || "", cor: inicial?.cor || CORES_PROJ[0], publico: inicial?.publico !== false });
  const [st, setSt] = useState(false), [erro, setErro] = useState("");
  const salvar = async () => { setSt(true); setErro(""); try { await api("/api/tarefas/projetos", "POST", { usuarioId: user.id, projeto: { id: inicial?.id, ...f } }); onOk(); } catch (e) { setErro(e.message); setSt(false); } };
  const excluir = async () => { if (!(await confirmar(`Excluir o projeto "${inicial.nome}"? As tarefas ficam, só saem do projeto.`))) return; try { await api("/api/tarefas/projetos", "DELETE", { usuarioId: user.id, id: inicial.id }); onOk(); } catch (e) { alerta(e.message); } };
  return (
    <Janela titulo={inicial?.id ? "Editar projeto" : "Novo projeto"} onClose={onClose} largura={460}
      rodape={<>
        {inicial?.id && <button onClick={excluir} className="mr-auto text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
        {erro && <span className="text-xs mr-auto" style={{ color: C.red }}>{erro}</span>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={st || !f.nome.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: A.azul, opacity: st || !f.nome.trim() ? 0.5 : 1 }}>{inicial?.id ? "Salvar" : "Criar projeto"}</button>
      </>}>
      <label className="block text-xs mb-3" style={{ color: C.sub }}>Nome
        <input value={f.nome} autoFocus onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} className={`${inp} mt-1`} style={inpS} />
      </label>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Cor</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {CORES_PROJ.map((c) => <button key={c} onClick={() => setF((x) => ({ ...x, cor: c }))} className="rounded-md" style={{ width: 26, height: 26, background: c, boxShadow: f.cor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none", transform: f.cor === c ? "scale(1.1)" : "none" }} />)}
      </div>
      <div className="flex gap-1">
        <button onClick={() => setF((x) => ({ ...x, publico: true }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={f.publico ? { background: A.azul, color: "#fff" } : { background: C.panel2, color: C.text }}><Globe size={12} /> Visível para todos</button>
        <button onClick={() => setF((x) => ({ ...x, publico: false }))} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={!f.publico ? { background: A.azul, color: "#fff" } : { background: C.panel2, color: C.text }}><Lock size={12} /> Só eu</button>
      </div>
    </Janela>
  );
}

export function Agenda({ user }) {
  const [tela, setTela] = useState("calendario");   // calendario | tarefas
  const [modo, setModo] = useState("semana");        // abre na semana atual
  const [visao, setVisao] = useState("GERAL");       // GERAL | PESSOAL | FUNCIONAL
  const [projetoId, setProjetoId] = useState(null);
  const [ref, setRef] = useState(hojeISO());
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [abrir, setAbrir] = useState(null);
  const [projForm, setProjForm] = useState(null);
  const [arrastando, setArrastando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [dir, setDir] = useState(0);                 // direção da navegação (animação)
  const [menuCard, setMenuCard] = useState(null);    // { x, y, t } — botão direito
  const H = hojeISO();
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  const dias = useMemo(() => {
    if (modo === "semana") { const i = inicioSemanaSeg(ref); return Array.from({ length: 7 }, (_, k) => somaDia(i, k)); }
    const p = `${ref.slice(0, 7)}-01`, i = inicioSemanaSeg(p);
    const fimMes = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const n = Math.ceil((Math.round((dUTC(fimMes) - dUTC(i)) / 86400000) + 1) / 7) * 7;
    return Array.from({ length: n }, (_, k) => somaDia(i, k));
  }, [modo, ref]);
  const carregar = () => api(`/api/tarefas?u=${user.id}&escopo=${projetoId ? "todas" : "minhas"}${projetoId ? `&projeto=${projetoId}` : ""}&de=${dias[0]}&ate=${dias[dias.length - 1]}`)
    .then(setD).catch(() => setD({ tarefas: [], usuarios: [], projetos: [], equipe: [] }));
  useEffect(() => { carregar(); }, [dias[0], dias[dias.length - 1], projetoId]);
  const projetos = d?.projetos || [];
  const P = useMemo(() => Object.fromEntries(projetos.map((p) => [p.id, p])), [projetos]);
  const fotos = useMemo(() => Object.fromEntries((d?.equipe || []).map((x) => [x.id, x.foto])), [d]);
  // v283 — concluída sai do calendário (continua na lista de Tarefas, filtro "Concluídas")
  const filtradas = (d?.tarefas || []).filter((t) => t.status !== "CONCLUIDA" && (visao === "GERAL" || t.natureza === visao));
  const porDia = useMemo(() => filtradas.reduce((a, t) => { (a[t.prazo] ||= []).push(t); return a; }, {}), [d, visao]);
  Object.values(porDia).forEach((l) => l.sort((a, b) => (a.hora || "99") .localeCompare(b.hora || "99") || a.id - b.id));
  const mover = (n) => { setDir(n); setRef(modo === "semana" ? somaDia(ref, 7 * n) : (() => { const x = new Date(Date.UTC(ano, mes - 1 + n, 1)); return x.toISOString().slice(0, 10); })()); };
  const titulo = `${MESES[mes - 1]} de ${ano}`;
  const novaNoDia = (dia) => setForm({ prazo: dia, responsavelId: user.id, setor: setorTarefaDe(user), projetoId, natureza: visao === "PESSOAL" ? "PESSOAL" : "FUNCIONAL", publica: visao !== "PESSOAL" });
  const soltar = async (dia) => {
    const t = arrastando; setArrastando(null); setSobre(null);
    if (!t || t.prazo === dia) return;
    try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: { prazo: dia } }); carregar(); } catch (e) { alerta(e.message); }
  };
  const proj = projetoId ? P[projetoId] : null;
  const alternarConcluida = async (t) => {
    try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: t.status === "CONCLUIDA" ? "reabrir" : "concluir", retorno: "" }); carregar(); } catch (e) { alerta(e.message); }
  };
  const excluirTarefa = async (t) => {
    if (!(await confirmar(`Excluir "${t.titulo}"?`))) return;
    try { await api(`/api/tarefas/${t.id}`, "DELETE", { usuarioId: user.id }); carregar(); } catch (e) { alerta(e.message); }
  };
  const Aba = ({ k, t, atual, set }) => (
    <button onClick={() => set(k)} className="relative px-3 py-1.5 text-sm font-semibold rounded-md"
      style={{ color: atual === k ? A.azul : A.texto, background: atual === k ? A.azulSoft : "transparent", transition: "all .18s" }}>{t}</button>
  );

  return (
    <div className="flex gap-0 -m-6 anim-entrar" style={{ minHeight: "calc(100vh - 64px)", background: A.fundo }}>
      {/* lateral: projetos */}
      <aside className="shrink-0 py-4 px-2" style={{ width: 220, borderRight: `1px solid ${A.linha}`, background: A.fundo2 }}>
        <button onClick={() => setProjetoId(null)} className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
          style={{ background: !projetoId ? A.azulSoft : "transparent", color: !projetoId ? A.azul : A.texto, transition: "all .18s" }}><CalendarDays size={15} /> Minha agenda</button>
        <div className="flex items-center px-3 mt-4 mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: A.sub }}>
          <span className="flex-1">Projetos</span>
          <button onClick={() => setProjForm({})} title="Novo projeto" style={{ color: A.sub }}><Plus size={14} /></button>
        </div>
        {projetos.map((p) => (
          <div key={p.id} className="group flex items-center rounded-lg" style={{ background: projetoId === p.id ? A.azulSoft : "transparent", transition: "all .18s" }}>
            <button onClick={() => setProjetoId(p.id)} className="flex-1 text-left px-3 py-1.5 text-sm flex items-center gap-2 min-w-0" style={{ color: A.texto }}>
              <span className="rounded-[4px] shrink-0" style={{ width: 12, height: 12, background: p.cor }} />
              <span className="truncate flex-1">{p.nome}</span>
              {!p.publico && <Lock size={10} style={{ color: A.sub }} />}
              {p.abertas > 0 && <span className="text-[10px]" style={{ color: A.sub }}>{p.abertas}</span>}
            </button>
            {p.podeEditar && <button onClick={() => setProjForm(p)} className="opacity-0 group-hover:opacity-100 px-1.5" title="Editar projeto" style={{ color: A.sub, transition: "opacity .15s" }}><Pencil size={12} /></button>}
          </div>
        ))}
        {!projetos.length && <div className="px-3 text-[11px]" style={{ color: A.sub }}>Nenhum projeto. Crie no +.</div>}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* cabeçalho */}
        <div className="px-6 pt-4" style={{ borderBottom: `1px solid ${A.linha}` }}>
          <div className="flex items-center gap-2 mb-2">
            {proj ? <span className="rounded-md" style={{ width: 22, height: 22, background: proj.cor }} /> : <CalendarDays size={22} style={{ color: A.azul }} />}
            <div className="text-xl font-bold" style={{ color: A.texto }}>{proj ? proj.nome : "Agenda"}</div>
          </div>
          <div className="flex items-center gap-1 pb-2">
            <Aba k="calendario" t="Calendário" atual={tela} set={setTela} />
            <Aba k="tarefas" t="Tarefas" atual={tela} set={setTela} />
            <span className="w-4" />
            {[["GERAL", "Geral"], ["PESSOAL", "Pessoal"], ["FUNCIONAL", "Funcional"]].map(([k, t]) => <Aba key={k} k={k} t={t} atual={visao} set={setVisao} />)}
          </div>
        </div>

        {tela === "tarefas" ? (
          <div key={`lista-${visao}-${projetoId}`} className="p-6 anim-entrar"><Tarefas user={user} natureza={visao} projetoId={projetoId} embutido /></div>
        ) : (
          <div key="cal" className="flex-1 flex flex-col anim-entrar">
            <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: `1px solid ${A.linha}` }}>
              <button onClick={() => novaNoDia(H)} className="px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5" style={{ border: `1px solid ${A.linha}`, color: A.texto }}><Plus size={14} /> Adicionar uma tarefa</button>
              <button onClick={() => mover(-1)} className="p-1 rounded" style={{ color: A.sub }}><ChevronLeft size={18} /></button>
              <button onClick={() => { setDir(0); setRef(H); }} className="text-sm px-1" style={{ color: A.texto }}>Hoje</button>
              <button onClick={() => mover(1)} className="p-1 rounded" style={{ color: A.sub }}><ChevronRight size={18} /></button>
              <span className="text-sm" style={{ color: A.sub }}>{titulo}</span>
              <span className="flex-1" />
              <div className="flex rounded-md p-0.5" style={{ background: A.fundo2, border: `1px solid ${A.linha}` }}>
                {[["semana", "Semanas"], ["mes", "Mês"]].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className="px-3 py-1 text-xs font-semibold rounded" style={{ background: modo === k ? "#fff" : "transparent", color: modo === k ? A.texto : A.sub, boxShadow: modo === k ? "0 1px 2px rgba(0,0,0,.12)" : "none", transition: "all .18s" }}>{t}</button>)}
              </div>
            </div>
            {!d && <div className="p-6"><Loader2 size={18} className="animate-spin" style={{ color: A.sub }} /></div>}
            <div key={`${modo}-${dias[0]}`} className={dir > 0 ? "anim-dir" : dir < 0 ? "anim-esq" : "anim-entrar"} style={{ flex: 1 }}>
              <div className="grid grid-cols-7" style={{ height: "100%" }}>
                {dias.map((dia, k) => {
                  const fora = modo === "mes" && Number(dia.slice(5, 7)) !== mes;
                  const l = porDia[dia] || [];
                  const hoje = dia === H;
                  return (
                    <div key={dia} onDragOver={(e) => { if (arrastando) { e.preventDefault(); setSobre(dia); } }} onDragLeave={() => setSobre(null)} onDrop={(e) => { e.preventDefault(); soltar(dia); }}
                      className="group/dia px-2 pt-2 pb-3 flex flex-col gap-1.5"
                      style={{ minHeight: modo === "semana" ? 560 : 130, borderLeft: k % 7 ? `1px solid ${A.linha}` : "none", borderTop: modo === "mes" && k >= 7 ? `1px solid ${A.linha}` : "none",
                        background: sobre === dia ? A.azulSoft : fora ? A.fundo2 : A.fundo, transition: "background .15s" }}>
                      {(modo === "semana" || k < 7) && <div className="text-[12px] px-1" style={{ color: A.sub }}>{SEM_SEG[k % 7]}</div>}
                      <div className="px-1 mb-1">
                        <span className="inline-flex items-center justify-center rounded-md font-medium" style={{ minWidth: modo === "semana" ? 34 : 24, height: modo === "semana" ? 32 : 24, fontSize: modo === "semana" ? 19 : 13,
                          background: hoje ? A.azul : "transparent", color: hoje ? "#fff" : fora ? "#B7B3B3" : A.texto, padding: "0 6px" }}>{Number(dia.slice(8))}</span>
                      </div>
                      {(modo === "mes" ? l.slice(0, 4) : l).map((t) => (
                        <CardAgenda key={t.id} t={t} proj={P[t.projetoId]} foto={fotos[t.responsavelId]} onClick={() => setAbrir(t.id)} onDragStart={() => setArrastando(t)}
                          onConcluir={() => alternarConcluida(t)} onMenu={(x, y) => setMenuCard({ x, y, t })} />
                      ))}
                      {modo === "mes" && l.length > 4 && <button onClick={() => { setModo("semana"); setRef(dia); }} className="text-[11px] text-left px-1" style={{ color: A.azul }}>+{l.length - 4} mais</button>}
                      <button onClick={() => novaNoDia(dia)} className={`text-left px-1 py-1 rounded-md text-[13px] flex items-center gap-1 ${modo === "mes" ? "opacity-0 group-hover/dia:opacity-100" : ""}`} style={{ color: A.sub, transition: "opacity .15s, background .15s" }}>
                        <Plus size={14} /> {modo === "semana" ? "Adicionar uma tarefa" : "Adicionar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      {form && <TarefaForm user={user} inicial={form} usuarios={d?.usuarios || []} projetos={projetos} onClose={() => setForm(null)} onOk={() => { setForm(null); carregar(); }} />}
      {abrir && <TarefaDetalhe user={user} id={abrir} usuarios={d?.usuarios || []} projetos={projetos} onClose={() => setAbrir(null)} onMudou={carregar} />}
      {menuCard && <MenuCard {...menuCard} onClose={() => setMenuCard(null)} onAbrir={() => setAbrir(menuCard.t.id)} onConcluir={() => alternarConcluida(menuCard.t)} onExcluir={() => excluirTarefa(menuCard.t)} />}
      {projForm && <ProjetoForm user={user} inicial={projForm} onClose={() => setProjForm(null)} onOk={() => { setProjForm(null); carregar(); }} />}
    </div>
  );
}
