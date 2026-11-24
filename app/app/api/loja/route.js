// v1084 — Comercial › Frente de caixa (loja física NORT)
export const dynamic = "force-dynamic";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial } from "@/lib/acesso";
import * as L from "@/lib/lojaCaixa";

const resp = (x) => Response.json(x, { status: x?.error ? 400 : 200 });
const negado = (m = "Sem acesso à frente de caixa.") => Response.json({ error: m }, { status: 403 });
async function quem(req, b) {
  const u = await usuarioAtivoFin(req.headers.get("x-usuario-id") || b?.usuarioId);
  return u && u.setor !== "CLIENTE" ? u : null;
}

// GET ?catalogo=1[&todos=1] · ?vendas=1&status= · ?venda=N · ?tabelas=1 · ?fpps=texto
export async function GET(req) {
  const u = await quem(req);
  if (!u) return negado();
  const q = new URL(req.url).searchParams;
  try {
    if (q.get("catalogo")) return resp({ produtos: await L.catalogo({ todos: !!q.get("todos") }), tabelas: await L.tabelas(), temSenha: await L.temSenha(), gerencial: gerencial(u) });
    if (q.get("vendas")) return resp({ vendas: await L.listarVendas({ status: q.get("status") }) });
    if (q.get("venda")) { const v = await L.venda(q.get("venda")); return v ? resp({ venda: v }) : Response.json({ error: "Venda não encontrada." }, { status: 404 }); }
    if (q.get("tabelas")) return resp({ tabelas: await L.tabelas() });
    if (q.get("fpps") != null) return resp({ fpps: await L.buscarFpps(q.get("fpps")) });
    return Response.json({ error: "Consulta inválida." }, { status: 400 });
  } catch (e) { console.log("loja:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}

// POST { acao: orcamento | fechar | pagamento | pronta | entregar | cancelar | producao | produto | importar | tabelas | senha, … }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await quem(req, b);
  if (!u) return negado();
  const cfgOk = gerencial(u);
  try {
    switch (b.acao) {
      case "orcamento": return resp(await L.salvarOrcamento(b, u));
      case "fechar": return resp(await L.fecharVenda(b, u));
      case "pagamento": return resp(await L.registrarPagamento(b.numero, b, u));
      case "pronta": return resp(await L.mudarStatus(b.numero, "PRONTA", b, u));
      case "entregar": return resp(await L.mudarStatus(b.numero, "ENTREGAR", b, u));
      case "cancelar": return resp(await L.mudarStatus(b.numero, "CANCELAR", b, u));
      case "producao": return resp(await L.tentarProducao(b.numero, u));
      case "produto": if (!cfgOk) return negado("Só a gestão mexe no catálogo."); return resp(await L.salvarProduto(b.produto || {}));
      case "importar": if (!cfgOk) return negado("Só a gestão mexe no catálogo."); return resp(await L.importarDoEstoque());
      case "tabelas": if (!cfgOk) return negado("Só a gestão mexe nas tabelas."); return resp(await L.salvarTabelas(b.tabelas || {}));
      case "senha": if (!cfgOk) return negado("Só a gestão define a senha de sócio."); return resp(await L.definirSenha(b.senha));
      default: return Response.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (e) { console.log("loja:", e.message); return Response.json({ error: e.message }, { status: 500 }); }
}
