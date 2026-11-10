"use client";
// v747 — Dados › Vendedores: cadastro dos vendedores comissionados (dados, PIX, banco) e condição de fechamento
//   SPOT: a comissão entra no vencimento de cada conta a receber do pedido · MENSAL: uma conta no dia 10 do mês seguinte
import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, Pencil, Trash2, Search, Loader2, KeyRound, Phone, CalendarClock, Zap } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = {
  bg: "#F5F6F8", panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", red: "#D92D20", navy: "#001E41", steel: "#3D6799", steelSoft: "#EEF3FB",
};
const inp = "w-full rounded-lg px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };
const semAc = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const money = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
};
const Campo = ({ t, cls = "", children }) => <label className={`block ${cls}`}><div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>;

export function VendedorModal({ user, vendedor, pixTipos = [], onClose, onSalvo }) {
  const [f, setF] = useState(() => ({ fechamento: "SPOT", pixTipo: "", ...(vendedor || {}) }));
  const [st, setSt] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const salvar = async () => {
    setSt(true);
    try { const r = await api("/api/vendedores", "POST", { usuarioId: user.id, vendedor: f }); onSalvo?.(r.vendedor); onClose(); } catch (e) { alerta(e.message); }
    setSt(false);
  };
  const T = (k, t, cls) => <Campo t={t} cls={cls}><input value={f[k] || ""} onChange={(e) => set(k, e.target.value)} className={inp} style={inpS} /></Campo>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl" style={{ background: C.panel, borderTop: `4px solid ${C.accent}` }}>
        <div className="flex items-center px-5 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="font-bold flex-1" style={{ color: C.navy }}>{f.id ? "Editar vendedor" : "Novo vendedor"}</div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {T("nome", "Nome", "col-span-2")}
          {T("documento", "CPF / CNPJ")}
          {T("telefone", "Telefone / WhatsApp")}
          {T("email", "E-mail")}
          {T("endereco", "Endereço")}
          <Campo t="Tipo da chave PIX"><select value={f.pixTipo || ""} onChange={(e) => set("pixTipo", e.target.value)} className={inp} style={inpS}><option value="">—</option>{pixTipos.map((x) => <option key={x} value={x}>{x === "ALEATORIA" ? "Aleatória" : x === "TELEFONE" ? "Telefone" : x === "EMAIL" ? "E-mail" : x}</option>)}</select></Campo>
          {T("pixChave", "Chave PIX")}
          {T("banco", "Banco")}
          <div className="grid grid-cols-2 gap-2">{T("agencia", "Agência")}{T("conta", "Conta")}</div>
          <div className="col-span-2">
            <div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>Condição de fechamento da comissão</div>
            <div className="grid grid-cols-2 gap-2">
              {[["SPOT", Zap, "Spot", "No vencimento de cada conta a receber do pedido entra a comissão (parcelado: proporcional em cada fatura)."],
                ["MENSAL", CalendarClock, "Mensal", "Junta as comissões das contas a receber que vencem no mês numa só conta a pagar, no dia 10 do mês seguinte."]].map(([k, Ico, t, d]) => (
                <button key={k} type="button" onClick={() => set("fechamento", k)} className="text-left rounded-lg p-3" style={{ border: `2px solid ${f.fechamento === k ? C.accent : C.line}`, background: f.fechamento === k ? C.accentSoft : "#fff" }}>
                  <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.text }}><Ico size={14} style={{ color: C.accent }} /> {t}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.sub }}>{d}</div>
                </button>))}
            </div>
          </div>
          <Campo t="Observações" cls="col-span-2"><textarea value={f.obs || ""} onChange={(e) => set("obs", e.target.value)} rows={2} className={inp} style={inpS} /></Campo>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: `1px solid ${C.line}` }}>Cancelar</button>
          <button onClick={salvar} disabled={st} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1" style={{ background: C.accent }}>{st && <Loader2 size={14} className="animate-spin" />} Salvar</button>
        </div>
      </div>
    </div>
  );
}

export default function Vendedores({ user }) {
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [ed, setEd] = useState(null);
  const carregar = () => api(`/api/vendedores?u=${user.id}`).then(setD).catch((e) => setD({ erro: e.message }));
  useEffect(() => { carregar(); }, []);
  const lista = useMemo(() => (d?.vendedores || []).filter((v) => !q || semAc([v.nome, v.documento, v.email, v.telefone].join(" ")).includes(semAc(q))), [d, q]);
  const inativar = async (v) => { if (!(await confirmar(`Inativar ${v.nome}? Ele sai da lista do lançamento de pedido (as comissões já lançadas continuam).`))) return; await api("/api/vendedores", "DELETE", { usuarioId: user.id, id: v.id }).catch((e) => alerta(e.message)); carregar(); };
  if (!d) return <Loader2 className="animate-spin" style={{ color: C.sub }} />;
  if (d.erro) return <div style={{ color: C.red }}>{d.erro}</div>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-lg font-bold" style={{ color: C.navy }}>Vendedores</div>
        <span className="text-sm" style={{ color: C.sub }}>comissionados · a comissão vai para o contas a pagar (conta 2119000 · Comissão de vendas)</span>
        <div className="flex-1" />
        <div className="relative"><Search size={14} className="absolute left-2 top-2.5" style={{ color: C.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="pl-7 pr-2 py-1.5 rounded-lg text-sm outline-none" style={inpS} /></div>
        <button onClick={() => setEd({})} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white flex items-center gap-1" style={{ background: C.accent }}><Plus size={15} /> Vendedor</button>
      </div>
      {!lista.length ? <div className="text-sm py-8 text-center" style={{ color: C.sub }}>Nenhum vendedor cadastrado.</div> : (
        <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <table className="w-full text-sm">
            <thead><tr style={{ background: C.panel2, color: C.sub }} className="text-xs text-left"><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Contato</th><th className="px-3 py-2">PIX</th><th className="px-3 py-2">Fechamento</th><th className="px-3 py-2 text-right">Comissões lançadas</th><th /></tr></thead>
            <tbody>{lista.map((v) => (
              <tr key={v.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 font-semibold">{v.nome}<div className="text-xs font-normal" style={{ color: C.sub }}>{v.documento || ""}</div></td>
                <td className="px-3 py-2 text-xs">{v.telefone && <div className="flex items-center gap-1"><Phone size={11} /> {v.telefone}</div>}{v.email}</td>
                <td className="px-3 py-2 text-xs">{v.pixChave ? <span className="flex items-center gap-1"><KeyRound size={11} /> {v.pixTipo ? `${v.pixTipo}: ` : ""}{v.pixChave}</span> : <span style={{ color: C.sub }}>—</span>}</td>
                <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: v.fechamento === "MENSAL" ? C.steelSoft : C.accentSoft, color: v.fechamento === "MENSAL" ? C.steel : C.accent }}>{v.fechamento === "MENSAL" ? "Mensal (dia 10)" : "Spot"}</span></td>
                <td className="px-3 py-2 text-right text-xs">{v.comissoes?.partes ? <>{money(v.comissoes.total)}<div style={{ color: C.sub }}>{v.comissoes.partes} parcela(s)</div></> : "—"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setEd(v)} className="p-1" style={{ color: C.sub }} title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => inativar(v)} className="p-1" style={{ color: C.red }} title="Inativar"><Trash2 size={14} /></button>
                </td>
              </tr>))}</tbody>
          </table>
        </div>)}
      {ed && <VendedorModal user={user} vendedor={ed.id ? ed : null} pixTipos={d.pixTipos} onClose={() => setEd(null)} onSalvo={carregar} />}
    </div>
  );
}
