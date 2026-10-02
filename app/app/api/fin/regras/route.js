export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, garantirRegrasBase, dadosRegra } from "@/lib/fin";

// GET ?u= → todas as palavras-chave em ordem de prioridade
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await garantirRegrasBase();
  return Response.json(await prisma.finRegra.findMany({ orderBy: [{ ordem: "asc" }, { id: "asc" }], include: { conta: true } }));
}

// POST { usuarioId, descricao, comparar, termo, campo, banco, dc, contaId } → entra no TOPO da prioridade
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioMaster(b.usuarioId);
  if (!u) return negado();
  const d = dadosRegra(b);
  if (!d.termo || !d.contaId) return Response.json({ error: "Informe a palavra-chave e a conta-caixa." }, { status: 400 });
  const min = await prisma.finRegra.aggregate({ _min: { ordem: true } });
  const r = await prisma.finRegra.create({
    data: { ...d, ordem: (min._min.ordem ?? 10) - 10, origem: "MANUAL", criadoPorNome: [u.nome, u.sobrenome].join(" ").trim().toUpperCase() },
    include: { conta: true },
  });
  return Response.json(r);
}
