# v401 — Conferência Pedidos em andamento × PCP do Maycon

- Botão **Conferir com o PCP** (barra do Cronograma em Pedidos em andamento): lê o PCP ao vivo (`/api/ext/pedidos`) e mostra
  - PCP: OPs em andamento (OP com algum item não concluído; OP de agrupamento conta 1) e quantas são de agrupamento;
  - Aqui: pedidos em andamento (fora internos NORT) = com OP própria aberta + só dentro de OP de agrupamento + concluídos no PCP (aguardando NF) + fora do PCP;
  - lista por grupo, com as OPs e situação de cada pedido;
  - OPs em andamento no PCP sem pedido em andamento aqui, com o status daqui (FATURADO, INTERNO, NÃO EXISTE AQUI…).
- `confrontoPcp()` em lib/cronograma.js; `GET /api/fin/pedidos?acao=confronto-pcp`.
- v400: situação do PCP com itens em fases diferentes (pedido em mais de uma OP) mostra a fase menos avançada + "parte concluída".
