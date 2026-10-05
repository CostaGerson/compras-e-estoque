// Confere os funcionários da folha (Meridian) com o pessoal da Matriz de custos oficial
// e corrige a Matriz: inclui quem falta e dá nome a vaga sem nome que bate com a função.
import { prisma } from "@/lib/prisma";
import { normRegra } from "@/lib/fin";

const tk = (s) => normRegra(s).split(" ").filter((w) => w.length >= 3);
const PARADAS = new Set(["AUX", "AUXILIAR", "DE", "DA", "DO", "DAS", "DOS", "II", "III"]);
const tkCargo = (s) => tk(s).filter((w) => !PARADAS.has(w));

// depto da Matriz pela função da folha
export function deptoDaFuncao(f) {
  const n = normRegra(f);
  if (/COSTUR|PILOT/.test(n)) return "COS";
  if (/CORT|PREPARACAO DA CONFECCAO|PLOT/.test(n)) return "COR";
  if (/MOTORIST|LOGIST|ENTREG/.test(n)) return "LOG";
  if (/BORDAD/.test(n)) return "BOR";
  if (/SILK|SERIGRAF/.test(n)) return "SIL";
  if (/EXPEDI|CONFERENT|ARREMAT|EMBAL/.test(n)) return "EXP";
  if (/ADMINISTR|PCP|ANALISTA|SERVICOS GERAIS|LIMPEZA|ESTAGI/.test(n)) return "ADM";
  if (/VENDED|LOJA|CAIXA|ATENDENT/.test(n)) return "NORT";
  return "COS";
}

// a pessoa da Matriz é essa da folha? (MATRIZ usa o primeiro nome ou apelido: ROSE = ROSIANE)
function casaNome(nomeMatriz, nomeFolha) {
  const m = tk(nomeMatriz), f = tk(nomeFolha);
  if (!m.length || !f.length) return false;
  if (m.every((w) => f.includes(w))) return true;
  return m.length === 1 && m[0].length >= 3 && f[0].startsWith(m[0]);
}

export async function matrizOficial() {
  return prisma.finMatriz.findFirst({ where: { oficial: true } });
}

// empresa: MERIDIAN confere com todo o pessoal menos o setor NORT; NORT confere só com o setor NORT
export async function conferirFolhaMatriz(funcionarios, empresa = "MERIDIAN") {
  const m = await matrizOficial();
  if (!m) return { semMatriz: true, ok: [], faltam: [], foraDaFolha: [] };
  const nort = empresa === "NORT";
  const pessoas = (m.dados?.pessoal || []).filter((p) => p.ativo !== false && (p.depto === "NORT") === nort);
  const usadas = new Set(), ok = [], faltam = [];
  // 1º nome a nome
  const resto = [];
  for (const f of funcionarios) {
    const p = pessoas.find((x) => !usadas.has(x.id) && x.nome && casaNome(x.nome, f.nome));
    if (p) { usadas.add(p.id); ok.push({ folha: f.nome, matriz: p.nome, depto: p.depto }); } else resto.push(f);
  }
  // 2º apelido: mesmas 3 primeiras letras e mesmo setor (ROSE = ROSIANE, costura)
  const resto2 = [];
  for (const f of resto) {
    const ini = tk(f.nome)[0]?.slice(0, 3);
    const p = ini && pessoas.find((x) => !usadas.has(x.id) && x.nome && tk(x.nome)[0]?.startsWith(ini) && (nort || x.depto === deptoDaFuncao(f.funcao || x.cargo)));
    if (p) { usadas.add(p.id); ok.push({ folha: f.nome, matriz: p.nome, depto: p.depto, apelido: true }); } else resto2.push(f);
  }
  // 3º vaga sem nome na Matriz que bate com a função
  for (const f of resto2) {
    const vaga = f.funcao && pessoas.find((x) => !usadas.has(x.id) && !String(x.nome || "").trim()
      && tkCargo(x.cargo).filter((w) => tkCargo(f.funcao).some((y) => y.startsWith(w.slice(0, 5)))).length >= 2);
    if (vaga) {
      usadas.add(vaga.id);
      faltam.push({ ...f, acao: "NOMEAR", matrizId: vaga.id, cargoMatriz: vaga.cargo, depto: vaga.depto });
    } else {
      faltam.push({ ...f, acao: "INCLUIR", depto: nort ? "NORT" : deptoDaFuncao(f.funcao || ""), empresa });
    }
  }
  // na Matriz (CLT) e fora da folha — só informação (sócios e estagiários não entram na folha)
  const foraDaFolha = pessoas.filter((p) => !usadas.has(p.id) && p.regime === "CLT").map((p) => p.nome || p.cargo);
  return { matrizId: m.id, ok, faltam, foraDaFolha };
}

// pessoas: [{ acao: INCLUIR|NOMEAR, nome, funcao, salario, depto, adiantamento, matrizId? }]
export async function corrigirMatriz(pessoas, { quem, ref } = {}) {
  const m = await matrizOficial();
  if (!m) return { error: "Matriz oficial não encontrada." };
  const dados = JSON.parse(JSON.stringify(m.dados));
  dados.pessoal = dados.pessoal || [];
  const nomes = new Set(dados.pessoal.map((p) => normRegra(p.nome)));
  let incluidas = 0, nomeadas = 0;
  const ids = dados.pessoal.map((p) => Number(String(p.id).replace(/\D/g, "")) || 0);
  let prox = Math.max(0, ...ids) + 1;
  for (const f of pessoas) {
    const partes = String(f.nome || "").toUpperCase().split(" ").filter(Boolean);
    let nome = partes[0] || "SEM NOME";
    if (nomes.has(normRegra(nome)) && partes[1]) nome = `${partes[0]} ${partes[1]}`;
    if (f.acao === "NOMEAR" && f.matrizId) {
      const p = dados.pessoal.find((x) => x.id === f.matrizId);
      if (p) { p.nome = nome; p.obs = [p.obs, `NOME DA FOLHA ${ref || ""}`.trim()].filter(Boolean).join(" · "); nomeadas++; nomes.add(normRegra(nome)); continue; }
    }
    dados.pessoal.push({
      id: `p${prox++}`, nome, cargo: String(f.funcao || "").toUpperCase().slice(0, 60) || (f.empresa === "NORT" ? "FUNCIONÁRIO NORT" : "FUNCIONÁRIO"), depto: f.depto || deptoDaFuncao(f.funcao || ""),
      regime: "CLT", salario: Number(f.salario) || 0, bonus: 0, vt: 287.5, descontaVt: true, vr: 100, ps: 54.9, assPct: 0.05,
      saldoLivre: 0, rFerias: 0, adiantamento: !!f.adiantamento, ativo: true, obs: `INCLUÍDO PELA FOLHA ${ref || ""}`.trim(),
    });
    nomes.add(normRegra(nome)); incluidas++;
  }
  if (!incluidas && !nomeadas) return { ok: true, incluidas, nomeadas };
  const resumo = `folha ${ref || ""}: ${incluidas} incluída(s), ${nomeadas} nomeada(s)`;
  await prisma.finMatrizVersao.create({ data: { matrizId: m.id, dados: m.dados, usuarioNome: m.atualizadoPor, resumo: `antes de: ${resumo}` } });
  await prisma.finMatriz.update({ where: { id: m.id }, data: { dados, atualizadoPor: quem || "IMPORTAÇÃO DA FOLHA" } });
  return { ok: true, incluidas, nomeadas, resumo };
}
