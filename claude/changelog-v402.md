# v402 — Faturamento parcial sai da previsão quando as contas da NF estão lançadas

- Regra (Igor, 22/10/2026): o que já foi faturado e tem conta a receber lançada não pode continuar na previsão dos pedidos em andamento (duplicaria o recebível).
- Listagem (e painel, que usa a mesma listagem): para cada pedido em andamento, soma as NFs dele (`nfsFaturadas` casadas pelos itens + `kmNfs`, sem repetir)
  que têm contas lançadas (`nfsComContas`: movimento fiscal LANÇADA com parcelas, ou título a receber com o nº da NF, mesmo CNPJ).
  Base da previsão = menor entre o saldo do KM e (total − faturado com contas).
- NF parcial sem contas continua na previsão (o recebível ainda não existe no contas a receber).
- Tela: abaixo do total, "− R$ x faturado" (NFs com contas) e "NF n sem contas" (parcial ainda sem contas).
