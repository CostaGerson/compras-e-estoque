// Ao subir o servidor: agenda o backup diário (lib/backup.js)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { agendarBackup } = await import("./lib/backup");
    agendarBackup();
    const { agendarLembretes } = await import("./lib/lembretesTarefas");   // v551 — aviso no celular 30 min antes da tarefa
    agendarLembretes();
  }
}
