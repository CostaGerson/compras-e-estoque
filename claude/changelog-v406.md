# v406 — Cruzar com estoque, autorizar atendimento e leitura pelo PCP do Maycon

- **Levantamento › Cruzar com estoque** (`api/compras/cruzar`, `cruzarEstoque` em `lib/compras.js`): disponível = saldo do artigo − reservas. Sugestão: 1º pedidos que o estoque atende por inteiro, em ordem de entrega; 2º itens inteiros com o que sobrou, em ordem de entrega. Item nunca é atendido pela metade.
- Tabela por artigo: demanda, saldo, reservado, atende, **a comprar** (demanda dos itens não atendidos − sobra do estoque; botão em grosas). Por pedido: completo / parcial / vai para compra, com checkbox por item (dá para desmarcar a sugestão).
- **Autorizar atendimento pelo estoque**: confere o saldo de novo e muda o item para `ESTOQUE` (liberado para o PCP). Desfazer via `DELETE`. Reserva libera sozinha quando o item entra em produção/concluído no cronograma ou o pedido sai do andamento.
- **PCP do Maycon lê daqui** (nada gravado no banco dele): `GET /api/ext/compras` com `X-Api-Key` (token em Cruzamento › Integração PCP; gerado e salvo em FinConfig `COMPRAS|EXT_TOKEN`, ou `COMPRAS_EXT_TOKEN` no .env). Traz cada pedido com cabeçalho, itens liberados (grade, OP, parâmetros, FPP, materiais, origem ESTOQUE/OC, liberadoEm). Filtros `?desde=` e `?pedido=`.
- `CompraItem`: `autorizadoEm`, `autorizadoPorNome`, `liberadoEm`, `reservaLiberada`.
- Próximo: Gerar PIC → OC por fornecedor.
