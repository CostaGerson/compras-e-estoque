-- v386 — pedidos do KM para o Compras & Estoque. SÓ LEITURA (usuário de consulta mentorbi).
-- Entram: pedidos com saldo a entregar, pedidos dos últimos 45 dias e os alterados nos últimos 3 dias.
-- Saída: um único JSON { "pedidos": [...] } — o servidor descarta o que não mudou.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT json_build_object('geradoEm', now(), 'pedidos', coalesce(json_agg(x), '[]'::json))
FROM (
  SELECT
    pe.ncodigopedid::text            AS numero,
    pe.nnumeropedid                  AS id,
    pm.data_pedido                   AS emissao,
    coalesce(pm.data_entrega, pe.ddataentrega) AS entrega,
    coalesce(cb.razao_social, pm.cliente, pe.cliente) AS cliente,
    cb.fantasia                      AS fantasia,
    trim(cb.codigo)                  AS cliente_codigo,
    coalesce(pm.cnpj_cpf_cliente, cb.cnpj_cpf) AS cnpj,
    coalesce(pm.condicao, pe.cd_pgto) AS condicao,
    trim(pe.tppedido)                AS tipo,
    pm.representante                 AS representante,
    trim(pm.oc_cliente)              AS oc,
    pm.valor_pedido, pm.vlr_com_desconto, pm.vlr_financeiro,
    coalesce(pm.total_pecas, pe.quant_total) AS total_pecas,
    pm.itens_a_entregar, pm.valor_a_entregar, pm.ult_faturamento,
    pm.fase_pedido                   AS fase,
    pm.situacao                      AS situacao,
    pe.cstatuspedid                  AS status_km,
    coalesce((SELECT bool_or(d.excluido) FROM v_dash_pedidos d WHERE d.id = pe.nnumeropedid AND d.codigo = pe.ncodigopedid), false) AS excluido,
    (SELECT coalesce(json_agg(json_build_object(
        'id', it.pk_item_pedido, 'produto', it.pk_produto, 'codigo', trim(it.codigo_produto),
        'nome', it.nome_produto, 'descricao', it.descricao_comercial,
        'qtd', it.qtde_pedida, 'entregue', it.qtde_entregue,
        'preco', it.preco_unitario_com_desconto, 'precoTabela', it.preco_unitario, 'valor', it.valor,
        'detalhe', (SELECT convert_from(si.cdetalhitped, 'LATIN1') FROM solitped si WHERE si.nnumeroitped = it.pk_item_pedido),
        'grade', (SELECT json_agg(json_build_object('tam', trim(g.descricao_grade), 'qtd', g.qtde_pedida_grade, 'entregue', g.qtde_entregue_grade))
                  FROM pedido_item_grade g WHERE g.pk_item_pedido = it.pk_item_pedido),
        'ops', (SELECT json_agg(json_build_object(
                  'op', o.nnumeropcpip, 'qtd', o.nquatdepcpip, 'producao', o.dproducpcpip, 'programacao', o.dprograpcpip, 'obs', o.cobservpcpip,
                  'setores', (SELECT json_agg(json_build_object('setor', s.cdescrisetin, 'seq', st.nsequenpcpst, 'previsao', st.dprevispcpst,
                                'entrada', st.dentradpcpst, 'envio', st.denviopcpst, 'finalizado', st.cfinalipcpst) ORDER BY st.nsequenpcpst)
                              FROM indpcpst st LEFT JOIN indsetin s ON s.nnumerosetin = st.nnumerosetin WHERE st.nnumeropcpip = o.nnumeropcpip)
                ) ORDER BY o.nnumeropcpip) FROM indpcpip o WHERE o.nnumeroitped = it.pk_item_pedido)
      ) ORDER BY it.pk_item_pedido), '[]'::json)
     FROM pedido_item_detalhe it WHERE it.pk_pedido = pe.nnumeropedid) AS itens
  FROM pedidos pe
  LEFT JOIN pedido_mestre pm ON pm.pk_pedido = pe.nnumeropedid
  LEFT JOIN LATERAL (SELECT * FROM v_clientes_bi c WHERE c.id_cliente = pe.nnumeroclien LIMIT 1) cb ON true
  WHERE pe.quant_saldo > 0
     OR pe.ddatapedid >= now() - interval '45 days'
     OR EXISTS (SELECT 1 FROM v_dash_pedidos d WHERE d.id = pe.nnumeropedid AND d.data_alteracao >= now() - interval '3 days')
) x;
