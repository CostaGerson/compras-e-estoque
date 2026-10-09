export const dynamic = "force-dynamic";
import { pedirRedefinicao, baseUrl } from "@/lib/senha";

// POST { chave: login ou e-mail } → envia o link de redefinição por e-mail
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  try {
    const r = await pedirRedefinicao(b.chave, baseUrl(req));
    return Response.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return Response.json({ ok: false, erro: `Não consegui enviar o e-mail: ${e.message}` }, { status: 500 });
  }
}
