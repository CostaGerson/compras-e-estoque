-- v1022 — "Monta notas" do KM: NF de saída × pedido (fatitabe = itens montados em cada NF). SÓ LEITURA.
-- Uma NF pode juntar vários pedidos e um pedido pode sair em várias NFs (parcial). Valor = itens do pedido naquela NF.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT coalesce(json_agg(x), '[]'::json) FROM (
  SELECT sp.ncodigopedid::text AS pedido, ls.nnumeronfsai::text AS numero, ls.demissenfsai AS emissao, ls.nnvalornfsai AS "valorNf",
         round(sum(coalesce(fa.nquatiditabe, 0)), 0) AS pecas,
         round(sum(coalesce(fa.nquatiditabe, 0) * coalesce(si.nprecoitped, 0) * (1 - coalesce(si.npctdesitped, 0) / 100.0)) - sum(coalesce(fa.ndesconitabe, 0)), 2) AS valor
    FROM fatitabe fa
    JOIN livsaida ls ON ls.nnumerogrupo = fa.nnumerogrupo AND ls.nnumeroempre = fa.nnumeroempre AND ls.nnumerosaida = fa.nnumerosaida
    JOIN solpedid sp ON sp.nnumeropedid = fa.nnumeropedid
    LEFT JOIN solitped si ON si.nnumeropedid = fa.nnumeropedid AND si.nnumeroitped = fa.nnumeroitped
   WHERE coalesce(ls.cnfcancnfsai, 'N') <> 'S' AND ls.demissenfsai >= current_date - 150
   GROUP BY sp.ncodigopedid, ls.nnumeronfsai, ls.demissenfsai, ls.nnvalornfsai
) x;
