# v469 — PIC e Ordens de compra

- **Cruzamento com estoque → Gerar PIC**: os itens que o estoque não atende ("compra") viram um PIC (`PIC 0001`…), com os artigos iguais somados (quantidade = a comprar, arredondada à grosa quando há embalagem). Os itens saem do levantamento (status `PIC`, `CompraItem.picId`).
- **Tela PIC** (Compras › PIC): mesma visão por artigo, com campos do comprador — quantidade, **fornecedor** (lista do cadastro) e **valor unitário**; total por linha e por fornecedor. Fornecedor e valor vêm pré-preenchidos do artigo quando existem. Botões Salvar, **Gerar OCs por fornecedor** e Desfazer PIC (antes de qualquer OC).
- **Gerar OCs**: uma `OrdemCompra` por fornecedor (`OC 0001`…), com os itens que têm fornecedor e valor; o resto fica no PIC. O artigo passa a ter o fornecedor e o último preço. Com todos os itens em OC: PIC = `OC`, itens = `OC`, compra avulsa correspondente = COMPRADA.
- **Tela Ordens de compra**: lista por OC (fornecedor, itens, total), condição de faturamento, prazo na fábrica, situação (aberta / enviada / recebida / cancelada) e **Imprimir / PDF**.
- Schema: `Pic.criadoPorNome/obs`, `PicItem.fornecedorId/valorUnitario/info`, `OrdemCompra.picId/obs/criadoPorNome`, `CompraItem.picId`.
- `simularCruzamento()` foi para `lib/compras.js` (usada pela rota do cruzamento e pelo PIC). Código novo em `lib/pic.js`, `api/compras/pic`, `api/compras/oc`.
