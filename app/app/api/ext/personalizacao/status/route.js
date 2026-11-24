// v1085 — devolutiva do sistema da NORT: POST { id | chave, status: RECEBIDA|EM_PRODUCAO|PRONTA|ENTREGUE|PROBLEMA, refExterna?, obs?, em?, por? }
//   ou { atualizacoes: [ … ] } (várias de uma vez). Mesmo X-Api-Key.
export const dynamic = "force-dynamic";
import { autorizadoNort } from "@/lib/nortInteg";
import { atualizarStatus } from "@/lib/personalizacaoExt";

export async function POST(req) {
  if (!(await autorizadoNort(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  if (Array.isArray(b.atualizacoes)) {
    const resultados = [];
    for (const x of b.atualizacoes.slice(0, 200)) resultados.push(await atualizarStatus(x).catch((e) => ({ ok: false, error: e.message })));
    return Response.json({ ok: resultados.every((r) => r.ok), resultados });
  }
  const r = await atualizarStatus(b);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}
