# v1081 (24/11/2026) — Financeiro da Loja Way (portal do cliente)

Guia **Financeiro** no portal (a Way vê no portal dela; a Meridian entra por Gestão › S › Portal Loja Way). Cópia simplificada do financeiro da Meridian, com dados separados por cliente do portal.

- **Contas a pagar / a receber** (`PortalFinTitulo`): mês a mês, cards (em aberto, vencido, vence hoje, pago), filtros, busca; nova conta com parcelas mensais (valor total dividido), "já foi paga", baixa com data e valor, estorno, edição e exclusão.
- **Contas a pagar à Meridian automáticas**: espelho das contas a receber da Meridian dos pedidos da Way (`FinTitulo RECEBER` com `PED|<nº>|…`, ou CNPJ/nome do cliente). Valor, vencimento e baixa vêm da Meridian; aparecem com cadeado ("automática") e entram no CMV (conta 3.01).
- **Conta a receber ligada ao pedido do portal**: escolhe o pedido e preenche cliente final e valor vendido (desconta o que já foi lançado).
- **Análise mensal**: DRE simplificada por mês (receita, deduções, receita líquida, CMV, margem bruta, despesas, EBITDA, impostos, financeiro, lucro, investimentos, resultado de caixa, com % da receita), regime **Realizado** (data do pagamento) ou **Previsto** (realizado + em aberto pelo vencimento), caixa do mês e acumulado.
- **Plano de contas** (`PortalFinConta`) criado sozinho no primeiro acesso, editável (adicionar, renomear, desativar).
- Arquivos: `lib/portalFin.js`, `app/api/portal/fin/route.js`, `app/portalFinanceiro.jsx`; guia em `portalCliente.jsx`; texto do card em `sistemas.jsx`.
- Depois: upload de extratos e documentos úteis.
