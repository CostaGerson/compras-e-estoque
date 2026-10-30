// v184/v185 — acesso ao PP: lançar (master, diretoria, Leandro/PCP); ver (produção, sem valores); valores (quem lança e o administrativo)
import { usuarioAtivoFin } from "@/lib/fin";
import { lancaPP, vePP, veValoresPP } from "@/lib/acesso";
export async function usuarioPP(req, nivel = "lanca") {
  // v320 — o id também pode vir na URL (_u), para abrir PDF em nova aba
  let id = req.headers.get("x-usuario-id");
  if (!id) { try { id = new URL(req.url).searchParams.get("_u"); } catch {} }
  const u = await usuarioAtivoFin(id);
  if (!u) return null;
  return (nivel === "ve" ? vePP(u) : lancaPP(u)) ? u : null;
}
export const negadoPP = () => Response.json({ error: "PP: sem acesso para este usuário." }, { status: 403 });
// tira os valores do pedido para quem não pode vê-los
export function ppParaUsuario(pp, u) {
  if (!pp || veValoresPP(u)) return pp;
  const { valorTotal, arquivoPedidoPdf, pagamento, condicaoPagamento, ...resto } = pp;   // v595 — prazo de pagamento também   // v320 — o PV (pedido) tem preços: não vai para quem não vê valores
  return { ...resto, valorTotal: null, arquivoPedidoPdf: null, temPv: false, ...(Array.isArray(pp.itens) ? { itens: pp.itens.map(({ valorUnitario, valorTotal, valorTerceirizado, ...it }) => ({ ...it, valorUnitario: null, valorTotal: null, valorTerceirizado: null })) } : {}) };
}
export const nomeQuem = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase() || null;   // v595
