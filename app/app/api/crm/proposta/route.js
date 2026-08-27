import { NextResponse } from "next/server";
import crypto from "crypto";
import { crmPool } from "../../../../lib/crm";

export const dynamic = "force-dynamic";

// POST: cria (ou reusa) company, cria deal e cria proposal no CRM.
// body: { clienteNome, customerDoc?, ownerId, stage, title, paymentTerms?, deliveryTerms?,
//         notes?, freightCents?, items:[{description, qty, unit_price_cents}] }
export async function POST(req) {
  const pool = crmPool();
  if (!pool) return NextResponse.json({ error: "CRM_DATABASE_URL não configurado." }, { status: 503 });

  const b = await req.json();
  const nome = String(b.clienteNome || "").trim();
  if (!nome) return NextResponse.json({ error: "Informe o cliente." }, { status: 400 });
  if (!b.ownerId) return NextResponse.json({ error: "Informe o dono (owner) da proposta." }, { status: 400 });
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return NextResponse.json({ error: "Nenhum item na proposta." }, { status: 400 });

  const stage = b.stage || "proposta";
  const title = String(b.title || `Proposta ${nome}`).slice(0, 200);
  const itemsNorm = items.map((it) => ({
    qty: Number(it.qty) || 0,
    details: it.details ?? null,
    description: String(it.description || "").slice(0, 300),
    unit_price_cents: Math.round(Number(it.unit_price_cents) || 0),
  }));
  const subtotal = itemsNorm.reduce((s, it) => s + it.qty * it.unit_price_cents, 0);
  const freight = Math.round(Number(b.freightCents) || 0);
  const total = subtotal + freight;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) company: reusa por (brand=meridian, name) ou cria
    const found = await client.query(
      `select id from public.companies where brand = 'meridian'::public."Brand" and lower(name) = lower($1) limit 1`,
      [nome]
    );
    let companyId;
    if (found.rows.length) {
      companyId = found.rows[0].id;
    } else {
      companyId = crypto.randomUUID();
      await client.query(
        `insert into public.companies (id, owner_id, brand, name, cnpj, updated_at)
         values ($1, $2, 'meridian'::public."Brand", $3, $4, now())`,
        [companyId, b.ownerId, nome, b.customerDoc || null]
      );
    }

    // 2) deal
    const dealId = crypto.randomUUID();
    await client.query(
      `insert into public.deals (id, owner_id, company_id, brand, title, value_cents, currency, stage, "position", outcome, updated_at)
       values ($1, $2, $3, 'meridian'::public."Brand", $4, $5, 'BRL', $6, 0, 'open'::public."DealOutcome", now())`,
      [dealId, b.ownerId, companyId, title, total, stage]
    );

    // 3) proposal
    const propId = crypto.randomUUID();
    await client.query(
      `insert into public.proposals
        (id, deal_id, owner_id, brand, customer_name, customer_doc, title, items,
         subtotal_cents, discount_cents, total_cents, freight_cents, payment_terms, delivery_terms, notes, updated_at)
       values ($1,$2,$3,'meridian'::public."Brand",$4,$5,$6,$7::jsonb,$8,0,$9,$10,$11,$12,$13, now())`,
      [propId, dealId, b.ownerId, nome, b.customerDoc || null, title, JSON.stringify(itemsNorm),
       subtotal, total, freight, b.paymentTerms || null, b.deliveryTerms || null, b.notes || null]
    );

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, proposalId: propId, dealId, companyId, total_cents: total });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: "Falha ao gravar no CRM: " + (e?.message || e) }, { status: 500 });
  } finally {
    client.release();
  }
}
