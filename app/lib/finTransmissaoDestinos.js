// v171 — destinos da Transmissão de arquivos (usado no servidor e na tela)
export const DESTINOS = {
  DOCUMENTO: { rotulo: "Documentos financeiros", desc: "Boletos, guias, folha, recibos, iFood, comprovantes (baixa das contas) e extratos/faturas parciais (lançamentos já identificáveis; o mensal entra pelo card da Importação)", perms: ["contasPagar", "contasReceber", "docsFinanceiros", "docsRH"] },
  NF: { rotulo: "Notas fiscais", desc: "XML e DANFE/NFS-e: entradas viram contas a pagar e saídas contas a receber (Movimento fiscal)", perms: ["nfEntrada", "contasPagar", "contasReceber", "faturamento"] },
  RETORNO: { rotulo: "Retorno de cobrança (CNAB)", desc: "Registro, liquidação e tarifas dos boletos: baixa as contas a receber", perms: ["contasReceber"] },
  ANTECIPACAO: { rotulo: "Antecipação de recebíveis", desc: "Contrato de desconto de duplicatas: baixa as contas descontadas e lança os custos", perms: ["contasReceber"], porArquivo: true },
  POSICAO: { rotulo: "Posição de contas (planilha)", desc: "Planilha de posição: importa e confere duplicidades das contas a pagar/receber", perms: ["contasPagar", "contasReceber"], porArquivo: true },
  HISTORICO: { rotulo: "Histórico de lançamentos (.txt)", desc: "Lançamentos antigos já identificados para a análise mensal", perms: ["docsFinanceiros"], porArquivo: true },
  PONTO: { rotulo: "Cartões de ponto", desc: "Vai para o RH: assiduidade, pontualidade e horas extras", perms: ["docsRH"] },
  OFX: { rotulo: "Extrato OFX", desc: "Vai para o pacote da contabilidade do mês (banco e mês identificados no arquivo)", perms: ["docsFinanceiros"], direto: true },
  SPED: { rotulo: "SPED", desc: "Vai para o pacote da contabilidade do mês", perms: ["docsFinanceiros"], direto: true },
  DESCONHECIDO: { rotulo: "Não identificados", desc: "Formato não cadastrado — confira o arquivo", perms: [] },
};
