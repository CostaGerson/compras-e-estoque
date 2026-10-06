// v127 — Retorno de cobrança CNAB 400 do Bradesco (.RET)
// 1) lerRetorno: texto → cabeçalho + registros
// 2) analisarRetornos: cada registro ganha a ação e a conta a receber casada (seu número = numeroDoc, ou nosso número)
// 3) aplicarRetornos: registra / baixa (LIQUIDADO ou DESCONTADO), lança a tarifa e anexa o .RET
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { dataUTC, mesDe, r2 } from "@/lib/finTitulos";

const sub = (l, a, b) => l.slice(a - 1, b);                       // posições do layout (1-based, inclusivas)
const num = (l, a, b) => r2(Number(sub(l, a, b).replace(/\D/g, "") || 0) / 100);
const data6 = (l, a, b) => {                                      // DDMMAA → AAAA-MM-DD
  const t = sub(l, a, b);
  if (!/^\d{6}$/.test(t) || t === "000000") return null;
  return `20${t.slice(4, 6)}-${t.slice(2, 4)}-${t.slice(0, 2)}`;
};
const dBR = (s) => (s ? s.split("-").reverse().join("/") : "");
export const hashTexto = (b64) => createHash("sha256").update(Buffer.from(String(b64 || ""), "base64")).digest("hex");

export const OCORRENCIAS = {
  "02": "ENTRADA CONFIRMADA", "03": "ENTRADA REJEITADA", "06": "LIQUIDAÇÃO NORMAL", "09": "BAIXADO AUTOMATICAMENTE VIA ARQUIVO",
  "10": "BAIXADO CONFORME INSTRUÇÕES DA AGÊNCIA", "11": "EM SER", "12": "ABATIMENTO CONCEDIDO", "13": "ABATIMENTO CANCELADO",
  "14": "VENCIMENTO ALTERADO", "15": "LIQUIDAÇÃO EM CARTÓRIO", "16": "PAGO EM CHEQUE VINCULADO", "17": "LIQUIDAÇÃO APÓS BAIXA",
  "18": "ACERTO DE DEPOSITÁRIA", "19": "INSTRUÇÃO DE PROTESTO CONFIRMADA", "20": "SUSTAÇÃO DE PROTESTO", "22": "PAGAMENTO CANCELADO",
  "23": "ENTRADA EM CARTÓRIO", "24": "ENTRADA REJEITADA (CEP)", "27": "BAIXA REJEITADA", "28": "DÉBITO DE TARIFAS/CUSTAS",
  "30": "ALTERAÇÃO REJEITADA", "32": "INSTRUÇÃO REJEITADA", "33": "ALTERAÇÃO DE DADOS CONFIRMADA", "40": "ESTORNO DE PAGAMENTO",
};
const LIQ = ["06", "15", "16", "17"];

// ---------------- 1) ler ----------------
export function lerRetorno(nome, b64) {
  const txt = Buffer.from(String(b64 || ""), "base64").toString("latin1");
  const L = txt.split(/\r?\n/).map((l) => l.replace(/\r$/, "")).filter((l) => l.trim());
  const h = L.find((l) => l[0] === "0");
  if (!h || !/RETORNO/.test(sub(h, 3, 9)) || sub(h, 77, 79) !== "237") throw new Error(`${nome}: não é um retorno CNAB 400 do Bradesco.`);
  const cab = {
    arquivo: nome, banco: "237", empresa: sub(h, 47, 76).trim(), dataArquivo: data6(h, 95, 100),
    sequencia: String(Number(sub(h, 109, 113).replace(/\D/g, "") || 0)) || null, dataCredito: data6(h, 380, 385),
  };
  const registros = L.filter((l) => l[0] === "1").map((l) => {
    const motivos = (sub(l, 319, 328).match(/.{2}/g) || []).filter((m) => /^\d\d$/.test(m) && m !== "00");
    return {
      seq: sub(l, 395, 400).trim(),
      ocorrencia: sub(l, 109, 110),
      dataOcorrencia: data6(l, 111, 116),
      numeroDoc: sub(l, 117, 126).trim(),
      controle: sub(l, 38, 62).trim(),
      nosso: sub(l, 71, 82).trim(),
      carteira: sub(l, 108, 108),
      vencimento: data6(l, 147, 152),
      valor: num(l, 153, 165),
      tarifa: num(l, 176, 188),
      outrasDespesas: num(l, 189, 201),
      abatimento: num(l, 228, 240),
      desconto: num(l, 241, 253),
      valorPago: num(l, 254, 266),
      juros: num(l, 267, 279),
      dataCredito: data6(l, 296, 301),
      motivos,
    };
  });
  const tarifa = r2(registros.reduce((s, x) => s + x.tarifa + x.outrasDespesas, 0));
  return { ...cab, registros, tarifa };
}

// ---------------- 2) analisar ----------------
const normDoc = (s) => String(s || "").toUpperCase().replace(/\s+/g, "");
const normNosso = (s) => String(s || "").replace(/\D/g, "").replace(/^0+/, "");
const nossoObs = (o) => (String(o || "").match(/NOSSO N[ºO°.]*\s*:?\s*([\d.\-\/ ]{4,})/i) || [])[1] || null;

// motivos das ocorrências (manual do arquivo-retorno CNAB 400 do Bradesco, posições 319–328)
const MOTIVOS_BAIXA = {   // ocorrências 09 e 10
  "00": "ocorrência aceita", "10": "baixa comandada pelo cliente (beneficiário)", "14": "título protestado", "15": "título excluído",
  "16": "título baixado pelo banco por decurso de prazo", "17": "título baixado e transferido de carteira", "20": "título baixado e transferido para desconto",
};
const MOTIVOS_LIQ = { "00": "crédito disponível", "15": "crédito indisponível", "18": "pagamento parcial", "42": "rateio não efetuado" };
const MOTIVOS_REJEICAO = {   // ocorrências 03, 24, 27, 30, 32 — entrada / instrução rejeitada
  "02": "código do registro detalhe inválido", "03": "código da ocorrência inválida", "04": "código de ocorrência não permitida para a carteira",
  "05": "código de ocorrência não numérico", "07": "agência/conta/dígito inválido", "08": "nosso número inválido", "09": "nosso número duplicado",
  "10": "carteira inválida", "13": "identificação da emissão do boleto inválida", "16": "data de vencimento inválida", "18": "vencimento fora do prazo de operação",
  "20": "valor do título inválido", "21": "espécie do título inválida", "22": "espécie não permitida para a carteira", "24": "data de emissão inválida",
  "28": "código do desconto inválido", "38": "prazo para protesto inválido", "44": "agência beneficiário não prevista", "45": "nome do pagador não informado",
  "46": "tipo/número de inscrição do pagador inválidos", "47": "endereço do pagador não informado", "48": "CEP inválido", "50": "CEP irregular — banco correspondente",
  "63": "entrada para título já cadastrado", "65": "limite excedido", "66": "número autorização inexistente", "68": "débito não agendado — erro nos dados da remessa",
  "69": "débito não agendado — pagador não consta do cadastro de autorizante", "70": "débito não agendado — beneficiário não autorizado pelo pagador",
  "71": "débito não agendado — beneficiário não participa do débito automático", "74": "débito não agendado — conforme seu pedido, título não registrado",
};
function textoMotivos(r) {
  const tabela = ["09", "10"].includes(r.ocorrencia) ? MOTIVOS_BAIXA : LIQ.includes(r.ocorrencia) ? MOTIVOS_LIQ : MOTIVOS_REJEICAO;
  return r.motivos.map((m) => `motivo ${m}${tabela[m] ? `: ${tabela[m]}` : ""}`).join("; ");
}

// SÓ pagamento baixa a conta (06, 15, 16, 17). Entrada confirmada registra; tarifa vira conta a pagar.
// Toda outra ocorrência (baixa pelo banco ou pelo beneficiário, transferência para desconto, protesto, rejeição,
// pagamento cancelado, estorno…) NÃO baixa: vira CRÍTICA na conta, para conferir.
function acaoDe(r) {
  if (r.ocorrencia === "02") return { acao: "REGISTRAR" };
  if (LIQ.includes(r.ocorrencia)) return { acao: "LIQUIDAR" };
  if (r.ocorrencia === "28") return { acao: "TARIFA" };
  const nome = OCORRENCIAS[r.ocorrencia] || `OCORRÊNCIA ${r.ocorrencia}`;
  const mot = textoMotivos(r);
  return { acao: "CRITICA", aviso: `${nome} (ocorrência ${r.ocorrencia})${mot ? ` — ${mot}` : ""}. A conta NÃO foi baixada — confira.` };
}

export async function analisarRetornos(arquivos) {
  const lidos = arquivos.map((a) => ({ ...lerRetorno(a.nome, a.conteudo), hash: hashTexto(a.conteudo) }));
  const ja = await prisma.finRetorno.findMany({ where: { hash: { in: lidos.map((x) => x.hash) } }, select: { hash: true, createdAt: true } });
  const jaPor = Object.fromEntries(ja.map((x) => [x.hash, x.createdAt]));
  const tits = await prisma.finTitulo.findMany({
    where: { tipo: "RECEBER", status: { not: "CANCELADO" } },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, numeroDoc: true, nossoNumero: true, observacao: true, cobranca: true },
  });
  const porDoc = new Map(), porNosso = new Map();
  const add = (m, k, t) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(t); };
  for (const t of tits) {
    add(porDoc, normDoc(t.numeroDoc), t);
    const n = normNosso(t.nossoNumero || nossoObs(t.observacao));
    add(porNosso, n, t); if (n.length > 1) add(porNosso, n.slice(0, -1), t);   // com e sem o dígito
  }
  const prefere = (l) => (l || []).slice().sort((a, b) => (a.status === "ABERTO" ? 0 : 1) - (b.status === "ABERTO" ? 0 : 1))[0] || null;
  const out = lidos.map((f) => ({
    arquivo: f.arquivo, sequencia: f.sequencia, dataArquivo: f.dataArquivo, empresa: f.empresa, tarifa: f.tarifa, hash: f.hash,
    jaProcessado: jaPor[f.hash] || null,
    itens: f.registros.map((r) => {
      const { acao, aviso } = acaoDe(r);
      const n = normNosso(r.nosso);
      const t = prefere(porDoc.get(normDoc(r.numeroDoc))) || prefere(porDoc.get(normDoc(r.controle)))
        || prefere(porNosso.get(n)) || (n.length > 1 ? prefere(porNosso.get(n.slice(0, -1))) : null);
      let situacao = "OK", msg = aviso || null;
      if (["REGISTRAR", "LIQUIDAR", "CRITICA"].includes(acao)) {
        if (!t) { situacao = "SEM_CONTA"; msg = "Nenhuma conta a receber com esse nº de título / nosso número."; }
        else if (acao === "LIQUIDAR" && t.status !== "ABERTO") { situacao = "JA_BAIXADA"; msg = "Conta já baixada — nada a fazer."; }
        else if (acao === "CRITICA" && !["ABERTO", "EXECUCAO"].includes(t.status)) { situacao = "JA_BAIXADA"; msg = `${aviso} (conta já ${t.status === "PAGO" ? "recebida" : t.status.toLowerCase()} no sistema — sem crítica)`; }
        else if (acao === "REGISTRAR" && t.cobranca) { situacao = "JA_REGISTRADA"; }
      }
      return {
        k: `${f.arquivo}#${r.seq}`, arquivo: f.arquivo, ...r, acao, nomeOcorrencia: OCORRENCIAS[r.ocorrencia] || `OCORRÊNCIA ${r.ocorrencia}`,
        situacao, aviso: msg,
        alvo: t ? { id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: t.vencimento.toISOString().slice(0, 10), status: t.status } : null,
        aplicar: !!t && situacao === "OK" && ["REGISTRAR", "LIQUIDAR", "CRITICA"].includes(acao),
      };
    }),
  }));
  return { arquivos: out };
}

// ---------------- 3) aplicar ----------------
async function anexar(tituloId, f, hash, quem) {
  if (!f?.conteudo) return;
  const ja = await prisma.finTituloAnexo.findFirst({ where: { tituloId, hash }, select: { id: true } });
  if (ja) return;
  await prisma.finTituloAnexo.create({ data: { tituloId, nome: f.nome, mime: "text/plain", tamanho: Math.floor(f.conteudo.length * 3 / 4), conteudo: f.conteudo, hash, criadoPorNome: quem || null } });
}

// itens: os registros marcados para aplicar (com alvo.id); arquivos: [{ nome, conteudo }]
export async function aplicarRetornos(itens, arquivos, { quem } = {}) {
  const r = { registradas: 0, liquidadas: 0, descontadas: 0, valorLiquidado: 0, valorDescontado: 0, tarifas: 0, valorTarifas: 0, linhas: [], erros: [] };
  const lidos = [];
  for (const a of arquivos || []) {
    try { lidos.push({ ...lerRetorno(a.nome, a.conteudo), hash: hashTexto(a.conteudo), a }); }
    catch (e) { r.erros.push(e.message); }
  }
  const porNome = Object.fromEntries(lidos.map((f) => [f.arquivo, f]));
  const usados = new Set();
  for (const it of itens || []) {
    const f = porNome[it.arquivo];
    try {
      const id = Number(it.alvo?.id);
      if (!id || !f) continue;
      const reg = f.registros.find((x) => x.seq === it.seq);
      if (!reg) throw new Error("registro não encontrado no arquivo");
      const { acao } = acaoDe(reg);
      const t = await prisma.finTitulo.findUnique({ where: { id } });
      if (!t || t.tipo !== "RECEBER" || t.status === "CANCELADO") throw new Error("conta não encontrada");
      const nosso = t.nossoNumero || reg.nosso || null;
      if (acao === "REGISTRAR") {
        if (t.status === "ABERTO" && !t.cobranca) {
          await prisma.finTitulo.update({ where: { id }, data: { cobranca: "REGISTRADO", nossoNumero: nosso, formaPagamento: t.formaPagamento || "BOLETO", atualizadoPorNome: quem || null } });
          r.registradas++;
        }
        continue;
      }
      if (acao === "CRITICA") {
        if (!["ABERTO", "EXECUCAO"].includes(t.status)) continue;
        const dtc = reg.dataOcorrencia ? dBR(reg.dataOcorrencia) : dBR(f.dataArquivo);
        const txt = `Retorno ${f.sequencia || f.arquivo} (${dtc}): ${acaoDe(reg).aviso}`.slice(0, 500);
        await prisma.finTitulo.update({ where: { id }, data: { critica: txt, nossoNumero: nosso, atualizadoPorNome: quem || null,
          observacao: [t.observacao, `RETORNO ${f.sequencia || f.arquivo}: ${OCORRENCIAS[reg.ocorrencia] || reg.ocorrencia}${reg.motivos.length ? ` (MOTIVO ${reg.motivos.join(",")})` : ""}`].filter(Boolean).join(" · ").slice(0, 1000) } });
        await anexar(id, f.a, f.hash, quem);
        r.criticas = (r.criticas || 0) + 1;
        r.linhas.push(`${t.titulo}: crítica registrada (não baixada)`);
        continue;
      }
      if (acao !== "LIQUIDAR") continue;
      if (usados.has(id)) continue;
      if (t.status !== "ABERTO") { r.linhas.push(`${t.titulo}: já baixada — ignorada`); continue; }
      const liq = acao === "LIQUIDAR";
      const dt = liq ? (reg.dataCredito || reg.dataOcorrencia) : reg.dataOcorrencia;
      if (!dt) throw new Error("registro sem data");
      const valor = liq ? r2(reg.valorPago || reg.valor) : r2(Number(t.valor));
      await prisma.finTitulo.update({
        where: { id },
        data: {
          status: "PAGO", dataPagamento: dataUTC(dt), valorPago: valor, previsao: false, valorConfirmado: true,
          cobranca: liq ? "LIQUIDADO" : "DESCONTADO", nossoNumero: nosso,
          formaPagamento: liq ? (t.formaPagamento || "BOLETO") : "DESCONTO",
          observacao: [t.observacao, liq
            ? `LIQUIDADO PELO RETORNO ${f.sequencia || f.arquivo} · CRÉDITO ${dBR(dt)}${reg.juros ? ` · JUROS ${reg.juros.toFixed(2)}` : ""}`
            : `TRANSFERIDO PARA DESCONTO (RETORNO ${f.sequencia || f.arquivo}, ${dBR(dt)})`].filter(Boolean).join(" · ").slice(0, 500),
          atualizadoPorNome: quem || null,
        },
      });
      usados.add(id);
      await anexar(id, f.a, f.hash, quem);
      if (liq) { r.liquidadas++; r.valorLiquidado = r2(r.valorLiquidado + valor); }
      else { r.descontadas++; r.valorDescontado = r2(r.valorDescontado + valor); }
      r.linhas.push(`${t.titulo}: ${liq ? "liquidada" : "descontada"} em ${dBR(dt)} · R$ ${valor.toFixed(2).replace(".", ",")}`);
    } catch (e) { r.erros.push(`${it.numeroDoc || it.k}: ${e.message}`); }
  }
  // tarifas de cada retorno → conta a pagar já paga em 2134000 TAXAS
  const taxas = await prisma.finConta.findUnique({ where: { codigo: "2134000" }, select: { id: true } }).catch(() => null);
  for (const f of lidos) {
    try {
      if (f.tarifa > 0) {
        const chave = `RETORNO|237|${f.sequencia || f.hash.slice(0, 12)}|TARIFA`;
        const ja = await prisma.finTitulo.findFirst({ where: { chaveImport: chave }, select: { id: true } });
        if (!ja) {
          const dt = f.dataArquivo || f.dataCredito || new Date().toISOString().slice(0, 10);
          const t = await prisma.finTitulo.create({
            data: {
              tipo: "PAGAR", titulo: `TARIFA DE COBRANÇA BRADESCO — RETORNO ${f.sequencia || ""}`.trim(), parceiro: "BANCO BRADESCO S.A.",
              documento: "60746948000112", numeroDoc: f.sequencia || null, valor: f.tarifa, vencimento: dataUTC(dt), competencia: mesDe(dt),
              previsao: false, status: "PAGO", dataPagamento: dataUTC(dt), valorPago: f.tarifa, valorConfirmado: true,
              rateio: taxas ? [{ contaId: taxas.id, pct: 100 }] : [], forma: "IMPORTACAO", formaPagamento: "DEBITO_AUTOMATICO",
              chaveImport: chave, observacao: `TARIFAS DO RETORNO DE COBRANÇA ${f.arquivo}`, criadoPorNome: quem || null,
            },
          });
          await anexar(t.id, f.a, f.hash, quem);
          r.tarifas++; r.valorTarifas = r2(r.valorTarifas + f.tarifa);
        }
      }
      await prisma.finRetorno.upsert({
        where: { hash: f.hash },
        create: { banco: "237", sequencia: f.sequencia, nome: f.arquivo, dataArquivo: f.dataArquivo ? dataUTC(f.dataArquivo) : null, hash: f.hash, conteudo: f.a.conteudo, resumo: { registros: f.registros.length, tarifa: f.tarifa }, criadoPorNome: quem || null },
        update: {},
      });
    } catch (e) { r.erros.push(`${f.arquivo}: ${e.message}`); }
  }
  return r;
}
