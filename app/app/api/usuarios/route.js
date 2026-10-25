export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { ator, soMasterUsuarios, limparPermissoes } from "@/lib/usuariosAcesso";

const up = (v) => (v ? String(v).trim().toUpperCase() : "");
const txt = (v) => (v == null ? "" : String(v).trim());
const bool = (v) => v === true || v === "true" || v === 1;
const PERMS = ["permLancaPedidos", "permLancaContas", "permAlteraStatus", "permVeValores"];
// v167 — chave Diretoria liga lançar/editar contas e pedidos e ver valores
const aplicaDiretoria = (data) => { if (data.diretoria) { data.isMaster = false; data.permLancaPedidos = true; data.permLancaContas = true; data.permVeValores = true; data.permAlteraStatus = true; } };
const semSegredos = (u) => { if (!u) return u; const { resetHash, resetExpira, ...r } = u; return r; };

export async function GET(req) {
  const a = await ator(new URL(req.url).searchParams.get("u"));
  if (!a?.isMaster) return soMasterUsuarios();
  // v451 — pessoas da folha (Matriz oficial) para ligar ao usuário (motorista vê "Minha rota", RH, ponto…)
  if (new URL(req.url).searchParams.get("pessoas")) {
    const m = await prisma.finMatriz.findFirst({ where: { oficial: true }, select: { dados: true } });
    const folha = (m?.dados?.pessoal || []).filter((p) => p && p.id && p.ativo !== false);
    const fichas = await prisma.rhFuncionario.findMany({ where: { pessoaId: { in: folha.map((p) => p.id) } }, select: { pessoaId: true, nomeCompleto: true } });
    const fi = Object.fromEntries(fichas.map((f) => [f.pessoaId, f.nomeCompleto]));
    return Response.json(folha.map((p) => ({ id: p.id, nome: String(fi[p.id] || p.nome || "").toUpperCase(), cargo: p.cargo || "" })).sort((x, y) => x.nome.localeCompare(y.nome)));
  }
  const usuarios = await prisma.usuario.findMany({ orderBy: [{ isMaster: "desc" }, { nome: "asc" }] });
  return Response.json(usuarios.map(semSegredos));
}

export async function POST(req) {
  const b = await req.json();
  if (!(await ator(b.atorId))?.isMaster) return soMasterUsuarios();
  if (!txt(b.nome)) return Response.json({ error: "Nome é obrigatório" }, { status: 400 });
  if (!txt(b.login)) return Response.json({ error: "Usuário (login) é obrigatório" }, { status: 400 });
  const data = {
    nome: up(b.nome),
    sobrenome: up(b.sobrenome),
    email: txt(b.email).toLowerCase(),
    login: txt(b.login).toLowerCase(),
    senha: txt(b.senha),
    fotoBase64: b.fotoBase64 || null,
    setor: b.setor || "PCP",
    isMaster: bool(b.isMaster),
    ativo: b.ativo === undefined ? true : bool(b.ativo),
    pessoaId: txt(b.pessoaId) || null,   // v451
  };
  for (const p of PERMS) data[p] = bool(b[p]);
  data.diretoria = bool(b.diretoria);
  aplicaDiretoria(data);
  const pm = limparPermissoes(b.permissoes, data);
  if (pm) data.permissoes = pm;   // nenhuma = todas as do tipo
  try {
    const u = await prisma.usuario.create({ data });
    return Response.json(semSegredos(u), { status: 201 });
  } catch (e) {
    if (e.code === "P2002") return Response.json({ error: "Já existe um usuário com esse login" }, { status: 400 });
    return Response.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
