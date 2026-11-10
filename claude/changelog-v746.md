# v746 — Frete contratado por entrega no lançamento de pedido

- Em cada entrega (única ou cada local da fracionada / terceiros): **Frete contratado? Não / Sim** e, no sim, **valor do frete**.
- O frete **soma no total do pedido** (prazo de pagamento, parcelas, contas a receber) e **não é distribuído entre os itens** (valor unitário e total dos itens ficam como estão).
- Totais mostram "itens + frete"; o PV impresso traz as linhas Itens e Frete antes do Total.
- Grava: `Pp.frete` (entrega única, campo novo) e `entregas[].frete`; no pedido de venda, `frete` (soma) e `freteTipo = CONTRATADO`. Cálculo em `freteTotal()` (`lib/pedidoLanc.js`).
