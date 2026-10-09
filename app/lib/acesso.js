// v170 — tipos de usuário e permissões (planilha "usuários e permissões" do Igor)
//   MASTER    = chave "Usuário master": tudo, e só ele cadastra/edita usuários e altera permissões
//   DIRETORIA = chave Diretoria: todos os painéis gerenciais e todas as funções operacionais (não gerencia usuários)
//   demais    = tipo pelo setor; cada tipo tem suas permissões possíveis (chaves por usuário, ligadas por padrão)
export const SETORES = [
  "FINANCEIRO", "PCP", "COMPRAS", "ESTOQUE", "ADMINISTRATIVO", "RH",
  "PRODUCAO", "COMERCIAL", "CORTE", "BORDADO", "SILK", "SUBLIMACAO", "DTF", "COSTURA", "EXPEDICAO", "LOGISTICA", "NORT",
];
export const SETOR_NOME = {
  FINANCEIRO: "FINANCEIRO", PCP: "PCP", COMPRAS: "COMPRAS", ESTOQUE: "ESTOQUE", ADMINISTRATIVO: "ADMINISTRATIVO", RH: "RH",
  PRODUCAO: "PRODUÇÃO", COMERCIAL: "COMERCIAL", CORTE: "CORTE", BORDADO: "BORDADO", SILK: "SILK", SUBLIMACAO: "SUBLIMAÇÃO", DTF: "DTF",
  NORT: "NORT", COSTURA: "COSTURA", EXPEDICAO: "EXPEDIÇÃO", LOGISTICA: "LOGÍSTICA",
};
export const SETORES_LIDER = ["CORTE", "SILK", "BORDADO", "SUBLIMACAO", "DTF", "COSTURA", "EXPEDICAO"];

export const TIPO_NOME = { MASTER: "Master", DIRETORIA: "Diretoria", COMERCIAL: "Comercial", PRODUCAO: "Produção", LIDER: "Líder de setor",
  ADMINISTRATIVO: "Administrativo", FINANCEIRO: "Financeiro", RH: "RH", BASICO: "Operacional (agenda, tarefas e rota)" };
export function tipoDe(u) {
  if (!u) return "BASICO";
  if (u.isMaster) return "MASTER";
  if (u.diretoria) return "DIRETORIA";
  const s = u.setor;
  if (s === "COMERCIAL") return "COMERCIAL";
  if (["PRODUCAO", "PCP", "COMPRAS", "ESTOQUE"].includes(s)) return "PRODUCAO";
  if (SETORES_LIDER.includes(s)) return "LIDER";
  if (s === "ADMINISTRATIVO") return "ADMINISTRATIVO";
  if (s === "FINANCEIRO") return "FINANCEIRO";
  if (s === "RH") return "RH";
  return "BASICO";   // LOGÍSTICA, NORT
}

export const PERMISSOES = {
  fpp: "Lança, edita e exclui FPPs",
  proposta: "Gera proposta comercial",
  crm: "Evolui status de negociações no CRM",
  pedidoVenda: "Gera pedido de venda",
  pp: "Lança, edita e exclui pedidos de produção",
  ppStatus: "Evolui status e programação de pedidos",
  pic: "Gera pedido interno de compras (PIC)",
  fme: "Movimenta estoque (FME)",
  cronometro: "Inicia e finaliza o cronômetro do seu setor",
  faturamento: "Fatura pedidos de produção (emissão, correção e cancelamento de NF)",
  contasPagar: "Lança, edita e exclui contas a pagar, inclusive por importação",
  contasReceber: "Lança, edita e exclui contas a receber, inclusive por importação",
  nfEntrada: "Dá entrada em NF de compra/prestação de serviço, inclusive por importação",
  rotas: "Lança, edita e exclui rotas",
  docsFinanceiros: "Lança, edita e exclui documentos financeiros (extratos, contratos, guias, posição…), inclusive por importação",
  docsRH: "Lança, edita e exclui documentos de RH (folha, ponto, guias trabalhistas, recargas de benefícios…), inclusive por importação",
};
export const PERMS_DO_TIPO = {
  COMERCIAL: ["fpp", "proposta", "crm", "pedidoVenda"],
  PRODUCAO: ["pp", "ppStatus", "pic", "fme"],
  LIDER: ["cronometro"],
  ADMINISTRATIVO: ["faturamento", "contasPagar", "contasReceber", "nfEntrada", "rotas", "docsFinanceiros", "docsRH"],
  FINANCEIRO: ["contasPagar", "contasReceber", "docsFinanceiros"],
  RH: ["docsRH"],
  BASICO: [],
};
export const VISAO_DO_TIPO = {
  MASTER: "Todas as visualizações", DIRETORIA: "Todos os painéis gerenciais",
  COMERCIAL: "Todos os dados de venda", PRODUCAO: "Todos os dados de produção", LIDER: "Metas e evolução da meta do seu setor",
  ADMINISTRATIVO: "Não visualiza dados gerenciais", FINANCEIRO: "Não visualiza dados gerenciais", RH: "Todos os dados da guia RH",
  BASICO: "Agenda, tarefas e rota",
};

export const ehMaster = (u) => !!u && !!u.isMaster;                 // v170 — setor FINANCEIRO não é mais master
export const ehDiretor = (u) => !!u && !!u.diretoria && !u.isMaster;
export const gerencial = (u) => ehMaster(u) || ehDiretor(u);         // todos os painéis gerenciais e todas as funções
export const veFinanceiro = gerencial;                               // compatibilidade: valores e painéis gerenciais
// permissão operacional: master/diretoria têm todas; os demais, as do seu tipo que estiverem ligadas
export function tem(u, perm) {
  if (!u) return false;
  if (gerencial(u)) return true;
  const doTipo = PERMS_DO_TIPO[tipoDe(u)] || [];
  if (!doTipo.includes(perm)) return false;
  return !Array.isArray(u.permissoes) || u.permissoes.includes(perm);
}
export const temAlguma = (u, ...perms) => perms.some((p) => tem(u, p));
// importar/excluir documentos importados: com permissão (ou master/diretoria quando não se informa a permissão)
export const podeImportar = (u, ...perms) => (perms.length ? temAlguma(u, ...perms) : gerencial(u));
export const SO_MASTER_MSG = "Sem permissão para importar ou excluir este documento.";
export const veRHCompleto = (u) => gerencial(u) || tipoDe(u) === "RH";

// v169 — setores das Tarefas (demandas entre setores)
export const SETORES_TAREFA = [["GESTAO", "Gestão"], ["COMERCIAL", "Comercial"], ["FINANCEIRO", "Financeiro"], ["PRODUCAO", "Produção"], ["RH", "RH"], ["LOGISTICA", "Logística"]];
export const NOME_SETOR_TAREFA = Object.fromEntries(SETORES_TAREFA);
export function setorTarefaDe(u) {
  if (!u) return "GESTAO";
  if (u.diretoria || u.isMaster) return "GESTAO";
  const s = u.setor;
  if (s === "FINANCEIRO") return "FINANCEIRO";
  if (s === "COMERCIAL" || s === "NORT") return "COMERCIAL";
  if (s === "RH") return "RH";
  if (s === "LOGISTICA") return "LOGISTICA";
  if (s === "ADMINISTRATIVO") return "GESTAO";
  return "PRODUCAO";   // PCP, COMPRAS, ESTOQUE, PRODUÇÃO, CORTE, BORDADO, SILK, SUBLIMAÇÃO, DTF, COSTURA, EXPEDIÇÃO
}
