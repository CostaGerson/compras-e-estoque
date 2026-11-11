export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { sugestoes, baixar, desfazer, marcarVistas, baixarItem, desfazerItem, baixarRecompra } from "@/lib/finBaixas";

// GET ?u=&competencia=  ou  ?u=&arquivoId= → baixas sugeridas
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  const arquivoId = sp.get("arquivoId");
  if (!arquivoId && !competenciaValida(competencia)) return Response.json({ error: "Informe a competência." }, { status: 400 });
  return Response.json({ ok: true, ...(await sugestoes({ competencia, arquivoId })) });
}

// POST { usuarioId, tituloId, lancamentoId } → autoriza a baixa
export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioMaster(b?.usuarioId);
  if (!u) return negado();
  if (b.acao === "vistas") return Response.json({ ok: true, n: await marcarVistas(b.ids) });
  const quemE = [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
  if (b.recompra) {   // v332 — recompra de título descontado
    const rr = await baixarRecompra({ tituloId: b.tituloId, lancamentoId: b.lancamentoId, quem: quemE });
    if (!rr.ok) return Response.json({ error: rr.erro }, { status: 400 });
    return Response.json(rr);
  }
  if (b.itemId) {   // v181 — item da semana (freelancer/terceirizado)
    const ri = await baixarItem({ itemId: b.itemId, lancamentoId: b.lancamentoId, quem: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() });
    if (!ri.ok) return Response.json({ error: ri.erro }, { status: 400 });
    return Response.json(ri);
  }
  const r = await baixar({ tituloId: b.tituloId, lancamentoId: b.lancamentoId, quem: [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase() });
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  // v761 — boleto pago por PIX: mensagem prioritária para quem autorizou a baixa, pedindo a baixa do boleto no banco
  if (r.pixBoleto) {
    const x = r.pixBoleto, br = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "—");
    const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const texto = `💠 BOLETO PAGO VIA PIX — ${x.parceiro || "cliente"} · ${x.titulo}${x.numeroDoc && !String(x.titulo).includes(x.numeroDoc) ? ` (${x.numeroDoc})` : ""} · vence ${br(x.vencimento)}${x.nossoNumero ? ` · nosso nº ${x.nossoNumero}` : ""}. `
      + `A conta foi baixada pelo extrato com o PIX de ${moeda(x.valorPago)} em ${br(x.data)}. Baixe o boleto no banco para ele não ficar em aberto na cobrança.`;
    await prisma.mensagem.create({ data: { deId: u.id, paraId: u.id, texto, prioritaria: true, tituloId: x.id } }).catch((e) => console.log("msg pix-boleto:", e.message));
    try { const { notificar } = await import("@/lib/push"); await notificar(u.id, { titulo: "💠 Boleto pago via PIX", texto: `${x.parceiro || ""} · ${x.titulo} — baixe o boleto no banco`, url: "/", tag: `pixbol-${x.id}` }); } catch {}
  }
  return Response.json(r);
}

// DELETE ?u=&tituloId= → desfaz a baixa
export async function DELETE(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const r = sp.get("itemId") ? await desfazerItem(sp.get("itemId")) : await desfazer(sp.get("tituloId"));
  if (!r.ok) return Response.json({ error: r.erro }, { status: 400 });
  return Response.json(r);
}
