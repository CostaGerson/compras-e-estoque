// v779 — #33: GET ?u=&data=AAAA-MM-DD → prévia da cobrança semanal · POST { usuarioId, data, forcar } → envia agora (master)
export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { cobrancaSemanal } from "@/lib/cobrancaSemanal";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioSoMaster(sp.get("u"));
  if (!u) return soMaster();
  return Response.json(await cobrancaSemanal({ dataIso: sp.get("data") || undefined, previa: true }));
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId);
  if (!u) return soMaster();
  return Response.json(await cobrancaSemanal({ dataIso: b.data || undefined, forcar: !!b.forcar }));
}
