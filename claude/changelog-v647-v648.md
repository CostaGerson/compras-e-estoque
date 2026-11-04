# v647 — Itens padrão, grupos de clientes e ranking por grupo · v648 — ordem livre na agenda

## Itens padrão (Dados › Itens padrão)
- Cadastro com nome interno (como chamamos), nome NF (sai na NF ao faturar), clientes (vários), FPP de origem, tipo de peça, código do KM, parâmetros de produção, foto, preço atual praticado, NCM, GTIN/EAN (opcional), observação e anexos de **layout** e **tabela de medidas**.
- **Crítica**: valor de venda da FPP (`valorProposto`) diferente do preço praticado → etiqueta vermelha na lista e no cadastro.
- Lista ordenável pelo título da coluna, busca, filtro por cliente e visualização **Por cliente**.
- Modelos `ItemPadrao` e `ItemPadraoAnexo` · `lib/itensPadrao.js` · `api/itens-padrao`.

## Lançamento de pedido
- Quando o cliente (pelo CNPJ) tem itens padrão, aparece um **campo em destaque** com autocompletar. O item escolhido entra preenchido: nome NF, preço, tipo de peça, código, parâmetros, foto e FPP (com o tecido), e segue para o levantamento de compras. Ocupa o primeiro item vazio ou acrescenta um item. Avisa se o preço estiver diferente da FPP.

## Grupos de clientes (Dados › Clientes)
- Marcar clientes → **Criar grupo / juntar a um grupo** (nome e CNPJ opcional), tirar do grupo, filtro e coluna Grupo, editar/excluir grupo.
- Modelo `ClienteGrupo` + `Cliente.grupoId` · `api/clientes/grupos`.

## Gestão — Top 10 clientes
- Os clientes de um grupo entram **juntos** na colocação (somados). Clicar no grupo abre a posição de cada cliente dele (valor e % do grupo). Casamento pelo CNPJ (pedidos e NFs de saída) ou pelo nome (razão social / fantasia).

## v648 — Agenda
- Arrastar um card acima ou abaixo de outro muda a ordem mesmo com horário; as tarefas com horário continuam de mais cedo para mais tarde entre si (`ordenarDia`).
