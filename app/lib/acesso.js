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
