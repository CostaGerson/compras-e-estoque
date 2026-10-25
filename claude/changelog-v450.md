# v448–v451 — Faturamento → entrega, Rota no ADM, motorista

- **v448:** Rota dentro de ADM; aba Logística removida.
- **v450 — fluxo do pedido concluído no PCP** (`lib/faturamentoFluxo.js`, roda após a leitura do PCP, a gravação de NFs e ao abrir Demandas ADM):
  - Concluído na expedição (PCP do Maycon) → **A faturar** (chip e card na Gestão da produção) + demanda ADM **FATURAR PEDIDO N** com botão que abre o pedido.
  - Pedido (Gestão da produção) → **Incluir faturamento**: XML + PDF no mesmo fluxo do movimento fiscal; gravar = contas lançadas. NF que nenhuma regra ligou vai para este pedido (`vincularNfAoPedido`); total ou parcial pelas peças/valor.
  - NF com contas → a FATURAR conclui sozinha (retorno diz parcial/total). Parcial: saldo segue acompanhado no PCP; se o PCP mostrar tudo concluído → nova FATURAR do saldo; se o pedido sair do PCP → **crítica** no painel e no pedido.
  - Faturado (NF com contas) → tarefa conforme a **forma de entrega** (FPP › Logística, nova escolha; ou escolhida na tarefa): Própria → PROGRAMAR ENTREGA com **Criar demanda de rota** (cliente, endereço, ENTREGA, "ENTREGA PEDIDO N"; a tarefa conclui ao salvar a rota); Transportadora/Fretebras → ENTREGA POR …; Retirada → PROGRAMAR RETIRADA + mensagem ao vendedor (sem usuário com o nome → setor Comercial).
  - 1ª execução: NFs que já tinham contas não geram tarefa de entrega; pedidos concluídos no PCP sem NF ganham FATURAR.
  - Schema: `AdmDemanda.pedidoNumero/ref/dados`, `PedidoVenda.formaEntrega`.
- **v451:** usuário ligado ao funcionário da folha (Usuários › Funcionário da folha); freelancer/terceirizado com botão Inativar/Reativar.
