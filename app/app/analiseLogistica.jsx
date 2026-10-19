"use client";
// v279 — Análise da logística: custo logístico por peça. Pessoal = folha da Matriz em todos os meses; demais contas = DRE do mês.
// v290 — mesma visão dos outros setores: planilha mensal em cima (clique no mês) e indicadores embaixo, na mesma ordem.
//   Valor cobrado na FPP = custo inteiro por peça (folha + custos), só sem o frete entrega; retorno à operação = FPP × peças do mês.
import React, { useEffect, useState } from "react";
import { Loader2, Truck } from "lucide-react";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", red: "#D92D20", soft: "#FFF1E8" };
const brl = (v) => (v == null ? "—" : (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const R = (v) => (v == null ? "—" : `R$ ${brl(v)}`);
const int = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const nomeMes = (c) => `${MES[Number(c.slice(5, 7)) - 1]}/${c.slice(2, 4)}`;
const nomeMesL = (c) => `${MESL[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;

export default function AnaliseLogistica({ user }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const [sel, setSel] = useState(null);
  useEffect(() => {
    fetch(`/api/producao/analises?u=${user.id}&setor=LOGISTICA`).then((r) => r.json())
      .then((j) => { if (j.error) return setErro(j.error); setD(j); const c = [...j.meses].reverse().find((m) => m.pecas > 0) || j.meses[j.meses.length - 1]; setSel(c?.comp || null); })
      .catch((e) => setErro(e.message));
  }, []);
  if (erro) return <div className="p-3 rounded text-sm" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>;
  if (!d) return <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Calculando pela DRE…</div>;

  const custoCols = d.contas.filter((c) => c.entra);
  const infoCols = d.contas.filter((c) => !c.entra);
  const M = d.media;
  const m = d.meses.find((x) => x.comp === sel);
  const Th = ({ children, dir, cor, bg }) => <th className={`px-2 py-1.5 font-semibold whitespace-nowrap ${dir ? "text-right" : "text-left"}`} style={{ color: cor || C.sub, background: bg }}>{children}</th>;
  const Td = ({ v, forte, cor, bg, peca }) => <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap" style={{ color: cor || C.text, fontWeight: forte ? 700 : 400, background: bg }}>{peca ? int(v) : brl(v)}</td>;

  return (
    <div>
      <div className="flex items-start gap-3 mb-3">
        <Truck size={22} style={{ color: C.accent }} className="mt-0.5" />
        <div className="flex-1">
          <div className="text-lg font-bold" style={{ color: C.navy }}>Análise da logística</div>
          <div className="text-xs" style={{ color: C.sub }}>
            Pessoal = folha da logística pela Matriz (igual em todos os meses); as demais contas vêm da DRE do mês. Peças = análise da expedição.
            O valor cobrado na FPP é o custo logístico inteiro por peça (folha + custos); só o <b>frete entrega</b> fica de fora, porque a FPP o cobra à parte (por volume).
          </div>
        </div>
      </div>

      {/* planilha mensal — últimos 6 meses */}
      <div className="rounded-xl p-4 mb-4 overflow-x-auto" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="font-bold text-sm mb-2" style={{ color: C.navy }}>Últimos 6 meses · {d.meses.length} mês(es) <span className="font-normal text-[11px]" style={{ color: C.sub }}>— clique no mês para ver os indicadores</span></div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              <Th>Mês</Th><Th dir>Pessoal</Th>
              {custoCols.map((c) => <Th key={c.k} dir>{c.n}</Th>)}
              <Th dir cor={C.navy}>Custo</Th><Th dir>Peças</Th><Th dir cor={C.accent} bg={C.soft}>Custo / peça</Th>
              {infoCols.map((c) => <Th key={c.k} dir cor="#98A2B3">{c.n}</Th>)}
            </tr>
          </thead>
          <tbody>
            {d.meses.map((x) => {
              const on = x.comp === sel;
              return (
                <tr key={x.comp} onClick={() => setSel(x.comp)} className="cursor-pointer" style={{ borderBottom: `1px solid ${C.line}`, background: on ? C.panel2 : undefined, fontWeight: on ? 700 : 400 }}>
                  <td className="px-2 py-1.5 whitespace-nowrap" style={{ color: on ? C.accent : C.text }}>{nomeMes(x.comp)}</td>
                  <Td v={x.pessoal} />
                  {custoCols.map((c) => <Td key={c.k} v={x.valores[c.k]} />)}
                  <Td v={x.custo} forte cor={C.navy} />
                  <Td v={x.pecas} peca />
                  <Td v={x.porPeca} forte cor={C.accent} bg={C.soft} />
                  {infoCols.map((c) => <Td key={c.k} v={x.valores[c.k]} cor="#98A2B3" />)}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-[11px] mt-2" style={{ color: C.sub }}>
          Custo = pessoal + {custoCols.map((c) => c.n.toLowerCase()).join(" + ")}. Em cinza, só informativo (fora do custo).
        </div>
      </div>

      {/* indicadores — mesma ordem dos outros setores */}
      {m && (
        <>
          <div className="text-sm font-bold mb-2" style={{ color: C.navy }}>{nomeMesL(m.comp)}</div>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
            <Kpi t="Peças no mês" v={int(m.pecas)} s="peças expedidas (análise da expedição)" />
            <Kpi t="Custo total do setor" v={R(m.custo)} s={`pessoal ${R(m.pessoal)} + custos ${R(m.custo - m.pessoal)}`} />
            <Kpi t="Custo incorrido / peça" v={R(m.porPeca)} cor={M.porPeca != null && m.porPeca != null ? (m.porPeca <= M.porPeca ? C.green : C.red) : C.navy}
              s={M.porPeca != null ? `cobrado na FPP ${R(M.porPeca)} / peça` : ""} />
            <Kpi destaque t="Retorno à operação" v={M.porPeca != null ? R(M.porPeca * m.pecas) : "—"} cor={C.navy}
              s={M.porPeca != null ? `${R(M.porPeca)} cobrado na FPP × ${int(m.pecas)} peças${m.custo ? ` · ${M.porPeca * m.pecas >= m.custo ? "cobre" : "não cobre"} o custo do mês` : ""}` : ""} />
            <Kpi destaque t="Valor cobrado na FPP" v={M.porPeca != null ? `${R(M.porPeca)} / pç` : "—"} cor={C.accent}
              s={M.meses.length ? `custo ${R(M.custo)} ÷ ${int(M.pecas)} peças · sem frete entrega · média ponderada ${M.meses.map(nomeMes).join(", ")}` : "sem peças nos últimos 6 meses"} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ t, v, s, cor, destaque }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="text-[11px] font-semibold uppercase" style={{ color: destaque ? cor : C.sub }}>{t}</div>
      <div className="text-lg font-bold tabular-nums" style={{ color: cor || C.navy }}>{v}</div>
      {s && <div className="text-[11px]" style={{ color: C.sub }}>{s}</div>}
    </div>
  );
}
