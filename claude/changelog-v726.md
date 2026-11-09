# v726 — Facções a pagar (PCP): uma linha por item, datas do PCP e correção das lançadas

Base: documento do Maycon "ERP — Como importar as contas de facção do PCP" (06/11/2026).

## Lançamento (ADM › Facções a pagar)
- **Uma linha por `itens[]`**: pedido, produto, tipo de peça (pelo nome do produto), qtd aprovada × unitário. Acabou o `1 × total`.
- **Tipo de peça por linha** (conta-caixa e rateio por linha). Produto que o nome não identifica → a conferência pede o tipo
  (select vermelho "— escolher —"), e só lança depois de escolhido.
- **Datas**: recebido = `retornadoEm`; prazo = `vencimento − retornadoEm` (0 sem vencimento); pagamento na primeira sexta a
  partir do `vencimento`. Ex.: OS 15 → recebido 05/11, prazo 8, paga 13/11.
- **Desconto do PCP** (líquido < bruto): linha negativa "DESCONTO" com o motivo; total da conta = `valorLiquido`.
- **Conferência de valores**: itens ≠ bruto (> R$ 0,01) ou item com qtd × unitário ≠ valor → aviso na linha; a OS não vem marcada
  e não lança (nada é ajustado sozinho).
- **Observação**: `PCP OS 56 · ROMANEIO 26 · ACERTO 56-1 · 6 ITENS · ENVIADAS 80 · APROVADAS 80 · BRUTO R$ 496,00` (+ perdas, 2ª,
  retrabalho, desconto, vencimento). "UNIT." só quando há um item.
- PCP antigo sem `itens[]`: a linha sai do resumo (qtd aprovada × unitário), com aviso.
- A tela mostra itens e pedidos, qtd total enviada/aprovada, recebimento, prazo e sexta.

## Correção das contas lançadas no formato antigo
- Aba **Lançadas** mostra o aviso "N conta(s) lançada(s) como 1 × total" com o botão **Corrigir lançadas**.
- Busca de novo no PCP pela chave `lancamento` e regrava o mesmo item (nunca cria conta nova):
  - **não paga**: linhas, valor, recebimento, prazo, vencimento e sexta (muda de semana se for o caso; pagamento excepcional fica onde está);
  - **paga**: só as linhas e a observação, e só se o total do PCP = valor pago.

## Editar facção
- A linha de desconto (valor negativo) é aceita ao salvar; o código do item do PCP (`itemCode`) é mantido.
