# v822 — sugestões #72 a #78

- **#78 (Brenda)** — conta recorrente dava "Erro" ao salvar: a recorrência recebia o campo chave PIX, que ela não tem (desde a v698). Agora cria; a chave PIX vai para as contas geradas.
- **#77 (Leandro)** — botão **Duplicar** no título de cada item do pedido: cria a cópia logo abaixo (grade, parâmetros, layout, estampas) para trocar cor, estampa ou valor.
- **#76 (Leandro)** — já atendida na v816 (OP sem os arquivos de personalização).
- **#75 (Leandro)** — OP: o total da grade saiu da sequência dos tamanhos e aparece embaixo ("TOTAL DA GRADE: N pç").
- **#74 (Leandro)** — OP com mais de um item: cada folha mostra "Nº 26115022 / 2-4" no cabeçalho e no título do item.
- **#73 (Maycon)** — lançar outro serviço: sem pedido por padrão (só "Valor do serviço"); marcando **Atribuir a pedido** abrem as linhas por pedido.
- **#72 (Leandro)** — ao escolher o item do KM, o que já estava preenchido (ficha/PP) e o KM não traz continua; o KM só completa ou atualiza (antes apagava, ex.: bolso dianteiro, reforço, personalização). Duplicidade de campos resolvida na v801.

# v823 — Conferir com o banco (contas a receber)
- Botão **Conferir com o banco** no contas a receber: arraste, cole (Ctrl+V) ou escolha o print/PDF da lista de cobranças em aberto do banco.
- A IA (`perguntarIA`, chave ANTHROPIC_API_KEY do servidor) lê pagador, nº do documento, nosso número, vencimento e valor (`lib/finConfBanco.js`, `POST /api/fin/conferir-banco`).
- Casamento: nosso número → NF + parcela ("1893-1/1") → valor + vencimento ±5 dias + nome do pagador. Usa o valor de face e o vencimento do boleto nas antecipadas.
- Resultado em 4 grupos (cards filtram): **Divergem** (valor, vencimento, ou baixada no sistema e aberta no banco) · **Só no banco** · **Só no sistema** (boletos em aberto entre a 1ª e a última data do print) · **Conferem**. Lápis abre a conta (`GET /api/fin/titulos/:id`).
- Contas NORT ficam fora. Não altera nada sozinho.
