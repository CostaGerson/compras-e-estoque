export const dynamic = "force-dynamic";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, garantirContas } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarRetornos, aplicarRetornos } from "@/lib/finRetorno";

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo (base64) }] } → registros com a ação e a conta casada
// POST { usuarioId, acao: "aplicar", arquivos, itens: [...] }                   → registra / baixa / lança tarifa / anexa
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId);
  if (!u) return soMaster();
  const arquivos = Array.isArray(b.arquivos) ? b.arquivos.filter((a) => a?.conteudo) : [];
  if (!arquivos.length) return Response.json({ error: "Envie o arquivo de retorno (.RET)." }, { status: 400 });
  try {
    if (b.acao === "analisar") return Response.json(await analisarRetornos(arquivos));
    if (b.acao === "aplicar") {
      await garantirContas();
      return Response.json(await aplicarRetornos(Array.isArray(b.itens) ? b.itens : [], arquivos, { quem: nomeU(u) }));
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e.message || "Erro ao ler o retorno." }, { status: 400 });
  }
}
