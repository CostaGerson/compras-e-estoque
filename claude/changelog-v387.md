# v387 — NF de saída de pedido com entrada (o KM fatura a NF cheia)

- `lib/entradaNf.js`: ao importar a NF de saída no movimento fiscal (manual ou "Lançar contas" da crítica da contabilidade), acha o pedido da NF
  (NFs do pedido no KM — `PedidoVenda.kmNfs`, vindas de `livsaida` pelo agente —, ou a NF já casada no faturamento) e o mesmo CNPJ.
- Pedido com conta de entrada (`PEDIDO N - ENTRADA` ou título com `PEDIDO N`): as parcelas **novas** da NF são reduzidas pelo valor da entrada,
  proporcionalmente, mantendo os vencimentos. Aviso na conferência: "ENTRADA DO PEDIDO N ABATIDA: R$ … (PAGA / AINDA NÃO PAGA)".
- Entrada **não paga** → as contas da NF nascem com crítica (⚠) para conferir o recebimento da entrada.
- Faturamento parcial: a entrada é abatida uma vez só (`PedidoVenda.entradaAbatidaNfs`); reimportar a mesma NF não abate em dobro.
- Condição com entrada e sem conta de entrada → aviso na conferência. NF de mais de um pedido ou de outro CNPJ: não mexe.
- Agente do KM manda as NFs de cada pedido (`km-pedidos.sql` v387).
