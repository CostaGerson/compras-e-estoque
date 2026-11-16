// v865 — envio de arquivo grande em partes e download
//   POST { nome, mime, tamanho }                     → { token, parte }   (precisa de usuário: cabeçalho x-usuario-id)
//   PUT  ?t=TOKEN&off=N  (corpo binário, até 8 MB)   → { recebido, completo }
//   GET  ?t=TOKEN[&baixar=1]                         → o arquivo
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { iniciar, parte, resposta, PARTE } from "@/lib/arquivos";

async function usuario(req) {
  const id = Number(req.headers.get("x-usuario-id") || new URL(req.url).searchParams.get("u")) || 0;
  return id ? prisma.usuario.findFirst({ where: { id, ativo: true }, select: { id: true, nome: true, sobrenome: true } }) : null;
}
export async function POST(req) {
  const u = await usuario(req);
  if (!u) return Response.json({ error: "Usuário inválido." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try { return Response.json({ token: await iniciar({ ...b, quem: [u.nome, u.sobrenome].filter(Boolean).join(" ") }), parte: PARTE }); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
export async function PUT(req) {
  const sp = new URL(req.url).searchParams;
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > PARTE) return Response.json({ error: "Parte grande demais." }, { status: 413 });
  try { return Response.json(await parte(sp.get("t"), Number(sp.get("off")) || 0, buf)); }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  return resposta(sp.get("t"), { baixar: sp.get("baixar") === "1" });
}
