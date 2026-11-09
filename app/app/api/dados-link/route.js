// v699 — links de dados unitários (lado de quem gera: vendedor ou portal do cliente)
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";
import { criarLink, verLink, mudarLimite } from "@/lib/dadosLink";

async function quem(req) {
  const u = await usuarioAtivoFin(req.headers.get("x-usuario-id"));
  if (!u) return null;
  if (u.setor === "CLIENTE" && !u.portalClienteId) return null;
  return u;
}
const negado = () => Response.json({ error: "Sem acesso." }, { status: 403 });
const pode = (u, l) => l && (u.setor !== "CLIENTE" || l.portalClienteId === u.portalClienteId);

// GET ?id= → respostas e previsão de peças
export async function GET(req) {
  const u = await quem(req);
  if (!u) return negado();
  const l = await verLink(new URL(req.url).searchParams.get("id"));
  if (!pode(u, l)) return Response.json({ error: "Link não encontrado." }, { status: 404 });
  return Response.json(l);
}

// POST { acao: "criar", titulo, clienteNome, campos, tamanhos } · { acao: "fechar" | "reabrir", id }
export async function POST(req) {
  const u = await quem(req);
  if (!u) return negado();
  const b = await req.json().catch(() => ({}));
  if (b.acao === "criar") {
    const r = await criarLink(b, { u, portalClienteId: u.setor === "CLIENTE" ? u.portalClienteId : null });
    return Response.json(r, { status: r.error ? 400 : 201 });
  }
  const l = await verLink(b.id);
  if (!pode(u, l)) return Response.json({ error: "Link não encontrado." }, { status: 404 });
  if (b.acao === "fechar" || b.acao === "reabrir") {
    const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
    await prisma.dadoUnitarioLink.update({ where: { id: l.id }, data: b.acao === "fechar" ? { aberto: false, fechadoEm: new Date(), fechadoPorNome: nome } : { aberto: true, fechadoEm: null, fechadoPorNome: null } });
    return Response.json(await verLink(l.id));
  }
  if (b.acao === "prazo") {   // v702
    const r = await mudarLimite(l.id, b.limite);
    if (r.error) return Response.json(r, { status: 400 });
    return Response.json(await verLink(l.id));
  }
  return Response.json({ error: "Ação desconhecida." }, { status: 400 });
}
