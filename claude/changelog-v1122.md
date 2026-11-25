# v1122 (25/11/2026) — desconto no pedido: justificativa obrigatória e aprovação do financeiro

- Pedido com desconto (no total ou em alguma peça): card **Justificativa do desconto** (obrigatória) no lançamento.
- **Gerar pedido** com desconto → status `AGUARDANDO_APROVACAO` (selo no pedido e na lista de rascunhos) e tarefa urgente **APROVAR DESCONTO · PEDIDO n · cliente** para o financeiro (Igor), com itens, desconto, total, % e justificativa.
- **Aprovar** (na tarefa) → o pedido é efetivado na hora e segue para layout, compras e produção.
- **Reprovar** (motivo obrigatório) → volta para **RASCUNHO** com a crítica em vermelho no topo do pedido (quem reprovou, quando e o motivo). Gerar de novo manda para nova aprovação.
- Aprovação vale para aquele desconto: se o desconto ou os valores mudarem, pede de novo. Pedido já efetivado, interno e da loja (frente de caixa) não passam por isso.
- `lib/descontoAprov.js`, `api/pp/[id]/desconto`, `Pp.descontoObs`, `Pp.descontoAprov`, `Tarefa.descontoPp`.
