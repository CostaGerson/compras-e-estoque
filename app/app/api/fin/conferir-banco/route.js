// v823 — POST { usuarioId, arquivos:[{ nome, mime, base64 }] } → lê o print/PDF das cobranças do banco e confere com o contas a receber
export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { usuarioMaster, negado } from "@/lib/fin";
import { lerCobrancas, conferirCobrancas } from "@/lib/finConfBanco";

export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  try {
    const linhas = Array.isArray(b.linhas) ? b.linhas : await lerCobrancas(b.arquivos);
    if (!linhas.length) return Response.json({ error: "Não encontrei cobranças no arquivo enviado." }, { status: 400 });
    return Response.json({ lidas: linhas, ...(await conferirCobrancas(linhas)) });
  } catch (e) { console.log("conferir-banco:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}
