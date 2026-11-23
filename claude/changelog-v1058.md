# v1058 (23/11/2026) — dispensar só o artigo (não o item inteiro)

- **O que sumiu do VGR (26115015)**: a calça (CL.01.001.0057) foi para o PIC 0015 normalmente (UNILEVE 322 m, elástico 184 m, faixa 5 cm 299 m, tactel 299 m). A camiseta (CM.02.002.0030) **foi dispensada** em 23/11 às 14:13 pelo "D" (usuário IGOR COSTA, sem motivo) e, com ela, saíram de compras os 4 materiais (2208 HENRY, PV ANTIPILLING, faixa e tactel 552 m).
- **Causa da armadilha**: o "D" ao lado de um artigo (Levantamento consolidado, PIC, OC) dispensava o **item do pedido inteiro**, com todos os materiais dele, e não só aquele artigo.
- **Correção**: nesses lugares o "D" pergunta **Só [artigo]** (padrão) ou **O item inteiro**.
  - Só o artigo: a linha da demanda fica marcada `dispensado` (com quem, quando e motivo), sai da necessidade, do levantamento, do PIC/cotação/OC aberta; os outros materiais do item seguem em compras. Se não sobrar material, o item sai inteiro (como antes).
  - A marca sobrevive quando a demanda é refeita pela FPP (`herdaDem`).
- `lib/compras.js`: `dispensarArtigoDoItem`, `necessidade` ignora artigo dispensado; `api/compras/pedidos` POST com `artigoId`.
