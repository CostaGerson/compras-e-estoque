# v420 — Produção › Gestão (abre ao clicar em Produção)

- **Atalhos** (Lançar PP, Compras, Análises, Estoque…) viram botões pequenos no canto superior direito; os cards da entrada de Produção saem.
- **Indicadores em pizza** (lidos do PCP do Maycon a cada 1 min — `sincronizar({ intervaloMs })`): pedidos em andamento, em dia, atrasados e entrega na semana (próximos 7 dias), em % do total. Clicar filtra a lista.
- **Atrasado:** prazo de entrega vencido ou previsão de término (fim programado no PCP) depois do prazo.
- **Lista** por fase do processo (compras › corte › personalização › costura › expedição › concluído; a fase do pedido é a do item menos avançado), busca por cliente, nº, valor ou item, e ordenação clicando no título da coluna.
- **Pedido em tela grande:** nº, status (em dia/atrasado), fase, cliente, OC, vendedor, condição, datas, observação editável; itens com a fase no PCP, **ver FPP** e **editar FPP** (abre a ficha no Comercial); faturamento (NFs, peças pendentes, valor pendente a faturar); **ocorrências** (lançamento, compras e cada fase do PCP com início/fim ou previsão, prestador) e **comentários** com @marcação (quem é marcado recebe mensagem). Modelo `PedidoComentario`.
