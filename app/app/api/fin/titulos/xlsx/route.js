export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { usuarioMaster, negado } from "@/lib/fin";
import { gerarXlsxTitulos } from "@/lib/finTitulosXlsx";

// POST { usuarioId, ids: [...] (na ordem da tela), titulo, nome } → .xlsx com as contas da tela
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  if (!(await usuarioMaster(b.usuarioId))) return negado();
  if (!Array.isArray(b.ids) || !b.ids.length) return Response.json({ error: "Nenhuma conta na tela para exportar." }, { status: 400 });
  try {
    const buf = await gerarXlsxTitulos(b.ids, { titulo: String(b.titulo || "").slice(0, 300) });
    const nome = String(b.nome || "contas.xlsx").replace(/[^\w.\- ]/g, "_");
    return new Response(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nome}"` } });
  } catch (e) { return Response.json({ error: e.message || "Erro ao gerar o Excel." }, { status: 500 }); }
}
