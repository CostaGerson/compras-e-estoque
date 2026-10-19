# v310 — Painel de previsão refeito (Igor, 19/10/2026)

Código: `lib/finPainel.js` (novo; `finDre` reexporta `painel`/`salvarPainel`), `api/fin/painel` (GET `acao=salvo|comparar`, PUT `retrato`), tela `PainelPrevisao` em `financeiro.jsx`.

- **O painel da competência C é a previsão do mês seguinte (M = C+1)**: a posição automática usa M ("Previsão de novembro/2026" no painel de outubro).
- **Posição automática**: contas atrasadas (pagar, sem previsões; clique = lista) · a pagar no mês (inclui previsões, mostradas à parte) · a pagar total em aberto **sem previsões** · a receber posição geral (**real**; clique = virtual pela regra das antecipações e atrasados por modalidade: em cobrança / em execução) · a receber no mês (real; mesmo detalhe) · a receber atrasado (cobrança + execução; clique = listas por modalidade com seleção da **quitação provável**). Saíram os cards de execução e de perdas reconhecidas.
- **Bancos** já vêm lançados com os limites (Bradesco 50.000 · Itaú 22.819 · Itaú cx aval 7.000 · Caixa 10.000 · C6 15.000 · Inter 0 · BB 1.000); saldo a preencher.
- **Contas atrasadas** automáticas; **Prioridade do mês** com botão + (seleciona entre as atrasadas; listadas abaixo).
- **Contas a receber**: previsão e litígio digitados (virão do sistema do Maycon); **fora do mês** = recebíveis depois do último dia de M (real; clique = virtual); **quitação provável** = seleção feita nos atrasados. Saiu "atraso provável".
- **Previsões de entrega/recebimento** (antes "Carteira e caixa"): pedidos a entregar, a receber no mês (entregas), em andamento (virão do Maycon) e antecipação disponível (digitada).
- **Cenários calculados**: geral = a receber real + execução + em andamento − a pagar sem previsões; do mês = saldos positivos + (a receber no mês + quitação provável + entregas) − (a pagar no mês + prioridade); cobrindo = do mês − cheque em uso; sem cobrir = do mês; antecipando ± = + antecipação disponível.
- **Salvar painel** grava e guarda um retrato datado → card **Painéis salvos** (clique abre o retrato).
- **Previsto × realizado**: no painel seguinte, botão que abre o último painel salvo do mês anterior e compara com as contas pagas/recebidas no mês previsto (entradas, saídas, resultado, quitação provável, prioridade, cenário × saldo dos bancos).
