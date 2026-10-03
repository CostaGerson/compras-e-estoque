export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado, competenciaValida } from "@/lib/fin";
import { montarZip } from "@/lib/finContab";

// GET ?u=&competencia=AAAA-MM → baixa o pacote da contabilidade
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  const competencia = sp.get("competencia");
  if (!competenciaValida(competencia)) return new Response("Competência inválida.", { status: 400 });

  const z = await montarZip(competencia);
  if (!z) return new Response("Nenhum documento neste mês.", { status: 404 });

  return new Response(z.buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(z.nome)}`,
    },
  });
}
