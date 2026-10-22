# v386 — Integração direta com o banco do KM (PV + OP)

- **Agente no PC da fábrica** (`tools/km/km-sync.ps1` + `km-pedidos.sql`): lê o PostgreSQL do KM (192.168.0.107:5435, usuário de consulta `mentorbi`, só leitura) a cada 10 min e envia para `POST /api/km/sync` (token `KM_SYNC_TOKEN`).
- **Fontes no KM**: `pedidos` (nº do pedido = `ncodigopedid`), `pedido_mestre`, `pedido_item_detalhe`, `pedido_item_grade`, `v_clientes_bi`; OP = `indpcpip` (+ setores `indpcpst`/`indsetin`); parâmetros da OP = RTF em `solitped.cdetalhitped` (blocos `****TÍTULO****`, até PERÍODO/VALOR TERCEIRIZADO).
- **Mesmo fluxo do PDF**: `importarArquivos` virou `aplicarLidos` (PDF e KM) → PedidoVenda, espelho no Lançar PP, Cronograma. Frete/obs existentes não são apagados quando a fonte não traz.
- **Saldo**: qtEntregar/vlEntregar do KM; saldo zerado → FATURADO; excluído no KM → CANCELADO. Pedido novo já sem saldo ou cancelado não é criado.
- **Entrada automática**: pedido criado pelo KM e emitido a partir de 22/10/2026 (KM_ENTRADA_DESDE) com entrada na condição → conta a receber `PEDIDO N - ENTRADA` na data de emissão, com crítica (⚠ vermelho) para conferir. Se o KM mudar o valor e a conta ainda estiver aberta, atualiza e volta a crítica. Pedidos antigos (PDF) não ganham entrada automática.
- `KmPedido` (hash por pedido — o que não mudou é ignorado) e `KmSyncLog` (histórico). `?previa=1` mostra o mapeamento sem gravar.
- Próximo (v387): no faturamento, conferir a entrada paga e lançar pela NF só o que falta.
