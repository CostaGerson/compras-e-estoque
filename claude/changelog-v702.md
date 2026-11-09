# v702 — Link de dados unitários mais claro, prazo do link, lead time e fim do roxo

- **Link do cliente** (`/dados/<token>`): "Quem está pedindo?" deixa claro que o nome **não vai na camisa**; cada peça tem o bloco **"O que vai escrito na peça"** (nome, tipo sanguíneo… com o local). A confirmação mostra o que sai em cada peça.
- **Prévia no WhatsApp**: título "Escolha os detalhes da sua camisa", site "Meridian" (`app/dados/layout.jsx`).
- **Dia e horário limite** obrigatórios ao gerar o link (`DadoUnitarioLink.limite`); depois disso o link não aceita respostas. Dá para mudar o prazo (e reabrir) em "respostas / fechar preenchimento".
- **Lista colada**: tabela compacta (nº e tamanho estreitos), dados maiores e em negrito. Aviso quando a lista tem tipo sanguíneo e só existe o dado NOME.
- **Lead time**: ao inserir o item (portal e lançamento), mostra a entrega prevista pelo lead time da FPP; o prazo do pedido vem preenchido com o maior lead time (dias corridos) se estiver vazio.
- **Paleta**: o roxo (`#7A5AF8`/`#7C3AED`) saiu do sistema inteiro; o status "especial" passou a azul-aço Meridian `#3D6799` / `#EEF3FB`.
