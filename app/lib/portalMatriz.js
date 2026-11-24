// v1091 — Matriz de custos do portal (NORT), no modelo da Matriz da Meridian (mesma conta de encargos e provisões por pessoa).
//   Gera as contas a pagar do mês no financeiro do portal (salário, encargos/benefícios e cada custo fixo), sem duplicar.
import { prisma } from "@/lib/prisma";
import { calcFuncionario } from "@/lib/matriz";
import { garantirPlano } from "@/lib/portalFin";

export const SECOES = [
  { k: "vidaVegetativa", nome: "Vida vegetativa (ocupação)", conta: "4.02" }, { k: "sistemas", nome: "Sistemas", conta: "4.05" },
  { k: "administracao", nome: "Administração", conta: "4.06" }, { k: "logistica", nome: "Logística", conta: "4.07" }, { k: "dividas", nome: "Dívidas e parcelamentos", conta: "6.01" },
];
const PAR_PADRAO = { inssPatronal: 0.2, inssFunc: 0.075, fgts: 0.08, vtDesconto: 0.06, multaFgts: 0.4, diasUteis: 22 };
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nomeU = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase() || null;

// primeira vez: parâmetros da Matriz oficial da Meridian e, na NORT, as pessoas do depto NORT de lá (ex.: Ayrllon)
async function semente(cliente) {
  const of = await prisma.finMatriz.findFirst({ where: { oficial: true } }).catch(() => null);
  const d = of?.dados || {};
  const nort = /NORT SPORTS/i.test(`${cliente.razaoSocial || ""} ${cliente.nomeFantasia || ""}`);
  const pessoal = nort ? (Array.isArray(d.pessoal) ? d.pessoal : []).filter((p) => p.depto === "NORT" && p.ativo !== false).map((p) => ({ ...p, obs: [p.obs, "VEIO DA MATRIZ DA MERIDIAN (DEPTO NORT)"].filter(Boolean).join(" · ") })) : [];
  return { parametros: { ...PAR_PADRAO, ...(d.parametros || {}) }, pessoal, ...Object.fromEntries(SECOES.map((s) => [s.k, []])) };
}
export async function obterMatriz(cliente) {
  let m = await prisma.portalMatriz.findUnique({ where: { clienteId: cliente.id } });
  if (!m) m = await prisma.portalMatriz.create({ data: { clienteId: cliente.id, dados: await semente(cliente), atualizadoPor: "CRIADA PELO SISTEMA" } });
  return { dados: m.dados, atualizadoPor: m.atualizadoPor, updatedAt: m.updatedAt, calc: calcular(m.dados) };
}
export function calcular(d) {
  const par = { ...PAR_PADRAO, ...(d?.parametros || {}) };
  const pessoas = (d?.pessoal || []).map((p) => { const c = calcFuncionario(p, par); return { id: p.id, ativo: p.ativo !== false, liquido: r2(c.liquido + c.G), encargos: r2(c.inssPatronal + c.inssFunc + c.fgts),
    beneficios: r2(c.vt + c.vr + c.ps + c.ass + c.saldoLivre), provisoes: r2(c.provisoes), total: r2(c.total) }; });
  const pessoal = r2(pessoas.filter((p) => p.ativo).reduce((s, p) => s + p.total, 0));
  const secoes = Object.fromEntries(SECOES.map((s) => [s.k, r2((d?.[s.k] || []).reduce((t, x) => t + (Number(x.valor) || 0), 0))]));
  return { pessoas, pessoal, secoes, total: r2(pessoal + Object.values(secoes).reduce((a, b) => a + b, 0)) };
}
const limpar = (d) => {
  const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const pessoal = (Array.isArray(d?.pessoal) ? d.pessoal : []).filter((p) => String(p.nome || "").trim()).map((p, i) => ({ ...p, id: p.id || `p${Date.now()}${i}`, nome: String(p.nome).toUpperCase().slice(0, 80),
    cargo: String(p.cargo || "").toUpperCase().slice(0, 80), regime: ["CLT", "DIRETOR", "ESTAGIO"].includes(p.regime) ? p.regime : "CLT", salario: num(p.salario), bonus: num(p.bonus), vt: num(p.vt), vr: num(p.vr), ps: num(p.ps),
    assPct: num(p.assPct), saldoLivre: num(p.saldoLivre), rFerias: num(p.rFerias), descontaVt: !!p.descontaVt, ativo: p.ativo !== false, depto: "NORT" }));
  const out = { parametros: { ...PAR_PADRAO, ...(d?.parametros || {}) }, pessoal };
  for (const s of SECOES) out[s.k] = (Array.isArray(d?.[s.k]) ? d[s.k] : []).filter((x) => String(x.natureza || "").trim()).map((x, i) => ({ id: x.id || `i${Date.now()}${i}`, natureza: String(x.natureza).toUpperCase().slice(0, 120),
    valor: num(x.valor), dia: Math.min(28, Math.max(1, Math.round(num(x.dia)) || 10)), parceiro: x.parceiro ? String(x.parceiro).toUpperCase().slice(0, 120) : null, obs: x.obs ? String(x.obs).slice(0, 200) : "" }));
  return out;
};
export async function salvarMatriz(cliente, dados, u) {
  await obterMatriz(cliente);
  const d = limpar(dados);
  await prisma.portalMatriz.update({ where: { clienteId: cliente.id }, data: { dados: d, atualizadoPor: nomeU(u) } });
  return { ok: true, ...(await obterMatriz(cliente)) };
}
// contas a pagar do mês (AAAA-MM): salário líquido (dia 5), encargos e benefícios (dia 20) e cada custo fixo (dia do item)
export async function gerarContasMes(cliente, mes, u) {
  if (!/^\d{4}-\d{2}$/.test(String(mes || ""))) return { error: "Mês inválido." };
  const { dados, calc } = await obterMatriz(cliente);
  await garantirPlano(cliente.id);
  const contas = Object.fromEntries((await prisma.portalFinConta.findMany({ where: { clienteId: cliente.id } })).map((c) => [c.codigo, c.id]));
  const dia = (n) => new Date(`${mes}-${String(n).padStart(2, "0")}T00:00:00Z`);
  const linhas = [];
  for (const p of dados.pessoal || []) {
    if (p.ativo === false) continue;
    const c = calc.pessoas.find((x) => x.id === p.id);
    if (!c) continue;
    if (c.liquido > 0) linhas.push({ chave: `MATRIZ|${mes}|${p.id}|SAL`, descricao: `SALÁRIO ${p.nome}`, parceiro: p.nome, valor: c.liquido, venc: dia(5), conta: "4.01" });
    const eb = r2(c.encargos + c.beneficios);
    if (eb > 0) linhas.push({ chave: `MATRIZ|${mes}|${p.id}|ENC`, descricao: `ENCARGOS E BENEFÍCIOS ${p.nome} (INSS, FGTS, VT, VR, PLANO)`, parceiro: null, valor: eb, venc: dia(20), conta: "4.01" });
  }
  for (const s of SECOES) for (const x of dados[s.k] || []) if (Number(x.valor) > 0) linhas.push({ chave: `MATRIZ|${mes}|${x.id}`, descricao: x.natureza, parceiro: x.parceiro || null, valor: r2(x.valor), venc: dia(x.dia || 10), conta: s.conta });
  let criadas = 0, atualizadas = 0, mantidas = 0;
  for (const l of linhas) {
    const ja = await prisma.portalFinTitulo.findUnique({ where: { chave: l.chave } });
    const d = { clienteId: cliente.id, tipo: "PAGAR", descricao: `${l.descricao} · ${mes.slice(5)}/${mes.slice(0, 4)}`.slice(0, 160), parceiro: l.parceiro, valor: l.valor, vencimento: l.venc, contaId: contas[l.conta] || null, observacao: "GERADA PELA MATRIZ DE CUSTOS" };
    if (!ja) { await prisma.portalFinTitulo.create({ data: { ...d, chave: l.chave, criadoPorNome: nomeU(u) } }); criadas++; }
    else if (ja.status === "ABERTO" && (Math.abs(Number(ja.valor) - l.valor) > 0.004)) { await prisma.portalFinTitulo.update({ where: { id: ja.id }, data: { valor: l.valor, atualizadoPorNome: nomeU(u) } }); atualizadas++; }
    else mantidas++;
  }
  return { ok: true, criadas, atualizadas, mantidas, total: r2(linhas.reduce((s, l) => s + l.valor, 0)) };
}
