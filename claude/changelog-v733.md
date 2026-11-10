# v733 — Arte finalista só com tarefas · visibilidade das tarefas · fluxo do layout

- **Ayrllon (setor ARTE FINALISTA)**: menu só com *Minhas tarefas* e *Agenda* (sem ADM, Rota, Dados/Uploads, Destinatários). Ao entrar no sistema abre direto nas tarefas (`soTarefas` em `lib/acesso.js`).
- **Visibilidade (regra única)**: cada usuário vê só as tarefas em que é o colaborador (responsável), as que ele mesmo criou e as de evento/decisão para as quais foi convidado. Pública, projeto e cargo não abrem mais tarefa de outra pessoa (vale também para o status da equipe).
- **Criação de layout**: fica só para o arte finalista (criada no nome dele, privada) — o vendedor não vê. Só vira tarefa do vendedor quando o arte finalista anexa o layout e clica em *Enviar para aprovação* (tarefa do dia na agenda do vendedor).
- **Aprovação**: aprovado → o layout vai automático para o item do pedido (já existia). Reprovado → o vendedor escreve as instruções e a **mesma** tarefa de criação volta a ficar em aberto para o arte finalista (urgente, prazo hoje, com as instruções), em vez de criar outra.
