# v1051 (23/11/2026) — uma cotação só por fornecedor

- **PIC › Gerar cotação**: se o fornecedor já tem cotação aberta (gerada, enviada ou respondida, sem OC), o sistema pergunta se junta os itens nela. Linhas iguais são somadas; a cotação volta a **gerada** para reenviar ao fornecedor (os valores já respondidos ficam). O card de envio mostra a cotação inteira.
- **Cotações**: botão **Juntar COT X** no card quando há outras cotações abertas do mesmo fornecedor — os itens vão para esta, as outras são canceladas ("Juntada na COT …").
- **Gerar OC** (complemento): a pergunta de consolidar numa OC só passa a considerar todas as cotações sem OC do fornecedor com valor (salvo ou digitado), salvando as respostas antes.
- `lib/cotacoes.js`: `juntarItens`, `juntarCotacoes`, `criarCotacoes` com `juntarEm`.
