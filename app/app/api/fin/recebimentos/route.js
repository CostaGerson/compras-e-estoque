export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { gerar, BLOCOS, ORDEM_BLOCOS } from "@/lib/finRecebimentos";
import { iaDisponivel } from "@/lib/finIA";

const sel = {
  id: true, bloco: true, ordem: true, data: true, titulo: true, valor: true,
  nf: true, nomePagador: true, cnpj: true, obs: true, origem: true, lancamentoId: true, editado: true,
};

async function carregar(competencia) {
  const [linhas, notas, lanc] = await Promise.all([
    prisma.finRecebimento.findMany({ where: { competencia }, orderBy: [{ bloco: "asc" }, { data: "asc" }, { ordem: "asc" }], select: sel }),
    prisma.finNfSaida.count({ where: { competencia } }),
    prisma.finLancamento.count({ where: { competencia, valor: { gt: 0 }, desmembrado: false, substituido: false } }),
  ]);
  return {
    competencia, linhas, notasSaida: notas, creditosExtrato: lanc,
    blocos: ORDEM_BLOCOS.map((k) => ({ k, label: BLOCOS[k] })),
    iaPronta: iaDisponivel(),
  };
}

// GET ?u=&competencia=
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  return Response.json(await carregar(competencia));
}

// POST { usuarioId, competencia } → gera/atualiza a planilha do extrato + cobranças + XMLs
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const r = await gerar(b.competencia);
  return Response.json({ ...r, ...(await carregar(b.competencia)) });
}

// PUT { usuarioId, competencia, bloco? } → nova linha em branco (manual)
export async function PUT(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  if (!competenciaValida(b.competencia)) return Response.json({ error: "Competência inválida." }, { status: 400 });
  const bloco = ORDEM_BLOCOS.includes(b.bloco) ? b.bloco : "CREDITO";
  const ult = await prisma.finRecebimento.findFirst({ where: { competencia: b.competencia }, orderBy: { ordem: "desc" }, select: { ordem: true } });
  const l = await prisma.finRecebimento.create({
    data: { competencia: b.competencia, bloco, ordem: (ult?.ordem || 0) + 1, valor: 0, origem: "MANUAL", editado: true },
    select: sel,
  });
  return Response.json({ ok: true, linha: l });
}
