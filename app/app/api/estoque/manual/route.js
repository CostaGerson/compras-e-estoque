// v1152 — entrada manual de estoque: GET listas e gramaturas · POST { acao: "entrar" | "gramaturas" }
export const dynamic = "force-dynamic";
import { usuarioAtivo } from "@/lib/tarefas";
import { TIPOS_ESTOQUE, TIPOS_TECIDO, UNIDADES_MANUAL, ORIGENS, NOMES_MALHA, NOMES_AVIAMENTO, TIPOS_ZIPER, UNIDADES_TAMANHO, gramaturasPadrao, salvarGramaturas, entradaManual, etiquetasArtigo, novaEtiquetaArtigo, excluirDoEstoque, excluirLancamento, substituirLancamento, dadosSubstituicao, lixeiraEstoque, restaurarLixeira } from "@/lib/estoqueManual";

const negado = () => Response.json({ error: "Sem permissão." }, { status: 403 });
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  if (!(await usuarioAtivo(sp.get("u")))) return negado();
  if (sp.get("substituir")) { const r = await dadosSubstituicao(sp.get("substituir")); return Response.json(r, { status: r.error ? 404 : 200 }); }   // v1199
  if (sp.get("lixeira")) return Response.json({ itens: await lixeiraEstoque() });   // v1199
  if (sp.get("artigo")) { const r = await etiquetasArtigo(sp.get("artigo")); return Response.json(r, { status: r.error ? 404 : 200 }); }   // v1173
  return Response.json({ tipos: TIPOS_ESTOQUE, tecidos: TIPOS_TECIDO, unidades: UNIDADES_MANUAL, origens: ORIGENS, nomesMalha: NOMES_MALHA, nomesAviamento: NOMES_AVIAMENTO, tiposZiper: TIPOS_ZIPER, unidadesTamanho: UNIDADES_TAMANHO, gramaturas: await gramaturasPadrao() });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return negado();
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ");
  try {
    if (b.acao === "gramaturas") return Response.json({ gramaturas: await salvarGramaturas(b.gramaturas || {}) });
    if (b.acao === "excluir") { const r = await excluirDoEstoque(b.artigoId, quem, u.id); return Response.json(r, { status: r.error ? 400 : 200 }); }   // v1186
    if (b.acao === "excluirLancamento") { const r = await excluirLancamento(b.movId, quem); return Response.json(r, { status: r.error ? 400 : 200 }); }   // v1199
    if (b.acao === "substituir") { const r = await substituirLancamento(b.movId, { ...b, usuarioId: u.id }, quem); return Response.json(r, { status: r.error ? 400 : 200 }); }
    if (b.acao === "restaurar") { const r = await restaurarLixeira(b.id, quem); return Response.json(r, { status: r.error ? 400 : 200 }); }
    if (b.acao === "etiqueta") { const r = await novaEtiquetaArtigo(b, quem); return Response.json(r, { status: r.error ? 400 : 200 }); }   // v1173
    const r = await entradaManual(b, quem);
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
