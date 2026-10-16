import { prisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { modeloFreelancers, importarFreelancers, abrirSemana, salvarItem, excluirItem, garantirSemanas, programacao, tituloDaData, sextaDaSemana, sextaAPartirDe, tipoDoGrupo, sugerirBaixaParcial, baixarItemManual, obsItem } from "@/lib/finSemana";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();

// GET ?u=&titulo=ID → a semana aberta (itens, catálogos e prestadores)
// GET ?u=&competencia=AAAA-MM → garante as contas das sextas do mês
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioMaster(q.get("u")))) return negado();
  const comp = q.get("competencia");
  if (comp) {
    if (!/^\d{4}-\d{2}$/.test(comp)) return Response.json({ error: "Competência inválida." }, { status: 400 });
    return Response.json(await garantirSemanas(comp));
  }
  // prévia da programação: recebimento + prazo → sexta de pagamento
  // v208 — modelo Excel para lançar freelancers da semana
  if (q.get("modelo")) {
    const buf = await modeloFreelancers();
    return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="modelo-freelancers-semana.xlsx"' } });
  }
  if (q.get("recebimento")) {
    const prog = programacao(q.get("recebimento"), q.get("prazo"));
    return prog ? Response.json(prog) : Response.json({ error: "Informe a data de recebimento e o prazo." }, { status: 400 });
  }
  // conta avulsa de freelancer/terceirizado: cai na próxima sexta
  if (q.get("proximaSexta")) {
    const grupo = q.get("grupo") || "FREELANCER";
    const sexta = sextaAPartirDe(new Date());
    const t = await tituloDaData(tipoDoGrupo(grupo), sexta, false);
    return Response.json({ sexta, tituloId: t.id, ...(await abrirSemana(t.id)) });
  }
  const r = await abrirSemana(q.get("titulo"));
  if (!r.ok) return Response.json({ error: r.erro }, { status: 404 });
  return Response.json(r);
}

// POST { usuarioId, tituloId, item, id? } → lança ou edita uma linha da semana
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  // v208 — importa a planilha modelo de freelancers na semana (simular: só confere)
  if (b.acao === "importar") {
    const r = await importarFreelancers(b.tituloId, b.conteudo, { quem: quemE(u), usuarioId: u.id, simular: !!b.simular });
    if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
    return Response.json({ ...r, ...(await abrirSemana(b.tituloId)) });
  }
  // v271 — comandos por conta interna (cada prestador): sugerir baixa parcial, baixar (inteira/parcial), desfazer, OBS
  if (b.acao === "sugerir") {
    const t = String(b.valor ?? "").trim().replace(/\s|R\$/g, "");
    const r = await sugerirBaixaParcial(b.id, Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t));
    return r.ok ? Response.json(r) : Response.json({ error: r.erro }, { status: 400 });
  }
  if (b.acao === "baixar") {
    const r = await baixarItemManual({ itemId: b.id, data: b.data, pedidos: b.pedidos || null, dias: b.dias || null, observacao: b.observacao || null, quem: quemE(u) });
    if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
    return Response.json({ ...r, ...(await abrirSemana(b.tituloId)) });
  }
  if (b.acao === "desfazer") {
    const { desfazerItem } = await import("@/lib/finBaixas");
    const r = await desfazerItem(b.id);
    if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
    return Response.json({ ok: true, ...(await abrirSemana(b.tituloId)) });
  }
  if (b.acao === "obs") {
    const r = await obsItem(b.id, b.observacao);
    if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
    return Response.json({ ok: true, ...(await abrirSemana(r.tituloId)) });
  }
  // v180 — só a justificativa do custo extra (diferença sobre as diárias)
  if (b.acao === "justificar") {
    const txt = String(b.justificativa || "").trim().toUpperCase();
    if (!txt) return Response.json({ error: "Escreva a justificativa." }, { status: 400 });
    const it = await prisma.finSemanaItem.update({ where: { id: Number(b.id) }, data: { justificativa: txt } }).catch(() => null);
    if (!it) return Response.json({ error: "Lançamento não encontrado." }, { status: 404 });
    return Response.json({ ok: true, ...(await abrirSemana(it.tituloId)) });
  }
  const r = await salvarItem(b.tituloId, b.item || {}, { id: b.id, quem: quemE(u), usuarioId: u.id });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(await abrirSemana(r.tituloId || b.tituloId)) });
}

// DELETE { usuarioId, id } → apaga uma linha
export async function DELETE(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  const r = await excluirItem(b.id);
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json({ ...r, ...(b.tituloId ? await abrirSemana(b.tituloId) : {}) });
}
