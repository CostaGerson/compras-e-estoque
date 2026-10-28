# v539 — Recompra não liquida o título: o cliente ainda deve

- Antes: pagar a conta a pagar da recompra marcava o título a receber como "liquidado (RECOMPRA)" — ele sumia do em aberto real e do virtual, como se o cliente tivesse pago.
- Agora: recompra paga → o título volta a **EM ABERTO** (conta a receber real), `cobranca RECOMPRADO`, mantendo o histórico (antecipação, contrato, recompra e data). Baixa normal quando o cliente pagar (extrato, retorno, manual). Estornar a recompra devolve o título a antecipado aguardando cliente.
- Títulos já recomprados antes da v539 são reabertos sozinhos ao abrir o contas a receber (`amarrarCobrancas`).
- Painel financeiro: recomprado conta no a receber real, não mais como antecipado.
- Relatório "Títulos Baixados/Pagos" do Bradesco: título que tem recompra não é mais liquidado automaticamente como "cliente pagou" (a baixa pode ser o débito da recompra) — aparece como **Tem recompra — conferir**.
