-- v595 — cadastro de itens do KM (solprodu) com o último detalhe de produção lançado em pedido (solitped). SÓ LEITURA.
-- Usado no lançamento de pedidos do Compras & Estoque para manter a mesma nomenclatura e os dados de produção.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT json_build_object('geradoEm', now(), 'produtos', coalesce(json_agg(x ORDER BY x.id), '[]'::json))
FROM (
  SELECT pr.nnumeroprodu                     AS id,
         trim(pr.ccodigoprodu)               AS codigo,
         trim(pr.cnomeprodu)                 AS nome,
         u.detalhe, u.preco, coalesce(c.usos, 0) AS usos
    FROM solprodu pr
    LEFT JOIN LATERAL (
      SELECT convert_from(si.cdetalhitped, 'LATIN1') AS detalhe, si.nprecoitped AS preco
        FROM solitped si
       WHERE si.nnumeroprodu = pr.nnumeroprodu AND si.cdetalhitped IS NOT NULL
       ORDER BY si.nnumeroitped DESC LIMIT 1) u ON true
    LEFT JOIN LATERAL (SELECT count(*) AS usos FROM solitped si WHERE si.nnumeroprodu = pr.nnumeroprodu) c ON true
   WHERE nullif(trim(pr.ccodigoprodu), '') IS NOT NULL
) x;
