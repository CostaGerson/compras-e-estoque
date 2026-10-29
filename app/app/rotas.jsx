"use client";
// v425 — Logística › Rotas: calendário de demandas de rota, mapa do dia, montagem da rota com a melhor sequência, despacho e execução pelo motorista
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, MapPin, Truck, Bike, Car, Settings, Route as IcoRota, Send, CheckCircle2, Circle, ArrowUp, ArrowDown, AlertTriangle, Flag, Package, ShoppingBag, ArrowLeftRight, ExternalLink, Undo2, Home, Copy, MessageCircle } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dUTC = (s) => new Date(`${s}T00:00:00Z`);
const somaDia = (s, n) => { const d = dUTC(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const inicioSemana = (s) => { const d = dUTC(s); const w = (d.getUTCDay() + 6) % 7; return somaDia(s, -w); };
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "—");
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const sc = (t) => { const s0 = String(t || "").toLocaleLowerCase("pt-BR"); return s0.charAt(0).toLocaleUpperCase("pt-BR") + s0.slice(1); };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
const OBJ = { COLETA: ["Coleta", Package], ENTREGA: ["Entrega", Truck], COLETA_ENTREGA: ["Coleta e entrega", ArrowLeftRight], COMPRA: ["Compra", ShoppingBag], RETORNO: ["Retorno", Home] };   // v563 — coleta e entrega   // v521 — retorno à fábrica no meio da rota
const ST = { ABERTA: ["aberta", C.sub], NO_BLOCO: ["na rota", C.yellow], EM_EXECUCAO: ["em execução", C.accent], CONCLUIDA: ["concluída", C.green] };
// v435 — cor por tipo: coleta laranja claro (v561; era cinza), entrega azul claro, compra amarela, frete por transportadora azul escuro;
// concluída verde; urgente mantém a cor do tipo com borda vermelha
const TIPO_COR = {
  COLETA: { bg: "#FFEBDC", bd: "#FFA463", tx: "#7A3300", sb: "#9A5A2E", pin: "#FFA463" },
  // v563 — coleta e entrega: degradê do azul (entrega) para o laranja (coleta)
  COLETA_ENTREGA: { bg: "linear-gradient(90deg, #E3F0FC 0%, #FFEBDC 100%)", bd: "#C9A08A", tx: "#3B3F5C", sb: "#5E5A6B", pin: "linear-gradient(135deg, #5BA4E6 0%, #FFA463 100%)" },
  ENTREGA: { bg: "#E3F0FC", bd: "#5BA4E6", tx: "#1D4F80", sb: "#4A6B8C", pin: "#5BA4E6" },
  COMPRA: { bg: "#FFF4CC", bd: "#E0A800", tx: "#6B4D00", sb: "#8A6D1F", pin: "#E0A800" },
  TRANSP: { bg: "#001E41", bd: "#001E41", tx: "#FFFFFF", sb: "#B8C4D6", pin: "#001E41" },
  RETORNO: { bg: "#FDEBDD", bd: "#FF6B1A", tx: "#7A3300", sb: "#9A5A2E", pin: "#FF6B1A" },
};
const tipoCor = (d) => (d.frete && d.freteTipo === "TRANSPORTADORA" ? TIPO_COR.TRANSP : TIPO_COR[d.objetivo] || TIPO_COR.COLETA);
const corDemanda = (d) => {
  if (d.status === "CONCLUIDA") return { bg: C.greenSoft, bd: C.green, tx: C.text, sb: C.sub, bw: 1 };
  const t = tipoCor(d);
  return d.urgente ? { ...t, bd: C.red, bw: 2 } : { ...t, bw: 1 };
};
// v434 — card: NOME CURTO - Tarefa ("ALPINO LINHAS E AVIAMENTOS LTDA" + "COLETAR PEDIDO" → "ALPINO - Coletar pedido")
const nomeCurto = (n) => { const p = String(n || "").toUpperCase().trim().split(/\s+/).filter(Boolean); return p.length > 1 && p[0].length <= 3 ? `${p[0]} ${p[1]}` : p[0] || ""; };
const frase = (t) => { const s0 = String(t || "").trim().toLowerCase(); return s0 ? s0[0].toUpperCase() + s0.slice(1) : ""; };
const nomeTarefa = (x) => `${nomeCurto(x.destinoNome)}${x.tarefa ? ` - ${frase(x.tarefa)}` : ""}`;
const ordenar = (l) => [...l].sort((a, b) => (b.urgente - a.urgente) || ((a.ordem ?? 99) - (b.ordem ?? 99)) || (a.janela?.[0] || "").localeCompare(b.janela?.[0] || "") || a.id - b.id);

export default function Rotas({ user, nova }) {
  const H = hojeISO();
  // v436 — sábado/domingo: o foco (card grande) vai para a segunda seguinte
  const dowH = dUTC(H).getUTCDay();
  const FOCO = dowH === 6 ? somaDia(H, 2) : dowH === 0 ? somaDia(H, 1) : H;
  const [modo, setModo] = useState("semana");
  const [ref, setRef] = useState(FOCO);
  const [dia, setDia] = useState(FOCO);
  // v558 — semana: os cards e o mapa vão até o fim da tela (altura medida a partir do topo da grade)
  const gradeRef = useRef(null);
  const [altGrade, setAltGrade] = useState(0);
  useEffect(() => {
    const medir = () => {
      const el = gradeRef.current;
      if (!el || window.innerWidth < 900) { setAltGrade((v) => (v ? 0 : v)); return; }
      const h = Math.max(560, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 20));
      setAltGrade((v) => (Math.abs(v - h) > 2 ? h : v));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  });
  const [verRota, setVerRota] = useState(null);
  const [vivo, setVivo] = useState(null);   // v485 — posição dos motoristas em rota (para o mapa)
  // v450 — vindo da tarefa PROGRAMAR ENTREGA: abre a demanda de rota já preenchida (cliente, endereço, "ENTREGA PEDIDO N")
  useEffect(() => { if (nova?.t) { const { t, ...x } = nova; setDia(FOCO); setForm({ data: FOCO, horarioTipo: "LIVRE", ...x }); } }, [nova?.t]);   // v444 — rota aberta pelo botão R
  const [verConc, setVerConc] = useState(new Set());   // v464 — dias com as demandas concluídas à mostra
  const alternaConc = (x) => setVerConc((s0) => { const n = new Set(s0); n.has(x) ? n.delete(x) : n.add(x); return n; });
  const visiveis = (x, l) => (verConc.has(x) ? l : l.filter((y) => y.status !== "CONCLUIDA"));
  const btnConc = (x, l, peq) => { const n = l.filter((y) => y.status === "CONCLUIDA").length; if (!n) return null;
    return <button type="button" onClick={(e) => { e.stopPropagation(); alternaConc(x); }} className={`${peq ? "text-[10px]" : "text-[11px]"} font-semibold flex items-center gap-0.5 px-1 rounded`} style={{ color: C.green }} title={verConc.has(x) ? "Ocultar as concluídas" : "Mostrar as concluídas"}>
      <CheckCircle2 size={peq ? 10 : 11} /> {verConc.has(x) ? (peq ? "ocultar" : "Ocultar concluídas") : peq ? n : `Mostrar concluídas (${n})`}</button>; };
  const [fds, setFds] = useState(new Set());   // v436 — sábado/domingo abertos (ficam recolhidos em S e D) · v521: guarda a data
  const [arr, setArr] = useState(null);   // v521 — alvo do arrastar ("data" ou "data|MANHA")
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [marc, setMarc] = useState(new Set());
  const [montar, setMontar] = useState(null);   // { ids, bloco? }
  const [cfgFab, setCfgFab] = useState(false);
  const [escolher, setEscolher] = useState(false);   // v426 — escolher as demandas do dia para a rota
  // v507 — concluir (ou reabrir) a demanda direto no calendário, mesmo sem rota
  async function concluirDem(y) {
    if (y.status === "CONCLUIDA") {
      if (!(await confirmar(`Reabrir a demanda de ${y.destinoNome}?`))) return;
      try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "reativar", id: y.id }); carregar(); } catch (e) { alerta(e.message); }
      return;
    }
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "concluirDemanda", id: y.id }); carregar(); } catch (e) { alerta(e.message); }
  }
  // v454 — parada cancelada numa rota despachada: abre a montagem já sem ela, para mandar a rota alterada ao motorista
  async function abrirAlteracao(c) {
    const b = (d?.blocos || []).find((x) => x.id === c.blocoId);
    const ids = (d?.demandas || []).filter((x) => x.blocoId === c.blocoId && x.id !== c.id && x.status === "EM_EXECUCAO").sort((a, z) => a.ordem - z.ordem).map((x) => x.id);
    if (!b) return;
    if (!pode) return alerta(`Demanda cancelada. A rota ${b.id} já foi avisada ao motorista; quem monta as rotas pode reenviar a ordem nova.`);
    if (!ids.length) return alerta(`Demanda cancelada. A rota ${b.id} não tem mais paradas pendentes: o motorista já pode voltar à fábrica.`);
    setDia(b.data); setMontar({ ids, bloco: b, canceladas: [c.nome] });
  }
  const ano = Number(ref.slice(0, 4)), mes = Number(ref.slice(5, 7));
  // v521 — semana: o dia atual é sempre o primeiro card; dia passado só aparece enquanto tiver demanda pendente
  // (depois de concluir ou realocar, some); os passados ficam no botão "Passado"
  // v529 — dias passados com demanda pendente entram ANTES de hoje, sem empurrar a semana para trás
  // (na v521 a semana começava na pendência mais antiga e hoje/os próximos dias sumiam da tela)
  const pendDias = useMemo(() => {
    if (modo !== "semana" || ref !== FOCO) return [];
    const l = (d?.demandas || []).filter((x) => x.data < FOCO && x.data >= somaDia(FOCO, -14) && x.status !== "CONCLUIDA" && x.status !== "CANCELADA");
    return [...new Set(l.map((x) => x.data))].sort();
  }, [d, modo, ref]);
  const dias = useMemo(() => {
    if (modo === "semana") return [...pendDias, ...Array.from({ length: 7 }, (_, k) => somaDia(ref, k))];
    const p = `${ref.slice(0, 7)}-01`, i = inicioSemana(p);
    const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
    const n = Math.ceil((Math.round((dUTC(fim) - dUTC(i)) / 864e5) + 1) / 7) * 7;
    return Array.from({ length: n }, (_, k) => somaDia(i, k));
  }, [modo, ref, pendDias]);
  const de0 = dias[0] < dia ? dias[0] : dia, ate = dias[dias.length - 1] > dia ? dias[dias.length - 1] : dia;
  const de = modo === "semana" && ref === FOCO && somaDia(FOCO, -14) < de0 ? somaDia(FOCO, -14) : de0;   // v521 — lê 14 dias para trás (pendências)
  const carregar = () => api(`/api/rotas?u=${user.id}&de=${de}&ate=${ate}`).then(setD).catch((e) => setD((x) => x || { erro: e.message, demandas: [], blocos: [], motoristas: [] }));
  useEffect(() => { carregar(); const t = setInterval(carregar, 30000); return () => clearInterval(t); }, [de, ate]);
  const porDia = useMemo(() => (d?.demandas || []).reduce((a, x) => { (a[x.data] ||= []).push(x); return a; }, {}), [d]);
  const doDia = ordenar(porDia[dia] || []);
  const blocosDia = (d?.blocos || []).filter((b) => b.data === dia || (b.status === "EM_EXECUCAO" && b.data < dia && (dia === H || dia === FOCO)));
  const mover = (n) => setRef(modo === "semana" ? somaDia(ref, 7 * n) : new Date(Date.UTC(ano, mes - 1 + n, 1)).toISOString().slice(0, 10));
  const passado = modo === "semana" && ref < FOCO;
  const titulo = modo === "semana" ? `${dBR(dias[0])} a ${dBR(dias[6])} · ${MESES[Number(dias[3].slice(5, 7)) - 1]} ${dias[3].slice(0, 4)}` : `${MESES[mes - 1]} de ${ano}`;
  const pode = !!d?.podeMontar;
  const minhaRota = (d?.blocos || []).find((b) => b.status === "EM_EXECUCAO" && d?.pessoaId && b.motoristaId === d.pessoaId);
  const novaNoDia = (x, per) => { setDia(x); setForm({ data: x, ...(per ? { horarioTipo: per } : {}) }); };   // v521 — manhã/tarde já define o período
  // v521 — arrastar a demanda (aberta, fora de rota) para outro dia, ou para a manhã/tarde do dia grande
  const podeArrastar = (y) => pode && y.status === "ABERTA" && !y.blocoId && y.objetivo !== "RETORNO";
  const soltar = async (e, data, periodo) => {
    e.preventDefault(); e.stopPropagation(); setArr(null);
    const id = Number(e.dataTransfer.getData("text/rota-demanda"));
    if (!id) return;
    const y = (d?.demandas || []).find((z) => z.id === id);
    if (!y || (y.data === data && (!periodo || y.horarioTipo === periodo))) return;
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "mover", id, data, periodo }); carregar(); } catch (er) { alerta(er.message); }
  };
  const alvo = (data, periodo) => ({
    onDragOver: (e) => { if (!Array.from(e.dataTransfer.types || []).includes("text/rota-demanda")) return; e.preventDefault(); e.stopPropagation(); const k = periodo ? `${data}|${periodo}` : data; if (arr !== k) setArr(k); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setArr(null); },
    onDrop: (e) => soltar(e, data, periodo),
  });
  const abrirDem = (x, y) => { if (y.objetivo === "RETORNO") { if (y.blocoId) setVerRota(y.blocoId); return; } setDia(x); setForm(y); };
  const tog = (id) => setMarc((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => { setMarc(new Set()); }, [dia]);

  return (
    <div className="space-y-4">
      {/* cabeçalho */}
      <div className="flex items-center gap-2 flex-wrap">
        <IcoRota size={22} style={{ color: C.accent }} />
        <div className="text-xl font-bold mr-2" style={{ color: C.navy }}>Rotas</div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["semana", "Semana"], ["mes", "Mês"]].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className="px-3 py-1.5 text-xs font-semibold" style={{ background: modo === k ? C.navy : C.panel, color: modo === k ? "#fff" : C.sub }}>{t}</button>)}
        </div>
        <button onClick={() => mover(-1)} className="p-1.5 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><ChevronLeft size={15} /></button>
        {modo === "semana" && <button onClick={() => { setRef(passado ? FOCO : somaDia(FOCO, -7)); setDia(passado ? FOCO : somaDia(FOCO, -1)); }} title="Dias passados e as rotas concluídas"
          className="px-3 py-1.5 rounded text-xs font-semibold" style={{ border: `1px solid ${passado ? C.accent : C.line}`, background: passado ? C.accentSoft : C.panel, color: passado ? C.accent : C.text }}>Passado</button>}
        <button onClick={() => { setRef(FOCO); setDia(FOCO); }} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel }}>Hoje</button>
        <button onClick={() => mover(1)} className="p-1.5 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><ChevronRight size={15} /></button>
        <div className="text-sm font-semibold" style={{ color: C.text }}>{titulo}</div>
        <div className="ml-auto flex items-center gap-2">
          {pode && <button onClick={() => setCfgFab(true)} title="Endereço da fábrica (saída e retorno das rotas)" className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.sub }}><Settings size={13} /> Fábrica</button>}
          {pode && <button onClick={() => setEscolher(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.navy, color: "#fff" }}><IcoRota size={15} /> Montar rota</button>}
          <button onClick={() => novaNoDia(dia)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Demanda de rota</button>
        </div>
      </div>
      {d?.erro && <div className="text-sm" style={{ color: C.red }}>{d.erro}</div>}
      {pode && d && !d.fabrica && <div className="text-xs px-3 py-2 rounded-lg flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={14} /> Cadastre o endereço da fábrica (botão Fábrica): é o ponto de saída e de retorno das rotas.</div>}

      <AoVivo user={user} onRota={setVerRota} onDados={setVivo} />   {/* v463 — motoristas em rota, ao vivo */}

      {minhaRota && <MinhaRota bloco={minhaRota} demandas={(d?.demandas || []).filter((x) => x.blocoId === minhaRota.id)} user={user} onMudou={carregar} />}

      {/* calendário */}
      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div> : modo === "semana" ? (
        (() => {
          // v444 — grade da semana: o card do dia em foco desce até o fim da página (manhã e tarde);
          // o mapa e as rotas do dia ficam ao lado dele, embaixo dos outros dias
          // v521 — começa no dia atual (ou na pendência mais antiga); clicar num dia o expande do tamanho do atual (o mapa sai);
          // sábado/domingo recolhidos viram uma coluna estreita no lugar deles
          const dow = (x) => dUTC(x).getUTCDay();
          const fecha = (x) => (dow(x) === 6 || dow(x) === 0) && !fds.has(x) && x !== dia;
          const exp = dia !== FOCO && dias.includes(dia) ? dia : null;   // dia expandido além do atual
          const grandeDe = (x) => x === FOCO || x === exp || (passado && x === dia);
          const fp = dias.indexOf(FOCO);
          const comMapa = !passado && fp >= 0 && !exp;
          const tpl = dias.map((x) => (fecha(x) ? "34px" : grandeDe(x) ? "minmax(0,2.2fr)" : "minmax(0,1fr)")).join(" ");
          const esq = fp, dir = fp >= 0 ? dias.length - 1 - fp : 0;
          const ladoMapa = dir >= esq ? "dir" : "esq";
          const colMapa = !comMapa ? null : ladoMapa === "dir" ? `${fp + 2} / ${dias.length + 1}` : `1 / ${fp + 1}`;
          const card = (x, pos) => {
            const i = (dow(x) + 6) % 7;
            if (fecha(x)) {
              const n = (porDia[x] || []).filter((y) => y.status !== "CONCLUIDA").length;
              return (
                <button key={x} type="button" {...alvo(x)} onClick={() => setFds((s0) => new Set(s0).add(x))} title={`${i === 5 ? "Sábado" : "Domingo"} ${dBR(x)}${n ? ` · ${n} demanda(s)` : ""}`}
                  className="rounded-xl flex flex-col items-center justify-center gap-1 text-sm font-bold" style={{ gridColumn: pos + 1, gridRow: 1, minHeight: 260, background: arr === x ? C.accentSoft : C.panel, border: `1px solid ${n || arr === x ? C.accent : C.line}`, color: n ? C.accent : C.sub }}>
                  {i === 5 ? "S" : "D"}{n > 0 && <span className="text-[10px] font-semibold">{n}</span>}
                </button>
              );
            }
            const lTudo = ordenar(porDia[x] || []);
            const l = passado ? lTudo : visiveis(x, lTudo);   // v464 — concluídas ocultas até clicar em "mostrar concluídas" (v521: no Passado aparecem)
            const grande = grandeDe(x);
            const sel = x === dia;
            const atrasado = x < FOCO && !passado;
            const mini = (y) => <MiniDemanda key={y.id} x={y} grande={grande} arrastar={podeArrastar(y)} onConcluir={pode ? concluirDem : null} onClick={(e) => { e.stopPropagation(); abrirDem(x, y); }} />;
            const lista = (ll) => agruparRota(ll, mini, setVerRota);
            const tarde = (y) => String(y.janela?.[0] || "") >= "12:00";
            const alvoDia = arr === x;
            return (
              <div key={x} {...alvo(x)} onClick={() => (grande ? novaNoDia(x) : setDia(x))} className="rounded-xl p-2 cursor-pointer flex flex-col min-w-0 transition-all"
                style={{ gridColumn: pos + 1, gridRow: grande && colMapa ? "1 / span 2" : 1, minHeight: grande ? (altGrade && colMapa ? 0 : 520) : altGrade && colMapa ? 0 : 260, ...(altGrade && colMapa ? { overflowY: "auto" } : {}), background: alvoDia ? C.accentSoft : C.panel, border: `${sel || grande || alvoDia ? 2 : 1}px ${alvoDia ? "dashed" : "solid"} ${sel || grande || alvoDia ? (atrasado ? C.red : C.accent) : atrasado ? C.red : C.line}` }}
                title={grande ? "Clique na manhã ou na tarde para criar a demanda já com o período" : "Clique para abrir este dia"}>
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: atrasado ? C.red : grande ? C.accent : C.sub }}>{DIAS[i]}</span>
                  <span className={grande ? "text-xl font-bold" : "text-sm font-bold"} style={{ color: atrasado ? C.red : grande ? C.accent : C.text }}>{x.slice(8, 10)}</span>
                  {x === FOCO && <span className="text-[11px] font-semibold" style={{ color: C.accent }}>{x === H ? "hoje" : "próximo dia útil"}</span>}
                  {atrasado && <span className="text-[11px] font-semibold" style={{ color: C.red }}>pendente · conclua ou arraste</span>}
                  {i >= 5 && fds.has(x) && <button type="button" onClick={(e) => { e.stopPropagation(); setFds((s0) => { const n = new Set(s0); n.delete(x); return n; }); }} title="Recolher" className="text-[11px] px-1" style={{ color: C.sub }}>✕</button>}
                  <span className="ml-auto flex items-center gap-1">{btnConc(x, lTudo, !grande)}{l.length > 0 && <span className="text-[11px]" style={{ color: C.sub }}>{l.length}</span>}
                    {x === exp && <button type="button" onClick={(e) => { e.stopPropagation(); setDia(FOCO); }} title="Recolher este dia (o mapa volta)" className="text-[11px] px-1 font-semibold" style={{ color: C.sub }}>✕</button>}</span>
                </div>
                {grande ? (
                  <div className="flex-1 flex flex-col gap-2">
                    {[["Manhã", "MANHA", l.filter((y) => !tarde(y))], ["Tarde", "TARDE", l.filter(tarde)]].map(([t, per, ll]) => {
                      const ali = arr === `${x}|${per}`;
                      return (
                        <div key={t} {...alvo(x, per)} onClick={(e) => { e.stopPropagation(); novaNoDia(x, per); }} title={`Clique para criar uma demanda de ${t.toLowerCase()}`}
                          className="flex-1 flex flex-col rounded-lg p-1.5" style={{ background: ali ? C.accentSoft : C.panel2, outline: ali ? `2px dashed ${C.accent}` : "none" }}>
                          <div className="text-[10px] font-bold mb-1 tracking-wide" style={{ color: C.sub }}>{t.toUpperCase()}{ll.length ? ` · ${ll.length}` : ""}</div>
                          <div className="space-y-1 flex-1">
                            {lista(ll)}
                            {!ll.length && <div className="text-[11px] mt-2 text-center" style={{ color: "#B0B7C3" }}><Plus size={12} className="inline" /> nova demanda de {t.toLowerCase()}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1 flex-1">
                    {lista(l.slice(0, 6))}
                    {l.length > 6 && <div className="text-[11px]" style={{ color: C.sub }}>+{l.length - 6}</div>}
                    {!l.length && <div className="text-[11px] mt-2 text-center" style={{ color: "#B0B7C3" }}>abrir o dia</div>}
                  </div>
                )}
              </div>
            );
          };
          return (
            <>
              {passado && <div className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: C.panel2, color: C.sub }}>Vendo dias passados · <button onClick={() => { setRef(FOCO); setDia(FOCO); }} className="font-semibold" style={{ color: C.accent }}>voltar para hoje</button></div>}
              <div ref={gradeRef} className="grid gap-2" style={{ gridTemplateColumns: tpl, ...(colMapa && altGrade ? { height: altGrade, gridTemplateRows: "minmax(190px, 25%) minmax(0, 1fr)" } : {}) }}>
                {dias.map((x, pos) => card(x, pos))}
                {colMapa && (
                  <div className="min-w-0" style={{ gridColumn: colMapa, gridRow: 2, minHeight: 0 }}>
                    <MapasDia demandas={doDia} fabrica={d.fabrica} dia={dia} vivos={vivo?.rotas} cheio={!!altGrade} />
                  </div>
                )}
              </div>
              {!colMapa && !exp && <MapasDia demandas={doDia} fabrica={d.fabrica} dia={dia} vivos={vivo?.rotas} />}
            </>
          );
        })()
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr))" }}>
          {DIAS.map((x) => <div key={x} className="text-[11px] font-semibold px-1" style={{ color: C.sub }}>{x}</div>)}
          {dias.map((x) => {
            const lTudo = ordenar(porDia[x] || []);
            const l = visiveis(x, lTudo);   // v464
            const fora = x.slice(5, 7) !== ref.slice(5, 7);
            return (
              <div key={x} {...alvo(x)} onClick={() => novaNoDia(x)} className="rounded-lg p-1.5 cursor-pointer min-w-0" style={{ minHeight: 86, background: arr === x ? C.accentSoft : C.panel, border: `${x === dia || x === H || arr === x ? 2 : 1}px ${arr === x ? "dashed" : "solid"} ${x === dia || x === H || arr === x ? C.accent : C.line}`, opacity: fora ? 0.5 : 1 }}>
                <div className="text-xs font-bold mb-1 flex items-center" style={{ color: x === H ? C.accent : C.text }}>{x.slice(8, 10)}<span className="ml-auto">{btnConc(x, lTudo, true)}</span></div>
                {agruparRota(l.slice(0, 3), (y) => <MiniDemanda key={y.id} x={y} arrastar={podeArrastar(y)} onConcluir={pode ? concluirDem : null} onClick={(e) => { e.stopPropagation(); abrirDem(x, y); }} />, setVerRota)}
                {l.length > 3 && <div className="text-[10px]" style={{ color: C.sub }}>+{l.length - 3}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* v426 — mapa em largura total; rotas do dia logo abaixo */}
      {d && modo !== "semana" && <MapasDia demandas={doDia} fabrica={d.fabrica} dia={dia} vivos={vivo?.rotas} />}

      {form && <DemandaForm user={user} inicial={form} motoristas={d?.motoristas || []} onClose={() => setForm(null)} onOk={(c) => { setForm(null); if (c?.blocoId) abrirAlteracao(c); carregar(); }} />}
      {montar && <MontarRota user={user} podeLiberar={!!d?.podeLiberar} onRecarregar={carregar} ids={montar.ids} bloco={montar.bloco} canceladas={montar.canceladas} demandas={d?.demandas || []} motoristas={d?.motoristas || []} dia={dia} onClose={() => setMontar(null)} onOk={() => { setMontar(null); setMarc(new Set()); carregar(); }} />}
      {escolher && <EscolherDemandas dia={dia} hoje={H} lista={doDia.filter((x) => x.status === "ABERTA" && !x.frete)} onClose={() => setEscolher(false)} onOk={(ids) => { setEscolher(false); setMontar({ ids }); }} />}
      {verRota && (() => {
        const b = (d?.blocos || []).find((x) => x.id === verRota);
        if (!b) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={() => setVerRota(null)}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[92vh] overflow-auto">
              <div className="flex justify-end mb-1"><button onClick={() => setVerRota(null)} className="rounded-full p-1" style={{ background: C.panel }}><X size={16} style={{ color: C.sub }} /></button></div>
              <BlocoCard b={b} demandas={(d.demandas || []).filter((x) => x.blocoId === b.id)} pode={pode} meu={d.pessoaId && b.motoristaId === d.pessoaId} user={user} onMudou={carregar}
                onEditar={() => { setVerRota(null); setMontar({ ids: (d.demandas || []).filter((x) => x.blocoId === b.id).sort((a, z) => a.ordem - z.ordem).map((x) => x.id), bloco: b }); }} />
              <div className="text-[11px] mt-1 text-center" style={{ color: "#fff" }}>Atualiza sozinho a cada 30 s</div>
            </div>
          </div>
        );
      })()}
      {cfgFab && <FabricaModal user={user} atual={d?.fabrica} onClose={() => setCfgFab(false)} onOk={() => { setCfgFab(false); carregar(); }} />}
    </div>
  );
}

// v445 — demandas da mesma rota ficam juntas, com um único botão R<nº> ao lado do grupo
function agruparRota(l, render, onRota) {
  const grupos = [], porBloco = {};
  for (const y of l) {
    if (y.blocoId) { if (!porBloco[y.blocoId]) { porBloco[y.blocoId] = { bloco: y.blocoId, itens: [] }; grupos.push(porBloco[y.blocoId]); } porBloco[y.blocoId].itens.push(y); }
    else grupos.push({ itens: [y] });
  }
  return grupos.map((g) => {
    if (!g.bloco) return render(g.itens[0]);
    const it = [...g.itens].sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99));
    const st = it.every((y) => y.status === "CONCLUIDA") ? "CONCLUIDA" : it.some((y) => y.status === "EM_EXECUCAO" || y.status === "CONCLUIDA") ? "EM_EXECUCAO" : "NO_BLOCO";
    return (
      <div key={`R${g.bloco}`} className="flex items-stretch gap-1 min-w-0">
        <div className="flex-1 min-w-0 space-y-1">{it.map(render)}</div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onRota?.(g.bloco); }} title={`Ver a rota ${g.bloco}`} className="shrink-0 rounded-md px-1.5 text-[10px] font-bold"
          style={{ background: st === "EM_EXECUCAO" ? C.accent : st === "CONCLUIDA" ? C.green : C.navy, color: "#fff" }}>R{g.bloco}</button>
      </div>
    );
  });
}

function MiniDemanda({ x, grande, onClick, onRota, onConcluir, arrastar }) {
  const c = corDemanda(x);
  const Ico = x.frete ? Truck : x.veiculo === "MOTO" ? Bike : Car;   // v460 — ícone do veículo (o tipo já está na cor)
  const naRota = !!x.blocoId;   // v444 — em rota: mais opaca e com o botão R<nº>
  const feita = x.status === "CONCLUIDA";
  // v507 — igual ao calendário: no hover aparece o check à esquerda e o texto desliza
  const btn = (
    <div role="button" tabIndex={0} onClick={onClick} title={`${OBJ[x.objetivo]?.[0] || ""} · ${x.horario}${x.motoristaNome ? ` · ${sc(x.motoristaNome)}` : ""}${arrastar ? " · arraste para outro dia" : ""}`}
      draggable={!!arrastar} onDragStart={arrastar ? (e) => { e.stopPropagation(); e.dataTransfer.setData("text/rota-demanda", String(x.id)); e.dataTransfer.effectAllowed = "move"; } : undefined}
      className="group relative flex-1 text-left rounded-md px-1.5 py-0.5 block min-w-0 overflow-hidden cursor-pointer" style={{ background: c.bg, border: `${c.bw}px solid ${c.bd}`, opacity: feita ? 0.55 : naRota ? 0.6 : 1 }}>
      {onConcluir && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onConcluir(x); }} title={feita ? "Reabrir" : "Concluir"}
          className={`absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full ${feita ? "" : "opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0"}`}
          style={{ width: 15, height: 15, border: `1.5px solid ${feita ? "#5DA283" : "#6D6E6F"}`, background: feita ? "#5DA283" : "rgba(255,255,255,.85)", transition: "all .18s ease", zIndex: 1 }}>
          <svg width="9" height="9" viewBox="0 0 12 12"><path d="M2.5 6.2l2.2 2.2 4.8-4.9" fill="none" stroke={feita ? "#fff" : "#6D6E6F"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
      <div className={`flex items-center gap-1 text-[11px] font-semibold min-w-0 ${onConcluir ? (feita ? "translate-x-4" : "group-hover:translate-x-4") : ""}`} style={{ color: c.tx, transition: "transform .18s ease" }}>
        {feita ? (onConcluir ? null : <CheckCircle2 size={11} className="shrink-0" style={{ color: C.green }} />) : <Ico size={11} className="shrink-0" />}
        <span className="truncate" title={`${x.destinoNome}${x.tarefa ? ` - ${frase(x.tarefa)}` : ""} · ${OBJ[x.objetivo]?.[0] || ""} · ${x.horario}${x.motoristaNome ? ` · ${sc(x.motoristaNome)}` : ""}`} style={{ textDecoration: feita ? "line-through" : "none" }}>{nomeTarefa(x)}</span>
      </div>
    </div>
  );
  if (!naRota || !onRota) return btn;
  return (
    <div className="flex items-stretch gap-1 min-w-0">
      {btn}
      <button type="button" onClick={(e) => { e.stopPropagation(); onRota(x.blocoId); }} title={`Ver a rota ${x.blocoId}`} className="shrink-0 rounded-md px-1.5 text-[10px] font-bold"
        style={{ background: x.status === "EM_EXECUCAO" ? C.accent : x.status === "CONCLUIDA" ? C.green : C.navy, color: "#fff" }}>R{x.blocoId}</button>
    </div>
  );
}

// ---------- mapas (Leaflet carregado sob demanda) ----------
let _leaflet = null;
function carregarLeaflet() {
  if (_leaflet) return _leaflet;
  _leaflet = new Promise((ok, nok) => {
    if (window.L) return ok(window.L);
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => ok(window.L); s.onerror = nok; document.head.appendChild(s);
  });
  return _leaflet;
}
const LIMITES = { RMBH: [[-20.4, -44.45], [-19.5, -43.6]], MG: [[-22.95, -51.05], [-14.2, -39.85]], BR: [[-33.8, -73.9], [5.3, -34.8]] };
const TITULO_MAPA = { RMBH: "Região metropolitana de BH", MG: "Minas Gerais", BR: "Brasil" };
function Mapa({ area, pontos, fabrica, motoristas = [], altura = 360 }) {
  const ref = useRef(null), caixa = useRef(null), mapa = useRef(null), camada = useRef(null), enq = useRef(""), enquadrar = useRef(null);
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !ref.current) return;
      if (!mapa.current) {
        mapa.current = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90, zoomSnap: 0, zoomDelta: 0.5, fadeAnimation: false });   // v560 — zoom com a rodinha do mouse   // v558 — zoom fracionado: enquadra os pontos o mais perto possível
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19, referrerPolicy: "strict-origin-when-cross-origin" }).addTo(mapa.current);   // v428 — CARTO passou a exigir chave · v459 — OSM bloqueia pedido sem Referer (o domínio com https mandava no-referrer)
        camada.current = L.layerGroup().addTo(mapa.current);
      }
      const m = mapa.current; camada.current.clearLayers();
      const pts = [];
      if (fabrica?.lat != null && area === "RMBH") {
        L.marker([fabrica.lat, fabrica.lng], { zIndexOffset: 1000, icon: L.divIcon({ className: "", iconSize: [92, 34], iconAnchor: [46, 34],   // v437 — logo da Meridian
          html: `<div style="display:flex;flex-direction:column;align-items:center"><img src="/meridian-logo.png" alt="Fábrica" style="height:26px;width:auto;border-radius:6px;border:2px solid #fff;box-shadow:0 1px 4px #0006;display:block"/><div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid #001E41;margin-top:-1px"></div></div>` }) }).bindTooltip("Fábrica", { direction: "top", offset: [0, -30] }).addTo(camada.current);
        pts.push([fabrica.lat, fabrica.lng]);
      }
      for (const p of pontos) {
        const cor = p.cor || "#FF6B1A";
        L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
          html: `<div style="width:26px;height:26px;border-radius:13px;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px #0006;color:#fff;font:700 11px Montserrat,sans-serif;display:flex;align-items:center;justify-content:center">${p.num ?? ""}</div>` }) })
          .bindTooltip(p.rotulo, { direction: "top", offset: [0, -12] }).addTo(camada.current);
        pts.push([p.lat, p.lng]);
      }
      // v485 — motorista em rota: seta laranja apontando a direção
      for (const mo of motoristas) {
        L.marker([mo.lat, mo.lng], { zIndexOffset: 2000, icon: L.divIcon({ className: "", iconSize: [34, 34], iconAnchor: [17, 17],
          html: `<div style="width:34px;height:34px;border-radius:17px;background:${mo.fresca ? "#FFF0E6" : "#EEF0F3"};border:2px solid #fff;box-shadow:0 1px 6px #0007;display:flex;align-items:center;justify-content:center"><svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${mo.rumo}deg)"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="${mo.fresca ? "#FF6B1A" : "#98A2B3"}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg></div>` }) })
          .bindTooltip(mo.rotulo, { direction: "top", offset: [0, -16], permanent: true, className: "" }).addTo(camada.current);
        pts.push([mo.lat, mo.lng]);
      }
      // v436 — zoom o mais perto possível mostrando todos os pontos
      // v485 — a posição do motorista atualiza sem mexer no zoom (só reenquadra quando mudam os pontos do dia)
      const chave = `${area}|${JSON.stringify(pontos)}|${fabrica?.lat}|${motoristas.length}`;
      if (enq.current === chave) { setTimeout(() => m.invalidateSize(), 50); return; }
      enq.current = chave;
      const temFab = fabrica?.lat != null && area === "RMBH";
      enquadrar.current = () => {
        // v562 — o mapa ocupa a área toda (sem recorte) e o zoom é o maior possível: enquadra só as demandas
        //   (e os motoristas), zoom exato (sem degraus) e margem mínima; a fábrica aparece se estiver na área
        m.invalidateSize();
        const alvo = pts.length - (temFab ? 1 : 0) >= 2 ? pts.slice(temFab ? 1 : 0) : pts;
        const fabNaArea = temFab && alvo.length === pts.length;
        if (alvo.length > 1) m.fitBounds(L.latLngBounds(alvo), { paddingTopLeft: [18, fabNaArea ? 40 : 18], paddingBottomRight: [18, 18], maxZoom: 16 });   // v559 — margem mínima (o logo da fábrica sobe 34px)
        else if (pts.length === 1) m.setView(pts[0], 15);
        else m.fitBounds(LIMITES[area], { padding: [4, 4] });
      };
      enquadrar.current();
      setTimeout(() => enquadrar.current?.(), 60);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [area, JSON.stringify(pontos), fabrica?.lat, JSON.stringify(motoristas)]);
  // v558 — o mapa ocupa a altura que sobra na tela: ao mudar de tamanho, refaz o tamanho e o enquadramento (sem faixa cinza)
  useEffect(() => {
    if (!caixa.current || typeof ResizeObserver === "undefined") return;
    let t; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => enquadrar.current?.(), 80); });
    ro.observe(caixa.current);   // v561 — observa a área (o mapa dentro dela muda de largura no enquadramento)
    return () => { clearTimeout(t); ro.disconnect(); };
  }, []);
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);
  return (
    <div ref={caixa} style={{ height: altura, minHeight: 260, flex: altura === "100%" ? 1 : undefined, minWidth: 0, display: "flex" }}>
      <div ref={ref} className="ce-mapa rounded-lg overflow-hidden" style={{ flex: 1, minWidth: 0, background: "#F2EFE9", zIndex: 0 }} />
    </div>
  );
}
function MapasDia({ demandas, fabrica, vivos, cheio }) {
  const mots = (vivos || []).filter((r) => r.posicao?.lat != null).map((r) => ({ lat: r.posicao.lat, lng: r.posicao.lng, rumo: r.posicao.rumo || 0, fresca: r.posicao.fresca, rotulo: `${sc(String(r.motoristaNome || "").split(" ")[0])} · R${r.id}${r.posicao.endereco ? ` · ${r.posicao.endereco}` : ""} · ${r.posicao.minAtras < 1 ? "agora" : `há ${r.posicao.minAtras} min`}` }));
  const ponto = (x, i) => ({ lat: x.lat, lng: x.lng, num: x.ordem || "", rotulo: `${OBJ[x.objetivo]?.[0]} · ${nomeTarefa(x)} · ${x.horario}`, cor: x.status === "CONCLUIDA" ? C.green : x.urgente ? C.red : tipoCor(x).pin });
  const com = demandas.filter((x) => x.lat != null);
  const rmbh = com.filter((x) => x.regiao === "RMBH" || !x.regiao).map(ponto);
  const mg = com.filter((x) => x.regiao === "MG").map(ponto);
  const br = com.filter((x) => x.regiao === "BR").map(ponto);
  const lateral = br.length ? "BR" : mg.length ? "MG" : null;
  return (
    <div className="rounded-xl p-3 grid gap-3" style={{ background: C.panel, border: `1px solid ${C.line}`, gridTemplateColumns: lateral ? "minmax(0,2.4fr) minmax(0,1fr)" : "1fr", ...(cheio ? { height: "100%", gridTemplateRows: "minmax(0,1fr)" } : {}) }}>
      <div className="min-w-0 flex flex-col">
        <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>{TITULO_MAPA.RMBH} · {rmbh.length} ponto(s)</div>
        <Mapa area="RMBH" pontos={rmbh} fabrica={fabrica} motoristas={mots} altura={cheio ? "100%" : 520} />
      </div>
      {lateral && (
        <div className="min-w-0 flex flex-col">
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>Fora da RMBH · {TITULO_MAPA[lateral]} · {lateral === "BR" ? br.length + mg.length : mg.length} ponto(s)</div>
          <Mapa area={lateral} pontos={lateral === "BR" ? [...br, ...mg] : mg} altura={cheio ? "100%" : 520} />
        </div>
      )}
    </div>
  );
}

// v427 — campo de endereço com sugestões do Google Maps enquanto digita (sem a chave, é um campo comum)
function EnderecoGoogle({ user, value, onChange, onGeo, autoFocus, buscar, placeholder = "Rua, número, bairro, cidade - UF" }) {
  const [sug, setSug] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [errG, setErrG] = useState("");   // v431 — erro do Google aparece embaixo do campo
  const sessao = useRef(null);
  const t = useRef(null);
  const digitou = useRef(false);
  useEffect(() => {
    if (!digitou.current) return;
    clearTimeout(t.current);
    const q = String(value || "").trim();
    if (q.length < 4) { setSug([]); return; }
    t.current = setTimeout(() => {
      if (!sessao.current) sessao.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
      fetch(`/api/rotas?u=${user.id}&auto=${encodeURIComponent(q)}&sessao=${sessao.current}`).then((r) => r.json()).then((l) => { if (Array.isArray(l)) { setErrG(""); setSug(l); setAberto(true); } else setErrG(l?.error || "Google não respondeu."); }).catch((e) => setErrG(`Google: ${e.message}`));
    }, 350);
    return () => clearTimeout(t.current);
  }, [value]);
  // v438 — endereço vindo do cadastro: procura no Google o correspondente (sem CEP); sem endereço, procura pelo nome
  const [doCad, setDoCad] = useState(false);
  useEffect(() => {
    if (!buscar) return;
    const limpo = String(buscar.texto || "").replace(/,?\s*CEP\s*[\d.\-]+/i, "").trim();
    const consultas = [limpo, limpo && buscar.nome ? `${buscar.nome} ${limpo.split(",").slice(-1)[0]}` : buscar.nome].filter((x) => x && x.trim().length >= 3);
    if (!consultas.length) return;
    if (!sessao.current) sessao.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
    (async () => {
      for (const c of consultas) {
        const l = await fetch(`/api/rotas?u=${user.id}&auto=${encodeURIComponent(c)}&sessao=${sessao.current}`).then((r) => r.json()).catch(() => null);
        if (Array.isArray(l) && l.length) { setErrG(""); setSug(l); setDoCad(true); setAberto(true); return; }
        if (l && !Array.isArray(l)) { setErrG(l.error || "Google não respondeu."); return; }
      }
    })();
  }, [buscar?.t]);
  const escolher = async (x) => {
    setAberto(false); setSug([]); setDoCad(false); digitou.current = false;
    try {
      const g = await api(`/api/rotas?u=${user.id}&lugar=${encodeURIComponent(x.placeId)}&sessao=${sessao.current || ""}&digitado=${encodeURIComponent(value || "")}`);
      sessao.current = null;
      if (g?.endereco) { onChange(g.endereco); onGeo?.(g); } else onChange(x.texto);
    } catch { onChange(x.texto); }
  };
  return (
    <div className="relative">
      <input autoFocus={autoFocus} value={value || ""} onChange={(e) => { digitou.current = true; setDoCad(false); onChange(e.target.value); onGeo?.(null); }} onFocus={() => sug.length && setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
        placeholder={placeholder} className={inp} style={inpS} />
      {aberto && sug.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-md shadow-lg max-h-64 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          {doCad && <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold" style={{ color: C.accent }}>ESCOLHA O ENDEREÇO DO CADASTRO NO GOOGLE (ATUALIZA O CADASTRO)</div>}
          {sug.map((x) => (
            <button key={x.placeId} type="button" onMouseDown={(e) => { e.preventDefault(); escolher(x); }} className="flex items-start gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50">
              <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: C.sub }} />
              <span className="min-w-0"><span className="block text-sm truncate" style={{ color: C.text }}>{x.principal || x.texto}</span><span className="block text-[11px] truncate" style={{ color: C.sub }}>{x.secundario}</span></span>
            </button>
          ))}
          <div className="px-3 py-1 text-[10px] text-right" style={{ color: "#9AA3B2" }}>Google</div>
        </div>
      )}
      {errG && <div className="text-[11px] mt-1" style={{ color: "#B42318" }}>Sugestões do Google indisponíveis: {errG}</div>}
    </div>
  );
}

// ---------- demanda de rota ----------
const inp = "w-full px-2.5 py-1.5 rounded-md text-sm";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
function L({ t, children, span }) { return <label className={`block min-w-0 ${span ? "col-span-2" : ""}`}><div className="text-xs mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>; }
function Seg({ v, opts, on }) {
  return (
    <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
      {opts.map(([k, t]) => <button key={k} type="button" onClick={() => on(k)} className="flex-1 px-2 py-1.5 text-xs font-semibold" style={{ background: v === k ? C.accent : "#fff", color: v === k ? "#fff" : C.sub }}>{t}</button>)}
    </div>
  );
}
let _destinos = null;
function DemandaForm({ user, inicial, motoristas, onClose, onOk }) {
  const novo = !inicial.id;
  const trava = ["EM_EXECUCAO", "CONCLUIDA"].includes(inicial.status);
  const [f, setF] = useState({ objetivo: "ENTREGA", destinoTipo: "", destinoId: null, destinoNome: "", endereco: "", contato: "", telefone: "", horarioTipo: "MANHA", hora1: "", hora2: "",
    tarefa: "", motoristaId: "", motoristaNome: "", veiculo: "CARRO", urgente: false, frete: false, freteTipo: "", obs: "", ...inicial,
    freteValorMax: inicial.freteValorMax != null ? String(inicial.freteValorMax).replace(".", ",") : "", freteVolumes: inicial.freteVolumes ?? "",
    // v561 — motorista padrão (o único ativo, o Antônio) já vem escolhido
    ...(!inicial.motoristaId && !inicial.frete && motoristas.find((m) => m.padrao) ? { motoristaId: motoristas.find((m) => m.padrao).id, motoristaNome: motoristas.find((m) => m.padrao).nome } : {}) });
  const [lista, setLista] = useState(_destinos || []);
  const [q, setQ] = useState(inicial.destinoNome || "");
  const [aberto, setAberto] = useState(false);
  const [salv, setSalv] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => { if (!_destinos) api(`/api/rotas?u=${user.id}&destinos=1`).then((l) => { _destinos = l; setLista(l); }).catch(() => {}); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  // v438 — busca também pela razão social/CNPJ; quem começa com o texto vem primeiro
  const sug = useMemo(() => { const t = sem(q).trim(); if (t.length < 2) return [];
    const td = t.replace(/\D/g, "");
    const l = lista.filter((x) => sem(`${x.nome} ${x.busca || ""} ${x.endereco}`).includes(t) || (td.length >= 5 && String(x.busca || "").replace(/\D/g, "").includes(td)));
    return l.sort((a, b) => (sem(b.nome).startsWith(t) - sem(a.nome).startsWith(t))).slice(0, 10); }, [q, lista]);
  const [buscaEnd, setBuscaEnd] = useState(null);   // v438 — pede ao Google o endereço do cadastro escolhido
  const escolher = (x) => { setQ(x.nome); setAberto(false); setF((s0) => ({ ...s0, destinoTipo: x.tipo, destinoId: x.id, destinoNome: x.nome, endereco: x.endereco || s0.endereco,
    geo: x.lat != null ? { endereco: x.endereco, lat: x.lat, lng: x.lng, municipio: x.municipio, uf: x.uf } : null, contato: x.contato || "", telefone: x.telefone || "" }));
    if (x.lat == null) setBuscaEnd({ t: Date.now(), texto: x.endereco || "", nome: x.nome }); };
  // v430 — estabelecimentos do Google pelo nome (vira destinatário novo ao salvar)
  const [sugG, setSugG] = useState([]);
  const [errQ, setErrQ] = useState("");   // v431
  const sessaoG = useRef(null), tG = useRef(null), digitouQ = useRef(false);
  useEffect(() => {
    if (!digitouQ.current) return;
    clearTimeout(tG.current);
    const t = String(q || "").trim();
    if (t.length < 3) { setSugG([]); return; }
    tG.current = setTimeout(() => {
      if (!sessaoG.current) sessaoG.current = Math.random().toString(36).slice(2) + Date.now().toString(36);
      fetch(`/api/rotas?u=${user.id}&auto=${encodeURIComponent(t)}&sessao=${sessaoG.current}`).then((r) => r.json()).then((l) => { if (Array.isArray(l)) { setErrQ(""); setSugG(l.slice(0, 6)); setAberto(true); } else { setSugG([]); setErrQ(l?.error || "Google não respondeu."); } }).catch((e) => setErrQ(`Google: ${e.message}`));
    }, 350);
    return () => clearTimeout(tG.current);
  }, [q]);
  const escolherGoogle = async (x) => {
    setAberto(false); digitouQ.current = false;
    try {
      const g = await api(`/api/rotas?u=${user.id}&lugar=${encodeURIComponent(x.placeId)}&sessao=${sessaoG.current || ""}`);
      sessaoG.current = null;
      const nome = String(g?.nome || x.principal || x.texto).toUpperCase();
      setQ(nome);
      setF((s0) => ({ ...s0, destinoTipo: "GOOGLE", destinoId: null, destinoNome: nome, endereco: g?.endereco || x.texto, geo: g?.lat != null ? g : null }));
    } catch { setQ(x.principal || x.texto); }
  };
  async function salvar() {
    setSalv(true); setErro("");
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "demanda", demanda: { ...f, destinoNome: f.destinoNome || q } });
      _destinos = null;   // v430 — destinatário novo entra na lista
      if (r.semMapa) await alerta("Demanda salva, mas o endereço não foi encontrado no mapa. Confira rua, número, cidade e UF para ela aparecer no mapa e entrar no cálculo da rota.");
      // v467 — mesmo destinatário, dia e horário: oferece juntar numa demanda só
      if (r.consolidar?.length) {
        const todas = [r.demanda, ...r.consolidar];
        const lista = todas.map((x) => `#${x.id} ${frase(x.tarefa)}`).join(" e ");
        if (await confirmar(`${r.demanda.destinoNome} já tem demanda no mesmo dia e horário. Consolidar as demandas ${lista} numa só, na mesma parada da rota?`)) {
          try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "consolidar", ids: todas.map((x) => x.id) }); } catch (e) { await alerta(e.message); }
        }
      }
      onOk();
    } catch (e) { setErro(e.message); setSalv(false); }
  }
  // v465 — concluída por engano
  async function reativar() {
    if (!(await confirmar(`Reativar a demanda de ${inicial.destinoNome}? Se a rota dela ainda está em andamento ela volta para a rota; senão fica aberta para entrar em outra rota.`))) return;
    try { const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "reativar", id: inicial.id }); onOk(); alerta(r.naRota ? `Demanda reativada na rota ${r.naRota}.` : "Demanda reativada: está aberta para entrar numa rota."); } catch (e) { setErro(e.message); }
  }
  async function cancelar() {
    const emRota = inicial.status === "EM_EXECUCAO";
    if (!(await confirmar(emRota ? `A demanda de ${inicial.destinoNome} está numa rota em andamento. Cancelar mesmo assim? Ela sai da rota e o motorista é avisado.` : `Cancelar a demanda de ${inicial.destinoNome}?`))) return;
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "cancelar", id: inicial.id });
      onOk(r?.blocoId ? { blocoId: r.blocoId, id: inicial.id, nome: [inicial.destinoNome, inicial.tarefa].filter(Boolean).join(" - ") } : null);   // v454 — estava em rota despachada
    } catch (e) { setErro(e.message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl" style={{ background: C.panel, borderTop: `4px solid ${f.urgente ? C.red : f.frete ? C.blue : C.accent}` }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>{novo ? "Nova demanda de rota" : `Demanda de rota #${inicial.id}`}</div>
          {!novo && inicial.status && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: (ST[inicial.status] || ST.ABERTA)[1] }}>{(ST[inicial.status] || ST.ABERTA)[0]}</span>}
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <fieldset disabled={trava} className="p-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <L t="Objetivo" span><Seg v={f.objetivo} opts={[["COLETA", "Coleta"], ["ENTREGA", "Entrega"], ["COLETA_ENTREGA", "Coleta e entrega"], ["COMPRA", "Compra"]]} on={(v) => set("objetivo", v)} /></L>
          <div className="col-span-2 relative">
            <div className="text-xs mb-1" style={{ color: C.sub }}>Destinatário <span style={{ color: "#9AA3B2" }}>· cadastrados ou locais do Google Maps; um nome novo fica salvo em Dados › Destinatários</span></div>
            <input value={q} onChange={(e) => { digitouQ.current = true; setQ(e.target.value); set("destinoNome", e.target.value.toUpperCase()); set("destinoId", null); set("destinoTipo", "OUTRO"); setAberto(true); }} onFocus={() => setAberto(true)} onBlur={() => setTimeout(() => setAberto(false), 150)}
              placeholder="Digite o nome…" className={inp} style={inpS} />
            {aberto && (sug.length > 0 || sugG.length > 0) && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-md shadow-lg max-h-80 overflow-auto" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
                {sug.length > 0 && <div className="px-3 pt-1.5 text-[10px] font-semibold" style={{ color: "#9AA3B2" }}>CADASTRADOS</div>}
                {sug.map((x) => (
                  <button key={`${x.tipo}${x.id}`} type="button" onMouseDown={(e) => { e.preventDefault(); escolher(x); }} className="block w-full text-left px-3 py-1.5 hover:bg-gray-50">
                    <div className="text-sm" style={{ color: C.text }}>{sc(x.nome)} <span className="text-[10px] px-1.5 rounded" style={{ background: C.panel2, color: C.sub }}>{sc(x.tipo)}</span></div>
                    <div className="text-[11px] truncate" style={{ color: x.endereco ? C.sub : C.yellow }}>{x.endereco || "sem endereço no cadastro"}</div>
                  </button>
                ))}
                {sugG.length > 0 && <div className="px-3 pt-1.5 text-[10px] font-semibold" style={{ color: "#9AA3B2", borderTop: sug.length ? `1px solid ${C.line}` : "none" }}>NO GOOGLE MAPS</div>}
                {sugG.map((x) => (
                  <button key={x.placeId} type="button" onMouseDown={(e) => { e.preventDefault(); escolherGoogle(x); }} className="flex items-start gap-2 w-full text-left px-3 py-1.5 hover:bg-gray-50">
                    <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: C.sub }} />
                    <span className="min-w-0"><span className="block text-sm truncate" style={{ color: C.text }}>{x.principal || x.texto}</span><span className="block text-[11px] truncate" style={{ color: C.sub }}>{x.secundario}</span></span>
                  </button>
                ))}
              </div>
            )}
            {errQ && <div className="text-[11px] mt-1" style={{ color: "#B42318" }}>Locais do Google indisponíveis: {errQ}</div>}
          </div>
          <L t="O que fazer lá" span><input value={f.tarefa || ""} onChange={(e) => set("tarefa", e.target.value)} placeholder="ex.: buscar 300 camisas cortadas · levar NF 1234 · comprar linha" className={inp} style={inpS} /></L>
          <div className="col-span-2"><div className="text-xs mb-1" style={{ color: C.sub }}>Endereço{f.geo ? <span style={{ color: C.green }}> · localizado no mapa ✓</span> : ""}</div>
            <EnderecoGoogle user={user} value={f.endereco} onChange={(v) => set("endereco", v)} onGeo={(g) => set("geo", g)} buscar={buscaEnd} /></div>
          <L t="Contato"><input value={f.contato || ""} onChange={(e) => set("contato", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Telefone"><input value={f.telefone || ""} onChange={(e) => set("telefone", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Horário">
            <select value={f.horarioTipo} onChange={(e) => set("horarioTipo", e.target.value)} className={inp} style={inpS}>
              <option value="FIXO">Horário fixo</option><option value="MANHA">Manhã</option><option value="TARDE">Tarde</option>
              <option value="ATE">Até as…</option><option value="APOS">Após as…</option><option value="ENTRE">De … até …</option><option value="LIVRE">Qualquer horário</option>
            </select>
          </L>
          {["FIXO", "ATE", "APOS", "ENTRE"].includes(f.horarioTipo) && <L t={f.horarioTipo === "ENTRE" ? "De" : f.horarioTipo === "FIXO" ? "Às" : f.horarioTipo === "ATE" ? "Até as" : "Após as"}><input type="time" value={f.hora1 || ""} onChange={(e) => set("hora1", e.target.value)} className={inp} style={inpS} /></L>}
          {f.horarioTipo === "ENTRE" && <L t="Até"><input type="time" value={f.hora2 || ""} onChange={(e) => set("hora2", e.target.value)} className={inp} style={inpS} /></L>}
          {/* v442 — tempo previsto no local (entra na previsão da rota) */}
          <L t="Tempo previsto no local (min)"><input type="number" min="0" step="5" value={f.tempoLocal ?? 15} onChange={(e) => set("tempoLocal", e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0))} className={inp} style={inpS} /></L>
          {!["FIXO", "ATE", "APOS"].includes(f.horarioTipo) && <div />}

          <div className="col-span-2 flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: f.urgente ? C.red : C.sub }}><input type="checkbox" checked={!!f.urgente} onChange={(e) => set("urgente", e.target.checked)} /> Urgente</label>
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer" style={{ color: f.frete ? C.blue : C.sub }}><input type="checkbox" checked={!!f.frete} onChange={(e) => set("frete", e.target.checked)} /> Frete (contratado à parte)</label>
          </div>
          {f.frete ? (
            <>
              <L t="Tipo de frete" span><Seg v={f.freteTipo} opts={[["TRANSPORTADORA", "Transportadora"], ["FRETEBRAS", "Fretebras"]]} on={(v) => set("freteTipo", v)} /></L>
              {f.freteTipo === "FRETEBRAS" && <L t="Valor máximo a pagar (R$)"><input value={f.freteValorMax} onChange={(e) => set("freteValorMax", e.target.value)} inputMode="decimal" className={inp} style={inpS} /></L>}
              {f.freteTipo && <L t="Número de volumes"><input value={f.freteVolumes} onChange={(e) => set("freteVolumes", e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inp} style={inpS} /></L>}
              {f.freteTipo === "TRANSPORTADORA" && <div className="col-span-2 text-xs px-3 py-2 rounded" style={{ background: C.blueSoft, color: C.blue }}>
                {inicial.admDemandaId ? (inicial.cotacao?.status === "CONCLUIDA" ? `Cotado: R$ ${Number(inicial.cotacao.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · prazo ${inicial.cotacao.prazo} · ${inicial.cotacao.transportadoras}` : "Cotação pedida ao administrativo (ADM › Demandas ADM).")
                  : "Ao salvar, o administrativo recebe a demanda de cotar o frete (anexo da cotação, valor, prazo e transportadoras cotadas)."}</div>}
            </>
          ) : (
            <>
              <L t="Motorista">
                <select value={f.motoristaId || ""} onChange={(e) => { const m = motoristas.find((x) => x.id === e.target.value); setF((s0) => ({ ...s0, motoristaId: e.target.value, motoristaNome: m?.nome || "" })); }} className={inp} style={inpS}>
                  <option value="">A definir</option>
                  {motoristas.map((m) => <option key={m.id} value={m.id}>{sc(m.nome)}{m.origem === "FREELANCER" ? " (freelancer)" : ""}{m.emRota ? " · em rota" : ""}</option>)}
                </select>
              </L>
              <L t="Veículo"><Seg v={f.veiculo} opts={[["CARRO", "Carro"], ["MOTO", "Moto"]]} on={(v) => set("veiculo", v)} /></L>
            </>
          )}
          <L t="Observação" span><textarea value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} rows={2} className={inp} style={inpS} /></L>
          {erro && <div className="col-span-2 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        </fieldset>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          {inicial.status === "CONCLUIDA" && <button onClick={reativar} className="text-xs flex items-center gap-1 font-semibold" style={{ color: C.accent }}><Undo2 size={13} /> Reativar demanda</button>}
          {!novo && inicial.status !== "CONCLUIDA" && <button onClick={cancelar} className="text-xs flex items-center gap-1" style={{ color: C.red }}><X size={13} /> Cancelar demanda</button>}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
          {!trava && <button onClick={salvar} disabled={salv} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{salv && <Loader2 size={14} className="animate-spin" />} Salvar</button>}
        </div>
      </div>
    </div>
  );
}

// v426 — escolher as demandas do dia que entram na rota
function EscolherDemandas({ dia, hoje, lista, onClose, onOk }) {
  const [m, setM] = useState(new Set(lista.map((x) => x.id)));
  const tog = (id) => setM((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-xl max-h-[85vh] overflow-auto shadow-2xl" style={{ background: C.panel }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <IcoRota size={18} style={{ color: C.accent }} />
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>Montar rota · {dia === hoje ? "hoje" : dBR(dia)}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {!lista.length ? <div className="px-5 py-8 text-center text-sm" style={{ color: C.sub }}>Nenhuma demanda aberta neste dia para entrar numa rota (as de frete são contratadas à parte).</div> : (
          <div className="py-1">
            {ordenar(lista).map((x) => {
              const Ico = OBJ[x.objetivo]?.[1] || MapPin;
              return (
                <label key={x.id} className="flex items-start gap-3 px-5 py-2 cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: x.urgente ? C.redSoft : undefined }}>
                  <input type="checkbox" checked={m.has(x.id)} onChange={() => tog(x.id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold flex items-center gap-1" style={{ color: x.urgente ? C.red : C.text }}><Ico size={13} /> {OBJ[x.objetivo]?.[0]} · {nomeTarefa(x)}{x.urgente ? " · URGENTE" : ""}</div>
                    <div className="text-[11px] truncate" style={{ color: C.sub }}>{x.endereco}</div>
                    <div className="text-[11px]" style={{ color: C.sub }}>{sc(x.horario)}{x.motoristaNome ? ` · ${sc(x.motoristaNome)}` : ""}{x.lat == null ? " · sem localização" : ""}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button disabled={!m.size} onClick={() => onOk(ordenar(lista).filter((x) => m.has(x.id)).map((x) => x.id))} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: m.size ? 1 : 0.5 }}>Calcular rota ({m.size})</button>
        </div>
      </div>
    </div>
  );
}

// ---------- montar a rota: melhor sequência, ajuste da ordem e despacho ----------
function MontarRota({ user, podeLiberar, onRecarregar, ids, bloco, canceladas, demandas, motoristas, dia, onClose, onOk }) {
  const alt = bloco?.status === "EM_EXECUCAO";   // v454 — rota já despachada: só reordena o que falta e reenvia
  const [extras, setExtras] = useState({});   // v521 — paradas de retorno à fábrica criadas nesta janela
  const porId = { ...Object.fromEntries(demandas.map((x) => [x.id, x])), ...extras };
  const sugMot = bloco?.motoristaId || demandas.find((x) => ids.includes(x.id) && x.motoristaId)?.motoristaId || motoristas.find((m) => m.padrao)?.id || "";   // v561 — motorista padrão
  const agora = new Date(); const hoje = hojeISO() === dia;
  const saidaPadrao = bloco?.saida || (hoje ? `${String(Math.max(8, agora.getHours() + (agora.getMinutes() > 30 ? 1 : 0))).padStart(2, "0")}:${agora.getMinutes() > 30 ? "00" : "30"}` : "08:00");
  const [mot, setMot] = useState(sugMot);
  const [veic, setVeic] = useState(bloco?.veiculo || demandas.find((x) => ids.includes(x.id) && x.veiculo)?.veiculo || "CARRO");
  const [saida, setSaida] = useState(saidaPadrao);
  const [ordem, setOrdem] = useState(ids);
  const [av, setAv] = useState(null);
  const [ocup, setOcup] = useState(false);
  const [desp, setDesp] = useState(null);   // resultado do despacho (link do WhatsApp)
  // v439 — tempo previsto em cada local (min), entra na previsão de chegada e de retorno
  const [tempos, setTempos] = useState(() => Object.fromEntries(ids.map((i) => [i, porId[i]?.tempoLocal ?? 15])));
  const ehRet = (id) => porId[id]?.objetivo === "RETORNO";
  const calc = async (acao, l = ordem, tp = tempos) => {
    setOcup(true);
    try {
      // v521 — o retorno à fábrica fica na posição escolhida: a melhor ordem é calculada só para as outras paradas
      const fixos = l.map((id, i) => (ehRet(id) ? [i, id] : null)).filter(Boolean);
      if (acao === "otimizar" && fixos.length) {
        const r0 = await api("/api/rotas", "POST", { usuarioId: user.id, acao, ids: l.filter((id) => !ehRet(id)), saida, veiculo: veic, tempos: tp });
        const nova = [...r0.ordem]; for (const [i, id] of fixos) nova.splice(Math.min(i, nova.length), 0, id);
        setOrdem(nova);
        setAv(await api("/api/rotas", "POST", { usuarioId: user.id, acao: "avaliar", ids: nova, saida, veiculo: veic, tempos: tp }));
      } else { const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao, ids: l, saida, veiculo: veic, tempos: tp }); setAv(r); if (acao === "otimizar") setOrdem(r.ordem); }
    } catch (e) { alerta(e.message); }
    setOcup(false);
  };
  // v521 — retorno à fábrica no meio da rota (entra antes da última parada; ajuste com as setas)
  async function addRetorno() {
    setOcup(true);
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "criarRetorno", data: dia });
      setExtras((x) => ({ ...x, [r.demanda.id]: r.demanda }));
      const l = [...ordem]; l.splice(Math.max(1, l.length - 1), 0, r.demanda.id);
      const tp = { ...tempos, [r.demanda.id]: r.demanda.tempoLocal ?? 20 };
      setOrdem(l); setTempos(tp); setOcup(false); calc("avaliar", l, tp);
    } catch (e) { alerta(e.message); setOcup(false); }
  }
  async function tirarRetorno(id) {
    const l = ordem.filter((x) => x !== id); setOrdem(l); calc("avaliar", l);
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "cancelar", id }); } catch {}
  }
  // fechou sem salvar: retornos criados aqui não ficam soltos no calendário
  const fechar = async () => { for (const id of Object.keys(extras)) { try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "cancelar", id: Number(id) }); } catch {} } onClose(); };
  useEffect(() => { if (!alt) calc(bloco ? "avaliar" : "otimizar", ids); }, []);
  useEffect(() => { if (av && !alt) calc("avaliar"); }, [saida, veic]);
  const tT = useRef(null);
  const mudarTempo = (id, v) => { const tp = { ...tempos, [id]: v === "" ? "" : Math.max(0, parseInt(v, 10) || 0) }; setTempos(tp); if (alt) return; clearTimeout(tT.current); tT.current = setTimeout(() => calc("avaliar", ordem, tp), 500); };
  const mexer = (i, dir) => { const l = [...ordem]; const j = i + dir; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; setOrdem(l); if (!alt) calc("avaliar", l); };
  async function enviarAlterada() {
    setOcup(true);
    try { const x = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "alterar", id: bloco.id, ordem, tempos, canceladas: canceladas || [] }); setDesp(x); } catch (e) { alerta(e.message); }
    setOcup(false);
  }
  const eta = Object.fromEntries((av?.etas || []).map((e) => [e.id, e]));
  const [liberados, setLiberados] = useState(new Set());   // v461 — motoristas liberados nesta janela
  const m0 = motoristas.find((x) => x.id === mot);
  const m = m0 && liberados.has(m0.id) ? { ...m0, emRota: null } : m0;
  // v461 — master/diretoria/adm: "está na fábrica" encerra a rota em curso por engano
  async function liberar() {
    if (!(await confirmar(`${sc(m.nome)} consta na rota ${m.emRota}. Ele já está disponível na fábrica? A rota é encerrada: paradas concluídas ficam registradas e as que faltam voltam a ficar abertas.`))) return false;
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "liberarMotorista", motoristaId: m.id });
      setLiberados((s) => new Set(s).add(m.id)); onRecarregar?.();
      if (r.reabertas) alerta(`Rota ${r.rotas.join(", ")} encerrada. ${r.reabertas} parada(s) voltaram a ficar abertas.`);
      return true;
    } catch (e) { alerta(e.message); return false; }
  }
  async function salvar(despachar) {
    if (!mot) return alerta("Escolha o motorista.");
    if (despachar && m?.emRota && m.emRota !== bloco?.id) {
      if (!podeLiberar) return alerta(`${sc(m.nome)} ainda está em outra rota. Ele fica disponível quando registrar o retorno à fábrica. Se ele já está na fábrica, peça para o administrativo, a diretoria ou um master liberar.`);
      if (!(await liberar())) return;
    }
    setOcup(true);
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "bloco", id: bloco?.id, ordem, motoristaId: mot, veiculo: veic, saida, tempos });
      if (despachar) {
        const x = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "despachar", id: r.bloco.id });
        setDesp(x); setOcup(false); return;
      }
      onOk();
    } catch (e) { alerta(e.message); setOcup(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={desp ? onOk : fechar}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl" style={{ background: C.panel }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <IcoRota size={18} style={{ color: C.accent }} />
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>{bloco ? `Rota ${bloco.id}${alt ? " · alterada" : ""}` : "Montar rota"} · {dBR(dia)}</div>
          <button onClick={desp ? onOk : fechar}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {desp ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: C.green }}><CheckCircle2 size={18} /> Rota {desp.bloco.id} {desp.alterada ? "alterada" : "despachada"} · em execução</div>
            {desp.whatsapp ? (
              <a href={desp.whatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold" style={{ background: "#25D366", color: "#fff" }}><Send size={15} /> Enviar a rota {desp.alterada ? "alterada " : ""}no WhatsApp de {sc(desp.bloco.motoristaNome)}</a>
            ) : <div className="text-xs px-3 py-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>{sc(desp.bloco.motoristaNome)} não tem telefone cadastrado (ficha do RH ou cadastro do freelancer). Copie a mensagem abaixo.</div>}
            {(desp.bloco.links || []).map((l, i) => <a key={i} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm" style={{ color: C.blue }}><ExternalLink size={13} /> Abrir no Google Maps{desp.bloco.links.length > 1 ? ` (parte ${i + 1})` : ""}</a>)}
            <textarea readOnly value={desp.texto} rows={8} className="w-full px-2 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.sub }} />
            <div className="flex justify-end"><button onClick={onOk} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Concluir</button></div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {alt && <div className="text-xs px-3 py-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>
              Rota em andamento com {sc(bloco.motoristaNome)}.{canceladas?.length ? <> Cancelada: <b>{canceladas.join("; ")}</b>.</> : null} Ajuste a ordem das paradas que faltam e envie a rota alterada. O link do Maps sai de onde o motorista está.
            </div>}
            {!alt && <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 150px 110px" }}>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Motorista</div>
                <select value={mot} onChange={(e) => setMot(e.target.value)} className="w-full px-2.5 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>
                  <option value="">Escolha…</option>
                  {motoristas.map((x) => <option key={x.id} value={x.id}>{sc(x.nome)}{x.emRota && x.emRota !== bloco?.id && !liberados.has(x.id) ? " · em rota" : " · disponível"}</option>)}
                </select>
                {podeLiberar && m?.emRota && m.emRota !== bloco?.id && <button type="button" onClick={liberar} className="text-[11px] mt-1 font-semibold" style={{ color: C.accent }}>Já está na fábrica? Liberar motorista</button>}
                </label>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Veículo</div>
                <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
                  {[["CARRO", Car], ["MOTO", Bike]].map(([k, I]) => <button key={k} onClick={() => setVeic(k)} className="flex-1 py-1.5 flex justify-center" style={{ background: veic === k ? C.accent : "#fff", color: veic === k ? "#fff" : C.sub }}><I size={15} /></button>)}
                </div></label>
              <label className="block"><div className="text-xs mb-1" style={{ color: C.sub }}>Saída</div><input type="time" value={saida} onChange={(e) => setSaida(e.target.value)} className="w-full px-2 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }} /></label>
            </div>}
            {!alt && <div className="flex items-center gap-2 text-xs" style={{ color: C.sub }}>
              <span className="flex-1">{ocup ? <Loader2 size={13} className="animate-spin inline" /> : av ? <>Percurso estimado <b style={{ color: C.text }}>{String(av.km).replace(".", ",")} km</b> · retorno à fábrica por volta das <b style={{ color: C.text }}>{av.retorno}</b></> : ""}</span>
              <button onClick={() => calc("otimizar")} className="px-2.5 py-1 rounded font-semibold" style={{ border: `1px solid ${C.line}`, color: C.accent }}>Sugerir melhor ordem</button>
            </div>}
            <div className="rounded-lg" style={{ border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: C.sub, background: C.panel2 }}><Home size={13} /> {alt ? "Posição atual do motorista" : `Saída da fábrica · ${saida}`}</div>
              {ordem.map((id, i) => {
                const x = porId[id]; if (!x) return null; const e = eta[id];
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2" style={{ borderTop: `1px solid ${C.line}`, background: x.urgente ? C.redSoft : undefined }}>
                    <span className="rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ width: 22, height: 22, background: C.accent, color: "#fff" }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: x.urgente ? C.red : C.text }}>{OBJ[x.objetivo]?.[0]} · {nomeTarefa(x)}</div>
                      <div className="text-[11px] truncate" style={{ color: C.sub }}>{x.endereco}</div>
                      <div className="text-[11px]" style={{ color: e?.atrasoMin ? C.red : C.sub }}>{sc(x.horario)}{e ? ` · chegada prevista ${e.chegada} · sai ${e.saida}${e.atrasoMin ? ` · ${e.atrasoMin} min fora do horário` : ""}` : ""}{x.lat == null ? " · sem localização (estimado)" : ""}</div>
                    </div>
                    <label className="flex flex-col items-center shrink-0" title="Tempo previsto no local (min)">
                      <span className="text-[10px]" style={{ color: C.sub }}>no local</span>
                      <span className="flex items-center gap-0.5"><input type="number" min="0" step="5" value={tempos[id] ?? 15} onChange={(ev) => mudarTempo(id, ev.target.value)} className="w-12 px-1 py-0.5 rounded text-sm text-right" style={{ border: `1px solid ${C.line}` }} /><span className="text-[10px]" style={{ color: C.sub }}>min</span></span>
                    </label>
                    <button onClick={() => mexer(i, -1)} disabled={i === 0} className="p-1 rounded" style={{ color: i === 0 ? "#C9CED6" : C.sub }}><ArrowUp size={14} /></button>
                    <button onClick={() => mexer(i, 1)} disabled={i === ordem.length - 1} className="p-1 rounded" style={{ color: i === ordem.length - 1 ? "#C9CED6" : C.sub }}><ArrowDown size={14} /></button>
                    {!alt && x.objetivo === "RETORNO" && <button onClick={() => tirarRetorno(id)} title="Tirar o retorno da rota" className="p-1 rounded" style={{ color: C.red }}><X size={14} /></button>}
                  </div>
                );
              })}
              {!alt && ordem.length > 0 && <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
                <button onClick={addRetorno} disabled={ocup} className="text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}><Plus size={13} /> Retorno à fábrica no meio da rota</button></div>}
              <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: C.sub, background: C.panel2, borderTop: `1px solid ${C.line}` }}><Home size={13} /> Retorno à fábrica{av && !alt ? ` · ${av.retorno}` : ""}{av?.volta ? ` (${av.volta.min} min de viagem · ${String(av.volta.km).replace(".", ",")} km)` : ""}</div>
            </div>
            {!alt && <div className="text-[11px]" style={{ color: C.sub }}>A ordem sugerida busca a menor distância respeitando o horário de cada demanda ({av?.porRuas ? "distância e tempo por ruas com o trânsito previsto para o dia e a hora de saída, Google Maps" : "distância estimada em linha reta"} + o tempo previsto em cada local). Use as setas para ajustar.{av?.avisoRuas ? <span style={{ color: C.yellow }}> Google indisponível: {av.avisoRuas}</span> : null}</div>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={fechar} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
              {alt ? <button onClick={enviarAlterada} disabled={ocup || !ordem.length} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{ocup ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar rota alterada</button> : <>
              <button onClick={() => salvar(false)} disabled={ocup} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Salvar rota</button>
              <button onClick={() => salvar(true)} disabled={ocup} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><Send size={14} /> Despachar</button></>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- blocos (rotas montadas) ----------
// v443 — mensagem da rota: reenviar no WhatsApp ou copiar
function MensagemRota({ user, id, onClose }) {
  const [m, setM] = useState(null);
  const [copiou, setCopiou] = useState(false);
  useEffect(() => { api("/api/rotas", "POST", { usuarioId: user.id, acao: "mensagem", id }).then(setM).catch((e) => { alerta(e.message); onClose(); }); }, [id]);
  const copiar = async () => { try { await navigator.clipboard.writeText(m.texto); setCopiou(true); setTimeout(() => setCopiou(false), 2000); } catch { alerta("Não consegui copiar. Selecione o texto e copie."); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-lg shadow-2xl" style={{ background: C.panel }}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <MessageCircle size={18} style={{ color: C.accent }} />
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>Mensagem da rota {id}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {!m ? <div className="p-5 flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Montando a mensagem…</div> : (
          <div className="p-5 space-y-3">
            {m.whatsapp ? <a href={m.whatsapp} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-semibold" style={{ background: "#25D366", color: "#fff" }}><Send size={15} /> Enviar no WhatsApp de {sc(m.bloco.motoristaNome)}</a>
              : <div className="text-xs px-3 py-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>{sc(m.bloco.motoristaNome)} não tem telefone cadastrado. Copie a mensagem abaixo.</div>}
            <textarea readOnly value={m.texto} rows={10} className="w-full px-2 py-1.5 rounded text-xs" style={{ border: `1px solid ${C.line}`, color: C.sub }} />
            <div className="flex justify-end gap-2">
              <button onClick={copiar} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><Copy size={14} /> {copiou ? "Copiada!" : "Copiar mensagem"}</button>
              <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlocoCard({ b, demandas, pode, meu, user, onMudou, onEditar }) {
  const [msg, setMsg] = useState(false);   // v443
  const l = [...demandas].sort((a, z) => (a.ordem || 0) - (z.ordem || 0));
  const feitas = l.filter((x) => x.status === "CONCLUIDA").length;
  const cor = b.status === "EM_EXECUCAO" ? C.accent : b.status === "CONCLUIDO" ? C.green : C.yellow;
  const txt = b.status === "EM_EXECUCAO" ? "em execução" : b.status === "CONCLUIDO" ? "concluída" : "montada · não despachada";
  const acao = async (body, pergunta) => { if (pergunta && !(await confirmar(pergunta))) return; try { await api("/api/rotas", "POST", { usuarioId: user.id, ...body }); onMudou(); } catch (e) { alerta(e.message); } };
  return (
    <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${cor}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold flex items-center gap-1" style={{ color: C.navy }}>Rota {b.id} · {sc(b.motoristaNome)} {b.veiculo === "MOTO" ? <Bike size={13} /> : <Car size={13} />}</div>
          <div className="text-[11px]" style={{ color: C.sub }}>{l.length} parada(s){b.distanciaKm ? ` · ~${String(b.distanciaKm).replace(".", ",")} km` : ""}{b.saida ? ` · saída ${b.saida}` : ""}{b.status === "EM_EXECUCAO" ? ` · ${feitas}/${l.length} concluídas` : ""}{b.retornoEm ? ` · retorno ${new Date(b.retornoEm).toLocaleTimeString("pt-BR", { timeStyle: "short" })}` : ""}</div>
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cor, background: C.panel2 }}>{txt}</span>
      </div>
      <div className="px-4 pb-2 space-y-1">
        {l.map((x) => (
          <div key={x.id} className="flex items-center gap-2 text-xs">
            {b.status === "EM_EXECUCAO" && (pode || meu)
              ? <button onClick={() => acao({ acao: "parada", id: x.id, desfazer: x.status === "CONCLUIDA" })} style={{ color: x.status === "CONCLUIDA" ? C.green : C.sub }}>{x.status === "CONCLUIDA" ? <CheckCircle2 size={15} /> : <Circle size={15} />}</button>
              : <span className="font-bold w-4 text-center" style={{ color: C.sub }}>{x.ordem}</span>}
            <span className="truncate" style={{ color: C.text, textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{OBJ[x.objetivo]?.[0]} · {nomeTarefa(x)}</span>
            <span className="ml-auto whitespace-nowrap" style={{ color: C.sub }}>{x.horario}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
        {(b.links || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1" style={{ color: C.blue }}><ExternalLink size={12} /> Maps{b.links.length > 1 ? ` ${i + 1}` : ""}</a>)}
        <div className="flex-1" />
        {pode && <button onClick={() => setMsg(true)} className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.text }}><MessageCircle size={12} /> Mensagem</button>}
        {pode && <button onClick={async () => {   // v447 — envia direto no WhatsApp do motorista
          const w = window.open("", "_blank");
          try {
            const m = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "mensagem", id: b.id });
            if (m.whatsapp && w) w.location.href = m.whatsapp;
            else { w?.close(); if (m.whatsapp) window.open(m.whatsapp, "_blank"); else { alerta(`${sc(b.motoristaNome)} não tem telefone cadastrado. Use Mensagem para copiar o texto.`); } }
          } catch (e) { w?.close(); alerta(e.message); }
        }} className="text-xs flex items-center gap-1 px-2.5 py-1 rounded font-semibold" style={{ background: "#25D366", color: "#fff" }}><Send size={12} /> WhatsApp</button>}
        {msg && <MensagemRota user={user} id={b.id} onClose={() => setMsg(false)} />}
        {b.status === "MONTAGEM" && pode && <>
          <button onClick={() => acao({ acao: "desfazerBloco", id: b.id }, `Desfazer a rota ${b.id}? As demandas voltam a ficar abertas.`)} className="text-xs flex items-center gap-1" style={{ color: C.red }}><Undo2 size={12} /> Desfazer</button>
          <button onClick={onEditar} className="text-xs px-2.5 py-1 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Abrir / despachar</button>
        </>}
        {b.status === "EM_EXECUCAO" && (pode || meu) && feitas < l.length && !l.find((x) => x.status !== "CONCLUIDA" && x.objetivo === "RETORNO") && <BotaoRetornoMeio user={user} bloco={b} justificar={!pode} onMudou={onMudou} />}
        {b.status === "EM_EXECUCAO" && (pode || meu) && <button disabled={feitas < l.length} onClick={() => acao({ acao: "retorno", id: b.id }, `Registrar o retorno de ${sc(b.motoristaNome)} à fábrica? A rota fecha e ele fica disponível para outra.`)}
          className="text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1" style={{ background: feitas < l.length ? C.panel2 : C.green, color: feitas < l.length ? C.sub : "#fff" }} title={feitas < l.length ? "Conclua todas as paradas primeiro" : ""}><Home size={12} /> Retorno à fábrica</button>}
      </div>
    </div>
  );
}

// v521 — retorno à fábrica no meio da rota: vira a próxima parada. Motorista justifica; quem monta as rotas só confirma.
function BotaoRetornoMeio({ user, bloco, justificar, escuro, onMudou }) {
  const [abre, setAbre] = useState(false);
  const [txt, setTxt] = useState("");
  const [oc, setOc] = useState(false);
  const enviar = async () => {
    if (justificar && txt.trim().length < 5) return alerta("Escreva a justificativa.");
    if (!justificar && !(await confirmar(`Incluir o retorno à fábrica como próxima parada da rota ${bloco.id}?`))) return;
    setOc(true);
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "retornoNaRota", blocoId: bloco.id, justificativa: txt }); setAbre(false); setTxt(""); onMudou?.(); } catch (e) { alerta(e.message); }
    setOc(false);
  };
  if (!justificar) return <button onClick={enviar} disabled={oc} className="text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><Home size={12} /> Retorno no meio</button>;
  if (!abre) return <button onClick={() => setAbre(true)} className={escuro ? "w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" : "text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1"}
    style={escuro ? { background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.35)" } : { border: `1px solid ${C.accent}`, color: C.accent }}><Home size={escuro ? 15 : 12} /> Voltar à fábrica agora (no meio da rota)</button>;
  return (
    <div className="rounded-lg p-2 space-y-2" style={{ background: escuro ? "rgba(255,255,255,.12)" : C.panel2 }}>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={2} autoFocus placeholder="Justificativa (por que precisa voltar à fábrica agora?)" className="w-full px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text, background: "#fff" }} />
      <div className="flex justify-end gap-2">
        <button onClick={() => setAbre(false)} className="px-3 py-1 rounded text-xs" style={{ color: escuro ? "#fff" : C.sub }}>Cancelar</button>
        <button onClick={enviar} disabled={oc} className="px-3 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}>{oc ? "Enviando…" : "Confirmar retorno"}</button>
      </div>
    </div>
  );
}

// visão do motorista: a rota dele em execução, com as paradas em sequência
function MinhaRota({ bloco, demandas, user, onMudou }) {
  const l = [...demandas].sort((a, z) => (a.ordem || 0) - (z.ordem || 0));
  const feitas = l.filter((x) => x.status === "CONCLUIDA").length;
  const prox = l.find((x) => x.status !== "CONCLUIDA");
  const acao = async (body, pergunta) => { if (pergunta && !(await confirmar(pergunta))) return; try { await api("/api/rotas", "POST", { usuarioId: user.id, ...body }); onMudou(); } catch (e) { alerta(e.message); } };
  return (
    <div className="rounded-xl p-4" style={{ background: C.navy, color: "#fff" }}>
      <div className="flex items-center gap-2 mb-3">
        <Truck size={18} />
        <div className="font-bold flex-1">Minha rota · {feitas}/{l.length} paradas concluídas</div>
        {(bloco.links || []).map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs px-2.5 py-1 rounded font-semibold flex items-center gap-1" style={{ background: "#fff", color: C.navy }}><ExternalLink size={12} /> Google Maps{bloco.links.length > 1 ? ` ${i + 1}` : ""}</a>)}
      </div>
      <div className="space-y-2">
        {l.map((x) => (
          <div key={x.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: x.status === "CONCLUIDA" ? "rgba(255,255,255,.08)" : x.id === prox?.id ? "#fff" : "rgba(255,255,255,.15)", color: x.id === prox?.id ? C.text : "#fff" }}>
            <span className="rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ width: 24, height: 24, background: x.status === "CONCLUIDA" ? C.green : C.accent, color: "#fff" }}>{x.ordem}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{OBJ[x.objetivo]?.[0]} · {nomeTarefa(x)}{x.urgente ? " · URGENTE" : ""}</div>
              <div className="text-xs opacity-80 truncate">{x.endereco}</div>
              <div className="text-xs opacity-80">{sc(x.horario)}{x.telefone ? ` · ${[x.contato, x.telefone].filter(Boolean).join(" · ")}` : ""}{x.obs ? ` · ${x.obs}` : ""}</div>
            </div>
            <button onClick={() => acao({ acao: "parada", id: x.id, desfazer: x.status === "CONCLUIDA" })} className="px-3 py-1.5 rounded-md text-xs font-semibold shrink-0" style={{ background: x.status === "CONCLUIDA" ? "transparent" : C.green, color: "#fff", border: x.status === "CONCLUIDA" ? "1px solid rgba(255,255,255,.4)" : "none" }}>
              {x.status === "CONCLUIDA" ? "Desfazer" : "Concluir"}
            </button>
          </div>
        ))}
        {feitas < l.length && prox?.objetivo !== "RETORNO" && <BotaoRetornoMeio user={user} bloco={bloco} justificar escuro onMudou={onMudou} />}
        <button disabled={feitas < l.length} onClick={() => acao({ acao: "retorno", id: bloco.id }, "Confirmar o retorno à fábrica? A rota fecha.")} className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: feitas < l.length ? "rgba(255,255,255,.15)" : C.accent, color: "#fff", opacity: feitas < l.length ? 0.6 : 1 }}><Home size={15} /> Cheguei na fábrica</button>
      </div>
    </div>
  );
}

// ---------- v463 — ao vivo: o que cada motorista em rota está fazendo agora ----------
const curtoNome = (n) => sc(String(n || "").split(" ")[0]);
function AoVivo({ user, onRota, onDados }) {
  const [v, setV] = useState(null);
  useEffect(() => {
    let vivo = true;
    const ler = () => api(`/api/rotas?u=${user.id}&aovivo=1`).then((x) => { if (vivo) { setV(x); onDados?.(x); } }).catch(() => {});
    ler(); const t = setInterval(ler, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  if (!v?.rotas?.length) return null;
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: C.navy, color: "#fff" }}>
        <span className="relative flex" style={{ width: 9, height: 9 }}><span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: C.accent, opacity: 0.7 }} /><span className="relative inline-flex rounded-full" style={{ width: 9, height: 9, background: C.accent }} /></span>
        <span className="text-xs font-bold uppercase tracking-wide">Ao vivo</span>
        <span className="text-[11px]" style={{ color: "#B9C6D8" }}>· atualiza a cada 30 s{v.agora ? ` · ${v.agora}` : ""}</span>
      </div>
      <div className="divide-y" style={{ borderColor: C.line }}>
        {v.rotas.map((r) => <AoVivoRota key={r.id} r={r} onRota={onRota} />)}
      </div>
    </div>
  );
}
function AoVivoRota({ r, onRota }) {
  const Vei = r.veiculo === "MOTO" ? Bike : Car;
  const ps = r.paradas;
  const iInd = ps.findIndex((p) => p.status === "INDO");
  const iPend = ps.findIndex((p) => p.status !== "FEITA");
  const ultima = [...ps].reverse().find((p) => p.status === "FEITA");
  const nm = (p) => `${p.nome}${p.tarefa ? ` - ${frase(p.tarefa)}` : ""}`;
  const hm = (d) => (d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "");
  const txt = {
    INDO: <>A caminho de <b>{nm(ps[iInd] || {})}</b>{ps[iInd]?.eta ? <> · chega por volta das <b>{ps[iInd].eta}</b></> : null}</>,
    NA_PARADA: <>Em <b>{ultima ? nm(ultima) : "parada"}</b>{ultima?.concluidaEm ? ` (concluiu às ${hm(ultima.concluidaEm)})` : ""} · ainda não saiu para a próxima</>,
    SAINDO: <>Despachado{r.despachadoEm ? ` às ${hm(r.despachadoEm)}` : ""} · ainda não iniciou a 1ª parada</>,
    VOLTANDO: <>Voltando à fábrica</>,
    FIM_PARADAS: <>Concluiu todas as paradas · ainda não iniciou a volta</>,
  }[r.fase];
  // trilha: fábrica → paradas → fábrica; a perna atual fica laranja com o veículo
  const pernaAtual = r.fase === "INDO" ? iInd : r.fase === "VOLTANDO" ? ps.length : -1;   // índice do ponto de chegada da perna
  const pontos = [{ k: "f0", t: "🏭", nome: "Fábrica", feito: true }, ...ps.map((p, i) => ({ k: p.id, t: String(i + 1), nome: nm(p), feito: p.status === "FEITA", eta: p.eta, alvo: p.status === "INDO" })), { k: "f1", t: "🏭", nome: "Fábrica", feito: false, eta: r.retornoPrevisto, alvo: r.fase === "VOLTANDO" }];
  const aqui = r.fase === "NA_PARADA" ? ps.indexOf(ultima) + 1 : r.fase === "SAINDO" ? 0 : r.fase === "FIM_PARADAS" ? ps.length : -1;   // parado neste ponto
  const pos = r.posicao;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Vei size={16} style={{ color: C.accent }} />
        <span className="text-sm font-bold" style={{ color: C.navy }}>{curtoNome(r.motoristaNome)}</span>
        <span className="text-sm" style={{ color: C.sub }}>cumprindo</span>
        <button onClick={() => onRota?.(r.id)} className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: C.accent, color: "#fff" }}>R{r.id}</button>
        {r.alterada && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>ALTERADA</span>}
        <span className="text-xs flex-1 min-w-0 truncate" style={{ color: C.text }}>{txt}</span>
        {pos ? <a href={`https://www.google.com/maps?q=${pos.lat},${pos.lng}`} target="_blank" rel="noreferrer" title="Ver no Google Maps" className="text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: pos.fresca ? C.greenSoft : C.panel2, color: pos.fresca ? C.green : C.sub }}><MapPin size={11} /> {pos.minAtras < 1 ? "agora" : `há ${pos.minAtras} min`}</a>
          : <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.sub }} title="O app do motorista manda a localização enquanto está aberto">sem localização</span>}
        {r.retornoPrevisto && <span className="text-xs font-semibold flex items-center gap-1" style={{ color: C.navy }}><Home size={12} /> volta ~{r.retornoPrevisto}</span>}
      </div>
      {pos && <div className="text-xs mt-1 flex items-center gap-1" style={{ color: pos.fresca ? C.text : C.sub }}>   {/* v485 — onde o motorista está */}
        <svg width="12" height="12" viewBox="0 0 24 24" style={{ transform: `rotate(${pos.rumo || 0}deg)` }}><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill={C.accent} /></svg>
        <span className="truncate">{pos.endereco || `${Number(pos.lat).toFixed(5)}, ${Number(pos.lng).toFixed(5)}`}</span>
        <span style={{ color: C.sub }}>· {pos.minAtras < 1 ? "agora" : `há ${pos.minAtras} min`}{!pos.fresca ? " · posição antiga (app do motorista fechado?)" : ""}</span>
      </div>}
      <div className="flex items-start mt-2.5 overflow-x-auto pb-1">
        {pontos.map((p, i) => (
          <React.Fragment key={p.k}>
            {i > 0 && <div className="flex-1 relative" style={{ minWidth: 28, height: 26 }}>
              <div className="absolute left-0 right-0 rounded-full" style={{ top: 11, height: 4, background: p.feito ? C.green : i === pernaAtual ? C.accent : C.line, ...(i === pernaAtual ? { backgroundImage: `repeating-linear-gradient(90deg, ${C.accent} 0 6px, #FFD2B8 6px 10px)` } : {}) }} />
              {i === pernaAtual && <span className="absolute left-1/2 -translate-x-1/2 rounded-full flex items-center justify-center" style={{ top: 1, width: 24, height: 24, background: "#fff", border: `2px solid ${C.accent}` }}><Vei size={13} style={{ color: C.accent }} /></span>}
            </div>}
            <div className="flex flex-col items-center shrink-0" style={{ width: 64 }} title={p.nome}>
              <div className="rounded-full flex items-center justify-center text-[11px] font-bold relative" style={{ width: 26, height: 26, background: p.feito ? C.green : p.alvo ? "#fff" : C.panel, color: p.feito ? "#fff" : p.alvo ? C.accent : C.sub, border: `2px solid ${p.feito ? C.green : p.alvo || i === aqui ? C.accent : C.line}`, boxShadow: i === aqui ? `0 0 0 4px ${C.accentSoft}` : "none" }}>
                {p.feito && p.t !== "🏭" ? "✓" : p.t}
                {i === aqui && <span className="absolute -top-2 -right-2 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, background: C.accent }}><Vei size={9} style={{ color: "#fff" }} /></span>}
              </div>
              <div className="text-[10px] mt-0.5 w-full text-center truncate" style={{ color: p.feito ? C.green : C.sub }}>{p.t === "🏭" ? "Fábrica" : curtoNome(p.nome)}</div>
              {!p.feito && p.eta && i > 0 && <div className="text-[10px] font-semibold" style={{ color: p.alvo ? C.accent : C.text }}>~{p.eta}</div>}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Motoristas({ l }) {
  if (!l.length) return <div className="text-xs px-1" style={{ color: C.sub }}>Nenhum motorista na folha (cargo com "motorista") nem freelancer com função motorista.</div>;
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-xs font-semibold mb-2" style={{ color: C.sub }}>Motoristas</div>
      <div className="flex flex-wrap gap-2">
        {l.map((m) => (
          <span key={m.id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: m.emRota ? C.accentSoft : C.greenSoft, color: m.emRota ? C.accent : C.green }}>
            <span className="rounded-full" style={{ width: 7, height: 7, background: m.emRota ? C.accent : C.green }} /> {sc(m.apelido || m.nome)} · {m.emRota ? `em rota (${m.emRota})` : "disponível"}{!m.telefone ? " · sem telefone" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function FabricaModal({ user, atual, onClose, onOk }) {
  const [e, setE] = useState(atual?.endereco || "");
  const [geo, setGeo] = useState(null);
  const [ocup, setOcup] = useState(false);
  const salvar = async () => {
    setOcup(true);
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "fabrica", endereco: e, geo }); onOk(); } catch (x) { alerta(x.message); setOcup(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(ev) => ev.stopPropagation()} className="rounded-xl w-full max-w-lg shadow-2xl p-5" style={{ background: C.panel }}>
        <div className="text-base font-bold mb-1" style={{ color: C.navy }}>Endereço da fábrica</div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>Ponto de saída e de retorno de todas as rotas.</div>
        <EnderecoGoogle user={user} autoFocus value={e} onChange={setE} onGeo={setGeo} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={salvar} disabled={ocup || !e.trim()} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{ocup && <Loader2 size={14} className="animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ---------- v430 — Dados › Destinatários ----------
export function Destinatarios({ user }) {
  const [l, setL] = useState(null);
  const [q, setQ] = useState("");
  const [ed, setEd] = useState(null);
  const carregar = () => api(`/api/rotas?u=${user.id}&destinatarios=1`).then(setL).catch(() => setL([]));
  useEffect(() => { carregar(); }, []);
  const lista = (l || []).filter((x) => !q || sem(`${x.nome} ${x.endereco} ${x.contato || ""}`).includes(sem(q)));
  const excluir = async (x) => {
    if (!(await confirmar(`Excluir o destinatário ${sc(x.nome)}?`))) return;
    try { await api("/api/rotas", "POST", { usuarioId: user.id, acao: "excluirDestinatario", id: x.id }); _destinos = null; carregar(); } catch (e) { alerta(e.message); }
  };
  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Destinatários</div>
          <div className="text-xs" style={{ color: C.sub }}>Locais das demandas de rota que não são fornecedor, terceirizado nem cliente. Um nome novo na demanda de rota entra aqui sozinho.</div>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="px-3 py-1.5 rounded-md text-sm w-56" style={{ border: `1px solid ${C.line}` }} />
        <button onClick={() => setEd({})} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Novo</button>
      </div>
      <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {!l && <div className="p-4 flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
        {l && !lista.length && <div className="p-6 text-center text-sm" style={{ color: C.sub }}>Nenhum destinatário.</div>}
        {lista.map((x) => (
          <div key={x.id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
            <MapPin size={16} style={{ color: x.lat != null ? C.green : C.yellow }} title={x.lat != null ? "Localizado no mapa" : "Fora do mapa"} />
            <button onClick={() => setEd(x)} className="flex-1 text-left min-w-0">
              <div className="text-sm font-semibold" style={{ color: C.text }}>{sc(x.nome)}</div>
              <div className="text-xs truncate" style={{ color: C.sub }}>{x.endereco}</div>
              {(x.contato || x.telefone) && <div className="text-xs" style={{ color: C.sub }}>{[x.contato, x.telefone].filter(Boolean).join(" · ")}</div>}
            </button>
            <span className="text-xs whitespace-nowrap" style={{ color: C.sub }}>{x.demandas} demanda(s)</span>
            <button onClick={() => excluir(x)} title="Excluir" style={{ color: C.sub }}><X size={15} /></button>
          </div>
        ))}
      </div>
      {ed && <DestinatarioForm user={user} inicial={ed} onClose={() => setEd(null)} onOk={() => { setEd(null); _destinos = null; carregar(); }} />}
    </div>
  );
}
function DestinatarioForm({ user, inicial, onClose, onOk }) {
  const [f, setF] = useState({ nome: "", endereco: "", contato: "", telefone: "", obs: "", ...inicial });
  const [ocup, setOcup] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setOcup(true);
    try {
      const r = await api("/api/rotas", "POST", { usuarioId: user.id, acao: "destinatario", destinatario: f });
      if (r.semMapa) await alerta("Salvo, mas o endereço não foi encontrado no mapa. Escolha uma das sugestões do Google para localizar.");
      onOk();
    } catch (e) { alerta(e.message); setOcup(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-lg shadow-2xl" style={{ background: C.panel }}>
        <div className="flex items-center px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-base font-bold flex-1" style={{ color: C.navy }}>{inicial.id ? "Destinatário" : "Novo destinatário"}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-5 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <L t="Nome" span><input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value.toUpperCase())} className={inp} style={inpS} /></L>
          <div className="col-span-2"><div className="text-xs mb-1" style={{ color: C.sub }}>Endereço{f.geo || (f.lat != null && f.endereco === inicial.endereco) ? <span style={{ color: C.green }}> · localizado no mapa ✓</span> : ""}</div>
            <EnderecoGoogle user={user} value={f.endereco} onChange={(v) => set("endereco", v)} onGeo={(g) => set("geo", g)} buscar={buscaEnd} /></div>
          <L t="Contato"><input value={f.contato || ""} onChange={(e) => set("contato", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Telefone"><input value={f.telefone || ""} onChange={(e) => set("telefone", e.target.value)} className={inp} style={inpS} /></L>
          <L t="Observação" span><textarea value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} rows={2} className={inp} style={inpS} /></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={salvar} disabled={ocup || !f.nome.trim() || !String(f.endereco || "").trim()} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{ocup && <Loader2 size={14} className="animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}
