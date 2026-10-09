export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial, garantirContas } from "@/lib/fin";
import { dre, mapaDeContas, salvarMapa, salvarPainel, TODOS_GRUPOS, GRUPOS_OPERACAO, GRUPOS_EXTERNOS, GRUPO_FORA } from "@/lib/finDre";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const CATALOGO = { operacao: GRUPOS_OPERACAO, externos: GRUPOS_EXTERNOS, fora: GRUPO_FORA, todos: TODOS_GRUPOS };

// GET ?u=&competencia=AAAA-MM[&mapa=1] → DRE do mês (e o de–para das contas)
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  const comp = q.get("competencia") || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  if (q.get("mapa")) await garantirContas();
  const [d, contas] = await Promise.all([dre(comp), q.get("mapa") ? mapaDeContas() : Promise.resolve(null)]);
  return Response.json({ ...d, grupos: CATALOGO, ...(contas ? { contas } : {}) });
}

// PUT { usuarioId, competencia, mapa:[{contaId,grupo}] | saldoInicial } → salva de–para / saldo inicial
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  const comp = b?.competencia || "";
  if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });

  if (Array.isArray(b.mapa)) {
    for (const m of b.mapa) {
      const r = await salvarMapa(m.contaId, m.grupo);
      if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
    }
  }
  if (b.saldoInicial !== undefined) {
    await salvarPainel(comp, { saldoInicial: b.saldoInicial === null ? null : Number(b.saldoInicial), quem: quemE(u) });
  }
  const [d, contas] = await Promise.all([dre(comp), mapaDeContas()]);
  return Response.json({ ok: true, ...d, grupos: CATALOGO, contas });
}
