"use client";
// v1003 — Dados › Artes e layouts: layouts, artes de personalização e mockups do designer, guardados no Google Drive
import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Upload, RefreshCw, ExternalLink, Download, Eye, Trash2, Settings, CheckCircle2, AlertTriangle, Copy, Cloud, HardDrive } from "lucide-react";
import { BuscaLista, SEL_BRANCO, THEAD } from "./listaPadrao";
import { subirArquivo } from "@/lib/arquivosCliente";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE",
  red: "#D92D20", redSoft: "#FDECEA", yellow: "#C08401", yellowSoft: "#FFF6DD", navy: "#001E41", blue: "#2E7CD6", blueSoft: "#EAF2FC" };
const TIPOS = [["LAYOUT", "Layout"], ["ARTE", "Arte de personalização"], ["MOCKUP", "Mockup"], ["OUTRO", "Outro"]];
const ORIG = { TAREFA: "Tarefa do designer", PP_ITEM: "Item do pedido", MANUAL: "Enviado aqui" };
const ST = { ENVIADO: ["No Drive", C.green, C.greenSoft], PENDENTE: ["Aguardando envio", C.yellow, C.yellowSoft], ERRO: ["Erro", C.red, C.redSoft], LOCAL: ["No servidor (grande)", C.blue, C.blueSoft] };
const tam = (n) => (!n ? "—" : n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const dh = (s) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ArtesLayouts({ user }) {
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [origem, setOrigem] = useState("");
  const [ocup, setOcup] = useState("");
  const [novo, setNovo] = useState({ tipo: "ARTE", pedidoNumero: "", cliente: "", item: "" });
  const [sobre, setSobre] = useState(false);
  const carregar = () => fetch(`/api/artes?u=${user.id}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ error: e.message }));
  useEffect(() => { carregar(); }, []);
  const post = async (corpo) => { const r = await fetch("/api/artes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...corpo }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `Erro ${r.status}`); return j; };
  const sincronizar = async () => { setOcup("sinc"); try { const j = await post({ acao: "sincronizar" }); if (j.semConfig) alerta("Configure o Google Drive primeiro."); } catch (e) { alerta(e.message); } setOcup(""); carregar(); };
  const enviar = async (fs) => {
    fs = [...(fs || [])]; if (!fs.length) return;
    setOcup("env");
    for (const f of fs) {
      try { const b = await subirArquivo(f, user.id); await post({ acao: "enviar", nome: f.name, mime: f.type || null, base64: b, ...novo }); }
      catch (e) { await alerta(`${f.name}: ${e.message}`); }
    }
    setOcup(""); carregar();
  };
  const sem = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const lista = useMemo(() => (d?.itens || []).filter((x) => (!tipo || x.tipo === tipo) && (!origem || x.origem === origem)
    && (!q.trim() || sem(`${x.nome} ${x.pedidoNumero} ${x.cliente} ${x.item} ${x.criadoPorNome}`).includes(sem(q).trim()))), [d, q, tipo, origem]);
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  const R = d.resumo || {}, K = d.config || {};
  const url = (x, inline) => `/api/artes?u=${user.id}&baixar=${x.id}${inline ? "&inline=1" : ""}`;
  return (
    <div>
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        <div className="flex-1 min-w-[280px]">
          <div className="text-sm" style={{ color: C.sub }}>Todo layout, arte de personalização e mockup feito pelo designer fica guardado no <b>Google Drive</b> da empresa, numa pasta por pedido — o sistema não fica pesado.
            Entram sozinhos os arquivos das tarefas de layout/arte e o layout de cada item dos pedidos; aqui também dá para enviar à mão.</div>
          <div className="text-xs mt-1 flex items-center gap-2 flex-wrap" style={{ color: C.sub }}>
            {K.configurado ? <span className="flex items-center gap-1 font-semibold" style={{ color: C.green }}><Cloud size={13} /> Google Drive conectado{K.pastaNome ? ` · pasta "${K.pastaNome}"` : ""}</span>
              : <span className="flex items-center gap-1 font-semibold" style={{ color: C.yellow }}><AlertTriangle size={13} /> Google Drive ainda não conectado — os arquivos ficam aguardando</span>}
            <a href={`https://drive.google.com/drive/folders/${K.pasta}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold" style={{ color: C.blue }}><ExternalLink size={12} /> abrir a pasta no Drive</a>
            <span>· {R.ENVIADO || 0} no Drive · {R.PENDENTE || 0} aguardando{R.ERRO ? ` · ${R.ERRO} com erro` : ""}{R.LOCAL ? ` · ${R.LOCAL} grandes no servidor` : ""}</span>
          </div>
        </div>
        <button onClick={sincronizar} disabled={!!ocup} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.accent}`, background: C.panel, color: C.accent }}>
          {ocup === "sinc" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Enviar pendentes agora</button>
      </div>

      {!K.configurado && d.master && <div className="rounded-lg px-3 py-2 mb-3 text-xs flex items-center gap-2" style={{ background: C.yellowSoft, color: C.text }}><Settings size={13} style={{ color: C.yellow }} /> A conexão com o Google Drive fica em <b>Dados › Integrações › Artes e layouts</b>.</div>}

      {/* envio manual */}
      <div onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setSobre(true); } }} onDragLeave={() => setSobre(false)}
        onDrop={(e) => { e.preventDefault(); setSobre(false); enviar(e.dataTransfer?.files); }}
        className="rounded-lg p-3 mb-3 flex items-end gap-2 flex-wrap" style={{ background: sobre ? C.accentSoft : C.panel, border: `1.5px dashed ${sobre ? C.accent : C.line}` }}>
        <label className="text-xs" style={{ color: C.sub }}>Tipo<select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} className="block mt-1 px-2 py-1.5 rounded text-sm outline-none" style={SEL_BRANCO}>{TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="text-xs" style={{ color: C.sub }}>Pedido (opcional)<input value={novo.pedidoNumero} onChange={(e) => setNovo({ ...novo, pedidoNumero: e.target.value })} placeholder="26115041" className="block mt-1 px-2 py-1.5 rounded text-sm outline-none w-32" style={SEL_BRANCO} /></label>
        <label className="text-xs" style={{ color: C.sub }}>Cliente (opcional)<input value={novo.cliente} onChange={(e) => setNovo({ ...novo, cliente: e.target.value })} className="block mt-1 px-2 py-1.5 rounded text-sm outline-none w-56" style={SEL_BRANCO} /></label>
        <label className="text-xs flex-1 min-w-[160px]" style={{ color: C.sub }}>Descrição (opcional)<input value={novo.item} onChange={(e) => setNovo({ ...novo, item: e.target.value })} placeholder="ex.: camisa polo — frente" className="block mt-1 px-2 py-1.5 rounded text-sm outline-none w-full" style={SEL_BRANCO} /></label>
        <label className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: C.accent, color: "#fff" }}>
          {ocup === "env" ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {ocup === "env" ? "Enviando…" : "Enviar artes"}
          <input type="file" multiple className="hidden" disabled={!!ocup} onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; enviar(fs); }} /></label>
        <span className="text-[11px] w-full" style={{ color: C.sub }}>ou arraste os arquivos aqui · até 35 MB por arquivo</span>
      </div>

      <div className="flex items-end gap-2 mb-2 flex-wrap">
        <BuscaLista value={q} onChange={setQ} placeholder="Pedido, cliente, nome do arquivo, item…" />
        <label className="text-xs" style={{ color: C.sub }}>Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value)} className="block mt-1 px-2 py-1.5 rounded text-sm outline-none" style={SEL_BRANCO}><option value="">Todos</option>{TIPOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className="text-xs" style={{ color: C.sub }}>Origem<select value={origem} onChange={(e) => setOrigem(e.target.value)} className="block mt-1 px-2 py-1.5 rounded text-sm outline-none" style={SEL_BRANCO}><option value="">Todas</option>{Object.entries(ORIG).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
      </div>
      <div className="text-xs mb-2" style={{ color: C.sub }}>{lista.length} de {(d.itens || []).length} arquivo(s) · clique no título para ordenar</div>
      <div className="rounded-lg overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm">
          <thead className="text-xs" style={THEAD}><tr>
            {["Data", "Tipo", "Arquivo", "Pedido", "Cliente", "Item / tarefa", "Origem", "Tamanho", "Situação"].map((h) => <th key={h} className={`px-3 py-2 font-semibold whitespace-nowrap ${h === "Tamanho" ? "text-right" : "text-left"}`}>{h}</th>)}<th className="px-3 py-2" />
          </tr></thead>
          <tbody>
            {!lista.length && <tr><td colSpan={10} className="px-3 py-8 text-center text-sm" style={{ color: C.sub }}>Nenhuma arte {q || tipo || origem ? "neste filtro" : "ainda"}.</td></tr>}
            {lista.slice(0, 1000).map((x) => { const [st, cor, fundo] = ST[x.status] || ST.PENDENTE; return (
              <tr key={x.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 text-xs whitespace-nowrap tabular-nums" style={{ color: C.sub }}>{dh(x.createdAt)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap">{(TIPOS.find((t) => t[0] === x.tipo) || [, x.tipo])[1]}</td>
                <td className="px-3 py-2" style={{ maxWidth: 320 }}><a href={url(x, true)} target="_blank" rel="noreferrer" className="block truncate font-semibold" style={{ color: C.navy }} title={x.nome}>{x.nome}</a>
                  {x.criadoPorNome && <div className="text-[11px]" style={{ color: C.sub }}>{x.criadoPorNome}</div>}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap tabular-nums font-semibold">{x.pedidoNumero || "—"}</td>
                <td className="px-3 py-2 text-xs" style={{ color: C.sub, maxWidth: 220 }}><div className="truncate" title={x.cliente || ""}>{x.cliente || "—"}</div></td>
                <td className="px-3 py-2 text-xs" style={{ color: C.sub, maxWidth: 260 }}><div className="truncate" title={x.item || ""}>{x.item || "—"}</div></td>
                <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: C.sub }}>{ORIG[x.origem] || x.origem}</td>
                <td className="px-3 py-2 text-xs text-right whitespace-nowrap tabular-nums" style={{ color: C.sub }}>{tam(x.tamanho)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap"><span className="px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{ color: cor, background: fundo }} title={x.erro || (x.enviadoEm ? `enviado ${dh(x.enviadoEm)}` : "")}>
                  {x.status === "ENVIADO" ? <CheckCircle2 size={11} /> : x.status === "LOCAL" ? <HardDrive size={11} /> : x.status === "ERRO" ? <AlertTriangle size={11} /> : null}{st}</span></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <a href={url(x, true)} target="_blank" rel="noreferrer" title="Abrir" className="inline-flex p-1" style={{ color: C.sub }}><Eye size={14} /></a>
                  <a href={url(x)} title="Baixar" className="inline-flex p-1" style={{ color: C.blue }}><Download size={14} /></a>
                  {x.driveLink && <a href={x.driveLink} target="_blank" rel="noreferrer" title="Abrir no Google Drive" className="inline-flex p-1" style={{ color: C.green }}><ExternalLink size={14} /></a>}
                  {x.origem === "MANUAL" && <button title="Excluir" className="inline-flex p-1" style={{ color: C.red }} onClick={async () => { if (!(await confirmar(`Excluir ${x.nome}? No Drive ele vai para a lixeira.`))) return; try { await post({ acao: "excluir", id: x.id }); carregar(); } catch (e) { alerta(e.message); } }}><Trash2 size={14} /></button>}
                </td>
              </tr>); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfigDrive({ K, post, onSalvo }) {
  const [url, setUrl] = useState(K.url || "");
  const [ocup, setOcup] = useState(false);
  const [msg, setMsg] = useState(null);
  const salvarTestar = async () => {
    setOcup(true); setMsg(null);
    try { await post({ acao: "config", url }); const t = await post({ acao: "testar" }); setMsg({ ok: true, t: `Conectado à pasta "${t.pasta}". Os arquivos começam a subir em instantes.` }); post({ acao: "sincronizar" }).catch(() => null); onSalvo(); }
    catch (e) { setMsg({ ok: false, t: e.message }); }
    setOcup(false);
  };
  return (
    <div className="rounded-lg p-4 mb-3 text-sm" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="font-bold mb-2" style={{ color: C.navy }}>Conectar o Google Drive (uma vez só, na conta Google dona da pasta)</div>
      <ol className="list-decimal pl-5 space-y-1 text-xs" style={{ color: C.text }}>
        <li>Abra o projeto no <a href="https://script.google.com/home" target="_blank" rel="noreferrer" style={{ color: C.blue }}>script.google.com</a> (ou crie um novo), apague tudo do <b>Código.gs</b>, cole o código abaixo e salve (Ctrl+S).</li>
        <li>Clique em <b>Implantar → Nova implantação</b> → engrenagem → <b>App da Web</b> · Executar como: <b>Eu</b> · Quem pode acessar: <b>Qualquer pessoa</b> (não "Qualquer pessoa em Meridian") → <b>Implantar</b> e autorize o acesso ao Drive (em "app não verificado": Avançado → Acessar).</li>
        <li>Copie o <b>URL do app da Web</b> (termina em <code>/exec</code>), cole aqui e clique em <b>Salvar e testar</b>.</li>
      </ol>
      <div className="relative mt-2">
        <textarea readOnly value={K.script || ""} rows={8} className="w-full px-2 py-1.5 rounded text-[11px] font-mono" style={{ border: `1px solid ${C.line}`, background: "#FAFBFC", color: C.text }} />
        <button onClick={() => navigator.clipboard?.writeText(K.script || "").then(() => setMsg({ ok: true, t: "Código copiado." }))} className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{ background: C.accent, color: "#fff" }}><Copy size={12} /> copiar código</button>
      </div>
      <div className="text-[11px] mt-1" style={{ color: C.sub }}>O código já leva a pasta da empresa e uma senha própria deste sistema — não compartilhe o código nem o URL.</div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" className="flex-1 min-w-[300px] px-2 py-1.5 rounded text-sm outline-none" style={SEL_BRANCO} />
        <button onClick={salvarTestar} disabled={ocup || !url.trim()} className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: ocup || !url.trim() ? 0.6 : 1 }}>{ocup && <Loader2 size={14} className="animate-spin" />} Salvar e testar</button>
      </div>
      {msg && <div className="text-xs mt-2 font-semibold" style={{ color: msg.ok ? C.green : C.red }}>{msg.t}</div>}
    </div>
  );
}

// v1039 — Dados › Integrações › Artes e layouts: a conexão com o Google Drive (só master)
export function IntegracaoArtes({ user }) {
  const [d, setD] = useState(null);
  const carregar = () => fetch(`/api/artes?u=${user.id}`, { cache: "no-store" }).then((r) => r.json()).then(setD).catch((e) => setD({ error: e.message }));
  useEffect(() => { carregar(); }, []);
  const post = async (corpo) => { const r = await fetch("/api/artes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, ...corpo }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || `Erro ${r.status}`); return j; };
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Carregando…</div>;
  if (d.error) return <div className="text-sm" style={{ color: C.red }}>{d.error}</div>;
  if (!d.master) return <div className="text-sm" style={{ color: C.sub }}>Só o master configura o Google Drive.</div>;
  const R = d.resumo || {}, K = d.config || {};
  return (
    <div>
      <div className="text-sm mb-2" style={{ color: C.sub }}>Layouts, artes e mockups vão para o <b>Google Drive</b> da empresa, numa pasta por pedido. A lista dos arquivos fica em <b>Dados › Artes e layouts</b>.</div>
      <div className="text-xs mb-3 flex items-center gap-2 flex-wrap" style={{ color: C.sub }}>
        {K.configurado ? <span className="flex items-center gap-1 font-semibold" style={{ color: C.green }}><Cloud size={13} /> Conectado{K.pastaNome ? ` · pasta "${K.pastaNome}"` : ""}{K.testadoEm ? ` · testado em ${dh(K.testadoEm)}` : ""}</span>
          : <span className="flex items-center gap-1 font-semibold" style={{ color: C.yellow }}><AlertTriangle size={13} /> Ainda não conectado — os arquivos ficam aguardando</span>}
        <a href={`https://drive.google.com/drive/folders/${K.pasta}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold" style={{ color: C.blue }}><ExternalLink size={12} /> abrir a pasta no Drive</a>
        <span>· {R.ENVIADO || 0} no Drive · {R.PENDENTE || 0} aguardando{R.ERRO ? ` · ${R.ERRO} com erro` : ""}{R.LOCAL ? ` · ${R.LOCAL} grandes no servidor` : ""}</span>
      </div>
      <ConfigDrive K={K} post={post} onSalvo={carregar} />
    </div>
  );
}
