"use client";
// v1084 — Comercial › Frente de caixa da loja física (NORT), no modelo da calculadora do Gerson.
//   Catálogo (modelo = produto + cor, ligado a uma FPP) com o estoque LOJA por tamanho · item com grade, técnica e estampas por posição
//   · carrinho com desconto de quantidade, taxa de bordado, desconto/acréscimo · fechamento com pagamento (entrada mínima 50% no
//   personalizado/encomenda; abaixo disso ou desconto > 10% pede a senha de sócio) · vendas: pagamento do saldo, pronta, entrega, cancelamento.
import ProdutoIcon from "./produtoIcon";
import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, Search, ShoppingCart, Trash2, Pencil, Loader2, ArrowLeft, Settings, CheckCircle2, Package, MessageCircle, RefreshCw, Lock, Store } from "lucide-react";
import { alerta, confirmar, perguntar } from "./dialogo";
import { useMobile } from "./useMobile";
import { POSICOES, limparItem, calcularItem, totaisPedido, textoPersonalizacao, qtdDe, grupoDe, pecaDoGrupo } from "@/lib/lojaPreco";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD" };
const inpS = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const inp = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const brl = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: String(s).length === 10 ? "UTC" : undefined }) : "");
const TAMS_CAMISA = ["PP", "P", "M", "G", "GG", "XG", "EXG"], TAMS_CALCA = ["M", "G", "GG", "34", "36", "38", "40", "42", "44", "46", "48", "50"];
const ORDEM_TAM = [...TAMS_CAMISA, "EXGG", ...TAMS_CALCA.slice(3), "52", "54", "56", "58"];
const ordTam = (a, b) => ((ORDEM_TAM.indexOf(a) + 1 || 99) - (ORDEM_TAM.indexOf(b) + 1 || 99)) || a.localeCompare(b);
const FORMAS = [["PIX", "PIX"], ["CARTAO_CREDITO", "Cartão de crédito"], ["CARTAO_DEBITO", "Cartão de débito"], ["DINHEIRO", "Dinheiro"]];
const ST = { ORCAMENTO: ["Orçamento", C.yellow, C.yellowSoft], EM_PRODUCAO: ["Em produção", C.blue, C.blueSoft], PRONTA: ["Pronta", C.accent, C.accentSoft], ENTREGUE: ["Entregue", C.green, C.greenSoft], CANCELADA: ["Cancelada", C.sub, C.panel2] };
const Chip = ({ s }) => { const [t, c, f] = ST[s] || [s, C.sub, C.panel2]; return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap" style={{ background: f, color: c }}>{t}</span>; };
const Btn = ({ children, onClick, cor = C.accent, contorno, disabled, cls = "" }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${cls}`}
    style={contorno ? { border: `1px solid ${C.line}`, color: C.text, background: C.panel, opacity: disabled ? 0.5 : 1 } : { background: cor, color: "#fff", opacity: disabled ? 0.5 : 1 }}>{children}</button>
);
function Janela({ titulo, onClose, children, rodape, largura = 640 }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4" style={{ background: "rgba(16,24,40,.45)" }} onClick={onClose}>
      <div className="w-full flex flex-col rounded-t-2xl sm:rounded-xl" style={{ maxWidth: largura, maxHeight: "94vh", background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center px-5 py-3.5" style={{ borderBottom: `1px solid ${C.line}` }}><div className="font-bold flex-1" style={{ color: C.navy }}>{titulo}</div><button onClick={onClose} aria-label="Fechar"><X size={18} style={{ color: C.sub }} /></button></div>
        <div className="px-5 py-4 overflow-auto">{children}</div>
        {rodape && <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>{rodape}</div>}
      </div>
    </div>
  );
}
const resumoItem = (it, prod) => [Object.entries(it.grade).sort(([a], [b]) => ordTam(a, b)).map(([t, q]) => `${q} ${t}`).join(" · "), it.manga === "LONGA" && "manga longa",
  it.outraCor && `outra cor${it.corNome ? ` (${it.corNome})` : ""}`, it.encomenda && "encomenda", it.malha === "TEXTURIZADA" && "texturizada", textoPersonalizacao(it).toLowerCase()].filter(Boolean).join(" · ");

export default function FrenteCaixa({ user }) {
  const api = (url, o = {}) => fetch(url, { cache: "no-store", ...o, headers: { "Content-Type": "application/json", "x-usuario-id": String(user.id) } })
    .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || "Erro."); e.dados = j; throw e; } return j; });
  const [tela, setTela] = useState("CAIXA");
  const [cat, setCat] = useState(null);
  const [carrinho, setCarrinho] = useState({ numero: null, itens: [], desconto: null, acrescimo: null, cliente: { nome: "", telefone: "", documento: "" }, obs: "" });
  const [vendaAberta, setVendaAberta] = useState(null);
  const carregarCat = () => api("/api/loja?catalogo=1").then(setCat).catch((e) => alerta(e.message));
  useEffect(() => { carregarCat(); }, []);
  const editarOrcamento = (v) => { setCarrinho({ numero: v.numero, itens: v.itens, desconto: v.desconto, acrescimo: v.acrescimo, cliente: v.balcao ? { nome: "", telefone: "", documento: "" } : { ...v.cliente }, obs: v.obs || "" }); setVendaAberta(null); setTela("CAIXA"); };
  const novo = () => setCarrinho({ numero: null, itens: [], desconto: null, acrescimo: null, cliente: { nome: "", telefone: "", documento: "" }, obs: "" });
  const TABS = [["CAIXA", "Caixa", ShoppingCart], ["VENDAS", "Vendas e orçamentos", Package], ...(cat?.gerencial ? [["CONFIG", "Catálogo e preços", Settings]] : [])];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 mb-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        {TABS.map(([k, t, I]) => <button key={k} onClick={() => setTela(k)} className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold" style={{ color: tela === k ? C.accent : C.sub, borderBottom: tela === k ? `3px solid ${C.accent}` : "3px solid transparent", marginBottom: -1 }}><I size={15} /> {t}</button>)}
      </div>
      {!cat ? <div className="flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>
        : tela === "CAIXA" ? <Caixa api={api} cat={cat} carrinho={carrinho} setCarrinho={setCarrinho} onNovo={novo} onFechou={(n) => { novo(); setTela("VENDAS"); setVendaAberta(n); carregarCat(); }} />
        : tela === "VENDAS" ? <Vendas api={api} cat={cat} aberta={vendaAberta} setAberta={setVendaAberta} onEditar={editarOrcamento} />
        : <Config api={api} cat={cat} onMudou={carregarCat} />}
    </div>
  );
}

// ---------- caixa: catálogo + carrinho ----------
function Caixa({ api, cat, carrinho, setCarrinho, onNovo, onFechou }) {
  const tab = cat.tabelas;
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [itemEd, setItemEd] = useState(null);   // { prod, item?, idx? }
  const [fechar, setFechar] = useState(false);
  const [desc, setDesc] = useState(false);
  const mobile = useMobile();
  const porId = useMemo(() => Object.fromEntries(cat.produtos.map((p) => [p.id, p])), [cat]);
  const q = busca.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = cat.produtos.filter((p) => (!grupo || p.grupo === grupo) && (!q || p.modelo.normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)));
  const grupos = [...new Set(cat.produtos.map((p) => p.grupo))].map((k) => grupoDe(tab, k)).filter(Boolean);
  const cartoes = [...new Set(lista.map((p) => p.grupo))].map((k) => {   // v1093 — um card por produto (estava faltando: derrubava a tela)
    const g = grupoDe(tab, k); if (!g) return null;
    const prods = lista.filter((p) => p.grupo === k);
    return { g, prods, foto: prods.find((p) => p.fotos?.length)?.fotos[0] || null, estoque: prods.reduce((s, p) => s + (Number(p.estoqueTotal) || 0), 0) };
  }).filter(Boolean);
  const itens = carrinho.itens;
  const tot = itens.length ? totaisPedido(tab, itens, { desconto: carrinho.desconto, acrescimo: carrinho.acrescimo }) : null;
  const salvarOrc = async () => {
    try { const r = await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "orcamento", ...carrinho }) }); setCarrinho((c) => ({ ...c, numero: r.numero })); alerta(`Orçamento ${r.numero} salvo.`); }
    catch (e) { alerta(e.message); }
  };
  const whats = () => {
    const tel = String(carrinho.cliente?.telefone || "").replace(/\D/g, "");
    const txt = [`*Orçamento NORT Sports${carrinho.numero ? ` nº ${carrinho.numero}` : ""}*`, ...itens.map((it, i) => { const l = tot.linhas[i]; return `• ${it.modelo} — ${resumoItem(it)}: ${l.qtd} × ${brl(l.unit)} = ${brl(l.total)}`; }),
      tot.taxaBordado ? `Taxa de bordado: ${brl(tot.taxaBordado)}` : "", tot.descontoExtra ? `Desconto: −${brl(tot.descontoExtra)}` : "", tot.acrescimo ? `Adicional: ${brl(tot.acrescimo)}` : "",
      `*Total: ${brl(tot.total)}*`, tot.producao ? `Entrada mínima: ${brl(tot.entradaMinima)} (50%). Pagamento: cartão, Pix ou dinheiro.` : "Pagamento: cartão, Pix ou dinheiro."].filter(Boolean).join("\n");
    window.open(`https://wa.me/${tel.length >= 10 ? `55${tel.replace(/^55/, "")}` : ""}?text=${encodeURIComponent(txt)}`, "_blank", "noopener");
  };
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: mobile ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(320px, 400px)" }}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 flex-1 min-w-[200px]" style={inpS}><Search size={15} style={{ color: C.sub }} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto ou cor…" className="bg-transparent outline-none text-sm flex-1" /></div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setGrupo("")} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={!grupo ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>Todos</button>
          {grupos.map((g) => <button key={g.k} onClick={() => setGrupo(g.k)} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={grupo === g.k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{g.nome}</button>)}
        </div>
        {!cat.produtos.length && <div className="p-6 rounded-xl text-center text-sm" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.sub }}>Catálogo da loja vazio. {cat.gerencial ? "Monte em Catálogo e preços › Importar do estoque NORT." : "Peça para a gestão montar o catálogo."}</div>}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>   {/* v1091 — um card por produto (as cores ficam dentro), com a foto, como na calculadora */}
          {cartoes.map((c) => (
            <button key={c.g.k} onClick={() => setItemEd({ grupo: c.g.k })} className="group text-left rounded-3xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg" style={{ background: "linear-gradient(180deg,#FFFFFF 0%,#F7FAFE 100%)", border: `1px solid ${C.line}`, boxShadow: "0 2px 6px rgba(16,24,40,.06)" }}>
              <div className="relative flex items-center justify-center overflow-hidden rounded-2xl m-3 mb-0" style={{ height: 150, background: "radial-gradient(120% 120% at 50% 18%, #FFFFFF 0%, #E3EBF6 100%)" }}>   {/* v1094 — mesma ilustração da calculadora */}
                <span aria-hidden className="absolute rounded-full" style={{ width: 116, height: 116, background: "radial-gradient(circle, #FDE4CF 0%, rgba(253,228,207,0) 70%)" }} />
                <ProdutoIcon produtoId={c.g.k} className="relative h-24 w-24 transition-transform duration-300 group-hover:scale-[1.04]" />
                {c.estoque > 0 && <span className="absolute top-2.5 right-2.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: C.green, color: "#fff" }}>{c.estoque} em estoque</span>}
              </div>
              <div className="px-4 py-3">
                <div className="text-sm font-bold leading-tight" style={{ color: C.navy }}>{c.g.nome}</div>
                <div className="flex items-center gap-1 mt-1.5">{c.prods.slice(0, 9).map((p) => <span key={p.id} title={p.cor} className="inline-block rounded-full" style={{ width: 13, height: 13, background: p.hex, border: "1px solid rgba(0,0,0,.15)" }} />)}{c.prods.length > 9 && <span className="text-[10px]" style={{ color: C.sub }}>+{c.prods.length - 9}</span>}</div>
                <div className="text-xs mt-1.5" style={{ color: C.text }}>a partir de <b style={{ color: C.accent }}>{brl(c.g.base)}</b> · {c.prods.length} cor(es)</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl flex flex-col self-start sticky top-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <ShoppingCart size={17} style={{ color: C.accent }} /><div className="font-bold flex-1" style={{ color: C.navy }}>{carrinho.numero ? `Orçamento ${carrinho.numero}` : "Pedido"}</div>
          {(itens.length > 0 || carrinho.numero) && <button onClick={async () => { if (await confirmar("Limpar o carrinho e começar outro?")) onNovo(); }} className="text-xs" style={{ color: C.sub }}>novo</button>}
        </div>
        <div className="px-4 py-2 max-h-[46vh] overflow-auto">
          {!itens.length && <div className="text-sm py-6 text-center" style={{ color: C.sub }}>Escolha um produto no catálogo.</div>}
          {itens.map((it, i) => { const l = tot.linhas[i]; return (
            <div key={i} className="py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold" style={{ color: C.text }}>{it.modelo}</div><div className="text-xs" style={{ color: C.sub }}>{resumoItem(it)}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.sub }}>{l.qtd} × {brl(l.unit)}{l.unit !== l.unitTabela ? <span style={{ color: C.green }}> (faixa {["1-5", "6-10", "11+", "20+"][l.faixa]})</span> : null}{l.producao ? " · produção" : ""}</div></div>
                <div className="text-sm font-bold" style={{ color: C.navy }}>{brl(l.total)}</div>
              </div>
              <div className="flex gap-3 mt-1"><button onClick={() => setItemEd({ grupo: it.grupo, item: it, idx: i })} className="text-xs flex items-center gap-1" style={{ color: C.blue }}><Pencil size={12} /> editar</button>
                <button onClick={() => setCarrinho((c) => ({ ...c, itens: c.itens.filter((_, j) => j !== i) }))} className="text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={12} /> tirar</button></div>
            </div>); })}
        </div>
        {tot && (
          <div className="px-4 py-3 text-sm space-y-1" style={{ borderTop: `1px solid ${C.line}`, background: "#FAFBFC" }}>
            <div className="flex justify-between"><span style={{ color: C.sub }}>Valor de tabela</span><span>{brl(tot.valorTabela)}</span></div>
            {tot.descontoQuantidade > 0 && <div className="flex justify-between" style={{ color: C.green }}><span>Desconto por quantidade</span><span>−{brl(tot.descontoQuantidade)}</span></div>}
            {tot.taxaBordado > 0 && <div className="flex justify-between"><span style={{ color: C.sub }}>Taxa de bordado</span><span>{brl(tot.taxaBordado)}</span></div>}
            {tot.descontoExtra > 0 && <div className="flex justify-between" style={{ color: C.green }}><span>Desconto {String(tot.descontoPct).replace(".", ",")}%{tot.precisaSenha ? " 🔒" : ""}</span><span>−{brl(tot.descontoExtra)}</span></div>}
            {tot.acrescimo > 0 && <div className="flex justify-between"><span style={{ color: C.sub }}>Adicional</span><span>{brl(tot.acrescimo)}</span></div>}
            <div className="flex justify-between text-lg font-bold pt-1" style={{ color: C.navy }}><span>Total</span><span>{brl(tot.total)}</span></div>
            <div className="text-xs" style={{ color: C.sub }}>{tot.pecas} peça(s){tot.producao ? ` · entrada mínima ${brl(tot.entradaMinima)}` : " · pagamento total"}</div>
            <button onClick={() => setDesc(true)} className="text-xs font-semibold" style={{ color: C.blue }}>{carrinho.desconto || carrinho.acrescimo ? "Mudar desconto / acréscimo" : "Desconto / acréscimo"}</button>
          </div>
        )}
        <div className="px-4 py-3 grid grid-cols-2 gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <Btn contorno disabled={!itens.length} onClick={salvarOrc}>Salvar orçamento</Btn>
          <Btn contorno disabled={!itens.length} onClick={whats}><MessageCircle size={14} /> WhatsApp</Btn>
          <Btn cls="col-span-2" disabled={!itens.length} onClick={() => setFechar(true)}><CheckCircle2 size={15} /> Cliente fechou? Receber pagamento</Btn>
        </div>
      </div>
      {itemEd && <ItemModal tab={tab} prods={cat.produtos.filter((p) => p.grupo === (itemEd.grupo || itemEd.item?.grupo))} prodInicial={itemEd.item ? porId[itemEd.item.produtoId] : null} inicial={itemEd.item} onClose={() => setItemEd(null)}
        onOk={(it) => { setCarrinho((c) => ({ ...c, itens: itemEd.idx != null ? c.itens.map((x, j) => (j === itemEd.idx ? it : x)) : [...c.itens, it] })); setItemEd(null); }} />}
      {desc && <DescontoModal tab={tab} carrinho={carrinho} onClose={() => setDesc(false)} onOk={(d, a) => { setCarrinho((c) => ({ ...c, desconto: d, acrescimo: a })); setDesc(false); }} />}
      {fechar && <FecharModal api={api} tab={tab} carrinho={carrinho} setCarrinho={setCarrinho} tot={tot} onClose={() => setFechar(false)} onOk={(n) => { setFechar(false); onFechou(n); }} />}
    </div>
  );
}

// v1091 — peça na cor escolhida (máscara + sombra da calculadora)
function Palco({ peca, vista, hex, foto }) {
  const base = `/loja/pecas/${peca}/${vista}`;
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "1 / 1", background: "radial-gradient(120% 120% at 50% 18%, #FFFFFF 0%, #E3EBF6 100%)" }}>
      {foto ? <img src={foto} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover" }} />
        : peca ? <div className="absolute inset-0" style={{ isolation: "isolate" }}>
          <div className="absolute inset-0" style={{ background: hex, WebkitMaskImage: `url(${base}-mascara.png)`, maskImage: `url(${base}-mascara.png)`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", transition: "background 400ms ease" }} />
          <img src={`${base}-sombra.png`} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill", mixBlendMode: "hard-light" }} />
        </div> : <Package size={48} className="absolute inset-0 m-auto" style={{ color: C.sub }} />}
    </div>
  );
}
function ItemModal({ tab, prods, prodInicial, inicial, onClose, onOk }) {
  const [prod, setProd] = useState(() => prodInicial || prods.find((p) => p.fppId && p.estoqueTotal > 0) || prods.find((p) => p.fppId) || prods[0]);
  const [vista, setVista] = useState("frente");
  const [foto, setFoto] = useState(null);
  const g = grupoDe(tab, prod.grupo);
  const tams = [...new Set([...(g.tipo === "CALCA" || g.tipo === "LISA" && /cal/.test(g.k) ? TAMS_CALCA : TAMS_CAMISA), ...prods.flatMap((p) => Object.keys(p.estoque || {}))])].sort(ordTam);
  const [it, setIt] = useState(() => inicial ? { ...inicial } : { produtoId: prod.id, grupo: prod.grupo, modelo: prod.modelo, fppId: prod.fppId, fppNumero: prod.fppNumero, grade: {}, manga: "CURTA", tecnica: null, estampas: [], outraCor: false, corNome: "", encomenda: false, malha: "LISA", bolso: false, obs: "" });
  const set = (p) => setIt((x) => ({ ...x, ...p }));
  const escolherCor = (p) => { setProd(p); setFoto(null); setIt((x) => ({ ...x, produtoId: p.id, modelo: p.modelo, fppId: p.fppId, fppNumero: p.fppNumero })); };
  const peca = pecaDoGrupo(prod.grupo, it.manga);
  const limpo = limparItem(tab, { ...it, tecnica: it.tecnica });
  const enc = it.encomenda || it.outraCor || it.manga === "LONGA" || g.tipo === "SUBLIMACAO";
  const l = qtdDe(limpo.grade) ? calcularItem(tab, limpo) : null;
  const estampaDe = (k) => (it.estampas || []).find((e) => e.local === k)?.tamanho || "";
  const setEstampa = (k, tam) => set({ estampas: [...(it.estampas || []).filter((e) => e.local !== k), ...(tam ? [{ local: k, tamanho: tam }] : [])] });
  const excede = !enc && Object.entries(it.grade || {}).some(([t, q]) => (Number(q) || 0) > Math.max(0, Number(prod.estoque?.[t]) || 0));
  const trocarTecnica = (t) => { const ok = (it.estampas || []).filter((e) => (POSICOES.find((p) => p.k === e.local)?.[t] || []).includes(e.tamanho)); if (t && ok.length < (it.estampas || []).length) alerta("Algumas estampas não existem nessa técnica e saíram."); set({ tecnica: t, estampas: t ? ok : [] }); };
  return (
    <Janela titulo={g.nome} onClose={onClose} largura={920}
      rodape={<>{l && <div className="mr-auto text-sm" style={{ color: C.text }}><b style={{ color: C.navy }}>{brl(l.unit)}</b>/peça · {l.qtd} peça(s) · <b style={{ color: C.navy }}>{brl(l.total)}</b></div>}
        <Btn contorno onClick={onClose}>Cancelar</Btn><Btn disabled={!l || excede || !prod.fppId || (it.tecnica && !(it.estampas || []).length)} onClick={() => onOk(limpo)}><Plus size={14} /> {inicial ? "Atualizar" : "Adicionar ao carrinho"}</Btn></>}>
      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)" }}>
        <div>
          <Palco peca={peca} vista={vista} hex={it.outraCor ? "#B0B0B0" : prod.hex} foto={foto} />
          <div className="flex items-center gap-1.5 mt-2">
            {peca && [["frente", "Frente"], ["costas", "Costas"]].map(([k, t]) => <button key={k} onClick={() => { setVista(k); setFoto(null); }} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={!foto && vista === k ? { background: C.navy, color: "#fff" } : { border: `1px solid ${C.line}`, color: C.sub }}>{t}</button>)}
            {(prod.fotos || []).map((f, k) => <button key={f} onClick={() => setFoto(f)} className="rounded-lg overflow-hidden" style={{ width: 34, height: 34, border: `2px solid ${foto === f ? C.accent : C.line}` }}><img src={f} alt={`foto ${k + 1}`} className="w-full h-full" style={{ objectFit: "cover" }} /></button>)}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs mb-2" style={{ color: C.sub }}>base {brl(g.base)}{prod.fppNumero ? ` · FPP ${String(prod.fppNumero).padStart(5, "0")}` : ""}</div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>COR</div>
          <div className="flex flex-wrap gap-1.5">
            {prods.map((p) => { const on = p.id === prod.id; return (
              <button key={p.id} onClick={() => escolherCor(p)} title={p.fppId ? `${p.cor} · ${p.estoqueTotal} em estoque` : `${p.cor} · sem FPP ligada (gestão liga em Catálogo e preços)`} className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs"
                style={{ border: `2px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", opacity: p.fppId ? 1 : 0.5 }}>
                <span className="inline-block rounded-full" style={{ width: 18, height: 18, background: p.hex, border: "1px solid rgba(0,0,0,.18)" }} />
                <span style={{ color: C.text, fontWeight: on ? 700 : 500 }}>{p.cor || p.modelo}</span><span style={{ color: p.estoqueTotal > 0 ? C.green : C.sub }}>{p.estoqueTotal > 0 ? p.estoqueTotal : "0"}</span>
              </button>); })}
          </div>
          {!prod.fppId && <div className="text-xs mt-2 px-2.5 py-1.5 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>Esta cor ainda não tem FPP ligada: a gestão liga em Catálogo e preços (o custo cobrado da NORT vem dela).</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {g.tipo !== "SUBLIMACAO" && <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}><input type="checkbox" checked={it.encomenda} onChange={(e) => set({ encomenda: e.target.checked })} /> Encomenda (não sai do estoque)</label>}
        {g.tipo !== "SUBLIMACAO" && <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}><input type="checkbox" checked={it.outraCor} onChange={(e) => set({ outraCor: e.target.checked })} /> Outra cor (+{tab.outraCorPct}%)</label>}
        {it.outraCor && <input value={it.corNome || ""} onChange={(e) => set({ corNome: e.target.value })} placeholder="qual cor?" className="rounded-lg px-3 py-1.5 text-sm outline-none" style={inpS} />}
        {g.longa && <div className="flex rounded-lg overflow-hidden text-sm" style={{ border: `1px solid ${C.line}` }}>{[["CURTA", "Manga curta"], ["LONGA", "Manga longa (+R$ 4)"]].map(([k, t]) => <button key={k} onClick={() => set({ manga: k })} className="px-3 py-1.5" style={it.manga === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>)}</div>}
        {g.tipo === "SUBLIMACAO" && <div className="flex rounded-lg overflow-hidden text-sm" style={{ border: `1px solid ${C.line}` }}>{[["LISA", "Malha lisa"], ["TEXTURIZADA", "Texturizada (+R$ 23)"]].map(([k, t]) => <button key={k} onClick={() => set({ malha: k })} className="px-3 py-1.5" style={it.malha === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>)}</div>}
        {g.tipo === "CALCA" && g.bolso && <label className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}><input type="checkbox" checked={it.bolso} onChange={(e) => set({ bolso: e.target.checked })} /> Bordado no bolso</label>}
      </div>
      <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>GRADE {enc ? "(encomenda: sem limite de estoque)" : "(limitada ao estoque da loja)"}</div>
      <div className="flex flex-wrap gap-2 mb-1">
        {tams.map((t) => { const s = Math.max(0, Number(prod.estoque?.[t]) || 0), q = Number(it.grade?.[t]) || 0, passou = !enc && q > s; return (
          <label key={t} className="flex flex-col items-center rounded-lg px-2 py-1.5" style={{ border: `1px solid ${passou ? C.red : C.line}`, minWidth: 62 }}>
            <span className="text-xs font-bold" style={{ color: C.navy }}>{t}</span>
            <input value={it.grade?.[t] || ""} onChange={(e) => set({ grade: { ...it.grade, [t]: e.target.value.replace(/\D/g, "").slice(0, 4) } })} inputMode="numeric" className="w-12 text-center rounded px-1 py-1 text-sm outline-none" style={inpS} />
            <span className="text-[10px]" style={{ color: passou ? C.red : s ? C.green : C.sub }}>{enc ? "—" : `tem ${s}`}</span>
          </label>); })}
      </div>
      {excede && <div className="text-xs mb-2" style={{ color: C.red }}>Passou do estoque da loja. Diminua ou marque como encomenda.</div>}
      {g.tipo === "PADRAO" && g.tecnicas.length > 0 && <>
        <div className="text-xs font-semibold mt-3 mb-1.5" style={{ color: C.sub }}>PERSONALIZAÇÃO (uma estampa por posição · esquerdo/direito de quem veste)</div>
        <div className="flex rounded-lg overflow-hidden text-sm mb-2 w-fit" style={{ border: `1px solid ${C.line}` }}>
          {[[null, "Lisa"], ...g.tecnicas.map((t) => [t, t === "DTF" ? "DTF" : "Bordado"])].map(([k, t]) => <button key={t} onClick={() => trocarTecnica(k)} className="px-3 py-1.5" style={it.tecnica === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>)}
        </div>
        {it.tecnica && <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {POSICOES.filter((p) => (p[it.tecnica] || []).length).map((p) => (
            <div key={p.k} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ border: `1px solid ${estampaDe(p.k) ? C.accent : C.line}` }}>
              <span className="text-xs flex-1" style={{ color: C.text }}>{p.nome}</span>
              <select value={estampaDe(p.k)} onChange={(e) => setEstampa(p.k, e.target.value)} className="rounded px-1.5 py-1 text-xs outline-none" style={inpS}>
                <option value="">—</option>{p[it.tecnica].map((t) => <option key={t} value={t}>{t} cm</option>)}
              </select>
            </div>
          ))}
        </div>}
      </>}
      <input value={it.obs || ""} onChange={(e) => set({ obs: e.target.value })} placeholder="Observação do item (vai para a produção)" className={`${inp} mt-3`} style={inpS} />
    </Janela>
  );
}

function DescontoModal({ tab, carrinho, onClose, onOk }) {
  const [modo, setModo] = useState(carrinho.acrescimo ? "ACR" : "DESC");
  const [tipo, setTipo] = useState((carrinho.desconto || carrinho.acrescimo)?.tipo || "PCT");
  const [valor, setValor] = useState(String((carrinho.desconto || carrinho.acrescimo)?.valor || "").replace(".", ","));
  const [obs, setObs] = useState(carrinho.acrescimo?.obs || "");
  const v = Number(String(valor).replace(",", ".")) || 0;
  const ok = () => { if (modo === "ACR" && v > 0 && !obs.trim()) return alerta("Acréscimo precisa de observação."); onOk(modo === "DESC" && v > 0 ? { tipo, valor: v } : null, modo === "ACR" && v > 0 ? { tipo, valor: v, obs } : null); };
  return (
    <Janela titulo="Desconto ou acréscimo" onClose={onClose} largura={440} rodape={<><Btn contorno onClick={() => onOk(null, null)}>Tirar</Btn><Btn onClick={ok}>Aplicar</Btn></>}>
      <div className="flex rounded-lg overflow-hidden text-sm mb-3" style={{ border: `1px solid ${C.line}` }}>{[["DESC", "Desconto"], ["ACR", "Acréscimo"]].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className="flex-1 px-3 py-2" style={modo === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub }}>{t}</button>)}</div>
      <div className="flex gap-2 mb-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={inpS}><option value="PCT">%</option><option value="VALOR">R$</option></select>
        <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={inp} style={inpS} autoFocus />
      </div>
      {modo === "DESC" ? <div className="text-xs" style={{ color: C.sub }}>Sobre o valor já com o desconto de quantidade, sem a taxa de bordado. Até {tab.descontoLivrePct}% livre; acima, pede a senha de sócio ao fechar.</div>
        : <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Motivo do acréscimo (obrigatório)" className={inp} style={inpS} />}
    </Janela>
  );
}

function FecharModal({ api, tab, carrinho, setCarrinho, tot, onClose, onOk }) {
  const [cli, setCli] = useState(carrinho.cliente || { nome: "", telefone: "", documento: "" });
  const [pgs, setPgs] = useState([{ forma: "PIX", valor: ((tot.producao ? tot.entradaMinima : tot.total) / 100).toFixed(2).replace(".", ",") }]);
  const [senha, setSenha] = useState("");
  const [socio, setSocio] = useState("");
  const [obs, setObs] = useState(carrinho.obs || "");
  const [salv, setSalv] = useState(false);
  const soma = pgs.reduce((s, p) => s + Math.round((Number(String(p.valor).replace(",", ".")) || 0) * 100), 0);
  const abaixo = tot.producao ? soma < tot.entradaMinima : soma < tot.total;
  const pedeSenha = tot.precisaSenha || (tot.producao && abaixo);
  const ir = async () => {
    setSalv(true);
    try {
      setCarrinho((c) => ({ ...c, cliente: cli, obs }));
      const r = await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "fechar", ...carrinho, cliente: cli, obs, pagamentos: pgs, senha, socio }) });
      await alerta([`Venda ${r.numero} fechada.`, r.pedido ? `Pedido de produção ${r.pedido} lançado.` : "", r.producaoErro ? `ATENÇÃO: não lançou na produção (${r.producaoErro}). Use "Tentar de novo" na venda.` : "", ...(r.avisos || [])].filter(Boolean).join("\n"));
      onOk(r.numero);
    } catch (e) { if (e.dados?.numero) setCarrinho((c) => ({ ...c, numero: e.dados.numero })); alerta(e.message); }
    setSalv(false);
  };
  return (
    <Janela titulo={`Fechar venda · ${brl(tot.total)}`} onClose={onClose} largura={560}
      rodape={<><Btn contorno onClick={onClose}>Voltar</Btn><Btn cor={C.green} disabled={salv || !soma || (!tot.producao && soma < tot.total) || (pedeSenha && senha.length !== 4)} onClick={ir}>{salv ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Confirmar pagamento</Btn></>}>
      <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>CLIENTE (em branco = venda de balcão)</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <input value={cli.nome || ""} onChange={(e) => setCli({ ...cli, nome: e.target.value })} placeholder="Nome" className={`${inp} sm:col-span-3`} style={inpS} />
        <input value={cli.telefone || ""} onChange={(e) => setCli({ ...cli, telefone: e.target.value })} placeholder="Telefone / WhatsApp" inputMode="tel" className={inp} style={inpS} />
        <input value={cli.documento || ""} onChange={(e) => setCli({ ...cli, documento: e.target.value })} placeholder="CPF ou CNPJ (opcional)" className={`${inp} sm:col-span-2`} style={inpS} />
      </div>
      <div className="text-xs font-semibold mb-1.5" style={{ color: C.sub }}>PAGAMENTO RECEBIDO AGORA {tot.producao ? `(entrada mínima ${brl(tot.entradaMinima)})` : "(peça do estoque: total)"}</div>
      {pgs.map((p, i) => (
        <div key={i} className="flex gap-2 mb-1.5">
          <select value={p.forma} onChange={(e) => setPgs(pgs.map((x, j) => (j === i ? { ...x, forma: e.target.value } : x)))} className="rounded-lg px-3 py-2 text-sm outline-none" style={inpS}>{FORMAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          <input value={p.valor} onChange={(e) => setPgs(pgs.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))} inputMode="decimal" className={inp} style={inpS} />
          {pgs.length > 1 && <button onClick={() => setPgs(pgs.filter((_, j) => j !== i))}><Trash2 size={15} style={{ color: C.red }} /></button>}
        </div>
      ))}
      <div className="flex items-center gap-3 mb-3 text-xs">
        <button onClick={() => setPgs([...pgs, { forma: "CARTAO_CREDITO", valor: "" }])} className="font-semibold flex items-center gap-1" style={{ color: C.accent }}><Plus size={13} /> Outra forma</button>
        <button onClick={() => setPgs([{ forma: pgs[0]?.forma || "PIX", valor: (tot.total / 100).toFixed(2).replace(".", ",") }])} className="font-semibold" style={{ color: C.blue }}>Pagar o total</button>
        <span className="ml-auto" style={{ color: soma > tot.total ? C.red : C.text }}>Recebido {brl(soma)} · saldo {brl(Math.max(0, tot.total - soma))}</span>
      </div>
      {pedeSenha && <div className="rounded-lg p-3 mb-3" style={{ background: C.yellowSoft }}>
        <div className="text-xs font-semibold mb-2 flex items-center gap-1" style={{ color: C.yellow }}><Lock size={13} /> {tot.precisaSenha ? `Desconto acima de ${tab.descontoLivrePct}%` : `Entrada abaixo de ${tab.entradaMinPct}%`}: senha de sócio</div>
        <div className="flex gap-2"><input value={socio} onChange={(e) => setSocio(e.target.value)} placeholder="Sócio que liberou" className={inp} style={inpS} />
          <input value={senha} onChange={(e) => setSenha(e.target.value.replace(/\D/g, "").slice(0, 4))} type="password" inputMode="numeric" placeholder="4 dígitos" className="w-28 rounded-lg px-3 py-2 text-sm outline-none" style={inpS} /></div>
      </div>}
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações da venda (opcional)" className={inp} style={inpS} />
      {tot.producao && <div className="text-xs mt-2" style={{ color: C.sub }}>Os itens personalizados ou de encomenda viram um pedido de produção (NORT × Meridian, loja física). Previsão: {tab.prazos.personalizado} dias úteis (DTF/bordado) ou {tab.prazos.encomenda} (encomenda/sublimação).</div>}
    </Janela>
  );
}

// ---------- vendas e orçamentos ----------
function Vendas({ api, cat, aberta, setAberta, onEditar }) {
  const [filtro, setFiltro] = useState("ABERTAS");
  const [l, setL] = useState(null);
  const carregar = () => api(`/api/loja?vendas=1&status=${filtro}`).then((j) => setL(j.vendas)).catch((e) => alerta(e.message));
  useEffect(() => { setL(null); carregar(); }, [filtro]);
  if (aberta) return <VendaDetalhe api={api} numero={aberta} onVoltar={() => { setAberta(null); carregar(); }} onEditar={onEditar} />;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[["ABERTAS", "Em aberto"], ["ORCAMENTO", "Orçamentos"], ["ENTREGUE", "Entregues"], ["CANCELADA", "Canceladas"], ["TODAS", "Todas"]].map(([k, t]) => (
          <button key={k} onClick={() => setFiltro(k)} className="text-xs px-3 py-1.5 rounded-full font-semibold" style={filtro === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.sub, border: `1px solid ${C.line}` }}>{t}</button>))}
        <button onClick={carregar} className="ml-auto p-1.5 rounded" title="Atualizar"><RefreshCw size={14} style={{ color: C.sub }} /></button>
      </div>
      {!l ? <div className="flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div> : !l.length ? <div className="text-sm py-8 text-center" style={{ color: C.sub }}>Nada aqui.</div> : (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Previsão</th><th className="px-3 py-2">Pedido</th><th className="px-3 py-2">Situação</th></tr></thead>
            <tbody>{l.map((v) => (
              <tr key={v.id} onClick={() => setAberta(v.numero)} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 font-bold" style={{ color: C.navy }}>{v.numero}</td><td className="px-3 py-2">{dBR(v.fechadaEm || v.createdAt)}</td><td className="px-3 py-2">{v.cliente?.nome || "—"}</td>
                <td className="px-3 py-2 text-right font-semibold">{brl(v.total)}</td><td className="px-3 py-2 text-right" style={{ color: v.saldo && v.status !== "ORCAMENTO" ? C.red : C.sub }}>{v.status === "ORCAMENTO" ? "—" : brl(v.saldo)}</td>
                <td className="px-3 py-2">{dBR(v.previsao)}</td><td className="px-3 py-2">{v.pedidoNumero || (v.producaoErro ? <span style={{ color: C.red }}>falhou</span> : "—")}</td><td className="px-3 py-2"><Chip s={v.status} /></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VendaDetalhe({ api, numero, onVoltar, onEditar }) {
  const [v, setV] = useState(null);
  const [pg, setPg] = useState(null);
  const carregar = () => api(`/api/loja?venda=${numero}`).then((j) => setV(j.venda)).catch((e) => alerta(e.message));
  useEffect(() => { carregar(); }, [numero]);
  const acao = async (acao, extra = {}, msg) => {
    try { const r = await api("/api/loja", { method: "POST", body: JSON.stringify({ acao, numero, ...extra }) }); if (msg) await alerta(typeof msg === "function" ? msg(r) : msg); carregar(); } catch (e) { alerta(e.message); }
  };
  if (!v) return <div className="flex items-center gap-2" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  const t = v.totais || {}, aberta = ["EM_PRODUCAO", "PRONTA"].includes(v.status), tel = String(v.cliente?.telefone || "").replace(/\D/g, "");
  return (
    <div className="max-w-4xl">
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm mb-3" style={{ color: C.accent }}><ArrowLeft size={15} /> Vendas</button>
      <div className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xl font-bold" style={{ color: C.navy }}>Venda {v.numero}</div><Chip s={v.status} />
          {v.pedidoNumero && <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: C.blueSoft, color: C.blue }}>Pedido {v.pedidoNumero}</span>}
          <div className="ml-auto text-right"><div className="text-xl font-bold" style={{ color: C.navy }}>{brl(v.total)}</div>{v.status !== "ORCAMENTO" && <div className="text-xs" style={{ color: v.saldo ? C.red : C.green }}>{v.saldo ? `saldo ${brl(v.saldo)}` : "quitada"}</div>}</div>
        </div>
        <div className="text-sm mt-1" style={{ color: C.sub }}>{v.cliente?.nome}{v.cliente?.telefone ? ` · ${v.cliente.telefone}` : ""} · {v.vendedorNome || ""}{v.previsao ? ` · previsão ${dBR(v.previsao)}` : ""}</div>
        {v.producaoErro && <div className="mt-2 p-2 rounded text-sm flex items-center gap-2" style={{ background: C.redSoft, color: C.red }}>Não lançou na produção: {v.producaoErro}<button onClick={() => acao("producao", {}, (r) => `Pedido ${r.pedido} lançado.`)} className="ml-auto px-2 py-1 rounded text-xs font-semibold" style={{ background: C.red, color: "#fff" }}>Tentar de novo</button></div>}
      </div>
      <div className="rounded-xl p-4 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {(v.itens || []).map((it, i) => <div key={i} className="py-2 text-sm" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}><b>{it.modelo}</b><div className="text-xs" style={{ color: C.sub }}>{resumoItem(it)}</div></div>)}
        <div className="pt-2 mt-2 text-sm space-y-0.5" style={{ borderTop: `1px solid ${C.line}` }}>
          {t.descontoQuantidade > 0 && <div className="flex justify-between" style={{ color: C.green }}><span>Desconto por quantidade</span><span>−{brl(t.descontoQuantidade)}</span></div>}
          {t.taxaBordado > 0 && <div className="flex justify-between"><span>Taxa de bordado</span><span>{brl(t.taxaBordado)}</span></div>}
          {t.descontoExtra > 0 && <div className="flex justify-between" style={{ color: C.green }}><span>Desconto{v.desconto?.liberadoPor ? ` (liberado por ${v.desconto.liberadoPor})` : ""}</span><span>−{brl(t.descontoExtra)}</span></div>}
          {t.acrescimo > 0 && <div className="flex justify-between"><span>Adicional · {v.acrescimo?.obs}</span><span>{brl(t.acrescimo)}</span></div>}
        </div>
      </div>
      {(v.pagamentos || []).length > 0 && <div className="rounded-xl p-4 mb-3 text-sm" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>PAGAMENTOS</div>
        {v.pagamentos.map((p, i) => <div key={i} className="flex justify-between py-0.5"><span>{dBR(p.em)} · {(FORMAS.find((f) => f[0] === p.forma) || [])[1] || p.forma} · {p.tipo === "SALDO" ? "saldo" : "entrada"}{p.abaixoMinimo ? ` (abaixo do mínimo, ${p.liberadoPor})` : ""}</span><b>{brl(p.valor)}</b></div>)}
      </div>}
      <div className="flex flex-wrap gap-2 mb-3">
        {v.status === "ORCAMENTO" && <Btn onClick={() => onEditar(v)}><Pencil size={14} /> Abrir no caixa</Btn>}
        {aberta && v.saldo > 0 && <Btn cor={C.green} onClick={() => setPg({ forma: "PIX", valor: (v.saldo / 100).toFixed(2).replace(".", ",") })}>Receber pagamento</Btn>}
        {v.status === "EM_PRODUCAO" && <Btn contorno onClick={() => acao("pronta", {}, null)}>Marcar pronta</Btn>}
        {v.status === "PRONTA" && tel.length >= 10 && <Btn contorno onClick={() => window.open(`https://wa.me/55${tel.replace(/^55/, "")}?text=${encodeURIComponent(`Olá, ${v.cliente?.nome || ""}! Seu pedido ${v.numero} da NORT Sports está pronto para retirada.${v.saldo ? ` Saldo a pagar: ${brl(v.saldo)}.` : ""}`)}`, "_blank", "noopener")}><MessageCircle size={14} /> Avisar que está pronto</Btn>}
        {aberta && <Btn contorno disabled={v.saldo > 0} onClick={() => acao("entregar", {}, "Entregue. Lembre de emitir a NFC-e no Bling.")}><Store size={14} /> Entregar</Btn>}
        {!["ENTREGUE", "CANCELADA"].includes(v.status) && <Btn contorno onClick={async () => { const m = await perguntar("Motivo do cancelamento:", ""); if (m) acao("cancelar", { motivo: m }, (r) => ["Venda cancelada.", r.avisoPedido, r.devolver ? `Já foram pagos ${brl(r.devolver)}: combine a devolução com o cliente.` : ""].filter(Boolean).join("\n")); }}><X size={14} /> Cancelar</Btn>}
      </div>
      {(v.historico || []).length > 0 && <div className="text-xs" style={{ color: C.sub }}>{v.historico.slice().reverse().map((h, i) => <div key={i}>{new Date(h.em).toLocaleString("pt-BR")} · {h.por || "—"} · {h.txt}</div>)}</div>}
      {pg && <Janela titulo="Receber pagamento" onClose={() => setPg(null)} largura={420} rodape={<><Btn contorno onClick={() => setPg(null)}>Cancelar</Btn><Btn cor={C.green} onClick={() => { acao("pagamento", pg); setPg(null); }}>Confirmar</Btn></>}>
        <div className="flex gap-2"><select value={pg.forma} onChange={(e) => setPg({ ...pg, forma: e.target.value })} className="rounded-lg px-3 py-2 text-sm outline-none" style={inpS}>{FORMAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
          <input value={pg.valor} onChange={(e) => setPg({ ...pg, valor: e.target.value })} inputMode="decimal" className={inp} style={inpS} /></div>
      </Janela>}
    </div>
  );
}

// ---------- catálogo e preços (gestão) ----------
function Config({ api, cat, onMudou }) {
  const [todos, setTodos] = useState(null);
  const [busca, setBusca] = useState("");
  const [fppDe, setFppDe] = useState(null);   // produto escolhendo FPP
  const [novo, setNovo] = useState(null);
  const [tabEd, setTabEd] = useState(false);
  const carregar = () => api("/api/loja?catalogo=1&todos=1").then((j) => setTodos(j.produtos)).catch((e) => alerta(e.message));
  useEffect(() => { carregar(); }, []);
  const salvar = async (produto) => { try { await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "produto", produto }) }); carregar(); onMudou(); return true; } catch (e) { alerta(e.message); return false; } };
  const importar = async () => { try { const r = await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "importar" }) }); await alerta(`${r.criados} modelo(s) entraram no catálogo.${r.semGrupo.length ? `\nSem grupo de preço reconhecido (ligue à mão): ${r.semGrupo.slice(0, 20).join(", ")}${r.semGrupo.length > 20 ? "…" : ""}` : ""}`); carregar(); onMudou(); } catch (e) { alerta(e.message); } };
  const senha = async () => { const s = await perguntar("Nova senha de sócio (4 dígitos):", ""); if (!s) return; try { await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "senha", senha: s }) }); alerta("Senha de sócio definida."); onMudou(); } catch (e) { alerta(e.message); } };
  const q = busca.trim().toUpperCase();
  const l = (todos || []).filter((p) => !q || p.modelo.includes(q));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Btn onClick={importar}><RefreshCw size={14} /> Importar do estoque NORT</Btn>
        <Btn contorno onClick={() => setNovo({ modelo: "", grupo: cat.tabelas.grupos[0].k })}><Plus size={14} /> Modelo à mão</Btn>
        <Btn contorno onClick={() => setTabEd(true)}><Settings size={14} /> Tabela de preços</Btn>
        <Btn contorno onClick={senha}><Lock size={14} /> {cat.temSenha ? "Trocar senha de sócio" : "Definir senha de sócio"}</Btn>
        <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 ml-auto" style={{ ...inpS, minWidth: 220 }}><Search size={14} style={{ color: C.sub }} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar modelo…" className="bg-transparent outline-none text-sm flex-1" /></div>
      </div>
      {!cat.temSenha && <div className="text-xs mb-2 p-2 rounded" style={{ background: C.yellowSoft, color: C.yellow }}>Sem senha de sócio: desconto acima de 10% e entrada abaixo de 50% ficam bloqueados.</div>}
      <div className="text-xs mb-2" style={{ color: C.sub }}>Cada modelo (produto + cor, igual ao nome no estoque da NORT sem o tamanho) precisa de um grupo de preço e de uma FPP: o custo cobrado da NORT vem da FPP.</div>
      {!todos ? <Loader2 size={15} className="animate-spin" /> : (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm" style={{ minWidth: 760 }}>
            <thead><tr className="text-xs text-left" style={{ background: C.panel2, color: C.sub }}><th className="px-3 py-2">Modelo</th><th className="px-3 py-2">Grupo de preço</th><th className="px-3 py-2">FPP</th><th className="px-3 py-2 text-right">Custo</th><th className="px-3 py-2 text-right">Estoque loja</th><th className="px-3 py-2" /></tr></thead>
            <tbody>{l.map((p) => (
              <tr key={p.id} style={{ borderTop: `1px solid ${C.line}`, opacity: p.ativo ? 1 : 0.5 }}>
                <td className="px-3 py-2 font-semibold">{p.modelo}</td>
                <td className="px-3 py-2"><select value={p.grupo} onChange={(e) => salvar({ id: p.id, grupo: e.target.value })} className="rounded px-2 py-1 text-xs outline-none" style={inpS}>{cat.tabelas.grupos.map((g) => <option key={g.k} value={g.k}>{g.nome}</option>)}</select></td>
                <td className="px-3 py-2"><button onClick={() => setFppDe(p)} className="text-xs font-semibold" style={{ color: p.fppId ? C.blue : C.red }}>{p.fppNumero ? String(p.fppNumero).padStart(5, "0") : "ligar FPP"}</button></td>
                <td className="px-3 py-2 text-right">{p.custo != null ? brl(Math.round(p.custo * 100)) : "—"}</td>
                <td className="px-3 py-2 text-right">{p.estoqueTotal}</td>
                <td className="px-3 py-2 text-right"><button onClick={() => salvar({ id: p.id, ativo: !p.ativo })} className="text-xs px-2 py-0.5 rounded" style={{ border: `1px solid ${C.line}`, color: C.sub }}>{p.ativo ? "Desativar" : "Ativar"}</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {fppDe && <FppBusca api={api} prod={fppDe} onClose={() => setFppDe(null)} onPick={async (f) => { if (await salvar({ id: fppDe.id, fppId: f ? f.id : null })) setFppDe(null); }} />}
      {novo && <Janela titulo="Modelo à mão" onClose={() => setNovo(null)} largura={480} rodape={<><Btn contorno onClick={() => setNovo(null)}>Cancelar</Btn><Btn onClick={async () => { if (await salvar(novo)) setNovo(null); }}>Salvar</Btn></>}>
        <input value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })} placeholder="Produto + cor, sem o tamanho (ex.: CAMISETA PV GOLA VIES PRETO)" className={`${inp} mb-2`} style={inpS} />
        <select value={novo.grupo} onChange={(e) => setNovo({ ...novo, grupo: e.target.value })} className={inp} style={inpS}>{cat.tabelas.grupos.map((g) => <option key={g.k} value={g.k}>{g.nome}</option>)}</select>
      </Janela>}
      {tabEd && <TabelaPrecos api={api} tab={cat.tabelas} onClose={() => setTabEd(false)} onOk={() => { setTabEd(false); onMudou(); }} />}
    </div>
  );
}
function FppBusca({ api, prod, onClose, onPick }) {
  const [q, setQ] = useState(prod.modelo);
  const [l, setL] = useState(null);
  useEffect(() => { const t = setTimeout(() => api(`/api/loja?fpps=${encodeURIComponent(q)}`).then((j) => setL(j.fpps)).catch(() => setL([])), 300); return () => clearTimeout(t); }, [q]);
  return (
    <Janela titulo={`FPP de ${prod.modelo}`} onClose={onClose} rodape={<>{prod.fppId && <Btn contorno onClick={() => onPick(null)}>Desligar FPP</Btn>}<Btn contorno onClick={onClose}>Fechar</Btn></>}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome comercial, item ou nº da FPP" className={`${inp} mb-2`} style={inpS} autoFocus />
      {!l ? <Loader2 size={15} className="animate-spin" /> : !l.length ? <div className="text-sm" style={{ color: C.sub }}>Nenhuma FPP.</div> : l.map((f) => (
        <button key={f.id} onClick={() => onPick(f)} className="w-full text-left px-3 py-2 rounded-lg mb-1 text-sm" style={{ border: `1px solid ${f.id === prod.fppId ? C.accent : C.line}` }}>
          <b style={{ color: C.navy }}>{String(f.numero || "").padStart(5, "0")}</b> · {f.nomeComercial || f.item} <span className="text-xs" style={{ color: C.sub }}>· {f.clienteNome || "—"} · {f.negociacao || "—"} · custo {f.custoProducao != null ? brl(Math.round(f.custoProducao * 100)) : "—"}</span>
        </button>))}
    </Janela>
  );
}
const InP = ({ v, on }) => <input value={v} onChange={(e) => on(e.target.value)} inputMode="decimal" className="w-20 rounded px-2 py-1 text-xs text-right outline-none" style={inpS} />;
const FaixasP = ({ titulo, linhas, set, faixas = ["1-5", "6-10", "11-19", "20+"] }) => (
  <div className="mb-4"><div className="text-xs font-bold mb-1" style={{ color: C.navy }}>{titulo}</div>
    <table className="text-xs"><thead><tr style={{ color: C.sub }}><th className="text-left pr-3">Tamanho</th>{faixas.map((f) => <th key={f} className="px-1">{f}</th>)}</tr></thead>
      <tbody>{Object.entries(linhas).map(([k, v]) => <tr key={k}><td className="pr-3">{k}</td>{v.map((x, i) => <td key={i} className="px-1 py-0.5"><InP v={x} on={(nv) => set(k, i, nv)} /></td>)}</tr>)}</tbody></table></div>
);
function TabelaPrecos({ api, tab, onClose, onOk }) {
  const reais = (c) => (Number(c || 0) / 100).toFixed(2).replace(".", ",");
  const cent = (s) => Math.round((Number(String(s).replace(",", ".")) || 0) * 100);
  const [t, setT] = useState(() => ({ grupos: tab.grupos.map((g) => ({ k: g.k, nome: g.nome, base: reais(g.base) })), DTF: Object.fromEntries(Object.entries(tab.DTF).map(([k, v]) => [k, v.map(reais)])),
    BORDADO: Object.fromEntries(Object.entries(tab.BORDADO).map(([k, v]) => [k, v.map(reais)])), bolso: tab.bolso.map(reais), sublimacao: tab.sublimacao.map(reais),
    mangaLonga: reais(tab.mangaLonga), sublimacaoLonga: reais(tab.sublimacaoLonga), texturizada: reais(tab.texturizada), taxaBordado: reais(tab.taxaBordado) }));
  const salvar = async () => {
    try {
      await api("/api/loja", { method: "POST", body: JSON.stringify({ acao: "tabelas", tabelas: {
        grupos: t.grupos.map((g) => ({ k: g.k, base: cent(g.base) })), DTF: Object.fromEntries(Object.entries(t.DTF).map(([k, v]) => [k, v.map(cent)])), BORDADO: Object.fromEntries(Object.entries(t.BORDADO).map(([k, v]) => [k, v.map(cent)])),
        bolso: t.bolso.map(cent), sublimacao: t.sublimacao.map(cent), mangaLonga: cent(t.mangaLonga), sublimacaoLonga: cent(t.sublimacaoLonga), texturizada: cent(t.texturizada), taxaBordado: cent(t.taxaBordado) } }) });
      onOk();
    } catch (e) { alerta(e.message); }
  };
  return (
    <Janela titulo="Tabela de preços da loja (R$)" onClose={onClose} largura={760} rodape={<><Btn contorno onClick={onClose}>Cancelar</Btn><Btn onClick={salvar}>Salvar</Btn></>}>
      <div className="text-xs font-bold mb-1" style={{ color: C.navy }}>Preço base por produto</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-4">{t.grupos.map((g, i) => <div key={g.k} className="flex items-center gap-2 text-xs"><span className="flex-1">{g.nome}</span><InP v={g.base} on={(v) => setT({ ...t, grupos: t.grupos.map((x, j) => (j === i ? { ...x, base: v } : x)) })} /></div>)}</div>
      <FaixasP titulo="DTF (por estampa)" linhas={t.DTF} set={(k, i, v) => setT({ ...t, DTF: { ...t.DTF, [k]: t.DTF[k].map((x, j) => (j === i ? v : x)) } })} />
      <FaixasP titulo="Bordado (por estampa)" linhas={t.BORDADO} set={(k, i, v) => setT({ ...t, BORDADO: { ...t.BORDADO, [k]: t.BORDADO[k].map((x, j) => (j === i ? v : x)) } })} />
      <FaixasP titulo="Bordado no bolso (calça)" linhas={{ bolso: t.bolso }} set={(k, i, v) => setT({ ...t, bolso: t.bolso.map((x, j) => (j === i ? v : x)) })} />
      <FaixasP titulo="Sublimação total (adicional sobre a base, manga curta)" faixas={["1-5", "6-10", "11-20", "21+"]} linhas={{ curta: t.sublimacao }} set={(k, i, v) => setT({ ...t, sublimacao: t.sublimacao.map((x, j) => (j === i ? v : x)) })} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        {[["mangaLonga", "Manga longa"], ["sublimacaoLonga", "Sublimação manga longa"], ["texturizada", "Malha texturizada"], ["taxaBordado", "Taxa de bordado (pedido)"]].map(([k, n]) => <label key={k} className="flex flex-col gap-1">{n}<InP v={t[k]} on={(v) => setT({ ...t, [k]: v })} /></label>)}
      </div>
    </Janela>
  );
}
