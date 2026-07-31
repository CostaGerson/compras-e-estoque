"use client";
import React, { useState } from "react";
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
  sidebar: "#111725", sidebarLine: "#1E2636", sidebarSub: "#9AA4B2",
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
  const [view, setView] = useState("pedidos");
  const [tab, setTab] = useState("lista");
  const master = perfil === "FINANCEIRO";
  const [showVal, setShowVal] = useState(true);

  if (!logged) return <Login onEnter={() => setLogged(true)} />;
  const nav = NAV.filter((n) => n.perfis.includes(perfil));
  const money = (v) => (master && showVal ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "•••••");

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }} className="flex text-sm">
      <aside style={{ background: C.sidebar }} className="w-60 shrink-0 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.sidebarLine}` }}>
          <Mountain size={22} color={C.accent} />
          <span className="font-bold tracking-wide text-white">MERIDIAN</span>
        </div>
        <nav className="flex-1 py-2">
          {nav.map((n) => {
            const Ico = n.icon; const on = view === n.key;
            return (
              <button key={n.key} onClick={() => { setView(n.key); setTab("lista"); }}
                className="w-full flex items-center gap-3 px-4 py-2 transition-colors"
                style={{ background: on ? "#1E2636" : "transparent", color: on ? C.accent : C.sidebarSub,
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
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }} className="flex items-center justify-center">
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }} className="w-80 rounded-xl p-8">
        <div className="flex items-center gap-2 justify-center mb-1">
          <Mountain size={30} color={C.accent} />
          <span className="text-2xl font-bold tracking-wide" style={{ color: C.text }}>MERIDIAN</span>
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
  return (
    <div className="max-w-3xl">
      <p className="text-sm mb-4" style={{ color: C.sub }}>Entrada virtual da NF (PDF/XML) e estratificação de cada item para os PICs.</p>
      <div className="rounded-lg p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-semibold">NF 12.334 · Malharia SP</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: C.yellow + "1A", color: C.yellow }}>Aguardando estratificação</span>
        </div>
        <Tabela cols={["Item da NF", "Qtd", "Direcionar para PIC/PV"]} rows={[["Malha PV Tutti Frutti", "420 kg", "→ PV 26070040 (310) · sobra estoque (110)"]]} />
      </div>
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
function Artigos({ money, master }) {
  return (
    <Tabela cols={["Fabricante", "Artigo", "Cor", "Tecido", "Largura", ...(master ? ["Valor un."] : [])]}
      rows={ARTIGOS.map((a) => [a.fab, a.nome, a.cor, a.tec || "—", a.larg ? a.larg + " m" : "—", ...(master ? [money(a.valor)] : [])])} />
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
