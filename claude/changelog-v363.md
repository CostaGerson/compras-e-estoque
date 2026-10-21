# v363 — NFs da contabilidade no movimento fiscal e nos dados de NF, com origem e crítica

- **Sincronização:** ao abrir o movimento fiscal ou os dados de NF, os ZIPs/XMLs de saída já enviados na contabilidade são relidos uma vez (controle em `FinConfig FISCAL|SYNC_CONTAB`) e as NFs que faltam entram em `FiscalNota` — sem duplicar (chave da NF). Erros agora vão para o log em vez de serem engolidos.
- **Origem:** cada nota mostra "MOVIMENTO FISCAL" ou "IMPORTAÇÃO CONTABILIDADE" (dados de NF: coluna Origem e filtro; movimento fiscal: "via contabilidade" sob o número).
- **Crítica** (`critica` na listagem): NF que gera conta e não tem conta lançada — vinda da contabilidade ("NF subida por importação na contabilidade, verificar contas") ou lançada sem parcelas ("NF sem conta lançada, verificar contas"). Linha vermelha nos dois lugares; filtro "Com crítica (sem conta)" nos dados de NF. Cancelada/remessa/retorno continuam só registradas, sem crítica.
