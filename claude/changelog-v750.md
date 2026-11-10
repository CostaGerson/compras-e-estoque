# v750 — Desconto no lançamento de pedido (na peça ou no total)

- **Na peça**: em cada item, "+ desconto na peça" — % ou R$ sobre o valor unitário cheio. O campo passa a ser "Valor unitário cheio" e o item usa o preço com desconto (mostra "= R$ x/pç"). Guarda `PpItem.desconto { tipo, valor, base }`.
- **No total do pedido**: card "Desconto no total do pedido" (Não/Sim, % ou R$) sobre o valor dos itens (o frete não entra). Guarda `Pp.desconto { tipo, valor }`.
- O total do pedido = itens − desconto + frete (prazo de pagamento, contas a receber, pedido de venda). A comissão (v747) é calculada sobre o valor com desconto. O PV impresso mostra Itens, Desconto e Frete.
- v749: desfeita a v748 (pedido do portal só entra na Produção depois de efetivado) + diagnóstico `/api/producao/gestao?diagPortal=1` (pedidos do portal e o pedido de venda de cada um).
