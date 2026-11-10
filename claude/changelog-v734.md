# v734 — Excluir demanda de compra com justificativa

- **Quem pode**: só o usuário master (qualquer demanda) ou quem lançou a compra avulsa (só as demandas das avulsas dele). O botão "Excluir demanda" só aparece para quem pode; o servidor também confere.
- **Justificativa obrigatória** ao excluir (levantamento, atendidos pelo estoque e Compras › Pedidos).
- A justificativa vai para as **mensagens de quem incluiu a demanda**: quem lançou a avulsa, ou quem vinculou a FPP no item do pedido. Uma mensagem por pessoa, com as linhas excluídas.
- Na avulsa, a linha excluída guarda quem excluiu e o motivo (`removidaPor`, `removidaMotivo`).
