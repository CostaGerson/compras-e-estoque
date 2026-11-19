-- v1017 — descobrir onde o KM (MentorSoft) guarda o "Monta notas" (NF de saída ligada a um ou vários pedidos, parcial ou total). SÓ LEITURA.
-- Gera texto: tabelas candidatas (nome ou colunas de nota/pedido), colunas, nº de linhas e amostra;
-- e as linhas que citam o pedido 26070012 (GRABER, concluído e sem NF ligada pelo livsaida).
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
\pset format unaligned
\pset tuples_only on
WITH tabs AS (
  SELECT t.table_schema s, t.table_name n
    FROM information_schema.tables t
   WHERE t.table_type IN ('BASE TABLE', 'VIEW') AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
     AND has_table_privilege(format('%I.%I', t.table_schema, t.table_name), 'SELECT')
     AND (t.table_name ~* '(mont|nfs|nfsai|livsai|itsai|sainf|notas?|nfe|fatur|romane|expedi|carga|embarq)'
          OR (EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name ~* 'pedid')
              AND EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name AND c.column_name ~* '(nfsai|nfs|notaf|nota)')))
)
SELECT E'\n### ' || s || '.' || n
       || '  (' || coalesce((xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', s, n), false, true, '')))[1]::text, '?') || ' linhas)'
       || E'\n' || (SELECT string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
                      FROM information_schema.columns c WHERE c.table_schema = tabs.s AND c.table_name = tabs.n)
       || E'\n' || coalesce((SELECT string_agg(r::text, E'\n')
                               FROM (SELECT (xpath('/table/row', query_to_xml(format('select * from %I.%I limit 8', s, n), true, false, '')))) x(a),
                                    unnest(x.a) r), '')
  FROM tabs ORDER BY s, n;

-- linhas que citam o pedido 26070012 em qualquer tabela com coluna de pedido (pelo id interno e pelo código)
SELECT E'\n### pedido 26070012 = nnumeropedid ' || coalesce((SELECT nnumeropedid::text FROM pedidos WHERE ncodigopedid::text = '26070012' LIMIT 1), '?');
WITH alvo AS (SELECT nnumeropedid id FROM pedidos WHERE ncodigopedid::text = '26070012' LIMIT 1),
cols AS (
  SELECT c.table_schema s, c.table_name n, c.column_name col
    FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
   WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema') AND c.column_name ~* 'pedid' AND c.data_type IN ('integer', 'bigint', 'numeric', 'smallint')
     AND has_table_privilege(format('%I.%I', c.table_schema, c.table_name), 'SELECT')
)
SELECT E'\n--- ' || s || '.' || n || '.' || col || E'\n' || string_agg(r::text, E'\n')
  FROM cols, alvo,
       LATERAL unnest(xpath('/table/row', query_to_xml(format('select * from %I.%I where %I = %s limit 20', s, n, col, alvo.id), true, false, ''))) r
 GROUP BY s, n, col;

-- NFs de saída do cliente GRABER desde julho (para casar com o pedido)
SELECT E'\n### livsaida GRABER desde 01/07/2026\n' || coalesce(string_agg(r::text, E'\n'), '(nenhuma)')
  FROM unnest(xpath('/table/row', query_to_xml($q$
    select ls.* from livsaida ls
     left join pedidos pn on pn.nnumeropedid = ls.nnumeropedid
     left join solclien cn on cn.nnumeroclien = pn.nnumeroclien
     where ls.demissenfsai >= '2026-07-01' and (cn.cnomeclien ilike '%GRABER%' or ls::text ilike '%GRABER%') limit 20 $q$, true, false, ''))) r;
