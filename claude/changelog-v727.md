# v727 — Pedido da Loja Way liberado no portal entra sozinho na produção

- **Liberado para produção no portal** (envio direto ou fim do recebimento de detalhes) → o pedido é **efetivado sozinho**:
  número, pedido de venda, contas a receber e Compras (itens com FPP vão para o levantamento → PCP), igual ao botão Efetivar.
- **Anexos no pedido** (card Anexos / produção):
  - as artes que o cliente subiu em cada item (categoria LAYOUT, "Item N · arquivo");
  - **Personalização exclusiva em Excel** (`Personalização exclusiva · portal 0003.xlsx`): uma aba por item, com nº, tamanho e o
    que vai em cada local (ex.: COSTAS SUPERIOR CENTRAL · NOME). Liberar de novo refaz o anexo, sem duplicar.
- **Condição de pagamento e vendedor**: os do último pedido do mesmo cliente do portal já efetivado. Só repete condição por prazo
  (sem entrada e sem parcela de valor fixo).
- **Quando não dá para lançar sozinho** (primeiro pedido do cliente, condição com entrada/valor fixo, item sem preço, sem prazo…):
  fica em Pedidos › Lançar pedido e a mensagem para comercial/master/diretoria traz o motivo. A equipe efetiva e os próximos seguem sozinhos.
- **Ajustes depois**: o pedido abre normal em Lançar pedido; "Salvar alterações" muda itens, grade, prazo de entrega, pagamento e
  anexos e regrava o pedido de venda. Para o cliente ele aparece "Em produção" e não pode mais ser alterado/excluído pelo portal.
- `lib/portalProducao.js` (`lancarNaProducao`, `planilhaPersonalizacao`, `condicaoReaproveitavel`).
