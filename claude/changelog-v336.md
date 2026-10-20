# v336 — Títulos Pagos (Bradesco) liquida antecipados

- Novo leitor do relatório **Títulos Pagos** (Produto DESCONTO): vencimento, parcela, contrato, seu nº, nosso nº, sacado, valor da nota, valor cobrado.
- Mesmo efeito do Títulos Baixados: liquida o título antecipado (liquidação CLIENTE) e cancela recompra em aberto.
- O relatório não traz data por título: usa o vencimento, limitado ao "Último movimento".
- Transmissão identifica sozinho → destino "Títulos baixados / pagos (desconto)" (mesma tela).
- Arquivos: `lib/finAntecipacao.js` (`ehTitulosPagos`, `parseTitulosPagos`, `analisarBaixados` aceita os dois), `lib/finTransmissao*.js`, `app/contas.jsx`.
