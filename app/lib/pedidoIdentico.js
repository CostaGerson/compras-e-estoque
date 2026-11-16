// v866 — aviso de pedido idêntico: mesmo cliente (CNPJ ou nome), mesmo valor total e mesma OC em mais de um pedido.
// Roda depois de cada entrada de pedido (KM, PV/PP, relatório, efetivação no sistema). Cada grupo avisa uma vez
// (FinConfig "pedido-identico:<números>"); se entrar mais um pedido igual, avisa de novo com a lista nova.
import { prisma } from "@/lib/prisma";

const nz = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dBR = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "—");

export async function avisarPedidosIdenticos() {
  const desde = new Date(Date.now() - 30 * 864e5);   // só grupos com pedido novo nos últimos 30 dias (não avisa o histórico antigo)
  const ps = await prisma.pedidoVenda.findMany({ where: { NOT: { status: "CANCELADO" }, oc: { not: null } },
    select: { numero: true, cliente: true, cnpj: true, total: true, oc: true, emissao: true, createdAt: true, status: true } });
  const g = new Map();
  for (const p of ps) {
    const oc = nz(p.oc), tot = Math.round(Number(p.total || 0) * 100), cli = String(p.cnpj || "").replace(/\D/g, "") || nz(p.cliente);
    if (!oc || !tot || !cli) continue;
    const k = `${cli}|${tot}|${oc}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(p);
  }
  const grupos = [...g.values()].filter((l) => l.length > 1 && l.some((p) => new Date(p.createdAt) >= desde));
  if (!grupos.length) return 0;
  const para = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { diretoria: true }] }, select: { id: true, isMaster: true } });
  if (!para.length) return 0;
  const de = (para.find((u) => u.isMaster) || para[0]).id;
  let n = 0;
  for (const l of grupos) {
    l.sort((a, b) => String(a.numero).localeCompare(String(b.numero), "pt-BR", { numeric: true }));
    const chave = `pedido-identico:${l.map((p) => p.numero).join(",")}`.slice(0, 190);
    if (await prisma.finConfig.findUnique({ where: { chave } })) continue;
    const p0 = l[0];
    const texto = `⚠️ PEDIDO IDÊNTICO — ${p0.cliente} · OC ${p0.oc} · ${brl(p0.total)}: ${l.map((p) => `pedido ${p.numero} (emissão ${dBR(p.emissao)})`).join(", ")}. `
      + `Mesmo cliente, mesmo valor total e mesma OC: a venda conta ${l.length} vezes. Se for duplicado, cancele no KM; se for o saldo de um pedido parcialmente faturado, ajuste as quantidades.`;
    await prisma.mensagem.createMany({ data: para.map((u) => ({ deId: de, paraId: u.id, texto: texto.slice(0, 2000), etiqueta: "LANCAMENTO" })) });
    await prisma.finConfig.create({ data: { chave, valor: new Date().toISOString() } });
    n++;
  }
  return n;
}
