# v332 — Recompra de títulos descontados identificada no extrato

- No extrato, a recompra aparece como débito **"DEB DESCONTO DUPLICATAS"** (o banco debita de volta um título descontado que o cliente não pagou).
- `lib/finBaixas.js`:
  - Detecta esses débitos (`RECOMPRA_RX`) e os casa, por **valor próximo**, com os títulos **descontados ainda não liquidados** (RECEBER, PAGO, cobrança DESCONTADO / antecipado, sem liquidação).
    - Tolerância de 8% ou R$ 50 (juros/IOF do banco); mostra a diferença como juros.
    - Confiança ALTA quando o valor bate exato, MÉDIA quando é próximo.
  - As contas a pagar de recompra (`RECOMPRA|…`) saem do casamento normal — a recompra trata delas.
  - `baixarRecompra`: ao aceitar, cria (ou usa) a conta a pagar da recompra, baixa-a com o débito e o título original fica **liquidado como RECOMPRA** (via `sincronizarAntecipados`).
- `api/fin/baixas` e a tela de baixas passam a enviar/entender a flag `recompra`.
- Teste: débito de R$ 6.210,88 casou com a duplicata descontada de R$ 6.150 (R$ 60,88 de juros), como sugestão MÉDIA.
