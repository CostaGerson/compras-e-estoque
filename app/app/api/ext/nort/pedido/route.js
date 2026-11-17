// v906 — NORT → ERP: encomenda personalizada vira pedido interno da NORT (ver claude/integracao-nort.md)
//   POST { ref, cliente, contato?, emissao?, entrega, vendedor?, canal?, obs?, itens: [{ seq?, nome, sku?, descricao?, grade: [{ tam, qtd }],
//          personalizacao?: [{ metodo, local, larguraCm?, alturaCm?, obs? }], dispensaDesign? }] }
//        → { ok, numero, status: AGUARDANDO_FPP | EM_ANDAMENTO | CONCLUIDO, pendentes?, url, jaExistia }
//   POST { acao: "iniciar", nome, mime, tamanho } → { token, parte } · { acao: "parte", token, off, conteudo } (arquivo grande em partes)
//   POST { acao: "anexar", ref, seq?, nome, mime, conteudo | token } → layout / arte no pedido
//   GET ?ref= → situação
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { autorizadoNort, criarPedidoNort, situacaoPedidoNort } from "@/lib/nortInteg";
import { iniciar, parte, lerMeta, PARTE } from "@/lib/arquivos";

const negado = () => Response.json({ ok: false, error: "Token inválido." }, { status: 401 });

export async function GET(req) {
  if (!(await autorizadoNort(req))) return negado();
  const r = await situacaoPedidoNort(new URL(req.url).searchParams.get("ref"));
  return Response.json(r, { status: r.ok ? 200 : 404 });
}

export async function POST(req) {
  if (!(await autorizadoNort(req))) return negado();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.acao === "iniciar") return Response.json({ token: await iniciar({ nome: b.nome, mime: b.mime, tamanho: b.tamanho, quem: "NORT" }), parte: PARTE });
    if (b.acao === "parte") return Response.json(await parte(b.token, Number(b.off) || 0, Buffer.from(String(b.conteudo || ""), "base64")));
    if (b.acao === "anexar") {
      const pp = await prisma.pp.findUnique({ where: { extRef: `NORT|${String(b.ref || "").trim()}` }, select: { id: true } });
      if (!pp) return Response.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
      const nome = `${b.seq ? `Item ${Number(b.seq)} · ` : ""}${String(b.nome || "arquivo")}`.slice(0, 200);
      if (await prisma.ppAnexo.findFirst({ where: { ppId: pp.id, nome }, select: { id: true } })) return Response.json({ ok: true, ja: true });   // reenvio não duplica
      let base64, tamanho;
      if (b.token) { const m = await lerMeta(b.token); if (!m?.completo) return Response.json({ ok: false, error: "Arquivo incompleto." }, { status: 422 }); base64 = `arq:${b.token}`; tamanho = m.tamanho; }
      else { base64 = String(b.conteudo || "").replace(/^data:[^,]+,/, ""); tamanho = Math.floor(base64.length * 3 / 4); if (!tamanho) return Response.json({ ok: false, error: "Arquivo vazio." }, { status: 422 }); }
      if (!b.token && tamanho > 8 * 1048576) return Response.json({ ok: false, error: "Acima de 8 MB: envie em partes (iniciar/parte)." }, { status: 422 });
      const a = await prisma.ppAnexo.create({ data: { ppId: pp.id, nome, tipo: b.mime || null, categoria: "LAYOUT", tamanho, base64, criadoPorNome: "NORT" } });
      return Response.json({ ok: true, id: a.id });
    }
    const r = await criarPedidoNort(b);
    return Response.json(r, { status: r.ok ? 200 : 422 });
  } catch (e) { console.log("ext/nort/pedido:", e.message); return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
