# v334 — Relatório "Títulos Baixados" (cliente pagou a duplicata descontada)

- Novo destino na Transmissão: **Títulos baixados (desconto)**. O relatório "Títulos Baixados" do Bradesco é reconhecido sozinho.
- `lib/finAntecipacao.js`:
  - `ehTitulosBaixados`, `parseTitulosBaixados` — lê cada baixa: vencimento, parcela, contrato, seu número (NF-parcela), data da baixa, nosso número, sacado, valor baixado e valor da nota.
  - `analisarBaixados` — casa cada baixa com o **título descontado ainda não liquidado**: 1º nosso número, 2º NF + valor próximo, 3º valor exato + nome do sacado. Mostra situação (liquidar / já liquidado / sem conta).
  - `aplicarBaixados` — **liquida** (liquidação do cliente, na data da baixa) os títulos marcados; a conta a pagar da recompra em aberto, se houver, é cancelada (via `sincronizarAntecipados`/`amarrarCobrancas`).
- `api/fin/baixados` (analisar/aplicar) e `BaixadosModal` na Transmissão.
- Teste com o relatório real: Σ baixado R$ 5.584,41 (bate com o total); título da Atrativa casou pelo nosso número e foi liquidado em 14/10.
