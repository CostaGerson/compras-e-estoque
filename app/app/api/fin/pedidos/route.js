export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioGerencial, negadoGerencial } from "@/lib/fin";
import { importarArquivos, listarPedidos, atualizarPedido, lancarEntrada, pdfDoPedido, excluirPedido } from "@/lib/pedidos";

const quemE = (u) => [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase();
const erro = (e) => Response.json({ error: e.message || String(e) }, { status: 400 });

// GET ?u=&competencia=AAAA-MM&todos=1 → painel · ?acao=pdf&id=&tipo=PV|PP → o PDF
export async function GET(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  if (q.get("acao") === "pdf") {
    const f = await pdfDoPedido(q.get("id"), q.get("tipo") === "PP" ? "PP" : "PV");
    if (!f) return Response.json({ error: "PDF não encontrado." }, { status: 404 });
    return new Response(f.buf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${f.nome}"` } });
  }
  try { return Response.json(await listarPedidos({ competencia: q.get("competencia") || undefined, todos: q.get("todos") === "1" })); }
  catch (e) { return erro(e); }
}

// POST { usuarioId, arquivos: [{ nome, base64 }] } → importa PV/PP · { usuarioId, acao: "entrada", id, vencimento?, valor? } → lança a entrada
export async function POST(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  try {
    if (b.acao === "entrada") return Response.json({ ok: true, titulo: await lancarEntrada(b.id, { vencimento: b.vencimento, valor: b.valor }, quemE(u)) });
    if (!Array.isArray(b.arquivos) || !b.arquivos.length) return Response.json({ error: "Envie os PDFs." }, { status: 400 });
    return Response.json({ ok: true, resultado: await importarArquivos(b.arquivos, quemE(u)) });
  } catch (e) { return erro(e); }
}

// PUT { usuarioId, id, condicao?, entradaValor?, status?, nfNumero?, faturadoEm?, despacho?, obs? }
export async function PUT(req) {
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  const u = await usuarioGerencial(b?.usuarioId);
  if (!u) return negadoGerencial();
  try { await atualizarPedido(b.id, b, quemE(u)); return Response.json({ ok: true }); } catch (e) { return erro(e); }
}

export async function DELETE(req) {
  const q = new URL(req.url).searchParams;
  if (!(await usuarioGerencial(q.get("u")))) return negadoGerencial();
  try { await excluirPedido(q.get("id")); return Response.json({ ok: true }); } catch (e) { return erro(e); }
}
