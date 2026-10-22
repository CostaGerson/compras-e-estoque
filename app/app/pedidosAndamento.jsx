"use client";
// v316 — Pedidos em andamento: sobe PV + PP (KM Sistemas) e vê a previsão de receitas (entrada + parcelas após a NF), dentro e fora do mês
import React, { useEffect, useRef, useState } from "react";
import { ouvirColar, pdfsDoColar } from "./colarPdf";
import { Upload, Loader2, FileText, ChevronDown, ChevronRight, Trash2, CheckCircle2, AlertTriangle, X, Receipt, Pencil, Save, Undo2, RefreshCw, Link2, Settings, Download } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => `R$ ${brl(v)}`;
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (c) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;
const curto = (c) => `${MESES[Number(c.slice(5, 7)) - 1].slice(0, 3).toLowerCase()}/${c.slice(2, 4)}`;
const somaMes = (c, n) => { const d = new Date(Date.UTC(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const lerB64 = (f) => new Promise((ok, nok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = nok; r.readAsDataURL(f); });

export default function PedidosAndamento({ user }) {
  const hoje = new Date();
  const [comp, setComp] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [todos, setTodos] = useState(false);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [vista, setVista] = useState(null);   // v393 — card/aviso clicado: a lista mostra só os pedidos dele
  const inp = useRef(null);
  const tabRef = useRef(null);

  const carregar = () => fetch(`/api/fin/pedidos?u=${user.id}&competencia=${comp}&ocultos=1${todos ? "&todos=1" : ""}`)
    .then((r) => r.json().then((j) => (r.ok ? (setD(j), setErro("")) : setErro(j.error || "Erro")))).catch(() => setErro("Falha de conexão."));
  useEffect(() => { carregar(); }, [comp, todos]);
  // v319 — colar (Ctrl+V) PDFs copiados do Explorer/e-mail em qualquer lugar da tela
  const enviarRef = useRef(null);
  useEffect(() => {
    return ouvirColar((fs) => enviarRef.current?.(fs), (m) => setErro(m));
  }, []);

  const enviar = async (files) => {
    const lista = [...files].filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
    if (!lista.length) return;
    setEnviando(true); setResultado(null);
    try {
      const arquivos = [];
      for (const f of lista) arquivos.push({ nome: f.name, base64: await lerB64(f) });
      const r = await fetch("/api/fin/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, arquivos }) });
      const j = await r.json();
      if (!r.ok) setErro(j.error || "Erro"); else { setResultado(j.resultado); carregar(); }
    } catch (e) { setErro(e.message); }
    setEnviando(false);
  };
  enviarRef.current = enviar;
  const salvar = async (id, dados) => {
    const r = await fetch("/api/fin/pedidos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, id, ...dados }) });
    const j = await r.json(); if (!r.ok) return alert(j.error || "Erro"); carregar();
  };
  const lancarEntrada = async (p) => {
    const pend = p.previsao.parcelas.find((x) => x.pendente);
    const venc = prompt(`Vencimento da entrada de ${moeda(pend?.valor)} (AAAA-MM-DD):`, p.emissao || "");
    if (venc === null) return;
    const r = await fetch("/api/fin/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "entrada", id: p.id, vencimento: venc || undefined }) });
    const j = await r.json(); if (!r.ok) return alert(j.error || "Erro"); carregar();
  };
  const excluir = async (p) => {
    if (!confirm(`Excluir o pedido ${p.numero} (${p.cliente})?`)) return;
    const r = await fetch(`/api/fin/pedidos?u=${user.id}&id=${p.id}`, { method: "DELETE" }); if (r.ok) carregar();
  };

  const [conex, setConex] = useState(null);   // v317 — formulário de conexão com o Cronograma
  const [diag, setDiag] = useState(null);
  const [sinc, setSinc] = useState(false);
  const post = async (corpo) => { const r = await fetch("/api/fin/pedidos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...corpo }) }); return r.json(); };
  const atualizarPcp = async () => { setSinc(true); await post({ acao: "crono-sync" }); await carregar(); setSinc(false); };
  const salvarConexao = async () => { setSinc(true); await post({ acao: "crono-config", url: conex.url, token: conex.token || undefined }); setConex(null); await carregar(); setSinc(false); };
  const verDiag = async () => { setDiag({ carregando: true }); const r = await fetch(`/api/fin/pedidos?u=${user.id}&acao=crono-diag`); setDiag(await r.json()); };
  const R = d?.resumo;
  const normal = (p) => !p.oculto && !p.interno;
  const CR = d?.crono;
  const f = filtro.trim().toUpperCase();
  const VISTAS = {
    andamento: ["Pedidos em andamento · a faturar", (p) => normal(p) && p.status === "ANDAMENTO" && (p.vlEntregar != null ? p.vlEntregar : p.total) > 0.009],
    noMes: [`Com pagamento em ${curto(comp)}`, (p) => normal(p) && p.noMes > 0.009],
    foraMes: ["Fora do mês", (p) => normal(p) && p.foraMes > 0.009],
    antes: ["Antes do mês", (p) => normal(p) && p.antes > 0.009],
    entLancadas: ["Entradas já lançadas", (p) => normal(p) && p.previsao.entradaLancada > 0.009],
    entPendentes: ["Entradas a lançar", (p) => normal(p) && p.previsao.parcelas.some((x) => x.pendente)],
    reprogPcp: ["Programação vencida no Cronograma", (p) => normal(p) && p.previsao.reprogramar === "PCP"],
    reprogDespacho: ["Entrega vencida", (p) => normal(p) && p.previsao.reprogramar === "DESPACHO"],
    internos: ["Internos NORT", (p) => !p.oculto && p.interno && p.status === "ANDAMENTO"],
    prontosSemNf: ["Concluídos no PCP sem NF no KM", (p) => normal(p) && p.previsao.pronto && !(p.kmNfs || []).length],
    prontosComNf: ["Concluídos no PCP com NF parcial no KM", (p) => normal(p) && p.previsao.pronto && (p.kmNfs || []).length > 0],
    semCondicao: ["Condição não reconhecida", (p) => normal(p) && !p.previsao.condicaoOk],
    nfSemContas: ["NF emitida no KM — subir NF", (p) => normal(p) && !!p.faturamentoPendente],
    foraPcp: ["Antigos fora do PCP do Maycon (ocultos)", (p) => !!p.oculto],
    semPv: ["Sem PV", (p) => normal(p) && !p.temPv],
    semCrono: ["Sem programação no Cronograma", (p) => normal(p) && !p.entregaPrevista],
    nfSugerida: ["Com NF de saída que parece ser o faturamento", (p) => normal(p) && !!p.nfSugerida],
  };
  const tog = (k) => setVista(vista === k ? null : k);
  const base = (d?.pedidos || []).filter(vista && VISTAS[vista] ? VISTAS[vista][1] : (p) => !p.oculto && !(p.interno && p.status === "ANDAMENTO"));
  const lista = base.filter((p) => !f || `${p.numero} ${p.cliente} ${p.vendedor || ""}`.toUpperCase().includes(f))
    .map((p, i) => [p, i]).sort((a, b) => (b[0].previsao.atrasado ? 1 : 0) - (a[0].previsao.atrasado ? 1 : 0) || a[1] - b[1]).map(([p]) => p);   // v322 — vencidos no topo

  // v395 — exporta para Excel exatamente o que a lista mostra (filtro do card/aviso, busca e ordem escolhida no título da coluna)
  const exportar = async () => {
    const XLSX = await import("xlsx");
    const ordemDom = [...(tabRef.current?.querySelectorAll("tbody tr[data-chave]") || [])].map((tr) => tr.dataset.chave);
    const porId = Object.fromEntries(lista.map((p) => [String(p.id), p]));
    const pedidos = ordemDom.length ? ordemDom.map((k) => porId[k]).filter(Boolean) : lista;
    const dt = (s) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00Z`) : null);
    const situacao = (p) => p.status !== "ANDAMENTO" ? (p.status === "FATURADO" ? `FATURADO${p.nfNumero ? ` · NF ${p.nfNumero}` : ""}` : p.status)
      : p.cronoSituacao && p.cronoSituacao !== "NÃO ESTÁ NO CRONOGRAMA" ? `PCP: ${String(p.cronoSituacao).split(" · ")[0]}` : p.cronoSituacao ? "FORA DO PCP" : "EM ANDAMENTO";
    const linhas = pedidos.map((p) => ({
      Pedido: p.numero, Cliente: p.cliente, CNPJ: p.cnpj || "", Vendedor: p.vendedor || "", "O.C.": p.oc || "",
      "Emissão": dt(p.emissao), Entrega: dt(p.entregaPrevista || p.despacho), "Entrega pelo": p.previsao.baseOrigem === "CRONOGRAMA" ? "PCP" : "PV",
      "Condição": p.condicao || "", "Peças": p.qtd || 0, "Peças a entregar": p.qtEntregar ?? "", Total: Number(p.total) || 0,
      "Saldo a faturar": p.vlEntregar != null ? Number(p.vlEntregar) : Number(p.total) || 0,
      Entrada: p.previsao.entrada || 0, "Entrada lançada": p.previsao.entradaLancada || 0,
      [`No mês (${curto(comp)})`]: p.noMes || 0, "Fora do mês": p.foraMes || 0, "Antes do mês": p.antes || 0,
      "Situação": situacao(p), "Etapa PCP": p.cronoEtapa || "", Atrasado: p.previsao.atrasado ? "SIM" : "",
      "NF no KM": (p.kmNfs || []).map((n) => n.numero).join(", "), Interno: p.interno ? "SIM" : "", Origem: p.fonte || "",
    }));
    const parcelas = pedidos.flatMap((p) => p.previsao.parcelas.map((x) => ({
      Pedido: p.numero, Cliente: p.cliente, Tipo: x.tipo === "ENTRADA" ? "ENTRADA" : `PARCELA ${x.n}/${x.de}`, Vencimento: dt(x.data), Valor: x.valor,
      "Pendente (entrada a lançar)": x.pendente ? "SIM" : "",
    })));
    const wb = XLSX.utils.book_new();
    const add = (dados, nome, larg) => {
      const ws = XLSX.utils.json_to_sheet(dados.length ? dados : [{ "": "sem dados" }], { cellDates: true, dateNF: "dd/mm/yyyy" });
      ws["!cols"] = larg.map((w) => ({ wch: w }));
      if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
      XLSX.utils.book_append_sheet(wb, ws, nome);
    };
    add(linhas, "Pedidos", [11, 38, 16, 12, 16, 11, 11, 8, 26, 8, 10, 13, 13, 12, 12, 13, 13, 13, 26, 18, 9, 14, 8, 10]);
    add(parcelas, "Parcelas previstas", [11, 38, 14, 12, 13, 12]);
    const sufixo = vista && VISTAS[vista] ? ` - ${VISTAS[vista][0]}` : "";
    XLSX.writeFile(wb, `Pedidos em andamento ${comp}${sufixo}.xlsx`.replace(/[\\/:*?"<>|]/g, "-"), { cellDates: true });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1 rounded-lg px-1 py-1" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <button onClick={() => setComp(somaMes(comp, -1))} className="px-2 text-sm font-bold" style={{ color: C.navy }}>‹</button>
          <span className="text-sm font-bold px-2" style={{ color: C.navy, minWidth: 130, textAlign: "center" }}>{nomeMes(comp)}</span>
          <button onClick={() => setComp(somaMes(comp, 1))} className="px-2 text-sm font-bold" style={{ color: C.navy }}>›</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs" style={{ color: C.sub }}><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} /> mostrar faturados e cancelados</label>
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar pedido, cliente, vendedor…" className="px-3 py-1.5 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, minWidth: 240 }} />
        <button onClick={exportar} disabled={!lista.length} title="Baixa em Excel o que a lista está mostrando (filtro, busca e ordem)" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
          style={{ color: C.green, border: `1px solid ${C.green}`, background: C.panel, opacity: lista.length ? 1 : 0.4 }}><Download size={14} /> Excel{lista.length ? ` (${lista.length})` : ""}</button>
        <div className="flex-1" />
        <input ref={inp} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
        <button disabled={enviando} onClick={() => inp.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent, opacity: enviando ? 0.5 : 1 }}>
          {enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Subir PV e PP
        </button>
      </div>

      <div tabIndex={0} title="Clique aqui e aperte Ctrl+V" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); enviar(e.dataTransfer.files); }}
        className="rounded-xl px-4 py-3 mb-4 text-xs flex items-center gap-2" style={{ background: C.blueSoft, color: C.blue, border: `1px dashed ${C.blue}` }}>
        <FileText size={14} /> Arraste ou cole (Ctrl+V) aqui os PDFs do KM, vários de uma vez: o <b>PV</b> (valores e condição), o <b>PP</b> (produção) e o relatório <b>Posição Geral de Vendas</b> (condição e saldo a faturar de todos os pedidos de uma vez). Tudo se junta pelo nº do pedido.
      </div>

      {/* v317 — conexão com o Cronograma (Maycon) */}
      {d && (
        <div className="rounded-xl px-4 py-2.5 mb-4 flex flex-wrap items-center gap-3 text-xs" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <Link2 size={14} style={{ color: CR?.erro || !CR?.temToken ? C.red : C.green }} />
          <b style={{ color: C.navy }}>Cronograma PCP</b>
          {!CR?.temToken ? <span style={{ color: C.red }}>sem token — configure a conexão</span>
            : CR?.erro ? <span style={{ color: C.red }}>{CR.erro}</span>
            : <span style={{ color: C.sub }}>lido {CR?.em ? new Date(CR.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"} · {CR?.itens ?? 0} itens, {CR?.etapas ?? 0} etapas · {CR?.casados ?? 0} pedido(s) daqui casados{CR?.semPedidoAqui ? ` · ${CR.semPedidoAqui} OP(s) em produção no PCP sem PV aqui` : ""}{CR?.pecasEmProducao != null ? ` · ${CR.pecasEmProducao.toLocaleString("pt-BR")} peças em produção (${CR.opsEmProducao ?? 0} OPs)` : ""}{CR?.opsAgrupamento ? ` · ${CR.opsAgrupamento} OP(s) de agrupamento` : ""}{CR?.complementos ? ` · ${CR.complementos} complementos fora da contagem de peças` : ""}{CR?.semNumero ? ` · ${CR.semNumero} itens sem nº (amostra/piloto)` : ""}{CR?.avisoEtapas ? ` · etapas: ${CR.avisoEtapas}` : ""}</span>}
          <div className="flex-1" />
          <button disabled={sinc} onClick={atualizarPcp} className="flex items-center gap-1 font-semibold" style={{ color: C.accent }}>{sinc ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Atualizar do PCP</button>
          <button onClick={verDiag} className="font-semibold" style={{ color: C.sub }}>Ver o que veio</button>
          <button onClick={() => setConex({ url: CR?.url || "", token: "" })} className="flex items-center gap-1 font-semibold" style={{ color: C.sub }}><Settings size={12} /> Conexão</button>
        </div>
      )}
      {conex && (
        <div className="rounded-xl p-4 mb-4 text-xs grid gap-2" style={{ background: C.panel, border: `1px solid ${C.accent}`, maxWidth: 560 }}>
          <b style={{ color: C.navy }}>Conexão com o Cronograma</b>
          <label>Endereço <input value={conex.url} onChange={(e) => setConex({ ...conex, url: e.target.value })} placeholder="http://147.93.35.189:8124" className="w-full px-2 py-1 rounded mt-0.5" style={{ border: `1px solid ${C.line}` }} /></label>
          <label>Token (X-Api-Key){CR?.temToken ? ` — atual termina em …${CR.tokenFim}; deixe vazio para manter` : ""} <input type="password" value={conex.token} onChange={(e) => setConex({ ...conex, token: e.target.value })} className="w-full px-2 py-1 rounded mt-0.5" style={{ border: `1px solid ${C.line}` }} /></label>
          <div className="flex gap-2"><button onClick={salvarConexao} className="px-3 py-1 rounded font-semibold text-white" style={{ background: C.accent }}>Salvar e ler</button><button onClick={() => setConex(null)} style={{ color: C.sub }}>cancelar</button></div>
        </div>
      )}
      {diag && (
        <div className="rounded-xl p-3 mb-4 text-[11px]" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-1"><b style={{ color: C.navy }}>O que o Cronograma devolveu (amostra)</b><button onClick={() => setDiag(null)}><X size={14} /></button></div>
          {diag.carregando ? <Loader2 size={14} className="animate-spin" /> : <pre className="overflow-auto" style={{ maxHeight: 360, whiteSpace: "pre-wrap" }}>{JSON.stringify(diag, null, 2)}</pre>}
        </div>
      )}

      {resultado && (
        <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-1"><b style={{ color: C.navy }}>Importação</b><button onClick={() => setResultado(null)}><X size={14} /></button></div>
          {resultado.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-0.5" style={{ color: r.erro ? C.red : C.text }}>
              {r.erro ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} style={{ color: C.green }} />}
              <span className="font-semibold">{r.nome}</span>
              <span style={{ color: C.sub }}>{r.erro || (r.tipo === "POSICAO" ? `Posição de Vendas · ${r.lidos} pedido(s) lidos · ${r.criados} novo(s), ${r.atualizados} atualizado(s) · saldo a faturar ${moeda(r.somaVle)}` : `${r.tipo} · pedido ${r.numero} · ${r.cliente || ""}${r.tipo === "PV" ? ` · ${moeda(r.total)}` : ` · ${r.itens} item(ns)`}${r.novo ? " · novo" : " · atualizado"}${r.semPv ? " · falta o PV" : ""}`)}</span>
            </div>
          ))}
        </div>
      )}

      {erro && <div className="rounded-lg px-4 py-3 mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>}

      {R && (
        <>
          {/* painel de previsão de receitas */}
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Kpi onClick={() => tog("andamento")} ativo={vista === "andamento"} t="Pedidos em andamento · a faturar" v={moeda(R.totalAndamento)} cor={C.navy}
              s={`${R.qtdPedidos} pedido(s) · ${R.pecas.toLocaleString("pt-BR")} peças a entregar${R.totalBruto != null && Math.abs(R.totalBruto - R.totalAndamento) > 0.01 ? ` · bruto ${moeda(R.totalBruto)}` : ""}${R.qtdSemSaldo ? ` · ${R.qtdSemSaldo} sem saldo` : ""}`} />
            <Kpi onClick={() => tog("noMes")} ativo={vista === "noMes"} t={`A receber em ${curto(comp)}`} v={moeda(R.noMes)} s="entradas a lançar + parcelas que vencem no mês" cor={C.green} />
            <Kpi onClick={() => tog("foraMes")} ativo={vista === "foraMes"} t="Fora do mês" v={moeda(R.foraMes)} s={`parcelas depois de ${curto(comp)}`} cor={C.blue} />
            <Kpi onClick={() => tog("entLancadas")} ativo={vista === "entLancadas"} t="Entradas já lançadas" v={moeda(R.entradasLancadas)} s="estão no contas a receber" cor={C.sub} />
            <Kpi onClick={() => tog("entPendentes")} ativo={vista === "entPendentes"} t="Entradas a lançar" v={moeda(R.entradasPendentes)} s={`${R.qtdEntradasPendentes} pedido(s)`} cor={R.entradasPendentes ? C.accent : C.sub} />
            {R.antes > 0 && <Kpi onClick={() => tog("antes")} ativo={vista === "antes"} t="Antes do mês" v={moeda(R.antes)} s="parcelas de meses anteriores ao selecionado" cor={C.yellow} />}
          </div>
          {(R.qtdAtrasados || R.qtdProntos || R.qtdInternos || R.qtdSemCondicao || R.qtdSemPv || R.qtdNfSugerida || R.qtdForaPcp || R.qtdNfSemContas || (CR?.temToken && R.qtdSemCrono)) > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 text-xs">
              {R.qtdReprogPcp > 0 && <Aviso onClick={() => tog("reprogPcp")} ativo={vista === "reprogPcp"} cor={C.red} bg={C.redSoft}>{R.qtdReprogPcp} com programação vencida — reprogramar no Cronograma (contam de hoje)</Aviso>}
              {R.qtdReprogDespacho > 0 && <Aviso onClick={() => tog("reprogDespacho")} ativo={vista === "reprogDespacho"} cor={C.red} bg={C.redSoft}>{R.qtdReprogDespacho} com entrega vencida — programar no Cronograma (contam de hoje)</Aviso>}
              {R.qtdInternos > 0 && <Aviso onClick={() => tog("internos")} ativo={vista === "internos"} cor={C.sub} bg={C.panel2}>{R.qtdInternos} interno(s) NORT — fora da lista, da previsão e sem contas</Aviso>}
              {R.qtdProntosSemNf > 0 && <Aviso onClick={() => tog("prontosSemNf")} ativo={vista === "prontosSemNf"} cor={C.green} bg={C.greenSoft}>{R.qtdProntosSemNf} concluído(s) no PCP sem NF no KM — faturar</Aviso>}
              {R.qtdProntosComNf > 0 && <Aviso onClick={() => tog("prontosComNf")} ativo={vista === "prontosComNf"} cor={C.blue} bg={C.blueSoft}>{R.qtdProntosComNf} concluído(s) no PCP com NF parcial no KM — conferir o saldo</Aviso>}
              {R.qtdSemCondicao > 0 && <Aviso onClick={() => tog("semCondicao")} ativo={vista === "semCondicao"} cor={C.yellow} bg={C.yellowSoft}>{R.qtdSemCondicao} com condição de pagamento não reconhecida — previsto à vista na entrega</Aviso>}
              {R.qtdNfSemContas > 0 && <Aviso onClick={() => tog("nfSemContas")} ativo={vista === "nfSemContas"} cor={C.blue} bg={C.blueSoft}>{R.qtdNfSemContas} com NF emitida no KM — suba a NF no movimento fiscal para faturar</Aviso>}
              {R.qtdForaPcp > 0 && <Aviso onClick={() => tog("foraPcp")} ativo={vista === "foraPcp"} cor={C.sub} bg={C.panel2}><span title={(R.foraPcp || []).join(", ")}>{R.qtdForaPcp} pedido(s) antigo(s) fora do PCP do Maycon — ocultos</span></Aviso>}
              {R.qtdSemPv > 0 && <Aviso onClick={() => tog("semPv")} ativo={vista === "semPv"} cor={C.yellow} bg={C.yellowSoft}>{R.qtdSemPv} só com PP — suba o PV para ter os valores</Aviso>}
              {R.qtdSemCrono > 0 && CR?.temToken && <Aviso onClick={() => tog("semCrono")} ativo={vista === "semCrono"} cor={C.yellow} bg={C.yellowSoft}>{R.qtdSemCrono} sem programação no Cronograma — previsto pela DT despacho do PV</Aviso>}
              {R.qtdNfSugerida > 0 && <Aviso onClick={() => tog("nfSugerida")} ativo={vista === "nfSugerida"} cor={C.blue} bg={C.blueSoft}>{R.qtdNfSugerida} com NF de saída que parece ser o faturamento — confira e marque como faturado</Aviso>}
            </div>
          )}
          {R.porMes.length > 0 && (
            <div className="rounded-xl p-3 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold uppercase mb-2" style={{ color: C.navy }}>Previsão por mês</div>
              <div className="flex flex-wrap gap-2">
                {R.porMes.map((m) => (
                  <button key={m.competencia} onClick={() => { const sai = m.competencia === comp && vista === "noMes"; setComp(m.competencia); setVista(sai ? null : "noMes"); }} title="Clique para ver os pedidos com pagamento neste mês" className="rounded-lg px-3 py-1.5 text-left"
                    style={{ background: m.competencia === comp ? C.accentSoft : C.panel2, border: `${m.competencia === comp && vista === "noMes" ? 2 : 1}px solid ${m.competencia === comp ? C.accent : C.line}` }}>
                    <div className="text-[10px] font-semibold uppercase" style={{ color: C.sub }}>{curto(m.competencia)}</div>
                    <div className="text-sm font-bold whitespace-nowrap tabular-nums" style={{ color: C.navy }}>{moeda(m.valor)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {vista && VISTAS[vista] && (
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span className="px-2.5 py-1 rounded-full font-semibold" style={{ background: C.navy, color: "#fff" }}>Mostrando: {VISTAS[vista][0]} · {lista.length}</span>
              <button onClick={() => setVista(null)} className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold" style={{ color: C.sub, border: `1px solid ${C.line}` }}><X size={12} /> mostrar todos</button>
            </div>
          )}
          {/* pedidos */}
          <div className="rounded-xl overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table ref={tabRef} className="w-full text-xs">
              <thead>
                <tr style={{ background: C.panel2, color: C.sub }}>
                  {["", "Pedido", "Cliente", "Emissão", "Entrega", "Condição", "Peças", "Total", "Entrada", `No mês`, "Fora do mês", "Situação", ""].map((h, i) => (
                    <th key={i} className="px-2 py-2 font-semibold whitespace-nowrap text-center">{h}</th>))}
                </tr>
              </thead>
              <tbody>
                {!lista.length && <tr><td colSpan={13} className="px-3 py-6 text-center" style={{ color: C.sub }}>{vista ? "Nenhum pedido neste filtro." : "Nenhum pedido. Suba os PDFs de PV e PP."}</td></tr>}
                {lista.map((p) => <LinhaPedido key={p.id} p={p} aberto={aberto === p.id} onToggle={() => setAberto(aberto === p.id ? null : p.id)}
                  user={user} salvar={salvar} lancarEntrada={lancarEntrada} excluir={excluir} comp={comp} />)}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] mt-2" style={{ color: C.sub }}>
            Entrega = programação do Cronograma (fim programado das etapas; sem etapas, o prazo de entrega dos itens) ou, sem ela, a DT despacho do PV. Parcelas = restante (total − entrada) dividido pelos prazos da condição, contados da entrega/NF.
            Entrada já lançada no contas a receber sai da previsão (já conta no a receber); entrada ainda não lançada entra na previsão. Faturado sai da previsão: a partir daí valem as contas da NF.
          </div>
        </>
      )}
    </div>
  );
}

function LinhaPedido({ p, aberto, onToggle, user, salvar, lancarEntrada, excluir, comp }) {
  const v = p.previsao;
  const [ed, setEd] = useState(null);
  // v392 — em andamento mostra a situação do pedido no PCP do Maycon; FATURADO só quando a NF é subida (contas lançadas)
  const pcpSit = p.cronoSituacao && p.cronoSituacao !== "NÃO ESTÁ NO CRONOGRAMA" ? String(p.cronoSituacao).split(" · ")[0] : null;
  const st = { ANDAMENTO: [pcpSit ? `PCP: ${pcpSit}` : p.cronoSituacao ? "Fora do PCP" : "Em andamento", p.cronoConcluido ? C.green : C.accent, p.cronoConcluido ? C.greenSoft : C.accentSoft],
    FATURADO: ["Faturado", C.green, C.greenSoft], CANCELADO: ["Cancelado", C.sub, C.panel2] }[p.status];
  const td = "px-2 py-2 text-center whitespace-nowrap";
  return (
    <>
      <tr onClick={onToggle} data-chave={p.id} className="cursor-pointer" style={{ height: 52, borderTop: `1px solid ${C.line}`, background: v.atrasado ? C.redSoft : aberto ? C.panel2 : undefined, boxShadow: v.atrasado ? `inset 3px 0 0 ${C.red}` : undefined, opacity: p.interno ? 0.65 : 1 }}>
        <td className={td}>{aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
        <td className={`${td} font-bold`} style={{ color: C.navy }}>{p.numero}</td>
        {/* v376 — linha de altura fixa: no máximo 2 linhas (cliente + um aviso); o resto aparece ao abrir o pedido */}
        <td className="px-2 py-1 text-left" style={{ maxWidth: 340 }} title={[p.cliente, p.vendedor].filter(Boolean).join(" · ")}>
          <div className="truncate">{p.cliente}{p.vendedor && <span style={{ color: C.sub }}> · {p.vendedor}</span>}</div>
          {(() => {
            const a = v.reprogramar ? [C.red, `⚠ ${v.reprogramar === "PCP" ? "PROGRAMAÇÃO VENCIDA — REPROGRAMAR NO PCP" : "ENTREGA VENCIDA — PROGRAMAR NO PCP"}`]
              : p.interno ? [C.sub, "INTERNO · NORT — NÃO GERA CONTAS"]
              : v.pronto ? [C.green, "✓ CONCLUÍDO NO PCP — FATURAR"] : null;
            return a ? <div className="text-[10px] font-bold truncate" style={{ color: a[0] }}>{a[1]}</div> : null;
          })()}</td>
        <td className={td}>{dBR(p.emissao)}</td>
        <td className={td} style={{ color: v.atrasado ? C.red : C.text }} title={v.baseOrigem === "CRONOGRAMA" ? `programação do Cronograma${p.despacho ? ` · DT despacho do PV ${dBR(p.despacho)}` : ""}` : "DT despacho do PV"}>
          {dBR(p.entregaPrevista || p.despacho)}{v.baseOrigem === "CRONOGRAMA" && <span className="ml-1 text-[9px] font-bold" style={{ color: C.blue }}>PCP</span>}{v.atrasado && <AlertTriangle size={11} className="inline ml-1" />}
        </td>
        <td className={td} style={{ color: v.condicaoOk ? C.text : C.yellow }}>{p.condicao || "—"}</td>
        <td className={`${td} tabular-nums`}>{(p.qtd || 0).toLocaleString("pt-BR")}</td>
        <td className={`${td} tabular-nums font-semibold`}>{p.temPv ? brl(p.total) : <span style={{ color: C.yellow }}>falta PV</span>}</td>
        <td className={`${td} tabular-nums`} style={{ color: v.entrada ? (v.entradaLancada + 0.01 >= v.entrada ? C.green : C.accent) : C.sub }}>
          {v.entrada ? brl(v.entrada) : "—"}{v.entrada > 0 && <span className="text-[9px] ml-1">{v.entradaLancada + 0.01 >= v.entrada ? "lançada" : "a lançar"}</span>}
        </td>
        <td className={`${td} tabular-nums font-semibold`} style={{ color: p.noMes ? C.green : C.sub }}>{brl(p.noMes)}</td>
        <td className={`${td} tabular-nums`} style={{ color: p.foraMes ? C.blue : C.sub }}>{brl(p.foraMes)}</td>
        <td className={td}>
          {p.status === "ANDAMENTO" && Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length > 0   /* v372/v376 — parcial: resumido; NFs ao abrir */
            ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: C.yellow, background: C.yellowSoft }}
                title={p.nfsFaturadas.map((n) => `NF ${n.numero} (${dBR(n.emissao)}) · ${n.pecas} peças · ${moeda(n.valor)}`).join("\n")}>
                Parcial · faltam {p.qtEntregar ?? "?"} pç</span>
            : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ color: st[1], background: st[2] }} title={p.status === "ANDAMENTO" ? [p.cronoSituacao, p.cronoEtapa && `etapa: ${p.cronoEtapa}`].filter(Boolean).join(" · ") || undefined : p.nfNumero ? `NF ${p.nfNumero}` : undefined}>
                {st[0]}{p.nfNumero ? ` · NF ${String(p.nfNumero).split(/[,\s]+/)[0]}${String(p.nfNumero).includes(",") ? "…" : ""}` : ""}</span>}
          {p.nfSugerida && <span className="ml-1 text-[10px] font-semibold" style={{ color: C.blue }} title={`NF ${p.nfSugerida.numero} de ${dBR(p.nfSugerida.emissao)} · ${moeda(p.nfSugerida.valor)}`}>NF?</span>}
          {p.status === "ANDAMENTO" && (p.faturamentoPendente?.nfNumero || (Array.isArray(p.kmNfs) && p.kmNfs.length > 0)) && <span className="ml-1 text-[10px] font-semibold" style={{ color: C.blue }}
            title={`${(p.kmNfs || []).map((n) => `NF ${n.numero} (${dBR(n.emissao)}) · ${moeda(n.valor)}`).join("\n")}\nEmitida no KM — suba a NF no movimento fiscal para faturar o pedido`}>
            NF {p.faturamentoPendente?.nfNumero || (p.kmNfs || []).map((n) => n.numero).join(", ")} no KM — subir NF</span>}</td>
        <td className={td} onClick={(e) => e.stopPropagation()}>
          {p.pdfPv && <a href={`/api/fin/pedidos?u=${user.id}&acao=pdf&id=${p.id}&tipo=PV`} target="_blank" className="font-semibold mr-2" style={{ color: C.accent }}>PV</a>}
          {p.pdfPp && <a href={`/api/fin/pedidos?u=${user.id}&acao=pdf&id=${p.id}&tipo=PP`} target="_blank" className="font-semibold" style={{ color: C.accent }}>PP</a>}
          {String(p.fonte || "").includes("KM") && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ color: C.green, background: C.greenSoft }} title="Dados sincronizados do KM (PV e OP)">KM</span>}
        </td>
      </tr>
      {aberto && (
        <tr data-anexo={p.id} style={{ background: C.panel2 }}>
          <td colSpan={13} className="px-4 pb-4 pt-1">
            <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1.4fr)" }}>
              {/* financeiro */}
              <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-2">
                  <b className="text-xs" style={{ color: C.navy }}>Previsão de recebimento</b>
                  {!ed ? <button onClick={() => setEd({ condicao: p.condicao || "", entradaValor: p.entradaValor ?? "", despacho: p.despacho || "" })} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.accent }}><Pencil size={11} /> editar</button>
                    : <span className="flex gap-2">
                        <button onClick={() => { salvar(p.id, { condicao: ed.condicao, entradaValor: ed.entradaValor === "" ? null : Number(String(ed.entradaValor).replace(/\./g, "").replace(",", ".")), despacho: ed.despacho || null }); setEd(null); }} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.green }}><Save size={11} /> salvar</button>
                        <button onClick={() => setEd(null)} className="text-[11px]" style={{ color: C.sub }}>cancelar</button></span>}
                </div>
                {ed ? (
                  <div className="grid gap-2 mb-2 text-xs">
                    <label>Condição de pagamento <input value={ed.condicao} onChange={(e) => setEd({ ...ed, condicao: e.target.value })} placeholder="EX.: 30/60/90 · ENTRADA 50% + 30 DIAS · A VISTA" className="w-full px-2 py-1 rounded mt-0.5" style={{ border: `1px solid ${C.line}` }} /></label>
                    <label>Valor da entrada (vazio = pela condição) <input value={ed.entradaValor} onChange={(e) => setEd({ ...ed, entradaValor: e.target.value })} className="w-full px-2 py-1 rounded mt-0.5" style={{ border: `1px solid ${C.line}` }} /></label>
                    <label>DT despacho <input type="date" value={ed.despacho} onChange={(e) => setEd({ ...ed, despacho: e.target.value })} className="w-full px-2 py-1 rounded mt-0.5" style={{ border: `1px solid ${C.line}` }} /></label>
                  </div>
                ) : (
                  <div className="text-[11px] mb-2" style={{ color: C.sub }}>
                    {v.condicaoOk ? <>Condição <b>{p.condicao}</b>: {v.entradaPct > 0 ? `entrada de ${Math.round(v.entradaPct * 100)}% + ` : ""}{v.prazos.length ? `${v.prazos.join("/")} dias após a NF` : ""}</> : <span style={{ color: C.yellow }}>Condição não reconhecida — previsto à vista na entrega. Edite a condição.</span>}
                    {" · "}base: {v.baseOrigem === "CRONOGRAMA" ? "programação do Cronograma" : v.baseOrigem === "DESPACHO" ? "DT despacho" : "hoje"} {dBR(v.base)}{v.atrasado ? ` (${v.reprogramar === "PCP" ? "programação" : "entrega"} vencida: previsão conta de hoje até reprogramar)` : ""}
                  </div>
                )}
                {p.obs && <div className="text-[11px] mb-2 px-2 py-1 rounded" style={{ background: C.yellowSoft, color: C.text }}><b>Obs. do pedido:</b> {p.obs}</div>}
                <table className="w-full text-xs">
                  <tbody>
                    {v.entradaTitulos.map((t) => (
                      <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1">Entrada lançada <span style={{ color: C.sub }}>· contas a receber · {t.status === "PAGO" ? "recebida" : "em aberto"}</span></td><td className="py-1 text-center">{dBR(t.vencimento)}</td><td className="py-1 text-right tabular-nums" style={{ color: C.sub }}>{brl(t.valor)}</td></tr>
                    ))}
                    {v.parcelas.map((x, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: x.data.slice(0, 7) === comp ? C.greenSoft : undefined }}>
                        <td className="py-1">{x.tipo === "ENTRADA" ? <span style={{ color: C.accent }}>Entrada a lançar</span> : `Parcela ${x.n}/${x.de} · ${x.dias} dias`}</td>
                        <td className="py-1 text-center">{dBR(x.data)}</td>
                        <td className="py-1 text-right tabular-nums font-semibold">{brl(x.valor)}</td>
                      </tr>
                    ))}
                    {!v.parcelas.length && !v.entradaTitulos.length && <tr><td className="py-1" style={{ color: C.sub }}>Nada a prever.</td></tr>}
                  </tbody>
                </table>
                <div className="flex flex-wrap gap-2 mt-3">
                  {p.status === "ANDAMENTO" && v.parcelas.some((x) => x.pendente) && <Botao cor={C.accent} onClick={() => lancarEntrada(p)}><Receipt size={12} /> Lançar entrada no contas a receber</Botao>}
                  <Botao cor={C.sub} onClick={() => salvar(p.id, { interno: !p.interno })}>{p.interno ? "Não é interno (gera contas)" : "Interno (não gera contas)"}</Botao>
                  {p.status === "ANDAMENTO" && !p.interno && <Botao cor={C.green} onClick={() => { const nf = prompt("Nº da NF do faturamento:", p.nfSugerida?.numero || ""); if (nf !== null) salvar(p.id, { status: "FATURADO", nfNumero: nf, faturadoEm: p.nfSugerida?.emissao }); }}><CheckCircle2 size={12} /> Marcar faturado{p.nfSugerida ? ` (NF ${p.nfSugerida.numero}?)` : ""}</Botao>}
                  {p.status === "ANDAMENTO" && <Botao cor={C.sub} onClick={() => confirm(`Cancelar o pedido ${p.numero}?`) && salvar(p.id, { status: "CANCELADO" })}><X size={12} /> Cancelado</Botao>}
                  {p.status !== "ANDAMENTO" && <Botao cor={C.navy} onClick={() => salvar(p.id, { status: "ANDAMENTO" })}><Undo2 size={12} /> Voltar para andamento</Botao>}
                  <Botao cor={C.red} onClick={() => excluir(p)}><Trash2 size={12} /> Excluir</Botao>
                </div>
              </div>
              {/* itens */}
              <div className="rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <b className="text-xs" style={{ color: C.navy }}>Itens</b>
                <table className="w-full text-xs mt-1">
                  <thead><tr style={{ color: C.sub }}>{["Código", "Produto", "Grade", "Qtd", "Preço", "Total"].map((h) => <th key={h} className="py-1 font-semibold text-center">{h}</th>)}</tr></thead>
                  <tbody>
                    {(p.itens || []).map((it, i) => (
                      <React.Fragment key={i}>
                        <tr style={{ borderTop: `1px solid ${C.line}` }}>
                          <td className="py-1 text-center whitespace-nowrap" style={{ color: C.sub }}>{it.codigo || "—"}</td>
                          <td className="py-1">{it.descricao}{it.op && <span style={{ color: C.sub }}> · OP {it.op}</span>}</td>
                          <td className="py-1 text-center whitespace-nowrap" style={{ color: C.sub }}>{(it.grade || []).filter((g) => g.qtd).map((g) => `${g.tam} ${g.qtd}`).join(" · ")}</td>
                          <td className="py-1 text-center tabular-nums">{it.qtd}</td>
                          <td className="py-1 text-center tabular-nums">{it.preco != null ? brl(it.preco) : "—"}</td>
                          <td className="py-1 text-center tabular-nums font-semibold">{it.total != null ? brl(it.total) : "—"}</td>
                        </tr>
                        {it.parametros?.length > 0 && (
                          <tr><td></td><td colSpan={5} className="pb-1.5 text-[10px]" style={{ color: C.sub }}>
                            {it.parametros.filter((x) => x.v).map((x) => <span key={x.t} className="mr-3"><b>{x.t}:</b> {x.v}</span>)}
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {!p.temPp && <div className="text-[11px] mt-2" style={{ color: C.yellow }}>Sem PP: suba a ordem de produção para ver os dados de produção.</div>}
                {/* v376 — avisos e faturamento completos (na linha ficam resumidos) */}
                {(v.reprogramar || v.pronto || p.interno || p.vendedor || (Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length) || p.nfNumero) && (
                  <div className="mt-3 pt-2 text-[11px] grid gap-0.5" style={{ borderTop: `1px solid ${C.line}`, color: C.sub }}>
                    <b className="text-xs" style={{ color: C.navy }}>Situação</b>
                    <div>{p.cliente}{p.vendedor ? ` · vendedor ${p.vendedor}` : ""}</div>
                    {v.reprogramar && <div className="font-bold" style={{ color: C.red }}>⚠ {v.reprogramar === "PCP" ? "Programação vencida — reprogramar no PCP" : "Entrega vencida — programar no PCP"}</div>}
                    {v.pronto && !p.interno && <div className="font-bold" style={{ color: C.green }}>✓ Concluído no PCP — faturar</div>}
                    {p.interno && <div className="font-bold">Interno · NORT — não gera contas</div>}
                    {p.nfNumero && <div>NF: <b style={{ color: C.text }}>{p.nfNumero}</b>{p.faturadoEm ? ` · faturado em ${dBR(p.faturadoEm)}` : ""}</div>}
                    {Array.isArray(p.nfsFaturadas) && p.nfsFaturadas.length > 0 && (
                      <table className="w-full mt-1"><tbody>{p.nfsFaturadas.map((n, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                          <td className="py-0.5 font-semibold" style={{ color: C.text }}>NF {n.numero}</td><td className="py-0.5">{dBR(n.emissao)}</td>
                          <td className="py-0.5 text-right">{n.pecas} pç</td><td className="py-0.5 text-right tabular-nums">{moeda(n.valor)}</td>
                          <td className="py-0.5 text-right text-[10px]">{n.modo === "PCP" ? "pelos produtos do PCP" : n.modo === "PECAS" ? "pelas peças" : "pelos itens do PV"}</td>
                        </tr>))}
                        <tr style={{ borderTop: `1px solid ${C.line}` }}><td colSpan={5} className="py-0.5 font-semibold" style={{ color: C.yellow }}>Falta faturar: {p.qtEntregar ?? "?"} peça(s) · {moeda(p.vlEntregar)}</td></tr>
                      </tbody></table>
                    )}
                  </div>
                )}
                {/* v317 — programação do Cronograma */}
                <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                  <b className="text-xs" style={{ color: C.navy }}>Cronograma PCP</b>
                  {!p.cronoEm ? <div className="text-[11px]" style={{ color: C.sub }}>Ainda não lido.</div> : (
                    <>
                      <div className="text-[11px] mt-0.5" style={{ color: C.sub }}>
                        {p.cronoSituacao || "—"}{p.cronoEtapa ? ` · etapa ${p.cronoEtapa}` : ""}
                        {p.cronoFimProgramado && <> · fim programado <b style={{ color: C.text }}>{dBR(p.cronoFimProgramado)}</b></>}
                        {p.cronoPrazo && <> · prazo <b style={{ color: C.text }}>{dBR(p.cronoPrazo)}</b></>}
                        {p.despacho && <> · DT despacho PV {dBR(p.despacho)}</>}
                      </div>
                      {(p.cronoItens || []).length > 0 && (() => {   /* v353 — peças = campo pecas (complemento não conta) */
                        const pc = p.cronoItens.reduce((s, c) => s + (c.pecas ?? c.qtd ?? 0), 0);
                        const corte = p.cronoItens.reduce((s, c) => s + (c.qtdCorte ?? c.qtd ?? 0), 0);
                        const agr = /AGRUPADO NA OP/.test(p.cronoSituacao || "");
                        const dif = !agr && p.qtd && pc && Number(p.qtd) !== pc;
                        return <div className="text-[11px] mt-0.5" style={{ color: dif ? C.red : C.sub }}>
                          PCP: <b>{pc.toLocaleString("pt-BR")}</b> peças{corte !== pc ? ` · ${corte.toLocaleString("pt-BR")} a cortar (com complementos)` : ""}
                          {p.qtd ? ` · PV ${Number(p.qtd).toLocaleString("pt-BR")}` : ""}{dif ? " — quantidade diferente, conferir item a item" : ""}{agr ? " · peças da OP inteira (agrupamento)" : ""}
                        </div>;
                      })()}
                      {(p.cronoItens || []).length > 0 && (
                        <table className="w-full text-[11px] mt-1">
                          <tbody>{p.cronoItens.map((c, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                              <td className="py-0.5" style={{ color: C.sub }}>{c.itemCode}</td><td className="py-0.5">{c.produto}{c.complemento ? <span style={{ color: C.sub }}> (complemento)</span> : ""}</td>
                              <td className="py-0.5 text-center" title={c.complemento ? `complemento: ${c.qtdCorte ?? ""} a cortar, não conta como peça` : ""}>{c.complemento ? <span style={{ color: C.sub }}>corte {c.qtdCorte || ""}</span> : (c.pecas ?? c.qtd) || ""}</td><td className="py-0.5 text-center">{c.situacao}{c.etapa ? ` · ${c.etapa}` : ""}</td>
                              <td className="py-0.5 text-center">{c.fimProgramado ? `fim ${dBR(c.fimProgramado)}` : c.entrega ? `entrega ${dBR(c.entrega)}` : "—"}</td>
                            </tr>))}</tbody>
                        </table>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Kpi({ t, v, s, cor, onClick, ativo }) {
  return (
    <div onClick={onClick} title={onClick ? "Clique para ver os pedidos deste card" : undefined} className={`rounded-xl px-3 py-2.5 ${onClick ? "cursor-pointer hover:shadow-sm" : ""}`}
      style={{ background: ativo ? C.accentSoft : C.panel, border: `1px solid ${ativo ? C.accent : C.line}`, borderLeft: `3px solid ${cor}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: C.sub }}>{t}</div>
      <div className="font-bold whitespace-nowrap tabular-nums" style={{ color: cor, fontSize: "clamp(14px, 1.15vw, 18px)" }}>{v}</div>
      {s && <div className="text-[10px]" style={{ color: C.sub }}>{s}</div>}
    </div>
  );
}
const Aviso = ({ cor, bg, children, onClick, ativo }) => <span onClick={onClick} title={onClick ? "Clique para ver estes pedidos" : undefined}
  className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
  style={{ color: cor, background: bg, outline: ativo ? `2px solid ${cor}` : "none" }}><AlertTriangle size={11} /> {children}</span>;
const Botao = ({ cor, onClick, children }) => <button onClick={onClick} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ color: cor, border: `1px solid ${cor}`, background: C.panel }}>{children}</button>;
