# v826 — receita por tipo de serviço; reprogramado alinhado

- Contas-caixa novas (grupo RECEITA da DRE): 1116100 SERVIÇO DE SILK · 1116200 SERVIÇO DE BORDADO · 1116300 SERVIÇO DE IMPRESSÃO DTF · 1116400 SERVIÇO DE IMPRESSÃO SUBLIMAÇÃO · 1116500 SERVIÇO DE PRENSAGEM DTF · 1116600 SERVIÇO DE PRENSAGEM SUBLIMAÇÃO. A facção continua na 1116000 SERVIÇO DE FACÇÃO. Criadas por `garantirContas` (CONTAS_BASE) e mapeadas em `MAPA_OFICIAL`.
- Pedido de serviço: cada linha tem **Tipo de serviço** (select; se vazio, deduz pela descrição). Gravado em `parametrosJson.TIPO_SERVICO`.
- Contas a receber do pedido de serviço (entrada, parcelas, faturamento, sem nota) vão para a receita do serviço, proporcional ao valor de cada linha (`lib/servicosReceita.js`). As em aberto que já existiam são realocadas ao abrir o financeiro.
- NFS-e de saída: a conta vai para a receita do serviço pela descrição da nota (antes de repetir a última conta do cliente).
- Conta a receber/pagar: "Reprogramado" sem a explicação, alinhado ao vencimento.
