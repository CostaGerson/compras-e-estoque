// v1152 — entrada manual de estoque: GET listas e gramaturas · POST { acao: "entrar" | "gramaturas" }
export const dynamic = "force-dynamic";
import { usuarioAtivo } from "@/lib/tarefas";
import { TIPOS_ESTOQUE, TIPOS_TECIDO, UNIDADES_MANUAL, ORIGENS, NOMES_MALHA, NOMES_AVIAMENTO, TIPOS_ZIPER, UNIDADES_TAMANHO, gramaturasPadrao, salvarGramaturas, entradaManual } from "@/lib/estoqueManual";

const negado = () => Response.json({ error: "Sem permissão." }, { status: 403 });
export async function GET(req) {
  if (!(await usuarioAtivo(new URL(req.url).searchParams.get("u")))) return negado();
  return Response.json({ tipos: TIPOS_ESTOQUE, tecidos: TIPOS_TECIDO, unidades: UNIDADES_MANUAL, origens: ORIGENS, nomesMalha: NOMES_MALHA, nomesAviamento: NOMES_AVIAMENTO, tiposZiper: TIPOS_ZIPER, unidadesTamanho: UNIDADES_TAMANHO, gramaturas: await gramaturasPadrao() });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivo(b.usuarioId);
  if (!u) return negado();
  const quem = [u.nome, u.sobrenome].filter(Boolean).join(" ");
  try {
    if (b.acao === "gramaturas") return Response.json({ gramaturas: await salvarGramaturas(b.gramaturas || {}) });
    const r = await entradaManual(b, quem);
    return Response.json(r, { status: r.error ? 400 : 200 });
  } catch (e) { return Response.json({ error: e.message }, { status: 400 }); }
}
