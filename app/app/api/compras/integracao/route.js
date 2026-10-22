// v406 — token da leitura externa do PCP (mostrado ao gestor para passar ao Maycon)
export const dynamic = "force-dynamic";
import { tokenExterno } from "@/lib/compras";

export async function GET() { return Response.json({ token: await tokenExterno(), caminho: "/api/ext/compras" }); }
export async function POST() { return Response.json({ token: await tokenExterno(undefined, true), caminho: "/api/ext/compras" }); }
