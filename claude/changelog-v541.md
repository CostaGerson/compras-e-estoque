# v541 — Relatório "Títulos a Vencer" (desconto Bradesco) + conferência dos layouts

- Conferidos com os PDFs reais de 28/10: **Títulos Pagos** (13 títulos, R$ 41.245,64) e **Títulos Baixados** (6 títulos, R$ 32.985,66) são lidos corretamente pelo parser existente.
- Novo: **Títulos a Vencer** (37 títulos, R$ 98.121,91 — total confere). Entra pela Transmissão de arquivos (destino "Títulos a vencer (desconto)") ou `/api/fin/avencer`.
  - Casa por nosso número → NF/parcela/valor. Situações: **Antecipado no sistema** (ok), **Marcar antecipado** (em aberto no sistema — marca PAGO/DESCONTADO/Bradesco com o contrato do relatório), **Divergente** (liquidado, recomprado ou recebido de outra forma), **Sem conta no sistema**.
  - Lista também os antecipados do sistema, a vencer, que o banco não listou.
