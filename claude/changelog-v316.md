# v316 — Pedidos em andamento (PV + PP) e previsão de receitas

**Onde:** Financeiro › card **Pedidos em andamento** (só gerencial).

- **Upload** de vários PDFs do KM Sistemas de uma vez (botão ou arrastar). O tipo é reconhecido pelo texto:
  - **PV** (pedido de venda): nº, cliente, CNPJ, emissão, DT despacho, condição de pagamento, vendedor, OC, frete, itens com grade, preço e total.
  - **PP** (ordem de produção, uma página por item): OP, descrição e parâmetros de produção (modelagem, tecido, gola, personalização…).
  - Os dois se juntam pelo **nº do pedido**; os itens casam pelo código do produto.
- **Condição de pagamento** → entrada + prazos após a NF (`lerCondicao`): "30 DIAS", "30/60/90", "A VISTA", "ENTRADA 50% + 30 DIAS", "ENTRADA/30/60" (partes iguais). A condição e o valor da entrada podem ser editados no pedido.
- **Entrada:** o botão "Lançar entrada no contas a receber" cria o título `PEDIDO N - ENTRADA` (chave `PED|N|ENTRADA`, conta 1111000).
  - Com a entrada lançada, ela sai da previsão, porque já conta no a receber.
  - Enquanto não for lançada, entra na previsão com data de hoje.
- **Parcelas:** restante (total − entrada) ÷ prazos, contados da entrega.
  - A entrega é a programação do Cronograma (campo `entregaPrevista`, ainda vazio) ou, na falta dela, a DT despacho do PV.
  - Despacho vencido: as parcelas contam a partir de hoje e o pedido aparece em vermelho.
- **Painel:** em andamento (R$, pedidos, peças), a receber no mês selecionado, fora do mês, entradas lançadas e a lançar, previsão por mês, e avisos (despacho vencido, condição não reconhecida, só PP, NF que parece o faturamento).
- **Faturamento:** a NF de saída do mesmo CNPJ, emitida depois do pedido e com valor ±2% do total ou do restante, é sugerida.
  - Marcar como faturado tira o pedido da previsão; a partir daí valem as contas da NF.
  - Também é possível marcar como cancelado ou voltar para andamento.

**Arquivos:**
- Leitura dos PDFs: `lib/pedidosLer.js`.
- Previsão e painel: `lib/pedidos.js`.
- Rota: `api/fin/pedidos` (GET painel e PDF, POST upload e entrada, PUT, DELETE).
- Tela: `app/pedidosAndamento.jsx`.
- Modelo: `PedidoVenda`.

**Próximo:** leitura da programação do Cronograma (Maycon) por nº do pedido, preenchendo `entregaPrevista`, `cronoSituacao` e `cronoEtapa`. Depois, ligar o resultado aos campos do Painel de previsão (pedidos em andamento, a entregar e recebimento do mês).
