# v405 — Aviamentos na demanda de compras

- FPP: botão **+** em gola, punho, elástico, faixa, botão e em cada custo extra de aviamento (aparece quando há aviamento escolhido). Campos: fornecedor, cor, código, qtd por peça (padrão 1) e observação. Tecidos/malhas também ganharam observação.
- Aviamentos entram sempre em **unidades** (`categoria AVIAMENTO`, `UN`); obs vai para `especificacao` do artigo cadastrado.
- **Botão**: qtd por peça = "Qtde de botões"; compra em **grosa (144)** — o consolidado do levantamento arredonda para cima (ex.: 450 un → 4 grosas).
- Valor unitário estimado do aviamento = custo por peça do parâmetro ÷ qtd por peça.
- "SEM …" (sem faixa, sem punho, sem elástico) não gera demanda.
