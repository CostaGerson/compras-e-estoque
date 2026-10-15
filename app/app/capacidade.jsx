"use client";
// v227 — Capacidade × freelancer: histórico por setor e quanto gastar / contratar para a meta de peças
import React, { useState, useEffect } from "react";
import { Loader2, Users2, Factory, ArrowRight, Info } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", yellow: "#C08401", yellowSoft: "#FFF6DD",
};
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const curto = (v) => { if (v == null) return "—"; const a = Math.abs(v); return a >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M` : a >= 1e3 ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}K` : `R$ ${brl(v)}`; };
const int = (v) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const pc = (v) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const nomeC = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
const Th = ({ children, dir }) => <th className={`px-3 py-2 text-[11px] font-semibold whitespace-nowrap ${dir ? "text-right" : "text-left"}`} style={{ color: C.sub }}>{children}</th>;
const Td = ({ children, dir, forte, cor }) => <td className={`px-3 py-2 whitespace-nowrap tabular-nums ${dir ? "text-right" : ""}`} style={{ fontWeight: forte ? 700 : 400, color: cor || C.text }}>{children}</td>;

export default function Capacidade({ user, usarNaMeta }) {
  const [meses, setMeses] = useState(6);
  const [alvo, setAlvo] = useState("");
  const [folga, setFolga] = useState(5);
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = async (a = alvo) => {
    setErro("");
    try {
      const r = await fetch(`/api/kpi/capacidade?u=${user.id}&meses=${meses}&folga=${folga}${a ? `&alvo=${a}` : ""}`).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      if (!a && (r.metaMetas || r.pecasMedia)) { const pad = r.metaMetas || r.pecasMedia; setAlvo(String(pad)); return carregar(String(pad)); }
      setD(r);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setD(null); carregar(); }, [meses, folga]);
  const T = d?.total;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold flex items-center gap-2" style={{ color: C.navy }}><Factory size={18} style={{ color: C.accent }} /> Capacidade × freelancer</div>
          <div className="text-xs" style={{ color: C.sub }}>Com o que a equipe própria e os freelancers entregaram nos últimos meses, quanto custa a mão de obra para a meta de peças — e quantas pessoas contratar para depender o mínimo de freelancer.</div>
        </div>
        <label className="text-xs" style={{ color: C.sub }}>Histórico
          <select value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="block mt-1 rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
            {[3, 6, 12].map((n) => <option key={n} value={n}>últimos {n} meses</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: C.sub }}>Meta de peças/mês
          <input value={alvo} onChange={(e) => setAlvo(e.target.value.replace(/\D/g, ""))} onBlur={() => carregar()} onKeyDown={(e) => e.key === "Enter" && carregar()}
            className="block mt-1 rounded-lg px-2 py-1.5 text-sm text-right font-bold" style={{ border: `1px solid ${C.line}`, width: 130 }} />
        </label>
        <label className="text-xs" style={{ color: C.sub }} title="Parte da meta que continua com freelancer para cobrir picos">Folga de freelancer
          <div className="flex items-center gap-1 mt-1"><input value={folga} onChange={(e) => setFolga(Number(e.target.value.replace(",", ".")) || 0)} className="rounded-lg px-2 py-1.5 text-sm text-right" style={{ border: `1px solid ${C.line}`, width: 60 }} /> %</div>
        </label>
      </div>
      {erro && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Analisando…</div>}
      {d && (
        <div className="anim-entrar">
          {/* resumo */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>HOJE · MÉDIA DE {d.usados} {d.usados === 1 ? "MÊS" : "MESES"}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>{int(T.pecas)} <span className="text-sm font-semibold">peças/mês</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>Folha {curto(T.folha)} · freelancer {curto(T.freelancer)} · <b style={{ color: C.text }}>{pc(T.pct)} freelancer</b></div>
              <div className="text-xs" style={{ color: C.sub }}>{T.pessoas} pessoas nos setores produtivos</div>
            </div>
            {T.A && <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.yellow}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.yellow }}>A · META SEM AUMENTAR A EQUIPE</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>{curto(T.A.freelancer)} <span className="text-sm font-semibold">de freelancer/mês</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>{T.A.freelancer >= T.freelancer ? "+" : ""}{curto(T.A.freelancer - T.freelancer)} vs hoje · custo de MO {curto(T.A.custo)}/mês</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.yellow }}>{pc(T.A.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                {usarNaMeta && <button onClick={() => usarNaMeta(T.A.pct)} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>usar na meta <ArrowRight size={12} /></button>}</div>
            </div>}
            {T.B && <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.green}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.green }}>B · MÍNIMO DE FREELANCER (FOLGA {pc(d.folga)})</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>+{T.B.contratar} <span className="text-sm font-semibold">pessoas na folha</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>Folha {curto(T.B.folha)} · freelancer {curto(T.B.freelancer)} · custo de MO {curto(T.B.custo)}/mês ({T.B.custo <= T.A.custo ? "" : "+"}{curto(T.B.custo - T.A.custo)} vs A)</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.green }}>{pc(T.B.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                {usarNaMeta && <button onClick={() => usarNaMeta(T.B.pct)} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>usar na meta <ArrowRight size={12} /></button>}</div>
            </div>}
          </div>

          {/* por setor */}
          <div className="rounded-xl overflow-x-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 pt-3 pb-1 font-bold text-sm" style={{ color: C.navy }}>Por setor</div>
            <table className="w-full text-xs">
              <thead><tr style={{ borderBottom: `1px solid ${C.line}` }}>
                <Th>Setor</Th><Th dir>Pessoas</Th><Th dir>Folha/mês</Th><Th dir>Freelancer/mês</Th><Th dir>% free</Th><Th dir>Custo MO/peça</Th><Th dir>Capacidade interna</Th><Th dir>Peças/pessoa</Th>
                <Th dir>A · freelancer</Th><Th dir>A · % free</Th><Th dir>B · contratar</Th><Th dir>B · folha</Th><Th dir>B · freelancer</Th><Th dir>B · % free</Th>
              </tr></thead>
              <tbody>
                {d.setores.map((s) => (
                  <tr key={s.setor} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <Td forte>{s.setor}</Td><Td dir>{s.pessoas}</Td><Td dir>{brl(s.folha)}</Td><Td dir>{brl(s.freelancer)}</Td><Td dir>{pc(s.pct)}</Td>
                    <Td dir>R$ {brl(s.custoPeca)}</Td><Td dir>{int(s.capInterna)} pç</Td><Td dir>{s.porPessoa == null ? "—" : `${int(s.porPessoa)} pç`}</Td>
                    <Td dir cor={C.yellow}>{s.A ? brl(s.A.freelancer) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? pc(s.A.pct) : "—"}</Td>
                    <Td dir forte cor={C.green}>{s.B ? (s.B.semEquipe ? "sem equipe" : `+${s.B.contratar}`) : "—"}</Td><Td dir cor={C.green}>{s.B ? brl(s.B.folha) : "—"}</Td><Td dir cor={C.green}>{s.B ? brl(s.B.freelancer) : "—"}</Td><Td dir cor={C.green}>{s.B ? pc(s.B.pct) : "—"}</Td>
                  </tr>
                ))}
                <tr style={{ background: C.panel2 }}>
                  <Td forte>TOTAL</Td><Td dir forte>{T.pessoas}</Td><Td dir forte>{brl(T.folha)}</Td><Td dir forte>{brl(T.freelancer)}</Td><Td dir forte>{pc(T.pct)}</Td><Td dir></Td><Td dir></Td><Td dir></Td>
                  <Td dir forte cor={C.yellow}>{T.A ? brl(T.A.freelancer) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? pc(T.A.pct) : "—"}</Td>
                  <Td dir forte cor={C.green}>{T.B ? `+${T.B.contratar}` : "—"}</Td><Td dir forte cor={C.green}>{T.B ? brl(T.B.folha) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? brl(T.B.freelancer) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? pc(T.B.pct) : "—"}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* meses usados */}
          <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="font-bold text-sm mb-2 flex items-center gap-1.5" style={{ color: C.navy }}><Users2 size={15} style={{ color: C.accent }} /> Meses da base</div>
            <div className="flex flex-wrap gap-2">
              {d.meses.map((m) => (
                <div key={m.comp} className="rounded-lg px-3 py-2 text-xs" style={{ background: m.usado ? C.panel2 : C.yellowSoft, opacity: m.usado ? 1 : 0.8 }}>
                  <div className="font-bold" style={{ color: C.navy }}>{nomeC(m.comp)}</div>
                  <div style={{ color: C.sub }}>{m.pecas ? `${int(m.pecas)} pç` : "sem peças no KPI"} · free {curto(m.freelancer)}</div>
                  {!m.usado && <div style={{ color: C.yellow }}>fora da conta</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs flex items-start gap-1.5" style={{ color: C.sub }}><Info size={13} className="shrink-0 mt-0.5" />
            <span>Como é calculado (por setor, média dos meses com peças lançadas): custo de mão de obra por peça = (folha + freelancer) ÷ peças; capacidade interna = peças × folha ÷ (folha + freelancer);
              <b> A</b> = custo por peça × meta − folha; <b>B</b> = pessoas para cobrir a meta menos a folga, ao custo médio por pessoa da Matriz, e o restante em freelancer.
              Folha vem da Matriz; freelancer, da DRE (extrato identificado) ou das contas da semana; peças, dos KPIs (peças faturadas = produzidas).</span></div>
        </div>
      )}
    </div>
  );
}
