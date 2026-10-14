export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster, abrirPdf } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarOs, aplicarOs } from "@/lib/finOsKm";

// v209 — OS do KM (fechamento de facção)
// POST { usuarioId, acao: "analisar", arquivos: [{ nome, conteudo }] }
// POST { usuarioId, acao: "aplicar", arquivos, itens, dataRecebimento }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasPagar");
  if (!u) return soMaster();
  try {
    if (b.acao === "analisar") return Response.json(await analisarOs(b.arquivos, (buf) => abrirPdf(buf, [])));
    if (b.acao === "aplicar") {
      const r = await aplicarOs(b, { quem: nomeU(u), usuarioId: u.id });
      return Response.json(r, { status: r.ok ? 200 : 400 });
    }
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message || "Erro ao ler a OS." }, { status: 400 }); }
}
