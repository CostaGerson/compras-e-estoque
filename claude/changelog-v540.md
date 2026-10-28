# v540 — Fluxo dos relatórios de desconto de duplicatas (Bradesco)

- **Títulos Vencidos**: recompra (conta a pagar) com vencimento **5 dias úteis após o vencimento original** do título + crítica no título.
- **Títulos Pagos**: cliente pagou o boleto → liquida o título antecipado (cancela a recompra em aberto, se houver).
- **Títulos Baixados**: o banco cobrou a recompra da Meridian → **baixa a conta a pagar da recompra** (cria se não existir; valor baixado do relatório, diferença = encargos). O título NÃO é baixado: volta a EM ABERTO (RECOMPRADO) para receber do cliente.
- Antecipado (retorno motivo 20 ou contrato) segue no **em aberto virtual** até aparecer num dos relatórios.
