// Importação da "Posição de Títulos a Pagar/Receber (Analítico)" do sistema antigo (.xls/.xlsx).
// 1) ler: planilha → linhas
// 2) analisar: cada linha ganha uma situação e uma decisão sugerida
//    NOVO · JA_IMPORTADO · DUPLICADO (já existe conta igual) · RECORRENCIA (o mês já tem a previsão da recorrência)
//    · REPETIDO (a mesma linha duas vezes na planilha)
// 3) importar: IMPORTAR cria a conta · SUBSTITUIR troca valor/vencimento da previsão da recorrência · IGNORAR não faz nada
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { normRegra, acharRegra, regrasOrdenadas } from "@/lib/fin";
import { dataUTC, mesDe, r2, so } from "@/lib/finTitulos";

const DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const dBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
const norm = (s) => normRegra(s).replace(/[^A-Z0-9]+/g, " ").trim();
const PARADAS = new Set(["REF", "MENSAL", "PAGAMENTO", "PGTO", "PARA", "COM", "DOS", "DAS", "DE", "DA", "DO", "E", "EM", "NO", "NA",
  "LTDA", "S A", "SA", "ME", "EPP", "CIA", "IND", "COM", "ENTRADA", "POR", "COMPRA", "PAGO", "CONTA", "VALOR"]);
// sinônimos para casar a planilha com as recorrências (folha = salário = funcionário, pró-labore etc.)
const SINON = { SALARIO: "FOLHA", SALARIOS: "FOLHA", FUNCIONARIO: "FOLHA", FUNCIONARIOS: "FOLHA",
  IFOOD: "BENEFICIO", BENEFICIOS: "BENEFICIO", ALIMENTACAO: "BENEFICIO", REFEICAO: "BENEFICIO",
  TELEF: "TELEFONIA", TELEFONE: "TELEFONIA", INTERNET: "TELEFONIA", ECONOMICA: "CAIXA" };
const tokens = (s) => new Set(norm(s).replace(/\bPRO LABORE\b/g, "PROLABORE").split(" ")
  .filter((w) => w.length >= 3 && !PARADAS.has(w) && !/^\d+$/.test(w)).map((w) => SINON[w] || w));

// número serial do Excel ou texto dd/mm/aaaa → AAAA-MM-DD
function dataCel(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") { const p = XLSX.SSF.parse_date_code(v); return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : null; }
  if (v instanceof Date) return iso(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate())));
  const m = String(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const n = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return n ? `${n[1]}-${n[2]}-${n[3]}` : null;
}
const numCel = (v) => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").replace(/\s|R\$/g, "");
  if (!t) return 0;
  const x = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(x) ? x : 0;
};

// ---------------- 1) ler ----------------
export function lerPosicao(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "VENCIMENTO") && r.some((c) => norm(c).startsWith("ORIGEM")));
  if (hi < 0) throw new Error("Não achei o cabeçalho da posição de títulos (colunas Origem e Vencimento).");
  const cab = rows[hi].map((c) => norm(c));
  const col = (...nomes) => cab.findIndex((c) => nomes.some((n) => c === n || c.startsWith(n)));
  const C = {
    origem: col("ORIGEM"), titulo: col("TITULO"), emissao: col("EMISSAO"), venc: col("VENCIMENTO"), pagamento: col("PAGAMENTO"),
    parceiro: col("FORNECEDOR", "CLIENTE"), doc: col("CNPJ CPF"), valor: col("VALOR"), valorAtual: col("VALOR ATUAL"),
    descricao: col("DESCRICAO"), obs: col("OBSERVACAO"), codParc: col("CODIGO DO"), idParc: col("ID DO"),
  };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const origem = norm(r[C.origem]);
    const venc = dataCel(r[C.venc]);
    if (!venc || !["PAGAR", "RECEBER"].includes(origem)) continue;   // linha de total / vazia
    if (C.pagamento >= 0 && dataCel(r[C.pagamento])) continue;          // já pago no sistema antigo
    const valor = r2(C.valorAtual >= 0 && numCel(r[C.valorAtual]) ? numCel(r[C.valorAtual]) : numCel(r[C.valor]));
    if (!(valor > 0)) continue;
    const tituloOrig = String(r[C.titulo] || "").trim();
    const descricao = String(r[C.descricao] || "").trim().replace(/\s+/g, " ");
    const parceiro = String(r[C.parceiro] || "").trim().replace(/\s+/g, " ").toUpperCase();
    out.push({
      linha: i + 1, tipo: origem, tituloOrig, descricao: descricao.toUpperCase(), parceiro,
      documento: so(r[C.doc]) || null, emissao: dataCel(r[C.emissao]), vencimento: venc, valor,
      obs: C.obs >= 0 ? String(r[C.obs] || "").trim() : "",
      idParceiro: C.idParc >= 0 ? String(r[C.idParc] || "").trim() : "",
    });
  }
  return out;
}

export const chavePosicao = (l) => `POSICAO|${l.tipo}|${norm(l.parceiro).replace(/ /g, "")}|${norm(l.tituloOrig).replace(/ /g, "")}|${l.vencimento}`;
const nfDe = (l) => (l.descricao.match(/REF\.?\s*NF\s*:?\s*(\d+)/) || [])[1] || null;
const tituloDe = (l) => (l.descricao || l.tituloOrig || "IMPORTADO").toUpperCase().slice(0, 120);

// ---------------- 2) analisar ----------------
export async function analisarPosicao(linhas) {
  if (!linhas.length) return { linhas: [], resumo: {} };
  const venc = linhas.map((l) => l.vencimento).sort();
  const de = new Date(dataUTC(venc[0]).getTime() - 40 * DIA), ate = new Date(dataUTC(venc[venc.length - 1]).getTime() + 40 * DIA);
  const tipos = [...new Set(linhas.map((l) => l.tipo))];
  const [existentes, comChave, regras, contas] = await Promise.all([
    prisma.finTitulo.findMany({
      where: { tipo: { in: tipos }, status: { not: "CANCELADO" }, vencimento: { gte: de, lte: ate } },
      select: { id: true, tipo: true, titulo: true, parceiro: true, documento: true, numeroDoc: true, valor: true, vencimento: true, competencia: true, status: true, recorrenciaId: true, rateio: true, chaveImport: true, previsao: true },
    }),
    // só bloqueia se a conta importada antes AINDA ESTÁ ATIVA (em aberto ou baixada); cancelada/excluída não conta
    prisma.finTitulo.findMany({ where: { chaveImport: { in: linhas.map(chavePosicao) }, status: { not: "CANCELADO" } },
      select: { chaveImport: true, id: true, titulo: true, status: true, vencimento: true, valor: true } }),
    regrasOrdenadas(),
    prisma.finConta.findMany({ select: { id: true, codigo: true, nome: true } }),
  ]);
  const jaChave = new Map(comChave.map((x) => [x.chaveImport, x]));
  // último rateio usado por parceiro (para sugerir a conta-caixa)
  const ultimos = await prisma.finTitulo.findMany({
    where: { tipo: { in: tipos }, parceiro: { in: [...new Set(linhas.map((l) => l.parceiro))] } },
    orderBy: { createdAt: "desc" }, select: { parceiro: true, rateio: true }, take: 2000,
  });
  const rateioParc = new Map();
  for (const u of ultimos) if (!rateioParc.has(u.parceiro) && Array.isArray(u.rateio) && u.rateio.length) rateioParc.set(u.parceiro, u.rateio);
  const nomeConta = Object.fromEntries(contas.map((c) => [c.id, `${c.codigo} · ${c.nome}`]));

  const ex = existentes.map((t) => ({
    ...t, valor: Number(t.valor), venc: iso(t.vencimento),
    tkTit: tokens(t.titulo), tkParc: tokens(t.parceiro), parcN: norm(t.parceiro),
  }));
  const out = [];
  const vistos = new Map();       // repetição dentro da planilha
  const dV = (t, l) => Math.abs(dataUTC(t.venc) - dataUTC(l.vencimento)) / DIA;

  // 1ª passada: já importado, repetido na planilha, conta igual já lançada (fora das recorrências)
  for (const l of linhas) {
    const chave = chavePosicao(l);
    const x = { ...l, chave, titulo: tituloDe(l), situacao: "NOVO", decisao: "IMPORTAR", motivo: "", alvo: null, conta: null };
    const rep = `${norm(l.parceiro)}|${l.valor}|${l.vencimento}|${norm(l.descricao)}`;
    const mesmoParc = (t) => (l.documento && t.documento && l.documento === t.documento) || t.parcN === norm(l.parceiro)
      || [...tokens(l.parceiro)].filter((w) => t.tkParc.has(w)).length >= 2;
    if (jaChave.has(chave)) {
      const t = jaChave.get(chave);
      Object.assign(x, { situacao: "JA_IMPORTADO", decisao: "IGNORAR", alvo: { id: t.id },
        motivo: `Já importada e ainda ativa (${t.status === "PAGO" ? "baixada" : "em aberto"}): conta nº ${t.id}, vence ${dBR(iso(t.vencimento))}, R$ ${Number(t.valor).toFixed(2).replace(".", ",")}.` });
    } else if (vistos.has(rep)) {
      Object.assign(x, { situacao: "REPETIDO", decisao: "IGNORAR", motivo: `Igual à linha ${vistos.get(rep)} da planilha (mesmo parceiro, valor, vencimento e descrição).` });
    } else {
      const nf = nfDe(l);
      const igual = ex.filter((t) => t.tipo === l.tipo && !t.recorrenciaId && Math.abs(t.valor - l.valor) <= 0.05 && dV(t, l) <= 5
        && (mesmoParc(t) || (nf && String(t.numeroDoc || "").replace(/\D.*$/, "") === nf)));
      if (igual.length) {
        const t = igual.sort((a, b) => dV(a, l) - dV(b, l))[0];
        Object.assign(x, { situacao: "DUPLICADO", decisao: "IGNORAR", alvo: t,
          motivo: `Já existe "${t.titulo}" · ${t.parceiro} · R$ ${t.valor.toFixed(2).replace(".", ",")} · vence ${dBR(t.venc)}${t.status === "PAGO" ? " (já baixada)" : ""}.` });
      }
    }
    vistos.set(rep, l.linha);
    out.push(x);
  }

  // 2ª passada: previsões das recorrências no mesmo mês — pontua todos os pares e casa do melhor para o pior
  const pares = [];
  for (const x of out) {
    if (x.situacao !== "NOVO") continue;
    const tkPar = tokens(x.parceiro);
    const prefixo = tokens(x.tituloOrig.replace(/-\d+\/\d+$/, ""));
    // fortes: descrição + nome curto do título (sem repetir o nome do parceiro, como em "RECEITA FEDERAL-1/18")
    const fortes = new Set([...tokens(x.descricao), ...[...prefixo].filter((w) => !tkPar.has(w))]);
    const tudo = new Set([...fortes, ...tkPar, ...prefixo]);
    for (const t of ex) {
      if (t.tipo !== x.tipo || !t.recorrenciaId || t.competencia !== mesDe(x.vencimento)) continue;
      const cand = new Set([...t.tkTit, ...t.tkParc]);
      const casou = [...fortes].filter((w) => cand.has(w));
      // recorrência com o nome do próprio parceiro (ex.: CLARO, CEMIG) casa pelo parceiro
      if (!casou.length && t.tkTit.size && [...t.tkTit].every((w) => tkPar.has(w))) casou.push(...t.tkTit);
      if (!casou.length) continue;
      const titSobra = [...t.tkTit].filter((w) => !tudo.has(w));
      const parcOk = [...tkPar].some((w) => cand.has(w)) || [...t.tkParc].some((w) => tudo.has(w));
      if (!parcOk && titSobra.length) continue;   // ex.: PRÓ-LABORE IGOR × pró-labore do MAYCON
      const pontos = casou.length * 3 + (parcOk ? 2 : 0) - titSobra.length * 2
        - [...prefixo].filter((w) => !cand.has(w)).length * 2 - [...tkPar].filter((w) => !cand.has(w)).length;
      const sobra = [...new Set([...prefixo, ...tkPar])].filter((w) => !cand.has(w) && !["RECEITA", "FEDERAL"].includes(w));
      if (pontos > 0) pares.push({ x, t, pontos, dif: Math.abs(t.valor - x.valor), sobra });
    }
  }
  pares.sort((a, b) => b.pontos - a.pontos || a.dif - b.dif);
  const casadoX = new Set(), casadoT = new Set();
  for (const { x, t, sobra } of pares) {
    if (casadoX.has(x) || casadoT.has(t.id)) continue;
    casadoX.add(x); casadoT.add(t.id);
    Object.assign(x, { situacao: "RECORRENCIA", alvo: t, decisao: t.status === "PAGO" ? "IGNORAR" : "SUBSTITUIR",
      motivo: `O mês já tem a previsão "${t.titulo}" (${t.parceiro}) de R$ ${t.valor.toFixed(2).replace(".", ",")}, vence ${dBR(t.venc)}${t.status === "PAGO" ? " — já baixada" : ""}.`
        + (sobra.length ? ` Atenção: não batem ${sobra.join(", ")}.` : "") });
    if (Array.isArray(t.rateio) && t.rateio.length) x.conta = t.rateio[0].contaId;
  }

  // conta-caixa sugerida: recorrência > último rateio do parceiro > palavras-chave
  for (const x of out) {
    let conta = x.conta, origemConta = conta ? "RECORRÊNCIA" : null;
    if (!conta && rateioParc.has(x.parceiro)) { conta = rateioParc.get(x.parceiro)[0]?.contaId || null; origemConta = conta ? "ÚLTIMA CONTA DO PARCEIRO" : null; }
    if (!conta) {
      const r = acharRegra(regras, { historico: `${x.descricao} ${x.parceiro}`, identificacao: "", valor: x.tipo === "PAGAR" ? -x.valor : x.valor, banco: null });
      if (r) { conta = r.contaId; origemConta = "PALAVRA-CHAVE"; }
    }
    const a = x.alvo;
    Object.assign(x, { contaId: conta, contaNome: conta ? nomeConta[conta] || null : null, origemConta, conta: undefined,
      alvo: a ? { id: a.id, titulo: a.titulo, parceiro: a.parceiro, valor: a.valor, vencimento: a.venc, status: a.status } : null });
  }
  const resumo = {};
  for (const l of out) {
    const r = (resumo[l.situacao] ||= { qtd: 0, valor: 0 });
    r.qtd++; r.valor = r2(r.valor + l.valor);
  }
  return { linhas: out, resumo, total: r2(out.reduce((s, l) => s + l.valor, 0)), tipos };
}

// ---------------- 3) importar ----------------
export async function importarPosicao(linhas, { quem, usuarioId } = {}) {
  // conta-caixa obrigatória em toda conta nova (e na previsão que não tiver rateio)
  const faltam = [];
  for (const l of linhas) {
    if (l.decisao === "IMPORTAR" && !Number(l.contaId)) faltam.push(l.linha);
    if (l.decisao === "SUBSTITUIR" && !Number(l.contaId) && l.alvo?.id) {
      const t = await prisma.finTitulo.findUnique({ where: { id: Number(l.alvo.id) }, select: { rateio: true } });
      if (!(Array.isArray(t?.rateio) && t.rateio.length)) faltam.push(l.linha);
    }
  }
  if (faltam.length) return { error: `Informe a conta-caixa das linhas ${faltam.slice(0, 15).join(", ")}${faltam.length > 15 ? "…" : ""} — é obrigatória.` };
  const r = { criadas: 0, substituidas: 0, ignoradas: 0, jaExistiam: 0, valorCriado: 0, valorSubstituido: 0 };
  for (const l of linhas) {
    const chave = chavePosicao(l);
    if (l.decisao === "IGNORAR" || !["IMPORTAR", "SUBSTITUIR"].includes(l.decisao)) { r.ignoradas++; continue; }
    const velha = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true, status: true } });
    if (velha && velha.status !== "CANCELADO") { r.jaExistiam++; continue; }
    // a conta antiga foi cancelada: libera a chave para a nova (a cancelada fica com a chave marcada)
    if (velha) await prisma.finTitulo.update({ where: { id: velha.id }, data: { chaveImport: `${chave}|CANCELADA|${velha.id}`.slice(0, 190) } });
    const valor = r2(l.valor);
    const rateio = Number(l.contaId) ? [{ contaId: Number(l.contaId), pct: 100 }] : [];
    const obs = `IMPORTADO DA POSIÇÃO DE TÍTULOS${l.emissao ? ` · EMISSÃO ${dBR(l.emissao)}` : ""}${l.tituloOrig ? ` · ${l.tituloOrig}` : ""}`;
    if (l.decisao === "SUBSTITUIR" && l.alvo?.id) {
      const t = await prisma.finTitulo.findUnique({ where: { id: Number(l.alvo.id) } });
      if (t && t.status === "ABERTO") {
        await prisma.finTitulo.update({
          where: { id: t.id },
          data: {
            valor, vencimento: dataUTC(l.vencimento), previsao: false, valorConfirmado: true,
            numeroDoc: t.numeroDoc || l.tituloOrig || null, chaveImport: t.chaveImport || chave,
            documento: t.documento || l.documento || null,
            ...(rateio.length && !(Array.isArray(t.rateio) && t.rateio.length) ? { rateio } : {}),
            observacao: [t.observacao, `VALOR DA POSIÇÃO DE TÍTULOS (${l.tituloOrig || "SISTEMA ANTIGO"})`].filter(Boolean).join(" · ").slice(0, 500),
            atualizadoPorNome: quem || null,
          },
        });
        { const { registrarValorGuia } = await import("@/lib/finGuias"); await registrarValorGuia(t.id, quem).catch(() => null); }
        r.substituidas++; r.valorSubstituido = r2(r.valorSubstituido + valor);
        continue;
      }
      // a previsão sumiu ou já foi baixada: cai para importar
    }
    await prisma.finTitulo.create({
      data: {
        tipo: l.tipo, titulo: tituloDe(l), parceiro: l.parceiro || "SEM PARCEIRO", documento: l.documento || null,
        numeroDoc: l.tituloOrig || null, valor, vencimento: dataUTC(l.vencimento), competencia: mesDe(l.vencimento),
        previsao: false, rateio, observacao: obs.slice(0, 500), forma: "IMPORTACAO", chaveImport: chave,
        criadoPorId: usuarioId || null, criadoPorNome: quem || null,
      },
    });
    r.criadas++; r.valorCriado = r2(r.valorCriado + valor);
  }
  return r;
}
