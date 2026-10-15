"use client";
// v229 — Capacidade × freelancer pela diária de cada área: quantos freelancers por dia a meta exige
// mantendo a equipe (A) e o recomendado (B: acima de 1 freelancer por dia útil, contrata)
import React, { useState, useEffect } from "react";
import CapacidadeMensal from "./capacidadeMensal";
import { Loader2, Users2, Factory, ArrowRight, Info, Save, AlertTriangle } from "lucide-react";

const C = {
  panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", accent: "#FF6B1A", accentSoft: "#FFF0E6",
  green: "#12A150", greenSoft: "#E7F6EE", blue: "#2E7CD6", blueSoft: "#EAF2FC", red: "#D92D20", redSoft: "#FDECEA", navy: "#001E41", yellow: "#C08401", yellowSoft: "#FFF6DD",
};
const brl = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const curto = (v) => { if (v == null) return "—"; const a = Math.abs(v); return a >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M` : a >= 1e3 ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}K` : `R$ ${brl(v)}`; };
const int = (v) => (v == null ? "—" : Math.round(v).toLocaleString("pt-BR"));
const um = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const pc = (v) => (v == null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);
const MES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const nomeC = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
const Th = ({ children, dir, cor }) => <th className={`px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap ${dir ? "text-right" : "text-left"}`} style={{ color: cor || C.sub }}>{children}</th>;
const Td = ({ children, dir, forte, cor }) => <td className={`px-2.5 py-2 whitespace-nowrap tabular-nums ${dir ? "text-right" : ""}`} style={{ fontWeight: forte ? 700 : 400, color: cor || C.text }}>{children}</td>;

export default function Capacidade({ user, usarNaMeta }) {
  const [meses, setMeses] = useState(6);
  const [alvo, setAlvo] = useState("");
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [diarias, setDiarias] = useState({});
  const [mexeu, setMexeu] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const carregar = async (a = alvo) => {
    setErro("");
    try {
      const r = await fetch(`/api/kpi/capacidade?u=${user.id}&meses=${meses}${a ? `&alvo=${a}` : ""}`).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      if (!a && (r.metaMetas || r.total?.pecas)) { const pad = r.metaMetas || r.total.pecas; setAlvo(String(pad)); return carregar(String(pad)); }
      setD(r); setDiarias(Object.fromEntries(r.setores.map((s) => [s.setor, s.diaria ? String(s.diaria).replace(".", ",") : ""]))); setMexeu(false);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setD(null); carregar(); }, [meses]);
  const salvarDiarias = async () => {
    setSalvando(true);
    try {
      await fetch("/api/kpi/capacidade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, diarias }) });
      await carregar();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  const T = d?.total;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold flex items-center gap-2" style={{ color: C.navy }}><Factory size={18} style={{ color: C.accent }} /> Capacidade × freelancer</div>
          <div className="text-xs" style={{ color: C.sub }}><b>Só análise — nada aqui altera metas ou Matriz.</b> Pelo gasto com freelancer de cada área ÷ a diária, quantos freelancers por dia a produção precisou — e quantos a meta vai precisar. Acima de 1 freelancer por dia útil, o recomendado é contratar (risco trabalhista acima da economia).</div>
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
      </div>
      {erro && <div className="p-3 rounded mb-4 text-sm" style={{ background: C.redSoft, color: C.red }}>{erro}</div>}
      {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={16} className="animate-spin" /> Analisando…</div>}
      {d && (
        <div className="anim-entrar">
          {T.semDiaria.length > 0 && <div className="p-2.5 rounded-lg mb-3 text-xs flex items-center gap-2" style={{ background: C.yellowSoft, color: C.yellow }}>
            <AlertTriangle size={14} /> Informe a diária do freelancer de: <b>{T.semDiaria.join(", ")}</b> (na tabela abaixo) — sem ela essas áreas não entram na projeção.</div>}
          {/* resumo */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.sub }}>HOJE · {d.selecionados} MESES SELECIONADOS{d.usados !== d.selecionados ? `, ${d.usados} COM PEÇAS` : ""}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>{int(T.pecas)} <span className="text-sm font-semibold">peças/mês</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>{um(T.pessoas)} pessoas na folha + <b style={{ color: C.text }}>{um(T.freeDia)} freelancers/dia</b></div>
              <div className="text-xs" style={{ color: C.sub }}>Folha {curto(T.folha)} · freelancer {curto(T.freelancer)} · {pc(T.pct)} freelancer</div>
            </div>
            {T.A && <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.yellow}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.yellow }}>A · MANTER A EQUIPE</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>{um(T.A.freeDia)} <span className="text-sm font-semibold">freelancers/dia</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>{int(T.A.diarias)} diárias/mês · {curto(T.A.freelancer)} de freelancer · custo de MO {curto(T.A.custo)}/mês</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.yellow }}>{pc(T.A.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                {usarNaMeta && <button onClick={() => usarNaMeta(T.A.pct)} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>levar para Metas (sem salvar) <ArrowRight size={12} /></button>}</div>
            </div>}
            {T.B && <div className="rounded-xl p-4" style={{ background: C.panel, border: `2px solid ${C.green}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.green }}>B · RECOMENDADO</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>+{T.B.contratar} <span className="text-sm font-semibold">contratações</span> <span className="text-sm font-semibold" style={{ color: C.sub }}>+ {um(T.B.freeDia)} freelancers/dia</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>Folha {curto(T.B.folha)} · freelancer {curto(T.B.freelancer)} · custo de MO {curto(T.B.custo)}/mês ({T.B.custo <= T.A.custo ? "" : "+"}{curto(T.B.custo - T.A.custo)} vs A)</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.green }}>{pc(T.B.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                {usarNaMeta && <button onClick={() => usarNaMeta(T.B.pct)} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>levar para Metas (sem salvar) <ArrowRight size={12} /></button>}</div>
            </div>}
          </div>

          {/* por setor */}
          <div className="rounded-xl overflow-x-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 pt-3 pb-1 flex items-center gap-3">
              <div className="font-bold text-sm flex-1" style={{ color: C.navy }}>Por setor</div>
              {mexeu && <button onClick={salvarDiarias} disabled={salvando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar diárias e recalcular</button>}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr><th colSpan={7} className="px-2.5 pt-1 text-left text-[10px] font-bold tracking-wider" style={{ color: C.sub }}>HISTÓRICO (média)</th>
                  <th colSpan={4} className="px-2.5 pt-1 text-left text-[10px] font-bold tracking-wider" style={{ color: C.yellow, borderLeft: `1px solid ${C.line}` }}>A · MANTER A EQUIPE</th>
                  <th colSpan={4} className="px-2.5 pt-1 text-left text-[10px] font-bold tracking-wider" style={{ color: C.green, borderLeft: `1px solid ${C.line}` }}>B · RECOMENDADO</th></tr>
                <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                  <Th>Setor</Th><Th dir>Diária (R$)</Th><Th dir>Pessoas</Th><Th dir>Freelancer/mês</Th><Th dir>Diárias/mês</Th><Th dir>Freelancers/dia</Th><Th dir>Peças/trab.</Th>
                  <Th dir cor={C.yellow}>Precisa (trab.)</Th><Th dir cor={C.yellow}>Freelancers/dia</Th><Th dir cor={C.yellow}>Freelancer/mês</Th><Th dir cor={C.yellow}>% free</Th>
                  <Th dir cor={C.green}>Contratar</Th><Th dir cor={C.green}>Freelancers/dia</Th><Th dir cor={C.green}>Folha + free</Th><Th dir cor={C.green}>% free</Th>
                </tr>
              </thead>
              <tbody>
                {d.setores.map((s) => (
                  <tr key={s.setor} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <Td forte>{s.setor}{s.jaPrecisa && <div className="text-[10px] font-semibold" style={{ color: C.red }}>já acima de 1/dia em {s.mesesAcima1} meses</div>}</Td>
                    <td className="px-2.5 py-1.5 text-right">
                      <input value={diarias[s.setor] ?? ""} onChange={(e) => { setDiarias((x) => ({ ...x, [s.setor]: e.target.value })); setMexeu(true); }} placeholder="informe"
                        className="rounded px-1.5 py-1 text-xs text-right" style={{ width: 80, border: `1px solid ${s.semDiaria ? C.yellow : C.line}`, background: s.semDiaria ? C.yellowSoft : "#fff" }} />
                    </td>
                    <Td dir>{um(s.pessoas)}</Td><Td dir>{brl(s.freelancer)}</Td><Td dir>{s.semDiaria ? "—" : int(s.diariasMes)}</Td><Td dir forte>{s.semDiaria ? "—" : um(s.freeDia)}</Td><Td dir>{s.semDiaria ? "—" : `${int(s.porTrab)} pç`}</Td>
                    <Td dir cor={C.yellow}>{s.A ? um(s.A.necessarios) : "—"}</Td><Td dir forte cor={C.yellow}>{s.A ? um(s.A.freeDia) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? brl(s.A.freelancer) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? pc(s.A.pct) : "—"}</Td>
                    <Td dir forte cor={C.green}>{s.B ? (s.B.contratar ? `+${s.B.contratar}` : "0") : "—"}</Td><Td dir cor={C.green}>{s.B ? um(s.B.freeDia) : "—"}</Td>
                    <Td dir cor={C.green}>{s.B ? (s.B.semCustoPessoa ? "sem custo na Matriz" : brl(s.B.custo)) : "—"}</Td><Td dir cor={C.green}>{s.B ? pc(s.B.pct) : "—"}</Td>
                  </tr>
                ))}
                <tr style={{ background: C.panel2 }}>
                  <Td forte>TOTAL</Td><Td dir></Td><Td dir forte>{um(T.pessoas)}</Td><Td dir forte>{brl(T.freelancer)}</Td><Td dir></Td><Td dir forte>{um(T.freeDia)}</Td><Td dir></Td>
                  <Td dir></Td><Td dir forte cor={C.yellow}>{T.A ? um(T.A.freeDia) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? brl(T.A.freelancer) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? pc(T.A.pct) : "—"}</Td>
                  <Td dir forte cor={C.green}>{T.B ? `+${T.B.contratar}` : "—"}</Td><Td dir forte cor={C.green}>{T.B ? um(T.B.freeDia) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? brl(T.B.custo) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? pc(T.B.pct) : "—"}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* v231.2 — capacidade mês a mês da simulação: a distribuição das Metas ajustada para a média digitada */}
          {(() => {
            const a = Number(alvo) || 0;
            if (!a) return null;
            const dist = d.metaMesesPecas || [];
            const soma = dist.reduce((s, x) => s + (x || 0), 0);
            const temDist = soma > 0 && dist.every((x) => x != null);
            const pecasMes = temDist ? dist.map((x) => Math.round((x * a * 12) / soma)) : Array(12).fill(a);
            const nota = temDist
              ? `Simulação: ${int(a)} peças/mês em média, distribuídas pela sazonalidade das Metas de ${d.anoMetas} (${int(a * 12)} no ano).`
              : `Simulação: ${int(a)} peças em todos os meses (sem distribuição mensal nas Metas de ${d.anoMetas}).`;
            return <div className="mb-4"><CapacidadeMensal user={user} ano={d.anoMetas} cap={d} pecasMes={pecasMes} nota={nota} /></div>;
          })()}
          {/* meses usados */}
          <div className="rounded-xl p-4 mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="font-bold text-sm mb-2 flex items-center gap-1.5" style={{ color: C.navy }}><Users2 size={15} style={{ color: C.accent }} /> Meses da base</div>
            <div className="flex flex-wrap gap-2">
              {d.meses.map((m) => (
                <div key={m.comp} className="rounded-lg px-3 py-2 text-xs" style={{ background: m.usado ? C.panel2 : C.yellowSoft }}>
                  <div className="font-bold" style={{ color: C.navy }}>{nomeC(m.comp)} <span className="font-normal" style={{ color: C.sub }}>· {m.diasUteis} dias úteis</span></div>
                  <div style={{ color: C.sub }}>{m.pecas ? `${int(m.pecas)} pç` : "sem peças no KPI"} · free {curto(m.freelancer)}</div>
                  {!m.usado && <div style={{ color: C.yellow }}>fora da conta — lance as peças do mês nos KPIs</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs flex items-start gap-1.5" style={{ color: C.sub }}><Info size={13} className="shrink-0 mt-0.5" />
            <span>Como é calculado, por setor e mês: diárias = gasto com freelancer ÷ diária da área; freelancers por dia = diárias ÷ dias úteis (seg a sex, sem feriados nacionais, Carnaval, Sexta-feira Santa e Corpus Christi);
              peças por trabalhador = peças do mês ÷ (pessoas da folha + freelancers por dia). Para a meta: trabalhadores necessários = meta ÷ peças por trabalhador.
              <b> A</b>: o que passar da equipe atual vira freelancer por dia. <b>B</b>: cada freelancer necessário o dia útil inteiro (acima de 1 por dia) vira contratação, ao custo médio por pessoa do setor na Matriz; a fração que sobra continua freelancer.
              Projeção com {um(d.diasUteisMedio)} dias úteis (média da base). Folha: Matriz · freelancer: DRE (extrato) ou contas da semana · peças: KPIs.</span></div>
        </div>
      )}
    </div>
  );
}
