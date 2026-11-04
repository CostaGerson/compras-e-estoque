# v638 — Card do pedido em Produção: guia OP, imprimir PV/OP, anexos e obs (sugestão #38)

- **Guia OP** no card do pedido (Produção › Gestão), entre Visão geral e Financeiro: cada item com foto, tipo de peça, código, grade, parâmetros de produção (na ordem do tipo de peça), FPP, situação em compras e a **fase no PCP** (fase, etapa, situação, previsão de término). Topo com o total de peças por fase.
- **Imprimir OP / Imprimir PV** no cabeçalho do card. Pedido lançado no sistema → mesmo layout do editor; veio do KM com PDF → abre o PDF do KM; sem lançamento → imprime com os dados do pedido. PV só para quem vê valores.
- **Visão geral**: card de **Anexos** do lançamento (OC, solicitação, layout…) e a **observação da NF** abaixo da observação.
- **PP passa a se chamar OP** (ordem de produção) nas telas e na impressão.
- Backend: `detalhePedido` devolve `tipoPeca`, `parametros`, `foto`, `previsto` por item, `pp` (id/origem/PDFs), `anexos` e `nfObs`. Helpers `dadosImpressaoPp` e `dadosImpressaoPedido` em `impressaoPedido.js`.
