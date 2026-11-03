-- v630 — descobrir onde o KM (MentorSoft) guarda naturezas de operação, CFOP, NCM e tributação. SÓ LEITURA.
-- Gera texto: tabelas candidatas, colunas, nº de linhas e até 15 linhas de amostra de cada uma.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
\pset format unaligned
\pset tuples_only on
WITH tabs AS (
  SELECT t.table_schema s, t.table_name n
    FROM information_schema.tables t
   WHERE t.table_type = 'BASE TABLE' AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
     AND has_table_privilege(format('%I.%I', t.table_schema, t.table_name), 'SELECT')
     AND (t.table_name ~* '(natu|nop|cfop|ncm|trib|impos|icms|ipi|pis|cofins|iss|fisc|empre|filia|emit|parnf|confnf|serie|cst|csosn|clasf|classi)'
          OR EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
                      AND c.column_name ~* '(cfop|ncm|natop|natur|csosn|cst)'))
)
SELECT E'\n### ' || s || '.' || n
       || '  (' || (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', s, n), false, true, '')))[1]::text || ' linhas)'
       || E'\n' || (SELECT string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
                      FROM information_schema.columns c WHERE c.table_schema = tabs.s AND c.table_name = tabs.n)
       || E'\n' || coalesce((SELECT string_agg(r::text, E'\n')
                               FROM (SELECT (xpath('/table/row', query_to_xml(format('select * from %I.%I limit 15', s, n), true, false, '')))) x(a),
                                    unnest(x.a) r), '')
  FROM tabs ORDER BY s, n;
-- colunas fiscais no cadastro de produtos e no item de pedido
SELECT E'\n### colunas fiscais em solprodu / solitped / solpedid\n' || string_agg(table_name || '.' || column_name || ':' || data_type, E'\n')
  FROM information_schema.columns
 WHERE table_name IN ('solprodu', 'solitped', 'solpedid') AND column_name ~* '(cfop|ncm|natu|trib|icms|ipi|pis|cofins|cst|orig|cest|unid|gtin|ean|class)';
