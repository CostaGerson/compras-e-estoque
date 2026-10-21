# v364 — Cenário LB (liquidação de balanço)

- Cenário geral sem o texto da antecipação (a conta continua no "passe o mouse").
- **Cenário LB**, abaixo dos cenários, na largura das duas colunas: `cenário geral + venda de patrimônio − passivo trabalhista − 1 mês de operação − dívidas`.
  - Venda de patrimônio, passivo trabalhista e 1 mês de operação: digitados no próprio card (salvos com o painel: `lbVendaPatrimonio`, `lbPassivoTrabalhista`, `lbMesOperacao`).
  - Dívidas: saldo para quitar **hoje** tudo o que está na Alavancagem (`pos.pagar.dividasLB`), descontadas as parcelas dessas dívidas já lançadas no contas a pagar (não previsão), que já saem do cenário geral. Clicar abre a lista por contrato.
- O servidor calcula o mesmo valor (`cenarios.lb`) ao salvar o painel.
