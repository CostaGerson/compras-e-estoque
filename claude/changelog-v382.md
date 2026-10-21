# v382 — Previsto × realizado

- Nova guia **Previsto × realizado** na Análise financeira (ao lado de Meses; master/diretoria). Lista todos os painéis de previsão salvos (todas as competências), agrupados pelo mês previsto, com o estado: aguardando (cadeado até o 1º dia do mês seguinte ao previsto), pronto para analisar, bateu, ou divergências justificadas / sem justificativa.
- Ao abrir: antes da análise, o previsto do painel; **Analisar realizado** (só a partir de 01/M+1) gera, item a item, previsto × realizado × diferença:
  - caixa do mês: entradas (baixas do a receber em M) e saídas (baixas do a pagar em M) × previstas; resultado; cenário do mês × caixa no fim (bancos do painel seguinte, senão saldo final da DRE);
  - títulos previstos: a receber/a pagar no mês do painel, quitação provável, prioridades e (painéis novos) todas as atrasadas a pagar — quanto foi baixado em M;
  - pedidos: entregas programadas × faturado (NFs de venda emitidas em M);
  - DRE do mês: receita, resultado da operação, saldo final.
- Divergência (acima de 2%, mín. R$ 100) fica amarela com campo de **justificativa** (opcional, salva ao sair do campo). Reanalisar mantém as justificativas. Tudo fica gravado em `FinPrevReal` (base histórica).
- Painéis salvos a partir de agora guardam também os ids das atrasadas a pagar/receber.
