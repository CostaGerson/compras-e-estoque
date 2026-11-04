# v655 — Decisões e reunião de gestão na agenda · FPP preenche o item padrão

## Decisão
- No formulário da tarefa: **Decisão** (no lugar de evento) com envolvidos e opções (2 ou mais). A situação vai na descrição.
- Os envolvidos veem a decisão na agenda (sem pedir presença) e marcam uma opção no detalhe (podem trocar até todos marcarem; o voto dos outros aparece depois de votar).
- Todos marcaram: **unânime** → resultado para quem criou/responsável decidir (mensagem); **sem unanimidade** → vira pauta automática da **próxima reunião de gestão**.
- Campo `Tarefa.decisao` (Json) · `lib/decisoes.js` · ações `votar`, `pauta`, `tirarPauta` no PATCH da tarefa.

## Reunião de gestão
- Evento mensal às **14h**, responsável Igor, convidados Pedro e Maycon (respondem como qualquer evento). Gerada no início de cada mês (só a do mês corrente; a do mês seguinte é criada se uma decisão precisar dela depois da reunião do mês).
- Data: **1ª quinta-feira**; mês que começa na **quarta ou quinta** → a **quinta seguinte** (2026: 08/01, 05/02, 05/03, 09/04, 07/05, 04/06, 09/07, 06/08, 03/09, 08/10, 05/11, 03/12).
- Pautas fixas: demonstração de resultados financeiros, operacionais, comerciais e RH. Decisões sem unanimidade entram sozinhas; qualquer convidado acrescenta (e tira as que incluiu).
- Card igual aos demais, com o ícone de reunião; decisão com o ícone de voto. Ambas abrem no detalhe.

## Itens padrão
- Ao trazer a FPP, preenche o que estiver vazio: nome interno, nome NF, tipo de peça, preço atual (valor de venda), cliente da FPP e o tecido (artigo, cor, rendimento/consumo, forro).
