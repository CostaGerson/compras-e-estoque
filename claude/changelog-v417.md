# v417 — Compras só com pedidos em levantamento/compras no PCP + compras avulsas

- **Filtro pelo PCP do Maycon:** Compras › Pedidos, Levantamento e Cruzamento mostram só os pedidos com item em LEVANTAMENTO ou COMPRAS no PCP (situação ou etapa). Programado/a programar, em produção e concluído já têm a matéria-prima comprada e saem. Pedido que ainda não está no PCP continua (filtro "Fora do PCP").
- **Compras avulsas** (Compras › Pedidos › "Compras avulsas"): nº opcional (ex.: 1210 do PCP), para operação ou pedido específico, observação e itens com nome, quantidade, unidade, fornecedor (opcional) e **bom para** (data máxima de chegada): até 2 dias vermelho, até 5 amarelo, depois verde. Status aberta → comprada → recebida, com "voltar" e cancelar. Modelo `CompraAvulsa`.
