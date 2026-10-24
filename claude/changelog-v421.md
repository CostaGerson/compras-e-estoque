# v421 — Compras do PCP lidas direto (/api/ext/compras)

- Testado com os dados reais do PCP (24/10): 30 compras pendentes — 18 de pedidos (26100013, 016, 025, 026, 031, 032, 034, 035) e 12 itens avulsos (1210, 1310, 1410, 1510, 1610).
- **Coluna Compras do PCP:** a sincronização lê as compras pendentes de cada OP e grava em `PedidoVenda.cronoCompras`. Item com compra pendente (casado pelo nome do produto) conta como em compras, mesmo com situação "a programar". Vale para Compras, Levantamento, Cruzamento e para a fase "Compras" da Gestão da produção.
- **Avulsas do PCP importadas sozinhas** (origem PCP): cria a compra avulsa com os itens (nome, quantidade) e acompanha pedido/recebido do PCP (aberta → comprada → recebida). Itens editados aqui não são sobrescritos; as já recebidas antes da integração não entram.
- Gestão: etapa ACABAMENTO conta como Costura.
