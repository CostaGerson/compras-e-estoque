export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivo, ehMaster, negadoKpi as negado } from "@/lib/kpi";
import { analisarCapacidade, salvarDiarias } from "@/lib/gestaoCapacidade";
import { salvarSalarios, criarSimulacao } from "@/lib/capacidadeSimulacao";

const nomeU = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// v229 — GET ?u=&meses=6&alvo=15000&ano=2026 → capacidade × freelancer por setor (pela diária de cada área)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivo(sp.get("u"));
  if (!ehMaster(u)) return negado("Capacidade: master e diretoria.");
  try { return Response.json(await analisarCapacidade({ meses: sp.get("meses"), alvo: sp.get("alvo"), ano: sp.get("ano") })); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
// POST { usuarioId, diarias: { COSTURA: 180, ... }, salarios: { COSTURA: 1900, ... } } → grava diária e salário previsto por área
// POST { usuarioId, acao: "simular", cenario: "A" | "B", meses, alvo, ano, mes } → cria a Simulação na Matriz (v234)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!ehMaster(u)) return negado("Só o financeiro altera.");
  try {
    if (b.acao === "simular") {
      if (!["A", "B"].includes(b.cenario)) return Response.json({ error: "Cenário inválido." }, { status: 400 });
      const analise = await analisarCapacidade({ meses: b.meses, alvo: b.alvo, ano: b.ano });
      return Response.json(await criarSimulacao({ analise, cenario: b.cenario, ano: b.ano, mes: b.mes, quem: nomeU(u), pecasMes: b.pecasMes }));
    }
    const out = {};
    if (b.diarias) out.diarias = await salvarDiarias(b.diarias);
    if (b.salarios) out.salarios = await salvarSalarios(b.salarios);
    return Response.json(out);
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
