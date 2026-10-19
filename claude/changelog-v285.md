# v285 — Retorno à operação e valor cobrado na FPP em cada setor

Na tela de cada setor (corte, silk, bordado, costura, expedição), junto dos indicadores, dois cards em destaque:
- **Retorno à operação / peça** — o mesmo número do card do setor nas Análises (média dos últimos 3 meses com registro), com o líquido (− % freelancers oficial). Silk e bordado mostram o valor da personalização.
- **Valor cobrado na FPP** — a mesma janela dos parâmetros da FPP (`janelaFpp`): corte, expedição e costura = média por peça ponderada pelas quantidades, com os principais tipos de peça; silk = R$ por cor; bordado ainda não alimenta a FPP.
- API: `GET /api/producao/analises?acao=retornoFpp` (`fppPorSetor` em `lib/fppAnalises.js`).
