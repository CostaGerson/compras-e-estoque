# v501 — Facções a pagar do Cronograma PCP (Parte 2 do "como ler o cronograma")

Leitura dos pedidos do PCP (Parte 1) **sem mudança**: as 5 regras já estavam implantadas desde a v353.

- **ADM › Facções a pagar (PCP)**: lê `GET /api/ext/faccao/apagar` (só OS `FECHADA`). Lançamento **só pela tela de conferência** (decisão do Igor 26/10/2026).
- Cada OS vira um **item dos terceirizados da semana** (casca da sexta do vencimento), grupo FACÇÃO na **mesma conta-caixa de facção de hoje** (tipo de peça pelo nome do produto, ajustável na tela); serviço SILK/BORDADO/… vai para a conta do serviço. Valor = `valorLiquido`; observação com OS, romaneio, itemCode, refProduto, quantidades, bruto e descontos.
- **Chave = nº da OS** (`FaccaoOsPcp.os` único): ler de novo nunca duplica. Facção casada pelo documento, nome ou nome no KM do cadastro de terceirizados; dá para escolher na tela quando não acha.
- **Análises operacionais não mudam** (continuam pelo extrato), decisão do Igor.
- **Lista de facções para o PCP** (implantação, uma vez): botão CSV na tela e `GET /api/ext/faccoes` (X-Api-Key = token de /api/ext/compras) com id, nome, documento, nome no KM.
- Enquanto o Maycon não publicar o endereço, a tela avisa que ainda não está disponível.
