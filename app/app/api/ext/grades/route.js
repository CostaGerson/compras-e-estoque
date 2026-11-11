// Cronograma PCP — grade (e parâmetros) dos itens de vários pedidos, para completar de uma vez
// os cards antigos do PCP. POST { pedidos: ["26100016", …] } → { ok, pedidos: { "26100016": [{ chave, codigo, descricao, qtd, grade, parametros }] } }
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { tokenExterno, itensDoPedido } from "@/lib/compras";
import { paramFora } from "@/lib/pedidoLanc";

const autorizado = async (req) => { const tk = req.headers.get("x-api-key") || ""; return !!tk && tk === (await tokenExterno()); };

export async function POST(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const nums = [...new Set((Array.isArray(b?.pedidos) ? b.pedidos : []).map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 2000);
  if (!nums.length) return Response.json({ ok: true, pedidos: {} });
  try {
    const pvs = await prisma.pedidoVenda.findMany({ where: { numero: { in: nums } }, select: { numero: true, itens: true } });
    const out = {};
    for (const p of pvs) {
      const brutos = Array.isArray(p.itens) ? p.itens : [];
      out[p.numero] = itensDoPedido(p).map((x, i) => {
        const raw = brutos[i] || {};
        const parametros = (Array.isArray(raw.parametros) ? raw.parametros : []).filter((y) => y && (y.t || y.v) && !paramFora(y.t)).map((y) => ({ t: String(y.t || ""), v: String(y.v || "") }));
        const grade = (x.grade || []).map((g) => ({ tam: String(g.tam || "").trim(), qtd: Number(g.qtd) || 0 })).filter((g) => g.tam && g.qtd > 0);
        return { chave: x.chave, codigo: x.codigo || "", descricao: x.descricao || "", qtd: x.qtd || 0, grade, parametros };
      });
    }
    return Response.json({ ok: true, pedidos: out });
  } catch (e) {
    console.log("ext/grades:", e.message);
    return Response.json({ ok: false, error: "Não consegui ler os pedidos." }, { status: 500 });
  }
}
