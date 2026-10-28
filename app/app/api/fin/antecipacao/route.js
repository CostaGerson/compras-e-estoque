export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { usuarioMaster, usuarioSoMaster, soMaster, negado } from "@/lib/fin";
import { nomeU } from "@/lib/finTitulos";
import { analisarAntecipacao, aplicarAntecipacao, listarAntecipacoes, conciliarAntecipacoesPendentes, lerComprovanteAntecipacao } from "@/lib/finAntecipacao";
import { sincronizarAntecipados, listarAntecipados, contratoDoTitulo, contratoPorId, arquivoContrato, liquidar, desfazerLiquidacao, desfazerAntecipacao, registrarManual, recomprar } from "@/lib/finAntecipados";
const okD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

// GET ?u= → contratos de desconto importados
// v186: &acao=titulos&dIni&dFim (guia Antecipações) · &acao=contrato&titulo=|&id= (o "A") · &acao=pdf&id= (arquivo do contrato)
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioMaster(sp.get("u"));
  if (!u) return negado();
  const acao = sp.get("acao");
  try {
    if (acao === "titulos") {
      if (!okD(sp.get("dIni")) || !okD(sp.get("dFim"))) return Response.json({ error: "Período inválido." }, { status: 400 });
      await sincronizarAntecipados(nomeU(u));
      return Response.json(await listarAntecipados({ dIni: sp.get("dIni"), dFim: sp.get("dFim") }));
    }
    if (acao === "contrato") { await sincronizarAntecipados(nomeU(u)).catch(() => null); return Response.json(sp.get("titulo") ? await contratoDoTitulo(sp.get("titulo")) : await contratoPorId(sp.get("id"))); }
    if (acao === "pdf") {
      const a = await arquivoContrato(sp.get("id"));
      if (!a) return Response.json({ error: "Contrato sem arquivo." }, { status: 404 });
      return new Response(a.buf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(a.nome)}"` } });
    }
  } catch (e) { return Response.json({ error: e.message || "Erro" }, { status: 400 }); }
  await conciliarAntecipacoesPendentes(nomeU(u)).catch(() => 0);
  return Response.json({ contratos: await listarAntecipacoes() });
}

// POST { usuarioId, acao: "analisar" | "aplicar", arquivo: { nome, conteudo } }
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  // v186 — liquidação (cliente pagou), desfazer, antecipação manual
  if (["liquidar", "desliquidar", "desfazer", "manual", "recomprar", "comprovante"].includes(b.acao)) {
    const um = await usuarioMaster(b.usuarioId);
    if (!um) return negado();
    try {
      if (b.acao === "liquidar") {
        if (!okD(b.data)) return Response.json({ error: "Informe a data em que o cliente pagou." }, { status: 400 });
        let n = 0;
        for (const id of b.ids || []) { const r = await liquidar(id, b.data, nomeU(um)); if (r.ok) n++; }
        return Response.json({ liquidados: n });
      }
      if (b.acao === "desliquidar") return Response.json(await desfazerLiquidacao(b.id));
      if (b.acao === "desfazer") return Response.json(await desfazerAntecipacao(b.id, nomeU(um)));
      if (b.acao === "recomprar") return Response.json(await recomprar(b.id, b.motivo, nomeU(um)));
      if (b.acao === "manual") return Response.json(await registrarManual(b, nomeU(um)));
      if (b.acao === "comprovante") return Response.json(await lerComprovanteAntecipacao(b.arquivo?.conteudo));
    } catch (e) { return Response.json({ error: e.message || "Erro" }, { status: 400 }); }
  }
  const u = await usuarioSoMaster(b.usuarioId, "contasReceber");
  if (!u) return soMaster();
  if (!b.arquivo?.conteudo) return Response.json({ error: "Envie o PDF do contrato." }, { status: 400 });
  try {
    if (b.acao === "analisar") return Response.json(await analisarAntecipacao(b.arquivo.nome, b.arquivo.conteudo));
    if (b.acao === "aplicar") return Response.json(await aplicarAntecipacao(b.arquivo.nome, b.arquivo.conteudo, { quem: nomeU(u) }));
    return Response.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) { return Response.json({ error: e.message || "Erro ao ler o contrato." }, { status: 400 }); }
}
