export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioAtivoFin, negado as negadoFin } from "@/lib/fin";
import { gerencial, tipoDe } from "@/lib/acesso";
// v170 — cadastro de freelancers e terceirizados: master, diretoria, produção, administrativo e financeiro
const usuarioMaster = async (id) => { const u = await usuarioAtivoFin(id); return u && (gerencial(u) || ["PRODUCAO", "ADMINISTRATIVO", "FINANCEIRO"].includes(tipoDe(u))) ? u : null; };
const negado = () => Response.json({ error: "Sem permissão para o cadastro de prestadores." }, { status: 403 });
import {
  listar, salvar, excluir, SETORES_FREELANCER, SERVICOS_DE_TERCEIRIZADO,
  TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, garantirContasPrestadores,
} from "@/lib/prestadores";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const CATALOGOS = {
  FREELANCER: SETORES_FREELANCER,
  TERCEIRIZADO: SERVICOS_DE_TERCEIRIZADO,
  faccao: TIPOS_FACCAO,
  servicos: SERVICOS_TERCEIRIZADOS,
};

// GET ?u=&tipo=FREELANCER|TERCEIRIZADO → cadastro + catálogos
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioMaster(q.get("u")))) return negado();
  await garantirContasPrestadores().catch(() => null);
  return Response.json({ prestadores: await listar(q.get("tipo")), catalogos: CATALOGOS });
}

// POST { usuarioId, tipo, campos } → cadastra
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await salvar(b.tipo, b.campos || {}, { quem: quemE(u) });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, prestadores: await listar(b.tipo), catalogos: CATALOGOS });
}

// PUT { usuarioId, tipo, id, campos } → edita
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await salvar(b.tipo, b.campos || {}, { id: b.id, quem: quemE(u) });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, prestadores: await listar(b.tipo), catalogos: CATALOGOS });
}

// DELETE { usuarioId, tipo, id } → apaga (ou desativa, se já tiver lançamento)
export async function DELETE(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await excluir(b.id);
  return Response.json({ ...r, prestadores: await listar(b.tipo), catalogos: CATALOGOS });
}
