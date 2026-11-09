// v501 — Facções a pagar (PCP): conferência e lançamento manual
export const dynamic = "force-dynamic";
import { usuarioSoMaster, soMaster } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { conferirFaccoes, lancarFaccoes, listaFaccoes, estornarFaccoes, descartarFaccoes, reativarFaccoes, regravarFaccoes } from "@/lib/faccaoPcp";

export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioSoMaster(sp.get("u"), "contasPagar");
  if (!u) return soMaster();
  if (sp.get("lista")) return Response.json(await listaFaccoes());
  return Response.json(await conferirFaccoes({ desde: sp.get("desde") || null }));
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioSoMaster(b.usuarioId, "contasPagar");
  if (!u) return soMaster();
  // v669 — { acao: "estornar" | "descartar" | "reativar", chaves: ["12", "12-1"], motivo }
  const r = b.acao === "estornar" ? await estornarFaccoes(b.chaves, nomeU(u), b.motivo)
    : b.acao === "descartar" ? await descartarFaccoes(b.chaves, nomeU(u), b.motivo)
    : b.acao === "reativar" ? await reativarFaccoes(b.chaves, nomeU(u))
    : b.acao === "regravar" ? await regravarFaccoes(b.chaves, nomeU(u))   // v726 — contas lançadas no formato antigo (1 × total)
    : await lancarFaccoes(b.escolhas, nomeU(u));
  return Response.json(r, { status: r.error ? 400 : 200 });
}
