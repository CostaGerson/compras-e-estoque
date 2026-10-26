"use client";
// v404 — Compras: pedidos do KM desmembrados em itens → FPP base → demanda de matéria-prima → Levantamento
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, X, Search, FileText, Link2, Unlink, RefreshCw, Layers, Merge, PackageSearch, AlertTriangle, Boxes, CheckCircle2, ShoppingCart, KeyRound, Copy, Undo2, ClipboardList, PackageCheck } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import { ImportarNfs } from "./adm";   // v494 — NF subida pela OC passa pelo mesmo lançamento do movimento fiscal   // v424 — popups do sistema

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "—");
const brl = (v) => (v == null ? "—" : `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const qtdU = (v, u) => `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: u === "UN" ? 0 : 2, maximumFractionDigits: u === "UN" ? 0 : 2 })} ${String(u || "").toLowerCase()}`;
// v405 — botão: unidades + grosas inteiras (144)
const qtdG = (v, u, emb) => (emb ? `${qtdU(v, u)} · ${Math.ceil((Number(v) || 0) / emb - 1e-9)} grosa(s)` : qtdU(v, u));
const tipoMat = (m) => (m.papel === "FORRO" ? "forro" : m.categoria === "MALHA" ? "malha" : m.categoria === "AVIAMENTO" ? "aviamento" : "tecido");
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const rotPed = (n, cli) => (/^AV\d+$/.test(String(n || "")) ? `Compra avulsa · ${cli || ""}` : `Pedido ${n} · ${cli || ""}`);   // v419
const nomeUser = (u) => `${u?.nome || ""} ${u?.sobrenome || ""}`.trim();
const detArtigo = (d) => [d.fornecedor, d.cor, d.codigo, d.largura ? `${String(d.largura).replace(".", ",")} m` : null].filter(Boolean).join(" · ");

const STATUS = {
  LEVANTAMENTO: ["No levantamento", C.blue, C.blueSoft], ESTOQUE: ["Atendido pelo estoque · liberado p/ PCP", C.green, C.greenSoft],
  REPROVADO: ["Reprovado no estoque · vai para compra", C.red, C.redSoft],   // v483
  PIC: ["Em PIC", C.accent, C.accentSoft], OC: ["OC emitida", C.accent, C.accentSoft], NF: ["NF emitida", C.yellow, C.yellowSoft], ENTREGUE: ["Entregue · liberado p/ PCP", C.green, C.greenSoft],
};
function Chip({ cor = C.sub, fundo = C.panel2, children, title }) {
  return <span title={title} className="text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: fundo, color: cor, border: `1px solid ${cor}33` }}>{children}</span>;
}
function Modal({ titulo, onClose, children, largo }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`rounded-lg w-full ${largo === "xl" ? "max-w-6xl" : largo ? "max-w-2xl" : "max-w-lg"} ${largo === "xl" ? "" : "max-h-[90vh]"} flex flex-col`} style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className={`p-4 ${largo === "xl" ? "overflow-visible" : "overflow-auto"}`}>{children}</div>
      </div>
    </div>
  );
}

// ---------- FPP resumida (janela central) ----------
export function FppResumo({ fppId, item, veValores, onClose, onUsar, usando }) {
  const [f, setF] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    fetch(`/api/compras/fpp/${fppId}?qtd=${item?.qtd || 0}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setF(d); }).catch((e) => setErro(e.message));
  }, [fppId]);
  const Lin = ({ l, v, forte, cor }) => (
    <div className="flex justify-between gap-3 text-sm"><span style={{ color: C.sub }}>{l}</span><span className="text-right" style={{ color: cor || C.text, fontWeight: forte ? 700 : 400 }}>{v ?? "—"}</span></div>
  );
  const difPreco = f && item?.preco && f.valorProposto ? (item.preco - f.valorProposto) / f.valorProposto : null;
  return (
    <Modal titulo={f ? `FPP ${fmtFpp(f.numero)} · ${f.nomeComercial || f.item}` : "FPP"} onClose={onClose} largo>
      {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
      {!f && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {f && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Lin l="Peça" v={`${f.item} · ${f.tipo === "PLANO" ? "plano" : "malha"}`} />
            <Lin l="Cliente" v={f.clienteNome} />
            {f.negociacao && <Lin l="Negociação" v={f.negociacao} />}
            <Lin l="Qtde da FPP" v={f.qtde} />
            {veValores && <Lin l="Valor proposto na FPP" v={brl(f.valorProposto)} forte />}
            {veValores && item?.preco != null && <Lin l="Valor vendido no pedido" v={`${brl(item.preco)}${difPreco != null ? ` (${difPreco >= 0 ? "+" : ""}${(difPreco * 100).toFixed(1).replace(".", ",")}%)` : ""}`} cor={difPreco != null && Math.abs(difPreco) > 0.05 ? C.yellow : C.text} />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase mb-1.5" style={{ color: C.sub }}>Matéria-prima {item?.qtd ? `· para ${item.qtd} peças` : ""}</div>
            {!f.materiais.length && <div className="text-sm px-3 py-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>Esta FPP não tem artigo informado — a demanda sai vazia.</div>}
            {f.materiais.map((m) => (
              <div key={m.papel} className="rounded-md px-3 py-2 mb-1.5" style={{ background: C.panel2 }}>
                <div className="flex justify-between gap-2">
                  <div className="text-sm font-semibold" style={{ color: C.text }}>{m.nome} <span className="font-normal text-xs" style={{ color: C.sub }}>{tipoMat(m)}</span></div>
                  {m.demanda != null && <div className="text-sm font-bold" style={{ color: C.accent }}>{qtdG(m.demanda, m.unidade, m.embalagem)}</div>}
                </div>
                <div className="text-xs" style={{ color: C.sub }}>
                  {detArtigo({ ...m.det, fornecedor: m.fornecedor }) || <span style={{ color: C.yellow }}>sem fornecedor/cor/código</span>} · {m.base}{m.det?.obs ? ` · obs: ${m.det.obs}` : ""}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs" style={{ color: C.sub }}>Criada por {f.criadoPorNome || "—"} em {new Date(f.createdAt).toLocaleDateString("pt-BR")}</div>
          {onUsar && (
            <button disabled={usando} onClick={() => onUsar(f)} className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: usando ? 0.6 : 1 }}>
              {usando ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Usar esta FPP neste item
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------- busca livre de FPP (quando as sugestões não servem) ----------
let _fpps = null;
function BuscarFpp({ cliente, onClose, onEscolher }) {
  const [lista, setLista] = useState(_fpps);
  const [q, setQ] = useState("");
  const [soCliente, setSoCliente] = useState(true);
  useEffect(() => { if (!_fpps) fetch("/api/fpp").then((r) => r.json()).then((l) => { _fpps = Array.isArray(l) ? l : []; setLista(_fpps); }); }, []);
  const filtrada = useMemo(() => {
    if (!lista) return [];
    const t = norm(q).split(/\s+/).filter(Boolean);
    const c = norm(cliente).split(/\s+/).filter((x) => x.length > 2)[0];
    return lista.filter((f) => {
      const hay = norm(`${fmtFpp(f.numero)} ${f.item} ${f.nomeComercial || ""} ${f.clienteNome || ""} ${f.negociacao || ""}`);
      if (soCliente && c && !norm(f.clienteNome).includes(c)) return false;
      return t.every((x) => hay.includes(x));
    }).slice(0, 60);
  }, [lista, q, soCliente]);
  return (
    <Modal titulo="Buscar FPP" onClose={onClose} largo>
      <div className="flex gap-2 mb-3 items-center">
        <div className="flex-1 flex items-center gap-2 px-2 rounded" style={{ border: `1px solid ${C.line}` }}>
          <Search size={14} style={{ color: C.sub }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº, peça, nome comercial, negociação…" className="w-full py-1.5 text-sm outline-none" />
        </div>
        <label className="flex items-center gap-1 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={soCliente} onChange={(e) => setSoCliente(e.target.checked)} /> só deste cliente</label>
      </div>
      {!lista && <Loader2 size={16} className="animate-spin" style={{ color: C.sub }} />}
      {lista && !filtrada.length && <div className="text-sm" style={{ color: C.sub }}>Nenhuma FPP encontrada.</div>}
      {filtrada.map((f) => (
        <button key={f.id} onClick={() => onEscolher(f.id)} className="w-full text-left px-3 py-2 rounded-md mb-1 flex justify-between gap-2" style={{ background: C.panel2 }}>
          <span className="text-sm"><b>FPP {fmtFpp(f.numero)}</b> · {f.nomeComercial || f.item}<span className="text-xs" style={{ color: C.sub }}> · {f.clienteNome || "—"}{f.negociacao ? ` · ${f.negociacao}` : ""}</span></span>
          <span className="text-xs" style={{ color: C.sub }}>{new Date(f.createdAt).toLocaleDateString("pt-BR")}</span>
        </button>
      ))}
    </Modal>
  );
}

// ---------- Compras › Pedidos ----------
// v415 — fases de compras na guia superior (troca de tela entre as fases)
export const FASES_COMPRAS = [
  ["comprasPedidos", "Sincronização de pedidos", ClipboardList], ["levantamento", "Levantamento e estoque", Layers],   // v483 — cruzamento e atendidos dentro do Levantamento
  ["pic", "PIC diário", ClipboardList], ["comprasCotacoes", "Cotações", FileText], ["oc", "Ordens de compra", ShoppingCart],
];
export function FasesCompras({ atual, fases, ir }) {
  if (!ir) return null;
  const l = FASES_COMPRAS.filter(([k]) => !fases || fases.includes(k));
  return (
    <div className="flex gap-1 mb-4 overflow-x-auto" style={{ borderBottom: `1px solid ${C.line}` }}>
      {l.map(([k, t, Ico], i) => (
        <button key={k} onClick={() => k !== atual && ir(k)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap"
          style={{ color: atual === k ? C.accent : C.sub, borderBottom: atual === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
          <span className="text-[11px] font-bold rounded-full inline-flex items-center justify-center" style={{ width: 18, height: 18, background: atual === k ? C.accent : C.panel2, color: atual === k ? "#fff" : C.sub }}>{i + 1}</span>
          <Ico size={14} /> {t}
        </button>
      ))}
    </div>
  );
}
// barra de seleção com a devolução para a fase anterior
function BarraDevolver({ n, rotulo, onDevolver, onLimpar, ocupado }) {
  if (!n) return null;
  return (
    <div className="flex items-center gap-2 sticky bottom-0 py-3 z-10" style={{ background: "#F7F8FA" }}>
      <button disabled={ocupado} onClick={onDevolver} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel, color: C.red, border: `1px solid ${C.red}` }}>
        {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} {rotulo} ({n})
      </button>
      <button onClick={onLimpar} className="text-xs" style={{ color: C.sub }}>limpar seleção</button>
    </div>
  );
}
async function devolverItens(ids, dest) {
  const url = dest === "pedidos" ? "/api/compras/itens" : "/api/compras/cruzar";
  const body = dest === "pedidos" ? { ids } : { itemIds: ids };
  const r = await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error || "Erro ao devolver.");
  return x;
}

export function ComprasPedidos({ user, veValores, fases, ir }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("pendentes");
  const [ordem, setOrdem] = useState({ k: "entrega", d: 1 });   // v498
  const [q, setQ] = useState("");
  const [aberto, setAberto] = useState({});
  const [resumo, setResumo] = useState(null);   // { fppId, item, pedido }
  const [busca, setBusca] = useState(null);     // { item, pedido }
  const [usando, setUsando] = useState(false);

  const carregar = () => fetch("/api/compras/pedidos").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function usar(fpp) {
    setUsando(true);
    const r = await fetch("/api/compras/itens", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedidoNumero: resumo.pedido.numero, chave: resumo.item.chave, fppId: fpp.id, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setUsando(false);
    if (!r.ok) return alerta(x.error || "Não foi possível vincular.");
    setResumo(null); carregar();
  }
  async function dispensar(p) {   // v419 — pedido só para faturamento
    const motivo = (await perguntar(`Dispensar compras do pedido ${p.numero} (${p.cliente})?\nEle sai de compras e não entra no levantamento nem no cruzamento.\n\nMotivo (opcional):`, "Só para faturamento"));
    if (motivo === null) return;
    const r = await fetch("/api/compras/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero, motivo, quem: nomeUser(user) }) });
    if (!r.ok) return alerta("Erro ao dispensar.");
    carregar();
  }
  async function reativar(p) {
    if (!(await confirmar(`Voltar o pedido ${p.numero} para compras?`))) return;
    await fetch("/api/compras/pedidos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero }) });
    carregar();
  }
  async function desvincular(p, it) {
    if (!(await confirmar(`Tirar a FPP do item ${it.codigo || it.chave}? A demanda sai do levantamento.`))) return;
    const r = await fetch("/api/compras/itens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero, chave: it.chave }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return alerta(x.error || "Erro.");
    carregar();
  }

  const lista = useMemo(() => {
    if (!d) return [];
    const t = norm(q).split(/\s+/).filter(Boolean);
    return d.pedidos.filter((p) => {
      if (filtro === "fora" && p.fasePcp !== "FORA") return false;
      if (filtro === "pendentes" && p.comFpp >= p.total) return false;
      if (filtro === "completos" && p.comFpp < p.total) return false;
      const hay = norm(`${p.numero} ${p.cliente} ${p.itens.map((i) => `${i.codigo} ${i.descricao}`).join(" ")}`);
      return t.every((x) => hay.includes(x));
    });
  }, [d, filtro, q]);

  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando pedidos…</div>;
  const nPend = d.pedidos.filter((p) => p.comFpp < p.total).length;

  return (
    <div className="w-full">
      <FasesCompras atual="comprasPedidos" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Pedidos em <b>levantamento</b> ou <b>compras</b> no PCP. Cada item precisa de uma FPP base; ao escolher a FPP, a demanda de matéria-prima vai para o <b>Levantamento</b>.{d.emProducao ? ` ${d.emProducao} pedido(s) já programados, em produção ou concluídos no PCP não aparecem (matéria-prima já comprada).` : ""}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[["pendentes", `Sem FPP (${nPend})`], ["completos", "Com FPP em todos os itens"], ["todos", `Todos (${d.pedidos.length})`], ["fora", `Fora do PCP (${d.pedidos.filter((p) => p.fasePcp === "FORA").length})`], ["avulsas", "Compras avulsas"], ["dispensadas", `Compras dispensadas (${(d.dispensados || []).length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: filtro === k ? C.accent : C.panel, color: filtro === k ? "#fff" : C.sub, border: `1px solid ${filtro === k ? C.accent : C.line}` }}>{l}</button>
        ))}
        <div className="flex items-center gap-2 px-2 rounded ml-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente, item…" className="py-1.5 text-sm outline-none w-56" />
        </div>
        <button onClick={carregar} title="Atualizar" className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>

      {filtro === "avulsas" && <Avulsas user={user} />}
      {filtro === "dispensadas" && (
        <div>
          <div className="text-xs mb-2" style={{ color: C.sub }}>Pedidos lançados no KM só para faturamento: não entram em compras, levantamento nem cruzamento.</div>
          {!(d.dispensados || []).length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum pedido dispensado.</div>}
          {(d.dispensados || []).map((p) => (
            <div key={p.numero} className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.navy }}>Pedido {p.numero} · {p.cliente}</div>
                <div className="text-xs" style={{ color: C.sub }}>Entrega {dBR(p.entrega)}{p.motivo ? ` · ${p.motivo}` : ""} · dispensado {new Date(p.em).toLocaleDateString("pt-BR")}{p.porNome ? ` por ${p.porNome}` : ""}</div>
              </div>
              <button onClick={() => reativar(p)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.line}`, color: C.accent }}><Undo2 size={13} /> Voltar para compras</button>
            </div>
          ))}
        </div>
      )}
      {!["avulsas", "dispensadas"].includes(filtro) && !lista.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum pedido neste filtro.</div>}
      {/* v498 — sincronização de pedidos: lista ordenável; clicar no pedido abre os itens para ligar à FPP */}
      {!["avulsas", "dispensadas"].includes(filtro) && lista.length > 0 && (() => {
        const sitPcp = (p) => (p.fasePcp === "FORA" ? "Fora do PCP" : /PROGRAMAR/i.test(p.situacaoPcp || "") ? "A programar" : p.fasePcp === "COMPRAS" ? "Compras" : p.situacaoPcp || "—");
        const val = { numero: (p) => p.numero, cliente: (p) => p.cliente || "", entrega: (p) => p.entrega || "9999", situacao: (p) => sitPcp(p), itens: (p) => p.total, fpp: (p) => p.comFpp };
        const ord = [...lista].sort((a, z) => { const x = val[ordem.k](a), y = val[ordem.k](z); return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true })) * ordem.d; });
        const Th = ({ k, t, cls = "" }) => <th onClick={() => setOrdem((o) => ({ k, d: o.k === k ? -o.d : 1 }))} className={`px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${cls}`} title="Ordenar">{t}{ordem.k === k ? (ordem.d > 0 ? " ▲" : " ▼") : ""}</th>;
        return (
          <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-sm" data-sem-ordenar>
              <thead><tr className="text-xs" style={{ color: C.sub, background: C.panel2 }}>
                <th className="w-8" /><Th k="numero" t="Pedido" cls="text-left" /><Th k="cliente" t="Cliente" cls="text-left" /><Th k="entrega" t="Entrega" cls="text-center" /><Th k="situacao" t="Situação no PCP" cls="text-center" /><Th k="itens" t="Itens" cls="text-center" /><Th k="fpp" t="Itens com FPP" cls="text-center" /><th className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {ord.map((p) => {
                  const ab = !!aberto[p.numero];
                  const ok = p.comFpp >= p.total;
                  const sit = sitPcp(p);
                  return (
                    <React.Fragment key={p.numero}>
                      <tr onClick={() => setAberto((s0) => ({ ...s0, [p.numero]: !ab }))} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}`, background: ab ? C.accentSoft : undefined }}>
                        <td className="pl-3">{ab ? <ChevronDown size={15} style={{ color: C.sub }} /> : <ChevronRight size={15} style={{ color: C.sub }} />}</td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap" style={{ color: C.navy }}>{p.numero}{p.interno && <span className="ml-1"><Chip>interno</Chip></span>}</td>
                        <td className="px-3 py-2 truncate max-w-[320px]" title={p.cliente}>{p.cliente}</td>
                        <td className="px-3 py-2 text-center text-xs" style={{ color: C.sub }}>{dBR(p.entrega)}</td>
                        <td className="px-3 py-2 text-center"><Chip cor={sit === "Fora do PCP" ? C.sub : sit === "Compras" ? C.accent : C.blue} fundo={sit === "Fora do PCP" ? C.panel2 : sit === "Compras" ? C.accentSoft : C.blueSoft}>{sit}</Chip></td>
                        <td className="px-3 py-2 text-center">{p.total}</td>
                        <td className="px-3 py-2 text-center font-semibold" style={{ color: ok ? C.green : C.accent }}>{p.comFpp}/{p.total}</td>
                        <td className="px-3 py-2 text-right"><button onClick={(e) => { e.stopPropagation(); dispensar(p); }} title="Pedido só para faturamento: tira de compras" className="text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ border: `1px solid ${C.line}`, color: C.sub, background: C.panel }}>Dispensar compras</button></td>
                      </tr>
                      {ab && (
                        <tr><td colSpan={8} className="px-4 pb-3 pt-1" style={{ background: "#FCFCFD" }}>
                          {p.itensFora ? <div className="text-[11px] mb-1" style={{ color: C.sub }}>{p.itensFora} item(ns) já programado(s) no PCP não aparecem.</div> : null}
                          <div className="space-y-2">
                            {p.itens.map((it) => <ItemCard key={it.chave} p={p} it={it} veValores={veValores}
                              onVer={(fppId) => setResumo({ fppId, item: it, pedido: p, so: true })}
                              onSugestao={(fppId) => setResumo({ fppId, item: it, pedido: p })}
                              onBuscar={() => setBusca({ item: it, pedido: p })}
                              onDesvincular={() => desvincular(p, it)} />)}
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {resumo && <FppResumo fppId={resumo.fppId} item={resumo.item} veValores={veValores} onClose={() => setResumo(null)} onUsar={resumo.so ? null : usar} usando={usando} />}
      {busca && <BuscarFpp cliente={busca.pedido.cliente} onClose={() => setBusca(null)} onEscolher={(id) => { setResumo({ fppId: id, item: busca.item, pedido: busca.pedido }); setBusca(null); }} />}
    </div>
  );
}

// ---------- v474 — busca de fornecedor no cadastro (lista ao focar/digitar; nome, cidade e CNPJ) ----------
const nomeFornCad = (f) => f.nomeFantasia || f.nome || f.razaoSocial || "";
function BuscaFornecedor({ valor, idAtual, forns, onEscolher, estilo, placeholder = "Buscar no cadastro de fornecedores" }) {
  const [ab, setAb] = useState(false);
  const t = norm(valor || "");
  const l = useMemo(() => {
    // v494 — busca por palavras em qualquer ordem: nome fantasia/comercial, razão social, nome, cidade e CNPJ (com ou sem pontuação)
    const pal = t.split(/\s+/).filter(Boolean);
    const x = forns.filter((f) => { if (!pal.length) return true; const h = norm(`${f.nomeFantasia || ""} ${f.nome || ""} ${f.razaoSocial || ""} ${f.municipio || ""} ${(f.cnpjs || []).map((c) => `${c.cnpj} ${String(c.cnpj).replace(/\D/g, "")} ${c.razaoSocial || ""}`).join(" ")}`); return pal.every((p) => h.includes(p)); });
    return x.slice(0, 40);
  }, [forns, t]);
  const semCad = !!(valor || "").trim() && !idAtual;
  return (
    <div className="relative">
      <input value={valor || ""} onFocus={() => setAb(true)} onBlur={() => setTimeout(() => setAb(false), 200)}
        onChange={(e) => { const v = e.target.value; const f = forns.find((x) => norm(nomeFornCad(x)) === norm(v)); onEscolher(f || null, v); setAb(true); }}
        placeholder={placeholder} className="w-full px-2 py-1.5 rounded text-sm" title={semCad ? "Fornecedor não encontrado no cadastro" : ""}
        style={{ ...(estilo || {}), ...(semCad ? { border: `1px solid ${C.red}` } : idAtual ? { border: `1px solid ${C.green}` } : {}) }} />
      {ab && l.length > 0 && (
        <div className="absolute z-30 left-0 mt-1 rounded-md shadow-lg max-h-64 overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}`, minWidth: "100%", width: 340 }}>
          {l.map((f) => (
            <button key={f.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(f, nomeFornCad(f)); setAb(false); }}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="font-semibold truncate" style={{ color: C.navy }}>{nomeFornCad(f)}</div>
              <div className="text-[11px] truncate" style={{ color: C.sub }}>{[f.nomeFantasia && f.nome && f.nome !== f.nomeFantasia ? f.nome : null, f.razaoSocial && f.razaoSocial !== nomeFornCad(f) ? f.razaoSocial : null, [f.municipio, f.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—"}</div>
            </button>
          ))}
        </div>
      )}
      {ab && !l.length && <div className="absolute z-30 left-0 mt-1 rounded-md shadow-lg px-3 py-2 text-xs" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub, width: 300 }}>Nenhum fornecedor com esse nome. Cadastre em Artigos &amp; Fornec.</div>}
    </div>
  );
}

// ---------- v471 — busca do pedido da avulsa: nº ou cliente, só pedidos em andamento ----------
function BuscaPedido({ valor, cliente, onEscolher, sel, rotulo = "Pedido (nº ou cliente)", placeholder = "Digite o nº do pedido ou o cliente" }) {
  const [q, setQ] = useState(valor ? `${valor}${cliente ? ` · ${cliente}` : ""}` : "");
  const [l, setL] = useState([]);
  const [ab, setAb] = useState(false);
  const t = React.useRef(null);
  const buscar = (v) => { clearTimeout(t.current); t.current = setTimeout(() => fetch(`/api/compras/avulsas?pedidos=${encodeURIComponent(v)}`).then((r) => r.json()).then((x) => setL(Array.isArray(x) ? x : [])).catch(() => setL([])), 250); };
  const brl0 = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <label className="text-xs relative block" style={{ color: C.sub }}>{rotulo}
      <input value={q} onFocus={() => { setAb(true); buscar(valor ? "" : q); }} onBlur={() => setTimeout(() => setAb(false), 200)}
        onChange={(e) => { setQ(e.target.value); setAb(true); buscar(e.target.value); if (!e.target.value) onEscolher(null); }}
        placeholder={placeholder} className={`w-full px-2 py-1.5 rounded text-sm ${rotulo ? "mt-1" : ""}`} style={{ ...sel, ...(valor ? { borderColor: C.green } : {}) }} />
      {ab && l.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-md shadow-lg max-h-72 overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}`, minWidth: 460 }}>
          {l.map((p) => (
            <button key={p.numero} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onEscolher(p); setQ(`${p.numero} · ${p.cliente}`); setAb(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}` }}>
              <b style={{ color: C.navy }}>{p.numero}</b>
              <span className="flex-1 min-w-0 truncate" style={{ color: C.text }}>{p.cliente}</span>
              <span className="text-xs whitespace-nowrap" style={{ color: C.sub }} title="Data de lançamento do pedido">{p.emissao ? dBR(p.emissao) : ""}</span>
              <span className="text-xs whitespace-nowrap" style={{ color: C.sub }}>{(p.qtd || 0).toLocaleString("pt-BR")} pç</span>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: C.accent }}>{brl0(p.total)}</span>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

// v493 — etapa de cada item da avulsa (mesma régua do painel de compras)
const ETAPA_AV = { LEVANTAMENTO: ["Pendente", "#7A5AF8", "#F1EDFF"], ESTOQUE: ["Atendido pelo estoque", C.green, C.greenSoft], REPROVADO: ["Vai para compra", C.red, C.redSoft],
  EM_COTACAO: ["Em cotação", C.accent, C.accentSoft], AGUARDANDO_NF: ["Aguardando NF", C.yellow, C.yellowSoft], EM_COLETA: ["Em coleta", C.blue, C.blueSoft],
  EM_TRANSPORTADORA: ["Em entrega transportadora", "#4F46E5", "#EEF2FF"], ENTREGA_FORNECEDOR: ["Entrega do fornecedor", "#0E9384", "#E6F6F4"], RECEBIDA: ["Recebida", C.green, C.greenSoft],
  PIC: ["Em cotação", C.accent, C.accentSoft], OC: ["Aguardando NF", C.yellow, C.yellowSoft], NF: ["NF emitida", C.yellow, C.yellowSoft], ENTREGUE: ["Recebida", C.green, C.greenSoft] };
function EtapaItemAv({ i }) {
  if (!i.etapa) return <div />;
  const [t, cor, fundo] = ETAPA_AV[i.etapa] || [i.etapa, C.sub, C.panel2];
  const det = [i.pic, i.oc?.numero, i.oc?.nf ? `NF ${i.oc.nf}` : null, i.etapa === "EM_COLETA" ? (i.rota ? `rota ${dBR(i.rota.data).slice(0, 5)}` : "sem rota") : null, i.previsao && ["EM_TRANSPORTADORA", "ENTREGA_FORNECEDOR", "AGUARDANDO_NF"].includes(i.etapa) ? `prev. ${dBR(i.previsao).slice(0, 5)}` : null].filter(Boolean).join(" · ");
  return <div className="text-center leading-tight"><span className="text-[10px] font-semibold px-1.5 py-px rounded whitespace-nowrap" style={{ background: fundo, color: cor }}>{t}</span>{det && <div className="text-[10px] truncate" style={{ color: C.sub }}>{det}</div>}</div>;
}

// ---------- v417 — compras avulsas (operação ou complemento de pedido) ----------
const diasAte = (iso) => { if (!iso) return null; const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((new Date(`${iso}T00:00:00`) - h) / 86400000); };
const corBomPara = (iso) => { const dd = diasAte(iso); if (dd == null) return null; return dd <= 2 ? [C.red, C.redSoft] : dd <= 5 ? [C.yellow, C.yellowSoft] : [C.green, C.greenSoft]; };
const UNIDADES_AV = [["UN", "un"], ["M", "m"], ["KG", "kg"], ["PC", "pç"]];
let _fornAv = null;
export function Avulsas({ user, soBotao }) {   // v502 — soBotao: só o botão + a janela (a lista é o painel)
  const [l, setL] = useState(null);
  const [ed, setEd] = useState(null);   // compra em edição (nova ou existente)
  const [forns, setForns] = useState(_fornAv || []);
  const [aba, setAba] = useState("pendentes");   // v472

  const carregar = () => fetch("/api/compras/avulsas").then((r) => r.json()).then(setL).catch(() => setL([]));
  useEffect(() => { carregar(); if (!_fornAv) fetch("/api/fornecedores").then((r) => r.json()).then((x) => { _fornAv = Array.isArray(x) ? x : []; setForns(_fornAv); }).catch(() => {}); }, []);
  const nomeF = (f) => f.nome || f.nomeFantasia || f.razaoSocial || "";
  async function salvar() {
    const r = await fetch("/api/compras/avulsas", { method: ed.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...ed, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return alerta(x.error || "Erro ao salvar.");
    setEd(null); carregar(); window.dispatchEvent(new Event("ce:avulsasMudou"));
  }
  const abrirEdicao = (c) => setEd({ ...c, itens: (c.itens || []).map((i) => ({ ...i, quantidade: String(i.quantidade ?? "").replace(".", ","), ...((c.itens || []).some((x) => x && Object.prototype.hasOwnProperty.call(x, "pedidoRef")) ? { pedidoRef: i.pedidoRef || "", pedidoCliente: i.pedidoCliente || "" } : { pedidoRef: c.destino === "PEDIDO" ? c.pedidoRef || "" : "", pedidoCliente: c.destino === "PEDIDO" ? c.pedidoCliente || "" : "" }) })) });
  // v502 — o painel pede para abrir uma avulsa (clique no "Avulsa 0000x")
  useEffect(() => {
    const f = async (e) => { const id = e.detail?.id; let ll = l; if (!ll) { ll = await fetch("/api/compras/avulsas").then((r) => r.json()).catch(() => []); setL(ll); } const c = (ll || []).find((x) => x.id === id); if (c) abrirEdicao(c); };
    window.addEventListener("ce:editarAvulsa", f); return () => window.removeEventListener("ce:editarAvulsa", f);
  }, [l]);
  async function bomPara(c, k, v) {   // v470
    setL((ll) => ll.map((x) => (x.id === c.id ? { ...x, itens: x.itens.map((i, j) => (j === k ? { ...i, bomPara: v } : i)) } : x)));
    const r = await fetch("/api/compras/avulsas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...c, itens: c.itens.map((i, j) => (j === k ? { ...i, bomPara: v } : i)), quem: nomeUser(user) }) });
    if (!r.ok) { const x = await r.json().catch(() => ({})); alerta(x.error || "Erro ao salvar."); }
    carregar();
  }
  async function status(c, st) {
    if (st === "CANCELADA" && !(await confirmar("Cancelar esta compra avulsa?"))) return;
    await fetch("/api/compras/avulsas", { method: st === "CANCELADA" ? "DELETE" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: st, usuarioId: user?.id }) });
    carregar(); window.dispatchEvent(new Event("ce:avulsasMudou"));
  }
  const vis = (l || []).filter((c) => (aba === "arquivadas" ? c.status === "RECEBIDA" : c.status !== "RECEBIDA"));   // v472
  const BomPara = ({ iso }) => { const c = corBomPara(iso); return iso ? <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ color: c[0], background: c[1] }}>{dBR(iso)}</span> : <span className="text-xs" style={{ color: C.sub }}>—</span>; };
  const ST = { ABERTA: [C.accent, C.accentSoft, "aberta"], COMPRADA: [C.blue, C.blueSoft || C.panel2, "comprada"], RECEBIDA: [C.green, C.greenSoft, "recebida"] };
  const sel = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
  const setIt = (i, k, v) => setEd((e) => ({ ...e, itens: e.itens.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const novaAv = () => setEd({ numero: "", destino: "OPERACAO", pedidoRef: "", obs: "", itens: [{ nome: "", quantidade: "", unidade: "UN", fornecedorNome: "", pedidoRef: "", pedidoCliente: "", bomPara: "", obs: "" }] });
  return (
    <div>
      {soBotao && <button onClick={novaAv} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>+ Compra avulsa</button>}
      {!soBotao && <>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs flex-1" style={{ color: C.sub }}>Material para a operação ou para completar um pedido. Aberta, a compra entra no <b>Levantamento</b>. <b>Bom para</b> = data máxima de chegada na fábrica: até 2 dias vermelho, até 5 amarelo, depois verde.</div>
        <button onClick={() => setEd({ numero: "", destino: "OPERACAO", pedidoRef: "", obs: "", itens: [{ nome: "", quantidade: "", unidade: "UN", fornecedorNome: "", pedidoRef: "", pedidoCliente: "", bomPara: "", obs: "" }] })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>+ Compra avulsa</button>
      </div>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {/* v472 — recebidas vão para Arquivadas */}
      {l && <div className="flex gap-2 mb-3">
        {[["pendentes", `Pendentes (${l.filter((c) => c.status !== "RECEBIDA").length})`], ["arquivadas", `Arquivadas · recebidas (${l.filter((c) => c.status === "RECEBIDA").length})`]].map(([k, t]) => (
          <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: aba === k ? C.accent : C.panel, color: aba === k ? "#fff" : C.sub, border: `1px solid ${aba === k ? C.accent : C.line}` }}>{t}</button>
        ))}
      </div>}
      {l && !vis.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>{aba === "arquivadas" ? "Nenhuma compra avulsa recebida." : "Nenhuma compra avulsa pendente."}</div>}
      {vis.map((c) => {
        const [cor, fundo, txt] = ST[c.status] || ST.ABERTA;
        return (
          <div key={c.id} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>Avulsa {c.numero || `#${c.id}`} · {(() => { const novo = (c.itens || []).some((i) => i && Object.prototype.hasOwnProperty.call(i, "pedidoRef")); const ps = [...new Set((c.itens || []).map((i) => (novo ? i.pedidoRef : c.destino === "PEDIDO" ? c.pedidoRef : null)).filter(Boolean))]; return ps.length ? `pedido${ps.length > 1 ? "s" : ""} ${ps.join(", ")}${ps.length === 1 && c.pedidoCliente ? ` · ${c.pedidoCliente}` : ""}` : "operação"; })()}
                {c.obs && <span className="font-normal text-xs" style={{ color: C.sub }}> · {c.obs}</span>}
                <span className="font-normal text-xs" style={{ color: C.sub }}> · {new Date(c.createdAt).toLocaleDateString("pt-BR")}{c.criadoPorNome ? ` por ${c.criadoPorNome}` : ""}</span></div>
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
              {c.status === "ABERTA" && <button onClick={() => status(c, "COMPRADA")} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.blue }}>marcar comprada</button>}
              {c.status === "COMPRADA" && <button onClick={() => status(c, "RECEBIDA")} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.green }}>marcar recebida</button>}
              {c.status !== "ABERTA" && <button onClick={() => status(c, c.status === "RECEBIDA" ? "COMPRADA" : "ABERTA")} title="Voltar para a fase anterior" className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.sub }}>voltar</button>}
              <button onClick={() => setEd({ ...c, itens: (c.itens || []).map((i) => ({ ...i, quantidade: String(i.quantidade ?? "").replace(".", ","), ...((c.itens || []).some((x) => x && Object.prototype.hasOwnProperty.call(x, "pedidoRef")) ? { pedidoRef: i.pedidoRef || "", pedidoCliente: i.pedidoCliente || "" } : { pedidoRef: c.destino === "PEDIDO" ? c.pedidoRef || "" : "", pedidoCliente: c.destino === "PEDIDO" ? c.pedidoCliente || "" : "" }) })) })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.text }}>editar</button>
              <button onClick={() => status(c, "CANCELADA")} title="Cancelar" style={{ color: C.sub }}><X size={15} /></button>
            </div>
            {(c.itens || []).map((i, k) => (
              <div key={k} className="grid gap-3 px-4 py-2 text-sm items-center" style={{ gridTemplateColumns: "minmax(0,1fr) 100px 200px 150px 190px", borderTop: k ? `1px solid ${C.line}` : "none" }}>
                <div style={{ color: C.text }}>{i.nome}{i.obs ? <div className="text-[11px]" style={{ color: C.sub }}>{i.obs}</div> : null}</div>
                <div className="font-semibold" style={{ color: C.accent }}>{qtdU(i.quantidade, i.unidade)}</div>
                <div className="text-xs truncate" style={{ color: C.sub }} title={[i.fornecedorNome, i.pedidoRef ? `Pedido ${i.pedidoRef} · ${i.pedidoCliente || ""}` : null].filter(Boolean).join("\n")}>
                  {i.pedidoRef ? <span className="font-semibold mr-1.5 px-1.5 py-0.5 rounded" style={{ background: C.blueSoft, color: C.blue }}>Ped. {i.pedidoRef}</span> : null}{i.fornecedorNome || ""}</div>
                <EtapaItemAv i={i} />   {/* v493 */}
                {/* v470 — bom para preenchido direto na lista */}
                <label className="flex items-center gap-1"><span className="text-[11px]" style={{ color: C.sub }}>bom para</span>
                  {(() => { const cb = corBomPara(i.bomPara); return <input type="date" value={i.bomPara || ""} disabled={c.status === "CANCELADA"} onChange={(e) => bomPara(c, k, e.target.value)} className="px-1.5 py-0.5 rounded text-xs" style={{ border: `1px solid ${cb ? cb[0] : C.line}`, color: cb ? cb[0] : C.sub, background: cb ? cb[1] : C.panel, fontWeight: cb ? 600 : 400 }} />; })()}
                </label>
              </div>
            ))}
          </div>
        );
      })}
      </>}
      {ed && (
        <Modal titulo={ed.id ? `Compra avulsa ${ed.numero || `#${ed.id}`}` : "Nova compra avulsa · o nº sai ao salvar"} onClose={() => setEd(null)} largo="xl">
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
            <div className="text-xs self-end pb-2" style={{ color: C.sub }}>Cada item pode ser de um <b>pedido</b> diferente (entra na DRE dele). Sem pedido = <b>operação</b>.</div>
            <label className="text-xs" style={{ color: C.sub }}>Observação<input value={ed.obs || ""} onChange={(e) => setEd({ ...ed, obs: e.target.value })} className="w-full px-2 py-1.5 rounded text-sm mt-1" style={sel} /></label>
          </div>
          <div className="grid gap-2 text-xs mb-1" style={{ gridTemplateColumns: "minmax(0,1.8fr) 90px 80px minmax(0,1.2fr) minmax(0,1.3fr) 150px 24px", color: C.sub }}><span>Item</span><span>Quantidade</span><span>Unidade</span><span>Fornecedor (se houver)</span><span>Pedido (se houver)</span><span>Bom para</span><span /></div>
          {ed.itens.map((i, k) => {
            const c = corBomPara(i.bomPara);
            return (
              <div key={k} className="grid gap-2 mb-2 items-center" style={{ gridTemplateColumns: "minmax(0,1.8fr) 90px 80px minmax(0,1.2fr) minmax(0,1.3fr) 150px 24px" }}>
                <input value={i.nome || ""} onChange={(e) => setIt(k, "nome", e.target.value)} placeholder="Nome do item" className="px-2 py-1.5 rounded text-sm" style={sel} />
                <input value={i.quantidade ?? ""} onChange={(e) => setIt(k, "quantidade", e.target.value)} inputMode="decimal" className="px-2 py-1.5 rounded text-sm" style={sel} />
                <select value={i.unidade || "UN"} onChange={(e) => setIt(k, "unidade", e.target.value)} className="px-2 py-1.5 rounded text-sm" style={sel}>{UNIDADES_AV.map(([u, n]) => <option key={u} value={u}>{n}</option>)}</select>
                <BuscaFornecedor valor={i.fornecedorNome} idAtual={i.fornecedorId} forns={forns} estilo={sel} placeholder="opcional · buscar no cadastro"
                  onEscolher={(f, v) => setEd((ee) => ({ ...ee, itens: ee.itens.map((x, j) => (j === k ? { ...x, fornecedorNome: f ? nomeFornCad(f) : v, fornecedorId: f ? f.id : null } : x)) }))} />
                <BuscaPedido key={`p${k}-${i.pedidoRef || ""}`} rotulo="" placeholder="operação · nº ou cliente" valor={i.pedidoRef} cliente={i.pedidoCliente} sel={sel}
                  onEscolher={(p) => setEd((ee) => ({ ...ee, itens: ee.itens.map((x, j) => (j === k ? { ...x, pedidoRef: p?.numero || "", pedidoCliente: p?.cliente || "" } : x)) }))} />
                <input type="date" value={i.bomPara || ""} onChange={(e) => setIt(k, "bomPara", e.target.value)} className="px-2 py-1.5 rounded text-sm"
                  style={{ ...sel, ...(c ? { color: c[0], background: c[1], border: `1px solid ${c[0]}`, fontWeight: 600 } : {}) }} />
                <button onClick={() => setEd((e) => ({ ...e, itens: e.itens.filter((_, j) => j !== k) }))} style={{ color: C.red }}><X size={15} /></button>
                <input value={i.obs || ""} onChange={(e) => setIt(k, "obs", e.target.value)} placeholder="Obs. do item (cor, medida, onde usar…)" className="px-2 py-1 rounded text-xs" style={{ ...sel, gridColumn: "1 / span 6", marginTop: -4 }} />   {/* v475 */}
              </div>
            );
          })}
          <button onClick={() => setEd((e) => ({ ...e, itens: [...e.itens, { nome: "", quantidade: "", unidade: "UN", fornecedorNome: "", pedidoRef: e.itens[e.itens.length - 1]?.pedidoRef || "", pedidoCliente: e.itens[e.itens.length - 1]?.pedidoCliente || "", bomPara: "", obs: "" }] }))} className="text-xs font-semibold mb-4" style={{ color: C.accent }}>+ Adicionar item</button>
          <div className="flex justify-end gap-2">
            {ed.id && <button onClick={async () => { await status(ed, "CANCELADA"); setEd(null); }} className="mr-auto px-3 py-2 rounded-md text-sm" style={{ color: C.red }}>Cancelar esta compra avulsa</button>}
            <button onClick={() => setEd(null)} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
            <button onClick={salvar} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ItemCard({ p, it, veValores, onVer, onSugestao, onBuscar, onDesvincular }) {
  const v = it.vinculo;
  return (
    <div className="rounded-md px-3 py-2.5" style={{ background: C.panel2, border: `1px solid ${v ? C.green + "55" : C.line}` }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.text }}>{it.codigo ? `${it.codigo} · ` : ""}{it.descricao || "—"}</div>
          <div className="text-xs" style={{ color: C.sub }}>{it.qtd} peças{veValores && it.preco != null ? ` · ${brl(it.preco)}/pç` : ""}{it.grade?.length ? ` · ${it.grade.map((g) => `${g.tam}:${g.qtd}`).join(" ")}` : ""}</div>
        </div>
        {it.colunaPcp && <Chip cor={C.navy} title="Coluna do item no PCP">PCP: {it.colunaPcp === "LEVANTAMENTO" ? "levantamento" : it.colunaPcp === "COMPRAS" ? "compras" : it.colunaPcp.toLowerCase()}</Chip>}
        {v ? <Chip cor={STATUS[v.status]?.[1] || C.green} fundo={STATUS[v.status]?.[2] || C.greenSoft}>{STATUS[v.status]?.[0] || v.status}</Chip> : <Chip cor={C.yellow} fundo={C.yellowSoft}>Sem FPP</Chip>}
      </div>
      {v ? (
        <div className="mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onVer(v.fppId)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: C.panel, color: C.navy, border: `1px solid ${C.line}` }}>
              <FileText size={12} /> FPP {fmtFpp(v.fppNumero)}{v.fpp ? ` · ${v.fpp.nomeComercial || v.fpp.item}` : ""}
            </button>
            {v.status === "LEVANTAMENTO" && <button onClick={onBuscar} className="text-xs px-2 py-1 rounded" style={{ color: C.sub, border: `1px solid ${C.line}`, background: C.panel }}>trocar</button>}
            {v.status === "LEVANTAMENTO" && <button onClick={onDesvincular} title="Tirar a FPP" className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Unlink size={12} /></button>}
          </div>
          {!(v.demanda || []).length && <div className="mt-1.5 text-xs flex items-center gap-1" style={{ color: C.yellow }}><AlertTriangle size={12} /> A FPP não tem artigo — sem demanda gerada.</div>}
          {(v.demanda || []).map((dm, i) => (
            <div key={i} className="mt-1.5 flex justify-between gap-2 text-xs">
              <span style={{ color: C.text }}><b>{dm.nome}</b>{dm.papel === "FORRO" ? " (forro)" : ""} <span style={{ color: C.sub }}>{detArtigo(dm)}{dm.obs ? ` · obs: ${dm.obs}` : ""}</span></span>
              <span className="font-semibold whitespace-nowrap" style={{ color: C.accent }}>{qtdU(dm.quantidade, dm.unidade)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {it.sugestoes.length ? <span className="text-[11px]" style={{ color: C.sub }}>Sugestões:</span> : <span className="text-[11px]" style={{ color: C.sub }}>Nenhuma FPP parecida deste cliente.</span>}
          {it.sugestoes.map((s) => (
            <button key={s.id} onClick={() => onSugestao(s.id)} title={`nome ${s.nome}% · valor ${s.valor}%`} className="text-xs px-2 py-1 rounded-md text-left" style={{ background: C.panel, border: `1px solid ${C.accent}55`, color: C.text }}>
              <b>FPP {fmtFpp(s.numero)}</b> · {s.nomeComercial || s.item}{veValores && s.valorProposto ? ` · ${brl(s.valorProposto)}` : ""}
              <span className="ml-1 font-semibold" style={{ color: C.accent }}>{s.score}%</span>
            </button>
          ))}
          <button onClick={onBuscar} className="text-xs px-2 py-1 rounded-md flex items-center gap-1" style={{ color: C.sub, border: `1px dashed ${C.line}`, background: C.panel }}><Search size={11} /> buscar outra</button>
        </div>
      )}
    </div>
  );
}

// ---------- Compras › Levantamento ----------
export function Levantamento({ user, veValores, fases, ir, fase, irCruzar, irPic }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState(fase === "cruzamento" ? "cruzamento" : "consolidado");
  const [salvando, setSalvando] = useState(false);
  const [marc, setMarc] = useState(new Set());   // v415 — itens marcados para devolver a Pedidos
  const tog = (id) => setMarc((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function devolver() {
    if (!(await confirmar(`Devolver ${marc.size} item(ns) para Pedidos? A FPP base é desvinculada e a demanda sai do levantamento.`))) return;
    setSalvando(true);
    try { await devolverItens([...marc], "pedidos"); setMarc(new Set()); carregar(); } catch (e) { alerta(e.message); }
    setSalvando(false);
  }
  const carregar = () => fetch("/api/compras/levantamento").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function equiparar(de, para) {
    setSalvando(true);
    const r = await fetch("/api/compras/levantamento", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ de, para }) });
    setSalvando(false);
    if (!r.ok) { const x = await r.json().catch(() => ({})); return alerta(x.error || "Erro."); }
    carregar();
  }

  const porPedido = useMemo(() => {
    if (!d) return [];
    const m = {};
    for (const l of d.linhas) (m[l.pedidoNumero] ||= { numero: l.pedidoNumero, cliente: l.cliente, entrega: l.entrega, linhas: [] }).linhas.push(l);
    return Object.values(m).sort((a, b) => String(a.entrega || "9").localeCompare(String(b.entrega || "9")));
  }, [d]);
  const nomeArt = useMemo(() => Object.fromEntries((d?.consolidado || []).map((c) => [c.artigoId, c])), [d]);

  const barra = <FasesCompras atual={fase === "cruzamento" ? "comprasCruzamento" : "levantamento"} fases={fases} ir={ir} />;
  if (fase === "cruzamento") return <div className="w-full">{barra}<Cruzamento user={user} veValores={veValores} onMudou={carregar} irPic={irPic} /></div>;
  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="w-full">{barra}<div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando levantamento…</div></div>;

  const Kpi = ({ l, v }) => <div className="rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}><div className="text-xs" style={{ color: C.sub }}>{l}</div><div className="text-xl font-bold" style={{ color: C.navy }}>{v}</div></div>;
  return (
    <div className="w-full">
      {barra}
      <p className="text-sm mb-3" style={{ color: C.sub }}>Demandas de matéria-prima dos pedidos e das compras avulsas. Clique em <b>Cruzar com estoque</b>: o sistema mostra o que o estoque atende e você <b>autoriza</b> (fica atendido pelo estoque e o Leandro é avisado) ou <b>reprova</b> (vira demanda de compra, entra no PIC).</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi l="Pedidos" v={d.pedidos} /><Kpi l="Itens" v={d.itens} /><Kpi l="Artigos" v={d.consolidado.length} /><Kpi l="Equiparações sugeridas" v={d.equiparacoes.length} />
      </div>
      <div className="flex gap-1 mb-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["consolidado", "Demanda consolidada", Layers], ["equiparacoes", `Equiparações${d.equiparacoes.length ? ` (${d.equiparacoes.length})` : ""}`, Merge], ["itens", "Demandas por item", PackageSearch], ["atendidos", "Atendidos pelo estoque", PackageCheck]].map(([k, t, Ico]) => (
          <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium" style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}><Ico size={15} /> {t}</button>
        ))}
        <button onClick={() => setAba("cruzamento")} title="Cruza com o saldo de estoque (menos reservas) e sugere os atendimentos" className="ml-auto mb-1 px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: aba === "cruzamento" ? C.navy : C.accent, color: "#fff" }}><Boxes size={14} /> Cruzar com estoque</button>
      </div>
      {aba === "cruzamento" && <Cruzamento user={user} veValores={veValores} onMudou={carregar} irPic={irPic} />}
      {aba === "atendidos" && <Atendidos />}   {/* v483 */}

      {!["cruzamento", "atendidos"].includes(aba) && !d.linhas.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma demanda no levantamento. Vincule a FPP base nos itens em Compras › Pedidos.</div>}

      {aba === "consolidado" && d.consolidado.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2 }}>
            <div className="flex-1">Artigo</div><div className="w-48">Fornecedor · cor · código</div><div className="w-28 text-right">Demanda</div><div className="w-24 text-right">Pedidos</div>{veValores && <div className="w-28 text-right">Estimado</div>}
          </div>
          {d.consolidado.map((c) => (
            <div key={c.artigoId} className="flex px-4 py-2.5 text-sm items-center" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1"><b>{c.nome}</b> <span className="text-xs" style={{ color: C.sub }}>{c.categoria?.toLowerCase()}</span>
                {c.juntados.length > 0 && <div className="text-[11px]" style={{ color: C.green }}>+ juntou {c.juntados.map((j) => detArtigo(j) || "sem detalhe").join(", ")}</div>}</div>
              <div className="w-48 text-xs" style={{ color: detArtigo(c) ? C.sub : C.yellow }}>{detArtigo(c) || "sem detalhe"}</div>
              <div className="w-28 text-right font-bold" style={{ color: C.accent }}>{c.compra ? <>{c.compra} grosa(s)<div className="text-[11px] font-normal" style={{ color: C.sub }}>{qtdU(c.quantidade, c.unidade)} de {qtdU(c.compra * c.embalagem, c.unidade)}</div></> : qtdU(c.quantidade, c.unidade)}</div>
              <div className="w-24 text-right text-xs" style={{ color: C.sub }} title={c.pedidos.join(", ")}>{c.pedidos.length} ped · {c.itens} it</div>
              {veValores && <div className="w-28 text-right text-xs" style={{ color: C.sub }}>{c.valorEstimado ? brl(c.valorEstimado) : "—"}</div>}
            </div>
          ))}
        </div>
      )}

      {aba === "equiparacoes" && (
        <div className="space-y-2">
          {!d.equiparacoes.length && d.linhas.length > 0 && <div className="text-sm py-4 text-center" style={{ color: C.sub }}>Nenhum artigo incompleto que possa juntar a outro.</div>}
          {d.equiparacoes.map((e) => (
            <div key={e.de.artigoId} className="rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-sm"><b>{e.de.nome}</b> <span style={{ color: C.yellow }}>{detArtigo(e.de) || "sem detalhe"}</span> · <b style={{ color: C.accent }}>{qtdU(e.quantidade, e.de.unidade)}</b> <span className="text-xs" style={{ color: C.sub }}>em {e.linhas} item(ns)</span></div>
              <div className="text-xs mt-1 mb-1.5" style={{ color: C.sub }}>Pode juntar ao volume de:</div>
              <div className="flex flex-wrap gap-2">
                {e.para.map((b) => (
                  <button key={b.artigoId} disabled={salvando} onClick={() => equiparar(e.de.artigoId, b.artigoId)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-semibold" style={{ background: C.greenSoft, color: C.green, border: `1px solid ${C.green}55` }}>
                    <Merge size={12} /> {b.nome} · {detArtigo(b)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {d.linhas.some((l) => l.equiparadoA) && (
            <div className="rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>Já juntados</div>
              {[...new Map(d.linhas.filter((l) => l.equiparadoA).map((l) => [l.artigoId, l])).values()].map((l) => (
                <div key={l.artigoId} className="flex items-center justify-between text-xs py-1">
                  <span>{l.nome} <span style={{ color: C.sub }}>{detArtigo(l) || "sem detalhe"}</span> → {nomeArt[l.equiparadoA]?.nome} <span style={{ color: C.sub }}>{detArtigo(nomeArt[l.equiparadoA] || {})}</span></span>
                  <button disabled={salvando} onClick={() => equiparar(l.artigoId, null)} className="px-2 py-0.5 rounded" style={{ color: C.red, border: `1px solid ${C.line}` }}>desfazer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === "itens" && d.linhas.length > 0 && <div className="text-xs mb-2" style={{ color: C.sub }}>Marque os itens para devolver a Pedidos (a FPP base é desvinculada).</div>}
      {aba === "itens" && porPedido.map((p) => (
        <div key={p.numero} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2 text-sm font-semibold flex items-center gap-2" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>
            {(() => { const ids = [...new Set(p.linhas.map((l) => l.itemId))]; const todos = ids.every((x) => marc.has(x));
              return <input type="checkbox" checked={todos} title="Marcar o pedido inteiro" onChange={() => setMarc((s0) => { const n = new Set(s0); ids.forEach((x) => (todos ? n.delete(x) : n.add(x))); return n; })} />; })()}
            {rotPed(p.numero, p.cliente)} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
          {p.linhas.map((l, i) => (
            <div key={i} className="flex px-4 py-2 text-xs gap-2" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <input type="checkbox" checked={marc.has(l.itemId)} onChange={() => tog(l.itemId)} style={{ visibility: i && p.linhas[i - 1].itemId === l.itemId ? "hidden" : "visible" }} />
              <div className="w-56 truncate" style={{ color: C.text }} title={l.descricao}>{l.chave} · {l.descricao} <span style={{ color: C.sub }}>({l.qtdPecas} pç)</span></div>
              <div className="flex-1"><b>{l.nome}</b>{l.papel === "FORRO" ? " (forro)" : ""} <span style={{ color: C.sub }}>{detArtigo(l)}{l.obs ? ` · obs: ${l.obs}` : ""}</span>{l.equiparadoA && <span style={{ color: C.green }}> → junto com {detArtigo(nomeArt[l.equiparadoA] || {})}</span>}</div>
              <div className="w-24 text-right font-semibold" style={{ color: C.accent }}>{qtdU(l.quantidade, l.unidade)}</div>
            </div>
          ))}
        </div>
      ))}
      {aba === "itens" && <BarraDevolver n={marc.size} rotulo="Devolver para Pedidos" ocupado={salvando} onDevolver={devolver} onLimpar={() => setMarc(new Set())} />}
    </div>
  );
}

// ---------- v415 — itens atendidos pelo estoque (podem voltar ao levantamento) ----------
export function Atendidos({ fases, ir }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [marc, setMarc] = useState(new Set());
  const [ocupado, setOcupado] = useState(false);
  const carregar = () => fetch("/api/compras/cruzar?atendidos=1").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x.itens); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const tog = (id) => setMarc((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function devolver() {
    if (!(await confirmar(`Devolver ${marc.size} item(ns) para o levantamento? A reserva do estoque é desfeita.`))) return;
    setOcupado(true);
    try { await devolverItens([...marc], "levantamento"); setMarc(new Set()); carregar(); } catch (e) { alerta(e.message); }
    setOcupado(false);
  }
  const porPedido = useMemo(() => {
    const m = {};
    for (const i of d || []) (m[i.pedidoNumero] ||= { numero: i.pedidoNumero, cliente: i.cliente, entrega: i.entrega, itens: [] }).itens.push(i);
    return Object.values(m);
  }, [d]);
  return (
    <div className="w-full">
      <FasesCompras atual="comprasAtendidos" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Itens autorizados para atender pelo estoque. Enquanto o material não seguiu para a produção, dá para devolver ao levantamento.</p>
      {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {d && !d.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum item atendido pelo estoque.</div>}
      {porPedido.map((p) => (
        <div key={p.numero} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2 text-sm font-semibold" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>{rotPed(p.numero, p.cliente)} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
          {p.itens.map((i) => (
            <label key={i.id} className="flex items-start gap-3 px-4 py-2 text-xs" style={{ borderTop: `1px solid ${C.line}`, cursor: i.seguiu ? "default" : "pointer" }}>
              <input type="checkbox" disabled={i.seguiu} checked={marc.has(i.id)} onChange={() => tog(i.id)} className="mt-0.5" />
              <div className="flex-1">
                <div className="text-sm" style={{ color: C.text }}>{i.chave} · {i.descricao} <span className="text-xs" style={{ color: C.sub }}>({i.quantidade} pç · FPP {fmtFpp(i.fppNumero)})</span></div>
                <div style={{ color: C.sub }}>{i.demanda.map((x) => `${x.nome}${x.cor ? ` ${x.cor}` : ""} ${qtdU(x.quantidade, x.unidade)}`).join(" · ")}</div>
                <div style={{ color: C.sub }}>Autorizado {i.autorizadoEm ? new Date(i.autorizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}{i.autorizadoPorNome ? ` por ${i.autorizadoPorNome}` : ""}</div>
              </div>
              {i.seguiu ? <Chip cor={C.sub}>material já na produção</Chip> : <Chip cor={C.green} fundo={C.greenSoft}>reservado</Chip>}
            </label>
          ))}
        </div>
      ))}
      <BarraDevolver n={marc.size} rotulo="Devolver para o levantamento" ocupado={ocupado} onDevolver={devolver} onLimpar={() => setMarc(new Set())} />
    </div>
  );
}

// ---------- v406 — cruzamento com o estoque ----------
function Cruzamento({ user, veValores, onMudou, irPic }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [marc, setMarc] = useState(new Set());
  const [salvando, setSalvando] = useState(false);
  const [integ, setInteg] = useState(null);
  const carregar = () => { setD(null); fetch("/api/compras/cruzar").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); setMarc(new Set(x.atendidos)); }).catch((e) => setErro(e.message)); };
  useEffect(() => { carregar(); }, []);
  const tog = (id) => setMarc((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function autorizar() {
    if (!marc.size) return;
    if (!(await confirmar(`Autorizar o atendimento pelo estoque de ${marc.size} item(ns)? Eles ficam liberados para o PCP programar.`))) return;
    setSalvando(true);
    const r = await fetch("/api/compras/cruzar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: [...marc], quem: nomeUser(user), usuarioId: user?.id }) });
    const x = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    await alerta(`${x.itens} item(ns) atendido(s) pelo estoque. O Leandro foi avisado.`);
    onMudou?.(); carregar();
  }
  // v483 — reprovar: o item vai para compra (próximo PIC) mesmo que o estoque atenda
  async function reprovar(ids, desfazer) {
    if (!ids.length) return;
    if (!desfazer && !(await confirmar(`Reprovar o atendimento pelo estoque de ${ids.length} item(ns)? Eles viram demanda de compra e entram no próximo PIC.`))) return;
    setSalvando(true);
    const r = await fetch("/api/compras/cruzar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: desfazer ? "desfazerReprovacao" : "reprovar", itemIds: ids, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    onMudou?.(); carregar();
  }
  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm py-4" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Cruzando com o estoque…</div>;
  const SIT = { COMPLETO: [C.green, C.greenSoft, "atendido completo"], PARCIAL: [C.yellow, C.yellowSoft, "parcial"], COMPRA: [C.accent, C.accentSoft, "vai para compra"], "SEM DEMANDA": [C.sub, C.panel2, "sem demanda"] };
  const nCompra = d.pedidos.flatMap((p) => p.itens).filter((i) => !i.atendido && !i.semDemanda).length + (d.reprovados || []).length;
  return (
    <div className="space-y-4">
      <div className="text-xs" style={{ color: C.sub }}>Sugestão: primeiro os pedidos que o estoque atende por inteiro, em ordem de entrega; depois itens inteiros com o que sobrar. Item nunca é atendido pela metade. Disponível = saldo − reservas de itens já autorizados que ainda não entraram em produção.</div>
      <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2 }}>
          <div className="flex-1">Artigo</div><div className="w-24 text-right">Demanda</div><div className="w-24 text-right">Saldo</div><div className="w-24 text-right">Reservado</div><div className="w-24 text-right">Atende</div><div className="w-28 text-right">A comprar</div>
        </div>
        {d.artigos.map((a) => (
          <div key={a.artigoId} className="flex px-4 py-2 text-sm items-center" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="flex-1"><b>{a.nome}</b> <span className="text-xs" style={{ color: C.sub }}>{detArtigo(a)}</span></div>
            <div className="w-24 text-right">{qtdU(a.quantidade, a.unidade)}</div>
            <div className="w-24 text-right" style={{ color: C.sub }}>{qtdU(a.saldo, a.unidade)}</div>
            <div className="w-24 text-right" style={{ color: a.reservado ? C.yellow : C.sub }}>{qtdU(a.reservado, a.unidade)}</div>
            <div className="w-24 text-right" style={{ color: C.green }}>{qtdU(a.atendido, a.unidade)}</div>
            <div className="w-28 text-right font-bold" style={{ color: a.comprar ? C.accent : C.sub }}>{a.comprarEmb ? `${a.comprarEmb} grosa(s)` : qtdU(a.comprar, a.unidade)}</div>
          </div>
        ))}
      </div>

      {d.pedidos.map((p) => {
        const [cor, fundo, txt] = SIT[p.situacao] || SIT.COMPRA;
        return (
          <div key={p.numero} className="rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>{rotPed(p.numero, p.cliente)} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
            </div>
            {p.itens.map((i) => (
              <label key={i.id} className="flex items-start gap-3 px-4 py-2 text-xs cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}>
                <input type="checkbox" disabled={i.semDemanda} checked={marc.has(i.id)} onChange={() => tog(i.id)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm" style={{ color: C.text }}>{i.chave} · {i.descricao} <span className="text-xs" style={{ color: C.sub }}>({i.quantidade} pç · FPP {fmtFpp(i.fppNumero)})</span></div>
                  <div style={{ color: C.sub }}>{i.demanda.map((x) => `${x.nome}${x.cor ? ` ${x.cor}` : ""} ${qtdU(x.quantidade, x.unidade)}`).join(" · ")}</div>
                </div>
                {!i.semDemanda && (i.atendido ? <span className="flex items-center gap-1.5"><Chip cor={C.green} fundo={C.greenSoft}>estoque atende</Chip>
                  <button type="button" onClick={(e) => { e.preventDefault(); reprovar([i.id]); }} className="text-[11px] px-2 py-0.5 rounded font-semibold" style={{ border: `1px solid ${C.red}`, color: C.red }}>reprovar</button></span>
                  : <Chip cor={C.accent} fundo={C.accentSoft}>sem estoque · compra</Chip>)}
              </label>
            ))}
          </div>
        );
      })}

      {(d.reprovados || []).length > 0 && (
        <div className="rounded-lg" style={{ background: C.panel, border: `1px solid ${C.red}55` }}>
          <div className="px-4 py-2 text-sm font-semibold flex items-center gap-2" style={{ color: C.red, borderBottom: `1px solid ${C.line}` }}>Reprovados no estoque · vão para compra ({d.reprovados.length})</div>
          {d.reprovados.map((i) => (
            <div key={i.id} className="flex items-start gap-3 px-4 py-2 text-xs" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1">
                <div className="text-sm" style={{ color: C.text }}>{rotPed(i.pedidoNumero, i.cliente)} · {i.chave} · {i.descricao}</div>
                <div style={{ color: C.sub }}>{i.demanda.map((x) => `${x.nome}${x.cor ? ` ${x.cor}` : ""} ${qtdU(x.quantidade, x.unidade)}`).join(" · ")}{i.autorizadoPorNome ? ` · reprovado por ${i.autorizadoPorNome}` : ""}</div>
              </div>
              <button onClick={() => reprovar([i.id], true)} className="text-[11px] px-2 py-0.5 rounded flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.sub }}><Undo2 size={11} /> desfazer</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sticky bottom-0 py-3" style={{ background: "#F7F8FA" }}>
        <button disabled={salvando || !marc.size} onClick={autorizar} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.green, color: "#fff", opacity: marc.size ? 1 : 0.5 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Autorizar atendimento pelo estoque ({marc.size})
        </button>
        <button disabled={salvando || !marc.size} onClick={() => reprovar([...marc])} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel, color: C.red, border: `1px solid ${C.red}`, opacity: marc.size ? 1 : 0.5 }}>
          <X size={15} /> Reprovar · vai para compra ({marc.size})
        </button>
        <button disabled={salvando || !nCompra} onClick={async () => {   // v469 — PIC com o que o estoque não atende
          if (!(await confirmar(`Gerar o PIC com os ${nCompra} item(ns) que o estoque não atende? Os artigos iguais são somados e os itens saem do levantamento.`))) return;
          setSalvando(true);
          const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "gerar", quem: nomeUser(user) }) });
          const x = await r.json().catch(() => ({}));
          setSalvando(false);
          if (!r.ok) return alerta(x.error || "Erro ao gerar o PIC.");
          await alerta(`${x.numero} gerado: ${x.artigos} artigo(s) de ${x.itens} item(ns). Preencha fornecedor e valor para gerar as OCs.`);
          onMudou?.(); if (irPic) irPic(); else carregar();
        }} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: nCompra ? C.accent : C.panel2, color: nCompra ? "#fff" : C.sub, border: `1px solid ${nCompra ? C.accent : C.line}` }}>
          <ShoppingCart size={15} /> Gerar PIC ({nCompra} itens)
        </button>
        <button disabled={salvando || !marc.size} onClick={async () => {
          if (!(await confirmar(`Devolver ${marc.size} item(ns) para Pedidos? A FPP base é desvinculada e a demanda sai do levantamento.`))) return;
          setSalvando(true);
          try { await devolverItens([...marc], "pedidos"); onMudou?.(); carregar(); } catch (e) { alerta(e.message); }
          setSalvando(false);
        }} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel, color: C.red, border: `1px solid ${C.red}`, opacity: marc.size ? 1 : 0.5 }}>
          <Undo2 size={15} /> Devolver para Pedidos ({marc.size})
        </button>
        <button onClick={carregar} className="p-2 rounded-md" title="Refazer o cruzamento" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
        {veValores && <button onClick={() => fetch("/api/compras/integracao").then((r) => r.json()).then(setInteg)} className="ml-auto text-xs flex items-center gap-1" style={{ color: C.sub }}><KeyRound size={13} /> Integração PCP</button>}
      </div>
      {integ && (
        <Modal titulo="Integração com o PCP (Maycon)" onClose={() => setInteg(null)}>
          <div className="text-sm space-y-2">
            <div>O PCP lê os itens liberados (atendidos pelo estoque ou com OC entregue) com todos os dados do pedido:</div>
            <div className="font-mono text-xs p-2 rounded" style={{ background: C.panel2 }}>GET {typeof window !== "undefined" ? window.location.origin : ""}{integ.caminho}<br />Cabeçalho X-Api-Key: {integ.token}<br />?desde=AAAA-MM-DDTHH:MM (opcional) · ?pedido=NÚMERO (opcional)</div>
            <button onClick={() => navigator.clipboard?.writeText(integ.token)} className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }}><Copy size={12} /> copiar token</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- v469 — PIC: o comprador preenche fornecedor e valor; gera as OCs agrupadas por fornecedor ----------
let _fornPic = null;
const nomeFornec = (f) => f.nomeFantasia || f.nome || f.razaoSocial || "";
const numBR = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));
const lerNum = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
export function PicCompras({ user, fases, ir }) {
  const [l, setL] = useState(null);
  const [forns, setForns] = useState(_fornPic || []);
  const [ed, setEd] = useState({});   // { picItemId: { fornecedor, valor, qtd } }
  const [oc, setOc] = useState(false);
  const [cot, setCot] = useState(null);   // v476 — cotação por fornecedor
  const [sel, setSel] = useState(new Set());   // v477 — itens escolhidos (de qualquer PIC)
  const carregar = () => fetch("/api/compras/pic").then((r) => r.json()).then((x) => { setL(Array.isArray(x) ? x : []); setEd({}); const f = lerFoco("pic"); if (f) rolarDestacar(`pic-${f}`); }).catch(() => setL([]));
  useEffect(() => { carregar(); if (!_fornPic) fetch("/api/fornecedores").then((r) => r.json()).then((x) => { _fornPic = Array.isArray(x) ? x : []; setForns(_fornPic); }).catch(() => {}); }, []);
  const porNome = useMemo(() => Object.fromEntries(forns.map((f) => [nomeFornec(f).toUpperCase(), f])), [forns]);
  const val = (i) => ({ fornecedor: i.fornecedor || "", valor: numBR(i.valorUnitario), qtd: numBR(i.quantidade), extras: (i.fornecedoresCotacao || []).map((f) => f.nome), ...(ed[i.id] || {}) });   // v482 — extras: outros fornecedores p/ cotação
  const set = (i, k, v) => setEd((e) => ({ ...e, [i.id]: { ...val(i), ...e[i.id], [k]: v } }));
  const linhas = (p) => p.itens.filter((i) => !i.oc).map((i) => { const v = val(i); const f = porNome[v.fornecedor.trim().toUpperCase()]; return { id: i.id, fornecedorId: f ? f.id : (v.fornecedor.trim() ? undefined : null), valorUnitario: v.valor, quantidade: v.qtd, nomeForn: v.fornecedor }; });
  async function enviar(p, acao) {
    const its = linhas(p);
    const semCad = its.filter((x) => x.fornecedorId === undefined);
    if (semCad.length) return alerta(`Fornecedor não encontrado no cadastro: ${[...new Set(semCad.map((x) => x.nomeForn))].join(", ")}. Escolha um da lista (cadastre em Artigos & Fornec. se for novo).`);
    if (acao === "ocs") {
      const prontos = its.filter((x) => x.fornecedorId && lerNum(x.valorUnitario) > 0);
      const nF = new Set(prontos.map((x) => x.fornecedorId)).size;
      if (!prontos.length) return alerta("Preencha fornecedor e valor unitário dos itens para gerar as OCs.");
      if (!(await confirmar(`Gerar ${nF} OC(s), uma por fornecedor, com ${prontos.length} item(ns)?${prontos.length < its.length ? ` ${its.length - prontos.length} item(ns) sem fornecedor ou valor ficam no PIC.` : ""}`))) return;
    }
    setOc(true);
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, id: p.id, itens: its.map(({ nomeForn, ...x }) => ({ ...x, fornecedorId: x.fornecedorId || null })), quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    if (acao === "ocs") await alerta(`${x.ocs.map((o) => o.numero).join(", ")} gerada(s).${x.faltam ? ` ${x.faltam} item(ns) continuam no PIC.` : ""}`);
    carregar();
  }
  // v477 — ações sobre itens de vários PICs: os escolhidos, ou todos os que estão sem OC
  const todosAbertos = (l || []).flatMap((p) => p.itens.filter((i) => !i.oc).map((i) => ({ ...i, picNumero: p.numero })));
  const alvo = sel.size ? todosAbertos.filter((i) => sel.has(i.id)) : todosAbertos;
  const linha = (i) => { const v = val(i); const f = porNome[v.fornecedor.trim().toUpperCase()]; return { id: i.id, fornecedorId: f ? f.id : (v.fornecedor.trim() ? undefined : null), valorUnitario: v.valor, quantidade: v.qtd, nomeForn: v.fornecedor,
    fornecedoresCotacao: v.extras.map((n) => porNome[String(n || "").trim().toUpperCase()]).filter(Boolean).map((x) => ({ id: x.id, nome: nomeFornec(x) })) }; };
  async function acaoItens(acao) {
    const its = (acao === "salvarItens" ? todosAbertos : alvo).map(linha);
    const semCad = its.filter((x) => x.fornecedorId === undefined);
    if (semCad.length) return alerta(`Fornecedor não encontrado no cadastro: ${[...new Set(semCad.map((x) => x.nomeForn))].join(", ")}. Escolha um da lista.`);
    const extraFora = (acao === "salvarItens" ? todosAbertos : alvo).flatMap((i) => val(i).extras).filter((n) => String(n || "").trim() && !porNome[String(n).trim().toUpperCase()]);
    if (extraFora.length) return alerta(`Fornecedor para cotação fora do cadastro: ${[...new Set(extraFora)].join(", ")}. Escolha da lista.`);
    if (acao === "ocsItens") {
      const prontos = its.filter((x) => x.fornecedorId && lerNum(x.valorUnitario) > 0);
      if (!prontos.length) return alerta("Preencha fornecedor e valor unitário dos itens para gerar as OCs.");
      const nF = new Set(prontos.map((x) => x.fornecedorId)).size;
      const nP = new Set(alvo.filter((i) => prontos.some((x) => x.id === i.id)).map((i) => i.picNumero)).size;
      if (!(await confirmar(`Gerar ${nF} OC(s), uma por fornecedor, com ${prontos.length} item(ns) de ${nP} PIC(s)?${prontos.length < its.length ? ` ${its.length - prontos.length} item(ns) sem fornecedor ou valor ficam no PIC.` : ""}`))) return;
    }
    setOc(true);
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, itens: its.map(({ nomeForn, ...x }) => ({ ...x, fornecedorId: x.fornecedorId || null })), ids: its.map((x) => x.id), quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    if (acao === "ocsItens") { await alerta(`${x.ocs.map((o) => o.numero).join(", ")} gerada(s).${x.faltam ? ` ${x.faltam} item(ns) continuam no PIC.` : ""}`); setSel(new Set()); }
    carregar();
  }
  function cotacao() {
    const g = {};
    // v482 — cada item vai para o card de cada um dos seus fornecedores (principal + até 4 extras)
    for (const i of alvo) { const v = val(i);
      const nomes = [...new Set([v.fornecedor, ...v.extras].map((n) => String(n || "").trim()).filter(Boolean).map((n) => n.toUpperCase()))];
      for (const nomeU of nomes) { const f = porNome[nomeU]; const k = f ? `F${f.id}` : `N${nomeU}`;
        (g[k] ||= { fornecedor: f || { nome: nomeU }, itens: [] }).itens.push({ nome: i.info?.nome || `Artigo #${i.artigoId}`, det: [i.info?.cor, i.info?.codigo].filter(Boolean).join(" · "), quantidade: lerNum(v.qtd) ?? i.quantidade, unidade: i.info?.unidade, picItemIds: [i.id] }); } }
    // salva os fornecedores extras escolhidos (ficam no PIC)
    fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "salvarItens", itens: alvo.map(linha).filter((x) => x.fornecedorId !== undefined).map(({ nomeForn, ...x }) => ({ ...x, fornecedorId: x.fornecedorId || null })) }) }).catch(() => {});
    if (!Object.keys(g).length) return alerta("Escolha o fornecedor dos itens para gerar a cotação.");
    // o mesmo artigo vindo de PICs diferentes vira uma linha só
    for (const x of Object.values(g)) { const m = {}; for (const it of x.itens) { const k = `${it.nome}|${it.det}|${it.unidade}`; if (m[k]) { m[k].quantidade += Number(it.quantidade) || 0; m[k].picItemIds.push(...it.picItemIds); } else m[k] = { ...it, quantidade: Number(it.quantidade) || 0, picItemIds: [...it.picItemIds] }; } x.itens = Object.values(m); }
    // v478 — cada card vira uma cotação registrada (guia Cotações), com número próprio
    const pics = [...new Set(alvo.map((i) => i.picNumero))].join(", ");
    const grupos = Object.values(g);
    fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "criar", grupos, pics, quem: nomeUser(user) }) })
      .then((r) => r.json()).then((x) => { (x.cotacoes || []).forEach((c, k) => { if (grupos[k]) { grupos[k].numero = c.numero; grupos[k].id = c.id; } }); setCot({ pic: pics, grupos, semF: alvo.filter((i) => !val(i).fornecedor.trim()).length }); })
      .catch(() => setCot({ pic: pics, grupos, semF: alvo.filter((i) => !val(i).fornecedor.trim()).length }));
  }
  const togSel = (id) => setSel((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function desfazer(p) {
    if (!(await confirmar(`Desfazer o ${p.numero}? Os itens voltam para o levantamento.`))) return;
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "cancelar", id: p.id }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return alerta(x.error || "Erro.");
    carregar();
  }
  const inp = "px-2 py-1 rounded text-sm outline-none";
  return (
    <div className="w-full">
      <FasesCompras atual="pic" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Os itens que o estoque não atende saem do <b>Cruzamento</b> num PIC, com os artigos iguais somados. Preencha o <b>fornecedor</b> e o <b>valor unitário</b> (a quantidade pode ser ajustada) e gere as <b>OCs</b>: uma por fornecedor. Itens de <b>PICs diferentes</b> podem ir na mesma cotação e na mesma OC: marque os itens e use a barra de baixo.</p>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !l.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum PIC. Gere pelo Cruzamento com estoque (botão Gerar PIC).</div>}
      {cot && <CotacaoModal cot={cot} onClose={() => setCot(null)} />}
      {(l || []).map((p) => {
        const abertos = p.itens.filter((i) => !i.oc);
        const tot = p.itens.reduce((s0, i) => { const v = val(i); return s0 + (lerNum(v.valor) || 0) * (lerNum(v.qtd) || 0); }, 0);
        const porF = {};
        for (const i of abertos) { const v = val(i); const k = v.fornecedor.trim() || "— sem fornecedor"; porF[k] = (porF[k] || 0) + (lerNum(v.valor) || 0) * (lerNum(v.qtd) || 0); }
        return (
          <div key={p.id} id={`pic-${p.numero}`} className="rounded-lg mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>{p.numero} <span className="font-normal text-xs" style={{ color: C.sub }}>· {new Date(p.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{p.criadoPorNome ? ` por ${p.criadoPorNome}` : ""} · {p.itens.length} artigo(s)</span></div>
              <span className="text-sm font-bold" style={{ color: C.navy }}>{brl(tot)}</span>
              <Chip cor={p.status === "OC" ? C.green : C.accent} fundo={p.status === "OC" ? C.greenSoft : C.accentSoft}>{p.status === "OC" ? "OCs geradas" : `${abertos.length} sem OC`}</Chip>
            </div>
            <div className="flex px-4 py-2 text-xs font-semibold gap-2" style={{ color: C.sub, background: C.panel2 }}>
              <div className="w-5">{abertos.length > 0 && <input type="checkbox" title="Marcar todos deste PIC" checked={abertos.every((i) => sel.has(i.id))} onChange={(e) => setSel((s0) => { const n = new Set(s0); abertos.forEach((i) => (e.target.checked ? n.add(i.id) : n.delete(i.id))); return n; })} />}</div><div className="flex-1">Artigo</div><div className="w-28 text-right">Quantidade</div><div className="w-56">Fornecedor</div><div className="w-28 text-right">Valor unit.</div><div className="w-28 text-right">Total</div>
            </div>
            {p.itens.map((i) => {
              const v = val(i), trav = !!i.oc, inf = i.info || {};
              const semF = !trav && v.fornecedor.trim() && !porNome[v.fornecedor.trim().toUpperCase()];
              return (
                <div key={i.id} className="flex px-4 py-2 gap-2 items-center text-sm" style={{ borderTop: `1px solid ${C.line}`, opacity: trav ? 0.7 : 1, background: sel.has(i.id) ? C.accentSoft : undefined }}>
                  <div className="w-5">{!trav && <input type="checkbox" checked={sel.has(i.id)} onChange={() => togSel(i.id)} title="Escolher para cotação/OC (pode misturar PICs)" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ color: C.text }}>{inf.nome || `Artigo #${i.artigoId}`} <span className="text-xs font-normal" style={{ color: C.sub }}>{[inf.cor, inf.codigo].filter(Boolean).join(" · ")}</span></div>
                    <div className="text-[11px] truncate" style={{ color: C.sub }} title={(inf.pedidos || []).map((x) => `${x.avulsa ? "Avulsa" : "Pedido"} ${x.pedido} ${x.chave} · ${qtdU(x.quantidade, inf.unidade)}`).join("\n")}>
                      {(inf.pedidos || []).map((x) => (x.avulsa ? `Avulsa ${x.cliente?.split("·")[0]?.replace("AVULSA", "").trim() || x.pedido}` : `Ped. ${x.pedido}`)).filter((x, k, a) => a.indexOf(x) === k).join(" · ")}
                      {inf.embalagem ? ` · grosa de ${inf.embalagem}` : ""}
                    </div>
                    {(i.cotacoes || []).length > 0 && !trav && (   // v484 — como está a cotação deste item
                      <div className="text-[11px] mt-0.5 flex flex-wrap gap-1">
                        {i.semCotacao && <span className="font-semibold px-1.5 rounded" style={{ background: C.redSoft, color: C.red }}>nenhum fornecedor tem · escolha outro e cote de novo</span>}
                        {i.cotacoes.map((x, k2) => <span key={k2} className="px-1.5 rounded" title={x.numero} style={{ background: x.situacao === "VALOR" ? C.greenSoft : x.situacao === "NAO_TEM" ? C.panel2 : C.yellowSoft, color: x.situacao === "VALOR" ? C.green : x.situacao === "NAO_TEM" ? C.sub : C.yellow, textDecoration: x.situacao === "NAO_TEM" ? "line-through" : "none" }}>{x.fornecedor.split(" ")[0]} {x.situacao === "VALOR" ? brl(x.valor) : x.situacao === "NAO_TEM" ? "não tem" : "aguardando"}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="w-28 text-right">{trav ? qtdU(i.quantidade, inf.unidade) : <span className="inline-flex items-center gap-1"><input value={v.qtd} onChange={(e) => set(i, "qtd", e.target.value)} className={`${inp} w-20 text-right`} style={{ border: `1px solid ${C.line}` }} /><span className="text-xs" style={{ color: C.sub }}>{String(inf.unidade || "").toLowerCase()}</span></span>}</div>
                  <div className="w-56">{trav ? <span className="text-xs">{i.fornecedor} · <b style={{ color: C.green }}>{i.oc.numero}</b></span>
                    : <div className="space-y-1">
                        <div className="flex items-center gap-1"><div className="flex-1 min-w-0"><BuscaFornecedor valor={v.fornecedor} idAtual={porNome[v.fornecedor.trim().toUpperCase()]?.id} forns={forns} estilo={{ border: `1px solid ${C.line}` }} onEscolher={(f, txt) => set(i, "fornecedor", f ? nomeFornec(f) : txt)} /></div>
                          {v.extras.length < 4 && <button type="button" onClick={() => set(i, "extras", [...v.extras, ""])} title="Adicionar outro fornecedor para cotação (até 5)" className="shrink-0 rounded-md font-bold text-sm flex items-center justify-center" style={{ width: 26, height: 26, border: `1px solid ${C.accent}`, color: C.accent }}>+</button>}</div>
                        {v.extras.map((n, j) => (   // v482 — outros fornecedores para cotação
                          <div key={j} className="flex items-center gap-1"><div className="flex-1 min-w-0"><BuscaFornecedor valor={n} idAtual={porNome[String(n || "").trim().toUpperCase()]?.id} forns={forns} placeholder={`cotar também com…`} estilo={{ border: `1px dashed ${C.line}`, fontSize: 12 }}
                            onEscolher={(f, txt) => set(i, "extras", v.extras.map((x, k2) => (k2 === j ? (f ? nomeFornec(f) : txt) : x)))} /></div>
                            <button type="button" onClick={() => set(i, "extras", v.extras.filter((_, k2) => k2 !== j))} title="Tirar" className="shrink-0 flex items-center justify-center" style={{ width: 26, height: 26, color: C.sub }}><X size={13} /></button></div>
                        ))}
                      </div>}</div>
                  <div className="w-28 text-right">{trav ? brl(i.valorUnitario) : <input value={v.valor} onChange={(e) => set(i, "valor", e.target.value)} placeholder="0,00" className={`${inp} w-24 text-right`} style={{ border: `1px solid ${C.line}` }} />}</div>
                  <div className="w-28 text-right font-semibold" style={{ color: C.navy }}>{lerNum(v.valor) && lerNum(v.qtd) ? brl(lerNum(v.valor) * lerNum(v.qtd)) : "—"}</div>
                </div>
              );
            })}
            {abertos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
                <div className="flex-1 text-xs" style={{ color: C.sub }}>{Object.entries(porF).map(([f, v]) => `${f}: ${brl(v)}`).join(" · ")}</div>
                {!p.itens.some((i) => i.oc) && <button onClick={() => desfazer(p)} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Undo2 size={13} /> Desfazer PIC</button>}
              </div>
            )}
          </div>
        );
      })}
      {todosAbertos.length > 0 && (   // v477 — barra única: itens de PICs diferentes na mesma cotação/OC
        <div className="flex flex-wrap items-center gap-2 sticky bottom-0 py-3 px-3 rounded-lg" style={{ background: "#F7F8FA", border: `1px solid ${C.line}` }}>
          <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer" style={{ color: C.navy }}><input type="checkbox" checked={sel.size === todosAbertos.length} onChange={(e) => setSel(e.target.checked ? new Set(todosAbertos.map((i) => i.id)) : new Set())} /> Todos</label>   {/* v480 */}
          <div className="flex-1 text-sm" style={{ color: C.sub }}>{sel.size ? <><b style={{ color: C.navy }}>{sel.size}</b> item(ns) escolhido(s) de {new Set(alvo.map((i) => i.picNumero)).size} PIC(s) · <button onClick={() => setSel(new Set())} className="underline">limpar</button></> : <>Sem escolha: vale para <b style={{ color: C.navy }}>todos os {todosAbertos.length}</b> itens sem OC. Marque itens (de qualquer PIC) para escolher.</>}</div>
          <button disabled={oc} onClick={() => acaoItens("salvarItens")} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>Salvar</button>
          <button disabled={oc} onClick={cotacao} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><FileText size={14} /> Gerar cotação</button>
          <button disabled={oc} onClick={() => acaoItens("ocsItens")} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />} Gerar OCs por fornecedor</button>
        </div>
      )}
    </div>
  );
}

// ---------- v469 — ordens de compra (uma por fornecedor) ----------
const ST_OC = { ABERTA: ["aberta", C.accent, C.accentSoft], ENVIADA: ["enviada ao fornecedor", C.blue, C.blueSoft], NF_EMITIDA: ["NF emitida", C.yellow, C.yellowSoft], RECEBIDA: ["recebida", C.green, C.greenSoft], CANCELADA: ["cancelada", C.sub, C.panel2] };
function imprimirOc(o) {
  const linhas = o.itens.map((i) => `<tr><td>${i.nome}${i.cor ? ` · ${i.cor}` : ""}${i.codigo ? ` · ${i.codigo}` : ""}</td><td class="n">${qtdU(i.quantidade, i.unidade)}</td><td class="n">${brl(i.valorUnitario)}</td><td class="n">${brl(i.quantidade * i.valorUnitario)}</td></tr>`).join("");
  const dt = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.numero} · ${o.fornecedor.nome}</title><style>
    body{font-family:Arial,sans-serif;color:#0c2342;margin:32px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
    th,td{border-bottom:1px solid #dde3ea;padding:7px 6px;text-align:left}th{background:#f1f6fe}.n{text-align:right}.tot{font-weight:bold;font-size:15px}.cab{display:flex;justify-content:space-between;align-items:flex-start}
    .k{color:#667085;font-size:12px}</style></head><body>
    <div class="cab"><div><img src="/meridian-wordmark.svg" style="height:26px"><div class="k" style="margin-top:6px">Ordem de compra</div><h1>${o.numero}</h1></div>
    <div style="text-align:right;font-size:13px"><b>${o.fornecedor.razaoSocial || o.fornecedor.nome}</b><br>${[o.fornecedor.contato, o.fornecedor.telefone, o.fornecedor.email].filter(Boolean).join(" · ")}<br><span class="k">Emitida em ${dt(o.createdAt)}${o.pic ? ` · ${o.pic}` : ""}</span></div></div>
    <table><tr><th>Artigo</th><th class="n">Quantidade</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>${linhas}
    <tr><td colspan="3" class="n tot">Total</td><td class="n tot">${brl(o.total)}</td></tr></table>
    <p style="font-size:13px;margin-top:18px">Condição de faturamento: <b>${o.condicaoFaturamento || "—"}</b> · Prazo de entrega: <b>${dt(o.prazoFabrica)}</b>${o.formaRecebimento ? ` · Recebimento: <b>${(FORMAS_REC.find((x) => x[0] === o.formaRecebimento) || [])[1]}</b>${o.diasAposFaturamento ? ` (${o.diasAposFaturamento} dias após o faturamento)` : ""}` : ""}${o.nfNumero ? `<br>NF ${o.nfNumero}` : ""}${o.obs ? `<br>Obs.: ${o.obs}` : ""}</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
  const w = window.open("", "_blank"); if (!w) return alerta("Permita pop-ups para imprimir a OC."); w.document.write(html); w.document.close();
}
export function OrdensCompra({ user, fases, ir }) {
  const [l, setL] = useState(null);
  const [ab, setAb] = useState({});
  const [filtro, setFiltro] = useState("ativas");
  const carregar = () => fetch("/api/compras/oc").then((r) => r.json()).then((x) => { setL(Array.isArray(x) ? x : []);
    const f = lerFoco("oc"); if (f) { setFiltro("todas"); setAb((m) => ({ ...m, [f]: true })); rolarDestacar(`oc-${f}`); } }).catch(() => setL([]));
  useEffect(() => { carregar(); }, []);
  const salvar = async (o, campos) => {
    const r = await fetch("/api/compras/oc", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, ...campos }) });
    const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro.");
    carregar();
  };
  const vis = (l || []).filter((o) => (filtro === "ativas" ? ["ABERTA", "ENVIADA", "NF_EMITIDA"].includes(o.status) : true));
  const [nf, setNf] = useState({});   // v479 — { ocId: { numero, emissao } }
  const [edIt, setEdIt] = useState({});   // v487 — itens da OC em edição
  return (
    <div className="w-full">
      <FasesCompras atual="oc" fases={fases} ir={ir} />
      <div className="flex items-center gap-2 mb-3">
        {[["ativas", "Em andamento"], ["todas", "Todas"]].map(([k, t]) => <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: filtro === k ? C.accent : C.panel, color: filtro === k ? "#fff" : C.sub, border: `1px solid ${filtro === k ? C.accent : C.line}` }}>{t}</button>)}
        <span className="text-sm ml-auto" style={{ color: C.sub }}>Total: <b style={{ color: C.navy }}>{brl(vis.reduce((s0, o) => s0 + o.total, 0))}</b></span>
        <button onClick={carregar} className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !vis.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma OC. Elas são geradas no PIC, uma por fornecedor.</div>}
      {vis.map((o) => {
        const [txt, cor, fundo] = ST_OC[o.status] || ST_OC.ABERTA;
        const aberto = !!ab[o.id];
        return (
          <div key={o.id} id={`oc-${o.id}`} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <button onClick={() => setAb((s0) => ({ ...s0, [o.id]: !aberto }))} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              {aberto ? <ChevronDown size={16} style={{ color: C.sub }} /> : <ChevronRight size={16} style={{ color: C.sub }} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: C.navy }}>{o.numero} · {o.fornecedor.nome}</div>
                <div className="text-xs" style={{ color: C.sub }}>{new Date(o.createdAt).toLocaleDateString("pt-BR")}{o.cotacao ? ` · ${o.cotacao}` : ""}{o.pic ? ` · ${o.pic}` : ""} · {o.itens.length} item(ns){o.formaRecebimento ? ` · ${(FORMAS_REC.find((x) => x[0] === o.formaRecebimento) || [])[1]}` : ""}{o.nfNumero ? ` · NF ${o.nfNumero}` : ""}{o.condicaoFaturamento ? ` · ${o.condicaoFaturamento}` : ""}{o.prazoFabrica ? ` · fábrica ${new Date(o.prazoFabrica).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}</div>
              </div>
              <span className="text-sm font-bold" style={{ color: C.accent }}>{brl(o.total)}</span>
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
              <ChipEntrega e={o.entrega} />   {/* v497 */}
            </button>
            {aberto && (
              <div className="px-4 pb-3">
                {(() => {   // v487 — itens editáveis (atualiza o PIC e a cotação de origem)
                  const pode = !["RECEBIDA", "CANCELADA"].includes(o.status);
                  const e = edIt[o.id] || Object.fromEntries(o.itens.map((i) => [i.id, { q: numBR(i.quantidade), v: numBR(i.valorUnitario) }]));
                  const setE = (id, k, x) => setEdIt((m) => ({ ...m, [o.id]: { ...e, [id]: { ...e[id], [k]: x } } }));
                  const mudou = !!edIt[o.id];
                  const tot = o.itens.reduce((s0, i) => s0 + (lerNum(e[i.id]?.q) || 0) * (lerNum(e[i.id]?.v) || 0), 0);
                  return <>
                    {o.itens.map((i) => (
                      <div key={i.id} className="flex gap-2 py-1.5 text-sm items-center" style={{ borderTop: `1px solid ${C.line}` }}>
                        <div className="flex-1">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{[i.cor, i.codigo].filter(Boolean).join(" · ")}</span></div>
                        <div className="w-32 text-right">{pode ? <span className="inline-flex items-center gap-1"><input value={e[i.id]?.q ?? ""} onChange={(ev) => setE(i.id, "q", ev.target.value)} className="w-20 px-2 py-0.5 rounded text-sm text-right" style={{ border: `1px solid ${C.line}` }} /><span className="text-xs" style={{ color: C.sub }}>{String(i.unidade || "").toLowerCase()}</span></span> : qtdU(i.quantidade, i.unidade)}</div>
                        <div className="w-28 text-right">{pode ? <input value={e[i.id]?.v ?? ""} onChange={(ev) => setE(i.id, "v", ev.target.value)} className="w-24 px-2 py-0.5 rounded text-sm text-right" style={{ border: `1px solid ${C.line}` }} /> : <span style={{ color: C.sub }}>{brl(i.valorUnitario)}</span>}</div>
                        <div className="w-28 text-right font-semibold">{brl((lerNum(e[i.id]?.q) || 0) * (lerNum(e[i.id]?.v) || 0))}</div>
                      </div>
                    ))}
                    {pode && mudou && <div className="flex items-center justify-end gap-2 py-2">
                      <span className="text-sm font-bold mr-2" style={{ color: C.navy }}>Novo total {brl(tot)}</span>
                      <button onClick={() => setEdIt((m) => { const n = { ...m }; delete n[o.id]; return n; })} className="text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${C.line}` }}>Descartar</button>
                      <button onClick={async () => { await salvar(o, { itens: o.itens.map((i) => ({ id: i.id, quantidade: e[i.id]?.q, valorUnitario: e[i.id]?.v })) }); setEdIt((m) => { const n = { ...m }; delete n[o.id]; return n; }); }} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar itens{o.cotacao ? ` (atualiza a ${o.cotacao})` : ""}</button>
                    </div>}
                  </>;
                })()}
                <div className="flex flex-wrap items-end gap-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <label className="text-xs" style={{ color: C.sub }}>Condição de faturamento<input defaultValue={o.condicaoFaturamento || ""} onBlur={(e) => e.target.value !== (o.condicaoFaturamento || "") && salvar(o, { condicaoFaturamento: e.target.value })} placeholder="ex.: 30 dias" className="block mt-1 px-2 py-1 rounded text-sm w-40" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
                  <label className="text-xs" style={{ color: C.sub }}>Prazo na fábrica<input type="date" defaultValue={o.prazoFabrica ? String(o.prazoFabrica).slice(0, 10) : ""} onChange={(e) => salvar(o, { prazoFabrica: e.target.value || null })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
                  <label className="text-xs" style={{ color: C.sub }}>Situação<select value={o.status} onChange={(e) => salvar(o, { status: e.target.value })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }}>{Object.entries(ST_OC).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></label>
                  {o.formaRecebimento && o.formaRecebimento !== "COLETA" && <label className="text-xs" style={{ color: C.sub }}>Previsão de chegada<input type="date" defaultValue={o.previsaoEntrega || ""} onChange={(e) => salvar(o, { previsaoEntrega: e.target.value || null })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>}   {/* v497 */}
                  <label className="text-xs" style={{ color: C.sub }}>Recebimento<select value={o.formaRecebimento || ""} onChange={(e) => salvar(o, { formaRecebimento: e.target.value || null })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }}><option value="">—</option>{FORMAS_REC.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                  {o.formaRecebimento === "TRANSPORTADORA" && <label className="text-xs" style={{ color: C.sub }}>Dias após faturar<input defaultValue={o.diasAposFaturamento ?? ""} onBlur={(e) => String(e.target.value) !== String(o.diasAposFaturamento ?? "") && salvar(o, { diasAposFaturamento: e.target.value })} className="block mt-1 px-2 py-1 rounded text-sm w-24" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>}
                  {o.formaRecebimento === "COLETA" && !["RECEBIDA", "CANCELADA"].includes(o.status) && !o.rota && <button onClick={() => criarRotaColeta(o)} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ background: C.navy, color: "#fff" }}>Criar rota de coleta</button>}
                </div>
                {/* v479 — NF do fornecedor */}
                <div className="flex flex-wrap items-end gap-3 pt-3 mt-3" style={{ borderTop: `1px dashed ${C.line}` }}>
                  {!(o.nfs || []).length && (() => { const v = nf[o.id] || { numero: o.nfNumero || "", emissao: o.nfEmissao || "" }; const setV = (k, x) => setNf((n) => ({ ...n, [o.id]: { ...v, [k]: x } }));
                    return <>
                      <label className="text-xs" style={{ color: C.sub }}>NF do fornecedor<input value={v.numero} onChange={(e) => setV("numero", e.target.value)} placeholder="nº da NF" className="block mt-1 px-2 py-1 rounded text-sm w-32" style={{ border: `1px solid ${o.nfNumero ? C.green : C.line}`, color: C.text }} /></label>
                      <label className="text-xs" style={{ color: C.sub }}>Emissão<input type="date" value={v.emissao} onChange={(e) => setV("emissao", e.target.value)} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
                      <button onClick={() => { salvar(o, { nfNumero: v.numero, nfEmissao: v.emissao || null }); setNf((n) => { const m = { ...n }; delete m[o.id]; return m; }); }} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>{o.nfNumero ? "Atualizar NF" : "Inserir NF"}</button>
                      {o.nfNumero && <span className="text-xs" style={{ color: C.green }}>NF {o.nfNumero} registrada · compra com status NF emitida</span>}
                    </>; })()}
                </div>
                <NfsDaOc o={o} user={user} onMudou={carregar} />   {/* v494 — NFs da OC: movimento fiscal, contas, conferência */}
                <div>
                  <button onClick={() => imprimirOc(o)} className="ml-auto text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><FileText size={14} /> Imprimir / PDF</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- v476 — cotação para o fornecedor: imagem (PNG) ou PDF para mandar no WhatsApp ----------
const telWa = (t) => { let d = String(t || "").split(/[\/,;]/)[0].replace(/\D/g, ""); if (!d) return null; if (d.length >= 12 && d.startsWith("55")) return d; if (d.length === 10 || d.length === 11) return `55${d}`; return d.length >= 10 ? d : null; };
let _logoCot = null;
const logoCot = () => (_logoCot ||= new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = "/meridian-wordmark.svg"; }));
async function desenharCotacao(g, pic) {
  const W = 1080, P = 64, LH = 30;
  const c0 = document.createElement("canvas"); const x0 = c0.getContext("2d");
  const quebra = (ctx, t, w) => { const ps = String(t || "").split(/\s+/); const ls = []; let l = ""; for (const p of ps) { const n = l ? `${l} ${p}` : p; if (ctx.measureText(n).width > w && l) { ls.push(l); l = p; } else l = n; } if (l) ls.push(l); return ls.length ? ls : [""]; };
  x0.font = "600 26px Arial"; const colArt = W - P * 2 - 230 - 56;
  const linhas = g.itens.map((i) => { x0.font = "600 26px Arial"; const a = quebra(x0, i.nome, colArt); x0.font = "22px Arial"; const d = i.det ? quebra(x0, i.det, colArt) : []; return { i, a, d, h: Math.max(64, 22 + a.length * LH + d.length * 26) }; });
  const H = 300 + 70 + linhas.reduce((s0, l) => s0 + l.h, 0) + 200;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#0c2342"; x.fillRect(0, 0, W, 14);
  const logo = await logoCot();
  if (logo) { const h = 44, w = (logo.naturalWidth || 4117) / (logo.naturalHeight || 601) * h; x.drawImage(logo, P, 54, w, h); }
  else { x.fillStyle = "#0c2342"; x.font = "800 40px Arial"; x.fillText("MERIDIAN", P, 92); }
  x.textAlign = "right"; x.fillStyle = "#ee6500"; x.font = "700 22px Arial"; x.fillText("SOLICITAÇÃO DE COTAÇÃO", W - P, 72);
  x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText(`${new Date().toLocaleDateString("pt-BR")}${pic ? ` · ${pic}` : ""}`, W - P, 102); x.textAlign = "left";
  x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText("Fornecedor", P, 168);
  x.fillStyle = "#0c2342"; x.font = "700 34px Arial"; x.fillText(nomeFornCad(g.fornecedor).slice(0, 48), P, 210);
  x.fillStyle = "#3e5066"; x.font = "22px Arial"; x.fillText("Por favor, informe valor unitário, prazo de entrega e condição de pagamento:", P, 262);
  let y = 300;
  x.fillStyle = "#f1f6fe"; x.fillRect(P - 16, y, W - P * 2 + 32, 56);
  x.fillStyle = "#3d6799"; x.font = "700 20px Arial"; x.fillText("#", P, y + 36); x.fillText("ARTIGO", P + 56, y + 36); x.textAlign = "right"; x.fillText("QUANTIDADE", W - P, y + 36); x.textAlign = "left";
  y += 70;
  linhas.forEach((l, k) => {
    x.fillStyle = "#ee6500"; x.font = "700 24px Arial"; x.fillText(String(k + 1), P, y + 30);
    x.fillStyle = "#0c2342"; x.font = "600 26px Arial"; l.a.forEach((t, j) => x.fillText(t, P + 56, y + 30 + j * LH));
    x.fillStyle = "#667085"; x.font = "22px Arial"; l.d.forEach((t, j) => x.fillText(t, P + 56, y + 30 + l.a.length * LH + j * 26));
    x.textAlign = "right"; x.fillStyle = "#0c2342"; x.font = "700 28px Arial"; x.fillText(qtdU(l.i.quantidade, l.i.unidade), W - P, y + 32); x.textAlign = "left";
    y += l.h; x.strokeStyle = "#e4e7ec"; x.lineWidth = 2; x.beginPath(); x.moveTo(P - 16, y - 10); x.lineTo(W - P + 16, y - 10); x.stroke();
  });
  y += 40;
  x.fillStyle = "#0c2342"; x.font = "700 24px Arial"; x.fillText("Responder para:", P, y);
  x.fillStyle = "#3e5066"; x.font = "22px Arial"; x.fillText("Compras Meridian · Belo Horizonte / MG", P, y + 34); x.fillText("meridianpro.com.br", P, y + 66);
  x.strokeStyle = "#ee6500"; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(P, H - 60); x.lineTo(W - P, H - 60); x.stroke(); x.setLineDash([]);
  return cv;
}
let _jspdf = null;
const carregarJsPdf = () => (_jspdf ||= new Promise((ok, nok) => { if (window.jspdf) return ok(window.jspdf); const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; sc.onload = () => ok(window.jspdf); sc.onerror = nok; document.head.appendChild(sc); }));
function CotacaoCard({ g, pic }) {
  const [img, setImg] = useState(null);
  const [cv, setCv] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { desenharCotacao(g, pic).then((c) => { setCv(c); setImg(c.toDataURL("image/png")); }); }, []);
  const nomeArq = `${g.numero ? `${g.numero.replace(/\s+/g, "")}-` : ""}cotacao-${nomeFornCad(g.fornecedor).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const blob = () => new Promise((ok) => cv.toBlob(ok, "image/png"));
  const avisar = (t) => { setMsg(t); setTimeout(() => setMsg(""), 2500); };
  const enviada = () => { if (g.id) fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "enviada", id: g.id }) }).catch(() => {}); };   // v479
  const baixar = (href, nome) => { const a = document.createElement("a"); a.href = href; a.download = nome; a.click(); };
  async function copiar() {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]); enviada(); avisar("Imagem copiada! Cole no WhatsApp (Ctrl+V)."); }
    catch { alerta("O navegador não deixou copiar a imagem. Use Baixar PNG."); }
  }
  async function pdf() {
    try {
      const { jsPDF } = await carregarJsPdf();
      const w = 210, h = (cv.height / cv.width) * w;
      const d = new jsPDF({ unit: "mm", format: [w, Math.max(h, 100)] });
      d.addImage(img, "PNG", 0, 0, w, h); d.save(`${nomeArq}.pdf`); enviada();
    } catch { alerta("Não consegui gerar o PDF. Use Baixar PNG."); }
  }
  async function compartilhar() {
    try { const f = new File([await blob()], `${nomeArq}.png`, { type: "image/png" }); await navigator.share({ files: [f], title: "Cotação Meridian" }); enviada(); } catch {}
  }
  const tel = telWa(g.fornecedor.telefone || g.fornecedor.telefones);
  const podeShare = typeof navigator !== "undefined" && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }); } catch { return false; } })();
  const texto = `Olá! Segue a solicitação de cotação da Meridian (${g.itens.length} item(ns)). Pode nos passar valor unitário, prazo de entrega e condição de pagamento? Obrigado!`;
  const b = "text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1";
  return (
    <div className="rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>{g.numero ? `${g.numero} · ` : ""}{nomeFornCad(g.fornecedor)} <span className="text-xs font-normal" style={{ color: C.sub }}>· {g.itens.length} item(ns){!g.fornecedor.id ? " · não cadastrado" : ""}</span></div>
        {msg && <span className="text-xs font-semibold" style={{ color: C.green }}>{msg}</span>}
      </div>
      {img ? <img src={img} alt="Cotação" className="w-full rounded" style={{ border: `1px solid ${C.line}` }} /> : <div className="flex items-center gap-2 text-sm py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Montando…</div>}
      {img && <div className="flex flex-wrap gap-2 mt-2">
        {podeShare && <button onClick={compartilhar} className={b} style={{ background: "#25D366", color: "#fff" }}>Compartilhar (WhatsApp)</button>}
        <button onClick={copiar} className={b} style={{ background: C.navy, color: "#fff" }}><Copy size={13} /> Copiar imagem</button>
        <button onClick={() => { baixar(img, `${nomeArq}.png`); enviada(); }} className={b} style={{ border: `1px solid ${C.line}`, color: C.text }}>Baixar PNG</button>
        <button onClick={pdf} className={b} style={{ border: `1px solid ${C.line}`, color: C.text }}><FileText size={13} /> Baixar PDF</button>
        <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" onClick={enviada} className={b} style={{ border: "1px solid #25D366", color: "#128C7E" }} title={tel ? `WhatsApp ${tel}` : "Fornecedor sem telefone no cadastro: escolha o contato no WhatsApp"}>Abrir WhatsApp{tel ? "" : " (sem telefone)"}</a>
      </div>}
    </div>
  );
}
function CotacaoModal({ cot, onClose }) {
  return (
    <Modal titulo={`Cotação · ${cot.pic} · ${cot.grupos.length} fornecedor(es)`} onClose={onClose} largo>
      <div className="text-xs mb-3" style={{ color: C.sub }}>Um card por fornecedor com os artigos e as quantidades (sem preço). <b>Copiar imagem</b> e colar na conversa do WhatsApp, ou baixar em PNG/PDF.{cot.semF ? ` ${cot.semF} item(ns) sem fornecedor ficaram de fora.` : ""}</div>
      <div className="space-y-4">{cot.grupos.map((g, k) => <CotacaoCard key={k} g={g} pic={[g.numero, cot.pic].filter(Boolean).join(" · ")} />)}</div>
      <div className="text-xs mt-3" style={{ color: C.sub }}>As cotações ficam em <b>Compras › Cotações</b>, onde você registra a resposta de cada fornecedor e aplica o preço no PIC.</div>
    </Modal>
  );
}

// ---------- v478 — Compras › Cotações: resposta dos fornecedores e aplicação do preço no PIC ----------
const ST_COT = { GERADA: ["gerada · não enviada", C.sub, C.panel2], ENVIADA: ["enviada · aguardando resposta", C.yellow, C.yellowSoft], RESPONDIDA: ["respondida", C.blue, C.blueSoft], OC: ["OC gerada", C.green, C.greenSoft], APLICADA: ["aplicada no PIC", C.green, C.greenSoft] };
const FORMAS_REC = [["COLETA", "Coleta (nós buscamos)"], ["TRANSPORTADORA", "Entrega por transportadora"], ["ENTREGA_PROPRIA", "Entrega própria do fornecedor"]];
// v479 — rota de coleta a partir da OC: abre a demanda de rota preenchida (fornecedor, endereço, "COLETA OC x · NF y")
export function criarRotaColeta(o) {
  window.dispatchEvent(new CustomEvent("ce:ir", { detail: { v: "rota", nova: { objetivo: "COLETA", destinoTipo: "FORNECEDOR", destinoId: o.fornecedor.id, destinoNome: String(o.fornecedor.nome || "").toUpperCase(),
    endereco: o.fornecedor.endereco || "", contato: o.fornecedor.contato || "", telefone: o.fornecedor.telefone || "", horarioTipo: "LIVRE",
    tarefa: `COLETA ${o.numero}${o.nfNumero ? ` · NF ${o.nfNumero}` : ""}`, ocId: o.id } } }));
}
// v486 — situação da rota de coleta de uma OC
const ST_ROTA = { ABERTA: "a montar", NO_BLOCO: "na rota", EM_EXECUCAO: "em execução", CONCLUIDA: "coletada" };
function ChipRota({ r, forma }) {
  if (forma !== "COLETA" && !r) return null;
  if (!r) return <Chip cor={C.red} fundo={C.redSoft} title="Coleta sem demanda de rota">sem rota de coleta</Chip>;
  const ok = r.status === "CONCLUIDA";
  return <Chip cor={ok ? C.green : C.blue} fundo={ok ? C.greenSoft : C.blueSoft} title={`Demanda de rota #${r.id}`}>🚚 coleta {dBR(r.data).slice(0, 5)} · {ST_ROTA[r.status] || r.status}{r.blocoId ? ` R${r.blocoId}` : ""}</Chip>;
}
// v488 — várias cotações do mesmo fornecedor viram uma OC só
// v497 — situação de entrega da OC + previsão de chegada
const ST_ENT = { EM_COLETA: ["Em coleta", C.blue, C.blueSoft], COLETADA: ["Coletada", C.green, C.greenSoft], EM_TRANSPORTADORA: ["Em entrega transportadora", "#4F46E5", "#EEF2FF"], ENTREGA_FORNECEDOR: ["Entrega do fornecedor", "#0E9384", "#E6F6F4"], RECEBIDA: ["Recebida", C.green, C.greenSoft] };
function ChipEntrega({ e }) {
  if (!e?.status) return null;
  const [t, cor, fundo] = ST_ENT[e.status] || [e.status, C.sub, C.panel2];
  const atraso = e.previsao && !["RECEBIDA", "COLETADA"].includes(e.status) && e.previsao < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  return (
    <span className="flex flex-col items-center leading-tight" title={e.fonte === "rota" ? "Previsão = data da rota de coleta" : e.fonte === "calculada" ? "Previsão = emissão da NF + dias após o faturamento" : e.fonte === "informada" ? "Previsão informada na NF/OC" : "Previsão = prazo da OC"}>
      <Chip cor={cor} fundo={fundo}>{t}</Chip>
      <span className="text-[10px] mt-0.5 font-semibold" style={{ color: atraso || (e.status === "EM_COLETA" && e.fonte !== "rota") ? C.red : C.sub }}>{e.status === "EM_COLETA" && e.fonte !== "rota" ? "sem rota de coleta" : e.previsao ? `${e.status === "COLETADA" ? "em" : "prev."} ${dBR(e.previsao).slice(0, 5)}${atraso ? " · atrasada" : ""}` : "sem previsão"}</span>
    </span>
  );
}
function GerarOcCotacao({ cs, user, onClose, onOk }) {
  const [f, setF] = useState({ itens: cs.map((c) => c.itens.map((i) => ({ valorNegociado: numBR(i.valorNegociado ?? i.valorUnitario) }))), prazoEntrega: cs.map((c) => c.prazoEntrega).filter(Boolean).sort().pop() || "", forma: "", dias: "", condicao: cs.find((c) => c.condicao)?.condicao || "" });
  const [oc, setOc] = useState(false);
  const tot = cs.reduce((s1, c, ci) => s1 + c.itens.reduce((s0, i, k) => s0 + (i.naoTem ? 0 : lerNum(f.itens[ci][k]?.valorNegociado) || 0) * (Number(i.quantidade) || 0), 0), 0);
  async function gerar() {
    if (!f.forma) return alerta("Escolha a forma de recebimento.");
    setOc(true);
    const r = await fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "gerarOc", cotacoes: cs.map((c, ci) => ({ id: c.id, itens: f.itens[ci] })), prazoEntrega: f.prazoEntrega, forma: f.forma, diasAposFaturamento: f.dias, condicao: f.condicao, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setOc(false);
    if (!r.ok) return alerta(x.error || "Erro ao gerar a OC.");
    if (x.forma === "COLETA" && (await confirmar(`${x.oc.numero} gerada${x.cotacoes?.length > 1 ? ` (${x.cotacoes.join(" + ")})` : ""}. Criar agora a rota de coleta no fornecedor?`))) {
      const l = await fetch("/api/compras/oc").then((rr) => rr.json()).catch(() => []);
      const o = (Array.isArray(l) ? l : []).find((y) => y.id === x.oc.id);
      onOk(); if (o) criarRotaColeta(o);
      return;
    }
    await alerta(`${x.oc.numero} gerada${x.cotacoes?.length > 1 ? ` juntando ${x.cotacoes.join(" + ")}` : ""}. Ela está em Compras › Ordens de compra.`);
    onOk();
  }
  const inp = "px-2 py-1 rounded text-sm outline-none";
  return (
    <Modal titulo={`Gerar OC · ${cs[0].fornecedorNome} · ${cs.map((c) => c.numero).join(" + ")}`} onClose={onClose} largo>
      <div className="flex px-1 py-1 text-xs font-semibold gap-2" style={{ color: C.sub }}><div className="flex-1">Artigo</div><div className="w-24 text-right">Qtd</div><div className="w-24 text-right">Cotado</div><div className="w-28 text-right">Negociado</div></div>
      {cs.map((c, ci) => (
        <React.Fragment key={c.id}>
          {cs.length > 1 && <div className="text-[11px] font-bold px-1 pt-2" style={{ color: C.accent }}>{c.numero}{c.pics ? ` · ${c.pics}` : ""}</div>}
          {c.itens.map((i, k) => i.naoTem ? <div key={k} className="px-1 py-1.5 text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.sub }}><s>{i.nome}</s> · fornecedor não tem (fica no PIC)</div> : (
            <div key={k} className="flex px-1 py-1.5 gap-2 items-center text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0 truncate">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{i.det}</span></div>
              <div className="w-24 text-right">{qtdU(i.quantidade, i.unidade)}</div>
              <div className="w-24 text-right" style={{ color: C.sub }}>{brl(i.valorUnitario)}</div>
              <div className="w-28 text-right"><input value={f.itens[ci][k]?.valorNegociado || ""} onChange={(e) => setF((x) => ({ ...x, itens: x.itens.map((arr, cj) => (cj !== ci ? arr : arr.map((y, j) => (j === k ? { valorNegociado: e.target.value } : y)))) }))} className={`${inp} w-24 text-right`} style={{ border: `1px solid ${C.line}` }} /></div>
            </div>
          ))}
        </React.Fragment>
      ))}
      <div className="text-right text-sm font-bold py-2" style={{ color: C.navy }}>Total negociado {brl(tot)}</div>
      <div className="grid gap-3 mt-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <label className="text-xs" style={{ color: C.sub }}>Forma de recebimento<select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })} className={`${inp} block w-full mt-1`} style={{ border: `1px solid ${f.forma ? C.line : C.accent}`, color: C.text }}><option value="">Escolha…</option>{FORMAS_REC.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="text-xs" style={{ color: C.sub }}>Prazo de entrega<input type="date" value={f.prazoEntrega} onChange={(e) => setF({ ...f, prazoEntrega: e.target.value })} className={`${inp} block w-full mt-1`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
        {f.forma === "TRANSPORTADORA" && <label className="text-xs" style={{ color: C.sub }}>Entrega após o faturamento (dias)<input value={f.dias} onChange={(e) => setF({ ...f, dias: e.target.value.replace(/\D/g, "") })} placeholder="ex.: 5" className={`${inp} block w-full mt-1`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>}
        <label className="text-xs" style={{ color: C.sub }}>Condição de pagamento<input value={f.condicao} onChange={(e) => setF({ ...f, condicao: e.target.value })} placeholder="ex.: 30/60 dias" className={`${inp} block w-full mt-1`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
      </div>
      {f.forma === "COLETA" && <div className="text-xs mt-3 px-3 py-2 rounded" style={{ background: C.blueSoft, color: C.blue }}>Coleta: depois de gerar a OC você pode criar a rota de coleta no fornecedor (também pelo botão da OC).</div>}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
        <button disabled={oc} onClick={gerar} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />} Gerar OC{cs.length > 1 ? ` única (${cs.length} cotações)` : ""}</button>
      </div>
    </Modal>
  );
}
// v481 — arquivos da cotação (proposta do fornecedor, prints…)
const lerB64 = (f) => new Promise((ok, nok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = nok; r.readAsDataURL(f); });
const tamTxt = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
function ArquivosCotacao({ c, user, onMudou }) {
  const [env, setEnv] = useState(false);
  const [arr, setArr] = useState(false);
  async function anexar(fs) {
    setEnv(true);
    for (const f of fs) {
      try {
        const r = await fetch("/api/compras/cotacoes/arquivos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cotacaoId: c.id, nome: f.name, mime: f.type, conteudo: await lerB64(f), quem: nomeUser(user) }) });
        if (!r.ok) { const x = await r.json().catch(() => ({})); alerta(x.error || `Erro ao anexar ${f.name}.`); }
      } catch { alerta(`Erro ao ler ${f.name}.`); }
    }
    setEnv(false); onMudou();
  }
  async function tirar(a) {
    if (!(await confirmar(`Excluir o arquivo ${a.nome}?`))) return;
    await fetch("/api/compras/cotacoes/arquivos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) });
    onMudou();
  }
  const arqs = c.arquivos || [];
  return (
    <div className="px-4 py-2.5 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${C.line}`, background: arr ? C.accentSoft : undefined }}
      onDragOver={(e) => { e.preventDefault(); setArr(true); }} onDragLeave={() => setArr(false)} onDrop={(e) => { e.preventDefault(); setArr(false); if (e.dataTransfer.files?.length) anexar([...e.dataTransfer.files]); }}>
      <span className="text-xs font-semibold" style={{ color: C.sub }}>📎 Arquivos ({arqs.length})</span>
      {arqs.map((a) => (
        <span key={a.id} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }} title={`${a.criadoPorNome || ""} · ${new Date(a.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}>
          <FileText size={12} style={{ color: C.accent }} />
          <a href={`/api/compras/cotacoes/arquivos?id=${a.id}`} target="_blank" rel="noreferrer" className="max-w-[220px] truncate" style={{ color: C.blue }}>{a.nome}</a>
          <span style={{ color: C.sub }}>{tamTxt(a.tamanho)}</span>
          <button onClick={() => tirar(a)} title="Excluir" style={{ color: C.sub }}><X size={12} /></button>
        </span>
      ))}
      <label className="text-xs px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1" style={{ border: `1px dashed ${C.accent}`, color: C.accent }}>
        {env ? <Loader2 size={12} className="animate-spin" /> : "+"} Anexar arquivo
        <input type="file" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) anexar(fs); }} />
      </label>
      <span className="text-[11px]" style={{ color: C.sub }}>ou arraste aqui (PDF, imagem, planilha · até 15 MB)</span>
    </div>
  );
}
export function Cotacoes({ user, fases, ir }) {
  const [l, setL] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [ed, setEd] = useState({});   // { cotId: { itens: [...], condicao, prazoEntrega, obs } }
  const [card, setCard] = useState(null);
  const [gerOc, setGerOc] = useState(null);   // v479
  const [forns, setForns] = useState(_fornPic || []);   // v491 — para ligar a cotação ao cadastro
  useEffect(() => { if (!_fornPic) fetch("/api/fornecedores").then((r) => r.json()).then((x) => { _fornPic = Array.isArray(x) ? x : []; setForns(_fornPic); }).catch(() => {}); }, []);
  const [vinc, setVinc] = useState({});
  const carregar = () => fetch("/api/compras/cotacoes").then((r) => r.json()).then((x) => { setL(Array.isArray(x) ? x : []); setEd({}); }).catch(() => setL([]));
  useEffect(() => { carregar(); }, []);
  const dados = (c) => ed[c.id] || { itens: c.itens.map((i) => ({ valorUnitario: numBR(i.valorUnitario), prazo: i.prazo || "", obs: i.obs || "", naoTem: !!i.naoTem })), condicao: c.condicao || "", prazoEntrega: c.prazoEntrega || "", obs: c.obs || "" };
  const setD = (c, f) => setEd((e) => ({ ...e, [c.id]: f(dados(c)) }));
  const post = async (body, ok) => { const r = await fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const x = await r.json().catch(() => ({})); if (!r.ok) { alerta(x.error || "Erro."); return null; } if (ok) await alerta(ok(x)); carregar(); return x; };
  // menor preço de cada artigo entre as cotações (para comparar fornecedores)
  const melhor = useMemo(() => { const m = {}; for (const c of l || []) for (const i of c.itens) if (i.valorUnitario != null && !i.naoTem) { const k = `${i.nome}|${i.det}|${i.unidade}`; if (!m[k] || i.valorUnitario < m[k].v) m[k] = { v: i.valorUnitario, f: c.fornecedorNome, n: c.numero }; } return m; }, [l]);
  const ehOc = (c) => c.status === "OC" || c.status === "APLICADA";
  const ABAS = [["GERADA", "Geradas"], ["ENVIADA", "Enviadas"], ["RESPONDIDA", "Respondidas"], ["OC", "Com OC"], ["todas", "Todas"]];
  const conta = (k) => (l || []).filter((c) => (k === "OC" ? ehOc(c) : c.status === k)).length;
  const vis = (l || []).filter((c) => filtro === "todas" || (filtro === "OC" ? ehOc(c) : c.status === filtro));
  const inp = "px-2 py-1 rounded text-sm outline-none";
  return (
    <div className="w-full">
      <FasesCompras atual="comprasCotacoes" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Todas as cotações geradas no <b>PIC</b>, uma por fornecedor: <b>geradas</b>, <b>enviadas</b> (ao copiar, baixar ou abrir no WhatsApp), <b>respondidas</b> (quando você registra o valor) e <b>com OC</b>. Na respondida, <b>Gerar OC</b> pede o valor negociado, o prazo e a forma de recebimento. O menor preço entre as cotações de cada artigo aparece em verde.</p>
      <div className="flex items-center gap-2 mb-3">
        {ABAS.map(([k, t0]) => [k, k === "todas" ? t0 : `${t0} (${conta(k)})`]).map(([k, t]) => <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: filtro === k ? C.accent : C.panel, color: filtro === k ? "#fff" : C.sub, border: `1px solid ${filtro === k ? C.accent : C.line}` }}>{t}</button>)}
        <button onClick={carregar} className="p-2 rounded-md ml-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !vis.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma cotação aqui. Gere pelo PIC (botão Gerar cotação).</div>}
      {card && <CotacaoModal cot={card} onClose={() => { setCard(null); carregar(); }} />}
      {gerOc && <GerarOcCotacao cs={gerOc} user={user} onClose={() => setGerOc(null)} onOk={() => { setGerOc(null); carregar(); }} />}
      {vis.map((c) => {
        const d = dados(c), trav = false, comOc = ehOc(c);   // v487 — cotação sempre editável
        const [txt, cor, fundo] = ST_COT[c.status] || ST_COT.ENVIADA;
        const tot = c.itens.reduce((s0, i, k) => s0 + (d.itens[k]?.naoTem ? 0 : (lerNum(d.itens[k]?.valorUnitario) || 0)) * (Number(i.quantidade) || 0), 0);
        return (
          <div key={c.id} className="rounded-lg mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>{c.numero} · {c.fornecedorNome} <span className="font-normal text-xs" style={{ color: C.sub }}>· {new Date(c.createdAt).toLocaleDateString("pt-BR")}{c.pics ? ` · ${c.pics}` : ""}{c.criadoPorNome ? ` · ${c.criadoPorNome}` : ""}</span></div>
              {!c.fornecedorId && (   // v491 — sem cadastro não gera OC: liga ao cadastro aqui
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold" style={{ color: C.red }}>fora do cadastro ·</span>
                  <div className="w-56"><BuscaFornecedor valor={vinc[c.id] ?? ""} forns={forns} placeholder="ligar ao fornecedor do cadastro" estilo={{ border: `1px solid ${C.red}`, fontSize: 12, padding: "3px 8px" }}
                    onEscolher={async (f, txt) => { setVinc((m) => ({ ...m, [c.id]: f ? nomeFornCad(f) : txt })); if (f) { const x = await post({ acao: "vincular", id: c.id, fornecedorId: f.id }); if (x?.cotacoes > 1) alerta(`${x.cotacoes} cotações de ${c.fornecedorNome} ligadas a ${nomeFornCad(f)}.`); } }} /></div>
                </div>
              )}
              {tot > 0 && <span className="text-sm font-bold" style={{ color: C.navy }}>{brl(tot)}</span>}
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
            </div>
            <div className="flex px-4 py-2 text-xs font-semibold gap-2" style={{ color: C.sub, background: C.panel2 }}>
              <div className="flex-1">Artigo</div><div className="w-28 text-right">Quantidade</div><div className="w-28 text-right">Valor unit.</div><div className="w-36">Prazo</div><div className="w-20 text-center">Não tem</div><div className="w-28 text-right">Total</div>
            </div>
            {c.itens.map((i, k) => {
              const di = d.itens[k] || {}; const v = lerNum(di.valorUnitario);
              const m = melhor[`${i.nome}|${i.det}|${i.unidade}`];
              const eMelhor = m && v != null && v <= m.v + 1e-9;
              return (
                <div key={k} className="flex px-4 py-2 gap-2 items-center text-sm" style={{ borderTop: `1px solid ${C.line}`, opacity: di.naoTem ? 0.55 : 1 }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ color: C.text, textDecoration: di.naoTem ? "line-through" : "none" }}>{i.nome} <span className="text-xs font-normal" style={{ color: C.sub }}>{i.det}</span></div>
                    {comOc && i.valorNegociado != null && !di.naoTem && <div className="text-[11px] font-semibold" style={{ color: C.green }}>negociado na {c.ocNumero}: {brl(i.valorNegociado)}</div>}
                    {m && m.n !== c.numero && <div className="text-[11px]" style={{ color: C.sub }}>menor preço: <b style={{ color: C.green }}>{brl(m.v)}</b> · {m.f} ({m.n})</div>}
                  </div>
                  <div className="w-28 text-right">{qtdU(i.quantidade, i.unidade)}</div>
                  <div className="w-28 text-right">{di.naoTem ? <span className="text-xs" style={{ color: C.red }}>não tem</span> : trav ? brl(i.valorUnitario) : <input value={di.valorUnitario} onChange={(e) => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, valorUnitario: e.target.value } : y)) }))} placeholder="0,00" className={`${inp} w-24 text-right`} style={{ border: `1px solid ${eMelhor ? C.green : C.line}`, background: eMelhor ? C.greenSoft : C.panel }} />}</div>
                  <div className="w-36">{di.naoTem ? "" : trav ? (i.prazo ? dBR(i.prazo) : "—") : <input type="date" value={di.prazo} onChange={(e) => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, prazo: e.target.value } : y)) }))} className={`${inp} w-full`} style={{ border: `1px solid ${C.line}` }} />}</div>
                  <div className="w-20 text-center">{/* v484 */}<input type="checkbox" disabled={trav} checked={!!di.naoTem} title="O fornecedor não tem este item" onChange={(e) => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, naoTem: e.target.checked, ...(e.target.checked ? { valorUnitario: "", prazo: "" } : {}) } : y)) }))} /></div>
                  <div className="w-28 text-right font-semibold" style={{ color: C.navy }}>{v && !di.naoTem ? brl(v * (Number(i.quantidade) || 0)) : "—"}</div>
                </div>
              );
            })}
            <ArquivosCotacao c={c} user={user} onMudou={() => fetch("/api/compras/cotacoes").then((r) => r.json()).then((x) => Array.isArray(x) && setL(x)).catch(() => {})} />
            <div className="flex flex-wrap items-end gap-3 px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
              <label className="text-xs" style={{ color: C.sub }}>Condição de pagamento<input disabled={trav} value={d.condicao} onChange={(e) => setD(c, (x) => ({ ...x, condicao: e.target.value }))} placeholder="ex.: 30/60 dias" className={`${inp} block mt-1 w-40`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
              <label className="text-xs" style={{ color: C.sub }}>Entrega prevista<input disabled={trav} type="date" value={d.prazoEntrega} onChange={(e) => setD(c, (x) => ({ ...x, prazoEntrega: e.target.value }))} className={`${inp} block mt-1`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
              <label className="text-xs flex-1 min-w-[160px]" style={{ color: C.sub }}>Obs.<input disabled={trav} value={d.obs} onChange={(e) => setD(c, (x) => ({ ...x, obs: e.target.value }))} className={`${inp} block mt-1 w-full`} style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>
              {c.status === "GERADA" && <button onClick={() => post({ acao: "enviada", id: c.id })} className="text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }}>Marcar enviada</button>}
              <button onClick={() => setCard({ pic: c.pics || "", grupos: [{ id: c.id, numero: c.numero, fornecedor: c.fornecedor, itens: c.itens }] })} className="text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><FileText size={13} /> Card / WhatsApp</button>
              {!comOc && <button onClick={async () => { if (await confirmar(`Cancelar a ${c.numero}?`)) post({ acao: "cancelar", id: c.id }); }} className="text-xs px-2.5 py-1.5 rounded-md" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}>Cancelar</button>}
              {!trav && <button onClick={() => post({ acao: "responder", id: c.id, ...d })} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>Salvar resposta</button>}
              {!comOc && <button onClick={async () => {   // v479 — OC a partir da cotação respondida
                if (!d.itens.some((x) => !x.naoTem && lerNum(x.valorUnitario) > 0)) return alerta(d.itens.every((x) => x.naoTem) ? "O fornecedor não tem nenhum item: não há OC a gerar." : "Registre a resposta do fornecedor (valor unitário) antes de gerar a OC.");
                const x = await post({ acao: "responder", id: c.id, ...d }); if (!x) return;
                const atual = { ...c, ...x.cotacao, itens: x.cotacao.itens };
                // v488 — outras cotações respondidas do mesmo fornecedor, ainda sem OC: juntar numa OC só
                const irmas = (l || []).filter((y) => y.id !== c.id && y.fornecedorId && y.fornecedorId === c.fornecedorId && y.status === "RESPONDIDA" && y.itens.some((i) => !i.naoTem && i.valorUnitario != null));
                if (irmas.length && (await confirmar(`${c.fornecedorNome} também respondeu ${irmas.map((y) => y.numero).join(", ")}. Juntar tudo numa OC só?`))) setGerOc([atual, ...irmas]);
                else setGerOc([atual]);
              }} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}><ShoppingCart size={14} /> Gerar OC</button>}
              {comOc && c.ocNumero && <Chip cor={C.green} fundo={C.greenSoft}>{c.ocNumero}</Chip>}
              {comOc && c.ocNumero && <ChipRota r={c.rota} forma={c.ocForma} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- v486 — XML e PDF da NF na OC (o XML preenche o nº e a emissão) ----------
function ArquivosNfOc({ o, onMudou }) {
  const [env, setEnv] = useState(false);
  async function anexar(fs) {
    setEnv(true);
    for (const f of fs) {
      try {
        const r = await fetch("/api/compras/oc/arquivos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocId: o.id, nome: f.name, mime: f.type, conteudo: await lerB64(f) }) });
        const x = await r.json().catch(() => ({}));
        if (!r.ok) alerta(x.error || `Erro ao anexar ${f.name}.`);
        else if (x.nf) alerta(`XML lido: NF ${x.nf.numero}${x.nf.emissao ? ` de ${dBR(x.nf.emissao)}` : ""} registrada na OC.`);
      } catch { alerta(`Erro ao ler ${f.name}.`); }
    }
    setEnv(false); onMudou();
  }
  const tirar = async (a) => { if (!(await confirmar(`Excluir ${a.nome}?`))) return; await fetch("/api/compras/oc/arquivos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) }); onMudou(); };
  const arqs = o.arquivos || [];
  const tem = (t) => arqs.some((a) => a.tipo === t);
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) anexar([...e.dataTransfer.files]); }}>
      <span className="text-xs font-semibold" style={{ color: C.sub }}>Arquivos da NF:</span>
      <Chip cor={tem("XML") ? C.green : C.sub} fundo={tem("XML") ? C.greenSoft : C.panel2}>XML {tem("XML") ? "✓" : "—"}</Chip>
      <Chip cor={tem("PDF") ? C.green : C.sub} fundo={tem("PDF") ? C.greenSoft : C.panel2}>PDF {tem("PDF") ? "✓" : "—"}</Chip>
      {arqs.map((a) => (
        <span key={a.id} className="text-xs flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
          <FileText size={12} style={{ color: a.tipo === "XML" ? C.blue : C.red }} />
          <a href={`/api/compras/oc/arquivos?id=${a.id}`} target="_blank" rel="noreferrer" className="max-w-[200px] truncate" style={{ color: C.blue }}>{a.nome}</a>
          <button onClick={() => tirar(a)} style={{ color: C.sub }}><X size={12} /></button>
        </span>
      ))}
      <label className="text-xs px-2.5 py-1 rounded-md font-semibold cursor-pointer flex items-center gap-1" style={{ border: `1px dashed ${C.accent}`, color: C.accent }}>
        {env ? <Loader2 size={12} className="animate-spin" /> : "+"} Anexar XML / PDF
        <input type="file" multiple accept=".xml,.pdf,application/pdf,text/xml,application/xml" className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) anexar(fs); }} />
      </label>
    </div>
  );
}

// ---------- v486 — painel de compras: tudo que está em PIC e a etapa de cada item ----------
const ETAPAS_PRE = [["LEVANTAMENTO", "Pendente", "#7A5AF8", "#F1EDFF"], ["ESTOQUE", "Atendido pelo estoque", C.green, C.greenSoft], ["REPROVADO", "Vai para compra", C.red, C.redSoft]];   // v495
const ETAPAS = [["EM_COTACAO", "Em cotação", C.accent, C.accentSoft], ["AGUARDANDO_NF", "Aguardando NF", C.yellow, C.yellowSoft], ["EM_COLETA", "Em coleta", C.blue, C.blueSoft],
  ["EM_TRANSPORTADORA", "Em entrega transportadora", "#4F46E5", "#EEF2FF"], ["ENTREGA_FORNECEDOR", "Entrega do fornecedor", "#0E9384", "#E6F6F4"], ["RECEBIDA", "Recebida", C.green, C.greenSoft]];
export function PainelCompras({ ir, soAvulsas, acoes }) {   // v495 — soAvulsas: o mesmo painel só com as compras avulsas
  const [l, setL] = useState(null);
  const [jan, setJan] = useState(null);   // v490 — PIC ou OC em janela central
  const [f, setF] = useState(null);
  const [q, setQ] = useState("");
  const carregar = () => fetch(`/api/compras/demandas${soAvulsas ? "?avulsas=1" : ""}`).then((r) => r.json()).then((x) => setL(Array.isArray(x) ? x : [])).catch(() => setL([]));
  useEffect(() => { carregar(); const f = () => carregar(); window.addEventListener("ce:avulsasMudou", f); return () => window.removeEventListener("ce:avulsasMudou", f); }, []);
  const conta = (k) => (l || []).filter((i) => i.etapa === k).length;
  const t = norm(q);
  const vis = (l || []).filter((i) => (f ? i.etapa === f : i.etapa !== "RECEBIDA") && (!t || norm(`${i.nome} ${i.det} ${i.fornecedor || ""} ${i.pic} ${i.oc?.numero || ""} ${i.pedidos.join(" ")}`).includes(t)));
  return (
    <div className={soAvulsas ? "mb-6" : "mt-6"}>   {/* v495 — largura da página toda */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-base font-bold" style={{ color: C.navy }}>{soAvulsas ? "Itens das compras avulsas" : "Demandas de compra"}</div>
        <span className="text-xs" style={{ color: C.sub }}>{soAvulsas ? "do lançamento ao recebimento, por etapa" : "tudo que está em PIC, por etapa"}</span>
        <div className="flex items-center gap-2 px-2 rounded ml-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}><Search size={14} style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artigo, fornecedor, OC, pedido…" className="py-1.5 text-sm outline-none w-56" /></div>
        <button onClick={carregar} className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
        {acoes}
      </div>
      {/* trilha das etapas */}
      <div className="flex items-stretch gap-1 mb-3 overflow-x-auto">
        {[...ETAPAS_PRE, ...ETAPAS].map(([k, t0, cor, fundo], n) => (
          <React.Fragment key={k}>
            {n > 0 && <div className="flex items-center text-sm" style={{ color: C.sub }}>›</div>}
            <button onClick={() => setF(f === k ? null : k)} className="flex-1 min-w-[120px] rounded-lg px-3 py-2 text-left" style={{ background: f === k ? cor : fundo, color: f === k ? "#fff" : cor, border: `1px solid ${cor}55` }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide">{t0}</div>
              <div className="text-xl font-bold">{l ? conta(k) : "…"}</div>
            </button>
          </React.Fragment>
        ))}
      </div>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !vis.length && <div className="text-sm py-6 text-center rounded-lg" style={{ color: C.sub, background: C.panel, border: `1px solid ${C.line}` }}>{l.length ? "Nada nesta etapa." : "Nenhuma demanda de compra. Elas nascem no Levantamento (Gerar PIC)."}</div>}
      {vis.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex px-4 py-2 text-xs font-semibold gap-3 items-center" style={{ color: C.sub, background: C.panel2 }}>
            <div className="flex-1">Artigo</div><div className="w-8 text-center" title="A = compra avulsa · P = pedido">Orig.</div><div className="w-24 text-center">Qtd</div><div className="w-40 text-center">Fornecedor</div><div className="w-28 text-center">PIC / OC</div><div className="w-32 text-center">Para</div><div className="w-36 text-center">Etapa</div>
          </div>
          {vis.map((i) => {
            const e = [...ETAPAS_PRE, ...ETAPAS].find((x) => x[0] === i.etapa) || ETAPAS[0];
            const cotTxt = i.etapa === "EM_COTACAO" ? (i.cotacoes.length ? `${i.cotacoes.filter((c) => c.s === "VALOR").length}/${i.cotacoes.length} cotação(ões) respondida(s)${i.cotacoes.length && i.cotacoes.every((c) => c.s === "NAO_TEM") ? " · ninguém tem" : ""}` : "cotação não gerada") : null;
            return (
              <div key={i.id} className="flex px-4 py-2 gap-3 items-center text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="flex-1 min-w-0"><div className="font-semibold truncate" style={{ color: C.text }}>{i.nome} <span className="text-xs font-normal" style={{ color: C.sub }}>{i.det}</span></div>
                  <div className="text-[11px] truncate" style={{ color: C.sub }}>
                    {(i.origens || []).filter((o) => o.startsWith("AV")).length && soAvulsas
                      ? [...new Set(i.origens.filter((o) => o.startsWith("AV")).map((o) => Number(o.split("|")[0].slice(2))))].map((id, k2) => <button key={id} onClick={() => window.dispatchEvent(new CustomEvent("ce:editarAvulsa", { detail: { id } }))} className="underline decoration-dotted mr-1.5" title="Abrir a compra avulsa">{i.pedidos[k2] || `Avulsa #${id}`}</button>)
                      : i.pedidos.join(" · ")}
                    {i.criadoEm ? <span> · criada em {dBR(String(i.criadoEm).slice(0, 10))}</span> : null}</div></div>
                <div className="w-8 flex flex-col items-center gap-0.5">{/* v495 — A laranja avulsa · P azul pedido */}
                  {i.origem?.includes("A") && <span title="Compra avulsa" className="rounded font-extrabold text-[11px] flex items-center justify-center" style={{ width: 18, height: 18, background: C.accent, color: "#fff" }}>A</span>}
                  {i.origem?.includes("P") && <span title="Pedido" className="rounded font-extrabold text-[11px] flex items-center justify-center" style={{ width: 18, height: 18, background: C.blue, color: "#fff" }}>P</span>}</div>
                <div className="w-24 text-center">{qtdU(i.quantidade, i.unidade)}</div>
                <div className="w-40 text-xs truncate text-center" style={{ color: i.fornecedor ? C.text : C.sub }} title={i.fornecedor || ""}>{i.fornecedor || "—"}</div>
                <div className="w-28 text-xs text-center" style={{ color: C.sub }}>   {/* v490 — clicar abre o PIC ou a OC */}
                  {i.pic ? <button onClick={() => (ir ? irPara(ir, "pic", i.pic) : setJan({ tipo: "pic", numero: i.pic }))} className="underline decoration-dotted hover:text-black" title="Abrir este PIC">{i.pic}</button> : "—"}
                  {i.oc ? <div><button onClick={() => (ir ? irPara(ir, "oc", i.oc.id) : setJan({ tipo: "oc", id: i.oc.id }))} title="Abrir esta OC" className="font-semibold underline decoration-dotted" style={{ color: C.navy }}>{i.oc.numero}</button>{i.oc.nf ? <span style={{ color: C.navy }}> · NF {i.oc.nf}</span> : ""}</div> : null}</div>
                <div className="w-32 flex flex-wrap gap-1 justify-center">{(i.destinos || []).map((x) => x === "OPERACAO"   // v489 — operação (interno) ou pedido indexado
                  ? <span key={x} className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: C.panel2, color: C.sub }}>Operação</span>
                  : <span key={x} className="text-[10px] font-semibold px-1.5 py-px rounded" style={{ background: C.blueSoft, color: C.blue }}>{x.replace("PED ", "Ped. ")}</span>)}</div>
                <div className="w-36 min-w-0 text-center">
                  <span className="text-[10px] font-semibold px-1.5 py-px rounded whitespace-nowrap" style={{ background: e[3], color: e[2] }}>{e[1]}</span>
                  <div className="text-[10px] mt-0.5 truncate" style={{ color: C.sub }}>
                    {cotTxt}
                    {i.etapa === "EM_COLETA" && (i.rota ? `rota ${dBR(i.rota.data).slice(0, 5)} · ${ST_ROTA[i.rota.status] || i.rota.status}${i.rota.blocoId ? ` R${i.rota.blocoId}` : ""}` : "sem rota de coleta")}
                    {["EM_TRANSPORTADORA", "ENTREGA_FORNECEDOR", "AGUARDANDO_NF"].includes(i.etapa) && i.previsao ? `previsão ${dBR(i.previsao)}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {jan && <JanelaPicOc jan={jan} onClose={() => setJan(null)} ir={ir} />}
      {ir && <div className="flex gap-3 mt-2 text-xs">{[["pic", "Abrir PIC"], ["comprasCotacoes", "Abrir cotações"], ["oc", "Abrir ordens de compra"]].map(([k, t0]) => <button key={k} onClick={() => ir(k)} className="underline" style={{ color: C.accent }}>{t0}</button>)}</div>}
    </div>
  );
}

// v491b — abrir um PIC ou uma OC específica na tela dela (rola até ele e destaca)
const FOCO = "ce_foco_compras";
function irPara(ir, tipo, chave) { try { sessionStorage.setItem(FOCO, JSON.stringify({ tipo, chave, t: Date.now() })); } catch {} ir(tipo === "pic" ? "pic" : "oc"); }
function lerFoco(tipo) { try { const f = JSON.parse(sessionStorage.getItem(FOCO) || "null"); if (f?.tipo === tipo && Date.now() - f.t < 15000) { sessionStorage.removeItem(FOCO); return f.chave; } } catch {} return null; }
function rolarDestacar(id) { setTimeout(() => { const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ behavior: "smooth", block: "start" }); el.style.transition = "box-shadow .4s"; el.style.boxShadow = "0 0 0 3px #FF6B1A"; setTimeout(() => { el.style.boxShadow = ""; }, 2500); }, 250); }

// ---------- v490 — PIC ou OC em janela central (a partir do painel de compras) ----------
function JanelaPicOc({ jan, onClose, ir }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (jan.tipo === "pic") fetch("/api/compras/pic").then((r) => r.json()).then((l) => setD((Array.isArray(l) ? l : []).find((p) => p.numero === jan.numero) || { vazio: true })).catch(() => setD({ vazio: true }));
    else fetch("/api/compras/oc").then((r) => r.json()).then((l) => setD((Array.isArray(l) ? l : []).find((o) => o.id === jan.id) || { vazio: true })).catch(() => setD({ vazio: true }));
  }, []);
  const titulo = jan.tipo === "pic" ? jan.numero : d?.numero || "OC";
  const linha = "flex gap-2 py-1.5 text-sm items-center";
  return (
    <Modal titulo={d && !d.vazio && jan.tipo === "oc" ? `${d.numero} · ${d.fornecedor.nome}` : titulo} onClose={onClose} largo>
      {!d && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {d?.vazio && <div className="text-sm" style={{ color: C.sub }}>Não encontrado.</div>}
      {d && !d.vazio && jan.tipo === "pic" && (
        <>
          <div className="text-xs mb-2" style={{ color: C.sub }}>{new Date(d.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{d.criadoPorNome ? ` · ${d.criadoPorNome}` : ""} · {d.itens.length} artigo(s) · {d.status === "OC" ? "todas em OC" : `${d.itens.filter((i) => !i.oc).length} sem OC`}</div>
          <div className="flex gap-2 py-1 text-xs font-semibold" style={{ color: C.sub }}><div className="flex-1">Artigo</div><div className="w-24 text-center">Qtd</div><div className="w-40 text-center">Fornecedor</div><div className="w-24 text-center">Valor</div><div className="w-20 text-center">OC</div></div>
          {d.itens.map((i) => (
            <div key={i.id} className={linha} style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0"><div className="truncate font-semibold">{i.info?.nome}</div><div className="text-[11px] truncate" style={{ color: C.sub }}>{(i.info?.pedidos || []).map((x) => (x.avulsa ? "Avulsa" : `Ped. ${x.pedido}`)).filter((x, k, a) => a.indexOf(x) === k).join(" · ")}</div></div>
              <div className="w-24 text-center">{qtdU(i.quantidade, i.info?.unidade)}</div>
              <div className="w-40 text-center text-xs truncate">{i.fornecedor || "—"}</div>
              <div className="w-24 text-center">{i.valorUnitario ? brl(i.valorUnitario) : "—"}</div>
              <div className="w-20 text-center text-xs font-semibold" style={{ color: i.oc ? C.green : C.sub }}>{i.oc?.numero || "—"}</div>
            </div>
          ))}
        </>
      )}
      {d && !d.vazio && jan.tipo === "oc" && (
        <>
          <div className="text-xs mb-2" style={{ color: C.sub }}>{new Date(d.createdAt).toLocaleDateString("pt-BR")}{d.cotacao ? ` · ${d.cotacao}` : ""}{d.pic ? ` · ${d.pic}` : ""} · {(ST_OC[d.status] || [])[0]}{d.formaRecebimento ? ` · ${(FORMAS_REC.find((x) => x[0] === d.formaRecebimento) || [])[1]}` : ""}{d.condicaoFaturamento ? ` · ${d.condicaoFaturamento}` : ""}{d.prazoFabrica ? ` · entrega ${new Date(d.prazoFabrica).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}{d.nfNumero ? ` · NF ${d.nfNumero}` : ""}</div>
          <div className="flex gap-2 py-1 text-xs font-semibold" style={{ color: C.sub }}><div className="flex-1">Artigo</div><div className="w-28 text-center">Qtd</div><div className="w-28 text-center">Valor unit.</div><div className="w-28 text-center">Total</div></div>
          {d.itens.map((i) => (
            <div key={i.id} className={linha} style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0 truncate">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{[i.cor, i.codigo].filter(Boolean).join(" · ")}</span></div>
              <div className="w-28 text-center">{qtdU(i.quantidade, i.unidade)}</div><div className="w-28 text-center">{brl(i.valorUnitario)}</div><div className="w-28 text-center font-semibold">{brl(i.quantidade * i.valorUnitario)}</div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <ChipRota r={d.rota} forma={d.formaRecebimento} />
            <span className="ml-auto text-sm font-bold" style={{ color: C.accent }}>Total {brl(d.total)}</span>
          </div>
        </>
      )}
      <div className="flex justify-end gap-2 mt-4">
        {ir && <button onClick={() => { onClose(); ir(jan.tipo === "pic" ? "pic" : "oc"); }} className="px-3 py-1.5 rounded-md text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Abrir {jan.tipo === "pic" ? "a tela do PIC" : "Ordens de compra"}</button>}
        <button onClick={onClose} className="px-3 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
      </div>
    </Modal>
  );
}

// ---------- v494 — NFs da OC: sobe pelo lançamento do movimento fiscal, confere com a OC e permite corrigir ----------
function NfsDaOc({ o, user, onMudou }) {
  const [imp, setImp] = useState(null);
  const [arr, setArr] = useState(false);
  const [conf, setConf] = useState(null);
  const [oc2, setOc2] = useState(false);
  const nfs = o.nfs || [];
  const conferir = () => fetch(`/api/compras/oc/nf?oc=${o.id}`).then((r) => r.json()).then(setConf).catch(() => setConf(null));
  useEffect(() => { if (nfs.length) conferir(); else setConf(null); }, [nfs.map((n) => n.id).join(",")]);
  const post = async (body, msg) => { setOc2(true); const r = await fetch("/api/compras/oc/nf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocId: o.id, ...body }) }); const x = await r.json().catch(() => ({})); setOc2(false); if (!r.ok) { alerta(x.error || "Erro."); return null; } if (msg) await alerta(msg(x)); onMudou(); conferir(); return x; };
  async function excluir(n) {
    if (!(await confirmar(`Tirar a NF ${n.numero} desta OC?`))) return;
    const tudo = await confirmar(`Excluir também a NF ${n.numero} do movimento fiscal? As contas lançadas por ela vão para a lixeira do contas a pagar.\n\n(Cancelar = só tira da OC e a nota continua no movimento fiscal.)`);
    post({ acao: "excluir", fiscalNotaId: n.id, excluirRegistro: tudo, quem: nomeUser(user) }, (x) => `NF ${n.numero} retirada da OC${tudo ? ` e excluída do movimento fiscal${x.contas ? ` (${x.contas} conta(s) na lixeira)` : ""}` : ""}.`);
  }
  const crit = conf?.criticas || [];
  const corrigiveis = crit.filter((c) => ["QTD", "VALOR", "PRAZO", "TOTAL"].includes(c.tipo));
  const cnpjs = crit.filter((c) => c.tipo === "CNPJ");
  return (
    <div className="mt-3 rounded-lg p-3" style={{ border: `${arr ? 2 : 1}px dashed ${arr ? C.accent : C.line}`, background: arr ? C.accentSoft : C.panel }}
      onDragOver={(e) => { e.preventDefault(); setArr(true); }} onDragLeave={() => setArr(false)} onDrop={(e) => { e.preventDefault(); setArr(false); if (e.dataTransfer.files?.length) setImp([...e.dataTransfer.files]); }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: C.navy }}>Notas fiscais do fornecedor</span>
        <button onClick={() => setImp([])} className="text-xs px-2.5 py-1 rounded-md font-semibold" style={{ background: C.accent, color: "#fff" }}>+ Subir NF (XML / PDF)</button>
        <span className="text-[11px]" style={{ color: C.sub }}>ou arraste os arquivos aqui · a nota entra no movimento fiscal e em Dados › Notas fiscais e você lança as contas</span>
      </div>
      {nfs.map((n) => (
        <div key={n.id} className="flex flex-wrap items-center gap-2 mt-2 text-xs px-2 py-1.5 rounded" style={{ background: C.panel2 }}>
          <b style={{ color: C.navy }}>NF {n.numero}</b><span style={{ color: C.sub }}>{dBR(n.emissao)} · {brl(n.valor)} · {n.parceiro}</span>
          {n.temXml ? <a href={`/api/compras/oc/nf?id=${n.id}&arq=xml`} target="_blank" rel="noreferrer" style={{ color: C.blue }}>XML</a> : <span style={{ color: C.sub }}>sem XML</span>}
          {n.temPdf ? <a href={`/api/compras/oc/nf?id=${n.id}&arq=pdf`} target="_blank" rel="noreferrer" style={{ color: C.red }}>PDF</a> : <span style={{ color: C.sub }}>sem PDF</span>}
          <Chip cor={n.contas ? C.green : C.yellow} fundo={n.contas ? C.greenSoft : C.yellowSoft}>{n.contas ? `${n.contas} conta(s) lançada(s)` : n.acao === "LANCADA" ? "lançada" : "sem contas"}</Chip>
          <button onClick={() => excluir(n)} className="ml-auto flex items-center gap-1" style={{ color: C.red }}><X size={12} /> excluir</button>
        </div>
      ))}
      {nfs.length > 0 && o.formaRecebimento && o.formaRecebimento !== "COLETA" && (   // v497 — previsão informada junto com a NF
        <label className="flex items-center gap-2 mt-2 text-xs" style={{ color: C.sub }}>Previsão de chegada{o.formaRecebimento === "TRANSPORTADORA" ? " (transportadora)" : ""}:
          <input type="date" defaultValue={o.previsaoEntrega || o.entrega?.previsao || ""} onChange={(e) => post({ acao: "previsao", previsaoEntrega: e.target.value || null })} className="px-2 py-0.5 rounded text-xs" style={{ border: `1px solid ${o.previsaoEntrega ? C.green : C.accent}`, color: C.text }} />
          {!o.previsaoEntrega && <span style={{ color: C.accent }}>informe a data que o fornecedor/transportadora passou</span>}
        </label>
      )}
      {conf && !conf.error && nfs.length > 0 && (
        <div className="mt-2 rounded p-2" style={{ background: crit.length ? C.redSoft : C.greenSoft }}>
          {!crit.length ? <div className="text-xs font-semibold flex items-center gap-1" style={{ color: C.green }}><CheckCircle2 size={13} /> NF confere com a OC: itens, quantidades, valores, prazo e CNPJ.</div> : <>
            <div className="text-xs font-bold mb-1 flex items-center gap-1" style={{ color: C.red }}><AlertTriangle size={13} /> {crit.length} crítica(s) na conferência NF × OC</div>
            {crit.map((c, k) => (
              <div key={k} className="text-xs flex items-center gap-2 py-0.5" style={{ color: C.red }}>
                <span>• {c.texto}</span>
                {c.tipo === "CNPJ" && <button disabled={oc2} onClick={() => post({ acao: "aceitarCnpj", cnpj: c.cnpj, razao: c.emitente }, (x) => (x.cadastro ? `CNPJ ${c.cnpj} incluído no cadastro do fornecedor.` : `CNPJ ${c.cnpj} (de outro fornecedor no cadastro) aceito para esta OC.`))} className="px-2 py-0.5 rounded font-semibold" style={{ background: "#fff", border: `1px solid ${C.red}` }}>aceitar este CNPJ</button>}
              </div>
            ))}
            {corrigiveis.length > 0 && <div className="flex flex-wrap items-center gap-2 mt-2">
              <button disabled={oc2} onClick={async () => { if (await confirmar("Corrigir a OC com as quantidades, valores e prazo da NF? A cotação de origem também é atualizada.")) post({ acao: "corrigir", condicao: crit.find((c) => c.tipo === "PRAZO")?.condNf ? (crit.find((c) => c.tipo === "PRAZO").condNf === "À VISTA" ? "À VISTA" : `${crit.find((c) => c.tipo === "PRAZO").condNf} DIAS`) : undefined }, (x) => `OC corrigida pela NF (${x.itens} item(ns)).`); }}
                className="text-xs px-3 py-1 rounded-md font-semibold" style={{ background: C.red, color: "#fff" }}>Corrigir a OC pela NF</button>
              <span className="text-[11px]" style={{ color: C.sub }}>ou ajuste os itens acima à mão e salve.</span>
            </div>}
          </>}
        </div>
      )}
      {imp && <ImportarNfs user={user} iniciais={imp} ocId={o.id} onClose={() => setImp(null)} onFim={(m) => { setImp(null); onMudou(); if (m) alerta(`${m} A NF foi ligada à ${o.numero}; confira as críticas abaixo.`); }} />}
    </div>
  );
}
