# v372 — Pedido faturado total ou parcial pelos itens da NF

- `faturarPelasNfsItens()` (roda ao abrir Pedidos em andamento e ao atualizar o painel): para cada NF de saída de venda com XML no movimento fiscal (inclui as que vieram do ZIP da contabilidade), ainda não usada:
  - candidatos: pedidos em andamento do **mesmo CNPJ** (sem CNPJ, pelo nome), emitidos até a data da NF;
  - casa pelos **códigos dos produtos** (cProd da NF = código do item do PV, ex. CM.02.002.0022) e pela **O.C.** do cliente quando o PV tem ("Pedido de Compra" no infCpl); escolhe o pedido em que os itens da NF cabem no saldo;
  - soma as quantidades de todas as NFs do pedido (`PedidoVenda.nfsFaturadas`): **todas** as quantidades entregues → FATURADO; senão continua em andamento com `vlEntregar`/`qtEntregar` = saldo (a previsão de receita passa a usar só o saldo) e obs "PARCIALMENTE FATURADO".
  - pedido sem códigos de item: regra por valor (±2%).
- A regra antiga (valor ±2%) segue para NFs sem XML, só em pedidos que não foram casados por itens.
- Tela: selo amarelo "PARCIAL · NF x · faltam N pç" no pedido.
- Teste com as NFs 2027–2031 (21/10): 2027→26090010 e 2029→26090011 totais; 2028→26090029 (69/70), 2030→26090036 (60/200), 2031→26080048 (179/180) parciais. (Pedidos simulados a partir do PCP; os itens reais vêm do PV.)
