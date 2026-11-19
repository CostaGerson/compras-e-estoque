// Ao subir o servidor: agenda o backup diário (lib/backup.js)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { agendarBackup } = await import("./lib/backup");
    agendarBackup();
    const { agendarLembretes } = await import("./lib/lembretesTarefas");   // v551 — aviso no celular 30 min antes da tarefa
    agendarLembretes();
    const { agendarCobrancaSemanal } = await import("./lib/cobrancaSemanal");   // v779 — #33: boletos da semana por e-mail (sexta 17h)
    agendarCobrancaSemanal();
    const { agendarLeituraNort } = await import("./lib/nortLeitura");   // v910 — lê pedidos (10 min) e estoque (1 h) do sistema da NORT
    agendarLeituraNort();
    const { agendarAnalisesPcp } = await import("./lib/pcpAnalises");   // v928 — #90: análises do PCP, dia 1 a 5 de cada mês
    agendarAnalisesPcp();
    const { agendarPrevisaoFaccao } = await import("./lib/faccaoPrevisao");   // previsão das facções do PCP na semana (de hora em hora)
    agendarPrevisaoFaccao();
    const { agendarArtes } = await import("./lib/artesDrive");   // v1003 — artes e layouts vão para o Google Drive (a cada 5 min)
    agendarArtes();
    // v972 — layouts aprovados com a gravação nos itens pela metade: retoma 1 min após subir e a cada 10 min
    const retomar = async () => { try { const { retomarGravacoesLayout } = await import("./lib/layoutFluxo"); await retomarGravacoesLayout(); } catch (e) { console.error("[v972] layout:", e.message); } };
    setTimeout(retomar, 60 * 1000); setInterval(retomar, 10 * 60 * 1000);
    // v556 — casamento NF ↔ pedido só manual: remove uma vez os casamentos automáticos já feitos
    setTimeout(async () => { try { const { removerCasamentosAutomaticos } = await import("./lib/faturamentoCasamento"); const r = await removerCasamentosAutomaticos(); if (r) console.log(`[v556] casamentos automáticos removidos: ${r.length}`); } catch (e) { console.error("[v556]", e.message); } }, 20 * 1000);
  }
}
