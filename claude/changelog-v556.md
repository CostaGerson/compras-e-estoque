# v556 — Casamento NF ↔ pedido só manual

- Regras automáticas desligadas (reativáveis com `CASAMENTO_AUTOMATICO=1` no .env): pelos itens da NF, pelo valor, pelas NFs do KM, no upload da NF e no sync do KM (KM com saldo zerado não fatura mais o pedido). `efetivarFaturamentos` continua só para os casamentos manuais pendentes de contas.
- Uma vez (na subida do servidor / ao abrir a Produção): pedidos atualizados desde 01/10/2026 com faturamento automático voltam para EM ANDAMENTO com o saldo; ficam só as NFs casadas manualmente ("Casar" e "Incluir faturamento"). Registro em `finConfig FAT|REMOVE_AUTO_V556` — ver em `/api/producao/faturamento?log=v556`.
- Conferência da NF: sem escolha a NF fica sem pedido.
