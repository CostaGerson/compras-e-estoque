// v628 — Dados › Tributário
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { gerencial } from "@/lib/acesso";
import { dadosTributarios, salvarEmpresa, salvarNatureza, excluirNatureza, salvarProduto } from "@/lib/tributario";

const usuario = async (id) => { const u = await prisma.usuario.findUnique({ where: { id: Number(id) || 0 } }); return u?.ativo ? u : null; };
const pode = (u) => u && (gerencial(u) || u.setor === "FINANCEIRO");
export async function GET(req) {
  const u = await usuario(new URL(req.url).searchParams.get("u"));
  if (!u) return Response.json({ error: "Sem acesso." }, { status: 403 });
  return Response.json(await dadosTributarios());
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuario(b.usuarioId);
  if (!pode(u)) return Response.json({ error: "Só o financeiro/gestão altera os dados tributários." }, { status: 403 });
  const r = b.acao === "empresa" ? await salvarEmpresa(b.dados) : b.acao === "produto" ? await salvarProduto(b.dados || {}) : b.acao === "excluirNatureza" ? await excluirNatureza(b.id) : await salvarNatureza(b.dados || {});
  return Response.json(r, { status: r.error ? 400 : 200 });
}
