# v486 — Rota de coleta visível, XML/PDF da NF na OC e painel de compras

- **Rota de coleta**: a demanda de rota criada pela OC guarda `RotaDemanda.ocId`. OC e cotação (com OC) mostram o chip da rota: data, situação (a montar / na rota / em execução / coletada) e R nº; coleta sem rota aparece em vermelho. O botão "Criar rota de coleta" some quando já existe rota.
- **Arquivos da NF na OC** (`OcArquivo`): anexar XML e PDF (botão ou arrastar). O XML preenche sozinho o nº e a emissão da NF (se ainda vazios) e a OC vai para "NF emitida".
- **Painel "Demandas de compra"** na entrada de Compras: todos os itens de PIC por etapa — Em cotação › Aguardando NF › Em coleta › Em entrega transportadora › Entrega do fornecedor › Recebida — com contador em cada etapa (clicar filtra), busca, fornecedor, PIC/OC/NF, situação das cotações, rota de coleta e previsão (transportadora = emissão da NF + dias). `GET /api/compras/demandas` (`painelDemandas` em `lib/pic.js`).
