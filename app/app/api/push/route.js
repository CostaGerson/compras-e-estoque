// v466 — inscrição do aparelho para receber notificações (Web Push)
export const dynamic = "force-dynamic";
import { usuarioAtivoFin } from "@/lib/fin";
import { chavePublica, inscrever, remover, notificar } from "@/lib/push";

export async function GET() {
  try { return Response.json({ publicKey: await chavePublica() }); }
  catch (e) { return Response.json({ error: e.message }, { status: 500 }); }
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "inscrever": return r(await inscrever(u.id, b.sub, b.aparelho));
    case "remover": return r(await remover(b.endpoint));
    case "teste": return r(await notificar(u.id, { titulo: "ERP Meridian", texto: "Notificações ligadas neste aparelho. ✅", tag: "teste" }));
    default: return Response.json({ error: "Ação?" }, { status: 400 });
  }
}
