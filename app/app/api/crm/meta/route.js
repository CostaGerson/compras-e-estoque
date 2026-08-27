import { NextResponse } from "next/server";
import { crmPool } from "../../../../lib/crm";

export const dynamic = "force-dynamic";

// GET: usuários (donos possíveis) e etapas do funil do CRM
export async function GET() {
  const pool = crmPool();
  if (!pool) return NextResponse.json({ error: "CRM_DATABASE_URL não configurado." }, { status: 503 });
  try {
    const users = await pool.query('select id, login, full_name, role from public.users order by full_name');
    let stages = [];
    try {
      const s = await pool.query('select distinct stage from public.deals order by stage');
      stages = s.rows.map((r) => r.stage);
    } catch { /* sem deals ainda */ }
    if (stages.length === 0) stages = ["novo_lead", "envio_apresentacao", "proposta", "reuniao", "fechamento"];
    return NextResponse.json({ users: users.rows, stages });
  } catch (e) {
    return NextResponse.json({ error: "Falha ao consultar o CRM: " + (e?.message || e) }, { status: 500 });
  }
}
