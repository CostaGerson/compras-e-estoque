// "Importar documento" das contas a pagar: lê o PDF, entende o que é, acha a conta certa,
// atualiza o valor e anexa o arquivo.
//  · FOLHA      — Folha de Pagamento (Alterdata): total líquido + líquido por funcionário
//  · LIQUIDOS   — Resumo de Líquidos (Alterdata): líquido por funcionário + total
//    Folha e resumo da mesma empresa/mês viram UM lançamento: o SALÁRIO do 5º dia útil do mês seguinte
//    (MERIDIAN → recorrência SALÁRIO da Matriz; NORT → NORT — FOLHA 5º DIA ÚTIL). O que vale é o líquido.
//    Sócios (IGOR, PEDRO, MAYCON) não estão na folha: o pró-labore é fixo e fica nas contas próprias.
//  · RECIBO     — Recibo de pagamento (ex.: estagiário): valor, referência, nome e data
// Para incluir outro tipo: um detector novo em DETECTORES.
import { prisma } from "@/lib/prisma";
import { linhasPdf } from "@/lib/finParse";
import { normRegra } from "@/lib/fin";
import { dataUTC, mesDe, r2 } from "@/lib/finTitulos";
import { conferirFolhaMatriz, deptoDaFuncao } from "@/lib/finFolhaMatriz";
import { CONTA_DEPTO } from "@/lib/finMatrizRec";

const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const num = (s) => { const x = Number(String(s || "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const iso = (d) => d.toISOString().slice(0, 10);
const dBR = (s) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
const somaMes = (c, n) => { const [a, m] = c.split("-").map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return iso(d).slice(0, 7); };
const nomeMes = (c) => { const [a, m] = c.split("-").map(Number); return `${MESES[m - 1].toLowerCase()}/${a}`; };
const empresaDe = (txt) => (/\bNORT\b/.test(normRegra(txt)) ? "NORT" : "MERIDIAN");
const ref = (txt) => {   // "01/09/2026 a 30/09/2026" → { de, ate, comp }
  const m = txt.match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? { de: `${m[3]}-${m[2]}-${m[1]}`, ate: `${m[6]}-${m[5]}-${m[4]}`, comp: `${m[6]}-${m[5]}` } : null;
};

export async function textoDoc(buf) {
  const pags = await linhasPdf(buf);
  return pags.flat().map((l) => l.its.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean);
}

// ---------------- detectores ----------------
const DETECTORES = [
  {
    tipo: "LIQUIDOS",
    casa: (L) => L.some((l) => /RESUMO DE L[IÍ]QUIDOS/i.test(l)),
    ler(L) {
      const t = L.join("\n");
      const r = ref(t);
      const funcionarios = [];
      for (const l of L) { const m = l.match(/^(\d{6})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})$/); if (m) funcionarios.push({ codigo: m[1], nome: m[2].toUpperCase(), liquido: num(m[3]) }); }
      const tot = t.match(/Total por Empresa\s*=>\s*([\d.]+,\d{2})/i);
      return { empresa: empresaDe(L.slice(0, 3).join(" ")), ref: r, total: tot ? num(tot[1]) : r2(funcionarios.reduce((s, f) => s + f.liquido, 0)), funcionarios };
    },
  },
  {
    tipo: "FOLHA",
    casa: (L) => L.some((l) => /^FOLHA DE PAGAMENTO$/i.test(l)) && L.some((l) => /Total L[ií]quido/i.test(l)),
    ler(L) {
      const t = L.join("\n");
      const emp = (L.find((l) => /^Empresa\s*:/i.test(l)) || "").replace(/^Empresa\s*:\s*/i, "");
      const funcionarios = [];
      let atual = null;
      for (const l of L) {
        const h = l.match(/^(\d{6})\s+(.+?)\s+([\d.]+,\d{2})\s+Fun[cç][aã]o\s*:?\s*(.*?)(?:\s+Livro.*)?$/i);
        if (h) { atual = { codigo: h[1], nome: h[2].toUpperCase(), salario: num(h[3]), funcao: h[4].toUpperCase().trim(), adiantamento: false, liquido: null }; funcionarios.push(atual); continue; }
        if (atual && /^606\s+Adiantamento/i.test(l)) atual.adiantamento = true;
        const tot = l.match(/^([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+\*+\s+([\d.]+,\d{2})$/);
        if (tot && atual && atual.liquido == null) atual.liquido = num(tot[3]);
      }
      const liq = t.match(/Total L[ií]quido\s*\**\s*([\d.]+,\d{2})/i);
      const bruto = t.match(/Total Geral da Folha\s*\**\s*([\d.]+,\d{2})/i);
      const qtd = t.match(/Total Funcion[aá]rios\s+(\d+)/i);
      return {
        empresa: empresaDe(emp), ref: ref(t), total: liq ? num(liq[1]) : 0, bruto: bruto ? num(bruto[1]) : null,
        qtdFuncionarios: qtd ? Number(qtd[1]) : funcionarios.length,
        funcionarios: funcionarios.filter((f) => f.liquido > 0),
        semLiquido: funcionarios.filter((f) => !(f.liquido > 0)).map((f) => f.nome),
      };
    },
  },
  {
    tipo: "RECIBO",
    casa: (L) => L.some((l) => /^RECIBO DE PAGAMENTO/i.test(l)),
    ler(L) {
      const t = L.join("\n");
      const v = t.match(/Valor:\s*R\$\s*([\d.]+,\d{2})/i) || t.match(/TOTAL\s+([\d.]+,\d{2})/i);
      const rm = normRegra(t).match(/REFERENCIA\s+([A-Z]+)\s+(\d{4})/);
      const comp = rm && MESES.indexOf(rm[1]) >= 0 ? `${rm[2]}-${String(MESES.indexOf(rm[1]) + 1).padStart(2, "0")}` : null;
      const dm = normRegra(t).match(/(\d{1,2}) DE ([A-Z]+) DE (\d{4})/);
      const data = dm && MESES.indexOf(dm[2]) >= 0 ? `${dm[3]}-${String(MESES.indexOf(dm[2]) + 1).padStart(2, "0")}-${dm[1].padStart(2, "0")}` : null;
      const i = L.findIndex((l) => /^_{10,}$/.test(l));
      const nome = i >= 0 ? (L[i + 1] || "").toUpperCase() : "";
      const pagador = t.match(/Recebi de\s+(.+?),/i)?.[1] || "";
      const itens = [];
      for (const l of L) {
        const m = l.match(/^(.+?)\s+([\d.]+,\d{2})$/);
        if (m && /^(SALARIO|PASSAGEM|BOLSA|AUXILIO|VALE)/.test(normRegra(m[1])) && !itens.some((x) => x.desc === m[1])) itens.push({ desc: m[1], valor: num(m[2]) });
      }
      return { empresa: empresaDe(pagador), comp, data, valor: v ? num(v[1]) : 0, nome, itens };
    },
  },
];

export async function lerDocumento(nome, buf) {
  const L = await textoDoc(buf);
  const d = DETECTORES.find((x) => x.casa(L));
  if (!d) return { arquivo: nome, tipo: "DESCONHECIDO", erro: "Não reconheci este documento (folha, resumo de líquidos ou recibo)." };
  return { ...d.ler(L), arquivo: nome, tipo: d.tipo };
}

// ---------------- conta de destino ----------------
async function contasDoMes(comp) {
  return prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", competencia: comp, status: { not: "CANCELADO" } },
    orderBy: { vencimento: "asc" },
    select: { id: true, titulo: true, parceiro: true, valor: true, vencimento: true, status: true, recorrenciaId: true, rateio: true },
  });
}
const saida = (t) => t && ({ id: t.id, titulo: t.titulo, parceiro: t.parceiro, valor: Number(t.valor), vencimento: iso(t.vencimento), status: t.status });

// Junta os documentos em lançamentos e acha a conta de cada um
export async function analisarDocumentos(docs) {
  const itens = [];
  // folha + resumo de líquidos da mesma empresa e mês → um lançamento
  const folhas = new Map();
  for (const d of docs.filter((x) => x.tipo === "FOLHA" || x.tipo === "LIQUIDOS")) {
    const k = `${d.empresa}|${d.ref?.comp || "?"}`;
    if (!folhas.has(k)) folhas.set(k, []);
    folhas.get(k).push(d);
  }
  const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: ["MATRIZ|pessoal|SALARIO", "NORT|FOLHA5"] } }, select: { id: true, chaveOrigem: true } });
  const recDe = Object.fromEntries(recs.map((r) => [r.chaveOrigem, r.id]));
  for (const [k, ds] of folhas) {
    const [empresa, compRef] = k.split("|");
    const folha = ds.find((x) => x.tipo === "FOLHA"), liq = ds.find((x) => x.tipo === "LIQUIDOS");
    const valor = r2((folha || liq).total);
    const comp = compRef !== "?" ? somaMes(compRef, 1) : null;   // folha de setembro → paga no 5º dia útil de outubro
    const avisos = [];
    if (folha && liq) {
      if (Math.abs(folha.total - liq.total) > 0.01) avisos.push(`Folha (${folha.total.toFixed(2)}) e resumo de líquidos (${liq.total.toFixed(2)}) não batem.`);
      const porCod = Object.fromEntries(liq.funcionarios.map((f) => [f.codigo, f]));
      for (const f of folha.funcionarios) {
        const o = porCod[f.codigo];
        if (!o) avisos.push(`${f.nome} está na folha e não no resumo de líquidos.`);
        else if (Math.abs(o.liquido - f.liquido) > 0.01) avisos.push(`${f.nome}: folha ${f.liquido.toFixed(2)} × resumo ${o.liquido.toFixed(2)}.`);
      }
    }
    const somaFunc = r2((liq || folha).funcionarios.reduce((s, f) => s + f.liquido, 0));
    if (Math.abs(somaFunc - valor) > 0.01) avisos.push(`A soma dos líquidos (${somaFunc.toFixed(2)}) difere do total (${valor.toFixed(2)}).`);
    const opcoes = comp ? await contasDoMes(comp) : [];
    // todos da folha (com líquido) precisam estar na Matriz de custos — só a da Meridian
    const base = (folha || liq).funcionarios.map((f) => ({ ...f, ...(folha?.funcionarios.find((x) => x.codigo === f.codigo) || {}) }));
    const matriz = empresa === "MERIDIAN" ? await conferirFolhaMatriz(base) : null;
    // rateio do salário pelo setor de cada funcionário (Matriz; quem não está nela, pela função) — peso = líquido
    const contas = await prisma.finConta.findMany({ select: { id: true, codigo: true } });
    const idConta = Object.fromEntries(contas.map((c) => [c.codigo, c.id]));
    let rateio;
    if (empresa === "NORT") rateio = idConta["2154000"] ? [{ contaId: idConta["2154000"], pct: 100 }] : null;
    else {
      const setor = {};
      for (const o of matriz?.ok || []) setor[o.folha] = o.depto;
      for (const f of matriz?.faltam || []) setor[f.nome] = f.depto;
      const porConta = {};
      for (const f of base) {
        const cod = CONTA_DEPTO[setor[f.nome] || deptoDaFuncao(f.funcao || "")] || "2128200";
        porConta[cod] = (porConta[cod] || 0) + f.liquido;
      }
      const tot = Object.values(porConta).reduce((a, v) => a + v, 0);
      const linhas = Object.entries(porConta).filter(([c]) => idConta[c]).sort((a, b) => b[1] - a[1])
        .map(([c, v]) => ({ contaId: idConta[c], codigo: c, pct: r2((v / tot) * 100) }));
      if (linhas.length) { const dif = r2(100 - linhas.reduce((a, l) => a + l.pct, 0)); linhas[0].pct = r2(linhas[0].pct + dif); }
      rateio = linhas.length ? linhas.map(({ contaId, pct }) => ({ contaId, pct })) : null;
    }
    const chave = empresa === "NORT" ? "NORT|FOLHA5" : "MATRIZ|pessoal|SALARIO";
    let alvo = opcoes.find((t) => recDe[chave] && t.recorrenciaId === recDe[chave]);
    if (!alvo) alvo = opcoes.find((t) => /^SAL[AÁ]RIO/.test(t.titulo) && (empresa === "NORT") === /NORT/.test(`${t.titulo} ${t.parceiro}`))
      || (empresa === "NORT" ? opcoes.find((t) => /NORT/.test(t.titulo) && /FOLHA|SAL[AÁ]RIO/.test(t.titulo) && !/ADIANT/.test(t.titulo)) : null);
    itens.push({
      chave: `FOLHA|${k}`, tipo: "FOLHA", empresa, comp, refTexto: compRef !== "?" ? nomeMes(compRef) : "?",
      descricao: `Folha de ${compRef !== "?" ? nomeMes(compRef) : "?"} — ${empresa} · líquido de ${(liq || folha).funcionarios.length} funcionário(s)`,
      valor, arquivos: ds.map((x) => x.arquivo), docs: ds.map((x) => x.tipo),
      funcionarios: (liq || folha).funcionarios, bruto: folha?.bruto ?? null, avisos,
      nota: "Sócios (IGOR, PEDRO, MAYCON) não entram na folha — o pró-labore fixo de R$ 6.000 fica nas contas próprias.",
      matriz, ref: compRef, rateio,
      alvo: saida(alvo), opcoes: opcoes.map(saida),
    });
  }
  // recibos
  for (const d of docs.filter((x) => x.tipo === "RECIBO")) {
    const comp = d.comp || (d.data ? mesDe(d.data) : null);
    const opcoes = comp ? await contasDoMes(comp) : [];
    const pal = normRegra(d.nome).split(" ").filter((w) => w.length >= 3);
    const palavra = (t, w) => new RegExp(`(^| )${w}( |$)`).test(normRegra(`${t.titulo} ${t.parceiro}`));
    const recsEst = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { startsWith: "MATRIZ|pessoal|ESTAGIO|" } }, select: { id: true } });
    const idsEst = new Set(recsEst.map((x) => x.id));
    const alvo = opcoes.find((t) => idsEst.has(t.recorrenciaId) && pal.length && palavra(t, pal[0]))
      || opcoes.find((t) => pal.length && palavra(t, pal[0]) && (pal[1] ? palavra(t, pal[1]) || /ESTAGI|RECIBO/.test(normRegra(t.titulo)) : true))
      || opcoes.find((t) => idsEst.has(t.recorrenciaId));
    // sugestão de conta-caixa para criar: última conta usada pelo mesmo nome
    const ant = await prisma.finTitulo.findFirst({ where: { tipo: "PAGAR", parceiro: d.nome }, orderBy: { createdAt: "desc" }, select: { rateio: true } });
    itens.push({
      chave: `RECIBO|${d.nome}|${comp}`, tipo: "RECIBO", empresa: d.empresa, comp, refTexto: comp ? nomeMes(comp) : "?",
      descricao: `Recibo de ${d.nome || "?"} — ${comp ? nomeMes(comp) : "?"}`,
      valor: r2(d.valor), arquivos: [d.arquivo],
      itens: d.itens, data: d.data, nome: d.nome, avisos: d.valor > 0 ? [] : ["Não achei o valor do recibo."],
      alvo: saida(alvo), opcoes: opcoes.map(saida),
      novo: { titulo: `${/ESTAGI/.test(normRegra(d.nome)) ? "" : "ESTAGIÁRIO — "}${d.nome}`.slice(0, 120), parceiro: d.nome, vencimento: d.data || (comp ? `${comp}-05` : null),
        contaId: Array.isArray(ant?.rateio) && ant.rateio.length ? ant.rateio[0].contaId : null },
    });
  }
  return itens;
}

// ---------------- aplicar ----------------
// item: { tipo, valor, comp, descricao, arquivos:[nomes], alvoId? , criar?: { titulo, parceiro, vencimento, contaId } }
export async function aplicarDocumentos(itens, arquivos, { quem, usuarioId } = {}) {
  const porNome = Object.fromEntries((arquivos || []).map((a) => [a.nome, a]));
  const r = { atualizadas: 0, criadas: 0, anexos: 0, linhas: [], ids: [] };
  for (const it of itens) {
    const valor = r2(it.valor);
    let id = Number(it.alvoId) || null;
    if (id) {
      const t = await prisma.finTitulo.findUnique({ where: { id } });
      if (!t) throw new Error(`Conta ${id} não encontrada.`);
      if (t.status === "ABERTO") {
        const antes = Number(t.valor);
        await prisma.finTitulo.update({
          where: { id },
          data: {
            valor, previsao: false, valorConfirmado: true, atualizadoPorNome: quem || null,
            ...(Array.isArray(it.rateio) && it.rateio.length ? { rateio: it.rateio.map((x) => ({ contaId: Number(x.contaId), pct: r2(x.pct) })) } : {}),
            observacao: [t.observacao, `${it.descricao} · R$ ${valor.toFixed(2).replace(".", ",")}`].filter(Boolean).join(" · ").slice(0, 500),
          },
        });
        r.atualizadas++;
        r.linhas.push(`${t.titulo}: ${antes.toFixed(2)} → ${valor.toFixed(2)}`);
      } else {
        r.linhas.push(`${t.titulo}: já ${t.status === "PAGO" ? "baixada" : t.status.toLowerCase()} — só anexei o documento`);
      }
    } else if (it.criar) {
      const c = it.criar;
      if (!Number(c.contaId)) throw new Error(`${it.descricao}: escolha a conta-caixa (o rateio é obrigatório).`);
      if (!c.vencimento) throw new Error(`${it.descricao}: informe o vencimento.`);
      const t = await prisma.finTitulo.create({
        data: {
          tipo: "PAGAR", titulo: String(c.titulo || it.descricao).toUpperCase().slice(0, 120), parceiro: String(c.parceiro || "").toUpperCase() || "SEM PARCEIRO",
          valor, vencimento: dataUTC(c.vencimento), competencia: mesDe(c.vencimento), previsao: false, valorConfirmado: true,
          rateio: [{ contaId: Number(c.contaId), pct: 100 }], observacao: it.descricao.slice(0, 500), forma: "MANUAL",
          criadoPorId: usuarioId || null, criadoPorNome: quem || null,
        },
      });
      id = t.id; r.criadas++;
      r.linhas.push(`${t.titulo}: criada com R$ ${valor.toFixed(2)}`);
    } else { r.ids.push(null); continue; }
    r.ids.push(id);
    for (const n of it.arquivos || []) {
      const a = porNome[n];
      if (!a?.conteudo) continue;
      const ja = await prisma.finTituloAnexo.findFirst({ where: { tituloId: id, nome: a.nome }, select: { id: true } });
      if (ja) continue;
      await prisma.finTituloAnexo.create({
        data: { tituloId: id, nome: a.nome, mime: "application/pdf", tamanho: Math.floor(a.conteudo.length * 3 / 4), conteudo: a.conteudo, criadoPorNome: quem || null },
      });
      r.anexos++;
    }
  }
  return r;
}
