# v373 — Pedido só sai de "em andamento" pela NF; sem duplicar com o contas a receber

Regra combinada (21/10): concluído no PCP **não** fecha o pedido. Ele fica em andamento no financeiro (painéis, previsão, pedidos) até ser faturado; aí sai do em andamento e o valor passa a estar no contas a receber (lançado pelo movimento fiscal).

- Removida a baixa automática pelo PCP (v347): só a NF fecha o pedido.
- A baixa por itens (v372) roda **na hora** em que uma NF de saída entra no movimento fiscal (importação normal, "Lançar contas" da crítica ou ZIP da contabilidade).
- Painel de previsão: se algum pedido foi faturado (total ou parcial) depois da última "Atualizar", o painel refaz sozinho os números de pedidos em andamento ao abrir — o valor faturado sai do em andamento e fica só no contas a receber.
- Parcial: o em andamento passa a contar só o saldo (`vlEntregar`); a parte faturada está no contas a receber pela NF.
