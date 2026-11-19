export const dynamic = "force-dynamic";
export const maxDuration = 120;
import { usuarioDaChave, receberComprovantes } from "@/lib/finComprovanteCel";

// v1027 — atalho do iPhone: POST ?t=CHAVE com o arquivo (formulário, campo "arquivo") ou o arquivo puro no corpo.
// Responde em texto, para o atalho mostrar no celular.
const txt = (s, status = 200) => new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioDaChave(sp.get("t") || req.headers.get("x-chave"));
  if (!u) return txt("⛔ Chave do atalho inválida. Gere de novo em Contas a pagar › iPhone.", 403);
  const arquivos = [];
  try {
    const ct = req.headers.get("content-type") || "";
    if (/multipart\/form-data|application\/x-www-form-urlencoded/i.test(ct)) {
      const fd = await req.formData();
      for (const v of fd.values()) {
        if (v && typeof v === "object" && typeof v.arrayBuffer === "function") arquivos.push({ nome: v.name || "comprovante", mime: v.type, buf: Buffer.from(await v.arrayBuffer()) });
      }
    } else {
      const buf = Buffer.from(await req.arrayBuffer());
      if (buf.length) arquivos.push({ nome: sp.get("nome") || req.headers.get("x-nome") || "comprovante", mime: ct.split(";")[0], buf });
    }
  } catch (e) { return txt(`⚠️ Não consegui receber o arquivo (${e.message}).`, 400); }
  if (!arquivos.length) return txt("⚠️ Nenhum arquivo recebido. No atalho, o campo do formulário deve ser do tipo Arquivo com a Entrada do Atalho.", 400);
  const r = await receberComprovantes(u, arquivos);
  return txt(r.linhas.join("\n") || "Nada a fazer.");
}
