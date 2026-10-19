# v288 — Corte e expedição pelo custo real

Correção do Igor (19/10/2026): o valor de mercado (terceirizado) como "volta para a operação" vale só para costura e personalização.
- Corte e expedição passam a usar o **custo real do setor** (pessoal + freelancers do mês, com os ajustes manuais da análise), média dos últimos 6 meses encerrados:
  - contribuição bruta/líquida nas Análises operacionais (`resumoVolta`, `calcularReal`, `SETORES_CUSTO_REAL`);
  - FPP: corte e expedição/acabamento por tipo de peça = custo real rateado pelo peso de mercado de cada tipo (`valorInterno`), ponderado pelas quantidades;
  - card "Valor cobrado na FPP" dos setores.
- Costura (mercado), silk (R$/cor) e logística (folha) não mudam.
- A chave da janela da FPP ganhou o prefixo `v288|` para reaplicar os parâmetros uma vez (com histórico).
