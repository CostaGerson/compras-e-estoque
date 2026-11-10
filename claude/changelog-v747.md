# v747 — Venda comissionada e cadastro de vendedores

- **Dados › Vendedores** (novo): nome, CPF/CNPJ, telefone, e-mail, endereço, PIX (tipo e chave), banco/agência/conta e **condição de fechamento**: Spot ou Mensal.
- **Lançamento de pedido** — card **Venda comissionada** (antes do prazo de pagamento): Não/Sim, vendedor (com "+ Cadastrar vendedor"), comissão em **%** (sobre o valor dos itens, sem frete) ou em **R$**.
- **Contas a pagar** (conta 2119000 · Comissão de vendas, criada sozinha; forma `COMISSAO`, PIX do vendedor):
  - a comissão é dividida entre as contas a receber do pedido, na proporção do valor de cada uma sobre o total do pedido;
  - **Spot**: uma conta a pagar em cada vencimento de conta a receber (entrada, parcelas; faturado e parcelado: em cada fatura, proporcional);
  - **Mensal**: as partes com vencimento a receber no mês viram uma só conta a pagar no **dia 10 do mês seguinte** (soma de todos os pedidos do vendedor).
- Lança ao **efetivar** e de novo ao **faturar** (as parcelas da NF/entrega ganham a parte delas). Mudar o fechamento do vendedor refaz as contas ainda não pagas; conta já paga não é alterada.
- Modelos novos: `Vendedor`, `VendaComissao` (parte por conta a receber); `Pp.comissao`. Cálculo em `lib/comissoes.js`.
