# v374 — Faturamento parcial também em pedido sem PV (pelas peças)

- Pedido sem itens do PV ("falta PV", veio do relatório): a NF é conferida pelas **peças** (qtd do pedido; sem ela, peças do PCP sem complementos) e pelo valor do saldo. NF com menos peças que o pedido → **parcial**; o saldo a faturar = total − valor da NF (com frete quando cabe no pedido).
- Pedidos fechados antes só pelo valor (±2%, texto "FATURADO AUTOMÁTICO PELA NF") são reabertos e reconferidos pelas peças — ex.: 26090029 (NF 2028, 69 de 70 peças) volta a em andamento com R$ 24,90 / 1 peça.
- A regra só por valor fica apenas para NF sem XML no movimento fiscal (texto "FATURADO PELO VALOR DA NF").

## v374.1
- Correção: a busca das NFs descartava as notas com `motivo` vazio (todas as lançadas) por causa do `NOT` do Prisma com nulo — por isso nenhum pedido era baixado. Agora `motivo` nulo OU sem "CANCELAD".
