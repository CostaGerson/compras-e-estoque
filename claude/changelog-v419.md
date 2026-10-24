# v419 — Dispensar compras e compra avulsa no levantamento

- **Dispensar compras** (botão no cabeçalho de cada pedido em Compras › Pedidos): pedido do KM só para faturamento sai de compras, levantamento e cruzamento (itens no levantamento e reservas ainda não usadas são apagados). Filtro **Compras dispensadas** lista com motivo, quem e quando, e **Voltar para compras**. Modelo `CompraDispensa`.
- **Compra avulsa vai para o levantamento:** cada item vira um item de compra (`pedidoNumero` "AV<id>") com artigo achado ou criado pelo nome + unidade + fornecedor (categoria OUTROS, origem AVULSA). Comprada → sai do levantamento (OC); recebida → ENTREGUE; voltar → reabre; cancelar → apaga. Unidades: un, m, kg, pç.
- **Entrada de Compras** (clicar em Compras no menu) mostra o card de compra avulsa abaixo dos atalhos.
