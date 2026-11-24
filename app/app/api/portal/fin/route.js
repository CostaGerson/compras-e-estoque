// v1081 — Financeiro do portal do cliente (Loja Way): contas a pagar/receber, plano de contas e análise mensal.
// Mesmo acesso do portal: usuário do cliente (setor CLIENTE) ou acesso interno pelo ERP (x-portal-cliente).
export const dynamic = "force-dynamic";
import { usuarioPortal, negadoPortal } from "@/lib/portalCliente";
import { listarTitulos, salvarTitulo, acaoTitulo, listarContas, salvarConta, analiseMensal, pedidosParaReceber, GRUPOS } from "@/lib/portalFin";

const resp = (x) => Response.json(x, { status: x?.error ? 400 : 200 });

// GET ?tipo=PAGAR|RECEBER&de=&ate= · ?analise=1&ano=&regime=REALIZADO|PREVISTO · ?contas=1 · ?pedidos=1
export async function GET(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const q = new URL(req.url).searchParams;
  try {
    if (q.get("matriz")) { const { obterMatriz, SECOES } = await import("@/lib/portalMatriz"); return resp({ ...(await obterMatriz(p.cliente)), secoes: SECOES }); }   // v1091
    if (q.get("analise")) return resp(await analiseMensal(p.cliente, { ano: q.get("ano"), regime: q.get("regime") }));
    if (q.get("contas")) return resp({ contas: await listarContas(p.cliente.id), grupos: GRUPOS });
    if (q.get("pedidos")) return resp({ pedidos: await pedidosParaReceber(p.cliente) });
    return resp(await listarTitulos(p.cliente, { tipo: q.get("tipo"), de: q.get("de"), ate: q.get("ate") }));
  } catch (e) { console.log("portal/fin:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}

// POST { acao: "salvar", titulo } | { acao: "baixar"|"estornar"|"excluir", id, data?, valor? } | { acao: "conta", conta }
export async function POST(req) {
  const p = await usuarioPortal(req);
  if (!p) return negadoPortal();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "salvar") return resp(await salvarTitulo(p.cliente, b.titulo || {}, p.u));
    if (["baixar", "estornar", "excluir"].includes(b.acao)) return resp(await acaoTitulo(p.cliente, { id: b.id, acao: b.acao.toUpperCase(), data: b.data, valor: b.valor }, p.u));
    if (b.acao === "matriz") { const { salvarMatriz } = await import("@/lib/portalMatriz"); return resp(await salvarMatriz(p.cliente, b.dados || {}, p.u)); }   // v1091
    if (b.acao === "matrizContas") { const { gerarContasMes } = await import("@/lib/portalMatriz"); return resp(await gerarContasMes(p.cliente, b.mes, p.u)); }
    if (b.acao === "conta") return resp(await salvarConta(p.cliente.id, b.conta || {}));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { console.log("portal/fin:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}
