# v515 — Anexos na compra avulsa (sugestão #20 · Leandro)

- Janela da compra avulsa ganhou **Anexos**: escolher arquivo, arrastar ou colar print (Ctrl+V). Imagens e PDF, até 15 MB cada; miniaturas clicáveis (abre em nova aba) e exclusão.
- Avulsa nova: os anexos ficam pendentes e sobem ao salvar.
- Na lista, avulsas com anexo mostram o clipe com a quantidade (abre a avulsa).
- Modelo novo `CompraAvulsaAnexo` (base64 no Postgres, hash evita duplicado) · API `api/compras/avulsas/[id]/anexos`.
