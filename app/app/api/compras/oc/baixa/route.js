// v532 — baixa da OC (material recebido): arquivos do recebimento, justificativa sem NF e liberação dos itens para o PCP
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { baixarOc, reabrirOc } from "@/lib/pic";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const x = b.acao === "reabrir" ? await reabrirOc(b.ocId) : await baixarOc(b, b.quem);
  return Response.json(x, { status: x?.error ? 400 : 200 });
}
