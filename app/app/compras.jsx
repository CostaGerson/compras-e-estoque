"use client";
// v404 — Compras: pedidos do KM desmembrados em itens → FPP base → demanda de matéria-prima → Levantamento
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, X, Search, FileText, Link2, Unlink, RefreshCw, Layers, Merge, PackageSearch, AlertTriangle, Boxes, CheckCircle2, ShoppingCart, KeyRound, Copy, Undo2, ClipboardList, PackageCheck } from "lucide-react";

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
const nomeUser = (u) => `${u?.nome || ""} ${u?.sobrenome || ""}`.trim();
const detArtigo = (d) => [d.fornecedor, d.cor, d.codigo, d.largura ? `${String(d.largura).replace(".", ",")} m` : null].filter(Boolean).join(" · ");

const STATUS = {
  LEVANTAMENTO: ["No levantamento", C.blue, C.blueSoft], ESTOQUE: ["Atendido pelo estoque · liberado p/ PCP", C.green, C.greenSoft],
  PIC: ["Em PIC", C.accent, C.accentSoft], OC: ["OC emitida", C.accent, C.accentSoft], NF: ["NF emitida", C.yellow, C.yellowSoft], ENTREGUE: ["Entregue · liberado p/ PCP", C.green, C.greenSoft],
};
function Chip({ cor = C.sub, fundo = C.panel2, children, title }) {
  return <span title={title} className="text-[11px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: fundo, color: cor, border: `1px solid ${cor}33` }}>{children}</span>;
}
function Modal({ titulo, onClose, children, largo }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`rounded-lg w-full ${largo ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] flex flex-col`} style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="text-sm font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onClose}><X size={18} style={{ color: C.sub }} /></button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

// ---------- FPP resumida (janela central) ----------
function FppResumo({ fppId, item, veValores, onClose, onUsar, usando }) {
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
  ["comprasPedidos", "Pedidos", ClipboardList], ["levantamento", "Levantamento", Layers], ["comprasCruzamento", "Cruzamento com estoque", Boxes],
  ["comprasAtendidos", "Atendidos pelo estoque", PackageCheck], ["pic", "PIC diário", ClipboardList], ["oc", "Ordens de compra", ShoppingCart],
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
    if (!r.ok) return alert(x.error || "Não foi possível vincular.");
    setResumo(null); carregar();
  }
  async function desvincular(p, it) {
    if (!confirm(`Tirar a FPP do item ${it.codigo || it.chave}? A demanda sai do levantamento.`)) return;
    const r = await fetch("/api/compras/itens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero, chave: it.chave }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return alert(x.error || "Erro.");
    carregar();
  }

  const lista = useMemo(() => {
    if (!d) return [];
    const t = norm(q).split(/\s+/).filter(Boolean);
    return d.pedidos.filter((p) => {
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
    <div className="max-w-5xl">
      <FasesCompras atual="comprasPedidos" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Cada item do pedido precisa de uma FPP base. Ao escolher a FPP, a demanda de matéria-prima do item vai para o <b>Levantamento</b>.</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[["pendentes", `Sem FPP (${nPend})`], ["completos", "Com FPP em todos os itens"], ["todos", `Todos (${d.pedidos.length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: filtro === k ? C.accent : C.panel, color: filtro === k ? "#fff" : C.sub, border: `1px solid ${filtro === k ? C.accent : C.line}` }}>{l}</button>
        ))}
        <div className="flex items-center gap-2 px-2 rounded ml-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente, item…" className="py-1.5 text-sm outline-none w-56" />
        </div>
        <button onClick={carregar} title="Atualizar" className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>

      {!lista.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum pedido neste filtro.</div>}
      {lista.map((p) => {
        const ab = aberto[p.numero] ?? (lista.length <= 3);
        const ok = p.comFpp >= p.total;
        return (
          <div key={p.numero} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <button onClick={() => setAberto((s) => ({ ...s, [p.numero]: !ab }))} className="w-full flex items-center gap-3 px-4 py-3 text-left">
              {ab ? <ChevronDown size={16} style={{ color: C.sub }} /> : <ChevronRight size={16} style={{ color: C.sub }} />}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: C.navy }}>Pedido {p.numero} · {p.cliente}{p.interno && <span className="ml-2"><Chip>interno</Chip></span>}</div>
                <div className="text-xs" style={{ color: C.sub }}>Entrega {dBR(p.entrega)} · emitido {dBR(p.emissao)}{p.situacaoPcp ? ` · PCP: ${p.situacaoPcp}` : ""}</div>
              </div>
              <Chip cor={ok ? C.green : C.accent} fundo={ok ? C.greenSoft : C.accentSoft}>{p.comFpp}/{p.total} itens com FPP</Chip>
            </button>
            {ab && (
              <div className="px-4 pb-3 space-y-2">
                {p.itens.map((it) => <ItemCard key={it.chave} p={p} it={it} veValores={veValores}
                  onVer={(fppId) => setResumo({ fppId, item: it, pedido: p, so: true })}
                  onSugestao={(fppId) => setResumo({ fppId, item: it, pedido: p })}
                  onBuscar={() => setBusca({ item: it, pedido: p })}
                  onDesvincular={() => desvincular(p, it)} />)}
              </div>
            )}
          </div>
        );
      })}

      {resumo && <FppResumo fppId={resumo.fppId} item={resumo.item} veValores={veValores} onClose={() => setResumo(null)} onUsar={resumo.so ? null : usar} usando={usando} />}
      {busca && <BuscarFpp cliente={busca.pedido.cliente} onClose={() => setBusca(null)} onEscolher={(id) => { setResumo({ fppId: id, item: busca.item, pedido: busca.pedido }); setBusca(null); }} />}
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
export function Levantamento({ user, veValores, fases, ir, fase }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState(fase === "cruzamento" ? "cruzamento" : "consolidado");
  const [salvando, setSalvando] = useState(false);
  const [marc, setMarc] = useState(new Set());   // v415 — itens marcados para devolver a Pedidos
  const tog = (id) => setMarc((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function devolver() {
    if (!confirm(`Devolver ${marc.size} item(ns) para Pedidos? A FPP base é desvinculada e a demanda sai do levantamento.`)) return;
    setSalvando(true);
    try { await devolverItens([...marc], "pedidos"); setMarc(new Set()); carregar(); } catch (e) { alert(e.message); }
    setSalvando(false);
  }
  const carregar = () => fetch("/api/compras/levantamento").then(async (r) => { const x = await r.json(); if (!r.ok) throw new Error(x.error || "erro"); setD(x); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  async function equiparar(de, para) {
    setSalvando(true);
    const r = await fetch("/api/compras/levantamento", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ de, para }) });
    setSalvando(false);
    if (!r.ok) { const x = await r.json().catch(() => ({})); return alert(x.error || "Erro."); }
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
  if (fase === "cruzamento") return <div className="max-w-5xl">{barra}<Cruzamento user={user} veValores={veValores} onMudou={carregar} /></div>;
  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="max-w-5xl">{barra}<div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando levantamento…</div></div>;

  const Kpi = ({ l, v }) => <div className="rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}><div className="text-xs" style={{ color: C.sub }}>{l}</div><div className="text-xl font-bold" style={{ color: C.navy }}>{v}</div></div>;
  return (
    <div className="max-w-5xl">
      {barra}
      <p className="text-sm mb-3" style={{ color: C.sub }}>Todas as demandas de matéria-prima registradas nos itens dos pedidos, aguardando o cruzamento com o estoque.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi l="Pedidos" v={d.pedidos} /><Kpi l="Itens" v={d.itens} /><Kpi l="Artigos" v={d.consolidado.length} /><Kpi l="Equiparações sugeridas" v={d.equiparacoes.length} />
      </div>
      <div className="flex gap-1 mb-3 items-center" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["consolidado", "Demanda consolidada", Layers], ["equiparacoes", `Equiparações${d.equiparacoes.length ? ` (${d.equiparacoes.length})` : ""}`, Merge], ["itens", "Demandas por item", PackageSearch]].map(([k, t, Ico]) => (
          <button key={k} onClick={() => setAba(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium" style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}><Ico size={15} /> {t}</button>
        ))}
        <button onClick={() => (ir ? ir("comprasCruzamento") : setAba("cruzamento"))} disabled={!d.linhas.length} title="Cruza com o saldo de estoque (menos reservas) e sugere os atendimentos" className="ml-auto mb-1 px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: aba === "cruzamento" ? C.navy : C.accent, color: "#fff", opacity: d.linhas.length ? 1 : 0.5 }}><Boxes size={14} /> Cruzar com estoque</button>
      </div>
      {aba === "cruzamento" && <Cruzamento user={user} veValores={veValores} onMudou={carregar} />}

      {aba !== "cruzamento" && !d.linhas.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma demanda no levantamento. Vincule a FPP base nos itens em Compras › Pedidos.</div>}

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
            Pedido {p.numero} · {p.cliente} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
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
    if (!confirm(`Devolver ${marc.size} item(ns) para o levantamento? A reserva do estoque é desfeita.`)) return;
    setOcupado(true);
    try { await devolverItens([...marc], "levantamento"); setMarc(new Set()); carregar(); } catch (e) { alert(e.message); }
    setOcupado(false);
  }
  const porPedido = useMemo(() => {
    const m = {};
    for (const i of d || []) (m[i.pedidoNumero] ||= { numero: i.pedidoNumero, cliente: i.cliente, entrega: i.entrega, itens: [] }).itens.push(i);
    return Object.values(m);
  }, [d]);
  return (
    <div className="max-w-5xl">
      <FasesCompras atual="comprasAtendidos" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Itens autorizados para atender pelo estoque. Enquanto o material não seguiu para a produção, dá para devolver ao levantamento.</p>
      {erro && <div className="text-sm" style={{ color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {d && !d.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum item atendido pelo estoque.</div>}
      {porPedido.map((p) => (
        <div key={p.numero} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2 text-sm font-semibold" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>Pedido {p.numero} · {p.cliente} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
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
function Cruzamento({ user, veValores, onMudou }) {
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
    if (!confirm(`Autorizar o atendimento pelo estoque de ${marc.size} item(ns)? Eles ficam liberados para o PCP programar.`)) return;
    setSalvando(true);
    const r = await fetch("/api/compras/cruzar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds: [...marc], quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return alert(x.error || "Erro.");
    onMudou?.(); carregar();
  }
  if (erro) return <div className="text-sm" style={{ color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm py-4" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Cruzando com o estoque…</div>;
  const SIT = { COMPLETO: [C.green, C.greenSoft, "atendido completo"], PARCIAL: [C.yellow, C.yellowSoft, "parcial"], COMPRA: [C.accent, C.accentSoft, "vai para compra"], "SEM DEMANDA": [C.sub, C.panel2, "sem demanda"] };
  const nCompra = d.pedidos.flatMap((p) => p.itens).filter((i) => !i.atendido && !i.semDemanda).length;
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
              <div className="flex-1 text-sm font-semibold" style={{ color: C.navy }}>Pedido {p.numero} · {p.cliente} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span></div>
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
            </div>
            {p.itens.map((i) => (
              <label key={i.id} className="flex items-start gap-3 px-4 py-2 text-xs cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}>
                <input type="checkbox" disabled={i.semDemanda} checked={marc.has(i.id)} onChange={() => tog(i.id)} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm" style={{ color: C.text }}>{i.chave} · {i.descricao} <span className="text-xs" style={{ color: C.sub }}>({i.quantidade} pç · FPP {fmtFpp(i.fppNumero)})</span></div>
                  <div style={{ color: C.sub }}>{i.demanda.map((x) => `${x.nome}${x.cor ? ` ${x.cor}` : ""} ${qtdU(x.quantidade, x.unidade)}`).join(" · ")}</div>
                </div>
                {!i.semDemanda && (i.atendido ? <Chip cor={C.green} fundo={C.greenSoft}>estoque</Chip> : <Chip cor={C.accent} fundo={C.accentSoft}>compra</Chip>)}
              </label>
            ))}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 sticky bottom-0 py-3" style={{ background: "#F7F8FA" }}>
        <button disabled={salvando || !marc.size} onClick={autorizar} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.green, color: "#fff", opacity: marc.size ? 1 : 0.5 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Autorizar atendimento pelo estoque ({marc.size})
        </button>
        <button disabled title="Próxima versão: junta os artigos iguais dos itens não atendidos e agrupa por fornecedor" className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}`, cursor: "not-allowed" }}>
          <ShoppingCart size={15} /> Gerar PIC ({nCompra} itens) · em breve
        </button>
        <button disabled={salvando || !marc.size} onClick={async () => {
          if (!confirm(`Devolver ${marc.size} item(ns) para Pedidos? A FPP base é desvinculada e a demanda sai do levantamento.`)) return;
          setSalvando(true);
          try { await devolverItens([...marc], "pedidos"); onMudou?.(); carregar(); } catch (e) { alert(e.message); }
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
