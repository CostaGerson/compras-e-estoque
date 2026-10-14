"use client";
// v209 — OS do KM (fechamento de facção) → fechamento de terceirizados da semana
import React, { useState, useEffect, useMemo } from "react";
import { Loader2, ClipboardList, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { PrestadorModal } from "./prestadores";
import { ModalContas as Modal, CoresContas as C } from "./contas";

const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const inp = "w-full rounded px-2 py-1.5 text-xs outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
// sexta de pagamento: recebimento + prazo → a primeira sexta a partir do vencimento
function sextaDe(receb, prazo) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receb || "")) return null;
  const d = new Date(`${receb}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + (Number(prazo) || 0));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function OsKmModal({ user, arquivos: files, onClose, onSalvo }) {
  const [st, setSt] = useState("Lendo as OS…");
  const [erro, setErro] = useState("");
  const [d, setD] = useState(null);
  const [arqs, setArqs] = useState([]);
  const [linhas, setLinhas] = useState([]);   // por OS: { ...item, marcado, prestadorId, tipo, chavePix }
  const [receb, setReceb] = useState("");
  const [novo, setNovo] = useState(null);   // linha que abriu o cadastro de terceirizado

  useEffect(() => {
    (async () => {
      try {
        const a = [];
        for (const f of files || []) a.push({ nome: f.name, conteudo: await readB64(f) });
        setArqs(a);
        const j = await api("/api/fin/os", "POST", { usuarioId: user.id, acao: "analisar", arquivos: a });
        setD(j);
        setLinhas(j.itens.map((it) => ({ ...it, marcado: !it.erro && it.ok, tipo: it.os?.tipo || "", prestadorId: it.prestadorId || "", chavePix: it.chavePix || "" })));
      } catch (e) { setErro(e.message); }
      setSt("");
    })();
  }, []);

  const alt = (i, k, v) => setLinhas((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const prest = (id) => (d?.prestadores || []).find((p) => p.id === Number(id));
  const marcadas = linhas.filter((x) => x.marcado && !x.erro);
  const pendente = marcadas.find((x) => !x.prestadorId || !x.tipo || !String(x.chavePix || prest(x.prestadorId)?.chavePix || "").trim());
  const total = marcadas.reduce((s, x) => s + x.total, 0);

  const aplicar = async () => {
    setErro(""); setSt("Lançando…");
    try {
      const r = await api("/api/fin/os", "POST", { usuarioId: user.id, acao: "aplicar", dataRecebimento: receb, arquivos: arqs,
        itens: marcadas.map((x) => ({ arquivo: x.arquivo, os: x.os, prestadorId: Number(x.prestadorId), tipo: x.tipo, qtd: x.qtd, unitario: x.unitario, chavePix: x.chavePix })) });
      onSalvo(`OS lançadas: ${r.lancadas} · R$ ${brl(r.valor)}. ${r.linhas.join(" · ")}${r.erros.length ? ` · Erros: ${r.erros.join("; ")}` : ""}`);
    } catch (e) { setErro(e.message); setSt(""); }
  };

  return (
    <Modal titulo="Ordem de serviço (KM) → fechamento de terceirizados" icone={ClipboardList} onClose={onClose} largura={1180}
      rodape={d ? <>
        <span className="text-xs mr-auto" style={{ color: C.sub }}>{marcadas.length} OS · <b style={{ color: C.navy }}>R$ {brl(total)}</b>{pendente ? " · complete terceirizado, tipo de peça e PIX" : ""}</span>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <button onClick={aplicar} disabled={!!st || !marcadas.length || !receb || !!pendente} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: !marcadas.length || !receb || pendente ? C.sub : C.accent }}>{st && d && <Loader2 size={14} className="animate-spin" />} Lançar</button>
      </> : null}>
      {st && !d && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> {st}</div>}
      {erro && <div className="p-2.5 rounded-lg mb-3 text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {d && (
        <>
          <div className="flex flex-wrap items-end gap-3 mb-3 p-3 rounded-lg" style={{ background: receb ? C.panel2 : C.yellowSoft }}>
            <label className="text-xs font-semibold" style={{ color: C.navy }}>Data de recebimento do serviço
              <input type="date" value={receb} onChange={(e) => setReceb(e.target.value)} max={hojeISO()} className="block rounded px-2 py-1.5 text-sm mt-1" style={{ ...inpS, borderColor: receb ? C.line : C.yellow }} />
            </label>
            <div className="text-xs pb-2" style={{ color: C.sub }}>Vencimento = recebimento + prazo do cadastro do terceirizado (vazio = 0). O pagamento cai na primeira sexta a partir do vencimento. Várias OS do mesmo terceirizado viram um lançamento com uma linha por OS.</div>
          </div>
          <div className="overflow-auto rounded-lg" style={{ border: `1px solid ${C.line}`, maxHeight: "60vh" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: C.panel2 }}><tr style={{ color: C.sub }}>
                {["", "OS", "Terceirizado", "Pedido / peça", "Tipo de peça", "Qtd × unit.", "Total", "Pagamento", "Avisos"].map((h) => <th key={h} className="px-2 py-2 text-left font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>{linhas.map((x, i) => {
                if (x.erro) return <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}><td /><td className="px-2 py-1.5" colSpan={8} style={{ color: C.red }}>{x.arquivo}: {x.erro}</td></tr>;
                const p = prest(x.prestadorId);
                const sx = sextaDe(receb, p?.prazoDias ?? 0);
                return (
                  <tr key={i} style={{ borderTop: `1px solid ${C.line}`, opacity: x.marcado ? 1 : 0.5 }}>
                    <td className="px-2 py-1.5"><input type="checkbox" checked={!!x.marcado} disabled={!x.ok} onChange={(e) => alt(i, "marcado", e.target.checked)} /></td>
                    <td className="px-2 py-1.5"><b style={{ color: C.navy }}>{x.os.nr}</b><div style={{ color: C.sub }}>{dBR(x.os.dataOs)} · {x.os.servico || "—"}</div></td>
                    <td className="px-2 py-1.5" style={{ minWidth: 190 }}>
                      <div style={{ color: C.sub }}>KM: {x.os.prestador}</div>
                      <div className="flex items-center gap-1">
                        <select value={x.prestadorId} onChange={(e) => { alt(i, "prestadorId", e.target.value); alt(i, "chavePix", prest(e.target.value)?.chavePix || ""); }} className={inp} style={{ ...inpS, borderColor: x.prestadorId ? C.line : C.yellow }}>
                          <option value="">— escolha —</option>
                          {d.prestadores.map((q) => <option key={q.id} value={q.id}>{q.nome}{q.nomeKm ? ` (KM ${q.nomeKm})` : ""}</option>)}
                        </select>
                        <button type="button" onClick={() => setNovo(x)} title="Cadastrar terceirizado novo" className="shrink-0 flex items-center justify-center rounded"
                          style={{ width: 26, height: 26, background: C.accent, color: "#fff" }}><Plus size={14} /></button>
                      </div>
                      {x.prestadorId && !String(p?.chavePix || "").trim() && <input value={x.chavePix} onChange={(e) => alt(i, "chavePix", e.target.value)} placeholder="CHAVE PIX (vai para o cadastro)" className={`${inp} mt-1`} style={{ ...inpS, borderColor: x.chavePix ? C.line : C.yellow }} />}
                    </td>
                    <td className="px-2 py-1.5" style={{ maxWidth: 260 }}><b>{x.os.pedido}</b>{x.os.itemPedido ? ` · item ${x.os.itemPedido}` : ""}<div className="truncate" style={{ color: C.sub }} title={`${x.os.cliente} - ${x.os.peca}`}>{x.os.cliente} · {x.os.peca}</div></td>
                    <td className="px-2 py-1.5" style={{ minWidth: 150 }}>
                      <select value={x.tipo} onChange={(e) => alt(i, "tipo", e.target.value)} className={inp} style={{ ...inpS, borderColor: x.tipo ? C.line : C.yellow }}>
                        <option value="">—</option>
                        {d.tipos.map((t) => <option key={t.k} value={t.k}>{t.n}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{x.qtd} × {brl(x.unitario)}{x.jaLancado ? <div style={{ color: C.sub }}>já lançadas {x.jaLancado}</div> : null}</td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{brl(x.total)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{sx ? <>sexta {dBR(sx)}<div style={{ color: C.sub }}>prazo {p?.prazoDias ?? 0} dia(s)</div></> : <span style={{ color: C.sub }}>informe o recebimento</span>}</td>
                    <td className="px-2 py-1.5" style={{ maxWidth: 260 }}>
                      {x.avisos.length ? x.avisos.map((a, k) => <div key={k} className="flex gap-1" style={{ color: C.yellow }}><AlertTriangle size={11} className="shrink-0 mt-0.5" /> {a}</div>)
                        : <span className="flex items-center gap-1" style={{ color: C.green }}><CheckCircle2 size={12} /> ok</span>}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </>
      )}
      {novo && (
        <PrestadorModal user={user} tipo="TERCEIRIZADO" nomeSugerido={novo.os.prestador} nomeKmInicial={novo.os.prestador}
          servicosIniciais={novo.tipo ? [`FACCAO:${novo.tipo}`] : []} catalogo={d.catalogoCadastro || []}
          onClose={() => setNovo(null)}
          onSalvo={(j) => {
            const p = j.prestador;
            setD((x) => ({ ...x, prestadores: [...x.prestadores.filter((q) => q.id !== p.id), { id: p.id, nome: p.nome, nomeKm: p.nomeKm, chavePix: p.chavePix, prazoDias: p.prazoDias ?? 0 }].sort((a, b) => a.nome.localeCompare(b.nome)) }));
            // todas as OS com esse mesmo nome no KM (ainda sem terceirizado) passam a usar o cadastro novo
            setLinhas((l) => l.map((y) => (y.os && !y.prestadorId && y.os.prestador === novo.os.prestador ? { ...y, prestadorId: p.id, chavePix: p.chavePix || "" } : y)));
            setNovo(null);
          }} />
      )}
    </Modal>
  );
}
