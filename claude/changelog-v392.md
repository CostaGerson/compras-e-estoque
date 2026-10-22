# v392 — Faturamento pelo upload da NF; status do PCP enquanto isso

- Regra (Igor): quem fatura o pedido é **subir a NF de saída** no movimento fiscal (com as contas lançadas). Antes disso o pedido mostra a situação no PCP do Maycon.
- Lista de pedidos: o selo de status do pedido em andamento mostra `PCP: <situação>` (verde quando concluído no PCP; "Fora do PCP" quando não está no Cronograma); etapa no título.
- NF já emitida no KM e ainda não subida: dica discreta "NF nnn no KM — subir NF" (substitui "lançar contas" / "NF KM").
- `faturarPeloUpload` (lib/entradaNf.js), chamado ao gravar NF de SAÍDA com contas criadas/ligadas: pedido ligado à NF pelo KM vira FATURADO na hora quando
  as NFs dele cobrem o total (±2%) e todas têm contas; senão fica pendente/parcial. Em seguida roda `efetivarFaturamentos` e `faturarPelasNfs`.
