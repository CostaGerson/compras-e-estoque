import { NextResponse } from "next/server";
import crypto from "crypto";
import { crmPool } from "../../../../lib/crm";

export const dynamic = "force-dynamic";

const MARCA = "GERADA PELO SISTEMA COMPRAS & ESTOQUE";
// apelidos que o CRM pode usar em cada campo do item (espelhamos os que aparecerem numa proposta feita no próprio CRM)
const APELIDOS = {
  nome: ["description", "name", "title", "product", "produto", "descricao", "item", "commercial_name", "nome"],
  qtd: ["qty", "quantity", "quantidade", "qtde"],
  unitCents: ["unit_price_cents", "unitPriceCents", "price_cents", "priceCents"],
  unitReais: ["unit_price", "unitPrice", "price", "valor_unitario", "valorUnitario"],
  totCents: ["total_cents", "totalCents", "line_total_cents", "lineTotalCents", "subtotal_cents"],
  totReais: ["total", "totalPrice", "line_total", "valor_total", "valorTotal"],
  det: ["details", "detalhes", "notes", "observacao", "obs"],
};

async function estrutura(client) {
  const cols = (await client.query(
    `select column_name from information_schema.columns where table_schema='public' and table_name='proposals'`)).rows.map((r) => r.column_name);
  const ordem = cols.includes("created_at") ? "order by created_at desc" : "";
  const filtroNotas = cols.includes("notes") ? `and (notes is null or notes not like '${MARCA}%')` : "";
  let chaves = [];
  try {
    const s = await client.query(`select items from public.proposals where jsonb_typeof(items)='array' and jsonb_array_length(items)>0 ${filtroNotas} ${ordem} limit 5`);
    for (const r of s.rows) for (const it of r.items || []) if (it && typeof it === "object") chaves.push(...Object.keys(it));
  } catch { /* sem propostas */ }
  return { cols, chaves: [...new Set(chaves)] };
}

// Item no formato EXATO do CRM: só as chaves que as propostas feitas no próprio CRM usam
// (chave a mais pode fazer o CRM recusar a proposta). Sem amostra → formato padrão de 4 chaves.
const PADRAO = ["qty", "details", "description", "unit_price_cents"];
function montarItem(it, chaves) {
  const qty = Number(it.qty) || 0;
  const unit = Math.round(Number(it.unit_price_cents) || 0);
  const desc = String(it.description || "").slice(0, 300);
  const det = it.details ? String(it.details).slice(0, 500) : null;
  const usar = chaves.length ? chaves : PADRAO;
  const o = {};
  for (const k of usar) {
    if (APELIDOS.nome.includes(k)) o[k] = desc;
    else if (APELIDOS.qtd.includes(k)) o[k] = qty;
    else if (APELIDOS.unitCents.includes(k)) o[k] = unit;
    else if (APELIDOS.unitReais.includes(k)) o[k] = unit / 100;
    else if (APELIDOS.totCents.includes(k)) o[k] = qty * unit;
    else if (APELIDOS.totReais.includes(k)) o[k] = (qty * unit) / 100;
    else if (APELIDOS.det.includes(k)) o[k] = det;
    else o[k] = null;                       // chave do CRM que não conhecemos: vai vazia
  }
  return o;
}

// GET ?diag=1 → mostra as colunas da proposta e as chaves dos itens que o CRM usa (para conferir o formato)
export async function GET() {
  const pool = crmPool();
  if (!pool) return NextResponse.json({ error: "CRM_DATABASE_URL não configurado." }, { status: 503 });
  const client = await pool.connect();
  try { return NextResponse.json(await estrutura(client)); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  finally { client.release(); }
}

// POST: cria (ou reusa) company, cria deal e cria proposal no CRM.
// body: { clienteNome, customerDoc?, ownerId, stage, title, paymentTerms?, deliveryTerms?, leadTimeDias?,
//         notes?, freightCents?, items:[{description, details, qty, unit_price_cents}] }
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

  const client = await pool.connect();
  try {
    const { cols, chaves } = await estrutura(client);
    const itemsNorm = items.map((it) => montarItem(it, chaves));
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * Math.round(Number(it.unit_price_cents) || 0), 0);
    const freight = Math.round(Number(b.freightCents) || 0);
    const total = subtotal + freight;
    const notes = [MARCA, b.notes].filter(Boolean).join(" · ");

    await client.query("BEGIN");

    // 1) company: reusa por (brand=meridian, name) ou cria
    const found = await client.query(
      `select id from public.companies where brand = 'meridian'::public."Brand" and lower(name) = lower($1) limit 1`, [nome]);
    let companyId;
    if (found.rows.length) companyId = found.rows[0].id;
    else {
      companyId = crypto.randomUUID();
      await client.query(
        `insert into public.companies (id, owner_id, brand, name, cnpj, updated_at)
         values ($1, $2, 'meridian'::public."Brand", $3, $4, now())`,
        [companyId, b.ownerId, nome, b.customerDoc || null]);
    }

    // 2) deal
    const dealId = crypto.randomUUID();
    await client.query(
      `insert into public.deals (id, owner_id, company_id, brand, title, value_cents, currency, stage, "position", outcome, updated_at)
       values ($1, $2, $3, 'meridian'::public."Brand", $4, $5, 'BRL', $6, 0, 'open'::public."DealOutcome", now())`,
      [dealId, b.ownerId, companyId, title, total, stage]);

    // 3) proposal — campos fixos + os opcionais que existirem no CRM
    const campos = {
      id: crypto.randomUUID(), deal_id: dealId, owner_id: b.ownerId, customer_name: nome, customer_doc: b.customerDoc || null,
      title, items: JSON.stringify(itemsNorm), subtotal_cents: subtotal, discount_cents: 0, total_cents: total,
      freight_cents: freight, payment_terms: b.paymentTerms || null, delivery_terms: b.deliveryTerms || null, notes,
    };
    const lt = Number(b.leadTimeDias) || null;
    for (const k of ["delivery_days", "lead_time_days", "lead_time", "delivery_time_days", "prazo_entrega_dias"]) if (lt && cols.includes(k)) campos[k] = lt;
    for (const k of ["delivery_time", "delivery_deadline", "prazo_entrega"]) if (b.deliveryTerms && cols.includes(k)) campos[k] = b.deliveryTerms;
    for (const k of ["payment_conditions", "payment_method", "condicao_pagamento"]) if (b.paymentTerms && cols.includes(k)) campos[k] = b.paymentTerms;
    const nomes = Object.keys(campos).filter((k) => cols.length === 0 || cols.includes(k) || ["id", "deal_id", "owner_id", "items"].includes(k));
    const vals = nomes.map((k) => campos[k]);
    const ph = nomes.map((k, i) => (k === "items" ? `$${i + 1}::jsonb` : `$${i + 1}`));
    await client.query(
      `insert into public.proposals (${nomes.map((k) => `"${k}"`).join(", ")}, brand, updated_at)
       values (${ph.join(", ")}, 'meridian'::public."Brand", now())`, vals);

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, proposalId: campos.id, dealId, companyId, total_cents: total, chavesItem: chaves });
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    return NextResponse.json({ error: "Falha ao gravar no CRM: " + (e?.message || e) }, { status: 500 });
  } finally {
    client.release();
  }
}
