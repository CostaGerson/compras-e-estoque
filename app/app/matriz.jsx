"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  Grid3x3, Save, Undo2, Plus, Trash2, X, Loader2, HelpCircle, History, Copy, Pencil, Users, Leaf, Truck, Briefcase,
  Cpu, Landmark, Factory, SlidersHorizontal, LayoutDashboard, UserX, UserCheck, AlertTriangle, PiggyBank, Columns3, RotateCcw,
} from "lucide-react";
import { calcularMatriz, calcFuncionario, calcFreelancer, DEPTOS, REGIMES, FORMULAS } from "@/lib/matriz";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
  navy: "#001E41",
};

/* ---------- formatos ---------- */
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => "R$ " + brl(v);
const pct = (v, c = 2) => ((Number(v) || 0) * 100).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }) + "%";
const int = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const lerNum = (s) => {
  const t = String(s ?? "").trim().replace(/\s|R\$|%/g, "");
  if (!t) return 0;
  const x = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
};
const novoId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const dataHora = (v) => { const d = new Date(v); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); };

const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};

/* ---------- campos ---------- */
function NumInput({ value, onChange, tipo = "moeda", casas = 2, className = "", style, width = 110, disabled }) {
  const [foco, setFoco] = useState(false);
  const [txt, setTxt] = useState("");
  const mostra = tipo === "pct" ? brlN((Number(value) || 0) * 100, casas) : brlN(value, casas);
  return (
    <div className="relative inline-flex items-center" style={{ width }}>
      {tipo === "moeda" && <span className="absolute left-2 text-[10px]" style={{ color: C.sub }}>R$</span>}
      <input disabled={disabled} value={foco ? txt : mostra}
        onFocus={(e) => { setFoco(true); setTxt(mostra); setTimeout(() => e.target.select(), 0); }}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => { setFoco(false); const v = lerNum(txt); onChange(tipo === "pct" ? v / 100 : v); }}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
        className={`w-full text-right rounded px-2 py-1 text-xs outline-none ${className}`}
        style={{ border: `1px solid ${C.line}`, paddingLeft: tipo === "moeda" ? 22 : 8, paddingRight: tipo === "pct" ? 18 : 8, background: disabled ? C.panel2 : "#fff", color: C.text, ...style }} />
      {tipo === "pct" && <span className="absolute right-2 text-[10px]" style={{ color: C.sub }}>%</span>}
    </div>
  );
}
const brlN = (v, c = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
function TxtInput({ value, onChange, placeholder, width, upper = true }) {
  return (
    <input value={value || ""} placeholder={placeholder} onChange={(e) => onChange(upper ? e.target.value.toUpperCase() : e.target.value)}
      className="rounded px-2 py-1 text-xs outline-none w-full" style={{ border: `1px solid ${C.line}`, width }} />
  );
}

function Modal({ titulo, icone: Ico, onClose, children, largura = 560, rodape }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }}>
      <div className="rounded-xl w-full flex flex-col" style={{ background: C.panel, maxWidth: largura, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-semibold flex items-center gap-2">{Ico && <Ico size={18} style={{ color: C.accent }} />} {titulo}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="overflow-auto p-5">{children}</div>
        {rodape && <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2, borderRadius: "0 0 12px 12px" }}>{rodape}</div>}
      </div>
    </div>
  );
}

function ComoCalcula({ itens }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button onClick={() => setAberto(true)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: C.blue, background: C.blueSoft }}>
        <HelpCircle size={14} /> Como é calculado
      </button>
      {aberto && (
        <Modal titulo="Como é calculado" icone={HelpCircle} onClose={() => setAberto(false)} largura={680}>
          <table className="w-full text-sm">
            <tbody>{itens.map(([k, v]) => (
              <tr key={k} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td className="py-2 pr-4 font-semibold align-top whitespace-nowrap" style={{ color: C.navy }}>{k}</td>
                <td className="py-2" style={{ color: C.text }}>{v}</td>
              </tr>
            ))}</tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

const ABAS = [
  ["painel", "Painel", LayoutDashboard],
  ["pessoal", "Pessoal", Users],
  ["vidaVegetativa", "Vida vegetativa", Leaf],
  ["logistica", "Logística/Manutenção", Truck],
  ["administracao", "Administração", Briefcase],
  ["sistemas", "Sistemas", Cpu],
  ["dividas", "Dívidas", Landmark],
  ["producao", "Produção", Factory],
  ["parametros", "Parâmetros", SlidersHorizontal],
];

/* ============================================================ */
export default function MatrizCustos({ user }) {
  const [lista, setLista] = useState(null);
  const [atualId, setAtualId] = useState(null);
  const [doc, setDoc] = useState(null);       // registro salvo
  const [dados, setDados] = useState(null);   // rascunho em edição
  const [mexidos, setMexidos] = useState([]); // abas alteradas (resumo da versão)
  const [oficialDados, setOficialDados] = useState(null);
  const [aba, setAba] = useState("painel");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modal, setModal] = useState(null);
  const [aviso, setAviso] = useState("");

  const sujo = mexidos.length > 0;

  const carregarLista = async () => {
    const l = await api(`/api/fin/matriz?u=${user.id}`);
    setLista(l);
    return l;
  };
  const abrir = async (id) => {
    setErro("");
    const m = await api(`/api/fin/matriz/${id}?u=${user.id}`);
    setDoc(m); setDados(m.dados); setAtualId(id); setMexidos([]);
    if (m.oficial) setOficialDados(m.dados);
  };
  useEffect(() => {
    carregarLista().then(async (l) => {
      const of = l.find((x) => x.oficial) || l[0];
      if (of) await abrir(of.id);
    }).catch((e) => setErro(e.message));
  }, []);
  // dados da oficial para comparar quando estiver num cenário
  useEffect(() => {
    if (!doc || doc.oficial || oficialDados) return;
    const of = (lista || []).find((x) => x.oficial);
    if (of) api(`/api/fin/matriz/${of.id}?u=${user.id}`).then((m) => setOficialDados(m.dados)).catch(() => {});
  }, [doc]);
  useEffect(() => {
    const h = (e) => { if (sujo) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sujo]);

  const calc = useMemo(() => (dados ? calcularMatriz(dados) : null), [dados]);
  const calcOf = useMemo(() => (oficialDados && doc && !doc.oficial ? calcularMatriz(oficialDados) : null), [oficialDados, doc]);

  const muda = (chave, valor) => {
    setDados((d) => ({ ...d, [chave]: typeof valor === "function" ? valor(d[chave]) : valor }));
    const nome = (ABAS.find((a) => a[0] === chave) || [null, chave === "freelancer" ? "Produção" : chave])[1];
    setMexidos((m) => (m.includes(nome) ? m : [...m, nome]));
  };

  const salvar = async () => {
    setSalvando(true); setErro("");
    try {
      const r = await api(`/api/fin/matriz/${doc.id}`, "PUT", { usuarioId: user.id, dados, resumo: mexidos.join(", "), versaoBase: doc.updatedAt });
      setDoc((d) => ({ ...d, dados, updatedAt: r.updatedAt, atualizadoPor: r.atualizadoPor }));
      if (doc.oficial) setOficialDados(dados);
      setMexidos([]); setAviso("Alterações salvas."); setTimeout(() => setAviso(""), 2500);
      carregarLista();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const descartar = () => { if (confirm("Descartar as alterações não salvas?")) { setDados(doc.dados); setMexidos([]); } };
  const trocar = async (id) => {
    if (sujo && !confirm("Há alterações não salvas. Trocar mesmo assim (elas serão perdidas)?")) return;
    await abrir(Number(id)).catch((e) => setErro(e.message));
  };
  const novoCenario = async () => {
    const nome = prompt("Nome do cenário (cópia da matriz aberta, com as alterações ainda não salvas não incluídas):", `CENÁRIO ${new Date().toLocaleDateString("pt-BR")}`);
    if (!nome) return;
    const r = await api("/api/fin/matriz", "POST", { usuarioId: user.id, nome, copiarDe: doc.id }).catch((e) => setErro(e.message));
    if (r) { await carregarLista(); await abrir(r.id); }
  };
  const resetar = async () => {
    if (!confirm(`Resetar "${doc.nome}" para ficar exatamente igual à matriz oficial?\n\nTodas as alterações deste cenário serão substituídas. Depois clique em Salvar (a versão anterior fica no Histórico).`)) return;
    try {
      let of = oficialDados;
      const reg = (lista || []).find((x) => x.oficial);
      if (reg) { const m = await api(`/api/fin/matriz/${reg.id}?u=${user.id}`); of = m.dados; setOficialDados(m.dados); }
      if (!of) throw new Error("Matriz oficial não encontrada.");
      setDados(JSON.parse(JSON.stringify(of)));
      setMexidos((m) => (m.includes("Reset para a oficial") ? m : [...m, "Reset para a oficial"]));
    } catch (e) { setErro(e.message); }
  };
  const renomear = async () => {
    const nome = prompt("Novo nome:", doc.nome);
    if (!nome) return;
    await api(`/api/fin/matriz/${doc.id}`, "PATCH", { usuarioId: user.id, nome });
    setDoc((d) => ({ ...d, nome: nome.toUpperCase() })); carregarLista();
  };
  const apagar = async () => {
    if (!confirm(`Apagar o cenário "${doc.nome}"?`)) return;
    await api(`/api/fin/matriz/${doc.id}`, "DELETE", { usuarioId: user.id }).catch((e) => setErro(e.message));
    const l = await carregarLista();
    setMexidos([]);
    await abrir((l.find((x) => x.oficial) || l[0]).id);
  };

  if (erro && !dados) return <div className="p-4 rounded-lg text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>;
  if (!dados || !calc) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando matriz…</div>;

  return (
    <div>
      {/* barra da matriz */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <Grid3x3 size={18} style={{ color: C.accent }} />
        <select value={atualId || ""} onChange={(e) => trocar(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm font-semibold outline-none" style={{ border: `1px solid ${C.line}`, color: C.navy }}>
          {(lista || []).map((m) => <option key={m.id} value={m.id}>{m.oficial ? "★ " : ""}{m.nome}</option>)}
        </select>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={doc.oficial ? { background: C.navy, color: "#fff" } : { background: C.yellowSoft, color: C.yellow }}>
          {doc.oficial ? "OFICIAL" : "CENÁRIO · simulação"}
        </span>
        <span className="text-xs" style={{ color: C.sub }}>Atualizada {dataHora(doc.updatedAt)}{doc.atualizadoPor ? ` · ${doc.atualizadoPor}` : ""}</span>
        <div className="flex-1" />
        <BtnSec onClick={novoCenario} Ico={Copy} t="Novo cenário" />
        {!doc.oficial && <BtnSec onClick={resetar} Ico={RotateCcw} t="Resetar p/ oficial" />}
        {!doc.oficial && <BtnSec onClick={renomear} Ico={Pencil} t="Renomear" />}
        {!doc.oficial && <BtnSec onClick={apagar} Ico={Trash2} t="Apagar" cor={C.red} />}
        <BtnSec onClick={() => setModal("versoes")} Ico={History} t="Histórico" />
        {sujo && <BtnSec onClick={descartar} Ico={Undo2} t="Descartar" />}
        <button onClick={salvar} disabled={!sujo || salvando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: sujo ? C.accent : "#C9CED6" }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
        </button>
      </div>
      {sujo && <div className="mb-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={14} /> Alterações não salvas em: <b>{mexidos.join(", ")}</b></div>}
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}

      {/* guias */}
      <div className="flex gap-1 mb-5 overflow-x-auto" style={{ borderBottom: `1px solid ${C.line}` }}>
        {ABAS.map(([k, t, I]) => (
          <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap"
            style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
            <I size={15} /> {t}
          </button>
        ))}
      </div>

      {aba === "painel" && <Painel calc={calc} calcOf={calcOf} ir={setAba} cenario={!doc.oficial} pr={dados.producao} prOf={oficialDados?.producao}
        setPr={(k, v) => muda("producao", (x) => ({ ...x, [k]: v }))} />}
      {aba === "pessoal" && <Pessoal dados={dados} calc={calc} muda={muda} cenario={!doc.oficial} />}
      {aba === "vidaVegetativa" && <Lista titulo="Vida vegetativa" sub="Custos fixos do imóvel e da estrutura." itens={dados.vidaVegetativa} set={(f) => muda("vidaVegetativa", f)} cdb />}
      {aba === "logistica" && <Lista titulo="Logística / Manutenção" sub="Veículos, seguros, impostos e manutenção." itens={dados.logistica} set={(f) => muda("logistica", f)} cdb />}
      {aba === "administracao" && <Lista titulo="Administração" sub="Contribuições, serviços, assinaturas e eventos." itens={dados.administracao} set={(f) => muda("administracao", f)} cdb />}
      {aba === "sistemas" && <Lista titulo="Sistemas especializados" sub="Softwares de produção e gestão." itens={dados.sistemas} set={(f) => muda("sistemas", f)} cdb />}
      {aba === "dividas" && <Lista titulo="Dívidas" sub={dados.notas?.dividas || "Parcelas mensais de dívidas e empréstimos."} itens={dados.dividas} set={(f) => muda("dividas", f)} />}
      {aba === "producao" && <Producao dados={dados} calc={calc} muda={muda} />}
      {aba === "parametros" && <Parametros dados={dados} muda={muda} />}

      {modal === "versoes" && <Versoes user={user} doc={doc} sujo={sujo} onClose={() => setModal(null)} onRestaurado={async () => { setModal(null); await abrir(doc.id); }} />}
    </div>
  );
}

function BtnSec({ onClick, Ico, t, cor }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.line}`, color: cor || C.text, background: C.panel }}>
      <Ico size={14} /> {t}
    </button>
  );
}

/* ---------------- PAINEL ---------------- */
function Painel({ calc, calcOf, ir, cenario, pr, prOf, setPr }) {
  const b = calc.blocos;
  const linhaBloco = [
    ["vidaVegetativa", "Vida vegetativa", Leaf, b.vidaVegetativa],
    ["pessoal", `Pessoal (${calc.headcount})`, Users, b.pessoal],
    ["logistica", "Logística/Manutenção", Truck, b.logistica],
    ["administracao", "Administração", Briefcase, b.administracao],
    ["sistemas", "Sistemas", Cpu, b.sistemas],
    ["dividas", "Dívidas", Landmark, b.dividas],
  ];
  const Dif = ({ a, o, tipo = "moeda", inverso }) => {
    if (!calcOf) return null;
    const d = a - o;
    if (Math.abs(d) < 0.005) return <span className="text-[10px]" style={{ color: C.sub }}>= oficial</span>;
    const bom = inverso ? d < 0 : d > 0;
    return <span className="text-[10px] font-semibold" style={{ color: bom ? C.green : C.red }}>{d > 0 ? "+" : ""}{tipo === "pct" ? pct(d) : tipo === "int" ? int(d) : brl(d)} vs oficial</span>;
  };
  const ind = [
    ["Custo da operação", calc.custoOperacao, calc.custoOperacaoDia, calcOf?.custoOperacao, true],
    ["Custo do negócio (com dívidas)", calc.custoNegocio, calc.custoNegocioDia, calcOf?.custoNegocio, true],
    ["Operação precificada", calc.operacaoPrecificada, null, calcOf?.operacaoPrecificada, true],
    ["Custo administrativo", calc.custoAdministrativo, null, calcOf?.custoAdministrativo, true],
  ];
  const alavancas = [
    ["ticketMedio", "Ticket médio", "moeda", 2, (v) => moeda(v)],
    ["margemContribuicao", "Margem de contribuição", "pct", 2, (v) => pct(v)],
    ["metaPecas", "Peças faturadas (mês)", "num", 0, (v) => int(v)],
  ];
  return (
    <div className="space-y-5">
      {cenario && (
        <div className="rounded-xl p-4" style={{ background: C.navy, color: "#fff" }}>
          <div className="flex flex-wrap items-end gap-5">
            <div className="flex-1 min-w-[200px]">
              <div className="font-bold flex items-center gap-1.5"><SlidersHorizontal size={16} style={{ color: C.accent }} /> Simule aqui</div>
              <div className="text-xs mt-0.5" style={{ color: "#9FB0C7" }}>Mude os valores e veja metas, lucro e breakeven recalcularem na hora. Salve para guardar o cenário.</div>
            </div>
            {alavancas.map(([k, t, tipo, casas, fmt]) => (
              <div key={k}>
                <div className="text-[11px] font-semibold mb-1" style={{ color: "#C9D3E0" }}>{t}</div>
                <NumInput tipo={tipo} casas={casas} value={pr[k]} onChange={(v) => setPr(k, v)} width={130} style={{ fontSize: 14, fontWeight: 700, padding: "6px 8px", paddingLeft: tipo === "moeda" ? 24 : 8 }} />
                {prOf && <div className="text-[10px] mt-1" style={{ color: Number(pr[k]) === Number(prOf[k]) ? "#9FB0C7" : C.accent }}>oficial: {fmt(prOf[k])}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end"><ComoCalcula itens={FORMULAS.painel} /></div>
      {/* distribuição (pizza) + blocos */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Cartao titulo="Distribuição do custo do negócio">
          <Pizza fatias={linhaBloco.map(([k, t, , v]) => ({ k, t, v, cor: COR_BLOCO[k] }))} total={calc.custoNegocio} ir={ir} />
        </Cartao>
      <div className="grid gap-3 content-start" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {linhaBloco.map(([k, t, I, v]) => (
          <button key={k} onClick={() => ir(k)} className="text-left p-4 rounded-xl hover:shadow-md transition-shadow" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: C.sub }}><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COR_BLOCO[k] }} /><I size={14} style={{ color: C.accent }} /> {t}</div>
            <div className="text-lg font-bold mt-1" style={{ color: C.navy }}>{moeda(v)}</div>
            <div className="text-[10px]" style={{ color: C.sub }}>{pct(calc.custoNegocio ? v / calc.custoNegocio : 0, 1)} do custo do negócio</div>
            {calcOf && <Dif a={v} o={calcOf.blocos[k]} inverso />}
          </button>
        ))}
      </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        {/* custos */}
        <Cartao titulo="Custos">
          <table className="w-full text-sm">
            <thead><tr className="text-xs" style={{ color: C.sub }}><th className="text-left font-semibold py-1">Indicador</th><th className="text-right font-semibold">Mensal</th><th className="text-right font-semibold">Anual</th><th className="text-right font-semibold">Diário</th></tr></thead>
            <tbody>{ind.map(([t, m, d, o]) => (
              <tr key={t} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="py-2">{t}<div><Dif a={m} o={o} inverso /></div></td>
                <td className="text-right font-semibold">{brl(m)}</td>
                <td className="text-right">{brl(m * 12)}</td>
                <td className="text-right" style={{ color: C.sub }}>{d != null ? brl(d) : "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </Cartao>

        {/* metas e resultado */}
        <Cartao titulo="Metas e resultado">
          <Kv k="Meta de faturamento (mês)" v={moeda(calc.metaMensal)} extra={<Dif a={calc.metaMensal} o={calcOf?.metaMensal} />} />
          <Kv k="Meta de faturamento (ano)" v={moeda(calc.metaFatAnual)} />
          <Kv k="Meta por dia útil" v={moeda(calc.metaDia)} />
          <Kv k="Balanço meta x custo operacional" v={brlN(calc.balanco, 3)} cor={calc.balanco >= 1 ? C.green : C.red}
            extra={<span className="text-[10px]" style={{ color: C.sub }}>a operação se paga com {int(calc.pecasCobrem)} peças/mês</span>} />
          <Kv k="Lucro líquido no cenário" v={`${pct(calc.lucroCenario)} · ${moeda(calc.lucroCenarioR)}/ano`} cor={calc.lucroCenario >= 0 ? C.green : C.red} extra={<Dif a={calc.lucroCenario} o={calcOf?.lucroCenario} tipo="pct" />} />
          <Kv k="Lucro líquido real" v={`${pct(calc.lucroReal)} · ${moeda(calc.lucroRealR)}/ano`} cor={calc.lucroReal >= 0 ? C.green : C.red} extra={<Dif a={calc.lucroReal} o={calcOf?.lucroReal} tipo="pct" />} />
          <Kv k="Breakeven (peças faturadas/mês)" v={int(calc.breakevenPecas)} extra={<span className="text-[10px]" style={{ color: C.sub }}>lucro real zera nessa meta</span>} />
        </Cartao>

        {/* produção */}
        <Cartao titulo="Custo por peça">
          <Kv k="Razão interna (produção própria)" v={pct(calc.razaoInterna)} extra={<span className="text-[10px]" style={{ color: C.sub }}>freelancer: {pct(calc.pctFreelancer)}</span>} />
          <Kv k="Razão custo produção / peça" v={moeda(calc.razaoProd)} />
          <Kv k="Razão custo logístico / peça" v={moeda(calc.razaoLog)} />
          <Kv k="Custo interno por peça" v={moeda(calc.custoPecaInterno)} />
        </Cartao>

        {/* CDB */}
        <Cartao titulo="Reserva mensal (CDB)" Ico={PiggyBank}>
          <div className="text-2xl font-bold mb-2" style={{ color: C.navy }}>{moeda(calc.cdb)}</div>
          <Kv k="Provisões do pessoal (13º, férias, aviso, multa, R. férias)" v={moeda(calc.cdbPessoal)} />
          {calc.cdbItens.map((i) => <Kv key={i.id} k={i.natureza} v={moeda(i.valor)} />)}
          <div className="text-[10px] mt-2" style={{ color: C.sub }}>Marque ou desmarque itens como CDB nas guias de cada área.</div>
        </Cartao>
      </div>

      {/* pessoal por depto */}
      <Cartao titulo="Pessoal por departamento">
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {DEPTOS.map(([k, t]) => (
            <div key={k} className="p-2.5 rounded-lg" style={{ background: C.panel2 }}>
              <div className="text-xs" style={{ color: C.sub }}>{t}</div>
              <div className="font-bold" style={{ color: C.navy }}>{moeda(calc.porDepto[k])}</div>
              <div className="text-[10px]" style={{ color: k === "DIR" || k === "ADM" ? C.sub : C.green }}>{k === "DIR" || k === "ADM" ? "fora da operação" : "operação precificada"}</div>
            </div>
          ))}
        </div>
      </Cartao>
    </div>
  );
}
const COR_BLOCO = { pessoal: "#001E41", vidaVegetativa: "#FF6B1A", dividas: "#D92D20", administracao: "#2E7CD6", logistica: "#12A150", sistemas: "#C08401" };
function Pizza({ fatias, total, ir }) {
  const [ativo, setAtivo] = useState(null);
  const R = 90, cx = 100, cy = 100;
  const ord = [...fatias].filter((f) => f.v > 0).sort((a, b) => b.v - a.v);
  let ang = -Math.PI / 2;
  const arcos = ord.map((f) => {
    const a = total ? (f.v / total) * Math.PI * 2 : 0;
    const a0 = ang, a1 = ang + a; ang = a1;
    const m = (a0 + a1) / 2, off = ativo === f.k ? 6 : 0;
    const dx = Math.cos(m) * off, dy = Math.sin(m) * off;
    const p = (t) => [cx + dx + R * Math.cos(t), cy + dy + R * Math.sin(t)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    const d = a >= Math.PI * 2 - 1e-6
      ? `M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0`
      : `M ${cx + dx} ${cy + dy} L ${x0} ${y0} A ${R} ${R} 0 ${a > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`;
    const lx = cx + dx + R * 0.62 * Math.cos(m), ly = cy + dy + R * 0.62 * Math.sin(m);
    return { ...f, d, lx, ly, pc: total ? f.v / total : 0 };
  });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 200 200" style={{ width: 210, height: 210, flex: "none" }}>
        {arcos.map((a) => (
          <path key={a.k} d={a.d} fill={a.cor} stroke="#fff" strokeWidth="1.5" style={{ cursor: "pointer", opacity: ativo && ativo !== a.k ? 0.55 : 1, transition: "opacity .15s" }}
            onMouseEnter={() => setAtivo(a.k)} onMouseLeave={() => setAtivo(null)} onClick={() => ir(a.k)}>
            <title>{`${a.t}: ${moeda(a.v)} (${pct(a.pc, 1)})`}</title>
          </path>
        ))}
        {arcos.filter((a) => a.pc >= 0.06).map((a) => (
          <text key={a.k} x={a.lx} y={a.ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{pct(a.pc, 0)}</text>
        ))}
      </svg>
      <div className="flex-1 min-w-[170px] text-sm">
        {arcos.map((a) => (
          <button key={a.k} onClick={() => ir(a.k)} onMouseEnter={() => setAtivo(a.k)} onMouseLeave={() => setAtivo(null)}
            className="w-full flex items-center gap-2 py-1.5 text-left" style={{ borderBottom: `1px solid ${C.line}`, background: ativo === a.k ? C.panel2 : "transparent" }}>
            <span className="w-3 h-3 rounded-sm flex-none" style={{ background: a.cor }} />
            <span className="flex-1">{a.t}</span>
            <span className="text-xs" style={{ color: C.sub }}>{pct(a.pc, 1)}</span>
            <span className="font-semibold text-right" style={{ minWidth: 92 }}>{brl(a.v)}</span>
          </button>
        ))}
        <div className="flex justify-between pt-2 font-bold" style={{ color: C.navy }}><span>Custo do negócio</span><span>{moeda(total)}</span></div>
      </div>
    </div>
  );
}

function Cartao({ titulo, children, Ico }) {
  return (
    <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="font-bold mb-3 flex items-center gap-1.5" style={{ color: C.navy }}>{Ico && <Ico size={16} style={{ color: C.accent }} />}{titulo}</div>
      {children}
    </div>
  );
}
function Kv({ k, v, cor, extra }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
      <div>{k}{extra && <div>{extra}</div>}</div>
      <div className="font-semibold text-right whitespace-nowrap" style={{ color: cor || C.text }}>{v}</div>
    </div>
  );
}

/* ---------------- LISTAS (vida vegetativa, logística, adm, sistemas, dívidas) ---------------- */
function Lista({ titulo, sub, itens = [], set, cdb }) {
  const total = itens.filter((i) => i.ativo !== false).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const alt = (id, k, v) => set((l) => l.map((i) => (i.id === id ? { ...i, [k]: v } : i)));
  const add = () => set((l) => [...(l || []), { id: novoId("i"), natureza: "", valor: 0, cdb: false, obs: "" }]);
  const del = (it) => { if (confirm(`Remover "${it.natureza || "item"}"?`)) set((l) => l.filter((i) => i.id !== it.id)); };
  return (
    <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex-1">
          <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
          <div className="text-xs" style={{ color: C.sub }}>{sub}</div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: C.sub }}>Total mensal</div>
          <div className="text-lg font-bold" style={{ color: C.navy }}>{moeda(total)}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, background: C.panel2 }}>
            <th className="text-left px-4 py-2 font-semibold">Natureza</th>
            <th className="text-right px-2 py-2 font-semibold">Valor mensal</th>
            {cdb && <th className="text-center px-2 py-2 font-semibold" title="Entra na reserva mensal do CDB">CDB</th>}
            <th className="text-left px-2 py-2 font-semibold">Observação</th>
            <th className="text-center px-2 py-2 font-semibold" title="Desmarque para tirar do cálculo sem apagar">Ativo</th>
            <th />
          </tr></thead>
          <tbody>{itens.map((i) => (
            <tr key={i.id} style={{ borderTop: `1px solid ${C.line}`, opacity: i.ativo === false ? 0.45 : 1 }}>
              <td className="px-4 py-1.5" style={{ minWidth: 220 }}><TxtInput value={i.natureza} onChange={(v) => alt(i.id, "natureza", v)} placeholder="NATUREZA" /></td>
              <td className="px-2 py-1.5 text-right"><NumInput value={i.valor} onChange={(v) => alt(i.id, "valor", v)} width={120} /></td>
              {cdb && <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={!!i.cdb} onChange={(e) => alt(i.id, "cdb", e.target.checked)} /></td>}
              <td className="px-2 py-1.5" style={{ minWidth: 220 }}><TxtInput value={i.obs} onChange={(v) => alt(i.id, "obs", v)} upper={false} placeholder="—" /></td>
              <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={i.ativo !== false} onChange={(e) => alt(i.id, "ativo", e.target.checked)} /></td>
              <td className="px-2 py-1.5"><button onClick={() => del(i)} style={{ color: C.sub }}><Trash2 size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
        <button onClick={add} className="flex items-center gap-1 text-xs font-semibold" style={{ color: C.accent }}><Plus size={14} /> Adicionar item</button>
      </div>
    </div>
  );
}

/* ---------------- PESSOAL ---------------- */
const COLS_TODAS = [
  ["F", "Salário"], ["G", "Bônus"], ["liquido", "Líquido"], ["inssPatronal", "INSS patr."], ["inssFunc", "INSS func."], ["fgts", "FGTS"],
  ["vt", "VT"], ["vtDesc", "VT desc."], ["vr", "VR"], ["ps", "PS"], ["ass", "ASS"], ["saldoLivre", "Saldo livre"],
  ["decimo", "13º"], ["ferias", "Férias"], ["aviso", "Aviso"], ["multa", "Multa"], ["rFerias", "R. férias"], ["total", "TOTAL"],
];
function Pessoal({ dados, calc, muda, cenario }) {
  const [edit, setEdit] = useState(null);
  const [todas, setTodas] = useState(false);
  const [verDeslig, setVerDeslig] = useState(false);
  const par = dados.parametros;
  const lista = dados.pessoal.filter((p) => verDeslig || p.ativo !== false);
  const deslig = dados.pessoal.filter((p) => p.ativo === false).length;
  const salvarP = (p) => {
    muda("pessoal", (l) => (l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [...l, p]));
    setEdit(null);
  };
  const duplicar = (p) => muda("pessoal", (l) => {
    const i = l.findIndex((x) => x.id === p.id);
    const copia = { ...p, id: novoId("p"), nome: `CÓPIA DE ${p.nome || p.cargo || "FUNCIONÁRIO"}`.toUpperCase() };
    return [...l.slice(0, i + 1), copia, ...l.slice(i + 1)];
  });
  const alternar = (p) => muda("pessoal", (l) => l.map((x) => (x.id === p.id ? { ...x, ativo: x.ativo === false } : x)));
  const novo = () => setEdit({ id: novoId("p"), nome: "", cargo: "", depto: "COS", regime: "CLT", salario: 0, bonus: 0, vt: 287.5, descontaVt: true, vr: 100, ps: 54.9, assPct: 0.05, saldoLivre: 0, rFerias: 0, ativo: true, obs: "" });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="text-sm" style={{ color: C.sub }}>{calc.headcount} ativos · custo mensal <b style={{ color: C.navy }}>{moeda(calc.blocos.pessoal)}</b></div>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> <Columns3 size={13} /> Todas as colunas</label>
        {deslig > 0 && <label className="flex items-center gap-1 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={verDeslig} onChange={(e) => setVerDeslig(e.target.checked)} /> Mostrar desligados ({deslig})</label>}
        <ComoCalcula itens={FORMULAS.pessoal} />
        <button onClick={novo} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}><Plus size={15} /> Funcionário</button>
      </div>
      <div className="rounded-xl overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, background: C.panel2 }}>
            <th className="text-left px-3 py-2 font-semibold sticky left-0" style={{ background: C.panel2 }}>Funcionário</th>
            <th className="text-left px-2 py-2 font-semibold">Regime</th>
            {todas ? COLS_TODAS.map(([k, t]) => <th key={k} className="text-right px-2 py-2 font-semibold whitespace-nowrap">{t}</th>) : (
              <>
                <th className="text-right px-2 py-2 font-semibold">Salário</th>
                <th className="text-right px-2 py-2 font-semibold">Bônus</th>
                <th className="text-right px-2 py-2 font-semibold">Encargos</th>
                <th className="text-right px-2 py-2 font-semibold">Benefícios</th>
                <th className="text-right px-2 py-2 font-semibold">Provisões</th>
                <th className="text-right px-2 py-2 font-semibold">TOTAL</th>
              </>
            )}
            <th />
          </tr></thead>
          <tbody>{DEPTOS.map(([dk, dt]) => {
            const ps = lista.filter((p) => p.depto === dk);
            if (!ps.length) return null;
            return (
              <React.Fragment key={dk}>
                <tr style={{ background: C.accentSoft }}>
                  <td colSpan={todas ? COLS_TODAS.length + 3 : 9} className="px-3 py-1.5 font-bold" style={{ color: C.navy }}>
                    {dt} <span className="font-normal" style={{ color: C.sub }}>· {moeda(calc.porDepto[dk])}{dk === "DIR" || dk === "ADM" ? " · fora da operação precificada" : ""}</span>
                  </td>
                </tr>
                {ps.map((p) => {
                  const c = calcFuncionario(p, par);
                  const enc = c.inssPatronal + c.inssFunc + c.fgts;
                  const ben = c.vt + c.vtDesc + c.vr + c.ps + c.ass + c.saldoLivre;
                  const off = p.ativo === false;
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${C.line}`, opacity: off ? 0.45 : 1 }} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 sticky left-0" style={{ background: C.panel, minWidth: 200 }}>
                        <button onClick={() => setEdit(p)} className="text-left">
                          <div className="font-semibold" style={{ color: C.navy }}>{p.nome || <i style={{ color: C.yellow }}>VAGA</i>}{off && " (desligado)"}</div>
                          <div style={{ color: C.sub }}>{p.cargo}{p.adiantamento && <span className="ml-1 px-1 rounded text-[9px] font-semibold" style={{ background: C.blueSoft, color: C.blue }} title="Recebe adiantamento salarial (40% do salário base) no dia 20, abatido da folha do dia 5">ADIANT.</span>}</div>
                        </button>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: C.sub }}>{REGIMES[p.regime] || p.regime}</td>
                      {todas ? COLS_TODAS.map(([k]) => (
                        <td key={k} className="text-right px-2 py-1.5 whitespace-nowrap" style={{ fontWeight: k === "total" ? 700 : 400, color: c[k] < 0 ? C.red : undefined }}>{c[k] ? brl(c[k]) : "—"}</td>
                      )) : (
                        <>
                          <td className="text-right px-2 py-1.5">{brl(c.F)}</td>
                          <td className="text-right px-2 py-1.5">{c.G ? brl(c.G) : "—"}</td>
                          <td className="text-right px-2 py-1.5">{brl(enc)}</td>
                          <td className="text-right px-2 py-1.5">{brl(ben)}</td>
                          <td className="text-right px-2 py-1.5">{brl(c.provisoes)}</td>
                          <td className="text-right px-2 py-1.5 font-bold" style={{ color: C.navy }}>{brl(c.total)}</td>
                        </>
                      )}
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <button onClick={() => setEdit(p)} title="Editar" className="mr-2" style={{ color: C.sub }}><Pencil size={14} /></button>
                        {cenario && <button onClick={() => duplicar(p)} title="Duplicar funcionário" className="mr-2" style={{ color: C.sub }}><Copy size={14} /></button>}
                        <button onClick={() => alternar(p)} title={off ? "Reativar" : "Desligar (sai do cálculo)"} style={{ color: off ? C.green : C.sub }}>{off ? <UserCheck size={14} /> : <UserX size={14} />}</button>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}</tbody>
          <tfoot><tr style={{ borderTop: `2px solid ${C.navy}` }}>
            <td className="px-3 py-2 font-bold sticky left-0" style={{ background: C.panel }} colSpan={2}>TOTAL ({calc.headcount})</td>
            {todas ? COLS_TODAS.map(([k]) => (
              <td key={k} className="text-right px-2 py-2 font-bold whitespace-nowrap">{brl(calc.pessoas.reduce((s, p) => s + (p.c[k] || 0), 0))}</td>
            )) : <td colSpan={6} className="text-right px-2 py-2 font-bold" style={{ color: C.navy }}>{moeda(calc.blocos.pessoal)}</td>}
            <td />
          </tr></tfoot>
        </table>
      </div>
      {edit && <EditarFuncionario p={edit} par={par} onClose={() => setEdit(null)} onSalvar={salvarP}
        onExcluir={dados.pessoal.some((x) => x.id === edit.id) ? () => { if (confirm("Excluir este funcionário da matriz? (para manter o histórico, prefira Desligar)")) { muda("pessoal", (l) => l.filter((x) => x.id !== edit.id)); setEdit(null); } } : null} />}
    </div>
  );
}

function EditarFuncionario({ p: inicial, par, onClose, onSalvar, onExcluir }) {
  const [p, setP] = useState(inicial);
  const s = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const c = calcFuncionario(p, par);
  const est = p.regime === "ESTAGIO";
  return (
    <Modal titulo={inicial.nome || inicial.cargo ? `Funcionário · ${inicial.nome || inicial.cargo}` : "Novo funcionário"} icone={Users} onClose={onClose} largura={860}
      rodape={<>
        {onExcluir && <button onClick={onExcluir} className="mr-auto px-3 py-2 rounded-lg text-sm" style={{ color: C.red }}>Excluir</button>}
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={() => onSalvar(p)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Aplicar</button>
      </>}>
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 260px" }}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo t="Nome"><TxtInput value={p.nome} onChange={(v) => s("nome", v)} placeholder="VAGA" /></Campo>
            <Campo t="Cargo"><TxtInput value={p.cargo} onChange={(v) => s("cargo", v)} /></Campo>
            <Campo t="Departamento" dica="DIR e ADM ficam fora da operação precificada">
              <select value={p.depto} onChange={(e) => s("depto", e.target.value)} className="w-full rounded px-2 py-1 text-xs" style={{ border: `1px solid ${C.line}` }}>
                {DEPTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Campo>
            <Campo t="Regime">
              <select value={p.regime} onChange={(e) => s("regime", e.target.value)} className="w-full rounded px-2 py-1 text-xs" style={{ border: `1px solid ${C.line}` }}>
                {Object.entries(REGIMES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Campo t={p.regime === "DIRETOR" ? "Pró-labore" : est ? "Bolsa" : "Salário"}><NumInput value={p.salario} onChange={(v) => s("salario", v)} width="100%" /></Campo>
            <Campo t="Bônus"><NumInput value={p.bonus} onChange={(v) => s("bonus", v)} width="100%" /></Campo>
            <Campo t="Saldo livre"><NumInput value={p.saldoLivre} onChange={(v) => s("saldoLivre", v)} width="100%" /></Campo>
            <Campo t="Vale-transporte"><NumInput value={p.vt} onChange={(v) => s("vt", v)} width="100%" /></Campo>
            <Campo t="Vale-refeição"><NumInput value={p.vr} onChange={(v) => s("vr", v)} width="100%" /></Campo>
            <Campo t="Plano de saúde"><NumInput value={p.ps} onChange={(v) => s("ps", v)} width="100%" /></Campo>
            <Campo t="Assiduidade" dica="% do salário"><NumInput tipo="pct" value={p.assPct} onChange={(v) => s("assPct", v)} width="100%" /></Campo>
            <Campo t="R. férias"><NumInput value={p.rFerias} onChange={(v) => s("rFerias", v)} width="100%" /></Campo>
            <Campo t="Adiantamento salarial" dica="dia 20">
              <label className="flex items-center gap-1.5 text-xs mt-1.5"><input type="checkbox" checked={!!p.adiantamento} onChange={(e) => s("adiantamento", e.target.checked)} /> recebe 40% do salário base</label>
            </Campo>
            <Campo t="Desconto de VT">
              <label className="flex items-center gap-1.5 text-xs mt-1.5"><input type="checkbox" checked={!!p.descontaVt} onChange={(e) => s("descontaVt", e.target.checked)} /> desconta {pct(par.vtDesconto, 0)} do salário</label>
            </Campo>
          </div>
          <Campo t="Observação"><TxtInput value={p.obs} onChange={(v) => s("obs", v)} upper={false} /></Campo>
        </div>
        <div className="rounded-lg p-3 text-xs self-start" style={{ background: C.panel2 }}>
          <div className="font-bold mb-2" style={{ color: C.navy }}>Cálculo ao vivo</div>
          {[["Líquido", c.liquido], ["INSS patronal", c.inssPatronal], ["INSS funcionário", c.inssFunc], ["FGTS", c.fgts], ["Desconto VT", c.vtDesc], ["Assiduidade", c.ass],
            ["13º", c.decimo], ["Férias", c.ferias], ["Aviso", c.aviso], ["Multa FGTS", c.multa]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5"><span style={{ color: C.sub }}>{k}</span><span style={{ color: v < 0 ? C.red : C.text }}>{brl(v)}</span></div>
          ))}
          <div className="flex justify-between pt-2 mt-2 font-bold text-sm" style={{ borderTop: `1px solid ${C.line}`, color: C.navy }}><span>Custo mensal</span><span>{moeda(c.total)}</span></div>
          <div className="flex justify-between py-0.5" style={{ color: C.sub }}><span>Provisões (CDB)</span><span>{brl(c.provisoes)}</span></div>
          {est && <div className="mt-2 text-[10px]" style={{ color: C.sub }}>Estágio: sem INSS, FGTS, férias, aviso e multa.</div>}
          {p.regime === "DIRETOR" && <div className="mt-2 text-[10px]" style={{ color: C.sub }}>Diretor: 13º sobre pró-labore + bônus; sem aviso e multa.</div>}
          {(() => {
            const adiant = p.adiantamento ? c.F * 0.4 : 0;
            const linhas = [
              ["Dia 5 · folha", c.liquido - c.vtDesc + c.G + c.ass - adiant],
              ...(adiant ? [["Dia 20 · adiantamento", adiant]] : []),
              ["Dia 20 · INSS e FGTS", c.inssPatronal + c.inssFunc + c.fgts],
              ["Dia 29 · iFood", c.vt + c.vtDesc + c.vr + c.saldoLivre],
              ["Dia 10 · plano de saúde", c.ps],
              ["Dia 30 · provisões (CDB)", c.provisoes],
            ].filter(([, v]) => Math.abs(v) > 0.004);
            return (
              <div className="pt-2 mt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="font-bold mb-1" style={{ color: C.navy }}>Quando sai do caixa</div>
                {linhas.map(([k, v]) => (
                  <div key={k} className="flex justify-between py-0.5"><span style={{ color: C.sub }}>{k}</span><span>{brl(v)}</span></div>
                ))}
                <div className="flex justify-between pt-1 mt-1 font-semibold" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span style={{ color: C.sub }}>soma</span><span>{brl(linhas.reduce((a, [, v]) => a + v, 0))}</span>
                </div>
                <div className="text-[10px] mt-1" style={{ color: C.sub }}>
                  O desconto de 6% do VT sai do iFood, não da folha do dia 5.
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Modal>
  );
}

function Campo({ t, children, dica }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}{dica && <span className="font-normal"> · {dica}</span>}</div>
      {children}
    </label>
  );
}
function Linha({ t, children, dica }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
      <div>{t}{dica && <div className="text-[10px]" style={{ color: C.sub }}>{dica}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

/* ---------------- PRODUÇÃO ---------------- */
function Producao({ dados, calc, muda }) {
  const pr = dados.producao;
  const s = (k, v) => muda("producao", (x) => ({ ...x, [k]: v }));
  return (
    <div className="space-y-5">
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Cartao titulo="Custo por peça (semestre)">
          <Linha t="Custo produção / peça" dica={pr.custoPecaObs}><NumInput value={pr.custoPeca} onChange={(v) => s("custoPeca", v)} /></Linha>
          <Linha t="Razão interna" dica={pr.razaoInternaAuto ? `Calculada: 1 − ${pct(calc.pctFreelancer)} de freelancer (tabelas abaixo)` : "Valor manual"}>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={!!pr.razaoInternaAuto} onChange={(e) => s("razaoInternaAuto", e.target.checked)} /> automática</label>
              {pr.razaoInternaAuto ? <span className="font-semibold">{pct(calc.razaoInterna)}</span> : <NumInput tipo="pct" value={pr.razaoInternaManual} onChange={(v) => s("razaoInternaManual", v)} width={90} />}
            </div>
          </Linha>
          <Linha t="Razão custo prod. / operação precificada" dica="custo produção × razão interna"><b>{moeda(calc.razaoProd)}</b></Linha>
          <Linha t="Custo logístico / peça"><NumInput value={pr.custoLogPeca} onChange={(v) => s("custoLogPeca", v)} /></Linha>
          <Linha t="Razão custo logístico / peça" dica={pr.razaoLogObs}><NumInput value={pr.razaoLog} onChange={(v) => s("razaoLog", v)} /></Linha>
        </Cartao>
        <Cartao titulo="Metas">
          <Linha t="Ticket médio (semestre)"><NumInput value={pr.ticketMedio} onChange={(v) => s("ticketMedio", v)} /></Linha>
          <Linha t="Meta de peças faturadas (mês)"><NumInput tipo="num" casas={0} value={pr.metaPecas} onChange={(v) => s("metaPecas", v)} /></Linha>
          <Linha t="Margem de contribuição"><NumInput tipo="pct" value={pr.margemContribuicao} onChange={(v) => s("margemContribuicao", v)} width={90} /></Linha>
          <Linha t="Meta de faturamento (mês)"><b>{moeda(calc.metaMensal)}</b></Linha>
          <Linha t="Breakeven (peças/mês)"><b>{int(calc.breakevenPecas)}</b></Linha>
        </Cartao>
      </div>
      <TabelaFreelancer titulo="Expedição · Pessoal x Freelancer" tab={dados.freelancer.expedicao} set={(f) => muda("freelancer", (x) => ({ ...x, expedicao: f(x.expedicao) }))} />
      <TabelaFreelancer titulo="Corte · Pessoal x Freelancer" tab={dados.freelancer.corte} set={(f) => muda("freelancer", (x) => ({ ...x, corte: f(x.corte) }))} />
      <div className="text-xs" style={{ color: C.sub }}>Freelancer geral (expedição + corte): <b>{pct(calc.pctFreelancer)}</b> → razão interna {pct(1 - calc.pctFreelancer)}.</div>
    </div>
  );
}
function TabelaFreelancer({ titulo, tab = [], set }) {
  const { linhas, tot } = calcFreelancer(tab);
  const alt = (id, k, v) => set((l) => l.map((m) => (m.id === id ? { ...m, [k]: v } : m)));
  const add = () => set((l) => [...l, { id: novoId("m"), mes: "", pessoal: 0, freelancer: 0, pecas: 0 }]);
  const del = (id) => set((l) => l.filter((m) => m.id !== id));
  return (
    <Cartao titulo={titulo}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub }}>
            {["Mês", "Pessoal", "Freelancers", "Custo total", "Peças processadas", "Custo incorrido / peça", "% freelancer", ""].map((h, i) => <th key={i} className={`py-1.5 px-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
          </tr></thead>
          <tbody>{linhas.map((m) => (
            <tr key={m.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td className="px-2 py-1"><TxtInput value={m.mes} onChange={(v) => alt(m.id, "mes", v)} width={80} /></td>
              <td className="px-2 py-1 text-right"><NumInput value={m.pessoal} onChange={(v) => alt(m.id, "pessoal", v)} /></td>
              <td className="px-2 py-1 text-right"><NumInput value={m.freelancer} onChange={(v) => alt(m.id, "freelancer", v)} /></td>
              <td className="px-2 py-1 text-right font-semibold">{brl(m.custo)}</td>
              <td className="px-2 py-1 text-right"><NumInput tipo="num" casas={0} value={m.pecas} onChange={(v) => alt(m.id, "pecas", v)} width={90} /></td>
              <td className="px-2 py-1 text-right font-semibold" style={{ color: C.navy }}>{brlN(m.custoPeca, 2)}</td>
              <td className="px-2 py-1 text-right" style={{ color: C.sub }}>{m.custo ? pct(m.freelancer / m.custo, 1) : "—"}</td>
              <td className="px-2 py-1"><button onClick={() => del(m.id)} style={{ color: C.sub }}><Trash2 size={13} /></button></td>
            </tr>
          ))}</tbody>
          <tfoot><tr style={{ borderTop: `2px solid ${C.navy}` }} className="font-bold">
            <td className="px-2 py-1.5">TOTAL</td>
            <td className="px-2 py-1.5 text-right">{brl(tot.pessoal)}</td>
            <td className="px-2 py-1.5 text-right">{brl(tot.freelancer)}</td>
            <td className="px-2 py-1.5 text-right">{brl(tot.custo)}</td>
            <td className="px-2 py-1.5 text-right">{int(tot.pecas)}</td>
            <td className="px-2 py-1.5 text-right" style={{ color: C.accent }}>{brlN(tot.custoPeca, 2)}</td>
            <td className="px-2 py-1.5 text-right">{tot.custo ? pct(tot.freelancer / tot.custo, 1) : "—"}</td>
            <td />
          </tr></tfoot>
        </table>
      </div>
      <button onClick={add} className="flex items-center gap-1 text-xs font-semibold mt-2" style={{ color: C.accent }}><Plus size={14} /> Adicionar mês</button>
    </Cartao>
  );
}

/* ---------------- PARÂMETROS ---------------- */
function Parametros({ dados, muda }) {
  const p = dados.parametros;
  const s = (k, v) => muda("parametros", (x) => ({ ...x, [k]: v }));
  const itens = [
    ["inssPatronal", "INSS patronal", "pct"], ["inssFunc", "INSS do funcionário", "pct"], ["fgts", "FGTS", "pct"],
    ["vtDesconto", "Desconto de VT", "pct"], ["multaFgts", "Multa do FGTS (provisão)", "pct"], ["diasUteis", "Dias úteis no mês", "num"],
  ];
  return (
    <div className="max-w-xl">
      <Cartao titulo="Parâmetros de cálculo">
        <div className="text-xs mb-2" style={{ color: C.sub }}>Valem para todos os funcionários desta matriz. Mudar aqui recalcula tudo.</div>
        {itens.map(([k, t, tipo]) => (
          <div key={k} className="flex items-center justify-between py-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
            <span>{t}</span>
            <NumInput tipo={tipo} casas={tipo === "num" ? 0 : 2} value={p[k]} onChange={(v) => s(k, v)} width={100} />
          </div>
        ))}
      </Cartao>
    </div>
  );
}

/* ---------------- HISTÓRICO DE VERSÕES ---------------- */
function Versoes({ user, doc, sujo, onClose, onRestaurado }) {
  const [l, setL] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => { api(`/api/fin/matriz/${doc.id}/versoes?u=${user.id}`).then(setL).catch((e) => setErro(e.message)); }, []);
  const restaurar = async (v) => {
    if (!confirm(`Restaurar a versão de ${dataHora(v.createdAt)}?${sujo ? " As alterações não salvas serão perdidas." : ""} A versão atual fica guardada no histórico.`)) return;
    try { await api(`/api/fin/matriz/${doc.id}/versoes`, "POST", { usuarioId: user.id, versaoId: v.id }); onRestaurado(); } catch (e) { setErro(e.message); }
  };
  return (
    <Modal titulo={`Histórico · ${doc.nome}`} icone={History} onClose={onClose} largura={620}>
      {erro && <div className="p-2 rounded mb-2 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!l ? <Loader2 size={18} className="animate-spin" /> : !l.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhuma alteração salva ainda.</div> : l.map((v) => (
        <div key={v.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex-1">
            <div className="font-semibold">{dataHora(v.createdAt)} <span className="font-normal text-xs" style={{ color: C.sub }}>· {v.usuarioNome || "—"}</span></div>
            <div className="text-xs" style={{ color: C.sub }}>Versão salva {v.resumo}</div>
          </div>
          <button onClick={() => restaurar(v)} className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Restaurar</button>
        </div>
      ))}
    </Modal>
  );
}
