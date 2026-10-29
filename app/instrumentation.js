// Ao subir o servidor: agenda o backup diário (lib/backup.js)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { agendarBackup } = await import("./lib/backup");
    agendarBackup();
    const { agendarLembretes } = await import("./lib/lembretesTarefas");   // v551 — aviso no celular 30 min antes da tarefa
    agendarLembretes();
    // v556 — casamento NF ↔ pedido só manual: remove uma vez os casamentos automáticos já feitos
    setTimeout(async () => { try { const { removerCasamentosAutomaticos } = await import("./lib/faturamentoCasamento"); const r = await removerCasamentosAutomaticos(); if (r) console.log(`[v556] casamentos automáticos removidos: ${r.length}`); } catch (e) { console.error("[v556]", e.message); } }, 20 * 1000);
  }
}
