// v486 — painel de compras: itens de PIC por etapa
export const dynamic = "force-dynamic";
import { painelDemandas } from "@/lib/pic";
export async function GET() { return Response.json(await painelDemandas()); }
