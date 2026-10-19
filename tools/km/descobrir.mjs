// v324 — passo 1: descobrir onde o KM (MentorSoft) guarda os pedidos. SÓ LEITURA.
// Uso (no PowerShell, dentro desta pasta):  node descobrir.mjs
// Gera o arquivo km-estrutura.txt — mande esse arquivo para o Claude.
import pg from "pg";
import fs from "fs";
import readline from "readline";

const pergunta = (q, oculto = false) => new Promise((ok) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (oculto) rl._writeToOutput = () => {};
  rl.question(q, (r) => { rl.close(); if (oculto) process.stdout.write("\n"); ok(r); });
});

const host = process.env.KM_HOST || "192.168.0.107", port = Number(process.env.KM_PORTA || 5435);
const user = process.env.KM_USUARIO || "mentorsoft", database = process.env.KM_BANCO || "mentorsoft";
const password = process.env.KM_SENHA || await pergunta(`Senha do banco (${user}@${host}:${port}/${database}): `, true);

const c = new pg.Client({ host, port, user, password, database, connectionTimeoutMillis: 10000 });
await c.connect();
await c.query("SET default_transaction_read_only = on");
const out = [];
const log = (s) => { out.push(s); console.log(s); };
log(`KM ${host}:${port}/${database} — ${new Date().toISOString()}`);
log((await c.query("select version()")).rows[0].version);

// tabelas com nome de pedido / item / parcela / condição / cliente
const tabs = (await c.query(`
  select table_schema s, table_name t from information_schema.tables
  where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema')
  order by 1,2`)).rows;
log(`\n${tabs.length} tabelas no total`);
const rx = /ped|item|parc|cond|client|venda|grade|vend|ordem|op_|produc/i;
const alvo = tabs.filter((x) => rx.test(x.t));
log(`\n== ${alvo.length} tabelas candidatas ==`);
for (const { s, t } of alvo) {
  const cols = (await c.query(`select column_name n, data_type d from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position`, [s, t])).rows;
  let n = "?"; try { n = (await c.query(`select count(*)::int n from "${s}"."${t}"`)).rows[0].n; } catch {}
  log(`\n### ${s}.${t}  (${n} linhas)`);
  log(cols.map((x) => `${x.n}:${x.d}`).join(", "));
}
// onde aparece o pedido 26100034 (M ROSCOE) — acha a tabela de cabeçalho
log(`\n== procura pelo pedido 26100034 ==`);
for (const { s, t } of alvo) {
  const cols = (await c.query(`select column_name n from information_schema.columns where table_schema=$1 and table_name=$2 and data_type in ('integer','bigint','numeric','character varying','text','character')`, [s, t])).rows.map((x) => x.n);
  for (const col of cols) {
    try {
      const r = await c.query(`select count(*)::int n from "${s}"."${t}" where "${col}"::text = '26100034'`);
      if (r.rows[0].n) log(`${s}.${t}.${col}: ${r.rows[0].n} linha(s)`);
    } catch {}
  }
}
log(`\n== nomes de todas as tabelas ==\n${tabs.map((x) => `${x.s}.${x.t}`).join("\n")}`);
await c.end();
fs.writeFileSync("km-estrutura.txt", out.join("\n"));
console.log("\nPronto: km-estrutura.txt");
