# v752 — Demanda de arte vinda do PCP

- `POST /api/ext/demanda-arte` (token X-Api-Key, o mesmo das outras /api/ext): cada solicitação de desenvolvimento de arte no PCP (v50) abre uma demanda na agenda do **Maycon**.
- Modelo: Funcional · projeto Meridian LTDA · setor Gestão · colaborador Maycon · data limite = dia da solicitação · manhã · padrão · privada.
- Título: `DESENVOLVIMENTO DE ARTE - PEDIDO (26100016, 26100020 - M ROSCOE)`. Descrição: detalhes de personalização do pedido, lista dos itens quando são vários, responsável pela arte.
- Campo novo `Tarefa.pcpChave` (único): a mesma solicitação nunca abre duas demandas.
