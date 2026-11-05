# v686 — FPP: prazo de pagamento igual ao pedido, operações pelo período de uso, título banco/factoring

- **Prazo de pagamento na FPP** igual ao do pedido: entrada + parcelas (dias corridos/úteis a contar da emissão do pedido, NF ou entrega). Valor em R$ ou % ("50%"); parcela sem valor divide o que sobra. FPPs antigas convertem a condição da lista automaticamente.
- **Op. investimento**: juros sobre o custo só pelo período de uso — por parcela, lead time + prazo (entrada não usa recurso; parcela contada da emissão do pedido = só o prazo). Com op. título ligada, o prazo fica no título e o investimento cobre só o lead time (sem cobrar duas vezes).
- **Op. título**: só nas parcelas com prazo, pelo prazo + 2 dias úteis de compensação. Escolha **Banco** ou **Factoring**.
- **Parâmetros**: novas constantes `OP_TITULO_BANCO_TAXA` e `OP_TITULO_FACTORING_TAXA` (nascem com a taxa antiga do título; `OP_TITULO_TAXA` sai da lista).
- **Aviamentos**: qtde e tipo de botão na mesma linha.
