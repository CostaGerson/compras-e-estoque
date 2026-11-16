export const dynamic = "force-dynamic";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, abrirPdf } from "@/lib/fin";
import { senhasSalvas } from "@/lib/finImportArquivo";
import { analisar, gravar, listar, lancarCritica, vistarCritica } from "@/lib/fiscal";

// GET ?u=&de=&ate=&tipo=ENTRADA|SAIDA&busca= → notas registradas no movimento fiscal
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  return Response.json(await listar({ de: sp.get("de"), ate: sp.get("ate"), tipo: sp.get("tipo"), busca: sp.get("busca"), km: true }));
}

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, xml } | { nome, b64 }] } → conferência (não grava)
// POST { usuarioId, acao: "gravar", notas: [...] }                               → registra e lança as contas
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "nfEntrada", "contasPagar", "contasReceber", "faturamento");
  if (!u) return soMaster();
  if (b.acao === "analisar") {
    const senhas = await senhasSalvas().catch(() => []);
    return Response.json(await analisar(b.arquivos || [], { abrirPdf, senhas }));
  }
  if (b.acao === "gravar") return Response.json({ ok: true, resultados: await gravar(b.notas || [], u) });
  // v365 — nota com crítica: lançar as contas ou vistar (tirar a crítica sem conta)
  // v408 — NF emitida no KM sem arquivo: vistar tira a crítica
  // v876 — dispensar (ou voltar a pedir) as etiquetas de volume da NF de compra: { id, motivo } · { id, desfazer: true }
  if (b.acao === "dispensarEtiquetas") {
    const { prisma } = await import("@/lib/prisma");
    const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() || u.email;
    const txt = b.desfazer ? null : `${String(b.motivo || "").trim().toUpperCase() || "SEM MOTIVO"} · POR ${quem} EM ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).split("-").reverse().join("/")}`.slice(0, 300);
    await prisma.fiscalNota.update({ where: { id: Number(b.id) || 0 }, data: { etqDispensa: txt } });
    return Response.json({ ok: true });
  }
  if (b.acao === "vistarKm") { const { vistarKm } = await import("@/lib/kmNfs"); const r = await vistarKm(b.id, u.nome || u.email); return Response.json(r, { status: r.error ? 400 : 200 }); }
  if (b.acao === "lancarCritica" || b.acao === "vistar") {
    const r = b.acao === "vistar" ? await vistarCritica(b.id, u) : await lancarCritica(b.id, u);
    return Response.json(r, { status: r.error ? 400 : 200 });
  }
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
