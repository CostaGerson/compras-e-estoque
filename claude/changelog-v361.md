# v361 — Planilha de recebimentos casando com a base inteira de NFs

- **Fora da planilha:** créditos de MERIDIAN e de NORT SPORTS (antes Nort ia para "A confirmar"). Pedro Tavares / Igor continuam em "A confirmar".
- **Base de NFs:** `baseNfs()` junta todas as NFs de saída — XMLs da contabilidade (`FinNfSaida`, todos os meses) + movimento fiscal (`FiscalNota` SAIDA, com as parcelas). Ficam fora canceladas e notas que não geram conta (remessa, retorno…).
- **Casamento de cada crédito:** valor = total da NF **ou** uma parcela; cliente = CNPJ (do histórico, do cadastro ou pelo nome) ou nome parecido; NF emitida até 1 ano antes (ou até 5 dias depois) do crédito. Cada NF/valor só casa uma vez (duas parcelas iguais casam dois créditos), contando o que já foi usado nos outros meses.
  - valor + cliente → NF preenchida, OBS "NF SUGERIDA: valor e cliente batem";
  - só valor e único → NF preenchida, OBS "NF SUGERIDA SÓ PELO VALOR — CONFERIR O CLIENTE";
  - senão → OBS "POSSÍVEIS: NF x (cliente) · …" (até 3).
- **Cruzar com a IA:** passa a usar a mesma base (NFs dos últimos 12 meses, com parcelas). A pílula mostra quantas NFs há na base.
- Linhas editadas à mão continuam preservadas ao gerar de novo.
