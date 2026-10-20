# v333 — Nome único para as recompras de antecipação

- O sistema criava o mesmo tipo de conta a pagar (banco cobrando de volta uma antecipação) com **dois nomes**: "RECOMPRA DE TÍTULO ANTECIPADO" (recompra manual/pelo extrato) e "COBRANÇA DE ANTECIPAÇÃO NÃO PAGA" (cobrança automática do vencido). Isso confundia.
- Agora as duas usam o mesmo nome: **"RECOMPRA DE ANTECIPAÇÃO · <título> · <cliente>"**.
- `padronizarNomes()` (roda no `sincronizarAntecipados`) renomeia as contas já existentes com os nomes antigos para o novo padrão.
- Parceiro (Bradesco), conta (2131300) e a lógica de liquidação continuam iguais.
