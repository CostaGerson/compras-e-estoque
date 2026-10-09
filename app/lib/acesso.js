// v167 — níveis de acesso (usado no navegador e no servidor)
//   master   = usuário master ou setor FINANCEIRO → tudo
//   diretor  = chave Diretoria → lança/edita contas e pedidos, enxerga valores do financeiro e da gestão
//              (não importa nem exclui documentos importados, não gerencia usuários)
//   demais   = o que o setor permite no menu

export const SETORES = [
  "FINANCEIRO", "PCP", "COMPRAS", "ESTOQUE", "ADMINISTRATIVO", "RH",
  "PRODUCAO", "COMERCIAL", "CORTE", "BORDADO", "SILK", "NORT", "COSTURA", "EXPEDICAO", "LOGISTICA",
];
export const SETOR_NOME = {
  FINANCEIRO: "FINANCEIRO", PCP: "PCP", COMPRAS: "COMPRAS", ESTOQUE: "ESTOQUE", ADMINISTRATIVO: "ADMINISTRATIVO", RH: "RH",
  PRODUCAO: "PRODUÇÃO", COMERCIAL: "COMERCIAL", CORTE: "CORTE", BORDADO: "BORDADO", SILK: "SILK", NORT: "NORT",
  COSTURA: "COSTURA", EXPEDICAO: "EXPEDIÇÃO", LOGISTICA: "LOGÍSTICA",
};

// v168.1 — a chave Diretoria tira o poder de master de quem está no setor FINANCEIRO (só o "Usuário master" ligado mantém)
export const ehMaster = (u) => !!u && !!(u.isMaster || (u.setor === "FINANCEIRO" && !u.diretoria));
export const ehDiretor = (u) => !!u && !!u.diretoria && !ehMaster(u);
// enxerga valores e entra no financeiro / lança e edita contas e pedidos
export const veFinanceiro = (u) => ehMaster(u) || ehDiretor(u);
// importação e exclusão de documentos importados
export const podeImportar = (u) => ehMaster(u);
export const SO_MASTER_MSG = "Importação e exclusão de documentos importados: só o master.";

// v169 — setores das Tarefas (demandas entre setores)
export const SETORES_TAREFA = [["GESTAO", "Gestão"], ["COMERCIAL", "Comercial"], ["FINANCEIRO", "Financeiro"], ["PRODUCAO", "Produção"], ["RH", "RH"], ["LOGISTICA", "Logística"]];
export const NOME_SETOR_TAREFA = Object.fromEntries(SETORES_TAREFA);
export function setorTarefaDe(u) {
  if (!u) return "GESTAO";
  if (u.diretoria || u.isMaster && u.setor !== "FINANCEIRO") return "GESTAO";
  const s = u.setor;
  if (s === "FINANCEIRO") return "FINANCEIRO";
  if (s === "COMERCIAL" || s === "NORT") return "COMERCIAL";
  if (s === "RH") return "RH";
  if (s === "LOGISTICA") return "LOGISTICA";
  if (s === "ADMINISTRATIVO") return "GESTAO";
  return "PRODUCAO";   // PCP, COMPRAS, ESTOQUE, PRODUÇÃO, CORTE, BORDADO, SILK, COSTURA, EXPEDIÇÃO
}
