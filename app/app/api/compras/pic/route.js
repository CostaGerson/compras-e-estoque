// v469 — PIC: gerar a partir do cruzamento, preencher fornecedor/valor, gerar OCs por fornecedor
export const dynamic = "force-dynamic";
import { gerarPic, listarPics, salvarItensPic, gerarOcs, cancelarPic } from "@/lib/pic";

export async function GET() { return Response.json(await listarPics()); }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const r = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
  switch (b.acao) {
    case "gerar": return r(await gerarPic(b.quem));
    case "salvar": return r(await salvarItensPic(b.id, b.itens));
    case "ocs": { const s = await salvarItensPic(b.id, b.itens || []); if (s.error) return r(s); return r(await gerarOcs(b.id, b.quem)); }
    case "cancelar": return r(await cancelarPic(b.id));
    default: return Response.json({ error: "Ação?" }, { status: 400 });
  }
}
