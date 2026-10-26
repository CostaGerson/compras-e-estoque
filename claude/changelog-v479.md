# v479 — Cotações → OC → NF → rota de coleta

- **Cotações**: situações GERADA → ENVIADA (ao copiar, baixar, compartilhar ou abrir no WhatsApp, ou "Marcar enviada") → RESPONDIDA (valor registrado) → OC. Abas Geradas / Enviadas / Respondidas / Com OC / Todas.
- **Gerar OC** na cotação respondida: valor negociado por item, prazo de entrega, forma de recebimento (coleta, transportadora, entrega própria), dias após o faturamento (transportadora) e condição de pagamento. A OC sai com os itens do PIC da cotação (`OrdemCompra.cotacaoId`, `formaRecebimento`, `diasAposFaturamento`).
- **Coleta**: ao gerar a OC (e pelo botão "Criar rota de coleta" da OC) abre a demanda de rota preenchida — fornecedor, endereço, contato e "COLETA OC x · NF y".
- **NF na OC**: nº e emissão da NF do fornecedor; OC = NF emitida e os itens de compra cujos artigos estão todos em OCs com NF passam a status `NF`.
- Rota de entrega de pedido (tarefa PROGRAMAR ENTREGA) leva a NF do pedido no "o que fazer": "ENTREGA PEDIDO N · NF x".
