"use client";
// v230 — Capacidade mês a mês da meta (na página de Metas). Só análise: não grava nada, não mexe na Matriz.
import React, { useState, useEffect } from "react";
import { Users, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { planoMensal } from "@/lib/capacidadeMensal";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", yellow: "#C08401", yellowSoft: "#FFF6DD",
  red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41",
};
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAIO", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const n1 = (v) => Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const rs = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`;
  if (a >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`;
  return `R$ ${Math.round(v || 0).toLocaleString("pt-BR")}`;
};
const pc = (v) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

export default function CapacidadeMensal({ user, ano, pecasMes, metaFreela, irCapacidade, cap: capPronto, nota, fechados = [] }) {
  const [cap, setCap] = useState(capPronto || null);
  useEffect(() => { if (capPronto) setCap(capPronto); }, [capPronto]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (capPronto) return;
    fetch(`/api/kpi/capacidade?u=${user.id}&meses=6`).then((r) => r.json())
      .then((d) => (d.error ? setErro(d.error) : setCap(d))).catch((e) => setErro(e.message));
  }, []);

  const caixa = { background: C.panel, border: `1px solid ${C.line}` };
  if (erro) return <div className="rounded-xl p-4 mt-4 text-xs" style={{ ...caixa, color: C.sub }}>Capacidade mês a mês indisponível: {erro}</div>;
  if (!cap) return <div className="rounded-xl p-4 mt-4 text-xs flex items-center gap-2" style={{ ...caixa, color: C.sub }}><Loader2 size={14} className="animate-spin" /> Calculando capacidade da equipe…</div>;

  const plano = planoMensal({ setores: cap.setores, pecasMes, ano, fechados });
  const semDiaria = cap.setores.filter((s) => s.semDiaria).map((s) => s.setor);
  if (!plano.linhas.length) return (
    <div className="rounded-xl p-4 mt-4 text-xs" style={{ ...caixa, color: C.sub }}>
      <b style={{ color: C.navy }}>Capacidade mês a mês:</b> falta produtividade por setor (peças nos KPIs, freelancer por setor na DRE) ou diária do freelancer.
      {irCapacidade && <> <button onClick={irCapacidade} className="underline font-semibold" style={{ color: C.blue }}>preencher diárias</button></>}
    </div>
  );

  // v232 — recomendações agrupadas por setor (um card pequeno por setor)
  const recs = plano.linhas.map((l) => {
    const ev = [];
    l.meses.forEach((x, m) => {
      if (x.contratar) ev.push({ t: "c", n: x.contratar, mes: MESES[m] });
      if (x.demitir) ev.push({ t: "d", n: x.demitir, mes: MESES[m] });
    });
    const pico = Math.max(...l.meses.map((x) => x.equipe));
    return { setor: l.setor, ev, base: l.base, pico, fim: l.meses[11].equipe };
  }).filter((r) => r.ev.length);
  const pctMeta = metaFreela != null ? metaFreela / 100 : null;

  return (
    <div className="rounded-xl mt-4 overflow-hidden" style={caixa}>
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>CAPACIDADE DA EQUIPE × META (MÊS A MÊS)</div>
          <div className="text-xs" style={{ color: C.sub }}>
            Peças faturadas da meta ÷ peças por trabalhador do histórico ({cap.usados} {cap.usados === 1 ? "mês" : "meses"}). Meses fechados no KPI só aparecem (cinza); as recomendações valem para os meses em aberto. Contrata quando passa de 1 freelancer/dia por 2+ meses; desliga quando sobra ≥ 1 por 2+ meses. Dias úteis sem sábados e feriados.
          </div>
          {nota && <div className="text-xs mt-0.5" style={{ color: C.text }}>{nota}</div>}
          <div className="text-[11px] font-semibold mt-1" style={{ color: C.accent }}>Só análise — nada aqui altera metas ou Matriz.</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[["Contratações", plano.ano.contratar, C.green], ["Desligamentos", plano.ano.demitir, C.red], ["Freelancer no ano", rs(plano.ano.freelancer), C.navy],
            ["% freelancer", pc(plano.ano.pct), pctMeta != null && plano.ano.pct != null && plano.ano.pct > pctMeta + 0.005 ? C.red : C.navy]].map(([t, v, cor]) => (
            <div key={t} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
              <div className="text-[10px] font-semibold" style={{ color: C.sub }}>{t}</div>
              <div className="font-bold text-sm" style={{ color: cor }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {pctMeta != null && plano.ano.pct != null && <div className="px-4 pb-2 text-[11px]" style={{ color: C.sub }}>
        Meta de % freelancer: <b style={{ color: C.text }}>{pc(pctMeta)}</b> · plano recomendado: <b style={{ color: plano.ano.pct > pctMeta + 0.005 ? C.red : C.green }}>{pc(plano.ano.pct)}</b>
      </div>}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr style={{ color: C.sub, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
            <th className="text-left px-3 py-2">Setor</th>
            {MESES.map((m, i) => <th key={m} className="text-center px-2 py-2 font-semibold" style={fechados[i] ? { background: C.panel2 } : undefined}>{m}<div className="text-[9px] font-normal">{fechados[i] ? "fechado" : `${plano.total[i].diasUteis} d.u.`}</div></th>)}
          </tr></thead>
          <tbody>
            {plano.linhas.map((l) => (
              <tr key={l.setor} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td className="px-3 py-2 whitespace-nowrap align-top">
                  <div className="font-semibold" style={{ color: C.navy }}>{l.setor}</div>
                  <div className="text-[10px]" style={{ color: C.sub }}>hoje {l.base} · {n1(l.porTrab)} pç/trab · diária {rs(l.diaria)}</div>
                </td>
                {l.meses.map((x) => {
                  const fundo = x.fechado ? C.panel2 : x.contratar ? C.greenSoft : x.demitir ? C.redSoft : x.freeDia > 1 ? C.yellowSoft : "transparent";
                  return (
                    <td key={x.comp} className="text-center px-1.5 py-1.5 align-top tabular-nums" style={{ background: fundo, opacity: x.fechado ? 0.55 : 1 }}
                      title={`Necessários ${n1(x.necessarios)} · equipe ${x.equipe} · ${n1(x.freeDia)} freelancer/dia (${x.diarias} diárias, ${rs(x.freelancer)})${x.ociosos >= 0.5 ? ` · ociosos ${n1(x.ociosos)}` : ""}`}>
                      <div className="font-bold" style={{ color: C.navy }}>{x.equipe}
                        {x.contratar > 0 && <span style={{ color: C.green }}> +{x.contratar}</span>}
                        {x.demitir > 0 && <span style={{ color: C.red }}> −{x.demitir}</span>}
                      </div>
                      <div className="text-[10px]" style={{ color: x.freeDia > 0 ? C.yellow : C.sub }}>{x.freeDia > 0 ? `${n1(x.freeDia)} free/d` : "—"}</div>
                      <div className="text-[9px]" style={{ color: C.sub }}>nec {n1(x.necessarios)}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr style={{ background: C.panel2 }}>
              <td className="px-3 py-2 font-bold" style={{ color: C.navy }}>Mão de obra</td>
              {plano.total.map((t) => (
                <td key={t.comp} className="text-center px-1.5 py-1.5 tabular-nums">
                  <div className="font-semibold" style={{ color: C.navy }}>{rs(t.folha + t.freelancer)}</div>
                  <div className="text-[10px]" style={{ color: pctMeta != null && t.pct != null && t.pct > pctMeta + 0.005 ? C.red : C.sub }}>{pc(t.pct)} free</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 grid gap-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
        {!recs.length && <div className="text-xs flex items-center gap-2" style={{ color: C.green }}><Users size={14} /> A equipe atual + freelancer dá conta da meta o ano todo — nenhuma contratação recomendada.</div>}
        {recs.length > 0 && <>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
            {recs.map((r) => (
              <div key={r.setor} className="rounded-lg px-3 py-2" style={{ background: C.panel2 }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: C.navy }}>{r.setor}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: C.sub }} title="equipe hoje → maior equipe no ano → equipe em DEZ">{r.base} → {r.pico} → {r.fim}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {r.ev.map((e, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums"
                      style={e.t === "c" ? { background: C.greenSoft, color: C.green } : { background: C.redSoft, color: C.red }}
                      title={e.t === "c" ? `Contratar ${e.n} em ${e.mes}` : `Desligar ${e.n} em ${e.mes}`}>
                      {e.t === "c" ? <UserPlus size={10} /> : <UserMinus size={10} />}{e.t === "c" ? "+" : "−"}{e.n} {e.mes}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px]" style={{ color: C.sub }}>
            <b style={{ color: C.green }}>+ contratar</b>: necessidade acima de 1 freelancer/dia por mais de um mês · <b style={{ color: C.red }}>− desligar</b>: fim do pico, sobra ≥ 1 pessoa por 2 meses (só quem foi contratado no plano — considere contrato de experiência e custo de rescisão) · números: equipe hoje → pico → DEZ.
          </div>
        </>}
        {semDiaria.length > 0 && <div className="text-[11px]" style={{ color: C.yellow }}>
          Fora da conta (sem diária): {semDiaria.join(", ")}. {irCapacidade && <button onClick={irCapacidade} className="underline font-semibold" style={{ color: C.blue }}>preencher</button>}
        </div>}
        <div className="text-[10px]" style={{ color: C.sub }}>Legenda: verde = contratar · vermelho = desligar · amarelo = mais de 1 freelancer/dia. Passe o mouse na célula para ver diárias e custo.</div>
      </div>
    </div>
  );
}
