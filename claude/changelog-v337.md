# v337 — Botão "Atualizar" no Painel de previsão

- Novo botão **Atualizar** (ao lado de Salvar painel): sincroniza as contas (antecipados/recompras) e puxa os pedidos do PCP/KM para o mês previsto.
- Preenche sozinho:
  - **Pedidos a entregar** = saldo a faturar dos pedidos em andamento (sem internos NORT);
  - **A receber no mês (entregas)** = parcelas dos pedidos que caem no mês previsto;
  - **Pedidos em andamento** = tudo que os pedidos ainda vão gerar (sem as entradas já lançadas no contas a receber).
- Bancos, antecipação disponível, prioridade e quitação provável continuam como estão (digitados/selecionados).
- Mostra a data da última atualização e avisa se o PCP não respondeu (usa a última programação recebida).
- Arquivos: `lib/finPainel.js` (`atualizarPainel`), `api/fin/painel` (PUT acao=atualizar), `app/financeiro.jsx`.
