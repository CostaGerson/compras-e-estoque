# v1065 (23/11/2026) — protesto de contas a pagar

- **Contas a pagar · conta vencida em aberto**: botão discreto **P** (cinza) nas ações. Abre a tela de protesto:
  - **Tabelionato de Protesto de Títulos de BH**: 1º, 2º, 3º ou 4º;
  - **Data máxima de pagamento**;
  - **Valor total a pagar** → calcula **principal** (valor da conta) e **taxas** (total − principal), lado a lado.
- Ao salvar: a conta passa a valer o **total** e vence na data máxima (o vencimento anterior fica no histórico de reprogramação); o **rateio** separa o principal (conta-caixa original, proporcional) e as taxas na conta nova **2134100 TAXAS DE PROTESTO** — grupo **06. Impostos e juros** da DRE, junto de 2134000 TAXAS. Na baixa (manual ou pelo extrato), cada parte cai na sua conta.
- A linha ganha a etiqueta vermelha **Protestado · Nº Tab.** e o P fica vermelho; uma observação registra cartório, prazo e valores.
- **Sustar / retirar protesto** (na mesma tela): volta valor, rateio e vencimento de antes.
- Banco: `FinTitulo.protesto` (Json). Conta-caixa criada automaticamente.
