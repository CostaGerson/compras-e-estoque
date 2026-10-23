-- v390/v408 — pedidos (e NFs de saída) do KM para o Compras & Estoque. SÓ LEITURA (usuário de consulta mentorbi).
-- Sem as views pedido_mestre / pedido_item_detalhe (chamam prc_valor_pedido, que lê recpedid — sem permissão).
-- Entram: pedidos com saldo a entregar, dos últimos 45 dias ou alterados nos últimos 3 dias.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT json_build_object('geradoEm', now(), 'pedidos', coalesce(json_agg(x), '[]'::json),
  'nfsDesde', current_date - 60,
  'nfs', (SELECT coalesce(json_agg(json_build_object('numero', ls.nnumeronfsai::text, 'emissao', ls.demissenfsai, 'valor', ls.nnvalornfsai,
              'pedido', pn.ncodigopedid::text, 'cliente', coalesce(cn.cnomeclien, sn.cnomecliente, pn.cliente),
              'cnpj', coalesce(nullif(trim(cn.ccnpjclien),''), nullif(trim(cn.ccpfclien),''))) ORDER BY ls.demissenfsai), '[]'::json)
          FROM livsaida ls
          LEFT JOIN pedidos pn ON pn.nnumeropedid = ls.nnumeropedid
          LEFT JOIN solpedid sn ON sn.nnumeropedid = ls.nnumeropedid
          LEFT JOIN solclien cn ON cn.nnumeroclien = coalesce(sn.nnumeroclien, pn.nnumeroclien)
          WHERE ls.demissenfsai >= current_date - 60 AND coalesce(ls.cnfcancnfsai,'N') <> 'S'))
FROM (
  SELECT
    pe.ncodigopedid::text                  AS numero,
    pe.nnumeropedid                        AS id,
    sp.ddatapedid                          AS emissao,
    coalesce(sp.ddataentrega, pe.ddataentrega) AS entrega,
    coalesce(cl.cnomeclien, sp.cnomecliente, pe.cliente) AS cliente,
    cl.cnfantaclien                        AS fantasia,
    trim(cl.ccodigoclien)                  AS cliente_codigo,
    coalesce(nullif(trim(cl.ccnpjclien),''), nullif(trim(cl.ccpfclien),'')) AS cnpj,
    trim(pe.cd_pgto)                       AS condicao,
    trim(pe.tppedido)                      AS tipo,
    (SELECT r.nome FROM v_dash_representantes r WHERE r.id = sp.nnumerorepre LIMIT 1) AS representante,
    trim(sp.cpedclipedid)                  AS oc,
    pe.vlr_pedido                          AS valor_pedido,
    sp.nvalorpedid                         AS valor_solpedid,
    sp.nfretepedid                         AS frete,
    trim(sp.ctpfretpedid)                  AS frete_tipo,
    sp.cobservpedid                        AS obs,
    pe.quant_total                         AS total_pecas,
    pe.quant_saldo                         AS itens_a_entregar,
    (SELECT round(sum(greatest(coalesce(si.nquatdeitped,0) - coalesce(si.nqtdentitped,0), 0) * coalesce(si.nprecoitped,0)
                      * (1 - coalesce(si.npctdesitped,0) / 100.0)), 2)
       FROM solitped si WHERE si.nnumeropedid = pe.nnumeropedid) AS valor_a_entregar,
    coalesce(sp.ddatafatura, (SELECT max(ls.demissenfsai) FROM livsaida ls WHERE ls.nnumeropedid = pe.nnumeropedid AND coalesce(ls.cnfcancnfsai,'N') <> 'S')) AS ult_faturamento,
    trim(sp.cstatuspedid)                  AS status_km,
    sp.dalterapedid                        AS alterado,
    false                                  AS excluido,
    (SELECT json_agg(json_build_object('numero', ls.nnumeronfsai::text, 'emissao', ls.demissenfsai, 'valor', ls.nnvalornfsai) ORDER BY ls.demissenfsai)
       FROM livsaida ls WHERE ls.nnumeropedid = pe.nnumeropedid AND coalesce(ls.cnfcancnfsai,'N') <> 'S') AS nfs,
    (SELECT coalesce(json_agg(json_build_object(
        'id', si.nnumeroitped, 'produto', si.nnumeroprodu, 'codigo', trim(pr.ccodigoprodu),
        'nome', pr.cnomeprodu, 'descricao', si.cdescomitped,
        'qtd', si.nquatdeitped, 'entregue', si.nqtdentitped,
        'preco', round(coalesce(si.nprecoitped,0) * (1 - coalesce(si.npctdesitped,0) / 100.0), 4), 'precoTabela', si.nprecoitped,
        'valor', round(coalesce(si.nquatdeitped,0) * coalesce(si.nprecoitped,0) * (1 - coalesce(si.npctdesitped,0) / 100.0), 2),
        'detalhe', convert_from(si.cdetalhitped, 'LATIN1'),
        'grade', (SELECT json_agg(json_build_object('tam', trim(g.descricao_grade), 'qtd', g.qtde_pedida_grade, 'entregue', g.qtde_entregue_grade))
                  FROM pedido_item_grade g WHERE g.pk_item_pedido = si.nnumeroitped),
        'ops', (SELECT json_agg(json_build_object(
                  'op', o.nnumeropcpip, 'qtd', o.nquatdepcpip, 'producao', o.dproducpcpip, 'programacao', o.dprograpcpip, 'obs', o.cobservpcpip,
                  'setores', (SELECT json_agg(json_build_object('setor', s.cdescrisetin, 'seq', st.nsequenpcpst, 'previsao', st.dprevispcpst,
                                'entrada', st.dentradpcpst, 'envio', st.denviopcpst, 'finalizado', st.cfinalipcpst) ORDER BY st.nsequenpcpst)
                              FROM indpcpst st LEFT JOIN indsetin s ON s.nnumerosetin = st.nnumerosetin WHERE st.nnumeropcpip = o.nnumeropcpip)
                ) ORDER BY o.nnumeropcpip) FROM indpcpip o WHERE o.nnumeroitped = si.nnumeroitped)
      ) ORDER BY si.nnumeroitped), '[]'::json)
     FROM solitped si LEFT JOIN solprodu pr ON pr.nnumeroprodu = si.nnumeroprodu
     WHERE si.nnumeropedid = pe.nnumeropedid) AS itens
  FROM pedidos pe
  LEFT JOIN solpedid sp ON sp.nnumeropedid = pe.nnumeropedid
  LEFT JOIN solclien cl ON cl.nnumeroclien = coalesce(sp.nnumeroclien, pe.nnumeroclien)
  WHERE pe.quant_saldo > 0
     OR pe.ddatapedid >= now() - interval '45 days'
     OR sp.dalterapedid >= now() - interval '3 days'
     OR pe.ncodigopedid::text = ANY(string_to_array(:'abertos', ','))   -- em andamento no Compras & Estoque
) x;
