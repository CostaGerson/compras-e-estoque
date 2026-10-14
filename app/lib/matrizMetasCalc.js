// v219 — parte pura (sem banco) das metas da Matriz: usada no servidor e na tela de Metas (impacto ao vivo)
// aplica as metas da Gestão nos dados da Matriz (só na oficial)
export function aplicarMetas(dados, mg) {
  if (!dados || !mg) return dados;
  const pr = { ...(dados.producao || {}) };
  if (mg.pcsMedia) pr.metaPecas = mg.pcsMedia;          // média mensal da meta do ano
  if (mg.ticket != null) pr.ticketMedio = mg.ticket;
  if (mg.margem != null) pr.margemContribuicao = mg.margem;
  return { ...dados, producao: pr, metasGestao: mg };
}

