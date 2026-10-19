"use client";
// v279 — Análise da logística: custo logístico por peça pela DRE (extrato identificado), conferido com a planilha do Igor.
import React, { useEffect, useState } from "react";
import { Loader2, Truck, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", yellow: "#C08401", red: "#D92D20", soft: "#FFF1E8" };
const brl = (v) => (v == null ? "—" : (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const int = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeMes = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
const TOL = 1;

export default function AnaliseLogistica({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [conferir, setConferir] = useState(true);
  useEffect(() => {
    fetch(`/api/producao/analises?u=${user.id}&setor=LOGISTICA`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j))).catch((e) => setErro(e.message));
  }, []);
  if (erro) return <div className="p-3 rounded text-sm" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Calculando pela DRE…</div>;

  const custoCols = d.contas.filter((c) => c.entra);
  const infoCols = d.contas.filter((c) => !c.entra);
  const M = d.media;
  const nPlan = d.meses.filter((m) => m.planilha).length;
  // conferência planilha × DRE
  const difs = (m) => {
    if (!m.planilha) return null;
    const out = [];
    const cmp = (k, n, dre, pl) => { if (pl == null) return; const df = (Number(dre) || 0) - (Number(pl) || 0); if (Math.abs(df) > TOL) out.push({ k, n, dre, pl, df }); };
    cmp("pessoal", "Pessoal", m.pessoal, m.planilha.pessoal);
    for (const c of d.contas) if (c.k in m.planilha.valores) cmp(c.k, c.n, m.valores[c.k], m.planilha.valores[c.k]);
    cmp("pecas", "Peças", m.pecas, m.planilha.pecas);
    return out;
  };
  const Th = ({ children, dir, cor, bg }) => <th className={`px-2 py-1.5 font-semibold whitespace-nowrap ${dir ? "text-right" : "text-left"}`} style={{ color: cor || C.sub, background: bg }}>{children}</th>;
  const Cel = ({ v, pl, peca, forte, cor }) => {
    const diverge = conferir && pl !== undefined && pl !== null && Math.abs((Number(v) || 0) - (Number(pl) || 0)) > TOL;
    return (
      <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap" style={{ color: cor || C.text, fontWeight: forte ? 700 : 400, background: diverge ? "#FDECEA" : undefined }}>
        {peca ? int(v) : brl(v)}
        {conferir && pl != null && <div className="text-[10px]" style={{ color: diverge ? C.red : C.green }}>{peca ? int(pl) : brl(pl)}</div>}
      </td>
    );
  };

  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <Truck size={22} style={{ color: C.accent }} className="mt-0.5" />
        <div className="flex-1">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Análise da logística</div>
          <div className="text-xs" style={{ color: C.sub }}>
            Tudo vem da DRE (extrato identificado), exceto o pessoal, que é o custo total dos funcionários da logística pela Matriz. Peças = análise da expedição (as mesmas do KPI).
            A <b>folha de logística</b> volta para a operação (contribuição à operação = folha ÷ peças). Os <b>demais custos</b> (combustível, fretebras, freelancer…) não voltam: são o custo logístico cobrado na FPP (÷ peças).
            O <b>frete entrega</b> aparece só para informação: a FPP cobra o frete à parte (por volume).
          </div>
        </div>
        {nPlan > 0 && <label className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: C.sub }}>
          <input type="checkbox" checked={conferir} onChange={(e) => setConferir(e.target.checked)} /> <FileSpreadsheet size={13} /> Conferir com a planilha</label>}
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <Kpi t="Contribuição à operação / peça" v={M.contribPeca != null ? `R$ ${brl(M.contribPeca)}` : "—"} cor={C.navy}
          s={M.meses.length ? `folha de logística R$ ${brl(M.pessoal)} ÷ ${int(M.pecas)} peças · ${M.meses.map(nomeMes).join(", ")}` : "sem peças da expedição nos últimos 3 meses"} />
        <Kpi t="Custo logístico na FPP / peça" v={M.fppPeca != null ? `R$ ${brl(M.fppPeca)}` : "—"} cor={C.accent}
          s={`demais custos R$ ${brl(M.outros)} (sem folha e sem frete entrega) ÷ peças · vai para a FPP (logística base)`} />
        <Kpi t="Custo total do período" v={`R$ ${brl(M.custo)}`} s={`R$ ${M.porPeca != null ? brl(M.porPeca) : "—"} por peça · ${int(M.pecas)} peças expedidas`} />
        <Kpi t="Frete entrega / peça (informativo)" v={M.freteEntregaPeca != null ? `R$ ${brl(M.freteEntregaPeca)}` : "—"} s="fora do custo: cobrado à parte na FPP" />
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              <Th>Mês</Th><Th>Identificação</Th><Th dir>Pessoal</Th>
              {custoCols.map((c) => <Th key={c.k} dir>{c.n}</Th>)}
              <Th dir cor={C.navy}>Custo</Th><Th dir>Peças</Th><Th dir cor={C.navy}>Folha / pç</Th><Th dir cor={C.accent} bg={C.soft}>FPP / pç</Th><Th dir>Total / pç</Th>
              {infoCols.map((c) => <Th key={c.k} dir cor="#98A2B3">{c.n}</Th>)}
              <Th dir cor="#98A2B3">Frete entr. / pç</Th>
            </tr>
          </thead>
          <tbody>
            {d.meses.map((m) => {
              const naBase = M.meses.includes(m.comp);
              const pl = m.planilha;
              return (
                <tr key={m.comp} style={{ borderBottom: `1px solid ${C.line}`, background: naBase ? "#FFF8F3" : undefined }}>
                  <td className="px-2 py-1 font-semibold whitespace-nowrap" style={{ color: naBase ? C.accent : C.text }}>{nomeMes(m.comp)}{naBase && <div className="text-[10px] font-normal">na base</div>}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {!m.lancamentos ? <span style={{ color: C.sub }}>sem extrato</span>
                      : m.identificado ? <span className="flex items-center gap-1" style={{ color: C.green }}><CheckCircle2 size={12} /> 100%</span>
                      : <span className="flex items-center gap-1" style={{ color: C.yellow }} title={`${m.semConta} lançamento(s) sem conta · R$ ${brl(m.valorSemConta)}`}><AlertTriangle size={12} /> {(m.pctIdentificado * 100).toFixed(1).replace(".", ",")}% · {m.semConta} sem conta</span>}
                  </td>
                  <Cel v={m.pessoal} pl={pl?.pessoal} />
                  {custoCols.map((c) => <Cel key={c.k} v={m.valores[c.k]} pl={pl ? pl.valores[c.k] : undefined} />)}
                  <Cel v={m.custo} forte cor={C.navy} />
                  <Cel v={m.pecas} pl={pl?.pecas} peca />
                  <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color: C.navy }}>{m.contribPeca != null ? brl(m.contribPeca) : "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums font-bold" style={{ color: C.accent, background: C.soft }}>{m.fppPeca != null ? brl(m.fppPeca) : "—"}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{m.porPeca != null ? brl(m.porPeca) : "—"}</td>
                  {infoCols.map((c) => <Cel key={c.k} v={m.valores[c.k]} pl={pl ? pl.valores[c.k] : undefined} cor="#98A2B3" />)}
                  <td className="px-2 py-1 text-right tabular-nums" style={{ color: "#98A2B3" }}>{m.freteEntregaPeca != null ? brl(m.freteEntregaPeca) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] mt-2" style={{ color: C.sub }}>
        Custo = pessoal + {custoCols.map((c) => c.n.toLowerCase()).join(" + ")}. Folha/pç = pessoal ÷ peças (volta à operação); FPP/pç = demais custos ÷ peças (cobrado na FPP). Base de cálculo: últimos 3 meses encerrados (a mesma regra dos outros setores); a coluna Identificação mostra se ainda há lançamento sem conta no mês.
        {conferir && nPlan > 0 && <> Linha de baixo (verde/vermelho) = valor da planilha; em vermelho, diferença acima de R$ 1,00.</>}
      </div>

      {conferir && nPlan > 0 && (
        <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
          <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Planilha × DRE — divergências</div>
          {d.meses.filter((m) => m.planilha).map((m) => {
            const x = difs(m);
            return (
              <div key={m.comp} className="text-xs py-1" style={{ borderBottom: `1px solid ${C.line}` }}>
                <b>{nomeMes(m.comp)}</b>{" "}
                {!x.length ? <span style={{ color: C.green }}>bate</span>
                  : x.map((y) => <span key={y.k} className="mr-3" style={{ color: C.red }}>{y.n}: DRE {y.k === "pecas" ? int(y.dre) : brl(y.dre)} × planilha {y.k === "pecas" ? int(y.pl) : brl(y.pl)} ({y.df > 0 ? "+" : ""}{y.k === "pecas" ? int(y.df) : brl(y.df)})</span>)}
                {!m.identificado && m.lancamentos > 0 && <span style={{ color: C.yellow }}> · mês com {m.semConta} lançamento(s) sem conta</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ t, v, s, cor }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-[11px] font-semibold uppercase" style={{ color: C.sub }}>{t}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color: cor || C.navy }}>{v}</div>
      {s && <div className="text-[11px]" style={{ color: C.sub }}>{s}</div>}
    </div>
  );
}
