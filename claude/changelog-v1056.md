# v1056 (23/11/2026) — contas: busca + situação e nomes do mesmo CNPJ

- **Situação com busca**: desde a v952 a busca ignorava a situação escolhida ("em aberto" com busca trazia os pagos). Agora a busca soma com a situação (em aberto, vencidos, pagos…) e com os filtros rápidos.
- **Títulos "sumidos" da Cedro**: as NFs 953918 e 953919 (16/10) estão lançadas — 953918 em 2× R$ 1.060,40 (16/11 e 15/12) e 953919 em 3× (R$ 2.527,43 16/11 e 15/12, R$ 2.527,50 14/01) — mas o XML traz o emitente como **CDP - CENTRAL DISTRIB CONTAGEM** (mesmo CNPJ 17.245.234/0027-30), por isso a busca "cedro" não achava.
  A busca agora reconhece todos os nomes usados pelo mesmo CNPJ (raiz): buscar "cedro" traz também os títulos da CDP, e vice-versa.
