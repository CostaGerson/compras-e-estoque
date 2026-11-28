"use client";
// v1192 — Emitir NF-e do pedido direto na SEFAZ-MG: rascunho montado do pedido (cliente, itens pela grade, NCM, CFOP,
//   duplicatas, frete e observações) para conferir/ajustar e emitir. Mostra as NF-e já emitidas para o pedido (DANFE e XML).
import React, { useEffect, useState } from "react";
import { Loader2, X, Plus, Trash2, FileText, AlertTriangle } from "lucide-react";
import { alerta, confirmar } from "./dialogo";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", navy: "#001E41", green: "#12A150", red: "#D92D20", amber: "#B54708" };
const inp = "w-full px-2 py-1 rounded-md outline-none text-xs";
const iS = { background: C.panel2, border: `1px solid ${C.line}`, color: C.text };
const num = (v) => { if (v === "" || v == null) return 0; const s = String(v).trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const MODFRETE = [[0, "0 · Remetente (CIF)"], [1, "1 · Destinatário (FOB)"], [2, "2 · Terceiros"], [3, "3 · Próprio, por conta do remetente"], [4, "4 · Próprio, por conta do destinatário"], [9, "9 · Sem frete"]];
const TPAG = [["15", "Boleto"], ["17", "PIX"], ["03", "Cartão de crédito"], ["01", "Dinheiro"], ["05", "Crédito loja"], ["90", "Sem pagamento"], ["99", "Outros"]];

export default function NfePedidoModal({ numero, user, onClose }) {
  const [dupMan, setDupMan] = useState(false);   // v1193 — duplicatas editadas à mão: não recalcula mais
  const [d, setD] = useState(null), [n, setN] = useState(null), [emp, setEmp] = useState("MERIDIAN"), [st, setSt] = useState(""), [res, setRes] = useState(null);
  const carregar = async (e = emp) => {
    setD(null);
    const x = await fetch(`/api/tributario?u=${user.id}&acao=nfePedido&numero=${encodeURIComponent(numero)}&empresa=${e}`).then((r) => r.json()).catch((er) => ({ error: er.message }));
    if (x.error) { await alerta(x.error); return onClose(); }
    setD(x); setN(x.nota); setDupMan(false);
  };
  useEffect(() => { carregar(); }, [numero]);
  if (!d || !n) return <Moldura onClose={onClose}><div className="p-8 flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Montando a NF-e do pedido {numero}…</div></Moldura>;

  const set = (k, v) => setN((o) => ({ ...o, [k]: v }));
  const setDest = (k, v) => setN((o) => ({ ...o, dest: { ...o.dest, [k]: v } }));
  // v1193 — mudou quantidade/preço: refaz as duplicatas pela condição do pedido (até alguém editá-las à mão)
  const refaz = (o, forca = false) => {
    if ((dupMan && !forca) || !d?.estrutura?.length) return o;
    const V = o.itens.reduce((s2, i) => s2 + Math.round(num(i.qtd) * num(i.valorUnit) * 100) / 100, 0);
    const liq = Math.max(0, V - Math.min(d.pedido.entradaRestante || 0, V)); let ac = 0;
    const dup = d.estrutura.map((x, k) => { const v = k === d.estrutura.length - 1 ? Math.round((liq - ac) * 100) / 100 : Math.round(liq * x.fr * 100) / 100; ac = Math.round((ac + v) * 100) / 100; return { venc: x.venc, valor: v }; }).filter((x) => x.valor > 0);
    return { ...o, dup };
  };
  const setIt = (i, k, v) => setN((o) => refaz({ ...o, itens: o.itens.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
  const setDup = (i, k, v) => { setDupMan(true); setN((o) => ({ ...o, dup: o.dup.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })); };
  const todos = (modo) => setN((o) => refaz({ ...o, itens: o.itens.map((x) => ({ ...x, qtd: modo === "saldo" ? Math.max(0, (x.pedida || 0) - (x.faturada || 0)) : 0 })) }));
  const pecasNota = n.itens.reduce((s2, i) => s2 + num(i.qtd), 0);
  const total = n.itens.reduce((s, i) => s + Math.round(num(i.qtd) * num(i.valorUnit) * 100) / 100, 0);
  const somaDup = n.dup.reduce((s, x) => s + num(x.valor), 0);
  const hom = n.ambiente !== "PRODUCAO";
  const trocaEmp = (e) => { setEmp(e); carregar(e); };

  const emitir = async () => {
    if (n.itens.some((i) => num(i.qtd) > 0 && String(i.ncm || "").replace(/\D/g, "").length !== 8)) return alerta("Há item sem NCM (8 dígitos).");
    if (somaDup - total > 0.01) return alerta("A soma das duplicatas passa do total da nota.");
    if (!pecasNota) return alerta("Nenhuma peça nesta nota: informe as quantidades.");
    const passa = n.itens.find((i) => num(i.qtd) > Math.max(0, (i.pedida || 0) - (i.faturada || 0)));
    if (passa) return alerta(`${passa.descricao}: a quantidade passa do saldo a faturar.`);
    if (!(await confirmar(`Emitir a NF-e do pedido ${numero} pela ${emp} em ${hom ? "HOMOLOGAÇÃO (sem valor fiscal)" : "PRODUÇÃO"}? ${pecasNota} peça(s), ${brl(total)}.${n.itens.some((i) => num(i.qtd) < Math.max(0, (i.pedida || 0) - (i.faturada || 0))) ? " Faturamento PARCIAL: o restante continua no pedido." : ""}`))) return;
    setSt("Montando, assinando e enviando à SEFAZ-MG…");
    const r = await fetch("/api/tributario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, acao: "emitirPedido", numero, nota: { ...n, empresa: emp } }) })
      .then((x) => x.json()).catch((e) => ({ error: e.message }));
    setSt("");
    if (r.error) return alerta(r.error);
    setRes({ ...r.nota, faturamento: r.faturamento });
    if (r.nota?.status === "AUTORIZADA") { await carregar(emp); }
    const x = await fetch(`/api/tributario?u=${user.id}&acao=nfePedido&numero=${encodeURIComponent(numero)}&empresa=${emp}`).then((y) => y.json()).catch(() => null);
    if (x?.emitidas) setD((o) => ({ ...o, emitidas: x.emitidas }));
    if (r.nota?.status === "AUTORIZADA") window.open(`/api/tributario?u=${user.id}&acao=danfe&id=${r.nota.id}`, "_blank");
  };
  const I = (v, on, est = {}) => <input value={v ?? ""} onChange={(e) => on(e.target.value)} className={inp} style={{ ...iS, ...est }} />;

  return (
    <Moldura onClose={onClose} titulo={`NF-e do pedido ${numero} · ${d.pedido.cliente}`}>
      <div className="p-4 space-y-3 text-xs" style={{ color: C.text }}>
        <div className="flex flex-wrap items-center gap-2">
          {["MERIDIAN", "NORT"].map((e) => <button key={e} onClick={() => trocaEmp(e)} className="px-3 py-1 rounded-lg font-semibold" style={{ background: emp === e ? C.navy : C.panel2, color: emp === e ? "#fff" : C.text }}>{e}</button>)}
          <span className="px-2 py-1 rounded-md font-bold" style={{ background: hom ? "#FEF0C7" : "#E7F6EE", color: hom ? C.amber : C.green }}>{hom ? "HOMOLOGAÇÃO · sem valor fiscal" : "PRODUÇÃO"}</span>
          <span className="ml-auto" style={{ color: C.sub }}>Pedido {brl(d.pedido.total)}{d.pedido.condicao ? ` · ${d.pedido.condicao}` : ""}{d.pedido.entrada ? ` · entrada ${brl(d.pedido.entrada)}${d.pedido.entradaRestante < d.pedido.entrada ? ` (falta abater ${brl(d.pedido.entradaRestante)})` : " (abatida das duplicatas)"}` : ""}</span>
        </div>
        {d.avisos?.length > 0 && <div className="rounded-lg px-3 py-2 space-y-0.5" style={{ background: "#FEF0C7", color: C.amber }}>{d.avisos.map((a, i) => <div key={i} className="flex gap-1"><AlertTriangle size={13} /> {a}</div>)}</div>}

        <Sec t="Destinatário">
          <div className="grid grid-cols-6 gap-2">
            <div className="col-span-3"><Campo rot="Razão social">{I(n.dest.nome, (v) => setDest("nome", v))}</Campo></div>
            <Campo rot="CNPJ / CPF">{I(n.dest.cnpj || n.dest.cpf, (v) => { const dg = v.replace(/\D/g, ""); setN((o) => ({ ...o, dest: { ...o.dest, cnpj: dg.length > 11 ? dg : "", cpf: dg.length <= 11 ? dg : "" } })); })}</Campo>
            <Campo rot="Inscrição estadual">{I(n.dest.ie, (v) => setDest("ie", v))}</Campo>
            <Campo rot="E-mail NF">{I(n.dest.email, (v) => setDest("email", v))}</Campo>
            <div className="col-span-2"><Campo rot="Endereço">{I(n.dest.logradouro, (v) => setDest("logradouro", v))}</Campo></div>
            <Campo rot="Número">{I(n.dest.numero, (v) => setDest("numero", v))}</Campo>
            <Campo rot="Complemento">{I(n.dest.complemento, (v) => setDest("complemento", v))}</Campo>
            <Campo rot="Bairro">{I(n.dest.bairro, (v) => setDest("bairro", v))}</Campo>
            <Campo rot="CEP">{I(n.dest.cep, (v) => setDest("cep", v))}</Campo>
            <div className="col-span-2"><Campo rot="Município">{I(n.dest.municipio, (v) => setDest("municipio", v))}</Campo></div>
            <Campo rot="UF">{I(n.dest.uf, (v) => setDest("uf", v.toUpperCase().slice(0, 2)))}</Campo>
          </div>
        </Sec>

        <Sec t={`Itens desta nota · ${pecasNota} peça(s) · ${brl(total)}`}>
          <div className="flex flex-wrap items-center gap-3 mb-2" style={{ color: C.sub }}>
            <span>Faturamento parcial: escolha quanto de cada tamanho vai nesta nota. O que ficar de fora continua no pedido, na produção.</span>
            <span className="ml-auto flex gap-3"><button onClick={() => todos("saldo")} className="underline" style={{ color: C.navy }}>todo o saldo</button><button onClick={() => todos("zero")} className="underline" style={{ color: C.navy }}>zerar</button></span>
          </div>
          {d.pcp && <div className="mb-2" style={{ color: pecasNota > d.pcp.livres ? C.red : C.sub }}>PCP: {d.pcp.concluidas} de {d.pcp.total} peça(s) concluídas na expedição, {d.pcp.faturadas} já faturadas · <b>{d.pcp.livres} livres para faturar</b>{pecasNota > d.pcp.livres ? " — esta nota passa disso: peça em produção não pode ser faturada." : ""}</div>}
          <table className="w-full">
            <thead><tr style={{ color: C.sub }} className="text-[10px] uppercase"><th className="text-left">Código</th><th className="text-left">Descrição</th><th>NCM</th><th>CFOP</th><th title="pedido / já faturado">Ped. / fat.</th><th>Nesta NF</th><th>Unit.</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>{n.itens.map((it, i) => {
              const saldo = Math.max(0, (it.pedida || 0) - (it.faturada || 0)), passa = num(it.qtd) > saldo;
              return (
              <tr key={i} style={{ opacity: saldo === 0 && !num(it.qtd) ? 0.45 : 1 }}>
                <td style={{ width: 110 }}>{I(it.codigo, (v) => setIt(i, "codigo", v))}</td>
                <td>{I(it.descricao, (v) => setIt(i, "descricao", v))}</td>
                <td style={{ width: 86 }} title={it.ncmFonte ? `NCM: ${it.ncmFonte}` : ""}>{I(it.ncm, (v) => setIt(i, "ncm", v), String(it.ncm || "").replace(/\D/g, "").length !== 8 && num(it.qtd) > 0 ? { borderColor: C.red } : {})}</td>
                <td style={{ width: 56 }}>{I(it.cfop, (v) => setIt(i, "cfop", v))}</td>
                <td className="text-center whitespace-nowrap" style={{ width: 70, color: C.sub }}>{it.pedida ?? "—"} / {it.faturada || 0}</td>
                <td style={{ width: 60 }}>{I(it.qtd, (v) => setIt(i, "qtd", v), passa ? { borderColor: C.red, color: C.red } : { fontWeight: 700 })}</td>
                <td style={{ width: 72 }}>{I(String(it.valorUnit).replace(".", ","), (v) => setIt(i, "valorUnit", v))}</td>
                <td className="text-right whitespace-nowrap px-1" style={{ width: 84 }}>{brl(num(it.qtd) * num(it.valorUnit))}</td>
                <td style={{ width: 20 }}><button onClick={() => setN((o) => refaz({ ...o, itens: o.itens.filter((_, j) => j !== i) }))}><Trash2 size={13} style={{ color: C.sub }} /></button></td>
              </tr>); })}</tbody>
          </table>
        </Sec>

        <div className="grid grid-cols-2 gap-3">
          <Sec t={`Fatura / duplicatas · ${brl(somaDup)}`}>
            {n.dup.map((x, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <span style={{ width: 28, color: C.sub }}>{String(i + 1).padStart(3, "0")}</span>
                <input type="date" value={x.venc} onChange={(e) => setDup(i, "venc", e.target.value)} className={inp} style={{ ...iS, width: 140 }} />
                {I(String(x.valor).replace(".", ","), (v) => setDup(i, "valor", v), { width: 110 })}
                <button onClick={() => { setDupMan(true); set("dup", n.dup.filter((_, j) => j !== i)); }}><Trash2 size={13} style={{ color: C.sub }} /></button>
              </div>))}
            <button onClick={() => { setDupMan(true); set("dup", [...n.dup, { venc: new Date().toISOString().slice(0, 10), valor: Math.max(0, Math.round((total - somaDup) * 100) / 100) }]); }} className="flex items-center gap-1 mt-1 font-semibold" style={{ color: C.accent }}><Plus size={13} /> duplicata</button>
            {Math.abs(Math.max(0, total - Math.min(d.pedido.entradaRestante || 0, total)) - somaDup) > 0.01 && <div className="mt-1" style={{ color: C.amber }}>Duplicatas somam {brl(somaDup)}; esperado {brl(Math.max(0, total - Math.min(d.pedido.entradaRestante || 0, total)))} (nota {brl(total)}{d.pedido.entradaRestante ? ` − entrada ${brl(Math.min(d.pedido.entradaRestante, total))}` : ""}).</div>}
            {dupMan && <button onClick={() => { setDupMan(false); setN((o) => refaz(o, true)); }} className="underline mt-1" style={{ color: C.navy }}>recalcular pela condição</button>}
            <div className="mt-2"><Campo rot="Forma de pagamento"><select value={n.tPag} onChange={(e) => set("tPag", e.target.value)} className={inp} style={iS}>{TPAG.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></Campo></div>
          </Sec>
          <Sec t="Transporte e observações">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3"><Campo rot="Frete"><select value={n.modFrete} onChange={(e) => set("modFrete", Number(e.target.value))} className={inp} style={iS}>{MODFRETE.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select></Campo></div>
              <Campo rot="Volumes">{I(n.volumes?.qVol, (v) => set("volumes", { ...n.volumes, qVol: v }))}</Campo>
              <Campo rot="Espécie">{I(n.volumes?.esp, (v) => set("volumes", { ...n.volumes, esp: v }))}</Campo>
              <Campo rot="Peso bruto (kg)">{I(n.volumes?.pesoB, (v) => set("volumes", { ...n.volumes, pesoB: v, pesoL: n.volumes?.pesoL || v }))}</Campo>
              <div className="col-span-3"><Campo rot="Natureza da operação">{I(n.natOp, (v) => set("natOp", v))}</Campo></div>
              <div className="col-span-3"><Campo rot="Informações complementares"><textarea value={n.infCpl || ""} onChange={(e) => set("infCpl", e.target.value)} rows={3} className={inp} style={iS} /></Campo></div>
            </div>
          </Sec>
        </div>

        {res && (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: res.status === "AUTORIZADA" ? "#E7F6EE" : "#FDECEA", color: res.status === "AUTORIZADA" ? C.green : C.red }}>
            {res.status === "AUTORIZADA" ? <>✓ NF-e <b>{res.numero}</b> série {res.serie} autorizada · protocolo {res.protocolo}
              {res.ambiente === "PRODUCAO" ? (res.faturamento?.erro ? <div style={{ color: C.red }}>{res.faturamento.erro}</div> : <div>Entrou no faturamento do pedido (contas a receber e saldo do pedido atualizados).</div>)
                : <div style={{ color: C.sub }}>Homologação: não mexe no faturamento do pedido nem nas contas.</div>}</> : <>NF-e não autorizada: <b>{res.cStat} · {res.xMotivo}</b></>}
          </div>
        )}
        {d.emitidas?.length > 0 && (
          <Sec t="NF-e já emitidas para este pedido">
            {d.emitidas.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 py-0.5">
                <b>{x.empresa} · nº {x.numero}/{x.serie}</b><span>{x.ambiente === "PRODUCAO" ? "produção" : "homologação"}</span><span>{brl(x.valor)}</span>
                <b style={{ color: x.status === "AUTORIZADA" ? C.green : C.red }}>{x.status}</b>{x.status !== "AUTORIZADA" && <span style={{ color: C.sub }}>{x.cStat} · {x.xMotivo}</span>}
                <span className="ml-auto flex gap-3"><a className="underline" style={{ color: C.navy }} target="_blank" rel="noreferrer" href={`/api/tributario?u=${user.id}&acao=danfe&id=${x.id}`}>DANFE</a><a className="underline" style={{ color: C.navy }} href={`/api/tributario?u=${user.id}&acao=nfeXml&id=${x.id}`}>XML</a></span>
              </div>))}
          </Sec>
        )}
        <div className="flex items-center gap-2 pt-1">
          {st && <span className="flex items-center gap-1" style={{ color: C.sub }}><Loader2 size={14} className="animate-spin" /> {st}</span>}
          <button onClick={onClose} className="ml-auto px-4 py-2 rounded-lg text-sm" style={{ background: C.panel2 }}>Fechar</button>
          <button onClick={emitir} disabled={!!st || !n.itens.length} className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1" style={{ background: C.accent }}><FileText size={15} /> Emitir NF-e</button>
        </div>
      </div>
    </Moldura>
  );
}

function Campo({ rot, children, w }) { return <label className="text-[10px] uppercase block" style={{ color: C.sub, width: w }}>{rot}<div className="mt-0.5 normal-case">{children}</div></label>; }
function Sec({ t, children }) {
  return <div className="rounded-lg p-3" style={{ border: `1px solid ${C.line}` }}><div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.navy }}>{t}</div>{children}</div>;
}
function Moldura({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4" style={{ background: "rgba(0,0,0,.45)" }}>
      <div className="w-full max-w-5xl rounded-xl my-6" style={{ background: C.panel }}>
        <div className="flex items-center px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <b className="text-sm" style={{ color: C.navy }}>{titulo || "NF-e do pedido"}</b>
          <button onClick={onClose} className="ml-auto"><X size={18} style={{ color: C.sub }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
