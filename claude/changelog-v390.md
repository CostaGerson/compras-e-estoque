# v390 — Concluídos no PCP × NF emitida no KM

- Agente do KM: antes de consultar, pega na VPS os pedidos **em andamento** aqui (`GET /api/km/sync?abertos=1`) e consulta esses no KM
  mesmo fora do filtro (saldo/45 dias/alterados) — pega pedido faturado há tempo que continuava aberto aqui.
- Pedido em andamento vira **FATURADO** quando o KM marca F / saldo zerado **ou** as NFs de saída do pedido no KM (`livsaida`) somam ≥ 98% do total;
  grava o nº das NFs e a data da última. Hash com prefixo `v390` → todos os pedidos são reavaliados uma vez.
- Lista: selo "NF KM nnn" no pedido em andamento que já tem NF parcial; avisos separados "concluído(s) no PCP sem NF no KM — faturar"
  e "concluído(s) no PCP com NF parcial no KM — conferir o saldo".
