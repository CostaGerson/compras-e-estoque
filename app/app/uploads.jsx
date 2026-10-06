"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Search, Loader2, Trash2, Download, HardDriveDownload, RefreshCw, FolderUp, AlertTriangle } from "lucide-react";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC",
  text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };
const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const dtHora = (s) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const kb = (n) => (!n ? "—" : n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
};
// o que acontece ao excluir, por origem
const EFEITO = {
  ARQ: "Os lançamentos lidos deste arquivo também serão apagados e o card da importação do mês volta a acusar a falta.",
  CONTAB: "O card da contabilidade do mês volta a acusar a falta.",
  ANEXO: "O anexo sai da conta. Se veio do RH, o card do calendário de obrigações volta a ficar pendente.",
  RET: "As baixas já feitas pelo retorno continuam; só o arquivo é apagado.",
};

function Backup({ user }) {
  const [b, setB] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = () => api(`/api/backup?u=${user.id}`).then(setB).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (!b?.gerando) return; const t = setInterval(carregar, 5000); return () => clearInterval(t); }, [b?.gerando]);
  const gerar = async () => { setErro(""); try { setB(await api("/api/backup", "POST", { usuarioId: user.id })); } catch (e) { setErro(e.message); } };
  return (
    <div className="rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <HardDriveDownload size={22} style={{ color: C.accent }} />
      <div className="flex-1 min-w-[260px]">
        <div className="text-sm font-bold" style={{ color: C.navy }}>Backup diário</div>
        <div className="text-xs" style={{ color: C.sub }}>
          {!b ? "Carregando…" : b.gerando ? "Gerando o backup agora… pode levar alguns minutos."
            : b.existe ? <>Último: <b style={{ color: b.data === b.hoje ? C.green : C.yellow }}>{dtHora(b.geradoEm)}</b> · {kb(b.tamanho)} · {b.registros?.toLocaleString("pt-BR")} registros · {b.arquivos} arquivos · {b.por}. Substituído todo dia, automaticamente.</>
            : "Ainda não há backup. O primeiro é gerado alguns minutos depois de o sistema subir, ou clique em Gerar agora."}
        </div>
        {(erro || b?.erro) && <div className="text-xs mt-1" style={{ color: C.red }}>{erro || `Último erro: ${b.erro}`}</div>}
      </div>
      <button onClick={gerar} disabled={!b || b.gerando} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}`, color: C.text, opacity: !b || b.gerando ? 0.5 : 1 }}>
        {b?.gerando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Gerar agora
      </button>
      <a href={b?.existe && !b.gerando ? `/api/backup?u=${user.id}&baixar=1` : undefined} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: C.accent, opacity: b?.existe && !b.gerando ? 1 : 0.5, pointerEvents: b?.existe && !b.gerando ? "auto" : "none" }}>
        <Download size={15} /> Baixar backup
      </a>
    </div>
  );
}

export default function Uploads({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [origem, setOrigem] = useState("TODAS");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [conf, setConf] = useState(null);       // documento a excluir
  const [exc, setExc] = useState(false);
  const [aviso, setAviso] = useState("");
  const carregar = () => api(`/api/uploads?u=${user.id}`).then(setD).catch((e) => setErro(e.message));
  useEffect(() => { carregar(); }, []);
  const lista = useMemo(() => {
    if (!d) return [];
    const q = semAc(busca);
    return d.itens.filter((x) => (origem === "TODAS" || x.origem === origem)
      && (!de || x.data.slice(0, 10) >= de) && (!ate || x.data.slice(0, 10) <= ate)
      && (!q || semAc(`${x.nomeSistema} ${x.nomeOriginal} ${x.usuario || ""} ${x.origemNome}`).includes(q)));
  }, [d, busca, origem, de, ate]);
  const excluir = async () => {
    setExc(true); setErro("");
    try {
      await api("/api/uploads", "DELETE", { usuarioId: user.id, id: conf.id });
      setAviso(`${conf.nomeSistema} excluído.`); setConf(null); await carregar();
    } catch (e) { setErro(e.message); }
    setExc(false);
  };
  const qtdOrigem = (k) => (d?.itens || []).filter((x) => x.origem === k).length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <FolderUp size={20} style={{ color: C.accent }} />
        <h1 className="text-lg font-bold" style={{ color: C.navy }}>Uploads</h1>
      </div>
      <div className="text-xs mb-4" style={{ color: C.sub }}>
        {d?.master ? "Todos os documentos enviados ao sistema, por qualquer usuário e por qualquer tela." : "Os documentos que você enviou ao sistema."} Só o master ou quem enviou pode excluir.
      </div>
      {d?.master && <Backup user={user} />}
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, usuário…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 240 }} />
        </div>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={inpS}>
          <option value="TODAS">Todas as origens</option>
          {d && Object.entries(d.origens).filter(([k]) => qtdOrigem(k)).map(([k, t]) => <option key={k} value={k}>{t} ({qtdOrigem(k)})</option>)}
        </select>
        <label className="text-[11px]" style={{ color: C.sub }}>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <label className="text-[11px]" style={{ color: C.sub }}>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="block rounded-lg px-2 py-1.5 text-sm outline-none" style={inpS} /></label>
        <div className="flex-1" />
        {d && <span className="text-xs" style={{ color: C.sub }}>{lista.length} de {d.itens.length} documento(s)</span>}
      </div>
      {aviso && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {erro && <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d ? <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <div className="overflow-auto rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs">
            <thead style={{ background: C.panel2 }}><tr style={{ color: C.sub }}>
              {["Upload", "Nome no sistema", "Nome do arquivo", "Origem", "Enviado por", "Tamanho", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: C.sub }}>{dtHora(x.data)}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: C.navy }}>{x.nomeSistema}</td>
                  <td className="px-3 py-2" style={{ color: C.text, maxWidth: 280 }}><div className="truncate" title={x.nomeOriginal}>{x.nomeOriginal}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.sub }}>{x.origemNome}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{x.usuario || <span style={{ color: C.sub }}>—</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums" style={{ color: C.sub }}>{kb(x.tamanho)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    <a href={`/api/uploads?u=${user.id}&id=${encodeURIComponent(x.id)}`} target="_blank" rel="noreferrer" title="Baixar / abrir" className="inline-flex p-1.5 rounded" style={{ color: C.blue }}><Download size={15} /></a>
                    {x.podeExcluir && <button onClick={() => { setAviso(""); setConf(x); }} title="Excluir" className="inline-flex p-1.5 rounded" style={{ color: C.red }}><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: C.sub }}>Nenhum documento.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {conf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={() => !exc && setConf(null)}>
          <div className="rounded-xl p-5 w-full" style={{ background: C.panel, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} style={{ color: C.red }} /><b style={{ color: C.navy }}>Excluir documento</b></div>
            <div className="text-sm mb-1 font-semibold" style={{ color: C.text }}>{conf.nomeSistema}</div>
            <div className="text-xs mb-3" style={{ color: C.sub }}>{conf.nomeOriginal} · {dtHora(conf.data)}</div>
            <div className="text-xs p-2.5 rounded-lg mb-4" style={{ background: C.redSoft, color: C.red }}>
              Não dá para desfazer. {EFEITO[conf.origem] || "O documento é removido do sistema."}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConf(null)} disabled={exc} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
              <button onClick={excluir} disabled={exc} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.red }}>
                {exc && <Loader2 size={14} className="animate-spin" />} Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
