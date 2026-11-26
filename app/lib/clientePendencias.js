// v1148 — vendedor do cliente e pendências cadastrais: o vendedor recebe mensagem para completar o cadastro
import { prisma } from "@/lib/prisma";

export const VENDEDORES_CLIENTE = ["IGOR", "PEDRO", "MAYCON", "GERSON"];
const vazio = (v) => !String(v ?? "").trim();
const CAMPOS = [
  ["razaoSocial", "razão social"], ["cnpj", "CNPJ/CPF"], ["logradouro", "endereço"], ["numero", "número"], ["bairro", "bairro"],
  ["municipio", "município"], ["uf", "UF"], ["cep", "CEP"], ["telefones", "telefone"], ["emailNf", "e-mail para NF e boletos"], ["preposto", "contato (preposto)"],
];
export function pendenciasCliente(c) {
  if (!c) return [];
  return CAMPOS.filter(([k]) => vazio(c[k])).map(([, t]) => t);
}
const semAc = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
export async function usuarioDoVendedor(nome) {
  const n = semAc(nome);
  if (!n) return null;
  const us = await prisma.usuario.findMany({ where: { ativo: true }, select: { id: true, nome: true, sobrenome: true } });
  return us.find((u) => semAc(u.nome) === n) || us.find((u) => semAc(u.nome).split(" ")[0] === n) || null;
}
const nomeCli = (c) => c.nomeFantasia || c.razaoSocial || c.cnpj || `cliente ${c.id}`;

// ao salvar o cliente: avisa na hora o vendedor (se houver pendência)
export async function avisarPendenciasCliente(cli, deId) {
  try {
    const p = pendenciasCliente(cli);
    if (!p.length || !cli.vendedor) return 0;
    const u = await usuarioDoVendedor(cli.vendedor);
    if (!u) return 0;
    await prisma.mensagem.create({ data: { deId: Number(deId) || u.id, paraId: u.id,
      texto: `Cadastro incompleto do cliente ${nomeCli(cli)}: falta ${p.join(", ")}. Complete em Dados › Clientes.`.slice(0, 2000) } });
    try { const { notificar } = await import("@/lib/push"); await notificar(u.id, { titulo: "Cadastro de cliente incompleto", texto: `${nomeCli(cli)}: falta ${p.join(", ")}`, tag: `cli-${cli.id}` }); } catch {}
    return 1;
  } catch (e) { console.log("clientePendencias:", e.message); return 0; }
}

// todo dia: uma mensagem por vendedor com os clientes dele ainda incompletos (só se a lista mudou ou passaram 3 dias)
export async function rodadaPendencias() {
  const cs = await prisma.cliente.findMany({ where: { ativo: true, vendedor: { not: null } } });
  const porV = {};
  for (const c of cs) { const p = pendenciasCliente(c); if (p.length) (porV[c.vendedor] ||= []).push({ c, p }); }
  let n = 0;
  for (const [v, l] of Object.entries(porV)) {
    const u = await usuarioDoVendedor(v); if (!u) continue;
    const chave = `CLI|PEND|${u.id}`;
    const assin = l.map((x) => `${x.c.id}:${x.p.length}`).sort().join(",");
    const ant = await prisma.finConfig.findUnique({ where: { chave } }).catch(() => null);
    let a = {}; try { a = JSON.parse(ant?.valor || "{}"); } catch {}
    if (a.assin === assin && a.em && Date.now() - new Date(a.em).getTime() < 3 * 86400e3) continue;
    const linhas = l.slice(0, 25).map((x) => `• ${nomeCli(x.c)}: falta ${x.p.join(", ")}`);
    await prisma.mensagem.create({ data: { deId: u.id, paraId: u.id,
      texto: `Clientes seus com cadastro incompleto (${l.length}) — complete em Dados › Clientes:\n${linhas.join("\n")}${l.length > 25 ? `\n… e mais ${l.length - 25}` : ""}`.slice(0, 2000) } });
    try { const { notificar } = await import("@/lib/push"); await notificar(u.id, { titulo: "Clientes com cadastro incompleto", texto: `${l.length} cliente(s) para completar`, tag: "cli-pend" }); } catch {}
    await prisma.finConfig.upsert({ where: { chave }, create: { chave, valor: JSON.stringify({ assin, em: new Date().toISOString() }) }, update: { valor: JSON.stringify({ assin, em: new Date().toISOString() }) } });
    n++;
  }
  return n;
}
let ag = false;
export function agendarPendenciasClientes() {
  if (ag) return; ag = true;
  const ir = () => { const h = Number(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false })); if (h >= 8 && h <= 18) rodadaPendencias().catch((e) => console.log("[v1148] pendências:", e.message)); };
  setTimeout(ir, 3 * 60e3); setInterval(ir, 60 * 60e3);
}
