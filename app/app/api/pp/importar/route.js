// v320 — subir PV/PP (KM Sistemas) pelo Lançar PP: mesmo fluxo do Financeiro › Pedidos em andamento
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioPP, negadoPP } from "@/lib/pp";
import { importarArquivos } from "@/lib/pedidos";

export async function POST(req) {
  const u = await usuarioPP(req);
  if (!u) return negadoPP();
  let b; try { b = await req.json(); } catch { return Response.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (!Array.isArray(b?.arquivos) || !b.arquivos.length) return Response.json({ error: "Envie os PDFs." }, { status: 400 });
  try {
    const r = await importarArquivos(b.arquivos, [u.nome, u.sobrenome].filter(Boolean).join(" ").toUpperCase());
    return Response.json({ ok: true, resultado: r.map(({ total, ...x }) => x) });   // sem valores na resposta
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
