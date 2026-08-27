import pg from "pg";

// Pool único para o banco do CRM (crm_meridian). Reutiliza entre requisições.
let pool;
export function crmPool() {
  if (!process.env.CRM_DATABASE_URL) return null;
  if (!pool) pool = new pg.Pool({ connectionString: process.env.CRM_DATABASE_URL, max: 3 });
  return pool;
}
