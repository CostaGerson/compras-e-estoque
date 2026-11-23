# v1042 (23/11/2026) — sugestões #91 e #94

- **#94** · Lançamento do pedido › Venda comissionada: o "Não" não marcava ao clicar (`on` ficava `undefined`). Corrigido em `pedidoEditor.jsx`.
- **#91** · Pedidos efetivados antes da v917 ficaram só com o nome do produto e o PCP voltava ao nome do ERP.
  `corrigirPrefixosAntigos` (`lib/nomeItemCliente.js`) roda **uma vez**, 40 s após subir, e põe "CLIENTE - " nos itens dos pedidos do sistema em andamento (PpItem e PedidoVenda). Serviço, portal e NORT ficam de fora; item que já tem prefixo não muda.
  Marca em `FinConfig` `PEDIDO|PREFIXO_CLIENTE_V1042` com a lista dos pedidos corrigidos. No PCP, cada um aparece como "Alterado no ERP" para confirmar ciência.
