// v923 — custo de sublimação e de DTF (Análises operacionais): GET ?u=&tipo= · POST { usuarioId, tipo, params, linhas }
//   Gravado em FinConfig "CUSTO_IMP|<TIPO>". Sublimação: o total do metro linear atualiza o R$/m do papel das FPPs (SUB_PAPEL_METRO).
export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { usuarioAtivoFin } from "@/lib/fin";
import { gerencial } from "@/lib/acesso";
import { TIPOS, padraoDe, calcMetro } from "@/lib/custoImpressao";

const chave = (t) => `CUSTO_IMP|${t}`;
async function ler(tipo) {
  const c = await prisma.finConfig.findUnique({ where: { chave: chave(tipo) } }).catch(() => null);
  let d = null; try { d = c ? JSON.parse(c.valor) : null; } catch {}
  const p = padraoDe(tipo);
  return { params: { ...p.params, ...(d?.params || {}) }, linhas: Array.isArray(d?.linhas) ? d.linhas : p.linhas, em: d?.em || null, por: d?.por || null };
}
export async function GET(req) {
  const sp = new URL(req.url).searchParams;
  const u = await usuarioAtivoFin(sp.get("u"));
  // v1062 — lista das artes (nome + custo total por peça) para a FPP: qualquer usuário ativo
  if (u && sp.get("artes")) {
    const t = TIPOS.includes(sp.get("artes")) ? sp.get("artes") : "DTF";
    const d = await ler(t);
    const { calcLinha } = await import("@/lib/custoImpressao");
    const totalM = calcMetro(t, d.params).c.total;
    return Response.json({ tipo: t, artes: d.linhas.filter((l) => String(l.nome || "").trim() && !/METRO LINEAR/i.test(l.nome)).map((l) => ({ nome: String(l.nome).trim().toUpperCase(), custo: Math.round(calcLinha(l, totalM).total * 10000) / 10000 })) });
  }
  if (!u || !gerencial(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const tipo = TIPOS.includes(sp.get("tipo")) ? sp.get("tipo") : "SUBLIMACAO";
  const d = await ler(tipo);
  if (tipo === "SUBLIMACAO") {   // primeira vez: o R$/m do papel das FPPs ainda zerado recebe o total do metro linear
    const atual = await prisma.fppParam.findUnique({ where: { tipo_grupo_chave: { tipo: "COMUM", grupo: "CONST", chave: "SUB_PAPEL_METRO" } } }).catch(() => null);
    if (atual && !(Number(atual.valor) > 0)) {
      const total = Math.round(calcMetro(tipo, d.params).c.total * 10000) / 10000;
      await prisma.fppParam.update({ where: { id: atual.id }, data: { valor: total } }).catch(() => null);
      await prisma.fppParamHist.create({ data: { paramId: atual.id, campo: "valor", deNum: 0, paraNum: total, usuarioId: u.id, usuarioNome: "análise de sublimação (inicial)" } }).catch(() => null);
    }
  }
  return Response.json({ tipo, ...d, podeEditar: true });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const u = await usuarioAtivoFin(b.usuarioId);
  if (!u || !gerencial(u)) return Response.json({ error: "Sem acesso." }, { status: 403 });
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : null;
  if (!tipo) return Response.json({ error: "Tipo?" }, { status: 400 });
  const quem = `${u.nome || ""} ${u.sobrenome || ""}`.trim();
  const linhas = (Array.isArray(b.linhas) ? b.linhas : []).filter((l) => l && String(l.nome || "").trim()).map((l) => ({ ...l, nome: String(l.nome).trim().toUpperCase() }));
  const valor = JSON.stringify({ params: b.params || {}, linhas, em: new Date().toISOString(), por: quem });
  await prisma.finConfig.upsert({ where: { chave: chave(tipo) }, create: { chave: chave(tipo), valor }, update: { valor } });
  let papel = null;
  if (tipo === "SUBLIMACAO") {   // R$/m do papel nas FPPs = total do metro linear da sublimação
    const total = Math.round(calcMetro(tipo, b.params).c.total * 10000) / 10000;
    const atual = await prisma.fppParam.findUnique({ where: { tipo_grupo_chave: { tipo: "COMUM", grupo: "CONST", chave: "SUB_PAPEL_METRO" } } }).catch(() => null);
    if (!atual) {
      const novo = await prisma.fppParam.create({ data: { tipo: "COMUM", grupo: "CONST", chave: "SUB_PAPEL_METRO", valor: total, rotulo: "Papel de sublimação (R$/m)", ordem: 50, ativo: true } });
      await prisma.fppParamHist.create({ data: { paramId: novo.id, campo: "valor", deNum: null, paraNum: total, usuarioId: u.id, usuarioNome: `${quem} · análise de sublimação` } }).catch(() => null);
    } else if (Math.abs(Number(atual.valor) - total) > 1e-6) {
      await prisma.fppParam.update({ where: { id: atual.id }, data: { valor: total } });
      await prisma.fppParamHist.create({ data: { paramId: atual.id, campo: "valor", deNum: Number(atual.valor), paraNum: total, usuarioId: u.id, usuarioNome: `${quem} · análise de sublimação` } }).catch(() => null);
    }
    papel = total;
  }
  return Response.json({ ok: true, papel, ...(await ler(tipo)) });
}
