export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { gerar, BLOCOS, ORDEM_BLOCOS } from "@/lib/finRecebimentos";
import { iaDisponivel } from "@/lib/finIA";
import { formatarCnpj } from "@/lib/finNfSaida";

const sel = {
  id: true, bloco: true, ordem: true, data: true, titulo: true, valor: true,
  nf: true, nomePagador: true, cnpj: true, obs: true, tipoReceb: true, nfSugerida: true, origem: true, lancamentoId: true, editado: true,
};

async function carregar(competencia) {
  const [linhas, notas, lanc, clientes] = await Promise.all([
    prisma.finRecebimento.findMany({ where: { competencia }, orderBy: [{ bloco: "asc" }, { data: "asc" }, { ordem: "asc" }], select: sel }),
    import("@/lib/finRecebimentos").then((m) => m.baseNfs()).then((l) => l.length).catch(() => 0),   // v361 — base inteira de NFs
    prisma.finLancamento.count({ where: { competencia, valor: { gt: 0 }, desmembrado: false, substituido: false } }),
    prisma.cliente.findMany({ select: { razaoSocial: true, nomeFantasia: true, cnpj: true }, orderBy: { razaoSocial: "asc" } }).catch(() => []),   // v367 — autocompletar do pagador
  ]);
  return {
    competencia, linhas, notasSaida: notas, creditosExtrato: lanc,
    clientes: clientes.filter((c) => c.razaoSocial || c.nomeFantasia).map((c) => ({ nome: (c.razaoSocial || c.nomeFantasia).toUpperCase(), fantasia: c.nomeFantasia ? c.nomeFantasia.toUpperCase() : null, cnpj: c.cnpj ? formatarCnpj(c.cnpj) : null })),
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

// v362 — DELETE { usuarioId, ids: [] } → exclusão de várias linhas de uma vez
export async function DELETE(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!(await usuarioMaster(b?.usuarioId))) return negado();
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter((x) => x > 0);
  if (!ids.length) return Response.json({ error: "Nenhuma linha selecionada." }, { status: 400 });
  const r = await prisma.finRecebimento.deleteMany({ where: { id: { in: ids } } });
  return Response.json({ ok: true, excluidas: r.count });
}
