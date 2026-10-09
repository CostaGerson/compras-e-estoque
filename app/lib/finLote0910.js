// v179 — lançamento único das contas a pagar de 01 a 09/10/2026 (planilha do Gerson).
// Contas comuns: não lança se já existir (mesmo valor perto da data, ou a recorrência do mês — essa é ajustada).
// Facções: entram como itens da conta "TERCEIRIZADOS DA SEMANA" com o cadastro do terceirizado.
// Freelancers: um item por pessoa na "FREELANCERS DA SEMANA" de 09/10, com diária/passagem do cadastro.
import { prisma } from "@/lib/prisma";
import { contaDoSetor, garantirContasPrestadores, r2 } from "@/lib/prestadores";
import { tituloDaData, recalcular } from "@/lib/finSemana";

const FLAG = "LOTE|PAGAR|2026-10-09";
const DIA = 86400000;
const d = (s) => new Date(`${s}T00:00:00Z`);
const sa = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const brl = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const CONTAS = [
  ["2026-10-01", "HTMED", 100.00, "HTMED NORT SETEMBRO"],
  ["2026-10-03", "TAVARES", 1120.00, "REF JR"],
  ["2026-10-04", "ISABEL", 1500.00, "JUROS INVEST 2"],
  ["2026-10-05", "JB ELEVADORES", 300.00, "MANUTENÇÃO MENSAL ELEVADORES"],
  ["2026-10-06", "ESAUDE", 449.90, "ASSISTENCIA MEDICA"],
  ["2026-10-06", "GUIMARÃES", 988.03, "REF COTA PARTICIPAÇÃO ASTON"],
  ["2026-10-06", "PADARIA", 1368.00, "REF PADARIA: TRIGO GOURMET · CHAVE PIX: f5ebd953-1447-4975-8af0"],
  ["2026-10-07", "ISABEL", 2000.00, "REF JUROS MENSAL MUTUO"],
];
const FACCOES = [
  ["2026-10-08", "CARLA APARECIDA", 1008.00, "REF FACÇÃO POLOS MILPLAN E ARTEBRILHO", "MILPLAN/ARTEBRILHO"],
  ["2026-10-08", "GISLEY VALADARES", 731.00, "REF FACÇÃO CALÇAS ARTEBRILHO", "ARTEBRILHO"],
  ["2026-10-09", "EDINEL SOUSA", 2875.00, "FACÇÃO FECHAMENTO DE CONTROLE DE OS Nº128", "OS 128"],
  ["2026-10-09", "JUCIMARA CIRQUEIRA", 747.00, "FACÇÃO REF FECHAMENTO DE CONTROLE DE OS Nº130", "OS 130"],
];
const FREELANCERS = [
  ["GREGORY", 562.50], ["JHONNY", 1000.00], ["MARCO", 872.50], ["LUIZ RICARDO", 850.00], ["NATALINO (TATAL)", 450.00],
  ["JHONATA", 560.00], ["RAQUEL ALVES", 560.00], ["ANA JULIA", 225.00], ["TATIANA", 625.00], ["LUCIMARA GODOI DE SOUZA", 450.00],
  ["CRISLAINY EDUARDA DE OLIVEIRA", 575.00], ["RAQUEL FERNANDA", 727.50], ["ELIZA RIBEIRO", 660.00], ["WARLEN", 1000.00], ["HIGLEY", 674.92],
];
const SEXTA = "2026-10-09";

// dias e diária pelo cadastro: um turno exato; senão dois turnos; senão o 1º turno + diferença como custo extra
export function diasPelaDiaria(total, diarias) {
  const ts = (Array.isArray(diarias) ? diarias : []).map((x) => ({ ...x, dia: r2(Number(x.diaria) + Number(x.passagem || 0)) })).filter((x) => x.dia > 0);
  if (!ts.length) return { diaria: total, transporte: 0, dias: 1, custoExtra: 0 };
  for (const t of ts) { const n = total / t.dia; if (Math.abs(n - Math.round(n)) < 1e-6 && Math.round(n) >= 1 && Math.round(n) <= 7) return { diaria: Number(t.diaria), transporte: Number(t.passagem || 0), dias: Math.round(n), custoExtra: 0, turno: t.turno }; }
  for (const a of ts) for (const b of ts) if (a !== b) for (let x = 1; x <= 6; x++) {
    const y = (total - x * a.dia) / b.dia;
    if (y >= 1 && Math.abs(y - Math.round(y)) < 1e-6 && x + Math.round(y) <= 7) {
      // um item só: usa o turno de maior número de dias e a diferença do outro como extra (justificada)
      return { diaria: Number(a.diaria), transporte: Number(a.passagem || 0), dias: x, custoExtra: r2(total - x * a.dia), turno: a.turno, misto: `${x} × ${a.turno} + ${Math.round(y)} × ${b.turno}` };
    }
  }
  const t = ts[0];
  const n = Math.max(1, Math.floor(total / t.dia));
  return { diaria: Number(t.diaria), transporte: Number(t.passagem || 0), dias: n, custoExtra: r2(total - n * t.dia), turno: t.turno };
}

async function acharPrestador(tipo, nome) {
  const lista = await prisma.prestador.findMany({ where: { tipo } });
  const n = sa(nome);
  return lista.find((p) => sa(p.nome) === n) || lista.find((p) => sa(p.nome).startsWith(n + " ") || n.startsWith(sa(p.nome) + " "))
    || lista.find((p) => sa(p.nome).split(" ")[0] === n.split(" ")[0] && n.split(" ").length === 1) || null;
}

async function rateioDe(parceiro) {
  const tok = sa(parceiro).split(" ").find((w) => w.length >= 4) || sa(parceiro);
  const t = await prisma.finTitulo.findFirst({ where: { tipo: "PAGAR", status: { not: "CANCELADO" }, parceiro: { contains: tok, mode: "insensitive" } }, orderBy: { vencimento: "desc" } });
  return t && Array.isArray(t.rateio) && t.rateio.length ? t.rateio : [];
}

export async function lancarLote0910(quem = "SISTEMA · LOTE 09/10") {
  if (await prisma.finConfig.findUnique({ where: { chave: FLAG } })) return null;
  await prisma.finConfig.create({ data: { chave: FLAG, valor: "EM ANDAMENTO" } });   // marca antes: não roda em dobro
  try { return await executar(quem); }
  catch (e) { await prisma.finConfig.delete({ where: { chave: FLAG } }).catch(() => null); throw e; }   // deu erro: tenta de novo na próxima abertura (sem duplicar)
}

async function executar(quem) {
  const rel = [];
  // 1) contas comuns
  for (const [venc, parc, valor, desc] of CONTAS) {
    const v = d(venc);
    const tok = sa(parc).split(" ")[0];
    const perto = await prisma.finTitulo.findMany({ where: { tipo: "PAGAR", status: { not: "CANCELADO" }, vencimento: { gte: new Date(+v - 15 * DIA), lte: new Date(+v + 15 * DIA) } } });
    const igual = perto.find((t) => Math.abs(Number(t.valor) - valor) < 0.01 && (sa(`${t.parceiro} ${t.titulo}`).includes(tok) || Math.abs(+t.vencimento - +v) <= 3 * DIA));
    if (igual) { rel.push(`JÁ EXISTIA · ${parc} R$ ${brl(valor)} (${igual.titulo})`); continue; }
    // só a recorrência do mesmo fornecedor (nome igual), ainda não conferida: ajusta valor e vencimento
    const rec = perto.find((t) => t.recorrenciaId && t.status === "ABERTO" && !t.valorConfirmado && (sa(t.parceiro) === sa(parc) || sa(t.titulo) === sa(parc)) && t.competencia === venc.slice(0, 7));
    if (rec) {
      await prisma.finTitulo.update({ where: { id: rec.id }, data: { valor, vencimento: v, valorConfirmado: true, previsao: false,
        observacao: [rec.observacao, desc].filter(Boolean).join(" · ").slice(0, 1000), atualizadoPorNome: quem } });
      rel.push(`RECORRÊNCIA AJUSTADA · ${parc}: R$ ${brl(Number(rec.valor))} → R$ ${brl(valor)}, venc. ${venc.split("-").reverse().join("/")}`);
      continue;
    }
    const rateio = await rateioDe(parc);
    await prisma.finTitulo.create({ data: {
      tipo: "PAGAR", titulo: desc.split(" · ")[0].toUpperCase(), parceiro: sa(parc) === "GUIMARAES" ? "GUIMARÃES" : parc.toUpperCase(), valor, vencimento: v, competencia: venc.slice(0, 7),
      previsao: false, status: "ABERTO", rateio, observacao: desc.toUpperCase(), forma: "MANUAL", valorConfirmado: true, criadoPorNome: quem,
      ...(rateio.length ? {} : { critica: "Lançada pelo lote de 09/10 sem conta-caixa: escolha o rateio." }),
    } });
    rel.push(`LANÇADA · ${parc} R$ ${brl(valor)}${rateio.length ? "" : " (sem conta-caixa — conferir)"}`);
  }
  // 2) facções (terceirizados da semana)
  await garantirContasPrestadores();
  for (const [venc, nome, valor, desc, pedido] of FACCOES) {
    const p = await acharPrestador("TERCEIRIZADO", nome);
    const casca = await tituloDaData("TERCEIRIZADO", SEXTA, false);
    const ja = await prisma.finSemanaItem.findFirst({ where: { tituloId: casca.id, valor, nome: { contains: sa(nome).split(" ")[0], mode: "insensitive" } } });
    const avulsa = await prisma.finTitulo.findFirst({ where: { tipo: "PAGAR", status: { not: "CANCELADO" }, valor, NOT: { chaveImport: { startsWith: "SEMANA|" } }, parceiro: { contains: sa(nome).split(" ")[0], mode: "insensitive" } } });
    if (ja || avulsa) { rel.push(`JÁ EXISTIA · FACÇÃO ${nome} R$ ${brl(valor)}`); continue; }
    const serv = (p?.servicos || []).map(String).find((s) => s.startsWith("FACCAO:"));
    const setor = serv ? serv.split(":")[1] : "CAMISETA";
    const conta = await prisma.finConta.findUnique({ where: { codigo: contaDoSetor("FACCAO", setor) } });
    await prisma.finSemanaItem.create({ data: {
      tituloId: casca.id, grupo: "FACCAO", prestadorId: p?.id || null, nome: (p?.nome || nome).toUpperCase(), chavePix: p?.chavePix || "", setor, contaId: conta?.id,
      linhas: [{ pedido, item: desc.toUpperCase(), qtd: 1, unitario: valor, total: valor }], valor, dataRecebimento: d(venc), prazoDias: 0, vencimentoNegociado: d(venc),
      descricao: desc.toUpperCase(), observacao: `LANÇADO PELO LOTE DE 09/10 · VENC. ${venc.split("-").reverse().join("/")}${p?.chavePix ? "" : " · SEM PIX NO CADASTRO"}`, criadoPorNome: quem,
    } });
    rel.push(`FACÇÃO · ${p?.nome || nome} R$ ${brl(valor)} (${setor})${p ? "" : " — sem cadastro"}${p?.chavePix ? "" : " — sem PIX"}`);
  }
  {
    const casca = await tituloDaData("TERCEIRIZADO", SEXTA, false);
    await recalcular(casca.id);
  }
  // 3) freelancers da semana de 09/10
  const cascaF = await tituloDaData("FREELANCER", SEXTA, false);
  const lump = await prisma.finTitulo.findFirst({ where: { tipo: "PAGAR", status: { not: "CANCELADO" }, valor: 9792.42, NOT: { chaveImport: { startsWith: "SEMANA|" } } } });
  for (const [nome, valor] of FREELANCERS) {
    const p = await acharPrestador("FREELANCER", nome);
    const nm = (p?.nome || nome).toUpperCase();
    if (await prisma.finSemanaItem.findFirst({ where: { tituloId: cascaF.id, nome: nm } })) { rel.push(`JÁ EXISTIA · FREELANCER ${nm}`); continue; }
    const setor = (p?.servicos || [])[0] || "COSTURA";
    const conta = await prisma.finConta.findUnique({ where: { codigo: contaDoSetor("FREELANCER", setor) } });
    const x = diasPelaDiaria(valor, p?.diarias);
    await prisma.finSemanaItem.create({ data: {
      tituloId: cascaF.id, grupo: "FREELANCER", prestadorId: p?.id || null, nome: nm, chavePix: p?.chavePix || "", setor, contaId: conta?.id,
      diaria: x.diaria, transporte: x.transporte, dias: x.dias, custoExtra: x.custoExtra, valor,
      justificativa: x.custoExtra ? `FECHAMENTO DA SEMANA 05 A 09/10 = R$ ${brl(valor)}${x.misto ? ` (${x.misto})` : " (DIFERENÇA SOBRE AS DIÁRIAS DO CADASTRO)"}` : null,
      observacao: `LANÇADO PELO LOTE DE 09/10${p ? "" : " · SEM CADASTRO"}${p?.chavePix ? "" : " · SEM PIX"}`, criadoPorNome: quem, linhas: [],
    } });
    rel.push(`FREELANCER · ${nm} R$ ${brl(valor)} = ${x.dias} dia(s) × ${brl(x.diaria + x.transporte)}${x.custoExtra ? ` + extra ${brl(x.custoExtra)}` : ""}${p ? "" : " — sem cadastro"}`);
  }
  await recalcular(cascaF.id);
  if (lump) {
    await prisma.finTitulo.update({ where: { id: lump.id }, data: { critica: "Os freelancers de 05 a 09/10 (R$ 9.792,42) foram lançados item a item na conta FREELANCERS DA SEMANA de 09/10. Esta conta avulsa ficou repetida: exclua." } });
    rel.push("ATENÇÃO · havia uma conta avulsa FREELANCER de R$ 9.792,42 — marcada com crítica para excluir (os itens estão na semana)");
  }
  const texto = `LOTE DE CONTAS A PAGAR 01 A 09/10/2026\n${rel.join("\n")}`;
  await prisma.finConfig.update({ where: { chave: FLAG }, data: { valor: texto.slice(0, 9000) } });
  const masters = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { diretoria: true }] }, select: { id: true } });
  if (masters.length) await prisma.mensagem.createMany({ data: masters.map((u) => ({ deId: masters[0].id, paraId: u.id, texto: texto.slice(0, 2000) })) }).catch(() => null);
  return { linhas: rel };
}
