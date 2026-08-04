"use client";
import React, { useState, useEffect } from "react";
import {
  LayoutList, Trello, LayoutDashboard, CalendarDays, Package, ShoppingCart,
  FileText, ClipboardList, Boxes, ArrowLeftRight, Users2, Plus, Database, Trash2, Printer,
  ChevronRight, ChevronLeft, Eye, EyeOff, Mountain, CheckCircle2, Workflow, Camera, Pencil, X,
  Bell, Inbox, LogOut, Send, AlertTriangle,
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
  CAMISA: ["MODELAGEM","TECIDO","GOLA DA CAMISA","PE DE GOLA","MANGA DA CAMISA","FECHAMENTO DA CAMISA","FRENTE DA CAMISA","COSTAS DA CAMISA","BARRA DA CAMISA","PUNHO DA CAMISA","RECORTE DA CAMISA","BOLSO DA CAMISA","EXTRA DA CAMISA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  POLO: ["MODELAGEM","TECIDO","GOLA DA POLO","FECHAMENTO DA POLO","MANGA DA POLO","FRENTE DA POLO","COSTAS DA POLO","BARRA DA POLO","RECORTE DA POLO","BOLSO DA POLO","EXTRA DA POLO","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  JAQUETA: ["MODELAGEM","TECIDO","GOLA","MANGA","FECHAMENTO","COSTAS","BARRA","PUNHO","RECORTE","BOLSO","FORRO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  CALÇA: ["MODELAGEM","TECIDO","FECHAMENTO DA CALÇA","COS DA CALÇA","BOLSO DIANTEIRO","BOLSO TRASEIRO","REFORÇO","EXTRA","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
  JALECO: ["MOLDE","TECIDO","GOLA DO JALECO","FECHAMENTO DO JALECO","MANGA DO JALECO","BOLSO DO JALECO","EXTRA DO JALECO","PERSONALIZAÇÃO","PERÍODO PERSONALIZAÇÃO","PERÍODO FACÇÃO","VALOR TERCEIRIZADO"],
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
  { key: "banco", label: "Banco de dados", icon: Database, perfis: ["FINANCEIRO","PCP","COMPRAS"] },
  { key: "usuarios", label: "Usuários", icon: Users2, perfis: ["FINANCEIRO"] },
];

// sessão do usuário logado (guardada no navegador)
function lerSessao() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("ce_user") || "null"); } catch { return null; }
}
function sessaoId() { return lerSessao()?.id || null; }

export default function Home() {
  const [user, setUser] = useState(null);
  const [carregouSessao, setCarregouSessao] = useState(false);
  const [view, setView] = useState("inicio");
  const [tab, setTab] = useState("lista");
  const [showVal, setShowVal] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [badgeTick, setBadgeTick] = useState(0);
  const bumpBadges = () => setBadgeTick((x) => x + 1);

  useEffect(() => { setUser(lerSessao()); setCarregouSessao(true); }, []);

  const entrar = (u) => { localStorage.setItem("ce_user", JSON.stringify(u)); setUser(u); setView("inicio"); };
  const sair = () => { localStorage.removeItem("ce_user"); setUser(null); };
  const atualizarUser = (u) => { localStorage.setItem("ce_user", JSON.stringify(u)); setUser(u); };

  if (!carregouSessao) return null;
  if (!user) return <Login onEntrar={entrar} />;

  const master = !!(user.isMaster || user.setor === "FINANCEIRO");
  const perfil = master ? "FINANCEIRO" : user.setor;
  const nav = NAV.filter((n) => n.perfis.includes(perfil) || (perfil === "ADMINISTRATIVO" && n.key !== "usuarios"));
  const money = (v) => (master && showVal ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "•••••");

  return (
    <div style={{ background: C.bg, color: C.text, height: "100vh", overflow: "hidden", fontFamily: "Montserrat, system-ui, sans-serif" }} className="flex text-sm">
      <div className="shrink-0 h-full transition-all duration-300 ease-in-out overflow-hidden" style={{ width: collapsed ? 0 : 240 }}>
      <aside style={{ background: C.sidebar, width: 240 }} className="h-full flex flex-col">
        <div className="flex items-center shrink-0" style={{ borderBottom: `1px solid ${C.sidebarLine}` }}>
          <button onClick={() => setView("inicio")} className="px-4 py-4 flex items-center flex-1" style={{ background: C.sidebar }}>
            <img src="/meridian-logo.png" alt="MERIDIAN" style={{ height: 30, width: "auto" }} />
          </button>
          <button onClick={() => setCollapsed(true)} title="Recolher menu"
            className="px-3 py-4 flex items-center justify-center" style={{ color: C.sidebarSub }}>
            <ChevronLeft size={20} />
          </button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
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
        <div className="px-4 py-3 text-xs shrink-0" style={{ borderTop: `1px solid ${C.sidebarLine}`, color: C.sidebarSub }}>
          Sistema de Gestão · v1
        </div>
      </aside>
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-6 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel }}>
          <div className="flex items-center gap-2">
            {collapsed && (
              <button onClick={() => setCollapsed(false)} title="Expandir menu"
                className="flex items-center justify-center rounded p-1" style={{ background: C.sidebar, color: "#fff" }}>
                <ChevronRight size={18} />
              </button>
            )}
            <div className="font-semibold">{NAV.find((n) => n.key === view)?.label || (view === "notificacoes" ? "Notificações" : view === "mensagens" ? "Mensagens" : "")}</div>
          </div>
          <div className="flex items-center gap-3">
            {master && (
              <button onClick={() => setShowVal((s) => !s)} className="flex items-center gap-1 px-2 py-1 rounded"
                style={{ background: C.panel2, color: C.sub }}>
                {showVal ? <Eye size={15} /> : <EyeOff size={15} />} valores
              </button>
            )}
            <TopoUsuario user={user} perfil={perfil} badgeTick={badgeTick}
              onAbrirPerfil={() => setPerfilAberto(true)} onSair={sair}
              onIrNotificacoes={() => setView("notificacoes")} onIrMensagens={() => setView("mensagens")} />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {view === "inicio" && <Inicio money={money} master={master} />}
          {view === "pedidos" && <Pedidos tab={tab} setTab={setTab} money={money} />}
          {view === "producao" && <Producao />}
          {view === "pp" && <LancarPP />}
          {view === "pic" && <PIC />}
          {view === "oc" && <OC money={money} />}
          {view === "nf" && <NF master={master} money={money} perfil={perfil} />}
          {view === "estoque" && <Estoque money={money} master={master} />}
          {view === "fme" && <FME user={user} perfil={perfil} />}
          {view === "artigos" && <Artigos money={money} master={master} />}
          {view === "banco" && <BancoDados master={master} money={money} perfil={perfil} />}
          {view === "usuarios" && <Usuarios master={master} />}
          {view === "notificacoes" && <Notificacoes user={user} perfil={perfil} onIrEstoque={() => setView("estoque")} onMudou={bumpBadges} />}
          {view === "mensagens" && <Mensagens user={user} onMudou={bumpBadges} />}
        </div>
      </main>
      {perfilAberto && (
        <UsuarioModal usuario={user} self onClose={() => setPerfilAberto(false)}
          onSavedUser={(u) => { atualizarUser(u); setPerfilAberto(false); }} />
      )}
    </div>
  );
}

function Login({ onEntrar }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    setErro("");
    if (!login.trim() || !senha) return setErro("Informe usuário e senha.");
    setEntrando(true);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, senha }) });
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Não foi possível entrar."); setEntrando(false); return; }
      onEntrar(d);
    } catch { setErro("Falha de conexão."); setEntrando(false); }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "Montserrat, system-ui, sans-serif" }} className="flex items-center justify-center">
      <form onSubmit={submit} style={{ background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }} className="w-80 rounded-xl p-8">
        <div className="rounded-lg mb-4 flex items-center justify-center py-3" style={{ background: "#001E41" }}>
          <img src="/meridian-logo.png" alt="MERIDIAN" style={{ height: 34, width: "auto" }} />
        </div>
        <p className="text-center text-xs mb-6" style={{ color: C.sub }}>Gestão de Material &amp; Financeiro</p>
        <label className="text-xs" style={{ color: C.sub }}>Usuário</label>
        <input value={login} onChange={(e) => setLogin(e.target.value)} autoFocus className="w-full mb-3 mt-1 px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        <label className="text-xs" style={{ color: C.sub }}>Senha</label>
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="w-full mt-1 px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        {erro && <div className="text-xs mt-3" style={{ color: "#D64545" }}>{erro}</div>}
        <button type="submit" disabled={entrando} className="w-full mt-5 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: entrando ? 0.6 : 1 }}>{entrando ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

/* ===== Topo: sino de alertas + caixa de mensagens + avatar ===== */
function Badge({ n }) {
  if (!n) return null;
  return (
    <span style={{ position: "absolute", top: -5, right: -5, minWidth: 17, height: 17, padding: "0 4px", borderRadius: 9, background: "#E5484D", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{n > 99 ? "99+" : n}</span>
  );
}

function TopoUsuario({ user, perfil, badgeTick, onAbrirPerfil, onSair, onIrNotificacoes, onIrMensagens }) {
  const [naoVistos, setNaoVistos] = useState(0);
  const [naoLidas, setNaoLidas] = useState(0);
  const nomeCompleto = `${user.nome} ${user.sobrenome || ""}`.trim();

  const carregar = async () => {
    try {
      const a = await fetch(`/api/alertas?usuarioId=${user.id}&setor=${encodeURIComponent(perfil)}`).then((r) => r.json());
      setNaoVistos(a?.naoVistos || 0);
    } catch {}
    try {
      const m = await fetch(`/api/mensagens?usuarioId=${user.id}`).then((r) => r.json());
      setNaoLidas(m?.naoLidas || 0);
    } catch {}
  };
  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 45000);
    return () => clearInterval(t);
  }, [user.id, perfil, badgeTick]);

  return (
    <div className="flex items-center gap-4">
      <button onClick={onIrNotificacoes} title="Notificações" style={{ position: "relative", color: naoVistos ? "#E5484D" : C.sub }}>
        <Bell size={20} /><Badge n={naoVistos} />
      </button>
      <button onClick={onIrMensagens} title="Mensagens" style={{ position: "relative", color: naoLidas ? C.accent : C.sub }}>
        <Inbox size={20} /><Badge n={naoLidas} />
      </button>
      <button onClick={onAbrirPerfil} title="Meu perfil" className="flex items-center gap-2">
        <Avatar foto={user.fotoBase64} nome={nomeCompleto} size={34} />
        <div className="text-left leading-tight hidden md:block">
          <div className="text-sm font-medium" style={{ color: C.text }}>{user.nome}</div>
          <div className="text-xs" style={{ color: C.sub }}>{user.setor}{user.isMaster ? " · master" : ""}</div>
        </div>
      </button>
      <button onClick={onSair} title="Sair" style={{ color: C.sub }}><LogOut size={18} /></button>
    </div>
  );
}

const quandoData = (d) => { try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

/* ===== Notificações (tela cheia) ===== */
function Notificacoes({ user, perfil, onIrEstoque, onMudou }) {
  const [dados, setDados] = useState({ pendentes: [], resolvidas: [], naoVistos: 0 });
  const [aba, setAba] = useState("pendentes");
  const [aberta, setAberta] = useState(null); // id expandido
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const d = await fetch(`/api/alertas?usuarioId=${user.id}&setor=${encodeURIComponent(perfil)}`).then((r) => r.json());
      setDados(d && d.pendentes ? d : { pendentes: [], resolvidas: [], naoVistos: 0 });
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const acao = async (body) => {
    await fetch("/api/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await carregar(); onMudou && onMudou();
  };
  const abrir = (a) => {
    const novo = aberta === a.id ? null : a.id;
    setAberta(novo);
    if (novo && !a.visto) acao({ acao: "visto", id: a.id });
  };
  const vistarTudo = () => acao({ acao: "vistoTudo", usuarioId: user.id, setor: perfil });

  const lista = aba === "pendentes" ? dados.pendentes : dados.resolvidas;
  if (loading) return <div style={{ color: C.sub }}>Carregando…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {[["pendentes", `Pendentes (${dados.pendentes.length})`], ["resolvidas", `Resolvidas (${dados.resolvidas.length})`]].map(([k, l]) => {
            const on = aba === k;
            return <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: on ? C.accent : C.panel, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>{l}</button>;
          })}
        </div>
        {aba === "pendentes" && dados.naoVistos > 0 && (
          <button onClick={vistarTudo} className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}><CheckCircle2 size={15} /> Vistar tudo</button>
        )}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
        {lista.length === 0 && <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>{aba === "pendentes" ? "Nenhuma notificação pendente. Tudo cadastrado ✓" : "Nenhuma notificação resolvida."}</div>}
        {lista.map((a) => (
          <div key={a.id} style={{ borderBottom: `1px solid ${C.line}`, background: aba === "pendentes" && !a.visto ? C.accentSoft : "transparent" }}>
            <button onClick={() => abrir(a)} className="w-full text-left px-4 py-3 flex items-start gap-2">
              <AlertTriangle size={16} style={{ color: aba === "resolvidas" ? C.sub : "#E5484D", marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div className="text-sm font-medium" style={{ color: C.text }}>{a.nome} {a.nfNumero ? <span style={{ color: C.sub }}>· NF {a.nfNumero}</span> : ""} {aba === "pendentes" && !a.visto && <span className="text-xs ml-1" style={{ color: "#E5484D" }}>• novo</span>}</div>
                <div className="text-xs mt-0.5" style={{ color: C.sub }}>{a.categoria} · falta {a.faltando.length} campo(s)</div>
              </div>
            </button>
            {aberta === a.id && (
              <div className="px-4 pb-3" style={{ marginLeft: 26 }}>
                <div className="text-xs mb-2" style={{ color: C.sub }}>Campos faltando: <b style={{ color: C.text }}>{a.faltando.join(", ")}</b></div>
                <div className="flex gap-2">
                  <button onClick={onIrEstoque} className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: C.accent, color: "#fff" }}>Completar no estoque</button>
                  {aba === "pendentes"
                    ? <button onClick={() => acao({ acao: "resolvido", id: a.id })} className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1" style={{ background: C.greenSoft, color: C.green, border: `1px solid ${C.green}` }}><CheckCircle2 size={15} /> Marcar resolvido</button>
                    : <button onClick={() => acao({ acao: "reabrir", id: a.id })} className="px-3 py-1.5 rounded text-sm font-medium" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Reabrir</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Mensagens (tela cheia) ===== */
function Mensagens({ user, onMudou }) {
  const [dados, setDados] = useState({ recebidas: [], arquivadas: [], enviadas: [], naoLidas: 0 });
  const [aba, setAba] = useState("recebidas");
  const [usuarios, setUsuarios] = useState([]);
  const [comp, setComp] = useState({ paraId: "", texto: "" });
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const m = await fetch(`/api/mensagens?usuarioId=${user.id}`).then((r) => r.json());
      setDados(m && m.recebidas ? m : { recebidas: [], arquivadas: [], enviadas: [], naoLidas: 0 });
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    carregar();
    fetch("/api/usuarios/lista").then((r) => r.json()).then((u) => setUsuarios(Array.isArray(u) ? u.filter((x) => x.id !== user.id) : [])).catch(() => {});
  }, []);

  // ao abrir a aba Recebidas, marca todas como lidas
  useEffect(() => {
    if (aba === "recebidas" && dados.naoLidas > 0) {
      fetch("/api/mensagens/ler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id }) })
        .then(() => { carregar(); onMudou && onMudou(); });
    }
  }, [aba, dados.naoLidas]);

  const patch = async (id, body) => {
    await fetch(`/api/mensagens/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await carregar(); onMudou && onMudou();
  };
  const enviar = async () => {
    if (!comp.paraId || !comp.texto.trim()) return;
    setEnviando(true);
    await fetch("/api/mensagens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deId: user.id, paraId: Number(comp.paraId), texto: comp.texto }) });
    setEnviando(false); setComp({ paraId: "", texto: "" }); setAba("enviadas"); carregar();
  };
  const responder = (m) => { setComp({ paraId: String(m.de?.id || ""), texto: "" }); setAba("nova"); };

  if (loading) return <div style={{ color: C.sub }}>Carregando…</div>;

  const abas = [
    ["recebidas", `Recebidas${dados.naoLidas ? ` (${dados.naoLidas})` : ""}`],
    ["arquivadas", `Arquivadas (${dados.arquivadas.length})`],
    ["enviadas", "Enviadas"],
    ["nova", "Nova mensagem"],
  ];

  const CartaoRecebida = (m, arquivada) => (
    <div key={m.id} className="px-4 py-3 flex gap-3" style={{ borderBottom: `1px solid ${C.line}`, background: !m.lida && !arquivada ? C.accentSoft : "transparent" }}>
      <Avatar foto={m.de?.fotoBase64} nome={`${m.de?.nome || "?"} ${m.de?.sobrenome || ""}`} size={38} />
      <div style={{ flex: 1 }}>
        <div className="text-xs" style={{ color: C.sub }}>{m.de?.nome} {m.de?.sobrenome} · {m.de?.setor} · {quandoData(m.createdAt)}</div>
        <div className="text-sm mt-0.5" style={{ color: C.text }}>{m.texto}</div>
        <div className="flex gap-3 mt-2">
          <button onClick={() => responder(m)} className="text-xs font-medium" style={{ color: C.accent }}>Responder</button>
          {arquivada
            ? <button onClick={() => patch(m.id, { arquivada: false })} className="text-xs" style={{ color: C.sub }}>Desarquivar</button>
            : <button onClick={() => patch(m.id, { arquivada: true })} className="text-xs" style={{ color: C.sub }}>Arquivar</button>}
          {!m.lida && !arquivada && <button onClick={() => patch(m.id, { lida: true })} className="text-xs" style={{ color: C.sub }}>Marcar lida</button>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="flex gap-1 mb-4 flex-wrap">
        {abas.map(([k, l]) => {
          const on = aba === k;
          return <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: on ? C.accent : C.panel, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>{l}</button>;
        })}
      </div>

      {aba === "nova" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg p-4 mb-4">
          <div className="text-sm font-semibold mb-3">Nova mensagem</div>
          <select value={comp.paraId} onChange={(e) => setComp((s) => ({ ...s, paraId: e.target.value }))} className="w-full mb-3 px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option value="">Para quem…</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome} {u.sobrenome} · {u.setor}</option>)}
          </select>
          <textarea value={comp.texto} onChange={(e) => setComp((s) => ({ ...s, texto: e.target.value }))} rows={4} placeholder="Escreva a mensagem…" className="w-full px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, resize: "vertical" }} />
          <button onClick={enviar} disabled={enviando || !comp.paraId || !comp.texto.trim()} className="mt-3 px-4 py-2 rounded font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff", opacity: enviando || !comp.paraId || !comp.texto.trim() ? 0.5 : 1 }}><Send size={15} /> Enviar</button>
        </div>
      )}

      {aba !== "nova" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
          {aba === "recebidas" && (dados.recebidas.length === 0
            ? <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>Nenhuma mensagem recebida.</div>
            : dados.recebidas.map((m) => CartaoRecebida(m, false)))}
          {aba === "arquivadas" && (dados.arquivadas.length === 0
            ? <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>Nenhuma mensagem arquivada.</div>
            : dados.arquivadas.map((m) => CartaoRecebida(m, true)))}
          {aba === "enviadas" && (dados.enviadas.length === 0
            ? <div className="px-4 py-8 text-sm text-center" style={{ color: C.sub }}>Nenhuma mensagem enviada.</div>
            : dados.enviadas.map((m) => (
              <div key={m.id} className="px-4 py-3 flex gap-3" style={{ borderBottom: `1px solid ${C.line}` }}>
                <Avatar foto={m.para?.fotoBase64} nome={`${m.para?.nome || "?"} ${m.para?.sobrenome || ""}`} size={38} />
                <div style={{ flex: 1 }}>
                  <div className="text-xs" style={{ color: C.sub }}>Para {m.para?.nome} {m.para?.sobrenome} · {quandoData(m.createdAt)} {m.lida ? "· lida" : "· não lida"}</div>
                  <div className="text-sm mt-0.5" style={{ color: C.text }}>{m.texto}</div>
                </div>
              </div>
            )))}
        </div>
      )}
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

const TAMANHOS = ["PP","P","M","G","GG","XG","XGG","XXGG","XXXGG"];
const COND_PGTO = [
  "30% antecipado 30% entrega e 40% 30d",
  "50% antecipado e 50% entrega",
  "100% entrega",
  "prazo 30 dias",
  "prazo 30/60",
  "prazo 30/45/60",
  "prazo 30/60/90",
  "prazo 30/60/90/120",
  "prazo 30/60/90/120/150",
  "prazo 120",
];
const ppMoney = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Autocomplete({ value, onChange, onPick, buscar, render, placeholder, inputStyle }) {
  const [aberto, setAberto] = useState(false);
  const [opcoes, setOpcoes] = useState([]);
  const timer = React.useRef(null);
  const onType = (v) => {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v || v.length < 2) { setOpcoes([]); setAberto(false); return; }
    timer.current = setTimeout(async () => { const r = await buscar(v); setOpcoes(r.slice(0, 8)); setAberto(r.length > 0); }, 150);
  };
  return (
    <div style={{ position: "relative" }}>
      <input value={value} placeholder={placeholder} onChange={(e) => onType(e.target.value)}
        onFocus={() => value && value.length >= 2 && opcoes.length && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inputStyle || { background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
      {aberto && (
        <div style={{ position: "absolute", zIndex: 30, top: "100%", left: 0, right: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 240, overflowY: "auto" }}>
          {opcoes.map((o, i) => (
            <button key={i} onMouseDown={(e) => { e.preventDefault(); onPick(o); setAberto(false); }}
              className="w-full text-left px-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {render(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LancarPP() {
  const [lista, setLista] = useState([]);
  const [modo, setModo] = useState("lista"); // lista | editor
  const [ppId, setPpId] = useState(null);

  const carregar = async () => {
    try { const d = await fetch("/api/pp").then((r) => r.json()); setLista(Array.isArray(d) ? d : []); } catch {}
  };
  useEffect(() => { carregar(); }, []);

  if (modo === "editor") return <PpEditor ppId={ppId} onVoltar={() => { setModo("lista"); setPpId(null); carregar(); }} />;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm" style={{ color: C.sub }}>{lista.length} PP(s) lançado(s)</div>
        <button onClick={() => { setPpId(null); setModo("editor"); }} className="px-4 py-2 rounded font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={16} /> Novo PP
        </button>
      </div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
        <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="w-28">PP nº</div>
          <div className="flex-1">Cliente</div>
          <div className="w-24">OC</div>
          <div className="w-20 text-right">Itens</div>
          <div className="w-32 text-right">Valor</div>
          <div className="w-28"></div>
        </div>
        {lista.length === 0 ? (
          <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum PP ainda. Clique em "Novo PP".</div>
        ) : lista.map((p) => (
          <div key={p.id} className="flex px-4 py-3 items-center text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="w-28 font-medium">{p.numero || `#${p.id}`}</div>
            <div className="flex-1">{p.clienteNome || "—"}</div>
            <div className="w-24" style={{ color: C.sub }}>{p.oc || "—"}</div>
            <div className="w-20 text-right" style={{ color: C.sub }}>{p._count?.itens ?? 0}</div>
            <div className="w-32 text-right" style={{ color: C.accent, fontWeight: 600 }}>{p.valorTotal != null ? ppMoney(p.valorTotal) : "—"}</div>
            <div className="w-28 flex justify-end gap-2">
              <button onClick={() => { setPpId(p.id); setModo("editor"); }} className="text-xs px-2 py-1 rounded" style={{ color: C.accent, border: `1px solid ${C.accent}` }}>Abrir</button>
              <button onClick={async () => { if (confirm("Excluir este PP?")) { await fetch(`/api/pp/${p.id}`, { method: "DELETE" }); carregar(); } }} style={{ color: "#C77" }}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function novoItem() {
  return { tipoPecaNome: "POLO", codigo: "", descricao: "", valorUnitario: "", grade: TAMANHOS.map((t) => ({ tam: t, qtd: "" })), parametros: {}, fotoBase64: "" };
}

function PpEditor({ ppId, onVoltar }) {
  const [f, setF] = useState({
    numero: "", clienteNome: "", clienteCnpj: "", clienteIe: "", clienteEndereco: "", clienteContato: "",
    oc: "", condicaoPagamento: "", prazoEntrega: "", dtDespacho: "", tipoPedido: "", vendedor: "", obs: "",
    arquivoPcPdf: "", arquivoLancPdf: "", arquivoPedidoPdf: "",
  });
  const [itens, setItens] = useState([novoItem()]);
  const [salvando, setSalvando] = useState(false);
  const [carregado, setCarregado] = useState(!ppId);
  const [clientes, setClientes] = useState([]);
  const [artigos, setArtigos] = useState([]);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    fetch("/api/clientes").then((r) => r.json()).then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/artigos").then((r) => r.json()).then((d) => setArtigos(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const buscarCliente = async (q) => {
    const n = norm(q);
    return clientes.filter((c) => norm([c.razaoSocial, c.nomeFantasia, c.cnpj].filter(Boolean).join(" ")).includes(n));
  };
  const buscarArtigo = async (q) => {
    const n = norm(q);
    return artigos.filter((a) => norm([a.nome, a.artigoInterno, a.codigo, a.cor].filter(Boolean).join(" ")).includes(n));
  };
  const pickCliente = (c) => setF((s) => ({
    ...s,
    clienteNome: c.razaoSocial || c.nomeFantasia || "",
    clienteCnpj: fmtCnpj(c.cnpj),
    clienteIe: c.inscricaoEstadual || "",
    clienteEndereco: [c.logradouro, c.numero, c.bairro, c.municipio && `${c.municipio}${c.uf ? "/" + c.uf : ""}`, c.cep].filter(Boolean).join(", "),
    clienteContato: c.preposto || c.telefones || "",
  }));

  useEffect(() => {
    if (!ppId) return;
    fetch(`/api/pp/${ppId}`).then((r) => r.json()).then((d) => {
      setF({
        numero: d.numero || "", clienteNome: d.clienteNome || "", clienteCnpj: d.clienteCnpj || "", clienteIe: d.clienteIe || "",
        clienteEndereco: d.clienteEndereco || "", clienteContato: d.clienteContato || "", oc: d.oc || "",
        condicaoPagamento: d.condicaoPagamento || "", prazoEntrega: d.prazoEntrega || "", dtDespacho: d.dtDespacho || "",
        tipoPedido: d.tipoPedido || "", vendedor: d.vendedor || "", obs: d.obs || "",
        arquivoPcPdf: d.arquivoPcPdf || "", arquivoLancPdf: d.arquivoLancPdf || "", arquivoPedidoPdf: d.arquivoPedidoPdf || "",
      });
      setItens((d.itens || []).map((it) => ({
        tipoPecaNome: it.tipoPecaNome || "POLO", codigo: it.codigo || "", descricao: it.descricao || "",
        valorUnitario: it.valorUnitario != null ? String(it.valorUnitario).replace(".", ",") : "",
        grade: it.gradeJson ? JSON.parse(it.gradeJson) : TAMANHOS.map((t) => ({ tam: t, qtd: "" })),
        parametros: it.parametrosJson ? JSON.parse(it.parametrosJson) : {},
        fotoBase64: it.fotoBase64 || "",
      })));
      setCarregado(true);
    });
  }, [ppId]);

  const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });

  const aoAnexar = async (campo, file) => {
    const b64 = await readB64(file);
    set(campo, b64);
    if (campo === "arquivoPedidoPdf" || campo === "arquivoLancPdf") {
      const body = campo === "arquivoPedidoPdf" ? { pedidoBase64: b64 } : { lancBase64: b64 };
      try {
        const d = await fetch("/api/pp/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
        setF((s) => {
          const n = { ...s };
          for (const k of ["numero", "clienteNome", "clienteCnpj", "clienteIe", "clienteEndereco", "oc", "prazoEntrega", "dtDespacho", "tipoPedido", "vendedor"]) if (d[k]) n[k] = d[k];
          if (d.condicaoPagamento) { const achou = COND_PGTO.find((c) => c.toLowerCase() === String(d.condicaoPagamento).toLowerCase()); n.condicaoPagamento = achou || d.condicaoPagamento; }
          return n;
        });
        if (Array.isArray(d.itens) && d.itens.length) {
          setItens(d.itens.map((it) => ({
            tipoPecaNome: it.tipoPecaNome || "POLO", codigo: it.codigo || "", descricao: it.descricao || "",
            valorUnitario: it.valorUnitario || "",
            grade: Array.isArray(it.grade) && it.grade.length ? it.grade : TAMANHOS.map((t) => ({ tam: t, qtd: "" })),
            parametros: it.parametros || {}, fotoBase64: "",
          })));
        }
      } catch {}
    }
  };

  const somaItem = (it) => it.grade.reduce((s, g) => s + (parseFloat(String(g.qtd).replace(",", ".")) || 0), 0);
  const totalItem = (it) => somaItem(it) * (parseFloat(String(it.valorUnitario).replace(",", ".")) || 0);
  const totalGeral = itens.reduce((s, it) => s + totalItem(it), 0);
  const totalPecas = itens.reduce((s, it) => s + somaItem(it), 0);

  const upItem = (i, patch) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const upGrade = (i, gi, qtd) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, grade: it.grade.map((g, k) => (k === gi ? { ...g, qtd } : g)) } : it)));
  const upParam = (i, nome, val) => setItens((arr) => arr.map((it, j) => (j === i ? { ...it, parametros: { ...it.parametros, [nome]: val } } : it)));

  const salvar = async (imprimirDepois) => {
    setSalvando(true);
    const payload = {
      ...f, valorTotal: totalGeral,
      itens: itens.map((it) => ({
        tipoPecaNome: it.tipoPecaNome, codigo: it.codigo, descricao: it.descricao,
        quantidade: somaItem(it), valorUnitario: it.valorUnitario, valorTotal: totalItem(it),
        gradeJson: JSON.stringify(it.grade), parametrosJson: JSON.stringify(it.parametros), fotoBase64: it.fotoBase64,
      })),
    };
    const url = ppId ? `/api/pp/${ppId}` : "/api/pp";
    // sempre cria novo se não tiver id; edição simples recria via delete+create
    let novoId = ppId;
    if (ppId) { await fetch(`/api/pp/${ppId}`, { method: "DELETE" }); }
    const r = await fetch("/api/pp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json();
    setSalvando(false);
    if (!r.ok) { alert(d.error || "Erro ao salvar."); return; }
    if (imprimirDepois) imprimirPP({ ...f, valorTotal: totalGeral }, itens, totalPecas, totalGeral);
    onVoltar();
  };

  if (!carregado) return <div style={{ color: C.sub }}>Carregando…</div>;

  const anexo = (label, campo) => (
    <div className="flex-1">
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <label className="block px-3 py-2 rounded cursor-pointer text-sm text-center" style={{ background: f[campo] ? C.greenSoft : C.panel2, color: f[campo] ? C.green : C.sub, border: `1px dashed ${f[campo] ? C.green : C.line}` }}>
        {f[campo] ? "✓ anexado (trocar)" : "Selecionar PDF"}
        <input type="file" accept=".pdf" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) aoAnexar(campo, file); }} />
      </label>
    </div>
  );

  return (
    <div className="pb-10">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onVoltar} className="text-sm" style={{ color: C.sub }}>← Voltar</button>
        <div className="flex gap-2">
          <button onClick={() => imprimirPP({ ...f, valorTotal: totalGeral }, itens, totalPecas, totalGeral)} className="px-4 py-2 rounded flex items-center gap-1" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}><Printer size={16} /> Imprimir PP</button>
          <button onClick={() => salvar(false)} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar PP"}</button>
        </div>
      </div>

      {/* Anexos */}
      <div className="rounded-lg p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold text-sm mb-3">Anexos do pedido</div>
        <div className="flex gap-3">
          {anexo("1 · PC do cliente", "arquivoPcPdf")}
          {anexo("2 · Solicitação de lançamento", "arquivoLancPdf")}
          {anexo("3 · Pedido (base do PP)", "arquivoPedidoPdf")}
        </div>
      </div>

      {/* Cabeçalho */}
      <div className="rounded-lg p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold text-sm mb-3">Dados do pedido</div>
        <div className="grid grid-cols-4 gap-3">
          <In label="PP nº" value={f.numero} onChange={(e) => set("numero", e.target.value)} placeholder="ex.: 26070078" />
          <In label="OC do cliente" value={f.oc} onChange={(e) => set("oc", e.target.value)} />
          <In label="Tipo de pedido" value={f.tipoPedido} onChange={(e) => set("tipoPedido", e.target.value)} />
          <In label="Vendedor" value={f.vendedor} onChange={(e) => set("vendedor", e.target.value)} />
          <div className="col-span-2">
            <div className="text-xs mb-1" style={{ color: C.sub }}>Cliente <span style={{ color: C.accent }}>· busca no banco de dados</span></div>
            <Autocomplete value={f.clienteNome} onChange={(v) => set("clienteNome", v)} buscar={buscarCliente} onPick={pickCliente}
              placeholder="Digite o nome do cliente…"
              render={(c) => <span><b>{c.razaoSocial || c.nomeFantasia}</b> <span style={{ color: C.sub }}>· {fmtCnpj(c.cnpj)}{c.municipio ? " · " + c.municipio : ""}</span></span>} />
          </div>
          <In label="CNPJ" value={f.clienteCnpj} onChange={(e) => set("clienteCnpj", e.target.value)} />
          <In label="Inscr. estadual" value={f.clienteIe} onChange={(e) => set("clienteIe", e.target.value)} />
          <div className="col-span-3"><In label="Endereço" value={f.clienteEndereco} onChange={(e) => set("clienteEndereco", e.target.value)} /></div>
          <In label="Contato" value={f.clienteContato} onChange={(e) => set("clienteContato", e.target.value)} />
          <div>
            <div className="text-xs mb-1" style={{ color: C.sub }}>Condição de pagamento</div>
            <select value={f.condicaoPagamento} onChange={(e) => set("condicaoPagamento", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
              <option value="">Selecione…</option>
              {f.condicaoPagamento && !COND_PGTO.includes(f.condicaoPagamento) && <option value={f.condicaoPagamento}>{f.condicaoPagamento} (do arquivo)</option>}
              {COND_PGTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <In label="Prazo de entrega" value={f.prazoEntrega} onChange={(e) => set("prazoEntrega", e.target.value)} />
          <In label="Dt. despacho" value={f.dtDespacho} onChange={(e) => set("dtDespacho", e.target.value)} />
          <div className="col-span-4">
            <div className="text-xs mb-1" style={{ color: C.sub }}>Observações</div>
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={2} className="w-full px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
          </div>
        </div>
      </div>

      {/* Itens */}
      {itens.map((it, i) => (
        <div key={i} className="rounded-lg p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm">Peça {i + 1}</div>
            <button onClick={() => setItens((arr) => arr.filter((_, j) => j !== i))} style={{ color: "#C77" }}><Trash2 size={16} /></button>
          </div>
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Tipo de peça</div>
              <select value={it.tipoPecaNome} onChange={(e) => upItem(i, { tipoPecaNome: e.target.value, parametros: {} })} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
                {Object.keys(COMPONENTES).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <In label="Código" value={it.codigo} onChange={(e) => upItem(i, { codigo: e.target.value })} />
            <div className="col-span-2"><In label="Descrição do produto" value={it.descricao} onChange={(e) => upItem(i, { descricao: e.target.value })} /></div>
            <In label="Valor unitário (R$)" value={it.valorUnitario} onChange={(e) => upItem(i, { valorUnitario: e.target.value })} placeholder="0,00" />
          </div>

          <div className="flex gap-4">
            {/* Foto */}
            <div className="w-40 shrink-0">
              <div className="text-xs mb-1" style={{ color: C.sub }}>Foto da peça</div>
              <label className="block rounded cursor-pointer overflow-hidden" style={{ border: `1px dashed ${C.line}`, height: 150, background: C.panel2 }}>
                {it.fotoBase64
                  ? <img src={it.fotoBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div className="flex items-center justify-center h-full text-xs text-center px-2" style={{ color: C.sub }}>Clique para adicionar foto</div>}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) upItem(i, { fotoBase64: await readB64(file) }); }} />
              </label>
              {it.fotoBase64 && <button onClick={() => upItem(i, { fotoBase64: "" })} className="text-xs mt-1" style={{ color: "#C77" }}>remover foto</button>}
            </div>

            {/* Grade + Parâmetros */}
            <div className="flex-1 min-w-0">
              <div className="text-xs mb-1" style={{ color: C.sub }}>Grade (quantidade por tamanho) · total {somaItem(it)} pç · {ppMoney(totalItem(it))}</div>
              <div className="grid grid-cols-9 gap-1 mb-3">
                {it.grade.map((g, gi) => (
                  <div key={g.tam}>
                    <div className="text-center text-xs font-semibold py-0.5" style={{ color: C.sub }}>{g.tam}</div>
                    <input value={g.qtd} onChange={(e) => upGrade(i, gi, e.target.value)} className="w-full px-1 py-1 rounded outline-none text-center text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
                  </div>
                ))}
              </div>

              <div className="text-xs mb-1" style={{ color: C.sub }}>Parâmetros — {it.tipoPecaNome}</div>
              <div className="grid grid-cols-2 gap-2">
                {COMPONENTES[it.tipoPecaNome].map((comp) => (
                  <ParamLinha key={comp} comp={comp} valor={it.parametros[comp]} onChange={(v) => upParam(i, comp, v)} buscarArtigo={buscarArtigo} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <button onClick={() => setItens((arr) => [...arr, novoItem()])} className="px-4 py-2 rounded font-medium flex items-center gap-1" style={{ background: C.panel, color: C.accent, border: `1px solid ${C.accent}` }}>
        <Plus size={16} /> Adicionar peça
      </button>

      <div className="mt-4 flex justify-end text-sm" style={{ color: C.sub }}>
        Total do pedido: <b className="ml-2" style={{ color: C.accent }}>{totalPecas} peças · {ppMoney(totalGeral)}</b>
      </div>
    </div>
  );
}

function ParamLinha({ comp, valor, onChange, buscarArtigo }) {
  const isTecido = comp === "TECIDO";
  if (isTecido) {
    const v = valor && typeof valor === "object" ? valor : { tipo: "MALHA", artigo: "", medida: "" };
    const pick = (a) => {
      const tipo = a.categoria === "MALHA" ? "MALHA" : "PLANO";
      const medida = tipo === "MALHA"
        ? (a.rendimento ? `Rend. ${a.rendimento}` : "")
        : (a.largura ? `Larg. ${a.largura}` : "");
      onChange({ tipo, artigo: a.nome || "", medida, artigoId: a.id, composicao: a.composicao || "" });
    };
    return (
      <div className="col-span-2 flex items-center gap-2">
        <span className="w-40 text-sm" style={{ color: C.sub }}>{comp}</span>
        <select value={v.tipo} onChange={(e) => onChange({ ...v, tipo: e.target.value })} className="px-2 py-1 rounded outline-none text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
          <option>MALHA</option><option>PLANO</option>
        </select>
        <div className="flex-1">
          <Autocomplete value={v.artigo} onChange={(t) => onChange({ ...v, artigo: t })} buscar={buscarArtigo} onPick={pick}
            placeholder="Artigo (busca no estoque)…"
            render={(a) => <span><b>{a.nome}</b> <span style={{ color: C.sub }}>· {a.categoria}{a.cor ? " · " + a.cor : ""}{a.largura ? " · " + a.largura : ""}{a.rendimento ? " · rend " + a.rendimento : ""}</span></span>} />
        </div>
        <input placeholder={v.tipo === "MALHA" ? "Rendimento" : "Consumo/Largura"} value={v.medida} onChange={(e) => onChange({ ...v, medida: e.target.value })} className="w-36 px-2 py-1 rounded outline-none text-sm" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}66` }} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="w-40 text-sm truncate" style={{ color: C.sub }} title={comp}>{comp}</span>
      <input value={valor || ""} onChange={(e) => onChange(e.target.value)} className="flex-1 px-2 py-1 rounded outline-none text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
    </div>
  );
}

function imprimirPP(f, itens, totalPecas, totalGeral) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const money = (n) => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const soma = (it) => it.grade.reduce((s, g) => s + (parseFloat(String(g.qtd).replace(",", ".")) || 0), 0);
  const vun = (it) => parseFloat(String(it.valorUnitario).replace(",", ".")) || 0;

  const itensHtml = itens.map((it, idx) => {
    const grade = it.grade.filter((g) => String(g.qtd).trim() && Number(String(g.qtd).replace(",", ".")) > 0)
      .map((g) => `<span class="cell"><b>${esc(g.tam)}</b> ${esc(g.qtd)}</span>`).join("");
    const params = COMPONENTES[it.tipoPecaNome].map((comp) => {
      let val = it.parametros[comp];
      if (comp === "TECIDO" && val && typeof val === "object") {
        val = `${esc(val.tipo)}${val.artigo ? " · " + esc(val.artigo) : ""}${val.medida ? " · " + esc(val.medida) : ""}`;
      } else { val = esc(val || "—"); }
      return `<tr><td class="pk">${esc(comp)}</td><td>${val}</td></tr>`;
    }).join("");
    const foto = it.fotoBase64 ? `<img class="foto" src="${it.fotoBase64}"/>` : `<div class="foto vazio">sem foto</div>`;
    return `
      <div class="peca">
        <div class="peca-head"><span class="badge">${idx + 1}</span> <b>${esc(it.tipoPecaNome)}</b> — ${esc(it.descricao || "")} ${it.codigo ? `<span class="cod">${esc(it.codigo)}</span>` : ""}</div>
        <div class="peca-body">
          ${foto}
          <div class="peca-info">
            <div class="linha-valor">${soma(it)} pç &nbsp;·&nbsp; unit. ${money(vun(it))} &nbsp;·&nbsp; <b>${money(soma(it) * vun(it))}</b></div>
            <div class="grade">${grade || '<span class="cell">—</span>'}</div>
            <table class="params">${params}</table>
          </div>
        </div>
      </div>`;
  }).join("");

  const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>PP ${esc(f.numero || "")}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Montserrat', Arial, sans-serif; color: #1F2733; margin: 0; }
    .top { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #FF6B1A; padding-bottom:10px; margin-bottom:14px; }
    .top img { height: 46px; }
    .top .t { text-align:right; }
    .top .t h1 { color:#001E41; margin:0; font-size:20px; letter-spacing:1px; }
    .top .t .pp { color:#FF6B1A; font-weight:700; font-size:15px; }
    .hdr { display:grid; grid-template-columns: repeat(4, 1fr); gap:6px 16px; font-size:11px; margin-bottom:6px; }
    .hdr .lbl { color:#667085; text-transform:uppercase; font-size:9px; letter-spacing:.5px; }
    .hdr .val { font-weight:600; }
    .fat { background:#F5F6F8; border:1px solid #E4E7EC; border-radius:6px; padding:8px 10px; margin:8px 0 14px; font-size:11px; }
    .peca { border:1px solid #E4E7EC; border-radius:8px; margin-bottom:12px; overflow:hidden; page-break-inside:avoid; }
    .peca-head { background:#001E41; color:#fff; padding:7px 10px; font-size:12px; }
    .peca-head .badge { background:#FF6B1A; color:#fff; border-radius:50%; padding:1px 7px; font-weight:700; margin-right:4px; }
    .peca-head .cod { color:#9db3cc; font-size:10px; margin-left:6px; }
    .peca-body { display:flex; gap:12px; padding:10px; }
    .foto { width:150px; height:150px; object-fit:cover; border-radius:6px; border:1px solid #E4E7EC; }
    .foto.vazio { display:flex; align-items:center; justify-content:center; color:#aab; font-size:10px; }
    .peca-info { flex:1; }
    .linha-valor { font-size:12px; margin-bottom:6px; }
    .grade { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
    .grade .cell { border:1px solid #E4E7EC; border-radius:4px; padding:2px 7px; font-size:11px; background:#F5F6F8; }
    .grade .cell b { color:#FF6B1A; }
    table.params { width:100%; border-collapse:collapse; font-size:10.5px; }
    table.params td { border:1px solid #EEF0F3; padding:3px 6px; }
    table.params td.pk { color:#667085; width:38%; text-transform:uppercase; font-size:9.5px; }
    .totais { text-align:right; font-size:13px; margin-top:8px; }
    .totais b { color:#FF6B1A; }
    .obs { font-size:11px; margin-top:10px; }
    .rod { margin-top:16px; border-top:1px solid #E4E7EC; padding-top:6px; font-size:9px; color:#98A2B3; text-align:center; }
  </style></head><body>
    <div class="top">
      <img src="${origin}/meridian-logo.png" onerror="this.style.display='none'"/>
      <div class="t"><h1>PEDIDO DE PRODUÇÃO</h1><div class="pp">PP ${esc(f.numero || "")}</div></div>
    </div>
    <div class="hdr">
      <div><div class="lbl">Cliente</div><div class="val">${esc(f.clienteNome || "—")}</div></div>
      <div><div class="lbl">CNPJ</div><div class="val">${esc(f.clienteCnpj || "—")}</div></div>
      <div><div class="lbl">Insc. estadual</div><div class="val">${esc(f.clienteIe || "—")}</div></div>
      <div><div class="lbl">OC cliente</div><div class="val">${esc(f.oc || "—")}</div></div>
      <div><div class="lbl">Condição pgto</div><div class="val">${esc(f.condicaoPagamento || "—")}</div></div>
      <div><div class="lbl">Prazo entrega</div><div class="val">${esc(f.prazoEntrega || "—")}</div></div>
      <div><div class="lbl">Dt. despacho</div><div class="val">${esc(f.dtDespacho || "—")}</div></div>
      <div><div class="lbl">Vendedor</div><div class="val">${esc(f.vendedor || "—")}</div></div>
    </div>
    <div class="fat"><b>Endereço:</b> ${esc(f.clienteEndereco || "—")} &nbsp;·&nbsp; <b>Contato:</b> ${esc(f.clienteContato || "—")} &nbsp;·&nbsp; <b>Tipo:</b> ${esc(f.tipoPedido || "—")}</div>
    ${itensHtml}
    <div class="totais">Total do pedido: <b>${totalPecas} peças · ${money(totalGeral)}</b></div>
    ${f.obs ? `<div class="obs"><b>Obs.:</b> ${esc(f.obs)}</div>` : ""}
    <div class="rod">MERIDIAN · Confecção de uniformes — documento interno de produção</div>
    <script>window.onload=function(){setTimeout(function(){window.print();},300);}</script>
  </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("Permita pop-ups para imprimir o PP."); return; }
  w.document.write(html); w.document.close();
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
function NF({ master, money, perfil }) {
  const [nfs, setNfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null); // {tipo:'ok'|'erro', texto}
  const [arrastando, setArrastando] = useState(false);
  const [fornecedores, setFornecedores] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroForn, setFiltroForn] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");

  const carregar = async () => {
    setLoading(true);
    try {
      const [r, f] = await Promise.all([
        fetch("/api/nf").then((x) => x.json()),
        fetch("/api/fornecedores").then((x) => x.json()),
      ]);
      setNfs(Array.isArray(r) ? r : []);
      setFornecedores(Array.isArray(f) ? f : []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const excluir = async (n) => {
    if (!confirm(`Excluir a NF ${n.numero}? Os itens da nota serão removidos; os artigos cadastrados permanecem.`)) return;
    await fetch(`/api/nf/${n.id}`, { method: "DELETE" });
    carregar();
  };

  const readText = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Falha ao ler o arquivo"));
    fr.onload = () => res(fr.result);
    fr.readAsText(file);
  });
  const readBase64 = (file) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onerror = () => rej(new Error("Falha ao ler o arquivo"));
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.readAsDataURL(file);
  });

  const enviar = async (files) => {
    const arr = Array.from(files || []).filter(Boolean);
    if (!arr.length) return;
    setMsg(null); setEnviando(true);
    try {
      const xml = arr.find((f) => /\.xml$/i.test(f.name));
      const pdf = arr.find((f) => /\.pdf$/i.test(f.name));
      let payload;
      if (xml) {
        payload = { tipo: "xml", conteudo: await readText(xml), pdfBase64: pdf ? await readBase64(pdf) : null, perfil, usuarioId: sessaoId() };
      } else if (pdf) {
        payload = { tipo: "pdf", conteudo: await readBase64(pdf), perfil, usuarioId: sessaoId() };
      } else {
        setMsg({ tipo: "erro", texto: "Selecione um arquivo .xml e/ou .pdf." }); setEnviando(false); return;
      }
      const r = await fetch("/api/nf/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "erro", texto: data.error || "Não foi possível importar." });
      } else {
        const base = data.jaExistia ? `NF ${data.numero} (já existente) atualizada` : `NF ${data.numero} importada (${data.origem})`;
        const det = [];
        if (data.itensCriados) det.push(`${data.itensCriados} item(ns)`);
        if (data.artigosCriados) det.push(`${data.artigosCriados} artigo(s) novo(s)`);
        if (data.artigosVinculados) det.push(`${data.artigosVinculados} vinculado(s)`);
        if (data.artigosReativados) det.push(`${data.artigosReativados} reativado(s)`);
        if (data.temPdf) det.push("PDF anexado");
        setMsg({ tipo: "ok", texto: base + (det.length ? " · " + det.join(" · ") : "") + "." });
        carregar();
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    }
    setEnviando(false);
  };

  const normNf = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokensNf = normNf(busca).trim().split(/\s+/).filter(Boolean);
  const nfsFiltradas = nfs.filter((n) => {
    if (filtroForn && String(n.fornecedor?.id) !== String(filtroForn)) return false;
    if (dataDe && (!n.dataEmissao || new Date(n.dataEmissao) < new Date(dataDe))) return false;
    if (dataAte && (!n.dataEmissao || new Date(n.dataEmissao) > new Date(dataAte + "T23:59:59"))) return false;
    if (tokensNf.length) {
      const hay = normNf([n.numero, n.fornecedor?.nome, n.valorTotal, n.status].filter((v) => v != null).join(" "));
      if (!tokensNf.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  return (
    <div className="max-w-4xl">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!enviando) setArrastando(true); }}
        onDragLeave={(e) => { e.preventDefault(); setArrastando(false); }}
        onDrop={(e) => {
          e.preventDefault(); setArrastando(false);
          if (!enviando) enviar(e.dataTransfer.files);
        }}
        className="rounded-lg p-5 mb-5 transition-colors"
        style={{ background: arrastando ? C.accentSoft : C.panel, border: `2px dashed ${arrastando ? C.accent : C.accent + "88"}` }}>
        <div className="font-semibold mb-1">Importar Nota Fiscal</div>
        <p className="text-xs mb-4" style={{ color: C.sub }}>
          {arrastando ? "Solte os arquivos aqui…" : "Arraste o XML (e opcionalmente o PDF junto) para esta área, ou clique no botão. "}
          Aceita apenas notas de <b>venda</b> (remessa, industrialização, devolução, etc. são recusadas). Notas repetidas são bloqueadas pela chave. XML é a fonte confiável; anexe o PDF junto para poder baixá-lo depois.
        </p>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded font-semibold cursor-pointer"
          style={{ background: enviando ? C.panel2 : C.accent, color: enviando ? C.sub : "#fff" }}>
          {enviando ? "Importando…" : "Selecionar XML (e PDF)"}
          <input type="file" accept=".xml,.pdf" multiple disabled={enviando} style={{ display: "none" }}
            onChange={(e) => enviar(e.target.files)} />
        </label>
        {msg && (
          <div className="mt-4 rounded p-3 text-sm" style={{
            background: msg.tipo === "ok" ? C.greenSoft : "#FBE9E9",
            color: msg.tipo === "ok" ? C.green : "#B42318",
            border: `1px solid ${msg.tipo === "ok" ? C.green + "55" : "#F0A9A9"}`,
          }}>{msg.texto}</div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div style={{ flex: "1 1 220px" }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Buscar</div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nº da NF, fornecedor…"
            className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div style={{ flex: "0 1 200px" }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Fornecedor</div>
          <select value={filtroForn} onChange={(e) => setFiltroForn(e.target.value)} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option value="">Todos</option>
            {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome || "(sem nome comercial)"}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Emissão de</div>
          <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>até</div>
          <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        {(busca || filtroForn || dataDe || dataAte) && <button onClick={() => { setBusca(""); setFiltroForn(""); setDataDe(""); setDataAte(""); }} className="px-3 py-1.5 rounded text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Limpar</button>}
      </div>

      <div className="text-xs mb-2" style={{ color: C.sub }}>Notas importadas</div>
      {loading ? <div style={{ color: C.sub }}>Carregando…</div> : (
        <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
          <div style={{ minWidth: 900 }}>
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
            <div className="w-24">NF</div>
            <div className="flex-1">Fornecedor</div>
            <div className="w-28">Emissão</div>
            <div className="w-32">Valor total</div>
            <div className="w-16 text-center">Itens</div>
            <div className="w-28 text-center">Download</div>
            <div className="w-20 text-right">Ação</div>
          </div>
          {nfsFiltradas.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhuma NF encontrada.</div>}
          {nfsFiltradas.map((n) => (
            <div key={n.id} className="flex px-4 py-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="w-24 font-mono">{n.numero}</div>
              <div className="flex-1">{n.fornecedor?.nome || "—"}</div>
              <div className="w-28" style={{ color: C.sub }}>{fmtData(n.dataEmissao)}</div>
              <div className="w-32" style={{ color: C.accent }}>{n.valorTotal != null ? money(Number(n.valorTotal)) : "—"}</div>
              <div className="w-16 text-center" style={{ color: C.sub }}>{n._count?.itens ?? 0}</div>
              <div className="w-28 text-center flex items-center justify-center gap-2">
                {n.temPdf ? <a href={`/api/nf/${n.id}/pdf`} title="Baixar PDF" style={{ color: "#D64545", fontWeight: 700, textDecoration: "none" }}>PDF</a> : <span style={{ color: C.line }}>PDF</span>}
                {n.temXml ? <a href={`/api/nf/${n.id}/xml`} title="Baixar XML" style={{ color: C.blue, fontWeight: 700, textDecoration: "none" }}>XML</a> : <span style={{ color: C.line }}>XML</span>}
              </div>
              <div className="w-20 text-right">
                <button onClick={() => excluir(n)} title="Excluir NF" className="px-2 py-1 rounded text-xs" style={{ color: "#B42318", border: `1px solid ${C.line}` }}>Excluir</button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
function Estoque({ money, master }) {
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
  if (loading) return <div style={{ color: C.sub }}>Carregando…</div>;
  return (
    <div>
      <div className="text-xs mb-3" style={{ color: C.sub }}>
        Estoque = os mesmos artigos de “Artigos &amp; Fornec.”. O que entra pela NF aparece aqui, e qualquer alteração feita aqui ou lá reflete nas duas telas.
      </div>
      <ArtigosPane artigos={artigos} fornecedores={fornecedores} master={master} money={money} onSaved={carregar} modoEstoque />
    </div>
  );
}
/* ===== FME · Ficha de Movimentação de Estoque ===== */
const FME_SETORES = ["CORTE", "PCP", "ESTOQUE", "EXPEDICAO", "COMPRAS", "ADMINISTRATIVO", "FINANCEIRO"];
const rotuloQtd = (u) => (u === "M" ? "Metragem (m)" : u === "KG" ? "Quantidade (kg)" : "Quantidade (un)");

async function gerarPdfFme(fme, responsavelNome) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" }); // 210 x 148 (meia folha)
  const W = 210, M = 10;
  let y = 12;
  const data = (() => { try { return new Date(fme.data || fme.createdAt).toLocaleDateString("pt-BR"); } catch { return ""; } })();

  // cabeçalho
  doc.setFillColor(0, 30, 65); doc.rect(0, 0, W, 7, "F");
  doc.setFontSize(14); doc.setTextColor(0, 30, 65); doc.setFont(undefined, "bold");
  doc.text("MERIDIAN", M, y);
  doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "normal");
  doc.text("Ficha de Movimentação de Estoque", M + 34, y);
  doc.setFontSize(13); doc.setTextColor(255, 107, 26); doc.setFont(undefined, "bold");
  doc.text(String(fme.numero || ""), W - M, y, { align: "right" });
  y += 7;
  doc.setDrawColor(210, 210, 210); doc.line(M, y, W - M, y); y += 6;

  // dados
  doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.setTextColor(40, 40, 40);
  doc.text(`Data: ${data}`, M, y);
  doc.text(`Setor demandante: ${fme.setorDemandante || ""}`, M + 55, y);
  doc.text(`Solicitante: ${fme.responsavelSetor || "—"}`, M + 130, y);
  y += 5;
  doc.text(`Responsável estoque: ${responsavelNome || "—"}`, M, y);
  y += 5;

  // tabela de itens
  const cols = [
    { t: "Item", x: M, w: 66 },
    { t: "Cor", x: M + 66, w: 26 },
    { t: "PP", x: M + 92, w: 24 },
    { t: "Un", x: M + 116, w: 10 },
    { t: "Qtd retirada", x: M + 126, w: 26 },
    { t: "Qtd devolvida", x: M + 152, w: 26 },
    { t: "Obs", x: M + 178, w: W - M - (M + 178) },
  ];
  doc.setFillColor(241, 243, 245); doc.rect(M, y, W - 2 * M, 7, "F");
  doc.setFontSize(7.5); doc.setTextColor(90, 90, 90); doc.setFont(undefined, "bold");
  cols.forEach((c) => doc.text(c.t, c.x + 1.5, y + 4.6));
  y += 7;
  doc.setFont(undefined, "normal"); doc.setTextColor(30, 30, 30); doc.setFontSize(8);
  const itens = fme.itens || [];
  itens.forEach((it) => {
    const rowH = 8;
    const nome = it.nomeItem || it.artigo?.nome || "";
    const cor = it.cor || it.artigo?.cor || "";
    const un = it.unidade || it.artigo?.unidade || "";
    const qtd = Number(it.qtdRetirada || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    doc.setDrawColor(225, 225, 225); doc.rect(M, y, W - 2 * M, rowH);
    cols.forEach((c) => { if (c.x > M) doc.line(c.x, y, c.x, y + rowH); });
    doc.text(doc.splitTextToSize(nome, cols[0].w - 3)[0] || "", cols[0].x + 1.5, y + 5.2);
    doc.text(doc.splitTextToSize(cor, cols[1].w - 3)[0] || "", cols[1].x + 1.5, y + 5.2);
    doc.text(String(it.pedidoProducao || ""), cols[2].x + 1.5, y + 5.2);
    doc.text(String(un), cols[3].x + 1.5, y + 5.2);
    doc.text(qtd, cols[4].x + 1.5, y + 5.2);
    // Qtd devolvida e Obs ficam EM BRANCO (preenchimento à mão)
    y += rowH;
  });
  y += 10;

  // assinaturas
  const sigY = Math.max(y, 118);
  const half = W / 2;
  doc.setDrawColor(120, 120, 120);
  doc.line(M + 6, sigY, half - 8, sigY);
  doc.line(half + 8, sigY, W - M - 6, sigY);
  doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  doc.text("Assinatura do retirante", (M + 6 + half - 8) / 2, sigY + 5, { align: "center" });
  doc.text("Assinatura do estoque", (half + 8 + W - M - 6) / 2, sigY + 5, { align: "center" });

  doc.save(`${fme.numero || "FME"}.pdf`);
}

function AutocompleteArtigo({ artigos, onPick, onNovo }) {
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState(false);
  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  // busca por qualquer palavra: todos os termos digitados precisam aparecer (em qualquer ordem/campo)
  const tokens = norm(q).trim().split(/\s+/).filter(Boolean);
  const disp = artigos.filter((a) => (Number(a.quantidade) || 0) > 0);
  const matches = (tokens.length
    ? disp.filter((a) => {
        const hay = norm(`${a.nome} ${a.artigoInterno || ""} ${a.cor || ""} ${a.composicao || ""} ${a.codigo || ""} ${a.especificacao || ""} ${a.unidade || ""}`);
        return tokens.every((t) => hay.includes(t));
      })
    : disp).slice(0, 40);
  return (
    <div style={{ position: "relative" }}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)} placeholder="Digite qualquer palavra do material…"
        className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
      {aberto && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 38, maxHeight: 340, overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, zIndex: 30, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
          {matches.length === 0 && <div className="px-3 py-2 text-xs" style={{ color: C.sub }}>Nenhum material em estoque com esse nome.</div>}
          {matches.map((a) => (
            <button key={a.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(a); setQ(""); setAberto(false); }}
              className="w-full text-left px-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="text-sm font-medium" style={{ color: C.text }}>{a.nome}{a.artigoInterno ? ` · ${a.artigoInterno}` : ""}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: C.sub }}>
                <Bolinha cor={a.cor} /> {a.cor || "—"} · saldo {Number(a.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {a.unidade}
              </div>
            </button>
          ))}
          {onNovo && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onNovo(); setAberto(false); }}
              className="w-full text-left px-3 py-2 flex items-center gap-1 text-sm font-medium" style={{ color: C.accent, background: C.accentSoft, position: "sticky", bottom: 0 }}>
              <Plus size={14} /> Cadastrar novo artigo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FME({ user, perfil }) {
  const [fmes, setFmes] = useState([]);
  const [artigos, setArtigos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [f, a, u, fo] = await Promise.all([
        fetch("/api/fme").then((r) => r.json()),
        fetch("/api/artigos").then((r) => r.json()),
        fetch("/api/usuarios/lista").then((r) => r.json()),
        fetch("/api/fornecedores").then((r) => r.json()),
      ]);
      setFmes(Array.isArray(f) ? f : []);
      setArtigos(Array.isArray(a) ? a : []);
      setUsuarios(Array.isArray(u) ? u : []);
      setFornecedores(Array.isArray(fo) ? fo : []);
    } catch {}
    setLoading(false);
  };
  // recarrega só os artigos (sem "Carregando…", pra não fechar o modal aberto)
  const recarregarArtigos = async () => {
    try { const a = await fetch("/api/artigos").then((r) => r.json()); setArtigos(Array.isArray(a) ? a : []); } catch {}
  };
  useEffect(() => { carregar(); }, []);

  const nomeResp = (id) => { const u = usuarios.find((x) => x.id === id); return u ? `${u.nome} ${u.sobrenome || ""}`.trim() : ""; };
  const quando = (d) => { try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return ""; } };

  if (loading) return <div style={{ color: C.sub }}>Carregando…</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: C.sub }}>{fmes.length} FME(s) · saída de material do estoque</div>
        <button onClick={() => setNovo(true)} className="px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Nova FME</button>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
        <div style={{ minWidth: 720 }}>
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2, textTransform: "uppercase" }}>
            <div className="w-28">Nº</div><div className="w-28">Data</div><div className="w-36">Setor</div><div className="flex-1">Solicitante</div><div className="w-24">Itens</div><div className="w-24 text-right">PDF</div>
          </div>
          {fmes.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhuma FME ainda. Clique em “Nova FME”.</div>}
          {fmes.map((f) => (
            <div key={f.id} className="flex px-4 py-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="w-28 font-semibold" style={{ color: C.accent }}>{f.numero}</div>
              <div className="w-28 text-sm" style={{ color: C.sub }}>{quando(f.data || f.createdAt)}</div>
              <div className="w-36"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{f.setorDemandante}</span></div>
              <div className="flex-1 text-sm" style={{ color: C.text }}>{f.responsavelSetor || "—"}</div>
              <div className="w-24 text-sm" style={{ color: C.sub }}>{f.itens?.length || 0}</div>
              <div className="w-24 flex justify-end">
                <button onClick={() => gerarPdfFme(f, nomeResp(f.responsavelEstoque))} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}` }}><Printer size={13} /> PDF</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {novo && <NovaFmeModal user={user} perfil={perfil} artigos={artigos} usuarios={usuarios} fornecedores={fornecedores}
        onArtigosChanged={recarregarArtigos}
        onClose={() => setNovo(false)}
        onSalvo={async (fme) => { setNovo(false); await gerarPdfFme(fme, `${user.nome} ${user.sobrenome || ""}`.trim()); carregar(); }} />}
    </div>
  );
}

function NovaFmeModal({ user, perfil, artigos, usuarios, fornecedores, onArtigosChanged, onClose, onSalvo }) {
  const [solicitanteId, setSolicitanteId] = useState("");
  const [setor, setSetor] = useState("CORTE");
  const [itens, setItens] = useState([]); // { artigo, qtd, pp }
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [novoArtigo, setNovoArtigo] = useState(false);

  const escolherSolicitante = (id) => {
    setSolicitanteId(id);
    const u = (usuarios || []).find((x) => String(x.id) === String(id));
    if (u && u.setor) setSetor(u.setor); // setor vem automático do usuário
  };
  const solicitanteNome = (() => { const u = (usuarios || []).find((x) => String(x.id) === String(solicitanteId)); return u ? `${u.nome} ${u.sobrenome || ""}`.trim() : ""; })();

  const addItem = (a) => {
    if (itens.some((it) => it.artigo.id === a.id)) return;
    setItens((s) => [...s, { artigo: a, qtd: "", pp: "" }]);
  };
  const setItem = (i, k, v) => setItens((s) => s.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const remover = (i) => setItens((s) => s.filter((_, idx) => idx !== i));
  const decLocal = (v) => { let s = String(v).replace(/\s/g, ""); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isNaN(n) ? null : n; };

  const salvar = async () => {
    setErro("");
    if (!itens.length) return setErro("Inclua ao menos um material.");
    for (const it of itens) {
      const q = decLocal(it.qtd);
      if (!q || q <= 0) return setErro(`Informe a quantidade de ${it.artigo.nome}.`);
      if (q > (Number(it.artigo.quantidade) || 0)) return setErro(`Saldo insuficiente de ${it.artigo.nome} (disponível ${Number(it.artigo.quantidade).toLocaleString("pt-BR")} ${it.artigo.unidade}).`);
    }
    setSalvando(true);
    const body = {
      setorDemandante: setor, solicitante: solicitanteNome, responsavelEstoque: user.id, perfil,
      itens: itens.map((it) => ({ artigoId: it.artigo.id, qtdRetirada: it.qtd, pedidoProducao: it.pp })),
    };
    const res = await fetch("/api/fme", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSalvando(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); return setErro(j.error || "Erro ao salvar."); }
    const fme = await res.json();
    onSalvo(fme);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,.4)", paddingTop: 16 }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-3xl" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold">Nova FME · saída de material</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Sel label="Solicitante" value={solicitanteId} onChange={(e) => escolherSolicitante(e.target.value)}>
              <option value="">Selecione o solicitante…</option>
              {(usuarios || []).map((u) => <option key={u.id} value={u.id}>{u.nome} {u.sobrenome} · {u.setor}</option>)}
            </Sel>
            <Sel label="Setor (automático)" value={setor} onChange={(e) => setSetor(e.target.value)}>
              {FME_SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Sel>
          </div>

          <div className="text-xs mb-1 font-semibold" style={{ color: C.sub, textTransform: "uppercase" }}>Incluir material</div>
          <div className="mb-3"><AutocompleteArtigo artigos={artigos} onPick={addItem} onNovo={() => setNovoArtigo(true)} /></div>

          {itens.length > 0 && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 8 }} className="overflow-hidden mb-2">
              <div className="flex px-3 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2, textTransform: "uppercase" }}>
                <div className="flex-1">Material</div><div className="w-24">Cor</div><div className="w-32">Qtd</div><div className="w-28">PP</div><div className="w-8"></div>
              </div>
              {itens.map((it, i) => (
                <div key={it.artigo.id} className="flex px-3 py-2 items-center gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: C.text }}>{it.artigo.nome}</div>
                    <div className="text-xs" style={{ color: C.sub }}>saldo {Number(it.artigo.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {it.artigo.unidade}</div>
                  </div>
                  <div className="w-24 text-sm flex items-center gap-1" style={{ color: C.sub }}><Bolinha cor={it.artigo.cor} /> {it.artigo.cor || "—"}</div>
                  <div className="w-32">
                    <input value={it.qtd} onChange={(e) => setItem(i, "qtd", e.target.value)} inputMode="decimal" placeholder={rotuloQtd(it.artigo.unidade)} className="w-full px-2 py-1 rounded outline-none text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
                  </div>
                  <div className="w-28">
                    <input value={it.pp} onChange={(e) => setItem(i, "pp", e.target.value)} placeholder="PP" className="w-full px-2 py-1 rounded outline-none text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, textTransform: "uppercase" }} />
                  </div>
                  <button onClick={() => remover(i)} className="w-8 flex justify-end" style={{ color: "#C77" }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}

          {erro && <div className="text-xs mt-2" style={{ color: "#D64545" }}>{erro}</div>}
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="text-xs" style={{ color: C.sub }}>Ao salvar: baixa do estoque + PDF meia folha</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando || !itens.length} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando || !itens.length ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar e gerar PDF"}</button>
          </div>
        </div>
      </div>

      {novoArtigo && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto" style={{ background: "rgba(0,0,0,.5)", paddingTop: 16 }} onClick={(e) => { e.stopPropagation(); }}>
          <div className="rounded-xl w-full max-w-3xl" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="font-semibold">Cadastrar novo artigo</div>
              <button onClick={() => setNovoArtigo(false)} style={{ color: C.sub }}><X size={18} /></button>
            </div>
            <div className="p-5">
              <ArtigoForm fornecedores={fornecedores} master={true} onSaved={async () => { setNovoArtigo(false); onArtigosChanged && (await onArtigosChanged()); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ===== Artigos & Fornecedores (ligado ao banco) ===== */
function In({ label, ...p }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <input {...p} className="w-full px-2 py-1.5 rounded outline-none"
        style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, textTransform: "uppercase" }} />
    </div>
  );
}
function InCor({ label, value, onChange }) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.sub }}>{label}</div>
      <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
        <Bolinha cor={value} />
        <input value={value} onChange={onChange} placeholder="Ex.: AZUL MARINHO"
          className="flex-1 outline-none" style={{ background: "transparent", color: C.text, textTransform: "uppercase" }} />
      </div>
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

// fornecedores com o mesmo nome comercial (devem virar um só)
function gruposFornecedores(fornecedores) {
  const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const mapa = {};
  for (const f of fornecedores) {
    if (!f.nome || !f.nome.trim()) continue; // sem nome não agrupa
    const k = norm(f.nome);
    (mapa[k] = mapa[k] || []).push(f);
  }
  return Object.values(mapa).filter((g) => g.length > 1);
}

function FornecedoresPane({ fornecedores, onSaved }) {
  const [nome, setNome] = useState("");
  const [cnpjs, setCnpjs] = useState([{ cnpj: "", razaoSocial: "" }]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [editando, setEditando] = useState(null);
  const [verDupF, setVerDupF] = useState(false);
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
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs" style={{ color: C.sub }}>{fornecedores.length} fornecedor(es) · clique na linha para editar</div>
          {(() => { const g = gruposFornecedores(fornecedores); return g.length > 0 ? (
            <button onClick={() => setVerDupF(true)} className="px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}><AlertTriangle size={13} /> Mesclar fornecedores ({g.length})</button>
          ) : null; })()}
        </div>
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
      {verDupF && <FornecedoresDuplicadosModal fornecedores={fornecedores} onClose={() => setVerDupF(false)} onSaved={onSaved} />}
    </div>
  );
}

function FornecedoresDuplicadosModal({ fornecedores, onClose, onSaved }) {
  const grupos = gruposFornecedores(fornecedores);
  const [mesclando, setMesclando] = useState(null);
  const [erro, setErro] = useState("");

  const mesclar = async (grupo) => {
    setErro("");
    // mantém o que tem mais artigos (desempate: id menor)
    const ordenados = [...grupo].sort((a, b) => ((b._count?.artigos ?? 0) - (a._count?.artigos ?? 0)) || (a.id - b.id));
    const manter = ordenados[0];
    setMesclando(manter.id);
    for (const rem of ordenados.slice(1)) {
      const r = await fetch("/api/fornecedores/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manterId: manter.id, removerId: rem.id }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j.error || "Erro ao mesclar."); setMesclando(null); return; }
    }
    setMesclando(null);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold">Fornecedores duplicados</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="text-xs mb-3" style={{ color: C.sub }}>Mesmo nome comercial = deve ser um só fornecedor. Mesclar move todos os CNPJs, artigos, notas e OCs para um único cadastro (mantém o que tem mais artigos) e inativa os demais. Depois disso, os artigos duplicados também passam a ser mescláveis.</div>
          {grupos.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Nenhum fornecedor duplicado ✓</div>}
          {grupos.map((g, i) => (
            <div key={i} className="rounded-lg mb-3" style={{ border: `1px solid ${C.line}` }}>
              <div className="px-3 py-2 text-xs font-semibold flex items-center justify-between" style={{ background: C.panel2, color: C.sub }}>
                <span>{g[0].nome} · {g.length} cadastros</span>
                <button onClick={() => mesclar(g)} disabled={mesclando === g[0].id} className="px-3 py-1 rounded text-xs font-medium" style={{ background: C.accent, color: "#fff", opacity: mesclando != null ? 0.6 : 1 }}>{mesclando === g[0].id ? "Mesclando…" : "Mesclar em 1"}</button>
              </div>
              {g.map((f) => (
                <div key={f.id} className="px-3 py-2 text-sm flex items-center justify-between" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span style={{ color: C.text }}>{f.nome} <span style={{ color: C.sub }}>· {f._count?.artigos ?? 0} artigos · {f.cnpjs?.length || 0} CNPJ(s)</span></span>
                  <span className="text-xs flex flex-wrap gap-1 justify-end" style={{ maxWidth: 260 }}>{f.cnpjs?.map((c) => <span key={c.id} className="px-1.5 py-0.5 rounded" style={{ background: C.panel2, color: C.sub }}>{fmtCnpj(c.cnpj)}</span>)}</span>
                </div>
              ))}
            </div>
          ))}
          {erro && <div className="text-xs mt-2" style={{ color: "#D64545" }}>{erro}</div>}
        </div>
      </div>
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

const CATS = [["MALHA", "Malha"], ["TECIDO", "Tecido"], ["AVIAMENTO", "Aviamento"], ["OUTROS", "Outros"]];

const MAPA_COR = {
  "branco": "#FFFFFF", "off white": "#F5F5EF", "cru": "#E8E0CF", "gelo": "#F0F4F8",
  "preto": "#111111", "cinza": "#8A8F98", "chumbo": "#3A4149", "grafite": "#33383D", "prata": "#C7CBD1",
  "azul": "#1E5AA8", "azul marinho": "#1B2A4A", "marinho": "#1B2A4A", "azul royal": "#1D4ED8", "azul claro": "#7DB8E8", "azul bebe": "#AFD3F0", "turquesa": "#30C7C0",
  "vermelho": "#D0342C", "vinho": "#7B1E2B", "bordo": "#5E1A22", "rosa": "#E86AA6", "pink": "#E8368F", "salmao": "#F79C86", "coral": "#F0785A", "nude": "#E3BC9A",
  "verde": "#2E9E5B", "verde bandeira": "#1FA24A", "verde militar": "#4B5320", "verde musgo": "#5A6650", "verde limao": "#9BCF3B",
  "amarelo": "#F2C230", "ouro": "#D4AF37", "dourado": "#D4AF37", "mostarda": "#D9A521", "laranja": "#F07E24",
  "roxo": "#7C3AED", "lilas": "#B79CD8", "violeta": "#8B5CF6", "marrom": "#8A5A2B", "caramelo": "#B26B32", "bege": "#D6C7A8", "caqui": "#B7A66B",
};
function corParaCss(nome) {
  if (!nome) return null;
  const n = nome.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (MAPA_COR[n]) return MAPA_COR[n];
  const chaves = Object.keys(MAPA_COR).sort((a, b) => b.length - a.length);
  for (const k of chaves) if (n.includes(k)) return MAPA_COR[k];
  return null;
}
function Bolinha({ cor }) {
  const css = corParaCss(cor);
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12, borderRadius: "50%",
      background: css || "transparent",
      border: css ? "1px solid rgba(0,0,0,0.25)" : "1px dashed #C7CBD1",
      flexShrink: 0,
    }} title={cor || "sem cor"} />
  );
}

function round2Custom(x) {
  const n = Number(x);
  if (isNaN(n)) return null;
  const sign = n < 0 ? -1 : 1;
  const mil = Math.round(Math.abs(n) * 1000); // milésimos
  const terceiro = mil % 10;                    // 3ª casa decimal
  let cent = Math.floor(mil / 10);              // centésimos
  if (terceiro >= 6) cent += 1;                 // .6+ sobe; .5- desce
  return (sign * cent) / 100;
}
function fmtQtd(x, unidade) {
  const v = round2Custom(x);
  if (v === null) return "—";
  const s = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return unidade ? `${s} ${unidade}` : s;
}
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

function ResumoCard({ rotulo, valor, destaque }) {
  return (
    <div className="rounded-lg p-3" style={{ background: destaque ? C.accentSoft : C.panel, border: `1px solid ${destaque ? C.accent : C.line}` }}>
      <div className="text-xs font-semibold mb-1" style={{ color: destaque ? C.accent : C.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>{rotulo}</div>
      <div className="text-lg font-bold" style={{ color: destaque ? C.accent : C.text }}>{valor}</div>
    </div>
  );
}
// agrupa artigos que são o mesmo item: fornecedor (pelo NOME comercial) + nome NF + cor + valor (regra do Igor)
function gruposDuplicados(artigos) {
  const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const val = (v) => (v == null || v === "" ? "" : (Number(v) || 0).toFixed(4));
  // usa o NOME do fornecedor (assim "Têxtil MN" em cadastros diferentes conta como o mesmo);
  // se o fornecedor está sem nome, cai no id pra não juntar fornecedores distintos por engano
  const chaveForn = (a) => (a.fornecedor?.nome && a.fornecedor.nome.trim() ? "n:" + norm(a.fornecedor.nome) : "i:" + (a.fornecedorId || "0"));
  const mapa = {};
  for (const a of artigos) {
    const chave = [chaveForn(a), norm(a.nome), norm(a.cor), val(a.valorUnitario)].join("|");
    (mapa[chave] = mapa[chave] || []).push(a);
  }
  return Object.values(mapa).filter((g) => g.length > 1);
}

function ArtigosPane({ artigos, fornecedores, master, money, onSaved, modoEstoque }) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [verMov, setVerMov] = useState(null);
  const [verDup, setVerDup] = useState(false);
  const [sort, setSort] = useState({ key: "nome", dir: "asc" });
  const [busca, setBusca] = useState("");
  const [filtroForn, setFiltroForn] = useState("");
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [classe, setClasse] = useState("");
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const campos = {
    categoria: [(a) => a.categoria, "texto"],
    nome: [(a) => a.nome, "texto"],
    interno: [(a) => a.artigoInterno, "texto"],
    fornecedor: [(a) => a.fornecedor?.nome, "texto"],
    cor: [(a) => a.cor, "texto"],
    codigo: [(a) => a.codigo, "texto"],
    quantidade: [(a) => a.quantidade, "num"],
    dataCompra: [(a) => a.dataCompra, "data"],
    preco: [(a) => a.valorUnitario, "num"],
  };
  const [fn, tipo] = campos[sort.key] || campos.nome;

  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tokens = norm(busca).trim().split(/\s+/).filter(Boolean);
  const filtrados = artigos.filter((a) => {
    if (filtroForn && String(a.fornecedorId) !== String(filtroForn)) return false;
    if (classe && (["TECIDO", "MALHA", "AVIAMENTO"].includes(classe) ? a.categoria !== classe : !["TECIDO", "MALHA", "AVIAMENTO"].includes(a.categoria))) return false;
    if (dataDe && (!a.dataCompra || new Date(a.dataCompra) < new Date(dataDe))) return false;
    if (dataAte && (!a.dataCompra || new Date(a.dataCompra) > new Date(dataAte + "T23:59:59"))) return false;
    if (tokens.length) {
      const hay = norm([a.categoria, a.nome, a.artigoInterno, a.codigo, a.cor, a.composicao, a.especificacao, a.tipoMalha, a.unidade, a.largura, a.gramatura, a.rendimento, a.quantidade, a.valorUnitario, a.fornecedor?.nome, a.nf?.numero].filter((v) => v != null).join(" "));
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  const lista = ordenar(filtrados, fn, sort.dir, tipo);
  const totais = (() => {
    const seg = {
      TECIDO: { rotulo: "Tecidos", n: 0, v: 0, m: 0, kg: 0 },
      MALHA: { rotulo: "Malhas", n: 0, v: 0, m: 0, kg: 0 },
      AVIAMENTO: { rotulo: "Aviamentos", n: 0, v: 0, m: 0, kg: 0 },
      OUTROS: { rotulo: "Outros", n: 0, v: 0, m: 0, kg: 0 },
    };
    let v = 0, m = 0, kg = 0;
    for (const a of lista) {
      const q = Number(a.quantidade) || 0;
      const vt = (Number(a.valorUnitario) || 0) * q;
      v += vt;
      if (a.unidade === "M") m += q;
      if (a.unidade === "KG") kg += q;
      const cat = ["TECIDO", "MALHA", "AVIAMENTO"].includes(a.categoria) ? a.categoria : "OUTROS";
      seg[cat].n += 1; seg[cat].v += vt;
      if (a.unidade === "M") seg[cat].m += q;
      if (a.unidade === "KG") seg[cat].kg += q;
    }
    return { v, m, kg, seg };
  })();
  const temFiltro = busca || filtroForn || dataDe || dataAte || classe;
  const limpar = () => { setBusca(""); setFiltroForn(""); setDataDe(""); setDataAte(""); setClasse(""); };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div style={{ flex: "1 1 220px" }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Buscar</div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca em todos os campos…"
            className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div style={{ flex: "0 1 200px" }}>
          <div className="text-xs mb-1" style={{ color: C.sub }}>Fornecedor</div>
          <select value={filtroForn} onChange={(e) => setFiltroForn(e.target.value)} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option value="">Todos</option>
            {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome || "(sem nome comercial)"}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>NF de</div>
          <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>até</div>
          <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        {temFiltro && <button onClick={limpar} className="px-3 py-1.5 rounded text-sm" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Limpar</button>}
      </div>

      {modoEstoque && (
        <div className="flex flex-wrap gap-2 mb-3">
          {[["", "Todos"], ["TECIDO", "Tecidos"], ["MALHA", "Malhas"], ["AVIAMENTO", "Aviamentos"], ["OUTROS", "Outros"]].map(([k, l]) => {
            const on = classe === k;
            return (
              <button key={k || "todos"} onClick={() => setClasse(k)} className="px-3 py-1.5 rounded-md text-sm font-medium"
                style={{ background: on ? C.accent : C.panel, color: on ? "#fff" : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>{l}</button>
            );
          })}
        </div>
      )}

      {modoEstoque && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <ResumoCard rotulo="Total financeiro" valor={money(totais.v)} destaque />
            <ResumoCard rotulo="Total em metros" valor={fmtQtd(totais.m, "M")} />
            <ResumoCard rotulo="Total em kilos" valor={fmtQtd(totais.kg, "KG")} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {["TECIDO", "MALHA", "AVIAMENTO", "OUTROS"].map((k) => {
              const s = totais.seg[k];
              const fisico = [s.m > 0 ? fmtQtd(s.m, "M") : null, s.kg > 0 ? fmtQtd(s.kg, "KG") : null].filter(Boolean).join(" · ");
              return (
                <div key={k} className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <div className="text-xs font-semibold mb-1" style={{ color: C.sub, textTransform: "uppercase", letterSpacing: 0.3 }}>{s.rotulo}</div>
                  <div className="text-base font-bold" style={{ color: C.text }}>{money(s.v)}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.sub }}>{s.n} item(ns){fisico ? ` · ${fisico}` : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: C.sub }}>{lista.length} de {artigos.length} artigo(s) · clique na linha para editar, no título para ordenar</div>
        <div className="flex gap-2">
          {(() => { const g = gruposDuplicados(artigos); return g.length > 0 ? (
            <button onClick={() => setVerDup(true)} className="px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-1" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}><AlertTriangle size={14} /> Mesclar duplicados ({g.length})</button>
          ) : null; })()}
          <button onClick={() => setNovo((v) => !v)} className="px-3 py-1.5 rounded-md font-medium text-sm" style={{ background: novo ? C.panel : C.accent, color: novo ? C.sub : "#fff", border: `1px solid ${novo ? C.line : C.accent}` }}>{novo ? "Fechar" : "+ Novo artigo"}</button>
        </div>
      </div>

      {novo && <ArtigoForm fornecedores={fornecedores} master={master} onSaved={() => { setNovo(false); onSaved(); }} />}

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
        <div style={{ minWidth: modoEstoque ? 1620 : 1280, fontSize: 12, textTransform: "uppercase" }}>
        <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <ThSort label="Categoria" campoKey="categoria" sort={sort} onSort={onSort} className="w-24" />
          <ThSort label="Artigo NF" campoKey="nome" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Artigo Interno" campoKey="interno" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Fornecedor" campoKey="fornecedor" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Cor" campoKey="cor" sort={sort} onSort={onSort} className="w-28" />
          <ThSort label="Código" campoKey="codigo" sort={sort} onSort={onSort} className="w-24" />
          {modoEstoque && <ThSort label="Saldo" campoKey="quantidade" sort={sort} onSort={onSort} className="w-24" />}
          <div className="flex-1">Composição</div>
          <div className="w-20">Largura</div>
          <div className="w-28">Gram./Rend.</div>
          {modoEstoque && <div className="w-44">Movimento</div>}
          {modoEstoque && master && <ThSort label="Preço" campoKey="preco" sort={sort} onSort={onSort} className="w-24" />}
          {modoEstoque && master && <div className="w-28">Valor total</div>}
          {!modoEstoque && <div className="w-56">Última compra</div>}
        </div>
        {lista.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum artigo ainda. Clique em “Novo artigo”.</div>}
        {lista.map((a) => (
          <div key={a.id} onClick={() => setEditando(a)} className="flex px-4 py-3 items-center cursor-pointer" style={{ borderBottom: `1px solid ${C.line}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="w-24"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{a.categoria}</span></div>
            <div className="flex-1 font-medium">{a.nome}</div>
            <div className="flex-1" style={{ color: a.artigoInterno ? C.text : C.sub }}>{a.artigoInterno || "—"}</div>
            <div className="flex-1" style={{ color: a.fornecedor && !a.fornecedor.nome ? C.accent : C.sub }}>
              {a.fornecedor ? (a.fornecedor.nome || "⚠ definir nome") : "—"}
            </div>
            <div className="w-28 flex items-center gap-1" style={{ color: C.sub }}><Bolinha cor={a.cor} /> <span>{a.cor || "—"}</span></div>
            <div className="w-24" style={{ color: C.sub }}>{a.codigo || "—"}</div>
            {modoEstoque && <div className="w-24" style={{ color: C.sub }}>{a.quantidade != null ? fmtQtd(a.quantidade, a.unidade) : "—"}</div>}
            <div className="flex-1" style={{ color: C.sub }}>{a.composicao || "—"}</div>
            <div className="w-20" style={{ color: C.sub }}>{a.largura ? `${a.largura} m` : "—"}</div>
            <div className="w-28" style={{ color: C.sub }}>{gramRend(a)}</div>
            {modoEstoque && <div className="w-44" onClick={(e) => e.stopPropagation()}><MovimentoCell a={a} onOpen={() => setVerMov(a)} /></div>}
            {modoEstoque && master && <div className="w-24" style={{ color: C.accent }}>{a.valorUnitario ? money(Number(a.valorUnitario)) : "—"}</div>}
            {modoEstoque && master && <div className="w-28" style={{ color: C.text, fontWeight: 600 }}>{a.valorUnitario && a.quantidade != null ? money(Number(a.valorUnitario) * Number(a.quantidade)) : "—"}</div>}
            {!modoEstoque && (
              <div className="w-56" style={{ color: C.sub }}>
                {(master && a.valorUnitario) || ultimaCompraResto(a) ? (
                  <>
                    {master && a.valorUnitario && (
                      <span style={{ color: C.accent, fontWeight: 600 }}>{money(Number(a.valorUnitario))}</span>
                    )}
                    {master && a.valorUnitario && ultimaCompraResto(a) ? " · " : ""}
                    {ultimaCompraResto(a)}
                  </>
                ) : "—"}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      {editando && (
        <ArtigoEditModal artigo={editando} fornecedores={fornecedores} master={master}
          onClose={() => setEditando(null)} onSaved={() => { setEditando(null); onSaved(); }} />
      )}
      {verMov && <MovimentoModal artigo={verMov} onClose={() => setVerMov(null)} />}
      {verDup && <DuplicadosModal artigos={artigos} fornecedores={fornecedores} onClose={() => setVerDup(false)} onSaved={onSaved} />}
    </div>
  );
}

function DuplicadosModal({ artigos, fornecedores, onClose, onSaved }) {
  const grupos = gruposDuplicados(artigos);
  const [mesclando, setMesclando] = useState(null);
  const [erro, setErro] = useState("");
  const nomeForn = (id) => fornecedores.find((f) => f.id === id)?.nome || "(sem nome comercial)";
  const fmt = (a) => `${Number(a.quantidade || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${a.unidade || ""}`;

  const mesclar = async (grupo) => {
    setErro("");
    const ordenados = [...grupo].sort((a, b) => a.id - b.id);
    const manter = ordenados[0];
    setMesclando(manter.id);
    for (const rem of ordenados.slice(1)) {
      const r = await fetch("/api/artigos/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ manterId: manter.id, removerId: rem.id }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErro(j.error || "Erro ao mesclar."); setMesclando(null); return; }
    }
    setMesclando(null);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold">Artigos duplicados</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5">
          <div className="text-xs mb-3" style={{ color: C.sub }}>Mesmo fornecedor + mesmo nome (Artigo NF) + mesma cor + mesmo valor. Mesclar soma o saldo em um só (mantém o mais antigo) e inativa os outros. O histórico de entradas/saídas é preservado.</div>
          {grupos.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Nenhum duplicado encontrado ✓</div>}
          {grupos.map((g, i) => (
            <div key={i} className="rounded-lg mb-3" style={{ border: `1px solid ${C.line}` }}>
              <div className="px-3 py-2 text-xs font-semibold flex items-center justify-between" style={{ background: C.panel2, color: C.sub }}>
                <span>{g[0].nome} · {g[0].cor || "sem cor"} · {nomeForn(g[0].fornecedorId)}</span>
                <button onClick={() => mesclar(g)} disabled={mesclando === g[0].id} className="px-3 py-1 rounded text-xs font-medium" style={{ background: C.accent, color: "#fff", opacity: mesclando === g[0].id ? 0.6 : 1 }}>{mesclando === g[0].id ? "Mesclando…" : "Mesclar em 1"}</button>
              </div>
              {g.map((a) => (
                <div key={a.id} className="px-3 py-2 flex items-center gap-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{a.categoria}</span>
                  <span style={{ color: C.text }}>{a.nome}</span>
                  <span className="flex items-center gap-1" style={{ color: C.sub }}><Bolinha cor={a.cor} /> {a.cor || "—"}</span>
                  <span style={{ color: C.sub, marginLeft: "auto" }}>saldo {fmt(a)}{a.valorUnitario ? ` · R$ ${Number(a.valorUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}</span>
                </div>
              ))}
            </div>
          ))}
          {erro && <div className="text-xs mt-2" style={{ color: "#D64545" }}>{erro}</div>}
        </div>
      </div>
    </div>
  );
}

function ArtigoEditModal({ artigo, fornecedores, master, onClose, onSaved }) {
  const val = (v) => (v === null || v === undefined ? "" : String(v));
  const [f, setF] = useState({
    categoria: artigo.categoria || "MALHA",
    fornecedorId: artigo.fornecedorId ? String(artigo.fornecedorId) : "",
    nome: val(artigo.nome), artigoInterno: val(artigo.artigoInterno), cor: val(artigo.cor),
    codigo: val(artigo.codigo),
    quantidade: val(artigo.quantidade),
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
              {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome || "(sem nome comercial)"}</option>)}
            </Sel>
            <In label="Artigo NF (vem da nota)" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
            <In label="Artigo Interno" value={f.artigoInterno} onChange={(e) => set("artigoInterno", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <InCor label="Cor" value={f.cor} onChange={(e) => set("cor", e.target.value)} />
            <In label="Código" value={f.codigo} onChange={(e) => set("codigo", e.target.value)} />
            <In label="Quantidade" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} inputMode="decimal" />
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

function ultimaCompraResto(a) {
  const partes = [];
  if (a.dataCompra) partes.push(fmtData(a.dataCompra));
  if (a.nf?.numero) partes.push("NF " + a.nf.numero);
  return partes.join(" · ");
}
function gramRend(a) {
  if (a.categoria === "MALHA") return a.rendimento ? `Rend. ${a.rendimento}` : "—";
  if (a.categoria === "TECIDO") return a.gramatura ? `${a.gramatura} g/m²` : "—";
  return a.especificacao || "—";
}
function detalheArtigo(a) {
  if (a.categoria === "MALHA")
    return [a.tipoMalha, a.composicao, a.largura && `${a.largura} m`, a.rendimento && `rend. ${a.rendimento}`].filter(Boolean).join(" · ") || "—";
  if (a.categoria === "TECIDO")
    return [a.composicao, a.largura && `${a.largura} m`, a.gramatura && `${a.gramatura} g/m²`].filter(Boolean).join(" · ") || "—";
  return [a.especificacao, a.unidade].filter(Boolean).join(" · ") || "—";
}

function MovimentoCell({ a, onOpen }) {
  const m = a.movimentacoes && a.movimentacoes[0];
  if (!m) return <span style={{ color: C.line }}>—</span>;
  const entrada = m.tipo === "ENTRADA" || m.tipo === "RETORNO";
  const doc = m.nf ? `NF ${m.nf.numero}` : m.fme ? `FME ${m.fme.numero}` : "—";
  return (
    <button onClick={onOpen} className="flex items-center gap-1 text-left w-full" title="Ver histórico de movimentação">
      <span style={{ color: entrada ? C.green : "#D64545", fontWeight: 700 }}>{entrada ? "↑" : "↓"}</span>
      <span style={{ color: C.text }}>{doc}</span>
      <span style={{ color: C.sub }}>· {fmtQtd(m.quantidade, a.unidade)}</span>
    </button>
  );
}

function MovimentoModal({ artigo, onClose }) {
  const [movs, setMovs] = useState(null);
  useEffect(() => {
    fetch(`/api/artigos/${artigo.id}/movimentos`).then((r) => r.json()).then((d) => setMovs(Array.isArray(d) ? d : [])).catch(() => setMovs([]));
  }, [artigo.id]);
  const dh = (v) => { const d = new Date(v); return isNaN(d) ? "—" : d.toLocaleString("pt-BR"); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 760, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div>
            <div className="font-semibold">Movimentação — {artigo.artigoInterno || artigo.nome}</div>
            <div className="text-xs" style={{ color: C.sub }}>Saldo atual: <b style={{ color: C.accent }}>{fmtQtd(artigo.quantidade, artigo.unidade)}</b></div>
          </div>
          <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
        </div>
        <div className="p-5">
          {movs === null ? <div style={{ color: C.sub }}>Carregando…</div> : movs.length === 0 ? (
            <div className="text-sm" style={{ color: C.sub }}>Sem movimentações registradas.</div>
          ) : (
            <div style={{ border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
              <div className="flex px-3 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
                <div className="w-40">Data/hora</div><div className="w-24">Tipo</div><div className="flex-1">Documento</div>
                <div className="w-28">Quantidade</div><div className="w-28">Responsável</div><div className="w-20 text-center">Arquivo</div>
              </div>
              {movs.map((m) => {
                const entrada = m.tipo === "ENTRADA" || m.tipo === "RETORNO";
                const doc = m.nf ? `NF ${m.nf.numero}` : m.fme ? `FME ${m.fme.numero}` : "—";
                return (
                  <div key={m.id} className="flex px-3 py-2 items-center text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
                    <div className="w-40" style={{ color: C.sub }}>{dh(m.createdAt)}</div>
                    <div className="w-24" style={{ color: entrada ? C.green : "#D64545", fontWeight: 600 }}>{entrada ? "↑ Entrada" : "↓ Saída"}</div>
                    <div className="flex-1">{doc}</div>
                    <div className="w-28" style={{ color: C.sub }}>{fmtQtd(m.quantidade, artigo.unidade)}</div>
                    <div className="w-28" style={{ color: C.sub }}>{m.perfil || "—"}</div>
                    <div className="w-20 text-center flex items-center justify-center gap-1">
                      {m.nf?.temPdf ? <a href={`/api/nf/${m.nf.id}/pdf`} title="PDF" style={{ color: "#D64545", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>PDF</a> : null}
                      {m.nf?.temXml ? <a href={`/api/nf/${m.nf.id}/xml`} title="XML" style={{ color: C.blue, fontWeight: 700, fontSize: 11, textDecoration: "none" }}>XML</a> : null}
                      {!m.nf ? <span style={{ color: C.line }}>—</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex justify-end px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function ArtigoForm({ fornecedores, master, onSaved }) {
  const [f, setF] = useState({ categoria: "MALHA", fornecedorId: "", nome: "", artigoInterno: "", cor: "", codigo: "", quantidade: "", tipoMalha: "TUBULAR", composicao: "", largura: "", rendimento: "", gramatura: "", especificacao: "", unidade: "UN", valorUnitario: "" });
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
          {fornecedores.map((x) => <option key={x.id} value={x.id}>{x.nome || "(sem nome comercial)"}</option>)}
        </Sel>
        <In label="Artigo NF (vem da nota)" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome como consta na NF" />
        <In label="Artigo Interno" value={f.artigoInterno} onChange={(e) => set("artigoInterno", e.target.value)} placeholder="Seu nome padrão" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <InCor label="Cor" value={f.cor} onChange={(e) => set("cor", e.target.value)} />
        <In label="Código" value={f.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Código do artigo/cor" />
        <In label="Quantidade" value={f.quantidade} onChange={(e) => set("quantidade", e.target.value)} inputMode="decimal" placeholder="Qtde da NF" />
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
/* ============================================================
   BANCO DE DADOS — Clientes / Fornecedores
   ============================================================ */
function BancoDados({ master, money, perfil }) {
  const [aba, setAba] = useState("clientes");
  const [fornecedores, setFornecedores] = useState([]);
  const carregarForn = async () => {
    try { const f = await fetch("/api/fornecedores").then((r) => r.json()); setFornecedores(Array.isArray(f) ? f : []); } catch {}
  };
  useEffect(() => { carregarForn(); }, []);
  return (
    <div>
      <div className="flex gap-1 mb-5">
        {[["clientes", "Clientes"], ["fornecedores", "Fornecedores"]].map(([k, l]) => {
          const on = aba === k;
          return (
            <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm"
              style={{ background: on ? C.accentSoft : C.panel, color: on ? C.accent : C.sub, border: `1px solid ${on ? C.accent : C.line}` }}>{l}</button>
          );
        })}
      </div>
      {aba === "clientes"
        ? <ClientesPane master={master} money={money} />
        : <FornecedoresBancoPane master={master} money={money} perfil={perfil} />}
    </div>
  );
}

function ClientesPane({ master, money }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroUf, setFiltroUf] = useState("");
  const [sort, setSort] = useState({ key: "razaoSocial", dir: "asc" });
  const [verHist, setVerHist] = useState(null);
  const [editando, setEditando] = useState(null); // objeto cliente ou {} p/ novo
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [prog, setProg] = useState("");
  const [msg, setMsg] = useState(null);

  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const carregar = async () => {
    setLoading(true);
    try { const c = await fetch("/api/clientes").then((r) => r.json()); setClientes(Array.isArray(c) ? c : []); } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const ufs = [...new Set(clientes.map((c) => c.uf).filter(Boolean))].sort();

  const filtrados = (() => {
    const tokens = norm(busca).trim().split(/\s+/).filter(Boolean);
    let l = clientes.filter((c) => {
      if (filtroUf && c.uf !== filtroUf) return false;
      if (!tokens.length) return true;
      const hay = norm([c.razaoSocial, c.nomeFantasia, c.cnpj, c.municipio, c.uf, c.preposto, c.telefones, c.emailNf].filter(Boolean).join(" "));
      return tokens.every((t) => hay.includes(t));
    });
    const getv = sort.key === "notas" ? (c) => c._count?.notas ?? 0 : (c) => c[sort.key];
    return ordenar(l, getv, sort.dir, sort.key === "notas" ? "num" : "texto");
  })();

  const readText = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(fr.result); fr.readAsText(file); });
  const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });

  const importar = async (files) => {
    const arr = Array.from(files || []).filter(Boolean);
    const xmls = arr.filter((f) => /\.xml$/i.test(f.name));
    const plan = arr.find((f) => /\.(xlsx|xls|csv)$/i.test(f.name));
    if (!xmls.length && !plan) { setMsg({ tipo: "erro", texto: "Solte os XMLs e/ou a planilha (.xlsx/.csv)." }); return; }
    setMsg(null); setEnviando(true);
    let tot = { clientesNovos: 0, clientesAtualizados: 0, notasNovas: 0, notasDup: 0, erros: 0 };
    try {
      const LOTE = 40;
      for (let i = 0; i < xmls.length; i += LOTE) {
        const chunk = xmls.slice(i, i + LOTE);
        setProg(`Lendo XMLs ${Math.min(i + LOTE, xmls.length)}/${xmls.length}…`);
        const payload = { tipo: "xml", xmls: await Promise.all(chunk.map(async (f) => ({ name: f.name, conteudo: await readText(f) }))) };
        const r = await fetch("/api/clientes/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const d = await r.json();
        if (r.ok) for (const k of Object.keys(tot)) tot[k] += d[k] || 0;
      }
      let planTxt = "";
      if (plan) {
        setProg("Cruzando com a planilha…");
        const r = await fetch("/api/clientes/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "planilha", name: plan.name, base64: await readB64(plan) }) });
        const d = await r.json();
        if (r.ok) planTxt = ` · planilha: ${d.atualizados} cadastro(s) atualizado(s)${d.semMatch ? `, ${d.semMatch} sem correspondência` : ""}`;
        else planTxt = ` · planilha: ${d.error}`;
      }
      const partes = [];
      if (xmls.length) partes.push(`${tot.clientesNovos} cliente(s) novo(s), ${tot.notasNovas} nota(s) importada(s)`);
      if (tot.notasDup) partes.push(`${tot.notasDup} já existiam`);
      if (tot.erros) partes.push(`${tot.erros} XML(s) com erro`);
      setMsg({ tipo: "ok", texto: (partes.join(" · ") || "Concluído") + planTxt + "." });
      carregar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e.message });
    }
    setEnviando(false); setProg("");
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer.files); }}
        className="rounded-lg p-5 mb-5 text-center"
        style={{ background: arrastando ? C.accentSoft : C.panel, border: `1.5px dashed ${arrastando ? C.accent : C.line}` }}>
        <div className="text-sm mb-2" style={{ color: C.sub }}>
          Arraste os <b>XMLs das notas emitidas</b> e a <b>planilha de dados</b> aqui, ou selecione:
        </div>
        <label className="inline-block px-4 py-2 rounded font-semibold cursor-pointer" style={{ background: C.accent, color: "#fff" }}>
          {enviando ? (prog || "Importando…") : "Selecionar arquivos"}
          <input type="file" multiple accept=".xml,.xlsx,.xls,.csv" className="hidden"
            onChange={(e) => importar(e.target.files)} disabled={enviando} />
        </label>
        {msg && <div className="text-xs mt-3" style={{ color: msg.tipo === "ok" ? C.green : "#D64545" }}>{msg.texto}</div>}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex-1 min-w-64">
          <div className="text-xs mb-1" style={{ color: C.sub }}>Buscar</div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente, CNPJ, cidade…"
            className="w-full px-3 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>UF</div>
          <select value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option value="">Todas</option>
            {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <button onClick={() => setEditando({})} className="px-4 py-2 rounded font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      <div className="text-xs mb-2" style={{ color: C.sub }}>{filtrados.length} de {clientes.length} cliente(s) · clique no nome para editar, no número de notas para ver o histórico</div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
        <div className="flex px-4 py-2 text-xs font-semibold min-w-[900px]" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <ThSort label="Razão social" campoKey="razaoSocial" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Nome fantasia" campoKey="nomeFantasia" sort={sort} onSort={onSort} className="w-40" />
          <div className="w-40">CNPJ</div>
          <div className="w-24">IE</div>
          <ThSort label="Cidade/UF" campoKey="municipio" sort={sort} onSort={onSort} className="w-40" />
          <div className="w-32">Preposto</div>
          <div className="w-36">Telefone(s)</div>
          <div className="w-48">E-mail NF/Boletos</div>
          <ThSort label="Notas" campoKey="notas" sort={sort} onSort={onSort} className="w-16 text-right" />
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum cliente. Importe os XMLs acima.</div>
        ) : filtrados.map((c) => (
          <div key={c.id} onClick={() => setEditando(c)} className="flex px-4 py-3 items-center cursor-pointer text-sm min-w-[900px]"
            style={{ borderBottom: `1px solid ${C.line}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="flex-1 font-medium">{c.razaoSocial || "—"}</div>
            <div className="w-40" style={{ color: c.nomeFantasia ? C.text : C.sub }}>{c.nomeFantasia || "—"}</div>
            <div className="w-40" style={{ color: C.sub }}>{fmtCnpj(c.cnpj)}</div>
            <div className="w-24" style={{ color: C.sub }}>{c.inscricaoEstadual || "—"}</div>
            <div className="w-40" style={{ color: C.sub }}>{c.municipio ? `${c.municipio}${c.uf ? "/" + c.uf : ""}` : "—"}</div>
            <div className="w-32" style={{ color: C.sub }}>{c.preposto || "—"}</div>
            <div className="w-36" style={{ color: C.sub }}>{c.telefones || "—"}</div>
            <div className="w-48 truncate" style={{ color: C.sub }} title={c.emailNf || ""}>{c.emailNf || "—"}</div>
            <button onClick={(e) => { e.stopPropagation(); setVerHist(c); }} title="Ver histórico de compras"
              className="w-16 text-right" style={{ color: C.accent, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>{c._count?.notas ?? 0}</button>
          </div>
        ))}
      </div>

      {verHist && <ClienteHistoricoModal cliente={verHist} master={master} money={money} onClose={() => setVerHist(null)} onChanged={carregar} />}
      {editando && <ClienteEditModal cliente={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); carregar(); }} />}
    </div>
  );
}

function ClienteHistoricoModal({ cliente, master, money, onClose, onChanged }) {
  const [notas, setNotas] = useState(null);
  const recarregar = () => fetch(`/api/clientes/${cliente.id}/notas`).then((r) => r.json()).then((d) => setNotas(Array.isArray(d) ? d : [])).catch(() => setNotas([]));
  useEffect(() => { recarregar(); }, [cliente.id]);
  const excluir = async (n) => {
    if (!confirm(`Excluir a nota NF ${n.numero || ""} deste cliente?`)) return;
    const r = await fetch(`/api/cliente-notas/${n.id}`, { method: "DELETE" });
    if (r.ok) { recarregar(); onChanged && onChanged(); }
  };
  const data = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR"); };
  const total = notas && master ? notas.reduce((s, n) => s + (n.valorTotal || 0), 0) : 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 820, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">{cliente.razaoSocial || cliente.nomeFantasia}</div>
            <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
          </div>
          <div className="text-xs mt-0.5" style={{ color: C.sub }}>
            {fmtCnpj(cliente.cnpj)}{cliente.municipio ? ` · ${cliente.municipio}${cliente.uf ? "/" + cliente.uf : ""}` : ""}
            {master && notas ? <> · Total comprado: <b style={{ color: C.accent }}>{money(total)}</b></> : null}
          </div>
        </div>
        <div className="p-5">
          <div className="font-semibold text-sm mb-2">Histórico de compras</div>
          {notas === null ? <div style={{ color: C.sub }}>Carregando…</div> : notas.length === 0 ? (
            <div className="text-sm" style={{ color: C.sub }}>Sem compras registradas.</div>
          ) : (
            <div style={{ border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
              <div className="flex px-3 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
                <div className="w-32">Pedido de venda</div>
                <div className="w-28">Nota</div>
                <div className="w-32">Data</div>
                <div className="flex-1 text-right">Valor</div>
                <div className="w-10"></div>
              </div>
              {notas.map((n) => (
                <div key={n.id} className="flex px-3 py-2 items-center text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
                  <div className="w-32">{n.pedidoVenda || "—"}</div>
                  <div className="w-28" style={{ color: C.sub }}>NF {n.numero || "—"}</div>
                  <div className="w-32" style={{ color: C.sub }}>{data(n.dataEmissao)}</div>
                  <div className="flex-1 text-right" style={{ color: master ? C.text : C.sub }}>{master ? (n.valorTotal != null ? money(n.valorTotal) : "—") : "•••••"}</div>
                  <button onClick={() => excluir(n)} title="Excluir esta nota" className="w-10 flex justify-end" style={{ color: "#C77" }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function ClienteEditModal({ cliente, onClose, onSaved }) {
  const novo = !cliente.id;
  const v = (x) => (x == null ? "" : String(x));
  const [f, setF] = useState({
    razaoSocial: v(cliente.razaoSocial), nomeFantasia: v(cliente.nomeFantasia),
    cnpj: v(cliente.cnpj), inscricaoEstadual: v(cliente.inscricaoEstadual),
    logradouro: v(cliente.logradouro), numero: v(cliente.numero), complemento: v(cliente.complemento),
    bairro: v(cliente.bairro), municipio: v(cliente.municipio), uf: v(cliente.uf), cep: v(cliente.cep),
    preposto: v(cliente.preposto), telefones: v(cliente.telefones), emailNf: v(cliente.emailNf), obs: v(cliente.obs),
  });
  const set = (k, val) => setF((s) => ({ ...s, [k]: val }));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    setErro("");
    if (!f.cnpj.replace(/\D/g, "")) return setErro("Informe o CNPJ.");
    setSalvando(true);
    const url = novo ? "/api/clientes" : `/api/clientes/${cliente.id}`;
    const r = await fetch(url, { method: novo ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 760, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="font-semibold">{novo ? "Novo cliente" : (f.razaoSocial || "Editar cliente")}</div>
          <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <In label="Razão social" value={f.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
            <In label="Nome fantasia" value={f.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
            <In label="CNPJ" value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            <In label="Inscrição estadual" value={f.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
          </div>

          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>ENDEREÇO COMPLETO</div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-4"><In label="Logradouro" value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></div>
            <div className="col-span-1"><In label="Número" value={f.numero} onChange={(e) => set("numero", e.target.value)} /></div>
            <div className="col-span-1"><In label="CEP" value={f.cep} onChange={(e) => set("cep", e.target.value)} /></div>
            <div className="col-span-2"><In label="Complemento" value={f.complemento} onChange={(e) => set("complemento", e.target.value)} /></div>
            <div className="col-span-2"><In label="Bairro" value={f.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div className="col-span-1"><In label="Município" value={f.municipio} onChange={(e) => set("municipio", e.target.value)} /></div>
            <div className="col-span-1"><In label="UF" value={f.uf} onChange={(e) => set("uf", e.target.value)} /></div>
          </div>

          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>CONTATO</div>
          <div className="grid grid-cols-2 gap-3">
            <In label="Preposto (contato)" value={f.preposto} onChange={(e) => set("preposto", e.target.value)} />
            <In label="Telefone(s)" value={f.telefones} onChange={(e) => set("telefones", e.target.value)} placeholder="Separe vários por ;" />
            <div className="col-span-2"><In label="E-mail p/ NFs e Boletos" value={f.emailNf} onChange={(e) => set("emailNf", e.target.value)} /></div>
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: C.sub }}>Observações</div>
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
          </div>

          {erro && <div className="text-xs" style={{ color: "#D64545" }}>{erro}</div>}
        </div>
        <div className="flex justify-between items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <div>
            {!novo && (
              <button onClick={async () => {
                if (!confirm(`Excluir o cliente "${f.razaoSocial || cliente.nomeFantasia || cliente.cnpj}" e todo o seu histórico? Esta ação não pode ser desfeita.`)) return;
                const r = await fetch(`/api/clientes/${cliente.id}`, { method: "DELETE" });
                if (r.ok) onSaved(); else setErro("Não foi possível excluir.");
              }} className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ color: "#D64545", border: `1px solid #F1C7C7` }}>
                <Trash2 size={15} /> Excluir cliente
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FornecedoresBancoPane({ master, money, perfil }) {
  const [forns, setForns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroUf, setFiltroUf] = useState("");
  const [sort, setSort] = useState({ key: "nome", dir: "asc" });
  const [verMov, setVerMov] = useState(null);
  const [editando, setEditando] = useState(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [prog, setProg] = useState("");
  const [msg, setMsg] = useState(null);

  const norm = (s) => (s == null ? "" : String(s)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const carregar = async () => {
    setLoading(true);
    try { const f = await fetch("/api/fornecedores").then((r) => r.json()); setForns(Array.isArray(f) ? f : []); } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const ufs = [...new Set(forns.map((f) => f.uf).filter(Boolean))].sort();

  const filtrados = (() => {
    const tokens = norm(busca).trim().split(/\s+/).filter(Boolean);
    let l = forns.filter((f) => {
      if (filtroUf && f.uf !== filtroUf) return false;
      if (!tokens.length) return true;
      const cnpjTxt = (f.cnpjs || []).map((c) => c.cnpj).join(" ");
      const hay = norm([f.nome, f.razaoSocial, f.nomeFantasia, cnpjTxt, f.municipio, f.uf, f.preposto, f.telefones, f.emailNf].filter(Boolean).join(" "));
      return tokens.every((t) => hay.includes(t));
    });
    const getv = sort.key === "compras" ? (f) => f._count?.nfs ?? 0 : (f) => f[sort.key];
    return ordenar(l, getv, sort.dir, sort.key === "compras" ? "num" : "texto");
  })();

  const readText = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(fr.result); fr.readAsText(file); });
  const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1]); fr.readAsDataURL(file); });

  const importar = async (files) => {
    const arr = Array.from(files || []).filter(Boolean);
    const xmls = arr.filter((f) => /\.xml$/i.test(f.name));
    const pdfs = arr.filter((f) => /\.pdf$/i.test(f.name));
    if (!xmls.length) { setMsg({ tipo: "erro", texto: "Solte os XMLs das notas de compra." }); return; }
    setMsg(null); setEnviando(true);
    let novas = 0, existentes = 0, artigos = 0, recusadas = 0, erros = 0, primeiroErro = "";
    try {
      for (let i = 0; i < xmls.length; i++) {
        setProg(`Importando ${i + 1}/${xmls.length}…`);
        const x = xmls[i];
        const base = x.name.replace(/\.xml$/i, "");
        const pdf = pdfs.find((p) => p.name.replace(/\.pdf$/i, "") === base);
        const payload = { tipo: "xml", conteudo: await readText(x), pdfBase64: pdf ? await readB64(pdf) : null, perfil, usuarioId: sessaoId() };
        const r = await fetch("/api/nf/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        let d = {};
        try { const t = await r.text(); d = t ? JSON.parse(t) : {}; } catch { d = { error: `Resposta inválida (HTTP ${r.status})` }; }
        if (!r.ok) { if (/venda|recusad|não era|nao era/i.test(d.error || "")) recusadas++; else { erros++; if (!primeiroErro) primeiroErro = `${x.name}: ${d.error || "HTTP " + r.status}`; } }
        else { if (d.jaExistia) existentes++; else novas++; artigos += d.artigosCriados || 0; }
      }
      const partes = [`${novas} nota(s) nova(s)`];
      if (existentes) partes.push(`${existentes} já existentes`);
      if (artigos) partes.push(`${artigos} artigo(s) criado(s)`);
      if (recusadas) partes.push(`${recusadas} não eram compra`);
      if (erros) partes.push(`${erros} com erro`);
      setMsg({ tipo: erros ? "erro" : "ok", texto: partes.join(" · ") + "." + (primeiroErro ? ` 1º erro → ${primeiroErro}` : "") });
      carregar();
    } catch (e) { setMsg({ tipo: "erro", texto: e.message }); }
    setEnviando(false); setProg("");
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); importar(e.dataTransfer.files); }}
        className="rounded-lg p-5 mb-5 text-center"
        style={{ background: arrastando ? C.accentSoft : C.panel, border: `1.5px dashed ${arrastando ? C.accent : C.line}` }}>
        <div className="text-sm mb-2" style={{ color: C.sub }}>
          Arraste os <b>XMLs das notas de compra</b> (PDF opcional) aqui, ou selecione. Entra aqui, reflete em Artigos, Estoque e Notas Fiscais.
        </div>
        <label className="inline-block px-4 py-2 rounded font-semibold cursor-pointer" style={{ background: C.accent, color: "#fff" }}>
          {enviando ? (prog || "Importando…") : "Selecionar arquivos"}
          <input type="file" multiple accept=".xml,.pdf" className="hidden" onChange={(e) => importar(e.target.files)} disabled={enviando} />
        </label>
        {msg && <div className="text-xs mt-3" style={{ color: msg.tipo === "ok" ? C.green : "#D64545" }}>{msg.texto}</div>}
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex-1 min-w-64">
          <div className="text-xs mb-1" style={{ color: C.sub }}>Buscar</div>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, razão social, CNPJ, cidade…"
            className="w-full px-3 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
        </div>
        <div>
          <div className="text-xs mb-1" style={{ color: C.sub }}>UF</div>
          <select value={filtroUf} onChange={(e) => setFiltroUf(e.target.value)} className="px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
            <option value="">Todas</option>
            {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <button onClick={() => setEditando({})} className="px-4 py-2 rounded font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={16} /> Novo fornecedor
        </button>
      </div>

      <div className="text-xs mb-2" style={{ color: C.sub }}>{filtrados.length} de {forns.length} fornecedor(es) · clique no nome para editar, no número de compras para ver o histórico</div>
      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
        <div className="flex px-4 py-2 text-xs font-semibold min-w-[920px]" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <ThSort label="Fornecedor (nome comercial)" campoKey="nome" sort={sort} onSort={onSort} className="flex-1" />
          <ThSort label="Razão social" campoKey="razaoSocial" sort={sort} onSort={onSort} className="w-48" />
          <div className="w-40">CNPJ</div>
          <div className="w-24">IE</div>
          <ThSort label="Cidade/UF" campoKey="municipio" sort={sort} onSort={onSort} className="w-36" />
          <div className="w-36">Telefone(s)</div>
          <ThSort label="Compras" campoKey="compras" sort={sort} onSort={onSort} className="w-20 text-right" />
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum fornecedor. Importe XMLs de compra acima.</div>
        ) : filtrados.map((f) => (
          <div key={f.id} onClick={() => setEditando(f)} className="flex px-4 py-3 items-center cursor-pointer text-sm min-w-[920px]"
            style={{ borderBottom: `1px solid ${C.line}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.panel2)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="flex-1 font-medium" style={{ color: f.nome ? C.text : C.accent }}>{f.nome || "⚠ definir nome"}</div>
            <div className="w-48" style={{ color: C.sub }}>{f.razaoSocial || "—"}</div>
            <div className="w-40" style={{ color: C.sub }}>{f.cnpjs?.[0] ? fmtCnpj(f.cnpjs[0].cnpj) : "—"}{f.cnpjs?.length > 1 ? ` +${f.cnpjs.length - 1}` : ""}</div>
            <div className="w-24" style={{ color: C.sub }}>{f.inscricaoEstadual || "—"}</div>
            <div className="w-36" style={{ color: C.sub }}>{f.municipio ? `${f.municipio}${f.uf ? "/" + f.uf : ""}` : "—"}</div>
            <div className="w-36" style={{ color: C.sub }}>{f.telefones || f.telefone || "—"}</div>
            <button onClick={(e) => { e.stopPropagation(); setVerMov(f); }} title="Ver histórico de compras"
              className="w-20 text-right" style={{ color: C.accent, fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>{f._count?.nfs ?? 0}</button>
          </div>
        ))}
      </div>

      {editando && <FornecedorFullModal fornecedor={editando} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); carregar(); }} />}
      {verMov && <FornecedorMovModal fornecedor={verMov} master={master} money={money} onClose={() => setVerMov(null)} onChanged={carregar} />}
    </div>
  );
}

function FornecedorFullModal({ fornecedor, onClose, onSaved }) {
  const novo = !fornecedor.id;
  const v = (x) => (x == null ? "" : String(x));
  const [f, setF] = useState({
    nome: v(fornecedor.nome), razaoSocial: v(fornecedor.razaoSocial), nomeFantasia: v(fornecedor.nomeFantasia),
    inscricaoEstadual: v(fornecedor.inscricaoEstadual),
    logradouro: v(fornecedor.logradouro), numero: v(fornecedor.numero), complemento: v(fornecedor.complemento),
    bairro: v(fornecedor.bairro), municipio: v(fornecedor.municipio), uf: v(fornecedor.uf), cep: v(fornecedor.cep),
    preposto: v(fornecedor.preposto), telefones: v(fornecedor.telefones), emailNf: v(fornecedor.emailNf), obs: v(fornecedor.obs),
  });
  const [cnpjs, setCnpjs] = useState(fornecedor.cnpjs?.length ? fornecedor.cnpjs.map((c) => ({ cnpj: c.cnpj, razaoSocial: c.razaoSocial || "" })) : [{ cnpj: "", razaoSocial: "" }]);
  const set = (k, val) => setF((s) => ({ ...s, [k]: val }));
  const setC = (i, campo, val) => setCnpjs((cs) => cs.map((c, j) => (j === i ? { ...c, [campo]: val } : c)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const salvar = async () => {
    setErro("");
    if (!f.nome.trim()) return setErro("Informe o nome comercial.");
    setSalvando(true);
    const payload = { ...f, cnpjs };
    const url = novo ? "/api/fornecedores" : `/api/fornecedores/${fornecedor.id}`;
    const r = await fetch(url, { method: novo ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSalvando(false);
    if (!r.ok) { const e = await r.json().catch(() => ({})); return setErro(e.error || "Erro ao salvar."); }
    onSaved();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 760, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="font-semibold">{novo ? "Novo fornecedor" : (f.nome || "Editar fornecedor")}</div>
          <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <In label="Nome comercial" value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Malharia SP" />
            <In label="Nome fantasia" value={f.nomeFantasia} onChange={(e) => set("nomeFantasia", e.target.value)} />
            <In label="Razão social" value={f.razaoSocial} onChange={(e) => set("razaoSocial", e.target.value)} />
            <In label="Inscrição estadual" value={f.inscricaoEstadual} onChange={(e) => set("inscricaoEstadual", e.target.value)} />
          </div>

          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>CNPJ(s)</div>
          {cnpjs.map((c, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <In label={i === 0 ? "CNPJ" : ""} value={c.cnpj} onChange={(e) => setC(i, "cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
              <In label={i === 0 ? "Razão social do CNPJ" : ""} value={c.razaoSocial} onChange={(e) => setC(i, "razaoSocial", e.target.value)} />
            </div>
          ))}
          <button onClick={() => setCnpjs((cs) => [...cs, { cnpj: "", razaoSocial: "" }])} className="text-xs" style={{ color: C.accent }}>+ adicionar outro CNPJ</button>

          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>ENDEREÇO COMPLETO</div>
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-4"><In label="Logradouro" value={f.logradouro} onChange={(e) => set("logradouro", e.target.value)} /></div>
            <div className="col-span-1"><In label="Número" value={f.numero} onChange={(e) => set("numero", e.target.value)} /></div>
            <div className="col-span-1"><In label="CEP" value={f.cep} onChange={(e) => set("cep", e.target.value)} /></div>
            <div className="col-span-2"><In label="Complemento" value={f.complemento} onChange={(e) => set("complemento", e.target.value)} /></div>
            <div className="col-span-2"><In label="Bairro" value={f.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div className="col-span-1"><In label="Município" value={f.municipio} onChange={(e) => set("municipio", e.target.value)} /></div>
            <div className="col-span-1"><In label="UF" value={f.uf} onChange={(e) => set("uf", e.target.value)} /></div>
          </div>

          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>CONTATO</div>
          <div className="grid grid-cols-2 gap-3">
            <In label="Preposto (contato)" value={f.preposto} onChange={(e) => set("preposto", e.target.value)} />
            <In label="Telefone(s)" value={f.telefones} onChange={(e) => set("telefones", e.target.value)} placeholder="Separe vários por ;" />
            <div className="col-span-2"><In label="E-mail p/ NFs e Boletos" value={f.emailNf} onChange={(e) => set("emailNf", e.target.value)} /></div>
          </div>

          <div>
            <div className="text-xs mb-1" style={{ color: C.sub }}>Observações</div>
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
          </div>

          {erro && <div className="text-xs" style={{ color: "#D64545" }}>{erro}</div>}
        </div>
        <div className="flex justify-between items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <div>
            {!novo && (
              <button onClick={async () => {
                if (!confirm(`Inativar o fornecedor "${f.nome || fornecedor.razaoSocial}"? Ele sai da lista; as notas de compra e artigos permanecem no sistema.`)) return;
                const r = await fetch(`/api/fornecedores/${fornecedor.id}`, { method: "DELETE" });
                if (r.ok) onSaved(); else setErro("Não foi possível excluir.");
              }} className="px-3 py-2 rounded flex items-center gap-1 text-sm" style={{ color: "#D64545", border: `1px solid #F1C7C7` }}>
                <Trash2 size={15} /> Inativar fornecedor
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FornecedorMovModal({ fornecedor, master, money, onClose, onChanged }) {
  const [dados, setDados] = useState(null);
  const recarregar = () => fetch(`/api/fornecedores/${fornecedor.id}/nfs`).then((r) => r.json()).then(setDados).catch(() => setDados({ linhas: [] }));
  useEffect(() => { recarregar(); }, [fornecedor.id]);
  const excluir = async (n) => {
    if (!confirm(`Excluir a NF ${n.numero} desta compra? O saldo em estoque dos artigos desta nota será revertido. Esta ação não pode ser desfeita.`)) return;
    const r = await fetch(`/api/nf/${n.id}`, { method: "DELETE" });
    if (r.ok) { recarregar(); onChanged && onChanged(); }
    else alert("Não foi possível excluir a NF.");
  };
  const data = (v) => { if (!v) return "—"; const d = new Date(v); return isNaN(d) ? "—" : d.toLocaleDateString("pt-BR"); };
  const nBR = (n) => Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(3,10,22,0.55)", zIndex: 50 }} className="flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden"
        style={{ maxWidth: 860, maxHeight: "90vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.line}`, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Compras — {fornecedor.nome || fornecedor.razaoSocial}</div>
            <button onClick={onClose} style={{ color: C.sub }} className="text-lg leading-none">×</button>
          </div>
        </div>
        <div className="p-5">
          {/* Totais */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
              <div className="text-xs" style={{ color: C.sub }}>Total já comprado</div>
              <div className="font-semibold text-lg" style={{ color: master ? C.accent : C.sub }}>{master && dados ? money(dados.totalComprado) : "•••••"}</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
              <div className="text-xs" style={{ color: C.sub }}>Volume em metros</div>
              <div className="font-semibold text-lg">{dados ? nBR(dados.totalM) : "—"} m</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
              <div className="text-xs" style={{ color: C.sub }}>Volume em quilos</div>
              <div className="font-semibold text-lg">{dados ? nBR(dados.totalKg) : "—"} kg</div>
            </div>
          </div>

          <div className="font-semibold text-sm mb-2">Notas de compra</div>
          {dados === null ? <div style={{ color: C.sub }}>Carregando…</div> : !dados.linhas?.length ? (
            <div className="text-sm" style={{ color: C.sub }}>Sem compras registradas.</div>
          ) : (
            <div style={{ border: `1px solid ${C.line}` }} className="rounded-lg overflow-hidden">
              <div className="flex px-3 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
                <div className="w-28">Nº NF</div>
                <div className="w-28">Data</div>
                <div className="w-28 text-right">Metros</div>
                <div className="w-28 text-right">Quilos</div>
                <div className="flex-1 text-right">Valor total</div>
                <div className="w-10"></div>
              </div>
              {dados.linhas.map((n) => (
                <div key={n.id} className="flex px-3 py-2 items-center text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
                  <div className="w-28">NF {n.numero}</div>
                  <div className="w-28" style={{ color: C.sub }}>{data(n.dataEmissao)}</div>
                  <div className="w-28 text-right" style={{ color: C.sub }}>{n.metros ? `${nBR(n.metros)} m` : "—"}</div>
                  <div className="w-28 text-right" style={{ color: C.sub }}>{n.kg ? `${nBR(n.kg)} kg` : "—"}</div>
                  <div className="flex-1 text-right" style={{ color: master ? C.text : C.sub }}>{master ? money(n.valorTotal) : "•••••"}</div>
                  <button onClick={() => excluir(n)} title="Excluir esta NF (reverte estoque)" className="w-10 flex justify-end" style={{ color: "#C77" }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Usuários (ligado ao banco · só master) ===== */
const SETORES = ["FINANCEIRO", "PCP", "ESTOQUE", "ADMINISTRATIVO"];
const PERMISSOES = [
  ["permLancaPedidos", "Lança e edita pedidos"],
  ["permLancaContas", "Lança e edita contas"],
  ["permAlteraStatus", "Altera status de pedidos"],
  ["permVeValores", "Enxerga valores no financeiro"],
];

function Switch({ on, onChange, label }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 text-left w-full py-1">
      <span className="inline-flex items-center rounded-full transition-colors" style={{ width: 38, height: 22, padding: 2, background: on ? C.accent : C.line }}>
        <span className="rounded-full bg-white" style={{ width: 18, height: 18, transform: on ? "translateX(16px)" : "translateX(0)", transition: "transform .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </span>
      {label && <span className="text-sm" style={{ color: on ? C.text : C.sub }}>{label}</span>}
    </button>
  );
}

function Avatar({ foto, nome, size = 40 }) {
  const ini = (nome || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  if (foto) return <img src={foto} alt={nome} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `1px solid ${C.line}` }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: C.accentSoft, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.36 }}>{ini}</div>
  );
}

// redimensiona a foto para um quadrado ~256px (JPEG) e devolve dataURL base64
function fotoParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const S = 256;
        const canvas = document.createElement("canvas");
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext("2d");
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, S, S);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Usuarios({ master }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [verSenha, setVerSenha] = useState({});

  const carregar = async () => {
    setLoading(true);
    try {
      const u = await fetch("/api/usuarios").then((r) => r.json());
      setUsuarios(Array.isArray(u) ? u : []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const toggleAtivo = async (u) => {
    await fetch(`/api/usuarios/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !u.ativo }) });
    carregar();
  };
  const excluir = async (u) => {
    if (!window.confirm(`Excluir o usuário ${u.nome}? Esta ação não pode ser desfeita.`)) return;
    await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    carregar();
  };

  if (!master) return <div style={{ color: C.sub }}>Acesso restrito ao master.</div>;
  if (loading) return <div style={{ color: C.sub }}>Carregando…</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <div className="text-xs" style={{ color: C.sub }}>{usuarios.length} usuário(s) · você vê senhas e permissões porque é o master</div>
        <button onClick={() => { setEditando(null); setNovo(true); }} className="px-3 py-1.5 rounded-md font-medium text-sm flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Novo usuário</button>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}` }} className="rounded-lg overflow-x-auto">
        <div style={{ minWidth: 1120 }}>
          <div className="flex px-4 py-2 text-xs font-semibold items-center" style={{ color: C.sub, borderBottom: `1px solid ${C.line}`, background: C.panel2, textTransform: "uppercase" }}>
            <div className="w-12"> </div>
            <div className="flex-1">Nome</div>
            <div className="w-32">Usuário</div>
            <div className="w-36">Setor</div>
            <div className="w-40">Senha</div>
            <div className="flex-1">Permissões</div>
            <div className="w-24 text-center">Status</div>
            <div className="w-20 text-right">Ações</div>
          </div>
          {usuarios.length === 0 && <div className="px-4 py-6 text-sm" style={{ color: C.sub }}>Nenhum usuário ainda. Clique em “Novo usuário”.</div>}
          {usuarios.map((u) => {
            const perms = PERMISSOES.filter(([k]) => u[k]);
            return (
              <div key={u.id} className="flex px-4 py-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div className="w-12"><Avatar foto={u.fotoBase64} nome={`${u.nome} ${u.sobrenome || ""}`} /></div>
                <div className="flex-1">
                  <div className="font-medium" style={{ color: C.text }}>{u.nome} {u.sobrenome} {u.isMaster && <span className="text-xs" style={{ color: C.accent }}>· master</span>}</div>
                  <div className="text-xs" style={{ color: C.sub }}>{u.email || "—"}</div>
                </div>
                <div className="w-32 text-sm" style={{ color: C.sub }}>{u.login}</div>
                <div className="w-36"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{u.setor}</span></div>
                <div className="w-40 text-sm flex items-center gap-2" style={{ color: C.text }}>
                  <span style={{ fontFamily: "monospace" }}>{verSenha[u.id] ? (u.senha || "—") : "••••••"}</span>
                  <button onClick={() => setVerSenha((s) => ({ ...s, [u.id]: !s[u.id] }))} style={{ color: C.sub }}>{verSenha[u.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                </div>
                <div className="flex-1 flex flex-wrap gap-1">
                  {perms.length === 0 ? <span className="text-xs" style={{ color: C.sub }}>—</span> : perms.map(([k, l]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.greenSoft, color: C.green }}>{l}</span>
                  ))}
                </div>
                <div className="w-24 flex justify-center">
                  <button onClick={() => toggleAtivo(u)} className="text-xs px-3 py-1 rounded font-medium" style={{ background: u.ativo ? C.greenSoft : C.accentSoft, color: u.ativo ? C.green : C.accent }}>{u.ativo ? "Ativo" : "Bloqueado"}</button>
                </div>
                <div className="w-20 flex justify-end gap-2">
                  <button onClick={() => { setNovo(false); setEditando(u); }} title="Editar" style={{ color: C.sub }}><Pencil size={16} /></button>
                  <button onClick={() => excluir(u)} title="Excluir" style={{ color: "#C77" }} disabled={u.isMaster}><Trash2 size={16} style={{ opacity: u.isMaster ? 0.3 : 1 }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(novo || editando) && (
        <UsuarioModal usuario={editando} onClose={() => { setNovo(false); setEditando(null); }} onSaved={() => { setNovo(false); setEditando(null); carregar(); }} />
      )}
    </div>
  );
}

function UsuarioModal({ usuario, onClose, onSaved, onSavedUser, self }) {
  const ed = !!usuario;
  const [f, setF] = useState({
    nome: usuario?.nome || "", sobrenome: usuario?.sobrenome || "", email: usuario?.email || "",
    login: usuario?.login || "", senha: usuario?.senha || "", setor: usuario?.setor || "PCP",
    fotoBase64: usuario?.fotoBase64 || null, ativo: usuario?.ativo ?? true, isMaster: usuario?.isMaster ?? false,
    permLancaPedidos: usuario?.permLancaPedidos ?? false, permLancaContas: usuario?.permLancaContas ?? false,
    permAlteraStatus: usuario?.permAlteraStatus ?? false, permVeValores: usuario?.permVeValores ?? false,
  });
  const [verSenha, setVerSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const onFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { set("fotoBase64", await fotoParaBase64(file)); } catch { setErro("Não consegui ler a imagem."); }
  };

  const salvar = async () => {
    setErro("");
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (!f.login.trim()) return setErro("Informe o usuário (login).");
    setSalvando(true);
    // no modo "meu perfil" só mando os campos editáveis do próprio usuário
    const body = self
      ? { nome: f.nome, sobrenome: f.sobrenome, email: f.email, login: f.login, senha: f.senha, fotoBase64: f.fotoBase64 }
      : f;
    const url = ed ? `/api/usuarios/${usuario.id}` : "/api/usuarios";
    const method = ed ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSalvando(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); return setErro(j.error || "Erro ao salvar."); }
    const salvo = await res.json().catch(() => null);
    if (self && salvo && onSavedUser) onSavedUser(salvo);
    else if (onSaved) onSaved();
  };

  const titulo = self ? "Meu perfil" : ed ? "Editar usuário" : "Novo usuário";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.4)" }} onClick={onClose}>
      <div className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold">{titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 mb-4">
            <Avatar foto={f.fotoBase64} nome={`${f.nome} ${f.sobrenome}`} size={72} />
            <div className="flex flex-col gap-2">
              <label className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer flex items-center gap-1 w-fit" style={{ background: C.accentSoft, color: C.accent, border: `1px solid ${C.accent}` }}>
                <Camera size={15} /> {f.fotoBase64 ? "Trocar foto" : "Enviar foto"}
                <input type="file" accept="image/*" onChange={onFoto} style={{ display: "none" }} />
              </label>
              {f.fotoBase64 && <button onClick={() => set("fotoBase64", null)} className="text-xs text-left" style={{ color: C.sub }}>Remover foto</button>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <In label="Nome" value={f.nome} onChange={(e) => set("nome", e.target.value)} />
            <In label="Sobrenome" value={f.sobrenome} onChange={(e) => set("sobrenome", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>E-mail</div>
              <input value={f.email} onChange={(e) => set("email", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
            </div>
            {self ? (
              <div>
                <div className="text-xs mb-1" style={{ color: C.sub }}>Setor</div>
                <div className="px-2 py-1.5 rounded" style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}` }}>{f.setor}</div>
              </div>
            ) : (
              <Sel label="Setor" value={f.setor} onChange={(e) => set("setor", e.target.value)}>
                {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Sel>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Usuário (login)</div>
              <input value={f.login} onChange={(e) => set("login", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }} />
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: C.sub }}>Senha</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                <input type={verSenha ? "text" : "password"} value={f.senha} onChange={(e) => set("senha", e.target.value)} className="flex-1 outline-none" style={{ background: "transparent", color: C.text }} />
                <button onClick={() => setVerSenha((v) => !v)} style={{ color: C.sub }}>{verSenha ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>
          </div>

          {!self && (
            <>
              <div className="rounded-lg p-3 mb-4" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                <div className="text-xs font-semibold mb-2" style={{ color: C.sub, textTransform: "uppercase" }}>Permissões de acesso</div>
                <div className="grid grid-cols-2 gap-x-4">
                  {PERMISSOES.map(([k, l]) => <Switch key={k} on={f[k]} onChange={(v) => set(k, v)} label={l} />)}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Switch on={f.ativo} onChange={(v) => set("ativo", v)} label={f.ativo ? "Usuário ativo" : "Usuário bloqueado"} />
                <Switch on={f.isMaster} onChange={(v) => set("isMaster", v)} label="Usuário master (Financeiro)" />
              </div>
            </>
          )}

          {erro && <div className="text-xs mt-3" style={{ color: "#D64545" }}>{erro}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={onClose} className="px-4 py-2 rounded" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="px-4 py-2 rounded font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </div>
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
