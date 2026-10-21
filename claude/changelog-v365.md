# v365 — Ações na NF com crítica: Lançar contas / Vistar

- **Lançar contas** (movimento fiscal e dados de NF): refaz a importação normal com o XML guardado (parcelas do XML, conta contábil padrão do cliente, liga em conta parecida se já existir), grava a nota como LANÇADA (mantém a origem "importação contabilidade") e abre o **contas a receber** já filtrado pelo cliente e pelo período das parcelas. Sem conta contábil padrão → pede para lançar pela importação.
- **Vistar**: tira a crítica sem lançar contas; a nota fica "só registrada" com "VISTADA SEM CONTA POR <usuário> EM <data>".
- **Crítica só para quem não tem conta**: ao registrar NF vinda da contabilidade, procura contas a receber já lançadas por fora (chave da NF, ou nº da NF do mesmo CNPJ). Achou → nota LANÇADA ligada a essas contas, sem crítica. Notas já criticadas são revistas ao abrir as telas.
- Navegação: evento `ce:ir` abre Financeiro › Contas a pagar e receber com tipo, busca e período (`ContasPagarReceber inicial`).
