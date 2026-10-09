"use client";
// v158 — ADM › Movimento fiscal (NFs de entrada/saída → contas a pagar/receber) e Demandas ADM; Logística › Rota
import { podeImportar } from "@/lib/acesso";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { unzipSync } from "fflate";
import {
  Upload, Loader2, Search, Trash2, FileCode2, FileText, AlertTriangle, CheckCircle2, X, Plus, ArrowDownLeft, ArrowUpRight,
  Link2, Circle, CirclePlay, List, Columns3, Pencil, CalendarDays, Flag, Route as IcoRota, Truck,
} from "lucide-react";
import { Soltar, Rateio, ModalContas as Modal, ValorContas as Valor, CoresContas as C } from "./contas";

const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => "R$ " + brl(v);
const dBR = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const iniMes = () => hojeISO().slice(0, 8) + "01";
const fimMes = () => { const d = new Date(); return `${hojeISO().slice(0, 8)}${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`; };
const fmtDoc = (d) => { const s = String(d || "").replace(/\D/g, ""); if (s.length === 14) return s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5"); if (s.length === 11) return s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); return s; };
const api = async (url, method = "GET", body) => {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro");
  return d;
};
const u8b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const inp = "w-full rounded px-2 py-1.5 text-sm outline-none";
const inpS = { border: `1px solid ${C.line}`, color: C.text, background: "#fff" };
const BtnP = ({ onClick, children, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent, opacity: disabled ? 0.5 : 1 }}>{children}</button>
);
const Campo = ({ t, children }) => (
  <label className="block"><div className="text-[11px] font-semibold mb-1" style={{ color: C.sub }}>{t}</div>{children}</label>
);
const Chip = ({ on, onClick, children }) => (
  <button onClick={onClick} className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: on ? C.navy : C.panel2, color: on ? "#fff" : C.sub }}>{children}</button>
);
const FORMAS_PGTO = { PIX: "PIX", BOLETO: "Boleto", DEBITO_AUTOMATICO: "Débito automático", TED: "TED/DOC", CARTAO: "Cartão", DINHEIRO: "Dinheiro", CHEQUE: "Cheque" };
const TIPO = {
  ENTRADA: { t: "ENTRADA", s: "A PAGAR", c: C.red, bg: C.redSoft, I: ArrowDownLeft },
  SAIDA: { t: "SAÍDA", s: "A RECEBER", c: C.green, bg: C.greenSoft, I: ArrowUpRight },
};
const ST_PARC = { ABERTO: [C.blue, C.blueSoft, "aberto"], PAGO: [C.green, C.greenSoft, "baixado"], CANCELADO: [C.sub, C.panel2, "cancelado"], EXCLUIDA: [C.sub, C.panel2, "excluída"] };

// arquivos soltos (.xml / .pdf) ou compactados (.zip) → [{ nome, xml } | { nome, b64 }]
async function lerArquivos(files) {
  const out = [];
  for (const f of [...files]) {
    if (/\.zip$/i.test(f.name)) {
      const ent = unzipSync(new Uint8Array(await f.arrayBuffer()));
      for (const [nome, u8] of Object.entries(ent)) {
        const n = nome.split("/").pop();
        if (/\.xml$/i.test(n)) out.push({ nome: n, xml: new TextDecoder("utf-8").decode(u8) });
        else if (/\.pdf$/i.test(n)) out.push({ nome: n, b64: u8b64(u8) });
      }
    } else if (/\.xml$/i.test(f.name)) out.push({ nome: f.name, xml: await f.text() });
    else if (/\.pdf$/i.test(f.name)) out.push({ nome: f.name, b64: u8b64(new Uint8Array(await f.arrayBuffer())) });
  }
  return out;
}

// v159 — parcelas: ao mudar o valor de uma, o que falta para o total da nota é dividido igualmente entre as
// parcelas novas que ainda não foram digitadas à mão (centavos de arredondamento vão para a última).
// Parcelas ligadas/já lançadas contam como valor fixo. Sem nenhuma livre, a última parcela nova absorve a diferença.
export function redistribuir(parcelas, total, idx, valor) {
  const r2 = (x) => Math.round(Number(x || 0) * 100) / 100;
  const l = parcelas.map((p, k) => (k === idx ? { ...p, valor: r2(valor), editada: true } : { ...p }));
  const novas = l.map((p, k) => k).filter((k) => l[k].situacao === "NOVA");
  let livres = novas.filter((k) => k !== idx && !l[k].editada);
  if (!livres.length) { const ult = [...novas].reverse().find((k) => k !== idx); livres = ult != null ? [ult] : []; }
  if (!livres.length) return l;
  const fixo = l.reduce((s, p, k) => s + (livres.includes(k) ? 0 : Number(p.valor || 0)), 0);
  const resto = Math.max(0, Math.round((r2(total) - fixo) * 100));
  const base = Math.floor(resto / livres.length);
  livres.forEach((k, j) => { l[k].valor = (base + (j === livres.length - 1 ? resto - base * livres.length : 0)) / 100; });
  return l;
}
const totalParcelas = (n) => n.totalParcelas ?? (Math.round(n.parcelas.reduce((s, p) => s + Number(p.valor || 0), 0) * 100) / 100 || Number(n.valor || 0));

/* =================================================================== */
/* MOVIMENTO FISCAL                                                     */
/* =================================================================== */
export default function MovimentoFiscal({ user }) {
  const [de, setDe] = useState(iniMes());
  const [ate, setAte] = useState(fimMes());
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [importar, setImportar] = useState(null);   // null | [] (abre vazio) | arquivos soltos
  const [msg, setMsg] = useState("");

  const carregar = async () => {
    setErro("");
    try { setLista(await api(`/api/fiscal?u=${user.id}&de=${de}&ate=${ate}&tipo=${tipo}&busca=${encodeURIComponent(busca)}`)); }
    catch (e) { setErro(e.message); setLista([]); }
  };
  useEffect(() => { const t = setTimeout(carregar, 250); return () => clearTimeout(t); }, [de, ate, tipo, busca]);

  const tot = useMemo(() => {
    const l = lista || [];
    const s = (f) => l.filter(f).reduce((a, n) => a + n.valor, 0);
    const cont = (t) => l.filter((n) => n.tipo === t).flatMap((n) => n.parcelas).filter((p) => p.situacao === "CRIADA").length;
    return {
      ent: l.filter((n) => n.tipo === "ENTRADA").length, entV: s((n) => n.tipo === "ENTRADA"),
      sai: l.filter((n) => n.tipo === "SAIDA").length, saiV: s((n) => n.tipo === "SAIDA"),
      reg: l.filter((n) => n.acao === "REGISTRADA").length, pagar: cont("ENTRADA"), receber: cont("SAIDA"),
    };
  }, [lista]);

  const excluir = async (n) => {
    if (!confirm(`Excluir o registro da NF ${n.numero} (${n.parceiro})?\n\nAs contas criadas por esta importação vão para a lixeira do contas a pagar/receber.`)) return;
    try { const r = await api(`/api/fiscal/${n.id}`, "DELETE", { usuarioId: user.id }); setMsg(`NF ${n.numero} excluída${r.contas ? ` · ${r.contas} conta(s) na lixeira` : ""}.`); carregar(); }
    catch (e) { alert(e.message); }
  };
  const atalho = (k) => {
    const h = hojeISO();
    if (k === "mes") { setDe(iniMes()); setAte(fimMes()); }
    if (k === "ant") { const d = new Date(); const a = new Date(d.getFullYear(), d.getMonth() - 1, 1); const ini = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-01`; setDe(ini); setAte(`${ini.slice(0, 8)}${String(new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate()).padStart(2, "0")}`); }
    if (k === "ano") { setDe(`${h.slice(0, 4)}-01-01`); setAte(`${h.slice(0, 4)}-12-31`); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Movimento fiscal</div>
          <div className="text-xs" style={{ color: C.sub }}>NFs de entrada viram contas a pagar · NFs de saída viram contas a receber (XML e/ou PDF)</div>
        </div>
        {podeImportar(user, "nfEntrada", "contasPagar", "contasReceber", "faturamento") && <Soltar onArquivos={(f) => setImportar([...f])} dica="Solte aqui" className="rounded-xl">
          <BtnP onClick={() => setImportar([])}><Upload size={15} /> Importar NFs</BtnP>
        </Soltar>}
      </div>

      <Soltar onArquivos={(f) => { if (podeImportar(user, "nfEntrada", "contasPagar", "contasReceber", "faturamento")) setImportar([...f]); }} dica="Solte os XMLs/PDFs para importar">
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          {[
            ["NFs de entrada", tot.ent, moeda(tot.entV), C.red],
            ["NFs de saída", tot.sai, moeda(tot.saiV), C.green],
            ["Contas geradas", tot.pagar + tot.receber, `${tot.pagar} a pagar · ${tot.receber} a receber`, C.navy],
            ["Só registradas", tot.reg, "remessa, retorno, devolução…", C.sub],
          ].map(([t, v, s, c]) => (
            <div key={t} className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
              <div className="text-2xl font-bold" style={{ color: c }}>{v}</div>
              <div className="text-xs" style={{ color: C.sub }}>{s}</div>
            </div>
          ))}
        </div>
      </Soltar>

      <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="relative" style={{ width: 260 }}>
            <Search size={14} className="absolute left-2 top-2.5" style={{ color: C.sub }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nº, cliente/fornecedor, CNPJ, valor" className={inp} style={{ ...inpS, paddingLeft: 26 }} />
          </div>
          <span className="text-xs ml-2" style={{ color: C.sub }}>Emissão de</span>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="rounded px-2 py-1 text-xs" style={inpS} />
          <span className="text-xs" style={{ color: C.sub }}>até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="rounded px-2 py-1 text-xs" style={inpS} />
          <Chip onClick={() => atalho("mes")}>Mês</Chip><Chip onClick={() => atalho("ant")}>Mês anterior</Chip><Chip onClick={() => atalho("ano")}>Ano</Chip>
          <div className="flex gap-1 ml-auto">
            <Chip on={!tipo} onClick={() => setTipo("")}>Todas</Chip>
            <Chip on={tipo === "ENTRADA"} onClick={() => setTipo("ENTRADA")}>Entradas</Chip>
            <Chip on={tipo === "SAIDA"} onClick={() => setTipo("SAIDA")}>Saídas</Chip>
          </div>
        </div>
        {msg && <div className="mx-4 mt-3 p-2 rounded text-xs flex items-center gap-2" style={{ background: C.greenSoft, color: C.green }}><CheckCircle2 size={14} /> {msg}<button className="ml-auto" onClick={() => setMsg("")}><X size={13} /></button></div>}
        {erro && <div className="mx-4 mt-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: C.sub }}>
                {["Tipo", "Emissão", "Nota", "Cliente / fornecedor", "Natureza", "Valor", "Contas", "Arquivos", ""].map((h, i) => (
                  <th key={i} className={`px-3 py-2 font-semibold ${h === "Valor" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista === null && <tr><td colSpan={9} className="px-3 py-6 text-center" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin inline" /></td></tr>}
              {lista && !lista.length && <tr><td colSpan={9} className="px-3 py-8 text-center" style={{ color: C.sub }}>Nenhuma nota neste período. Use <b>Importar NFs</b> ou arraste os arquivos para os cards acima.</td></tr>}
              {(lista || []).map((n) => {
                const T = TIPO[n.tipo] || TIPO.ENTRADA;
                return (
                  <tr key={n.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td className="px-3 py-2"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ background: T.bg, color: T.c }}><T.I size={12} /> {T.t}</span></td>
                    <td className="px-3 py-2">{dBR(n.emissao)}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{n.modelo} {n.numero}{n.empresa === "NORT" && <span className="ml-1 px-1.5 rounded text-[10px]" style={{ background: C.roxoSoft, color: C.roxo }}>NORT</span>}</td>
                    <td className="px-3 py-2"><div className="font-semibold">{n.parceiro}</div><div style={{ color: C.sub }}>{fmtDoc(n.documento)}</div></td>
                    <td className="px-3 py-2" style={{ color: C.sub, maxWidth: 200 }}>{n.natureza || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{moeda(n.valor)}</td>
                    <td className="px-3 py-2">
                      {n.acao === "REGISTRADA"
                        ? <span className="px-2 py-0.5 rounded-full" style={{ background: C.panel2, color: C.sub }} title={n.motivo || ""}>só registro</span>
                        : <div className="flex flex-wrap gap-1">{n.parcelas.map((p, i) => {
                            const [c, bg, t] = ST_PARC[p.status] || ST_PARC.ABERTO;
                            return <span key={i} className="px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: bg, color: c }} title={p.situacao === "CRIADA" ? "conta criada por esta importação" : "ligada a conta que já existia"}>
                              {p.situacao !== "CRIADA" && <Link2 size={10} className="inline mr-0.5" />}{dBR(p.vencimento).slice(0, 5)} · {brl(p.valor)} · {t}</span>;
                          })}</div>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {n.temXml && <a href={`/api/fiscal/${n.id}?u=${user.id}&arq=xml&baixar=1`} className="inline-flex items-center gap-0.5 mr-2 font-semibold" style={{ color: C.blue }}><FileCode2 size={13} /> XML</a>}
                      {n.temPdf && <a href={`/api/fiscal/${n.id}?u=${user.id}&arq=pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-semibold" style={{ color: C.red }}><FileText size={13} /> PDF</a>}
                    </td>
                    <td className="px-3 py-2">{podeImportar(user, "nfEntrada", "contasPagar", "contasReceber", "faturamento") && <button onClick={() => excluir(n)} title="Excluir registro" style={{ color: C.sub }}><Trash2 size={14} /></button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {importar && <ImportarNfs user={user} iniciais={importar} onClose={() => setImportar(null)} onFim={(m) => { setImportar(null); setMsg(m); carregar(); }} />}
    </div>
  );
}

const DECISOES = [["LANCAR", "Lançar contas"], ["REGISTRAR", "Só registrar"], ["IGNORAR", "Ignorar"]];

// v162 — a importação fica aberta recebendo arquivos (arrastar várias vezes ou escolher), junta XML + PDF da mesma
// nota e só confere quando o usuário pede. Na conferência dá para soltar mais arquivos (o que já foi mexido é mantido)
// e gravar uma nota por vez ("Gravar esta") ou todas de uma vez.
const chaveNota = (n) => n.chaveRegistro || n.chave || n.xmlNome || n.pdfNome || "";
const tamArq = (a) => (a.xml != null ? a.xml.length : (a.b64 || "").length);
export function juntarNotas(antigas, novas) {
  const m = new Map((antigas || []).map((n) => [chaveNota(n), n]));
  return novas.map((n) => {
    const o = m.get(chaveNota(n));
    if (!o) return n;
    if (o.fonte === n.fonte) return o;                       // mesma nota, mesmos arquivos: mantém o que foi editado
    const rateio = (o.rateio || []).some((r) => r.contaId) ? o.rateio : n.rateio;
    return { ...n, aberta: o.aberta, rateio, titulo: o.titulo || n.titulo, decisao: n.existenteId ? n.decisao : o.decisao };
  });
}

export function ImportarNfs({ user, iniciais, onClose, onFim }) {
  const [arqs, setArqs] = useState([]);       // arquivos já lidos, aguardando conferência
  const [notas, setNotas] = useState(null);
  const [erros, setErros] = useState([]);
  const [contas, setContas] = useState([]);
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [feitas, setFeitas] = useState([]);   // notas gravadas uma a uma
  const [res, setRes] = useState(null);
  const leu = useRef(false);

  useEffect(() => { api(`/api/fin/contas?u=${user.id}`).then(setContas).catch(() => setContas([])); }, []);
  useEffect(() => { if (iniciais?.length && !leu.current) { leu.current = true; adicionar(iniciais); } }, []);

  const conferir = async (lista, antigas) => {
    if (!lista.length) { setNotas(antigas ? [] : null); return; }
    setErro(""); setSt(`Conferindo ${lista.length} arquivo(s)…`);
    try {
      const j = await api("/api/fiscal", "POST", { usuarioId: user.id, acao: "analisar", arquivos: lista.map(({ tam, ...a }) => a) });
      setErros(j.erros || []);
      const novas = (j.notas || []).map((n) => ({ ...n, aberta: n.decisao !== "IGNORAR", totalParcelas: totalParcelas(n) }));
      setNotas(antigas ? juntarNotas(antigas, novas) : novas);
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const adicionar = async (files) => {
    setErro(""); setSt("Lendo arquivos…");
    let lidos = [];
    try { lidos = await lerArquivos(files); } catch (e) { setErro(e.message); }
    setSt("");
    if (!lidos.length) { setErro("Nenhum XML ou PDF encontrado (aceita .xml, .pdf e .zip)."); return; }
    let lista = arqs;
    const chaves = new Set(arqs.map((a) => `${a.nome}|${a.tam}`));
    const novos = lidos.map((a) => ({ ...a, tam: tamArq(a) })).filter((a) => !chaves.has(`${a.nome}|${a.tam}`));
    lista = [...arqs, ...novos];
    setArqs(lista);
    if (notas && novos.length) await conferir(lista, notas);   // já na conferência: confere de novo mantendo as edições
  };
  const tirar = (k) => setArqs((l) => l.filter((_, j) => j !== k));

  const altN = (i, k, v) => setNotas((l) => l.map((n, j) => {
    if (j !== i) return n;
    if (k !== "valor") return { ...n, [k]: v };
    // valor da nota mudou (PDF): passa a ser o total e as parcelas não digitadas são refeitas
    const livres = n.parcelas.map((p, q) => q).filter((q) => n.parcelas[q].situacao === "NOVA" && !n.parcelas[q].editada);
    const parcelas = livres.length ? redistribuir(n.parcelas.map((p, q) => (q === livres[0] ? { ...p, editada: false } : p)), v, -1, 0) : n.parcelas;
    return { ...n, valor: v, totalParcelas: v, parcelas };
  }));
  // à vista: liga/desliga e acerta a data de pagamento; as parcelas novas vencem na data do pagamento
  const altVista = (i, mud) => setNotas((l) => l.map((n, j) => {
    if (j !== i) return n;
    const m = { ...n, ...mud };
    if (m.pagoVista && !m.formaPgto) m.formaPgto = "PIX";
    if (m.pagoVista && !m.dataPgto) m.dataPgto = m.emissao || hojeISO();
    if (m.pagoVista) m.parcelas = m.parcelas.map((p) => (p.situacao === "NOVA" ? { ...p, vencimento: m.dataPgto, semVencimento: false } : p));
    return m;
  }));
  const altValor = (i, pi, v) => setNotas((l) => l.map((n, j) => (j === i ? { ...n, parcelas: redistribuir(n.parcelas, totalParcelas(n), pi, v) } : n)));
  const altP = (i, pi, mud) => setNotas((l) => l.map((n, j) => (j === i ? { ...n, parcelas: n.parcelas.map((p, q) => (q === pi ? { ...p, ...mud } : p)) } : n)));

  const resumo = useMemo(() => {
    const l = notas || [];
    const lan = l.filter((n) => n.decisao === "LANCAR");
    const novas = (t) => lan.filter((n) => n.tipo === t).flatMap((n) => n.parcelas.filter((p) => p.marcado && p.situacao === "NOVA"));
    return {
      pagar: novas("ENTRADA"), receber: novas("SAIDA"),
      gravar: l.filter((n) => n.decisao !== "IGNORAR").length,
      semConta: lan.filter((n) => n.parcelas.some((p) => p.marcado && p.situacao === "NOVA") && !(n.rateio || []).some((r) => r.contaId)).length,
    };
  }, [notas]);

  const mandar = async (lote) => {
    try { return (await api("/api/fiscal", "POST", { usuarioId: user.id, acao: "gravar", notas: lote })).resultados || []; }
    catch (e) { return lote.map((n) => ({ numero: n.numero, situacao: "ERRO", motivo: e.message })); }
  };
  // tira da fila a nota gravada e os arquivos dela (para não voltar numa nova conferência)
  const tirarGravada = (n) => {
    const nomes = new Set([n.xmlNome, n.pdfNome].filter(Boolean));
    setArqs((l) => l.filter((a) => !nomes.has(a.nome)));
    setNotas((l) => l.filter((x) => x !== n));
  };
  const gravarUma = async (i) => {
    const n = notas[i]; setErro(""); setSt(`Gravando NF ${n.numero || ""}…`);
    const r = await mandar([n]);
    setSt("");
    if (r.some((x) => x.situacao === "ERRO")) { setErro(`NF ${n.numero}: ${r.find((x) => x.situacao === "ERRO").motivo}`); return; }
    setFeitas((f) => [...f, ...r]); tirarGravada(n);
  };
  const gravar = async () => {
    setErro("");
    const fila = (notas || []).filter((n) => n.decisao !== "IGNORAR");
    const out = [];
    for (let i = 0; i < fila.length; i += 8) {
      setSt(`Gravando ${Math.min(fila.length, i + 8)} de ${fila.length}…`);
      out.push(...(await mandar(fila.slice(i, i + 8))));
    }
    setSt(""); setRes([...feitas, ...out]);
  };
  const fechar = () => (feitas.length ? setRes(feitas) : onClose());

  if (res) {
    const c = (s) => res.filter((r) => r.situacao === s).length;
    const baixadas = res.reduce((s, r) => s + (r.baixadas || 0), 0);
    const criadas = res.reduce((s, r) => s + (r.criadas || 0), 0), ligadas = res.reduce((s, r) => s + (r.ligadas || 0), 0);
    const problemas = res.filter((r) => ["ERRO", "JA_IMPORTADA"].includes(r.situacao));
    const m = `${c("LANCADA")} NF(s) lançada(s) · ${criadas} conta(s) criada(s)${ligadas ? ` · ${ligadas} ligada(s) a contas existentes` : ""}${c("REGISTRADA") ? ` · ${c("REGISTRADA")} só registrada(s)` : ""}${c("COMPLETADA") ? ` · ${c("COMPLETADA")} completada(s)` : ""}${baixadas ? ` · ${baixadas} já baixada(s) (à vista)` : ""}.`;
    return (
      <Modal titulo="Importação concluída" icone={CheckCircle2} onClose={() => onFim(m)} largura={640}
        rodape={<BtnP onClick={() => onFim(m)}>Fechar</BtnP>}>
        <div className="text-sm mb-3">{m}</div>
        {problemas.length > 0 && (
          <div className="rounded-lg p-3 text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>
            {problemas.map((r, i) => <div key={i}>NF {r.numero}: {r.situacao === "JA_IMPORTADA" ? "já estava importada" : r.motivo}</div>)}
          </div>
        )}
      </Modal>
    );
  }

  const nX = arqs.filter((a) => a.xml != null).length, nP = arqs.length - nX;
  const contagem = `${arqs.length} arquivo(s) — ${nX} XML · ${nP} PDF`;
  const rodape = notas
    ? <>
        <span className="mr-auto text-xs" style={{ color: C.sub }}>
          {feitas.length > 0 && <b style={{ color: C.green }}>{feitas.length} gravada(s) · </b>}
          {resumo.pagar.length} a pagar ({moeda(resumo.pagar.reduce((s, p) => s + Number(p.valor || 0), 0))}) · {resumo.receber.length} a receber ({moeda(resumo.receber.reduce((s, p) => s + Number(p.valor || 0), 0))})
          {resumo.semConta > 0 && <span style={{ color: C.red }}> · {resumo.semConta} nota(s) sem conta-caixa</span>}
        </span>
        <button onClick={fechar} className="px-4 py-2 text-sm" style={{ color: C.sub }}>{feitas.length ? "Concluir" : "Cancelar"}</button>
        {resumo.gravar > 0 && <BtnP onClick={gravar} disabled={!!st}>{st && <Loader2 size={14} className="animate-spin" />} {st || `Gravar ${resumo.gravar === 1 ? "a nota" : `as ${resumo.gravar} notas`}`}</BtnP>}
      </>
    : <>
        <span className="mr-auto text-xs" style={{ color: C.sub }}>{arqs.length ? contagem : "Solte quantos arquivos quiser, em quantas vezes quiser."}</span>
        <button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button>
        <BtnP onClick={() => conferir(arqs)} disabled={!arqs.length || !!st}>{st && <Loader2 size={14} className="animate-spin" />} {st || `Conferir ${arqs.length} arquivo(s)`}</BtnP>
      </>;

  return (
    <Modal titulo="Importar NFs de entrada e saída" icone={Upload} onClose={fechar} largura={1040} rodape={rodape}>
      <Soltar onArquivos={adicionar} dica="Solte para adicionar">
        <label className={`flex items-center gap-3 rounded-xl cursor-pointer ${notas ? "px-4 py-2.5 mb-3" : "p-6"}`} style={{ border: `2px dashed ${C.line}` }}>
          <Upload size={notas ? 16 : 22} style={{ color: C.accent }} />
          {notas
            ? <div className="text-xs"><b>Adicionar mais arquivos</b> <span style={{ color: C.sub }}>— arraste aqui ou clique · {contagem}. O que você já conferiu é mantido.</span></div>
            : <div className="text-sm">
                <div className="font-semibold">Escolher ou arrastar NFs (XML, PDF ou .zip — pode misturar entrada e saída)</div>
                <div className="text-xs" style={{ color: C.sub }}>
                  Pode soltar várias vezes: os arquivos ficam juntos aqui até você clicar em <b>Conferir</b>.
                  O sistema identifica pelo CNPJ: Meridian/NORT emitente = <b>saída → contas a receber</b>; destinatária = <b>entrada → contas a pagar</b>.
                  XML e PDF da mesma nota juntos viram um registro só (o PDF fica anexado). PDF sozinho é lido e você confere os dados.
                </div>
              </div>}
          <input type="file" multiple accept=".xml,.pdf,.zip" className="hidden" onChange={(e) => { adicionar(e.target.files); e.target.value = ""; }} />
        </label>
      </Soltar>
      {!notas && arqs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {arqs.map((a, k) => {
            const I = a.xml != null ? FileCode2 : FileText;
            return (
              <span key={k} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg text-[11px]" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}` }}>
                <I size={12} style={{ color: a.xml != null ? C.blue : C.red }} /> {a.nome}
                <button onClick={() => tirar(k)} className="p-0.5 rounded" style={{ color: C.sub }} title="Tirar da lista"><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}
      {st && <div className="flex items-center gap-2 my-3 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> {st}</div>}
      {erro && <div className="my-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {notas && erros.length > 0 && <div className="mb-3 p-2 rounded text-xs" style={{ background: C.yellowSoft, color: C.yellow }}>{erros.map((e, i) => <div key={i}>{e}</div>)}</div>}
      {notas && !notas.length && <div className="text-sm" style={{ color: C.sub }}>{feitas.length ? `Todas as notas foram gravadas (${feitas.length}). Solte mais arquivos ou clique em Concluir.` : "Nenhuma nota reconhecida."}</div>}
      {notas && notas.map((n, i) => <NotaConferencia key={chaveNota(n) || i} n={n} i={i} contas={contas} altN={altN} altP={altP} altValor={altValor} altVista={altVista} onGravar={st ? null : () => gravarUma(i)} />)}
    </Modal>
  );
}

function NotaConferencia({ n, i, contas, altN, altP, altValor, altVista, onGravar }) {
  const somaP = Math.round(n.parcelas.reduce((s, p) => s + Number(p.valor || 0), 0) * 100) / 100;
  const totP = totalParcelas(n);
  const difP = Math.round((somaP - totP) * 100) / 100;
  const T = TIPO[n.tipo] || TIPO.ENTRADA;
  const pdf = n.fonte === "PDF";
  const ign = n.decisao === "IGNORAR";
  const avisos = [n.aviso, n.conferir, n.motivoSemConta && `sugestão: só registrar — ${n.motivoSemConta}`,
    n.existenteId && (n.existenteFalta ? `já importada — este envio completa o ${n.existenteFalta}` : "já importada")].filter(Boolean);
  const decisoes = n.existenteId ? (n.existenteFalta ? [["COMPLETAR", `Completar ${n.existenteFalta}`], ["IGNORAR", "Ignorar"]] : [["IGNORAR", "Ignorar"]]) : DECISOES;
  return (
    <div className="rounded-xl mb-3" style={{ border: `1px solid ${C.line}`, opacity: ign ? 0.6 : 1 }}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs" style={{ borderBottom: n.aberta ? `1px solid ${C.line}` : "none", background: C.panel2, borderRadius: n.aberta ? "12px 12px 0 0" : 12 }}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ background: T.bg, color: T.c }}><T.I size={12} /> {T.t} → {T.s}</span>
        <span className="font-semibold">{n.modelo} {n.numero || "?"}</span>
        {n.empresa === "NORT" && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: C.roxoSoft, color: C.roxo }}>NORT</span>}
        <span style={{ color: C.sub }}>{n.parceiro || "sem nome"} · {fmtDoc(n.documento)} · emissão {dBR(n.emissao)} · <b style={{ color: C.text }}>{moeda(n.valor)}</b></span>
        <span className="px-1.5 rounded text-[10px]" style={{ background: "#fff", color: C.sub, border: `1px solid ${C.line}` }}>{n.fonte}</span>
        {n.existenteId && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: C.blueSoft, color: C.blue }}>{n.existenteFalta ? `já importada · falta ${n.existenteFalta}` : "já importada"}</span>}
        <div className="ml-auto flex gap-1">
          {decisoes.map(([k, t]) => (
            <button key={k} onClick={() => altN(i, "decisao", k)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{ background: n.decisao === k ? (k === "LANCAR" ? C.accent : C.navy) : "#fff", color: n.decisao === k ? "#fff" : C.sub, border: `1px solid ${C.line}` }}>{t}</button>
          ))}
          <button onClick={() => altN(i, "aberta", !n.aberta)} className="px-2 text-[11px]" style={{ color: C.sub }}>{n.aberta ? "fechar" : "abrir"}</button>
          {!ign && onGravar && <button onClick={onGravar} className="ml-1 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white" style={{ background: C.green }} title="Grava só esta nota agora">Gravar esta</button>}
        </div>
      </div>
      {n.aberta && (
        <div className="p-4">
          {avisos.length > 0 && <div className="mb-3 p-2 rounded text-xs flex gap-2" style={{ background: C.yellowSoft, color: C.yellow }}><AlertTriangle size={14} className="shrink-0" /><div>{avisos.map((a, k) => <div key={k}>{a}</div>)}</div></div>}
          {["LANCAR", "REGISTRAR"].includes(n.decisao) && (
            <>
              {pdf && (
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "150px 110px 140px 150px 1fr" }}>
                  <Campo t="Tipo">
                    <select value={n.tipo} onChange={(e) => altN(i, "tipo", e.target.value)} className={inp} style={inpS}>
                      <option value="ENTRADA">Entrada (pagar)</option><option value="SAIDA">Saída (receber)</option>
                    </select></Campo>
                  <Campo t="Nº da nota"><input value={n.numero || ""} onChange={(e) => altN(i, "numero", e.target.value.replace(/\D/g, ""))} className={inp} style={inpS} /></Campo>
                  <Campo t="Emissão"><input type="date" value={n.emissao || ""} onChange={(e) => altN(i, "emissao", e.target.value)} className={inp} style={inpS} /></Campo>
                  <Campo t="Valor da nota"><Valor value={n.valor} onChange={(v) => altN(i, "valor", v)} width="100%" /></Campo>
                  <Campo t={`CNPJ/CPF do ${n.tipo === "SAIDA" ? "cliente" : "fornecedor"}`}><input value={fmtDoc(n.documento)} onChange={(e) => altN(i, "documento", e.target.value.replace(/\D/g, ""))} className={inp} style={inpS} /></Campo>
                </div>
              )}
              <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Campo t={n.tipo === "SAIDA" ? "Cliente" : "Fornecedor"}><input value={n.parceiro || ""} onChange={(e) => altN(i, "parceiro", e.target.value.toUpperCase())} className={inp} style={{ ...inpS, borderColor: n.parceiro ? C.line : C.yellow }} /></Campo>
                {n.decisao === "LANCAR" && <Campo t="Título da conta"><input value={n.titulo || ""} onChange={(e) => altN(i, "titulo", e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo>}
              </div>
            </>
          )}
          {n.decisao === "LANCAR" && (
            <>
              <Campo t={`Conta-caixa${n.rateioOrigem ? ` · sugerida: ${n.rateioOrigem.toLowerCase()}` : ""}`}>
                <Rateio contas={contas} valor={n.valor} value={n.rateio} onChange={(v) => altN(i, "rateio", v)} />
              </Campo>
              {n.parcelas.some((p) => p.marcado && p.situacao === "NOVA") && (
                <div className="mt-3 flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg text-xs" style={{ background: n.pagoVista ? C.greenSoft : C.panel2, border: `1px solid ${n.pagoVista ? C.green : C.line}` }}>
                  <label className="flex items-center gap-2 font-semibold cursor-pointer" style={{ color: n.pagoVista ? C.green : C.text }}>
                    <input type="checkbox" checked={!!n.pagoVista} onChange={(e) => altVista(i, { pagoVista: e.target.checked })} />
                    {n.tipo === "SAIDA" ? "Recebida à vista — importar e baixar" : "Paga à vista — importar e baixar"}
                  </label>
                  {n.pagoVista && <>
                    <span className="flex items-center gap-1.5" style={{ color: C.sub }}>Forma
                      <select value={n.formaPgto || ""} onChange={(e) => altVista(i, { formaPgto: e.target.value })} className="rounded px-2 py-1 text-xs" style={inpS}>
                        {Object.entries(FORMAS_PGTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select></span>
                    <span className="flex items-center gap-1.5" style={{ color: C.sub }}>Data do {n.tipo === "SAIDA" ? "recebimento" : "pagamento"}
                      <input type="date" value={n.dataPgto || ""} onChange={(e) => altVista(i, { dataPgto: e.target.value })} className="rounded px-2 py-1 text-xs" style={inpS} /></span>
                    <span style={{ color: C.green }}>as contas novas já entram baixadas</span>
                  </>}
                </div>
              )}
              <table className="w-full text-xs mt-3">
                <thead><tr style={{ color: C.sub }}><th /><th className="text-left px-2 py-1">Parcela</th><th className="text-left px-2 py-1">Vencimento</th><th className="text-right px-2 py-1">Valor</th><th className="text-left px-2 py-1">Situação</th></tr></thead>
                <tbody>{n.parcelas.map((p, pi) => (
                  <tr key={pi} style={{ borderTop: `1px solid ${C.line}`, opacity: p.marcado ? 1 : 0.5 }}>
                    <td className="px-2 py-1"><input type="checkbox" checked={!!p.marcado} onChange={(e) => altP(i, pi, { marcado: e.target.checked })} /></td>
                    <td className="px-2 py-1">{p.parcela}</td>
                    <td className="px-2 py-1">{p.situacao === "NOVA"
                      ? <input type="date" value={p.vencimento || ""} onChange={(e) => altP(i, pi, { vencimento: e.target.value, semVencimento: false })} className="rounded px-2 py-1 text-xs" style={{ ...inpS, borderColor: p.semVencimento ? C.yellow : C.line }} />
                      : dBR(p.vencimento)}</td>
                    <td className="px-2 py-1 text-right">{p.situacao === "NOVA" ? <Valor value={p.valor} onChange={(v) => altValor(i, pi, v)} /> : moeda(p.valor)}</td>
                    <td className="px-2 py-1 text-[11px]">
                      {p.situacao === "NOVA" && <span style={{ color: p.semVencimento ? C.yellow : C.green }}>{p.semVencimento ? "nota sem vencimento — confira a data" : n.pagoVista ? "conta nova · já baixada" : "conta nova"}</span>}
                      {p.situacao === "JA_LANCADA" && <span style={{ color: C.blue }}><Link2 size={11} className="inline" /> já lançada: {p.tituloDesc} — só anexa os arquivos</span>}
                      {p.situacao === "LIGAR" && <span style={{ color: C.blue }}><Link2 size={11} className="inline" /> parece com {p.tituloDesc} — liga e anexa
                        <button onClick={() => altP(i, pi, { situacao: "NOVA", tituloId: null })} className="ml-2 underline" style={{ color: C.accent }}>criar conta nova</button></span>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
              {n.parcelas.length > 1 && (
                <div className="text-[11px] text-right mt-1" style={{ color: Math.abs(difP) > 0.009 ? C.red : C.sub }}>
                  Soma das parcelas {moeda(somaP)} de {moeda(totP)}{Math.abs(difP) > 0.009 ? ` · diferença ${moeda(difP)}` : " · confere"}
                </div>
              )}
            </>
          )}
          {n.decisao === "REGISTRAR" && <div className="text-xs" style={{ color: C.sub }}>A nota fica registrada no movimento fiscal (com os arquivos), sem gerar conta.</div>}
          {n.decisao === "COMPLETAR" && <div className="text-xs" style={{ color: C.sub }}>O {n.existenteFalta} entra no registro que já existe e é anexado às contas dele.</div>}
        </div>
      )}
    </div>
  );
}

/* =================================================================== */
/* DEMANDAS ADM                                                         */
/* =================================================================== */
const COLS = [["A_FAZER", "A fazer", C.blue], ["FAZENDO", "Em andamento", C.yellow], ["CONCLUIDA", "Concluídas", C.green]];

export function DemandasAdm({ user, master }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [modo, setModo] = useState("lista");
  const [ver, setVer] = useState("ABERTAS");
  const [editar, setEditar] = useState(null);     // {} nova | demanda
  const [concluir, setConcluir] = useState(null);
  const [abrir, setAbrir] = useState(null);

  const carregar = async () => { try { setD(await api(`/api/adm/demandas?u=${user.id}`)); } catch (e) { setErro(e.message); setD({ demandas: [], equipe: [] }); } };
  useEffect(() => { carregar(); }, []);

  const mudar = async (dm, status) => {
    if (status === "CONCLUIDA") { setConcluir(dm); return; }
    try { await api(`/api/adm/demandas/${dm.id}`, "PATCH", { usuarioId: user.id, status }); carregar(); } catch (e) { alert(e.message); }
  };
  const excluir = async (dm) => {
    if (!confirm(`Excluir a demanda "${dm.titulo}"?`)) return;
    try { await api(`/api/adm/demandas/${dm.id}`, "DELETE", { usuarioId: user.id }); setAbrir(null); carregar(); } catch (e) { alert(e.message); }
  };
  const todas = d?.demandas || [];
  const lista = todas.filter((x) => ver === "TODAS" || (ver === "ABERTAS" ? x.status !== "CONCLUIDA" : x.status === "CONCLUIDA"));
  const hoje = hojeISO();
  const atrasadas = todas.filter((x) => x.status !== "CONCLUIDA" && x.prazo && x.prazo < hoje).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Demandas ADM</div>
          <div className="text-xs" style={{ color: C.sub }}>
            {todas.filter((x) => x.status !== "CONCLUIDA").length} em aberto{atrasadas ? <span style={{ color: C.red }}> · {atrasadas} atrasada(s)</span> : ""} · {todas.filter((x) => x.status === "CONCLUIDA").length} concluída(s)
          </div>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
          {[["lista", List, "Lista"], ["quadro", Columns3, "Quadro"]].map(([k, I, t]) => (
            <button key={k} onClick={() => setModo(k)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold" style={{ background: modo === k ? C.navy : C.panel, color: modo === k ? "#fff" : C.sub }}><I size={13} /> {t}</button>
          ))}
        </div>
        {master && <BtnP onClick={() => setEditar({})}><Plus size={15} /> Nova demanda</BtnP>}
      </div>
      {erro && <div className="mb-3 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && <Loader2 size={18} className="animate-spin" style={{ color: C.sub }} />}

      {d && modo === "lista" && (
        <div className="rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex gap-1 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
            {[["ABERTAS", "Em aberto"], ["CONCLUIDAS", "Concluídas"], ["TODAS", "Todas"]].map(([k, t]) => <Chip key={k} on={ver === k} onClick={() => setVer(k)}>{t}</Chip>)}
          </div>
          {COLS.filter(([k]) => lista.some((x) => x.status === k)).map(([k, t, cor]) => (
            <div key={k}>
              <div className="px-4 pt-3 pb-1 text-xs font-bold uppercase" style={{ color: cor }}>{t} · {lista.filter((x) => x.status === k).length}</div>
              {lista.filter((x) => x.status === k).map((x) => <LinhaDemanda key={x.id} x={x} hoje={hoje} onAbrir={() => setAbrir(x)} onMudar={mudar} />)}
            </div>
          ))}
          {!lista.length && <div className="px-4 py-8 text-center text-xs" style={{ color: C.sub }}>{master ? "Nenhuma demanda aqui. Crie em Nova demanda." : "Nenhuma demanda para você."}</div>}
        </div>
      )}

      {d && modo === "quadro" && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(240px, 1fr))" }}>
          {COLS.map(([k, t, cor]) => {
            const col = todas.filter((x) => x.status === k);
            return (
              <div key={k} className="rounded-xl p-3" style={{ background: C.panel2 }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = Number(e.dataTransfer.getData("text/plain")); const dm = todas.find((x) => x.id === id); if (dm && dm.status !== k) mudar(dm, k); }}>
                <div className="flex items-center gap-2 mb-2 text-sm font-semibold"><span className="w-2 h-2 rounded-full" style={{ background: cor }} /> {t} <span style={{ color: C.sub }}>{col.length}</span></div>
                {col.map((x) => (
                  <div key={x.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(x.id))} onClick={() => setAbrir(x)}
                    className="rounded-lg p-3 mb-2 cursor-pointer hover:shadow" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                    <div className="text-sm font-semibold" style={{ textDecoration: x.status === "CONCLUIDA" ? "line-through" : "none" }}>{x.titulo}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]" style={{ color: C.sub }}>
                      {x.prioridade === "URGENTE" && <span className="px-1.5 rounded font-semibold" style={{ background: C.redSoft, color: C.red }}>URGENTE</span>}
                      <Prazo x={x} hoje={hoje} />
                      <span>{x.responsavelNome || "ADMINISTRATIVO"}</span>
                    </div>
                  </div>
                ))}
                {!col.length && <div className="text-[11px] text-center py-4" style={{ color: C.sub }}>arraste para cá</div>}
              </div>
            );
          })}
        </div>
      )}

      {editar && <DemandaModal user={user} dm={editar} equipe={d?.equipe || []} onClose={() => setEditar(null)} onOk={() => { setEditar(null); carregar(); }} />}
      {concluir && <ConcluirModal user={user} dm={concluir} onClose={() => setConcluir(null)} onOk={() => { setConcluir(null); setAbrir(null); carregar(); }} />}
      {abrir && (
        <Modal titulo={abrir.titulo} icone={Flag} onClose={() => setAbrir(null)} largura={560}
          rodape={<>
            {master && <button onClick={() => excluir(abrir)} className="mr-auto text-xs flex items-center gap-1" style={{ color: C.red }}><Trash2 size={13} /> Excluir</button>}
            {master && <button onClick={() => { setEditar(abrir); setAbrir(null); }} className="px-3 py-2 text-sm flex items-center gap-1" style={{ color: C.sub }}><Pencil size={13} /> Editar</button>}
            {abrir.status === "A_FAZER" && <button onClick={() => { mudar(abrir, "FAZENDO"); setAbrir(null); }} className="px-3 py-2 text-sm font-semibold" style={{ color: C.yellow }}>Iniciar</button>}
            {abrir.status !== "CONCLUIDA" ? <BtnP onClick={() => mudar(abrir, "CONCLUIDA")}><CheckCircle2 size={15} /> Concluir</BtnP>
              : <button onClick={() => { mudar(abrir, "A_FAZER"); setAbrir(null); }} className="px-3 py-2 text-sm font-semibold" style={{ color: C.sub }}>Reabrir</button>}
          </>}>
          <div className="flex flex-wrap gap-3 text-xs mb-3" style={{ color: C.sub }}>
            {abrir.prioridade === "URGENTE" && <span className="px-1.5 rounded font-semibold" style={{ background: C.redSoft, color: C.red }}>URGENTE</span>}
            <Prazo x={abrir} hoje={hoje} />
            <span>Responsável: <b style={{ color: C.text }}>{abrir.responsavelNome || "TODO O ADMINISTRATIVO"}</b></span>
            <span>Criada por {abrir.criadoPorNome} em {dBR(abrir.createdAt)}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap mb-3">{abrir.descricao || <span style={{ color: C.sub }}>Sem descrição.</span>}</div>
          {abrir.status === "CONCLUIDA" && (
            <div className="rounded-lg p-3 text-sm" style={{ background: C.greenSoft }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: C.green }}>RETORNO · {abrir.concluidaPorNome} em {dBR(abrir.concluidaEm)}</div>
              <div className="whitespace-pre-wrap">{abrir.retorno}</div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Prazo({ x, hoje }) {
  if (!x.prazo) return <span>sem prazo</span>;
  const atras = x.status !== "CONCLUIDA" && x.prazo < hoje;
  const hj = x.prazo === hoje;
  return <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: atras ? C.red : hj ? C.green : C.sub }}><CalendarDays size={11} /> {hj ? "Hoje" : dBR(x.prazo)}{atras ? " · atrasada" : ""}</span>;
}

function LinhaDemanda({ x, hoje, onAbrir, onMudar }) {
  const feita = x.status === "CONCLUIDA";
  return (
    <div className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50" style={{ borderTop: `1px solid ${C.line}` }}>
      <button onClick={() => onMudar(x, feita ? "A_FAZER" : "CONCLUIDA")} title={feita ? "Reabrir" : "Concluir"} style={{ color: feita ? C.green : C.sub }}>
        {feita ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </button>
      <button onClick={onAbrir} className="flex-1 text-left text-sm" style={{ textDecoration: feita ? "line-through" : "none", color: feita ? C.sub : C.text }}>
        {x.titulo}{x.descricao && <span className="ml-2 text-xs" style={{ color: C.sub }}>· {x.descricao.slice(0, 80)}{x.descricao.length > 80 ? "…" : ""}</span>}
      </button>
      {x.prioridade === "URGENTE" && <span className="px-1.5 rounded text-[10px] font-semibold" style={{ background: C.redSoft, color: C.red }}>URGENTE</span>}
      <span className="text-xs w-40 truncate" style={{ color: C.sub }}>{x.responsavelNome || "ADMINISTRATIVO"}</span>
      <span className="text-xs w-28"><Prazo x={x} hoje={hoje} /></span>
      {x.status === "A_FAZER" && <button onClick={() => onMudar(x, "FAZENDO")} title="Iniciar" style={{ color: C.yellow }}><CirclePlay size={16} /></button>}
    </div>
  );
}

function DemandaModal({ user, dm, equipe, onClose, onOk }) {
  const [f, setF] = useState({ titulo: dm.titulo || "", descricao: dm.descricao || "", prazo: dm.prazo || "", prioridade: dm.prioridade || "NORMAL", responsavelId: dm.responsavelId || "" });
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const salvar = async () => {
    setSt(true); setErro("");
    try {
      const body = { usuarioId: user.id, ...f, responsavelId: f.responsavelId ? Number(f.responsavelId) : null };
      if (dm.id) await api(`/api/adm/demandas/${dm.id}`, "PATCH", body); else await api("/api/adm/demandas", "POST", body);
      onOk();
    } catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Modal titulo={dm.id ? "Editar demanda" : "Nova demanda"} icone={Flag} onClose={onClose} largura={560}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button><BtnP onClick={salvar} disabled={st || !f.titulo.trim()}>{st && <Loader2 size={14} className="animate-spin" />} Salvar</BtnP></>}>
      <div className="grid gap-3">
        <Campo t="O que precisa ser feito"><input autoFocus value={f.titulo} onChange={(e) => set("titulo", e.target.value.toUpperCase())} className={inp} style={inpS} /></Campo>
        <Campo t="Detalhes"><textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={4} className={inp} style={inpS} /></Campo>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 150px 150px" }}>
          <Campo t="Responsável">
            <select value={f.responsavelId} onChange={(e) => set("responsavelId", e.target.value)} className={inp} style={inpS}>
              <option value="">Todo o administrativo</option>
              {equipe.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </Campo>
          <Campo t="Prazo"><input type="date" value={f.prazo} onChange={(e) => set("prazo", e.target.value)} className={inp} style={inpS} /></Campo>
          <Campo t="Prioridade">
            <select value={f.prioridade} onChange={(e) => set("prioridade", e.target.value)} className={inp} style={inpS}>
              <option value="NORMAL">Normal</option><option value="URGENTE">Urgente</option>
            </select>
          </Campo>
        </div>
        {!equipe.length && <div className="text-xs" style={{ color: C.yellow }}>Nenhum usuário no setor ADMINISTRATIVO ainda — crie em Usuários para a auxiliar receber as demandas.</div>}
        {erro && <div className="p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      </div>
    </Modal>
  );
}

function ConcluirModal({ user, dm, onClose, onOk }) {
  const [ret, setRet] = useState(dm.retorno || "");
  const [st, setSt] = useState(false);
  const [erro, setErro] = useState("");
  const ok = async () => {
    setSt(true); setErro("");
    try { await api(`/api/adm/demandas/${dm.id}`, "PATCH", { usuarioId: user.id, status: "CONCLUIDA", retorno: ret }); onOk(); }
    catch (e) { setErro(e.message); setSt(false); }
  };
  return (
    <Modal titulo={`Concluir: ${dm.titulo}`} icone={CheckCircle2} onClose={onClose} largura={520}
      rodape={<><button onClick={onClose} className="px-4 py-2 text-sm" style={{ color: C.sub }}>Cancelar</button><BtnP onClick={ok} disabled={st || !ret.trim()}>{st && <Loader2 size={14} className="animate-spin" />} Concluir</BtnP></>}>
      <Campo t="Retorno: o que foi feito (o financeiro recebe esta mensagem)"><textarea autoFocus value={ret} onChange={(e) => setRet(e.target.value)} rows={4} className={inp} style={inpS} /></Campo>
      {erro && <div className="mt-2 p-2 rounded text-xs" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
    </Modal>
  );
}

/* =================================================================== */
/* LOGÍSTICA › ROTA                                                     */
/* =================================================================== */
export function Rota() {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: C.panel, border: `1px dashed ${C.line}` }}>
      <IcoRota size={34} style={{ color: C.accent }} className="mx-auto" />
      <div className="text-lg font-bold mt-2" style={{ color: C.navy }}>Rota</div>
      <div className="text-sm mt-1" style={{ color: C.sub }}>Em construção — aqui vão entrar as rotas de entrega e coleta (motorista, paradas, pedidos e retorno).</div>
      <div className="inline-flex items-center gap-1 text-xs mt-3 px-3 py-1 rounded-full" style={{ background: C.panel2, color: C.sub }}><Truck size={13} /> próximas demandas da logística</div>
    </div>
  );
}
