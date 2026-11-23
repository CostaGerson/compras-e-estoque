# v1055 (23/11/2026) — desfazer PIC sem erro

- **Desfazer PIC** dava "Erro." (exceção no servidor sem mensagem). Agora:
  - só bloqueia se houver OC **ativa** (OC cancelada não conta) e diz qual;
  - solta antes as ligações que travavam a exclusão das linhas do PIC (itens de OC cancelada, estratificação de NF);
  - tira as linhas do PIC das cotações abertas (cotação que fica vazia é cancelada) e avisa quais;
  - os itens voltam ao levantamento.
- A rota `api/compras/pic` passa a devolver o motivo de qualquer erro.
