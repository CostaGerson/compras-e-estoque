"use client";
// v647 — Dados › Itens padrão: itens de alto giro ou padronizados para acelerar o lançamento do pedido.
//   Nome interno (como chamamos) · nome NF (sai na NF ao faturar) · clientes · FPP de origem (crítica se o valor de venda da FPP
//   for diferente do preço praticado) · dados do item do pedido (tipo de peça, código, parâmetros, foto) · preço · NCM · GTIN/EAN ·
//   anexos de layout e tabela de medidas. Lista ordenável pelo título e visualização por cliente.
import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, Search, AlertTriangle, Paperclip, Trash2, FileText, Users, List, Upload } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", yellow: "#C08401", yellowSoft: "#FFF6DD", navy: "#001E41",
};
const inpS = { background: C.panel2, color: C.text, border: `1px solid ${C.line}` };
const brl = (v) => (v == null || v === "" ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const numFpp = (n) => (n != null ? String(n).padStart(5, "0") : "");
const readB64 = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result)); fr.readAsDataURL(file); });
const nomeCli = (c) => c.nomeFantasia || c.razaoSocial || "—";
const PARAM_FORA = ["TECIDO"];   // tecido vem da FPP
// v655 — tipo de peça pelo nome do item (mesma regra do lançamento)
const tipoPeca = (d, tipos) => {
  const n = norm(d);
  const t = /CAMISETA|T-SHIRT|REGATA|BABY ?LOOK/.test(n) ? "CAMISETA" : /\bPOLO\b/.test(n) ? "POLO" : /CAMISA/.test(n) ? "CAMISA"
    : /JAQUETA|MOLETOM|BLUSAO|CASACO|AGASALHO|COLETE|PARKA/.test(n) ? "JAQUETA" : /CALCA|BERMUDA|SHORT|MACACAO/.test(n) ? "CALÇA"
    : /JALECO/.test(n) ? "JALECO" : /AVENTAL/.test(n) ? "AVENTAL" : null;
  return t && tipos.includes(t) ? t : null;
};

function Critica({ c, curto }) {
  if (!c) return null;
  return (
    <span title={`Valor de venda na FPP ${brl(c.fpp)} · preço praticado ${brl(c.preco)}`} className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.redSoft, color: C.red }}>
      <AlertTriangle size={11} /> {curto ? `FPP ${brl(c.fpp)}` : `Preço difere da FPP (${brl(c.fpp)}${c.pct != null ? ` · ${c.pct > 0 ? "+" : ""}${String(c.pct).replace(".", ",")}%` : ""})`}
    </span>
  );
}

export default function ItensPadrao({ user, componentes = {} }) {
  const [l, setL] = useState(null);
  const [q, setQ] = useState("");
  const [cli, setCli] = useState("");
  const [modo, setModo] = useState("lista");   // lista | cliente
  const [sort, setSort] = useState({ k: "nomeInterno", dir: 1 });
  const [abrir, setAbrir] = useState(null);   // {} novo · {id}
  const [clientes, setClientes] = useState([]);
  const [pop, setPop] = useState(null);   // v657 — crítica do preço aberta
  const [verPadrao, setVerPadrao] = useState(false);   // v682
  useEffect(() => { if (!pop) return; const f = () => setPop(null); window.addEventListener("click", f); return () => window.removeEventListener("click", f); }, [pop]);
  // v669 — excluir direto da lista
  const excluir = async (i) => { if (!(await confirmar(`Excluir o item padrão ${i.nomeInterno}?`))) return; const r = await fetch(`/api/itens-padrao/${i.id}`, { method: "DELETE", headers: { "x-usuario-id": String(user?.id || "") } }); if (!r.ok) alerta("Não foi possível excluir."); carregar(); };
  const carregar = () => fetch("/api/itens-padrao").then((r) => r.json()).then((d) => setL(Array.isArray(d) ? d : [])).catch(() => setL([]));
  useEffect(() => { carregar(); fetch("/api/clientes").then((r) => r.json()).then((d) => setClientes(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const lista = useMemo(() => {
    if (!l) return [];
    const pal = norm(q).split(/\s+/).filter(Boolean);
    let x = l.filter((i) => (!cli || (i.clienteIds || []).map(Number).includes(Number(cli)))
      && (!pal.length || pal.every((w) => norm([i.codigoPadrao, i.nomeInterno, i.nomeNf, i.codigo, i.tipoPecaNome, i.ncm, i.gtin, i.fppNumero && numFpp(i.fppNumero), ...i.clientes.map((c) => c.nome)].join(" ")).includes(w))));
    const val = { codigoPadrao: (i) => i.codigoPadrao || "~", nomeInterno: (i) => i.nomeInterno, nomeNf: (i) => i.nomeNf, tipo: (i) => i.tipoPecaNome || "", codigo: (i) => i.codigo || "", clientes: (i) => i.clientes.map((c) => c.nome).join(", "),
      fpp: (i) => i.fppNumero ?? 1e9, preco: (i) => i.precoAtual ?? -1, critica: (i) => (i.critica ? 0 : 1), ncm: (i) => i.ncm || "", gtin: (i) => i.gtin || "", anexos: (i) => i.anexos.length };
    const f = val[sort.k] || val.nomeInterno;
    return [...x].sort((a, b) => { const p = f(a), r = f(b); return (typeof p === "number" ? p - r : String(p).localeCompare(String(r))) * sort.dir; });
  }, [l, q, cli, sort]);

  const Th = ({ k, children, cls = "" }) => (
    <th onClick={() => setSort((s) => ({ k, dir: s.k === k ? -s.dir : 1 }))} className={`text-left px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${cls}`}>
      {children}{sort.k === k ? (sort.dir > 0 ? " ▲" : " ▼") : ""}
    </th>
  );
  // v656 — linha fina: tudo em uma linha; o que não cabe é cortado (o texto inteiro aparece ao passar o mouse)
  const Cel = ({ children, w, cls = "", st = {}, t }) => <td className={`px-3 py-1.5 ${cls}`} style={{ maxWidth: w, ...st }}><div className="truncate" title={t ?? (typeof children === "string" ? children : undefined)}>{children}</div></td>;
  const linha = (i) => {
    const cl = i.clientes.map((c) => c.nome);
    return (
      <tr key={i.id} onClick={() => setAbrir({ id: i.id })} className="cursor-pointer hover:bg-gray-50 whitespace-nowrap" style={{ borderTop: `1px solid ${C.line}` }}>
        <Cel w={110} cls="font-bold tabular-nums text-xs" st={{ color: C.navy }}>{i.codigoPadrao || "—"}</Cel>
        <Cel w={220} cls="font-semibold" st={{ color: C.navy }}>{i.nomeInterno}</Cel>
        <Cel w={220} st={{ color: C.text }}>{i.nomeNf}</Cel>
        <Cel w={110} cls="text-xs" st={{ color: C.sub }}>{i.tipoPecaNome || "—"}</Cel>
        <Cel w={90} cls="text-xs" st={{ color: C.sub }}>{i.codigo || "—"}</Cel>
        <Cel w={240} cls="text-xs" st={{ color: C.sub }} t={cl.join(", ")}>{cl.length ? <>{cl[0]}{cl.length > 1 && <span className="ml-1 px-1 rounded text-[10px] font-semibold" style={{ background: C.panel2, color: C.text }}>+{cl.length - 1}</span>}</> : "—"}</Cel>
        <Cel w={90} cls="text-xs" st={{ color: C.sub }}>{i.fppNumero ? `FPP ${numFpp(i.fppNumero)}` : "—"}</Cel>
        <td className="px-3 py-1.5 relative" style={{ maxWidth: 120 }}>
          {i.critica ? <button onClick={(e) => { e.stopPropagation(); setPop(pop === i.id ? null : i.id); }} className="tabular-nums font-semibold inline-flex items-center gap-1" style={{ color: C.red }} title="Preço diferente da FPP — clique para ver">
            {brl(i.precoAtual)} <AlertTriangle size={12} /></button>
            : <span className="tabular-nums font-semibold" style={{ color: C.text }}>{brl(i.precoAtual)}</span>}
          {pop === i.id && i.critica && (
            <div onClick={(e) => e.stopPropagation()} className="absolute z-30 right-0 mt-1 rounded-lg shadow-xl p-3 text-xs whitespace-nowrap" style={{ background: C.panel, border: `1px solid ${C.line}`, top: "100%" }}>
              <div className="font-semibold mb-1" style={{ color: C.red }}>Preço diferente da FPP</div>
              <div className="flex justify-between gap-6"><span style={{ color: C.sub }}>Valor de venda FPP {numFpp(i.fppNumero)}</span><b>{brl(i.critica.fpp)}</b></div>
              <div className="flex justify-between gap-6"><span style={{ color: C.sub }}>Preço atual praticado</span><b style={{ color: C.red }}>{brl(i.critica.preco)}</b></div>
              <div className="flex justify-between gap-6"><span style={{ color: C.sub }}>Diferença</span><b>{brl(i.critica.dif)}{i.critica.pct != null ? ` (${i.critica.pct > 0 ? "+" : ""}${String(i.critica.pct).replace(".", ",")}%)` : ""}</b></div>
            </div>
          )}
        </td>
        <Cel w={90} cls="text-xs tabular-nums" st={{ color: C.sub }}>{i.ncm || "—"}</Cel>
        <Cel w={110} cls="text-xs tabular-nums" st={{ color: C.sub }}>{i.gtin || "—"}</Cel>
        <Cel w={60} cls="text-xs" st={{ color: C.sub }}>{i.anexos.length ? <span className="inline-flex items-center gap-1"><Paperclip size={12} />{i.anexos.length}</span> : "—"}</Cel>
        <td className="px-2 py-1.5 text-right"><button onClick={(e) => { e.stopPropagation(); excluir(i); }} title="Excluir item padrão" style={{ color: C.sub }}><Trash2 size={14} /></button></td>
      </tr>
    );
  };
  const cabecalho = (
    <thead style={{ background: C.panel2, color: C.sub }} className="text-xs">
      <tr><Th k="codigoPadrao">Código</Th><Th k="nomeInterno">Nome interno</Th><Th k="nomeNf">Nome NF</Th><Th k="tipo">Tipo de peça</Th><Th k="codigo">Código</Th><Th k="clientes">Clientes</Th>
        <Th k="fpp">FPP</Th><Th k="preco">Preço atual</Th><Th k="ncm">NCM</Th><Th k="gtin">GTIN/EAN</Th><Th k="anexos">Anexos</Th><th /></tr>
    </thead>
  );
  // por cliente: o item aparece em cada cliente dele; sem cliente no fim
  const porCliente = useMemo(() => {
    const g = new Map();
    for (const i of lista) {
      const cs = i.clientes.length ? i.clientes : [{ id: 0, nome: "Sem cliente" }];
      for (const c of cs) { if (cli && c.id !== Number(cli)) continue; const e = g.get(c.id) || { c, itens: [] }; e.itens.push(i); g.set(c.id, e); }
    }
    return [...g.values()].sort((a, b) => (a.c.id === 0) - (b.c.id === 0) || a.c.nome.localeCompare(b.c.nome));
  }, [lista, cli]);
  const nCrit = (l || []).filter((i) => i.critica).length;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex items-center gap-2 px-2 rounded flex-1 min-w-64" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome interno, nome NF, código, cliente, NCM…" className="py-1.5 text-sm outline-none flex-1" />
          {q && <button onClick={() => setQ("")} style={{ color: C.sub }}><X size={13} /></button>}
        </div>
        <select value={cli} onChange={(e) => setCli(e.target.value)} className="px-2 py-1.5 rounded outline-none text-sm" style={{ ...inpS, maxWidth: 260 }}>
          <option value="">Todos os clientes</option>
          {clientes.filter((c) => (l || []).some((i) => (i.clienteIds || []).map(Number).includes(c.id))).map((c) => <option key={c.id} value={c.id}>{nomeCli(c)}</option>)}
        </select>
        <div className="flex rounded overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["lista", "Lista", List], ["cliente", "Por cliente", Users]].map(([k, t, I]) => (
            <button key={k} onClick={() => setModo(k)} className="px-3 py-1.5 text-sm flex items-center gap-1" style={{ background: modo === k ? C.accentSoft : C.panel, color: modo === k ? C.accent : C.sub }}><I size={14} /> {t}</button>
          ))}
        </div>
        <button onClick={() => setVerPadrao(true)} className="px-3 py-1.5 rounded text-sm" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.text }} title="Siglas por tipo e variações dos códigos">Padrão de códigos</button>
        <button onClick={() => setAbrir({})} className="px-4 py-1.5 rounded font-semibold flex items-center gap-1 text-sm" style={{ background: C.accent, color: "#fff" }}><Plus size={15} /> Novo item padrão</button>
      </div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>
        {lista.length} de {(l || []).length} item(ns) · clique na linha para editar, no título para ordenar
        {nCrit > 0 && <span style={{ color: C.red }}> · {nCrit} com preço diferente da FPP</span>}
      </div>
      {!l ? <div className="text-sm" style={{ color: C.sub }}>Carregando…</div> : modo === "lista" ? (
        <div className="rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm">{cabecalho}<tbody>{lista.map(linha)}
            {!lista.length && <tr><td colSpan={12} className="px-3 py-6 text-center text-sm" style={{ color: C.sub }}>Nenhum item padrão{q || cli ? " neste filtro" : ". Clique em “Novo item padrão”."}</td></tr>}</tbody></table>
        </div>
      ) : (
        <div className="space-y-4">
          {porCliente.map(({ c, itens }) => (
            <div key={c.id} className="rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="px-3 py-2 text-sm font-bold flex items-center gap-2" style={{ color: C.navy, borderBottom: `1px solid ${C.line}` }}><Users size={14} style={{ color: C.accent }} /> {c.nome}<span className="text-xs font-normal" style={{ color: C.sub }}>{itens.length} item(ns)</span></div>
              <table className="w-full text-sm">{cabecalho}<tbody>{itens.map(linha)}</tbody></table>
            </div>
          ))}
          {!porCliente.length && <div className="text-sm" style={{ color: C.sub }}>Nenhum item.</div>}
        </div>
      )}
      {verPadrao && <PadraoCodigosModal onClose={() => setVerPadrao(false)} tiposPeca={Object.keys(componentes)} />}
      {abrir && <ItemPadraoModal id={abrir.id} user={user} componentes={componentes} clientes={clientes} onClose={() => setAbrir(null)} onSaved={() => { setAbrir(null); carregar(); }} />}
    </div>
  );
}

const vazio = () => ({ nomeInterno: "", nomeNf: "", clienteIds: [], fppId: null, fpp: null, tipoPecaNome: "", codigo: "", parametros: {}, fotoBase64: "", precoAtual: "", ncm: "", gtin: "", obs: "", anexos: [] });

function ItemPadraoModal({ id, user, componentes, clientes, onClose, onSaved }) {
  const [f, setF] = useState(id ? null : vazio());
  const [salv, setSalv] = useState(false);
  const [pend, setPend] = useState([]);   // anexos escolhidos antes de salvar o item novo
  const [buscaCli, setBuscaCli] = useState("");
  const [buscaFpp, setBuscaFpp] = useState("");
  const [fpps, setFpps] = useState([]);
  const [grupos, setGrupos] = useState([]);   // v658 — grupos de clientes: escolher o grupo põe todos os clientes dele
  useEffect(() => { fetch("/api/clientes/grupos").then((r) => r.json()).then((g) => setGrupos(Array.isArray(g) ? g : [])).catch(() => {}); }, []);
  const H = { "Content-Type": "application/json", "x-usuario-id": String(user?.id || "") };
  const TIPOS = Object.keys(componentes);
  const ler = () => fetch(`/api/itens-padrao/${id}`).then((r) => r.json()).then((d) => setF({ ...vazio(), ...d, precoAtual: d.precoAtual != null ? String(d.precoAtual).replace(".", ",") : "", parametros: d.parametros || {}, clienteIds: (d.clienteIds || []).map(Number) }));
  useEffect(() => { if (id) ler(); }, [id]);
  useEffect(() => {
    if (buscaFpp.trim().length < 2) { setFpps([]); return; }
    const t = setTimeout(() => fetch(`/api/pp/catalogo?fpp=${encodeURIComponent(buscaFpp)}`, { headers: H }).then((r) => r.json()).then((d) => setFpps(Array.isArray(d) ? d : [])).catch(() => setFpps([])), 250);
    return () => clearTimeout(t);
  }, [buscaFpp]);
  const [km, setKm] = useState([]);   // v668 — sugestões do cadastro do KM
  const [padrao, setPadrao] = useState(null);   // v682 — padrão de códigos (siglas e variações)
  useEffect(() => { fetch("/api/itens-padrao/codigos", { cache: "no-store" }).then((r) => r.json()).then(setPadrao).catch(() => {}); }, []);
  const tKm = React.useRef(null);
  useEffect(() => { if (f && !f.id) { const sg = padrao?.tipos?.[f.tipoPecaNome]?.sigla; sugerirPadrao(f, !!(sg && f.codigoPadrao && !String(f.codigoPadrao).startsWith(sg + "."))); } }, [f?.tipoPecaNome, f?.codigo, padrao]);
  if (!f) return <Moldura onClose={onClose}><div className="text-sm" style={{ color: C.sub }}>Carregando…</div></Moldura>;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setParam = (k, v) => setF((x) => ({ ...x, parametros: { ...x.parametros, [k]: v } }));
  const precoN = (() => { const s = String(f.precoAtual || "").trim(); if (!s) return null; const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s); return Number.isFinite(n) ? n : null; })();
  const fppValor = f.fpp?.valorProposto ?? null;
  const critica = precoN != null && fppValor != null && Math.abs(Math.round(precoN * 100) - Math.round(fppValor * 100)) >= 1 ? { fpp: fppValor, preco: precoN, pct: fppValor ? Math.round(((precoN - fppValor) / fppValor) * 1000) / 10 : null } : null;
  const comps = (componentes[f.tipoPecaNome] || []).filter((c) => !PARAM_FORA.includes(c));
  const extras = Object.keys(f.parametros || {}).filter((k) => !comps.includes(k) && !PARAM_FORA.includes(k));
  const cliSel = clientes.filter((c) => f.clienteIds.includes(c.id));
  const grpOpc = buscaCli.trim().length >= 2 ? grupos.filter((g) => norm([g.nome, g.cnpj, ...g.clientes.map((c) => `${c.razaoSocial} ${c.nomeFantasia || ""}`)].join(" ")).includes(norm(buscaCli)) && g.clientes.some((c) => !f.clienteIds.includes(c.id))).slice(0, 5) : [];
  const addIds = (ids) => set("clienteIds", [...new Set([...f.clienteIds, ...ids])]);
  // grupos com todos os clientes já no item aparecem como etiqueta
  const gruposNoItem = grupos.filter((g) => g.clientes.length && g.clientes.every((c) => f.clienteIds.includes(c.id)));
  const cliOpc = buscaCli.trim().length >= 2 ? clientes.filter((c) => !f.clienteIds.includes(c.id) && norm([c.razaoSocial, c.nomeFantasia, c.cnpj].join(" ")).includes(norm(buscaCli))).slice(0, 8) : [];

  // v668 — código do KM: busca no cadastro de itens do KM e puxa as informações técnicas (código exato → automático)
  // v682 — código no nosso padrão (SIGLA.VAR.SEQ): sugerido pelo tipo de peça e pelo código do KM; dá para alterar
  async function sugerirPadrao(x, forcar) {
    if (!x?.tipoPecaNome || (x.codigoPadrao && !forcar)) return;
    const r = await fetch(`/api/itens-padrao/codigos?sugerir=1&tipo=${encodeURIComponent(x.tipoPecaNome)}&km=${encodeURIComponent(x.codigo || "")}&nome=${encodeURIComponent(x.nomeInterno || x.nomeNf || "")}`, { cache: "no-store" }).then((y) => y.json()).catch(() => null);
    if (r?.codigo) setF((y) => ({ ...y, codigoPadrao: r.codigo }));
  }
  const tipoPad = padrao?.tipos?.[f?.tipoPecaNome] || null;
  const varAtual = f?.codigoPadrao ? Number(String(f.codigoPadrao).split(".")[1]) || null : null;
  const trocarVariacao = async (n) => {
    if (!tipoPad) return;
    const r = await fetch(`/api/itens-padrao/codigos?proximo=1&sigla=${tipoPad.sigla}&variacao=${n}`, { cache: "no-store" }).then((y) => y.json()).catch(() => null);
    if (r?.codigo) setF((y) => ({ ...y, codigoPadrao: r.codigo }));
  };
  const usarKm = (p) => { setKm([]); setF((x) => {
    const params = Object.fromEntries((p.parametros || []).filter((y) => y && y.t && y.v).map((y) => [String(y.t).toUpperCase(), y.v]));
    const nome = String(p.descricao || "").toUpperCase();
    return { ...x, codigo: p.codigo, nomeNf: x.nomeNf || nome, nomeInterno: x.nomeInterno || nome,
      tipoPecaNome: x.tipoPecaNome || tipoPeca(p.descricao, TIPOS) || "",
      precoAtual: x.precoAtual || (p.preco != null ? String(Number(p.preco).toFixed(2)).replace(".", ",") : ""),
      ncm: x.ncm || p.ncm || "", gtin: x.gtin || p.gtin || "",   // v670
      parametros: { ...params, ...Object.fromEntries(Object.entries(x.parametros || {}).filter(([k, v]) => v && (k === "TECIDO" || !params[k]))) } };
  }); };
  const digitarCodigo = (v) => {
    set("codigo", v);
    clearTimeout(tKm.current);
    if (String(v).trim().length < 2) { setKm([]); return; }
    tKm.current = setTimeout(async () => {
      const r = await fetch(`/api/pp/catalogo?q=${encodeURIComponent(v)}`, { headers: H }).then((x) => x.json()).catch(() => []);
      const l = Array.isArray(r) ? r : [];
      const ex = l.find((o) => String(o.codigo || "").trim().toUpperCase() === String(v).trim().toUpperCase());
      if (ex) usarKm(ex); else setKm(l.slice(0, 10));
    }, 300);
  };
  // v655 — ao trazer a FPP, o que ela já tem entra sozinho (só preenche o que estiver vazio)
  const usarFpp = (p) => setF((x) => {
    const nome = String(p.nomeComercial || p.item || "").toUpperCase();
    const cli = p.cliente ? clientes.find((c) => norm(c.razaoSocial) === norm(p.cliente) || norm(c.nomeFantasia) === norm(p.cliente)) : null;
    return { ...x, fpp: p, fppId: p.id,
      nomeInterno: x.nomeInterno || nome, nomeNf: x.nomeNf || nome,
      tipoPecaNome: x.tipoPecaNome || tipoPeca(`${p.item || ""} ${p.nomeComercial || ""}`, TIPOS) || "",
      precoAtual: x.precoAtual || (p.valorProposto != null ? String(Number(p.valorProposto).toFixed(2)).replace(".", ",") : ""),
      clienteIds: cli ? [...new Set([...x.clienteIds, cli.id, ...(grupos.find((g) => g.clientes.some((c) => c.id === cli.id))?.clientes || []).map((c) => c.id)])] : x.clienteIds,
      parametros: { ...x.parametros, TECIDO: { tipo: p.tecidoTipo, artigo: [p.artigo, p.artigoCor].filter(Boolean).join(" · "), medida: p.medida, forro: p.forro || null, fpp: p.numero } } };
  });
  const anexar = async (tipo, files) => {
    const arr = Array.from(files || []);
    if (!f.id) { const add = await Promise.all(arr.map(async (x) => ({ tipo, nome: x.name, mime: x.type, base64: await readB64(x) }))); setPend((p) => [...p, ...add]); return; }
    for (const x of arr) await fetch(`/api/itens-padrao/${f.id}`, { method: "PUT", headers: H, body: JSON.stringify({ acao: "anexar", tipo, nome: x.name, mime: x.type, base64: await readB64(x) }) });
    ler();
  };
  const tirarAnexo = async (a) => { if (!(await confirmar(`Tirar o anexo ${a.nome}?`))) return; await fetch(`/api/itens-padrao/${f.id}`, { method: "PUT", headers: H, body: JSON.stringify({ acao: "tirarAnexo", anexoId: a.id }) }); ler(); };
  const salvar = async () => {
    setSalv(true);
    try {
      const corpo = { ...f, fppId: f.fpp?.id || f.fppId || null };
      const r = await fetch(f.id ? `/api/itens-padrao/${f.id}` : "/api/itens-padrao", { method: f.id ? "PUT" : "POST", headers: H, body: JSON.stringify(corpo) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Erro ao salvar.");
      const novoId = f.id || j.id;
      for (const a of pend) await fetch(`/api/itens-padrao/${novoId}`, { method: "PUT", headers: H, body: JSON.stringify({ acao: "anexar", ...a }) });
      onSaved();
    } catch (e) { alerta(e.message); }
    setSalv(false);
  };
  const excluir = async () => { if (!(await confirmar(`Excluir o item padrão ${f.nomeInterno}?`))) return; await fetch(`/api/itens-padrao/${f.id}`, { method: "DELETE", headers: H }); onSaved(); };

  const Anexos = ({ tipo, titulo }) => {
    const lst = [...(f.anexos || []).filter((a) => a.tipo === tipo), ...pend.filter((a) => a.tipo === tipo).map((a, k) => ({ ...a, pendente: k }))];
    return (
      <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); anexar(tipo, e.dataTransfer.files); }} className="rounded-lg p-3" style={{ border: `1.5px dashed ${C.line}`, background: C.panel }}>
        <div className="flex items-center gap-2 mb-2"><Paperclip size={14} style={{ color: C.accent }} /><span className="text-sm font-semibold flex-1" style={{ color: C.navy }}>{titulo}</span>
          <label className="text-xs px-2 py-1 rounded cursor-pointer flex items-center gap-1" style={{ border: `1px solid ${C.accent}`, color: C.accent }}><Upload size={12} /> Anexar<input type="file" multiple className="hidden" onChange={(e) => anexar(tipo, e.target.files)} /></label></div>
        {lst.length ? <div className="flex flex-wrap gap-2">{lst.map((a, k) => (
          <span key={a.id || `p${k}`} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ background: C.panel2, border: `1px solid ${C.line}` }}>
            {a.id ? <button onClick={() => window.open(`/api/itens-padrao/${f.id}?anexo=${a.id}`, "_blank")} className="truncate max-w-[200px]" style={{ color: C.text }}>{a.nome}</button> : <span className="truncate max-w-[200px]" style={{ color: C.sub }}>{a.nome} (ao salvar)</span>}
            <button onClick={() => (a.id ? tirarAnexo(a) : setPend((p) => p.filter((_, j) => j !== a.pendente)))} style={{ color: C.sub }}><X size={11} /></button>
          </span>))}</div>
          : <div className="text-xs" style={{ color: C.sub }}>Arraste o arquivo aqui ou clique em Anexar.</div>}
      </div>
    );
  };

  return (
    <Moldura onClose={onClose} titulo={f.id ? `Item padrão · ${f.nomeInterno}` : "Novo item padrão"}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Campo l="Nome interno (como chamamos)"><input value={f.nomeInterno} onChange={(e) => set("nomeInterno", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none text-sm uppercase" style={inpS} /></Campo>
        <Campo l="Nome NF (sai na NF ao faturar)"><input value={f.nomeNf} onChange={(e) => set("nomeNf", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none text-sm uppercase" style={inpS} /></Campo>
      </div>

      {/* clientes */}
      <Campo l="Clientes deste item">
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {cliSel.map((c) => <span key={c.id} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{nomeCli(c)}<button onClick={() => set("clienteIds", f.clienteIds.filter((x) => x !== c.id))}><X size={11} /></button></span>)}
          {!cliSel.length && <span className="text-xs" style={{ color: C.sub }}>nenhum cliente</span>}
          {gruposNoItem.map((g) => <span key={`g${g.id}`} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: C.navy, color: "#fff" }} title={g.clientes.map((c) => c.razaoSocial).join(", ")}>
            <Users size={11} /> GRUPO {g.nome} · {g.clientes.length}<button onClick={() => set("clienteIds", f.clienteIds.filter((id) => !g.clientes.some((c) => c.id === id)))}><X size={11} /></button></span>)}
        </div>
        <div className="relative">
          <input value={buscaCli} onChange={(e) => setBuscaCli(e.target.value)} placeholder="adicionar cliente: nome ou CNPJ…" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inpS} />
          {(cliOpc.length > 0 || grpOpc.length > 0) && <div className="absolute z-20 left-0 right-0 mt-1 rounded shadow-lg max-h-64 overflow-y-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            {grpOpc.map((g) => <button key={`g${g.id}`} onClick={() => { addIds(g.clientes.map((c) => c.id)); setBuscaCli(""); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}`, background: "#F2F5FA" }}>
              <Users size={13} style={{ color: C.navy }} /><b>GRUPO {g.nome}</b><span style={{ color: C.sub }}>· {g.clientes.length} cliente(s): {g.clientes.map((c) => c.nomeFantasia || c.razaoSocial).join(", ")}</span></button>)}
            {cliOpc.map((c) => <button key={c.id} onClick={() => { set("clienteIds", [...f.clienteIds, c.id]); setBuscaCli(""); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}` }}>{c.razaoSocial || c.nomeFantasia}<span style={{ color: C.sub }}> · {c.cnpj || ""}</span></button>)}
          </div>}
        </div>
      </Campo>

      {/* FPP de origem */}
      <div className="rounded-lg px-3 py-2 my-3 text-sm" style={{ background: f.fpp ? C.greenSoft : C.panel2, border: `1px solid ${f.fpp ? C.green + "55" : C.line}` }}>
        {f.fpp ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold" style={{ color: C.green }}>FPP {numFpp(f.fpp.numero)}</span>
            <span style={{ color: C.text }}>{f.fpp.nomeComercial || f.fpp.item}{f.fpp.cliente ? ` · ${f.fpp.cliente}` : ""}</span>
            <span style={{ color: C.sub }}>· valor de venda {brl(f.fpp.valorProposto)}</span>
            {(f.fpp.artigo || f.parametros?.TECIDO?.artigo) && <span className="w-full text-xs" style={{ color: C.sub }}>Tecido: {[f.fpp.tecidoTipo || f.parametros?.TECIDO?.tipo, f.fpp.artigo ? [f.fpp.artigo, f.fpp.artigoCor].filter(Boolean).join(" · ") : f.parametros?.TECIDO?.artigo, f.fpp.medida || f.parametros?.TECIDO?.medida, (f.fpp.forro || f.parametros?.TECIDO?.forro) ? `forro ${f.fpp.forro || f.parametros.TECIDO.forro}` : ""].filter(Boolean).join(" · ")}</span>}
            <button onClick={() => setF((x) => ({ ...x, fpp: null, fppId: null }))} className="ml-auto text-xs underline" style={{ color: C.sub }}>tirar</button>
          </div>
        ) : (
          <div className="relative">
            <div className="text-xs mb-1" style={{ color: C.sub }}>FPP de origem</div>
            <input value={buscaFpp} onChange={(e) => setBuscaFpp(e.target.value)} placeholder="nº da FPP, item ou cliente…" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={{ ...inpS, background: C.panel }} />
            {fpps.length > 0 && <div className="absolute z-20 left-0 right-0 mt-1 rounded shadow-lg max-h-56 overflow-y-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              {fpps.map((p) => <button key={p.id} onClick={() => { usarFpp(p); setBuscaFpp(""); setFpps([]); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}` }}>
                <b>FPP {numFpp(p.numero)}</b> · {p.nomeComercial || p.item}<span style={{ color: C.sub }}>{p.cliente ? ` · ${p.cliente}` : ""} · {brl(p.valorProposto)}</span></button>)}
            </div>}
          </div>
        )}
      </div>

      {/* v682 — código no nosso padrão: SIGLA (tipo) . VARIAÇÃO . SEQUÊNCIA */}
      <div className="rounded-lg px-3 py-2 mb-3 flex flex-wrap items-end gap-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <Campo l="Código padrão (SIGLA.VARIAÇÃO.SEQUÊNCIA)"><input value={f.codigoPadrao || ""} onChange={(e) => set("codigoPadrao", e.target.value.toUpperCase())} placeholder={tipoPad ? `${tipoPad.sigla}.001.0001` : "escolha o tipo de peça"} className="px-2 py-1.5 rounded outline-none text-sm font-bold tabular-nums" style={{ ...inpS, width: 170, color: C.navy }} /></Campo>
        <Campo l="Variação"><select value={varAtual || ""} onChange={(e) => trocarVariacao(Number(e.target.value))} disabled={!tipoPad} className="px-2 py-1.5 rounded outline-none text-sm" style={{ ...inpS, minWidth: 220 }}>
          <option value="">{tipoPad ? "—" : "tipo de peça sem sigla"}</option>
          {(tipoPad?.variacoes || []).map((v) => <option key={v.n} value={v.n}>{String(v.n).padStart(3, "0")} · {v.nome}</option>)}
          {varAtual && !(tipoPad?.variacoes || []).some((v) => v.n === varAtual) && <option value={varAtual}>{String(varAtual).padStart(3, "0")} · (sem nome no padrão)</option>}
        </select></Campo>
        <button type="button" onClick={() => sugerirPadrao(f, true)} disabled={!f.tipoPecaNome} className="px-3 py-1.5 rounded text-xs font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>sugerir</button>
        <span className="text-[11px] pb-2" style={{ color: C.sub }}>sugerido pelo tipo de peça e pelo código do KM · a sequência é a próxima livre · dá para alterar</span>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-3">
        <Campo l="Tipo de peça"><select value={f.tipoPecaNome || ""} onChange={(e) => set("tipoPecaNome", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inpS}>
          <option value="">—</option>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}{f.tipoPecaNome && !TIPOS.includes(f.tipoPecaNome) && <option value={f.tipoPecaNome}>{f.tipoPecaNome}</option>}</select></Campo>
        <Campo l="Código (cadastro do KM)"><div className="relative">
          <input value={f.codigo || ""} onChange={(e) => digitarCodigo(e.target.value)} onBlur={() => setTimeout(() => setKm([]), 150)} placeholder="digite o código ou o nome…" className="w-full px-2 py-1.5 rounded outline-none text-sm uppercase" style={inpS} />
          {km.length > 0 && <div className="absolute z-30 left-0 mt-1 rounded shadow-lg max-h-64 overflow-y-auto" style={{ background: C.panel, border: `1px solid ${C.line}`, width: 420 }}>
            {km.map((p) => <button key={p.codigo} onMouseDown={(e) => { e.preventDefault(); usarKm(p); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50" style={{ borderBottom: `1px solid ${C.line}` }}>
              <b>{p.codigo}</b> <span style={{ color: C.sub }}>· {p.descricao}{p.parametros?.length ? ` · ${p.parametros.length} parâmetros` : ""}</span></button>)}
          </div>}
        </div></Campo>
        <Campo l="NCM"><input value={f.ncm || ""} onChange={(e) => set("ncm", e.target.value)} placeholder="8 dígitos" className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inpS} /></Campo>
        <Campo l="GTIN/EAN (opcional)"><input value={f.gtin || ""} onChange={(e) => set("gtin", e.target.value)} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inpS} /></Campo>
      </div>

      <div className="flex gap-4 mb-3">
        <div className="shrink-0">
          <div className="text-xs mb-1" style={{ color: C.sub }}>Foto</div>
          <label className="block rounded-lg overflow-hidden cursor-pointer flex items-center justify-center" style={{ width: 130, height: 130, background: C.panel2, border: `1px solid ${C.line}` }}>
            {f.fotoBase64 ? <img src={f.fotoBase64} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <span className="text-xs" style={{ color: C.sub }}>clique para pôr a foto</span>}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const x = e.target.files?.[0]; if (x) set("fotoBase64", await readB64(x)); }} />
          </label>
          {f.fotoBase64 && <button onClick={() => set("fotoBase64", "")} className="text-xs mt-1" style={{ color: C.red }}>remover foto</button>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs mb-1" style={{ color: C.sub }}>Parâmetros de produção{f.tipoPecaNome ? ` · ${f.tipoPecaNome}` : " (escolha o tipo de peça)"} · o tecido vem da FPP</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {[...comps, ...extras].map((c) => (
              <label key={c} className="flex items-center gap-2 text-xs"><span className="w-28 shrink-0 font-semibold truncate" style={{ color: C.sub }} title={c}>{c}</span>
                <input value={typeof f.parametros?.[c] === "object" ? "" : f.parametros?.[c] || ""} onChange={(e) => setParam(c, e.target.value)} className="flex-1 px-2 py-1 rounded outline-none text-sm" style={inpS} /></label>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-1 items-end">
        <Campo l="Preço atual praticado (R$)"><input value={f.precoAtual} onChange={(e) => set("precoAtual", e.target.value)} placeholder="0,00" className="w-full px-2 py-1.5 rounded outline-none text-sm font-semibold" style={inpS} /></Campo>
        <div className="col-span-3 pb-1.5">{critica ? <Critica c={critica} /> : f.fpp && precoN != null ? <span className="text-xs" style={{ color: C.green }}>Preço igual ao valor de venda da FPP.</span> : null}</div>
      </div>
      <Campo l="Observação"><textarea value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} rows={2} className="w-full px-2 py-1.5 rounded outline-none text-sm" style={inpS} /></Campo>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <Anexos tipo="LAYOUT" titulo="Layout" />
        <Anexos tipo="MEDIDAS" titulo="Tabela de medidas" />
      </div>

      <div className="flex items-center gap-2 mt-4">
        {f.id && <button onClick={excluir} className="text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
        {f.atualizadoPorNome && <span className="text-[11px]" style={{ color: C.sub }}>atualizado por {f.atualizadoPorNome}</span>}
        <span className="flex-1" />
        <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salv} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: salv ? 0.6 : 1 }}>{salv ? "Salvando…" : "Salvar"}</button>
      </div>
    </Moldura>
  );
}

function Campo({ l, children }) { return <label className="block text-xs" style={{ color: C.sub }}><span className="block mb-1">{l}</span>{children}</label>; }
function Moldura({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onMouseDown={onClose}>
      <div className="rounded-xl w-full max-w-4xl p-5 overflow-y-auto" style={{ background: C.bg, maxHeight: "92vh" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><div className="text-lg font-bold flex items-center gap-2" style={{ color: C.navy }}><FileText size={18} style={{ color: C.accent }} /> {titulo || "Item padrão"}</div><button onClick={onClose} style={{ color: C.sub }}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

// v682 — padrão de códigos: sigla por tipo de peça e variações (001, 002…) de cada tipo
function PadraoCodigosModal({ onClose, tiposPeca }) {
  const [t, setT] = useState(null);
  const [sel, setSel] = useState("");
  const [novoTipo, setNovoTipo] = useState("");
  const [salv, setSalv] = useState(false);
  useEffect(() => { fetch("/api/itens-padrao/codigos", { cache: "no-store" }).then((r) => r.json()).then((d) => { const x = { ...(d.tipos || {}) }; for (const tp of tiposPeca) if (!x[tp]) x[tp] = { sigla: "", variacoes: [] }; setT(x); setSel(Object.keys(x)[0] || ""); }).catch(() => setT({})); }, []);
  const up = (tp, patch) => setT((x) => ({ ...x, [tp]: { ...x[tp], ...patch } }));
  const salvar = async () => {
    setSalv(true);
    const r = await fetch("/api/itens-padrao/codigos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipos: t }) });
    const j = await r.json().catch(() => ({})); setSalv(false);
    if (!r.ok) return alerta(j.error || "Erro ao salvar.");
    onClose();
  };
  const v = t?.[sel];
  return (
    <Moldura onClose={onClose} titulo="Padrão de códigos dos produtos">
      <div className="text-xs mb-3" style={{ color: C.sub }}>Código = <b>SIGLA</b> do tipo · <b>VARIAÇÃO</b> do produto (3 dígitos) · <b>SEQUÊNCIA</b> automática (4 dígitos). Ex.: CL.001.0001 = calça de elástico com 2 bolsos frontais e 2 traseiros; CL.001.0002 = …</div>
      {!t ? <div className="text-sm" style={{ color: C.sub }}>Carregando…</div> : (
        <div className="flex gap-4">
          <div className="w-56 shrink-0 rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
            {Object.keys(t).sort().map((tp) => <button key={tp} onClick={() => setSel(tp)} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}`, background: sel === tp ? C.accentSoft : C.panel }}>
              <span className="flex-1 truncate">{tp}</span><b className="tabular-nums" style={{ color: t[tp].sigla ? C.navy : C.red }}>{t[tp].sigla || "?"}</b></button>)}
            <div className="flex gap-1 p-2"><input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value.toUpperCase())} placeholder="novo tipo" className="flex-1 min-w-0 px-2 py-1 rounded text-xs outline-none" style={inpS} />
              <button onClick={() => { const n = novoTipo.trim(); if (n && !t[n]) { setT((x) => ({ ...x, [n]: { sigla: "", variacoes: [] } })); setSel(n); } setNovoTipo(""); }} style={{ color: C.accent }}><Plus size={16} /></button></div>
          </div>
          {v && <div className="flex-1 min-w-0">
            <div className="flex items-end gap-3 mb-3">
              <Campo l={`Sigla de ${sel}`}><input value={v.sigla || ""} onChange={(e) => up(sel, { sigla: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4) })} className="px-2 py-1.5 rounded outline-none text-sm font-bold" style={{ ...inpS, width: 90 }} /></Campo>
              <span className="text-xs pb-2" style={{ color: C.sub }}>2 a 4 letras · não pode repetir entre tipos</span>
            </div>
            <div className="text-xs font-semibold mb-1" style={{ color: C.sub }}>Variações</div>
            {(v.variacoes || []).map((x, k) => <div key={k} className="flex items-center gap-2 mb-1.5">
              <input value={String(x.n).padStart(3, "0")} onChange={(e) => up(sel, { variacoes: v.variacoes.map((y, j) => (j === k ? { ...y, n: Number(e.target.value.replace(/\D/g, "")) || 0 } : y)) })} className="px-2 py-1 rounded outline-none text-sm font-bold tabular-nums text-center" style={{ ...inpS, width: 64 }} />
              <input value={x.nome} onChange={(e) => up(sel, { variacoes: v.variacoes.map((y, j) => (j === k ? { ...y, nome: e.target.value.toUpperCase() } : y)) })} placeholder={`ex.: ${sel} SOCIAL`} className="flex-1 px-2 py-1 rounded outline-none text-sm" style={inpS} />
              <span className="text-[11px] tabular-nums" style={{ color: C.sub, width: 92 }}>{v.sigla ? `${v.sigla}.${String(x.n).padStart(3, "0")}.0001` : ""}</span>
              <button onClick={() => up(sel, { variacoes: v.variacoes.filter((_, j) => j !== k) })} style={{ color: C.sub }}><X size={13} /></button>
            </div>)}
            <button onClick={() => up(sel, { variacoes: [...(v.variacoes || []), { n: (v.variacoes || []).reduce((m, y) => Math.max(m, y.n), 0) + 1, nome: "" }] })} className="text-xs font-semibold" style={{ color: C.accent }}>+ variação</button>
          </div>}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 py-1.5 rounded text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={salvar} disabled={salv || !t} className="px-4 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: salv ? 0.6 : 1 }}>{salv ? "Salvando…" : "Salvar padrão"}</button>
      </div>
    </Moldura>
  );
}
