# v362 — Recebimentos: NF sugerida em amarelo, tipo do recebimento e exclusão em lote

- **NF sugerida** pelo sistema aparece com fundo **amarelo** e sem OBS (`FinRecebimento.nfSugerida`). Ao editar a NF, deixa de ser sugestão.
- **Coluna TIPO** antes da OBS (`FinRecebimento.tipoReceb`): créditos `ENTRADA | RESTANTE | TOTAL`; boletos `k/n` (lido do seu número, ex. 1893-1/2 → 1/2) ou `TOTAL` (parcela 1/1). Também sai no XLSX.
- **Saldo da NF entre meses:** NF usada como TOTAL (ou boleto 1/1) fica fechada — não é sugerida em outro recebimento, em nenhum mês. ENTRADA, RESTANTE e parcelas vão abatendo do valor da NF; ela só volta a ser sugerida para valores que caibam no saldo (o saldo exato vira RESTANTE). Linhas antigas sem tipo com o valor cheio da NF contam como TOTAL.
- **Exclusão em lote:** caixa de seleção em cada linha (e "marcar todas" por bloco) + botão "Excluir N selecionada(s)".
- Banco: dois campos novos em `FinRecebimento` (entram pelo `prisma db push` do container).
