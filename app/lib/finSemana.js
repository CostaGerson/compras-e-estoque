// Contas da semana: toda sexta nascem dois títulos — FREELANCERS DA SEMANA e
// TERCEIRIZADOS DA SEMANA. Cada um é uma casca; o que vale são os itens lançados dentro,
// e é a soma deles que vira o valor e o rateio do título (por isso a DRE já sai certa).
import { prisma } from "@/lib/prisma";
import {
  SETORES_FREELANCER, TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS, GRUPOS_ITEM, GRUPOS_POR_TIPO,
  GRUPO_DESCREVE, ehServico, catalogoDe, contaDoSetor, nomeSetor, garantirContasPrestadores, r2,
} from "@/lib/prestadores";

const MS_DIA = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const dataUTC = (s) => new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);
const compDe = (s) => String(s).slice(0, 7);
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dBR = (s) => String(s).slice(0, 10).split("-").reverse().join("/");

export const TIPOS_SEMANA = {
  FREELANCER: { titulo: "FREELANCERS DA SEMANA", parceiro: "FREELANCERS", grupos: GRUPOS_POR_TIPO.FREELANCER },
  TERCEIRIZADO: { titulo: "TERCEIRIZADOS DA SEMANA", parceiro: "TERCEIRIZADOS", grupos: GRUPOS_POR_TIPO.TERCEIRIZADO },
};
export const chaveSemana = (tipo, data, excepcional) => `SEMANA|${tipo}|${data}${excepcional ? "|EXC" : ""}`;
export const tipoDoGrupo = (grupo) => (grupo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO");

// todas as sextas-feiras de um mês (AAAA-MM)
export function sextasDoMes(competencia) {
  const [a, m] = String(competencia).split("-").map(Number);
  const out = [];
  const d = new Date(Date.UTC(a, m - 1, 1));
  while (d.getUTCMonth() === m - 1) {
    if (d.getUTCDay() === 5) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// a sexta da semana de uma data qualquer (segunda a domingo)
export function sextaDaSemana(data) {
  const d = new Date(data);
  const dia = d.getUTCDay();
  const ate = dia === 0 ? 5 : 5 - dia;
  d.setUTCDate(d.getUTCDate() + ate);
  return iso(d);
}

// a primeira sexta a partir da data (a própria data, se já for sexta)
export function sextaAPartirDe(data) {
  const d = new Date(data);
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
}

// prazo em dias corridos: aceita 0 (à vista), recusa vazio e lixo
export function prazoEmDias(v) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

// Serviço recebido em tal dia, com tanto de prazo: quando vence e em que sexta se paga.
export function programacao(dataRecebimento, prazoDias) {
  if (!dataRecebimento || prazoEmDias(prazoDias) === null) return null;
  const venc = new Date(dataUTC(dataRecebimento).getTime() + prazoEmDias(prazoDias) * MS_DIA);
  const sexta = sextaAPartirDe(venc);
  return {
    recebimento: iso(dataUTC(dataRecebimento)),
    prazoDias: prazoEmDias(prazoDias),
    vencimento: iso(venc),
    sexta,
    aviso: `Pagamento programado para ${dBR(sexta)}, a primeira sexta-feira a partir do vencimento (${dBR(iso(venc))}). Confirma ciência?`,
  };
}

// Implantação: as contas da semana valem a partir da sexta 09/10/2026.
export const INICIO_SEMANAS = "2026-10-09";

// Cria as duas contas de cada sexta do mês (se ainda não existirem), a partir do início da implantação.
export async function garantirSemanas(competencia) {
  const sextas = sextasDoMes(competencia).filter((s) => s >= INICIO_SEMANAS);
  if (!sextas.length) return { criados: 0, sextas: [] };
  const chaves = [];
  for (const s of sextas) for (const t of Object.keys(TIPOS_SEMANA)) chaves.push(chaveSemana(t, s));
  const tem = new Set((await prisma.finTitulo.findMany({ where: { chaveImport: { in: chaves } }, select: { chaveImport: true } })).map((x) => x.chaveImport));

  const novos = [];
  for (const s of sextas) {
    for (const [t, cfg] of Object.entries(TIPOS_SEMANA)) {
      const chave = chaveSemana(t, s);
      if (tem.has(chave)) continue;
      novos.push(cascaDaSemana(t, cfg, s, false));
    }
  }
  if (novos.length) await prisma.finTitulo.createMany({ data: novos, skipDuplicates: true });
  return { criados: novos.length, sextas };
}

const cascaDaSemana = (tipo, cfg, data, excepcional) => ({
  tipo: "PAGAR",
  titulo: excepcional ? `${cfg.titulo.replace(" DA SEMANA", "")} · PAGAMENTO EXCEPCIONAL` : cfg.titulo,
  parceiro: cfg.parceiro, valor: 0, vencimento: dataUTC(data), competencia: compDe(data),
  previsao: true, valorConfirmado: false, rateio: [], forma: "SEMANAL",
  chaveImport: chaveSemana(tipo, data, excepcional),
  observacao: excepcional ? `PAGAMENTO EXCEPCIONAL EM ${dBR(data)}` : `SEMANA FECHADA EM ${dBR(data)}`,
});

// Acha (ou cria) o título de um tipo numa data — a casca da sexta, ou a do pagamento excepcional.
export async function tituloDaData(tipo, data, excepcional = false) {
  const cfg = TIPOS_SEMANA[tipo];
  if (!cfg) return null;
  if (!excepcional && String(data).slice(0, 10) < INICIO_SEMANAS) data = INICIO_SEMANAS;   // nada antes da implantação
  const chave = chaveSemana(tipo, String(data).slice(0, 10), excepcional);
  const existe = await prisma.finTitulo.findFirst({ where: { chaveImport: chave } });
  if (existe) return existe;
  return prisma.finTitulo.create({ data: cascaDaSemana(tipo, cfg, data, excepcional) });
}

// ---------------- itens ----------------
// Freelancer: (diária + transporte) × dias + custo extra. Facção e serviço somam as linhas.
export function valorDoItem(item) {
  if (item.grupo === "FREELANCER") {
    const dia = (Number(item.diaria) || 0) + (Number(item.transporte) || 0);
    return r2(dia * (Number(item.dias) || 0) + (Number(item.custoExtra) || 0));
  }
  return r2((item.linhas || []).reduce((s, l) => s + (Number(l.qtd) || 0) * (Number(l.unitario) || 0), 0));
}

export function validarItem(item) {
  if (!GRUPOS_ITEM[item.grupo]) return "Grupo inválido.";
  if (!String(item.nome || "").trim()) return "Escolha o prestador.";
  if (!String(item.chavePix || "").trim()) return "A chave PIX é obrigatória.";
  // v208 — facção: o tipo de peça é de cada linha (pedido), não do prestador
  if (item.grupo === "FACCAO") {
    const ls = item.linhas || [];
    for (const [i, l] of ls.entries()) if (!catalogoDe("FACCAO").some((c) => c.k === l.tipo)) return `Linha ${i + 1}: escolha o tipo de peça.`;
    item.setor = setorPrincipal(ls) || item.setor;
  }
  if (!catalogoDe(item.grupo).some((c) => c.k === item.setor)) {
    return item.grupo === "FREELANCER" ? "Escolha o setor." : "Escolha o tipo de peça ou o serviço.";
  }
  if (item.grupo === "FREELANCER") {
    if (!(Number(item.diaria) > 0)) return "Informe o valor da diária.";
    if (!(Number(item.dias) > 0)) return "Informe quantos dias ele trabalhou.";
    if (Number(item.custoExtra) !== 0 && Number.isFinite(Number(item.custoExtra)) && !String(item.justificativa || "").trim()) {
      return "Com custo extra, a justificativa é obrigatória.";
    }
    return null;
  }
  if (item.grupo === GRUPO_DESCREVE && !String(item.descricao || "").trim()) {
    return "Descreva o serviço prestado.";
  }
  const linhas = item.linhas || [];
  if (!linhas.length) return "Lance pelo menos um pedido.";
  for (const [i, l] of linhas.entries()) {
    const n = i + 1;
    if (!String(l.pedido || "").trim()) return `Linha ${n}: informe o nº do pedido.`;
    if (!(Number(l.qtd) > 0)) return `Linha ${n}: informe a quantidade.`;
    if (!(Number(l.unitario) > 0)) return `Linha ${n}: informe o valor unitário.`;
  }
  if (ehServico(item.grupo) || item.grupo === "FACCAO") {
    if (!item.dataRecebimento) return "Informe a data em que o serviço foi recebido.";
    if (prazoEmDias(item.prazoDias) === null) return "Informe o prazo de pagamento negociado, em dias corridos.";
    if (item.excepcional) {
      if (!item.dataPagamento) return "No pagamento excepcional, escolha a data de pagamento.";
      if (!String(item.justificativa || "").trim()) return "No pagamento excepcional, a justificativa é obrigatória.";
    }
  }
  return null;
}

// tipo de peça com o maior valor entre as linhas (vai para o "setor" do item, usado na lista)
export function setorPrincipal(linhas) {
  const t = {};
  for (const l of linhas || []) if (l.tipo) t[l.tipo] = (t[l.tipo] || 0) + (Number(l.qtd) || 0) * (Number(l.unitario) || 0);
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
const normLinhas = (linhas, grupo) => (linhas || []).map((l) => ({
  pedido: String(l.pedido || "").trim().toUpperCase(),
  item: String(l.item || "").trim().toUpperCase() || null,
  ...(grupo === "FACCAO" && l.tipo ? { tipo: l.tipo } : {}),
  ...(l.os ? { os: String(l.os) } : {}), ...(l.osParcial ? { osParcial: true } : {}),   // v209: OS do KM
  qtd: Number(l.qtd) || 0,
  unitario: r2(l.unitario),
  total: r2((Number(l.qtd) || 0) * (Number(l.unitario) || 0)),
}));

// Em que título o item deve cair.
export async function destinoDoItem(item, tituloAtual) {
  const tipo = tipoDoGrupo(item.grupo);
  if (item.grupo === "FREELANCER") {
    // o freelancer é pago na semana em que trabalhou
    const data = item.sexta || (tituloAtual ? iso(new Date(tituloAtual.vencimento)) : sextaDaSemana(new Date()));
    return { titulo: await tituloDaData(tipo, sextaAPartirDe(data), false), excepcional: false, programado: null };
  }
  if (item.excepcional && item.dataPagamento) {
    return { titulo: await tituloDaData(tipo, item.dataPagamento, true), excepcional: true, programado: programacao(item.dataRecebimento, item.prazoDias) };
  }
  const prog = programacao(item.dataRecebimento, item.prazoDias);
  if (prog) return { titulo: await tituloDaData(tipo, prog.sexta, false), excepcional: false, programado: prog };
  const data = item.sexta || (tituloAtual ? iso(new Date(tituloAtual.vencimento)) : sextaDaSemana(new Date()));
  return { titulo: await tituloDaData(tipo, sextaAPartirDe(data), false), excepcional: false, programado: null };
}

// Refaz valor e rateio do título a partir dos seus itens.
export async function recalcular(tituloId) {
  const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) } });
  const total = r2(itens.reduce((s, i) => s + Number(i.valor), 0));
  const porConta = {};
  for (const i of itens) {
    const ls = Array.isArray(i.linhas) ? i.linhas : [];
    if (i.grupo === "FACCAO" && ls.length && ls.every((l) => l.contaId)) {   // v208: facção rateada por linha
      for (const l of ls) porConta[l.contaId] = r2((porConta[l.contaId] || 0) + (Number(l.total) || 0));
    } else if (i.contaId) porConta[i.contaId] = r2((porConta[i.contaId] || 0) + Number(i.valor));
  }
  const ents = Object.entries(porConta).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  let acc = 0;
  const rateio = total
    ? ents.map(([contaId, v], k) => {
        const pct = k === ents.length - 1 ? r2(100 - acc) : r2((v / total) * 100);
        acc = r2(acc + pct);
        return { contaId: Number(contaId), pct };
      })
    : [];
  await prisma.finTitulo.update({ where: { id: Number(tituloId) }, data: { valor: total, rateio, previsao: total === 0 } });
  return { total, itens: itens.length, rateio };
}

export async function listarItens(tituloId) {
  // v273 — em aberto primeiro, pagos embaixo
  const itens = await prisma.finSemanaItem.findMany({ where: { tituloId: Number(tituloId) }, orderBy: [{ pago: "asc" }, { grupo: "asc" }, { nome: "asc" }, { id: "asc" }] });
  return itens.map((i) => ({
    ...i,
    valor: Number(i.valor),
    diaria: i.diaria == null ? null : Number(i.diaria),
    transporte: i.transporte == null ? null : Number(i.transporte),
    custoExtra: i.custoExtra == null ? null : Number(i.custoExtra),
    setorNome: nomeSetor(i.grupo, i.setor),
    grupoNome: (GRUPOS_ITEM[i.grupo] || {}).n || i.grupo,
  }));
}

// Avisa o financeiro quando alguém marca um pagamento como excepcional.
async function avisarFinanceiro(texto, deId) {
  const destinos = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: "FINANCEIRO", diretoria: false }] }, select: { id: true } });
  if (!destinos.length) return 0;
  const de = deId || destinos[0].id;
  await prisma.mensagem.createMany({ data: destinos.map((u) => ({ deId: de, paraId: u.id, texto })) });
  return destinos.length;
}

export async function salvarItem(tituloId, item, { id, quem, usuarioId } = {}) {
  const erro = validarItem(item);
  if (erro) return { ok: false, erro };
  await garantirContasPrestadores();
  const codigo = contaDoSetor(item.grupo, item.setor);
  const conta = await prisma.finConta.findUnique({ where: { codigo } });
  if (!conta) return { ok: false, erro: `A conta-caixa ${codigo} não existe.` };

  const atual = tituloId ? await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } }) : null;
  const destino = await destinoDoItem(item, atual);
  if (!destino.titulo) return { ok: false, erro: "Não consegui achar a conta da semana." };

  const linhas = item.grupo === "FREELANCER" ? [] : normLinhas(item.linhas, item.grupo);
  // v208 — facção: cada linha leva a conta-caixa do seu tipo de peça (o rateio da semana sai por linha)
  if (item.grupo === "FACCAO") {
    const cs = await prisma.finConta.findMany({ where: { codigo: { in: linhas.map((l) => contaDoSetor("FACCAO", l.tipo)).filter(Boolean) } }, select: { id: true, codigo: true } });
    const id = Object.fromEntries(cs.map((c) => [c.codigo, c.id]));
    for (const l of linhas) l.contaId = id[contaDoSetor("FACCAO", l.tipo)] || null;
  }
  // v208 — prestador sem PIX no cadastro: a chave digitada no lançamento passa a valer no cadastro
  if (item.prestadorId && String(item.chavePix || "").trim()) {
    const p = await prisma.prestador.findUnique({ where: { id: Number(item.prestadorId) }, select: { id: true, chavePix: true } }).catch(() => null);
    if (p && !String(p.chavePix || "").trim()) await prisma.prestador.update({ where: { id: p.id }, data: { chavePix: String(item.chavePix).trim() } }).catch(() => null);
  }
  const free = item.grupo === "FREELANCER";
  const data = {
    tituloId: destino.titulo.id,
    grupo: item.grupo,
    prestadorId: item.prestadorId ? Number(item.prestadorId) : null,
    nome: String(item.nome).trim().toUpperCase(),
    chavePix: String(item.chavePix).trim(),
    setor: item.setor,
    contaId: conta.id,
    diaria: free ? r2(item.diaria) : null,
    dias: free ? Number(item.dias) || 0 : null,
    transporte: free ? r2(item.transporte) : null,
    custoExtra: free ? r2(item.custoExtra) : null,
    justificativa: item.justificativa ? String(item.justificativa).trim().toUpperCase() : null,
    descricao: item.descricao ? String(item.descricao).trim().toUpperCase() : null,
    dataRecebimento: !free && item.dataRecebimento ? dataUTC(item.dataRecebimento) : null,
    prazoDias: free ? null : prazoEmDias(item.prazoDias),
    vencimentoNegociado: destino.programado ? dataUTC(destino.programado.vencimento) : null,
    excepcional: !!destino.excepcional,
    linhas,
    valor: valorDoItem({ ...item, linhas }),
    observacao: item.observacao ? String(item.observacao).trim().toUpperCase() : null,
  };

  const antes = id ? await prisma.finSemanaItem.findUnique({ where: { id: Number(id) } }) : null;
  const salvo = id
    ? await prisma.finSemanaItem.update({ where: { id: Number(id) }, data })
    : await prisma.finSemanaItem.create({ data: { ...data, criadoPorNome: quem || null } });

  // o item pode ter mudado de semana: as duas contas precisam ser refeitas
  const refazer = new Set([destino.titulo.id, ...(antes ? [antes.tituloId] : []), ...(tituloId ? [Number(tituloId)] : [])]);
  let tot = null;
  for (const t of refazer) tot = (await recalcular(t)) || tot;

  let avisados = 0;
  if (destino.excepcional && (!antes || !antes.excepcional)) {
    avisados = await avisarFinanceiro(
      `PAGAMENTO EXCEPCIONAL · ${data.nome} · R$ ${brl(data.valor)} programado para ${dBR(destino.titulo.vencimento.toISOString?.() || destino.titulo.vencimento)}`
      + (destino.programado ? ` (a sexta normal seria ${dBR(destino.programado.sexta)})` : "")
      + `. Justificativa: ${data.justificativa || "—"}. Lançado por ${quem || "—"}.`,
      usuarioId,
    ).catch(() => 0);
  }

  return {
    ok: true,
    item: { ...salvo, valor: Number(salvo.valor) },
    tituloId: destino.titulo.id,
    mudouDeSemana: !!tituloId && destino.titulo.id !== Number(tituloId),
    programado: destino.programado,
    excepcional: destino.excepcional,
    avisados,
    ...(tot || {}),
  };
}

export async function excluirItem(id) {
  const i = await prisma.finSemanaItem.findUnique({ where: { id: Number(id) } });
  if (!i) return { ok: false, erro: "Lançamento não encontrado." };
  await prisma.finSemanaItem.delete({ where: { id: i.id } });
  const tot = await recalcular(i.tituloId);
  return { ok: true, ...tot };
}

// Tudo que a tela da semana precisa.
export async function abrirSemana(tituloId) {
  const t = await prisma.finTitulo.findUnique({ where: { id: Number(tituloId) } });
  if (!t) return { ok: false, erro: "Conta da semana não encontrada." };
  const partes = String(t.chaveImport || "").split("|");
  const tipo = partes[1] || null;
  const cfg = TIPOS_SEMANA[tipo];
  const [itens, prestadores] = await Promise.all([
    listarItens(t.id),
    prisma.prestador.findMany({ where: { ativo: true, tipo: tipo === "FREELANCER" ? "FREELANCER" : "TERCEIRIZADO" }, orderBy: { nome: "asc" } }),
  ]);
  const porGrupo = {};
  for (const i of itens) porGrupo[i.grupo] = r2((porGrupo[i.grupo] || 0) + i.valor);
  const catalogos = Object.fromEntries(Object.entries(GRUPOS_ITEM).map(([k, v]) => [k, v.catalogo]));
  return {
    ok: true,
    titulo: { id: t.id, nome: t.titulo, vencimento: t.vencimento, competencia: t.competencia, status: t.status, valor: Number(t.valor) },
    tipo, grupos: cfg ? cfg.grupos : [],
    excepcional: partes[3] === "EXC",
    nomesGrupo: Object.fromEntries(Object.entries(GRUPOS_ITEM).map(([k, v]) => [k, v.n])),
    grupoDescreve: GRUPO_DESCREVE,
    catalogos, itens, prestadores,
    total: r2(itens.reduce((s, i) => s + i.valor, 0)),
    pago: r2(itens.filter((i) => i.pago).reduce((s, i) => s + i.valor, 0)),   // v273
    saldo: r2(itens.filter((i) => !i.pago).reduce((s, i) => s + i.valor, 0)),
    porGrupo,
  };
}

export { SETORES_FREELANCER, TIPOS_FACCAO, SERVICOS_TERCEIRIZADOS };

// Implantação (v103): exclui as contas da semana em aberto anteriores a 09/10/2026 — uma vez.
const CHAVE_LIMPEZA = "AJUSTE|semanas-antes-implantacao-v103";
export async function limparSemanasAntigas() {
  const ja = await prisma.finConfig.findUnique({ where: { chave: CHAVE_LIMPEZA } }).catch(() => null);
  if (ja) return { ok: true, jaFeito: true };
  const r = await prisma.finTitulo.deleteMany({
    where: { chaveImport: { startsWith: "SEMANA|" }, status: "ABERTO", vencimento: { lt: dataUTC(INICIO_SEMANAS) } },
  });
  await prisma.finConfig.upsert({
    where: { chave: CHAVE_LIMPEZA },
    create: { chave: CHAVE_LIMPEZA, valor: `${new Date().toISOString()} · ${r.count} excluídas` },
    update: { valor: `${new Date().toISOString()} · ${r.count} excluídas` },
  });
  return { ok: true, excluidas: r.count };
}

// Excluir conta da semana: a partir da implantação vira CANCELADA (senão o sistema recriaria a sexta);
// antes dela, sai de vez.
export const ehCascaSemana = (t) => String(t?.chaveImport || "").startsWith("SEMANA|");

// ---------------- v208 — importação de freelancers pela planilha modelo ----------------
const semAc = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
export const COLUNAS_MODELO_FREE = ["NOME", "CHAVE PIX", "SETOR", "DIÁRIA", "TRANSPORTE POR DIA", "DIAS", "CUSTO EXTRA", "JUSTIFICATIVA", "OBSERVAÇÃO"];
export async function modeloFreelancers() {
  const XLSX = await import("xlsx");
  const ps = await prisma.prestador.findMany({ where: { ativo: true, tipo: "FREELANCER" }, orderBy: { nome: "asc" } });
  const setorDe = (p) => { const s = (p.servicos || [])[0]; return SETORES_FREELANCER.find((x) => x.k === s)?.n || ""; };
  const linhas = ps.map((p) => {
    const d = Array.isArray(p.diarias) && p.diarias[0] ? p.diarias[0] : {};
    return [p.nome, p.chavePix || "", setorDe(p), Number(d.diaria) || null, Number(d.passagem) || null, null, null, "", ""];
  });
  const ws = XLSX.utils.aoa_to_sheet([COLUNAS_MODELO_FREE, ...linhas]);
  ws["!cols"] = [{ wch: 34 }, { wch: 30 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 36 }, { wch: 30 }];
  const inst = XLSX.utils.aoa_to_sheet([
    ["COMO PREENCHER"],
    ["1. Preencha a coluna DIAS de quem trabalhou na semana. Linha sem DIAS (ou com 0) é ignorada."],
    ["2. Diária e transporte vêm do cadastro — altere se mudou. Transporte é por dia e entra no valor do dia."],
    ["3. Custo extra (positivo ou negativo) exige JUSTIFICATIVA."],
    ["4. Pessoa nova: escreva o NOME, a CHAVE PIX e o SETOR — o cadastro é criado na importação."],
    ["5. Chave PIX preenchida para quem não tinha no cadastro passa a valer no cadastro."],
    [""], ["SETORES VÁLIDOS"], ...SETORES_FREELANCER.map((s) => [s.n]),
  ]);
  inst["!cols"] = [{ wch: 100 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Freelancers");
  XLSX.utils.book_append_sheet(wb, inst, "Instruções");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
const numBR = (v) => { if (v == null || v === "") return 0; if (typeof v === "number") return v; const t = String(v).replace(/R\$|\s/g, ""); const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); return Number.isFinite(n) ? n : NaN; };
// lê a planilha e lança cada linha com DIAS > 0 na semana (tituloId); devolve o resumo por linha
export async function importarFreelancers(tituloId, b64, { quem, usuarioId, simular } = {}) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(Buffer.from(String(b64 || ""), "base64"), { type: "buffer" });
  const ws = wb.Sheets["Freelancers"] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const cab = (rows[0] || []).map(semAc);
  const ix = (n) => cab.indexOf(semAc(n));
  if (ix("NOME") < 0 || ix("DIAS") < 0) return { ok: false, erro: "Planilha fora do modelo: faltam as colunas NOME e DIAS. Baixe o modelo de novo." };
  const ps = await prisma.prestador.findMany({ where: { tipo: "FREELANCER" } });
  const porNome = new Map(ps.map((p) => [semAc(p.nome), p]));
  const res = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const val = (n) => (ix(n) >= 0 ? r[ix(n)] : "");
    const nome = String(val("NOME") || "").trim().toUpperCase();
    const dias = numBR(val("DIAS"));
    if (!nome || !(dias > 0)) continue;
    const setorTxt = semAc(val("SETOR"));
    const setor = SETORES_FREELANCER.find((s) => semAc(s.n) === setorTxt || s.k === setorTxt)?.k;
    let p = porNome.get(semAc(nome));
    const pix = String(val("CHAVE PIX") || "").trim() || p?.chavePix || "";
    const linha = { linha: i + 1, nome, dias };
    if (!p && !simular) {
      if (!pix || !setor) { res.push({ ...linha, ok: false, erro: "Pessoa nova: informe CHAVE PIX e SETOR para criar o cadastro." }); continue; }
      p = await prisma.prestador.create({ data: { tipo: "FREELANCER", nome, chavePix: pix, servicos: [setor], criadoPorNome: quem || null } });
      porNome.set(semAc(nome), p); linha.novo = true;
    }
    const d = p && Array.isArray(p.diarias) && p.diarias[0] ? p.diarias[0] : {};
    const item = {
      grupo: "FREELANCER", prestadorId: p?.id || null, nome, chavePix: pix,
      setor: setor || (p?.servicos || [])[0] || "",
      diaria: val("DIÁRIA") !== "" ? numBR(val("DIÁRIA")) : Number(d.diaria) || 0,
      transporte: val("TRANSPORTE POR DIA") !== "" ? numBR(val("TRANSPORTE POR DIA")) : Number(d.passagem) || 0,
      dias, custoExtra: numBR(val("CUSTO EXTRA")) || 0,
      justificativa: String(val("JUSTIFICATIVA") || "").trim(), observacao: String(val("OBSERVAÇÃO") || "").trim(),
    };
    const erro = validarItem({ ...item });
    if (erro) { res.push({ ...linha, ok: false, erro }); continue; }
    if (simular) { res.push({ ...linha, ok: true, valor: valorDoItem(item), novo: !p }); continue; }
    const s = await salvarItem(tituloId, item, { quem, usuarioId });
    res.push(s.ok ? { ...linha, ok: true, valor: Number(s.item.valor) } : { ...linha, ok: false, erro: s.erro });
  }
  return { ok: true, linhas: res, lancadas: res.filter((x) => x.ok).length, erros: res.filter((x) => !x.ok).length, total: r2(res.filter((x) => x.ok).reduce((s, x) => s + (x.valor || 0), 0)) };
}

// ---------------- v271 — comandos por conta interna (cada prestador da semana) ----------------
// unidades da baixa parcial: facção/serviço = PEDIDOS inteiros (linhas do mesmo pedido juntas); freelancer = DIAS inteiros
function unidadesDoItem(it) {
  if (it.grupo === "FREELANCER") {
    const dia = r2((Number(it.diaria) || 0) + (Number(it.transporte) || 0));
    return { tipo: "DIAS", dia, dias: Number(it.dias) || 0 };
  }
  const ped = {};
  (Array.isArray(it.linhas) ? it.linhas : []).forEach((l, i) => {
    const k = String(l.pedido || `linha ${i + 1}`);
    (ped[k] ||= { pedido: k, linhas: [], total: 0 }).linhas.push(i);
    ped[k].total = r2(ped[k].total + (Number(l.qtd) || 0) * (Number(l.unitario) || 0));
  });
  return { tipo: "PEDIDOS", pedidos: Object.values(ped) };
}

// sugere a baixa parcial: o máximo de pedidos inteiros (ou dias) cujo total cabe no valor que se pretende pagar
export async function sugerirBaixaParcial(itemId, valor) {
  const it = await prisma.finSemanaItem.findUnique({ where: { id: Number(itemId) } });
  if (!it) return { ok: false, erro: "Lançamento não encontrado." };
  const alvo = r2(valor);
  if (!(alvo > 0)) return { ok: false, erro: "Informe quanto pretende pagar." };
  const u = unidadesDoItem(it);
  if (u.tipo === "DIAS") {
    const dias = u.dia > 0 ? Math.min(u.dias, Math.floor((alvo + 0.001) / u.dia)) : 0;
    return { ok: true, tipo: "DIAS", dias, valor: r2(dias * u.dia), sobra: r2(alvo - dias * u.dia), diaria: u.dia, diasTotal: u.dias };
  }
  // mochila 0/1 (centavos): maior total ≤ valor; no empate, mais pedidos
  const ps = u.pedidos;
  const unid = alvo > 50000 ? 10 : 1;   // acima de R$ 50 mil, trabalha em dezenas de centavos
  const T = Math.floor((alvo * 100) / unid);
  const custo = ps.map((p) => Math.ceil(Math.round(p.total * 100) / unid));
  const cnt = new Int16Array(T + 1).fill(-1); cnt[0] = 0;
  const take = ps.map(() => new Uint8Array(T + 1));
  ps.forEach((_, i) => {
    const c = custo[i];
    if (c <= 0 || c > T) return;
    for (let x = T; x >= c; x--) if (cnt[x - c] >= 0 && cnt[x - c] + 1 > cnt[x]) { cnt[x] = cnt[x - c] + 1; take[i][x] = 1; }
  });
  let sm = T; while (sm > 0 && cnt[sm] < 0) sm--;
  const escolha = [];
  for (let i = ps.length - 1, x = sm; i >= 0 && x > 0; i--) if (take[i][x]) { escolha.push(i); x -= custo[i]; }
  const somaMax = Math.round(escolha.reduce((t, i) => t + ps[i].total, 0) * 100);
  return { ok: true, tipo: "PEDIDOS", valor: r2(somaMax / 100), sobra: r2(alvo - somaMax / 100),
    pedidos: ps.map((p, i) => ({ pedido: p.pedido, total: p.total, linhas: p.linhas.length, sugerido: escolha.includes(i) })) };
}

async function fecharSemanaSePaga(tituloId, quem) {
  const todos = await prisma.finSemanaItem.findMany({ where: { tituloId }, select: { pago: true, valor: true, dataPagamento: true } });
  if (todos.length && todos.every((x) => x.pago)) {
    const ult = todos.map((x) => x.dataPagamento).sort((a, b) => +b - +a)[0];
    await prisma.finTitulo.update({ where: { id: tituloId }, data: { status: "PAGO", dataPagamento: ult, valorPago: r2(todos.reduce((s, x) => s + Number(x.valor), 0)), valorConfirmado: true, previsao: false, atualizadoPorNome: quem || null } });
  }
  return { pagos: todos.filter((x) => x.pago).length, total: todos.length };
}

// baixa manual de UMA conta interna: inteira, ou parcial (pedidos inteiros / dias) — a parte paga vira um lançamento próprio, pago
export async function baixarItemManual({ itemId, data, pedidos = null, dias = null, observacao = null, quem }) {
  const it = await prisma.finSemanaItem.findUnique({ where: { id: Number(itemId) } });
  if (!it) return { ok: false, erro: "Lançamento não encontrado." };
  if (it.pago) return { ok: false, erro: `${it.nome} já está pago.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ""))) return { ok: false, erro: "Informe a data do pagamento." };
  const obs = (extra) => [it.observacao, extra, observacao ? String(observacao).trim().toUpperCase() : null].filter(Boolean).join(" · ").slice(0, 500);
  const quando = String(data).split("-").reverse().join("/");
  const u = unidadesDoItem(it);
  let parcial = false;
  if (u.tipo === "PEDIDOS" && Array.isArray(pedidos) && pedidos.length && pedidos.length < u.pedidos.length) {
    const sel = new Set(pedidos.map(String));
    const idxPagos = new Set(u.pedidos.filter((p) => sel.has(p.pedido)).flatMap((p) => p.linhas));
    const linhas = Array.isArray(it.linhas) ? it.linhas : [];
    const pagas = linhas.filter((_, i) => idxPagos.has(i)), resto = linhas.filter((_, i) => !idxPagos.has(i));
    if (!pagas.length) return { ok: false, erro: "Escolha ao menos um pedido." };
    const { id: _id, createdAt, updatedAt, titulo, prestador, ...base } = it;
    await prisma.finSemanaItem.create({ data: { ...base, linhas: pagas, valor: valorDoItem({ ...it, linhas: pagas }), pago: true, dataPagamento: dataUTC(data), lancamentoId: null,
      observacao: obs(`BAIXA PARCIAL EM ${quando} · PEDIDO(S) ${[...sel].join(", ")}`), criadoPorNome: quem || it.criadoPorNome } });
    await prisma.finSemanaItem.update({ where: { id: it.id }, data: { linhas: resto, valor: valorDoItem({ ...it, linhas: resto }),
      observacao: obs(`SALDO APÓS BAIXA PARCIAL DE ${quando}`) } });
    parcial = true;
  } else if (u.tipo === "DIAS" && Number(dias) > 0 && Number(dias) < u.dias) {
    const n = Math.floor(Number(dias));
    const { id: _id, createdAt, updatedAt, titulo, prestador, ...base } = it;
    await prisma.finSemanaItem.create({ data: { ...base, dias: n, custoExtra: 0, valor: valorDoItem({ ...it, dias: n, custoExtra: 0 }), pago: true, dataPagamento: dataUTC(data), lancamentoId: null,
      observacao: obs(`BAIXA PARCIAL EM ${quando} · ${n} DIA(S)`), criadoPorNome: quem || it.criadoPorNome } });
    const restoDias = u.dias - n;
    await prisma.finSemanaItem.update({ where: { id: it.id }, data: { dias: restoDias, valor: valorDoItem({ ...it, dias: restoDias }),
      observacao: obs(`SALDO APÓS BAIXA PARCIAL DE ${quando}`) } });
    parcial = true;
  } else {
    await prisma.finSemanaItem.update({ where: { id: it.id }, data: { pago: true, dataPagamento: dataUTC(data), lancamentoId: null, observacao: obs(`PAGO EM ${quando} (BAIXA MANUAL)`) } });
  }
  await recalcular(it.tituloId);
  const st = await fecharSemanaSePaga(it.tituloId, quem);
  return { ok: true, parcial, ...st };
}

export async function obsItem(itemId, texto) {
  const it = await prisma.finSemanaItem.update({ where: { id: Number(itemId) }, data: { observacao: String(texto || "").trim().toUpperCase() || null } }).catch(() => null);
  if (!it) return { ok: false, erro: "Lançamento não encontrado." };
  return { ok: true, tituloId: it.tituloId };
}
