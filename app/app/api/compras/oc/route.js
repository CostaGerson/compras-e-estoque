// v469 — ordens de compra (geradas pelo PIC, uma por fornecedor)
export const dynamic = "force-dynamic";
import { listarOcs, salvarOc } from "@/lib/pic";

export async function GET() { return Response.json(await listarOcs()); }
export async function PATCH(req) {
  const b = await req.json().catch(() => ({}));
  const x = await salvarOc(b);
  return Response.json(x, { status: x?.error ? 400 : 200 });
}
