# v730 — Editar pedido do KM (assumir no sistema)

- **Card do pedido › Editar** agora aparece também nos pedidos que vieram do KM (antes só nos lançados no sistema).
- Pedido do KM: pede confirmação e **assume o pedido no sistema** (`POST /api/pp/assumir`, `lib/pedidoAssumir.js`):
  monta o lançamento a partir do pedido de venda (cliente, OC, vendedor, obs, emissão, prazo = entrega − emissão, condição,
  itens com grade, preço, parâmetros e a FPP já ligada em Compras). Se já existia lançamento do PDF do KM, reaproveita.
  Abre o editor em modo "Salvar alterações".
- **Ao salvar**: o pedido de venda vira fonte SISTEMA. A **sincronização do KM não mexe mais** nele (`kmSync`: assumidos).
  Os dados do KM de cada item (OP, setores, entregue) são mantidos.
- **Contas a receber do KM ficam como estão**: sem condição de pagamento montada no editor, a efetivação não cria nem cancela
  entrada/parcelas e mantém a condição de texto do KM. Se a equipe montar a condição no editor, ela passa a valer (como pedido do sistema).
- Pedido assumido não gera a tarefa de criação de layout.
- Schema: `Pp.kmAssumidoEm`.
