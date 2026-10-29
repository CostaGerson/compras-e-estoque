# v555 — Casamento NF de venda ↔ pedido (movimento fiscal e Produção)

- `lib/faturamentoCasamento.js`: candidatos (mesmo CNPJ/empresa, nome, O.C., valor do saldo), NFs livres para o pedido, `casarNf`, `descasarNf`, financeiro do pedido.
- **Regra de peças**: peças da NF ≤ peças **concluídas na expedição (PCP)** − já faturadas. Peça em andamento não é faturada (bloqueia com motivo). NF sem XML ou pedido fora do PCP: casa com aviso.
- Casar grava a NF em `nfsFaturadas` (valor, peças, quem casou), atualiza saldo (valor e peças), fatura quando completa (FATURADO com contas lançadas; senão "NF sem contas") e marca `FiscalNota.pedidoNumero`. NF só atende um pedido.
- **Movimento fiscal**: na conferência da NF de venda, bloco "Pedido que esta NF atende" com os candidatos (peças concluídas/livres, valor e O.C. conferem) + **Não casar agora**. Sem escolha, seguem as regras automáticas. "Incluir faturamento" do pedido já vem com o pedido escolhido. Na lista, NF de saída mostra "Pedido X" ou botão **Casar com pedido**.
- **Produção**: ícone de corrente em cada pedido abre as NFs de venda do cliente sem pedido para casar. Crítica nova: "N peça(s) concluída(s) na expedição sem NF casada" (segue enquanto não casar).
- **Aba Financeiro do pedido**: faturado, a entregar (valor e peças), peças do pedido × concluídas × faturadas, contas a receber das NFs (lançado, recebido, em aberto, cada parcela com vencimento/status/antecipado), Casar NF e descasar.
