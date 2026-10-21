export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// v368 — Patrimônio: lista, cadastro, edição, exclusão e arquivo da NF de compra
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const up = (s) => (s === null || s === undefined || String(s).trim() === "" ? null : String(s).toUpperCase().trim());
const num = (v) => { if (v === null || v === undefined || v === "") return null; const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return isNaN(n) ? null : n; };
const SEL = { id: true, descricao: true, categoria: true, marcaModelo: true, serie: true, local: true, aquisicao: true, valorCompra: true, valorAtual: true,
  situacao: true, nfNumero: true, nfFornecedor: true, nfChave: true, nfArquivoNome: true, obs: true, criadoPorNome: true, updatedAt: true };
const saida = (x) => ({ ...x, aquisicao: x.aquisicao ? x.aquisicao.toISOString().slice(0, 10) : null, valorCompra: x.valorCompra == null ? null : Number(x.valorCompra), valorAtual: x.valorAtual == null ? null : Number(x.valorAtual) });

function dados(b) {
  const d = {};
  if ("descricao" in b) d.descricao = up(b.descricao) || "SEM DESCRIÇÃO";
  for (const k of ["categoria", "marcaModelo", "serie", "local", "nfNumero", "nfFornecedor", "obs"]) if (k in b) d[k] = up(b[k]);
  if ("nfChave" in b) d.nfChave = String(b.nfChave || "").replace(/\D/g, "") || null;
  if ("aquisicao" in b) d.aquisicao = /^\d{4}-\d{2}-\d{2}$/.test(String(b.aquisicao || "")) ? new Date(`${b.aquisicao}T00:00:00Z`) : null;
  for (const k of ["valorCompra", "valorAtual"]) if (k in b) d[k] = num(b[k]);
  if ("situacao" in b) d.situacao = ["ATIVO", "VENDIDO", "BAIXADO"].includes(b.situacao) ? b.situacao : "ATIVO";
  if (b.arquivo?.base64) { d.nfArquivo = b.arquivo.base64; d.nfArquivoNome = b.arquivo.nome || "nf"; }
  if (b.removerArquivo) { d.nfArquivo = null; d.nfArquivoNome = null; }
  return d;
}

// GET ?u= → itens · ?u=&arq=ID → arquivo da NF
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  if (q.get("arq")) {
    const x = await prisma.finPatrimonio.findUnique({ where: { id: Number(q.get("arq")) }, select: { nfArquivo: true, nfArquivoNome: true } });
    if (!x?.nfArquivo) return Response.json({ error: "Sem arquivo." }, { status: 404 });
    const nome = x.nfArquivoNome || "nf";
    const tipo = /\.xml$/i.test(nome) ? "application/xml" : /\.pdf$/i.test(nome) ? "application/pdf" : "application/octet-stream";
    return new Response(Buffer.from(x.nfArquivo, "base64"), { headers: { "Content-Type": tipo, "Content-Disposition": `inline; filename="${nome}"` } });
  }
  const itens = (await prisma.finPatrimonio.findMany({ orderBy: [{ situacao: "asc" }, { categoria: "asc" }, { descricao: "asc" }], select: SEL })).map(saida);
  return Response.json({ itens });
}

// POST { usuarioId, ...campos } → novo item
export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId); if (!u) return negadoGerencial();
  const x = await prisma.finPatrimonio.create({ data: { descricao: "SEM DESCRIÇÃO", ...dados(b), criadoPorNome: quemE(u) }, select: SEL });
  return Response.json({ ok: true, item: saida(x) });
}

// PATCH { usuarioId, id, ...campos } → edita
export async function PATCH(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId); if (!u) return negadoGerencial();
  const x = await prisma.finPatrimonio.update({ where: { id: Number(b.id) }, data: dados(b), select: SEL }).catch(() => null);
  if (!x) return Response.json({ error: "Item não encontrado." }, { status: 404 });
  return Response.json({ ok: true, item: saida(x) });
}

// DELETE { usuarioId, id }
export async function DELETE(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId); if (!u) return negadoGerencial();
  await prisma.finPatrimonio.delete({ where: { id: Number(b.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
