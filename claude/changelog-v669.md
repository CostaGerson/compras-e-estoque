# v669 — Facções a pagar: descartar, estornar e reativar (pedido do Maycon) · excluir item padrão na lista

## Facções a pagar · Cronograma PCP
- Chave da conta passa a ser `lancamento` do PCP ("12", "12-1"); PCP antigo sem o campo usa o nº da OS. `FaccaoOsPcp.os` deixa de ser única (recebimento parcial gera várias contas por OS); registros antigos ganham `lancamento = os`.
- Entram as contas **FECHADA** (parcela 0) e **PARCIAL** (parcelas 1, 2…); a linha mostra PARCIAL #n e o "já lançado em partes".
- **Descartar** (A lançar, por linha ou em lote): sai da fila sem lançamento, motivo obrigatório; continua em **Todas** com motivo e autor.
- **Estornar** (Lançadas, por linha ou em lote): confirmação com OS, facção e valor; apaga o item dos terceirizados da semana, recalcula a semana e devolve a OS para A lançar (pode ser lançada de novo). **Recusa** se o item já tem baixa (pago ou casado com lançamento do extrato).
- **Reativar** (Todas): desfaz o descarte.
- Histórico fica no banco (status LANCADA / ESTORNADA / DESCARTADA / REATIVADA, com quem e quando). Nada é enviado ao PCP.
- API: `POST /api/fin/faccoes { acao: estornar|descartar|reativar, chaves, motivo }`.

## Itens padrão
- Lixeira em cada linha da lista (além do Excluir dentro do cadastro).
