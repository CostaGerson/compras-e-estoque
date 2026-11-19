-- v1024 — "Monta notas" do KM: NF de saída × pedido. SÓ LEITURA.
-- O usuário de consulta não lê fatitabe (itens montados); as views do KM leem (rodam com o dono):
--   v_notas_pedido          → pedido × nota (NF montada a partir do pedido)
--   v_itens_faturamento_bi  → itens de cada NF (produto, quantidade, valor)
-- Valor do pedido na NF = itens da NF cujo produto está no pedido (limitado ao valor da NF). Uma NF pode juntar vários pedidos.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT coalesce(json_agg(x), '[]'::json) FROM (
  SELECT vp.codigo_pedido::text AS pedido, vp.nota::text AS numero, coalesce(ls.demissenfsai, vp.dataemissao) AS emissao, ls.nnvalornfsai AS "valorNf",
         round(coalesce((SELECT sum(i.quantidade) FROM v_itens_faturamento_bi i WHERE i.id_nota = ls.nnumerosaida
                           AND i.id_produto IN (SELECT si.nnumeroprodu FROM solitped si WHERE si.nnumeropedid = vp.pedido_km_id)), 0), 0) AS pecas,
         round(least(coalesce(ls.nnvalornfsai, 0), coalesce((SELECT sum(coalesce(i.valor_total, 0) - coalesce(i.valor_desconto, 0)) FROM v_itens_faturamento_bi i WHERE i.id_nota = ls.nnumerosaida
                           AND i.id_produto IN (SELECT si.nnumeroprodu FROM solitped si WHERE si.nnumeropedid = vp.pedido_km_id)), 0)), 2) AS valor,
         (SELECT count(DISTINCT v2.codigo_pedido) FROM (SELECT DISTINCT codigo_pedido, nota FROM v_notas_pedido) v2 WHERE v2.nota = vp.nota) AS "pedidosNaNota"
    FROM (SELECT DISTINCT pedido_km_id, codigo_pedido, nota, dataemissao FROM v_notas_pedido WHERE situacao_nf = 'AUTORIZADA' AND dataemissao >= current_date - 150) vp
    JOIN livsaida ls ON ls.nnumeronfsai = vp.nota AND coalesce(ls.cnfcancnfsai, 'N') <> 'S' AND ls.demissenfsai >= current_date - 160
) x;
