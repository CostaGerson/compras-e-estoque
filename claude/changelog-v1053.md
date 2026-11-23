# v1053 (23/11/2026) — item de pedido do sistema não some do levantamento

- **Problema**: pedido 26115015 (CONSORCIO VARGEM GRANDE VGR). Os 2 itens sem FPP ganharam FPP e foram vinculados (demandas em LEVANTAMENTO, 4 artigos cada), mas não apareciam no Levantamento.
  O pedido já está "EM PRODUÇÃO" no PCP (os outros 3 itens foram dispensados) e `itensAbertos` escondia todo item de pedido em produção.
- **Correção** (`lib/compras.js › itensAbertos`): pedido lançado no sistema (fonte SISTEMA) segue a regra da Sincronização de pedidos — o item no levantamento ainda não foi para o PCP, então aparece no Levantamento mesmo com o pedido em produção.
