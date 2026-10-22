-- v386.1 — pedidos do KM para o Compras & Estoque. SÓ LEITURA (usuário de consulta mentorbi).
-- Sem as views pedido_mestre / pedido_item_detalhe (chamam prc_valor_pedido, que lê recpedid — sem permissão).
-- Entram: pedidos com saldo a entregar, dos últimos 45 dias ou alterados nos últimos 3 dias.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT json_build_object('geradoEm', now(), 'pedidos', coalesce(json_agg(x), '[]'::json))
FROM (
  SELECT
    pe.ncodigopedid::text                  AS numero,
    pe.nnumeropedid                        AS id,
    sp.ddatapedid                          AS emissao,
    coalesce(sp.ddataentrega, pe.ddataentrega) AS entrega,
    coalesce(cb.razao_social, sp.cnomecliente, pe.cliente) AS cliente,
    cb.fantasia                            AS fantasia,
    trim(cb.codigo)                        AS cliente_codigo,
    cb.cnpj_cpf                            AS cnpj,
    trim(pe.cd_pgto)                       AS condicao,
    trim(pe.tppedido)                      AS tipo,
    cb.nome_repre                          AS representante,
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
  LEFT JOIN LATERAL (SELECT * FROM v_clientes_bi c WHERE c.id_cliente = pe.nnumeroclien LIMIT 1) cb ON true
  WHERE pe.quant_saldo > 0
     OR pe.ddatapedid >= now() - interval '45 days'
     OR sp.dalterapedid >= now() - interval '3 days'
) x;
