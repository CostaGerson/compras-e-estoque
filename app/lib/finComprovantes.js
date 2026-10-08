// Baixa de contas a pagar pelos comprovantes do banco (v124)
// O relatório de comprovantes do Bradesco (Net Empresa / celular) traz um comprovante por página
// (PIX, boleto de cobrança, TED…). Cada página é lida, casada com as contas em aberto e, depois que o
// operador confirma, a conta é baixada e leva a página do comprovante como anexo.
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { linhasPdf } from "@/lib/finParse";
import { normRegra } from "@/lib/fin";
import { r2, dataUTC } from "@/lib/finTitulos";

const DIA = 86400000;
const JANELA = 25;                 // dias entre o pagamento e o vencimento
const num = (s) => { const x = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const dataBR = (s) => { const m = String(s || "").match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const so = (s) => String(s || "").replace(/\D/g, "");
const PROPRIAS = { "48011287": "MERIDIAN", "55116246": "NORT" };
const GEN = new Set("LTDA ME EPP EIRELI SA S A DE DA DO DAS DOS E EM PARA COM COMERCIO INDUSTRIA IND COM SERVICOS INSTITUICAO PAGAMENTO PAGAMENTOS FUNDO INVESTIMENTO".split(" "));
const tk = (s) => [...new Set(normRegra(s).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 3 && !GEN.has(p) && !/^\d+$/.test(p)))];
export const chaveHash = (chave) => createHash("sha256").update(`COMPROVANTE|${chave}`).digest("hex");

export const ehComprovante = (L) => L.slice(0, 4).some((l) => /Comprovante de Transa[cç][aã]o Banc[aá]ria/i.test(l));

// uma página → um comprovante
export function lerPagina(L) {
  const t = L.join("\n");
  const campo = (re) => { const l = L.find((x) => re.test(x)); return l ? l.replace(re, "").trim() : ""; };
  const i0 = L.findIndex((l) => /Comprovante de Transa/i.test(l));
  const tipoTxt = (L[i0 + 1] || "").trim();
  const tipo = /PIX/i.test(tipoTxt) ? "PIX" : /BOLETO/i.test(tipoTxt) ? "BOLETO" : /TED|DOC|TRANSFER/i.test(tipoTxt) ? "TED" : /TRIBUT|DARF|GPS|CONV[EÊ]NIO|CONCESSION/i.test(tipoTxt) ? "TRIBUTO" : tipoTxt.toUpperCase() || "OUTRO";
  const data = dataBR(campo(/^Data de d[eé]bito:\s*/i)) || dataBR(campo(/^Data da opera[cç][aã]o:\s*/i)) || dataBR(t);
  // v165: layout "Pagar Boletos de Cobrança Registrados" (iText) escreve os valores sem R$ (Valor a cobrar / Valor do Documento)
  const vt = t.match(/Valor total:?\s*R\$\s*([\d.]+,\d{2})/i) || t.match(/(?:^|\n)\s*Valor:?\s*R\$\s*([\d.]+,\d{2})/i) || t.match(/R\$\s*([\d.]+,\d{2})/)
    || t.match(/Valor (?:a cobrar|pago|cobrado):?\s*([\d.]+,\d{2})/i) || t.match(/Valor do Documento:?\s*([\d.]+,\d{2})/i);
  // boleto: valor do título, abatimentos e encargos (multa + juros) — explicam a diferença para a conta lançada
  const vCampo = (re) => { const l = L.find((x) => re.test(x)); const m = l && l.replace(re, "").match(/^\s*(?:R\$\s*)?([\d.]+,\d{2})/); return m ? num(m[1]) : 0; };
  const principal = vCampo(/^Valor:?\s*(?=R\$)/i) || vCampo(/^Valor do Documento:?/i);
  const multa = vCampo(/^Multa:?/i), juros = vCampo(/^Juros:?/i);
  const desconto = r2(vCampo(/^Descontos?:?/i) + vCampo(/^Abatimentos?:?/i) + vCampo(/^Bonifica[cç][aã]o:?/i));
  const docCtl = t.match(/(?:^|\n)\s*Documento:\s*(\d+)/i)?.[1] || "";
  const ctl = so(t.match(/N[°º] de controle:\s*([\d.]+)/i)?.[1] || "");
  const ident = campo(/^Identificador:\s*/i);
  const empresaTxt = campo(/^Empresa:\s*/i);
  const cnpjEmp = so(empresaTxt.match(/CNPJ:\s*([\d./-]+)/i)?.[1] || "").replace(/^0(?=\d{14}$)/, "");
  const empresa = PROPRIAS[cnpjEmp.slice(0, 8)] || (/NORT/.test(normRegra(empresaTxt)) ? "NORT" : "MERIDIAN");
  let favorecido = "", fantasia = "", final = "", documento = "", docFinal = "";
  if (tipo === "BOLETO") {
    const iRs = L.findIndex((l) => /^Raz[aã]o Social\s/i.test(l));
    favorecido = iRs >= 0 ? L[iRs].replace(/^Raz[aã]o Social\s*/i, "").trim() : "";
    fantasia = campo(/^Nome Fantasia\s*/i);
    const iFin = L.findIndex((l, k) => k > iRs && /^Raz[aã]o Social\s/i.test(l));
    final = iFin >= 0 ? L[iFin].replace(/^Raz[aã]o Social\s*/i, "").trim() : "";
    if (/N[aã]o informado/i.test(final)) final = "";
    documento = so(campo(/^CPF\/CNPJ Benefici[aá]rio:\s*/i));
    // sem dois-pontos: antes do bloco "Beneficiário Final" é o do beneficiário; depois dele, o do beneficiário final
    L.forEach((l, k) => {
      if (!/^CPF\/CNPJ Benefici[aá]rio\s+[\d.]/i.test(l)) return;
      if (!documento && (iFin < 0 || k < iFin)) documento = so(l);
      else if (!docFinal) docFinal = so(l);
    });
  } else {
    favorecido = campo(/^Nome:\s*/i);
    documento = so(campo(/^CPF\/CNPJ:\s*/i));
  }
  const descricao = campo(/^Descri[cç][aã]o:\s*/i);
  const codBarras = campo(/^C[oó]digo de barras:\s*/i);
  const vencBoleto = dataBR(campo(/^Data de vencimento:\s*/i));
  const norm = (d) => (d.length === 15 && d.startsWith("0") ? d.slice(1) : d);   // Bradesco escreve CNPJ com 15 dígitos (0 na frente)
  documento = norm(documento); docFinal = norm(docFinal);
  const propria = !!PROPRIAS[documento.slice(0, 8)] || /^(MERIDIAN|NORT SPORTS)\b/.test(normRegra(favorecido));
  return {
    tipo, data, valor: vt ? num(vt[1]) : 0, favorecido: favorecido.toUpperCase(), fantasia: fantasia.toUpperCase(), final: final.toUpperCase(),
    documento, docFinal, descricao, codBarras, vencBoleto, empresa, propria,
    principal: principal || null, multa, juros, desconto, encargos: r2(multa + juros),
    chave: [tipo, ident || `${ctl}|${docCtl}`, data, vt ? vt[1] : ""].join("|"),
  };
}

export async function lerComprovantes(nome, buf, senha) {
  const pags = await linhasPdf(buf, senha);
  const out = [];
  pags.forEach((p, i) => {
    const L = p.map((l) => l.its.map((x) => x.s).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!ehComprovante(L)) return;
    out.push({ ...lerPagina(L), arquivo: nome, pagina: i + 1 });
  });
  return out;
}

// parecença entre o comprovante e a conta: CNPJ igual ou nome do fornecedor no comprovante
function parecenca(c, t) {
  const doc = so(t.documento);
  const docOk = doc.length >= 11 && [c.documento, c.docFinal].some((d) => d && (d === doc || (d.length === 14 && doc.length === 14 && d.slice(0, 8) === doc.slice(0, 8))
    || (d.length === 6 && doc.length === 11 && doc.slice(3, 9) === d)));   // CPF mascarado no PIX: ***.210.046-**
  const alvo = tk(`${t.parceiro}`);
  const txt = new Set(tk(`${c.favorecido} ${c.fantasia} ${c.final} ${c.descricao}`));
  const sim = alvo.length ? alvo.filter((p) => txt.has(p)).length / alvo.length : 0;
  const alvo2 = tk(t.titulo);
  const sim2 = alvo2.length ? alvo2.filter((p) => txt.has(p)).length / alvo2.length : 0;
  return { docOk, sim: Math.max(sim, sim2 * 0.8) };
}

// casa cada comprovante com uma conta em aberto (uma conta só serve a um comprovante)
export function casar(comps, titulos) {
  const pares = [];
  comps.forEach((c, ci) => {
    if (c.propria || !c.valor || !c.data) return;
    const dc = new Date(`${c.data}T00:00:00Z`);
    for (const t of titulos) {
      const v = Number(t.valor), dif = r2(c.valor - v);
      const dias = Math.round((dc - new Date(t.vencimento)) / DIA);
      if (Math.abs(dias) > JANELA) continue;
      const tol = Math.max(0.02, v * 0.005);
      // valor do título no comprovante (antes de multa/juros/desconto) igual à conta = diferença explicada pelos encargos
      const base = c.principal || r2(c.valor - (c.encargos || 0) + (c.desconto || 0));
      const explicada = (c.encargos > 0 || c.desconto > 0) && Math.abs(base - v) <= tol;
      const exato = Math.abs(dif) <= tol || explicada;
      const { docOk, sim } = parecenca(c, t);
      const forte = docOk || sim >= 0.5;
      // valor maior que a conta até 15% (juros/multa) só com CNPJ ou nome batendo
      if (!exato && !(forte && dif > 0 && dif / v <= 0.15)) continue;
      if (exato && !forte && Math.abs(dias) > 10) continue;
      const vencIgual = c.vencBoleto && t.vencimento.toISOString?.().slice(0, 10) === c.vencBoleto;
      const score = (exato ? 100 : 40) + (docOk ? 60 : 0) + sim * 40 + (vencIgual ? 10 : 0) - Math.abs(dias);
      const confianca = exato && forte ? "ALTA" : exato || (forte && Math.abs(dif) <= 0.02 * v) ? "MEDIA" : "BAIXA";
      pares.push({ ci, t, dif, dias, docOk, sim: r2(sim), score: score + (explicada ? 15 : 0), confianca, explicada });
    }
  });
  pares.sort((a, b) => b.score - a.score);
  const usadoC = new Set(), usadoT = new Set(), escolhido = {}, alternativas = {};
  for (const p of pares) {
    (alternativas[p.ci] = alternativas[p.ci] || []).push(p);
    if (usadoC.has(p.ci) || usadoT.has(p.t.id)) continue;
    usadoC.add(p.ci); usadoT.add(p.t.id); escolhido[p.ci] = p;
  }
  return { escolhido, alternativas };
}

const brl = (v) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const saidaT = (t) => ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: (t.vencimento.toISOString ? t.vencimento.toISOString() : String(t.vencimento)).slice(0, 10), previsao: t.previsao, recorrenciaId: t.recorrenciaId, numeroDoc: t.numeroDoc });

// comprovantes lidos → sugestão de baixa de cada um
export async function analisarComprovantes(comps) {
  if (!comps.length) return [];
  const datas = comps.filter((c) => c.data).map((c) => new Date(`${c.data}T00:00:00Z`).getTime());
  const de = new Date(Math.min(...datas) - JANELA * DIA), ate = new Date(Math.max(...datas) + JANELA * DIA);
  const titulos = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", status: "ABERTO", vencimento: { gte: de, lte: ate } },
    select: { id: true, titulo: true, parceiro: true, documento: true, valor: true, vencimento: true, previsao: true, recorrenciaId: true, numeroDoc: true, chaveImport: true },
  });
  const { escolhido, alternativas } = casar(comps, titulos.filter((t) => !String(t.chaveImport || "").startsWith("SEMANA|")));
  // comprovante já usado numa baixa (mesma chave) não entra de novo
  const hashes = comps.map((c) => chaveHash(c.chave));
  const ja = await prisma.finTituloAnexo.findMany({ where: { hash: { in: hashes }, titulo: { status: { not: "CANCELADO" } } }, select: { hash: true, titulo: { select: { id: true, titulo: true } } } });
  const jaPor = Object.fromEntries(ja.map((a) => [a.hash, a.titulo]));
  return comps.map((c, i) => {
    const p = escolhido[i];
    const h = hashes[i];
    return {
      k: `${c.arquivo}#${c.pagina}`, ...c, hash: h,
      jaBaixado: jaPor[h] ? { id: jaPor[h].id, titulo: jaPor[h].titulo } : null,
      alvo: p ? { ...saidaT(p.t), diferenca: p.dif, dias: p.dias, confianca: p.confianca, explicada: !!p.explicada, motivo: [p.docOk ? "CNPJ/CPF igual" : null, p.sim >= 0.5 ? "nome do fornecedor no comprovante" : null, Math.abs(p.dif) <= 0.02 ? "mesmo valor" : p.explicada ? `conta ${brl(Number(p.t.valor))}${c.juros ? ` + juros ${brl(c.juros)}` : ""}${c.multa ? ` + multa ${brl(c.multa)}` : ""}${c.desconto ? ` − desconto ${brl(c.desconto)}` : ""} = pago ${brl(c.valor)} ✓` : c.encargos > 0 ? `diferença ${brl(p.dif)} NÃO bate com juros+multa do comprovante (${brl(c.encargos)})` : `diferença ${brl(p.dif)} (juros/multa?)`, `pago ${p.dias === 0 ? "no vencimento" : p.dias > 0 ? `${p.dias} dia(s) depois do vencimento` : `${-p.dias} dia(s) antes do vencimento`}`].filter(Boolean).join(" · ") } : null,
      opcoes: [...(p ? [p] : []), ...(alternativas[i] || []).filter((x) => !p || x.t.id !== p.t.id)].slice(0, 6).map((x) => ({ ...saidaT(x.t), diferenca: x.dif, dias: x.dias, confianca: x.confianca, explicada: !!x.explicada })),
      aviso: c.propria ? "Transferência entre contas da própria empresa — não baixa conta a pagar." : !p ? "Nenhuma conta em aberto com esse valor/fornecedor perto dessa data." : null,
    };
  });
}

// separa uma página do PDF (o comprovante) em um PDF próprio
async function paginaPdf(b64, pagina) {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(Buffer.from(b64, "base64"), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const [p] = await out.copyPages(src, [pagina - 1]);
  out.addPage(p);
  return Buffer.from(await out.save()).toString("base64");
}

// itens: [{ k, tituloId, arquivo, pagina, data, valor, tipo, favorecido, chave }] confirmados pelo operador
export async function baixarComprovantes(itens, arquivos, { quem } = {}) {
  const porNome = Object.fromEntries((arquivos || []).map((a) => [a.nome, a]));
  const r = { baixadas: 0, linhas: [], erros: [] };
  const usados = new Set();
  for (const it of itens) {
    try {
      const id = Number(it.tituloId);
      if (!id || usados.has(id)) continue;
      const t = await prisma.finTitulo.findUnique({ where: { id } });
      if (!t) throw new Error("conta não encontrada");
      if (t.status !== "ABERTO") { r.linhas.push(`${t.titulo}: já ${t.status === "PAGO" ? "baixada" : "cancelada"} — ignorada`); continue; }
      const h = chaveHash(it.chave);
      if (await prisma.finTituloAnexo.findFirst({ where: { hash: h, titulo: { status: { not: "CANCELADO" } } }, select: { id: true } })) { r.linhas.push(`${it.favorecido}: comprovante já usado — ignorado`); continue; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(it.data || "")) throw new Error("comprovante sem data");
      const valor = r2(it.valor);
      await prisma.finTitulo.update({
        where: { id },
        data: {
          status: "PAGO", dataPagamento: dataUTC(it.data), valorPago: valor, previsao: false, valorConfirmado: true,
          ...(t.formaPagamento ? {} : { formaPagamento: ["PIX", "BOLETO", "TED"].includes(it.tipo) ? it.tipo : null }),
          observacao: [t.observacao, `BAIXA POR COMPROVANTE ${it.tipo} ${it.data.split("-").reverse().join("/")} · ${it.favorecido}`,
            (Number(it.juros) || Number(it.multa) || Number(it.desconto)) ? `CONTA ${brl(t.valor)}${Number(it.juros) ? ` + JUROS ${brl(it.juros)}` : ""}${Number(it.multa) ? ` + MULTA ${brl(it.multa)}` : ""}${Number(it.desconto) ? ` − DESCONTO ${brl(it.desconto)}` : ""} = PAGO ${brl(valor)}` : null,
          ].filter(Boolean).join(" · ").slice(0, 500),
          atualizadoPorNome: quem || null,
        },
      });
      usados.add(id);
      const a = porNome[it.arquivo];
      if (a?.conteudo) {
        let conteudo = a.conteudo;
        try { conteudo = await paginaPdf(a.conteudo, Number(it.pagina) || 1); } catch { /* sem separar: vai o relatório inteiro */ }
        const nome = `COMPROVANTE ${it.tipo} ${it.data.split("-").reverse().join("-")} ${String(it.favorecido || "").slice(0, 40)}.pdf`.replace(/[\\/:*?"<>|]/g, "");
        await prisma.finTituloAnexo.create({ data: { tituloId: id, nome, mime: "application/pdf", tamanho: Math.floor(conteudo.length * 3 / 4), conteudo, hash: h, criadoPorNome: quem || null } });
      }
      r.baixadas++;
      r.linhas.push(`${t.titulo}: baixada em ${it.data.split("-").reverse().join("/")} · R$ ${valor.toFixed(2).replace(".", ",")}`);
    } catch (e) { r.erros.push(`${it.favorecido || it.k}: ${e.message}`); }
  }
  return r;
}
