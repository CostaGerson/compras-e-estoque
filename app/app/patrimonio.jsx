"use client";
// v368 — Financeiro › Patrimônio: bens da empresa com valores (compra e atual) e a NF de compra
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, Loader2, Paperclip, Search, Package, Save } from "lucide-react";
import { confirmar } from "./dialogo";   // v424 — popups do sistema

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41",
  accent: "#FF6B1A", accentSoft: "#FFF0E6", green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC",
  yellow: "#C08401", yellowSoft: "#FFF6DD", red: "#D92D20", redSoft: "#FDECEA",
};
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => `R$ ${brl(v)}`;
const dBR = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const lerB64 = (f) => new Promise((ok, nok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = nok; r.readAsDataURL(f); });
export const CATEGORIAS_PATRIMONIO = ["MÁQUINAS E EQUIPAMENTOS", "VEÍCULOS", "MÓVEIS E UTENSÍLIOS", "INFORMÁTICA", "IMÓVEIS", "INSTALAÇÕES", "OUTROS"];
const SIT = { ATIVO: [C.green, C.greenSoft, "Ativo"], VENDIDO: [C.blue, C.blueSoft, "Vendido"], BAIXADO: [C.sub, C.panel2, "Baixado"] };
const VAZIO = { descricao: "", categoria: "", marcaModelo: "", serie: "", local: "", aquisicao: "", valorCompra: "", valorAtual: "", situacao: "ATIVO", nfNumero: "", nfFornecedor: "", nfChave: "", obs: "" };

export default function Patrimonio({ user }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [fCat, setFCat] = useState("");
  const [fSit, setFSit] = useState("ATIVO");
  const [edit, setEdit] = useState(null);   // item em edição (novo = sem id)

  const carregar = async () => {
    setErro("");
    try {
      const r = await fetch(`/api/fin/patrimonio?u=${user.id}`); const j = await r.json();
      if (!r.ok) { setErro(j.error || "Erro ao carregar."); setItens([]); return; }
      setItens(j.itens || []);
    } catch { setErro("Falha de conexão."); setItens([]); }
  };
  useEffect(() => { carregar(); }, []);

  const lista = useMemo(() => {
    const b = busca.trim().toUpperCase();
    return (itens || []).filter((x) => (!fCat || x.categoria === fCat) && (!fSit || x.situacao === fSit)
      && (!b || `${x.descricao} ${x.marcaModelo || ""} ${x.serie || ""} ${x.local || ""} ${x.nfNumero || ""} ${x.nfFornecedor || ""}`.toUpperCase().includes(b)));
  }, [itens, busca, fCat, fSit]);
  const ativos = (itens || []).filter((x) => x.situacao === "ATIVO");
  const tot = (l, k) => l.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const porCat = useMemo(() => {
    const m = {};
    for (const x of ativos) { const k = x.categoria || "SEM CATEGORIA"; m[k] = m[k] || { qtd: 0, atual: 0 }; m[k].qtd++; m[k].atual += Number(x.valorAtual ?? x.valorCompra) || 0; }
    return Object.entries(m).sort((a, b) => b[1].atual - a[1].atual);
  }, [itens]);

  const excluir = async (x) => {
    if (!(await confirmar(`Excluir ${x.descricao} do patrimônio?`))) return;
    await fetch("/api/fin/patrimonio", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, id: x.id }) });
    carregar();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div>
          <div className="text-lg font-bold" style={{ color: C.navy }}>Patrimônio</div>
          <div className="text-xs" style={{ color: C.sub }}>Bens da empresa, valor de compra, valor atual estimado e NF de compra.</div>
        </div>
        <div className="flex-1" />
        <button onClick={() => setEdit({ ...VAZIO })} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff" }}>
          <Plus size={15} /> Novo bem
        </button>
      </div>

      {itens && (
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {[["Bens ativos", `${ativos.length}`, C.navy], ["Valor de compra (ativos)", moeda(tot(ativos, "valorCompra")), C.text],
            ["Valor atual estimado (ativos)", moeda(ativos.reduce((s, x) => s + (Number(x.valorAtual ?? x.valorCompra) || 0), 0)), C.green],
            ["Sem NF de compra", `${ativos.filter((x) => !x.nfNumero && !x.nfArquivoNome).length}`, C.yellow]].map(([t, v, c]) => (
            <div key={t} className="rounded-xl px-4 py-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{t}</div>
              <div className="text-xl font-bold mt-0.5 whitespace-nowrap tabular-nums" style={{ color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {porCat.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {porCat.map(([k, v]) => (
            <button key={k} onClick={() => setFCat(fCat === k ? "" : k)} className="px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: fCat === k ? C.accent : C.panel2, color: fCat === k ? "#fff" : C.navy }}>{k} · {v.qtd} · {moeda(v.atual)}</button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: C.panel, border: `1px solid ${C.line}`, minWidth: 260 }}>
          <Search size={14} style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar bem, série, local, NF…" className="flex-1 text-sm outline-none" />
        </div>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
          <option value="">Todas as categorias</option>{CATEGORIAS_PATRIMONIO.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fSit} onChange={(e) => setFSit(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
          <option value="">Todas as situações</option><option value="ATIVO">Ativos</option><option value="VENDIDO">Vendidos</option><option value="BAIXADO">Baixados</option>
        </select>
      </div>

      {erro && <div className="p-3 rounded mb-4" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!itens && <div style={{ color: C.sub }}><Loader2 size={16} className="animate-spin inline" /> Carregando…</div>}
      {itens && (
        <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-xs" style={{ minWidth: 980 }}>
            <thead><tr style={{ background: C.panel2, color: C.sub }}>
              {["Bem", "Categoria", "Série / placa", "Local", "Aquisição", "Valor de compra", "Valor atual", "NF de compra", "Situação", ""].map((h, i) => (
                <th key={i} className={`px-3 py-2 font-semibold ${/Valor/.test(h) ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {!lista.length && <tr><td colSpan={10} className="px-3 py-8 text-center" style={{ color: C.sub }}>
                {itens.length ? "Nenhum bem com estes filtros." : <>Nenhum bem cadastrado. Use <b>Novo bem</b> para começar.</>}</td></tr>}
              {lista.map((x) => { const [c, bg, t] = SIT[x.situacao] || SIT.ATIVO; return (
                <tr key={x.id} className="cursor-pointer hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }} onClick={() => setEdit({ ...VAZIO, ...x, valorCompra: x.valorCompra ?? "", valorAtual: x.valorAtual ?? "" })}>
                  <td className="px-3 py-2"><div className="font-semibold" style={{ color: C.text }}>{x.descricao}</div>{x.marcaModelo && <div style={{ color: C.sub }}>{x.marcaModelo}</div>}</td>
                  <td className="px-3 py-2" style={{ color: C.sub }}>{x.categoria || "—"}</td>
                  <td className="px-3 py-2" style={{ color: C.sub }}>{x.serie || "—"}</td>
                  <td className="px-3 py-2" style={{ color: C.sub }}>{x.local || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{dBR(x.aquisicao)}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{x.valorCompra != null ? brl(x.valorCompra) : "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-semibold">{x.valorAtual != null ? brl(x.valorAtual) : "—"}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {x.nfNumero ? <span>NF {x.nfNumero}{x.nfFornecedor ? <span style={{ color: C.sub }}> · {x.nfFornecedor}</span> : null}</span> : <span style={{ color: C.yellow }}>sem NF</span>}
                    {x.nfArquivoNome && <a href={`/api/fin/patrimonio?u=${user.id}&arq=${x.id}`} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center" style={{ color: C.accent }} title={x.nfArquivoNome}><Paperclip size={12} /></a>}
                  </td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full font-semibold" style={{ color: c, background: bg }}>{t}</span></td>
                  <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEdit({ ...VAZIO, ...x, valorCompra: x.valorCompra ?? "", valorAtual: x.valorAtual ?? "" })} className="mr-2" style={{ color: C.sub }} title="Editar"><Pencil size={13} /></button>
                    <button onClick={() => excluir(x)} style={{ color: C.sub }} title="Excluir"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ); })}
            </tbody>
            {lista.length > 0 && (
              <tfoot><tr style={{ borderTop: `2px solid ${C.line}`, background: C.panel2 }}>
                <td className="px-3 py-2 font-bold" style={{ color: C.navy }} colSpan={5}>{lista.length} bem(ns)</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: C.navy }}>{brl(tot(lista, "valorCompra"))}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums" style={{ color: C.navy }}>{brl(tot(lista, "valorAtual"))}</td>
                <td colSpan={3} />
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {edit && <EditarBem user={user} item={edit} onClose={() => setEdit(null)} onSalvo={() => { setEdit(null); carregar(); }} />}
    </div>
  );
}

function EditarBem({ user, item, onClose, onSalvo }) {
  const [f, setF] = useState(item);
  const [arq, setArq] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const inp = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const salvar = async () => {
    if (!String(f.descricao || "").trim()) { setErro("Informe a descrição do bem."); return; }
    setSalvando(true); setErro("");
    const corpo = { usuarioId: user.id, ...f, ...(f.id ? { id: f.id } : {}), ...(arq ? { arquivo: arq } : {}), ...(f.removerArquivo ? { removerArquivo: true } : {}) };
    const r = await fetch("/api/fin/patrimonio", { method: f.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) { setErro(j.error || "Erro ao salvar."); return; }
    onSalvo();
  };
  const campo = (k, t, props = {}) => (
    <label className="flex flex-col gap-1 text-xs"><span className="font-semibold" style={{ color: C.sub }}>{t}</span>
      <input value={f[k] ?? ""} onChange={set(k)} className="rounded-lg px-2.5 py-1.5 text-sm outline-none uppercase" style={{ border: `1px solid ${C.line}` }} {...props} /></label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl w-full flex flex-col" style={{ background: C.panel, maxWidth: 720, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <Package size={18} style={{ color: C.accent }} /><b style={{ color: C.navy }}>{f.id ? "Editar bem" : "Novo bem"}</b>
          <div className="flex-1" /><button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-auto grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div className="col-span-2">{campo("descricao", "Descrição do bem *", { autoFocus: true, placeholder: "EX.: MÁQUINA DE COSTURA RETA" })}</div>
          <label className="flex flex-col gap-1 text-xs"><span className="font-semibold" style={{ color: C.sub }}>Categoria</span>
            <select value={f.categoria || ""} onChange={set("categoria")} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
              <option value="">—</option>{CATEGORIAS_PATRIMONIO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></label>
          {campo("marcaModelo", "Marca / modelo")}
          {campo("serie", "Nº de série / placa / chassi")}
          {campo("local", "Local / setor")}
          {campo("aquisicao", "Data de aquisição", { type: "date" })}
          <label className="flex flex-col gap-1 text-xs"><span className="font-semibold" style={{ color: C.sub }}>Situação</span>
            <select value={f.situacao || "ATIVO"} onChange={set("situacao")} className="rounded-lg px-2.5 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
              <option value="ATIVO">Ativo</option><option value="VENDIDO">Vendido</option><option value="BAIXADO">Baixado</option>
            </select></label>
          {campo("valorCompra", "Valor de compra (R$)", { inputMode: "decimal", placeholder: "0,00" })}
          {campo("valorAtual", "Valor atual estimado (R$)", { inputMode: "decimal", placeholder: "0,00" })}
          <div className="col-span-2 text-[11px] font-bold uppercase mt-1" style={{ color: C.navy }}>NF de compra</div>
          {campo("nfNumero", "Nº da NF")}
          {campo("nfFornecedor", "Fornecedor")}
          <div className="col-span-2">{campo("nfChave", "Chave de acesso (opcional)")}</div>
          <div className="col-span-2 flex items-center gap-2 text-xs">
            <input ref={inp} type="file" accept=".pdf,.xml,image/*" className="hidden" onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) setArq({ nome: fl.name, base64: await lerB64(fl) }); e.target.value = ""; }} />
            <button onClick={() => inp.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold" style={{ border: `1px dashed ${C.accent}`, color: C.accent }}>
              <Paperclip size={13} /> {arq || (f.nfArquivoNome && !f.removerArquivo) ? "Trocar arquivo da NF" : "Anexar PDF/XML da NF"}
            </button>
            {arq ? <span style={{ color: C.text }}>{arq.nome}</span>
              : f.nfArquivoNome && !f.removerArquivo ? <><a href={`/api/fin/patrimonio?u=${user.id}&arq=${f.id}`} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{f.nfArquivoNome}</a>
                <button onClick={() => setF((x) => ({ ...x, removerArquivo: true }))} style={{ color: C.sub }} title="Remover arquivo"><X size={13} /></button></> : null}
          </div>
          <label className="col-span-2 flex flex-col gap-1 text-xs"><span className="font-semibold" style={{ color: C.sub }}>Observações</span>
            <textarea value={f.obs || ""} onChange={set("obs")} rows={2} className="rounded-lg px-2.5 py-1.5 text-sm outline-none uppercase" style={{ border: `1px solid ${C.line}`, resize: "vertical" }} /></label>
          {erro && <div className="col-span-2 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.panel2, color: C.sub }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: C.accent, color: "#fff", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
