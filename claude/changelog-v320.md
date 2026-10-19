# v320 — Pedidos subidos (PV/PP) aparecem no Lançar PP

- `espelharPp(numero)` em `lib/pedidos.js` roda a cada upload de PV/PP, tanto pelo Financeiro quanto pelo Lançar PP.
  - **PP que não existe:** é criado com `origem = "PEDIDOS"`.
    - Cabeçalho: cliente, CNPJ, OC, condição, DT despacho/prazo, tipo, vendedor, obs, valor total.
    - PDFs: `arquivoPedidoPdf` (PV) e `arquivoOpPdf` (PP do KM, campo novo).
    - Itens: tipo de peça pela descrição, código, qtd, preço, total, grade e parâmetros do PP.
  - **PP com origem PEDIDOS:** cabeçalho, PDFs e itens são refeitos a cada upload.
  - **PP já salvo no editor** (origem vazia): só recebe os PDFs e os campos que estiverem em branco.
- **Lançar PP:**
  - botão **Subir PV e PP (KM)**, com arrastar e **Ctrl+V** (rota `POST /api/pp/importar`, permissão de lançar PP);
  - coluna **PDFs** (PV · PP · PC · SOL) que abre o arquivo (`GET /api/pp/[id]?arquivo=`);
  - selo **KM**;
  - anexo 4 "Ordem de produção (KM)" no editor.
- **Sem valores** (`ppParaUsuario`): o PV não é enviado para quem não vê valores, porque tem preços. O PP (ordem de produção) é enviado para todos.
- A lista `GET /api/pp` deixou de trazer o conteúdo dos PDFs; agora traz só se cada um existe.
