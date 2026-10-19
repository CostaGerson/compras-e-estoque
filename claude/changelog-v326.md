# v326 — Cobranças antigas fora da previsão + todo pedido no Lançar PP

## Cobranças antigas fora do financeiro
- Pedido com entrega (programação do Cronograma ou DT despacho) **anterior a hoje** e não concluído no PCP → sai da previsão de receitas (sem parcelas).
  - Antes a previsão empurrava o valor para hoje; agora ele é desconsiderado até o pedido ser reprogramado.
  - O pedido continua aparecendo, em vermelho, com "ENTREGA/PROGRAMAÇÃO VENCIDA — FORA DA PREVISÃO · reprogramar no PCP".
- Com a Posição de Vendas carregada, a previsão passou a considerar só os pedidos com entrega futura; os vencidos (saldo antigo a faturar) ficam de fora até reprogramação.

## Todo pedido no Lançar PP
- A importação da Posição de Vendas agora:
  - **cria todos** os pedidos do relatório (não só os pendentes). Os já entregues (sem saldo a faturar) entram como **FATURADO**, então não poluem a lista de Pedidos em andamento, mas existem no sistema.
  - **espelha todos** no Lançar PP: cada pedido ganha uma casca de PP (cliente, OC, condição, despacho, vendedor, valor) quando ainda não tem PP. O PV/PP preenchem os itens e os PDFs depois.
- Tudo em massa (`createMany` em lotes + `$transaction`), para não travar com centenas de pedidos.
- Teste com a Posição de set–out/2026: 786 pedidos e 786 PPs criados; 109 em andamento, 677 faturados; previsão passou a R$ 593 mil (os ~R$ 966 mil de saldo vencido ficaram fora, aguardando reprogramação).
