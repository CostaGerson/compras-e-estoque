// v699 — link público de dados unitários (sem login: vale o link)
export const dynamic = "force-dynamic";
import { linkPublico, responder } from "@/lib/dadosLink";

export async function GET(req, { params }) {
  const l = await linkPublico(params.token);
  return l ? Response.json(l) : Response.json({ error: "Link não encontrado." }, { status: 404 });
}

// POST { responsavel, pecas: [{ tam, valores }] }
export async function POST(req, { params }) {
  const b = await req.json().catch(() => ({}));
  const r = await responder(params.token, b);
  return Response.json(r, { status: r.error ? 400 : 201 });
}
