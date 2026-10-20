# v346 — Card "Contas a pagar" (real × virtual) no painel de previsão

Novo card abaixo de "Contas atrasadas": mostra o **virtual**; clicando abre real e virtual com a composição.

- **Real**: contas a pagar em aberto com vencimento **depois do mês previsto**, sem previsões e sem as parcelas dos contratos de dívida (recorrências `MATRIZ|dividas|CONTRATO:`, já cobertas pela quitação). Dívidas tributárias ficam no real.
- **Virtual** = real
  + **previsões do mês seguinte** (mais um mês de operação, sem parcelas de contrato)
  + **quitação das dívidas não tributárias** no mês seguinte: saldo devedor de cada contrato ativo pela Alavancagem (`panorama`), na posição do fim do mês previsto — listado contrato a contrato
  + **CMV dos pedidos em andamento** (digitado, em branco)
  + **passivo tributário** (digitado, em branco).
- Campos novos no painel: `cmvAndamento`, `passivoTributario` (gravam ao salvar o painel).

## v348 — ajuste
- Previsões: só as do mês seguinte (M+1), **incluindo** a parcela dos contratos de dívida nesse mês.
- Quitação: saldo devedor de cada contrato **depois** das parcelas que já estão no contas a pagar até o fim de M+1 (atrasadas, mês e M+1) — sem contar duas vezes. Parcelas de contrato depois de M+1 ficam fora do real (estão na quitação).
