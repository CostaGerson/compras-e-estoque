// v486 — painel de compras: itens de PIC por etapa
export const dynamic = "force-dynamic";
import { painelDemandas } from "@/lib/pic";
export async function GET(req) { const av = !!new URL(req.url).searchParams.get("avulsas"); return Response.json(await painelDemandas({ avulsasAbertas: true, soAvulsas: av })); }   // v504 — o principal também traz as avulsas pendentes   // v495
