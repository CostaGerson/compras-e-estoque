# v331 — Baixa: casa recebimentos de contas a receber bem atrasadas

- Problema: ao enviar o extrato, créditos que pagam contas a receber **muito atrasadas** (ex.: R$ 2.745 do Top Service em 08/10) não eram sugeridos. A janela de casamento pelo nome era de 60 dias; a conta atrasada ficava de fora.
- `lib/finBaixas.js`:
  - `JANELA_ATRASADO = 365`. Para **contas a receber** com **valor exato + nome do pagador** no extrato, aceita a conta vencida há até 365 dias (cliente paga meses depois). Contas a pagar seguem em 60 dias.
  - A busca de títulos passa a carregar recebíveis bem mais pra trás (até 365 dias antes dos lançamentos).
- A leitura do extrato Bradesco já estava correta (o crédito vem com o nome "REMET. TOP SERVICE…").
- Teste: crédito de R$ 2.745 do Top Service vencido há 85 dias → sugestão MÉDIA, "mesmo valor · nome do pagador no extrato".
