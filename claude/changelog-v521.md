# v521 — Clientes do KM · PIX na conta comum · Rotas (retorno no meio, arrastar, calendário a partir de hoje)

## Clientes do KM
- Agente do PC (`tools/km/km-clientes.sql` + `km-sync.ps1`) lê **todos** os clientes de `solclien` (só leitura) e manda para `POST /api/km/clientes`.
- Roda sozinho de hora em hora (minuto 5) e quando alguém clica **Buscar do KM** na tela Clientes (atende em até 1 min). Manual: `.\km-sync.ps1 -Clientes` (com `-Previa` só mostra o mapeamento em `km_clientes_previa.json`).
- `lib/kmClientes.js`: reconhece as colunas pelo nome (nome, fantasia, código, CNPJ/CPF, IE, endereço, bairro, cidade, UF, CEP, fones, e-mail, contato); casa por id do KM → CNPJ/CPF → código. KM só **preenche o que está vazio**; o que foi editado no sistema não é sobrescrito. Linha crua em `Cliente.kmDados`; hash evita regravar o que não mudou.
- Campos novos em `Cliente`: `kmId`, `kmCodigo`, `kmDados`, `kmHash`, `kmSyncEm`.
- **No PC, uma vez:** `git pull` e `.\km-sync.ps1 -Instalar` (copia o SQL novo para a pasta do agente).

## #21 (Maycon) — Chave PIX na conta a pagar comum
- Campo **Chave PIX** no lançamento/edição da conta comum (`FinTitulo.chavePix`). Preenchido sem forma de pagamento → forma vira PIX. Aparece no detalhe da conta.

## #20 (Leandro) — Anexar imagem na compra avulsa
- Já entregue na v515 (anexos: escolher, arrastar ou Ctrl+V). Só marcar como acatada.

## #19 (Igor) + pedido de 27/10 — Rotas
- **Retorno à fábrica no meio da rota**: parada `RETORNO` (destino FÁBRICA) que entra na ordem, no Maps e na mensagem.
  - Montagem (Brenda): "+ Retorno à fábrica no meio da rota" (ajusta com as setas; "Sugerir melhor ordem" mantém o retorno na posição).
  - Rota em execução: botão **Retorno no meio** (quem monta, sem justificativa) e **Preciso voltar à fábrica agora** no app do motorista (pede **justificativa**, vira a próxima parada e avisa adm/logística/diretoria por mensagem).
- **Arrastar demanda entre dias** (aberta e fora de rota); soltar na manhã/tarde do dia grande também muda o período (se o horário for manhã/tarde/livre).
- **Calendário semanal começa hoje** (primeiro card à esquerda). Dia passado só aparece enquanto tiver demanda pendente (em vermelho); concluída/realocada, some. Botão **Passado** mostra os dias anteriores com as rotas concluídas.
- **Clicar num dia** o expande do tamanho do dia atual (o mapa sai; ✕ recolhe). Clicar em **Manhã/Tarde** cria a demanda já com o período.
