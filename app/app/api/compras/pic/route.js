// v469 — PIC: gerar a partir do cruzamento, preencher fornecedor/valor, gerar OCs por fornecedor
export const dynamic = "force-dynamic";
import { gerarPic, listarPics, salvarItensPic, gerarOcs, gerarOcsItens, cancelarPic } from "@/lib/pic";

export async function GET() { return Response.json(await listarPics()); }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "gerar": return r(await gerarPic(b.quem));
    case "salvar": return r(await salvarItensPic(b.id, b.itens));
    case "ocs": { const s = await salvarItensPic(b.id, b.itens || []); if (s.error) return r(s); return r(await gerarOcs(b.id, b.quem)); }
    // v477 — itens de vários PICs: salvar e gerar OCs juntos
    case "salvarItens": return r(await salvarItensPic(null, b.itens));
    case "ocsItens": { const s0 = await salvarItensPic(null, b.itens || []); if (s0.error) return r(s0); return r(await gerarOcsItens(b.ids || (b.itens || []).map((x) => x.id), b.quem)); }
    case "cancelar": return r(await cancelarPic(b.id));
    default: return Response.json({ error: "Ação?" }, { status: 400 });
  }
}
