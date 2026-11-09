# v699 — Portal do cliente (Loja Way) e dados unitários

## Portal do cliente
- Setor novo **CLIENTE (PORTAL)** + `Usuario.portalClienteId`. Usuário criado no seed: **lojaway / lojaway123**, vinculado ao cliente cujo nome tem "LOJA WAY" (se não achar, vincular em Usuários › setor Cliente › "Cliente do portal").
- O usuário do portal entra direto numa tela própria (`app/portalCliente.jsx`): **Novo pedido** (só os itens padrão do cliente → grade → artes → dado unitário) e **Meus pedidos** (só os do cliente, sem valores).
- Ao enviar (com confirmação), vira **rascunho** no Lançar pedido com o cliente, itens do padrão (preço, FPP, parâmetros, foto, layout/medidas) e as artes; marcado "PORTAL DO CLIENTE" na lista. Comercial, master e diretoria recebem mensagem. O comercial completa prazo/pagamento e efetiva.
- APIs: `/api/portal` (itens, pedidos, envio), `/api/portal/item`. Pedido guarda `Pp.portalClienteId`.

## Dados unitários (todo pedido)
- Chave **Dado unitário** em cada item (lançamento interno e portal): locais (frente: peito esq./dir./central, central, barra esq./dir./central · costas: superior esq./dir./central, central, barra esq./dir./central) + o que vai em cada um (NOME, TIPO SANGUÍNEO…).
- Lista peça a peça: digitar, **clonar a última**, **replicar** o valor da 1ª peça para todas, **replicar os locais para os outros itens**.
- **Colar lista** (WhatsApp/planilha): lê "1- (P) Mirela O+", "39- G Leandro A+", "(GG) - Reis Jesus O+", "sem nome"… → **prévia para confirmar** antes de lançar; a grade passa a seguir a contagem. Lista do exemplo: 39 peças, P 5 · M 16 · G 16 · GG 2, sem erro.
- Efetivar barra se a lista não bater com a grade. A OP impressa traz a tabela de dados unitários por peça.
- Guardado em `PpItem.dadosUnitarios`. Leitura em `lib/dadosUnitarios.js` (pura, testável).

## Link para o cliente final preencher
- No item: **Gerar link para o cliente** (vendedor ou portal) → `/dados/<token>`, sem login. Cada pessoa escolhe o tamanho e preenche os dados; pode adicionar outra peça (copiando a anterior ou em branco); confirma antes de enviar.
- **Respostas / fechar preenchimento**: mostra as peças previstas por tamanho; ao fechar, "Trazer para a lista do item" (com a mesma prévia de confirmação).
- Modelos `DadoUnitarioLink` e `DadoUnitarioResposta`; APIs `/api/dados-link` e `/api/dados-link/[token]`.
