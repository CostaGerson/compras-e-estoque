# v1030 (19/11/2026) — Comprovante do celular também nos lançamentos da semana

- O comprovante procura também os **lançamentos de dentro das contas da semana** (freelancers, facções e serviços terceirizados; `FinSemanaItem` não pago), e não só as contas a pagar.
- **Baixa automática** com a mesma regra: valor igual, data = vencimento do lançamento (vencimento negociado ou a sexta da semana) e o nome do destinatário no nome do lançamento ou do prestador cadastrado. Só baixa se houver uma única opção, contando contas e lançamentos.
  - Baixa só o lançamento (`baixarItemManual`). A conta da semana fecha sozinha quando todos estão pagos. O comprovante fica anexado na conta da semana.
- **Pendente**: a sugestão pode ser um lançamento da semana. Vale o valor igual com nome ou CPF/CNPJ do prestador (CPF mascarado confere os 6 dígitos do meio; a chave PIX também conta), ou o valor igual até 7 dias. A linha amarela fica na conta da semana.
- Tela de confirmação: a lista e a busca trazem os lançamentos (marcados `[FREELANCER · SEMANA]` / `[TERCEIRIZADO · SEMANA]`). A API aceita `alvo: "T:<conta>" | "I:<lançamento>"`.
- `FinComprovanteEnvio.semanaItemId` (novo).
