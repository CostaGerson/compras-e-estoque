# v1043 (23/11/2026) — sugestão #101: endereço na tarefa, hora de sair e Waze/Maps

- **Formulário da tarefa › Adicionar endereço**: o campo só aceita endereço escolhido na lista do Google (mesmo autocomplete da rota).
  - Com horário: "De onde você vai sair?" — botões com os endereços particulares do usuário + "Outro endereço" (pode salvar como favorito na hora).
  - Calcula o deslocamento pelo Google (trânsito previsto para o horário) e mostra "X min · Y km · sair às HH:MM".
  - **Chegar antes (min)**: vem 5; muda junto com o horário.
  - **Aceitar saída**: o aviso no celular passa a ser na hora de sair ("🚗 Hora de sair · início HH:MM", com origem → destino e tempo). O seletor "Aviso no celular" some enquanto a saída estiver aceita. Mudar o horário (inclusive arrastando na agenda) recalcula a saída.
  - Botões **Waze** e **Google Maps** grandes, abrem o app com o destino em rota.
- **Detalhe da tarefa**: endereço, trajeto, hora de sair e os botões Waze/Maps.
- **Dados › Endereços particulares** (todos os usuários, inclusive quem só tem agenda): cada um cadastra os seus; só quem cadastrou vê.
- Banco: `Tarefa.local` (Json) e modelo `EnderecoParticular`. `lib/tarefaLocal.js`, `api/tarefas/local`, `app/tarefaLocal.jsx`.
- Tarefa recorrente leva o endereço para a série.
