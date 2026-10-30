# v595 — Lançamento de pedidos sem o KM

Tela **Lançar PP** → botão **Novo pedido** abre o editor novo (`app/pedidoEditor.jsx`).

- **Tipo de pedido**: Venda normal ou **Interno** (não gera contas; entra nos dados gerenciais — peças produzidas etc.).
- **Numerador automático** ao efetivar: AAMM + sequência a partir de **5001** (ex.: 26105001) — faixa separada da do KM enquanto os dois rodam.
- **Cliente** pelo nome **ou pelo CNPJ** (digitou o CNPJ completo → puxa o cadastro; avisa CNPJ sem cadastro).
- **Prazo de entrega**: nº de dias + úteis/corridos (feriados nacionais) → **data de despacho** calculada a partir da emissão.
- **Itens**: código/descrição buscam o **cadastro de itens do KM** (mesma nomenclatura e parâmetros de produção). Fonte: tabela `KmProduto`
  (agente: `km-produtos.sql`, de hora em hora, ou `km-sync.ps1 -Produtos`) + itens dos pedidos que já vieram do KM.
- **FPP indexada** em cada item (botão Indexar FPP; as do cliente primeiro): **artigo e rendimento/consumo vêm da FPP** (TECIDO travado);
  valor proposto entra como valor unitário se vazio. Ao efetivar, o item vai para o **levantamento de Compras** com a demanda da FPP.
- Saíram dos parâmetros: **PERÍODO PERSONALIZAÇÃO, PERÍODO FACÇÃO e VALOR TERCEIRIZADO**.
- **Entrega**: única, fracionada ou terceiros envolvidos. Nas duas últimas, locais com endereço, nome do local, responsável pelo recebimento,
  contato, documento (venda de produção do estabelecimento · mercadoria adquirida/recebida de terceiros · remessa · remessa por conta e ordem
  de terceiros) e a **grade de cada local**. A soma das grades dos locais tem de bater com a grade do pedido (por item e tamanho) — senão não efetiva.
  Atalhos: "usar dados do cliente" e "pôr o restante aqui".
- **Prazo de pagamento**: Inserir entrada (data + valor) e Inserir parcela (dias úteis/corridos a contar da emissão do pedido, da NF ou da entrega;
  valor em branco divide o restante). Tem de fechar com o total.
  - Ao **efetivar**: entrada (`PED|N|ENTRADA`) e parcelas da emissão (`PED|N|PARC|i`) vão para o contas a receber.
  - Ao **faturar** (nº e data da NF): parcelas da NF e da entrega; se alguma usa a entrega, o sistema **pede a previsão de entrega**.
    Título `NF n - PEDIDO N - PARC i/n`, nº doc `n · PARC i/n` (o movimento fiscal reconhece e não duplica).
  - Previsão de receitas (`preverPedido`) usa o prazo montado (`PedidoVenda.pagamento`).
- **Obs. da NF**: campo próprio; a NF sai com **PEDIDO Nº + OC DO CLIENTE + obs** (copiar; também no PDF do pedido e em `PedidoVenda.nfObs`).
- **Anexos por arraste** (OC, solicitação, layout… qualquer arquivo, vários): cards com miniatura/ícone e categoria; aparecem também na lista
  de pedidos (`PpAnexo`, `GET /api/pp/[id]?anexo=ID`).
- Pedido que veio do KM não é efetivado por aqui (as contas seguem pelo KM).

**Arquivos**: `lib/pedidoLanc.js` (cálculos puros), `lib/pedidoEfetivar.js` (salvar/efetivar/faturar/catálogo), `api/pp` (POST/PUT/POST acao),
`api/pp/catalogo`, `api/km/produtos`, `tools/km/km-produtos.sql`. Modelos: `Pp` (+interno, emissao, prazoDias/Tipo, entregaModo, entregas,
pagamento, nfObs, efetivadoEm), `PpItem` (+fppId/fppNumero), `PpAnexo`, `KmProduto`, `PedidoVenda` (+pagamento, entregaModo, entregas, nfObs).

**PC da fábrica**: rodar de novo `km-sync.ps1 -Instalar` para o agente passar a mandar os itens do KM.
