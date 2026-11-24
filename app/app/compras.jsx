"use client";
// v404 — Compras: pedidos do KM desmembrados em itens → FPP base → demanda de matéria-prima → Levantamento
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, X, Search, FileText, Link2, Unlink, RefreshCw, Layers, Merge, PackageSearch, AlertTriangle, Boxes, CheckCircle2, ShoppingCart, KeyRound, Copy, Undo2, ClipboardList, PackageCheck, Paperclip, ImagePlus, Trash2, Send, Clock, MessageSquare } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import DocsOrigem from "./docsOrigem";   // v1089 — OP · PV · FPP do pedido de origem
import { desenharOc } from "./ocImagem";   // v1068 — OC em PNG para enviar
import { ImportarNfs } from "./adm";   // v494 — NF subida pela OC passa pelo mesmo lançamento do movimento fiscal   // v424 — popups do sistema

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const fmtFpp = (n) => (n ? String(n).padStart(5, "0") : "—");
const brl = (v) => (v == null ? "—" : `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const brlU = (v) => (v == null ? "—" : `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(Number(v)) < 1 ? 6 : 4 })}`);   // v1070 — valor unitário com as casas que tiver (0,044375)
const qtdU = (v, u) => `${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: u === "UN" ? 0 : 2, maximumFractionDigits: u === "UN" ? 0 : 2 })} ${String(u || "").toLowerCase()}`;
// v405 — botão: unidades + grosas inteiras (144)
const qtdG = (v, u, emb) => (emb ? `${qtdU(v, u)} · ${Math.ceil((Number(v) || 0) / emb - 1e-9)} grosa(s)` : qtdU(v, u));
const tipoMat = (m) => (m.papel === "FORRO" ? "forro" : m.categoria === "MALHA" ? "malha" : m.categoria === "AVIAMENTO" ? "aviamento" : "tecido");
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const rotPed = (n, cli) => (/^AV\d+$/.test(String(n || "")) ? `Compra avulsa · ${cli || ""}` : `Pedido ${n} · ${cli || ""}`);   // v419
const nomeUser = (u) => `${u?.nome || ""} ${u?.sobrenome || ""}`.trim();
const semAcento = (x) => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();   // v734
// v524 — pedido e cliente de cada demanda (cabe no iPad: quebra em linhas)
function Origens({ l, unidade }) {
  if (!l?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {l.map((o) => { const av = /^AV\d+$/.test(String(o.pedido)); const Tag = av ? "span" : "a";   // v871 — clicar no pedido abre ele em nova guia
        return (
        <Tag key={o.pedido} {...(av ? {} : { href: `/?v=pedido&numero=${encodeURIComponent(o.pedido)}`, target: "_blank", rel: "noopener", title: "Abrir o pedido em nova guia", onClick: (e) => e.stopPropagation() })}
          className={`text-[11px] px-1.5 py-0.5 rounded ${av ? "" : "hover:underline cursor-pointer"}`} style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
          <b>{av ? "Avulsa" : o.pedido}</b>{o.cliente ? ` · ${String(o.cliente).replace(/^AVULSA\s+/i, "")}` : ""}{l.length > 1 ? <span style={{ color: C.sub }}> · {qtdU(o.quantidade, unidade)}</span> : null}
        </Tag>); })}
    </div>
  );
}
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

// v1002 — guias no padrão do Financeiro (texto + ícone, sublinhado laranja na ativa)
function Guias({ abas, atual, onChange, direita }) {
  return (
    <div className="flex items-center gap-1 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
      {abas.map(([k, t, I]) => { const ativo = atual === k; return (
        <button key={k} onClick={() => onChange(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          style={{ color: ativo ? C.accent : C.sub, borderBottom: ativo ? `2px solid ${C.accent}` : "2px solid transparent", marginBottom: -1 }}>
          {I && <I size={15} />} {t}
        </button>); })}
      {direita && <div className="ml-auto flex items-center gap-2 pb-1">{direita}</div>}
    </div>
  );
}
// v999 — PIC, cotação e OC: nº do pedido sempre com o nome do cliente
const rotOrigem = (x) => `Ped. ${x.pedido}${x.cliente ? ` · ${String(x.cliente).trim()}` : ""}`;
// v913 — dispensar compras em qualquer fase (PIC, cotação, OC): escolhe os pedidos/linhas de origem da demanda
// v1072 — OC aberta (ainda não enviada) do mesmo fornecedor: pergunta se junta nela em vez de abrir outra OC
async function perguntarJuntarOc(fornIds) {
  const ids = [...new Set((fornIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return {};
  const l = await fetch("/api/compras/oc").then((r) => r.json()).catch(() => []);
  const out = {};
  for (const fid of ids) {
    const o = (Array.isArray(l) ? l : []).filter((x) => x.status === "ABERTA" && Number(x.fornecedorId ?? x.fornecedor?.id) === fid).sort((a, b) => b.id - a.id)[0];
    if (o && (await confirmar(`${o.fornecedor?.nome || "O fornecedor"} já tem a ${o.numero} aberta (ainda não enviada, ${o.itens.length} item(ns), ${brl(o.total)}).\n\nJuntar os itens novos nela, numa OC só?`))) out[fid] = o.id;
  }
  return out;
}
export function BotaoDispensar({ origens, user, onFeito, rotulo = "Dispensar", artigo }) {   // v1058 — artigo: { id, nome } → dispensa só este artigo
  const [ab, setAb] = useState(false);
  const soArt = true;   // v1071 — dispensa sempre só do artigo (nunca o item inteiro)
  const [marc, setMarc] = useState(new Set());
  const [motivo, setMotivo] = useState("");
  const [ocup, setOcup] = useState(false);
  const l = (origens || []).filter((o) => o && o.pedido && o.chave && (artigo?.id || o.avulsa));   // v1071 — sem artigo, só a linha de compra avulsa
  if (!l.length) return null;
  const k = (o) => `${o.pedido}|${o.chave}`;
  async function ir() {
    const alvo = l.filter((o) => marc.has(k(o)));
    if (!alvo.length) return alerta("Marque o que vai ser dispensado.");
    setOcup(true);
    const erros = [], trav = new Set();
    for (const o of alvo) {
      const r = await fetch("/api/compras/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: o.pedido, chave: o.chave, ...(artigo?.id && soArt ? { artigoId: artigo.id } : {}), motivo: motivo || null, quem: nomeUser(user) }) }).catch(() => null);
      const x = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok) erros.push(`${o.pedido} ${ch(o.chave)}${x.error ? ` (${x.error})` : !r ? " (sem conexão)" : ` (erro ${r.status})`}`); else (x.travadas || []).forEach((t) => trav.add(t));
    }
    setOcup(false); setAb(false); setMarc(new Set()); setMotivo("");
    if (erros.length) await alerta(`Não consegui dispensar: ${erros.join(", ")}`);
    if (trav.size) await alerta(`Dispensado. A ${[...trav].join(", ")} já foi enviada ao fornecedor e não mudou: o material que chegar vai para o estoque.`);
    onFeito && onFeito();
  }
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setMarc(new Set(l.length === 1 ? [k(l[0])] : [])); setAb(true); }} title="Dispensar compras: tirar esta demanda de compras (o item do pedido vai para o PCP sem compra de material)"
        aria-label={rotulo} className="inline-flex items-center justify-center rounded-full text-[11px] font-black shrink-0 align-middle" style={{ width: 20, height: 20, background: "#F5B700", color: "#fff" }}>D</button>   {/* v998 — sempre um "D" amarelo */}
      {ab && (
        <Modal titulo="Dispensar compras" onClose={() => setAb(false)}>
          {artigo?.id ? <div className="rounded-md p-2 mb-2 text-sm" style={{ background: C.panel2 }}><b>Só {artigo.nome || "este artigo"}</b> <span className="text-xs" style={{ color: C.sub }}>— os outros materiais do item continuam em compras</span></div> : null}   {/* v1071 */}
          <div className="text-xs mb-2" style={{ color: C.sub }}>{artigo?.id && soArt ? "Só este artigo sai da demanda dos itens marcados (em qualquer fase: levantamento, PIC, cotação e OC ainda não enviada). Se não sobrar nenhum material no item, ele sai de compras inteiro." : "A demanda sai de compras em qualquer fase (levantamento, PIC, cotação e OC ainda não enviada). Item de pedido vai para o PCP; linha de compra avulsa é cancelada."}</div>
          {l.map((o) => (
            <label key={k(o)} className="flex items-center gap-2 py-1.5 text-sm cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, color: C.text }}>
              <input type="checkbox" checked={marc.has(k(o))} onChange={() => setMarc((m) => { const n = new Set(m); n.has(k(o)) ? n.delete(k(o)) : n.add(k(o)); return n; })} />
              <span className="flex-1">{o.avulsa ? `Compra avulsa ${String(o.cliente || "").replace(/^AVULSA\s+/i, "").split("·")[0].trim() || o.pedido}` : `Pedido ${o.pedido}`} · {ch(o.chave)}{o.cliente && !o.avulsa ? <span style={{ color: C.sub }}> · {o.cliente}</span> : null}</span>
              {o.quantidade != null && <span className="text-xs" style={{ color: C.sub }}>{String(o.quantidade).replace(".", ",")}</span>}
            </label>
          ))}
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="w-full mt-3 px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.line}` }} />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setAb(false)} className="px-3 py-1.5 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Voltar</button>
            <button disabled={ocup} onClick={ir} className="px-3 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}>{ocup && <Loader2 size={14} className="animate-spin" />}Dispensar ({marc.size})</button>
          </div>
        </Modal>
      )}
    </>
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
  ["comprasPedidos", "Sincronização de pedidos", ClipboardList], ["levantamento", "Levantamento", Layers],   // v483 — cruzamento e atendidos dentro do Levantamento
  ["pic", "PIC diário", ClipboardList], ["comprasCotacoes", "Cotações", FileText], ["oc", "Ordens de compra", ShoppingCart], ["devolucoes", "Devoluções", Undo2],   // v1086
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
function BarraDevolver({ n, rotulo, onDevolver, onLimpar, ocupado, onExcluir, onDispensar }) {
  if (!n) return null;
  return (
    <div className="flex items-center gap-2 sticky bottom-0 py-3 z-10" style={{ background: "#F7F8FA" }}>
      <button disabled={ocupado} onClick={onDevolver} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel, color: C.red, border: `1px solid ${C.red}` }}>
        {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />} {rotulo} ({n})
      </button>
      {onDispensar && <button disabled={ocupado} onClick={onDispensar} title="O item sai de compras e do levantamento e vai para o PCP sem compra de material" className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2" style={{ background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Dispensar compras ({n})</button>}
      {onExcluir && <button disabled={ocupado} onClick={onExcluir} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 text-white" style={{ background: C.red }}><Trash2 size={15} /> Excluir demanda ({n})</button>}
      <button onClick={onLimpar} className="text-xs" style={{ color: C.sub }}>limpar seleção</button>
    </div>
  );
}
// v685 — "ITEM1" → "ITEM 1"
const ch = (c) => String(c || "").replace(/^ITEM(\d)/i, "ITEM $1");
// v685 — excluir demanda em qualquer etapa / gerar de novo as demandas de um pedido
const ETAPA = { LEVANTAMENTO: "levantamento", ESTOQUE: "atendida pelo estoque", PIC: "no PIC", OC: "em ordem de compra", NF: "com NF", ENTREGUE: "entregue" };
export async function excluirDemandas(ids, user, rotulo) {
  if (!ids.length) return false;
  // v734 — justificativa obrigatória: vai para as mensagens de quem incluiu a demanda
  let just = "";
  for (;;) {
    const r0 = await perguntar(`Excluir ${rotulo || `${ids.length} demanda(s) de compra`}? Sai de onde estiver (levantamento, estoque, PIC ou OC) e não volta sozinha.\n\nJustificativa (vai para as mensagens de quem incluiu a demanda):`, just);
    if (r0 == null) return false;
    just = String(r0).trim();
    if (just.length >= 3) break;
    await alerta("Escreva a justificativa da exclusão.");
  }
  const r = await fetch("/api/compras/itens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, excluir: true, quem: nomeUser(user), usuarioId: user?.id, justificativa: just }) });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) { await alerta(x.error || "Erro ao excluir."); return false; }
  return true;
}
export async function regerarDemandas(numero, user) {
  if (!(await confirmar(`Gerar de novo as demandas de compra do pedido ${numero}? As demandas atuais (em qualquer etapa) são apagadas e recriadas no levantamento pela FPP de cada item.`))) return false;
  const r = await fetch("/api/compras/regerar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: numero, quem: nomeUser(user) }) });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) { await alerta(x.error || "Erro."); return false; }
  await alerta(`${x.gerados} demanda(s) gerada(s) no levantamento${x.apagados ? ` (${x.apagados} anterior(es) apagada(s))` : ""}.${x.semFpp?.length ? `\nSem FPP (vincule em Compras › Pedidos): ${x.semFpp.map(ch).join(", ")}` : ""}`);
  return true;
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
  // v612 — confirma de uma vez as FPPs indexadas no lançamento do pedido → itens vão para o levantamento
  async function confirmarIndicadas(p, its) {
    if (!(await confirmar(`Confirmar a FPP do lançamento em ${its.length} item(ns) do pedido ${p.numero}? A demanda de matéria-prima vai para o Levantamento.`))) return;
    setUsando(true);
    const erros = [];
    for (const it of its) {
      const r = await fetch("/api/compras/itens", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoNumero: p.numero, chave: it.chave, fppId: it.sugestoes[0].id, quem: nomeUser(user) }) });
      if (!r.ok) { const x = await r.json().catch(() => ({})); erros.push(`${it.codigo || it.chave}: ${x.error || "erro"}`); }
    }
    setUsando(false);
    if (erros.length) alerta(`Não foi possível confirmar:\n${erros.join("\n")}`);
    carregar();
  }
  async function dispensar(p) {   // v419 — pedido só para faturamento
    const motivo = (await perguntar(`Dispensar compras do pedido ${p.numero} (${p.cliente})?\nEle sai de compras em qualquer etapa (levantamento, PIC, OC) e vai para o PCP. Linhas do PIC ainda sem OC são retiradas; OC já emitida não muda.\n\nMotivo (opcional):`, "Só para faturamento"));
    if (motivo === null) return;
    const r = await fetch("/api/compras/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero, motivo, quem: nomeUser(user) }) });
    if (!r.ok) return alerta("Erro ao dispensar.");
    carregar();
  }
  // v862 — dispensar compras de um item só (o resto do pedido segue em compras)
  async function dispensarItem(p, it) {
    const st = it.vinculo?.status;   // v911 — em qualquer etapa
    const aviso = st === "PIC" ? "\nA parte dele sai do PIC (linhas ainda sem OC)." : ["OC", "NF"].includes(st) ? "\nA OC já emitida não muda: o material que chegar fica no estoque." : "";
    const motivo = await perguntar(`Dispensar compras do item ${it.codigo || ch(it.chave)} · ${it.descricao || ""} (pedido ${p.numero})?\nO item sai de compras e vai para o PCP; os outros itens seguem normais.${aviso}\n\nMotivo (opcional):`, "Material já disponível");
    if (motivo === null) return;
    const r = await fetch("/api/compras/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: p.numero, chave: it.chave, motivo, quem: nomeUser(user) }) });
    if (!r.ok) return alerta("Erro ao dispensar.");
    carregar();
  }
  async function reativarItem(x) {
    if (!(await confirmar(`Voltar o item ${x.codigo || ch(x.chave)} do pedido ${x.numero} para compras?`))) return;
    await fetch("/api/compras/pedidos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: x.numero, chave: x.chave }) });
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
      <p className="text-sm mb-3" style={{ color: C.sub }}>Todo pedido <b>lançado no sistema</b> entra aqui e sai quando os itens são liberados para programação (o PCP lê e recebe em A PROGRAMAR). Do KM: pedidos em <b>levantamento</b> ou <b>compras</b> no PCP. Cada item precisa de uma FPP base; ao escolher a FPP, a demanda de matéria-prima vai para o <b>Levantamento</b>.{d.emProducao ? ` ${d.emProducao} pedido(s) já programados, em produção ou concluídos no PCP não aparecem (matéria-prima já comprada).` : ""}</p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[["pendentes", `Sem FPP (${nPend})`], ["completos", "Com FPP em todos os itens"], ["todos", `Todos (${d.pedidos.length})`], ["fora", `Fora do PCP (${d.pedidos.filter((p) => p.fasePcp === "FORA").length})`], ["avulsas", "Compras avulsas"], ["dispensadas", `Compras dispensadas (${(d.dispensados || []).length + (d.dispensadosItens || []).length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-md text-sm font-medium" style={{ background: filtro === k ? C.accent : C.panel, color: filtro === k ? "#fff" : C.sub, border: `1px solid ${filtro === k ? C.accent : C.line}` }}>{l}</button>
        ))}
        <div className="flex items-center gap-2 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel, order: -1 }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pedido, cliente, item…" className="py-1.5 text-sm outline-none w-56" />
        </div>
        <button onClick={carregar} title="Atualizar" className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>

      {filtro === "avulsas" && <Avulsas user={user} />}
      {filtro === "dispensadas" && (
        <div>
          <div className="text-xs mb-2" style={{ color: C.sub }}>Pedidos lançados no KM só para faturamento: não entram em compras, levantamento nem cruzamento.</div>
          {!(d.dispensados || []).length && !(d.dispensadosItens || []).length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhum pedido dispensado.</div>}
          {/* v862 — itens dispensados um a um */}
          {(d.dispensadosItens || []).map((x) => (
            <div key={`${x.numero}|${x.chave}`} className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.navy }}>Pedido {x.numero} · item {x.codigo || ch(x.chave)} · {x.descricao}</div>
                <div className="text-xs" style={{ color: C.sub }}>{x.cliente} · {x.qtd} pç · entrega {dBR(x.entrega)}{x.motivo ? ` · ${x.motivo}` : ""} · dispensado {new Date(x.em).toLocaleDateString("pt-BR")}{x.porNome ? ` por ${x.porNome}` : ""}</div>
              </div>
              <button onClick={() => reativarItem(x)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.line}`, color: C.accent }}><Undo2 size={13} /> Voltar para compras</button>
            </div>
          ))}
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
        const sitPcp = (p) => (p.proprio ? "Compras" : p.fasePcp === "FORA" ? "Fora do PCP" : /PROGRAMAR/i.test(p.situacaoPcp || "") ? "A programar" : p.fasePcp === "COMPRAS" ? "Compras" : p.situacaoPcp || "—");
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
                        <td className="px-3 py-2 text-right whitespace-nowrap">{p.comFpp > 0 && <button onClick={async (e) => { e.stopPropagation(); if (await regerarDemandas(p.numero, user)) carregar(); }} title="Apaga e gera de novo as demandas de compra do pedido" className="text-xs px-2 py-1 rounded-md mr-1" style={{ border: `1px solid ${C.line}`, color: C.accent, background: C.panel }}><RefreshCw size={11} className="inline -mt-0.5" /> Gerar demandas</button>}<button onClick={(e) => { e.stopPropagation(); dispensar(p); }} title="Pedido só para faturamento: tira de compras o pedido inteiro (para um item só, abra o pedido)" className="text-xs px-2 py-1 rounded-md whitespace-nowrap" style={{ border: `1px solid ${C.line}`, color: C.sub, background: C.panel }}>Dispensar pedido inteiro</button></td>
                      </tr>
                      {ab && (
                        <tr><td colSpan={8} className="px-4 pb-3 pt-1" style={{ background: "#FCFCFD" }}>
                          {p.itensDisp ? <div className="text-[11px] mb-1" style={{ color: C.sub }}>{p.itensDisp} item(ns) com compras dispensadas (veja em Compras dispensadas).</div> : null}
                          {p.itensFora ? <div className="text-[11px] mb-1" style={{ color: C.sub }}>{p.itensFora} item(ns) {p.proprio ? "já liberado(s) para programação (com o PCP)" : "já programado(s) no PCP"} não aparecem.</div> : null}
                          {(() => { const ind = p.itens.filter((it) => !it.vinculo && it.sugestoes?.[0]?.indicada); return ind.length > 0 && (   // v612
                            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-md text-xs" style={{ background: C.accentSoft, color: C.text }}>
                              <span className="flex-1">{ind.length} item(ns) com <b>FPP indexada no lançamento</b>. Confira e confirme para irem ao levantamento.</span>
                              <button disabled={usando} onClick={() => confirmarIndicadas(p, ind)} className="px-3 py-1.5 rounded-md font-semibold text-white" style={{ background: C.accent }}>{usando ? "Enviando…" : `Confirmar FPPs do lançamento (${ind.length})`}</button>
                            </div>); })()}
                          <div className="space-y-2">
                            {p.itens.map((it) => <ItemCard key={it.chave} p={p} it={it} veValores={veValores}
                              onVer={(fppId) => setResumo({ fppId, item: it, pedido: p, so: true })}
                              onSugestao={(fppId) => setResumo({ fppId, item: it, pedido: p })}
                              onBuscar={() => setBusca({ item: it, pedido: p })}
                              onDesvincular={() => desvincular(p, it)}
                              onExcluir={!user?.isMaster ? undefined : async () => { if (await excluirDemandas([it.vinculo.id], user, `a demanda do item ${it.codigo || ch(it.chave)} (${ETAPA[it.vinculo.status] || it.vinculo.status})`)) carregar(); }} />)}
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
const ETAPA_AV = { LEVANTAMENTO: ["Pendente", "#3D6799", "#EEF3FB"], ESTOQUE: ["Atendido pelo estoque", C.green, C.greenSoft], REPROVADO: ["Vai para compra", C.red, C.redSoft],
  SEM_COTACAO: ["Aguardando cotação", "#B54708", "#FEF0C7"], EM_COTACAO: ["Em cotação", C.accent, C.accentSoft], AGUARDANDO_NF: ["Aguardando NF", C.yellow, C.yellowSoft], EM_COLETA: ["Em coleta", C.blue, C.blueSoft],
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
    // v515 — anexos escolhidos antes do 1º salvar sobem agora, com o id da avulsa
    const falhas = [];
    for (const a of ed.anexosPendentes || []) {
      const ra = await fetch(`/api/compras/avulsas/${x.id}/anexos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: a.nome, mime: a.mime, conteudo: a.conteudo, quem: nomeUser(user) }) });
      if (!ra.ok) falhas.push(a.nome);
    }
    if (falhas.length) alerta(`Não foi possível anexar: ${falhas.join(", ")}.`);
    setEd(null); carregar(); window.dispatchEvent(new Event("ce:avulsasMudou"));
  }
  const abrirEdicao = (c) => setEd({ ...c, itens: (c.itens || []).map((i) => ({ ...i, quantidade: Number(i.quantidade) ? String(i.quantidade).replace(".", ",") : "", ...((c.itens || []).some((x) => x && Object.prototype.hasOwnProperty.call(x, "pedidoRef")) ? { pedidoRef: i.pedidoRef || "", pedidoCliente: i.pedidoCliente || "" } : { pedidoRef: c.destino === "PEDIDO" ? c.pedidoRef || "" : "", pedidoCliente: c.destino === "PEDIDO" ? c.pedidoCliente || "" : "" }) })) });
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
  // v587 — clonar: abre uma avulsa nova já com os itens da original (sem nº, status, "bom para" nem recebimento)
  const clonar = (c) => { const base = c.itens ? c : ed; setEd({ numero: "", destino: base.destino || "OPERACAO", pedidoRef: base.pedidoRef || "", pedidoCliente: base.pedidoCliente || "", obs: base.obs || "", clonadaDe: base.numero || `#${base.id}`,
    itens: (base.itens || []).filter((i) => i && i.nome).map((i) => ({ nome: i.nome, quantidade: Number(i.quantidade) ? String(i.quantidade).replace(".", ",") : "", unidade: i.unidade || "UN", fornecedorId: i.fornecedorId || null, fornecedorNome: i.fornecedorNome || "",
      pedidoRef: i.pedidoRef ?? (base.destino === "PEDIDO" ? base.pedidoRef || "" : ""), pedidoCliente: i.pedidoCliente ?? (base.destino === "PEDIDO" ? base.pedidoCliente || "" : ""), bomPara: "", obs: i.obs || "" })) }); };
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
              {c._count?.anexos > 0 && <button onClick={() => abrirEdicao(c)} title="Ver anexos" className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.navy }}><Paperclip size={12} /> {c._count.anexos}</button>}   {/* v515 */}
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
              {c.status === "ABERTA" && <button onClick={() => status(c, "COMPRADA")} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.blue }}>marcar comprada</button>}
              {c.status === "COMPRADA" && <button onClick={() => status(c, "RECEBIDA")} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.green }}>marcar recebida</button>}
              {c.status !== "ABERTA" && <button onClick={() => status(c, c.status === "RECEBIDA" ? "COMPRADA" : "ABERTA")} title="Voltar para a fase anterior" className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.sub }}>voltar</button>}
              <button onClick={() => setEd({ ...c, itens: (c.itens || []).map((i) => ({ ...i, quantidade: Number(i.quantidade) ? String(i.quantidade).replace(".", ",") : "", ...((c.itens || []).some((x) => x && Object.prototype.hasOwnProperty.call(x, "pedidoRef")) ? { pedidoRef: i.pedidoRef || "", pedidoCliente: i.pedidoCliente || "" } : { pedidoRef: c.destino === "PEDIDO" ? c.pedidoRef || "" : "", pedidoCliente: c.destino === "PEDIDO" ? c.pedidoCliente || "" : "" }) })) })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.text }}>editar</button>
              <button onClick={() => clonar(c)} title="Criar uma nova compra avulsa com os mesmos itens" className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}`, color: C.text }}><Copy size={12} /> clonar</button>   {/* v587 */}
              <button onClick={() => status(c, "CANCELADA")} title="Cancelar" style={{ color: C.sub }}><X size={15} /></button>
            </div>
            {(c.itens || []).map((i, k) => (
              <div key={k} className="grid gap-3 px-4 py-2 text-sm items-center" style={{ gridTemplateColumns: "minmax(0,1fr) 100px 200px 150px 190px", borderTop: k ? `1px solid ${C.line}` : "none" }}>
                <div style={{ color: C.text }}>{i.nome}{i.obs ? <div className="text-[11px]" style={{ color: C.sub }}>{i.obs}</div> : null}</div>
                <div className="font-semibold" style={{ color: C.accent }}>{Number(i.quantidade) > 0 ? qtdU(i.quantidade, i.unidade) : <span title="O comprador define a quantidade no PIC" style={{ color: C.yellow }}>a definir</span>}</div>
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
        <Modal titulo={ed.id ? `Compra avulsa ${ed.numero || `#${ed.id}`}` : ed.clonadaDe ? `Nova compra avulsa · clonada da ${ed.clonadaDe} · o nº sai ao salvar` : "Nova compra avulsa · o nº sai ao salvar"} onClose={() => setEd(null)} largo="xl">
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
                <input value={i.quantidade ?? ""} onChange={(e) => setIt(k, "quantidade", e.target.value)} inputMode="decimal" placeholder="a definir" title="Em branco: o comprador define a quantidade" className="px-2 py-1.5 rounded text-sm" style={sel} />
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
          <AnexosAvulsa avulsaId={ed.id} pendentes={ed.anexosPendentes || []} setPendentes={(l) => setEd((e) => ({ ...e, anexosPendentes: l }))} quem={nomeUser(user)} onMudou={carregar} />   {/* v515 */}
          <div className="flex justify-end gap-2">
            {ed.id && <button onClick={async () => { await status(ed, "CANCELADA"); setEd(null); }} className="mr-auto px-3 py-2 rounded-md text-sm" style={{ color: C.red }}>Cancelar esta compra avulsa</button>}
            {ed.id && <button onClick={() => clonar(ed)} title="Criar uma nova compra avulsa com os mesmos itens" className="flex items-center gap-1 px-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }}><Copy size={14} /> Clonar</button>}   {/* v587 */}
            <button onClick={() => setEd(null)} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button>
            <button onClick={salvar} className="px-4 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------- v515 — anexos da compra avulsa (sugestão #20): escolher, arrastar ou colar (Ctrl+V) imagens/PDF ----------
const lerArquivo = (file) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = erro; r.readAsDataURL(file); });
function AnexosAvulsa({ avulsaId, pendentes, setPendentes, quem, onMudou }) {
  const [l, setL] = useState(avulsaId ? null : []);
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const inp = React.useRef(null);
  const base = avulsaId ? `/api/compras/avulsas/${avulsaId}/anexos` : null;
  const carregar = () => base && fetch(base).then((r) => r.json()).then((x) => setL(Array.isArray(x) ? x : [])).catch(() => setL([]));
  useEffect(() => { carregar(); }, [avulsaId]);
  async function adicionar(files) {
    const fs = [...(files || [])].filter(Boolean);
    if (!fs.length) return;
    const grandes = fs.filter((f) => f.size > 15 * 1024 * 1024);
    if (grandes.length) alerta(`Maior que 15 MB: ${grandes.map((f) => f.name).join(", ")}.`);
    const ok = fs.filter((f) => f.size <= 15 * 1024 * 1024);
    setEnviando(true);
    const novos = [];
    for (const f of ok) {
      const url = await lerArquivo(f).catch(() => null);
      if (!url) continue;
      const nome = f.name && f.name !== "image.png" ? f.name : `imagem-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`;
      novos.push({ nome, mime: f.type || null, conteudo: url.replace(/^data:[^,]*,/, ""), url, tamanho: f.size });
    }
    if (base) {
      const falhas = [];
      for (const a of novos) {
        const r = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: a.nome, mime: a.mime, conteudo: a.conteudo, quem }) });
        if (!r.ok) { const x = await r.json().catch(() => ({})); falhas.push(x.error || a.nome); }
      }
      if (falhas.length) alerta(falhas.join("\n"));
      carregar(); onMudou?.();
    } else setPendentes([...(pendentes || []), ...novos]);
    setEnviando(false);
  }
  async function excluir(a, k) {
    if (!(await confirmar(`Excluir o anexo ${a.nome}?`))) return;
    if (base) { await fetch(base, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ anexoId: a.id }) }); carregar(); onMudou?.(); }
    else setPendentes(pendentes.filter((_, j) => j !== k));
  }
  // Ctrl+V em qualquer ponto da janela cola o print como anexo
  useEffect(() => {
    const f = (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); adicionar(fs); } };
    window.addEventListener("paste", f); return () => window.removeEventListener("paste", f);
  });
  const todos = base ? (l || []).map((a) => ({ ...a, url: `${base}?anexo=${a.id}` })) : (pendentes || []);
  const ehImg = (a) => /^image\//.test(a.mime || "");
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: C.sub }}><Paperclip size={12} /> Anexos {todos.length ? `(${todos.length})` : ""}</div>
      <div onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={(e) => { e.preventDefault(); setSobre(false); adicionar(e.dataTransfer.files); }}
        className="rounded-lg p-3 flex flex-wrap gap-2 items-center" style={{ border: `1px dashed ${sobre ? C.accent : C.line}`, background: sobre ? C.accentSoft : C.panel2 }}>
        {todos.map((a, k) => (
          <div key={a.id || k} className="relative rounded-md overflow-hidden" style={{ width: 84, height: 84, background: "#fff", border: `1px solid ${C.line}` }} title={a.nome}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
              {ehImg(a) ? <img src={a.url} alt={a.nome} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1"><FileText size={22} style={{ color: C.navy }} /><span className="text-[9px] text-center leading-tight break-all" style={{ color: C.sub }}>{a.nome.slice(0, 28)}</span></div>}
            </a>
            <button onClick={() => excluir(a, k)} title="Excluir" className="absolute top-0.5 right-0.5 rounded p-0.5" style={{ background: "rgba(255,255,255,.9)", color: C.red }}><Trash2 size={12} /></button>
          </div>
        ))}
        <button onClick={() => inp.current?.click()} disabled={enviando} className="flex flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold"
          style={{ width: 84, height: 84, border: `1px solid ${C.line}`, background: "#fff", color: C.accent, opacity: enviando ? 0.6 : 1 }}>
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={20} />}{enviando ? "Enviando…" : "Anexar"}
        </button>
        <div className="text-[11px] flex-1" style={{ color: C.sub, minWidth: 160 }}>Escolha, arraste ou cole (Ctrl+V) imagens ou PDF da peça/material.{!base && todos.length ? " Sobem ao salvar." : ""}</div>
        <input ref={inp} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function ItemCard({ p, it, veValores, onVer, onSugestao, onBuscar, onDesvincular, onExcluir, onDispensar }) {
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
        {onDispensar && (!v || v.status !== "ENTREGUE") && <button onClick={onDispensar} title="Tira só este item de compras, em qualquer etapa (levantamento, PIC, OC): vai para o PCP sem compra de material" className="text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap" style={{ border: `1px solid ${C.line}`, color: C.sub, background: C.panel }}>Dispensar compras</button>}
      </div>
      {v ? (
        <div className="mt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onVer(v.fppId)} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded" style={{ background: C.panel, color: C.navy, border: `1px solid ${C.line}` }}>
              <FileText size={12} /> FPP {fmtFpp(v.fppNumero)}{v.fpp ? ` · ${v.fpp.nomeComercial || v.fpp.item}` : ""}
            </button>
            {v.status === "LEVANTAMENTO" && <button onClick={onBuscar} className="text-xs px-2 py-1 rounded" style={{ color: C.sub, border: `1px solid ${C.line}`, background: C.panel }}>trocar</button>}
            {v.status === "LEVANTAMENTO" && <button onClick={onDesvincular} title="Tirar a FPP" className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Unlink size={12} /></button>}
            {onExcluir && <button onClick={onExcluir} title="Excluir a demanda de compra (em qualquer etapa)" className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Trash2 size={12} /> excluir demanda</button>}
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
            <button key={s.id} onClick={() => onSugestao(s.id)} title={s.indicada ? "FPP indexada no lançamento do pedido" : `nome ${s.nome}% · valor ${s.valor}%`} className="text-xs px-2 py-1 rounded-md text-left" style={{ background: s.indicada ? C.accentSoft : C.panel, border: `1px solid ${s.indicada ? C.accent : C.accent + "55"}`, color: C.text }}>
              <b>FPP {fmtFpp(s.numero)}</b> · {s.nomeComercial || s.item}{veValores && s.valorProposto ? ` · ${brl(s.valorProposto)}` : ""}
              {s.indicada ? <span className="ml-1 font-semibold" style={{ color: C.accent }}>do lançamento</span> : <span className="ml-1 font-semibold" style={{ color: C.accent }}>{s.score}%</span>}
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
  // v872 — dispensar compras pelo levantamento (itens marcados; compra avulsa fica de fora)
  async function dispensarSel() {
    const alvo = [...new Map(d.linhas.filter((l) => marc.has(l.itemId)).map((l) => [`${l.pedidoNumero}|${l.chave}`, l])).values()];   // v913 — compra avulsa também (a linha é cancelada)
    if (!alvo.length) return;
    const motivo = await perguntar(`Dispensar compras de ${alvo.length} item(ns)?\n${alvo.map((l) => `• ${l.pedidoNumero} · ${ch(l.chave)} · ${l.descricao || ""}`).join("\n")}\n\nOs itens saem de compras e do levantamento e vão para o PCP; os outros itens dos pedidos seguem normais.\n\nMotivo (opcional):`, "Material já disponível");
    if (motivo === null) return;
    setSalvando(true);
    const erros = [];
    for (const l of alvo) {
      const r = await fetch("/api/compras/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pedidoNumero: l.pedidoNumero, chave: l.chave, motivo, quem: nomeUser(user) }) }).catch(() => null);
      if (!r?.ok) erros.push(`${l.pedidoNumero} · ${ch(l.chave)}`);
    }
    setSalvando(false); setMarc(new Set()); carregar();
    if (erros.length) alerta(`Não consegui dispensar: ${erros.join(", ")}`);
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
  // v734 — excluir demanda: master, ou quem lançou a compra avulsa (todas as marcadas têm de ser avulsas dele)
  const podeExcluirSel = useMemo(() => {
    if (user?.isMaster) return true;
    if (!d || !marc.size) return false;
    const eu = semAcento(nomeUser(user));
    const ped = Object.fromEntries(d.linhas.map((l) => [l.itemId, l.pedidoNumero]));
    return !!eu && [...marc].every((id) => /^AV\d+$/.test(ped[id] || "") && semAcento(d.autores?.[ped[id]]) === eu);
  }, [d, marc, user]);

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
      {aba === "atendidos" && <Atendidos user={user} />}   {/* v483 */}

      {!["cruzamento", "atendidos"].includes(aba) && !d.linhas.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma demanda no levantamento. Vincule a FPP base nos itens em Compras › Pedidos.</div>}

      {aba === "consolidado" && d.consolidado.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex px-4 py-2 text-xs font-semibold" style={{ color: C.sub, background: C.panel2 }}>
            <div className="flex-1">Artigo</div><div className="w-48">Fornecedor · cor · código</div><div className="w-28 text-right">Demanda</div><div className="w-24 text-right">Pedidos</div>{veValores && <div className="w-28 text-right">Estimado</div>}<div className="w-8" />
          </div>
          {d.consolidado.map((c) => (
            <div key={c.artigoId} className="flex px-4 py-2.5 text-sm items-center" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0"><b>{c.nome}</b> <span className="text-xs" style={{ color: C.sub }}>{c.categoria?.toLowerCase()}</span>
                {c.juntados.length > 0 && <div className="text-[11px]" style={{ color: C.green }}>+ juntou {c.juntados.map((j) => detArtigo(j) || "sem detalhe").join(", ")}</div>}
                <Origens l={c.origens} unidade={c.unidade} /></div>
              <div className="w-48 text-xs" style={{ color: detArtigo(c) ? C.sub : C.yellow }}>{detArtigo(c) || "sem detalhe"}</div>
              <div className="w-28 text-right font-bold" style={{ color: C.accent }}>{c.compra ? <>{c.compra} grosa(s)<div className="text-[11px] font-normal" style={{ color: C.sub }}>{qtdU(c.quantidade, c.unidade)} de {qtdU(c.compra * c.embalagem, c.unidade)}</div></> : qtdU(c.quantidade, c.unidade)}</div>
              <div className="w-24 text-right text-xs" style={{ color: C.sub }} title={c.pedidos.join(", ")}>{c.pedidos.length} ped · {c.itens} it</div>
              {veValores && <div className="w-28 text-right text-xs" style={{ color: C.sub }}>{c.valorEstimado ? brl(c.valorEstimado) : "—"}</div>}
              <div className="w-8 text-right">{(c.origensItens || []).length > 0 && <BotaoDispensar origens={c.origensItens} user={user} onFeito={carregar} rotulo="Dispensar compras" artigo={{ id: c.artigoId, nome: c.nome }} />}</div>   {/* v996 */}
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

      {aba === "itens" && d.linhas.length > 0 && <div className="text-xs mb-2" style={{ color: C.sub }}>Marque os itens para devolver a Pedidos (a FPP base é desvinculada), dispensar as compras (o item vai para o PCP sem compra) ou excluir a demanda (master ou quem lançou a compra avulsa, com justificativa).</div>}
      {aba === "itens" && porPedido.map((p) => (
        <div key={p.numero} className="rounded-lg mb-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="px-4 py-2 text-sm font-semibold flex items-center gap-2" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}>
            {(() => { const ids = [...new Set(p.linhas.map((l) => l.itemId))]; const todos = ids.every((x) => marc.has(x));
              return <input type="checkbox" checked={todos} title="Marcar o pedido inteiro" onChange={() => setMarc((s0) => { const n = new Set(s0); ids.forEach((x) => (todos ? n.delete(x) : n.add(x))); return n; })} />; })()}
            {rotPed(p.numero, p.cliente)} <span className="font-normal text-xs" style={{ color: C.sub }}>· entrega {dBR(p.entrega ? String(p.entrega).slice(0, 10) : null)}</span>
            {!/^AV\d+$/.test(p.numero) && <button onClick={async () => { if (await regerarDemandas(p.numero, user)) carregar(); }} title="Apaga e gera de novo as demandas do pedido pela FPP de cada item" className="ml-auto text-xs font-normal px-2 py-0.5 rounded flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.accent }}><RefreshCw size={11} /> Gerar demandas de novo</button>}</div>
          {p.linhas.map((l, i) => (
            <div key={i} className="flex px-4 py-2 text-xs gap-2" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <input type="checkbox" checked={marc.has(l.itemId)} onChange={() => tog(l.itemId)} style={{ visibility: i && p.linhas[i - 1].itemId === l.itemId ? "hidden" : "visible" }} />
              <div className="w-56 truncate" style={{ color: C.text }} title={l.descricao}>{ch(l.chave)} · {l.descricao} <span style={{ color: C.sub }}>({l.qtdPecas} pç)</span></div>
              <div className="flex-1"><b>{l.nome}</b>{l.papel === "FORRO" ? " (forro)" : ""} <span style={{ color: C.sub }}>{detArtigo(l)}{l.obs ? ` · obs: ${l.obs}` : ""}</span>{l.equiparadoA && <span style={{ color: C.green }}> → junto com {detArtigo(nomeArt[l.equiparadoA] || {})}</span>}</div>
              <div className="w-24 text-right font-semibold" style={{ color: C.accent }}>{qtdU(l.quantidade, l.unidade)}</div>
            </div>
          ))}
        </div>
      ))}
      {aba === "itens" && <BarraDevolver n={marc.size} rotulo="Devolver para Pedidos" ocupado={salvando} onDevolver={devolver} onLimpar={() => setMarc(new Set())}
        onExcluir={!podeExcluirSel ? undefined : async () => { if (await excluirDemandas([...marc], user)) { setMarc(new Set()); carregar(); } }} />}
    </div>
  );
}

// ---------- v415 — itens atendidos pelo estoque (podem voltar ao levantamento) ----------
export function Atendidos({ fases, ir, user }) {
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
              <input type="checkbox" checked={marc.has(i.id)} onChange={() => tog(i.id)} className="mt-0.5" />
              <div className="flex-1">
                <div className="text-sm" style={{ color: C.text }}>{ch(i.chave)} · {i.descricao} <span className="text-xs" style={{ color: C.sub }}>({i.quantidade} pç · FPP {fmtFpp(i.fppNumero)})</span></div>
                <div style={{ color: C.sub }}>{i.demanda.map((x) => `${x.nome}${x.cor ? ` ${x.cor}` : ""} ${qtdU(x.quantidade, x.unidade)}`).join(" · ")}</div>
                <div style={{ color: C.sub }}>Autorizado {i.autorizadoEm ? new Date(i.autorizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""}{i.autorizadoPorNome ? ` por ${i.autorizadoPorNome}` : ""}</div>
              </div>
              {i.seguiu ? <Chip cor={C.sub}>material já na produção</Chip> : <Chip cor={C.green} fundo={C.greenSoft}>reservado</Chip>}
            </label>
          ))}
        </div>
      ))}
      <BarraDevolver n={marc.size} rotulo="Devolver para o levantamento" ocupado={ocupado} onDevolver={devolver} onLimpar={() => setMarc(new Set())}
        onExcluir={!user?.isMaster ? undefined : async () => { if (await excluirDemandas([...marc], user)) { setMarc(new Set()); carregar(); } }} />
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
            <div className="flex-1 min-w-0"><b>{a.nome}</b> <span className="text-xs" style={{ color: C.sub }}>{detArtigo(a)}</span><Origens l={a.origens} unidade={a.unidade} /></div>
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
                  <div className="text-sm" style={{ color: C.text }}>{ch(i.chave)} · {i.descricao} <span className="text-xs" style={{ color: C.sub }}>({i.quantidade} pç · FPP {fmtFpp(i.fppNumero)})</span></div>
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
                <div className="text-sm" style={{ color: C.text }}>{rotPed(i.pedidoNumero, i.cliente)} · {ch(i.chave)} · {i.descricao}</div>
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
        {veValores && <button onClick={() => fetch("/api/compras/integracao", { headers: { "x-usuario-id": String(user?.id || "") } }).then((r) => r.json()).then((j) => (j.token ? setInteg(j) : alerta(j.error || "Sem acesso.")))} className="ml-auto text-xs flex items-center gap-1" style={{ color: C.sub }}><KeyRound size={13} /> Integração PCP</button>}
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
// v609 — cadastro de fornecedor sem sair do PIC (popup no centro)
function NovoFornecedorModal({ nome, onClose, onCriado }) {
  const [f, setF] = useState({ nome: String(nome || "").trim().toUpperCase(), nomeFantasia: "", razaoSocial: "", inscricaoEstadual: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "", cep: "", preposto: "", telefones: "", emailNf: "", obs: "" });
  const [cnpjs, setCnpjs] = useState([{ cnpj: "", razaoSocial: "" }]);
  const [st, setSt] = useState(false), [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const Campo = ({ k, rot, ph, cls = "" }) => <label className={`block text-xs ${cls}`} style={{ color: C.sub }}>{rot}
    <input value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>;
  const salvar = async () => {
    setErro(""); if (!f.nome.trim()) return setErro("Informe o nome comercial.");
    setSt(true);
    const r = await fetch("/api/fornecedores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, cnpjs }) });
    const j = await r.json().catch(() => ({})); setSt(false);
    if (!r.ok) return setErro(j.error || "Erro ao salvar.");
    onCriado(j);
  };
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(3,10,22,0.55)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full rounded-xl overflow-hidden" style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto", background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${C.line}`, background: C.panel2 }}>
          <div className="font-semibold" style={{ color: C.navy }}>Novo fornecedor</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {Campo({ k: "nome", rot: "Nome comercial *", ph: "Ex.: Malharia SP" })}{Campo({ k: "nomeFantasia", rot: "Nome fantasia" })}
            {Campo({ k: "razaoSocial", rot: "Razão social" })}{Campo({ k: "inscricaoEstadual", rot: "Inscrição estadual" })}
          </div>
          <div className="text-xs font-semibold" style={{ color: C.sub }}>CNPJ(s)</div>
          {cnpjs.map((c, i) => <div key={i} className="grid grid-cols-2 gap-2">
            <input value={c.cnpj} onChange={(e) => setCnpjs((l) => l.map((x, j) => (j === i ? { ...x, cnpj: e.target.value } : x)))} placeholder="00.000.000/0000-00" className="px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
            <input value={c.razaoSocial} onChange={(e) => setCnpjs((l) => l.map((x, j) => (j === i ? { ...x, razaoSocial: e.target.value } : x)))} placeholder="Razão social do CNPJ" className="px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
          </div>)}
          <button onClick={() => setCnpjs((l) => [...l, { cnpj: "", razaoSocial: "" }])} className="text-xs" style={{ color: C.accent }}>+ adicionar outro CNPJ</button>
          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>ENDEREÇO</div>
          <div className="grid grid-cols-6 gap-3">
            {Campo({ k: "logradouro", rot: "Logradouro", cls: "col-span-4" })}{Campo({ k: "numero", rot: "Número", cls: "col-span-1" })}{Campo({ k: "cep", rot: "CEP", cls: "col-span-1" })}
            {Campo({ k: "complemento", rot: "Complemento", cls: "col-span-2" })}{Campo({ k: "bairro", rot: "Bairro", cls: "col-span-2" })}{Campo({ k: "municipio", rot: "Município", cls: "col-span-1" })}{Campo({ k: "uf", rot: "UF", cls: "col-span-1" })}
          </div>
          <div className="text-xs font-semibold pt-1" style={{ color: C.sub }}>CONTATO</div>
          <div className="grid grid-cols-2 gap-3">
            {Campo({ k: "preposto", rot: "Preposto (contato)" })}{Campo({ k: "telefones", rot: "Telefone(s)", ph: "Separe vários por ;" })}
            {Campo({ k: "emailNf", rot: "E-mail p/ NFs, boletos e cotações", cls: "col-span-2" })}
          </div>
          <label className="block text-xs" style={{ color: C.sub }}>Observações
            <textarea value={f.obs} onChange={(e) => set("obs", e.target.value)} rows={2} className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}`, resize: "vertical" }} /></label>
          {erro && <div className="text-xs" style={{ color: C.red }}>{erro}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ color: C.sub, border: `1px solid ${C.line}`, background: C.panel }}>Cancelar</button>
          <button onClick={salvar} disabled={st} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: st ? 0.6 : 1 }}>{st ? "Salvando…" : "Cadastrar e usar"}</button>
        </div>
      </div>
    </div>
  );
}
const numBR = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));
// v1075 — valor unitário da cotação com vírgula e milhar (1.393,00; até 6 casas quando houver)
const valBR = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 }));
const lerNum = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
// v1048 — item do PIC já seguido: tem cotação (sem "ninguém tem") ou OC. Daí em diante o acompanhamento é em Cotações / OC.
const picItemSeguido = (i) => !!i.oc || ((i.cotacoes || []).length > 0 && !i.semCotacao);
const picConcluido = (p) => p.itens.length > 0 && p.itens.every(picItemSeguido);
// v1088 — trocar o artigo do item do PIC por um similar do cadastro (busca como na FPP: nome, cor, código, fornecedor)
let _artsPic = null, _artsPicEm = 0;
const semAcentoUp = (s) => semAcento(s).toUpperCase();
function TrocarArtigoModal({ item, user, onClose, onOk }) {
  const inf = item.info || {};
  const [arts, setArts] = useState(_artsPic || []);
  const [q, setQ] = useState(inf.nome || "");
  const [motivo, setMotivo] = useState("");
  const [oc, setOc] = useState(false);
  useEffect(() => { if (!_artsPic || Date.now() - _artsPicEm > 5 * 60e3) fetch("/api/artigos").then((r) => r.json()).then((l) => { _artsPic = (Array.isArray(l) ? l : []).map((a) => ({ id: a.id, nome: a.nome, cor: a.cor, codigo: a.codigo, unidade: a.unidade, categoria: a.categoria, valorUnitario: a.valorUnitario, fornecedor: a.fornecedor ? (a.fornecedor.nomeFantasia || a.fornecedor.nome || a.fornecedor.razaoSocial) : null })); _artsPicEm = Date.now(); setArts(_artsPic); }).catch(() => {}); }, []);
  const pal = semAcentoUp(q).split(/\s+/).filter(Boolean);
  const lista = useMemo(() => !pal.length ? [] : arts.filter((a) => a.id !== item.artigoId).map((a) => { const t = semAcentoUp([a.nome, a.cor, a.codigo, a.fornecedor, a.categoria].filter(Boolean).join(" ")); const n = pal.filter((p) => t.includes(p)).length; return { a, n, ini: semAcentoUp(a.nome).startsWith(pal[0]) ? 1 : 0 }; })
    .filter((x) => x.n > 0).sort((x, y) => (y.n - x.n) || (y.ini - x.ini) || String(x.a.nome).localeCompare(String(y.a.nome))).slice(0, 40), [arts, q]);
  const trocar = async (a) => {
    if (!(await confirmar(`Trocar ${inf.nome}${inf.cor ? ` · ${inf.cor}` : ""} por ${a.nome}${a.cor ? ` · ${a.cor}` : ""}?\nFornecedor e valor passam a ser os do cadastro do novo artigo (confira antes de gerar a OC).`))) return;
    setOc(true);
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "trocarArtigo", picItemId: item.id, artigoId: a.id, motivo, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({})); setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    onOk();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,40,.45)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl flex flex-col" style={{ background: C.panel, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>Trocar por artigo similar</div>
          <div className="text-xs" style={{ color: C.sub }}>Hoje: {inf.nome}{inf.cor ? ` · ${inf.cor}` : ""}{inf.codigo ? ` · ${inf.codigo}` : ""} · {qtdU(item.quantidade, inf.unidade)}</div>
        </div>
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-2" style={{ border: `1px solid ${C.accent}` }}><Search size={15} style={{ color: C.sub }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, cor, código ou fornecedor do artigo…" className="flex-1 outline-none text-sm" /></div>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da troca (opcional): ex.: fornecedor sem estoque da cor" className="w-full px-3 py-2 rounded-lg text-sm mb-2" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <div className="px-5 pb-3 overflow-auto flex-1">
          {!arts.length ? <div className="text-sm flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={14} className="animate-spin" /> Carregando artigos…</div>
            : !lista.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhum artigo. Mude a busca.</div>
            : lista.map(({ a }) => (
              <button key={a.id} disabled={oc} onClick={() => trocar(a)} className="w-full text-left px-3 py-2 rounded-lg mb-1 text-sm hover:shadow-sm" style={{ border: `1px solid ${C.line}` }}>
                <b style={{ color: C.navy }}>{a.nome}</b>{a.cor ? <span style={{ color: C.text }}> · {a.cor}</span> : null}
                <span className="text-xs" style={{ color: C.sub }}>{[a.codigo, a.categoria, a.unidade, a.fornecedor, a.valorUnitario != null ? brlU(a.valorUnitario) : null].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
              </button>))}
        </div>
        <div className="flex justify-end px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}><button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}` }}>Fechar</button></div>
      </div>
    </div>
  );
}
export function PicCompras({ user, fases, ir }) {
  const [l, setL] = useState(null);
  const [forns, setForns] = useState(_fornPic || []);
  const [ed, setEd] = useState({});   // { picItemId: { fornecedor, valor, qtd } }
  const [oc, setOc] = useState(false);
  const [cot, setCot] = useState(null);   // v476 — cotação por fornecedor
  const [sel, setSel] = useState(new Set());   // v477 — itens escolhidos (de qualquer PIC)
  const [troca, setTroca] = useState(null);   // v1088 — item do PIC trocando de artigo
  // v912 — item com cotação gerada sai do PIC e fica só em Cotações (volta se todos os fornecedores responderem "não tem")
  const [emCot, setEmCot] = useState(0);
  const [todosPic, setTodosPic] = useState([]);   // v1047 — PICs completos (guias Baixados e Todos)
  const [guia, setGuia] = useState("andamento");
  const [abPic, setAbPic] = useState({});
  const [fotoPic, setFotoPic] = useState(null);   // v1054 — card do PIC em imagem
  const carregar = () => fetch("/api/compras/pic").then((r) => r.json()).then((x) => {
    const todos = Array.isArray(x) ? x : [];
    setTodosPic(todos);
    const naCot = (i) => (i.cotacoes || []).length > 0 && !i.semCotacao;
    setEmCot(todos.reduce((n, p) => n + p.itens.filter(naCot).length, 0));
    setL(todos.map((p) => ({ ...p, itens: p.itens.filter((i) => !picItemSeguido(i)) })).filter((p) => p.itens.length));   /* v1048 — em andamento: só itens sem cotação e sem OC */ setEd({}); const f = lerFoco("pic"); if (f) { const t = todos.find((p) => p.numero === f); if (t && picConcluido(t)) setGuia("todos"); if (t) setAbPic((m) => ({ ...m, [t.id]: true })); rolarDestacar(`pic-${f}`); } }).catch(() => setL([]));
  useEffect(() => { carregar(); if (!_fornPic) fetch("/api/fornecedores").then((r) => r.json()).then((x) => { _fornPic = Array.isArray(x) ? x : []; setForns(_fornPic); }).catch(() => {}); }, []);
  const porNome = useMemo(() => Object.fromEntries(forns.map((f) => [nomeFornec(f).toUpperCase(), f])), [forns]);
  const [novoForn, setNovoForn] = useState(null);   // v609 — { item, nome, extra? }
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
  const alvoGeral = sel.size ? todosAbertos.filter((i) => sel.has(i.id)) : todosAbertos;
  const alvo = alvoGeral;
  const linha = (i) => { const v = val(i); const f = porNome[v.fornecedor.trim().toUpperCase()]; return { id: i.id, fornecedorId: f ? f.id : (v.fornecedor.trim() ? undefined : null), valorUnitario: v.valor, quantidade: v.qtd, nomeForn: v.fornecedor,
    fornecedoresCotacao: v.extras.map((n) => porNome[String(n || "").trim().toUpperCase()]).filter(Boolean).map((x) => ({ id: x.id, nome: nomeFornec(x) })) }; };
  // v1061 — salvar só o que foi alterado (fornecedor, valor, quantidade, fornecedores extras), em qualquer guia
  const editados = (pid) => todosPic.flatMap((p) => p.itens.filter((i) => !i.oc && ed[i.id] && (pid == null || p.id === pid)).map((i) => ({ ...i, picNumero: p.numero })));
  const [salvando, setSalvando] = useState(false);
  async function salvarEdicoes(pid = null) {
    const alvo = editados(pid);
    if (!alvo.length) return;
    const its = alvo.map(linha);
    const semCad = its.filter((x) => x.fornecedorId === undefined);
    if (semCad.length) return alerta(`Fornecedor não encontrado no cadastro: ${[...new Set(semCad.map((x) => x.nomeForn))].join(", ")}. Escolha um da lista (ou use "Cadastrar").`);
    const extraFora = alvo.flatMap((i) => val(i).extras).filter((n) => String(n || "").trim() && !porNome[String(n).trim().toUpperCase()]);
    if (extraFora.length) return alerta(`Fornecedor para cotação fora do cadastro: ${[...new Set(extraFora)].join(", ")}. Escolha da lista.`);
    setSalvando(true);
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "salvarItens", itens: its.map(({ nomeForn, ...x }) => ({ ...x, fornecedorId: x.fornecedorId || null })) }) });
    const x = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return alerta(x.error || "Não foi possível salvar.");
    const ids = new Set(alvo.map((i) => String(i.id)));
    const resto = Object.fromEntries(Object.entries(ed).filter(([k]) => !ids.has(String(k))));   // as alterações de outros PICs continuam na tela
    await carregar(); setEd(resto);
  }
  // avisa ao sair da página com alteração sem salvar
  useEffect(() => { const n = Object.keys(ed).length; if (!n) return; const f = (e) => { e.preventDefault(); e.returnValue = ""; }; window.addEventListener("beforeunload", f); return () => window.removeEventListener("beforeunload", f); }, [ed]);
  async function acaoItens(acao, alvo = alvoGeral) {   // v527 — alvo: itens escolhidos (barra de baixo) ou os do PIC (barra do PIC)
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
      var juntarEm = await perguntarJuntarOc(prontos.map((x) => x.fornecedorId));   // v1072
      // v1086 — fornecedor com crédito de devoluções: usar nesta OC?
      var usarCredito = [];
      try {
        const fids = [...new Set(prontos.map((x) => x.fornecedorId))];
        const sd = await fetch(`/api/compras/devolucoes?saldos=${fids.join(",")}`).then((rr) => rr.json());
        for (const [fid, v] of Object.entries(sd.saldos || {})) {
          const nomeF = prontos.find((x) => String(x.fornecedorId) === String(fid))?.nomeForn || "O fornecedor";
          if (await confirmar(`${nomeF} tem ${brl(v)} de crédito de devoluções.\nUsar o crédito nesta OC? A OC sai abatida; quando a NF chegar, você escolhe aceitar a NF com valor ou usar o crédito para baixar as contas dela.`)) usarCredito.push(Number(fid));
        }
      } catch { /* sem crédito: segue */ }
    }
    setOc(true);
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, itens: its.map(({ nomeForn, ...x }) => ({ ...x, fornecedorId: x.fornecedorId || null })), ids: its.map((x) => x.id), quem: nomeUser(user), ...(acao === "ocsItens" && juntarEm ? { juntarEm } : {}), ...(acao === "ocsItens" && usarCredito?.length ? { usarCredito } : {}) }) });
    const x = await r.json().catch(() => ({}));
    setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    if (acao === "ocsItens") { await alerta(`${x.ocs.map((o) => `${o.numero}${o.juntada ? " (itens juntados)" : ""}${o.credito ? ` (crédito ${brl(o.credito)})` : ""}`).join(", ")} gerada(s)/atualizada(s).${x.faltam ? ` ${x.faltam} item(ns) continuam no PIC.` : ""}`); setSel(new Set()); }
    carregar();
  }
  async function cotacao(alvo = alvoGeral) {
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
    // v1051 — já há cotação aberta (sem OC) do mesmo fornecedor: pergunta se junta os itens nela em vez de abrir outra
    const abertas = (await fetch("/api/compras/cotacoes").then((r) => r.json()).catch(() => [])).filter?.((c) => ["GERADA", "ENVIADA", "RESPONDIDA"].includes(c.status)) || [];
    for (const gr of grupos) {
      const fid = gr.fornecedor?.id, nomeG = norm(gr.fornecedor?.nomeFantasia || gr.fornecedor?.nome || gr.fornecedor?.razaoSocial);
      const ex = abertas.filter((c) => (fid ? c.fornecedorId === fid : norm(c.fornecedorNome) === nomeG)).sort((a, b) => b.id - a.id)[0];
      if (ex && (await confirmar(`${ex.fornecedorNome} já tem a ${ex.numero} aberta (${ST_COT[ex.status]?.[0] || ex.status}, ${ex.itens.length} item(ns)).\n\nJuntar estes ${gr.itens.length} item(ns) nela, numa cotação só?${ex.status !== "GERADA" ? "\nEla volta para \"gerada\": reenvie ao fornecedor com os itens novos." : ""}`))) gr.juntarEm = ex.id;
    }
    fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "criar", grupos, pics, quem: nomeUser(user) }) })
      .then((r) => r.json()).then((x) => { (x.cotacoes || []).forEach((c, k) => { if (grupos[k]) { grupos[k].numero = c.numero; grupos[k].id = c.id; if (c.juntada) grupos[k].itens = c.itens; } }); setCot({ pic: pics, grupos, semF: alvo.filter((i) => !val(i).fornecedor.trim()).length }); setSel(new Set()); carregar(); })
      .catch(() => setCot({ pic: pics, grupos, semF: alvo.filter((i) => !val(i).fornecedor.trim()).length }));
  }
  const togSel = (id) => setSel((s0) => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  async function desfazer(p) {
    if (!(await confirmar(`Desfazer o ${p.numero}? Os itens voltam para o levantamento.\nAs linhas dele saem das cotações abertas (cotação que ficar vazia é cancelada).`))) return;
    const r = await fetch("/api/compras/pic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "cancelar", id: p.id }) });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) return alerta(x.error || "Erro.");
    if (x.cotacoes?.length) await alerta(`${p.numero} desfeito. Linhas retiradas de: ${x.cotacoes.join(", ")}.`);
    carregar();
  }
  const inp = "px-2 py-1 rounded text-sm outline-none";
  return (
    <div className="w-full">
      <FasesCompras atual="pic" fases={fases} ir={ir} />
      {troca && <TrocarArtigoModal item={troca} user={user} onClose={() => setTroca(null)} onOk={() => { setTroca(null); carregar(); }} />}
      <p className="text-sm mb-3" style={{ color: C.sub }}>Os itens que o estoque não atende saem do <b>Cruzamento</b> num PIC, com os artigos iguais somados. Preencha o <b>fornecedor</b> e o <b>valor unitário</b> (a quantidade pode ser ajustada) e gere as <b>OCs</b>: uma por fornecedor. Itens de <b>PICs diferentes</b> podem ir na mesma cotação e na mesma OC: marque os itens e use a barra de baixo.</p>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {/* v1047 — guias no padrão das OCs: em andamento (com itens sem OC e fora de cotação), baixados (tudo em OC) e todos */}
      <Guias abas={[["andamento", `Em andamento (${(l || []).length})`, Clock], ["baixados", `Baixados (${todosPic.filter(picConcluido).length})`, PackageCheck], ["todos", "Todos", Layers]]} atual={guia} onChange={setGuia}
        direita={<>{(() => { const n = Object.keys(ed).length; return <button disabled={!n || salvando} onClick={() => salvarEdicoes()} title="Salva fornecedor, valor, quantidade e fornecedores extras alterados" className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 disabled:opacity-50" style={n ? { background: C.accent, color: "#fff" } : { border: `1px solid ${C.line}`, color: C.sub, background: C.panel }}>{salvando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {n ? `Salvar alterações (${n})` : "Salvo"}</button>; })()}
          <button onClick={carregar} title="Atualizar" className="p-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button></>} />
      {l && !(guia === "andamento" ? l : guia === "baixados" ? todosPic.filter(picConcluido) : todosPic).length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>{guia === "andamento" ? "Nenhum PIC em andamento. Gere pelo Cruzamento com estoque (botão Gerar PIC)." : "Nenhum PIC aqui."}</div>}
      {emCot > 0 && <div className="text-xs mb-3 flex items-center gap-2" style={{ color: C.sub }}>{emCot} item(ns) com cotação gerada estão em Cotações.{ir && <button onClick={() => ir("comprasCotacoes")} className="underline" style={{ color: C.accent }}>Abrir cotações</button>}</div>}
      {cot && <CotacaoModal cot={cot} onClose={() => setCot(null)} />}
      {fotoPic && <PicFotoModal p={fotoPic} onClose={() => setFotoPic(null)} />}
      {novoForn && <NovoFornecedorModal nome={novoForn.nome} onClose={() => setNovoForn(null)} onCriado={(f) => {
        _fornPic = [...forns, f]; setForns(_fornPic); set(novoForn.item, "fornecedor", nomeFornec(f)); setNovoForn(null);
      }} />}
      {(guia === "andamento" ? l || [] : guia === "baixados" ? todosPic.filter(picConcluido) : todosPic).map((p) => {
        const abertos = p.itens.filter((i) => !picItemSeguido(i));   // v1048 — sem cotação e sem OC
        const corPic = abertos.length ? C.accent : C.green, fundoPic = abertos.length ? C.accentSoft : C.greenSoft;
        const abertoPic = abPic[p.id] ?? guia === "andamento";   // em andamento começa aberto; baixados/todos recolhidos
        const tot = p.itens.reduce((s0, i) => { const v = val(i); return s0 + (lerNum(v.valor) || 0) * (lerNum(v.qtd) || 0); }, 0);
        const porF = {};
        for (const i of abertos) { const v = val(i); const k = v.fornecedor.trim() || "— sem fornecedor"; porF[k] = (porF[k] || 0) + (lerNum(v.valor) || 0) * (lerNum(v.qtd) || 0); }
        return (
          <div key={p.id} id={`pic-${p.numero}`} className="rounded-xl mb-5 overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `5px solid ${corPic}`, boxShadow: "0 1px 3px rgba(16,24,40,.06)" }}>   {/* v1047 — mesmo card das cotações */}
            <div onClick={() => setAbPic((m) => ({ ...m, [p.id]: !abertoPic }))} className="flex flex-wrap items-center gap-3 px-5 py-3.5 cursor-pointer select-none" style={{ background: abertoPic ? "#FAFBFC" : C.panel, borderBottom: abertoPic ? `1px solid ${C.line}` : "none" }}>
              {abertoPic ? <ChevronDown size={18} style={{ color: C.sub }} /> : <ChevronRight size={18} style={{ color: C.sub }} />}
              <div className="flex-1 min-w-0"><span className="text-xs font-bold px-2 py-0.5 rounded mr-2" style={{ background: fundoPic, color: corPic }}>{p.numero}</span><span className="text-xs" style={{ color: C.sub }}> {new Date(p.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{p.criadoPorNome ? ` por ${p.criadoPorNome}` : ""} · {p.itens.length} artigo(s)</span></div>
              <div className="text-right"><div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.sub }}>Total</div><div className="text-base font-bold" style={{ color: C.navy }}>{brl(tot)}</div></div>
              <Chip cor={corPic} fundo={fundoPic}>{abertos.length ? `${abertos.length} sem cotação` : "em cotação / OC"}</Chip>
              {editados(p.id).length > 0 && <button onClick={(e) => { e.stopPropagation(); salvarEdicoes(p.id); }} disabled={salvando} title="Salvar as alterações deste PIC" className="text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}><CheckCircle2 size={13} /> Salvar ({editados(p.id).length})</button>}   {/* v1061 */}
              <button onClick={(e) => { e.stopPropagation(); setFotoPic({ ...p, itens: p.itens.map((i) => ({ ...i, _forn: val(i).fornecedor, _valor: lerNum(val(i).valor), _qtd: lerNum(val(i).qtd) ?? Number(i.quantidade) })) }); }} title="Card do PIC em imagem (copiar, PNG ou PDF)" className="text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }}><ImagePlus size={13} /> Card</button>   {/* v1054 */}
              {abertos.length > 0 && (() => {   // v527 — cotação e OC deste PIC: os marcados dele, ou todos os sem OC
                const doPic = abertos.map((i) => ({ ...i, picNumero: p.numero }));
                const marc = doPic.filter((i) => sel.has(i.id));
                const lista = marc.length ? marc : doPic;
                const rot = marc.length ? ` (${marc.length})` : "";
                // v609 — o botão de OC mostra quantas OCs saem (uma por fornecedor), não quantos itens
                const nForn = new Set(lista.map((i) => val(i).fornecedor.trim().toUpperCase()).filter(Boolean)).size;
                return <span className="flex items-center gap-1.5 ml-1" onClick={(e) => e.stopPropagation()}>
                  <button disabled={oc} onClick={() => cotacao(lista)} title={marc.length ? "Cotação dos itens marcados deste PIC" : "Cotação de todos os itens sem OC deste PIC"} className="text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><FileText size={13} /> Gerar cotação{rot}</button>
                  <button disabled={oc} onClick={() => acaoItens("ocsItens", lista)} title={marc.length ? "OCs dos itens marcados deste PIC" : "OCs de todos os itens sem OC deste PIC"} className="text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ background: C.accent, color: "#fff" }}>{oc ? <Loader2 size={13} className="animate-spin" /> : <ShoppingCart size={13} />} Gerar {nForn || ""} OC{nForn === 1 ? "" : "s"}{nForn ? ` · ${lista.length} ite${lista.length === 1 ? "m" : "ns"}` : ""}</button>
                </span>;
              })()}
            </div>
            {abertoPic && <>
            <div className="flex px-4 py-2 text-xs font-semibold gap-2" style={{ color: C.sub, background: C.panel2 }}>
              <div className="w-5">{abertos.length > 0 && <input type="checkbox" title="Marcar todos deste PIC" checked={abertos.every((i) => sel.has(i.id))} onChange={(e) => setSel((s0) => { const n = new Set(s0); abertos.forEach((i) => (e.target.checked ? n.add(i.id) : n.delete(i.id))); return n; })} />}</div><div className="flex-1">Artigo</div><div className="w-28 text-right">Quantidade</div><div className="w-56">Fornecedor</div><div className="w-28 text-right">Valor unit.</div><div className="w-28 text-right">Total</div><div className="w-7" />
            </div>
            {p.itens.map((i) => {
              const v = val(i), trav = !!i.oc, inf = i.info || {};
              const semF = !trav && v.fornecedor.trim() && !porNome[v.fornecedor.trim().toUpperCase()];
              return (
                <div key={i.id} className="flex px-4 py-2 gap-2 items-center text-sm" style={{ borderTop: `1px solid ${C.line}`, opacity: trav ? 0.7 : 1, background: sel.has(i.id) ? C.accentSoft : undefined }}>
                  <div className="w-5">{!trav && <input type="checkbox" checked={sel.has(i.id)} onChange={() => togSel(i.id)} title="Escolher para cotação/OC (pode misturar PICs)" />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate" style={{ color: C.text }}>{inf.nome || `Artigo #${i.artigoId}`} <span className="text-xs font-normal" style={{ color: C.sub }}>{[inf.cor, inf.codigo].filter(Boolean).join(" · ")}</span>
                      {!trav && <button onClick={() => setTroca(i)} title="Trocar por um artigo similar do cadastro" className="ml-2 text-[11px] font-semibold" style={{ color: C.blue }}>trocar por similar</button>}</div>   {/* v1088 */}
                    {inf.trocadoDe && <div className="text-[11px]" style={{ color: C.yellow }}>trocado de {inf.trocadoDe.nome}{inf.trocadoDe.cor ? ` · ${inf.trocadoDe.cor}` : ""}{inf.trocadoDe.por ? ` por ${inf.trocadoDe.por}` : ""}</div>}
                    <div className="text-[11px] truncate" style={{ color: C.sub }} title={(inf.pedidos || []).map((x) => `${x.avulsa ? "Avulsa" : "Pedido"} ${x.pedido} ${ch(x.chave)} · ${qtdU(x.quantidade, inf.unidade)}`).join("\n")}>
                      {(inf.pedidos || []).map((x) => (x.avulsa ? `Avulsa ${x.cliente?.split("·")[0]?.replace("AVULSA", "").trim() || x.pedido}` : rotOrigem(x))).filter((x, k, a) => a.indexOf(x) === k).join(" · ")}
                      {inf.embalagem ? ` · grosa de ${inf.embalagem}` : ""}
                    </div>
                    <DocsOrigem l={inf.pedidos} user={user} />
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
                          {semF && <button type="button" onClick={() => setNovoForn({ item: i, nome: v.fornecedor })} title="Fornecedor fora do cadastro — cadastrar agora" className="shrink-0 rounded-md text-[11px] font-semibold px-1.5" style={{ height: 26, background: C.red, color: "#fff" }}>Cadastrar</button>}
                          {!v.fornecedor.trim() && <button type="button" onClick={() => setNovoForn({ item: i, nome: "" })} title="Cadastrar fornecedor novo" className="shrink-0 rounded-md text-[11px] font-semibold px-1.5" style={{ height: 26, border: `1px solid ${C.line}`, color: C.sub }}>Novo</button>}
                          {v.extras.length < 4 && <button type="button" onClick={() => set(i, "extras", [...v.extras, ""])} title="Adicionar outro fornecedor para cotação (até 5)" className="shrink-0 rounded-md font-bold text-sm flex items-center justify-center" style={{ width: 26, height: 26, border: `1px solid ${C.accent}`, color: C.accent }}>+</button>}</div>
                        {v.extras.map((n, j) => (   // v482 — outros fornecedores para cotação
                          <div key={j} className="flex items-center gap-1"><div className="flex-1 min-w-0"><BuscaFornecedor valor={n} idAtual={porNome[String(n || "").trim().toUpperCase()]?.id} forns={forns} placeholder={`cotar também com…`} estilo={{ border: `1px dashed ${C.line}`, fontSize: 12 }}
                            onEscolher={(f, txt) => set(i, "extras", v.extras.map((x, k2) => (k2 === j ? (f ? nomeFornec(f) : txt) : x)))} /></div>
                            <button type="button" onClick={() => set(i, "extras", v.extras.filter((_, k2) => k2 !== j))} title="Tirar" className="shrink-0 flex items-center justify-center" style={{ width: 26, height: 26, color: C.sub }}><X size={13} /></button></div>
                        ))}
                      </div>}</div>
                  <div className="w-28 text-right">{trav ? brlU(i.valorUnitario) : <input value={v.valor} onChange={(e) => set(i, "valor", e.target.value)} placeholder="0,00" className={`${inp} w-24 text-right`} style={{ border: `1px solid ${C.line}` }} />}</div>
                  <div className="w-28 text-right font-semibold" style={{ color: C.navy }}>{lerNum(v.valor) && lerNum(v.qtd) ? brl(lerNum(v.valor) * lerNum(v.qtd)) : "—"}</div>
                  <div className="w-7 flex justify-end"><BotaoDispensar origens={inf.pedidos} user={user} onFeito={carregar} artigo={{ id: i.artigoId, nome: inf.nome }} /></div>   {/* v1054 — D à direita do valor */}
                </div>
              );
            })}
            {abertos.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderTop: `1px solid ${C.line}`, background: C.panel2 }}>
                <div className="flex-1 text-xs" style={{ color: C.sub }}>{Object.entries(porF).map(([f, v]) => `${f}: ${brl(v)}`).join(" · ")}</div>
                {!p.itens.some((i) => i.oc) && <button onClick={() => desfazer(p)} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md" style={{ color: C.red, border: `1px solid ${C.line}`, background: C.panel }}><Undo2 size={13} /> Desfazer PIC</button>}
              </div>
            )}
            </>}
          </div>
        );
      })}
      {todosAbertos.length > 0 && (   // v477 — barra única: itens de PICs diferentes na mesma cotação/OC
        <div className="flex flex-wrap items-center gap-2 sticky bottom-0 py-3 px-3 rounded-lg" style={{ background: "#F7F8FA", border: `1px solid ${C.line}` }}>
          <label className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer" style={{ color: C.navy }}><input type="checkbox" checked={sel.size === todosAbertos.length} onChange={(e) => setSel(e.target.checked ? new Set(todosAbertos.map((i) => i.id)) : new Set())} /> Todos</label>   {/* v480 */}
          <div className="flex-1 text-sm" style={{ color: C.sub }}>{sel.size ? <><b style={{ color: C.navy }}>{sel.size}</b> item(ns) escolhido(s) de {new Set(alvo.map((i) => i.picNumero)).size} PIC(s) · <button onClick={() => setSel(new Set())} className="underline">limpar</button></> : <>Sem escolha: vale para <b style={{ color: C.navy }}>todos os {todosAbertos.length}</b> itens sem OC. Marque itens (de qualquer PIC) para escolher.</>}</div>
          <button disabled={oc} onClick={() => acaoItens("salvarItens")} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>Salvar</button>
          <button disabled={oc} onClick={() => cotacao()} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><FileText size={14} /> Gerar cotação</button>
          <button disabled={oc} onClick={() => acaoItens("ocsItens")} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />} Gerar OCs por fornecedor</button>
        </div>
      )}
    </div>
  );
}

// ---------- v469 — ordens de compra (uma por fornecedor) ----------
const ST_OC = { ABERTA: ["aberta", C.accent, C.accentSoft], ENVIADA: ["enviada ao fornecedor", C.blue, C.blueSoft], NF_EMITIDA: ["NF emitida", C.yellow, C.yellowSoft], RECEBIDA: ["recebida", C.green, C.greenSoft], CANCELADA: ["cancelada", C.sub, C.panel2] };
function imprimirOc(o) {
  const linhas = o.itens.map((i) => `<tr><td>${i.nome}${i.cor ? ` · ${i.cor}` : ""}${i.codigo ? ` · ${i.codigo}` : ""}</td><td class="n">${qtdU(i.quantidade, i.unidade)}</td><td class="n">${brlU(i.valorUnitario)}</td><td class="n">${brl(i.quantidade * i.valorUnitario)}</td></tr>`).join("");
  const dt = (d) => (d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${o.numero} · ${o.fornecedor.nome}</title><style>
    body{font-family:Arial,sans-serif;color:#0c2342;margin:32px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
    th,td{border-bottom:1px solid #dde3ea;padding:7px 6px;text-align:left}th{background:#f1f6fe}.n{text-align:right}.tot{font-weight:bold;font-size:15px}.cab{display:flex;justify-content:space-between;align-items:flex-start}
    .k{color:#667085;font-size:12px}</style></head><body>
    <div class="cab"><div><img src="/meridian-wordmark.svg" style="height:26px"><div class="k" style="margin-top:6px">Ordem de compra</div><h1>${o.numero}</h1></div>
    <div style="text-align:right;font-size:13px"><b>${o.fornecedor.razaoSocial || o.fornecedor.nome}</b><br>${[o.fornecedor.contato, o.fornecedor.telefone, o.fornecedor.email].filter(Boolean).join(" · ")}<br><span class="k">Emitida em ${dt(o.createdAt)}${o.pic ? ` · ${o.pic}` : ""}</span></div></div>
    <table><tr><th>Artigo</th><th class="n">Quantidade</th><th class="n">Valor unit.</th><th class="n">Total</th></tr>${linhas}
    <tr><td colspan="3" class="n tot">Total</td><td class="n tot">${brl(o.total)}</td></tr>${o.creditoUsado > 0 && o.creditoStatus !== "DEVOLVIDO" ? `<tr><td colspan="3" class="n">Crédito de devolução</td><td class="n">− ${brl(o.creditoUsado)}</td></tr><tr><td colspan="3" class="n tot">A pagar</td><td class="n tot">${brl(Math.max(0, o.total - o.creditoUsado))}</td></tr>` : ""}</table>
    <p style="font-size:13px;margin-top:18px">Condição de faturamento: <b>${o.condicaoFaturamento || "—"}</b> · Prazo de entrega: <b>${dt(o.prazoFabrica)}</b>${o.formaRecebimento ? ` · Recebimento: <b>${(FORMAS_REC.find((x) => x[0] === o.formaRecebimento) || [])[1]}</b>${o.diasAposFaturamento ? ` (${o.diasAposFaturamento} dias após o faturamento)` : ""}` : ""}${o.nfNumero ? `<br>NF ${o.nfNumero}` : ""}${o.obs ? `<br>Obs.: ${o.obs}` : ""}</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
  const w = window.open("", "_blank"); if (!w) return alerta("Permita pop-ups para imprimir a OC."); w.document.write(html); w.document.close();
}
// v1086 — devolver itens da OC (vieram errados): voltam ao PIC; com NF anexada, o ADM recebe a demanda da NF de devolução
function DevolverItensModal({ o, user, onClose, onOk }) {
  const dev = (id) => (o.devolucoes || []).filter((d) => d.ocItemId === id).reduce((s0, d) => s0 + d.quantidade, 0);
  const [q, setQ] = useState({});
  const [motivo, setMotivo] = useState("");
  const [oc, setOc] = useState(false);
  const temNf = (o.nfs || []).length > 0;
  const total = o.itens.reduce((s0, i) => s0 + (lerNum(q[i.id]) || 0) * Number(i.valorUnitario || 0), 0);
  const ir = async () => {
    setOc(true);
    const r = await fetch("/api/compras/devolucoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "devolver", ocId: o.id, motivo, quem: nomeUser(user), itens: o.itens.map((i) => ({ ocItemId: i.id, quantidade: q[i.id] })) }) });
    const x = await r.json().catch(() => ({})); setOc(false);
    if (!r.ok) return alerta(x.error || "Erro.");
    await alerta(`${x.devolucoes} item(ns) em devolução. ${x.voltaramAoPic} voltaram ao PIC para comprar de novo.${x.demandaAdm ? "\nO ADM recebeu a demanda de emitir a NF de devolução (chave, itens e arquivos)." : x.semNf ? "\nA OC não tem NF anexada: não há NF de devolução a emitir." : ""}\nGere a OD na guia Devoluções para lançar o crédito com o fornecedor.`);
    onOk();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(16,24,40,.45)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl" style={{ background: C.panel, maxHeight: "92vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 font-bold flex items-center gap-2" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}><Undo2 size={16} style={{ color: C.red }} /> Devolver itens · {o.numero} · {o.fornecedor.nome}</div>
        <div className="px-5 py-4">
          <div className="text-xs mb-3 px-3 py-2 rounded" style={{ background: temNf ? C.yellowSoft : C.panel2, color: temNf ? C.yellow : C.sub }}>{temNf ? `NF ${o.nfs.map((n) => n.numero).join(", ")} anexada: o ADM vai receber a tarefa de emitir a NF de devolução.` : "Sem NF anexada: os itens voltam ao PIC e entram na guia Devoluções, sem NF de devolução."}</div>
          {o.itens.map((i) => { const livre = Math.max(0, Number(i.quantidade) - dev(i.id)); return (
            <div key={i.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{[i.cor, i.codigo].filter(Boolean).join(" · ")}</span><div className="text-xs" style={{ color: C.sub }}>na OC {qtdU(i.quantidade, i.unidade)}{dev(i.id) ? ` · já devolvido ${qtdU(dev(i.id), i.unidade)}` : ""} · {brlU(i.valorUnitario)}</div></div>
              <input value={q[i.id] || ""} onChange={(e) => setQ((m) => ({ ...m, [i.id]: e.target.value }))} placeholder="0" disabled={!livre} className="w-24 px-2 py-1 rounded text-sm text-right" style={{ border: `1px solid ${C.line}` }} />
              <button onClick={() => setQ((m) => ({ ...m, [i.id]: String(livre).replace(".", ",") }))} disabled={!livre} className="text-xs" style={{ color: C.blue }}>tudo</button>
            </div>); })}
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="O que veio errado? (vai para a NF de devolução e para o histórico da OC)" className="w-full mt-3 px-3 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}` }} />
        </div>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-sm mr-auto" style={{ color: C.text }}>Valor devolvido: <b style={{ color: C.navy }}>{brl(total)}</b></span>
          <button onClick={onClose} className="px-4 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button disabled={oc || !total || motivo.trim().length < 3} onClick={ir} className="px-4 py-2 rounded text-sm font-semibold flex items-center gap-1.5" style={{ background: C.red, color: "#fff", opacity: oc || !total || motivo.trim().length < 3 ? 0.5 : 1 }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Devolver</button>
        </div>
      </div>
    </div>
  );
}
// v1086 — OC com crédito de devolução: abate o valor; quando a NF chega, aceitar a NF com valor ou usar o crédito nas contas dela
function CreditoOc({ o, user, onMudou }) {
  const total = o.total, aPagar = Math.max(0, total - o.creditoUsado);
  const decidir = async (decisao) => {
    const r = await fetch("/api/compras/devolucoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "decidirNf", ocId: o.id, decisao, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro.");
    await alerta(decisao === "ACEITAR_NF" ? `NF aceita com valor. ${brl(x.devolvido)} voltaram ao crédito do fornecedor.` : `${brl(x.aplicado)} do crédito baixaram as contas a pagar da NF.${x.sobra > 0 ? ` Sobra de ${brl(x.sobra)} voltou ao saldo.` : ""}`);
    onMudou();
  };
  const st = { RESERVADO: "reservado", APLICADO: "aplicado nas contas da NF", DEVOLVIDO: "não usado (NF aceita com valor)" }[o.creditoStatus] || "";
  return (
    <div className="mt-3 px-3 py-2.5 rounded-lg text-sm" style={{ background: C.greenSoft, color: C.text }}>
      <div><b style={{ color: C.green }}>Crédito de devolução {brl(o.creditoUsado)}</b> · {st} · total da OC {brl(total)} · a pagar <b>{brl(o.creditoStatus === "DEVOLVIDO" ? total : aPagar)}</b></div>
      {o.creditoStatus === "RESERVADO" && (o.nfs || []).length > 0 && <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-xs" style={{ color: C.sub }}>A NF chegou. O que fazer com o crédito?</span>
        <button onClick={() => decidir("BAIXAR_CONTAS")} className="text-xs px-2.5 py-1.5 rounded-md font-semibold" style={{ background: C.green, color: "#fff" }}>Usar o crédito para baixar as contas da NF</button>
        <button onClick={() => decidir("ACEITAR_NF")} className="text-xs px-2.5 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel }}>Aceitar a NF com valor (crédito volta ao saldo)</button>
      </div>}
    </div>
  );
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
  // v1046 — cancelar a OC: os itens voltam para a cotação (outra OC ou dispensar)
  const cancelarOc = async (o) => {
    const aviso = o.nfNumero ? `\n\nATENÇÃO: a OC já tem NF do fornecedor (${o.nfNumero}). Combine a devolução/cancelamento da NF com ele.` : o.status === "ENVIADA" ? "\n\nA OC já foi enviada ao fornecedor: avise que ela foi cancelada." : "";
    const motivo = await perguntar(`Cancelar a ${o.numero}?\nOs ${o.itens.length} item(ns) voltam para a cotação: dá para gerar outra OC ou dispensar as compras. A rota de coleta ainda não feita também é cancelada.${aviso}\n\nMotivo:`, "");
    if (motivo === null) return;
    const r = await fetch("/api/compras/oc", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, status: "CANCELADA", motivo, quem: nomeUser(user) }) });
    const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro.");
    await alerta(`${o.numero} cancelada. ${x.itens || 0} item(ns) voltaram para a cotação.`);
    carregar();
  };
  const vis = (l || []).filter((o) => (filtro === "ativas" ? ["ABERTA", "ENVIADA", "NF_EMITIDA"].includes(o.status) : filtro === "baixadas" ? o.status === "RECEBIDA" : true));   // v532 — Baixadas
  const [nf, setNf] = useState({});   // v479 — { ocId: { numero, emissao } }
  const [edIt, setEdIt] = useState({});   // v487 — itens da OC em edição
  const [fotoOc, setFotoOc] = useState(null);   // v1068 — OC em PNG
  const [devOc, setDevOc] = useState(null);   // v1086 — devolver itens da OC
  return (
    <div className="w-full">
      <FasesCompras atual="oc" fases={fases} ir={ir} />
      <Guias abas={[["ativas", `Em andamento (${(l || []).filter((o) => ["ABERTA", "ENVIADA", "NF_EMITIDA"].includes(o.status)).length})`, Clock], ["baixadas", `Baixadas (${(l || []).filter((o) => o.status === "RECEBIDA").length})`, PackageCheck], ["todas", "Todas", Layers]]} atual={filtro} onChange={setFiltro}
        direita={<><span className="text-sm" style={{ color: C.sub }}>Total: <b style={{ color: C.navy }}>{brl(vis.reduce((s0, o) => s0 + o.total, 0))}</b></span>
          <button onClick={carregar} title="Atualizar" className="p-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button></>} />
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {devOc && <DevolverItensModal o={devOc} user={user} onClose={() => setDevOc(null)} onOk={() => { setDevOc(null); carregar(); }} />}
      {fotoOc && <PicFotoModal p={fotoOc} desenhar={desenharOc} aoEnviar={() => fotoOc.status === "ABERTA" && salvar(fotoOc, { status: "ENVIADA" })} onClose={() => setFotoOc(null)} />}
      {l && !vis.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma OC. Elas são geradas no PIC, uma por fornecedor.</div>}
      {vis.map((o) => {
        const [txt, cor, fundo] = ST_OC[o.status] || ST_OC.ABERTA;
        const aberto = !!ab[o.id];
        return (
          <div key={o.id} id={`oc-${o.id}`} className="rounded-xl mb-5 overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `5px solid ${cor}`, boxShadow: "0 1px 3px rgba(16,24,40,.06)" }}>   {/* v1047 — mesmo card das cotações */}
            <button onClick={() => setAb((s0) => ({ ...s0, [o.id]: !aberto }))} className="w-full flex items-center gap-4 px-5 py-3.5 text-left select-none" style={{ background: aberto ? "#FAFBFC" : C.panel }}>
              {aberto ? <ChevronDown size={18} style={{ color: C.sub }} /> : <ChevronRight size={18} style={{ color: C.sub }} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: fundo, color: cor }}>{o.numero}</span>
                  <span className="text-base font-bold truncate" style={{ color: C.navy }}>{o.fornecedor.nome}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.sub }}>{new Date(o.createdAt).toLocaleDateString("pt-BR")}{o.cotacao ? ` · ${o.cotacao}` : ""}{o.pic ? ` · ${o.pic}` : ""} · {o.itens.length} item(ns){o.formaRecebimento ? ` · ${(FORMAS_REC.find((x) => x[0] === o.formaRecebimento) || [])[1]}` : ""}{o.nfNumero ? ` · NF ${o.nfNumero}` : ""}{o.condicaoFaturamento ? ` · ${o.condicaoFaturamento}` : ""}{o.prazoFabrica ? ` · fábrica ${new Date(o.prazoFabrica).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}</div>
              </div>
              <div className="text-right"><div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: C.sub }}>Total</div><div className="text-base font-bold" style={{ color: C.navy }}>{brl(o.total)}</div></div>
              <Chip cor={cor} fundo={fundo}>{txt}</Chip>
              {o.status !== "RECEBIDA" && <ChipEntrega e={o.entrega} />}   {/* v497 · v534: baixada mostra só a tag recebida, sem previsão */}
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
                        <div className="flex-1">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{[i.cor, i.codigo].filter(Boolean).join(" · ")}</span>
                          {i.nfNome && norm(i.nfNome) !== norm(i.nome) && <div className="text-xs" style={{ color: C.blue }}>na NF: {i.nfNome}</div>}
                          {pode && <button onClick={async () => {   /* v1087 — cancelar só este item: volta ao PIC */
                            if ((o.nfs || []).length && !(await confirmar("A OC já tem NF. Se o item veio, use Devolver itens. Cancelar mesmo assim?"))) return;
                            const m = await perguntar(`Cancelar ${i.nome} desta OC? Ele volta ao PIC para outra compra.${o.itens.length === 1 ? "\nÉ o último item: a OC será cancelada." : ""}\n\nMotivo:`, "");
                            if (!m) return;
                            const r = await fetch("/api/compras/oc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "cancelarItem", ocItemId: i.id, motivo: m, quem: nomeUser(user) }) });
                            const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro.");
                            await alerta(x.ocCancelada ? `${o.numero} cancelada (era o último item). O item voltou ao PIC.` : "Item cancelado: voltou ao PIC."); carregar();
                          }} className="text-[11px] font-semibold" style={{ color: C.red }}>cancelar item</button>}
                          {(() => { const dv = (o.devolucoes || []).filter((d) => d.ocItemId === i.id).reduce((s0, d) => s0 + d.quantidade, 0); return dv > 0 ? <div className="text-xs font-semibold" style={{ color: C.red }}>↩ {String(dv).replace(".", ",")} devolvido(s) ao fornecedor</div> : null; })()}   {/* v1086 */}
                          {(i.origens || []).length > 0 && <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.sub }}>{i.origens.map((x) => (x.avulsa ? "Avulsa" : rotOrigem(x))).filter((x, j, a) => a.indexOf(x) === j).join(" · ")}{pode && <BotaoDispensar origens={i.origens} user={user} onFeito={carregar} artigo={{ id: i.artigoId, nome: i.nome }} />}</div>}<DocsOrigem l={i.origens} user={user} /></div>
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
                  <label className="text-xs" style={{ color: C.sub }}>Situação<select value={o.status} disabled={o.status === "RECEBIDA"} onChange={(e) => (e.target.value === "CANCELADA" ? cancelarOc(o) : salvar(o, { status: e.target.value }))} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }}>{Object.entries(ST_OC).filter(([k]) => k !== "RECEBIDA" || o.status === "RECEBIDA").map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select></label>
                  {o.formaRecebimento && o.formaRecebimento !== "COLETA" && <label className="text-xs" style={{ color: C.sub }}>Previsão de chegada<input type="date" defaultValue={o.previsaoEntrega || ""} onChange={(e) => salvar(o, { previsaoEntrega: e.target.value || null })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>}   {/* v497 */}
                  <label className="text-xs" style={{ color: C.sub }}>Recebimento<select value={o.formaRecebimento || ""} onChange={(e) => salvar(o, { formaRecebimento: e.target.value || null })} className="block mt-1 px-2 py-1 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.text }}><option value="">—</option>{FORMAS_REC.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
                  {o.formaRecebimento === "TRANSPORTADORA" && <label className="text-xs" style={{ color: C.sub }}>Dias após faturar<input defaultValue={o.diasAposFaturamento ?? ""} onBlur={(e) => String(e.target.value) !== String(o.diasAposFaturamento ?? "") && salvar(o, { diasAposFaturamento: e.target.value })} className="block mt-1 px-2 py-1 rounded text-sm w-24" style={{ border: `1px solid ${C.line}`, color: C.text }} /></label>}
                  {o.status === "ABERTA" && (() => {   // v1072 — outras OCs abertas do mesmo fornecedor: juntar nesta
                    const irm = (l || []).filter((y) => y.id !== o.id && y.status === "ABERTA" && Number(y.fornecedorId ?? y.fornecedor?.id) === Number(o.fornecedorId ?? o.fornecedor?.id));
                    if (!irm.length) return null;
                    return <button onClick={async () => {
                      if (!(await confirmar(`Juntar ${irm.map((y) => y.numero).join(", ")} nesta ${o.numero} (${o.fornecedor.nome})?\nOs itens passam para a ${o.numero} e as outras OCs são canceladas (vazias).`))) return;
                      const r = await fetch("/api/compras/oc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "juntar", id: o.id, ids: irm.map((y) => y.id), quem: nomeUser(user) }) });
                      const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro.");
                      await alerta(`${x.juntadas.join(", ")} juntada(s) na ${o.numero}.`); carregar();
                    }} title="Uma OC só por fornecedor" className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><Merge size={14} /> Juntar {irm.map((y) => y.numero).join(", ")}</button>;
                  })()}
                  {o.status !== "CANCELADA" && o.status !== "ABERTA" && o.itens.length > 0 && <button onClick={() => setDevOc(o)} title="Itens que vieram errados: voltam ao PIC; com NF anexada, o ADM emite a NF de devolução" className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.red}`, color: C.red, background: C.panel }}><Undo2 size={14} /> Devolver itens</button>}   {/* v1086 */}
                  {!["RECEBIDA", "CANCELADA"].includes(o.status) && <button onClick={() => cancelarOc(o)} title="Os itens voltam para a cotação (outra OC ou dispensar compras)" className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.red}`, color: C.red }}>Cancelar OC</button>}
                  {o.status !== "CANCELADA" && <button onClick={() => criarRotaColeta(o)} title={o.rota ? "A OC já tem rota de coleta: cria mais uma (ex.: coleta parcial ou remarcada)" : "Abre a demanda de rota preenchida com o fornecedor e a OC"} className="text-sm px-3 py-1.5 rounded-md font-semibold" style={{ background: C.navy, color: "#fff" }}>{o.rota ? "Nova rota de coleta" : "Criar rota de coleta"}</button>}{/* v1096 — a qualquer momento, qualquer forma de recebimento */}
                </div>
                {o.creditoUsado > 0 && <CreditoOc o={o} user={user} onMudou={carregar} />}   {/* v1086 */}
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
                <BaixaOc o={o} user={user} onMudou={carregar} />   {/* v532 — baixa (material recebido) */}
                <div className="flex justify-end mt-3">
                  <button onClick={() => setFotoOc(o)} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.line}`, color: C.navy, background: C.panel }}><FileText size={14} /> Card / WhatsApp</button>
                  <button onClick={() => imprimirOc(o)} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><FileText size={14} /> Imprimir / PDF</button>
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
    x.textAlign = "right"; x.fillStyle = "#0c2342"; x.font = "700 28px Arial";
    if (l.i.comercial) { x.fillText(txtComercial(l.i.comercial), W - P, y + 32); x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText(`= ${qtdU(qBase(l.i), l.i.comercial.unidade)}`, W - P, y + 58); }   // v1059 — como o mercado vende
    else x.fillText(qtdU(l.i.quantidade, l.i.unidade), W - P, y + 32);
    x.textAlign = "left";
    y += l.h; x.strokeStyle = "#e4e7ec"; x.lineWidth = 2; x.beginPath(); x.moveTo(P - 16, y - 10); x.lineTo(W - P + 16, y - 10); x.stroke();
  });
  y += 40;
  x.fillStyle = "#0c2342"; x.font = "700 24px Arial"; x.fillText("Responder para:", P, y);
  x.fillStyle = "#3e5066"; x.font = "22px Arial"; x.fillText("Compras Meridian · Belo Horizonte / MG", P, y + 34); x.fillText("meridianpro.com.br", P, y + 66);
  x.strokeStyle = "#ee6500"; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(P, H - 60); x.lineTo(W - P, H - 60); x.stroke(); x.setLineDash([]);
  return cv;
}
// v1054 — card do PIC em imagem, no padrão do card da cotação: artigos, origens, quantidade, fornecedor, valores e situação
async function desenharPic(p) {
  const W = 1500, P = 56, LH = 26;   // v1057 — valor unitário e total com espaço próprio (não se sobrepõem)
  const c0 = document.createElement("canvas"); const x0 = c0.getContext("2d");
  const quebra = (ctx, t, w) => { const ps = String(t || "").split(/\s+/); const ls = []; let l = ""; for (const q of ps) { const n = l ? `${l} ${q}` : q; if (ctx.measureText(n).width > w && l) { ls.push(l); l = q; } else l = n; } if (l) ls.push(l); return ls.length ? ls : [""]; };
  const col = { n: P, art: P + 44, qtd: 820, forn: 850, vu: 1250, tot: W - P };
  const wArt = col.qtd - 150 - col.art;
  const origem = (i) => [...new Set((i.info?.pedidos || []).map((x) => (x.avulsa ? `Avulsa ${String(x.cliente || "").split("·")[0].replace("AVULSA", "").trim() || x.pedido}` : `Ped. ${x.pedido}${x.cliente ? ` · ${String(x.cliente).trim()}` : ""}`)))].join(" · ");
  const situ = (i) => (i.oc ? `${i.oc.numero}` : (i.cotacoes || []).length && !i.semCotacao ? `${(i.cotacoes || []).map((c) => c.numero).filter((v, k, a) => a.indexOf(v) === k).join(", ")}` : "sem cotação");
  const linhas = p.itens.map((i) => {
    x0.font = "600 22px Arial"; const a = quebra(x0, i.info?.nome || `Artigo #${i.artigoId}`, wArt);
    x0.font = "18px Arial"; const d = quebra(x0, [[i.info?.cor, i.info?.codigo].filter(Boolean).join(" · "), origem(i)].filter(Boolean).join(" — "), wArt);
    x0.font = "18px Arial"; const f = quebra(x0, i._forn || "—", col.vu - 150 - col.forn);
    return { i, a, d, f, h: Math.max(60, 18 + a.length * LH + d.length * 22, 18 + f.length * 22 + 24) };
  });
  const total = p.itens.reduce((s0, i) => s0 + (i._valor || 0) * (i._qtd || 0), 0);
  const H = 250 + 60 + linhas.reduce((s0, l) => s0 + l.h, 0) + 150;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d");
  x.fillStyle = "#ffffff"; x.fillRect(0, 0, W, H); x.fillStyle = "#0c2342"; x.fillRect(0, 0, W, 14);
  const logo = await logoCot();
  if (logo) { const h = 44, w = (logo.naturalWidth || 4117) / (logo.naturalHeight || 601) * h; x.drawImage(logo, P, 50, w, h); }
  else { x.fillStyle = "#0c2342"; x.font = "800 40px Arial"; x.fillText("MERIDIAN", P, 88); }
  x.textAlign = "right"; x.fillStyle = "#ee6500"; x.font = "700 22px Arial"; x.fillText("PEDIDO INTERNO DE COMPRA", W - P, 68);
  x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText(`${new Date(p.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}${p.criadoPorNome ? ` · ${p.criadoPorNome}` : ""}`, W - P, 98); x.textAlign = "left";
  x.fillStyle = "#0c2342"; x.font = "700 40px Arial"; x.fillText(p.numero, P, 170);
  x.fillStyle = "#3e5066"; x.font = "22px Arial"; x.fillText(`${p.itens.length} artigo(s) · ${p.status === "OC" ? "todos em OC" : `${p.itens.filter((i) => !i.oc).length} sem OC`}`, P, 206);
  let y = 250;
  x.fillStyle = "#f1f6fe"; x.fillRect(P - 16, y, W - P * 2 + 32, 50);
  x.fillStyle = "#3d6799"; x.font = "700 18px Arial";
  x.fillText("#", col.n, y + 32); x.fillText("ARTIGO / ORIGEM", col.art, y + 32); x.fillText("FORNECEDOR / SITUAÇÃO", col.forn, y + 32);
  x.textAlign = "right"; x.fillText("QUANTIDADE", col.qtd, y + 32); x.fillText("VALOR UNIT.", col.vu, y + 32); x.fillText("TOTAL", col.tot, y + 32); x.textAlign = "left";
  y += 60;
  const brlS = (n) => (n ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—");
  linhas.forEach((l, k) => {
    x.fillStyle = "#ee6500"; x.font = "700 22px Arial"; x.fillText(String(k + 1), col.n, y + 26);
    x.fillStyle = "#0c2342"; x.font = "600 22px Arial"; l.a.forEach((t, j) => x.fillText(t, col.art, y + 26 + j * LH));
    x.fillStyle = "#667085"; x.font = "18px Arial"; l.d.forEach((t, j) => x.fillText(t, col.art, y + 26 + l.a.length * LH + j * 22));
    x.fillStyle = "#0c2342"; x.font = "18px Arial"; l.f.forEach((t, j) => x.fillText(t, col.forn, y + 24 + j * 22));
    const st = situ(l.i); x.fillStyle = l.i.oc ? "#12A150" : st === "sem cotação" ? "#B54708" : "#C08401"; x.font = "700 16px Arial"; x.fillText(st, col.forn, y + 24 + l.f.length * 22 + 4);
    x.textAlign = "right"; x.fillStyle = "#0c2342"; x.font = "700 24px Arial"; x.fillText(qtdU(l.i._qtd, l.i.info?.unidade), col.qtd, y + 28);
    x.font = "20px Arial"; x.fillText(brlS(l.i._valor), col.vu, y + 28);
    x.font = "700 22px Arial"; x.fillText(brlS((l.i._valor || 0) * (l.i._qtd || 0)), col.tot, y + 28); x.textAlign = "left";
    y += l.h; x.strokeStyle = "#e4e7ec"; x.lineWidth = 2; x.beginPath(); x.moveTo(P - 16, y - 8); x.lineTo(W - P + 16, y - 8); x.stroke();
  });
  y += 30;
  x.textAlign = "right"; x.fillStyle = "#667085"; x.font = "20px Arial"; x.fillText("TOTAL DO PIC", col.tot - 260, y + 6); x.fillStyle = "#0c2342"; x.font = "800 32px Arial"; x.fillText(brlS(total), col.tot, y + 8); x.textAlign = "left";
  x.strokeStyle = "#ee6500"; x.setLineDash([10, 10]); x.lineWidth = 3; x.beginPath(); x.moveTo(P, H - 50); x.lineTo(W - P, H - 50); x.stroke(); x.setLineDash([]);
  return cv;
}
function PicFotoModal({ p, onClose, desenhar = desenharPic, aoEnviar = null }) {   // v1068 — também a OC
  const [img, setImg] = useState(null);
  const [cv, setCv] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { desenhar(p).then((c) => { setCv(c); setImg(c.toDataURL("image/png")); }); }, []);
  const nomeArq = `${p.numero.replace(/\s+/g, "")}-meridian`;
  const enviou = () => { try { aoEnviar && aoEnviar(); } catch {} };
  const blob = () => new Promise((ok) => cv.toBlob(ok, "image/png"));
  const baixar = (href, nome) => { const a = document.createElement("a"); a.href = href; a.download = nome; a.click(); };
  async function copiar() { try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob() })]); enviou(); setMsg("Imagem copiada! Cole no WhatsApp (Ctrl+V)."); setTimeout(() => setMsg(""), 2500); } catch { alerta("O navegador não deixou copiar a imagem. Use Baixar PNG."); } }
  async function pdf() {
    try { const { jsPDF } = await carregarJsPdf(); const w = 297, h = (cv.height / cv.width) * w; const d = new jsPDF({ unit: "mm", format: [w, Math.max(h, 100)], orientation: h > w ? "portrait" : "landscape" }); d.addImage(img, "PNG", 0, 0, w, h); d.save(`${nomeArq}.pdf`); enviou(); }
    catch { alerta("Não consegui gerar o PDF. Use Baixar PNG."); }
  }
  async function compartilhar() { try { const f = new File([await blob()], `${nomeArq}.png`, { type: "image/png" }); await navigator.share({ files: [f], title: p.numero }); enviou(); } catch {} }
  const tel = p.fornecedor ? telWa(p.fornecedor.telefone || p.fornecedor.telefones) : null;
  const podeShare = typeof navigator !== "undefined" && !!navigator.canShare && (() => { try { return navigator.canShare({ files: [new File([""], "a.png", { type: "image/png" })] }); } catch { return false; } })();
  const b = "text-xs px-2.5 py-1.5 rounded-md font-semibold flex items-center gap-1";
  return (
    <Modal titulo={`${p.numero} · card em imagem`} onClose={onClose} largo>
      {img ? <img src={img} alt={p.numero} className="w-full rounded" style={{ border: `1px solid ${C.line}` }} /> : <div className="flex items-center gap-2 text-sm py-6" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Montando…</div>}
      {img && <div className="flex flex-wrap items-center gap-2 mt-2">
        {podeShare && <button onClick={compartilhar} className={b} style={{ background: "#25D366", color: "#fff" }}>Compartilhar</button>}
        <button onClick={copiar} className={b} style={{ background: C.navy, color: "#fff" }}><Copy size={13} /> Copiar imagem</button>
        <button onClick={() => { baixar(img, `${nomeArq}.png`); enviou(); }} className={b} style={{ border: `1px solid ${C.line}`, color: C.text }}>Baixar PNG</button>
        <button onClick={pdf} className={b} style={{ border: `1px solid ${C.line}`, color: C.text }}><FileText size={13} /> Baixar PDF</button>
        {aoEnviar && <a href={tel ? `https://wa.me/${tel}?text=${encodeURIComponent(`Olá! Segue a ordem de compra ${p.numero} da Meridian. Por favor, confirme o recebimento. Obrigado!`)}` : "https://wa.me/"} target="_blank" rel="noreferrer" className={b} style={{ border: "1px solid #25D366", color: "#128C7E" }} title={tel ? `WhatsApp ${tel}` : "Fornecedor sem telefone no cadastro"}>Abrir WhatsApp{tel ? "" : " (sem telefone)"}</a>}
        {msg && <span className="text-xs font-semibold" style={{ color: C.green }}>{msg}</span>}
      </div>}
    </Modal>
  );
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
// v1059 — unidade comercial na cotação (como o mercado vende): tecido plano = rolo de 100 m, malha = peça de 20 kg, aviamento livre
const qPreco = (i) => (i?.comercial && Number(i.comercial.qtd) > 0 && Number(i.comercial.fator) > 0 ? Number(i.comercial.qtd) : Number(i?.quantidade) || 0);   // v1070 — valor é por embalagem
const fatorC = (i) => (i?.comercial && Number(i.comercial.qtd) > 0 && Number(i.comercial.fator) > 0 ? Number(i.comercial.fator) : 1);
const porEmb = (i) => (i?.comercial ? `por ${String(i.comercial.tipo || "").toLowerCase()}` : null);
const qBase = (i) => (i?.comercial && Number(i.comercial.qtd) > 0 && Number(i.comercial.fator) > 0 ? Number(i.comercial.qtd) * Number(i.comercial.fator) : Number(i?.quantidade) || 0);
const txtComercial = (c) => `${String(c.qtd).replace(".", ",")} ${c.tipo}${Number(c.qtd) > 1 && !/S$/.test(c.tipo) ? "S" : ""} × ${String(c.fator).replace(".", ",")} ${c.unidade}`;
const EMBALAGENS = ["ROLO", "PEÇA", "UNIDADE", "CAIXA", "PACOTE", "CONE", "GROSA", "MILHEIRO", "FARDO", "BOBINA"];
function padraoComercial(i) {
  const cat = String(i.categoria || "").toUpperCase(), un = String(i.unidade || "").toUpperCase();
  if (cat === "TECIDO") return { tipo: "ROLO", fator: "100", unidade: un === "KG" ? "KG" : "M" };
  if (cat === "MALHA") return { tipo: "PEÇA", fator: "20", unidade: un === "M" ? "M" : "KG" };
  return { tipo: "", fator: "", unidade: un || "UN" };
}
function ComercialEditor({ i, onSalvar, onTirar, onFechar }) {
  const p0 = i.comercial ? { tipo: i.comercial.tipo, fator: numBR(i.comercial.fator), unidade: i.comercial.unidade } : padraoComercial(i);
  const [f, setF] = useState({ ...p0, qtd: i.comercial ? numBR(i.comercial.qtd) : "" });
  const [qtdMexida, setQtdMexida] = useState(!!i.comercial);
  const fator = lerNum(f.fator), real = Number(i.quantidade) || 0;
  const sugerida = fator > 0 ? Math.ceil(real / fator - 1e-9) : null;
  const qtd = qtdMexida ? lerNum(f.qtd) : sugerida;
  const base = qtd > 0 && fator > 0 ? qtd * fator : null;
  const inpC = "px-2 py-1 rounded text-sm outline-none";
  return (
    <div className="mt-1 mb-2 rounded-lg p-3" style={{ background: "#fff", border: `1px solid ${C.accent}` }}>
      <div className="flex flex-wrap items-end gap-2 text-xs" style={{ color: C.sub }}>
        <label>Embalagem<input list="ce-embalagens" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value.toUpperCase() })} placeholder="ROLO, PEÇA…" className={`${inpC} block mt-1 w-28`} style={{ border: `1px solid ${C.line}` }} /></label>
        <datalist id="ce-embalagens">{EMBALAGENS.map((x) => <option key={x} value={x} />)}</datalist>
        <span className="pb-1.5">de</span>
        <label>X<input value={f.fator} onChange={(e) => setF({ ...f, fator: e.target.value })} inputMode="decimal" placeholder="100" className={`${inpC} block mt-1 w-20 text-right`} style={{ border: `1px solid ${C.line}` }} /></label>
        <label>Unidade<select value={f.unidade} onChange={(e) => setF({ ...f, unidade: e.target.value })} className={`${inpC} block mt-1`} style={{ border: `1px solid ${C.line}` }}>{[...new Set(["M", "KG", "UN", "CM", "PC", String(f.unidade || "")].filter(Boolean))].map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
        <label className="ml-2">Comprar (nº de {f.tipo ? f.tipo.toLowerCase() : "embalagens"})<input value={qtdMexida ? f.qtd : sugerida ?? ""} onChange={(e) => { setQtdMexida(true); setF({ ...f, qtd: e.target.value }); }} inputMode="decimal" className={`${inpC} block mt-1 w-24 text-right font-semibold`} style={{ border: `1px solid ${C.accent}` }} /></label>
      </div>
      <div className="flex flex-wrap gap-3 mt-3 text-sm">
        <div className="rounded-md px-3 py-1.5" style={{ background: C.panel2 }}><div className="text-[10px] font-semibold uppercase" style={{ color: C.sub }}>Demanda real</div><b style={{ color: C.navy }}>{qtdU(real, i.unidade)}</b></div>
        <div className="rounded-md px-3 py-1.5" style={{ background: C.accentSoft }}><div className="text-[10px] font-semibold uppercase" style={{ color: C.accent }}>Comercial (vai para a OC)</div>
          <b style={{ color: C.navy }}>{base ? `${txtComercial({ tipo: f.tipo || "EMB.", fator, unidade: f.unidade, qtd })} = ${qtdU(base, f.unidade)}` : "—"}</b>
          {base && real > 0 && Math.abs(base - real) > 1e-9 && <span className="text-xs ml-1" style={{ color: base > real ? C.sub : C.red }}>({base > real ? "+" : ""}{qtdU(base - real, f.unidade)})</span>}</div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {i.comercial && <button onClick={onTirar} className="text-xs px-2.5 py-1.5 rounded-md mr-auto" style={{ color: C.red }}>Voltar à unidade padrão</button>}
        <button onClick={onFechar} className="text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, color: C.sub }}>Cancelar</button>
        <button disabled={!base || !f.tipo} onClick={() => onSalvar({ tipo: f.tipo, fator: f.fator, unidade: f.unidade, qtd: String(qtd).replace(".", ",") })} className="text-xs px-3 py-1.5 rounded-md font-semibold disabled:opacity-50" style={{ background: C.accent, color: "#fff" }}>Salvar</button>
      </div>
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
  try { (window.__ocRota ||= {})[o.id] = o; } catch {}   // v1060 — a demanda nova anexa a OC em PNG
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
  const [porM, setPorM] = useState({});   // v1101 — "ci|k": o valor negociado digitado é pela unidade inicial (m/kg), não pelo rolo
  const vEmb = (i, ci, k) => { const n = lerNum(f.itens[ci][k]?.valorNegociado) || 0; return porM[`${ci}|${k}`] ? n * fatorC(i) : n; };
  const [f, setF] = useState({ itens: cs.map((c) => c.itens.map((i) => ({ valorNegociado: numBR(i.valorNegociado ?? i.valorUnitario) }))), prazoEntrega: cs.map((c) => c.prazoEntrega).filter(Boolean).sort().pop() || "", forma: "", dias: "", condicao: cs.find((c) => c.condicao)?.condicao || "" });
  const [oc, setOc] = useState(false);
  const tot = cs.reduce((s1, c, ci) => s1 + c.itens.reduce((s0, i, k) => s0 + (i.naoTem ? 0 : vEmb(i, ci, k)) * qPreco(i), 0), 0);   // v1059 · v1070 · v1101
  async function gerar() {
    if (!f.forma) return alerta("Escolha a forma de recebimento.");
    const jo = await perguntarJuntarOc([cs[0].fornecedorId]);   // v1072
    setOc(true);
    const r = await fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "gerarOc", juntarOc: jo[Number(cs[0].fornecedorId)] || null, cotacoes: cs.map((c, ci) => ({ id: c.id, itens: c.itens.map((i, k) => (porM[`${ci}|${k}`] ? { valorNegociado: valBR(Math.round(vEmb(i, ci, k) * 1e6) / 1e6) } : f.itens[ci][k])) })), prazoEntrega: f.prazoEntrega, forma: f.forma, diasAposFaturamento: f.dias, condicao: f.condicao, quem: nomeUser(user) }) });
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
      <div className="flex px-1 py-1 text-xs font-semibold gap-2" style={{ color: C.sub }}><div className="flex-1">Artigo</div><div className="w-24 text-right">Qtd</div><div className="w-24 text-right">Cotado</div><div className="w-28 text-right">Negociado</div><div className="w-24 text-right">Total</div></div>
      {cs.map((c, ci) => (
        <React.Fragment key={c.id}>
          {cs.length > 1 && <div className="text-[11px] font-bold px-1 pt-2" style={{ color: C.accent }}>{c.numero}{c.pics ? ` · ${c.pics}` : ""}</div>}
          {c.itens.map((i, k) => i.naoTem ? <div key={k} className="px-1 py-1.5 text-xs" style={{ borderTop: `1px solid ${C.line}`, color: C.sub }}><s>{i.nome}</s> · fornecedor não tem (fica no PIC)</div> : (
            <div key={k} className="flex px-1 py-1.5 gap-2 items-center text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex-1 min-w-0 truncate">{i.nome} <span className="text-xs" style={{ color: C.sub }}>{i.det}</span></div>
              <div className="w-24 text-right">{i.comercial ? <><div className="font-semibold" style={{ color: C.accent }}>{txtComercial(i.comercial)}</div><div className="text-[11px]" style={{ color: C.sub }}>= {qtdU(qBase(i), i.comercial.unidade)}</div></> : qtdU(i.quantidade, i.unidade)}</div>
              <div className="w-24 text-right" style={{ color: C.sub }}>{brlU(i.valorUnitario)}{i.comercial && <><div className="text-[10px]">{porEmb(i)}</div><div className="text-[10px]">= {brlU((Number(i.valorUnitario) || 0) / fatorC(i))}/{String(i.comercial.unidade || "").toLowerCase()}</div></>}</div>
              <div className="w-28 text-right"><input value={f.itens[ci][k]?.valorNegociado || ""} onChange={(e) => setF((x) => ({ ...x, itens: x.itens.map((arr, cj) => (cj !== ci ? arr : arr.map((y, j) => (j === k ? { valorNegociado: e.target.value } : y)))) }))} className={`${inp} w-24 text-right`} style={{ border: `1px solid ${C.line}` }} />
                {i.comercial && <div className="flex justify-end gap-1 mt-0.5 text-[10px]" title="O valor digitado é por rolo ou pela unidade inicial (m/kg)?">{[[false, porEmb(i)], [true, `por ${String(i.comercial.unidade || "").toLowerCase()}`]].map(([m, t]) => { const on = !!porM[`${ci}|${k}`] === m; return <button key={t} type="button" onClick={() => setPorM((o) => ({ ...o, [`${ci}|${k}`]: m }))} className="px-1.5 rounded font-semibold" style={on ? { background: C.accent, color: "#fff" } : { color: C.accent, border: `1px solid ${C.accent}` }}>{t}</button>; })}</div>}
                {i.comercial && porM[`${ci}|${k}`] && <div className="text-[10px]" style={{ color: C.sub }}>= {brlU(vEmb(i, ci, k))} {porEmb(i)}</div>}</div>
              <div className="w-24 text-right font-semibold" style={{ color: C.navy }}>{brl(vEmb(i, ci, k) * qPreco(i))}</div>
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
    <div className="px-5 py-2.5 flex flex-wrap items-center gap-2" style={{ borderTop: `1px solid ${C.line}`, background: arr ? C.accentSoft : undefined }}
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
  const [filtro, setFiltro] = useState("andamento");   // v1049 — abre em andamento (sem OC)
  const [ed, setEd] = useState({});   // { cotId: { itens: [...], condicao, prazoEntrega, obs } }
  const [card, setCard] = useState(null);
  const [edCom, setEdCom] = useState(null);   // v1059 — "cotId|k" com a unidade comercial em edição
  const [porBase, setPorBase] = useState({});   // v1100 — "cotId|k" → { txt }: valor digitado na unidade inicial (m, kg…), guardado por embalagem
  const [gerOc, setGerOc] = useState(null);   // v479
  const [forns, setForns] = useState(_fornPic || []);   // v491 — para ligar a cotação ao cadastro
  useEffect(() => { if (!_fornPic) fetch("/api/fornecedores").then((r) => r.json()).then((x) => { _fornPic = Array.isArray(x) ? x : []; setForns(_fornPic); }).catch(() => {}); }, []);
  const [vinc, setVinc] = useState({});
  const [abertos, setAbertos] = useState({});   // v509
  const carregar = () => fetch("/api/compras/cotacoes").then((r) => r.json()).then((x) => { setL(Array.isArray(x) ? x : []); setEd({}); }).catch(() => setL([]));
  useEffect(() => { carregar(); }, []);
  const dados = (c) => ed[c.id] || { itens: c.itens.map((i) => ({ valorUnitario: valBR(i.valorUnitario), prazo: i.prazo || "", obs: i.obs || "", naoTem: !!i.naoTem })), condicao: c.condicao || "", prazoEntrega: c.prazoEntrega || "", obs: c.obs || "" };
  const setD = (c, f) => setEd((e) => ({ ...e, [c.id]: f(dados(c)) }));
  const [prazoU, setPrazoU] = useState(null);   // v1075 — cotação com o campo do prazo único aberto
  const post = async (body, ok) => { const r = await fetch("/api/compras/cotacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const x = await r.json().catch(() => ({})); if (!r.ok) { alerta(x.error || "Erro."); return null; } if (ok) await alerta(ok(x)); carregar(); return x; };
  // menor preço de cada artigo entre as cotações (para comparar fornecedores)
  const melhor = useMemo(() => { const m = {}; for (const c of l || []) for (const i of c.itens) if (i.valorUnitario != null && !i.naoTem) { const k = `${i.nome}|${i.det}|${i.unidade}`; const vb = i.valorUnitario / fatorC(i); if (!m[k] || vb < m[k].v) m[k] = { v: vb, f: c.fornecedorNome, n: c.numero }; } /* v1070 — compara pela unidade base */ return m; }, [l]);
  const ehOc = (c) => c.status === "OC" || c.status === "APLICADA";
  // v1049 — guias iguais às de PIC e OC: em andamento (ainda sem OC) · baixadas (com OC) · todas
  const ABAS = [["andamento", "Em andamento", Clock], ["OC", "Baixadas", PackageCheck], ["todas", "Todas", Layers]];
  const conta = (k) => (l || []).filter((c) => (k === "OC" ? ehOc(c) : !ehOc(c))).length;
  const vis = (l || []).filter((c) => filtro === "todas" || (filtro === "OC" ? ehOc(c) : !ehOc(c)));
  const inp = "px-2 py-1 rounded text-sm outline-none";
  return (
    <div className="w-full">
      <FasesCompras atual="comprasCotacoes" fases={fases} ir={ir} />
      <p className="text-sm mb-3" style={{ color: C.sub }}>Todas as cotações geradas no <b>PIC</b>, uma por fornecedor: <b>geradas</b>, <b>enviadas</b> (ao copiar, baixar ou abrir no WhatsApp), <b>respondidas</b> (quando você registra o valor) e <b>com OC</b>. Na respondida, <b>Gerar OC</b> pede o valor negociado, o prazo e a forma de recebimento. O menor preço entre as cotações de cada artigo aparece em verde.</p>
      <Guias abas={ABAS.map(([k, t0, I]) => [k, k === "todas" ? t0 : `${t0} (${conta(k)})`, I])} atual={filtro} onChange={setFiltro}
        direita={<button onClick={carregar} title="Atualizar" className="p-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>} />
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !vis.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Nenhuma cotação aqui. Gere pelo PIC (botão Gerar cotação).</div>}
      {card && <CotacaoModal cot={card} onClose={() => { setCard(null); carregar(); }} />}
      {gerOc && <GerarOcCotacao cs={gerOc} user={user} onClose={() => setGerOc(null)} onOk={() => { setGerOc(null); carregar(); }} />}
      {vis.map((c) => {
        const d = dados(c), trav = false, comOc = ehOc(c);   // v487 — cotação sempre editável
        const [txt, cor, fundo] = ST_COT[c.status] || ST_COT.ENVIADA;
        const tot = c.itens.reduce((s0, i, k) => s0 + (d.itens[k]?.naoTem ? 0 : (lerNum(d.itens[k]?.valorUnitario) || 0)) * qPreco(i), 0);   // v1059 · v1070 — nº de embalagens × valor da embalagem
        const aberto = abertos[c.id] ?? !comOc;   // v509 — com OC começa recolhida
        const resp = c.itens.filter((i, k) => d.itens[k]?.naoTem || lerNum(d.itens[k]?.valorUnitario) > 0).length;
        const lbl = "text-[10px] font-semibold uppercase tracking-wide";
        return (
          <div key={c.id} className="rounded-xl mb-5 overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `5px solid ${cor}`, boxShadow: "0 1px 3px rgba(16,24,40,.06)" }}>
            {/* v509 — cabeçalho limpo: nº grande + fornecedor, resumo à direita; clique abre/fecha */}
            <div onClick={() => setAbertos((m) => ({ ...m, [c.id]: !aberto }))} className="flex items-center gap-4 px-5 py-3.5 cursor-pointer select-none" style={{ background: aberto ? "#FAFBFC" : C.panel }}>
              {aberto ? <ChevronDown size={18} style={{ color: C.sub }} /> : <ChevronRight size={18} style={{ color: C.sub }} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: fundo, color: cor }}>{c.numero}</span>
                  <span className="text-base font-bold truncate" style={{ color: C.navy }}>{c.fornecedorNome}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: C.sub }}>{new Date(c.createdAt).toLocaleDateString("pt-BR")}{c.pics ? ` · ${c.pics}` : ""}{c.criadoPorNome ? ` · ${c.criadoPorNome}` : ""} · {c.itens.length} item(ns) · {resp}/{c.itens.length} respondido(s){(c.arquivos || []).length ? ` · 📎 ${c.arquivos.length}` : ""}</div>
              </div>
              {!c.fornecedorId && (   // v491 — sem cadastro não gera OC: liga ao cadastro aqui
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-semibold" style={{ color: C.red }}>fora do cadastro</span>
                  <div className="w-56"><BuscaFornecedor valor={vinc[c.id] ?? ""} forns={forns} placeholder="ligar ao fornecedor do cadastro" estilo={{ border: `1px solid ${C.red}`, fontSize: 12, padding: "3px 8px" }}
                    onEscolher={async (f, txt) => { setVinc((m) => ({ ...m, [c.id]: f ? nomeFornCad(f) : txt })); if (f) { const x = await post({ acao: "vincular", id: c.id, fornecedorId: f.id }); if (x?.cotacoes > 1) alerta(`${x.cotacoes} cotações de ${c.fornecedorNome} ligadas a ${nomeFornCad(f)}.`); } }} /></div>
                </div>
              )}
              <div className="text-right shrink-0">
                <div className={lbl} style={{ color: C.sub }}>Total</div>
                <div className="text-lg font-bold leading-tight" style={{ color: tot > 0 ? C.navy : C.sub }}>{tot > 0 ? brl(tot) : "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Chip cor={cor} fundo={fundo}>{txt}</Chip>
                {comOc && c.ocNumero && <span className="text-[11px] font-bold" style={{ color: C.green }}>{c.ocNumero}</span>}
              </div>
            </div>

            {aberto && <>
              {/* itens */}
              <div className="px-5 pb-2" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="flex gap-3 pt-3 pb-1.5" style={{ color: C.sub }}>
                  <div className={`flex-1 ${lbl}`}>Artigo</div><div className={`w-36 text-right ${lbl}`}>Quantidade</div><div className={`w-28 text-right ${lbl}`}>Valor unit.</div><div className="w-36 relative flex items-center gap-1.5"><span className={lbl}>Prazo</span>
                    {/* v1001 — prazo único · v1075 — só um "U": abre o campo, ao escolher a data todos os artigos recebem e fecha; laranja = prazo único aplicado */}
                    {(() => { const ps = d.itens.filter((y) => !y.naoTem).map((y) => y.prazo || ""); const igual = ps.length && ps[0] && ps.every((p) => p === ps[0]) ? ps[0] : "";
                      const aberto = prazoU === c.id;
                      const aplicar = (v) => { if (v) setD(c, (x) => ({ ...x, itens: x.itens.map((y) => (y.naoTem ? y : { ...y, prazo: v })) })); setPrazoU(null); };
                      return <>
                        <button type="button" onClick={() => setPrazoU(aberto ? null : c.id)} title={igual ? `Prazo único aplicado: ${igual.split("-").reverse().join("/")} (clique para trocar)` : "Prazo único: o mesmo prazo de entrega para todos os artigos (menos os que o fornecedor não tem)"}
                          className="rounded font-bold flex items-center justify-center" style={{ width: 18, height: 18, fontSize: 10, lineHeight: 1, background: igual ? C.accent : "#fff", color: igual ? "#fff" : C.sub, border: `1px solid ${igual ? C.accent : C.line}` }}>U</button>
                        {aberto && <div className="absolute left-0 top-full mt-1 z-20 rounded-md shadow-lg p-1.5" style={{ background: "#fff", border: `1px solid ${C.accent}` }}>
                          <input type="date" autoFocus defaultValue={igual} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && Number(e.target.value.slice(0, 4)) > 2000) aplicar(e.target.value); }}
                            onBlur={(e) => aplicar(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aplicar(e.currentTarget.value); if (e.key === "Escape") setPrazoU(null); }}
                            className={inp} style={{ border: `1px solid ${C.line}`, background: "#fff", fontSize: 12 }} /></div>}
                      </>; })()}
                  </div><div className={`w-16 text-center ${lbl}`}>Não tem</div><div className={`w-28 text-right ${lbl}`}>Total</div>
                </div>
                {c.itens.map((i, k) => {
                  const di = d.itens[k] || {}; const v = lerNum(di.valorUnitario);
                  const m = melhor[`${i.nome}|${i.det}|${i.unidade}`];
                  const eMelhor = m && v != null && v / fatorC(i) <= m.v + 1e-9;
                  return (
                    <React.Fragment key={k}>
                    <div className="flex gap-3 items-center text-sm rounded-lg px-2 -mx-2 py-2.5" style={{ background: k % 2 ? "transparent" : "#F8F9FB", opacity: di.naoTem ? 0.55 : 1 }}>
                      <div className="flex-1 min-w-0 flex items-start gap-2.5">
                        <span className="shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5" style={{ width: 22, height: 22, background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>{k + 1}</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate" style={{ color: C.text, textDecoration: di.naoTem ? "line-through" : "none" }} title={i.nome}>{i.nome}</div>
                          {i.det && <div className="text-[11px] truncate" style={{ color: C.sub }}>{i.det}</div>}
                          {(i.origens || []).length > 0 && <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.sub }}>{(i.origens || []).map((o) => (o.avulsa ? "Avulsa" : rotOrigem(o))).filter((x, j, a) => a.indexOf(x) === j).join(" · ")}{!comOc && <BotaoDispensar origens={i.origens} user={user} onFeito={carregar} artigo={i.artigoId ? { id: i.artigoId, nome: i.nome } : undefined} />}</div>}   {/* v913 */}
                          <DocsOrigem l={i.origens} user={user} />
                          {comOc && i.valorNegociado != null && !di.naoTem && <div className="text-[11px] font-semibold" style={{ color: C.green }}>negociado na {c.ocNumero}: {brl(i.valorNegociado)}</div>}
                          {m && m.n !== c.numero && <div className="text-[11px]" style={{ color: C.sub }}>menor preço: <b style={{ color: C.green }}>{brl(m.v * fatorC(i))}</b>{porEmb(i) ? ` ${porEmb(i)}` : ""} · {m.f}</div>}
                          {i.previstoFpp != null && !di.naoTem && (() => {   // v528 — valor previsto na FPP: confirmar com um clique
                            const ok = v != null && Math.abs(v - i.previstoFpp) < 0.00005;
                            const dif = v != null && !ok ? (v / i.previstoFpp - 1) * 100 : null;
                            return <div className="text-[11px] flex items-center gap-1.5 flex-wrap" style={{ color: C.sub }}>previsto na FPP: <b style={{ color: C.navy }}>{brl(i.previstoFpp)}</b>
                              {ok ? <span className="font-semibold" style={{ color: C.green }}>✓ confirmado</span>
                                : <button type="button" onClick={() => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, valorUnitario: valBR(i.previstoFpp) } : y)) }))} className="px-1.5 rounded font-semibold" style={{ border: `1px solid ${C.green}`, color: C.green }}>confirmar valor da FPP</button>}
                              {dif != null && <span style={{ color: dif > 0 ? C.red : C.green }}>{dif > 0 ? "+" : ""}{dif.toFixed(1).replace(".", ",")}% vs FPP</span>}</div>;
                          })()}
                        </div>
                      </div>
                      <div className="w-36 text-right whitespace-nowrap" style={{ color: C.text }}>   {/* v1059 — real × comercial · v1066 — comercial numa linha só */}
                        {i.comercial ? <><div className="text-[11px]" style={{ color: C.sub }} title="Demanda real">{qtdU(i.quantidade, i.unidade)}</div><div className="font-semibold" style={{ color: C.accent }} title="Quantidade comercial (vai para a OC)">{txtComercial(i.comercial)}</div></> : qtdU(i.quantidade, i.unidade)}
                        {!comOc && <button type="button" onClick={() => setEdCom(`${c.id}|${k}`)} className="text-[10px] underline decoration-dotted" style={{ color: C.accent }}>{i.comercial ? "editar unidade" : "unidade comercial"}</button>}
                      </div>
                      <div className="w-28 text-right relative">{di.naoTem ? <span className="text-xs font-semibold" style={{ color: C.red }}>não tem</span> : (() => { const kb = `${c.id}|${k}`, pb = porEmb(i) ? porBase[kb] : null, fat = fatorC(i);   // v1100 — valor por embalagem (rolo) ou pela unidade inicial (m)
                        const gravar = (txt, fim) => { const n = lerNum(txt); setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, valorUnitario: pb ? (n == null ? "" : valBR(Math.round(n * fat * 1e6) / 1e6)) : (fim && n != null ? valBR(n) : txt) } : y)) })); };
                        return <input value={pb ? pb.txt : di.valorUnitario} onChange={(e) => { if (pb) setPorBase((o) => ({ ...o, [kb]: { txt: e.target.value } })); gravar(e.target.value, false); }}
                          onBlur={(e) => { if (pb) { const n = lerNum(e.target.value); if (n != null) setPorBase((o) => ({ ...o, [kb]: { txt: valBR(n) } })); } gravar(e.target.value, true); }}
                          title={pb ? `Valor por ${String(i.comercial.unidade || i.unidade || "").toLowerCase()}: vai para a OC como ${brl((lerNum(pb.txt) || 0) * fat)} ${porEmb(i)}` : ""}
                          placeholder="0,00" className={`${inp} w-full text-right`} style={{ border: `1px solid ${eMelhor ? C.green : C.line}`, background: eMelhor ? C.greenSoft : "#fff" }} />; })()}
                        {!di.naoTem && porEmb(i) && (() => { const kb = `${c.id}|${k}`, pb = porBase[kb], un = String(i.comercial.unidade || i.unidade || "").toLowerCase(), fat = fatorC(i);
                          const ir = (base) => setPorBase((o) => { const n = { ...o }; if (base) { const v = lerNum(di.valorUnitario); n[kb] = { txt: v == null ? "" : valBR(Math.round((v / fat) * 1e6) / 1e6) }; } else delete n[kb]; return n; });
                          return <div className="absolute right-0 top-full flex gap-1 text-[10px] whitespace-nowrap mt-0.5">
                            <button type="button" onClick={() => ir(false)} className="px-1.5 rounded font-semibold" style={!pb ? { background: C.accent, color: "#fff" } : { color: C.accent, border: `1px solid ${C.accent}` }}>{porEmb(i)}</button>
                            <button type="button" onClick={() => ir(true)} className="px-1.5 rounded font-semibold" style={pb ? { background: C.accent, color: "#fff" } : { color: C.accent, border: `1px solid ${C.accent}` }}>por {un}</button>
                          </div>; })()}</div>
                      <div className="w-36">{di.naoTem ? "" : <input type="date" value={di.prazo} onChange={(e) => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, prazo: e.target.value } : y)) }))} className={`${inp} w-full`} style={{ border: `1px solid ${C.line}`, background: "#fff" }} />}</div>
                      <div className="w-16 text-center">{/* v484 */}<input type="checkbox" checked={!!di.naoTem} title="O fornecedor não tem este item" onChange={(e) => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (j === k ? { ...y, naoTem: e.target.checked, ...(e.target.checked ? { valorUnitario: "", prazo: "" } : {}) } : y)) }))} /></div>
                      <div className="w-28 text-right font-semibold" style={{ color: v && !di.naoTem ? C.navy : C.sub }}>{v && !di.naoTem ? brl(v * qPreco(i)) : "—"}</div>
                    </div>
                    {edCom === `${c.id}|${k}` && <ComercialEditor i={i} onFechar={() => setEdCom(null)}
                      onSalvar={async (com) => { const x = await post({ acao: "comercial", id: c.id, k, comercial: com }); if (x) setEdCom(null); }}
                      onTirar={async () => { const x = await post({ acao: "comercial", id: c.id, k, comercial: null }); if (x) setEdCom(null); }} />}
                    </React.Fragment>
                  );
                })}
              </div>

              {c.itens.some((i, k) => i.previstoFpp != null && !d.itens[k]?.naoTem && lerNum(d.itens[k]?.valorUnitario) !== i.previstoFpp) && (   // v528
                <div className="px-5 pb-2 flex justify-end">
                  <button type="button" onClick={() => setD(c, (x) => ({ ...x, itens: x.itens.map((y, j) => (c.itens[j]?.previstoFpp != null && !y.naoTem && !lerNum(y.valorUnitario) ? { ...y, valorUnitario: valBR(c.itens[j].previstoFpp) } : y)) }))}
                    className="text-xs px-3 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.green}`, color: C.green, background: C.panel }} title="Preenche os itens ainda sem valor com o valor previsto na FPP">Confirmar valores da FPP nos itens sem valor</button>
                </div>
              )}
              {/* resposta do fornecedor — v528: condição e entrega lado a lado, observação em linha própria (não sobrepõe) */}
              <div className="px-5 py-3 space-y-3" style={{ borderTop: `1px solid ${C.line}`, background: "#FAFBFC" }}>
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1" style={{ minWidth: 180, maxWidth: 260 }}>
                    <div className={lbl} style={{ color: C.sub }}>Condição de pagamento</div>
                    <input value={d.condicao} onChange={(e) => setD(c, (x) => ({ ...x, condicao: e.target.value }))} placeholder="ex.: 30/60 dias" className={`${inp} block mt-1 w-full`} style={{ border: `1px solid ${C.line}`, color: C.text, background: "#fff" }} />
                  </div>
                  <div style={{ width: 170 }}>
                    <div className={lbl} style={{ color: C.sub }}>Entrega prevista</div>
                    <input type="date" value={d.prazoEntrega} onChange={(e) => setD(c, (x) => ({ ...x, prazoEntrega: e.target.value }))} className={`${inp} block mt-1 w-full`} style={{ border: `1px solid ${C.line}`, color: C.text, background: "#fff" }} />
                  </div>
                </div>
                <div>
                  <div className={lbl} style={{ color: C.sub }}>Observação</div>
                  <textarea rows={2} value={d.obs} onChange={(e) => setD(c, (x) => ({ ...x, obs: e.target.value }))} placeholder="observações do fornecedor sobre a cotação" className={`${inp} block mt-1 w-full resize-y`} style={{ border: `1px solid ${C.line}`, color: C.text, background: "#fff", minHeight: 52 }} />
                </div>
              </div>
              <ArquivosCotacao c={c} user={user} onMudou={() => fetch("/api/compras/cotacoes").then((r) => r.json()).then((x) => Array.isArray(x) && setL(x)).catch(() => {})} />

              {/* ações: secundárias à esquerda, principais à direita */}
              <div className="flex flex-wrap items-center gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
                <button onClick={() => setCard({ pic: c.pics || "", grupos: [{ id: c.id, numero: c.numero, fornecedor: c.fornecedor, itens: c.itens }] })} className="text-xs px-3 py-1.5 rounded-md font-semibold flex items-center gap-1" style={{ border: `1px solid ${C.line}`, color: C.navy, background: C.panel }}><FileText size={13} /> Card / WhatsApp</button>
                {c.status === "GERADA" && <button onClick={() => post({ acao: "enviada", id: c.id })} className="text-xs px-3 py-1.5 rounded-md" style={{ border: `1px solid ${C.line}`, color: C.text, background: C.panel }}>Marcar enviada</button>}
                {!comOc && <button onClick={async () => { if (await confirmar(`Cancelar a ${c.numero}?`)) post({ acao: "cancelar", id: c.id }); }} className="text-xs px-3 py-1.5 rounded-md" style={{ color: C.red, background: "transparent" }}>Cancelar cotação</button>}
                {comOc && c.ocNumero && <ChipRota r={c.rota} forma={c.ocForma} />}
                {!comOc && (() => {   // v1051 — outras cotações abertas do mesmo fornecedor: juntar nesta
                  const irm = (l || []).filter((y) => y.id !== c.id && !ehOc(y) && (c.fornecedorId ? y.fornecedorId === c.fornecedorId : norm(y.fornecedorNome) === norm(c.fornecedorNome)));
                  if (!irm.length) return null;
                  return <button onClick={async () => {
                    if (!(await confirmar(`Juntar ${irm.map((y) => y.numero).join(", ")} nesta ${c.numero} (${c.fornecedorNome})?\nOs itens iguais são somados, as outras cotações são canceladas e esta volta para "gerada" para reenviar ao fornecedor.`))) return;
                    const x = await post({ acao: "juntar", id: c.id, ids: irm.map((y) => y.id) }); if (!x) return;
                    await alerta(`${x.juntadas.join(", ")} juntada(s) na ${c.numero}.`); carregar();
                  }} title="Uma cotação só por fornecedor" className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ border: `1px solid ${C.navy}`, color: C.navy, background: C.panel }}><Merge size={14} /> Juntar {irm.map((y) => y.numero).join(", ")}</button>;
                })()}
                <div className="flex-1" />
                <button onClick={() => post({ acao: "responder", id: c.id, ...d })} className="text-sm px-4 py-1.5 rounded-md font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent, background: C.panel }}>Salvar resposta</button>
                {!comOc && <button onClick={async () => {   // v479 — OC a partir da cotação respondida
                  if (!d.itens.some((x) => !x.naoTem && lerNum(x.valorUnitario) > 0)) return alerta(d.itens.every((x) => x.naoTem) ? "O fornecedor não tem nenhum item: não há OC a gerar." : "Registre a resposta do fornecedor (valor unitário) antes de gerar a OC.");
                  const x = await post({ acao: "responder", id: c.id, ...d }); if (!x) return;
                  const atual = { ...c, ...x.cotacao, itens: x.cotacao.itens };
                  // v488 · v1051 — outras cotações do mesmo fornecedor ainda sem OC (geradas, enviadas ou respondidas, com valor salvo
                  //   ou digitado na tela): pergunta se consolida tudo numa OC só; as respostas digitadas são salvas antes
                  const mesmoForn = (y) => y.id !== c.id && !ehOc(y) && (c.fornecedorId ? y.fornecedorId === c.fornecedorId : norm(y.fornecedorNome) === norm(c.fornecedorNome));
                  const comValor = (y) => dados(y).itens.some((i) => !i.naoTem && lerNum(i.valorUnitario) > 0);
                  const outras = (l || []).filter(mesmoForn);
                  const irmas = outras.filter(comValor), semResp = outras.filter((y) => !comValor(y));
                  let junta = [];
                  if (irmas.length) {
                    const tot = (y) => brl(y.itens.reduce((s0, i, k) => s0 + (dados(y).itens[k]?.naoTem ? 0 : (lerNum(dados(y).itens[k]?.valorUnitario) || 0) * qPreco(i)), 0));   // v1070
                    const ok = await confirmar(`${c.fornecedorNome} tem outras cotações sem OC:\n${irmas.map((y) => `• ${y.numero} · ${y.pics || ""} · ${y.itens.length} item(ns) · ${tot(y)}`).join("\n")}${semResp.length ? `\n(${semResp.map((y) => y.numero).join(", ")} ainda sem valor: fica(m) fora)` : ""}\n\nConsolidar tudo numa OC só?`);
                    if (ok) for (const y of irmas) { const r = await post({ acao: "responder", id: y.id, ...dados(y) }); if (r) junta.push({ ...y, ...r.cotacao, itens: r.cotacao.itens }); }
                  }
                  setGerOc([atual, ...junta]);
                }} className="text-sm px-4 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ background: C.accent, color: "#fff" }}><ShoppingCart size={14} /> Gerar OC</button>}
              </div>
            </>}
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
const ETAPAS_PRE = [["LEVANTAMENTO", "Pendente", "#3D6799", "#EEF3FB"], ["ESTOQUE", "Atendido pelo estoque", C.green, C.greenSoft], ["REPROVADO", "Vai para compra", C.red, C.redSoft]];   // v495
const ETAPAS = [["SEM_COTACAO", "Aguardando cotação", "#B54708", "#FEF0C7"], ["EM_COTACAO", "Em cotação", C.accent, C.accentSoft],   // v1044 — no PIC sem cotação gerada
  ["AGUARDANDO_NF", "Aguardando NF", C.yellow, C.yellowSoft], ["EM_COLETA", "Em coleta", C.blue, C.blueSoft],
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
  // v1050 — ordenar clicando no título da coluna (clicar de novo inverte)
  const [ord, setOrd] = useState({ k: null, d: 1 });
  const ordemEtapa = Object.fromEntries([...ETAPAS_PRE, ...ETAPAS].map(([k], n) => [k, n]));
  const chaveOrd = {
    artigo: (i) => norm(`${i.nome} ${i.det}`), orig: (i) => i.origem || "", qtd: (i) => Number(i.quantidade) || 0, fornecedor: (i) => norm(i.fornecedor || "~"),
    pic: (i) => `${i.pic || "~"} ${i.oc?.numero || ""}`, para: (i) => (i.destinos || []).join(" "), etapa: (i) => ordemEtapa[i.etapa] ?? 99,
  };
  const vis0 = (l || []).filter((i) => (f ? i.etapa === f : i.etapa !== "RECEBIDA") && (!t || norm(`${i.nome} ${i.det} ${i.fornecedor || ""} ${i.pic} ${i.oc?.numero || ""} ${i.pedidos.join(" ")}`).includes(t)));
  const vis = !ord.k ? vis0 : [...vis0].sort((a, b) => { const x = chaveOrd[ord.k](a), y = chaveOrd[ord.k](b); return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true })) * ord.d; });
  const Tit = ({ k, cls, children, title }) => (
    <button type="button" onClick={() => setOrd((o) => (o.k === k ? (o.d === 1 ? { k, d: -1 } : { k: null, d: 1 }) : { k, d: 1 }))} title={title || "Ordenar"} className={`${cls} flex items-center gap-0.5 hover:text-black ${cls.includes("text-center") ? "justify-center" : ""}`} style={{ color: ord.k === k ? C.navy : undefined }}>
      {children}{ord.k === k ? <span className="text-[10px]">{ord.d === 1 ? "▲" : "▼"}</span> : null}
    </button>
  );
  return (
    <div className={soAvulsas ? "mb-6" : "mt-6"}>   {/* v495 — largura da página toda */}
      <div className="flex items-center gap-2 mb-2">
        <div className="text-base font-bold" style={{ color: C.navy }}>{soAvulsas ? "Itens das compras avulsas" : "Demandas de compra"}</div>
        <span className="text-xs" style={{ color: C.sub }}>{soAvulsas ? "do lançamento ao recebimento, por etapa" : "tudo que está em PIC, por etapa"}</span>
        <div className="flex items-center gap-2 px-2 rounded" style={{ border: `1px solid ${C.line}`, background: C.panel }}><Search size={14} style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artigo, fornecedor, OC, pedido…" className="py-1.5 text-sm outline-none w-56" /></div>
        <button onClick={carregar} className="p-2 rounded-md" style={{ border: `1px solid ${C.line}`, background: C.panel }}><RefreshCw size={14} style={{ color: C.sub }} /></button>
        {acoes}
      </div>
      {/* trilha das etapas */}
      {/* v585 — trilha neutra e compacta: só um ponto de cor por etapa */}
      <div className="flex items-stretch mb-3 overflow-x-auto rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {[...ETAPAS_PRE, ...ETAPAS].map(([k, t0, cor], n) => {
          const sel = f === k, qtd = l ? conta(k) : null;
          return (
            <button key={k} onClick={() => setF(sel ? null : k)} title={t0} className="flex-1 min-w-[96px] px-2.5 py-1.5 text-left"
              style={{ borderLeft: n > 0 ? `1px solid ${C.line}` : "none", background: sel ? C.panel2 : "transparent", boxShadow: sel ? `inset 0 -2px 0 ${C.navy}` : "none" }}>
              <div className="flex items-center gap-1.5 text-[10px] font-medium truncate" style={{ color: C.sub }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: qtd ? cor : C.line }} />{t0}
              </div>
              <div className="text-sm font-semibold leading-tight mt-0.5" style={{ color: qtd ? C.navy : C.sub }}>{l ? qtd : "…"}</div>
            </button>
          );
        })}
      </div>
      {!l && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}
      {l && !vis.length && <div className="text-sm py-6 text-center rounded-lg" style={{ color: C.sub, background: C.panel, border: `1px solid ${C.line}` }}>{l.length ? "Nada nesta etapa." : "Nenhuma demanda de compra. Elas nascem no Levantamento (Gerar PIC)."}</div>}
      {vis.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex px-4 py-2 text-xs font-semibold gap-3 items-center" style={{ color: C.sub, background: C.panel2 }}>
            <Tit k="artigo" cls="flex-1 text-left">Artigo</Tit><Tit k="orig" cls="w-8 text-center" title="A = compra avulsa · P = pedido">Orig.</Tit><Tit k="qtd" cls="w-24 text-center">Qtd</Tit><Tit k="fornecedor" cls="w-40 text-center">Fornecedor</Tit><Tit k="pic" cls="w-28 text-center">PIC / OC</Tit><Tit k="para" cls="w-32 text-center">Para</Tit><Tit k="etapa" cls="w-36 text-center">Etapa</Tit>
          </div>
          {vis.map((i) => {
            const e = [...ETAPAS_PRE, ...ETAPAS].find((x) => x[0] === i.etapa) || ETAPAS[0];
            const cotTxt = i.etapa === "EM_COTACAO" ? (i.cotacoes.length ? `${i.cotacoes.filter((c) => c.s === "VALOR").length}/${i.cotacoes.length} cotação(ões) respondida(s)${i.cotacoes.length && i.cotacoes.every((c) => c.s === "NAO_TEM") ? " · ninguém tem" : ""}` : "cotação não gerada")
              : i.etapa === "SEM_COTACAO" ? (!Number(i.quantidade) ? "sem quantidade · ajuste no PIC" : !i.fornecedor ? "sem fornecedor · gere no PIC" : "gere a cotação no PIC") : null;   // v1044
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
                    {i.etapa === "SEM_COTACAO" && i.pic ? <button onClick={() => (ir ? irPara(ir, "pic", i.pic) : setJan({ tipo: "pic", numero: i.pic }))} className="underline decoration-dotted" style={{ color: "#B54708" }} title="Abrir o PIC para gerar a cotação">{cotTxt}</button> : cotTxt}
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
              <div className="flex-1 min-w-0"><div className="truncate font-semibold">{i.info?.nome}</div><div className="text-[11px] truncate" style={{ color: C.sub }}>{(i.info?.pedidos || []).map((x) => (x.avulsa ? "Avulsa" : rotOrigem(x))).filter((x, k, a) => a.indexOf(x) === k).join(" · ")}</div></div>
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
// v532 — baixa da OC: material recebido, com arquivos (fotos/comprovante); sem NF anexada exige justificativa.
// Quando todas as OCs dos materiais de um item de pedido estão baixadas, o item é liberado para o PCP (Maycon).
function BaixaOc({ o, user, onMudou }) {
  const [jan, setJan] = useState(false);
  const [arqs, setArqs] = useState([]);
  const [just, setJust] = useState("");
  const [oc, setOc] = useState(false);
  const temNf = (o.nfs || []).length > 0 || (o.arquivos || []).some((a) => a.tipo === "XML" || a.tipo === "PDF");
  const daBaixa = (o.arquivos || []).filter((a) => a.tipo === "BAIXA");
  const add = (fs) => setArqs((l) => [...l, ...fs.filter((f) => !l.some((x) => x.name === f.name && x.size === f.size))]);
  const fechar = () => { setJan(false); setArqs([]); setJust(""); };
  async function baixar() {
    if (!temNf && just.trim().length < 5) return alerta("Sem NF anexada: escreva a justificativa para baixar a OC.");
    setOc(true);
    try {
      const arquivos = [];
      for (const f of arqs) arquivos.push({ nome: f.name, mime: f.type, conteudo: await lerB64(f) });
      const r = await fetch("/api/compras/oc/baixa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ocId: o.id, justificativa: just, arquivos, quem: nomeUser(user) }) });
      const x = await r.json().catch(() => ({}));
      setOc(false);
      if (!r.ok) return alerta(x.error || "Erro ao baixar a OC.");
      fechar(); onMudou();
      alerta(`${o.numero} baixada (material recebido).${x.liberados ? ` ${x.liberados} item(ns) liberado(s) para a programação do PCP · pedido(s) ${x.pedidos.join(", ")}.` : ""}`);
    } catch (e) { setOc(false); alerta(e.message); }
  }
  async function reabrir() {
    if (!(await confirmar(`Desfazer a baixa da ${o.numero}? Os itens de pedido liberados por ela voltam a aguardar o material.`))) return;
    const r = await fetch("/api/compras/oc/baixa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reabrir", ocId: o.id }) });
    const x = await r.json().catch(() => ({})); if (!r.ok) return alerta(x.error || "Erro."); onMudou();
  }
  const listaArqs = daBaixa.length > 0 && <div className="flex flex-wrap gap-1.5 mt-1.5">{daBaixa.map((a) => (
    <a key={a.id} href={`/api/compras/oc/arquivos?id=${a.id}`} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.blue }}><Paperclip size={11} /> <span className="max-w-[180px] truncate">{a.nome}</span></a>))}</div>;
  if (o.status === "CANCELADA") return null;
  if (o.status === "RECEBIDA") return (
    <div className="mt-3 rounded-lg p-3" style={{ background: C.greenSoft, border: `1px solid ${C.green}` }}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <PackageCheck size={16} style={{ color: C.green }} />
        <b style={{ color: C.green }}>Baixada · material recebido</b>
        {o.baixa?.em && <span className="text-xs" style={{ color: C.sub }}>{new Date(o.baixa.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}{o.baixa.por ? ` · ${o.baixa.por}` : ""}</span>}
        <button onClick={reabrir} className="ml-auto text-xs px-2 py-1 rounded flex items-center gap-1" style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.sub }}><Undo2 size={12} /> desfazer baixa</button>
      </div>
      {o.baixa?.justificativa && <div className="text-xs mt-1" style={{ color: C.text }}><b>Justificativa (sem NF):</b> {o.baixa.justificativa}</div>}
      {listaArqs}
    </div>
  );
  return (
    <div className="mt-3">
      <button onClick={() => setJan(true)} className="text-sm px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5" style={{ background: C.green, color: "#fff" }}><PackageCheck size={15} /> Baixar OC · material recebido</button>
      {jan && (
        <Modal titulo={`Baixar ${o.numero} · ${o.fornecedor.nome}`} onClose={fechar}>
          <div className="text-sm mb-3" style={{ color: C.text }}>Confirma que o material desta OC foi recebido? Ela passa para <b>Baixadas</b> e, quando todas as OCs de um item de pedido estiverem baixadas, o item é liberado para a programação no PCP.</div>
          <div className="text-xs mb-3 px-2 py-1.5 rounded" style={{ background: temNf ? C.greenSoft : C.yellowSoft, color: temNf ? C.green : C.yellow }}>{temNf ? `NF anexada${(o.nfs || []).length ? `: ${o.nfs.map((n) => n.numero).join(", ")}` : ""}` : "Sem NF anexada nesta OC — a justificativa é obrigatória."}</div>
          <div className="rounded-lg p-3 mb-3" style={{ border: `2px dashed ${C.line}` }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) add([...e.dataTransfer.files]); }}
            onPaste={(e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) add(fs); }} tabIndex={0}>
            <label className="text-xs font-semibold cursor-pointer flex items-center gap-1.5" style={{ color: C.accent }}><ImagePlus size={14} /> Anexar fotos, comprovante ou canhoto (escolher, arrastar ou Ctrl+V)
              <input type="file" multiple accept="image/*,.pdf,application/pdf" className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) add(fs); }} /></label>
            {arqs.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{arqs.map((f, k) => (
              <span key={k} className="text-xs flex items-center gap-1 px-2 py-0.5 rounded" style={{ background: C.panel2, border: `1px solid ${C.line}` }}><Paperclip size={11} /> <span className="max-w-[180px] truncate">{f.name}</span>
                <button onClick={() => setArqs((l) => l.filter((_, j) => j !== k))} style={{ color: C.sub }}><X size={11} /></button></span>))}</div>}
          </div>
          <label className="text-xs block mb-3" style={{ color: C.sub }}>Justificativa{temNf ? " (opcional)" : " — obrigatória sem NF"}
            <textarea value={just} onChange={(e) => setJust(e.target.value)} rows={3} placeholder={temNf ? "Observação do recebimento" : "Por que está baixando sem NF? (ex.: NF vem depois, remessa sem nota, material de amostra…)"} className="block w-full mt-1 px-2 py-1.5 rounded text-sm" style={{ border: `1px solid ${!temNf && just.trim().length < 5 ? C.accent : C.line}`, color: C.text }} /></label>
          <div className="flex justify-end gap-2">
            <button onClick={fechar} className="px-4 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={baixar} disabled={oc} className="px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-1.5" style={{ background: C.green, color: "#fff" }}>{oc ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />} Confirmar baixa</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

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
  const corrigiveis = crit.filter((c) => ["QTD", "VALOR", "PRAZO", "TOTAL", "ITEM_FALTA", "ITEM_SOBRA"].includes(c.tipo));
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
              <button disabled={oc2} onClick={async () => {
                  if (!(await confirmar("Corrigir a OC com as quantidades, valores e prazo da NF? A cotação de origem também é atualizada."))) return;
                  // v536 — itens que não casaram pelo nome: pergunta se aceita o casamento (na ordem)
                  const pOc = new Set((conf.pares || []).map((p) => p.ocItemId)), pNf = new Set((conf.pares || []).map((p) => `${p.nfId}|${p.idx}`));
                  const sOc = (conf.itensOc || []).filter((x) => !pOc.has(x.id)), sNf = (conf.itensNf || []).filter((x) => !pNf.has(`${x.nfId}|${x.idx}`));
                  const casam = sOc.slice(0, sNf.length).map((o, k) => `• ${o.nome}  →  ${sNf[k].nome}`);
                  const casarSobras = casam.length ? await confirmar(`Estes itens têm nomes diferentes na OC e na NF. Aceita o casamento?\n\n${casam.join("\n")}\n\n(Cancelar = corrige só os itens de mesmo nome.)`) : false;
                  post({ acao: "corrigir", casarSobras, condicao: crit.find((c) => c.tipo === "PRAZO")?.condNf ? (crit.find((c) => c.tipo === "PRAZO").condNf === "À VISTA" ? "À VISTA" : `${crit.find((c) => c.tipo === "PRAZO").condNf} DIAS`) : undefined }, (x) => `OC corrigida pela NF (${x.itens} item(ns)).`); }}
                className="text-xs px-3 py-1 rounded-md font-semibold" style={{ background: C.red, color: "#fff" }}>Corrigir a OC pela NF</button>
              <span className="text-[11px]" style={{ color: C.sub }}>ou ajuste os itens acima à mão e salve.</span>
            </div>}
          </>}
        </div>
      )}
      {imp && <ImportarNfs user={user} iniciais={imp} ocId={o.id} onClose={() => setImp(null)} onFim={(m) => { setImp(null); onMudou(); if (m) { const nada = m.startsWith("0 NF") && !/já estava|registrada|completada/.test(m); alerta(nada ? `${m} Nada foi ligado à ${o.numero}.` : `${m} A NF foi ligada à ${o.numero}; confira as críticas abaixo.`); } }} />}
    </div>
  );
}
