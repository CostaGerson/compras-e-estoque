# v788 — sugestões #54, #55, #69 e #70 (a #9 fica para depois)

- **#54 (Lorraine)** — RH › Férias: nomes em ordem alfabética dentro de cada setor (a Matriz de pessoal já estava na v766).
- **#55 (Lorraine)** — VT por dia, cesta e VA por dia com apuração mensal pelo ponto: entregue na v766, só faltava acatar.
- **#69 (Maycon)** — Demandas da agenda: botão **baixar todos** (.zip) nos Arquivos e na lista de aprovação (`GET /api/tarefas/:id/arquivos?zip=1[&ids=]`).
- **Fluxo do designer (pedido do Igor, 12/11)** — demanda com aprovação mostra **um card por versão** (V1, V2…): arquivos enviados, quem enviou e quando, aprovada/reprovada com as instruções, e "baixar V2". A rodada em preparação aparece como a próxima versão com as instruções da anterior. Nos Arquivos da demanda, cada arquivo leva a etiqueta "briefing" ou "resposta".
  - `versoesAprovacao(t)` em `lib/tarefaAprovacao.js`; `GET /api/tarefas/:id/aprovacao` devolve `versoes` e serve `?arquivo=` e `?zip=1&versao=`.
- **#70 (Igor)** — Rotas:
  - **Anexos na demanda** (modelo `RotaDemandaArquivo`, até 15 MB cada; na demanda nova sobem ao salvar). O motorista vê os anexos no app.
  - **Demanda estimada**: o antigo "Com pendência" virou "Estimada (confirmar depois)". Ela **não entra numa rota** até ser confirmada (bloqueio no servidor em `salvarBloco`).
  - Botão **Confirmar demanda** no formulário e **Confirmar** na linha da janela "Montar rota". A confirmação fica registrada na observação.
