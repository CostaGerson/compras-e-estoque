// v754 — Cronograma PCP: catálogo de itens com os detalhes da peça, para completar de uma vez
// os pedidos que já estavam em produção antes de os detalhes virem do ERP.
// GET → { ok, itens: [{ fonte: "PADRAO"|"KM", codigo, nome, nomeBase, parametros: [{ t, v }], usos }] }
// Itens do KM vêm com o tamanho no nome ("... - P", "... - GG"): nomeBase tira o tamanho.
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { tokenExterno } from "@/lib/compras";
import { paramFora } from "@/lib/pedidoLanc";

const autorizado = async (req) => { const tk = req.headers.get("x-api-key") || ""; return !!tk && tk === (await tokenExterno()); };
const TAMS = ["RN", "BB", "PP", "P", "M", "G", "GG", "XG", "EG", "XGG", "EGG", "EXG", "G1", "G2", "G3", "G4", "EXGG", "XXG", "XXXG", "LXG", "UNICO", "ÚNICO", "U", "ESPECIAL", "INFANTIL"];
const tiraTam = (n) => {
  const s = String(n || "").trim();
  const m = s.match(/^(.*?)\s*-\s*([A-Z0-9ÚÇ]{1,8})\s*$/i);
  if (m && (TAMS.includes(m[2].toUpperCase()) || /^\d{1,2}$/.test(m[2]))) return m[1].trim();
  return s;
};
const deObjeto = (o) => Object.entries(o && typeof o === "object" ? o : {}).filter(([k, v]) => !paramFora(k) && v)
  .map(([t, v]) => ({ t, v: typeof v === "object" ? [v.tipo, v.artigo, v.medida, v.forro ? `FORRO ${v.forro}` : ""].filter(Boolean).join(" · ") : String(v) }));

export async function GET(req) {
  if (!(await autorizado(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  try {
    const [pad, km] = await Promise.all([
      prisma.itemPadrao.findMany({ where: { ativo: true }, select: { id: true, codigoPadrao: true, codigo: true, nomeInterno: true, nomeNf: true, parametros: true } }),
      prisma.kmProduto.findMany({ select: { codigo: true, nome: true, parametros: true, usos: true } }),
    ]);
    const itens = [];
    for (const p of pad) {
      const parametros = deObjeto(p.parametros);
      const nomes = [...new Set([p.nomeInterno, p.nomeNf].filter(Boolean))];
      itens.push({ fonte: "PADRAO", codigo: p.codigoPadrao || p.codigo || "IP" + p.id, codigoKm: p.codigo || "", nome: p.nomeInterno, nomes, nomeBase: p.nomeInterno, parametros, usos: 0 });
    }
    for (const k of km) {
      const parametros = (Array.isArray(k.parametros) ? k.parametros : []).filter((x) => x && (x.t || x.v) && !paramFora(x.t)).map((x) => ({ t: String(x.t || ""), v: String(x.v || "") }));
      if (!parametros.length) continue;   // sem detalhe não ajuda
      itens.push({ fonte: "KM", codigo: k.codigo, nome: k.nome, nomes: [k.nome], nomeBase: tiraTam(k.nome), parametros, usos: k.usos || 0 });
    }
    return Response.json({ ok: true, itens });
  } catch (e) {
    console.log("ext/catalogo-itens:", e.message);
    return Response.json({ ok: false, error: "Não consegui ler o catálogo." }, { status: 500 });
  }
}
