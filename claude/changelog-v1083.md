# v1083 (24/11/2026) — Pedido NORT no ERP + Portal NORT

Primeira parte da unificação dos lançamentos pelo ERP.

- **Comercial › card "Pedido NORT"**: abre o lançamento de pedido normal em modo NORT × Meridian.
  - Cliente NORT SPORTS automático, pedido interno; canal **Venda NORT** ou **Loja física** (fica em `Pp.canalVenda`).
  - Até **70 peças** no canal NORT (acima: "venda Meridian, lance como pedido normal"); todo item precisa de **FPP**.
  - Ao gerar o pedido, a Meridian cobra da NORT o **custo da FPP** (acerto NORT já existente, `NORTPED|<nº>`; o `extRef` `NORT|ERP-<id>` liga o acerto).
  - Card **Venda ao cliente final**: cliente final, valor da venda e parcelas (à vista, 2x…; vencimento, valor, forma) → `Pp.vendaFinal`.
- **Gestão › S › Portal NORT** (dentro do ERP, só a guia Financeiro, mesmo financeiro do portal da Way):
  - **A receber**: as parcelas da venda final de cada pedido NORT/loja (`PortalFinTitulo.chave = PED|<nº>|VF|<n>`), geradas ao gerar o pedido e atualizadas ao salvar de novo (a recebida não muda).
  - **A pagar**: espelho das contas da Meridian contra a NORT (`NORTPED|…`) — custo das peças pela FPP.
  - Análise mensal e plano de contas como na Way.
- Arquivos: `lib/pedidoEfetivar.js` (salvarPp/criticas/efetivar), `lib/portalFin.js` (contasVendaFinal, espelho NORT), `app/pedidoEditor.jsx` (modo NORT + `VendaFinalNort`), `app/comercial.jsx`, `app/sistemas.jsx`, `app/page.jsx`, `app/portalCliente.jsx`, `app/api/portal/route.js`.
- Próximo: frente de caixa da loja (catálogo de itens padrão NORT/loja ligados às FPPs) e a integração DTF/sublimação com o sistema do Gerson e o PCP.
