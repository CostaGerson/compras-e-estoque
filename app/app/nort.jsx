"use client";
// v808 — guia NORT (empresa amiga): créditos e débitos da relação com a NORT. Nada daqui entra em relatórios,
//   atrasados ou nas guias de contas a pagar/receber.
import React, { useState, useEffect, useMemo } from "react";
import { Loader2, Search, Pencil, CheckCircle2, ArrowDownLeft, ArrowUpRight } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", navySoft: "#EEF3FB",
};
const moeda = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const inpS = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };

function Card({ rotulo, valor, sub, cor, on, onClick }) {
  return (
    <div onClick={onClick} className={`rounded-xl p-4 ${onClick ? "cursor-pointer select-none" : ""}`} style={{ background: C.panel, border: on ? `2px solid ${cor}` : `1px solid ${C.line}`, margin: on ? 0 : 1 }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.sub }}>{rotulo}</div>
      <div className="text-xl font-bold mt-1" style={{ color: cor }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.sub }}>{sub}</div>}
    </div>
  );
}

export default function Nort({ user, onEditar, onBaixar, tick }) {
  const [de, setDe] = useState(`${new Date().getFullYear()}-01`);
  const [ate, setAte] = useState(mesAtual());
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [ver, setVer] = useState("TUDO");   // TUDO | CREDITOS | DEBITOS | ABERTOS
  const [busca, setBusca] = useState("");
  useEffect(() => {
    setD(null);
    fetch(`/api/fin/nort?u=${user.id}&de=${de}&ate=${ate}`).then((r) => r.json()).then((x) => { if (x.error) setErro(x.error); else { setD(x); setErro(""); } }).catch((e) => setErro(e.message));
  }, [de, ate, tick]);
  const q = busca.trim().toUpperCase();
  const lanc = useMemo(() => (d?.lancamentos || []).filter((l) => (ver === "CREDITOS" ? l.valor > 0 : ver === "DEBITOS" ? l.valor < 0 : true)
    && (!q || `${l.historico} ${l.conta} ${l.identificacao || ""} ${l.valor}`.toUpperCase().includes(q))), [d, ver, q]);
  const abertos = useMemo(() => (d?.abertos || []).filter((t) => !q || `${t.titulo} ${t.parceiro || ""} ${t.numeroDoc || ""} ${t.valor}`.toUpperCase().includes(q)), [d, q]);
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}>{erro || <><Loader2 size={16} className="animate-spin" /> Carregando…</>}</div>;
  const T = d.totais;
  const tog = (k) => setVer(ver === k ? "TUDO" : k);
  return (
    <div>
      <div className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: C.navySoft, color: C.navy }}>
        Contas da <b>NORT</b> (empresa amiga): ficam só aqui. Não entram nos relatórios, no painel, na previsão, nos atrasados nem nas guias de contas a pagar e a receber.
      </div>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Card rotulo="Créditos" valor={moeda(T.creditos)} sub="lançamentos positivos da NORT na DRE" cor={C.green} on={ver === "CREDITOS"} onClick={() => tog("CREDITOS")} />
        <Card rotulo="Débitos" valor={moeda(T.debitos)} sub={`contas pagas e empréstimos (${moeda(T.emprestimos)})`} cor={C.red} on={ver === "DEBITOS"} onClick={() => tog("DEBITOS")} />
        <Card rotulo="Saldo do período" valor={moeda(T.saldo)} sub={T.saldo >= 0 ? "a favor da NORT" : "a favor da Meridian"} cor={C.navy} on={ver === "TUDO"} onClick={() => setVer("TUDO")} />
        <Card rotulo="Em aberto" valor={moeda(T.aPagar + T.aReceber)} sub={`${moeda(T.aPagar)} a pagar · ${moeda(T.aReceber)} a receber`} cor={C.accent} on={ver === "ABERTOS"} onClick={() => tog("ABERTOS")} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: C.sub }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar histórico, conta ou valor…" className="rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ ...inpS, width: 260 }} />
        </div>
        <span className="text-xs ml-2" style={{ color: C.sub }}>Competência de</span>
        <input type="month" value={de} onChange={(e) => setDe(e.target.value)} className="rounded px-2 py-1 text-xs" style={inpS} />
        <span className="text-xs" style={{ color: C.sub }}>até</span>
        <input type="month" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded px-2 py-1 text-xs" style={inpS} />
      </div>

      {(ver === "TUDO" || ver === "ABERTOS") && <div className="rounded-xl overflow-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: C.panel2, color: C.sub }}>Contas NORT em aberto · {abertos.length}</div>
        <table className="w-full text-sm">
          <tbody>
            {abertos.map((t) => (
              <tr key={t.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 w-24"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={t.tipo === "PAGAR" ? { background: C.redSoft, color: C.red } : { background: C.greenSoft, color: C.green }}>
                  {t.tipo === "PAGAR" ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}{t.tipo === "PAGAR" ? "A PAGAR" : "A RECEBER"}</span></td>
                <td className="px-3 py-2"><div className="font-semibold" style={{ color: C.navy }}>{t.titulo}</div><div className="text-xs" style={{ color: C.sub }}>{t.parceiro}{t.numeroDoc ? ` · ${t.numeroDoc}` : ""}</div></td>
                <td className="px-3 py-2 whitespace-nowrap">{dBR(t.vencimento)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold">{moeda(t.valor)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {onBaixar && <button onClick={() => onBaixar(t)} title={t.tipo === "PAGAR" ? "Baixar (paga)" : "Baixar (recebida)"} className="p-1 rounded" style={{ color: C.green }}><CheckCircle2 size={15} /></button>}
                  {onEditar && <button onClick={() => onEditar(t)} title="Editar conta" className="p-1 rounded" style={{ color: C.blue }}><Pencil size={15} /></button>}
                </td>
              </tr>
            ))}
            {!abertos.length && <tr><td className="px-3 py-5 text-center" style={{ color: C.sub }}>Nenhuma conta NORT em aberto.</td></tr>}
          </tbody>
        </table>
      </div>}

      {ver !== "ABERTOS" && <div className="rounded-xl overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{ background: C.panel2, color: C.sub }}>
          {ver === "CREDITOS" ? "Créditos" : ver === "DEBITOS" ? "Débitos" : "Movimento"} da NORT na DRE · {lanc.length}</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wide text-left" style={{ color: C.sub }}>
            <th className="px-3 py-2">Data</th><th className="px-3 py-2">Histórico</th><th className="px-3 py-2">Conta-caixa</th><th className="px-3 py-2 text-right">Valor</th></tr></thead>
          <tbody>
            {lanc.map((l) => (
              <tr key={l.id} style={{ borderTop: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 whitespace-nowrap">{dBR(l.data)}</td>
                <td className="px-3 py-2">{l.historico}{l.identificacao ? <span style={{ color: C.sub }}> · {l.identificacao}</span> : null}{l.emprestimo && <span className="ml-1 px-1.5 rounded text-[10px] font-semibold" style={{ background: C.navySoft, color: C.navy }}>EMPRÉSTIMO</span>}</td>
                <td className="px-3 py-2 text-xs" style={{ color: C.sub }}>{l.conta}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap font-semibold" style={{ color: l.valor >= 0 ? C.green : C.red }}>{moeda(l.valor)}</td>
              </tr>
            ))}
            {!lanc.length && <tr><td colSpan={4} className="px-3 py-5 text-center" style={{ color: C.sub }}>Nenhum lançamento da NORT no período.</td></tr>}
          </tbody>
        </table>
      </div>}
    </div>
  );
}
