export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarRemessas, aplicarRemessas, listarRemessas } from "@/lib/finRemessa";

// v231 — GET ?u= → remessas cadastradas (com as críticas)
export async function GET(req) {
  const u = await usuarioSoMaster(new URL(req.url).searchParams.get("u"), "contasReceber");
  if (!u) return soMaster();
  return Response.json(await listarRemessas());
}

// POST { usuarioId, acao: "analisar" | "aplicar", arquivos: [{ nome, conteudo (base64) }] }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasReceber");
  if (!u) return soMaster();
  const arquivos = Array.isArray(b.arquivos) ? b.arquivos.filter((a) => a?.conteudo) : [];
  if (!arquivos.length) return Response.json({ error: "Envie o arquivo de remessa (.REM)." }, { status: 400 });
  try {
    if (b.acao === "analisar") return Response.json(await analisarRemessas(arquivos));
    if (b.acao === "aplicar") return Response.json(await aplicarRemessas(arquivos, { quem: nomeU(u) }));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao ler a remessa." }, { status: 400 });
  }
}
