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
    // v1038 — layouts/artes em base64 no banco vão para o disco (um por vez), 20 s após subir; repete de hora em hora
    const migrar = async () => { try { const { migrarTarefaArquivos } = await import("./lib/arquivos"); await migrarTarefaArquivos(); } catch (e) { console.error("[v1038]", e.message); } };
    setTimeout(migrar, 20 * 1000); setInterval(migrar, 60 * 60 * 1000);
    setTimeout(async () => { try { const { zerarEstoqueInventario } = await import("./lib/estoqueZerar"); await zerarEstoqueInventario(); } catch (e) { console.error("[v1156]", e.message); } }, 45 * 1000);   // v1156 — estoque zerado (inventário 27/11)
    const { agendarPendenciasClientes } = await import("./lib/clientePendencias");   // v1148 — vendedor avisado dos cadastros incompletos
    agendarPendenciasClientes();
    const { agendarArtes } = await import("./lib/artesDrive");   // v1003 — artes e layouts vão para o Google Drive (a cada 5 min)
    agendarArtes();
    // v972 — layouts aprovados com a gravação nos itens pela metade: retoma 1 min após subir e a cada 10 min
    const retomar = async () => { try { const { retomarGravacoesLayout } = await import("./lib/layoutFluxo"); await retomarGravacoesLayout(); } catch (e) { console.error("[v972] layout:", e.message); } };
    setTimeout(retomar, 60 * 1000); setInterval(retomar, 10 * 60 * 1000);
    // v1042 — #91: itens de pedidos antigos sem o prefixo "CLIENTE - " (uma vez só, 40 s após subir)
    setTimeout(async () => { try { const { corrigirPrefixosAntigos } = await import("./lib/nomeItemCliente"); const r = await corrigirPrefixosAntigos(); if (r) console.log(`[v1042] prefixo do cliente em ${r.length} pedido(s): ${r.join(", ")}`); } catch (e) { console.error("[v1042]", e.message); } }, 40 * 1000);
    // v1046 — OCs canceladas antes (só a situação mudava): os itens voltam para a cotação
    setTimeout(async () => { try { const { soltarOcsCanceladas } = await import("./lib/pic"); const r = await soltarOcsCanceladas(); if (r.length) console.log(`[v1046] OCs canceladas soltas: ${r.join(", ")}`); } catch (e) { console.error("[v1046]", e.message); } }, 50 * 1000);
    // v556 — casamento NF ↔ pedido só manual: remove uma vez os casamentos automáticos já feitos
    setTimeout(async () => { try { const { removerCasamentosAutomaticos } = await import("./lib/faturamentoCasamento"); const r = await removerCasamentosAutomaticos(); if (r) console.log(`[v556] casamentos automáticos removidos: ${r.length}`); } catch (e) { console.error("[v556]", e.message); } }, 20 * 1000);
  }
}
