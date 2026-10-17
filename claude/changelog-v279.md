# v279 — Análise da logística (DRE)

- Nova tela **Produção › Análises operacionais › Logística** (`app/analiseLogistica.jsx`, `lib/opLogistica.js`, GET `/api/producao/analises?setor=LOGISTICA`).
- Custo do mês = pessoal de logística (custo total pela Matriz, depto LOG) + contas da DRE: combustível 2111100, manutenção de viaturas 2116200,
  Fretebras 2111320, Uber 2111400, Lalamove 2111310, despesas de viagem 2111340, pedágio 2111330, frete compra 2111210, freelancer de logística 2117600.
- **Frete entrega (2111220)**: só informativo, fora do custo (a FPP cobra frete por volume). Contas antigas 2111200/2111300 e correio 2111500 também só informativas.
- Peças = análise da expedição (as mesmas do KPI desde a v278).
- Base: últimos 3 meses encerrados, **100% identificados** (nenhum lançamento do extrato sem conta) e com peças; média ponderada (custo ÷ peças).
- Conferência com a planilha do Igor (jun/2025–jun/2026, `lib/logisticaPlanilha.js`): valor da planilha abaixo de cada célula, divergência > R$ 1 em vermelho, e lista de divergências por mês.
- Integrações: card Logística nas Análises; contribuição bruta total = produção + logística; líquida = produção × (1 − % free) + logística;
  Matriz "Razão custo logístico / peça" automática (checkbox "da Logística"); FPP `LOGISTICA_BASE` (malha e plano) = custo por peça, com histórico.
- Planilha original: a fórmula de CUSTO LOGÍSTICO TOTAL (`SUM(B:L)/L`) soma as peças junto com os custos; a INTERNA deixa de fora combustível e frete compra.
