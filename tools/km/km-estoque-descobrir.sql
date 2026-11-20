-- v1033 — descobrir como o KM (MentorSoft) guarda o ESTOQUE e o que ele usa para o SPED (Bloco K: K200 estoque escriturado,
-- K230/K235 produção e consumo; Bloco H: inventário). SÓ LEITURA. (sem xpath: o KM tem texto LATIN1 que quebra o parser de XML)
-- Objetivo: entender por que o estoque do KM deixa itens EM PROCESSO de fora e montar o K200 certo no ERP.
-- Gera texto: tabelas candidatas, colunas, nº de linhas e amostra; views com a definição; funções com nome de SPED/bloco.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
\pset format unaligned
\pset tuples_only on

WITH tabs AS (
  SELECT t.table_schema s, t.table_name n, t.table_type = 'VIEW' v
    FROM information_schema.tables t
   WHERE t.table_type IN ('BASE TABLE', 'VIEW') AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
     AND has_table_privilege(format('%I.%I', t.table_schema, t.table_name), 'SELECT')
     AND (t.table_name ~* '(estoq|esto|sald|sld|invent|movest|movim|kardex|almox|deposit|lote|sped|bloco|blk|k200|k230|k235|k250|k280|h010|h005|regk|regh|efd|requis|consum|empenh|ordprod|ordem|indpcp|apont|produca|fichatec|estrut|compos|insumo|matpri|tipoite|tpitem)'
          OR EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name
                      AND c.column_name ~* '(estoq|saldo|qtdest|tipoitem|tpitem|tipo_item|inventar|emprocess|em_process|elabora)'))
)
SELECT E'\n### ' || s || '.' || n || CASE WHEN v THEN '  (VIEW)' || E'\n' || (SELECT string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
                      FROM information_schema.columns c WHERE c.table_schema = tabs.s AND c.table_name = tabs.n)
       || E'\n' || coalesce(pg_get_viewdef(format('%I.%I', s, n)::regclass, true), '') ELSE
       '  (' || coalesce(substring(query_to_xml(format('select count(*) c from %I.%I', s, n), false, true, '')::text from '<c>([0-9]+)</c>'), '?') || ' linhas)'
       || E'\n' || (SELECT string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position)
                      FROM information_schema.columns c WHERE c.table_schema = tabs.s AND c.table_name = tabs.n)
       || E'\n' || coalesce(query_to_xml(format('select * from %I.%I limit 6', s, n), true, false, '')::text, '') END
  FROM tabs ORDER BY s, n;

-- funções / procedures com nome de SPED, bloco, estoque ou inventário (só o nome e os argumentos; o corpo pode ser grande)
SELECT E'\n### FUNÇÕES\n' || coalesce(string_agg(n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', E'\n' ORDER BY p.proname), '(nenhuma)')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND p.proname ~* '(sped|bloco|blk|k200|k230|h010|estoq|invent|saldo|kardex|efd)';

-- colunas de "tipo do item" no cadastro de produtos (00 mercadoria · 01 MP · 02 embalagem · 03 em processo · 04 acabado …)
SELECT E'\n### colunas de tipo/estoque em solprodu\n' || coalesce(string_agg(column_name || ':' || data_type, ', ' ORDER BY ordinal_position), '(solprodu não encontrada)')
  FROM information_schema.columns WHERE table_name = 'solprodu' AND column_name ~* '(tip|estoq|sped|gener|class|unid|ncm|grupo|famil|categ)';
