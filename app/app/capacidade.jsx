"use client";
// v229 — Capacidade × freelancer pela diária de cada área: quantos freelancers por dia a meta exige
// mantendo a equipe (A) e o recomendado (B: acima de 1 freelancer por dia útil, contrata)
import React, { useState, useEffect } from "react";
import CapacidadeMensal from "./capacidadeMensal";
import { planoMensal } from "@/lib/capacidadeMensal";
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
// v232: colunas de número centralizadas (título e dado); sep = linha que separa os grupos A e B
const Th = ({ children, dir, cor, sep }) => <th className={`px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap ${dir ? "text-center" : "text-left"}`} style={{ color: cor || C.sub, borderLeft: sep ? `1px solid ${C.line}` : undefined }}>{children}</th>;
const Td = ({ children, dir, forte, cor, sep }) => <td className={`px-2.5 py-2 whitespace-nowrap tabular-nums ${dir ? "text-center" : ""}`} style={{ fontWeight: forte ? 700 : 400, color: cor || C.text, borderLeft: sep ? `1px solid ${C.line}` : undefined }}>{children}</td>;

const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const lerNum = (t) => { const x = Number(String(t ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };

// v250 — metasTela: { ano, pecasMes, ticket, margem } vindas da tela de Metas (mesmo sem gravar) — a análise abre com elas
export default function Capacidade({ user, usarNaMeta, irMatriz, metasTela, voltarMetas }) {
  const hoje = new Date();
  const [meses, setMeses] = useState(3);   // v244: histórico padrão = últimos 3 meses
  const [ano, setAno] = useState(Number(metasTela?.ano) || hoje.getFullYear());   // v234: período de trabalho (só meses em aberto)
  // v243 — a análise é do PERÍODO EM ABERTO inteiro: meta = peças de todos os meses em aberto (sem escolher mês)
  const [total, setTotal] = useState("");
  const [alvo, setAlvo] = useState("");      // média mensal do período (vai para a tabela por setor)
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [diarias, setDiarias] = useState({});
  const [salarios, setSalarios] = useState({});
  const [mexeu, setMexeu] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sim, setSim] = useState(null);       // v234: simulação criada na Matriz
  const [criando, setCriando] = useState("");
  const brlTxt = (v) => (v ? Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  const abertosDe = (r) => (r?.fechados || Array(12).fill(false)).map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  const metaPeriodo = (r) => abertosDe(r).reduce((t, i) => t + (Number(r?.metaMesesPecas?.[i]) || 0), 0);
  // meses em aberto com as peças da tela de Metas (fechados continuam com o realizado)
  const comTela = (r, y) => (metasTela?.pecasMes && r && !r.error && Number(metasTela.ano) === Number(y)
    ? { ...r, metaMesesPecas: Array.from({ length: 12 }, (_, i) => ((r.fechados || [])[i] ? r.metaMesesPecas?.[i] : Number(metasTela.pecasMes[i]) || 0)) } : r);
  const carregar = async (tot = total, y = ano) => {
    setErro("");
    try {
      const base = comTela(await fetch(`/api/kpi/capacidade?u=${user.id}&meses=${meses}&ano=${y}`).then((x) => x.json()), y);
      if (base.error) throw new Error(base.error);
      const n = abertosDe(base).length || 1;
      const t = Number(tot) || metaPeriodo(base) || (base.metaMetas || base.total?.pecas || 0) * n;
      setTotal(t ? String(Math.round(t)) : "");
      const a = t ? Math.round(t / n) : "";
      setAlvo(a ? String(a) : "");
      const r = a ? comTela(await fetch(`/api/kpi/capacidade?u=${user.id}&meses=${meses}&ano=${y}&alvo=${a}`).then((x) => x.json()), y) : base;
      if (r.error) throw new Error(r.error);
      setD(r);
      setDiarias(Object.fromEntries(r.setores.map((s) => [s.setor, s.diaria ? String(s.diaria).replace(".", ",") : ""])));
      setSalarios(Object.fromEntries(r.setores.map((s) => [s.setor, brlTxt(s.salarioPrevisto)])));
      setMexeu(false);
    } catch (e) { setErro(e.message); }
  };
  useEffect(() => { setD(null); carregar(); }, [meses]);
  const trocarAno = (y) => { setAno(y); setSim(null); setTotal(""); carregar("", y); };
  const mes = d ? (abertosDe(d)[0] ?? 11) + 1 : null;   // 1º mês em aberto (referência da simulação)
  const salvarDiarias = async () => {
    setSalvando(true);
    try {
      const sal = Object.fromEntries(Object.entries(salarios).map(([k, v]) => [k, lerNum(v)]));
      await fetch("/api/kpi/capacidade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuarioId: user.id, diarias, salarios: sal }) });
      await carregar();
    } catch (e) { setErro(e.message); }
    setSalvando(false);
  };
  // v234 — "levar": cria a SIMULAÇÃO A ou B na Matriz (cópia da oficial com o cenário)
  const criarSimulacao = async (cenario) => {
    setCriando(cenario); setErro(""); setSim(null);
    try {
      const r = await fetch("/api/kpi/capacidade", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: user.id, acao: "simular", cenario, meses, alvo, ano, mes, pecasMes: per?.pecasMes, pct: per?.[cenario]?.pct,
          metas: metasTela && Number(metasTela.ano) === Number(ano) ? { ticket: metasTela.ticket, margem: metasTela.margem } : undefined }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setSim(r);
    } catch (e) { setErro(e.message); }
    setCriando("");
  };
  const T = d?.total;
  // v242 — viabilidade no PERÍODO EM ABERTO inteiro: peças de cada mês (fechados = realizado; abertos = Metas escaladas pela meta digitada)
  const per = (() => {
    const tot = Number(total) || 0;
    if (!d || !tot) return null;
    const fech = d.fechados || [];
    const dist = d.metaMesesPecas || [];
    const ab = abertosDe(d), ref = metaPeriodo(d);
    const temDist = ref > 0;
    const fator = temDist ? tot / ref : 1;
    const pecasMes = Array.from({ length: 12 }, (_, i) => (fech[i] ? Number(dist[i]) || 0 : temDist ? Math.round((Number(dist[i]) || 0) * fator) : Math.round(tot / (ab.length || 1))));
    const nota = temDist
      ? `Período em aberto (${ab.length} ${ab.length === 1 ? "mês" : "meses"}): ${int(tot)} peças${Math.abs(fator - 1) > 0.0005 ? ` (${fator >= 1 ? "+" : ""}${((fator - 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% sobre as Metas)` : " — as Metas"}, distribuídas como nas Metas; meses fechados com o realizado.`
      : `Período em aberto: ${int(tot)} peças divididas igualmente (sem distribuição mensal nas Metas de ${d.anoMetas}).`;
    const A = planoMensal({ setores: d.setores, pecasMes, ano: d.anoMetas, fechados: fech, semContratar: true }).periodo;
    const B = planoMensal({ setores: d.setores, pecasMes, ano: d.anoMetas, fechados: fech }).periodo;
    const abertos = fech.map((f, i) => (f ? null : MES_LONGO[i].slice(0, 3).toUpperCase())).filter(Boolean);
    return { pecasMes, fech, nota, A, B, abertos, pecasPeriodo: pecasMes.reduce((t, x, i) => t + (fech[i] ? 0 : x), 0) };
  })();

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex-1 min-w-[260px]">
          <div className="text-lg font-bold flex items-center gap-2" style={{ color: C.navy }}><Factory size={18} style={{ color: C.accent }} /> Capacidade × freelancer</div>
          <div className="text-xs" style={{ color: C.sub }}><b>Só análise — nada aqui altera metas ou a Matriz oficial</b> (os botões criam uma Simulação separada). Pelo gasto com freelancer de cada área ÷ a diária, quantos freelancers por dia a produção precisou — e quantos a meta vai precisar. Acima de 1 freelancer por dia útil, o recomendado é contratar (risco trabalhista acima da economia).</div>
        </div>
        <label className="text-xs" style={{ color: C.sub }}>Histórico
          <select value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="block mt-1 rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
            {[3, 6, 12].map((n) => <option key={n} value={n}>últimos {n} meses</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: C.sub }}>Ano
          <select value={ano} onChange={(e) => trocarAno(Number(e.target.value))} className="block mt-1 rounded-lg px-2 py-1.5 text-sm" style={{ border: `1px solid ${C.line}` }}>
            {[hoje.getFullYear(), hoje.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: C.sub }}>Meta de peças · período em aberto{d ? ` (${abertosDe(d).map((i) => MES_LONGO[i].slice(0, 3).toUpperCase()).join(", ")})` : ""}
          <input value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} onBlur={() => { setSim(null); carregar(); }} onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            className="block mt-1 rounded-lg px-2 py-1.5 text-sm text-right font-bold" style={{ border: `1px solid ${C.line}`, width: 160 }} />
          {d && metaPeriodo(d) > 0 && Number(total) !== metaPeriodo(d) && <button type="button" onClick={() => { setSim(null); carregar(String(metaPeriodo(d))); }} className="block mt-0.5 text-[10px] underline" style={{ color: C.accent }}>voltar às Metas ({int(metaPeriodo(d))})</button>}
        </label>
      </div>
      {metasTela && <div className="p-2.5 rounded-lg mb-3 text-xs flex flex-wrap items-center gap-2" style={{ background: C.blueSoft, color: C.navy }}>
        <Info size={14} style={{ color: C.blue }} /> <span className="flex-1">Análise com as <b>metas da tela de Metas</b> ({metasTela.ano}{metasTela.ticket ? ` · ticket R$ ${brl(metasTela.ticket)}` : ""}) — mesmo sem salvar. As simulações criadas aqui levam essas metas.</span>
        {voltarMetas && <button onClick={voltarMetas} className="font-semibold underline" style={{ color: C.blue }}>← voltar às Metas</button>}
      </div>}
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
            {per && <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.yellow}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.yellow }}>A · MANTER A EQUIPE · {per.abertos[0]}–{per.abertos[per.abertos.length - 1]} ({per.A.meses} {per.A.meses === 1 ? "mês" : "meses"})</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>até {int(per.A.picoFreeDia)} <span className="text-sm font-semibold">freelancers/dia</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>{int(per.A.diarias)} diárias no período · freelancer {curto(per.A.freelancer)} · custo de MO {curto(per.A.custo)} no período</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.yellow }}>{pc(per.A.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                <button onClick={() => criarSimulacao("A")} disabled={!!criando} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>{criando === "A" ? <Loader2 size={12} className="animate-spin" /> : null} levar para Metas · cria Simulação A <ArrowRight size={12} /></button></div>
            </div>}
            {per && <div className="rounded-xl p-4" style={{ background: C.panel, border: `2px solid ${C.green}` }}>
              <div className="text-[11px] font-bold tracking-wider" style={{ color: C.green }}>B · RECOMENDADO · {per.abertos[0]}–{per.abertos[per.abertos.length - 1]}</div>
              <div className="text-2xl font-bold mt-1" style={{ color: C.navy }}>+{per.B.contratar} <span className="text-sm font-semibold">contratações</span>{per.B.demitir ? <span className="text-sm font-semibold" style={{ color: C.red }}> −{per.B.demitir} desligamentos</span> : null} <span className="text-sm font-semibold" style={{ color: C.sub }}>+ até {int(per.B.picoFreeDia)} free/dia</span></div>
              <div className="text-xs mt-1" style={{ color: C.sub }}>Folha {curto(per.B.folha)} · freelancer {curto(per.B.freelancer)} · custo de MO {curto(per.B.custo)} no período ({per.B.custo <= per.A.custo ? "" : "+"}{curto(per.B.custo - per.A.custo)} vs A)</div>
              <div className="flex items-center gap-2 mt-2"><b className="text-lg" style={{ color: C.green }}>{pc(per.B.pct)}</b><span className="text-xs" style={{ color: C.sub }}>de freelancer</span>
                <button onClick={() => criarSimulacao("B")} disabled={!!criando} className="ml-auto text-xs font-semibold flex items-center gap-1" style={{ color: C.accent }}>{criando === "B" ? <Loader2 size={12} className="animate-spin" /> : null} levar para Metas · cria Simulação B <ArrowRight size={12} /></button></div>
            </div>}
          </div>

          {sim && (
            <div className="rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3 text-xs anim-entrar" style={{ background: C.greenSoft, border: `1px solid ${C.green}` }}>
              <div className="flex-1 min-w-[260px]" style={{ color: C.text }}>
                <b style={{ color: C.green }}>{sim.nome}</b> criada na Matriz de custos (cópia da oficial) com {pc(sim.pct)} de freelancer
                {sim.contratados ? <> e <b>{sim.contratados} funcionário(s) hipotético(s)</b>: {Object.entries(sim.criados.reduce((o, c) => ({ ...o, [c.setor]: (o[c.setor] || 0) + 1 }), {})).map(([k, v]) => `${v} em ${k}`).join(", ")}
                  {sim.criados.some((c) => !c.previsto) && <span style={{ color: C.yellow }}> · setor sem salário previsto usou o salário médio do setor</span>}</> : null}.
                {sim.escaladas?.length ? <> Despesas por pessoa ajustadas ao novo quadro: {sim.escaladas.map((e) => e.natureza).join(", ")}.</> : null}
                {" "}A oficial e as metas não mudaram.
              </div>
              {irMatriz && <button onClick={() => irMatriz(sim.id)} className="px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: C.navy }}>Abrir na Matriz</button>}
              {usarNaMeta && <button onClick={() => usarNaMeta(sim.pct)} className="px-3 py-1.5 rounded-lg font-semibold" style={{ border: `1px solid ${C.accent}`, color: C.accent }}>Levar % para Metas (sem salvar)</button>}
            </div>
          )}
          {/* por setor */}
          <div className="rounded-xl overflow-x-auto mb-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="px-4 pt-3 pb-1 flex items-center gap-3">
              <div className="font-bold text-sm flex-1" style={{ color: C.navy }}>Por setor <span className="text-xs font-normal" style={{ color: C.sub }}>· mês médio do período em aberto ({int(Number(alvo) || 0)} peças/mês) — o mês a mês fica no quadro abaixo</span></div>
              {mexeu && <button onClick={salvarDiarias} disabled={salvando} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.accent }}>
                {salvando ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar diárias/salários e recalcular</button>}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr><th colSpan={8} className="px-2.5 pt-1 text-center text-[10px] font-bold tracking-wider" style={{ color: C.sub }}>HISTÓRICO (média)</th>
                  <th colSpan={4} className="px-2.5 pt-1 text-center text-[10px] font-bold tracking-wider" style={{ color: C.yellow, borderLeft: `1px solid ${C.line}` }}>A · MANTER A EQUIPE</th>
                  <th colSpan={4} className="px-2.5 pt-1 text-center text-[10px] font-bold tracking-wider" style={{ color: C.green, borderLeft: `1px solid ${C.line}` }}>B · RECOMENDADO</th></tr>
                <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                  <Th>Setor</Th><Th dir>Diária (R$)</Th><Th dir>Salário previsto (R$)</Th><Th dir>Pessoas</Th><Th dir>Freelancer/mês</Th><Th dir>Diárias/mês</Th><Th dir>Freelancers/dia</Th><Th dir>Peças/trab.</Th>
                  <Th dir sep cor={C.yellow}>Precisa (trab.)</Th><Th dir cor={C.yellow}>Freelancers/dia</Th><Th dir cor={C.yellow}>Freelancer/mês</Th><Th dir cor={C.yellow}>% free</Th>
                  <Th dir sep cor={C.green}>Contratar</Th><Th dir cor={C.green}>Freelancers/dia</Th><Th dir cor={C.green}>Folha + free</Th><Th dir cor={C.green}>% free</Th>
                </tr>
              </thead>
              <tbody>
                {d.setores.map((s) => (
                  <tr key={s.setor} style={{ borderBottom: `1px solid ${C.line}` }}>
                    <Td forte>{s.setor}{s.jaPrecisa && <div className="text-[10px] font-semibold" style={{ color: C.red }}>já acima de 1/dia em {s.mesesAcima1} meses</div>}</Td>
                    <td className="px-2.5 py-1.5 text-center">
                      <input value={diarias[s.setor] ?? ""} onChange={(e) => { setDiarias((x) => ({ ...x, [s.setor]: e.target.value })); setMexeu(true); }} placeholder="informe"
                        className="rounded px-1.5 py-1 text-xs text-right" style={{ width: 80, border: `1px solid ${s.semDiaria ? C.yellow : C.line}`, background: s.semDiaria ? C.yellowSoft : "#fff" }} />
                    </td>
                    <td className="px-2.5 py-1.5 text-center" title={s.salarioPrevisto ? `Custo na Matriz por contratação: R$ ${brl(s.custoContratacao)}` : s.salarioBase ? `Sem salário previsto: usa o salário médio do setor (R$ ${brl(s.salarioBase)})` : ""}>
                      <input value={salarios[s.setor] ?? ""} onChange={(e) => { setSalarios((x) => ({ ...x, [s.setor]: e.target.value })); setMexeu(true); }} placeholder={s.salarioBase ? brl(s.salarioBase) : "informe"}
                        className="rounded px-1.5 py-1 text-xs text-right" style={{ width: 96, border: `1px solid ${C.line}`, background: "#fff" }} />
                      {s.custoContratacao != null && <div className="text-[9px] mt-0.5" style={{ color: C.sub }}>custo {curto(s.custoContratacao)}/mês</div>}
                    </td>
                    <Td dir>{um(s.pessoas)}</Td><Td dir>{brl(s.freelancer)}</Td><Td dir>{s.semDiaria ? "—" : int(s.diariasMes)}</Td><Td dir forte>{s.semDiaria ? "—" : um(s.freeDia)}</Td><Td dir>{s.semDiaria ? "—" : `${int(s.porTrab)} pç`}</Td>
                    <Td dir sep cor={C.yellow}>{s.A ? um(s.A.necessarios) : "—"}</Td><Td dir forte cor={C.yellow}>{s.A ? um(s.A.freeDia) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? brl(s.A.freelancer) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? pc(s.A.pct) : "—"}</Td>
                    <Td dir sep forte cor={C.green}>{s.B ? (s.B.contratar ? `+${s.B.contratar}` : "0") : "—"}</Td><Td dir cor={C.green}>{s.B ? um(s.B.freeDia) : "—"}</Td>
                    <Td dir cor={C.green}>{s.B ? (s.B.semCustoPessoa ? "sem custo na Matriz" : brl(s.B.custo)) : "—"}</Td><Td dir cor={C.green}>{s.B ? pc(s.B.pct) : "—"}</Td>
                  </tr>
                ))}
                <tr style={{ background: C.panel2 }}>
                  <Td forte>TOTAL</Td><Td dir></Td><Td dir></Td><Td dir forte>{um(T.pessoas)}</Td><Td dir forte>{brl(T.freelancer)}</Td><Td dir></Td><Td dir forte>{um(T.freeDia)}</Td><Td dir></Td>
                  <Td dir sep></Td><Td dir forte cor={C.yellow}>{T.A ? um(T.A.freeDia) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? brl(T.A.freelancer) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? pc(T.A.pct) : "—"}</Td>
                  <Td dir sep forte cor={C.green}>{T.B ? `+${T.B.contratar}` : "—"}</Td><Td dir forte cor={C.green}>{T.B ? um(T.B.freeDia) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? brl(T.B.custo) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? pc(T.B.pct) : "—"}</Td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* v234 — capacidade mês a mês: meses fechados ficam como estão; os em aberto seguem a sazonalidade das Metas,
               escalados para que o mês escolhido tenha a meta digitada */}
          {per && <div className="mb-4"><CapacidadeMensal user={user} ano={d.anoMetas} cap={d} pecasMes={per.pecasMes} nota={per.nota} fechados={per.fech} /></div>}
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
