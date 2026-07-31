"use client";
import React, { useState, useEffect } from "react";
import {
  LayoutList, Trello, LayoutDashboard, CalendarDays, Package, ShoppingCart,
  FileText, ClipboardList, Boxes, ArrowLeftRight, Users2, Plus,
  ChevronRight, Eye, EyeOff, Mountain, CheckCircle2, Workflow,
} from "lucide-react";

/* ============================================================
   MERIDIAN — Protótipo (v2 · tema claro estilo Asana + laranja Meridian)
   ============================================================ */
const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", yellow: "#C08401",
  sidebar: "#001E41", sidebarLine: "#0C2C52", sidebarSub: "#9FB0C7",
};

const PEDIDOS = [
  { id: "26040015", cliente: "ANAC BRASÍLIA", pecas: "Camiseta, Calça", qtd: 240, status: "Em produção", entrega: "12/08" },
  { id: "25100242", cliente: "ANAC BRASÍLIA", pecas: "Jaqueta", qtd: 80, status: "Em compras", entrega: "18/08" },
  { id: "26060068", cliente: "ULTRASONIC", pecas: "Jaleco, Polo", qtd: 150, status: "Aguardando estoque", entrega: "20/08" },
  { id: "26070073", cliente: "SEGURA", pecas: "Camisa", qtd: 60, status: "Em produção", entrega: "22/08" },
  { id: "26070040", cliente: "ATRATIVA SERVICE", pecas: "Avental", qtd: 120, status: "Lançamento PP", entrega: "26/08" },
  { id: "25100215", cliente: "NORT CAMPINAS", pecas: "Camiseta", qtd: 300, status: "Concluído", entrega: "05/07" },
];
const STATUS_COL = ["Lançamento PP", "Em compras", "Aguardando estoque", "Em produção", "Concluído"];
const STATUS_COLOR = {
  "Lançamento PP": C.yellow, "Em compras": C.blue, "Aguardando estoque": C.accent,
  "Em produção": C.green, "Concluído": C.sub,
};
const ARTIGOS = [
  { id: 1, fab: "Malharia SP", nome: "Malha PV", cor: "Tutti Frutti", tec: "MALHA", larg: 1.8, valor: 32.9 },
  { id: 2, fab: "Têxtil MG", nome: "Oxford", cor: "Azul Marinho", tec: "PLANO", larg: 1.5, valor: 18.5 },
  { id: 3, fab: "Coats", nome: "Linha 120", cor: "Branca", tec: null, larg: null, valor: 6.2 },
  { id: 4, fab: "Zíperes RJ", nome: "Zíper 6mm", cor: "Preto", tec: null, larg: null, valor: 1.9 },
];
const ESTOQUE = [
  { art: "Malha PV — Tutti Frutti", end: "Corredor A · Célula 3", saldo: "420 kg", origem: "NF 12.334", val: 13818 },
  { art: "Oxford — Azul Marinho", end: "Corredor A · Célula 7", saldo: "180 m", origem: "NF 12.401", val: 3330 },
  { art: "Zíper 6mm — Preto", end: "Corredor B · Célula 1", saldo: "1.500 un", origem: "NF 12.410", val: 2850 },
];
const COMPONENTES = {
  CAMISETA: ["MODELAGEM","TECIDO","GOLA DA CAMISETA","MANGA DA CAMISETA","BARRA DA CAMISETA","RECORTE DA CAMISETA","BOLSO DA CAMISETA","EXTRA DA CAMISETA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  CALÇA: ["MODELAGEM","TECIDO","FECHAMENTO DA CALÇA","COS DA CALÇA","BOLSO DIANTEIRO","BOLSO TRASEIRO","REFORÇO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  JAQUETA: ["MODELAGEM","TECIDO","GOLA","MANGA","FECHAMENTO","COSTAS","BARRA","PUNHO","RECORTE","BOLSO","FORRO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  AVENTAL: ["MODELAGEM","TECIDO","BOLSO DO AVENTAL","ALÇA DO AVENTAL","EXTRA DO AVENTAL","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
};
const PERFIS = ["FINANCEIRO", "PCP", "COMPRAS", "ESTOQUE"];
const NAV = [
  { key: "inicio", label: "Início", icon: LayoutDashboard, perfis: ["FINANCEIRO","PCP","COMPRAS","ESTOQUE"] },
  { key: "pedidos", label: "Pedidos", icon: ClipboardList, perfis: ["FINANCEIRO","PCP","COMPRAS","ESTOQUE"] },
  { key: "producao", label: "Produção", icon: Workflow, perfis: ["FINANCEIRO","PCP","ESTOQUE"] },
  { key: "pp", label: "Lançar PP", icon: FileText, perfis: ["FINANCEIRO","PCP"] },
  { key: "pic", label: "PIC diário", icon: ClipboardList, perfis: ["FINANCEIRO","PCP"] },
  { key: "oc", label: "Ordens de Compra", icon: ShoppingCart, perfis: ["FINANCEIRO","COMPRAS"] },
  { key: "nf", label: "Notas Fiscais", icon: FileText, perfis: ["FINANCEIRO","COMPRAS"] },
  { key: "estoque", label: "Estoque", icon: Boxes, perfis: ["FINANCEIRO","ESTOQUE"] },
  { key: "fme", label: "FME", icon: ArrowLeftRight, perfis: ["FINANCEIRO","ESTOQUE"] },
  { key: "artigos", label: "Artigos & Fornec.", icon: Package, perfis: ["FINANCEIRO","PCP","COMPRAS"] },
  { key: "usuarios", label: "Usuários", icon: Users2, perfis: ["FINANCEIRO"] },
];

export default function Home() {
  const [logged, setLogged] = useState(false);
  const [perfil, setPerfil] = useState("FINANCEIRO");
  const [view, setView] = useState("inicio");
  const [tab, setTab] = useState("lista");
  const master = perfil === "FINANCEIRO";
  const [showVal, setShowVal] = useState(true);

  if (!logged) return <Login onEnter={() => setLogged(true)} />;
  const nav = NAV.filter((n) => n.perfis.includes(perfil));
  const money = (v) => (master && showVal ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "•••••");

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "Montserrat, system-ui, sans-serif" }} className="flex text-sm">
      <aside style={{ background: C.sidebar }} className="w-60 shrink-0 flex flex-col">
        <button onClick={() => setView("inicio")} className="px-4 py-4 flex items-center w-full" style={{ borderBottom: `1px solid ${C.sidebarLine}`, background: C.sidebar }}>
          <img src="/meridian-logo.png" alt="MERIDIAN" style={{ height: 30, width: "auto" }} />
        </button>
        <nav className="flex-1 py-2">
          {nav.map((n) => {
            const Ico = n.icon; const on = view === n.key;
            return (
              <button key={n.key} onClick={() => { setView(n.key); setTab("lista"); }}
                className="w-full flex items-center gap-3 px-4 py-2 transition-colors"
                style={{ background: on ? "#0C2C52" : "transparent", color: on ? C.accent : C.sidebarSub,
                  borderLeft: on ? `3px solid ${C.accent}` : "3px solid transparent" }}>
                <Ico size={17} /> <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-xs" style={{ borderTop: `1px solid ${C.sidebarLine}`, color: C.sidebarSub }}>
          Sistema de Gestão · v1
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-6 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
          <div className="font-semibold">{NAV.find((n) => n.key === view)?.label}</div>
          <div className="flex items-center gap-3">
            {master && (
              <button onClick={() => setShowVal((s) => !s)} className="flex items-center gap-1 px-2 py-1 rounded"
                style={{ background: C.panel2, color: C.sub }}>
                {showVal ? <Eye size={15} /> : <EyeOff size={15} />} valores
              </button>
            )}
            <span className="text-xs" style={{ color: C.sub }}>Perfil:</span>
            <select value={perfil} onChange={(e) => { setPerfil(e.target.value); setView("pedidos"); }}
              style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }} className="px-2 py-1 rounded outline-none">
              {PERFIS.map((p) => <option key={p} value={p}>{p}{p === "FINANCEIRO" ? " (Igor · master)" : ""}</option>)}
            </select>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold" style={{ background: C.accent, color: "#fff" }}>{perfil[0]}</div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {view === "inicio" && <Inicio money={money} master={master} />}
          {view === "pedidos" && <Pedidos tab={tab} setTab={setTab} money={money} />}
          {view === "producao" && <Producao />}
          {view === "pp" && <LancarPP />}
          {view === "pic" && <PIC />}
          {view === "oc" && <OC money={money} />}
          {view === "nf" && <NF />}
          {view === "estoque" && <Estoque money={money} master={master} />}
          {view === "fme" && <FME />}
          {view === "artigos" && <Artigos money={money} master={master} />}
          {view === "usuarios" && <Usuarios />}
        </div>
      </main>
    </div>
  );
}

function Login({ onEnter }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Montserrat, system-ui, sans-serif" }} className="flex items-center justify-center">
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }} className="w-80 rounded-xl p-8">
        <div className="rounded-lg mb-4 flex items-center justify-center py-3" style={{ background: "#001E41" }}>
          <img src="/meridian-logo.png" alt="MERIDIAN" style={{ height: 34, width: "auto" }} />
        </div>
        <p className="text-center text-xs mb-6" style={{ color: C.sub }}>Gestão de Material & Financeiro</p>
        <label className="text-xs" style={{ color: C.sub }}>Usuário</label>
        <input defaultValue="igor" className="w-full mb-3 mt-1 px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        <label className="text-xs" style={{ color: C.sub }}>Senha</label>
        <input type="password" defaultValue="••••••" className="w-full mb-5 mt-1 px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        <button onClick={onEnter} className="w-full py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Entrar</button>
      </div>
    </div>
  );
}

function Inicio({ money, master }) {
  const areas = [
    { l: "Pedidos em aberto", v: "5", sub: "2 entregas nesta semana", c: C.accent },
    { l: "Produção", v: "3", sub: "peças em etapa ativa", c: C.blue },
    { l: "Compras", v: "2", sub: "OCs pendentes · 3 PICs hoje", c: C.yellow },
    { l: "Estoque", v: "3", sub: "artigos endereçados", c: C.green },
    ...(master ? [{ l: "Valor em estoque", v: money(19998), sub: "custo total", c: C.text }] : []),
  ];
  const bars = STATUS_COL.map((s) => ({ s, n: PEDIDOS.filter((p) => p.status === s).length }));
  const maxB = Math.max(...bars.map((b) => b.n), 1);
  const etapas = [
    { e: "Corte", n: 1 }, { e: "Personalização", n: 1 }, { e: "Costura", n: 1 }, { e: "Acabamento", n: 0 },
  ];
  const maxE = Math.max(...etapas.map((x) => x.n), 1);
  return (
    <div>
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${areas.length}, minmax(0,1fr))` }}>
        {areas.map((a) => (
          <div key={a.l} className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-xs mb-2" style={{ color: C.sub }}>{a.l}</div>
            <div className="text-2xl font-bold" style={{ color: a.c }}>{a.v}</div>
            <div className="text-xs mt-1" style={{ color: C.sub }}>{a.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold mb-4">Pedidos por status</div>
          {bars.map((b) => (
            <div key={b.s} className="flex items-center gap-3 mb-2">
              <div className="w-36 text-xs" style={{ color: C.sub }}>{b.s}</div>
              <div className="flex-1 h-5 rounded" style={{ background: C.panel2 }}>
                <div className="h-5 rounded flex items-center px-2 text-xs font-medium" style={{ width: `${(b.n / maxB) * 100}%`, background: STATUS_COLOR[b.s], color: "#fff", minWidth: 24 }}>{b.n}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-semibold mb-4">Produção por etapa</div>
          {etapas.map((x) => (
            <div key={x.e} className="flex items-center gap-3 mb-2">
              <div className="w-36 text-xs" style={{ color: C.sub }}>{x.e}</div>
              <div className="flex-1 h-5 rounded" style={{ background: C.panel2 }}>
                <div className="h-5 rounded flex items-center px-2 text-xs font-medium" style={{ width: `${(x.n / maxE) * 100}%`, background: C.accent, color: "#fff", minWidth: 24 }}>{x.n}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Pedidos({ tab, setTab, money }) {
  const tabs = [
    { k: "lista", label: "Lista", icon: LayoutList },
    { k: "kanban", label: "Kanban", icon: Trello },
    { k: "dash", label: "Dashboard", icon: LayoutDashboard },
    { k: "cal", label: "Calendário", icon: CalendarDays },
  ];
  return (
    <div>
      <div className="flex items-center gap-1 mb-5">
        {tabs.map((t) => {
          const Ico = t.icon; const on = tab === t.k;
          return (
            <button key={t.k} onClick={() => setTab(t.k)} className="flex items-center gap-2 px-3 py-1.5 rounded-md"
              style={{ background: on ? C.accentSoft : C.panel, color: on ? C.accent : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>
              <Ico size={15} /> {t.label}
            </button>
          );
        })}
        <button className="flex items-center gap-1 ml-auto px-3 py-1.5 rounded-md font-medium" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Novo PV</button>
      </div>
      {tab === "lista" && <Lista />}
      {tab === "kanban" && <Kanban />}
      {tab === "dash" && <Dash money={money} />}
      {tab === "cal" && <Calendario />}
    </div>
  );
}

function Lista() {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
        <div className="col-span-2">PV</div><div className="col-span-3">Cliente</div><div className="col-span-3">Peças</div>
        <div className="col-span-1">Qtd</div><div className="col-span-2">Status</div><div className="col-span-1">Entrega</div>
      </div>
      {PEDIDOS.map((p) => (
        <div key={p.id} className="grid grid-cols-12 px-4 py-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="col-span-2 font-mono">{p.id}</div>
          <div className="col-span-3 font-medium">{p.cliente}</div>
          <div className="col-span-3" style={{ color: C.sub }}>{p.pecas}</div>
          <div className="col-span-1">{p.qtd}</div>
          <div className="col-span-2"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: STATUS_COLOR[p.status] + "1A", color: STATUS_COLOR[p.status] }}>{p.status}</span></div>
          <div className="col-span-1" style={{ color: C.sub }}>{p.entrega}</div>
        </div>
      ))}
    </div>
  );
}

function Kanban() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {STATUS_COL.map((col) => {
        const items = PEDIDOS.filter((p) => p.status === col);
        return (
          <div key={col} className="w-64 shrink-0">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[col] }} />
              <span className="font-semibold text-sm">{col}</span>
              <span className="text-xs" style={{ color: C.sub }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((p) => (
                <div key={p.id} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(16,24,40,0.05)" }}>
                  <div className="text-xs font-mono mb-1" style={{ color: STATUS_COLOR[col] }}>{p.id}</div>
                  <div className="font-medium">{p.cliente}</div>
                  <div className="text-xs mt-1" style={{ color: C.sub }}>{p.pecas} · {p.qtd} pç</div>
                  <div className="text-xs mt-2 flex items-center gap-1" style={{ color: C.sub }}><CalendarDays size={12} /> {p.entrega}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dash({ money }) {
  const cards = [
    { l: "PVs em aberto", v: "5", c: C.accent },
    { l: "PICs do dia", v: "3", c: C.blue },
    { l: "OCs pendentes", v: "2", c: C.yellow },
    { l: "Valor em estoque", v: money(19998), c: C.green },
  ];
  const bars = STATUS_COL.map((s) => ({ s, n: PEDIDOS.filter((p) => p.status === s).length }));
  const max = Math.max(...bars.map((b) => b.n), 1);
  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.l} className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-xs mb-2" style={{ color: C.sub }}>{c.l}</div>
            <div className="text-2xl font-bold" style={{ color: c.c }}>{c.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-sm font-semibold mb-4">Pedidos por status</div>
        {bars.map((b) => (
          <div key={b.s} className="flex items-center gap-3 mb-2">
            <div className="w-40 text-xs" style={{ color: C.sub }}>{b.s}</div>
            <div className="flex-1 h-5 rounded" style={{ background: C.panel2 }}>
              <div className="h-5 rounded flex items-center px-2 text-xs font-medium" style={{ width: `${(b.n / max) * 100}%`, background: STATUS_COLOR[b.s], color: "#fff", minWidth: 24 }}>{b.n}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calendario() {
  const dias = ["SEG","TER","QUA","QUI","SEX"];
  const eventos = { QUI: [PEDIDOS[0]], SEX: [PEDIDOS[1], PEDIDOS[3]], TER: [PEDIDOS[4]] };
  return (
    <div className="grid grid-cols-5 gap-3">
      {dias.map((d, i) => (
        <div key={d} className="rounded-lg p-3 min-h-64" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold" style={{ color: C.sub }}>{d}</span>
            <span className="text-lg font-bold">{11 + i}</span>
          </div>
          {(eventos[d] || []).map((p) => (
            <div key={p.id} className="rounded-md p-2 mb-2 text-xs" style={{ background: STATUS_COLOR[p.status] + "1A", borderLeft: `3px solid ${STATUS_COLOR[p.status]}` }}>
              <div className="font-mono" style={{ color: STATUS_COLOR[p.status] }}>{p.id}</div>
              <div>{p.cliente}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Producao() {
  const etapas = ["Corte", "Personalização", "Costura", "Acabamento"];
  const exemplo = {
    "Corte": [PEDIDOS[4]],
    "Personalização": [PEDIDOS[0]],
    "Costura": [PEDIDOS[3]],
    "Acabamento": [],
  };
  return (
    <div>
      <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: C.accentSoft, border: `1px solid ${C.accent}44`, color: C.text }}>
        Módulo em preparação — receberá o fluxo do cronograma (etapas do chão de fábrica), integrado aos pedidos.
      </div>
      <div className="grid grid-cols-4 gap-4">
        {etapas.map((e) => (
          <div key={e}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="w-2 h-2 rounded-full" style={{ background: C.accent }} />
              <span className="font-semibold text-sm">{e}</span>
              <span className="text-xs" style={{ color: C.sub }}>{exemplo[e].length}</span>
            </div>
            <div className="rounded-lg p-2 min-h-40" style={{ background: C.panel2, border: `1px dashed ${C.line}` }}>
              {exemplo[e].map((p) => (
                <div key={p.id} className="rounded-md p-2 mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <div className="text-xs font-mono" style={{ color: C.accent }}>{p.id}</div>
                  <div className="text-sm">{p.cliente}</div>
                  <div className="text-xs" style={{ color: C.sub }}>{p.pecas} · {p.qtd} pç</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LancarPP() {
  const [tipo, setTipo] = useState("CAMISETA");
  return (
    <div className="max-w-4xl">
      <div className="rounded-lg p-4 mb-5 flex items-center justify-between" style={{ background: C.greenSoft, border: `1px solid ${C.green}44` }}>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} color={C.green} />
          <div>
            <div className="font-semibold">Solicitação importada · PV 26070040</div>
            <div className="text-xs" style={{ color: C.sub }}>Cliente ATRATIVA SERVICE · 120 peças · importado do PDF de lançamento</div>
          </div>
        </div>
        <span className="text-xs px-2 py-1 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>auto-preenchido</span>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm" style={{ color: C.sub }}>Peça:</span>
        {Object.keys(COMPONENTES).map((t) => (
          <button key={t} onClick={() => setTipo(t)} className="px-3 py-1 rounded-md text-sm"
            style={{ background: tipo === t ? C.accentSoft : C.panel, color: tipo === t ? C.accent : C.sub, border: `1px solid ${tipo === t ? C.accent : C.line}` }}>{t}</button>
        ))}
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
        <div className="px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>Parâmetros da peça — {tipo}</div>
        {COMPONENTES[tipo].map((comp, i) => <LinhaParam key={comp} n={i + 1} comp={comp} />)}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Salvar rascunho</button>
        <button className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Gerar demanda</button>
      </div>
    </div>
  );
}

function LinhaParam({ n, comp }) {
  const isTecido = comp === "TECIDO";
  const [tec, setTec] = useState("MALHA");
  return (
    <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
      <span className="w-5 text-xs" style={{ color: C.sub }}>{n}</span>
      <ChevronRight size={14} color={C.sub} />
      <span className="w-56 text-sm">{comp}</span>
      {isTecido ? (
        <div className="flex items-center gap-2 flex-1">
          <select value={tec} onChange={(e) => setTec(e.target.value)} className="px-2 py-1 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option>MALHA</option><option>PLANO</option>
          </select>
          <input placeholder="Artigo (ex.: Malha PV Tutti Frutti)" className="flex-1 px-2 py-1 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
          <input placeholder={tec === "MALHA" ? "Rendimento (pç/kg)" : "Consumo (m/pç)"} className="w-40 px-2 py-1 rounded outline-none" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}66` }} />
        </div>
      ) : (
        <input placeholder="—" className="flex-1 px-2 py-1 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
      )}
    </div>
  );
}

function PIC() {
  const itens = [
    { art: "Malha PV — Tutti Frutti", pv: "26070040", qtd: "310 kg" },
    { art: "Oxford — Azul Marinho", pv: "25100242", qtd: "120 m" },
    { art: "Zíper 6mm — Preto", pv: "25100242", qtd: "80 un" },
  ];
  return (
    <div className="max-w-3xl">
      <p className="text-sm mb-4" style={{ color: C.sub }}>PIC gerado ao fim do dia com a demanda consolidada de todos os PVs lançados.</p>
      <Tabela cols={["Artigo", "PV origem", "Demanda"]} rows={itens.map((i) => [i.art, i.pv, i.qtd])} />
      <button className="mt-4 px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Gerar PIC · enviar a Compras</button>
    </div>
  );
}
function OC({ money }) {
  return (
    <div className="max-w-3xl">
      <p className="text-sm mb-4" style={{ color: C.sub }}>PICs consolidados por fornecedor em ordens de compra.</p>
      <div className="rounded-lg p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex justify-between mb-2"><span className="font-semibold">OC 4471 · Malharia SP</span><span className="font-semibold" style={{ color: C.accent }}>{money(10199)}</span></div>
        <div className="text-xs" style={{ color: C.sub }}>Malha PV Tutti Frutti · 310 kg · fat. 30d · fábrica 05/08 · entrega 08/08</div>
      </div>
      <div className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex justify-between mb-2"><span className="font-semibold">OC 4472 · Têxtil MG</span><span className="font-semibold" style={{ color: C.accent }}>{money(2220)}</span></div>
        <div className="text-xs" style={{ color: C.sub }}>Oxford Azul Marinho · 120 m · fat. à vista · fábrica 06/08 · entrega 09/08</div>
      </div>
    </div>
  );
}
function NF() {
  const [nfs, setNfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null); // {tipo:'ok'|'erro', texto}
  const [arrastando, setArrastando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { const r = await fetch("/api/nf").then((x) => x.json()); setNfs(Array.isArray(r) ? r : []); } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const lerArquivo = (file) => new Promise((res, rej) => {
    const isXml = /\.xml$/i.test(file.name);
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Falha ao ler o arquivo"));
    fr.onload = () => {
      if (isXml) res({ tipo: "xml", conteudo: fr.result });
      else res({ tipo: "pdf", conteudo: String(fr.result).split(",")[1] }); // base64
    };
    if (isXml) fr.readAsText(file); else fr.readAsDataURL(file);
  });

  const enviar = async (file) => {
    if (!file) return;
    setMsg(null); setEnviando(true);
    try {
      const payload = await lerArquivo(file);
      const r = await fetch("/api/nf/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: data.error || "Não foi possível importar." });
      } else {
        setMsg({ tipo: "ok", texto: `NF ${data.numero} importada (${data.origem}). ${data.itensCriados} item(ns) · ${data.artigosCriados} artigo(s) novo(s), ${data.artigosVinculados} vinculado(s).` });
        carregar();
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    }
    setEnviando(false);
  };

  return (
    <div className="max-w-4xl">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!enviando) setArrastando(true); }}
        onDragLeave={(e) => { e.preventDefault(); setArrastando(false); }}
        onDrop={(e) => {
          e.preventDefault(); setArrastando(false);
          if (!enviando) enviar(e.dataTransfer.files?.[0]);
        }}
        className="rounded-lg p-5 mb-5 transition-colors"
        style={{ background: arrastando ? C.accentSoft : C.panel, border: `2px dashed ${arrastando ? C.accent : C.accent + "88"}` }}>
        <div className="font-semibold mb-1">Importar Nota Fiscal</div>
        <p className="text-xs mb-4" style={{ color: C.sub }}>
          {arrastando ? "Solte o arquivo aqui…" : "Arraste um XML ou PDF para esta área, ou clique no botão. "}
          Aceita apenas notas de <b>venda</b> (remessa, industrialização, devolução, etc. são recusadas). Notas repetidas são bloqueadas pela chave. XML é a fonte mais confiável; o PDF importa o cabeçalho e valida a natureza.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold cursor-pointer"
          style={{ background: enviando ? C.panel2 : C.accent, color: enviando ? C.sub : "#fff" }}>
          {enviando ? "Importando…" : "Selecionar XML ou PDF"}
          <input type="file" accept=".xml,.pdf" disabled={enviando} style={{ display: "none" }}
            onChange={(e) => enviar(e.target.files?.[0])} />
        </label>
        {msg && (
          <div className="mt-4 rounded p-3 text-sm" style={{
            background: msg.tipo === "ok" ? C.greenSoft : "#FBE9E9",
            color: msg.tipo === "ok" ? C.green : "#B42318",
            border: `1px solid ${msg.tipo === "ok" ? C.green + "55" : "#F0A9A9"}`,
          }}>{msg.texto}</div>
        )}
      </div>

      <div className="text-xs mb-2" style={{ color: C.sub }}>Notas importadas</div>
      {loading ? <div style={{ color: C.sub }}>Carregando…</div> : (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
            <div className="w-28">NF</div><div className="flex-1">Fornecedor</div><div className="w-24">Itens</div><div className="w-32">Status</div>
          </div>
          {nfs.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhuma NF importada ainda.</div>}
          {nfs.map((n) => (
            <div key={n.id} className="flex px-4 py-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="w-28 font-mono">{n.numero}</div>
              <div className="flex-1">{n.fornecedor?.nome || "—"}</div>
              <div className="w-24" style={{ color: C.sub }}>{n._count?.itens ?? 0}</div>
              <div className="w-32"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.blue + "1A", color: C.blue }}>{n.status}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function Estoque({ money, master }) {
  return (
    <div>
      <Tabela cols={["Artigo", "Endereço", "Saldo", "Origem", ...(master ? ["Valor"] : [])]}
        rows={ESTOQUE.map((e) => [e.art, e.end, e.saldo, e.origem, ...(master ? [money(e.val)] : [])])} />
      {!master && <p className="text-xs mt-3" style={{ color: C.sub }}>Seu perfil vê metragem/peso/unidades. Valores são exclusivos do Financeiro.</p>}
    </div>
  );
}
function FME() {
  return (
    <div className="max-w-2xl">
      <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold mb-4">Nova FME · saída de material</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Campo label="Setor demandante" val="CORTE" />
          <Campo label="Responsável setor" val="—" />
        </div>
        <Tabela cols={["Artigo", "Retirado", "Devolvido", "Ajuste / Justificativa"]} rows={[["Malha PV — Tutti Frutti", "40 kg", "3 kg", "Sobra de encaixe"]]} />
        <button className="mt-4 px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff" }}>Registrar movimentação</button>
      </div>
    </div>
  );
}
/* ===== Artigos & Fornecedores (ligado ao banco) ===== */
function In({ label, ...p }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input {...p} className="w-full px-2 py-1.5 rounded outline-none"
        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
    </div>
  );
}
function Sel({ label, children, ...p }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <select {...p} className="w-full px-2 py-1.5 rounded outline-none"
        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>{children}</select>
    </div>
  );
}

function Artigos({ money, master }) {
  const [aba, setAba] = useState("artigos");
  const [fornecedores, setFornecedores] = useState([]);
  const [artigos, setArtigos] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    setLoading(true);
    try {
      const [f, a] = await Promise.all([
        fetch("/api/fornecedores").then((r) => r.json()),
        fetch("/api/artigos").then((r) => r.json()),
      ]);
      setFornecedores(Array.isArray(f) ? f : []);
      setArtigos(Array.isArray(a) ? a : []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  return (
    <div>
      <div className="flex gap-1 mb-5">
        {[["artigos", "Artigos"], ["fornecedores", "Fornecedores"]].map(([k, l]) => {
          const on = aba === k;
          return (
            <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm"
              style={{ background: on ? C.accentSoft : C.panel, color: on ? C.accent : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>{l}</button>
          );
        })}
      </div>
      {loading ? (
        <div style={{ color: C.sub }}>Carregando…</div>
      ) : aba === "artigos" ? (
        <ArtigosPane artigos={artigos} fornecedores={fornecedores} master={master} money={money} onSaved={carregar} />
      ) : (
        <FornecedoresPane fornecedores={fornecedores} onSaved={carregar} />
      )}
    </div>
  );
}

function FornecedoresPane({ fornecedores, onSaved }) {
  const [nome, setNome] = useState("");
  const [cnpjs, setCnpjs] = useState([{ cnpj: "", razaoSocial: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);
  const [sortF, setSortF] = useState({ key: "nome", dir: "asc" });
  const onSortF = (key) => setSortF((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const listaF = ordenar(
    fornecedores,
    sortF.key === "artigos" ? (f) => f._count?.artigos ?? 0 : (f) => f.nome,
    sortF.dir,
    sortF.key === "artigos" ? "num" : "texto"
  );

  const setC = (i, campo, v) => setCnpjs((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: v } : c)));

  const salvar = async () => {
    setErro("");
    if (!nome.trim()) return setErro("Informe o nome comercial.");
    setSalvando(true);
    const r = await fetch("/api/fornecedores", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, cnpjs }),
    });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    setNome(""); setCnpjs([{ cnpj: "", razaoSocial: "" }]); onSaved();
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="rounded-lg p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold mb-4">Novo fornecedor (nome comercial)</div>
        <div className="mb-3"><In label="Nome comercial" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Malharia SP" /></div>
        <div className="text-xs mb-2" style={{ color: C.sub }}>CNPJs (pode ter vários)</div>
        {cnpjs.map((c, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <In label={i === 0 ? "CNPJ" : ""} value={c.cnpj} onChange={(e) => setC(i, "cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            <In label={i === 0 ? "Razão social (opcional)" : ""} value={c.razaoSocial} onChange={(e) => setC(i, "razaoSocial", e.target.value)} />
          </div>
        ))}
        <button onClick={() => setCnpjs((cs) => [...cs, { cnpj: "", razaoSocial: "" }])} className="text-xs mb-4" style={{ color: C.accent }}>+ adicionar outro CNPJ</button>
        {erro && <div className="text-xs mb-3" style={{ color: "#D64545" }}>{erro}</div>}
        <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold w-full" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar fornecedor"}</button>
      </div>

      <div>
        <div className="text-xs mb-2" style={{ color: C.sub }}>{fornecedores.length} fornecedor(es) · clique na linha para editar, no título para ordenar</div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
            <ThSort label="Fornecedor (nome comercial)" campoKey="nome" sort={sortF} onSort={onSortF} className="flex-1" />
            <ThSort label="Artigos" campoKey="artigos" sort={sortF} onSort={onSortF} className="w-20 text-right" />
          </div>
          {listaF.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum fornecedor ainda.</div>}
          {listaF.map((f) => (
            <div key={f.id} onClick={() => setEditando(f)} className="px-4 py-3 cursor-pointer" style={{ borderBottom: `1px solid ${C.line}` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: f.nome ? C.text : C.accent }}>{f.nome || "⚠ definir nome comercial"}</span>
                <span className="text-xs w-20 text-right" style={{ color: C.sub }}>{f._count?.artigos ?? 0}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {f.cnpjs?.length ? f.cnpjs.map((c) => (
                  <span key={c.id} className="text-xs px-2 py-0.5 rounded" style={{ background: C.panel2, color: C.sub }}>{fmtCnpj(c.cnpj)}</span>
                )) : <span className="text-xs" style={{ color: C.sub }}>sem CNPJ</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editando && (
        <FornecedorEditModal fornecedor={editando}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); onSaved(); }} />
      )}
    </div>
  );
}

function fmtCnpj(v) {
  const d = (v || "").replace(/\D/g, "");
  if (d.length !== 14) return v;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function FornecedorEditModal({ fornecedor, onClose, onSaved }) {
  const [nome, setNome] = useState(fornecedor.nome || "");
  const [contato, setContato] = useState(fornecedor.contato || "");
  const [telefone, setTelefone] = useState(fornecedor.telefone || "");
  const [email, setEmail] = useState(fornecedor.email || "");
  const [cnpjs, setCnpjs] = useState(
    fornecedor.cnpjs?.length ? fornecedor.cnpjs.map((c) => ({ cnpj: fmtCnpj(c.cnpj), razaoSocial: c.razaoSocial || "" })) : [{ cnpj: "", razaoSocial: "" }]
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const setC = (i, campo, v) => setCnpjs((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: v } : c)));
  const removeC = (i) => setCnpjs((cs) => cs.filter((_, j) => j !== i));

  const salvar = async () => {
    setErro("");
    if (!nome.trim()) return setErro("Nome comercial é obrigatório.");
    setSalvando(true);
    const r = await fetch(`/api/fornecedores/${fornecedor.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, contato, telefone, email, cnpjs }),
    });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    onSaved();
  };

  const inativar = async () => {
    if (!confirm("Inativar este fornecedor? Ele deixa de aparecer na lista.")) return;
    await fetch(`/api/fornecedores/${fornecedor.id}`, { method: "DELETE" });
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="font-semibold">Editar fornecedor</div>
          <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
        </div>

        <div className="p-5">
          <div className="mb-3"><In label="Nome comercial (obrigatório)" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <In label="Contato" value={contato} onChange={(e) => setContato(e.target.value)} />
            <In label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            <In label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="text-xs mb-2" style={{ color: C.sub }}>CNPJs deste fornecedor (todos herdam o nome comercial acima)</div>
          {cnpjs.map((c, i) => (
            <div key={i} className="flex gap-2 mb-2 items-end">
              <div className="flex-1"><In label={i === 0 ? "CNPJ" : ""} value={c.cnpj} onChange={(e) => setC(i, "cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div className="flex-1"><In label={i === 0 ? "Razão social (opcional)" : ""} value={c.razaoSocial} onChange={(e) => setC(i, "razaoSocial", e.target.value)} /></div>
              <button onClick={() => removeC(i)} className="px-2 py-1.5 rounded" style={{ color: "#B42318", border: `1px solid ${C.line}` }} title="Remover">×</button>
            </div>
          ))}
          <button onClick={() => setCnpjs((cs) => [...cs, { cnpj: "", razaoSocial: "" }])} className="text-xs" style={{ color: C.accent }}>+ adicionar outro CNPJ</button>

          {erro && <div className="text-xs mt-3" style={{ color: "#D64545" }}>{erro}</div>}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={inativar} className="text-xs" style={{ color: "#B42318" }}>Inativar fornecedor</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CATS = [["MALHA", "Malha"], ["TECIDO", "Tecido"], ["AVIAMENTO", "Aviamento"]];

function fmtData(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR");
}
function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}
// ordena uma lista por campo (texto A→Z / número / data), asc ou desc
function ordenar(lista, campo, dir, tipo = "texto") {
  if (!campo) return lista;
  const arr = [...lista];
  arr.sort((a, b) => {
    let x = campo(a), y = campo(b);
    if (tipo === "num") { x = Number(x) || 0; y = Number(y) || 0; return x - y; }
    if (tipo === "data") { x = x ? new Date(x).getTime() : 0; y = y ? new Date(y).getTime() : 0; return x - y; }
    return String(x || "").localeCompare(String(y || ""), "pt-BR", { sensitivity: "base" });
  });
  return dir === "desc" ? arr.reverse() : arr;
}
function ThSort({ label, campoKey, sort, onSort, className, style }) {
  const on = sort.key === campoKey;
  return (
    <div className={className + " cursor-pointer select-none"} style={style} onClick={() => onSort(campoKey)}>
      {label}{on ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
    </div>
  );
}

function ArtigosPane({ artigos, fornecedores, master, money, onSaved }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sort, setSort] = useState({ key: "nome", dir: "asc" });
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const campos = {
    categoria: [(a) => a.categoria, "texto"],
    nome: [(a) => a.nome, "texto"],
    fornecedor: [(a) => a.fornecedor?.nome, "texto"],
    cor: [(a) => a.cor, "texto"],
    dataCompra: [(a) => a.dataCompra, "data"],
    preco: [(a) => a.valorUnitario, "num"],
  };
  const [fn, tipo] = campos[sort.key] || campos.nome;
  const lista = ordenar(artigos, fn, sort.dir, tipo);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: C.sub }}>{artigos.length} artigo(s) · clique numa linha para editar, no título para ordenar</div>
        <button onClick={() => setNovo((v) => !v)} className="px-3 py-1.5 rounded-md font-medium text-sm" style={{ background: novo ? C.panel : C.accent, color: novo ? C.sub : "#fff", border: `1px solid ${novo ? C.line : C.accent}` }}>{novo ? "Fechar" : "+ Novo artigo"}</button>
      </div>

      {novo && <ArtigoForm fornecedores={fornecedores} master={master} onSaved={() => { setNovo(false); onSaved(); }} />}

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
        <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <ThSort label="Categoria" campoKey="categoria" sort={sort} onSort={onSort} className="w-24" />
          <ThSort label="Artigo" campoKey="nome" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Fornecedor" campoKey="fornecedor" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Cor" campoKey="cor" sort={sort} onSort={onSort} className="w-24" />
          <div className="flex-1">Detalhe</div>
          <ThSort label="Data compra" campoKey="dataCompra" sort={sort} onSort={onSort} className="w-28" />
          {master && <ThSort label="Preço" campoKey="preco" sort={sort} onSort={onSort} className="w-28" />}
        </div>
        {lista.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum artigo ainda. Clique em “Novo artigo”.</div>}
        {lista.map((a) => (
          <div key={a.id} onClick={() => setEditando(a)} className="flex px-4 py-3 items-center cursor-pointer" style={{ borderBottom: `1px solid ${C.line}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="w-24"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{a.categoria}</span></div>
            <div className="flex-1 font-medium">{a.nome}</div>
            <div className="flex-1" style={{ color: a.fornecedor && !a.fornecedor.nome ? C.accent : C.sub }}>
              {a.fornecedor ? (a.fornecedor.nome || "⚠ definir nome") : "—"}
            </div>
            <div className="w-24" style={{ color: C.sub }}>{a.cor || "—"}</div>
            <div className="flex-1" style={{ color: C.sub }}>{detalheArtigo(a)}</div>
            <div className="w-28" style={{ color: C.sub }}>{fmtData(a.dataCompra)}</div>
            {master && <div className="w-28" style={{ color: C.accent }}>{a.valorUnitario ? money(Number(a.valorUnitario)) : "—"}</div>}
          </div>
        ))}
      </div>

      {editando && (
        <ArtigoEditModal artigo={editando} fornecedores={fornecedores} master={master}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); onSaved(); }} />
      )}
    </div>
  );
}

function ArtigoEditModal({ artigo, fornecedores, master, onClose, onSaved }) {
  const val = (v) => (v === null || v === undefined ? "" : String(v));
  const [f, setF] = useState({
    categoria: artigo.categoria || "MALHA",
    fornecedorId: artigo.fornecedorId ? String(artigo.fornecedorId) : "",
    nome: val(artigo.nome), cor: val(artigo.cor),
    tipoMalha: artigo.tipoMalha || "TUBULAR",
    composicao: val(artigo.composicao), largura: val(artigo.largura),
    rendimento: val(artigo.rendimento), gramatura: val(artigo.gramatura),
    especificacao: val(artigo.especificacao), unidade: artigo.unidade || "M",
    dataCompra: toDateInput(artigo.dataCompra),
    valorUnitario: val(artigo.valorUnitario),
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const salvar = async () => {
    setErro("");
    if (!f.nome.trim()) return setErro("Informe o nome do artigo.");
    setSalvando(true);
    const r = await fetch(`/api/artigos/${artigo.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
    });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    onSaved();
  };

  const inativar = async () => {
    if (!confirm("Inativar este artigo? Ele deixa de aparecer na lista.")) return;
    await fetch(`/api/artigos/${artigo.id}`, { method: "DELETE" });
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="font-semibold">Editar artigo</div>
          <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
        </div>

        <div className="p-5">
          <div className="text-xs mb-2" style={{ color: C.sub }}>Categoria</div>
          <div className="flex gap-2 mb-4">
            {CATS.map(([k, l]) => (
              <button key={k} onClick={() => set("categoria", k)} className="px-4 py-2 rounded-md text-sm"
                style={{ background: f.categoria === k ? C.accentSoft : C.panel2, color: f.categoria === k ? C.accent : C.sub, border: `1px solid ${f.categoria === k ? C.accent : C.line}` }}>{l}</button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <Sel label="Fornecedor" value={f.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
              <option value="">— selecione —</option>
              {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </Sel>
            <In label="Nome do artigo" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
            <In label="Cor" value={f.cor} onChange={(e) => set("cor", e.target.value)} />
          </div>

          {f.categoria === "MALHA" && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Sel label="Tipo" value={f.tipoMalha} onChange={(e) => set("tipoMalha", e.target.value)}>
                <option value="TUBULAR">Tubular</option><option value="RAMADA">Ramada</option>
              </Sel>
              <In label="Composição" value={f.composicao} onChange={(e) => set("composicao", e.target.value)} />
              <In label="Largura (m)" value={f.largura} onChange={(e) => set("largura", e.target.value)} inputMode="decimal" />
              <In label="Rendimento" value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} inputMode="decimal" />
            </div>
          )}
          {f.categoria === "TECIDO" && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <In label="Composição" value={f.composicao} onChange={(e) => set("composicao", e.target.value)} />
              <In label="Largura (m)" value={f.largura} onChange={(e) => set("largura", e.target.value)} inputMode="decimal" />
              <In label="Gramatura (g/m²)" value={f.gramatura} onChange={(e) => set("gramatura", e.target.value)} inputMode="decimal" />
            </div>
          )}
          {f.categoria === "AVIAMENTO" && (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <In label="Especificação" value={f.especificacao} onChange={(e) => set("especificacao", e.target.value)} />
              <Sel label="Unidade" value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
                {["UN","M","KG","PC","CM"].map((u) => <option key={u} value={u}>{u}</option>)}
              </Sel>
            </div>
          )}

          {master && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <In label="Data da compra" type="date" value={f.dataCompra} onChange={(e) => set("dataCompra", e.target.value)} />
              <In label="Preço (R$)" value={f.valorUnitario} onChange={(e) => set("valorUnitario", e.target.value)} inputMode="decimal" />
            </div>
          )}
          {!master && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <In label="Data da compra" type="date" value={f.dataCompra} onChange={(e) => set("dataCompra", e.target.value)} />
            </div>
          )}

          {erro && <div className="text-xs mb-3" style={{ color: "#D64545" }}>{erro}</div>}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={inativar} className="text-xs" style={{ color: "#B42318" }}>Inativar artigo</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function detalheArtigo(a) {
  if (a.categoria === "MALHA")
    return [a.tipoMalha, a.composicao, a.largura && `${a.largura} m`, a.rendimento && `rend. ${a.rendimento}`].filter(Boolean).join(" · ") || "—";
  if (a.categoria === "TECIDO")
    return [a.composicao, a.largura && `${a.largura} m`, a.gramatura && `${a.gramatura} g/m²`].filter(Boolean).join(" · ") || "—";
  return [a.especificacao, a.unidade].filter(Boolean).join(" · ") || "—";
}

function ArtigoForm({ fornecedores, master, onSaved }) {
  const [f, setF] = useState({ categoria: "MALHA", fornecedorId: "", nome: "", cor: "", tipoMalha: "TUBULAR", composicao: "", largura: "", rendimento: "", gramatura: "", especificacao: "", unidade: "UN", valorUnitario: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const salvar = async () => {
    setErro("");
    if (!f.nome.trim()) return setErro("Informe o nome do artigo.");
    setSalvando(true);
    const r = await fetch("/api/artigos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    onSaved();
  };

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: C.panel, border: `1px solid ${C.accent}66` }}>
      <div className="text-xs mb-2" style={{ color: C.sub }}>1. Categoria do artigo</div>
      <div className="flex gap-2 mb-4">
        {CATS.map(([k, l]) => (
          <button key={k} onClick={() => set("categoria", k)} className="px-4 py-2 rounded-md text-sm"
            style={{ background: f.categoria === k ? C.accentSoft : C.panel2, color: f.categoria === k ? C.accent : C.sub, border: `1px solid ${f.categoria === k ? C.accent : C.line}` }}>{l}</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Sel label="Fornecedor" value={f.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}>
          <option value="">— selecione —</option>
          {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </Sel>
        <In label="Nome do artigo" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Malha PV" />
        <In label="Cor" value={f.cor} onChange={(e) => set("cor", e.target.value)} placeholder="Ex.: Tutti Frutti" />
      </div>

      {f.categoria === "MALHA" && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Sel label="Tipo" value={f.tipoMalha} onChange={(e) => set("tipoMalha", e.target.value)}>
            <option value="TUBULAR">Tubular</option><option value="RAMADA">Ramada</option>
          </Sel>
          <In label="Composição" value={f.composicao} onChange={(e) => set("composicao", e.target.value)} placeholder="Ex.: 67% PES 33% Visc" />
          <In label="Largura (m)" value={f.largura} onChange={(e) => set("largura", e.target.value)} inputMode="decimal" />
          <In label="Rendimento" value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} inputMode="decimal" placeholder="pç/kg ou m/kg" />
        </div>
      )}
      {f.categoria === "TECIDO" && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <In label="Composição" value={f.composicao} onChange={(e) => set("composicao", e.target.value)} placeholder="Ex.: 100% Algodão" />
          <In label="Largura (m)" value={f.largura} onChange={(e) => set("largura", e.target.value)} inputMode="decimal" />
          <In label="Gramatura (g/m²)" value={f.gramatura} onChange={(e) => set("gramatura", e.target.value)} inputMode="decimal" />
        </div>
      )}
      {f.categoria === "AVIAMENTO" && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <In label="Especificação" value={f.especificacao} onChange={(e) => set("especificacao", e.target.value)} placeholder="Ex.: Zíper 6mm nº 5" />
          <Sel label="Unidade" value={f.unidade} onChange={(e) => set("unidade", e.target.value)}>
            {["UN","M","KG","PC","CM"].map((u) => <option key={u} value={u}>{u}</option>)}
          </Sel>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        {master && <In label="Preço (R$)" value={f.valorUnitario} onChange={(e) => set("valorUnitario", e.target.value)} inputMode="decimal" />}
      </div>

      {erro && <div className="text-xs mb-3" style={{ color: "#D64545" }}>{erro}</div>}
      <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar artigo"}</button>
    </div>
  );
}
function Usuarios() {
  const us = [
    { n: "Igor", s: "FINANCEIRO (master)", a: true },
    { n: "Maycon", s: "PCP", a: true },
    { n: "Ana", s: "COMPRAS", a: true },
    { n: "Diego", s: "ESTOQUE", a: false },
  ];
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden max-w-2xl">
      {us.map((u) => (
        <div key={u.n} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div><span className="font-medium">{u.n}</span> <span className="text-xs ml-2" style={{ color: C.sub }}>{u.s}</span></div>
          <button className="text-xs px-3 py-1 rounded font-medium" style={{ background: u.a ? C.greenSoft : C.accentSoft, color: u.a ? C.green : C.accent }}>{u.a ? "Ativo" : "Bloqueado"}</button>
        </div>
      ))}
    </div>
  );
}

function Tabela({ cols, rows }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
      <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
        {cols.map((c) => <div key={c} className="flex-1">{c}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          {r.map((cell, j) => <div key={j} className="flex-1" style={{ color: j === 0 ? C.text : C.sub }}>{cell}</div>)}
        </div>
      ))}
    </div>
  );
}
function Campo({ label, val }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <div className="px-2 py-1.5 rounded" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>{val}</div>
    </div>
  );
}
