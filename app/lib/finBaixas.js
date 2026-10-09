// Baixa de contas a partir do extrato: casa os lançamentos lidos com os títulos previstos
// (mesmo valor, data próxima) e devolve uma sugestão por vez para o usuário autorizar.
import { prisma } from "@/lib/prisma";

const r2 = (v) => Math.round(Number(v || 0) * 100) / 100;
const MS_DIA = 86400000;
export const JANELA_DIAS = 12;     // quanto o pagamento pode se afastar do vencimento
export const TOLERANCIA = 0.02;    // centavos de diferença aceitos sem ressalva
// v166: com o nome do credor/pagador batendo, aceita conta vencida há mais tempo e pagamento com juros/multa
export const JANELA_NOME = 60;     // dias, quando o nome bate
export const JUROS_MAX = 0.15;     // até 15% acima da conta, quando o nome bate

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const palavras = (t) => semAcento(t).replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((p) => p.length >= 4);

// quanto o histórico do extrato lembra o parceiro/título da conta
function parecenca(lanc, titulo) {
  const alvo = palavras(`${titulo.parceiro} ${titulo.titulo}`);
  if (!alvo.length) return 0;
  const texto = semAcento(`${lanc.historico} ${lanc.identificacao || ""}`);
  const achou = alvo.filter((p) => texto.includes(p)).length;
  return achou / alvo.length;
}

// v181 — o nome do prestador aparece no histórico do PIX? (aceita grafia parecida: JHONNY × JHONY, JHONATA × JHONATHA) ou a chave PIX
const lev = (a, b) => {
  const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};
function nomeNoHistorico(lanc, it) {
  const texto = semAcento(`${lanc.historico} ${lanc.identificacao || ""}`);
  const pix = String(it.chavePix || it.prestador?.chavePix || "").replace(/\D/g, "");
  if (pix.length >= 8 && texto.replace(/\D/g, " ").split(/\s+/).some((x) => x.length >= 8 && (pix.startsWith(x) || x.startsWith(pix.slice(0, 8))))) return 1;
  const alvo = semAcento(`${it.nome} ${it.prestador?.nome || ""}`).replace(/[^A-Z ]/g, " ").split(/\s+/).filter((p) => p.length >= 4);
  if (!alvo.length) return 0;
  const tks = texto.replace(/[^A-Z ]/g, " ").split(/\s+/).filter((p) => p.length >= 3);
  const bate = (p) => tks.some((t) => t === p || (p.length >= 5 && t.length >= 5 && lev(p, t) <= 1));
  const uniq = [...new Set(alvo)];
  return uniq.filter(bate).length / Math.min(uniq.length, 2);
}

// Sugestões para uma competência (ou para os lançamentos de um arquivo recém-enviado).
export async function sugestoes({ competencia, arquivoId } = {}) {
  // v181 — agora freelancers/terceirizados casam item a item: as sugestões já "vistas" voltam a aparecer uma vez
  if (!(await prisma.finConfig?.findUnique({ where: { chave: "BAIXAS|RESET|v181" } }).catch(() => true))) {
    await prisma.finLancamento.updateMany({ where: { baixaVista: true }, data: { baixaVista: false } }).catch(() => null);
    await prisma.finConfig.create({ data: { chave: "BAIXAS|RESET|v181", valor: new Date().toISOString() } }).catch(() => null);
  }
  const where = { desmembrado: false, substituido: false };
  const ids = String(arquivoId || "").split(",").map(Number).filter(Boolean);
  if (ids.length) where.arquivoId = { in: ids };
  else if (competencia) where.competencia = competencia;

  const lancamentos = await prisma.finLancamento.findMany({
    where, orderBy: [{ data: "asc" }, { ordem: "asc" }],
    select: { id: true, data: true, historico: true, identificacao: true, valor: true, banco: true, competencia: true, baixaVista: true },
  });
  if (!lancamentos.length) return { sugestoes: [], lancamentos: 0, titulos: 0 };

  // títulos ainda em aberto, no intervalo de datas dos lançamentos ± janela
  const datas = lancamentos.map((l) => new Date(l.data).getTime());
  const de = new Date(Math.min(...datas) - JANELA_NOME * MS_DIA);
  const ate = new Date(Math.max(...datas) + JANELA_DIAS * MS_DIA);
  const titulos0 = await prisma.finTitulo.findMany({
    where: { status: "ABERTO", vencimento: { gte: de, lte: ate } },
    select: { id: true, tipo: true, titulo: true, parceiro: true, valor: true, vencimento: true, formaPagamento: true, numeroDoc: true, recorrenciaId: true, competencia: true, chaveImport: true },
  });
  // v181 — freelancers e terceirizados da semana: cada item é uma conta; a casca (total) não casa com o extrato
  const titulos = titulos0.filter((t) => !String(t.chaveImport || "").startsWith("SEMANA|"));
  const itens = await prisma.finSemanaItem.findMany({
    where: { pago: false, titulo: { status: "ABERTO", vencimento: { gte: new Date(+de - 7 * MS_DIA), lte: ate } } },
    include: { titulo: { select: { id: true, titulo: true, vencimento: true } }, prestador: { select: { nome: true, chavePix: true, documento: true } } },
  }).catch(() => []);
  if (!titulos.length && !itens.length) return { sugestoes: [], lancamentos: lancamentos.length, titulos: 0 };

  // lançamentos que já deram baixa em alguma conta (ou item da semana) não entram de novo
  const usados = new Set([
    ...(await prisma.finTitulo.findMany({ where: { lancamentoId: { not: null } }, select: { lancamentoId: true } })).map((t) => t.lancamentoId),
    ...(await prisma.finSemanaItem.findMany({ where: { lancamentoId: { not: null } }, select: { lancamentoId: true } }).catch(() => [])).map((t) => t.lancamentoId),
  ]);
  const itensUsados = new Set();

  const out = [];
  const titulosUsados = new Set();
  // duas passadas: 1ª só casamentos fortes (valor exato ou nome), 2ª o resto — assim um valor parecido não "rouba" a conta de outro
  const feitos = new Set();
  for (const fase of [1, 2]) for (const l of lancamentos) {
    if (usados.has(l.id) || feitos.has(l.id)) continue;
    const saida = Number(l.valor) < 0;
    const valor = r2(Math.abs(Number(l.valor)));
    const tipo = saida ? "PAGAR" : "RECEBER";
    const dataL = new Date(l.data);

    // 1º) item da semana (freelancer/terceirizado): mesmo valor, pago perto da sexta, nome (ou PIX) no histórico
    if (saida) {
      const cs = itens.filter((it) => !itensUsados.has(it.id) && Math.abs(Number(it.valor) - valor) <= TOLERANCIA)
        .map((it) => {
          const dias = Math.round((dataL - new Date(it.titulo.vencimento)) / MS_DIA);
          return { it, dias, sim: nomeNoHistorico(l, it) };
        })
        .filter((c) => c.dias >= -JANELA_DIAS && c.dias <= JANELA_DIAS)
        .sort((a, b) => b.sim - a.sim || Math.abs(a.dias) - Math.abs(b.dias));
      const c = cs[0];
      if (c && (c.sim >= 0.5 || (fase === 2 && cs.length === 1))) {
        itensUsados.add(c.it.id); feitos.add(l.id);
        out.push({
          lancamento: { id: l.id, data: l.data, historico: l.historico, identificacao: l.identificacao, valor: Number(l.valor), banco: l.banco, vista: !!l.baixaVista },
          titulo: { id: c.it.titulo.id, itemId: c.it.id, tipo: "PAGAR", titulo: `${c.it.titulo.titulo} · ${c.it.nome}`, parceiro: c.it.nome, valor: Number(c.it.valor), vencimento: c.it.titulo.vencimento, formaPagamento: "PIX", numeroDoc: null },
          diferenca: 0, dias: c.dias, semelhanca: r2(c.sim),
          confianca: c.sim >= 0.5 ? "ALTA" : "MEDIA",
          motivo: ["mesmo valor", c.sim >= 0.5 ? "nome do prestador no extrato" : "único item da semana com esse valor"].join(" · "),
          alternativas: cs.length - 1,
        });
        continue;
      }
    }

    const candidatos = titulos
      .filter((t) => t.tipo === tipo && !titulosUsados.has(t.id))
      .map((t) => {
        const dif = r2(Math.abs(Number(t.valor) - valor));
        const dias = Math.round((dataL - new Date(t.vencimento)) / MS_DIA);
        const sim = parecenca(l, t);
        const exato = dif <= Math.max(TOLERANCIA, Number(t.valor) * 0.005);
        const nome = sim >= 0.5;
        const juros = nome && valor > Number(t.valor) && valor <= r2(Number(t.valor) * (1 + JUROS_MAX));
        return { t, dif, dias, sim, exato, nome, juros };
      })
      .filter((c) => (c.exato && Math.abs(c.dias) <= JANELA_DIAS) || (c.nome && (c.exato || c.juros) && c.dias >= -JANELA_DIAS && c.dias <= JANELA_NOME))
      .filter((c) => fase === 2 || c.dif <= TOLERANCIA || c.nome)
      .sort((a, b) => (b.exato - a.exato) || (b.nome - a.nome) || (a.dif - b.dif) || (Math.abs(a.dias) - Math.abs(b.dias)) || (b.sim - a.sim));

    if (!candidatos.length) continue;
    const c = candidatos[0];
    titulosUsados.add(c.t.id); feitos.add(l.id);
    const exato = c.dif <= TOLERANCIA;
    const confianca = exato && c.nome && Math.abs(c.dias) <= JANELA_DIAS ? "ALTA"
      : exato && Math.abs(c.dias) <= 3 && c.sim >= 0.4 ? "ALTA"
      : (exato && Math.abs(c.dias) <= 7) || (c.nome && c.exato) || c.juros ? "MEDIA" : "BAIXA";
    out.push({
      lancamento: { id: l.id, data: l.data, historico: l.historico, identificacao: l.identificacao, valor: Number(l.valor), banco: l.banco, vista: !!l.baixaVista },
      titulo: { id: c.t.id, tipo: c.t.tipo, titulo: c.t.titulo, parceiro: c.t.parceiro, valor: Number(c.t.valor), vencimento: c.t.vencimento, formaPagamento: c.t.formaPagamento, numeroDoc: c.t.numeroDoc },
      diferenca: r2(valor - Number(c.t.valor)),
      dias: c.dias,
      semelhanca: r2(c.sim),
      confianca,
      motivo: [c.exato ? "mesmo valor" : c.juros ? `pago ${(r2(valor - Number(c.t.valor))).toFixed(2).replace(".", ",")} a mais (juros/multa?)` : null,
        c.nome ? (saida ? "nome do credor no extrato" : "nome do pagador no extrato") : null].filter(Boolean).join(" · "),
      alternativas: candidatos.length - 1,
    });
  }

  const peso = { ALTA: 0, MEDIA: 1, BAIXA: 2 };
  out.sort((a, b) => peso[a.confianca] - peso[b.confianca] || Math.abs(a.dias) - Math.abs(b.dias));
  return { sugestoes: out, lancamentos: lancamentos.length, titulos: titulos.length };
}

// v181 — baixa de um item da semana (freelancer/terceirizado); quando todos estão pagos, a conta da semana fica paga
export async function baixarItem({ itemId, lancamentoId, quem }) {
  const [it, l] = await Promise.all([
    prisma.finSemanaItem.findUnique({ where: { id: Number(itemId) } }),
    prisma.finLancamento.findUnique({ where: { id: Number(lancamentoId) } }),
  ]);
  if (!it) return { ok: false, erro: "Lançamento da semana não encontrado." };
  if (!l) return { ok: false, erro: "Lançamento do extrato não encontrado." };
  if (it.pago) return { ok: false, erro: `${it.nome} já está pago.` };
  const ja = await prisma.finSemanaItem.findFirst({ where: { lancamentoId: l.id }, select: { nome: true } })
    || await prisma.finTitulo.findFirst({ where: { lancamentoId: l.id }, select: { titulo: true } });
  if (ja) return { ok: false, erro: `Este lançamento já baixou "${ja.nome || ja.titulo}".` };
  await prisma.finSemanaItem.update({ where: { id: it.id }, data: { pago: true, dataPagamento: l.data, lancamentoId: l.id,
    observacao: [it.observacao, `PAGO PELO EXTRATO ${l.banco} EM ${new Date(l.data).toISOString().slice(0, 10).split("-").reverse().join("/")}`].filter(Boolean).join(" · ").slice(0, 500) } });
  const todos = await prisma.finSemanaItem.findMany({ where: { tituloId: it.tituloId }, select: { pago: true, valor: true, dataPagamento: true } });
  if (todos.length && todos.every((x) => x.pago)) {
    const ult = todos.map((x) => x.dataPagamento).sort((a, b) => +b - +a)[0];
    await prisma.finTitulo.update({ where: { id: it.tituloId }, data: { status: "PAGO", dataPagamento: ult, valorPago: r2(todos.reduce((s, x) => s + Number(x.valor), 0)), valorConfirmado: true, previsao: false, atualizadoPorNome: quem || null } });
  }
  return { ok: true, item: { id: it.id, nome: it.nome }, pagos: todos.filter((x) => x.pago).length, total: todos.length };
}
export async function desfazerItem(itemId) {
  const it = await prisma.finSemanaItem.update({ where: { id: Number(itemId) }, data: { pago: false, dataPagamento: null, lancamentoId: null } }).catch(() => null);
  if (!it) return { ok: false, erro: "Item não encontrado." };
  await prisma.finTitulo.update({ where: { id: it.tituloId }, data: { status: "ABERTO", dataPagamento: null, valorPago: null } }).catch(() => null);
  return { ok: true };
}

// Dá baixa num título a partir de um lançamento do extrato.
export async function baixar({ tituloId, lancamentoId, quem }) {
  const [t, l] = await Promise.all([
    prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } }),
    prisma.finLancamento.findUnique({ where: { id: Number(lancamentoId) } }),
  ]);
  if (!t) return { ok: false, erro: "Conta não encontrada." };
  if (!l) return { ok: false, erro: "Lançamento não encontrado." };
  if (t.status !== "ABERTO") return { ok: false, erro: "Esta conta já foi baixada ou cancelada." };
  const ja = await prisma.finTitulo.findFirst({ where: { lancamentoId: l.id }, select: { id: true, titulo: true } });
  if (ja) return { ok: false, erro: `Este lançamento já baixou a conta "${ja.titulo}".` };

  const valorPago = r2(Math.abs(Number(l.valor)));
  const up = await prisma.finTitulo.update({
    where: { id: t.id },
    data: {
      status: "PAGO", dataPagamento: l.data, valorPago, lancamentoId: l.id,
      atualizadoPorNome: quem || null,
      observacao: [t.observacao, `BAIXA PELO EXTRATO ${l.banco} EM ${new Date(l.data).toISOString().slice(0, 10).split("-").reverse().join("/")}`].filter(Boolean).join(" · "),
    },
    select: { id: true, titulo: true, valor: true, valorPago: true, dataPagamento: true, status: true },
  });
  return { ok: true, titulo: up, diferenca: r2(valorPago - Number(t.valor)) };
}

// Desfaz a baixa (volta a conta para aberta).
export async function desfazer(tituloId) {
  const t = await prisma.finTitulo.update({
    where: { id: Number(tituloId) },
    data: { status: "ABERTO", dataPagamento: null, valorPago: null, lancamentoId: null },
    select: { id: true, titulo: true },
  }).catch(() => null);
  return t ? { ok: true, titulo: t } : { ok: false, erro: "Conta não encontrada." };
}

// v177 — sugestões já vistas na validação (baixadas ou não): somem do aviso até um lançamento novo aparecer
export async function marcarVistas(ids) {
  const l = (ids || []).map(Number).filter(Boolean);
  if (!l.length) return 0;
  return (await prisma.finLancamento.updateMany({ where: { id: { in: l } }, data: { baixaVista: true } })).count;
}
