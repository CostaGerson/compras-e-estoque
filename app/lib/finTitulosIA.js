// Analisar com IA — contas a pagar/receber (v124)
// 1) duplicidades: mesma NF/documento, ou mesmo valor + vencimento próximo + fornecedor parecido;
// 2) conta-caixa: compara com o histórico (outras contas do mesmo fornecedor e a identificação do extrato)
//    e aponta a conta que diverge, a que falta e o sinal trocado.
// O sistema monta os suspeitos (rápido, sem custo); a IA confirma, descarta e explica. Sem chave, vale o sistema.
import { prisma } from "@/lib/prisma";
import { normRegra } from "@/lib/fin";
import { indiceHistorico, candidatos, topConta, iaDisponivel, perguntarIA } from "@/lib/finIA";

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const DIA = 86400000;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || "").slice(0, 10));
const GENER = new Set("LTDA ME EPP EIRELI SA S A DE DA DO DAS DOS E EM PARA COM COMERCIO INDUSTRIA SERVICOS NORT MERIDIAN NF PARC PARCELA".split(" "));
export const tk = (s) => [...new Set(normRegra(s).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 3 && !GENER.has(p) && !/^\d+$/.test(p)))];
const jac = (a, b) => { if (!a.length || !b.length) return 0; const s = new Set(b); const i = a.filter((x) => s.has(x)).length; return i / (a.length + b.length - i); };
const ehSemana = (t) => String(t.chaveImport || "").startsWith("SEMANA|");
const contaPrincipal = (t) => { const r = (Array.isArray(t.rateio) ? t.rateio : []).filter((x) => Number(x.contaId) && Number(x.pct) > 0); return r.length ? Number(r.sort((a, b) => b.pct - a.pct)[0].contaId) : null; };
const chaveParceiro = (t) => (String(t.documento || "").replace(/\D/g, "").length >= 11 ? `DOC|${String(t.documento).replace(/\D/g, "")}` : `NOME|${tk(t.parceiro).join(" ")}`);

// ---------- duplicidades ----------
export function acharDuplicidades(escopo, todos) {
  const idsEsc = new Set(escopo.map((t) => t.id));
  const pares = [];
  const porValor = new Map();
  for (const t of todos) { const k = Math.round(Number(t.valor)); for (const v of [k - 1, k, k + 1]) { if (!porValor.has(v)) porValor.set(v, []); porValor.get(v).push(t); } }
  const visto = new Set();
  for (const a of escopo) {
    if (ehSemana(a)) continue;
    for (const b of porValor.get(Math.round(Number(a.valor))) || []) {
      if (a.id === b.id || ehSemana(b) || a.tipo !== b.tipo) continue;
      const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (visto.has(k)) continue;
      visto.add(k);
      if (a.status !== "ABERTO" && b.status !== "ABERTO") continue;
      if (a.recorrenciaId && a.recorrenciaId === b.recorrenciaId) continue;
      if (Math.abs(Number(a.valor) - Number(b.valor)) > 0.01) continue;
      const dias = Math.abs(new Date(a.vencimento) - new Date(b.vencimento)) / DIA;
      const docA = String(a.documento || "").replace(/\D/g, ""), docB = String(b.documento || "").replace(/\D/g, "");
      const mesmoDoc = docA.length >= 11 && docA === docB;
      const nfA = String(a.numeroDoc || "").replace(/\D/g, "").replace(/^0+/, ""), nfB = String(b.numeroDoc || "").replace(/\D/g, "").replace(/^0+/, "");
      const mesmaNf = nfA && nfA === nfB;
      const sim = jac(tk(`${a.parceiro} ${a.titulo}`), tk(`${b.parceiro} ${b.titulo}`));
      const motivos = [];
      if (mesmaNf && (mesmoDoc || sim >= 0.3)) motivos.push(`mesma NF/documento ${a.numeroDoc}`);
      if (dias <= 5 && (mesmoDoc || sim >= 0.5)) motivos.push(`mesmo valor, vencimentos a ${Math.round(dias)} dia(s)${mesmoDoc ? ", mesmo CNPJ/CPF" : ", fornecedor parecido"}`);
      const prevAvulsa = ((a.recorrenciaId && a.previsao && !b.recorrenciaId) || (b.recorrenciaId && b.previsao && !a.recorrenciaId)) && a.competencia === b.competencia && sim >= 0.3;
      if (prevAvulsa && !motivos.length) motivos.push("previsão da recorrência + a mesma conta lançada avulsa no mês");
      if (motivos.length) pares.push({ a, b, motivos });
    }
  }
  // junta pares em grupos
  const pai = new Map(); const f = (x) => { while (pai.get(x) !== x) x = pai.get(x); return x; };
  for (const { a, b } of pares) { for (const t of [a, b]) if (!pai.has(t.id)) pai.set(t.id, t.id); pai.set(f(a.id), f(b.id)); }
  const grupos = new Map(); const porId = new Map();
  for (const { a, b, motivos } of pares) {
    porId.set(a.id, a); porId.set(b.id, b);
    const r = f(a.id); if (!grupos.has(r)) grupos.set(r, { ids: new Set(), motivos: new Set() });
    const g = grupos.get(r); g.ids.add(a.id); g.ids.add(b.id); motivos.forEach((m) => g.motivos.add(m));
  }
  return [...grupos.values()].map((g) => {
    const ts = [...g.ids].map((id) => porId.get(id));
    // fica a paga; senão a que tem anexo; senão a lançada de verdade (não previsão); senão a mais antiga
    const nota = (t) => (t.status === "PAGO" ? 1000 : 0) + (t._count?.anexos ? 100 : 0) + (!t.previsao ? 10 : 0) + (t.recorrenciaId ? 5 : 0);
    const manter = [...ts].sort((x, y) => nota(y) - nota(x) || x.id - y.id)[0];
    return { titulos: ts, manterId: manter.id, motivos: [...g.motivos], noEscopo: ts.some((t) => idsEsc.has(t.id)) };
  }).filter((g) => g.noEscopo);
}

// ---------- conta-caixa ----------
export function indiceTitulos(todos) {
  const m = new Map();   // chaveParceiro → { contas: {id: n}, n }
  for (const t of todos) {
    if (t.status === "CANCELADO" || ehSemana(t)) continue;
    const c = contaPrincipal(t); if (!c) continue;
    const k = `${t.tipo}|${chaveParceiro(t)}`;
    let o = m.get(k); if (!o) { o = { contas: {}, n: 0, ids: new Set() }; m.set(k, o); }
    o.contas[c] = (o.contas[c] || 0) + 1; o.n++; o.ids.add(t.id);
  }
  return m;
}

export function suspeitosConta(escopo, idxT, idxL, cId) {
  const out = [];
  for (const t of escopo) {
    if (t.status === "CANCELADO" || ehSemana(t)) continue;
    const atual = contaPrincipal(t);
    // histórico das contas do mesmo fornecedor (tirando a própria)
    const h = idxT.get(`${t.tipo}|${chaveParceiro(t)}`);
    const contasT = h ? { ...h.contas } : {};
    if (h && atual && h.ids.has(t.id)) { contasT[atual]--; if (!contasT[atual]) delete contasT[atual]; }
    const topT = Object.keys(contasT).length ? topConta(contasT) : null;
    // identificação do extrato: histórico parecido com fornecedor + título
    const cand = idxL ? candidatos(idxL, { historico: `${t.parceiro} ${t.titulo}`, valor: t.tipo === "PAGAR" ? -1 : 1 }, 3) : { exata: null, parecidos: [] };
    const fonteL = cand.exata ? { contas: cand.exata.contas, ex: cand.exata.exemplo, s: 1 } : cand.parecidos[0] && cand.parecidos[0].s >= 0.5 ? { contas: cand.parecidos[0].c.contas, ex: cand.parecidos[0].c.exemplo, s: cand.parecidos[0].s } : null;
    const topL = fonteL ? topConta(fonteL.contas) : null;
    const motivos = [];
    let sugerida = null;
    if (!atual) {
      const b = topT || topL;
      if (b) { sugerida = b.contaId; motivos.push("sem conta-caixa"); }
      else continue;
    } else {
      const cod = cId[atual]?.codigo || "";
      if (cod !== "3000000" && ((t.tipo === "PAGAR" && cod.startsWith("1")) || (t.tipo === "RECEBER" && cod.startsWith("2"))))
        motivos.push(t.tipo === "PAGAR" ? "conta a pagar numa conta de receita" : "conta a receber numa conta de despesa");
      if (topT && topT.contaId !== atual && topT.tot >= 2 && topT.share >= 0.6 && (contasT[atual] || 0) / topT.tot < 0.3) {
        motivos.push(`outras contas do fornecedor usam ${topT.n} de ${topT.tot} vezes outra conta`); sugerida = topT.contaId;
      }
      if (topL && topL.contaId !== atual && topL.tot >= 3 && topL.share >= 0.7 && !(fonteL.contas[atual] > 0)) {
        motivos.push(`no extrato, "${fonteL.ex}" foi identificado ${topL.n} de ${topL.tot} vezes em outra conta`); sugerida = sugerida || topL.contaId;
      }
      if (!motivos.length) continue;
    }
    out.push({ t, atual, sugerida, motivos, contasT, fonteL });
  }
  return out;
}

const SYS = `Você é o auditor financeiro da Meridian (indústria de uniformes em BH/MG) revisando CONTAS A PAGAR/RECEBER.
Você recebe duas listas:
A) GRUPOS DE POSSÍVEL DUPLICIDADE: contas com mesmo valor, vencimento próximo e fornecedor parecido (ou mesma NF). Decida "DUPLICADO" (é a mesma despesa lançada mais de uma vez) ou "OK" (são despesas diferentes: parcelas, meses diferentes, serviços distintos que coincidem no valor). Uma previsão de recorrência + a mesma conta lançada avulsa no mesmo mês é DUPLICADO. Se DUPLICADO, diga qual id manter (a paga, a com anexo/NF, ou a lançada de verdade).
B) CONTAS-CAIXA SUSPEITAS: a conta-caixa atual diverge do histórico (outras contas do mesmo fornecedor e a identificação do extrato), falta, ou tem sinal trocado. Decida "TROCAR" (diga a conta certa do PLANO) ou "OK". Só TROCAR com evidência. Contas 1xxxxxx = receitas, 2xxxxxx = despesas, 3000000 = conciliação.
Responda SOMENTE a lista JSON entre <json></json>:
<json>[{"k": "D1", "acao": "DUPLICADO"|"OK", "manter": <id> | null, "motivo": "frase curta"}, {"k": "C1", "acao": "TROCAR"|"OK", "contaCodigo": "2112100" | null, "motivo": "frase curta"}]</json>`;

// tipo, dIni, dFim → { duplicidades, contas, ia, aviso }
export async function analisarTitulos({ tipo = "PAGAR", dIni, dFim, usarIA = true }) {
  const ini = new Date(`${dIni}T00:00:00Z`), fim = new Date(`${dFim}T00:00:00Z`);
  const sel = { id: true, tipo: true, titulo: true, parceiro: true, documento: true, numeroDoc: true, valor: true, vencimento: true, competencia: true, status: true, previsao: true, recorrenciaId: true, rateio: true, chaveImport: true, forma: true, observacao: true, _count: { select: { anexos: true } } };
  const [escopo, vizinhos, hist, contas] = await Promise.all([
    prisma.finTitulo.findMany({ where: { tipo, status: { not: "CANCELADO" }, vencimento: { gte: ini, lte: fim } }, select: sel }),
    prisma.finTitulo.findMany({ where: { tipo, status: { not: "CANCELADO" }, vencimento: { gte: new Date(ini.getTime() - 40 * DIA), lte: new Date(fim.getTime() + 40 * DIA) } }, select: sel }),
    prisma.finTitulo.findMany({ where: { tipo, status: { not: "CANCELADO" } }, select: { id: true, tipo: true, parceiro: true, documento: true, rateio: true, status: true, chaveImport: true } }),
    prisma.finConta.findMany({ orderBy: { codigo: "asc" } }),
  ]);
  const cId = Object.fromEntries(contas.map((c) => [c.id, c]));
  const cCod = Object.fromEntries(contas.map((c) => [c.codigo, c]));
  const nomeC = (id) => (cId[id] ? `${cId[id].codigo} ${cId[id].nome}` : "—");
  const idxL = await indiceHistorico("0000-00").catch(() => null);
  const dups = acharDuplicidades(escopo, vizinhos).slice(0, 80).map((g, i) => ({ k: `D${i + 1}`, ...g }));
  const susp = suspeitosConta(escopo, indiceTitulos(hist), idxL && idxL.total ? idxL : null, cId)
    .sort((a, b) => Number(b.t.valor) - Number(a.t.valor)).slice(0, 150).map((s, i) => ({ k: `C${i + 1}`, ...s }));

  let ia = false, aviso = "";
  const resp = {};
  if (usarIA && iaDisponivel() && (dups.length || susp.length)) {
    const fC = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${nomeC(id)} ×${n}`).join("; ");
    const lt = (t) => `id ${t.id} | ${t.titulo} | ${t.parceiro}${t.numeroDoc ? ` | doc ${t.numeroDoc}` : ""} | R$ ${Number(t.valor).toFixed(2)} | venc ${iso(t.vencimento)} | ${t.status}${t.previsao ? " (previsão)" : ""}${t.recorrenciaId ? " · recorrência" : ""}${t._count?.anexos ? ` · ${t._count.anexos} anexo(s)` : ""} | conta ${nomeC(contaPrincipal(t))}`;
    const txtD = dups.map((g) => `#${g.k} (${g.motivos.join("; ")})\n${g.titulos.map((t) => "   " + lt(t)).join("\n")}`).join("\n");
    const txtC = susp.map((s) => `#${s.k} | ${lt(s.t)}\n   alerta: ${s.motivos.join("; ")}${Object.keys(s.contasT).length ? `\n   outras contas do fornecedor → ${fC(s.contasT)}` : ""}${s.fonteL ? `\n   extrato "${s.fonteL.ex}" → ${fC(s.fonteL.contas)}` : ""}`).join("\n");
    const plano = contas.filter((c) => c.ativo).map((c) => `${c.codigo} ${c.nome}`).join("\n");
    const blocos = [];
    for (let i = 0; i < Math.max(dups.length, susp.length); i += 40)
      blocos.push(`PLANO DE CONTAS:\n${plano}\n\nA) GRUPOS DE POSSÍVEL DUPLICIDADE:\n${txtD.split(/\n(?=#D)/).slice(i, i + 40).join("\n") || "(nenhum)"}\n\nB) CONTAS-CAIXA SUSPEITAS:\n${txtC.split(/\n(?=#C)/).slice(i, i + 40).join("\n") || "(nenhuma)"}`);
    const res = await Promise.allSettled(blocos.map((b) => perguntarIA(SYS, b).then((r) => r.forEach((x) => (resp[x.k] = x)))));
    const falhas = res.filter((r) => r.status === "rejected");
    ia = falhas.length < res.length;
    if (falhas.length) aviso = `IA: ${falhas[0].reason?.message || "falha"}${ia ? " (parte ficou só com o histórico)" : " — usei só o histórico."}`;
  } else if (usarIA && !iaDisponivel()) aviso = "Chave da IA não configurada na VPS — análise feita só com o histórico.";

  const saidaT = (t) => ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, numeroDoc: t.numeroDoc, valor: r2(t.valor), vencimento: iso(t.vencimento), status: t.status, previsao: t.previsao, recorrenciaId: t.recorrenciaId, anexos: t._count?.anexos || 0, contaId: contaPrincipal(t) });
  const duplicidades = dups.map((g) => {
    const r = resp[g.k];
    if (r && r.acao === "OK") return null;
    const manterId = r && g.titulos.some((t) => t.id === Number(r.manter)) ? Number(r.manter) : g.manterId;
    return { k: g.k, titulos: g.titulos.map(saidaT), manterId, motivo: r ? r.motivo : g.motivos.join("; "), fonte: r ? "IA" : "HISTÓRICO" };
  }).filter(Boolean);
  const contasOut = susp.map((s) => {
    const r = resp[s.k];
    if (r && r.acao === "OK") return null;
    const sug = r && r.contaCodigo ? cCod[r.contaCodigo]?.id || null : s.sugerida;
    if (!sug && !s.motivos.some((m) => /sinal|receita|despesa/.test(m))) return null;
    return { k: s.k, titulo: saidaT(s.t), contaAtualId: s.atual, contaSugeridaId: sug || null, alertas: s.motivos, motivo: r ? r.motivo : s.motivos.join("; "), fonte: r ? "IA" : "HISTÓRICO", termo: tk(s.t.parceiro).slice(0, 3).join(" ") || null };
  }).filter(Boolean);
  return { ia, aviso, analisadas: escopo.length, duplicidades, contas: contasOut, descartadas: dups.length + susp.length - duplicidades.length - contasOut.length };
}
