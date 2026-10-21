# v353 — Leitura do Cronograma PCP pelas regras novas do Maycon

Fonte: `como-ler-o-cronograma.md` (21/10/2026). Tudo em `app/lib/cronograma.js` + bloco do PCP em `app/app/pedidosAndamento.jsx`.

- **Conexão:** padrão passa a ser `https://pcp.meridianpro.com.br` com token `meridian-pcp`. URL salva antiga (`147.93.35.189:8124`) é trocada sozinha; URL/token configurados na tela continuam valendo.
- **Regra 1 – situação:** `LEVANTAMENTO`, `A_PROGRAMAR`, `EM_PRODUCAO`, `CONCLUIDO`. Em produção = `situacao != CONCLUIDO`. Texto exibido: "A PROGRAMAR", "EM PRODUÇÃO", "CONCLUÍDO".
- **Regra 2 – peças:** contagem usa `pecas` (complemento = 0). `quantidade` fica só como "a cortar". Complementos (entretela, forro…) aparecem na lista do pedido como "(complemento) corte N".
- **Regra 3 – itemCode / sem número:** item com `pedido` vazio é amostra/piloto — não é mais deduzido pelo itemCode e não conta como "sem PV aqui".
- **Regra 4 – agrupamento:** PV casa com a OP pelo próprio número **ou** por `pedidosAgrupados`. Situação mostra "AGRUPADO NA OP x"; peças não são multiplicadas.
- **Regra 5:** o painel já é por pedido (PedidoVenda), não por parcela — nada a mudar.
- **Painel:** barra do PCP mostra peças em produção, OPs em produção, OPs de agrupamento, complementos fora da contagem e itens sem nº. "No PCP sem PV aqui" conta só OP em produção cujo número e agrupados não existem aqui.
- **Conferência:** no pedido, "PCP: X peças · PV Y" fica vermelho quando divergem (fora de agrupamento) — os 7 casos do Maycon.

## v353.1 — teste contra a API real (21/10/2026)
- URL padrão em `https` (o `http` redireciona).
- Rodado o código novo nos dados reais: 545 itens, 176 OPs, 43 complementos, **56.201 peças × 63.401 a cortar** (igual ao documento do Maycon); 20 itens sem nº (`SN-…`), 4 OPs de agrupamento, 42 OPs em produção com 18.084 peças; 26080044 (Graber) casa pela OP 26090045.
