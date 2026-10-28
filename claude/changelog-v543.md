# v543 — Parcelas da mesma NF: soma sempre igual ao valor da nota + "i" amarelo nas alterações

- Editar o **valor** de uma parcela (em aberto) de nota com várias parcelas: as demais parcelas **em aberto** são refeitas para a soma continuar igual ao valor da nota. Regra da importação: o que falta é dividido igualmente entre as parcelas em aberto não editadas à mão (arredondamento na última); se todas já foram editadas, ajusta a última em aberto. Parcelas pagas não mudam.
- Bloqueia (com mensagem) quando não dá para manter a soma: valor maior que a nota, parcela zerada ou nenhuma outra em aberto.
- Parcelas da mesma nota: chave de importação (NFE/NFSE/ARQ/RETNF), parcelas gravadas no movimento fiscal, ou nº "NNNN-k/n" + CNPJ.
- Novo campo `FinTitulo.alteracoes`: na lista, **i amarelo** ao lado do valor ou do vencimento alterado; o mouse mostra de quanto para quanto, quem e quando (e, nas parcelas ajustadas, qual parcela causou o ajuste).
