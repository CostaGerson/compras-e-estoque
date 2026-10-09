export const dynamic = "force-dynamic";
import { usuarioMaster, usuarioSoMaster, soMaster, negado, abrirPdf } from "@/lib/fin";
import { senhasSalvas } from "@/lib/finImportArquivo";
import { analisar, gravar, listar } from "@/lib/fiscal";

// GET ?u=&de=&ate=&tipo=ENTRADA|SAIDA&busca= → notas registradas no movimento fiscal
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioMaster(sp.get("u")))) return negado();
  return Response.json(await listar({ de: sp.get("de"), ate: sp.get("ate"), tipo: sp.get("tipo"), busca: sp.get("busca") }));
}

// POST { usuarioId, acao: "analisar", arquivos: [{ nome, xml } | { nome, b64 }] } → conferência (não grava)
// POST { usuarioId, acao: "gravar", notas: [...] }                               → registra e lança as contas
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId);
  if (!u) return soMaster();
  if (b.acao === "analisar") {
    const senhas = await senhasSalvas().catch(() => []);
    return Response.json(await analisar(b.arquivos || [], { abrirPdf, senhas }));
  }
  if (b.acao === "gravar") return Response.json({ ok: true, resultados: await gravar(b.notas || [], u) });
  return Response.json({ error: "Ação inválida." }, { status: 400 });
}
