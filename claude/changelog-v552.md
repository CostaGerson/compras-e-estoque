# v552 — Excluir pedido (lixeira) na Produção

- Pedido aberto na Gestão da produção: botão **Excluir pedido** (confirma + motivo opcional).
- O pedido sai de `PedidoVenda` e vai para `PedidoExcluido` (cópia completa, com PDFs de PV/PP e itens de compra removidos). Efeitos:
  - some da produção, faturamento, previsões, cronograma, acompanhamento comercial (todos leem PedidoVenda);
  - PP fica com status EXCLUIDO (sai do Lançar PP);
  - compras: pedido dispensado (CompraDispensa "PEDIDO EXCLUÍDO (LIXEIRA)") e itens do levantamento/estoque não liberado apagados (o que já está em PIC/OC fica);
  - sync do KM, PDFs de PV/PP e relatório de Posição de Vendas **não recriam** o pedido.
- Botão **Excluídos** na lista: mostra a lixeira (quem, quando, motivo) e **Restaurar** devolve o pedido, o PP, os itens de compra e tira a dispensa.
