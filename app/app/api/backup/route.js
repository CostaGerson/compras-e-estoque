export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 900;
import fs from "fs";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { infoBackup, gerarBackup, arquivoDoDia } from "@/lib/backup";

// v190 — a rota não estava no repositório (o .gitignore "backup/" ignorava também esta pasta)
async function master(id) {
  const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 }, select: { id: true, nome: true, sobrenome: true, isMaster: true, diretoria: true, ativo: true } });
  return u?.ativo && (u.isMaster || u.diretoria) ? u : null;
}
const nego = () => Response.json({ error: "Backup: só o master e a diretoria." }, { status: 403 });

// GET ?u=                     → situação do backup (último, cópias dos últimos dias, erro)
// GET ?u=&baixar=1[&data=AAAA-MM-DD] → baixa o ZIP (o mais recente ou a cópia do dia)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await master(sp.get("u")))) return nego();
  if (!sp.get("baixar")) return Response.json(infoBackup());
  const arq = arquivoDoDia(sp.get("data"));
  let st;
  try { st = fs.statSync(arq); } catch { return Response.json({ error: "Backup não encontrado." }, { status: 404 }); }
  const nome = `meridian-backup-${sp.get("data") || infoBackup().data || "ultimo"}.zip`;
  return new Response(Readable.toWeb(fs.createReadStream(arq)), {
    headers: { "Content-Type": "application/zip", "Content-Length": String(st.size), "Content-Disposition": `attachment; filename="${nome}"` },
  });
}

// POST { usuarioId } → gera agora (em segundo plano; a tela acompanha pelo GET)
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await master(b.usuarioId);
  if (!u) return nego();
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  gerarBackup({ quem }).catch((e) => console.error("[backup]", e.message));
  await new Promise((r) => setTimeout(r, 300));
  return Response.json(infoBackup());
}
