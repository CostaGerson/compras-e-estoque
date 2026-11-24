// v469 — ordens de compra (geradas pelo PIC, uma por fornecedor)
export const dynamic = "force-dynamic";
import { listarOcs, salvarOc, juntarOcs } from "@/lib/pic";

export async function GET() { return Response.json(await listarOcs()); }
export async function POST(req) {   // v1072 — juntar OCs abertas do mesmo fornecedor
  const b = await req.json().catch(() => ({}));
  if (b.acao === "cancelarItem") { const { cancelarItemOc } = await import("@/lib/pic"); const x = await cancelarItemOc(b.ocItemId, b.quem || null, b.motivo); return Response.json(x, { status: x?.error ? 400 : 200 }); }   // v1087
  if (b.acao !== "juntar") return Response.json({ error: "Ação?" }, { status: 400 });
  const x = await juntarOcs(b.id, b.ids, b.quem || null);
  return Response.json(x, { status: x?.error ? 400 : 200 });
}
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const x = await salvarOc(b);
  return Response.json(x, { status: x?.error ? 400 : 200 });
}
