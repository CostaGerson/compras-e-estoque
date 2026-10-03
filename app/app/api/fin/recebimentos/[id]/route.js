export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { formatarCnpj } from "@/lib/finNfSaida";

const up = (s) => (s === null || s === undefined || s === "" ? null : String(s).toUpperCase().trim());

// PATCH { usuarioId, campo, valor } → edita uma célula
export async function PATCH(req, { params }) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();

  const campos = ["data", "titulo", "valor", "nf", "nomePagador", "cnpj", "obs", "bloco"];
  if (!campos.includes(b.campo)) return Response.json({ error: "Campo inválido." }, { status: 400 });

  const data = { editado: true };
  if (b.campo === "valor") {
    const n = Number(String(b.valor).replace(/\./g, "").replace(",", "."));
    if (isNaN(n)) return Response.json({ error: "Valor inválido." }, { status: 400 });
    data.valor = n;
  } else if (b.campo === "data") {
    const t = String(b.valor || "").slice(0, 10);
    data.data = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00.000Z`) : null;
  } else if (b.campo === "cnpj") {
    data.cnpj = b.valor ? formatarCnpj(b.valor) : null;
  } else if (b.campo === "bloco") {
    data.bloco = ["CREDITO", "BOLETO", "CONFIRMAR"].includes(b.valor) ? b.valor : "CREDITO";
  } else data[b.campo] = up(b.valor);

  const l = await prisma.finRecebimento.update({
    where: { id: Number(params.id) }, data,
    select: { id: true, bloco: true, data: true, titulo: true, valor: true, nf: true, nomePagador: true, cnpj: true, obs: true, origem: true, editado: true },
  }).catch(() => null);
  if (!l) return Response.json({ error: "Linha não encontrada." }, { status: 404 });
  return Response.json({ ok: true, linha: l });
}

// DELETE ?u=
export async function DELETE(req, { params }) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  await prisma.finRecebimento.delete({ where: { id: Number(params.id) } }).catch(() => null);
  return Response.json({ ok: true });
}
