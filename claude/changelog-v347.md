# v347 — Pedido faturado sai do "em andamento" sozinho

Antes, nada mudava o status de um pedido para FATURADO (só a mão); a NF de saída aparecia apenas como sugestão — e nem isso quando o CNPJ estava formatado de um jeito diferente.

- **Pela NF de saída** (`faturarPelasNfs`, roda ao listar pedidos / Atualizar do painel): mesmo cliente (CNPJ só dígitos, ou nome quando o pedido não tem CNPJ), NF emitida a partir da emissão do pedido, valor ±2% do total, do total + frete ou do saldo a faturar. Uma NF baixa um pedido só. Grava nº da NF, data e observação "FATURADO AUTOMÁTICO PELA NF …".
- **Pelo Cronograma (PCP)**: item com situação "FATURADO" conta como concluído; pedido com todos os itens faturados vira FATURADO.
- **Pela Posição de Vendas**: pedido já existente que volta com saldo a faturar zerado vira FATURADO.
- Sugestão de NF na tela de pedidos agora compara CNPJ só pelos dígitos.
