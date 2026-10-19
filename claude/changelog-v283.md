# v283 — Agenda: recorrência editável, só dias úteis, concluídas saem do calendário

- **Recorrência na edição**: dá para marcar uma demanda avulsa como recorrente (ela vira a 1ª ocorrência da rotina), trocar a regra de uma rotina (vale desta ocorrência em diante; as próximas em aberto sem trabalho registrado são refeitas) ou escolher "Não se repete" (encerra a rotina depois desta). Antes o seletor ficava travado na edição e a marcação não tinha efeito.
- **Só em dias úteis** (opção da recorrência): data que cair em sábado, domingo ou feriado nacional passa para o próximo dia útil (`proximoDiaUtil` em `lib/recorrencia.js`, feriados de `lib/diasUteis.js`). Na diária, a opção pula os feriados.
- Geração das ocorrências: uma série com erro não trava mais as outras (try/catch por série).
- **Agenda**: tarefa concluída some do calendário; continua na lista de Tarefas (filtro "Concluídas" / busca).
