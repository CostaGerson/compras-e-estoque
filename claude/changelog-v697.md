# v697 — Recorrentes a pagar e a receber (Matriz → Recorrentes, nunca o contrário)

- **Criar recorrente** pela *Nova conta* (pagar **e** receber: chave "Conta recorrente", periodicidade e "até") e pela guia **Recorrentes** (botões "Nova recorrente a pagar / a receber").
- **Marca na lista**: símbolo de recorrência em toda conta recorrente; com um **M** discreto quando vem da Matriz de custos.
- **Regra**: toda conta da Matriz está nas recorrentes; nem toda recorrente está na Matriz (eventuais, com prazo).
  - Mexer na Matriz atualiza a recorrente (o espelho só sobrescreve quando o item **da Matriz** muda — assinatura em `FinRecorrencia.matrizSnap`).
  - Mexer na recorrente **não** mexe na Matriz (editar, vistar e "usar a Matriz" ficam só na recorrente e nas contas em aberto). Removido "atualizar a Matriz".
  - Recorrente da Matriz não pode ser encerrada/desativada/excluída pela guia — tira-se o item da Matriz.
- Removido o aviso "recorrente fora da Matriz" (agora é permitido). Origem: "Matriz de custos" ou "Avulsa".
