# v391 — Pedido só é FATURADO com as contas da NF lançadas

- Regra (Igor, 22/10/2026): faturado = NF emitida **e** contas a receber lançadas. Vale para todos os caminhos automáticos:
  KM (status F / NFs do KM cobrindo o pedido), NFs da contabilidade pelos itens (v372) e pelo valor (v347). O relatório de Posição de Vendas
  com saldo zerado deixou de faturar sozinho. Mudança manual de status continua livre.
- `contasLancadas(nfs, cnpj)`: movimento fiscal de SAÍDA LANÇADA com parcelas ligadas a títulos, ou título a receber não cancelado com o nº da NF no documento (mesmo CNPJ).
- Sem contas → o pedido fica **em andamento** com `faturamentoPendente` (NF, data, origem); o saldo e a previsão continuam como estavam.
  `efetivarFaturamentos()` (a cada listagem e a cada sincronização do KM) vira FATURADO quando as contas aparecem.
- Revisão única (`KM_REVISAO_V391`): o que a integração marcou FATURADO em 22/10 sem contas voltou para em andamento (pendente), saldo = total.
- Tela: selo laranja "NF nnn — lançar contas" e aviso "com NF emitida e contas a receber não lançadas". Log do agente mostra "NF sem contas".
