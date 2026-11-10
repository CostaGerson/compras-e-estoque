# v755 — Tarefa de layout: antes da aprovação o botão é "Prévia da OP" e a OP sai com a faixa "PRÉVIA — layout aguardando aprovação"; os arquivos só entram no pedido ao aprovar (já era assim).

# v756 — Layout reprovado aparece nas Designadas de quem reprovou (`layout.acompanhaId`), inclusive os reprovados antes.

# v757 — Toda demanda para o arte finalista passa por aprovação
- Demanda criada por outra pessoa para o arte finalista (setor ARTE) entra no fluxo: `Tarefa.aprovacao` (campo novo). As abertas antigas entram sozinhas.
- O arte finalista anexa os arquivos de resposta e clica **Enviar para aprovação** (não tem "Concluir"). Contam só os arquivos que ele anexou depois do último envio; os de quem pediu são o briefing.
- Quem pediu recebe a demanda **APROVAÇÃO · título** no dia, com os arquivos copiados: **Aprovar** (fim — a original fica "Aprovado por…") ou **Reprovar** com instruções (obrigatórias): a original volta a ficar em aberto para o arte finalista, prazo hoje, com as instruções, rodada +1. O processo se repete.
- Mensagens automáticas a cada envio e decisão. Tarefa de layout de pedido continua com o fluxo próprio.
- `lib/tarefaAprovacao.js`, rota `/api/tarefas/[id]/aprovacao`.
