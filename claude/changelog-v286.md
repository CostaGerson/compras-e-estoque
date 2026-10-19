# v286 — Análises operacionais: só os últimos 6 meses

Decisão do Igor (19/10/2026): para precificação só valem os custos dos últimos 6 meses.
- Janela única `janelaMeses()` / `JANELA_MESES = 6` em `lib/opAnalise.js`: os 6 meses encerrados (hoje: abr–set/2026).
- Médias (antes 3 meses) passam a usar os 6 meses encerrados: contribuição bruta/líquida das Análises, parâmetros da FPP (corte, expedição, costura, silk) e logística (folha/pç e FPP/pç).
- Telas dos setores e da logística mostram só esses 6 meses (o mês corrente aparece em andamento, sem entrar nas médias); o seletor de mês não vai antes da janela.
- Não mudou: o % de freelancer oficial (compartilhado com Capacidade e Matriz) segue com 3 meses.
