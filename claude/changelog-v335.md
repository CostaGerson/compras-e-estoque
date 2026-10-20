# v335 — Títulos Vencidos (Bradesco) define a recompra

- Novo leitor do relatório **Títulos Vencidos** (Produto DESCONTO): vencimento, parcela, contrato, seu nº, nosso nº, sacado, encargos, valor da nota.
- Transmissão identifica o PDF sozinho (destino "Títulos vencidos (desconto)").
- **Regra nova:** título antecipado só vira conta a pagar de recompra se aparecer nesse relatório.
  Recompra = nota + encargos, vence no dia, conta 2131300, Bradesco, chave `RECOMPRA|<id>`.
- Desligada a criação automática por data (vencimento + 3 dias úteis). Antes do relatório, o título fica só **atrasado**.
- Casamento: nosso nº → NF + valor → valor + nome. Já com recompra / cliente já pagou / sem conta aparecem e não são duplicados.
- Arquivos: `lib/finAntecipacao.js`, `lib/finAntecipados.js` (`recompraPorVencido`), `lib/finTransmissao*.js`, `api/fin/vencidos`, `contas.jsx` (VencidosModal), `transmissao.jsx`, `antecipacoes.jsx`.
