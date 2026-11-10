"use client";
// v169 — Tarefas (demandas entre setores), Agenda (mensal/semanal) e status das pessoas
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import {
  Plus, X, Loader2, Play, Square, CheckCircle2, Repeat, Paperclip, Lock, Globe, ListChecks, Link2, Trash2, Pencil, Upload,
  ChevronLeft, ChevronRight, Search, Clock, RotateCcw, CalendarDays, Users2, Flag, FileText,
  Eye, EyeOff, Users, AlertTriangle, Vote, Landmark, History, ChevronDown,
} from "lucide-react";
import { SETORES_TAREFA, NOME_SETOR_TAREFA, setorTarefaDe } from "@/lib/acesso";
import { TIPOS_REC, DIAS_SEMANA, ORDINAIS, descreverRecorrencia } from "@/lib/recorrencia";
import { alerta, confirmar } from "./dialogo";   // v424 — popups do sistema
import { useMobile } from "./useMobile";   // v550
import AvisosPush from "./avisosPush";   // v551 — lembrete 30 min antes das tarefas

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#D99A00", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", cinza: "#98A2B3", cinzaSoft: "#F2F4F7",
};
export const TIPO = { ROTINA: ["Rotina", C.cinza, C.cinzaSoft]   /* v646 — recorrente não tem cor própria: só o ícone */, URGENTE: ["Urgente", C.red, C.redSoft], PADRAO: ["Padrão", C.cinza, C.cinzaSoft] };
export const STATUS_P = { DISPONIVEL: ["Disponível", C.green], OCUPADO: ["Ocupado", C.yellow], REUNIAO: ["Em reunião", C.navy], INATIVO: ["Inativo", C.cinza] };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, method === "GET" ? undefined : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status >= 502 ? "Sistema reiniciando (atualização em andamento). Tente de novo em 1 minuto." : `Erro na operação (${r.status}).`));
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
export function StatusPessoa({ user, compacto }) {
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
        <Bolinha status={eu.status} size={compacto ? 10 : undefined} />{!compacto && <> {rot}</>}
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

// v652 — arrastar um anexo para fora (área de trabalho / outra janela) baixa o arquivo (Chrome/Edge)
function arrastarArquivo(e, a, url) {
  try {
    const abs = new URL(url, window.location.origin).href;
    e.dataTransfer.setData("DownloadURL", `${a.mime || "application/octet-stream"}:${a.nome}:${abs}`);
    e.dataTransfer.setData("text/uri-list", abs);
    e.dataTransfer.effectAllowed = "copy";
  } catch {}
}
// v566 — arquivos colados (Ctrl+V): imagens viram "imagem-colada-AAAAMMDD-HHMMSS.png"
function arquivosColados(e) {
  const its = [...(e.clipboardData?.files || [])];
  if (!its.length) return [];
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const carimbo = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return its.map((f, i) => (/^image\//.test(f.type) && (!f.name || /^image\.\w+$/i.test(f.name))
    ? new File([f], `imagem-colada-${carimbo}${its.length > 1 ? `-${i + 1}` : ""}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type }) : f));
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
  // v566 — concluídas e todas: histórico completo (arquivado para sempre); lixeira: excluídas dos últimos 30 dias
  const [lix, setLix] = useState(null);
  const carregar = () => {
    api(`/api/tarefas?u=${user.id}&escopo=${escopo}${projetoId ? `&projeto=${projetoId}` : ""}&de=${ver === "ABERTAS" ? somaDia(hojeISO(), -365) : "2000-01-01"}&ate=${somaDia(hojeISO(), ver === "ABERTAS" ? 60 : 400)}`).then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
    if (ver === "LIXEIRA") api(`/api/tarefas?u=${user.id}&lixeira=1`).then((j) => setLix(j.tarefas || [])).catch((e) => setErro(e.message));
  };
  useEffect(() => { carregar(); }, [escopo, projetoId, ver]);
  useEffect(() => { const i = setInterval(carregar, 60000); return () => clearInterval(i); }, [escopo, projetoId, ver]);
  const restaurar = async (t) => { try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: "restaurar" }); carregar(); } catch (e) { alerta(e.message); } };
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
          <div className="text-xs" style={{ color: C.sub }}>Demandas entre os setores · recorrente <Repeat size={11} className="inline" style={{ color: C.sub }} /> · urgente <b style={{ color: C.red }}>vermelho</b> · padrão <b style={{ color: C.cinza }}>cinza</b></div>
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
        {[["ABERTAS", "Em aberto"], ["CONCLUIDAS", "Concluídas"], ["TODAS", "Todas"], ["LIXEIRA", "Lixeira"]].map(([k, t]) => <button key={k} onClick={() => setVer(k)} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={ver === k ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}>{t}</button>)}
      </div>
      {erro && <div className="p-3 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}
      {ver === "LIXEIRA" && (
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 pt-3 pb-2 text-xs" style={{ color: C.sub }}>Demandas excluídas ficam aqui por 30 dias, com dados e arquivos, e depois somem. Concluídas e passadas nunca são apagadas: ficam em <b>Concluídas</b>.</div>
          {!lix && <div className="px-4 py-4"><Loader2 size={16} className="animate-spin" style={{ color: C.sub }} /></div>}
          {lix && !lix.length && <div className="px-4 py-10 text-center text-sm" style={{ color: C.sub }}>A lixeira está vazia.</div>}
          {(lix || []).filter((t) => !busca || `${t.titulo} ${t.responsavelNome} #${t.id}`.toUpperCase().includes(busca.toUpperCase())).map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-[200px]">
                <button onClick={() => setAbrir(t.id)} className="font-semibold text-left" style={{ color: C.text }}>#{t.id} {t.titulo}</button>
                <div className="text-xs" style={{ color: C.sub }}>{t.responsavelNome} · prazo {dBR(t.prazo)}{t.nArquivos ? ` · ${t.nArquivos} arquivo(s)` : ""} · excluída {dBR(String(t.excluidaEm).slice(0, 10))}{t.excluidaPorNome ? ` por ${t.excluidaPorNome}` : ""} · some em {dBR(t.someEm)}</div>
              </div>
              {t.podeRestaurar && <Btn fundo={C.panel2} cor={C.text} onClick={() => restaurar(t)}><RotateCcw size={12} /> Restaurar</Btn>}
            </div>
          ))}
        </div>
      )}
      {d && ver !== "LIXEIRA" && (
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
    <div onClick={onAbrir} className="anim-entrar flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}`, borderLeft: `4px solid ${proj?.cor || cor}`, background: proj?.cor ? `${proj.cor}14` : undefined, transition: "background .15s" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold truncate" style={{ color: C.text, textDecoration: t.status === "CONCLUIDA" ? "line-through" : "none" }}>{t.titulo}</span>
          <ChipTipo tipo={t.tipo} />
          {!t.publica && <Lock size={12} style={{ color: C.sub }} title="Privada" />}
          {t.natureza === "PESSOAL" && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "#F3E8FF", color: "#7E3AF2" }}>PESSOAL</span>}
          {proj && <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: C.sub }}><span className="rounded-[3px]" style={{ width: 10, height: 10, background: proj.cor }} />{proj.nome}</span>}
          {t.serieId && <Repeat size={12} style={{ color: C.sub }} title={t.recorrenciaTexto} />}
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

/* v589 — aviso prévio no celular antes do início (padrão 30 min; escolhe da lista ou digita outro período) */
const AVISOS = [[null, "Sem aviso"], [0, "Na hora do início"], [5, "5 min antes"], [10, "10 min antes"], [15, "15 min antes"], [30, "30 min antes"], [60, "1 h antes"], [120, "2 h antes"], [1440, "1 dia antes"]];
const UNID_AVISO = [[1, "min"], [60, "horas"], [1440, "dias"]];
function AvisoPrevio({ valor, onChange }) {
  const preset = AVISOS.some(([m]) => m === valor);
  const [outro, setOutro] = useState(!preset);
  const unid0 = valor && valor % 1440 === 0 ? 1440 : valor && valor % 60 === 0 ? 60 : 1;
  const [unid, setUnid] = useState(unid0);
  const [qtd, setQtd] = useState(valor ? String(valor / unid0) : "");
  const aplicar = (q, u) => { const n = Math.round(Number(String(q).replace(",", ".")) * u); if (n >= 0 && n <= 10080) onChange(n); };
  return (
    <div className="flex flex-wrap items-end gap-2 mb-3 text-xs" style={{ color: C.sub }}>
      <label className="flex-1 min-w-[180px]">Aviso no celular
        <select value={outro ? "OUTRO" : String(valor)} onChange={(e) => {
          const v = e.target.value;
          if (v === "OUTRO") { setOutro(true); if (!qtd) { setQtd("45"); setUnid(1); onChange(45); } else aplicar(qtd, unid); return; }
          setOutro(false); onChange(v === "null" ? null : Number(v));
        }} className={`${inp} mt-1`} style={inpS}>
          {AVISOS.map(([m, t]) => <option key={String(m)} value={String(m)}>{t}</option>)}
          <option value="OUTRO">Outro período…</option>
        </select>
      </label>
      {outro && <>
        <input value={qtd} onChange={(e) => { setQtd(e.target.value); aplicar(e.target.value, unid); }} inputMode="decimal" className={inp} style={{ ...inpS, width: 80 }} />
        <select value={unid} onChange={(e) => { const u = Number(e.target.value); setUnid(u); aplicar(qtd, u); }} className={inp} style={{ ...inpS, width: 100 }}>
          {UNID_AVISO.map(([u, t]) => <option key={u} value={u}>{t}</option>)}
        </select>
        <span className="pb-2">antes (máx. 7 dias)</span>
      </>}
    </div>
  );
}

// v600 — tarefas com horário que se sobrepõem (sem "até" = conta 30 min)
const minHH = (x) => Number(String(x).slice(0, 2)) * 60 + Number(String(x).slice(3, 5));
const intervalo = (h, hf) => { const a = minHH(h); return [a, hf && minHH(hf) > a ? minHH(hf) : a + 30]; };
export const conflitosHora = (lista, h, hf) => { if (!h) return []; const [a, b] = intervalo(h, hf); return lista.filter((t) => t.hora && t.status !== "CONCLUIDA" && t.status !== "CANCELADA" && (() => { const [c, d] = intervalo(t.hora, t.horaFim); return a < d && c < b; })()); };

/* ======================= formulário (nova / editar) ======================= */
export function TarefaForm({ user, inicial, usuarios, projetos = [], onClose, onOk }) {
  const ed = !!inicial.id;
  const criador = ed ? inicial.criadoPorId : user.id;
  const [f, setF] = useState({
    hora: inicial.hora || "", horaFim: inicial.horaFim || "", lembreteMin: inicial.lembreteMin === undefined ? 30 : inicial.lembreteMin, natureza: inicial.natureza === "PESSOAL" ? "PESSOAL" : "FUNCIONAL", projetoId: inicial.projetoId || "",
    titulo: inicial.titulo || "", descricao: inicial.descricao || "", setor: inicial.setor || setorTarefaDe(user), responsavelId: inicial.responsavelId || "",
    prazo: inicial.prazo || hojeISO(), tipo: inicial.tipo === "URGENTE" ? "URGENTE" : "PADRAO", publica: inicial.publica !== false,
    rec: { tipo: "NENHUMA", ...(inicial.recorrencia || {}) }, subtarefas: inicial.subtarefas || [], dependencias: inicial.dependencias || [], aplicarSerie: false,
    // v600 — período sem horário, evento com convidados e pessoas necessárias
    periodo: inicial.periodo || "", evento: !!inicial.evento, efetivo: inicial.efetivo || "", convidados: (inicial.convites || []).map((c) => c.usuarioId),
    // v655 — decisão: envolvidos marcam uma das opções
    decisao: !!inicial.decisao, opcoes: inicial.decisao?.opcoes?.length ? inicial.decisao.opcoes : ["", ""], envolvidos: inicial.decisao?.envolvidos || [],
  });
  const [buscaEnv, setBuscaEnv] = useState("");
  const [buscaConv, setBuscaConv] = useState("");
  const [todos, setTodos] = useState(false);
  const [nova, setNova] = useState("");
  const [arqs, setArqs] = useState([]);
  const [sobreArq, setSobreArq] = useState(false);   // v652 — arrastar arquivos para anexar
  const [jaArqs, setJaArqs] = useState(Array.isArray(inicial.arquivos) ? inicial.arquivos : []);   // v592 — anexos já salvos aparecem na edição
  const tirarJa = async (a) => { if (!(await confirmar(`Excluir ${a.nome}?`))) return; try { await api(`/api/tarefas/${inicial.id}/arquivos`, "DELETE", { usuarioId: user.id, arquivoId: a.id }); setJaArqs((l) => l.filter((x) => x.id !== a.id)); } catch (e) { alerta(e.message); } };
  const [publicas, setPublicas] = useState(null);
  const [buscaDep, setBuscaDep] = useState("");
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // v566 — Ctrl+V com imagem (print, foto copiada) entra nos anexos
  useEffect(() => { const f = (e) => { const fs = arquivosColados(e); if (fs.length) { e.preventDefault(); setArqs((a) => [...a, ...fs]); } }; document.addEventListener("paste", f); return () => document.removeEventListener("paste", f); }, []);
  const setRec = (k, v) => setF((x) => ({ ...x, rec: { ...x.rec, [k]: v } }));
  useEffect(() => { api(`/api/tarefas?u=${user.id}&escopo=todas&pendentes=1`).then((j) => setPublicas(j.tarefas.filter((t) => t.id !== inicial.id && !t.modelo))).catch(() => setPublicas([])); }, []);
  const doSetor = usuarios.filter((u) => u.setorTarefa === f.setor);
  const lista = todos || !doSetor.length ? usuarios : doSetor;
  const recorrente = f.rec.tipo && f.rec.tipo !== "NENHUMA";
  // v226 — atribuída por outra pessoa: funcional e pública · pessoal: sempre privada e para quem cria
  const atribuida = !!f.responsavelId && Number(f.responsavelId) !== criador;
  const pessoal = f.natureza === "PESSOAL" && !atribuida;
  const publicaFinal = atribuida ? true : pessoal ? false : f.publica;
  // v565 — pessoal: sem colaborador (é de quem cria), sempre privada · v592: projeto pessoal permitido · v598: dependências voltaram na pessoal
  const setNatureza = (n) => setF((x) => ({ ...x, natureza: n, projetoId: (projetos.find((p) => p.id === Number(x.projetoId)) || {}).natureza === n ? x.projetoId : "", ...(n === "PESSOAL" ? { responsavelId: criador, publica: false } : {}) }));
  // v599 — projeto atual da tarefa sempre fica na lista (projeto transportado entre pessoal/funcional não perde a tarefa)
  const projsOpc = projetos.filter((p) => p.id === Number(inicial.projetoId) || (pessoal ? p.natureza === "PESSOAL" && (p.donoId === criador || (p.membros || []).includes(criador)) : p.natureza !== "PESSOAL"));
  const dPrazo = f.prazo ? dUTC(f.prazo) : new Date();
  const salvar = async () => {
    // v600 — aviso de duas tarefas no mesmo horário (do mesmo responsável, no mesmo dia)
    if (f.hora && publicas) {
      const rf = pessoal ? criador : Number(f.responsavelId);
      const c = conflitosHora(publicas.filter((t) => t.id !== inicial.id && t.prazo === f.prazo && t.responsavelId === rf), f.hora, f.horaFim);
      if (c.length && !(await confirmar(`Já existe no mesmo horário:\n${c.map((t) => `• ${t.hora}${t.horaFim ? `–${t.horaFim}` : ""} ${t.titulo}`).join("\n")}\n\nSalvar mesmo assim?`))) return;
    }
    if (f.decisao && (f.opcoes.filter((o) => o.trim()).length < 2 || !f.envolvidos.length)) { setErro("Decisão: informe pelo menos 2 opções e os envolvidos."); return; }
    setSt(true); setErro("");
    const t = { titulo: f.titulo, descricao: f.descricao, setor: f.setor, responsavelId: Number(f.responsavelId), prazo: f.prazo, tipo: recorrente ? (f.tipo === "URGENTE" ? "URGENTE" : "ROTINA") : f.tipo,
      publica: publicaFinal, subtarefas: f.subtarefas, dependencias: f.dependencias.filter((id) => depsVal.some((t) => t.id === id)), recorrencia: recorrente ? f.rec : null, aplicarSerie: f.aplicarSerie,
      hora: f.hora || null, horaFim: f.horaFim || null, periodo: f.hora ? null : f.periodo || null, evento: f.evento, efetivo: f.evento && f.efetivo ? Number(f.efetivo) : null, convidados: f.evento ? f.convidados : [], lembreteMin: f.lembreteMin,
      ...(f.decisao ? { decisao: { opcoes: f.opcoes.map((o) => o.trim()).filter(Boolean), envolvidos: f.envolvidos } } : {}), natureza: pessoal ? "PESSOAL" : "FUNCIONAL", projetoId: projsOpc.some((p) => p.id === Number(f.projetoId)) ? Number(f.projetoId) : null };
    try {
      const r = ed ? await api(`/api/tarefas/${inicial.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: t }) : await api("/api/tarefas", "POST", { usuarioId: user.id, tarefa: t });
      const id = r.tarefa?.id || (ed ? inicial.id : null);
      // v592 — falha num anexo não perde os outros e avisa qual não subiu
      const falhas = [];
      for (const a of arqs) if (id) { try { await api(`/api/tarefas/${id}/arquivos`, "POST", { usuarioId: user.id, nome: a.name, mime: a.type, conteudo: await readB64(a) }); } catch (e) { falhas.push(`${a.name} (${e.message})`); } }
      if (falhas.length) alerta(`Demanda salva, mas não foi possível anexar: ${falhas.join(", ")}.`);
      onOk();
    } catch (e) { setSt(false); setErro(e.message); }
  };
  // v598 — pública depende só de públicas; privada/pessoal também das tarefas pessoais de quem é responsável
  const respFinal = pessoal ? criador : Number(f.responsavelId);
  const depsVal = (publicas || []).filter((t) => t.publica || (!publicaFinal && t.responsavelId === respFinal));
  // v606 — diz o que falta em vez de só deixar o botão apagado
  const faltando = [!f.titulo.trim() && "o que precisa ser feito (Demanda)", !f.responsavelId && "colaborador", !f.prazo && "data"].filter(Boolean);
  const depsSel = depsVal.filter((t) => f.dependencias.includes(t.id));
  const depsOpc = depsVal.filter((t) => !f.dependencias.includes(t.id) && buscaDep && `${t.titulo} ${t.responsavelNome} #${t.id}`.toUpperCase().includes(buscaDep.toUpperCase())).slice(0, 8);
  return (
    <Janela titulo={ed ? `Editar demanda #${inicial.id}` : "Nova demanda"} onClose={onClose} largura={720}
      rodape={<>
        {erro ? <span className="text-xs mr-auto" style={{ color: C.red }}>{erro}</span>
          : faltando.length > 0 && <span className="text-xs mr-auto" style={{ color: C.sub }}>Para criar, preencha: <b style={{ color: C.text }}>{faltando.join(", ")}</b></span>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={salvar} disabled={st || faltando.length > 0} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff", opacity: st || !f.titulo.trim() || !f.responsavelId ? 0.5 : 1 }}>
          {st && <Loader2 size={14} className="animate-spin" />} {ed ? "Salvar" : "Criar demanda"}
        </button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="text-xs" style={{ color: C.sub }}>Natureza
          <div className="flex gap-1 mt-1">
            {[["PESSOAL", "Pessoal"], ["FUNCIONAL", "Funcional"]].map(([k, t]) => {
              const off = k === "PESSOAL" && atribuida;
              const sel = (pessoal ? "PESSOAL" : "FUNCIONAL") === k;
              return <button key={k} disabled={off} onClick={() => setNatureza(k)} title={off ? "Demanda para outra pessoa é sempre funcional e pública" : ""}
                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold" style={sel ? { background: k === "PESSOAL" ? "#7E3AF2" : "#4573D2", color: "#fff", transition: "all .18s" } : { background: C.panel2, color: off ? C.cinza : C.text, transition: "all .18s" }}>{t}</button>;
            })}
          </div>
        </div>
        {<label className="text-xs" style={{ color: C.sub }}>{pessoal ? "Projeto pessoal" : "Projeto"}
          <div className="flex items-center gap-2 mt-1">
            {f.projetoId && <span className="rounded-[4px] shrink-0" style={{ width: 14, height: 14, background: (projetos.find((p) => p.id === Number(f.projetoId)) || {}).cor }} />}
            <select value={f.projetoId} onChange={(e) => set("projetoId", e.target.value)} className={inp} style={inpS}>
              <option value="">— sem projeto —</option>
              {projsOpc.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </label>}
      </div>
      {!pessoal && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
      </div>}
      <label className="block text-xs mb-3" style={{ color: C.sub }}>Demanda
        <input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} autoFocus placeholder={f.evento ? "Nome do evento (obrigatório)" : "O que precisa ser feito (obrigatório)"} className={`${inp} mt-1`} style={inpS} />
        <textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={3} placeholder="Detalhes (opcional)" className={`${inp} mt-1`} style={{ ...inpS, resize: "vertical" }} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <label className="text-xs" style={{ color: C.sub }}>{recorrente ? "Primeira data" : "Data limite"}<input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Horário (opcional)<input type="time" value={f.hora} onChange={(e) => set("hora", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Até<input type="time" value={f.horaFim} disabled={!f.hora} onChange={(e) => set("horaFim", e.target.value)} className={`${inp} mt-1`} style={inpS} /></label>
      </div>
      {f.hora && <AvisoPrevio valor={f.lembreteMin} onChange={(v) => set("lembreteMin", v)} />}
      {!f.hora && <div className="flex items-center gap-1 mb-3 text-xs" style={{ color: C.sub }}>Período (sem horário):
        {[["", "—"], ["MANHA", "Manhã"], ["TARDE", "Tarde"]].map(([k, t]) => <button key={k} onClick={() => set("periodo", k)} className="px-2.5 py-1 rounded-lg font-semibold" style={f.periodo === k ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}>{t}</button>)}
      </div>}
      {/* v655 — decisão: situação na descrição, envolvidos e opções para marcar */}
      {!f.evento && !inicial.reuniao && <div className="rounded-lg p-3 mb-3" style={{ background: C.panel2, border: f.decisao ? "1px solid #9E47FF" : "1px solid transparent" }}>
        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: C.text }}>
          <input type="checkbox" checked={f.decisao} disabled={!!inicial.decisao} onChange={(e) => set("decisao", e.target.checked)} /><Vote size={14} style={{ color: "#7E3AF2" }} /> Decisão (os envolvidos marcam uma opção)
        </label>
        {f.decisao && <>
          <div className="text-[11px] mt-1" style={{ color: C.sub }}>Descreva a situação na descrição. Unanimidade: você recebe o resultado e decide. Sem unanimidade: vira pauta da próxima reunião de gestão.</div>
          <div className="text-xs mt-2 mb-1" style={{ color: C.sub }}>Opções</div>
          {f.opcoes.map((o, k) => <div key={k} className="flex items-center gap-1 mb-1">
            <span className="text-[11px] w-4" style={{ color: C.sub }}>{k + 1}.</span>
            <input value={o} onChange={(e) => set("opcoes", f.opcoes.map((x, j) => (j === k ? e.target.value : x)))} placeholder={`Opção ${k + 1}`} className="flex-1 rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
            {f.opcoes.length > 2 && <button onClick={() => set("opcoes", f.opcoes.filter((_, j) => j !== k))} style={{ color: C.sub }}><X size={12} /></button>}
          </div>)}
          <button onClick={() => set("opcoes", [...f.opcoes, ""])} className="text-[11px] font-semibold" style={{ color: "#7E3AF2" }}>+ opção</button>
          <div className="text-xs mt-2 mb-1" style={{ color: C.sub }}>Envolvidos ({f.envolvidos.length})</div>
          {f.envolvidos.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{f.envolvidos.map((id) => { const x = usuarios.find((u) => u.id === id); const votou = inicial.decisao?.votos?.[id];
            return <span key={id} className="text-[11px] rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1" style={{ background: votou ? "#E3F4EA" : "#fff", border: `1px solid ${C.line}` }}>{x?.nome || `#${id}`}{votou ? " · votou" : ""}
              <button onClick={() => set("envolvidos", f.envolvidos.filter((y) => y !== id))}><X size={11} /></button></span>; })}</div>}
          <input value={buscaEnv} onChange={(e) => setBuscaEnv(e.target.value)} placeholder="Buscar pessoa envolvida…" className="w-full rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
          {buscaEnv && <div className="rounded-lg mt-1" style={{ border: `1px solid ${C.line}`, background: "#fff", maxHeight: 180, overflowY: "auto" }}>
            {usuarios.filter((x) => !f.envolvidos.includes(x.id) && String(x.nome).toUpperCase().includes(buscaEnv.toUpperCase())).slice(0, 10)
              .map((x) => <button key={x.id} onClick={() => { set("envolvidos", [...f.envolvidos, x.id]); setBuscaEnv(""); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50">{x.nome}</button>)}
          </div>}
        </>}
      </div>}
      {/* v600 — evento: convidados recebem mensagem, e-mail e popup na agenda (confirmar / recusar / decidir depois) */}
      {!f.decisao && <>
      <div className="rounded-lg p-3 mb-3" style={{ background: C.panel2, border: f.evento ? `1px solid ${C.line}` : "1px solid transparent" }}>
        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer" style={{ color: C.text }}>
          <input type="checkbox" checked={f.evento} onChange={(e) => set("evento", e.target.checked)} /><CalendarDays size={14} style={{ color: A.azul }} /> Evento com convidados
        </label>
        {f.evento && <>
          <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: C.sub }}>Pessoas necessárias (efetivo)
            <input type="number" min={0} value={f.efetivo} onChange={(e) => set("efetivo", e.target.value)} placeholder="opcional" className="w-24 rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
            <span className="text-[11px]">fica amarelo até esse número confirmar; você recebe a situação todo dia</span>
          </div>
          <div className="text-xs mt-2 mb-1" style={{ color: C.sub }}>Convidados ({f.convidados.length})</div>
          {f.convidados.length > 0 && <div className="flex flex-wrap gap-1 mb-1">
            {f.convidados.map((id) => { const x = usuarios.find((u) => u.id === id); const st = (inicial.convites || []).find((c) => c.usuarioId === id)?.status || "NOVO";
              const [cor, fundo, rot] = st === "CONFIRMADO" ? ["#3F8A5F", "#E3F4EA", "confirmou"] : st === "RECUSADO" ? [C.red, C.redSoft, "recusou"] : st === "PENDENTE" ? ["#8A5A00", "#FCEFC7", "pendente"] : [C.text, "#fff", "novo"];
              return <span key={id} className="text-[11px] rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1" style={{ background: fundo, color: cor, border: `1px solid ${C.line}` }}>{x?.nome || `#${id}`} · {rot}
                <button onClick={() => set("convidados", f.convidados.filter((y) => y !== id))}><X size={11} /></button></span>; })}
          </div>}
          <input value={buscaConv} onChange={(e) => setBuscaConv(e.target.value)} placeholder="Buscar pessoa para convidar…" className="w-full rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
          {buscaConv && <div className="rounded-lg mt-1" style={{ border: `1px solid ${C.line}`, background: "#fff", maxHeight: 180, overflowY: "auto" }}>
            {usuarios.filter((x) => !f.convidados.includes(x.id) && x.id !== (pessoal ? criador : Number(f.responsavelId)) && String(x.nome).toUpperCase().includes(buscaConv.toUpperCase())).slice(0, 10)
              .map((x) => <button key={x.id} onClick={() => { set("convidados", [...f.convidados, x.id]); setBuscaConv(""); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50">{x.nome}</button>)}
          </div>}
        </>}
      </div>
      </>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div className="text-xs" style={{ color: C.sub }}>Status
          <div className="flex gap-1 mt-1">
            {(recorrente ? [["ROTINA", "Rotina"], ["URGENTE", "Urgente"]] : [["PADRAO", "Padrão"], ["URGENTE", "Urgente"]]).map(([k, t]) => {
              const sel = recorrente ? (k === "URGENTE" ? f.tipo === "URGENTE" : f.tipo !== "URGENTE") : f.tipo === k;
              const [, c, bg] = TIPO[k];
              return <button key={k} onClick={() => set("tipo", k === "ROTINA" ? "PADRAO" : k)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold" style={sel ? { background: c, color: "#fff" } : { background: bg, color: c }}>{t}</button>;
            })}
          </div>
        </div>
        {!pessoal && <div className="text-xs" style={{ color: C.sub }}>Visibilidade
          <div className="flex gap-1 mt-1">
            <button disabled={atribuida || pessoal} onClick={() => set("publica", true)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={publicaFinal ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}><Globe size={12} /> Pública</button>
            <button disabled={atribuida || pessoal} onClick={() => set("publica", false)} className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={!publicaFinal ? { background: C.navy, color: "#fff" } : { background: C.panel2, color: C.text }}><Lock size={12} /> Privada</button>
          </div>
        </div>}
      </div>
      {(atribuida || pessoal || !publicaFinal) && <div className="text-[11px] mb-3 -mt-1" style={{ color: C.sub }}>
        {atribuida ? "Demanda para outra pessoa: sempre funcional e pública." : pessoal ? "Pessoal: sempre privada — só você enxerga." : "Privada: só o colaborador que recebe enxerga a demanda."}</div>}

      {/* recorrência */}
      {/* v283 — recorrência também na edição: marcar uma avulsa como rotina, trocar a regra (vale desta em diante) ou deixar de repetir */}
      {(
        <div className="rounded-lg p-3 mb-3 min-w-0 overflow-hidden" style={{ background: C.panel2 }}>
          <div className="ce-rec flex flex-wrap items-center gap-2 text-xs min-w-0">
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
            {recorrente && <span className="flex flex-wrap items-center gap-2 min-w-0">até <input type="date" value={f.rec.ate || ""} onChange={(e) => setRec("ate", e.target.value)} className="rounded-lg px-2 py-1 text-xs outline-none min-w-0" style={inpS} /><span style={{ color: C.sub }}>(vazio = sem fim)</span></span>}
          </div>
          {recorrente && f.rec.tipo !== "DIARIA" && <label className="flex items-start gap-2 text-xs mt-2" style={{ color: C.text }}>
            <input type="checkbox" checked={!!f.rec.uteis} onChange={(e) => setRec("uteis", e.target.checked)} /> Só em dias úteis — se cair em sábado, domingo ou feriado, passa para o próximo dia útil</label>}
          {recorrente && f.rec.tipo === "DIARIA" && <label className="flex items-start gap-2 text-xs mt-2" style={{ color: C.text }}>
            <input type="checkbox" checked={!!f.rec.uteis} onChange={(e) => setRec("uteis", e.target.checked)} /> Pular também os feriados nacionais</label>}
          {ed && inicial.serieId && <div className="text-[11px] mt-1.5" style={{ color: C.sub }}>Mudar a repetição vale desta ocorrência em diante · "Não se repete" encerra a rotina depois desta.</div>}
          {ed && !inicial.serieId && recorrente && <div className="text-[11px] mt-1.5" style={{ color: C.sub }}>Esta demanda vira a primeira ocorrência da rotina.</div>}
          {recorrente && <div className="text-[11px] mt-1.5" style={{ color: C.blue }}>Repete {descreverRecorrencia({ ...f.rec, dow: f.rec.dow ?? dPrazo.getUTCDay(), dia: f.rec.dia ?? dPrazo.getUTCDate(), n: f.rec.n ?? Math.min(4, Math.ceil(dPrazo.getUTCDate() / 7)), mes: f.rec.mes ?? dPrazo.getUTCMonth() + 1 })} · vira rotina (azul) automaticamente.</div>}
        </div>
      )}
      {ed && inicial.serieId && <div className="flex items-center gap-2 text-xs mb-3 rounded-lg px-3 py-2" style={{ background: C.panel2, color: C.sub }}><Repeat size={13} /> Tarefa recorrente ({inicial.recorrenciaTexto || "rotina"}): o que mudar aqui (projeto, título, responsável, horário…) vale para todas as ocorrências em aberto.</div>}

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

      {/* dependências — v598: também na pessoal/privada (públicas + suas tarefas pessoais) */}
      {<div className="mb-3">
        <div className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><Link2 size={13} /> Depende da conclusão de {publicaFinal ? "(demandas públicas de qualquer pessoa)" : "(demandas públicas ou suas tarefas pessoais)"}</div>
        {depsSel.map((t) => <div key={t.id} className="flex items-center gap-2 text-xs py-0.5"><span className="font-semibold">#{t.id}</span><span className="flex-1 truncate">{t.titulo}</span><span style={{ color: C.sub }}>{t.responsavelNome} · {dBR(t.prazo)}</span><button onClick={() => set("dependencias", f.dependencias.filter((x) => x !== t.id))} style={{ color: C.sub }}><X size={13} /></button></div>)}
        <div className="relative">
          <input value={buscaDep} onChange={(e) => setBuscaDep(e.target.value)} placeholder={publicas ? (publicaFinal ? "Buscar demanda pública…" : "Buscar demanda pública ou tarefa sua…") : "carregando…"} className="w-full rounded-lg px-2 py-1 text-xs outline-none" style={inpS} />
          {depsOpc.length > 0 && <div className="absolute left-0 right-0 z-10 mt-1 rounded-lg shadow-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            {depsOpc.map((t) => <button key={t.id} onClick={() => { set("dependencias", [...f.dependencias, t.id]); setBuscaDep(""); }} className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50">#{t.id} {t.titulo} <span style={{ color: C.sub }}>· {t.responsavelNome} · {dBR(t.prazo)}</span></button>)}
          </div>}
        </div>
      </div>}

      {/* arquivos — v565: também na edição (a tarefa da agenda abre direto na edição) */}
      {(
        <div>
          {/* v565 — anexos mais limpos: área de toque maior e lista espaçada */}
          <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: C.sub }}><Paperclip size={13} /> Arquivos{jaArqs.length ? ` (${jaArqs.length} anexado${jaArqs.length > 1 ? "s" : ""})` : ""}</div>
          {jaArqs.length > 0 && <div className="mb-2 flex flex-col gap-1.5">
            {jaArqs.map((a) => <div key={a.id} className="flex items-center gap-2.5 text-xs rounded-lg px-3 py-2" style={{ background: C.panel2 }}><FileText size={14} style={{ color: C.accent }} />
              <a href={`/api/tarefas/${inicial.id}/arquivos?u=${user.id}&arquivo=${a.id}`} target="_blank" rel="noreferrer" className="flex-1 truncate" style={{ color: C.blue }}
                draggable onDragStart={(e) => arrastarArquivo(e, a, `/api/tarefas/${inicial.id}/arquivos?u=${user.id}&arquivo=${a.id}`)} title="Clique para abrir ou arraste para a área de trabalho">{a.nome}</a>
              <button onClick={() => tirarJa(a)} className="p-1 rounded" title="Excluir" style={{ color: C.sub }}><Trash2 size={13} /></button></div>)}
          </div>}
          <label onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setSobreArq(true); } }} onDragLeave={() => setSobreArq(false)}
            onDrop={(e) => { e.preventDefault(); setSobreArq(false); const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) setArqs((a) => [...a, ...fs]); }}
            className="flex items-center justify-center gap-2 rounded-xl text-sm cursor-pointer py-4 px-3" style={{ border: `1.5px dashed ${sobreArq ? C.accent : C.line}`, color: C.sub, background: sobreArq ? C.accentSoft : C.panel }}>
            <Upload size={16} style={{ color: C.accent }} /> <span><b style={{ color: C.text }}>Anexar arquivos</b> · arraste aqui, clique ou cole uma imagem (Ctrl+V)</span>
            <input type="file" multiple className="hidden" onChange={(e) => { setArqs((a) => [...a, ...e.target.files]); e.target.value = ""; }} />
          </label>
          {arqs.length > 0 && <div className="mt-2 flex flex-col gap-1.5">
            {arqs.map((a, i) => <div key={i} className="flex items-center gap-2.5 text-xs rounded-lg px-3 py-2" style={{ background: C.panel2 }}><FileText size={14} style={{ color: C.sub }} /> <span className="flex-1 truncate">{a.name}</span>
              <button onClick={() => setArqs((x) => x.filter((_, j) => j !== i))} className="p-1 rounded" title="Tirar" style={{ color: C.sub }}><X size={14} /></button></div>)}
          </div>}
        </div>
      )}
    </Janela>
  );
}

/* ======================= detalhe ======================= */
export function TarefaDetalhe({ user, id, usuarios, projetos = [], onClose, onMudou, editarDireto }) {
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
  // v566 — Ctrl+V com imagem anexa direto na demanda aberta
  useEffect(() => { const f = (e) => { const fs = arquivosColados(e); if (fs.length && !editar && !(editarDireto && t?.podeEditar)) { e.preventDefault(); anexar(fs); } }; document.addEventListener("paste", f); return () => document.removeEventListener("paste", f); });
  const [sobreDet, setSobreDet] = useState(false);   // v652
  const tirarArq = async (a) => { if (!(await confirmar(`Excluir ${a.nome}?`))) return; try { await api(`/api/tarefas/${id}/arquivos`, "DELETE", { usuarioId: user.id, arquivoId: a.id }); carregar(); } catch (e) { alerta(e.message); } };
  // v561 — na agenda a demanda já abre na edição (quem pode editar); fechar a edição fecha tudo
  const direto = editarDireto && t?.podeEditar && !t?.layout && !t?.decisao && !t?.reuniao;   // v655 — decisão e reunião abrem no detalhe   // v654 — tarefa de layout abre no detalhe
  if ((editar || direto) && t) return <TarefaForm user={user} inicial={t} usuarios={usuarios} projetos={projetos} onClose={() => (direto ? onClose() : setEditar(false))} onOk={() => { setEditar(false); carregar(); onMudou?.(); if (direto) onClose(); }} />;
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
        {/* v600 — convidado responde aqui também */}
        {t.meuConvite && <div className="flex items-center gap-2 flex-wrap mb-3 p-3 rounded-lg text-sm" style={{ background: t.meuConvite === "PENDENTE" ? "#FCEFC7" : C.panel2 }}>
          <CalendarDays size={15} style={{ color: A.azul }} /> <span className="flex-1">{t.meuConvite === "PENDENTE" ? "Você foi convidado para este evento." : t.meuConvite === "CONFIRMADO" ? "Você confirmou presença." : "Você recusou este convite."}</span>
          {t.meuConvite !== "CONFIRMADO" && <Btn onClick={async () => { await responderConviteApi(user, t.id, "CONFIRMAR"); carregar(); onMudou?.(); }}>Confirmar</Btn>}
          {t.meuConvite !== "RECUSADO" && <Btn fundo={C.redSoft} cor={C.red} onClick={async () => { await responderConviteApi(user, t.id, "RECUSAR"); carregar(); onMudou?.(); }}>Recusar</Btn>}
        </div>}
        {t.evento && t.convites?.length > 0 && <div className="mb-3 text-xs">
          <div className="font-semibold mb-1 flex items-center gap-1" style={{ color: C.sub }}><Users size={13} /> Convidados{t.efetivo ? ` · ${t.confirmados} de ${t.efetivo} necessários` : ` · ${t.confirmados} confirmados`}</div>
          <div className="flex flex-wrap gap-1">{t.convites.map((c) => <span key={c.usuarioId} className="rounded-full px-2 py-0.5" style={c.status === "CONFIRMADO" ? { background: "#E3F4EA", color: "#3F8A5F" } : c.status === "RECUSADO" ? { background: C.redSoft, color: C.red } : { background: "#FCEFC7", color: "#8A5A00" }}>{c.nome}</span>)}</div>
        </div>}
        <div className="mb-4">
          <Linha k="Responsável"><b>{t.responsavelNome}</b>{t.criadoPorId !== t.responsavelId && <span className="text-xs" style={{ color: C.sub }}>pedido por {t.criadoPorNome} em {dBR(t.createdAt)}</span>}</Linha>
          <Linha k="Data de conclusão"><span style={{ color: t.status !== "CONCLUIDA" && t.prazo < hojeISO() ? C.red : t.prazo === hojeISO() ? C.green : "#1E1F21", fontWeight: 600 }}>{t.prazo === hojeISO() ? "Hoje" : dBR(t.prazo)}</span>{t.hora && <span className="flex items-center gap-1"><Clock size={13} /> {t.hora}{t.horaFim ? `–${t.horaFim}` : ""}</span>}{t.recorrenciaTexto && <span className="flex items-center gap-1 text-xs" style={{ color: C.blue }}><Repeat size={12} /> {t.recorrenciaTexto}</span>}</Linha>
          <Linha k="Projeto">{proj ? <span className="flex items-center gap-1.5"><span className="rounded-[4px]" style={{ width: 12, height: 12, background: proj.cor }} />{proj.nome}</span> : <span style={{ color: C.sub }}>—</span>}</Linha>
          <Linha k="Natureza"><span className="px-2 py-0.5 rounded text-xs font-semibold" style={t.natureza === "PESSOAL" ? { background: "#F3E8FF", color: "#7E3AF2" } : { background: "#EAF0FB", color: "#4573D2" }}>{t.natureza === "PESSOAL" ? "Pessoal" : "Funcional"}</span><span className="flex items-center gap-1 text-xs" style={{ color: C.sub }}>{t.publica ? <><Globe size={12} /> pública</> : <><Lock size={12} /> privada</>}</span></Linha>
          <Linha k="Prioridade"><ChipTipo tipo={t.tipo} /></Linha>
          <Linha k="Setor">{NOME_SETOR_TAREFA[t.setor]}</Linha>
        </div>
        {t.descricao && <div className="text-sm whitespace-pre-wrap mb-3 p-3 rounded-lg" style={{ background: C.panel2 }}>{t.descricao}</div>}
        {t.layout && <LayoutTarefa t={t} user={user} onMudou={() => { carregar(); onMudou?.(); }} />}
        {t.decisao && <DecisaoPainel t={t} user={user} acao={acao} />}
        {t.reuniao && <ReuniaoPainel t={t} user={user} acao={acao} />}
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
        <div className="mb-3 rounded-lg" onDragOver={(e) => { if ((meu || t.podeEditar) && e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setSobreDet(true); } }} onDragLeave={() => setSobreDet(false)}
          onDrop={(e) => { e.preventDefault(); setSobreDet(false); const fs = [...(e.dataTransfer?.files || [])]; if (fs.length && (meu || t.podeEditar)) anexar(fs); }}
          style={{ outline: sobreDet ? `2px dashed ${C.accent}` : "none", background: sobreDet ? C.accentSoft : "transparent", padding: sobreDet ? 6 : 0 }}>
          <div className="text-xs font-semibold mb-1 flex items-center gap-2" style={{ color: C.sub }}><Paperclip size={13} /> Arquivos ({t.arquivos.length}){(meu || t.podeEditar) && <span className="font-normal">· arraste arquivos aqui</span>}
            {(meu || t.podeEditar) && <label className="text-[11px] font-semibold cursor-pointer" style={{ color: C.accent }}>+ anexar<input type="file" multiple className="hidden" onChange={(e) => { anexar([...e.target.files]); e.target.value = ""; }} /></label>}
          </div>
          {t.arquivos.map((a) => <div key={a.id} className="flex items-center gap-2 text-xs py-0.5"><FileText size={12} style={{ color: C.accent }} /><a href={`/api/tarefas/${t.id}/arquivos?u=${user.id}&arquivo=${a.id}`} target="_blank" rel="noreferrer" draggable onDragStart={(e) => arrastarArquivo(e, a, `/api/tarefas/${t.id}/arquivos?u=${user.id}&arquivo=${a.id}`)} title="Clique para abrir ou arraste para a área de trabalho" className="flex-1 truncate" style={{ color: C.blue }}>{a.nome}</a><span style={{ color: C.sub }}>{a.criadoPorNome}</span><button onClick={() => tirarArq(a)} style={{ color: C.sub }}><Trash2 size={12} /></button></div>)}
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

/* v655 — decisão: cada envolvido marca uma opção; resultado unânime ou pauta da reunião de gestão */
function DecisaoPainel({ t, user, acao }) {
  const d = t.decisao || {};
  const votos = d.votos || {};
  const meuVoto = votos[user.id]?.opcao;
  const envolvido = (d.envolvidos || []).includes(user.id);
  const faltam = (d.envolvidos || []).length - Object.keys(votos).length;
  const R = d.resultado;
  const mostrar = !!R || !envolvido || !!meuVoto;   // o voto dos outros aparece depois de votar
  return (
    <div className="mb-3 rounded-xl p-3" style={{ border: "2px solid #9E47FF", background: "#F5EEFF" }}>
      <div className="flex items-center gap-2 mb-2"><Vote size={16} style={{ color: "#7E3AF2" }} /><span className="text-sm font-bold" style={{ color: "#7E3AF2" }}>Decisão</span>
        <span className="text-xs" style={{ color: C.sub }}>{Object.keys(votos).length}/{(d.envolvidos || []).length} marcaram{!R && faltam > 0 ? ` · faltam ${faltam}` : ""}</span></div>
      {R && <div className="text-sm font-semibold mb-2 p-2 rounded-lg" style={R.tipo === "UNANIME" ? { background: "#E3F4EA", color: "#3F8A5F" } : { background: "#FCEFC7", color: "#8A5A00" }}>
        {R.tipo === "UNANIME" ? `Unanimidade: “${R.opcao}”` : `Sem unanimidade — foi para a pauta da reunião de gestão${R.reuniaoData ? ` de ${dBR(R.reuniaoData)}` : ""}.`}</div>}
      <div className="flex flex-col gap-1.5">
        {(d.opcoes || []).map((o) => { const quem = Object.values(votos).filter((v) => v.opcao === o); const sel = meuVoto === o;
          return <button key={o} disabled={!envolvido || !!R} onClick={() => acao("votar", { opcao: o })} className="flex items-center gap-2 text-left text-sm rounded-lg px-3 py-2"
            style={{ background: sel ? "#7E3AF2" : "#fff", color: sel ? "#fff" : C.text, border: `1px solid ${sel ? "#7E3AF2" : C.line}`, cursor: envolvido && !R ? "pointer" : "default" }}>
            <span className="rounded-full shrink-0" style={{ width: 14, height: 14, border: `2px solid ${sel ? "#fff" : "#9E47FF"}`, background: sel ? "#fff" : "transparent" }} />
            <span className="flex-1">{o}</span>
            {mostrar && <span className="text-[11px]" style={{ color: sel ? "#fff" : C.sub }}>{quem.length ? quem.map((v) => v.nome.split(" ")[0]).join(", ") : "—"}</span>}
          </button>; })}
      </div>
      {envolvido && !R && <div className="text-[11px] mt-2" style={{ color: C.sub }}>{meuVoto ? "Você pode trocar sua opção até todos marcarem." : "Marque a sua opção."}</div>}
      {!envolvido && !R && <div className="text-[11px] mt-2" style={{ color: C.sub }}>Aguardando os envolvidos.</div>}
    </div>
  );
}

/* v655 — reunião de gestão: pautas (fixas, decisões sem unanimidade e as que os convidados incluírem) */
function ReuniaoPainel({ t, user, acao }) {
  const [txt, setTxt] = useState("");
  const P = t.reuniao?.pautas || [];
  const pode = t.responsavelId === user.id || (t.convites || []).some((c) => c.usuarioId === user.id);
  const ORI = { FIXA: ["fixa", C.panel2, C.sub], DECISAO: ["decisão", "#F5EEFF", "#7E3AF2"], MANUAL: ["incluída", C.blueSoft, C.blue] };
  return (
    <div className="mb-3 rounded-xl p-3" style={{ border: `2px solid ${C.navy || "#001E41"}`, background: "#F2F5FA" }}>
      <div className="flex items-center gap-2 mb-2"><Landmark size={16} style={{ color: "#001E41" }} /><span className="text-sm font-bold" style={{ color: "#001E41" }}>Reunião de gestão · pautas</span><span className="text-xs" style={{ color: C.sub }}>{P.length}</span></div>
      <ol className="flex flex-col gap-1">
        {P.map((p, k) => <li key={p.id} className="flex items-center gap-2 text-sm leading-5 rounded-lg px-3 py-1.5" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <span className="text-sm font-bold tabular-nums leading-5" style={{ color: C.sub, minWidth: 18 }}>{k + 1}.</span>   {/* v684 — número alinhado com o texto */}
          <span className="flex-1">{p.texto}{p.autor && p.origem === "MANUAL" ? <span className="text-[11px]" style={{ color: C.sub }}> · {p.autor}</span> : null}</span>
          <span className="text-[10px] font-semibold px-1.5 rounded shrink-0" style={{ background: ORI[p.origem]?.[1], color: ORI[p.origem]?.[2] }}>{ORI[p.origem]?.[0] || ""}</span>
          {p.origem !== "FIXA" && pode && <button onClick={async () => (await confirmar("Tirar esta pauta?")) && acao("tirarPauta", { pautaId: p.id })} style={{ color: C.sub }}><X size={12} /></button>}
        </li>)}
      </ol>
      {pode && <div className="flex gap-2 mt-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && txt.trim()) { await acao("pauta", { texto: txt }); setTxt(""); } }} placeholder="Acrescentar pauta…" className="flex-1 rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} />
        <Btn cor="#001E41" disabled={!txt.trim()} onClick={async () => { await acao("pauta", { texto: txt }); setTxt(""); }}><Plus size={12} /> Pauta</Btn>
      </div>}
    </div>
  );
}

/* v654 — tarefa de layout: OP dos itens, layout de cada item (criação) e aprovar/reprovar (vendedor) */
function LayoutTarefa({ t, user, onMudou }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocup, setOcup] = useState("");
  const L = t.layout || {};
  const criacao = L.etapa === "CRIACAO";
  const meu = t.responsavelId === user.id;
  const aberta = t.status !== "CONCLUIDA" && t.status !== "CANCELADA";
  const ler = () => fetch(`/api/tarefas/${t.id}/layout?u=${user.id}`).then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); }).catch((e) => setErro(e.message));
  useEffect(() => { ler(); }, [t.id, t.arquivos?.length]);
  const post = async (corpo) => { const r = await fetch(`/api/tarefas/${t.id}/layout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...corpo }) }); const x = await r.json().catch(() => ({})); if (!r.ok) throw new Error(x.error || "Erro."); return x; };
  const urlArq = (a) => `/api/tarefas/${t.id}/arquivos?u=${user.id}&arquivo=${a.id}`;
  // v736 — vários arquivos por item, qualquer formato (imagem, PDF, AI, CDR, PSD, ZIP…)
  const subir = async (idx, files) => {
    const l = [...(files || [])]; if (!l.length) return; setOcup(`up${idx}`);
    const falhas = [];
    for (const file of l) {
      try {
        const r = await api(`/api/tarefas/${t.id}/arquivos`, "POST", { usuarioId: user.id, nome: `LAYOUT item ${idx + 1} · ${file.name}`, mime: file.type, conteudo: await readB64(file) });
        await post({ acao: "marcar", idx, arquivoId: r.arquivo.id });
      } catch (e) { falhas.push(`${file.name} (${e.message})`); }
    }
    if (falhas.length) alerta(`Não subiu: ${falhas.join(", ")}.`);
    await ler(); onMudou?.(); setOcup("");
  };
  const tirar = async (idx, a) => { setOcup(`up${idx}`); try { await post({ acao: "marcar", idx, arquivoId: a.id, remover: true }); await ler(); onMudou?.(); } catch (e) { alerta(e.message); } setOcup(""); };
  const acao = async (a) => { setOcup(a); try { await post({ acao: a, motivo }); onMudou?.(); await ler(); } catch (e) { alerta(e.message); } setOcup(""); };
  const abrirOp = async () => {
    if (!d) return;
    const { imprimirPedido } = await import("./impressaoPedido");
    const base = `/api/tarefas/${t.id}/layout?u=${user.id}`;
    imprimirPedido("OP", { numero: d.pedido.numero, emissao: d.pedido.emissao, clienteNome: d.pedido.cliente, vendedor: d.pedido.vendedor, oc: d.pedido.oc, obs: d.pedido.obs,
      prazoEntrega: d.pedido.prazoDias != null ? `${d.pedido.prazoDias} dias ${d.pedido.prazoTipo === "UTEIS" ? "úteis" : "corridos"}` : "" },
      d.itens.map((i) => ({ tipoPecaNome: i.tipoPecaNome || "", codigo: i.codigo, descricao: i.descricao, grade: i.grade, parametros: Object.fromEntries(Object.entries(i.parametros || {}).filter(([, v]) => v)),
        fotoBase64: "", anexos: [...(i.arquivos || (i.arquivo ? [i.arquivo] : [])).map((a) => ({ nome: `Layout · ${a.nome}`, mime: a.mime, src: urlArq(a) })), ...i.anexosItem.map((a) => ({ nome: a.nome, mime: a.mime, src: `${base}&item=${i.idx}&k=${a.k}` }))] })),
      { anexos: (d.anexosPedido || []).map((a) => ({ nome: a.nome, mime: a.tipo, src: `${base}&anexo=${a.id}` })), alerta });
  };
  const img = (a) => /^image\//.test(a?.mime || "") || /\.(png|jpe?g|gif|webp)$/i.test(a?.nome || "");
  return (
    <div className="mb-3 rounded-xl p-3" style={{ border: `2px solid ${criacao ? "#9E47FF" : C.accent}`, background: criacao ? "#F5EEFF" : C.accentSoft }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-sm font-bold" style={{ color: criacao ? "#7E3AF2" : C.accent }}>🎨 {criacao ? "Criação de layout" : "Aprovação de layout"}</span>
        <span className="text-xs" style={{ color: C.sub }}>pedido {L.numero} · {L.cliente}{L.vendedor ? ` · vendedor ${L.vendedor}` : ""}</span>
        <button onClick={abrirOp} disabled={!d} className="ml-auto text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.text }}><FileText size={12} /> Abrir OP</button>
      </div>
      {L.motivo && criacao && <div className="text-xs mb-2 p-2 rounded" style={{ background: C.redSoft, color: C.red }}>Reprovado — instruções do vendedor: {L.motivo}</div>}
      {erro && <div className="text-xs" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <Loader2 size={15} className="animate-spin" style={{ color: C.sub }} />}
      {d && d.itens.map((i) => (
        <div key={i.idx} className="rounded-lg p-2.5 mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded overflow-hidden flex items-center justify-center" style={{ width: 92, height: 92, background: C.panel2, border: `1px solid ${C.line}` }}>
              {i.arquivo ? (img(i.arquivo) ? <a href={urlArq(i.arquivo)} target="_blank" rel="noreferrer"><img src={urlArq(i.arquivo)} alt="" style={{ width: 92, height: 92, objectFit: "contain" }} /></a>
                : <a href={urlArq(i.arquivo)} target="_blank" rel="noreferrer" className="text-[11px] text-center px-1" style={{ color: C.red }}><FileText size={22} className="mx-auto" />{i.arquivo.nome}</a>)
                : <span className="text-[11px]" style={{ color: C.sub }}>sem layout</span>}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="text-sm font-semibold" style={{ color: C.text }}>{i.idx + 1}. {i.descricao || "—"}</div>
              <div style={{ color: C.sub }}>{[i.tipoPecaNome, i.codigo ? `cód. ${i.codigo}` : "", i.fppNumero ? `FPP ${String(i.fppNumero).padStart(5, "0")}` : ""].filter(Boolean).join(" · ")}</div>
              {i.grade.length > 0 && <div className="mt-0.5" style={{ color: C.text }}>{i.grade.map((g) => `${g.tam}:${g.qtd}`).join("  ")} · <b>{i.grade.reduce((s0, g) => s0 + Number(g.qtd || 0), 0)} pç</b></div>}
              {Object.entries(i.parametros || {}).filter(([k, v]) => v && typeof v !== "object").length > 0 && <div className="mt-1 flex flex-wrap gap-x-3" style={{ color: C.sub }}>
                {Object.entries(i.parametros).filter(([, v]) => v && typeof v !== "object").map(([k, v]) => <span key={k}><b>{k}</b> {String(v)}</span>)}</div>}
              {(i.arquivos || []).length > 0 && <div className="mt-1.5 flex flex-col gap-0.5">
                {i.arquivos.map((a) => <div key={a.id} className="flex items-center gap-1.5">
                  <FileText size={11} style={{ color: C.accent }} />
                  <a href={urlArq(a)} target="_blank" rel="noreferrer" draggable onDragStart={(e) => arrastarArquivo(e, a, urlArq(a))} className="truncate" style={{ color: C.blue, maxWidth: 320 }} title={a.nome}>{a.nome.replace(/^LAYOUT item \d+ · /, "")}</a>
                  {criacao && meu && aberta && <button onClick={() => tirar(i.idx, a)} title="Tirar do item" style={{ color: C.sub }}><X size={12} /></button>}
                </div>)}
              </div>}
              {criacao && meu && aberta && <label className="inline-flex items-center gap-1 mt-2 px-2 py-1 rounded cursor-pointer font-semibold" style={{ border: "1px dashed #7E3AF2", color: "#7E3AF2" }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); subir(i.idx, e.dataTransfer.files); }}>
                {ocup === `up${i.idx}` ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} {(i.arquivos || []).length ? "Adicionar arquivos" : "Anexar layout"} <span className="font-normal" style={{ color: C.sub }}>(vários, qualquer formato · ou arraste)</span>
                <input type="file" multiple className="hidden" onChange={(e) => { subir(i.idx, e.target.files); e.target.value = ""; }} /></label>}
            </div>
          </div>
        </div>
      ))}
      {d && criacao && meu && aberta && <div className="flex justify-end"><Btn cor="#7E3AF2" disabled={!!ocup || d.itens.some((i) => !(i.arquivos || []).length)} onClick={() => acao("enviar")}>{ocup === "enviar" ? "Enviando…" : "Enviar para aprovação do vendedor"}</Btn></div>}
      {d && !criacao && meu && aberta && <div className="mt-1">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Instruções para o arte finalista (obrigatório para reprovar)" className={inp} style={inpS} />
        <div className="flex justify-end gap-2 mt-2">
          <Btn fundo={C.redSoft} cor={C.red} disabled={!!ocup} onClick={() => acao("reprovar")}>Reprovar</Btn>
          <Btn cor={C.green} disabled={!!ocup} onClick={() => acao("aprovar")}><CheckCircle2 size={13} /> Aprovar layout</Btn>
        </div>
      </div>}
      {!aberta && <div className="text-xs" style={{ color: C.sub }}>{t.retorno}</div>}
    </div>
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
  // v611 — sem arrastar/prévia nativa da foto (no iPhone o toque longo na foto cancelava o arraste da tarefa)
  return foto ? <img src={foto} alt="" draggable={false} className="rounded-full shrink-0 object-cover" style={{ width: size, height: size, pointerEvents: "none", WebkitUserDrag: "none", WebkitTouchCallout: "none" }} />
    : <span className="rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ width: size, height: size, background: "#C7C4C4", color: "#fff" }}>{iniciais(nome)}</span>;
}
// v592 — tarefa de projeto fica com a cor do projeto (urgente ganha borda vermelha)
// v600 — evento abaixo das pessoas necessárias fica amarelo
const corCard = (t, proj) => t.evento && t.efetivo && !t.efetivoOk ? ["#FCE7A6", "#E5B53A"] : proj?.cor ? [`${proj.cor}40`, t.tipo === "URGENTE" ? "#E8384F" : proj.cor] : t.tipo === "URGENTE" ? [A.cardVerm, A.cardVermBorda] : [A.cardBranco, A.cardBrancoBorda];   // v646 — rotina sem azul
// v648 — ordem do dia: período (manhã antes de tarde), depois a ordem escolhida arrastando; sem ordem gravada, as com horário primeiro.
//   As que têm horário ocupam as mesmas posições, mas reordenadas entre si de mais cedo para mais tarde.
export function ordenarDia(l) {
  const base = [...l].sort((a, b) => (periodoDe(a) === "TARDE") - (periodoDe(b) === "TARDE") || (a.ordem ?? 1e6) - (b.ordem ?? 1e6)
    || (a.hora ? 0 : 1) - (b.hora ? 0 : 1) || (a.hora || "").localeCompare(b.hora || "") || a.id - b.id);
  const comHora = base.filter((x) => x.hora).sort((a, b) => a.hora.localeCompare(b.hora) || (a.horaFim || "").localeCompare(b.horaFim || "") || a.id - b.id);
  let k = 0;
  return base.map((x) => (x.hora ? comHora[k++] : x));
}
const horaTxt = (t) => (t.hora ? `${t.hora}${t.horaFim ? `–${t.horaFim}` : ""}` : "");

function CardAgenda({ t, proj, foto, onClick, onDragStart, onDragEnd, onConcluir, onMenu, toque, grande, pres, arrastado }) {
  // v228 — card do tamanho fixo do Asana: título cortado numa linha; no hover o conteúdo desliza e aparece o check
  // v550 — toque (celular): card mais alto, check sempre visível, texto maior
  const [bg, bd] = corCard(t, proj);
  const feita = t.status === "CONCLUIDA";
  if (toque) return (
    <div onClick={onClick} {...(pres || {})} className="rounded-lg flex items-center gap-2 px-2 cursor-pointer select-none shrink-0"
      style={{ minHeight: 48, background: bg, border: `1px solid ${bd}`, color: A.texto, opacity: arrastado ? 0.35 : feita ? 0.6 : 1, WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", WebkitTapHighlightColor: "transparent", transition: "opacity .15s" }}>
      <button onClick={(e) => { e.stopPropagation(); onConcluir?.(); }} title={feita ? "Reabrir" : "Concluir"} className="flex items-center justify-center rounded-full shrink-0"
        style={{ width: 28, height: 28, border: `2px solid ${feita ? "#5DA283" : "#6D6E6F"}`, background: feita ? "#5DA283" : "rgba(255,255,255,.8)" }}>
        <svg width="13" height="13" viewBox="0 0 12 12"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke={feita ? "#fff" : "#6D6E6F"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <AvatarMini foto={foto} nome={t.responsavelNome} size={24} />
      <div className="flex-1 min-w-0 py-1.5">
        <div className="text-[15px] leading-tight truncate" style={{ textDecoration: feita ? "line-through" : "none" }}>{t.titulo.charAt(0) + t.titulo.slice(1).toLowerCase()}</div>
        {(t.hora || proj) && <div className="text-[12px] flex items-center gap-1.5 mt-0.5" style={{ color: A.sub }}>{t.hora && <b>{horaTxt(t)}</b>}{proj && <><span className="rounded-[3px]" style={{ width: 9, height: 9, background: proj.cor }} />{proj.nome}</>}</div>}
      </div>
      {t.meuConvite === "PENDENTE" && <span title="Convite aguardando sua decisão" className="shrink-0 rounded-full flex items-center justify-center text-[12px] font-black" style={{ width: 20, height: 20, background: "#F5B700", color: "#fff" }}>!</span>}
      {t.evento && <span className="text-[11px] font-semibold flex items-center gap-0.5 shrink-0" style={{ color: A.sub }}><Users size={12} />{t.confirmados || 0}{t.efetivo ? `/${t.efetivo}` : ""}</span>}
      {t.sessaoAberta && <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: C.yellow }} />}
      {t.nArquivos > 0 && <Paperclip size={12} className="shrink-0" style={{ color: A.sub }} />}
      {t.natureza === "PESSOAL" && <Lock size={12} className="shrink-0" style={{ color: A.sub }} />}
      {t.decisao && <Vote size={12} className="shrink-0" style={{ color: "#7E3AF2" }} />}{t.reuniao && <Landmark size={12} className="shrink-0" style={{ color: "#001E41" }} />}
      {t.serieId && <Repeat size={12} className="shrink-0" style={{ color: A.sub }} title="Recorrente" />}
    </div>
  );
  return (
    <div {...(pres || {})} onDragStart={(e) => e.preventDefault()} onClick={onClick} onContextMenu={(e) => { e.preventDefault(); if (Date.now() - (globalThis.__ceToque || 0) > 1500) onMenu?.(e.clientX, e.clientY); }}
      title={`${t.titulo}${t.hora ? ` · ${horaTxt(t)}` : ""}`}
      className="card-asana group relative rounded-md flex items-center overflow-hidden cursor-pointer select-none shrink-0" draggable={false}
      style={{ height: 36, background: bg, border: `1px solid ${bd}`, color: A.texto, opacity: arrastado ? 0.4 : feita ? 0.6 : 1 }}>
      <button onClick={(e) => { e.stopPropagation(); onConcluir?.(); }} title={feita ? "Reabrir" : "Concluir"}
        className={`absolute left-1.5 flex items-center justify-center rounded-full ${feita ? "" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"}`}
        style={{ width: 18, height: 18, border: `1.5px solid ${feita ? "#5DA283" : "#6D6E6F"}`, background: feita ? "#5DA283" : "rgba(255,255,255,.7)", transition: "all .18s ease" }}>
        <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke={feita ? "#fff" : "#6D6E6F"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className={`flex items-center gap-1.5 min-w-0 flex-1 pl-2 pr-1 ${feita ? "translate-x-5" : "group-hover:translate-x-5"}`} style={{ transition: "transform .18s ease" }}>
        <AvatarMini foto={foto} nome={t.responsavelNome} size={20} />
        {/* v597 — dia ampliado: título inteiro (quebra a linha) */}
        <span className="truncate text-[12.5px] leading-none" style={{ textDecoration: feita ? "line-through" : "none" }}>   {/* v649 — sempre uma linha, com reticências */}
          {t.hora && <b className="mr-1">{t.hora}</b>}{t.titulo.charAt(0) + t.titulo.slice(1).toLowerCase()}
        </span>
      </div>
      <div className="flex items-center gap-1 pr-2 shrink-0">
        {t.meuConvite === "PENDENTE" && <span title="Convite aguardando sua decisão" className="rounded-full flex items-center justify-center text-[10px] font-black" style={{ width: 15, height: 15, background: "#F5B700", color: "#fff" }}>!</span>}
        {t.evento && <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: A.sub }} title={t.efetivo ? `${t.confirmados} de ${t.efetivo} confirmados` : `${t.confirmados} confirmados`}><Users size={10} />{t.confirmados || 0}{t.efetivo ? `/${t.efetivo}` : ""}</span>}
        {t.sessaoAberta && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.yellow }} />}
        {t.nArquivos > 0 && <Paperclip size={10} style={{ color: A.sub }} />}
        {t.natureza === "PESSOAL" && <Lock size={10} style={{ color: A.sub }} />}
        {t.decisao && <Vote size={10} style={{ color: "#7E3AF2" }} title="Decisão" />}{t.reuniao && <Landmark size={10} style={{ color: "#001E41" }} title="Reunião de gestão" />}
        {t.serieId && <Repeat size={10} style={{ color: A.sub }} title="Recorrente" />}   {/* v646 */}
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

function ProjetoForm({ user, inicial, projetos = [], usuarios = [], onClose, onOk }) {
  // v592 — natureza do projeto (pessoal: só você, só tarefas pessoais) · cor sempre definida (sugere uma ainda não usada)
  const livre = CORES_PROJ.find((c) => !projetos.some((p) => String(p.cor).toUpperCase() === c.toUpperCase())) || CORES_PROJ[projetos.length % CORES_PROJ.length];
  // v599 — acesso: todos (só funcional) · pessoas selecionadas · só eu
  const ac0 = inicial?.acesso || (inicial?.natureza === "PESSOAL" ? "SO_EU" : inicial?.publico === false ? "SO_EU" : "TODOS");
  const [f, setF] = useState({ nome: inicial?.nome || "", cor: inicial?.cor || livre, natureza: inicial?.natureza === "PESSOAL" ? "PESSOAL" : "FUNCIONAL", acesso: ac0, membros: inicial?.membros || [] });
  const [buscaM, setBuscaM] = useState("");
  const dono = inicial?.donoId || user.id;
  const candidatos = usuarios.filter((x) => x.id !== dono && (!buscaM || String(x.nome).toUpperCase().includes(buscaM.toUpperCase())));
  const marcar = (id) => setF((x) => ({ ...x, membros: x.membros.includes(id) ? x.membros.filter((y) => y !== id) : [...x.membros, id] }));
  const mudouTipo = inicial?.id && (inicial.natureza === "PESSOAL") !== (f.natureza === "PESSOAL");
  const [st, setSt] = useState(false), [erro, setErro] = useState("");
  const salvar = async () => { setSt(true); setErro(""); try { await api("/api/tarefas/projetos", "POST", { usuarioId: user.id, projeto: { id: inicial?.id, ...f, publico: f.acesso === "TODOS" } }); onOk(); } catch (e) { setErro(e.message); setSt(false); } };
  const excluir = async () => { if (!(await confirmar(`Excluir o projeto "${inicial.nome}"? As tarefas ficam, só saem do projeto.`))) return; try { await api("/api/tarefas/projetos", "DELETE", { usuarioId: user.id, id: inicial.id }); onOk(); } catch (e) { alerta(e.message); } };
  return (
    <Janela titulo={inicial?.id ? "Editar projeto" : "Novo projeto"} onClose={onClose} largura={460}
      rodape={<>
        {inicial?.id && <button onClick={excluir} className="mr-auto text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
        {erro && <span className="text-xs mr-auto" style={{ color: C.red }}>{erro}</span>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={st || !f.nome.trim()} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: A.azul, opacity: st || !f.nome.trim() ? 0.5 : 1 }}>{inicial?.id ? "Salvar" : "Criar projeto"}</button>
      </>}>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Tipo</div>
      <div className="flex gap-1 mb-3">
        {[["PESSOAL", "Pessoal", "#7E3AF2"], ["FUNCIONAL", "Funcional", "#4573D2"]].map(([k, t, c]) => <button key={k} onClick={() => setF((x) => ({ ...x, natureza: k, acesso: k === "PESSOAL" && x.acesso === "TODOS" ? "SO_EU" : x.acesso }))}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold" style={f.natureza === k ? { background: c, color: "#fff" } : { background: C.panel2, color: C.text }}>{t}</button>)}
      </div>
      <label className="block text-xs mb-3" style={{ color: C.sub }}>Nome
        <input value={f.nome} autoFocus onChange={(e) => setF((x) => ({ ...x, nome: e.target.value }))} className={`${inp} mt-1`} style={inpS} />
      </label>
      <div className="text-xs mb-1" style={{ color: C.sub }}>Cor</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {CORES_PROJ.map((c) => <button key={c} onClick={() => setF((x) => ({ ...x, cor: c }))} className="rounded-md" style={{ width: 26, height: 26, background: c, boxShadow: f.cor === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "none", transform: f.cor === c ? "scale(1.1)" : "none" }} />)}
      </div>
      {mudouTipo && <div className="text-[11px] mb-3 rounded-lg px-2 py-1.5" style={{ background: "#FFF6E5", color: "#8A5A00" }}>As tarefas do projeto vão junto para {f.natureza === "PESSOAL" ? "pessoal" : "funcional"}{f.natureza === "PESSOAL" ? " (as atribuídas por outra pessoa continuam funcionais, dentro do projeto)" : ""}.</div>}
      <div className="text-xs mb-1" style={{ color: C.sub }}>Quem vê as tarefas do projeto</div>
      <div className="flex gap-1 mb-2">
        {[...(f.natureza === "PESSOAL" ? [] : [["TODOS", "Todos", Globe]]), ["SELECIONADOS", "Pessoas selecionadas", Users], ["SO_EU", "Só eu", Lock]].map(([k, t, Ico]) => <button key={k} onClick={() => setF((x) => ({ ...x, acesso: k }))}
          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1" style={f.acesso === k ? { background: A.azul, color: "#fff" } : { background: C.panel2, color: C.text }}><Ico size={12} /> {t}</button>)}
      </div>
      {f.acesso === "SELECIONADOS" && <div className="rounded-lg mb-1" style={{ border: `1px solid ${C.line}` }}>
        <input value={buscaM} onChange={(e) => setBuscaM(e.target.value)} placeholder={`Buscar pessoa… (${f.membros.length} selecionada${f.membros.length === 1 ? "" : "s"})`} className="w-full px-2 py-1.5 text-xs outline-none rounded-t-lg" style={{ borderBottom: `1px solid ${C.line}` }} />
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {candidatos.map((x) => <label key={x.id} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={f.membros.includes(x.id)} onChange={() => marcar(x.id)} /><span className="flex-1 truncate">{x.nome}</span>
          </label>)}
          {!candidatos.length && <div className="px-2 py-2 text-xs" style={{ color: C.sub }}>Ninguém encontrado.</div>}
        </div>
      </div>}
      <div className="text-[11px] flex items-center gap-1" style={{ color: C.sub }}>
        {f.acesso === "TODOS" ? <><Globe size={11} /> Todos veem as tarefas públicas do projeto.</> : <><Lock size={11} /> Só {f.acesso === "SELECIONADOS" ? "você e as pessoas marcadas" : "você"} veem as tarefas do projeto (o responsável sempre vê a própria tarefa).</>}
      </div>
    </Janela>
  );
}

// v600 — responder convite
async function responderConviteApi(user, tarefaId, resposta) {
  try { await api("/api/tarefas/convites", "POST", { usuarioId: user.id, acao: "responder", tarefaId, resposta }); } catch (e) { alerta(e.message); }
}
// v600 — popup ao abrir a agenda: convites a responder (volta todo dia até decidir) e, para quem criou, eventos abaixo das pessoas necessárias
function PopupConvites({ user, onMudou }) {
  const [p, setP] = useState(null);
  useEffect(() => { api(`/api/tarefas/convites?u=${user.id}`).then(setP).catch(() => {}); }, []);
  if (!p || (!p.convites.length && !p.efetivo.length)) return null;
  const quando = (x) => `${dBR(x.prazo)}${x.hora ? ` às ${x.hora}${x.horaFim ? `–${x.horaFim}` : ""}` : x.periodo === "TARDE" ? " · tarde" : x.periodo === "MANHA" ? " · manhã" : ""}`;
  const responder = async (x, r) => { await responderConviteApi(user, x.tarefaId, r); setP((v) => ({ ...v, convites: v.convites.filter((y) => y.tarefaId !== x.tarefaId) })); if (r !== "DEPOIS") onMudou?.(); };
  const fecharEfetivo = async () => { try { await api("/api/tarefas/convites", "POST", { usuarioId: user.id, acao: "visto", ids: p.efetivo.map((x) => x.tarefaId) }); } catch {} setP((v) => ({ ...v, efetivo: [] })); };
  const depoisTodos = async () => { for (const x of p.convites) await responderConviteApi(user, x.tarefaId, "DEPOIS"); setP((v) => ({ ...v, convites: [] })); };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.35)" }}>
      <div className="rounded-2xl shadow-2xl w-full anim-modal" style={{ maxWidth: 480, background: "#fff", maxHeight: "85vh", overflowY: "auto" }}>
        {p.convites.length > 0 && <div className="p-4">
          <div className="flex items-center gap-2 mb-3"><CalendarDays size={18} style={{ color: A.azul }} /><b className="flex-1">Convite{p.convites.length > 1 ? "s" : ""} para você</b>
            <button onClick={depoisTodos} className="text-xs" style={{ color: A.sub }}>Decidir depois</button></div>
          {p.convites.map((x) => <div key={x.tarefaId} className="rounded-xl p-3 mb-2" style={{ border: `1px solid ${A.linha}` }}>
            <div className="font-semibold">{x.titulo.charAt(0) + x.titulo.slice(1).toLowerCase()}</div>
            <div className="text-xs mb-1" style={{ color: A.sub }}>{quando(x)} · convite de {x.criadoPorNome}</div>
            {x.descricao && <div className="text-xs mb-2 whitespace-pre-wrap" style={{ color: A.texto }}>{x.descricao}</div>}
            <div className="flex gap-1.5">
              <button onClick={() => responder(x, "CONFIRMAR")} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#3F8A5F" }}>Confirmar</button>
              <button onClick={() => responder(x, "RECUSAR")} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: C.redSoft, color: C.red }}>Recusar</button>
              <button onClick={() => responder(x, "DEPOIS")} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: "#FCEFC7", color: "#8A5A00" }}>Decidir depois</button>
            </div>
          </div>)}
        </div>}
        {!p.convites.length && p.efetivo.length > 0 && <div className="p-4">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} style={{ color: "#D99A00" }} /><b className="flex-1">Eventos ainda sem as pessoas necessárias</b></div>
          {p.efetivo.map((x) => <div key={x.tarefaId} className="rounded-xl p-3 mb-2" style={{ background: "#FFF8E6", border: "1px solid #F1D58A" }}>
            <div className="font-semibold">{x.titulo.charAt(0) + x.titulo.slice(1).toLowerCase()}</div>
            <div className="text-xs" style={{ color: A.sub }}>{quando(x)}</div>
            <div className="text-sm mt-1"><b>{x.confirmados} de {x.efetivo}</b> confirmados{x.recusados ? ` · ${x.recusados} recusaram` : ""}</div>
            {x.pendentes.length > 0 && <div className="text-[11px] mt-0.5" style={{ color: A.sub }}>Ainda não responderam: {x.pendentes.join(", ")}</div>}
          </div>)}
          <button onClick={fecharEfetivo} className="w-full py-2 rounded-lg text-sm font-semibold text-white mt-1" style={{ background: A.azul }}>Ok, vi</button>
        </div>}
      </div>
    </div>
  );
}

/* v603 — régua de horários na lateral esquerda do dia em que a tarefa está sendo posicionada (troca de dia junto com o arraste) */
// v634 — dia inteiro: 00:00 até 23:30 (o último bloco vai até 00h)
const SLOTS_HORA = Array.from({ length: 48 }, (_, k) => `${String(Math.floor(k / 2)).padStart(2, "0")}:${k % 2 ? "30" : "00"}`);
function ReguaDia({ dia, alvo, atual, h = 21 }) {   // v610 — régua maior (mais fácil acertar o horário)
  return (
    <div className="shrink-0 flex flex-col rounded-lg overflow-hidden anim-entrar" style={{ width: 68, background: "#fff", border: `1px solid ${A.cardBrancoBorda}`, boxShadow: "0 2px 8px rgba(30,31,33,.12)" }}>
      {["", ...SLOTS_HORA].map((hh) => {
        const z = `h|${dia}|${hh}`, on = alvo === z, cheia = hh.endsWith(":00");
        return <div key={z} data-zona={z} className="flex items-center justify-center text-[12.5px] leading-none"
          style={{ height: h, background: on ? A.azul : (atual || "") === hh ? A.azulSoft : "transparent", color: on ? "#fff" : cheia || !hh ? A.texto : A.sub, fontWeight: cheia || on ? 700 : 400,
            borderTop: cheia ? `1px solid ${A.linha}` : "none" }}>{hh || "s/ hora"}</div>;
      })}
    </div>
  );
}
// celular, mês: a grade é pequena demais para abrir o dia — a régua fica fixa à esquerda com o dia sob o dedo
const SEM3 = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function PainelHoras({ dia, alvo, atual }) {
  return (
    <div className="fixed z-[70] left-0 flex flex-col anim-entrar" style={{ top: 0, bottom: 0, width: 74, background: "#fff", borderRight: `1px solid ${A.linha}`, boxShadow: "6px 0 18px rgba(30,31,33,.15)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="text-[11px] font-bold text-center py-1.5 leading-tight" style={{ color: A.azul, borderBottom: `1px solid ${A.linha}` }}>{SEM3[dUTC(dia).getUTCDay()]}<br />{Number(dia.slice(8))}/{Number(dia.slice(5, 7))}</div>
      {["", ...SLOTS_HORA].map((hh) => {
        const z = `h|${dia}|${hh}`, on = alvo === z, cheia = hh.endsWith(":00");
        return <div key={z} data-zona={z} className="flex-1 flex items-center justify-center text-[11px]"
          style={{ minHeight: 10, background: on ? A.azul : (atual || "") === hh ? A.azulSoft : "transparent", color: on ? "#fff" : cheia || !hh ? A.texto : A.sub, fontWeight: cheia ? 700 : 400, borderTop: cheia ? `1px solid ${A.linha}` : "none" }}>{hh || "sem hora"}</div>;
      })}
    </div>
  );
}
function Sentinela({ onMais, dep }) {
  const el = useRef(null), f = useRef(onMais); f.current = onMais;
  useEffect(() => {
    if (!el.current || typeof IntersectionObserver === "undefined") return;
    const ob = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) f.current?.(); }, { rootMargin: "500px 0px" });
    ob.observe(el.current); return () => ob.disconnect();
  }, [dep]);
  return <div ref={el} className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin" style={{ color: A.sub }} /></div>;
}

/* v590 — celular: mês no estilo do calendário do iPhone (domingo primeiro, hoje em círculo vermelho, tarefas em pílulas).
   Toque no dia: lista as tarefas dele embaixo · arrastar para o lado troca o mês. */
const SEM_DOM = ["D", "S", "T", "Q", "Q", "S", "S"];
const corPilula = (t, proj) => (t.evento && t.efetivo && !t.efetivoOk ? "#D99A00" : null) || proj?.cor || (t.tipo === "URGENTE" ? "#E8384F" : "#8A8B8C");
function MesMobile({ ref0, H, porDia, P, fotos, nMeses = 3, topo = 0, onMais, onDia, onMover, onNova, onAbrir, onConcluir, onSemana, pressionar, alvo, arrastandoId }) {
  // v592 — rolar para baixo emenda o mês seguinte (infinito); o dia tocado abre embaixo do mês dele
  const ano0 = Number(ref0.slice(0, 4)), mes0 = Number(ref0.slice(5, 7));
  const meses = Array.from({ length: nMeses }, (_, k) => new Date(Date.UTC(ano0, mes0 - 1 + k, 1)).toISOString().slice(0, 7));
  const [sel, setSel] = useState(ref0.slice(0, 7) === H.slice(0, 7) ? H : `${ref0.slice(0, 7)}-01`);
  useEffect(() => { setSel(ref0.slice(0, 7) === H.slice(0, 7) ? H : `${ref0.slice(0, 7)}-01`); }, [ref0.slice(0, 7)]);
  const toque = useRef(null);
  const fim = useRef(null);
  const painel = useRef(null);
  const maisRef = useRef(onMais); maisRef.current = onMais;
  // v594 — ao abrir o mês (ou tocar em "Mês" de novo) volta para o topo: o mês aparece primeiro, não a lista do dia
  const raiz = useRef(null);
  useEffect(() => {
    const ir = () => { let el = raiz.current?.parentElement; while (el) { const o = getComputedStyle(el).overflowY; if ((o === "auto" || o === "scroll") && el.scrollTop) el.scrollTop = 0; el = el.parentElement; } window.scrollTo(0, 0); };
    ir(); const t = setTimeout(ir, 80); return () => clearTimeout(t);
  }, [topo, ref0.slice(0, 7)]);
  useEffect(() => {
    if (!fim.current || typeof IntersectionObserver === "undefined") return;
    const ob = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) maisRef.current?.(); }, { rootMargin: "600px 0px" });
    ob.observe(fim.current); return () => ob.disconnect();
  }, [nMeses]);
  const lSel = porDia[sel] || [];
  const tocarDia = (dia) => { setSel(dia); onDia?.(dia); setTimeout(() => painel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60); };
  return (
    <div ref={raiz} style={{ paddingLeft: arrastandoId ? 74 : 0, transition: "padding .15s" }} onTouchStart={(e) => { toque.current = [e.touches[0].clientX, e.touches[0].clientY]; }}
      onTouchEnd={(e) => { const t0 = toque.current; toque.current = null; if (!t0 || arrastandoId) return; const dx = e.changedTouches[0].clientX - t0[0], dy = e.changedTouches[0].clientY - t0[1]; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onMover(dx < 0 ? 1 : -1); }}>
      <div className="grid grid-cols-7 py-1" style={{ borderBottom: `1px solid ${A.linha}`, position: "sticky", top: 0, zIndex: 5, background: A.fundo }}>
        {SEM_DOM.map((x, i) => <div key={i} className="text-center text-[11px] font-semibold" style={{ color: A.sub }}>{x}</div>)}
      </div>
      {meses.map((ym) => {
        const ano = Number(ym.slice(0, 4)), mes = Number(ym.slice(5, 7));
        const p1 = `${ym}-01`, desloc = dUTC(p1).getUTCDay();   // domingo = 0
        const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const cel = [...Array(desloc).fill(null), ...Array.from({ length: nDias }, (_, k) => somaDia(p1, k))];
        while (cel.length % 7) cel.push(null);
        const semanas = Array.from({ length: cel.length / 7 }, (_, k) => cel.slice(k * 7, k * 7 + 7));
        return (
          <div key={ym}>
            <div className="px-4 pt-4 pb-1 flex items-baseline gap-2">
              <span className="text-[28px] font-bold leading-none" style={{ color: ym === H.slice(0, 7) ? "#FF3B30" : A.texto }}>{MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1)}</span>
              <span className="text-base font-semibold" style={{ color: A.sub }}>{ano}</span>
            </div>
            {semanas.map((sem, i) => (
              <div key={i} className="grid grid-cols-7" style={{ borderBottom: `1px solid ${A.linha}` }}>
                {sem.map((dia, k) => {
                  if (!dia) return <div key={k} style={{ minHeight: 92 }} />;
                  const l = porDia[dia] || [], hoje = dia === H, marcado = dia === sel, fds = k === 0 || k === 6;
                  return (
                    <button key={dia} data-zona={`d|${dia}`} onClick={() => tocarDia(dia)} className="flex flex-col items-center pt-1.5 pb-1 min-w-0"
                      style={{ minHeight: 92, background: alvo === `d|${dia}` ? A.azulSoft : "transparent", boxShadow: alvo === `d|${dia}` ? `inset 0 0 0 2px ${A.azul}` : "none", transition: "background .12s" }}>
                      <span className="inline-flex items-center justify-center rounded-full text-[17px]" style={{ width: 32, height: 32, fontWeight: hoje || marcado ? 700 : 500,
                        background: hoje ? "#FF3B30" : marcado ? A.texto : "transparent", color: hoje || marcado ? "#fff" : fds ? "#8E8E93" : A.texto, transition: "background .15s" }}>{Number(dia.slice(8))}</span>
                      <div className="w-full flex flex-col gap-[3px] mt-1 px-[2px]">
                        {l.slice(0, 3).map((t) => { const c = corPilula(t, P[t.projetoId]); return (
                          <span key={t.id} className="block truncate rounded-[4px] px-1 text-[10px] font-semibold leading-[15px] text-left" style={{ background: `${c}2E`, color: c === "#8A8B8C" ? A.texto : c, ...(t.status === "CONCLUIDA" ? { textDecoration: "line-through", opacity: 0.5 } : {}) }}>
                            {t.meuConvite === "PENDENTE" && <b style={{ color: "#D99A00" }}>! </b>}{t.titulo.charAt(0) + t.titulo.slice(1).toLowerCase()}
                          </span>); })}
                        {l.length > 3 && <span className="text-[10px] font-semibold" style={{ color: A.sub }}>+{l.length - 3}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
            {/* tarefas do dia tocado: embaixo do mês dele */}
            {sel.slice(0, 7) === ym && <div ref={painel} className="px-3 pt-3 pb-4" style={{ background: A.fundo2, borderBottom: `1px solid ${A.linha}`, scrollMarginBottom: 16 }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold" style={{ color: sel === H ? "#FF3B30" : A.texto }}>{sel === H ? "Hoje" : ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][dUTC(sel).getUTCDay()]}, {Number(sel.slice(8))} de {MESES[Number(sel.slice(5, 7)) - 1]}</span>
                <span className="flex-1" />
                <button onClick={() => onSemana(sel)} className="text-xs font-semibold px-2 py-1.5 rounded-lg" style={{ color: A.azul }}>Ver semana</button>
                <button onClick={() => onNova(sel)} title="Nova tarefa neste dia" className="p-1.5 rounded-lg" style={{ color: A.azul }}><Plus size={20} /></button>
              </div>
              <div className="flex flex-col gap-1.5">
                {/* v597 — segurar a tarefa: arrasta para outro dia do mês ou abre o marco de horários ao lado */}
                {lSel.map((t) => <CardAgenda key={t.id} toque t={t} proj={P[t.projetoId]} foto={fotos[t.responsavelId]} onClick={() => onAbrir(t.id)} onConcluir={() => onConcluir(t)}
                  pres={pressionar?.(t)} arrastado={arrastandoId === t.id} />)}
                {lSel.length > 0 && <div className="text-[11px] text-center pt-1" style={{ color: "#B7B3B3" }}>Segure uma tarefa para mudar o dia ou o horário</div>}
                {!lSel.length && <div className="text-sm py-3 text-center" style={{ color: "#B7B3B3" }}>Nenhuma tarefa neste dia.</div>}
              </div>
            </div>}
          </div>
        );
      })}
      <div ref={fim} className="py-6 flex justify-center pb-24"><Loader2 size={16} className="animate-spin" style={{ color: A.sub }} /></div>
    </div>
  );
}

// v561 — períodos do dia (como nas rotas): tarde = horário a partir de 12:00; sem horário fica na manhã
const PERIODOS = [["Manhã", "MANHA"], ["Tarde", "TARDE"]];
// v600 — sem horário vale o período escolhido (soltar no período não inventa hora)
const periodoDe = (t) => (t.hora ? (t.hora >= "12:00" ? "TARDE" : "MANHA") : t.periodo === "TARDE" ? "TARDE" : "MANHA");
export function Agenda({ user, pedidoModo, onModo }) {
  const [tela, setTela] = useState("calendario");   // calendario | tarefas
  const [modo, setModo] = useState(pedidoModo?.modo === "mes" ? "mes" : "semana");        // abre na semana atual
  // v592 — botão "Mês" do topo (celular) troca a visualização daqui de fora
  const [topoMes, setTopoMes] = useState(0);
  useEffect(() => { if (pedidoModo?.modo) { setTela("calendario"); setModo(pedidoModo.modo); if (pedidoModo.modo === "mes") { setRef(hojeISO()); setTopoMes((n) => n + 1); } } }, [pedidoModo?.n]);
  useEffect(() => { onModo?.(modo); }, [modo]);
  const [nMeses, setNMeses] = useState(3);   // v592 — mês infinito no celular
  const [visao, setVisao] = useState("GERAL");       // GERAL | PESSOAL | FUNCIONAL
  const [projetoId, setProjetoId] = useState(null);
  const [ref, setRef] = useState(hojeISO());
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [abrir, setAbrir] = useState(null);
  const [projForm, setProjForm] = useState(null);
  const [dir, setDir] = useState(0);                 // direção da navegação (animação)
  const [menuCard, setMenuCard] = useState(null);    // { x, y, t } — botão direito
  const rolouHoje = useRef(false);   // v565 — celular: abre já no dia de hoje  // v561 — card sobre o qual a demanda arrastada vai ser posta (fica acima dele)
  const H = hojeISO();
  const mobile = useMobile();   // v550
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  // v597 — PC: o mês também rola para baixo (emenda as semanas dos meses seguintes)
  const dias = useMemo(() => {
    if (modo === "semana") { const i = inicioSemanaSeg(ref); return Array.from({ length: 7 }, (_, k) => somaDia(i, k)); }
    const p = `${ref.slice(0, 7)}-01`, i = inicioSemanaSeg(p);
    const fimMes = new Date(Date.UTC(ano, mes - 1 + (mobile ? 1 : nMeses), 0)).toISOString().slice(0, 10);
    const n = Math.ceil((Math.round((dUTC(fimMes) - dUTC(i)) / 86400000) + 1) / 7) * 7;
    return Array.from({ length: n }, (_, k) => somaDia(i, k));
  }, [modo, ref, nMeses, mobile]);
  useEffect(() => { setNMeses(3); }, [ref.slice(0, 7), modo]);
  const infinito = modo === "mes";
  const faixa = infinito ? [mobile ? `${ref.slice(0, 7)}-01` : dias[0], mobile ? new Date(Date.UTC(ano, mes - 1 + nMeses, 0)).toISOString().slice(0, 10) : dias[dias.length - 1]] : [dias[0], dias[dias.length - 1]];
  const carregar = () => api(`/api/tarefas?u=${user.id}&escopo=${projetoId ? "todas" : "agenda"}${projetoId ? `&projeto=${projetoId}` : ""}&de=${faixa[0]}&ate=${faixa[1]}`)
    .then(setD).catch(() => setD({ tarefas: [], usuarios: [], projetos: [], equipe: [] }));
  useEffect(() => { carregar(); }, [faixa[0], faixa[1], projetoId]);
  const projetos = d?.projetos || [];
  const P = useMemo(() => Object.fromEntries(projetos.map((p) => [p.id, p])), [projetos]);
  const fotos = useMemo(() => Object.fromEntries((d?.equipe || []).map((x) => [x.id, x.foto])), [d]);
  // v283 — concluída sai do calendário (continua na lista de Tarefas, filtro "Concluídas")
  // v591 — olho: mostra as concluídas (ficam guardadas; esmaecidas e riscadas no calendário). Lembra neste navegador.
  const [verConcl, setVerConcl] = useState(false);
  // v683 — dias passados sem tarefas ficam ocultos (semana); o botão ao lado do de concluídas mostra
  const [verPassados, setVerPassados] = useState(false);
  useEffect(() => { try { setVerPassados(localStorage.getItem("ce_agenda_passados") === "1"); } catch {} }, []);
  const alternarPassados = () => setVerPassados((v) => { try { localStorage.setItem("ce_agenda_passados", v ? "0" : "1"); } catch {} return !v; });
  useEffect(() => { try { setVerConcl(localStorage.getItem("ce_agenda_concl") === "1"); } catch {} }, []);
  const alternarConcl = () => setVerConcl((v) => { try { localStorage.setItem("ce_agenda_concl", v ? "0" : "1"); } catch {} return !v; });
  // v735 — "Designadas": troca as minhas tarefas pelas que eu criei para outras pessoas (seta escolhe o colaborador)
  const [designadas, setDesignadas] = useState(false);
  const [colab, setColab] = useState(null);
  const [menuColab, setMenuColab] = useState(false);
  const ehDesignada = (t) => t.criadoPorId === user.id && t.responsavelId !== user.id && !(t.layout?.etapa === "CRIACAO" || /^CRIAÇÃO DE LAYOUT/.test(t.titulo || ""));   // v737 — criação de layout é do arte finalista
  const colabs = useMemo(() => {
    const m = new Map();
    (d?.tarefas || []).filter((t) => ehDesignada(t) && t.status !== "CANCELADA").forEach((t) => { const x = m.get(t.responsavelId) || { id: t.responsavelId, nome: t.responsavelNome, n: 0 }; if (t.status !== "CONCLUIDA") x.n++; m.set(t.responsavelId, x); });
    return [...m.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
  }, [d]);
  useEffect(() => { if (colab && !colabs.some((c) => c.id === colab)) setColab(null); }, [colabs]);
  const daVez = (t) => (designadas ? ehDesignada(t) && (!colab || t.responsavelId === colab) : !ehDesignada(t));
  const nConcl = (d?.tarefas || []).filter((t) => daVez(t) && t.status === "CONCLUIDA" && (visao === "GERAL" || t.natureza === visao)).length;
  const filtradas = (d?.tarefas || []).filter((t) => daVez(t) && t.status !== "CANCELADA" && (verConcl || t.status !== "CONCLUIDA") && (visao === "GERAL" || t.natureza === visao));
  const porDia = useMemo(() => filtradas.reduce((a, t) => { (a[t.prazo] ||= []).push(t); return a; }, {}), [d, visao, verConcl, designadas, colab]);
  // v561 — ordem escolhida arrastando (ordem) e, sem ela, pelo horário
  // v605 — sempre pela ordem de horário; sem horário vem depois (manhã antes de tarde), na ordem escolhida arrastando
  // v648 — ordem livre arrastando (com ou sem horário); as que têm horário ficam de mais cedo para mais tarde entre si
  Object.keys(porDia).forEach((k) => { porDia[k] = ordenarDia(porDia[k]); });
  const mover = (n) => { setDir(n); setRef(modo === "semana" ? somaDia(ref, 7 * n) : (() => { const x = new Date(Date.UTC(ano, mes - 1 + n, 1)); return x.toISOString().slice(0, 10); })()); };
  const titulo = `${MESES[mes - 1]} de ${ano}`;
  const novaNoDia = (dia, per) => setForm({ prazo: dia, ...(per ? { periodo: per } : {}), responsavelId: user.id, setor: setorTarefaDe(user), projetoId, natureza: proj ? proj.natureza : visao === "FUNCIONAL" ? "FUNCIONAL" : "PESSOAL", publica: proj ? proj.natureza !== "PESSOAL" : visao === "FUNCIONAL" });   // v565 — nova tarefa começa pessoal
  const soltar = async (dia, t) => {
    if (!t || t.prazo === dia) return;
    try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: { prazo: dia } }); carregar(); } catch (e) { alerta(e.message); }
  };
  // v561 — manhã e tarde (como nas rotas): solta no período ou acima de outra demanda; a ordem fica gravada
  const soltarEm = async (dia, per, antesId, t) => {
    if (!t || antesId === t.id) return;
    const mud = {};
    if (t.prazo !== dia) mud.prazo = dia;
    if (periodoDe(t) !== per) { mud.periodo = per; if (t.hora) { mud.hora = null; mud.horaFim = null; } }
    const resto = (porDia[dia] || []).filter((x) => periodoDe(x) === per && x.id !== t.id).map((x) => x.id);
    const k = antesId ? resto.indexOf(antesId) : -1;
    const ids = k >= 0 ? [...resto.slice(0, k), t.id, ...resto.slice(k)] : [...resto, t.id];
    try {
      if (Object.keys(mud).length) await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: mud });
      await api("/api/tarefas", "POST", { usuarioId: user.id, acao: "ordenar", ids });
      carregar();
    } catch (e) { alerta(e.message); carregar(); }
  };
  // v597/v603 — soltar na régua: grava dia e hora (mantém a duração se tiver fim) e reordena o período pelo horário
  const minH = (x) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  const definirHora = async (t, dia, h) => {
    if (!t) return;
    const mud = { hora: h || null, horaFim: null };
    if (dia && dia !== t.prazo) mud.prazo = dia;
    if (h && t.hora && t.horaFim) { const f = Math.min(minH(h) + minH(t.horaFim) - minH(t.hora), 23 * 60 + 59); if (f > minH(h)) mud.horaFim = `${String(Math.floor(f / 60)).padStart(2, "0")}:${String(f % 60).padStart(2, "0")}`; }
    if (!mud.prazo && (t.hora || null) === mud.hora && (t.horaFim || null) === mud.horaFim) return;
    const d0 = mud.prazo || t.prazo;
    // v600 — aviso de conflito com outra tarefa no mesmo horário
    const c = conflitosHora((porDia[d0] || []).filter((x) => x.id !== t.id && x.responsavelId === t.responsavelId), mud.hora, mud.horaFim);
    if (c.length && !(await confirmar(`Já existe no mesmo horário:\n${c.map((x) => `• ${x.hora}${x.horaFim ? `–${x.horaFim}` : ""} ${x.titulo}`).join("\n")}\n\nColocar mesmo assim?`))) return;
    const nova = { ...t, ...mud }, per = periodoDe(nova);
    // v648 — as sem horário ficam onde estão; a nova entra na posição do horário dela entre as que têm horário
    const resto = (porDia[d0] || []).filter((x) => x.id !== t.id && periodoDe(x) === per);
    const k = nova.hora ? resto.findIndex((x) => x.hora && x.hora > nova.hora) : -1;
    const ids = ordenarDia(k >= 0 ? [...resto.slice(0, k), nova, ...resto.slice(k)] : [...resto, nova].map((x, i) => ({ ...x, ordem: i }))).map((x) => x.id);
    try {
      await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: "editar", tarefa: mud });
      await api("/api/tarefas", "POST", { usuarioId: user.id, acao: "ordenar", ids });
      carregar();
    } catch (e) { alerta(e.message); carregar(); }
  };
  // v597 — dia ampliado (PC): hoje começa ampliado; clicar em outro dia amplia ele
  const [selDia, setSelDia] = useState(H);
  /* v603 — arraste único para PC (mouse), iPad e celular (segurar 0,45 s): o dia sob o ponteiro amplia e mostra a régua de horários
     à esquerda; ao passar para outro dia, a régua vai junto. A tela não "pula": o dia novo fica parado sob o dedo/mouse. */
  const [arr, setArr] = useState(null);          // { t, x, y, toque }
  const [alvo, setAlvo] = useState(null);        // data-zona sob o ponteiro
  const [diaArr, setDiaArr] = useState(null);    // dia em que a tarefa está sendo posicionada
  const arrAtivo = useRef(false), semClique = useRef(0), diaArrRef = useRef(null), ancora = useRef(null), rolRef = useRef(null);
  const diaAmp = arr && diaArr ? diaArr : selDia;
  const diasVis = modo === "semana" && !verPassados ? dias.filter((x) => x >= H || (porDia[x] || []).length > 0) : dias;   // v683
  const nOcultos = dias.length - diasVis.length;
  const nCols = modo === "semana" ? diasVis.length || 1 : 7;
  const selK = diasVis.indexOf(diaAmp) >= 0 ? diasVis.indexOf(diaAmp) % nCols : -1;
  useEffect(() => {
    // listener fixo e não-passivo: só bloqueia a rolagem enquanto uma tarefa está sendo arrastada
    const h = (e) => { if (arrAtivo.current && e.cancelable) e.preventDefault(); };
    document.addEventListener("touchmove", h, { passive: false });
    return () => document.removeEventListener("touchmove", h);
  }, []);
  const rolante = (el) => { while (el && el !== document.body) { const o = getComputedStyle(el).overflowY; if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) return el; el = el.parentElement; } return document.scrollingElement; };
  const mudarDia = (dia) => {
    if (!dia || dia === diaArrRef.current) return;
    const el = document.querySelector(`[data-dia="${dia}"]`);
    ancora.current = el ? { dia, top: el.getBoundingClientRect().top } : null;
    diaArrRef.current = dia; setDiaArr(dia);
  };
  // mantém o dia novo parado sob o ponteiro quando o dia anterior encolhe
  useLayoutEffect(() => {
    const a = ancora.current; ancora.current = null;
    if (!a || !rolRef.current) return;
    const el = document.querySelector(`[data-dia="${a.dia}"]`); if (!el) return;
    const dy = el.getBoundingClientRect().top - a.top;
    if (Math.abs(dy) > 1) rolRef.current.scrollTop += dy;
  }, [diaArr]);
  const soltarZona = (t, z) => {
    if (!z) return;
    const [k, a, b, c] = z.split("|");
    if (k === "p") soltarEm(a, b, null, t);
    else if (k === "c") soltarEm(a, b, Number(c), t);
    else if (k === "d") soltar(a, t);
    else if (k === "h") definirHora(t, a, b);
    setSelDia(a);
  };
  const iniciar = (t, x, y, el, toque) => {
    if (toque) { try { navigator.vibrate?.(25); } catch {} }
    rolRef.current = rolante(el);
    let pos = [x, y], z = null, raf = 0, tmDia = 0, diaPend = null;
    arrAtivo.current = true; diaArrRef.current = null; setArr({ t, x, y, toque }); mudarDia(t.prazo);
    document.body.style.userSelect = "none"; document.body.style.webkitUserSelect = "none"; document.body.style.cursor = toque ? "" : "grabbing";
    try { window.getSelection()?.removeAllRanges(); } catch {}
    const semSel = (e) => e.preventDefault();
    document.addEventListener("selectstart", semSel); document.addEventListener("contextmenu", semSel);
    // v611 — celular/mês: só troca o dia da régua parando ~0,5 s em cima dele (passar pelos dias a caminho da régua não muda o dia)
    const esperaDia = mobile && modo === "mes" ? 550 : 140;
    const achar = () => {
      const nz = document.elementFromPoint(pos[0], pos[1])?.closest?.("[data-zona]")?.dataset.zona || null;
      if (nz !== z) { z = nz; setAlvo(nz); }
      const nd = z ? z.split("|")[1] : null;
      if (nd && nd !== diaArrRef.current) { if (nd !== diaPend) { diaPend = nd; clearTimeout(tmDia); tmDia = setTimeout(() => { mudarDia(diaPend); diaPend = null; requestAnimationFrame(achar); }, esperaDia); } }
      else { clearTimeout(tmDia); diaPend = null; }
    };
    const passo = () => {
      const m = 70, hh = window.innerHeight, v = pos[1] < m ? -(m - pos[1]) / 5 : pos[1] > hh - m ? (pos[1] - (hh - m)) / 5 : 0;
      if (v && rolRef.current) { rolRef.current.scrollTop += v; achar(); }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    const mover = (px, py) => { pos = [px, py]; setArr((s) => s && { ...s, x: px, y: py }); achar(); };
    const mvT = (ev) => { const q = ev.touches[0]; mover(q.clientX, q.clientY); };
    const mvM = (ev) => mover(ev.clientX, ev.clientY);
    const tecla = (ev) => { if (ev.key === "Escape") fim({ type: "cancelar" }); };
    const fim = (ev) => {
      if (ev.cancelable) ev.preventDefault();
      cancelAnimationFrame(raf); clearTimeout(tmDia); arrAtivo.current = false; semClique.current = Date.now();
      document.removeEventListener("touchmove", mvT); document.removeEventListener("touchend", fim); document.removeEventListener("touchcancel", fim);
      document.removeEventListener("mousemove", mvM); document.removeEventListener("mouseup", fim); document.removeEventListener("keydown", tecla);
      document.body.style.userSelect = ""; document.body.style.webkitUserSelect = ""; document.body.style.cursor = "";
      document.removeEventListener("selectstart", semSel); document.removeEventListener("contextmenu", semSel);
      // o clique que o navegador dispara logo após soltar não abre nada
      const parar = (e) => { e.stopPropagation(); e.preventDefault(); };
      document.addEventListener("click", parar, true); setTimeout(() => document.removeEventListener("click", parar, true), 80);
      diaArrRef.current = null; setArr(null); setAlvo(null); setDiaArr(null);
      if (ev.type === "touchend" || ev.type === "mouseup") soltarZona(t, z);
    };
    if (toque) { document.addEventListener("touchmove", mvT, { passive: false }); document.addEventListener("touchend", fim, { passive: false }); document.addEventListener("touchcancel", fim); }
    else { document.addEventListener("mousemove", mvM); document.addEventListener("mouseup", fim); }
    document.addEventListener("keydown", tecla);
    requestAnimationFrame(achar);
  };
  const pressionar = (t) => !t.podeEditar ? undefined : {
    onContextMenu: (e) => { if (Date.now() - (globalThis.__ceToque || 0) < 1500) e.preventDefault(); },
    onMouseDown: (e) => {
      if (e.button !== 0 || arrAtivo.current || e.target.closest("button")) return;
      const x0 = e.clientX, y0 = e.clientY, el = e.currentTarget;
      const mv = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { parar(); iniciar(t, ev.clientX, ev.clientY, el, false); } };
      const parar = () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", parar); };
      document.addEventListener("mousemove", mv); document.addEventListener("mouseup", parar);
    },
    onTouchStart: (e) => {
      globalThis.__ceToque = Date.now();
      if (arrAtivo.current || e.target.closest("button")) return;
      const p0 = e.touches[0], x0 = p0.clientX, y0 = p0.clientY, el = e.currentTarget;
      const parar = () => { clearTimeout(tm); document.removeEventListener("touchmove", mv0); document.removeEventListener("touchend", parar); document.removeEventListener("touchcancel", parar); };
      const mv0 = (ev) => { const q = ev.touches[0]; if (Math.hypot(q.clientX - x0, q.clientY - y0) > 10) parar(); };
      // v611 — 300 ms: começa antes do toque longo do próprio iPhone (seleção/menu), que cancelava o arraste
      const tm = setTimeout(() => { parar(); iniciar(t, x0, y0, el, true); }, 300);
      document.addEventListener("touchmove", mv0, { passive: true }); document.addEventListener("touchend", parar); document.addEventListener("touchcancel", parar);
    },
  };
  const rotZona = (z) => {
    if (!z) return "solte para mover";
    const [k, a, b] = z.split("|"), dd = `${SEM3[dUTC(a).getUTCDay()]} ${Number(a.slice(8))}`;
    return k === "h" ? `${dd} · ${b || "sem horário"}` : k === "d" ? dd : `${dd} · ${b === "TARDE" ? "tarde" : "manhã"}`;
  };
  const abrirT = (id) => { if (Date.now() - semClique.current > 600) setAbrir(id); };
  const proj = projetoId ? P[projetoId] : null;
  const alternarConcluida = async (t) => {
    try { await api(`/api/tarefas/${t.id}`, "PATCH", { usuarioId: user.id, acao: t.status === "CONCLUIDA" ? "reabrir" : "concluir", retorno: "" }); carregar(); } catch (e) { alerta(e.message); }
  };
  const excluirTarefa = async (t) => {
    if (!(await confirmar(`Excluir "${t.titulo}"?`))) return;
    try { await api(`/api/tarefas/${t.id}`, "DELETE", { usuarioId: user.id }); carregar(); } catch (e) { alerta(e.message); }
  };
  // v599 — transportar projeto entre pessoal e funcional (as tarefas vão junto)
  const [arrProj, setArrProj] = useState(null), [sobreSec, setSobreSec] = useState(null);
  const transportarProj = async (p, nat) => {
    if (!(await confirmar(`Transformar "${p.nome}" em projeto ${nat === "PESSOAL" ? "pessoal" : "funcional"}? ${p.abertas ? `As ${p.abertas} tarefas abertas vão junto.` : "As tarefas vão junto."}${nat === "PESSOAL" && p.acesso === "TODOS" ? " O acesso passa para \"Só eu\" (dá para escolher pessoas depois)." : ""}`))) return;
    try { await api("/api/tarefas/projetos", "POST", { usuarioId: user.id, projeto: { id: p.id, nome: p.nome, cor: p.cor, natureza: nat, acesso: nat === "PESSOAL" && p.acesso === "TODOS" ? "SO_EU" : p.acesso, membros: p.membros } }); carregar(); } catch (e) { alerta(e.message); }
  };
  // v510 — lateral recolhida (lembra neste navegador)
  const [latFechada, setLatFechada] = useState(false);
  useEffect(() => { try { setLatFechada(localStorage.getItem("ce_agenda_lat") === "0"); } catch {} }, []);
  const alternarLat = (fechar) => { setLatFechada(fechar); try { localStorage.setItem("ce_agenda_lat", fechar ? "0" : "1"); } catch {} };
  const Aba = ({ k, t, atual, set }) => (
    <button onClick={() => set(k)} className="relative px-3 py-1.5 text-sm font-semibold rounded-md"
      style={{ color: atual === k ? A.azul : A.texto, background: atual === k ? A.azulSoft : "transparent", transition: "all .18s" }}>{t}</button>
  );

  return (
    <div className={`flex gap-0 anim-entrar ${mobile ? "-m-2" : "-m-6"}`} style={{ minHeight: "calc(100vh - 64px)", background: A.fundo }}>
      {/* lateral: projetos — v510 recolhível pela seta (os dias ficam maiores) · v550: no celular vira um seletor no cabeçalho */}
      {mobile ? null : latFechada ? (
        <div className="shrink-0 flex flex-col items-center pt-4" style={{ width: 34, borderRight: `1px solid ${A.linha}`, background: A.fundo2 }}>
          <button onClick={() => alternarLat(false)} title="Mostrar projetos" className="rounded-md p-1" style={{ color: A.sub, background: A.fundo }}><ChevronRight size={18} /></button>
        </div>
      ) : (
      <aside className="shrink-0 py-4 px-2 relative" style={{ width: 220, borderRight: `1px solid ${A.linha}`, background: A.fundo2 }}>
        {/* v637 — seta de esconder alinhada ao centro do card Minha agenda */}
        <div className="flex items-center gap-1">
          <button onClick={() => setProjetoId(null)} className="flex-1 min-w-0 text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
            style={{ background: !projetoId ? A.azulSoft : "transparent", color: !projetoId ? A.azul : A.texto, transition: "all .18s" }}><CalendarDays size={15} /> Minha agenda</button>
          <button onClick={() => alternarLat(true)} title="Esconder projetos" className="shrink-0 rounded-md p-1" style={{ color: A.sub }}><ChevronLeft size={18} /></button>
        </div>
        {/* v592 — projetos pessoais e funcionais */}
        {/* v599 — arrastar um projeto para a outra seção transporta ele (e as tarefas) entre pessoal e funcional */}
        {[["PESSOAL", "Projetos pessoais"], ["FUNCIONAL", "Projetos funcionais"]].map(([nat, rot]) => <div key={nat}
          onDragOver={(e) => { if (arrProj && arrProj.natureza !== nat) { e.preventDefault(); setSobreSec(nat); } }} onDragLeave={() => setSobreSec(null)}
          onDrop={(e) => { e.preventDefault(); const p = arrProj; setArrProj(null); setSobreSec(null); if (p && p.natureza !== nat) transportarProj(p, nat); }}
          className="rounded-lg pb-1" style={{ background: sobreSec === nat ? A.azulSoft : "transparent", outline: sobreSec === nat ? `2px dashed ${A.azul}` : arrProj && arrProj.natureza !== nat ? `1px dashed ${A.cardBrancoBorda}` : "none", transition: "background .15s" }}>
        <div className="flex items-center px-3 mt-4 mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: A.sub }}>
          <span className="flex-1">{rot}</span>
          <button onClick={() => setProjForm({ natureza: nat })} title={`Novo projeto ${nat === "PESSOAL" ? "pessoal" : "funcional"}`} style={{ color: A.sub }}><Plus size={14} /></button>
        </div>
        {projetos.filter((p) => (p.natureza === "PESSOAL") === (nat === "PESSOAL")).map((p) => (
          <div key={p.id} draggable={p.podeEditar} onDragStart={() => setArrProj(p)} onDragEnd={() => { setArrProj(null); setSobreSec(null); }}
            title={p.podeEditar ? "Arraste para a outra seção para transformar em projeto " + (p.natureza === "PESSOAL" ? "funcional" : "pessoal") : undefined}
            className="group flex items-center rounded-lg" style={{ background: projetoId === p.id ? A.azulSoft : "transparent", opacity: arrProj?.id === p.id ? 0.4 : 1, transition: "all .18s" }}>
            <button onClick={() => setProjetoId(p.id)} className="flex-1 text-left px-3 py-1.5 text-sm flex items-center gap-2 min-w-0" style={{ color: A.texto }}>
              <span className="rounded-[4px] shrink-0" style={{ width: 12, height: 12, background: p.cor }} />
              <span className="truncate flex-1">{p.nome}</span>
              {p.acesso === "SELECIONADOS" ? <Users size={10} style={{ color: A.sub }} /> : !p.publico && <Lock size={10} style={{ color: A.sub }} />}
              {p.abertas > 0 && <span className="text-[10px]" style={{ color: A.sub }}>{p.abertas}</span>}
            </button>
            {p.podeEditar && <button onClick={() => setProjForm(p)} className="opacity-0 group-hover:opacity-100 px-1.5" title="Editar projeto" style={{ color: A.sub, transition: "opacity .15s" }}><Pencil size={12} /></button>}
          </div>
        ))}
        {arrProj && arrProj.natureza !== nat && <div className="text-[11px] px-3 py-1" style={{ color: A.azul }}>Solte aqui para virar {nat === "PESSOAL" ? "pessoal" : "funcional"}</div>}
        </div>)}
        {!projetos.length && <div className="px-3 text-[11px]" style={{ color: A.sub }}>Nenhum projeto. Crie no +.</div>}
      </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* cabeçalho */}
        <div className={mobile ? "px-3 pt-3" : "px-6 pt-4"} style={{ borderBottom: `1px solid ${A.linha}` }}>
          <div className="flex items-center gap-2 mb-2">
            {proj ? <span className="rounded-md shrink-0" style={{ width: 22, height: 22, background: proj.cor }} /> : <CalendarDays size={22} className="shrink-0" style={{ color: A.azul }} />}
            {mobile ? (
              <select value={projetoId || ""} onChange={(e) => setProjetoId(e.target.value ? Number(e.target.value) : null)} className="flex-1 min-w-0 rounded-lg px-2 py-2 font-bold" style={{ border: `1px solid ${A.linha}`, color: A.texto, background: A.fundo }}>
                <option value="">Minha agenda</option>{[["PESSOAL", "Projetos pessoais"], ["FUNCIONAL", "Projetos funcionais"]].map(([nat, rot]) => { const l = projetos.filter((p) => (p.natureza === "PESSOAL") === (nat === "PESSOAL")); return l.length ? <optgroup key={nat} label={rot}>{l.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.abertas ? ` (${p.abertas})` : ""}</option>)}</optgroup> : null; })}
              </select>
            ) : <div className="text-xl font-bold" style={{ color: A.texto }}>{proj ? proj.nome : "Agenda"}</div>}
            {mobile && <button onClick={() => setProjForm({})} title="Novo projeto" className="p-2 rounded-lg shrink-0" style={{ border: `1px solid ${A.linha}`, color: A.sub }}><Plus size={18} /></button>}
          </div>
          <div className="pb-2"><AvisosPush user={user} C={C} rotulo="lembretes no celular (antes de cada tarefa com horário; padrão 30 min)" compacto /></div>
          <div className={`flex items-center gap-1 pb-2 ${mobile ? "flex-wrap" : ""}`}>
            {mobile ? <>
              {/* v590 — celular: semanal e mensal no lugar de Calendário / Tarefas */}
              <Aba k="semana" t="Semanal" atual={modo} set={(k) => { setTela("calendario"); setModo(k); }} />
              <Aba k="mes" t="Mensal" atual={modo} set={(k) => { setTela("calendario"); setModo(k); }} />
            </> : <>
              <Aba k="calendario" t="Calendário" atual={tela} set={setTela} />
              <Aba k="tarefas" t="Tarefas" atual={tela} set={setTela} />
            </>}
            <span className="w-4" />
            {mobile ? (
              <select value={visao} onChange={(e) => setVisao(e.target.value)} className="ml-auto rounded-md px-2 py-1.5 text-sm font-semibold" style={{ border: `1px solid ${A.linha}`, color: A.texto, background: A.fundo }}>
                {[["GERAL", "Geral"], ["PESSOAL", "Pessoal"], ["FUNCIONAL", "Funcional"]].map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            ) : [["GERAL", "Geral"], ["PESSOAL", "Pessoal"], ["FUNCIONAL", "Funcional"]].map(([k, t]) => <Aba key={k} k={k} t={t} atual={visao} set={setVisao} />)}
          </div>
        </div>

        {tela === "tarefas" ? (
          <div key={`lista-${visao}-${projetoId}`} className={`${mobile ? "p-2" : "p-6"} anim-entrar`}><Tarefas user={user} natureza={visao} projetoId={projetoId} embutido /></div>
        ) : (
          <div key="cal" className="flex-1 flex flex-col anim-entrar">
            <div className={`flex items-center ${mobile ? "gap-1 px-2 py-2 flex-wrap" : "gap-3 px-6 py-3"}`} style={{ borderBottom: `1px solid ${A.linha}` }}>
              <button onClick={() => novaNoDia(H)} className={`rounded-md text-sm flex items-center gap-1.5 ${mobile ? "px-3 py-2 font-semibold" : "px-3 py-1.5"}`} style={mobile ? { background: A.azul, color: "#fff" } : { border: `1px solid ${A.linha}`, color: A.texto }}><Plus size={mobile ? 16 : 14} /> {mobile ? "Nova" : "Adicionar uma tarefa"}</button>
              <button onClick={() => mover(-1)} className={mobile ? "p-2 rounded" : "p-1 rounded"} style={{ color: A.sub }}><ChevronLeft size={mobile ? 22 : 18} /></button>
              <button onClick={() => { setDir(0); setRef(H); }} className={mobile ? "text-sm px-2 py-2 font-semibold" : "text-sm px-1"} style={{ color: A.texto }}>Hoje</button>
              <button onClick={() => mover(1)} className={mobile ? "p-2 rounded" : "p-1 rounded"} style={{ color: A.sub }}><ChevronRight size={mobile ? 22 : 18} /></button>
              {!(mobile && modo === "mes") && <span className="text-sm" style={{ color: A.sub }}>{titulo}</span>}
              <span className="flex-1" />
              {/* v735 — botão Designadas: clicar alterna; a seta escolhe o colaborador (só quem tem tarefa designada) */}
              <div className="relative flex items-stretch rounded-md text-xs font-semibold" style={{ border: `1px solid ${designadas ? A.azul : A.linha}`, background: designadas ? A.azulSoft : "transparent", color: designadas ? A.azul : A.texto, transition: "all .18s" }}>
                <button onClick={() => { setDesignadas((v) => !v); if (designadas) setColab(null); setMenuColab(false); }} title={designadas ? "Voltar para as minhas tarefas" : "Ver as tarefas que você designou"}
                  className={`flex items-center gap-1.5 ${mobile ? "px-2 py-2" : "px-2.5 py-1.5"}`}>
                  {(() => { const c = colabs.find((x) => x.id === colab); return c ? <AvatarMini foto={fotos[c.id]} nome={c.nome} size={mobile ? 20 : 16} /> : <Users size={mobile ? 18 : 14} />; })()}
                  <span className="truncate" style={{ maxWidth: mobile ? 90 : 150 }}>{designadas && colab ? (colabs.find((x) => x.id === colab)?.nome || "Designadas").split(" ")[0] : "Designadas"}</span>
                </button>
                <button onClick={() => setMenuColab((v) => !v)} title="Escolher colaborador" className="px-1.5 flex items-center" style={{ borderLeft: `1px solid ${designadas ? A.azul : A.linha}` }}><ChevronDown size={14} /></button>
                {menuColab && <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuColab(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 rounded-lg py-1 shadow-lg" style={{ background: "#fff", border: `1px solid ${A.linha}`, minWidth: 210, maxHeight: 320, overflowY: "auto" }}>
                    {!colabs.length ? <div className="px-3 py-2 text-xs font-normal" style={{ color: A.sub }}>Nenhuma tarefa designada neste período.</div> : <>
                      <button onClick={() => { setDesignadas(true); setColab(null); setMenuColab(false); }} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2" style={{ color: A.texto, background: designadas && !colab ? A.azulSoft : "transparent" }}><Users size={14} /> Todos os colaboradores</button>
                      {colabs.map((c) => <button key={c.id} onClick={() => { setDesignadas(true); setColab(c.id); setMenuColab(false); }} className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2" style={{ color: A.texto, background: designadas && colab === c.id ? A.azulSoft : "transparent" }}>
                        <AvatarMini foto={fotos[c.id]} nome={c.nome} size={18} /><span className="flex-1 truncate">{c.nome}</span>{c.n > 0 && <span style={{ color: A.sub }}>{c.n}</span>}</button>)}
                    </>}
                  </div>
                </>}
              </div>
              <button onClick={alternarConcl} title={verConcl ? "Esconder concluídas" : "Mostrar concluídas"} className={`rounded-md flex items-center gap-1 text-xs font-semibold ${mobile ? "p-2" : "px-2 py-1.5"}`}
                style={{ color: verConcl ? A.azul : A.sub, background: verConcl ? A.azulSoft : "transparent", transition: "all .18s" }}>
                {verConcl ? <Eye size={mobile ? 20 : 16} /> : <EyeOff size={mobile ? 20 : 16} />}{nConcl > 0 && <span>{nConcl}</span>}
              </button>
              {modo === "semana" && (nOcultos > 0 || verPassados) && <button onClick={alternarPassados} title={verPassados ? "Ocultar dias passados sem tarefas" : "Mostrar dias passados sem tarefas"} className={`rounded-md flex items-center gap-1 text-xs font-semibold ${mobile ? "p-2" : "px-2 py-1.5"}`}
                style={{ color: verPassados ? A.azul : A.sub, background: verPassados ? A.azulSoft : "transparent", transition: "all .18s" }}>
                <History size={mobile ? 20 : 16} />{!verPassados && nOcultos > 0 && <span>{nOcultos}</span>}
              </button>}
              {!mobile && <div className="flex rounded-md p-0.5" style={{ background: A.fundo2, border: `1px solid ${A.linha}` }}>
                {[["semana", "Semanas"], ["mes", "Mês"]].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className="px-3 py-1 text-xs font-semibold rounded" style={{ background: modo === k ? "#fff" : "transparent", color: modo === k ? A.texto : A.sub, boxShadow: modo === k ? "0 1px 2px rgba(0,0,0,.12)" : "none", transition: "all .18s" }}>{t}</button>)}
              </div>}
            </div>
            {!d && <div className="p-6"><Loader2 size={18} className="animate-spin" style={{ color: A.sub }} /></div>}
            <div key={`${modo}-${dias[0]}`} className={dir > 0 ? "anim-dir" : dir < 0 ? "anim-esq" : "anim-entrar"} style={{ flex: 1 }}>
              {/* v550 — celular: semana em lista vertical (um dia embaixo do outro); mês em grade compacta com a quantidade */}
              {mobile && modo === "semana" ? (
                <div className="flex flex-col">
                  {diasVis.map((dia) => {
                    const k = dias.indexOf(dia);
                    const l = porDia[dia] || [], hoje = dia === H, comRegua = arr && diaArr === dia;
                    return (
                      <div key={dia} data-dia={dia} data-zona={`d|${dia}`} ref={hoje ? (el) => { if (el && d && !rolouHoje.current) { rolouHoje.current = true; setTimeout(() => el.scrollIntoView({ block: "start", behavior: "smooth" }), 120); } } : undefined}
                        className="px-3 py-2.5 flex flex-col gap-2" style={{ borderBottom: `1px solid ${A.linha}`, background: comRegua ? "#F3F7FE" : hoje ? A.azulSoft : A.fundo, scrollMarginTop: 8, boxShadow: comRegua ? `inset 3px 0 0 ${A.azul}` : "none" }}>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center rounded-md font-semibold" style={{ minWidth: 34, height: 32, fontSize: 18, background: hoje ? A.azul : "transparent", color: hoje ? "#fff" : A.texto }}>{Number(dia.slice(8))}</span>
                          <span className="text-sm font-semibold" style={{ color: hoje ? A.azul : A.sub }}>{SEM_SEG[k % 7]}{hoje ? " · hoje" : ""}</span>
                          <span className="flex-1" />
                          {l.length > 0 && <span className="text-xs" style={{ color: A.sub }}>{l.length}</span>}
                          <button onClick={() => novaNoDia(dia)} title="Nova tarefa neste dia" className="p-2 rounded-lg" style={{ color: A.azul }}><Plus size={20} /></button>
                        </div>
                        <div className="flex gap-2">
                          {comRegua && <ReguaDia dia={dia} alvo={alvo} atual={arr.t.prazo === dia ? arr.t.hora : null} h={22} />}
                          <div className="flex-1 min-w-0 flex flex-col gap-2">
                            {PERIODOS.map(([rot, per]) => {
                              const ll = l.filter((t) => periodoDe(t) === per), zz = `${dia}|${per}`, aqui = alvo === `p|${zz}` || alvo?.startsWith(`c|${zz}|`);
                              return (
                                <div key={per} data-zona={`p|${zz}`} className="rounded-lg p-1.5 flex flex-col gap-1.5"
                                  style={{ background: aqui ? A.azulSoft : A.fundo2, outline: aqui ? `2px dashed ${A.azul}` : "none", minHeight: arr ? 56 : undefined, flex: comRegua ? 1 : undefined, transition: "background .12s" }}>
                                  <div className="flex items-center text-[11px] font-bold tracking-wide px-1" style={{ color: A.sub }}>
                                    <span className="flex-1">{rot.toUpperCase()}{ll.length ? ` · ${ll.length}` : ""}</span>
                                    <button onClick={() => novaNoDia(dia, per)} title={`Nova tarefa de ${rot.toLowerCase()}`} className="p-1 rounded" style={{ color: A.azul }}><Plus size={16} /></button>
                                  </div>
                                  {ll.map((t) => <div key={t.id} data-zona={`c|${zz}|${t.id}`} style={{ borderTop: `3px solid ${alvo === `c|${zz}|${t.id}` && arr?.t.id !== t.id ? A.azul : "transparent"}`, marginTop: -3 }}>
                                    <CardAgenda toque t={t} proj={P[t.projetoId]} foto={fotos[t.responsavelId]} onClick={() => abrirT(t.id)} onConcluir={() => alternarConcluida(t)}
                                      pres={pressionar(t)} arrastado={arr?.t.id === t.id} /></div>)}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : mobile ? (
                <MesMobile ref0={ref} H={H} porDia={porDia} P={P} fotos={fotos} nMeses={nMeses} topo={topoMes} onMais={() => setNMeses((n) => Math.min(n + 2, 36))} onMover={mover} onNova={(dia) => novaNoDia(dia)} onAbrir={abrirT}
                  pressionar={pressionar} alvo={alvo} arrastandoId={arr?.t.id}
                  onConcluir={alternarConcluida} onSemana={(dia) => { setModo("semana"); setRef(dia); }} />
              ) : (
              <>
              {/* v597 — dia ampliado: a coluna do dia escolhido (hoje, ao abrir) fica mais larga e, no mês, mostra todas as tarefas
                  v603 — arrastando: o dia sob o ponteiro amplia e ganha a régua de horários à esquerda · cabeçalho dos dias fixo ao rolar */}
              {(() => { const cols = Array.from({ length: nCols }, (_, i) => (i === selK ? (arr ? (modo === "semana" ? "2.6fr" : "2.8fr") : modo === "semana" ? "1.9fr" : "2.4fr") : "1fr")).join(" "); return <>
              <div className="grid" style={{ gridTemplateColumns: cols, transition: "grid-template-columns .25s ease", position: "sticky", top: 0, zIndex: 6, background: A.fundo, borderBottom: `1px solid ${A.linha}` }}>
                {(modo === "semana" ? diasVis.map((x) => SEM_SEG[dias.indexOf(x) % 7]) : SEM_SEG).map((x, i) => <div key={x} className="text-[12px] font-semibold px-3 py-1.5" style={{ color: i === selK ? A.azul : A.sub, borderLeft: i ? `1px solid ${A.linha}` : "none" }}>{x}</div>)}
              </div>
              <div className="grid" style={{ minHeight: "100%", gridTemplateColumns: cols, transition: "grid-template-columns .25s ease" }}>
                {diasVis.map((dia, k) => {
                  const mDia = Number(dia.slice(5, 7)), fora = modo === "mes" && ((mDia - mes + 12) % 2 === 1);
                  const l = porDia[dia] || [];
                  const hoje = dia === H, amp = dia === diaAmp, comRegua = arr && diaArr === dia;
                  const aquiDia = arr && alvo && alvo.split("|")[1] === dia;
                  // v604 — no mês, a linha do dia ampliado fica alta: os outros dias dela mostram tudo o que cabe (sem "+N mais" à toa)
                  const iAmp = modo === "mes" ? dias.indexOf(diaAmp) : -1, mesmaLinha = iAmp >= 0 && Math.floor(iAmp / 7) === Math.floor(k / 7);
                  const lim = mesmaLinha ? Math.max(4, (porDia[diaAmp] || []).length) : 4;
                  const regua = comRegua && <ReguaDia dia={dia} alvo={alvo} atual={arr.t.prazo === dia ? arr.t.hora : null} h={modo === "semana" ? 20 : 18} />;
                  return (
                    <div key={dia} data-dia={dia} data-zona={`d|${dia}`} onClick={() => setSelDia(dia)}
                      className="group/dia px-2 pt-2 pb-3 flex flex-col gap-1.5 min-w-0"
                      style={{ minHeight: modo === "semana" ? 560 : 130, borderLeft: k % 7 ? `1px solid ${A.linha}` : "none", borderTop: modo === "mes" && k >= 7 ? `1px solid ${A.linha}` : "none",
                        background: aquiDia ? "#F3F7FE" : fora ? A.fundo2 : A.fundo, boxShadow: amp ? `inset 0 0 0 2px ${A.azul}${arr ? "AA" : "55"}` : "none", transition: "background .15s, box-shadow .2s" }}>
                      <div className="px-1 mb-1 flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center rounded-md font-medium" style={{ minWidth: modo === "semana" ? 34 : 24, height: modo === "semana" ? 32 : 24, fontSize: modo === "semana" ? 19 : 13,
                          background: hoje ? A.azul : "transparent", color: hoje ? "#fff" : A.texto, padding: "0 6px" }}>{Number(dia.slice(8))}</span>
                        {modo === "mes" && Number(dia.slice(8)) === 1 && <span className="text-[12px] font-bold" style={{ color: A.azul }}>{MESES[mDia - 1]}{mDia === 1 ? ` ${dia.slice(0, 4)}` : ""}</span>}
                        {amp && l.length > 0 && <span className="text-[11px] ml-auto" style={{ color: A.sub }}>{l.length} tarefa{l.length > 1 ? "s" : ""}</span>}
                      </div>
                      <div className="flex-1 flex gap-1.5 min-w-0">
                      {regua}
                      {modo === "semana" ? (
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          {PERIODOS.map(([rot, per]) => {
                            const ll = l.filter((t) => periodoDe(t) === per), zz = `${dia}|${per}`, aqui = alvo === `p|${zz}` || alvo?.startsWith(`c|${zz}|`);
                            return (
                              <div key={per} data-zona={`p|${zz}`}
                                onClick={(e) => { e.stopPropagation(); if (amp) novaNoDia(dia, per); else setSelDia(dia); }} title={amp ? `Clique para criar uma tarefa de ${rot.toLowerCase()}` : "Clique para ampliar o dia"}
                                className="flex-1 flex flex-col gap-1 rounded-lg p-1.5 cursor-pointer" style={{ background: aqui ? A.azulSoft : A.fundo2, outline: aqui ? `2px dashed ${A.azul}` : "none", transition: "background .15s" }}>
                                <div className="text-[10px] font-bold tracking-wide px-0.5" style={{ color: A.sub }}>{rot.toUpperCase()}{ll.length ? ` · ${ll.length}` : ""}</div>
                                {ll.map((t) => (
                                  <div key={t.id} data-zona={`c|${zz}|${t.id}`} onClick={(e) => e.stopPropagation()}
                                    style={{ borderTop: `2px solid ${alvo === `c|${zz}|${t.id}` && arr?.t.id !== t.id ? A.azul : "transparent"}` }}>
                                    <CardAgenda t={t} grande={amp} arrastado={arr?.t.id === t.id} proj={P[t.projetoId]} foto={fotos[t.responsavelId]} onClick={() => abrirT(t.id)} pres={pressionar(t)}
                                      onConcluir={() => alternarConcluida(t)} onMenu={(x, y) => setMenuCard({ x, y, t })} />
                                  </div>
                                ))}
                                {!ll.length && <div className="text-[11px] text-center mt-1" style={{ color: "#B7B3B3" }}><Plus size={11} className="inline" /> {rot.toLowerCase()}</div>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          {(amp ? l : l.slice(0, lim)).map((t) => (
                            <CardAgenda key={t.id} t={t} grande={amp} arrastado={arr?.t.id === t.id} proj={P[t.projetoId]} foto={fotos[t.responsavelId]} onClick={(e) => { e.stopPropagation(); abrirT(t.id); }} pres={pressionar(t)}
                              onConcluir={() => alternarConcluida(t)} onMenu={(x, y) => setMenuCard({ x, y, t })} />
                          ))}
                          {!amp && l.length > lim && <button onClick={(e) => { e.stopPropagation(); setSelDia(dia); }} className="text-[11px] text-left px-1" style={{ color: A.azul }}>+{l.length - lim} mais</button>}
                          <button onClick={(e) => { e.stopPropagation(); novaNoDia(dia); }} className="text-left px-1 py-1 rounded-md text-[13px] flex items-center gap-1 opacity-0 group-hover/dia:opacity-100" style={{ color: A.sub, transition: "opacity .15s, background .15s" }}>
                            <Plus size={14} /> Adicionar
                          </button>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>; })()}
              {modo === "mes" && <Sentinela dep={nMeses} onMais={() => setNMeses((n) => Math.min(n + 2, 36))} />}
              </>
              )}
            </div>
          </div>
        )}
      </div>
      <PopupConvites user={user} onMudou={carregar} />
      {/* v603 — celular, mês: régua fixa à esquerda com o dia sob o dedo */}
      {mobile && modo === "mes" && arr && <PainelHoras dia={diaArr || arr.t.prazo} alvo={alvo} atual={(diaArr || arr.t.prazo) === arr.t.prazo ? arr.t.hora : null} />}
      {/* fantasma da tarefa acompanhando o mouse/dedo, com o destino */}
      {arr && <div className="fixed z-[80] pointer-events-none rounded-lg px-3 py-2 text-[13px] font-semibold shadow-2xl"
        style={{ left: arr.toque ? Math.max(8, Math.min(arr.x - 110, (typeof window !== "undefined" ? window.innerWidth : 400) - 228)) : arr.x + 14, top: arr.toque ? arr.y - 62 : arr.y + 12, width: arr.toque ? 220 : 210,
          background: "#fff", border: `2px solid ${A.azul}`, color: A.texto, transform: "rotate(-2deg)" }}>
        <div className="truncate">{arr.t.titulo.charAt(0) + arr.t.titulo.slice(1).toLowerCase()}</div>
        <div className="text-[11px] font-normal" style={{ color: alvo?.startsWith("h|") ? A.azul : A.sub }}>{rotZona(alvo)}</div>
      </div>}
      {/* v565 — celular: + fixo no canto da tela (continua visível ao rolar) */}
      {mobile && !form && !abrir && <button onClick={() => novaNoDia(H)} title="Nova tarefa" className="fixed z-30 flex items-center justify-center rounded-full shadow-xl"
        style={{ right: 18, bottom: "calc(20px + env(safe-area-inset-bottom))", width: 58, height: 58, background: A.azul, color: "#fff" }}><Plus size={28} /></button>}
      {form && <TarefaForm user={user} inicial={form} usuarios={d?.usuarios || []} projetos={projetos} onClose={() => setForm(null)} onOk={() => { setForm(null); carregar(); }} />}
      {abrir && <TarefaDetalhe user={user} id={abrir} usuarios={d?.usuarios || []} projetos={projetos} onClose={() => setAbrir(null)} onMudou={carregar} editarDireto />}
      {menuCard && <MenuCard {...menuCard} onClose={() => setMenuCard(null)} onAbrir={() => setAbrir(menuCard.t.id)} onConcluir={() => alternarConcluida(menuCard.t)} onExcluir={() => excluirTarefa(menuCard.t)} />}
      {projForm && <ProjetoForm user={user} inicial={projForm} projetos={projetos} usuarios={d?.usuarios || []} onClose={() => setProjForm(null)} onOk={() => { setProjForm(null); carregar(); }} />}
    </div>
  );
}
