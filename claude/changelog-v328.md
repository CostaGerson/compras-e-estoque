# v328 — Lançar PP mostra todos os pedidos do sistema

- Ao abrir o Lançar PP, o sistema garante automaticamente uma casca de PP para **todo pedido que existe no sistema** (PedidoVenda) e ainda não tem PP.
  - `garantirPpTodos()` em `lib/pedidos.js`, chamada no `GET /api/pp`.
  - Cria só o que falta (idempotente) e em massa (`createMany`).
  - A casca traz cliente, OC, condição, despacho, vendedor e valor; o PV/PP preenchem itens e PDFs depois.
- Antes, as cascas só eram criadas ao importar a Posição de Vendas; agora qualquer pedido (importado por relatório, PV, PP ou criado à mão) aparece no Lançar PP sem passo extra.
