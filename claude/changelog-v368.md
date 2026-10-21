# v368 — Financeiro › Patrimônio

- Card **Patrimônio** no painel do Financeiro (gerencial) → tela própria.
- Modelo `FinPatrimonio`: descrição, categoria, marca/modelo, nº de série/placa, local, data de aquisição, valor de compra, valor atual estimado, situação (ATIVO/VENDIDO/BAIXADO), NF de compra (nº, fornecedor, chave, arquivo PDF/XML) e observações.
- Tela: totais (bens ativos, valor de compra, valor atual, sem NF), filtro por categoria/situação/busca, chips por categoria, cadastro/edição em janela, exclusão, link do arquivo da NF.
- API `api/fin/patrimonio` (GET/POST/PATCH/DELETE; `?arq=ID` baixa a NF).
- Próximo passo natural: usar o valor atual dos ativos como sugestão da "venda de patrimônio" do cenário LB.
