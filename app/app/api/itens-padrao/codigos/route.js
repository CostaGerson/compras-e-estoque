// v682 — padrão de códigos: GET (siglas e variações) · GET ?sugerir=1&tipo=&km=&nome= · GET ?proximo=1&sigla=&variacao= · PUT { tipos }
export const dynamic = "force-dynamic";
import { padraoCodigos, salvarPadraoCodigos, sugerirCodigo, proximoCodigo } from "@/lib/itensPadrao";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (sp.get("sugerir")) return Response.json(await sugerirCodigo({ tipoPeca: sp.get("tipo"), codigoKm: sp.get("km"), nome: sp.get("nome") }));
  if (sp.get("proximo")) return Response.json({ codigo: await proximoCodigo(sp.get("sigla"), sp.get("variacao")) });
  return Response.json(await padraoCodigos(), { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(req) {
  const b = await req.json().catch(() => ({}));
  const r = await salvarPadraoCodigos(b.tipos);
  return Response.json(r, { status: r.error ? 400 : 200 });
}
