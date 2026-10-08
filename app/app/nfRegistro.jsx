"use client";
// v164 — Dados › Notas fiscais: registro geral de NFs de entrada e de saída (movimento fiscal + NFs antigas do Compras),
// com filtros por período, emitente/destinatário, natureza, empresa, situação e origem.
import React, { useState, useEffect, useMemo } from "react";
import { Search, ArrowDownLeft, ArrowUpRight, FileCode2, FileText, Loader2, ChevronUp, ChevronDown, X } from "lucide-react";
import { CoresContas as C } from "./contas";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => "R$ " + brl(v);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fimMesDe = (iso) => { const [a, m] = iso.split("-").map(Number); return `${iso.slice(0, 8)}${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`; };
const fmtDoc = (d) => { const s = String(d || "").replace(/\D/g, ""); if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); return s; };
const sem = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const ST = { ABERTO: [C.blue, C.blueSoft, "em aberto"], PAGO: [C.green, C.greenSoft, "baixada"], CANCELADO: [C.sub, C.panel2, "cancelada"], EXCLUIDA: [C.sub, C.panel2, "excluída"] };
const sel = "rounded-lg px-2 py-1.5 text-xs outline-none";
const selS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff", maxWidth: 240 };

// filtra e ordena as notas de uma guia (exportado para os testes)
export function filtrarNotas(lista, f) {
  const b = sem(f.busca).trim();
  const l = (lista || []).filter((n) => n.tipo === f.tipo
    && (!f.parceiro || n.parceiro === f.parceiro)
    && (!f.natureza || (f.natureza === "—" ? !n.natureza : n.natureza === f.natureza))
    && (!f.empresa || n.empresa === f.empresa)
    && (!f.situacao || n.acao === f.situacao)
    && (!f.origem || (f.origem === "COMPRAS" ? n.origem !== "MOVIMENTO FISCAL" : n.origem === "MOVIMENTO FISCAL"))
    && (!b || sem(`${n.numero} ${n.parceiro} ${n.documento || ""} ${n.natureza || ""} ${n.chave || ""}`).includes(b) || brl(n.valor).includes(b)));
  const [k, dir] = f.ordem || ["emissao", -1];
  const v = (n) => (k === "valor" ? n.valor : k === "numero" ? Number(n.numero) || 0 : String(n[k] || ""));
  return [...l].sort((a, c) => (v(a) > v(c) ? 1 : v(a) < v(c) ? -1 : 0) * dir);
}

export default function NfRegistro({ user }) {
  const ano = hojeISO().slice(0, 4);
  const [de, setDe] = useState(hojeISO().slice(0, 8) + "01");
  const [ate, setAte] = useState(fimMesDe(hojeISO()));
  const [tipo, setTipo] = useState("ENTRADA");
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [f, setF] = useState({ busca: "", parceiro: "", natureza: "", empresa: "", situacao: "", origem: "" });
  const [ordem, setOrdem] = useState(["emissao", -1]);
  const [aberta, setAberta] = useState(null);

  useEffect(() => {
    let vivo = true; setLista(null); setErro("");
    fetch(`/api/fiscal/registro?u=${user.id}&de=${de}&ate=${ate}`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Erro ao carregar");
      if (vivo) setLista(Array.isArray(d) ? d : []);
    }).catch((e) => { if (vivo) { setErro(e.message); setLista([]); } });
    return () => { vivo = false; };
  }, [de, ate]);

  const daGuia = useMemo(() => (lista || []).filter((n) => n.tipo === tipo), [lista, tipo]);
  const opcoes = useMemo(() => ({
    parceiros: [...new Set(daGuia.map((n) => n.parceiro))].sort(),
    naturezas: [...new Set(daGuia.map((n) => n.natureza || "—"))].sort(),
  }), [daGuia]);
  const notas = useMemo(() => filtrarNotas(lista, { ...f, tipo, ordem }), [lista, f, tipo, ordem]);
  const tot = useMemo(() => ({
    qtd: notas.length, valor: notas.reduce((s, n) => s + n.valor, 0),
    lanc: notas.filter((n) => n.acao === "LANCADA").length, reg: notas.filter((n) => n.acao === "REGISTRADA").length,
    semXml: notas.filter((n) => !n.temXml).length,
  }), [notas]);
  const cont = (t) => (lista || []).filter((n) => n.tipo === t).length;
  const filtrado = Object.values(f).some(Boolean);
  const mudaGuia = (t) => { setTipo(t); setF((x) => ({ ...x, parceiro: "", natureza: "" })); setAberta(null); };
  const periodo = (a, b) => { setDe(a); setAte(b); };
  const ent = tipo === "ENTRADA";

  const Th = ({ k, t, right }) => (
    <th className={`px-3 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      onClick={() => setOrdem(([ok, od]) => [k, ok === k ? -od : k === "parceiro" ? 1 : -1])}>
      {t}{ordem[0] === k && (ordem[1] > 0 ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />)}
    </th>
  );
  const arqLink = (n, x) => n.origem === "MOVIMENTO FISCAL" ? `/api/fiscal/${n.id}?u=${user.id}&arq=${x}` : `/api/nf/${n.idCompras}/${x}`;

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-bold" style={{ color: C.navy }}>Notas fiscais</div>
        <div className="text-xs" style={{ color: C.sub }}>Registro geral das NFs de entrada e de saída. Para importar novas notas, use ADM › Movimento fiscal.</div>
      </div>

      <div className="flex gap-1 mb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["ENTRADA", "Entrada", ArrowDownLeft, C.red], ["SAIDA", "Saída", ArrowUpRight, C.green]].map(([k, t, I, c]) => (
          <button key={k} onClick={() => mudaGuia(k)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold -mb-px"
            style={{ color: tipo === k ? C.navy : C.sub, borderBottom: `2px solid ${tipo === k ? C.accent : "transparent"}` }}>
            <I size={15} style={{ color: c }} /> {t} {lista && <span className="text-[11px] font-normal" style={{ color: C.sub }}>({cont(k)})</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2" style={{ color: C.sub }} />
          <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="Nº, nome, CNPJ, chave, valor…"
            className="rounded-lg pl-8 pr-2 py-1.5 text-xs outline-none" style={{ ...selS, width: 220, maxWidth: "none" }} />
        </div>
        <span className="text-xs" style={{ color: C.sub }}>Emissão de</span>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={sel} style={selS} />
        <span className="text-xs" style={{ color: C.sub }}>até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={sel} style={selS} />
        {[["Mês", hojeISO().slice(0, 8) + "01", fimMesDe(hojeISO())], ["Ano", `${ano}-01-01`, `${ano}-12-31`], ["Tudo", "", ""]].map(([t, a, b]) => (
          <button key={t} onClick={() => periodo(a, b)} className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: de === a && ate === b ? C.navy : C.panel2, color: de === a && ate === b ? "#fff" : C.sub }}>{t}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={f.parceiro} onChange={(e) => setF({ ...f, parceiro: e.target.value })} className={sel} style={selS}>
          <option value="">{ent ? "Todos os emitentes (fornecedores)" : "Todos os destinatários (clientes)"}</option>
          {opcoes.parceiros.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={f.natureza} onChange={(e) => setF({ ...f, natureza: e.target.value })} className={sel} style={selS}>
          <option value="">Todas as naturezas</option>
          {opcoes.naturezas.map((p) => <option key={p} value={p}>{p === "—" ? "Sem natureza" : p}</option>)}
        </select>
        <select value={f.empresa} onChange={(e) => setF({ ...f, empresa: e.target.value })} className={sel} style={selS}>
          <option value="">Meridian e NORT</option><option value="MERIDIAN">Meridian</option><option value="NORT">NORT</option>
        </select>
        <select value={f.situacao} onChange={(e) => setF({ ...f, situacao: e.target.value })} className={sel} style={selS}>
          <option value="">Lançadas e só registradas</option><option value="LANCADA">{ent ? "Lançadas (contas a pagar)" : "Lançadas (contas a receber)"}</option><option value="REGISTRADA">Só registradas</option>
        </select>
        {ent && <select value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} className={sel} style={selS}>
          <option value="">Todas as origens</option><option value="FISCAL">Movimento fiscal</option><option value="COMPRAS">Antigas do Compras</option>
        </select>}
        {filtrado && <button onClick={() => setF({ busca: "", parceiro: "", natureza: "", empresa: "", situacao: "", origem: "" })} className="flex items-center gap-1 text-xs" style={{ color: C.accent }}><X size={12} /> limpar filtros</button>}
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {[["Notas", tot.qtd, null, C.navy], ["Valor total", moeda(tot.valor), null, ent ? C.red : C.green],
          ["Lançadas", tot.lanc, ent ? "geraram contas a pagar" : "geraram contas a receber", C.navy], ["Só registradas", tot.reg, "sem conta", C.sub],
          ["Sem XML", tot.semXml, "só PDF ou sem arquivo", tot.semXml ? C.yellow : C.sub]].map(([t, v, s, c]) => (
          <div key={t} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="text-[11px] font-semibold" style={{ color: C.sub }}>{t}</div>
            <div className="text-lg font-bold" style={{ color: c }}>{v}</div>
            {s && <div className="text-[10px]" style={{ color: C.sub }}>{s}</div>}
          </div>
        ))}
      </div>

      {erro && <div className="mb-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      <div className="rounded-xl overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <table className="w-full text-xs">
          <thead style={{ color: C.sub, background: C.panel2 }}><tr>
            <Th k="emissao" t="Emissão" /><Th k="numero" t="Nº" /><th className="px-3 py-2 text-left font-semibold">Modelo</th>
            <Th k="parceiro" t={ent ? "Emitente (fornecedor)" : "Destinatário (cliente)"} /><th className="px-3 py-2 text-left font-semibold">CNPJ/CPF</th>
            <Th k="natureza" t="Natureza" /><Th k="valor" t="Valor" right /><th className="px-3 py-2 text-left font-semibold">Contas</th>
            <th className="px-3 py-2 text-left font-semibold">Arquivos</th><th className="px-3 py-2 text-left font-semibold">Origem</th>
          </tr></thead>
          <tbody>
            {!lista && <tr><td colSpan={10} className="px-3 py-8 text-center" style={{ color: C.sub }}><Loader2 size={15} className="inline animate-spin mr-1" /> Carregando…</td></tr>}
            {lista && !notas.length && <tr><td colSpan={10} className="px-3 py-8 text-center" style={{ color: C.sub }}>Nenhuma nota {filtrado ? "com estes filtros" : "neste período"}.</td></tr>}
            {notas.map((n) => {
              const st = n.parcelas.reduce((m, p) => ({ ...m, [p.status]: (m[p.status] || 0) + 1 }), {});
              const ab = aberta === n.id;
              return (
                <React.Fragment key={n.id}>
                  <tr onClick={() => setAberta(ab ? null : n.id)} className="cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: ab ? C.panel2 : undefined }}>
                    <td className="px-3 py-2 whitespace-nowrap">{dBR(n.emissao)}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{n.numero}{n.empresa === "NORT" && <span className="ml-1 px-1 rounded text-[9px]" style={{ background: C.roxoSoft, color: C.roxo }}>NORT</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.sub }}>{n.modelo}</td>
                    <td className="px-3 py-2">{n.parceiro}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: C.sub }}>{fmtDoc(n.documento) || "—"}</td>
                    <td className="px-3 py-2" style={{ color: n.natureza ? C.text : C.sub }}>{n.natureza || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{moeda(n.valor)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {n.acao === "REGISTRADA" ? <span style={{ color: C.sub }}>só registro</span>
                        : !n.parcelas.length ? <span style={{ color: C.sub }}>—</span>
                        : Object.entries(st).map(([s, q]) => { const [c, bg, t] = ST[s] || ST.EXCLUIDA; return <span key={s} className="mr-1 px-1.5 py-0.5 rounded" style={{ background: bg, color: c }}>{q} {t}</span>; })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {n.temXml && <a href={arqLink(n, "xml")} target="_blank" rel="noreferrer" className="mr-2 inline-flex items-center gap-0.5" style={{ color: C.blue }}><FileCode2 size={13} /> XML</a>}
                      {n.temPdf && <a href={arqLink(n, "pdf")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5" style={{ color: C.red }}><FileText size={13} /> PDF</a>}
                      {!n.temXml && !n.temPdf && <span style={{ color: C.sub }}>—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-[10px]" style={{ color: C.sub }}>{n.origem}</td>
                  </tr>
                  {ab && (
                    <tr style={{ background: C.panel2 }}><td colSpan={10} className="px-6 pb-3 pt-1">
                      <div className="text-[11px] mb-1.5" style={{ color: C.sub }}>
                        {n.chave && <>Chave {n.chave} · </>}{n.motivo && <>Motivo do só registro: {n.motivo} · </>}{n.criadoPorNome && <>Importada por {n.criadoPorNome}</>}
                      </div>
                      {n.parcelas.length > 0 ? (
                        <table className="text-[11px]"><tbody>{n.parcelas.map((p, k) => {
                          const [c, bg, t] = ST[p.status] || ST.EXCLUIDA;
                          return <tr key={k}><td className="pr-4">Parcela {p.parcela}</td><td className="pr-4">vence {dBR(p.vencimento)}</td><td className="pr-4 text-right">{moeda(p.valor)}</td>
                            <td><span className="px-1.5 rounded" style={{ background: bg, color: c }}>{t}</span></td></tr>;
                        })}</tbody></table>
                      ) : <div className="text-[11px]" style={{ color: C.sub }}>Nenhuma conta ligada a esta nota.</div>}
                    </td></tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
