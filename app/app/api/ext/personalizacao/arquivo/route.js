// v1085 — arte de uma demanda de DTF/sublimação: GET ?demanda=ID&arte=ID (X-Api-Key da NORT)
export const dynamic = "force-dynamic";
import { autorizadoNort } from "@/lib/nortInteg";
import { arteDaDemanda } from "@/lib/personalizacaoExt";
import { respostaAnexo } from "@/lib/arquivos";

export async function GET(req) {
  if (!(await autorizadoNort(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const a = await arteDaDemanda(q.get("demanda"), q.get("arte"));
  if (!a) return Response.json({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });
  return respostaAnexo(a.base64, { nome: a.nome, mime: a.mime });
}
