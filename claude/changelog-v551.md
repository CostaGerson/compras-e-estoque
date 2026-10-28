# v551 — Lembrete no celular 30 min antes das tarefas da agenda

- Servidor (instrumentation) roda a cada minuto `lib/lembretesTarefas.js`: tarefa do dia, com horário, aberta ou em andamento → Web Push ao responsável quando faltam ≤ 30 min ("⏰ Em 30 min · 14:00–15:00" + título). Um aviso por data+horário (`Tarefa.lembreteChave`): mudou o horário, avisa de novo. Rotinas: as ocorrências do dia são geradas de hora em hora.
- Tocar na notificação abre a agenda (`/?v=agenda`).
- Agenda: botão **🔔 Ativar lembretes no celular** (some depois de ativado). iPhone: precisa do app na tela inicial (o botão explica).
