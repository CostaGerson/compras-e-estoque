# v807 — atrasados
- Os cards (Em cobrança, Em execução, Recuperado, Perdas) trocam a visualização; saíram os botões Em cobrança/Execuções/Perdas.
- Botões de ação (e-mail, card, baixar, execução, perda) discretos: fundo branco, ícone na cor da ação.

# v808 — guia NORT
- Contas NORT (título "NORT - …") **fora** de: guias Contas a pagar e Contas a receber (lista, vencidos, críticas, sem conta-caixa, vencido total), atrasados/execuções/perdas, painel, DFC, previsto × realizado, resumo, cobrança semanal e análise IA dos títulos (`SEM_NORT` em `lib/finNort.js`).
- Nova guia **NORT** (`app/nort.jsx`, `GET /api/fin/nort`):
  - Créditos = lançamentos positivos das contas-caixa do grupo NORT na DRE;
  - Débitos = lançamentos negativos do grupo NORT + empréstimos concedidos à NORT (2131600; o recebimento 1136000 volta como crédito) — empréstimo entra quando o histórico/identificação cita a NORT;
  - Saldo do período e contas NORT em aberto (a pagar / a receber), com editar e baixar.
  - Cards filtram a lista; período por competência.
- Baixa e conciliação das contas NORT continuam funcionando (só os relatórios e as listas deixam de vê-las).
