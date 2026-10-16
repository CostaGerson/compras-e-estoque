"use client";
// v274 — Matriz: contratações / acionamento de freelancers que a simulação exige no período em aberto
// (mesma conta da Capacidade × freelancer: produtividade dos últimos 3 meses, A = só freelancer, B = contratar acima de 1/dia)
import React, { useState, useEffect } from "react";
import { Loader2, X } from "lucide-react";
import CapacidadeMensal from "./capacidadeMensal";

const C = { panel: "#FFFFFF", panel2: "#F1F3F5", line: "#E4E7EC", text: "#1F2733", sub: "#667085", navy: "#001E41", accent: "#FF6B1A", green: "#12A150", yellow: "#C08401", red: "#D92D20" };
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const um = (v) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const pc = (v) => (v == null ? "—" : `${((Number(v) || 0) * 100).toFixed(2).replace(".", ",")}%`);

export default function CapacidadeSimulacao({ user, dados, onClose }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState("");
  const pr = dados?.producao || {};
  const f = dados?.fechamento;
  const fech = f?.fechados || Array(12).fill(false);
  const pecasMes = Array.isArray(f?.pcsMeses) && f.pcsMeses.length === 12 ? f.pcsMeses.map((x) => Number(x) || 0) : Array(12).fill(Math.round(Number(pr.metaPecas) || 0));
  const abertos = pecasMes.filter((_, i) => !fech[i]);
  const alvo = Math.round(abertos.length ? abertos.reduce((t, x) => t + x, 0) / abertos.length : Number(pr.metaPecas) || 0);
  const ano = Number(f?.ano || dados?.simulacaoCapacidade?.ano) || new Date().getFullYear();
  const cen = dados?.simulacaoCapacidade?.cenario || "ATUAL";
  useEffect(() => {
    if (!alvo) { setErro("A simulação não tem meta de peças."); return; }
    fetch(`/api/kpi/capacidade?u=${user.id}&meses=3&ano=${ano}&alvo=${alvo}`).then((r) => r.json())
      .then((j) => (j.error ? setErro(j.error) : setD(j))).catch((e) => setErro(e.message));
  }, []);
  const Th = ({ children, dir, cor, sep }) => <th className={`px-2 py-1.5 font-semibold ${dir ? "text-right" : "text-left"}`} style={{ color: cor || C.sub, borderLeft: sep ? `1px solid ${C.line}` : undefined }}>{children}</th>;
  const Td = ({ children, dir, cor, forte, sep }) => <td className={`px-2 py-1.5 ${dir ? "text-right tabular-nums" : ""}`} style={{ color: cor || C.text, fontWeight: forte ? 700 : 400, borderLeft: sep ? `1px solid ${C.line}` : undefined }}>{children}</td>;
  const T = d?.total;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,30,65,.45)" }} onClick={onClose}>
      <div className="rounded-xl p-4 w-full max-w-[1100px] max-h-[92vh] overflow-auto" style={{ background: C.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start mb-2 gap-2">
          <div className="flex-1">
            <div className="font-bold" style={{ color: C.navy }}>Contratações e freelancers do período em aberto</div>
            <div className="text-[11px]" style={{ color: C.sub }}>
              Meta da simulação: {int(alvo)} peças/mês (média dos meses em aberto) · produtividade dos últimos 3 meses (Capacidade × freelancer).
              Ajuste desta simulação: <b>{cen === "ATUAL" ? "equipe de hoje" : `cenário ${cen}`}</b>.
            </div>
          </div>
          <button onClick={onClose} style={{ color: C.sub }}><X size={18} /></button>
        </div>
        {erro && <div className="p-2 rounded text-xs" style={{ background: "#FDECEA", color: C.red }}>{erro}</div>}
        {!d && !erro && <div className="flex items-center gap-2 text-sm" style={{ color: C.sub }}><Loader2 size={15} className="animate-spin" /> Calculando…</div>}
        {d && (
          <>
            <div className="rounded-lg overflow-x-auto" style={{ border: `1px solid ${C.line}` }}>
              <table className="w-full text-xs">
                <thead>
                  <tr><th colSpan={5} className="pt-1 text-center text-[10px] font-bold" style={{ color: C.sub }}>HOJE (média 3 meses)</th>
                    <th colSpan={4} className="pt-1 text-center text-[10px] font-bold" style={{ color: C.yellow, borderLeft: `1px solid ${C.line}`, background: cen === "A" ? "#FFF6DD" : undefined }}>A · SÓ FREELANCER</th>
                    <th colSpan={4} className="pt-1 text-center text-[10px] font-bold" style={{ color: C.green, borderLeft: `1px solid ${C.line}`, background: cen === "B" ? "#E7F6EE" : undefined }}>B · CONTRATAR ACIMA DE 1/DIA</th></tr>
                  <tr style={{ borderBottom: `1px solid ${C.line}` }}>
                    <Th>Setor</Th><Th dir>Pessoas</Th><Th dir>Freelancers/dia</Th><Th dir>Freelancer/mês</Th><Th dir>Peças/trab.</Th>
                    <Th dir sep cor={C.yellow}>Precisa (trab.)</Th><Th dir cor={C.yellow}>Freelancers/dia</Th><Th dir cor={C.yellow}>Freelancer/mês</Th><Th dir cor={C.yellow}>% free</Th>
                    <Th dir sep cor={C.green}>Contratar</Th><Th dir cor={C.green}>Freelancers/dia</Th><Th dir cor={C.green}>Folha + free</Th><Th dir cor={C.green}>% free</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.setores.map((s) => (
                    <tr key={s.setor} style={{ borderBottom: `1px solid ${C.line}` }}>
                      <Td forte>{s.setor}{s.semDiaria && <div className="text-[10px]" style={{ color: C.yellow }}>sem diária cadastrada</div>}</Td>
                      <Td dir>{um(s.pessoas)}</Td><Td dir>{s.semDiaria ? "—" : um(s.freeDia)}</Td><Td dir>{brl(s.freelancer)}</Td><Td dir>{s.porTrab ? `${int(s.porTrab)} pç` : "—"}</Td>
                      <Td dir sep cor={C.yellow}>{s.A ? um(s.A.necessarios) : "—"}</Td><Td dir forte cor={C.yellow}>{s.A ? um(s.A.freeDia) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? brl(s.A.freelancer) : "—"}</Td><Td dir cor={C.yellow}>{s.A ? pc(s.A.pct) : "—"}</Td>
                      <Td dir sep forte cor={C.green}>{s.B ? (s.B.contratar ? `+${s.B.contratar}` : "0") : "—"}</Td><Td dir cor={C.green}>{s.B ? um(s.B.freeDia) : "—"}</Td><Td dir cor={C.green}>{s.B ? brl(s.B.custo) : "—"}</Td><Td dir cor={C.green}>{s.B ? pc(s.B.pct) : "—"}</Td>
                    </tr>
                  ))}
                  <tr style={{ background: C.panel2 }}>
                    <Td forte>TOTAL</Td><Td dir forte>{um(T.pessoas)}</Td><Td dir forte>{um(T.freeDia)}</Td><Td dir forte>{brl(T.freelancer)}</Td><Td dir />
                    <Td dir sep /><Td dir forte cor={C.yellow}>{T.A ? um(T.A.freeDia) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? brl(T.A.freelancer) : "—"}</Td><Td dir forte cor={C.yellow}>{T.A ? pc(T.A.pct) : "—"}</Td>
                    <Td dir sep forte cor={C.green}>{T.B ? `+${T.B.contratar}` : "—"}</Td><Td dir forte cor={C.green}>{T.B ? um(T.B.freeDia) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? brl(T.B.custo) : "—"}</Td><Td dir forte cor={C.green}>{T.B ? pc(T.B.pct) : "—"}</Td>
                  </tr>
                </tbody>
              </table>
            </div>
            <CapacidadeMensal user={user} ano={ano} cap={d} pecasMes={pecasMes} fechados={fech} nota="Mês a mês do período em aberto com as peças desta simulação." />
          </>
        )}
      </div>
    </div>
  );
}
