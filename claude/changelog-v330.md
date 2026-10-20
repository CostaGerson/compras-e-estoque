# v330 — Pedido atrasado em andamento volta a contar na previsão

- Revertida a exclusão da v326. Pedido com entrega vencida mas **ainda em andamento** (saldo a faturar > 0) volta a entrar na previsão de receitas, com a data contando **a partir de hoje**.
  - Só fica de fora o que já foi entregue/faturado (Vl. à entregar = 0).
  - Regra: tudo que está no PCP (Maycon) como em andamento aparece aqui com o respectivo valor a receber.
- O pedido vencido continua em vermelho, mas o aviso passou de "fora da previsão" para "reprogramar no PCP (conta de hoje)".
