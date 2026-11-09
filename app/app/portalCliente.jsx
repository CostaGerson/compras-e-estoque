"use client";
// v699 — Portal do cliente (ex.: Loja Way): lançamento reduzido — item padrão, grade, artes, personalização exclusiva.
// v711 — pedido com status (em aberto · recebendo detalhes · liberado para produção · em produção · finalizado),
//        valor vendido por item, CMV (valor da FPP × peças), MC e despacho pelo lead time; envio pergunta
//        "data limite para receber os dados" ou "direto para a produção"; lista "Pedidos" no estilo do painel de produção.
import React, { useEffect, useMemo, useState } from "react";
import { LogOut, Plus, X, Paperclip, Send, Package, ClipboardList, Image as Img, FileText, RotateCcw, Save, Pencil, Search, CalendarClock, Factory, Trash2, Copy } from "lucide-react";
import { alerta, confirmar } from "./dialogo";
import { useMobile } from "./useMobile";
import { GradeEditor } from "./pedidoEditor";
import DadosUnitarios, { resumoDU, limiteTxt } from "./dadosUnitarios";
import ClienteFinalForm, { ClienteFinalResumo } from "./clienteFinal";
import { vazioClienteFinal, validarClienteFinal } from "@/lib/clienteFinal";
import { qtdGrade, num } from "@/lib/pedidoLanc";
import { temDU, conferirComGrade } from "@/lib/dadosUnitarios";

// paleta padrão do sistema Meridian (identidade visual)
const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", navyLine: "#0C2C52", navySub: "#9FB0C7",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", steel: "#3D6799", steelSoft: "#EEF3FB" };
const inp = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR") : "");
const money = (n) => (n == null ? "—" : "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pctTxt = (p) => (p == null ? "" : `${String(p).replace(".", ",")}%`);
const entregaEm = (dias) => (dias > 0 ? new Date(Date.now() + dias * 86400000).toLocaleDateString("pt-BR") : "");   // lead time em dias corridos
export const STATUS = {
  EM_ABERTO: ["Em aberto", C.yellow, C.yellowSoft], RECEBENDO_DETALHES: ["Recebendo detalhes", C.accent, C.accentSoft], LIBERADO: ["Liberado para produção", C.blue, C.blueSoft],
  EM_PRODUCAO: ["Em produção", C.green, C.greenSoft], FINALIZADO: ["Finalizado", C.navy, C.steelSoft], CANCELADO: ["Cancelado", C.sub, C.panel2],
};
const Chip = ({ s }) => { const [t, c, f] = STATUS[s] || [s, C.sub, C.panel2]; return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: f, color: c }}>{t}</span>; };
const paraLocal = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };

// valores do pedido em montagem
function calcValores(itens) {
  let cmv = 0, venda = 0, pecas = 0;
  for (const it of itens) { const q = qtdGrade(it.grade); pecas += q; cmv += q * (Number(it.padrao.cmvUnit) || 0); venda += q * num(it.valorVenda); }
  const mc = venda - cmv;
  return { pecas, cmv, venda, mc, mcPct: venda > 0 ? Math.round((mc / venda) * 1000) / 10 : null, lead: Math.max(0, ...itens.map((it) => it.padrao.leadTime || 0)) };
}

export default function PortalCliente({ user, onSair, tamanhos }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("NOVO");
  const [ppId, setPpId] = useState(null);          // pedido em edição (null = novo)
  const [itens, setItens] = useState([]);           // [{ key, padrao, grade, artes, dadosUnitarios, valorVenda }]
  const [oc, setOc] = useState("");
  const [obs, setObs] = useState("");
  const [cf, setCf] = useState(vazioClienteFinal());
  const [st, setSt] = useState("");
  const [busca, setBusca] = useState("");
  const [envio, setEnvio] = useState(null);         // janela de envio
  const [detalhe, setDetalhe] = useState(null);     // id do pedido aberto na lista
  const mobile = useMobile();
  const api = (url, o = {}) => fetch(url, { cache: "no-store", ...o, headers: { "Content-Type": "application/json", "x-usuario-id": String(user.id) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Erro."); return j; });
  const carregar = () => api("/api/portal").then((j) => { setD(j); setErro(""); }).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);

  const gradeVazia = () => tamanhos.map((t) => ({ tam: t, qtd: "" }));
  const completarGrade = (g) => { const tem = new Set((g || []).map((x) => x.tam)); return [...(g || []), ...tamanhos.filter((t) => !tem.has(t)).map((t) => ({ tam: t, qtd: "" }))]; };
  const adicionar = (p) => { setItens((l) => [...l, { key: Date.now() + Math.random(), padrao: p, grade: gradeVazia(), artes: [], dadosUnitarios: null, valorVenda: "" }]); setTimeout(() => document.getElementById("portal-itens-fim")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const up = (k, patch) => setItens((l) => l.map((it) => (it.key === k ? { ...it, ...patch } : it)));
  const tirar = async (it) => { if ((qtdGrade(it.grade) || it.artes.length) && !(await confirmar(`Tirar "${it.padrao.nome}" do pedido?`))) return; setItens((l) => l.filter((x) => x.key !== it.key)); };
  const anexar = async (it, files) => {
    const fs = Array.from(files || []).filter((f) => /^image\/|pdf$/i.test(f.type) || /\.(pdf|png|jpe?g|svg|ai|cdr|eps)$/i.test(f.name));
    const grandes = fs.filter((f) => f.size > 15 * 1024 * 1024);
    if (grandes.length) alerta(`Maior que 15 MB (não entrou): ${grandes.map((f) => f.name).join(", ")}`);
    const add = await Promise.all(fs.filter((f) => f.size <= 15 * 1024 * 1024).map(async (f) => ({ nome: f.name, mime: f.type || null, base64: await readB64(f) })));
    up(it.key, { artes: [...it.artes, ...add] });
  };
  const replicarLocais = (de) => setItens((l) => l.map((it) => (it.key === de.key ? it : { ...it, dadosUnitarios: { ...(it.dadosUnitarios || { linhas: [] }), campos: de.dadosUnitarios.campos.map((c) => ({ ...c })), linhas: it.dadosUnitarios?.linhas || [] } })));
  const limpar = () => { setPpId(null); setItens([]); setOc(""); setObs(""); setCf(vazioClienteFinal()); };
  const corpo = (extra = {}) => ({ ppId, oc, obs, clienteFinal: cf, itens: itens.map((it) => ({ itemPadraoId: it.padrao.id, grade: it.grade, artes: it.artes, dadosUnitarios: it.dadosUnitarios, valorVenda: it.valorVenda })), ...extra });

  const salvarRascunho = async () => {
    setSt("Salvando…");
    try { const j = await api("/api/portal", { method: "POST", body: JSON.stringify(corpo({ acao: "rascunho" })) }); setPpId(j.id); setD((x) => ({ ...x, pedidos: j.pedidos })); alerta("Pedido salvo como \"Em aberto\". Você continua de onde parou em Pedidos."); }
    catch (e) { alerta(e.message); }
    setSt("");
  };
  const abrirEnvio = () => {
    if (!itens.length) return alerta("Escolha ao menos um item.");
    const vcf = validarClienteFinal(cf);
    if (vcf.erros) { document.getElementById("portal-cliente-final")?.scrollIntoView({ behavior: "smooth" }); return alerta(`Dados do cliente e envio — preencha:\n\n• ${vcf.erros.join("\n• ")}`); }
    for (const [i, it] of itens.entries()) {
      if (!(qtdGrade(it.grade) > 0)) return alerta(`Item ${i + 1} (${it.padrao.nome}): informe a grade.`);
      if (!(num(it.valorVenda) > 0)) return alerta(`Item ${i + 1} (${it.padrao.nome}): informe o valor vendido por peça.`);
      if (temDU(it.dadosUnitarios) && it.dadosUnitarios.linhas?.length) {
        const c = conferirComGrade(it.dadosUnitarios, it.grade);
        if (!c.ok) return alerta(`Item ${i + 1}: a lista de personalização exclusiva não bate com a grade (${Object.entries(c.dif).map(([t, x]) => `${t} ${x > 0 ? "+" : ""}${x}`).join(", ")}). Use "ajustar a grade pela lista".`);
      }
    }
    const temPE = itens.some((it) => temDU(it.dadosUnitarios));
    const semLista = itens.some((it) => temDU(it.dadosUnitarios) && !it.dadosUnitarios.linhas?.length);
    const dt = new Date(); dt.setDate(dt.getDate() + 3); dt.setHours(18, 0, 0, 0);
    setEnvio({ modo: semLista ? "LIMITE" : "PRODUCAO", limite: paraLocal(dt), temPE, semLista });
  };
  const enviar = async () => {
    if (envio.modo === "LIMITE" && !envio.limite) return alerta("Escolha o dia e o horário limite.");
    setSt("Enviando…");
    try {
      const j = await api("/api/portal", { method: "POST", body: JSON.stringify(corpo({ acao: "enviar", modo: envio.modo, limite: envio.modo === "LIMITE" ? new Date(envio.limite).toISOString() : null })) });
      setD((x) => ({ ...x, pedidos: j.pedidos })); setEnvio(null); limpar(); setAba("PEDIDOS"); setDetalhe(j.id);
      alerta(j.modo === "LIMITE" ? `Pedido em "Recebendo detalhes". Os links de preenchimento estão no pedido (copie e mande para as pessoas). No horário limite, o que foi preenchido entra na lista e o pedido é liberado para produção.` : `Pedido liberado para produção: ${j.pecas} peça(s). Nossa equipe confere e inicia a produção.`);
    } catch (e) { alerta(e.message); }
    setSt("");
  };
  const editar = async (id) => {
    if (itens.length && !(await confirmar("Abrir este pedido para editar? O que está no Novo pedido agora sai da tela (salve antes se precisar)."))) return;
    try {
      const j = await api(`/api/portal?editar=${id}`);
      setPpId(j.ppId); setCf(j.clienteFinal || vazioClienteFinal()); setOc(j.oc || ""); setObs(j.obs || "");
      setItens(j.itens.map((it) => ({ key: Date.now() + Math.random(), padrao: it.padrao, grade: completarGrade(it.grade), artes: it.artes || [], dadosUnitarios: it.dadosUnitarios, valorVenda: it.valorVenda || "" })));
      setDetalhe(null); setAba("NOVO");
    } catch (e) { alerta(e.message); }
  };

  // v712 — excluir pedido (enquanto não está na produção)
  const excluirPedido = async (p) => { if (!(await confirmar(`Excluir o pedido de ${p.cliente || "—"} (${p.pecas} peças)?${p.status === "RECEBENDO_DETALHES" ? "\n\nOs links de preenchimento param de funcionar e as respostas recebidas são apagadas." : ""}${p.status === "LIBERADO" ? "\n\nA nossa equipe será avisada." : ""}\n\nNão dá para desfazer.`))) return; try { const j = await api("/api/portal", { method: "DELETE", body: JSON.stringify({ ppId: p.id }) }); setD((x) => ({ ...x, pedidos: j.pedidos })); setDetalhe(null); if (ppId === p.id) limpar(); } catch (e) { alerta(e.message); } };
  const n = busca.trim().toLowerCase();
  const catalogo = (d?.itens || []).filter((p) => !n || [p.nome, p.nomeNf, p.codigo].join(" ").toLowerCase().includes(n));
  const val = calcValores(itens);

  const ABAS = [["NOVO", ppId ? "Editar pedido" : "Novo pedido", Package], ["PEDIDOS", `Pedidos${d ? ` (${d.pedidos.length})` : ""}`, ClipboardList]];
  const nomeUser = [user.nome, user.sobrenome].filter(Boolean).join(" ");
  const tituloAba = aba === "NOVO" ? (ppId ? "Editar pedido" : "Novo pedido") : "Pedidos";
  return (
    <div className="flex text-sm" style={{ background: C.bg, color: C.text, height: "100vh", overflow: "hidden", fontFamily: "Montserrat, system-ui, sans-serif" }}>
      {!mobile && (
        <aside className="h-full flex flex-col shrink-0" style={{ background: C.navy, width: 240 }}>
          <div className="px-4 py-4 shrink-0" style={{ borderBottom: `1px solid ${C.navyLine}` }}>
            <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 24, width: "auto" }} />
          </div>
          <div className="px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${C.navyLine}` }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: C.navySub }}>Portal do cliente</div>
            <div className="font-bold text-sm mt-0.5" style={{ color: "#fff" }}>{d?.cliente?.nome || "…"}</div>
          </div>
          <nav className="flex-1 py-2 overflow-y-auto scroll-escuro">
            {ABAS.map(([k, t, I]) => {
              const on = aba === k;
              return (
                <button key={k} onClick={() => setAba(k)} className="w-full flex items-center gap-2.5 py-2.5 pr-3 text-left"
                  style={{ paddingLeft: 13, background: on ? C.navyLine : "transparent", borderLeft: on ? `3px solid ${C.accent}` : "3px solid transparent", color: on ? C.accent : C.navySub, fontWeight: on ? 600 : 400, fontSize: 14 }}>
                  <I size={17} /> {t}
                </button>
              );
            })}
          </nav>
          <div className="px-3 py-2.5 shrink-0 flex items-center gap-2" style={{ borderTop: `1px solid ${C.navyLine}` }}>
            <span className="text-xs flex-1 truncate" style={{ color: C.navySub }}>{nomeUser}</span>
            <button onClick={onSair} title="Sair" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
              style={{ color: "#fff", border: `1px solid ${C.navyLine}`, background: "rgba(255,255,255,.06)" }}><LogOut size={14} /> Sair</button>
          </div>
        </aside>
      )}
      <main className="flex-1 flex flex-col min-w-0">
        {mobile ? (
          <header className="shrink-0" style={{ background: C.navy }}>
            <div className="flex items-center gap-3 px-3 py-3">
              <img src="/meridian-logo.svg" alt="MERIDIAN" style={{ height: 20, width: "auto" }} />
              <div className="flex-1 min-w-0 text-right">
                <div className="text-[10px] uppercase tracking-wide" style={{ color: C.navySub }}>Portal do cliente</div>
                <div className="text-xs font-bold truncate" style={{ color: "#fff" }}>{d?.cliente?.nome || "…"}</div>
              </div>
              <button onClick={onSair} title="Sair" className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 38, height: 38, color: "#fff", border: `1px solid ${C.navyLine}` }}><LogOut size={18} /></button>
            </div>
            <div className="flex" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
              {ABAS.map(([k, t, I]) => (
                <button key={k} onClick={() => setAba(k)} className="flex-1 flex items-center justify-center gap-1.5 py-3 font-semibold"
                  style={{ color: aba === k ? C.accent : C.sub, borderBottom: aba === k ? `3px solid ${C.accent}` : "3px solid transparent" }}><I size={16} /> {t}</button>
              ))}
            </div>
          </header>
        ) : (
          <header className="shrink-0 flex items-center px-6 py-3" style={{ background: C.panel, borderBottom: `1px solid ${C.line}` }}>
            <div className="font-semibold" style={{ color: C.text }}><span style={{ color: C.sub, fontWeight: 400 }}>{d?.cliente?.nome || "Portal"} › </span>{tituloAba}</div>
            {aba === "NOVO" && itens.length > 0 && <div className="ml-auto text-xs" style={{ color: C.sub }}>{itens.length} item(ns) · <b style={{ color: C.text }}>{val.pecas} peça(s)</b></div>}
          </header>
        )}
        <div className="flex-1 overflow-auto">
        <div key={aba} className={`anim-entrar ${mobile ? "p-3" : "px-6 py-5"}`}>
        {erro && <div className="p-3 rounded mb-3" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}

        {d && aba === "NOVO" && (
          <>
            {ppId && <div className="mb-3 p-3 rounded-lg text-xs flex items-center gap-2" style={{ background: C.steelSoft, color: C.text }}>
              <Pencil size={14} style={{ color: C.steel }} /> Editando um pedido já criado. Salve como "em aberto" ou envie de novo.
              <button onClick={async () => { if (await confirmar("Sair da edição sem salvar?")) limpar(); }} className="ml-auto underline" style={{ color: C.steel }}>sair da edição</button>
            </div>}
            <div id="portal-cliente-final" className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold mb-3" style={{ color: C.navy }}>1. Dados do cliente e envio</div>
              <ClienteFinalForm valor={cf} onChange={setCf} mobile={mobile} />
            </div>
            <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="font-bold" style={{ color: C.navy }}>2. Escolha os itens</div>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="buscar item" className="ml-auto rounded-lg px-3 py-1.5 text-sm outline-none" style={{ ...inp, width: 220 }} />
              </div>
              {!d.itens.length ? <div className="text-sm py-4 text-center" style={{ color: C.sub }}>Nenhum item padrão cadastrado para o seu cadastro ainda. Fale com seu vendedor.</div> : (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? 150 : 200}px, 1fr))` }}>
                  {catalogo.map((p) => (
                    <button key={p.id} onClick={() => adicionar(p)} className="card-asana rounded-xl p-2.5 text-left" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                      <div className="rounded-lg mb-2 flex items-center justify-center overflow-hidden" style={{ height: mobile ? 120 : 150, background: C.panel2 }}>
                        {p.foto ? <img src={p.foto} alt="" style={{ maxHeight: mobile ? 120 : 150, maxWidth: "100%", objectFit: "contain" }} /> : <Img size={28} style={{ color: C.line }} />}
                      </div>
                      <div className="text-xs font-semibold leading-tight" style={{ color: C.text }}>{p.nome}</div>
                      {p.codigo && <div className="text-[10px]" style={{ color: C.sub }}>{p.codigo}</div>}
                      <div className="text-[10px]" style={{ color: C.sub }}>{p.cmvUnit != null ? `${money(p.cmvUnit)}/pç` : ""}{p.leadTime > 0 ? ` · lead time ${p.leadTime} dias` : ""}</div>
                      <div className="mt-1 text-[11px] font-semibold flex items-center gap-1" style={{ color: C.accent }}><Plus size={12} /> adicionar</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {itens.map((it, i) => {
              const q = qtdGrade(it.grade), cmv = q * (Number(it.padrao.cmvUnit) || 0), vend = q * num(it.valorVenda), mc = vend - cmv;
              return (
              <div key={it.key} className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${C.accent}` }}>
                <div className="flex items-start gap-3 mb-3">
                  {it.padrao.foto && <img src={it.padrao.foto} alt="" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: C.panel2 }} />}
                  <div className="flex-1">
                    <div className="text-xs" style={{ color: C.sub }}>Item {i + 1}</div>
                    <div className="font-bold" style={{ color: C.navy }}>{it.padrao.nome}</div>
                    <div className="text-xs mt-0.5" style={{ color: it.padrao.leadTime ? C.accent : C.sub }}>{it.padrao.leadTime ? <>Despacho previsto: <b>{entregaEm(it.padrao.leadTime)}</b> (lead time {it.padrao.leadTime} dias)</> : "Despacho previsto: a confirmar pela nossa equipe"}</div>
                  </div>
                  <div className="text-right"><div className="text-xl font-bold" style={{ color: C.navy }}>{q}</div><div className="text-[10px]" style={{ color: C.sub }}>peças</div></div>
                  <button onClick={() => tirar(it)} style={{ color: C.sub }} title="Tirar do pedido"><X size={18} /></button>
                </div>
                <div className={mobile ? "" : "grid gap-5"} style={mobile ? undefined : { gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}>
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Grade</div>
                    <GradeEditor grade={it.grade} tamanhos={tamanhos} onChange={(g) => up(it.key, { grade: g })} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Valores</div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <label className="text-xs" style={{ color: C.sub }}>Valor vendido por peça <span style={{ color: C.red }}>*</span>
                        <input value={it.valorVenda} onChange={(e) => up(it.key, { valorVenda: e.target.value.replace(/[^\d,.]/g, "") })} inputMode="decimal" placeholder="0,00" className="w-full rounded-lg px-3 py-2 mt-1 text-sm font-semibold outline-none" style={{ ...inp, borderColor: num(it.valorVenda) > 0 ? C.line : C.accent }} /></label>
                      <div className="text-xs rounded-lg p-2" style={{ background: C.panel2 }}>
                        <div style={{ color: C.sub }}>CMV {it.padrao.cmvUnit != null ? `(${money(it.padrao.cmvUnit)}/pç)` : ""}</div>
                        <div className="font-semibold">{money(cmv)}</div>
                        <div style={{ color: C.sub }} className="mt-0.5">Vendido {money(vend)} · MC <b style={{ color: mc >= 0 ? C.green : C.red }}>{money(mc)}</b></div>
                      </div>
                    </div>
                    <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Artes</div>
                    <label className="flex items-center justify-center gap-2 rounded-lg p-3 cursor-pointer text-xs" style={{ border: `1px dashed ${C.accent}`, color: C.accent, background: C.accentSoft }}
                      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); anexar(it, e.dataTransfer.files); }}>
                      <Paperclip size={14} /> Anexar artes (arraste aqui ou clique) — imagem ou PDF, até 15 MB
                      <input type="file" multiple accept="image/*,application/pdf,.ai,.cdr,.eps" className="hidden" onChange={(e) => { anexar(it, e.target.files); e.target.value = ""; }} />
                    </label>
                    {it.artes.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {it.artes.map((a, k) => (
                          <div key={k} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
                            {/^image\//.test(a.mime || "") ? <img src={a.base64} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4 }} /> : <FileText size={14} style={{ color: C.sub }} />}
                            <span className="truncate" style={{ maxWidth: 160 }}>{a.nome}</span>
                            <button onClick={() => up(it.key, { artes: it.artes.filter((_, j) => j !== k) })} style={{ color: C.sub }}><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DadosUnitarios du={it.dadosUnitarios} onChange={(v) => up(it.key, { dadosUnitarios: v })} grade={it.grade} onGrade={(g) => up(it.key, { grade: g })}
                  tamanhos={tamanhos} uid={user.id} titulo={`${d.cliente.nome} · ${it.padrao.nome}`} clienteNome={d.cliente.nome}
                  onReplicarItens={itens.length > 1 ? () => replicarLocais(it) : null}
                  semLinkTxt={'Quer que cada pessoa preencha o próprio tamanho e dado? Ao enviar, escolha "inserir data limite": o sistema cria o link e o pedido fica em "recebendo detalhes".'} />
              </div>
              );
            })}
            <div id="portal-itens-fim" />

            {itens.length > 0 && (
              <div className="rounded-xl p-4 mb-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs" style={{ color: C.sub }}>Sua OC / referência (opcional)<input value={oc} onChange={(e) => setOc(e.target.value)} className="w-full rounded-lg px-3 py-2 mt-1 text-sm outline-none" style={inp} /></label>
                  <label className="text-xs sm:col-span-2" style={{ color: C.sub }}>Observações (opcional)<input value={obs} onChange={(e) => setObs(e.target.value)} className="w-full rounded-lg px-3 py-2 mt-1 text-sm outline-none" style={inp} /></label>
                </div>
                <ResumoValores v={val} mobile={mobile} />
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button onClick={async () => { if (await confirmar("Resetar o pedido? Dados do cliente, itens, grades, valores, artes e personalização exclusiva saem da tela.")) limpar(); }}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm" style={{ color: C.red, border: `1px solid ${C.line}` }}><RotateCcw size={15} /> Resetar pedido</button>
                  <button onClick={salvarRascunho} disabled={!!st} className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold" style={{ color: C.accent, border: `1px solid ${C.accent}`, background: C.panel }}><Save size={15} /> Salvar (em aberto)</button>
                  <button onClick={abrirEnvio} disabled={!!st} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold" style={{ background: C.accent, color: "#fff" }}><Send size={16} /> {st || "Enviar pedido"}</button>
                </div>
              </div>
            )}
          </>
        )}

        {d && aba === "PEDIDOS" && <ListaPedidos pedidos={d.pedidos} mobile={mobile} onAbrir={setDetalhe} onExcluir={excluirPedido} />}
        </div>
        </div>
      </main>

      {envio && <EnvioModal envio={envio} setEnvio={setEnvio} val={val} st={st} onEnviar={enviar} onFechar={() => setEnvio(null)} />}
      {detalhe && d && (() => {
        const p = d.pedidos.find((x) => x.id === detalhe);
        return p ? <DetalhePedido p={p} user={user} tamanhos={tamanhos} nomeCliente={d.cliente.nome} mobile={mobile} onFechar={() => setDetalhe(null)} onEditar={() => editar(p.id)}
          onExcluir={() => excluirPedido(p)}
          salvarItem={async (k, body) => { const j = await api("/api/portal", { method: "PUT", body: JSON.stringify({ ppId: p.id, idx: k, ...body }) }); setD((x) => ({ ...x, pedidos: j.pedidos })); }} /> : null;
      })()}
    </div>
  );
}

function Caixa({ t, v, cor, sub }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
      <div className="text-[11px]" style={{ color: C.sub }}>{t}</div>
      <div className="font-bold text-base" style={{ color: cor || C.text }}>{v}</div>
      {sub && <div className="text-[11px]" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}
function ResumoValores({ v, mobile }) {
  return (
    <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${mobile ? 2 : 5}, minmax(0, 1fr))` }}>
      <Caixa t="Peças" v={v.pecas} />
      <Caixa t="CMV (valor da FPP × peças)" v={money(v.cmv)} />
      <Caixa t="Valor vendido" v={money(v.venda)} />
      <Caixa t="MC do pedido" v={money(v.mc)} cor={v.mc >= 0 ? C.green : C.red} sub={v.mcPct != null ? pctTxt(v.mcPct) + " do vendido" : ""} />
      <Caixa t="Despacho previsto" v={v.lead > 0 ? entregaEm(v.lead) : "a confirmar"} sub={v.lead > 0 ? `lead time ${v.lead} dias` : ""} />
    </div>
  );
}

function Janela({ titulo, onFechar, children, largura = 720, rodape }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 anim-fundo" style={{ background: "rgba(0,30,65,.45)" }} onClick={onFechar}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full flex flex-col shadow-2xl anim-modal" style={{ background: C.panel, maxWidth: largura, maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
          <button onClick={onFechar} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-4 overflow-auto flex-1">{children}</div>
        {rodape && <div className="px-4 py-3 flex flex-wrap justify-end gap-2" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}

// v711 — envio: data limite para receber os dados (link) ou direto para a produção, com os valores do pedido
function EnvioModal({ envio, setEnvio, val, st, onEnviar, onFechar }) {
  const opc = (k, Ic, t, dsc, off) => (
    <button type="button" disabled={off} onClick={() => setEnvio((x) => ({ ...x, modo: k }))} className="flex-1 text-left rounded-xl p-3"
      style={{ border: `2px solid ${envio.modo === k ? C.accent : C.line}`, background: envio.modo === k ? C.accentSoft : C.panel, opacity: off ? 0.45 : 1, minWidth: 220 }}>
      <div className="flex items-center gap-2 font-bold" style={{ color: envio.modo === k ? C.accent : C.navy }}><Ic size={17} /> {t}</div>
      <div className="text-xs mt-1" style={{ color: C.sub }}>{dsc}</div>
    </button>
  );
  return (
    <Janela titulo="Enviar pedido" onFechar={onFechar} largura={760}
      rodape={<><button onClick={onFechar} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Voltar</button>
        <button onClick={onEnviar} disabled={!!st} className="flex items-center gap-2 px-5 py-2 rounded-lg font-bold" style={{ background: C.accent, color: "#fff" }}><Send size={15} /> {st || (envio.modo === "LIMITE" ? "Enviar e abrir o recebimento" : "Enviar para a produção")}</button></>}>
      <div className="text-sm font-semibold mb-2" style={{ color: C.text }}>Como seguir com este pedido?</div>
      <div className="flex flex-wrap gap-2 mb-3">
        {opc("LIMITE", CalendarClock, "Inserir data limite para recebimento de dados", envio.temPE ? "Cria o link para cada pessoa preencher tamanho e personalização. O pedido fica em \"recebendo detalhes\" até o horário limite." : "Nenhum item tem personalização exclusiva.", !envio.temPE)}
        {opc("PRODUCAO", Factory, "Enviar direto para a produção", envio.semLista ? "Há item com personalização exclusiva sem lista: preencha a lista antes ou use a data limite." : "O pedido fica \"liberado para produção\".", envio.semLista)}
      </div>
      {envio.modo === "LIMITE" && (
        <label className="block text-xs mb-3" style={{ color: C.sub }}>Receber dados até (dia e horário)
          <input type="datetime-local" value={envio.limite} onChange={(e) => setEnvio((x) => ({ ...x, limite: e.target.value }))} className="block mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={inp} />
          <span className="block mt-1">No horário limite o link para de aceitar respostas; o que foi preenchido entra na lista e o pedido passa a "liberado para produção".</span>
        </label>
      )}
      <ResumoValores v={val} />
      {envio.modo === "LIMITE" && <div className="text-[11px] mt-2" style={{ color: C.sub }}>As peças, o CMV e o vendido são da grade atual: mudam conforme as respostas do link.</div>}
    </Janela>
  );
}

// v711 — lista no estilo do painel de produção
function ListaPedidos({ pedidos, mobile, onAbrir, onExcluir }) {
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const cont = useMemo(() => pedidos.reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {}), [pedidos]);
  const n = busca.trim().toLowerCase();
  const lista = pedidos.filter((p) => (filtro === "TODOS" || p.status === filtro) && (!n || [p.numero, p.cliente, p.oc, ...p.itens.map((i) => i.descricao)].join(" ").toLowerCase().includes(n)));
  const tot = lista.reduce((s, p) => ({ pecas: s.pecas + p.pecas, cmv: s.cmv + p.cmv, venda: s.venda + p.venda, mc: s.mc + p.mc }), { pecas: 0, cmv: 0, venda: 0, mc: 0 });
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {[["TODOS", "Todos"], ...Object.entries(STATUS).filter(([k]) => k !== "CANCELADO" || cont[k]).map(([k, [t]]) => [k, t])].map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={filtro === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>
            {t} <span style={{ opacity: 0.7 }}>{k === "TODOS" ? pedidos.length : cont[k] || 0}</span></button>
        ))}
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-2" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pedido, cliente, item…" className="rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none" style={{ ...inp, width: mobile ? 180 : 240 }} />
        </div>
      </div>
      {!lista.length ? <div className="text-center py-10" style={{ color: C.sub }}>Nenhum pedido{filtro !== "TODOS" ? " neste status" : ""}.</div> : mobile ? (
        lista.map((p) => (
          <button key={p.id} onClick={() => onAbrir(p.id)} className="card-asana w-full text-left rounded-xl p-3 mb-2" style={{ background: C.panel, border: `1px solid ${C.line}`, borderLeft: `4px solid ${(STATUS[p.status] || [])[1] || C.sub}` }}>
            <div className="flex items-center gap-2"><b style={{ color: C.navy }}>{p.numero || "sem nº"}</b><Chip s={p.status} /><span className="ml-auto text-[11px]" style={{ color: C.sub }}>{dBR(p.lancadoEm)}</span></div>
            <div className="text-xs mt-1 font-semibold">{p.cliente || "—"}</div>
            <div className="text-[11px] mt-1" style={{ color: C.sub }}>{p.pecas} pç · CMV {money(p.cmv)} · vendido {money(p.venda)} · MC <b style={{ color: p.mc >= 0 ? C.green : C.red }}>{money(p.mc)}</b>{p.despacho ? ` · despacho ${p.despacho}` : ""}</div>
          </button>
        ))
      ) : (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ borderCollapse: "collapse", minWidth: 960 }}>
            <thead><tr style={{ background: C.panel2, color: C.sub }}>
              {["Lançado em", "Pedido", "Cliente", "Peças", "CMV", "Vendido", "MC", "Despacho", "Status"].map((h, i) => <th key={h} className={`px-3 py-2 font-semibold ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>)}<th />
            </tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id} onClick={() => onAbrir(p.id)} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-2.5 whitespace-nowrap">{dBR(p.lancadoEm)}</td>
                  <td className="px-3 py-2.5 font-bold" style={{ color: C.navy }}>{p.numero || <span style={{ color: C.sub, fontWeight: 400 }}>sem nº</span>}</td>
                  <td className="px-3 py-2.5"><div className="font-semibold">{p.cliente || "—"}</div><div className="text-[11px] truncate" style={{ color: C.sub, maxWidth: 280 }}>{p.itens.map((i) => i.descricao).join(" · ")}</div></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.pecas}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(p.cmv)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(p.venda)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: p.mc >= 0 ? C.green : C.red }}>{money(p.mc)}<div className="text-[10px] font-normal" style={{ color: C.sub }}>{pctTxt(p.mcPct)}</div></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{p.despacho || "—"}</td>
                  <td className="px-3 py-2.5"><Chip s={p.status} />{p.status === "RECEBENDO_DETALHES" && p.limite && <div className="text-[10px] mt-0.5" style={{ color: C.sub }}>até {limiteTxt(p.limite)}</div>}</td>
                  <td className="px-2">{p.editavel && <button onClick={(e) => { e.stopPropagation(); onExcluir(p); }} title="Excluir pedido" style={{ color: C.sub }}><Trash2 size={14} /></button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ borderTop: `2px solid ${C.line}`, background: C.panel2 }}>
              <td colSpan={3} className="px-3 py-2 font-semibold">{lista.length} pedido(s)</td>
              <td className="px-3 py-2 text-right font-bold">{tot.pecas}</td><td className="px-3 py-2 text-right font-bold">{money(tot.cmv)}</td>
              <td className="px-3 py-2 text-right font-bold">{money(tot.venda)}</td><td className="px-3 py-2 text-right font-bold" style={{ color: tot.mc >= 0 ? C.green : C.red }}>{money(tot.mc)}</td><td colSpan={3} />
            </tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// v711 — dados gerais do pedido + edição
function DetalhePedido({ p, user, tamanhos, nomeCliente, mobile, onFechar, onEditar, onExcluir, salvarItem }) {
  const url = (t) => `${typeof window !== "undefined" ? window.location.origin : ""}/dados/${t}`;
  const copiar = async (t) => { try { await navigator.clipboard.writeText(url(t)); alerta("Link copiado."); } catch { window.prompt("Copie o link:", url(t)); } };
  return (
    <Janela titulo={`${p.numero ? `Pedido ${p.numero}` : "Pedido"} · ${p.cliente || nomeCliente}`} onFechar={onFechar} largura={980}
      rodape={<>
        {p.editavel && <button onClick={onExcluir} className="mr-auto flex items-center gap-1 px-3 py-2 rounded-lg text-sm" style={{ color: C.red, border: `1px solid ${C.line}` }}><Trash2 size={14} /> Excluir</button>}
        <button onClick={onFechar} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Fechar</button>
        {p.editavel && <button onClick={onEditar} className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: C.accent, color: "#fff" }}><Pencil size={14} /> Editar pedido</button>}
      </>}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Chip s={p.status} />
        <span className="text-xs" style={{ color: C.sub }}>lançado em {dBR(p.lancadoEm)}{p.enviadoPor ? ` por ${p.enviadoPor}` : ""}{p.oc ? ` · OC ${p.oc}` : ""}</span>
        {p.status === "RECEBENDO_DETALHES" && p.limite && <span className="text-xs font-semibold" style={{ color: C.accent }}>recebendo dados até {limiteTxt(p.limite)}</span>}
      </div>
      <ResumoValores v={{ pecas: p.pecas, cmv: p.cmv, venda: p.venda, mc: p.mc, mcPct: p.mcPct, lead: 0 }} mobile={mobile} />
      <div className="text-xs mt-2" style={{ color: C.sub }}>Despacho previsto: <b style={{ color: C.text }}>{p.despacho || "a confirmar"}</b></div>
      {p.clienteFinal && <div className="mt-3"><ClienteFinalResumo c={p.clienteFinal} /></div>}
      {p.obs && <div className="text-xs mt-2"><span style={{ color: C.sub }}>Observações:</span> {p.obs}</div>}
      <div className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: C.sub }}>Itens</div>
      {p.itens.map((it, k) => (
        <div key={k} className="rounded-lg p-3 mt-2" style={{ border: `1px solid ${C.line}` }}>
          <div className="flex flex-wrap items-center gap-2">
            <b style={{ color: C.navy }}>{it.descricao}</b>
            <span className="text-xs" style={{ color: C.sub }}>{it.pecas} pç ({it.grade.map((g) => `${g.tam} ${g.qtd}`).join(" · ")})</span>
            <span className="ml-auto text-xs" style={{ color: C.sub }}>CMV {money(it.cmv)} · vendido {money(it.venda)}{it.valorVenda ? ` (${money(it.valorVenda)}/pç)` : ""}</span>
          </div>
          {it.dadosUnitarios && <div className="text-xs mt-1" style={{ color: C.steel }}>{resumoDU(it.dadosUnitarios, tamanhos) || "Personalização exclusiva: aguardando a lista"}</div>}
          {it.link && p.status === "RECEBENDO_DETALHES" && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="font-mono px-2 py-1 rounded truncate" style={{ background: C.panel2, maxWidth: 380 }}>{url(it.link.token)}</span>
              <button onClick={() => copiar(it.link.token)} className="flex items-center gap-1 px-2 py-1 rounded-md font-semibold" style={{ color: C.accent, border: `1px solid ${C.accent}` }}><Copy size={12} /> copiar link</button>
            </div>
          )}
          {p.editavel && it.dadosUnitarios && <ItemPE p={p} it={it} idx={k} user={user} tamanhos={tamanhos} nomeCliente={nomeCliente} salvar={(body) => salvarItem(k, body)} />}
        </div>
      ))}
    </Janela>
  );
}

// personalização exclusiva de um item já criado: lista, respostas do link e fechar preenchimento
function ItemPE({ p, it, idx, user, tamanhos, nomeCliente, salvar }) {
  const [aberto, setAberto] = useState(false);
  const gradeIni = () => { const g = it.gradeToda || it.grade || []; const tem = new Set(g.map((x) => x.tam)); return [...g, ...tamanhos.filter((t) => !tem.has(t)).map((t) => ({ tam: t, qtd: "" }))]; };
  const [du, setDu] = useState(it.dadosUnitarios || null);
  const [grade, setGrade] = useState(gradeIni);
  const [st, setSt] = useState("");
  const gravar = async (duNovo = du, gradeNova = grade) => {
    setSt("Salvando…");
    try { await salvar({ dadosUnitarios: duNovo, grade: gradeNova }); setSt("Salvo ✓"); setTimeout(() => setSt(""), 2500); } catch (e) { alerta(e.message); setSt(""); }
  };
  return (
    <div className="mt-2">
      <button onClick={() => setAberto((x) => !x)} className="text-xs px-2 py-1 rounded-md font-semibold" style={{ border: `1px solid ${C.steel}`, color: C.steel }}>{aberto ? "fechar" : "personalização exclusiva: lista e respostas"}</button>
      {aberto && (
        <div className="mt-2">
          <GradeEditor grade={grade} tamanhos={tamanhos} onChange={setGrade} />
          <DadosUnitarios du={du} onChange={setDu} grade={grade} onGrade={setGrade} tamanhos={tamanhos} uid={user.id}
            titulo={`${nomeCliente} · ${it.descricao}`} clienteNome={nomeCliente} ppId={p.id} itemIdx={idx} onLinkCriado={(novo) => gravar(novo, grade)} />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs" style={{ color: C.sub }}>{st}</span>
            <button onClick={() => gravar()} disabled={st === "Salvando…"} className="ml-auto px-4 py-2 rounded-lg font-semibold text-sm" style={{ background: C.accent, color: "#fff" }}>Salvar item</button>
          </div>
        </div>
      )}
    </div>
  );
}
