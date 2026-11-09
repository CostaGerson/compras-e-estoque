# v707 — Link de dados unitários só com pedido criado + fase "Recebendo detalhes"

- O link de preenchimento só pode ser gerado para **pedido já criado** e **ainda não enviado para a produção** (`DadoUnitarioLink.ppId` / `itemIdx`; o servidor recusa sem pedido ou com pedido efetivado).
  - Lançamento interno: precisa do rascunho salvo; ao gerar o link, o pedido é gravado na hora com o link no item.
  - Portal do cliente: o link sai em **Meus pedidos › dados unitários / link** (pedido em conferência); no Novo pedido fica o aviso.
- Fase **RECEBENDO DETALHES**: enquanto houver link aberto (e dentro do prazo) o pedido aparece assim na lista, no editor e no portal, e **não pode ser efetivado** (enviado para a produção) — fecha o preenchimento e traz as respostas para a lista para liberar.
- Portal: o cliente pode enviar o pedido com o dado unitário ligado e sem lista (a lista vem pelo link) e ajustar grade/dados de um item enquanto o pedido está em conferência (`PUT /api/portal`).
