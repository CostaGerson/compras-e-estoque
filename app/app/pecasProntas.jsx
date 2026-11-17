"use client";
// v906 — Produção › Estoque › Peças prontas: estoque lançado no sistema da loja NORT, lido aqui por depósito (SEDE/LOJA/ML · v910),
//   com o custo pela FPP do Item Padrão ligado ao nome (indexação um a um), estoque mínimo e pedidos da NORT aguardando FPP.
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search, AlertTriangle, Link2, History, X, Package } from "lucide-react";
import { alerta } from "./dialogo";

const C = { bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", navy: "#001E41",
  green: "#12A150", greenSoft: "#E7F6EE", red: "#D92D20", redSoft: "#FDECEA", yellow: "#C08401", yellowSoft: "#FFF6DD", steel: "#3D6799", steelSoft: "#EEF3FB" };
const moeda = (v) => (v == null ? "—" : "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qtd = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dtBR = (s) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export default function PecasProntas({ user }) {
  const [d, setD] = useState(null);
  const [ips, setIps] = useState([]);
  const [aba, setAba] = useState("ESTOQUE");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("");
  const [movs, setMovs] = useState(null);   // { item, l }
  const [ocup, setOcup] = useState(0);
  const ler = () => fetch(`/api/nort?u=${user.id}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ error: e.message }));
  useEffect(() => { ler(); fetch(`/api/nort?u=${user.id}&itensPadrao=1`).then((r) => r.json()).then((j) => setIps(j.itens || [])).catch(() => {}); }, []);
  const post = async (body) => {
    setOcup(body.itemId);
    try {
      const r = await fetch("/api/nort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...body }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error || "Erro.");
      if (j.reprocessados?.efetivados) alerta(`${j.reprocessados.efetivados} pedido(s) da NORT seguiram para a produção com a FPP indexada.`);
      await ler();
    } catch (e) { alerta(e.message); } finally { setOcup(0); }
  };
  const verMovs = async (it) => { setMovs({ item: it, l: null }); const j = await fetch(`/api/nort?u=${user.id}&movs=${it.id}`).then((r) => r.json()).catch(() => ({ movs: [] })); setMovs({ item: it, l: j.movs || [] }); };
  const ipPorTexto = useMemo(() => Object.fromEntries(ips.map((i) => [`${i.codigoPadrao ? `${i.codigoPadrao} · ` : ""}${i.nomeInterno}${i.fppNumero ? ` (FPP ${String(i.fppNumero).padStart(5, "0")})` : " (sem FPP)"}`, i])), [ips]);
  const rotIp = (i) => Object.keys(ipPorTexto).find((k) => ipPorTexto[k].id === i?.id) || "";
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  const base = (d.itens || []).filter((i) => (aba === "ESTOQUE" ? i.temEstoque : true));
  const lista = base.filter((i) => (!q || semAc(`${i.nome} ${i.sku || ""} ${i.itemPadrao?.nome || ""}`).includes(semAc(q)))
    && (filtro === "SEMCUSTO" ? i.custoUnit == null : filtro === "MINIMO" ? i.abaixoMinimo : filtro === "DIVERG" ? i.divergencia && ["SEDE", "LOJA", "ML"].some((k) => i.divergencia[k] && i.divergencia[k].erp !== i.divergencia[k].nort) : true));
  const est = (d.itens || []).filter((i) => i.temEstoque);
  const tot = { pecas: est.reduce((s, i) => s + i.total, 0), sede: est.reduce((s, i) => s + i.sede, 0), loja: est.reduce((s, i) => s + i.loja, 0), ml: est.reduce((s, i) => s + (i.ml || 0), 0),
    custo: est.reduce((s, i) => s + (i.custoTotal || 0), 0), semCusto: est.filter((i) => i.custoUnit == null).length, minimo: est.filter((i) => i.abaixoMinimo).length };
  const Kpi = ({ r, v, cor }) => <div className="rounded-lg px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}><div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{r}</div><div className="text-lg font-bold" style={{ color: cor || C.navy }}>{v}</div></div>;
  const Chip = ({ k, t, n }) => <button onClick={() => setFiltro(filtro === k ? "" : k)} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={filtro === k ? { background: C.navy, color: "#fff" } : { background: C.panel, color: C.text, border: `1px solid ${C.line}` }}>{t}{n != null ? ` (${n})` : ""}</button>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1"><Package size={18} style={{ color: C.accent }} /><div className="text-lg font-bold" style={{ color: C.navy }}>Peças prontas</div></div>
      <div className="text-xs mb-4" style={{ color: C.sub }}>Estoque lançado no sistema da loja NORT e lido aqui por depósito. O custo vem da FPP do Item Padrão ligado ao nome do item; sem FPP, o item fica sem custo. O estoque mínimo avisa Compras quando o total (SEDE + LOJA + Mercado Livre) fica abaixo dele.</div>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Kpi r="Peças em estoque" v={qtd(tot.pecas)} /><Kpi r="SEDE" v={qtd(tot.sede)} /><Kpi r="LOJA" v={qtd(tot.loja)} /><Kpi r="Mercado Livre" v={qtd(tot.ml)} />
        <Kpi r="Custo do estoque" v={moeda(tot.custo)} /><Kpi r="Itens sem custo (sem FPP)" v={tot.semCusto} cor={tot.semCusto ? C.yellow : C.navy} /><Kpi r="Abaixo do mínimo" v={tot.minimo} cor={tot.minimo ? C.red : C.navy} />
      </div>
      {(d.pendentes || []).length > 0 && <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: C.yellowSoft, border: `1px solid #F2DFA6` }}>
        <div className="font-semibold flex items-center gap-1 mb-1" style={{ color: C.yellow }}><AlertTriangle size={15} /> {d.pendentes.length} pedido(s) da NORT aguardando FPP</div>
        {d.pendentes.map((p) => <div key={p.id} className="text-xs" style={{ color: C.text }}>Pedido {p.numero || "—"} · ref {p.ref}{p.cliente ? ` · ${p.cliente}` : ""} — sem FPP: {p.semFpp.join(", ")}</div>)}
        <div className="text-xs mt-1" style={{ color: C.sub }}>Ligue o nome do item a um Item Padrão com FPP na aba "Todos os nomes" (o pedido segue sozinho) ou indexe a FPP no editor do pedido e gere o pedido.</div>
      </div>}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {[["ESTOQUE", "Peças prontas"], ["TODOS", "Todos os nomes (equivalência)"]].map(([k, t]) => <button key={k} onClick={() => setAba(k)} className="px-3 py-1.5 text-sm font-semibold rounded-md" style={{ background: aba === k ? "#EAF2FC" : "transparent", color: aba === k ? "#2E7CD6" : C.text }}>{t}</button>)}
        <div className="flex-1" />
        <Chip k="SEMCUSTO" t="Sem custo" n={base.filter((i) => i.custoUnit == null).length} /><Chip k="MINIMO" t="Abaixo do mínimo" n={base.filter((i) => i.abaixoMinimo).length} /><Chip k="DIVERG" t="Divergência" />
        <div className="flex items-center gap-1 px-2 rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.panel, order: -1 }}><Search size={13} style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar item…" className="py-1.5 text-sm outline-none" /></div>
      </div>
      <datalist id="nort-itens-padrao">{Object.keys(ipPorTexto).map((k) => <option key={k} value={k} />)}</datalist>
      <div className="rounded-xl overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm" style={{ minWidth: 1180 }}>
          <thead><tr className="text-[11px] uppercase text-left" style={{ color: C.sub, background: C.panel2 }}>
            <th className="px-3 py-2">Item (nome na NORT)</th><th className="px-3 py-2">Item padrão (equivalência)</th><th className="px-3 py-2 text-right">Custo un.</th>
            <th className="px-3 py-2 text-right">SEDE</th><th className="px-3 py-2 text-right">LOJA</th><th className="px-3 py-2 text-right">M. LIVRE</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Custo total</th>
            <th className="px-3 py-2 text-right">Mínimo</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {!lista.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-sm" style={{ color: C.sub }}>{(d.itens || []).length ? "Nenhum item neste filtro." : "Nenhum item ainda: os itens aparecem quando o sistema da NORT envia o estoque ou um pedido."}</td></tr>}
            {lista.map((i) => {
              const div = i.divergencia && ["SEDE", "LOJA", "ML"].filter((k) => i.divergencia[k] && i.divergencia[k].erp !== i.divergencia[k].nort);
              return (
                <tr key={i.id} style={{ borderTop: `1px solid ${C.line}`, background: i.abaixoMinimo ? "#FFF8F7" : undefined }}>
                  <td className="px-3 py-2"><div className="font-semibold" style={{ color: C.navy }}>{i.nome}</div><div className="text-[11px]" style={{ color: C.sub }}>{i.sku ? `SKU ${i.sku} · ` : ""}último movimento {dtBR(i.ultimoMovEm)}{div?.length ? <span style={{ color: C.yellow }}> · conferência ajustou {div.join(" e ")}</span> : null}</div></td>
                  <td className="px-3 py-2" style={{ minWidth: 300 }}>
                    {d.podeEditar ? <input list="nort-itens-padrao" defaultValue={rotIp(i.itemPadrao)} key={`${i.id}-${i.itemPadrao?.id || 0}`} placeholder="Escolha o item padrão…" disabled={ocup === i.id}
                      onBlur={(e) => { const v = e.target.value.trim(); const ip = ipPorTexto[v]; if (!v && i.itemPadrao) post({ acao: "indexar", itemId: i.id, itemPadraoId: null }); else if (ip && ip.id !== i.itemPadrao?.id) post({ acao: "indexar", itemId: i.id, itemPadraoId: ip.id }); else if (v && !ip) { e.target.value = rotIp(i.itemPadrao); alerta("Escolha um item padrão da lista."); } }}
                      className="w-full px-2 py-1 rounded text-xs outline-none" style={{ border: `1px solid ${i.itemPadrao ? C.line : C.accent}` }} />
                      : <span className="text-xs">{i.itemPadrao ? `${i.itemPadrao.codigo ? `${i.itemPadrao.codigo} · ` : ""}${i.itemPadrao.nome}` : "—"}</span>}
                    <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: i.fppNumero ? C.green : C.yellow }}><Link2 size={11} />{i.fppNumero ? `FPP ${String(i.fppNumero).padStart(5, "0")}` : i.itemPadrao ? "item padrão sem FPP" : "sem equivalência"}</div>
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: i.custoUnit == null ? C.yellow : C.text }}>{i.custoUnit == null ? "sem custo" : moeda(i.custoUnit)}</td>
                  <td className="px-3 py-2 text-right">{qtd(i.sede)}</td><td className="px-3 py-2 text-right">{qtd(i.loja)}</td><td className="px-3 py-2 text-right">{qtd(i.ml)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: i.abaixoMinimo ? C.red : C.navy }}>{qtd(i.total)}</td>
                  <td className="px-3 py-2 text-right">{moeda(i.custoTotal)}</td>
                  <td className="px-3 py-2 text-right">{d.podeEditar ? <input defaultValue={i.minimo ?? ""} key={`m${i.id}-${i.minimo}`} inputMode="decimal" placeholder="—" disabled={ocup === i.id}
                    onBlur={(e) => { const v = e.target.value.trim(); if (String(v) !== String(i.minimo ?? "")) post({ acao: "minimo", itemId: i.id, minimo: v }); }}
                    className="w-20 px-2 py-1 rounded text-xs text-right outline-none" style={{ border: `1px solid ${i.abaixoMinimo ? C.red : C.line}` }} /> : qtd(i.minimo)}
                    {i.abaixoMinimo && <div className="text-[10px] font-semibold" style={{ color: C.red }}>abaixo do mínimo</div>}</td>
                  <td className="px-3 py-2 text-right">{ocup === i.id ? <Loader2 size={14} className="animate-spin inline" /> : <button onClick={() => verMovs(i)} title="Movimentos" style={{ color: C.sub }}><History size={15} /></button>}</td>
                </tr>);
            })}
          </tbody>
        </table>
      </div>
      {movs && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={() => setMovs(null)}>
        <div className="rounded-xl w-full p-5" style={{ background: "#fff", maxWidth: 760, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center mb-3"><div className="font-bold flex-1" style={{ color: C.navy }}>Movimentos · {movs.item.nome}</div><button onClick={() => setMovs(null)} style={{ color: C.sub }}><X size={18} /></button></div>
          {!movs.l ? <Loader2 size={15} className="animate-spin" /> : !movs.l.length ? <div className="text-sm" style={{ color: C.sub }}>Sem movimentos.</div> :
            <table className="w-full text-xs"><thead><tr className="text-left uppercase" style={{ color: C.sub }}><th className="py-1">Data</th><th>Depósito</th><th>Tipo</th><th className="text-right">Qtd</th><th>Referência</th></tr></thead>
              <tbody>{movs.l.map((m) => <tr key={m.id} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1">{dtBR(m.data)}</td><td>{m.deposito}</td><td>{m.tipo}</td>
                <td className="text-right font-semibold" style={{ color: m.quantidade < 0 ? C.red : C.green }}>{m.quantidade > 0 ? "+" : ""}{qtd(m.quantidade)}</td><td>{[m.ref, m.obs].filter(Boolean).join(" · ")}</td></tr>)}</tbody></table>}
        </div>
      </div>}
    </div>
  );
}

// Dados › Integrações › NORT: token próprio e endereços
export function IntegracaoNort({ user }) {
  const [d, setD] = useState(null);
  const [ver, setVer] = useState(false);
  const URL_NORT = "https://producao.nortsports.com.br";   // v914 — endereço já vem preenchido (antes era só o texto de exemplo)
  const [lf, setLf] = useState({ url: "", token: "" });   // v910 — leitura do sistema da NORT
  const [lendo, setLendo] = useState("");
  const ler = () => fetch(`/api/nort?u=${user.id}&token=1`, { cache: "no-store" }).then((r) => r.json()).then((j) => { setD(j); setLf((x) => ({ url: x.url || j.leitura?.url || URL_NORT, token: "" })); }).catch((e) => setD({ error: e.message }));
  const postL = async (acao, extra = {}) => {
    setLendo(acao);
    try { const r = await fetch("/api/nort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao, ...extra }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "Erro.");
      if (acao === "lerAgora") alerta(`Pedidos: ${j.pedidos.ok ? `${j.pedidos.lidos} lido(s), ${j.pedidos.novos} novo(s)` : j.pedidos.erro} · Estoque: ${j.estoque.ok ? `${j.estoque.itens} item(ns), ${j.estoque.ajustados} ajustado(s)` : j.estoque.erro}`);
      await ler(); } catch (e) { alerta(e.message); } finally { setLendo(""); }
  };
  useEffect(() => { ler(); }, []);
  // v914 — "Ler agora" salva antes o que estiver nos campos (endereço/token) e só então lê
  const lerAgora = async () => {
    const url = (lf.url || "").trim() || URL_NORT;
    if (url !== (d.leitura?.url || "") || lf.token.trim()) {
      const r = await fetch("/api/nort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "leituraCfg", url, token: lf.token }) }).then(async (x) => ({ ok: x.ok, j: await x.json().catch(() => ({})) })).catch(() => null);
      if (!r?.ok) return alerta(r?.j?.error || "Não salvou o endereço/token.");
    }
    if (!d.leitura?.temToken && !lf.token.trim()) return alerta("Cole o token do sistema da loja antes de ler.");
    postL("lerAgora");
  };
  const renovar = async () => {
    const r = await fetch("/api/nort", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "token" }) }).then((x) => x.json()).catch(() => null);
    if (r?.token) { setD((x) => ({ ...x, token: r.token })); setVer(true); } else alerta(r?.error || "Não renovou.");
  };
  if (!d) return <Loader2 size={15} className="animate-spin" />;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="max-w-4xl">
      <div className="text-sm mb-4" style={{ color: C.sub }}>O ERP lê o sistema da loja NORT. O token abaixo é do ERP e só serve se o sistema da loja também quiser mandar dados para cá (opcional).</div>
      {/* v910 — o ERP lê o sistema da loja (pedidos a cada 10 min, estoque a cada 1 h) */}
      <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold mb-1" style={{ color: C.navy }}>Leitura do sistema da NORT</div>
        <div className="text-xs mb-3" style={{ color: C.sub }}>O ERP busca as encomendas conferidas a cada 10 min e o saldo de estoque a cada 1 h (Loja → LOJA, Reserva Fábrica → SEDE, Mercado Livre → ML). Endereços que o sistema da loja precisa ter: <code>/api/erp/pedidos</code> e <code>/api/erp/estoque</code>.</div>
        <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: "2fr 1.5fr auto" }}>
          <input value={lf.url} onChange={(e) => setLf({ ...lf, url: e.target.value })} placeholder="https://producao.nortsports.com.br" className="px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
          <input value={lf.token} onChange={(e) => setLf({ ...lf, token: e.target.value })} placeholder={d.leitura?.temToken ? "token salvo (deixe em branco para manter)" : "token do sistema da loja"} type="password" autoComplete="new-password" className="px-2 py-1.5 rounded text-sm outline-none" style={{ border: `1px solid ${C.line}` }} />
          <button onClick={() => postL("leituraCfg", lf)} disabled={!!lendo} className="px-3 py-1.5 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>{lendo === "leituraCfg" ? "Salvando…" : "Salvar"}</button>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: C.sub }}>
          {["pedidos", "estoque"].map((k) => { const x = d.leitura?.status?.[k]; return <span key={k}><b style={{ color: C.text }}>{k === "pedidos" ? "Pedidos" : "Estoque"}:</b> {x ? `${x.ok ? "ok" : `erro — ${x.erro}`} · ${new Date(x.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}${k === "pedidos" && x.ok ? ` · ${x.novos} novo(s)` : ""}${k === "estoque" && x.ok ? ` · ${x.itens} item(ns)` : ""}` : "ainda não leu"}</span>; })}
          <button onClick={lerAgora} disabled={!!lendo} className="ml-auto px-3 py-1 rounded font-semibold" style={{ border: `1px solid ${C.line}`, color: C.navy }}>{lendo === "lerAgora" ? "Lendo…" : "Ler agora"}</button>
        </div>
      </div>
      <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-semibold mb-2" style={{ color: C.navy }}>Token do ERP para a NORT (envio opcional)</div>
        <div className="flex items-center gap-2 flex-wrap">
          <code className="flex-1 min-w-[260px] px-3 py-2 rounded text-sm break-all" style={{ background: C.panel2 }}>{ver ? d.token : "•".repeat(24) + String(d.token).slice(-4)}</code>
          <button onClick={() => setVer((x) => !x)} className="px-3 py-2 rounded text-sm" style={{ border: `1px solid ${C.line}`, color: C.sub }}>{ver ? "Ocultar" : "Ver"}</button>
          <button onClick={() => { navigator.clipboard?.writeText(d.token); }} className="px-3 py-2 rounded text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>Copiar</button>
          {!d.fixoNoServidor && <button onClick={renovar} className="px-3 py-2 rounded text-sm" style={{ border: `1px solid ${C.red}`, color: C.red }}>Renovar</button>}
        </div>
        <div className="text-xs mt-2" style={{ color: C.sub }}>Endereço base: <b>{origem}</b></div>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        {(d.endpoints || []).map((e) => <div key={e.metodo + e.caminho} className="flex items-start gap-3 px-4 py-2.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded mt-0.5" style={{ background: e.metodo === "GET" ? "#EAF2FC" : "#FFF0E6", color: e.metodo === "GET" ? "#2E7CD6" : C.accent }}>{e.metodo}</span>
          <div className="flex-1 min-w-0"><code style={{ color: C.navy }}>{e.caminho}</code><div className="text-xs" style={{ color: C.sub }}>{e.desc}</div></div></div>)}
      </div>
    </div>
  );
}
