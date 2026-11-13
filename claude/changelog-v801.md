# v801 — Movimento fiscal pelos cards; sugestões #71 e #72

- **Movimento fiscal**: saíram os botões Todas/Entradas/Saídas. Clicar num card (NFs de entrada, NFs de saída, Contas geradas, Só registradas) filtra a lista; clicar de novo mostra todas. A **setinha** do card escolhe um tipo dentro do grupo (compra, devolução, retorno de remessa, remessa, industrialização, serviço, frete CT-e, venda…; nas contas: a pagar / a receber), com a contagem. Um chip ao lado das datas mostra o filtro e limpa no X. O tipo vem da natureza da operação (`subtipoNf` em `app/adm.jsx`).
- **#71 (Leandro)**: o campo ESTAMPA dos parâmetros de produção virou caixa de texto de 5 linhas (uma por aplicação). Na OP impressa, a estampa sai com no mínimo 5 linhas.
- **#72 (Leandro)**: ao escolher um item do KM, os parâmetros casam com os campos do tipo de peça pelo nome normalizado (sem acento, sem "da/de/do", plural): "COR DA GOLA" vai para "COR GOLA" e não cria outro campo. Nomes repetidos juntam o texto. A descrição do KM chega limpa (espaços e separadores repetidos).

# v802 — FPP em maiúsculas
- Todos os campos editáveis da FPP aparecem em MAIÚSCULAS (campos, listas, selects; o placeholder continua normal).
- O que é digitado já é gravado em maiúsculas: nome comercial e demais textos, cliente, negociação, artigo e listas. Quando o texto digitado é uma opção cadastrada (sem diferenciar maiúsculas), o sistema usa a opção, para não perder o vínculo com o banco de dados.

# v803 — gramatura no detalhe do artigo da FPP
- Janela do artigo (malha e tecido plano): campo **Gramatura (g/m²)** depois da largura. Aparece no resumo do artigo e vai para o cadastro de Artigos (`gramatura`) ao salvar a FPP.
