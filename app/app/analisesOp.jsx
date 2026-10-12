"use client";
// v182 — Produção › Análises operacionais. Corte: custo do setor (pessoal pela Matriz + freelancers identificados) ÷ peças processadas,
// comparado com a meta (peças estimadas) e com o custo de terceirizar. Mesma mecânica da planilha "Análise Corte".
import React, { useState, useEffect, useRef } from "react";
import { Upload, Loader2, Save, Scissors, AlertTriangle, ChevronDown, ChevronRight, Construction } from "lucide-react";
import { CoresContas as C } from "./contas";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (c) => (c ? `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}` : "");
const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n2 = (v, d = 2) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 1) => `${n2((Number(v) || 0) * 100, d)}%`;
const int = (v) => (Number(v) || 0).toLocaleString("pt-BR");
const mesAnterior = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const readB64 = (f) => new Promise((res, rej) => { const fr = new FileReader(); fr.onerror = rej; fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.readAsDataURL(f); });
async function api(url, method = "GET", body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro");
  return j;
}

export function EmConstrucaoOp({ titulo, texto }) {
  return (
    <div className="rounded-xl p-8 text-center" style={{ background: C.panel, border: `1px dashed ${C.line}` }}>
      <Construction size={30} className="mx-auto mb-2" style={{ color: C.accent }} />
      <div className="font-bold" style={{ color: C.navy }}>{titulo}</div>
      <div className="text-sm mt-1" style={{ color: C.sub }}>{texto || "Análise em construção. Mande a planilha que vocês usam hoje para eu montar no mesmo formato do corte."}</div>
    </div>
  );
}

const Kpi = ({ t, v, sub, cor }) => (
  <div className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
    <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
    <div className="text-lg font-bold tabular-nums" style={{ color: cor || C.navy }}>{v}</div>
    {sub && <div className="text-[11px]" style={{ color: C.sub }}>{sub}</div>}
  </div>
);
const inp = "rounded px-2 py-1 text-sm text-right tabular-nums";
const inpS = { border: `1px solid ${C.line}`, background: "#fff", color: C.text };

export default function AnaliseCorte({ user }) {
  const [comp, setComp] = useState(null);
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);          // campos editáveis
  const [st, setSt] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [verDet, setVerDet] = useState(false);
  const inpRef = useRef(null);

  const carregar = async (c) => {
    setErro("");
    try {
      const j = await api(`/api/producao/analises?u=${user.id}&setor=CORTE${c ? `&competencia=${c}` : ""}`);
      if (!c) { const ult = j.competencias[j.competencias.length - 1] || mesAnterior(); setComp(ult); return; }
      setD(j);
      const a = j.analise;
      setF(a ? {
        qtds: { ...(a.qtds || {}) }, mercado: { ...(j.calc ? Object.fromEntries(j.calc.categorias.map((x) => [x.k, x.mercado])) : {}) },
        pecasEstimadas: a.pecasEstimadas ?? 13000, custoMeta: a.custoMeta ?? "", pessoalManual: a.pessoalManual ?? "", freelancerManual: a.freelancerManual ?? "",
        meta: a.meta || "", causas: a.causas || "", providencias: a.providencias || "",
      } : null);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { carregar(null); }, []);
  useEffect(() => { if (comp) carregar(comp); }, [comp]);

  const importar = async (files) => {
    const file = [...(files || [])][0];
    if (!file) return;
    setSt("Lendo a planilha…"); setErro(""); setAviso("");
    try {
      const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, acao: "importar", nome: file.name, conteudo: await readB64(file), competencia: comp });
      setAviso(j.tipo === "HISTORICO"
        ? `Histórico importado: ${j.meses.length} mês(es) — ${j.meses.map((m) => `${nomeMes(m.competencia)} (${int(m.total)} pç${m.preservado ? ", peças da exportação mantidas" : ""})`).join(", ")}.`
        : `${nomeMes(j.meses[0].competencia)}: ${int(j.meses[0].total)} peças importadas${j.meses[0].semCategoria ? ` · ${int(j.meses[0].semCategoria)} sem categoria ficaram fora` : ""}.`);
      const alvo = j.tipo === "HISTORICO" ? j.meses[j.meses.length - 1].competencia : j.meses[0].competencia;
      if (alvo === comp) carregar(comp); else setComp(alvo);
    } catch (e) { setErro(e.message); }
    setSt("");
  };
  const salvar = async () => {
    setSt("Salvando…"); setErro("");
    try { const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, acao: "salvar", competencia: comp, campos: f }); setD(j); setAviso("Análise salva."); setTimeout(() => setAviso(""), 2500); }
    catch (e) { setErro(e.message); }
    setSt("");
  };
  const criarVazia = async () => {
    setSt("Criando…");
    try { const j = await api("/api/producao/analises", "POST", { usuarioId: user.id, acao: "salvar", competencia: comp, campos: { pecasEstimadas: 13000 } }); setD(j); carregar(comp); } catch (e) { setErro(e.message); }
    setSt("");
  };
  const s = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const sQ = (k, v) => setF((x) => ({ ...x, qtds: { ...x.qtds, [k]: v } }));
  const sM = (k, v) => setF((x) => ({ ...x, mercado: { ...x.mercado, [k]: v } }));

  const c = d?.calc;
  const meses = [...new Set([...(d?.competencias || []), comp].filter(Boolean))].sort().reverse();
  const bom = c && c.incorrido <= c.estimado;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 mr-2"><Scissors size={20} style={{ color: C.accent }} /><div className="text-lg font-bold" style={{ color: C.navy }}>Análise do corte</div></div>
        <select value={comp || ""} onChange={(e) => setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inpS}>
          {meses.map((m) => <option key={m} value={m}>{nomeMes(m)}</option>)}
        </select>
        <input type="month" value={comp || ""} onChange={(e) => e.target.value && setComp(e.target.value)} className="rounded-lg px-2 py-1.5 text-sm" style={inpS} title="Outro mês" />
        <div className="flex-1" />
        <input ref={inpRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { importar(e.target.files); e.target.value = ""; }} />
        <button onClick={() => inpRef.current?.click()} disabled={!!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>
          {st ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar planilha do corte
        </button>
        {f && <button onClick={salvar} disabled={!!st} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.line}`, background: C.panel, color: C.navy }}><Save size={14} /> Salvar</button>}
      </div>
      <div className="text-[11px] mb-3" style={{ color: C.sub }}>
        Importe a exportação do sistema de produção (<i>analise-corte_AAAA-MM-DD_a_AAAA-MM-DD.xlsx</i>) — o mês vem do nome do arquivo — ou a planilha histórica do ano (uma aba por mês).
      </div>
      {erro && <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {aviso && <div className="p-2.5 rounded-lg mb-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>{aviso}</div>}
      {!d && !erro && <div style={{ color: C.sub }}>Carregando…</div>}
      {/* v182.1 — resumo do ano: todos os meses importados */}
      {d?.serie?.length > 0 && (
        <div className="rounded-xl p-4 mb-4 overflow-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Ano {comp?.slice(0, 4)} · {d.serie.length} mês(es) com análise</div>
          <table className="w-full text-xs">
            <thead><tr style={{ color: C.sub }}>{["Mês", "Peças", "Pessoal", "Freelancers", "Custo do setor", "Incorrido/pç", "Estimado/pç", "Resultado", ""].map((h, i) => <th key={i} className={`py-1 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>{d.serie.map((x) => { const ok = x.incorrido <= x.estimado; const sel = x.competencia === comp; return (
              <tr key={x.competencia} onClick={() => setComp(x.competencia)} className="cursor-pointer" style={{ borderTop: `1px solid ${C.line}`, background: sel ? C.panel2 : "transparent", fontWeight: sel ? 700 : 400 }}>
                <td className="py-1.5" style={{ color: sel ? C.accent : C.text }}>{nomeMes(x.competencia)}</td>
                <td className="text-right tabular-nums">{int(x.pecas)}</td>
                <td className="text-right tabular-nums" title={x.fontePessoal === "PLANILHA" ? "da planilha" : "Matriz de custos"}>{x.pessoal ? brl(x.pessoal) : "—"}{x.fontePessoal === "PLANILHA" && <span style={{ color: C.sub }}> ·P</span>}</td>
                <td className="text-right tabular-nums" title={x.fonteFree === "PLANILHA" ? `planilha ${brl(x.freelancer)} × sistema ${brl(x.freeSistema)}` : "identificados no sistema"}>
                  {brl(x.freelancer)}{x.fonteFree === "PLANILHA" && <span style={{ color: C.sub }}> ·P</span>}
                  {Math.abs(x.difFree) >= 1 && <div className="text-[10px] font-semibold" style={{ color: C.yellow }}>sistema {brl(x.freeSistema)} ({x.difFree > 0 ? "+" : "−"}{brl(Math.abs(x.difFree))})</div>}
                </td>
                <td className="text-right tabular-nums">{x.custoTotal ? brl(x.custoTotal) : "—"}</td>
                <td className="text-right tabular-nums">{x.incorrido ? brl(x.incorrido) : "—"}</td>
                <td className="text-right tabular-nums" style={{ color: C.sub }}>{x.estimado ? brl(x.estimado) : "—"}</td>
                <td className="text-right tabular-nums font-semibold" style={{ color: !x.incorrido ? C.sub : ok ? C.green : C.red }}>{x.incorrido && x.estimado ? `${((x.incorrido / x.estimado - 1) * 100).toFixed(1).replace(".", ",")}%` : "—"}</td>
                <td className="w-28 pl-2"><div className="h-2.5 rounded relative" style={{ background: C.panel2 }}>
                  <div className="h-2.5 rounded" style={{ width: `${Math.min(100, (x.incorrido / Math.max(...d.serie.map((y) => Math.max(y.incorrido, y.estimado)), 0.01)) * 100)}%`, background: ok ? C.green : C.red }} />
                </div></td>
              </tr>); })}</tbody>
          </table>
          <div className="text-[11px] mt-1" style={{ color: C.sub }}>Clique no mês para abrir. ·P = valor da planilha (meses antigos); sem ·P = sistema (Matriz e freelancers identificados). Em amarelo, o freelancer que o sistema registrou quando difere da planilha — vale o da planilha. Resultado = incorrido ÷ estimado − 1.</div>
        </div>
      )}

      {d && !d.analise && (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: C.panel, border: `1px dashed ${C.line}`, color: C.sub }}>
          Sem análise de {nomeMes(comp)}. Importe a planilha do corte ou <button onClick={criarVazia} className="underline font-semibold" style={{ color: C.accent }}>preencha à mão</button>.
        </div>
      )}

      {c && f && (
        <>
          {/* cenário interno × estimado */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Kpi t="Peças processadas" v={int(c.pecas)} sub={d.analise.semCategoria ? `${int(d.analise.semCategoria)} sem categoria fora da análise` : d.analise.arquivoNome || ""} />
            <Kpi t="Custo total do setor" v={brl(c.custoTotal)} sub={`pessoal ${brl(c.pessoal)} + freelancers ${brl(c.freelancer)}`} />
            <Kpi t="Custo incorrido / peça" v={brl(c.incorrido)} cor={bom ? C.green : C.red} />
            <Kpi t="Custo estimado / peça" v={brl(c.estimado)} sub={f.custoMeta !== "" && f.custoMeta != null ? "meta fixa" : `custo total ÷ ${int(c.pecasEstimadas)} peças estimadas`} />
            <Kpi t="Sobrecusto × meta" v={pct(c.sobrecusto)} cor={c.sobrecusto > 0 ? C.red : C.green} sub={`resultado ${pct(c.resultado)}`} />
            <Kpi t="Impacto no resultado" v={brl(c.impacto)} cor={c.impacto < 0 ? C.red : C.green} sub="(estimado − incorrido) × peças" />
          </div>

          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Custo do setor no mês</div>
              <table className="w-full text-xs"><tbody>
                <tr><td className="py-1">Pessoal (custo total da folha · Matriz)</td><td className="text-right">{brl(d.auto?.pessoal)}</td>
                  <td className="text-right pl-2"><input value={f.pessoalManual} onChange={(e) => s("pessoalManual")(e.target.value)} placeholder="usar Matriz" className={inp} style={{ ...inpS, width: 110 }} /></td></tr>
                <tr><td className="py-1">Freelancers do corte <span style={{ color: C.sub }}>({String(d.auto?.fonteFree || "—").toLowerCase()})</span></td><td className="text-right">{brl(d.auto?.freelancer)}</td>
                  <td className="text-right pl-2"><input value={f.freelancerManual} onChange={(e) => s("freelancerManual")(e.target.value)} placeholder="usar sistema" className={inp} style={{ ...inpS, width: 110 }} /></td></tr>
                {f.freelancerManual !== "" && f.freelancerManual != null && Math.abs(Number(String(f.freelancerManual).replace(",", ".")) - (d.auto?.freelancer || 0)) >= 1 && (
                  <tr><td colSpan={3} className="py-1 text-[11px] font-semibold" style={{ color: C.yellow }}>
                    Conflito: informado {brl(Number(String(f.freelancerManual).replace(",", ".")))} × registrado no sistema {brl(d.auto?.freelancer)} — vale o informado.
                  </td></tr>)}
                <tr><td className="py-1">Peças estimadas (meta do mês)</td><td /><td className="text-right pl-2"><input value={f.pecasEstimadas} onChange={(e) => s("pecasEstimadas")(e.target.value)} className={inp} style={{ ...inpS, width: 110 }} /></td></tr>
                <tr><td className="py-1">Custo estimado por peça fixo <span style={{ color: C.sub }}>(opcional)</span></td><td /><td className="text-right pl-2"><input value={f.custoMeta} onChange={(e) => s("custoMeta")(e.target.value)} placeholder="custo ÷ estimadas" className={inp} style={{ ...inpS, width: 110 }} /></td></tr>
              </tbody></table>
              <div className="text-[11px] mt-2" style={{ color: C.sub }}>Vazio = automático: pessoal pela Matriz de custos (salário, encargos, benefícios e provisões dos funcionários do corte) e freelancers do corte identificados no extrato ou nas contas da semana. Preencha só para corrigir um mês antigo.</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Interno × terceirizado</div>
              <table className="w-full text-xs"><tbody>
                <tr><td className="py-1">Custo se terceirizado (valor de mercado × peças)</td><td className="text-right font-semibold">{brl(c.terceirizado)}</td></tr>
                <tr><td className="py-1">Média da peça terceirizada</td><td className="text-right">{brl(c.mediaTerc)}</td></tr>
                <tr><td className="py-1">Custo interno do mês</td><td className="text-right">{brl(c.custoTotal)}</td></tr>
                <tr><td className="py-1 font-semibold">{c.economiaTerc >= 0 ? "Economia de cortar dentro" : "Sobrecusto de cortar dentro"}</td>
                  <td className="text-right font-bold" style={{ color: c.economiaTerc >= 0 ? C.green : C.red }}>{brl(Math.abs(c.economiaTerc))}</td></tr>
              </tbody></table>
            </div>
          </div>

          {/* por categoria */}
          <div className="rounded-xl overflow-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <table className="w-full text-xs" style={{ minWidth: 760 }}>
              <thead><tr style={{ background: C.panel2, color: C.sub }}>
                {["Peça", "Qtde", "Concentração", "Valor unit. mercado", "% da média", "Valor interno no mês"].map((h, i) => <th key={h} className={`px-2 py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {c.categorias.map((x) => (
                  <tr key={x.k} style={{ borderTop: `1px solid ${C.line}`, opacity: x.qtd ? 1 : 0.55 }}>
                    <td className="px-2 py-1 font-semibold">{x.n}</td>
                    <td className="px-2 py-1 text-right"><input value={f.qtds[x.k] ?? ""} onChange={(e) => sQ(x.k, e.target.value.replace(/\D/g, ""))} className={inp} style={{ ...inpS, width: 80 }} /></td>
                    <td className="px-2 py-1 text-right tabular-nums">{pct(x.concentracao)}</td>
                    <td className="px-2 py-1 text-right"><input value={f.mercado[x.k] ?? ""} onChange={(e) => sM(x.k, e.target.value.replace(",", "."))} className={inp} style={{ ...inpS, width: 80 }} /></td>
                    <td className="px-2 py-1 text-right tabular-nums">{n2(x.fator * 100, 1)}%</td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold">{x.mercado ? brl(x.valorInterno) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${C.line}` }}><td className="px-2 py-1.5 font-bold">Total</td><td className="px-2 text-right font-bold tabular-nums">{int(c.pecas)}</td><td className="px-2 text-right">100%</td><td /><td /><td className="px-2 text-right" style={{ color: C.sub }}>peça média {brl(c.incorrido)}</td></tr>
              </tbody>
            </table>
            <div className="text-[11px] px-3 py-2" style={{ color: C.sub }}>Valor interno no mês = (valor de mercado ÷ média da peça terceirizada) × custo incorrido por peça — o custo de cada tipo de peça cortada dentro, proporcional ao preço de mercado. As quantidades e valores de mercado podem ser ajustados (salve para recalcular).</div>
          </div>

          {/* conclusão */}
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {[["meta", "Meta financeira"], ["causas", "Causas / mérito"], ["providencias", "Providência"]].map(([k, t]) => (
              <div key={k} className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="text-[11px] font-semibold uppercase mb-1" style={{ color: C.sub }}>{t}</div>
                <textarea value={f[k]} onChange={(e) => s(k)(e.target.value.toUpperCase())} rows={3} className="w-full rounded px-2 py-1 text-xs" style={{ ...inpS, textAlign: "left", resize: "vertical" }} />
              </div>
            ))}
          </div>

          {/* conferência */}
          {Array.isArray(d.analise.detalhe) && d.analise.detalhe.length > 0 && (
            <div className="rounded-xl mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <button onClick={() => setVerDet((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold" style={{ color: C.navy }}>
                {verDet ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Conferência · {d.analise.detalhe.length} linha(s) importada(s)
                {d.analise.semCategoria > 0 && <span className="ml-2 flex items-center gap-1 text-xs font-semibold" style={{ color: C.yellow }}><AlertTriangle size={13} /> {int(d.analise.semCategoria)} peça(s) sem categoria</span>}
              </button>
              {verDet && (
                <div className="overflow-auto px-4 pb-3" style={{ maxHeight: 400 }}>
                  <table className="w-full text-xs"><thead><tr style={{ color: C.sub }}>{["Pedido", "Cliente", "Produto", "Categoria", "Qtde", "Concluído"].map((h) => <th key={h} className="text-left py-1 font-semibold">{h}</th>)}</tr></thead>
                    <tbody>{d.analise.detalhe.map((l, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${C.line}`, color: l.categoria === "SEM_CATEGORIA" ? C.yellow : C.text }}>
                        <td className="py-1">{l.pedido}</td><td>{l.cliente}</td><td>{l.produto}</td><td>{l.categoria === "SEM_CATEGORIA" ? "sem categoria" : d.categorias.find((x) => x.k === l.categoria)?.n}</td><td className="text-right pr-2">{int(l.qtde)}</td><td>{l.concluido}</td>
                      </tr>))}</tbody></table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
