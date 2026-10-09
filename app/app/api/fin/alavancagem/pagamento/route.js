export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { simularPagamentoExtra, calcular } from "@/lib/alavancagem";

const dec = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const x = Number(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(x) ? null : x;
};
const data = (v) => {
  const t = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T00:00:00.000Z`) : new Date();
};

// GET ?u=&contratoId= → histórico de pagamentos extras do contrato
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  const l = await prisma.finPagamentoExtra.findMany({
    where: { contratoId: Number(sp.get("contratoId")) }, orderBy: { data: "desc" },
  });
  return Response.json({ ok: true, pagamentos: l });
}

// POST { usuarioId, contratoId, valor, data?, simular:true } → mostra os caminhos
// POST { usuarioId, contratoId, valor, data?, modo } → aplica (PRAZO | PARCELA | MUTUO | QUITA)
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();

  const contrato = await prisma.finContrato.findUnique({ where: { id: Number(b.contratoId) } });
  if (!contrato) return Response.json({ error: "Contrato não encontrado." }, { status: 404 });

  const valor = dec(b.valor);
  const sim = simularPagamentoExtra(contrato, valor);
  if (sim.erro) return Response.json({ error: sim.erro }, { status: 400 });
  if (b.simular) return Response.json({ ok: true, simulacao: sim });

  const modo = String(b.modo || "").toUpperCase();
  const quando = data(b.data);
  const antes = calcular(contrato);
  const nome = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  let d = {}, registro = { modo, economia: null, parcelaAntes: null, parcelaDepois: null, prazoAntes: null, prazoDepois: null };

  if (sim.tipo === "MUTUO") {
    d = { capital: sim.depois.capital };
    registro = { ...registro, modo: "MUTUO", economia: sim.economia };
  } else if (sim.tipo === "QUITA") {
    d = { quitado: true };
    registro = { ...registro, modo: "QUITA", economia: sim.economia, parcelaAntes: antes.parcela, prazoAntes: antes.prazoMeses };
  } else if (modo === "PRAZO") {
    d = { prazoMeses: sim.prazo.prazoTotal, pagarAteInformado: null, aVencerInformado: null, debitoTotalInformado: null };
    registro = { ...registro, economia: sim.prazo.economia, parcelaAntes: antes.parcela, parcelaDepois: antes.parcela, prazoAntes: antes.prazoMeses, prazoDepois: sim.prazo.prazoTotal };
  } else if (modo === "PARCELA") {
    d = { parcela: sim.parcelaMenor.parcela, aVencerInformado: null, debitoTotalInformado: null };
    registro = { ...registro, economia: sim.parcelaMenor.economia, parcelaAntes: antes.parcela, parcelaDepois: sim.parcelaMenor.parcela, prazoAntes: antes.prazoMeses, prazoDepois: antes.prazoMeses };
  } else {
    return Response.json({ error: "Escolha abater o prazo ou reduzir a parcela." }, { status: 400 });
  }

  const [, pag] = await prisma.$transaction([
    prisma.finContrato.update({ where: { id: contrato.id }, data: d }),
    prisma.finPagamentoExtra.create({
      data: {
        contratoId: contrato.id, data: quando, valor,
        ...registro, observacao: b.observacao ? String(b.observacao).toUpperCase() : null, criadoPorNome: nome,
      },
    }),
  ]);

  const atualizado = await prisma.finContrato.findUnique({ where: { id: contrato.id } });
  return Response.json({ ok: true, pagamento: pag, contrato: { ...atualizado, calculo: calcular(atualizado) } });
}

// DELETE ?u=&id= → desfaz o registro (não reverte o contrato; ajuste à mão se precisar)
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(sp.get("u")))) return negadoGerencial();
  await prisma.finPagamentoExtra.delete({ where: { id: Number(sp.get("id")) } }).catch(() => null);
  return Response.json({ ok: true });
}
