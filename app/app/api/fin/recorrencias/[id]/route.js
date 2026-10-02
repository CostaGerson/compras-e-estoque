export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado } from "@/lib/fin";
import { validarRateio, r2, so, mesAtual, vencNoMes, gerarRecorrencias } from "@/lib/finTitulos";

// PATCH { usuarioId, titulo, parceiro, documento, valor, diaVencimento, rateio, fim, observacao }
// Alterações valem para os meses FUTUROS ainda não conferidos/pagos. Fim → apaga previsões depois dele.
export async function PATCH(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const id = Number(params.id);
  const r = await prisma.finRecorrencia.findUnique({ where: { id } });
  if (!r) return Response.json({ error: "Recorrência não encontrada." }, { status: 404 });
  const d = {};
  if (b.titulo !== undefined) d.titulo = String(b.titulo).trim().toUpperCase();
  if (b.parceiro !== undefined) d.parceiro = String(b.parceiro).trim().toUpperCase();
  if (b.documento !== undefined) d.documento = so(b.documento) || null;
  if (b.observacao !== undefined) d.observacao = b.observacao || null;
  if (b.valor !== undefined) { d.valor = r2(b.valor); if (!(d.valor >= 0)) return Response.json({ error: "Valor inválido." }, { status: 400 }); }
  if (b.diaVencimento !== undefined) d.diaVencimento = Math.min(31, Math.max(1, Number(b.diaVencimento) || 1));
  if (b.diaUtil !== undefined) d.diaUtil = !!b.diaUtil;
  if (b.rateio !== undefined) { const rt = validarRateio(b.rateio); if (rt.erro) return Response.json({ error: rt.erro }, { status: 400 }); d.rateio = rt.rateio; }
  if (b.fim !== undefined) d.fim = b.fim ? String(b.fim).slice(0, 7) : null;
  if (b.ativo !== undefined) d.ativo = !!b.ativo;
  await prisma.finRecorrencia.update({ where: { id }, data: d });

  const desde = mesAtual();
  // remove previsões depois do fim / ao desativar
  const corte = d.ativo === false ? desde : d.fim;
  if (corte) await prisma.finTitulo.deleteMany({ where: { recorrenciaId: id, competencia: { gt: d.ativo === false ? somaAnterior(desde) : corte }, status: "ABERTO", valorConfirmado: false } });
  // atualiza os meses futuros não conferidos
  const fut = await prisma.finTitulo.findMany({ where: { recorrenciaId: id, competencia: { gte: desde }, status: "ABERTO", valorConfirmado: false } });
  for (const t of fut) {
    const up = {};
    for (const k of ["titulo", "parceiro", "documento", "observacao", "rateio", "valor"]) if (d[k] !== undefined) up[k] = d[k];
    if (d.diaVencimento || d.diaUtil !== undefined) up.vencimento = vencNoMes(t.competencia, d.diaVencimento ?? r.diaVencimento, d.diaUtil ?? r.diaUtil);
    if (Object.keys(up).length) await prisma.finTitulo.update({ where: { id: t.id }, data: up });
  }
  await gerarRecorrencias(r.tipo);
  return Response.json({ ok: true });
}
const somaAnterior = (c) => { const [a, m] = c.split("-").map(Number); const d = new Date(Date.UTC(a, m - 2, 1)); return d.toISOString().slice(0, 7); };

// DELETE { usuarioId } → encerra e apaga as previsões futuras não conferidas (as já pagas/conferidas ficam)
export async function DELETE(req, { params }) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  const id = Number(params.id);
  await prisma.finTitulo.deleteMany({ where: { recorrenciaId: id, status: "ABERTO", valorConfirmado: false, competencia: { gte: mesAtual() } } });
  await prisma.finRecorrencia.delete({ where: { id } }).catch(() => {});
  return Response.json({ ok: true });
}
