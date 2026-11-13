// v805 — cliente digitado na FPP sem ter sido escolhido/registrado: entra no cadastro de Clientes (só com o nome)
//   para aparecer no lançamento de pedido. Mesmo nome (razão social ou fantasia) reaproveita o cadastro.
import { prisma } from "@/lib/prisma";

export async function clienteDaFpp(nome, id) {
  if (id != null && Number(id)) return Number(id);
  const n = String(nome || "").trim().toUpperCase();
  if (!n) return null;
  const ex = await prisma.cliente.findFirst({ where: { OR: [{ razaoSocial: { equals: n, mode: "insensitive" } }, { nomeFantasia: { equals: n, mode: "insensitive" } }] },
    orderBy: [{ ativo: "desc" }, { id: "asc" }], select: { id: true, ativo: true } });
  if (ex) { if (!ex.ativo) await prisma.cliente.update({ where: { id: ex.id }, data: { ativo: true } }); return ex.id; }
  return (await prisma.cliente.create({ data: { razaoSocial: n, cnpj: null, ativo: true }, select: { id: true } })).id;
}

// FPPs antigas com cliente só digitado: cadastra e liga (roda ao listar os clientes)
let _feito = 0;
export async function cadastrarClientesDasFpps() {
  if (Date.now() - _feito < 60_000) return;
  _feito = Date.now();
  const l = await prisma.fpp.findMany({ where: { clienteId: null, NOT: { clienteNome: null } }, select: { id: true, clienteNome: true } });
  const cache = new Map();
  for (const f of l) {
    const n = String(f.clienteNome || "").trim().toUpperCase();
    if (!n) continue;
    if (!cache.has(n)) cache.set(n, await clienteDaFpp(n));
    await prisma.fpp.update({ where: { id: f.id }, data: { clienteId: cache.get(n), clienteNome: n } });
  }
}
