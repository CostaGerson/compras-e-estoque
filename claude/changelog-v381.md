# v381 — Comercial › Acompanhamento

- Card **Acompanhamento** no Comercial → lista de pedidos (em andamento; "incluir faturados" mostra todos): nº, emissão, cliente, nº de itens (PV; sem PV, itens do PCP), valor total, entrega e **situação = a do item menos avançado no PCP** (Levantamento < A programar < Em produção [etapa] < Concluído); faturado/cancelado pelo status; selo "faturado em parte".
- Acesso: master e diretoria veem todos (com coluna vendedor); os demais só os pedidos em que o **vendedor do PV** é o usuário logado (primeiro nome ou nome completo).
- Ao clicar: leitura **ao vivo** do PCP (`pcpDoPedido`, inclui OP de agrupamento) — por peça: situação/etapa, **desde** quando (entrada na etapa em curso; sem entrada, saída da etapa anterior; concluído = última saída), **programação** (etapa em curso × fim programado: em dia / atrasado N dias / adiantado se entrou antes do início programado; concluído × prazo de entrega; sem etapa × prazo), prestador, entrega (vermelha se já passou). Clicar na peça abre as etapas (programado × real).
- API `api/comercial/acompanhamento`.
