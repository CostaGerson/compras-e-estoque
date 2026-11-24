# v1084 (24/11/2026) — Frente de caixa da loja física (NORT) no ERP

Comercial › **Frente de caixa**, no modelo da calculadora do Gerson (`claude/…calculadora-meridian-modelo-replicavel`).

- **Catálogo** (`LojaProduto`): modelo = produto + cor (nome do estoque da NORT sem o tamanho), grupo de preço e **FPP** (obrigatória). "Importar do estoque NORT" cria os modelos, reconhece o grupo pelo nome e liga a FPP de nome comercial igual (negociação LOJA primeiro); o resto liga à mão.
- **Preço** (`lib/lojaPreco.js`, conta pura em centavos): base por produto, DTF/bordado por posição e tamanho, bolso, sublimação (base + tabela + longa + texturizada), manga longa +R$ 4, outra cor +15% por último; faixas por item (1-5 · 6-10 · 11-19 · 20+; sublimação 11-20 · 21+); taxa de bordado R$ 20 uma vez por pedido; desconto extra sobre o valor com desconto de quantidade e sem a taxa. Tabelas editáveis (`FinConfig LOJA|TABELAS`). Conferido com o exemplo da calculadora (13 sublimação texturizada = R$ 69,90).
- **Estoque**: a grade é limitada ao saldo LOJA (encomenda não). Peça que não é encomenda baixa o saldo LOJA no ERP (movimento `LOJAV-…`); a NFC-e continua no Bling.
- **Fechar venda** (servidor recalcula tudo): pagamento total na peça lisa do estoque; entrada mínima 50% no personalizado/encomenda; desconto > 10% ou entrada abaixo de 50% pedem a **senha de sócio** (4 dígitos, scrypt em `LOJA|SENHA_SOCIO`).
  - Peça lisa do estoque: não vai para a produção; acerto NORT do custo da FPP (`NORTPED|LOJA-V<n>`).
  - Personalizado/encomenda: **pedido NORT × Meridian canal LOJA** efetivado (PCP/Compras; acerto pela FPP), prazo 5 dias úteis (DTF/bordado) ou 20 (encomenda/sublimação). Item do estoque vai com "PEÇA DO ESTOQUE DA LOJA: SIM (SÓ PERSONALIZAR)". Falha → a venda fecha e fica "Tentar de novo".
  - Pagamentos e saldo → contas a receber no **Portal NORT** (`LOJA|<n>|P…` pagas, `LOJA|<n>|SALDO` em aberto na previsão).
- **Vendas**: orçamento (salvar, WhatsApp, abrir no caixa), receber saldo, marcar pronta, "Avisar que está pronto" (WhatsApp), entregar (lembrete da NFC-e), cancelar (estorna o estoque e o acerto; avisa para cancelar o pedido de produção).
- **Leitura dos pedidos da calculadora desligada** (`lib/nortLeitura.js`, só com `lerPedidos: true`); a leitura do estoque continua.
- Fora desta versão: DTF no metro, troca/devolução, modo teste, impressão A4.
