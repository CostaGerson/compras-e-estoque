# v512 — FPP: acessório malha, acessório plano e produto revenda

- **Acessório malha / Acessório plano** (novas peças no campo Item): ficha aberta — rendimento/consumo, corte e expedição/acabamento digitados na ficha; todos os aviamentos disponíveis (gola, punho, elástico, faixa, botão), forro opcional e costura com todos os tipos.
- **Produto revenda**: entra só o preço de custo (R$/peça), com descrição e fornecedor; personalização, lead time, logística/embalagem e operação financeira iguais às demais. Sem matéria-prima, aviamentos e produção; não gera demanda de compras de MP. Volta para a operação: só logística base e personalização interna.
- API aceita `tipo = REVENDA`. Impressão da FPP adaptada.
- Arquivos: `lib/fppAv.js` (constantes), `app/comercial.jsx`, `lib/compras.js`, `api/fpp/route.js`, `api/fpp/[id]/route.js`.
