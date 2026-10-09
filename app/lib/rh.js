// RH (Lorraine): Matriz de pessoal (a mesma da Matriz de custos do financeiro), carômetro,
// documentos mensais ligados ao contas a pagar e calendário de obrigações — Meridian e NORT.
import { prisma } from "@/lib/prisma";
import { nDiaUtil, mesAtual, somaMes } from "@/lib/finTitulos";
import { veRHCompleto, tem, temAlguma } from "@/lib/acesso";

export const nomeUsuario = (u) => [u?.nome, u?.sobrenome].filter(Boolean).join(" ").toUpperCase();

// v170 — guia RH: master/diretoria e RH veem tudo; quem tem a permissão "documentos de RH" (administrativo) entra só nos documentos e no ponto
const SEL_RH = { id: true, nome: true, sobrenome: true, isMaster: true, setor: true, ativo: true, diretoria: true, permissoes: true };
async function ativo(id) {
  const uid = Number(id);
  if (!uid) return null;
  const u = await prisma.usuario.findUnique({ where: { id: uid }, select: SEL_RH });
  return u && u.ativo ? u : null;
}
export async function usuarioRH(id) {
  const u = await ativo(id);
  return u && (veRHCompleto(u) || tem(u, "docsRH")) ? u : null;
}
// dados de pessoal (salários, carômetro, painel, férias): master, diretoria e RH
export async function usuarioRHCompleto(id) {
  const u = await ativo(id);
  return u && veRHCompleto(u) ? u : null;
}
// importar documento / anexos de contas: documentos de RH, contas ou documentos financeiros
export async function usuarioDocs(id) {
  const u = await ativo(id);
  return u && (veRHCompleto(u) || temAlguma(u, "docsRH", "contasPagar", "contasReceber", "docsFinanceiros")) ? u : null;
}
export const negadoRH = () => Response.json({ error: "Sem permissão para esta área do RH." }, { status: 403 });

export const empresaDaPessoa = (p) => (p?.depto === "NORT" ? "NORT" : "MERIDIAN");

// Qualquer mudança no quadro: mensagem para o financeiro e para a operação (PCP e administrativo)
export async function notificarQuadro(texto, deId) {
  const destinos = await prisma.usuario.findMany({
    where: { ativo: true, OR: [{ isMaster: true }, { setor: { in: ["FINANCEIRO", "PCP", "ADMINISTRATIVO"] } }] }, select: { id: true },
  });
  const para = destinos.filter((u) => u.id !== deId);
  if (!para.length) return 0;
  await prisma.mensagem.createMany({ data: para.map((u) => ({ deId: deId || para[0].id, paraId: u.id, texto: String(texto).slice(0, 2000) })) });
  return para.length;
}

// Avisos só para o financeiro (master + setor FINANCEIRO)
export async function notificarFinanceiro(texto, deId) {
  const destinos = await prisma.usuario.findMany({ where: { ativo: true, OR: [{ isMaster: true }, { setor: "FINANCEIRO", diretoria: false }] }, select: { id: true } });
  const para = destinos.filter((u) => u.id !== deId);
  if (!para.length) return 0;
  await prisma.mensagem.createMany({ data: para.map((u) => ({ deId: deId || para[0].id, paraId: u.id, texto: String(texto).slice(0, 2000) })) });
  return para.length;
}

// ---------- pessoal (Matriz oficial) ----------
export const CAMPOS_PESSOA = ["nome", "cargo", "depto", "regime", "salario", "bonus", "vt", "descontaVt", "vr", "ps", "assPct",
  "saldoLivre", "rFerias", "adiantamento", "ativo", "obs", "admissao", "demissao"];
const ROTULO = { nome: "nome", cargo: "cargo", depto: "setor", regime: "regime", salario: "salário", bonus: "bônus", vt: "VT", descontaVt: "desconta VT",
  vr: "VA/VR", ps: "plano de saúde", assPct: "assiduidade", saldoLivre: "saldo livre", rFerias: "reflexo férias", adiantamento: "adiantamento",
  ativo: "ativo", obs: "observação", admissao: "admissão", demissao: "desligamento" };

export async function lerPessoal() {
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  const pessoas = m?.dados?.pessoal || [];
  const fichas = await prisma.rhFuncionario.findMany({ select: { pessoaId: true, nomeCompleto: true, foto: true, dados: true, _count: { select: { documentos: true } } } });
  const porId = Object.fromEntries(fichas.map((f) => [f.pessoaId, f]));
  return {
    matrizId: m?.id || null, atualizadaEm: m?.updatedAt || null, atualizadaPor: m?.atualizadoPor || null,
    pessoas: pessoas.map((p) => ({
      ...p, empresa: empresaDaPessoa(p), nomeCompleto: porId[p.id]?.nomeCompleto || null,
      foto: porId[p.id]?.foto || null, nDocs: porId[p.id]?._count?.documentos || 0, horario: porId[p.id]?.dados?.horario || null,
    })),
  };
}

const limpa = (p) => {
  const o = {};
  for (const k of CAMPOS_PESSOA) if (p[k] !== undefined) o[k] = p[k];
  for (const k of ["salario", "bonus", "vt", "vr", "ps", "assPct", "saldoLivre", "rFerias"]) if (o[k] !== undefined) o[k] = Number(o[k]) || 0;
  for (const k of ["nome", "cargo", "obs"]) if (o[k] !== undefined) o[k] = String(o[k] || "").toUpperCase().trim();
  return o;
};

// acao: EDITAR | ADMITIR | DESLIGAR | REATIVAR
export async function salvarPessoa({ acao, pessoa, nomeCompleto }, u) {
  const m = await prisma.finMatriz.findFirst({ where: { oficial: true } });
  if (!m) return { error: "Matriz oficial não encontrada." };
  const dados = JSON.parse(JSON.stringify(m.dados));
  dados.pessoal = dados.pessoal || [];
  const quem = nomeUsuario(u);
  let p, antes = null, resumo;
  if (acao === "ADMITIR") {
    const novo = limpa(pessoa || {});
    if (!novo.nome) return { error: "Informe o nome." };
    if (!novo.depto) return { error: "Informe o setor." };
    const ids = dados.pessoal.map((x) => Number(String(x.id).replace(/\D/g, "")) || 0);
    p = {
      id: `p${Math.max(0, ...ids) + 1}`, cargo: "", regime: "CLT", salario: 0, bonus: 0, vt: 287.5, descontaVt: true, vr: 100, ps: 54.9,
      assPct: 0.05, saldoLivre: 0, rFerias: 0, adiantamento: false, obs: "", ...novo, ativo: true,
    };
    dados.pessoal.push(p);
    resumo = `ADMISSÃO de ${p.nome} (${p.cargo || "—"}, setor ${p.depto}, ${empresaDaPessoa(p)})${p.admissao ? ` em ${p.admissao.split("-").reverse().join("/")}` : ""} · salário R$ ${Number(p.salario).toFixed(2).replace(".", ",")}`;
  } else {
    p = dados.pessoal.find((x) => x.id === pessoa?.id);
    if (!p) return { error: "Funcionário não encontrado na Matriz." };
    antes = { ...p };
    if (acao === "DESLIGAR") {
      p.ativo = false;
      p.demissao = pessoa.demissao || new Date().toISOString().slice(0, 10);
      if (pessoa.obs !== undefined) p.obs = String(pessoa.obs || "").toUpperCase();
      resumo = `DESLIGAMENTO de ${p.nome} (${p.cargo || "—"}, ${empresaDaPessoa(p)}) em ${p.demissao.split("-").reverse().join("/")}`;
    } else if (acao === "REATIVAR") {
      p.ativo = true; p.demissao = null;
      resumo = `REATIVAÇÃO de ${p.nome} (${empresaDaPessoa(p)})`;
    } else {
      Object.assign(p, limpa(pessoa));
      const mud = CAMPOS_PESSOA.filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(p[k] ?? null))
        .map((k) => `${ROTULO[k]}: ${antes[k] ?? "—"} → ${p[k] ?? "—"}`);
      if (!mud.length && nomeCompleto === undefined) return { ok: true, semMudanca: true };
      resumo = mud.length ? `ALTERAÇÃO de ${p.nome} (${empresaDaPessoa(p)}): ${mud.join(" · ")}` : null;
    }
  }
  if (nomeCompleto !== undefined) {
    await prisma.rhFuncionario.upsert({ where: { pessoaId: p.id }, create: { pessoaId: p.id, nomeCompleto: String(nomeCompleto || "").toUpperCase() || null, atualizadoPorNome: quem },
      update: { nomeCompleto: String(nomeCompleto || "").toUpperCase() || null, atualizadoPorNome: quem } });
  }
  if (!resumo) return { ok: true, pessoa: p };
  await prisma.finMatrizVersao.create({ data: { matrizId: m.id, dados: m.dados, usuarioNome: m.atualizadoPor, resumo: `antes de: RH · ${resumo}`.slice(0, 300) } });
  await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: `${quem} (RH)` } });
  // as contas de pessoal do financeiro acompanham a Matriz na hora
  const { sincronizarPessoal } = await import("@/lib/finMatrizRecDb");
  const contas = await sincronizarPessoal(`${quem} (RH)`).catch((e) => ({ error: e.message }));
  const avisados = await notificarQuadro(`RH · ${resumo}. Matriz de custos e contas de pessoal atualizadas. Por ${quem}.`, u.id);
  return { ok: true, pessoa: p, resumo, contas, avisados };
}

// ---------- calendário de obrigações ----------
// · folha (fopag + resumo de líquidos) do mês anterior: até o 3º dia útil
// · adiantamento do mês: até o dia 17
// · impostos (INSS e FGTS) do mês anterior: até o dia 17
// · relatório de recargas do iFood + boleto (PDF ou PIX copia e cola): até o dia 25
const iso = (d) => d.toISOString().slice(0, 10);
export async function calendario(comp = mesAtual()) {
  const envios = await prisma.rhEnvio.findMany({ where: { competencia: comp } });
  // documento que já entrou por outro caminho (contas a pagar, importação antiga…): a conta do mês tem anexo
  const CHAVES = {
    MERIDIAN: { FOLHA: "MATRIZ|pessoal|SALARIO", ADIANTAMENTO: "MATRIZ|pessoal|ADIANTAMENTO", INSS: "MATRIZ|pessoal|INSS", FGTS: "MATRIZ|pessoal|FGTS", IFOOD: "MATRIZ|pessoal|IFOOD" },
    NORT: { FOLHA: "NORT|FOLHA5", ADIANTAMENTO: "NORT|ADIANTAMENTO", INSS: "NORT|INSS", FGTS: "NORT|FGTS", IFOOD: "NORT|BENEFICIOS" },
  };
  const recs = await prisma.finRecorrencia.findMany({ where: { chaveOrigem: { in: Object.values(CHAVES).flatMap((x) => Object.values(x)) } }, select: { id: true, chaveOrigem: true } });
  const recId = Object.fromEntries(recs.map((r) => [r.chaveOrigem, r.id]));
  const titulos = await prisma.finTitulo.findMany({
    where: { tipo: "PAGAR", competencia: comp, status: { not: "CANCELADO" } },
    select: { id: true, titulo: true, recorrenciaId: true, _count: { select: { anexos: true } } },
  });
  const PISTA = { FOLHA: /SAL[AÁ]RIO|FOLHA 5/, ADIANTAMENTO: /ADIANT/, INSS: /\bINSS\b/, FGTS: /\bFGTS\b/, IFOOD: /IFOOD|BENEF/ };
  const anexado = (emp, cat) => titulos.some((t) => t._count.anexos > 0 && (t.recorrenciaId === recId[CHAVES[emp][cat]]
    || (PISTA[cat].test(t.titulo.toUpperCase()) && (emp === "NORT") === /NORT/.test(t.titulo.toUpperCase()) && !/RESCIS/.test(t.titulo.toUpperCase()))));
  const enviado = (emp, c) => envios.some((e) => e.empresa === emp && e.categoria === c) || anexado(emp, c);
  const tem = (emp, cats) => cats.every((c) => enviado(emp, c));
  const [a, mm] = comp.split("-").map(Number);
  const dia17 = `${comp}-17`;
  const terceiro = iso(nDiaUtil(comp, 3));
  const hoje = new Date().toISOString().slice(0, 10);
  const nomeMes = (c) => ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(c.split("-")[1]) - 1];
  const ant = somaMes(comp, -1);
  const out = [];
  for (const emp of ["MERIDIAN", "NORT"]) {
    for (const [ob, prazo, cats, desc] of [
      ["FOLHA", terceiro, ["FOLHA"], `Folha de ${nomeMes(ant)} (fopag + líquidos)`],
      ["ADIANTAMENTO", dia17, ["ADIANTAMENTO"], `Adiantamento de ${nomeMes(comp)}`],
      ["IMPOSTOS", dia17, ["INSS", "FGTS"], `Guias de INSS e FGTS de ${nomeMes(ant)}`],
      ["IFOOD", `${comp}-25`, ["IFOOD"], `Recargas do iFood de ${nomeMes(comp)} + boleto/PIX`],
    ]) {
      const feito = tem(emp, cats);
      const parcial = !feito && cats.length > 1 && cats.some((c) => enviado(emp, c));
      const dias = Math.round((new Date(`${prazo}T12:00:00Z`) - new Date(`${hoje}T12:00:00Z`)) / 86400000);
      out.push({
        empresa: emp, obrigacao: ob, descricao: desc, prazo, dias, feito, parcial,
        faltam: cats.filter((c) => !enviado(emp, c)),
        status: feito ? "OK" : dias < 0 ? "ATRASADO" : dias <= 2 ? "VENCENDO" : "PENDENTE",
        enviados: envios.filter((e) => e.empresa === emp && cats.includes(e.categoria)).map((e) => ({ arquivo: e.arquivo, em: e.createdAt, por: e.criadoPorNome })),
      });
    }
  }
  return { competencia: comp, ano: a, mes: mm, itens: out };
}

// categoria do documento pela conta que recebeu (para o calendário)
export function categoriaEnvio(it, titulo) {
  if (it.tipo === "FOLHA") return "FOLHA";
  if (it.tipo === "IFOOD") return "IFOOD";
  if (it.tipo === "GUIA" && ["INSS", "FGTS"].includes(it.guia)) return it.guia === "FGTS" && /RESCIS/.test(String(it.descricao)) ? "RESCISAO" : it.guia;
  const t = String(`${titulo?.titulo || ""} ${it.descricao || ""}`).toUpperCase();
  if (/ADIANT/.test(t)) return "ADIANTAMENTO";
  if (/IFOOD|BENEF/.test(t)) return "IFOOD";
  if (/RESCIS/.test(t)) return "RESCISAO";
  if (/ESTAGI/.test(t)) return "ESTAGIO";
  if (/SAL[AÁ]RIO|FOLHA/.test(t)) return "FOLHA";
  return "OUTRO";
}
