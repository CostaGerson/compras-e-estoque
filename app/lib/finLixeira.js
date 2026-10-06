// v139 — Lixeira de contas a pagar/receber: tudo que é excluído fica 30 dias para reativar ou excluir de vez.
import { prisma } from "@/lib/prisma";

export const DIAS_LIXEIRA = 30;
const DATAS_TITULO = ["vencimento", "dataPagamento", "createdAt", "perdaData", "vencimentoOriginal"];
const DATAS_ITEM = ["dataRecebimento", "vencimentoNegociado", "createdAt"];
const json = (x) => JSON.parse(JSON.stringify(x));          // Decimal → texto, Date → ISO
const comDatas = (o, campos) => { const r = { ...o }; for (const k of campos) if (r[k]) r[k] = new Date(r[k]); return r; };

// guarda a conta na lixeira. modo EXCLUIDA: cópia completa (a conta é apagada depois); CANCELADA: só a referência
export async function paraLixeira(t, quem, modo = "EXCLUIDA") {
  let dados = {};
  if (modo === "EXCLUIDA") {
    const [anexos, semanaItens] = await Promise.all([
      prisma.finTituloAnexo.findMany({ where: { tituloId: t.id } }),
      prisma.finSemanaItem.findMany({ where: { tituloId: t.id } }),
    ]);
    dados = { titulo: json(t), anexos: json(anexos), semanaItens: json(semanaItens) };
  }
  return prisma.finLixeira.create({
    data: {
      tituloId: t.id, tipo: t.tipo, modo, titulo: t.titulo, parceiro: t.parceiro, valor: t.valor, vencimento: t.vencimento, status: t.status,
      dados, excluidoPorNome: quem || null, expiraEm: new Date(Date.now() + DIAS_LIXEIRA * 86400000),
    },
  });
}

// some de vez o que passou de 30 dias
export async function limparExpirados() {
  const r = await prisma.finLixeira.deleteMany({ where: { expiraEm: { lt: new Date() } } }).catch(() => ({ count: 0 }));
  return r.count;
}

export async function listarLixeira() {
  await limparExpirados();
  const l = await prisma.finLixeira.findMany({
    orderBy: { excluidoEm: "desc" },
    select: { id: true, tituloId: true, tipo: true, modo: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, excluidoPorNome: true, excluidoEm: true, expiraEm: true },
  });
  return l.map((x) => ({
    ...x, valor: Number(x.valor), vencimento: x.vencimento.toISOString().slice(0, 10),
    diasRestantes: Math.max(0, Math.ceil((x.expiraEm - Date.now()) / 86400000)),
  }));
}

// reativa: recria a conta com o mesmo nº, anexos e itens; cancelada volta para EM ABERTO
export async function restaurar(id, quem) {
  const e = await prisma.finLixeira.findUnique({ where: { id: Number(id) } });
  if (!e) throw new Error("Item não está mais na lixeira.");
  const avisos = [];
  if (e.modo === "CANCELADA") {
    const t = await prisma.finTitulo.findUnique({ where: { id: e.tituloId }, select: { id: true, status: true } });
    if (t?.status === "CANCELADO") await prisma.finTitulo.update({ where: { id: t.id }, data: { status: e.status === "CANCELADO" ? "ABERTO" : e.status, atualizadoPorNome: quem || null } });
    else if (!t) avisos.push("A conta cancelada não existe mais.");
    await prisma.finLixeira.delete({ where: { id: e.id } });
    return { ok: true, tituloId: e.tituloId, avisos };
  }
  const { titulo: t0, anexos = [], semanaItens = [] } = e.dados || {};
  if (!t0) throw new Error("Cópia da conta incompleta.");
  const { updatedAt, ...resto } = t0;
  const data = comDatas(resto, DATAS_TITULO);
  if (await prisma.finTitulo.findUnique({ where: { id: data.id }, select: { id: true } })) delete data.id;   // nº já reutilizado
  if (data.chaveImport && (await prisma.finTitulo.findFirst({ where: { chaveImport: data.chaveImport }, select: { id: true } }))) {
    avisos.push("Já existe outra conta importada do mesmo documento — a reativada ficou sem a chave de importação."); data.chaveImport = null;
  }
  if (data.recorrenciaId && (await prisma.finTitulo.findFirst({ where: { recorrenciaId: data.recorrenciaId, competencia: data.competencia }, select: { id: true } }))) {
    avisos.push("A recorrência já tem a parcela deste mês — a reativada ficou fora da recorrência."); data.recorrenciaId = null;
  }
  if (data.recorrenciaId && !(await prisma.finRecorrencia.findUnique({ where: { id: data.recorrenciaId }, select: { id: true } }))) data.recorrenciaId = null;
  if (data.nfId && !(await prisma.notaFiscal.findUnique({ where: { id: data.nfId }, select: { id: true } }))) data.nfId = null;
  if (data.execucaoId && !(await prisma.finExecucao.findUnique({ where: { id: data.execucaoId }, select: { id: true } }))) { data.execucaoId = null; if (data.status === "EXECUCAO") data.status = "ABERTO"; }
  data.atualizadoPorNome = quem || null;
  const novo = await prisma.finTitulo.create({ data });
  for (const a of anexos) { const { id: _i, tituloId: _t, ...r } = a; await prisma.finTituloAnexo.create({ data: { ...comDatas(r, ["createdAt"]), tituloId: novo.id } }); }
  for (const it of semanaItens) {
    const { id: _i, tituloId: _t, updatedAt: _u, ...r } = it;
    if (r.prestadorId && !(await prisma.prestador.findUnique({ where: { id: r.prestadorId }, select: { id: true } }))) r.prestadorId = null;
    await prisma.finSemanaItem.create({ data: { ...comDatas(r, DATAS_ITEM), tituloId: novo.id } });
  }
  await prisma.finLixeira.delete({ where: { id: e.id } });
  return { ok: true, tituloId: novo.id, avisos };
}

export async function excluirDefinitivo(id) {
  await prisma.finLixeira.deleteMany({ where: { id: Number(id) } });
  return { ok: true };
}
