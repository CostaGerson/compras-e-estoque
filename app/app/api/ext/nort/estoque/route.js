// v906 — NORT → ERP: estoque de peças prontas (X-Api-Key = token da NORT, Dados › Integrações › NORT)
//   POST { movimentos: [{ id, nome, sku?, deposito: SEDE|LOJA, tipo: ENTRADA|SAIDA|AJUSTE, quantidade, data?, ref?, obs? }] }
//        → { gravados, repetidos, erros }   (o mesmo id não grava duas vezes)
//   POST { saldos: [{ nome, deposito, saldo }] }   → conferência diária: o ERP se alinha ao saldo da NORT
export const dynamic = "force-dynamic";
import { autorizadoNort, registrarMovimentos, conferirSaldos } from "@/lib/nortInteg";

export async function POST(req) {
  if (!(await autorizadoNort(req))) return Response.json({ ok: false, error: "Token inválido." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (Array.isArray(b.saldos)) return Response.json({ ok: true, ...(await conferirSaldos(b.saldos.slice(0, 20000))) });
    if (Array.isArray(b.movimentos)) return Response.json({ ok: true, ...(await registrarMovimentos(b.movimentos.slice(0, 5000))) });
    return Response.json({ ok: false, error: "Mande movimentos ou saldos." }, { status: 422 });
  } catch (e) { console.log("ext/nort/estoque:", e.message); return Response.json({ ok: false, error: e.message }, { status: 500 }); }
}
