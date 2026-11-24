# v1085 (24/11/2026) — DTF e sublimação → sistema de produção da NORT (Gerson) + status no PCP

- Novo `PersonalizacaoDemanda`: uma por item de pedido efetivado × método (DTF, SUBLIMACAO), de qualquer canal (Meridian, NORT, loja física, Way).
  Detecção: aplicações do item > texto "PERSONALIZAÇÃO" > personalizações da FPP. Gerada ao efetivar e a cada leitura; pedido alterado → `versao` +1; pedido cancelado ou item sem DTF/sublimação → `CANCELADA`.
- API para o sistema da NORT (mesmo `X-Api-Key` de `/api/ext/nort/*`):
  - `GET /api/ext/personalizacao?desde=&status=&pedido=&metodo=` — demandas com item, grade, aplicações (cm), dados por peça, cliente final, entrega e artes.
  - `GET /api/ext/personalizacao/arquivo?demanda=&arte=` — arquivo da arte.
  - `POST /api/ext/personalizacao/status` — devolutiva: RECEBIDA, EM_PRODUCAO, PRONTA, ENTREGUE, PROBLEMA (avisa gestão e PCP); aceita lote.
- PCP: `GET /api/ext/compras` traz `personalizacao: [{ metodo, etapa, sistema: "NORT", status, statusEm, obs }]` no item (campo a mais, nada muda no PCP).
- Frente de caixa: as estampas viram aplicações do item (método, local, largura × altura).
- Documento para o sistema do Gerson: `claude/integracao-dtf-sublimacao.md`.
