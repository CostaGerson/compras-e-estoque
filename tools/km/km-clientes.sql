-- v521 — TODOS os clientes cadastrados no KM (tabela solclien) para o Compras & Estoque. SÓ LEITURA.
-- Vai a linha inteira (só colunas de texto, número, data e booleano, até 300 caracteres): o sistema reconhece as colunas pelo nome.
SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;
SELECT json_build_object('geradoEm', now(), 'clientes', coalesce(json_agg(x.j ORDER BY x.id), '[]'::json))
FROM (
  SELECT cl.nnumeroclien AS id,
         (SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
            FROM jsonb_each(to_jsonb(cl)) e
           WHERE jsonb_typeof(e.value) IN ('string', 'number', 'boolean')
             AND length(e.value::text) <= 300
             AND left(e.value #>> '{}', 2) <> '\x') AS j
    FROM solclien cl
) x;
