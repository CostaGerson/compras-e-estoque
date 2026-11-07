# v696 — Pedido preenchido pela solicitação de lançamento (skill do vendedor)

Ao arrastar o PDF da **Solicitação de lançamento** (gerado pela skill `lancamento-pedido-meridian`) nos anexos do lançamento de pedido, o sistema preenche o pedido sozinho. Também há o botão ✨ em qualquer PDF já anexado.

O que entra:
- **Cliente e faturamento**: razão social, CNPJ, IE, endereço; contato com o e-mail do cliente. CNPJ sem cadastro → **cadastra o cliente** em Clientes (endereço separado em rua/número/bairro/cidade/UF/CEP, e-mail de NF). Cadastro existente → completa e-mail de NF, IE e endereço que faltarem.
- **Vendedor, OC, observações**.
- **Prazo de entrega**: data → dias corridos a partir da emissão; "N dias úteis/corridos" direto. Prazo já vencido gera aviso.
- **Condição de pagamento** → parcelas do prazo de pagamento: "Boleto 30 dias", "30/60/90", "28 DDL", "à vista", "entrada + 30/60", "50% entrada e 50% na entrega", "30% antecipado 30% entrega e 40% 30d", "dias úteis", "da entrega".
- **Itens**: tipo de peça pela categoria, descrição (categoria + modelo), valor unitário, **grade** (inclusive G1–G4, numeração, infantil e babylook), parâmetros (GOLA → GOLA DA CAMISETA, CÓS → COS DA CALÇA, BOLSOS → bolso dianteiro/traseiro, REFORÇO…; o que não tem campo vai em EXTRA), personalização e tecido/cor.
- **FPP pelo número** (do cabeçalho ou do card): indexa a FPP no item (artigo, rendimento, cor do tecido escolhida pela cor do documento).
- **Layout**: as artes embutidas no PDF viram a foto de cada item (o logo da Meridian é ignorado).

Conferências mostradas no topo: soma da grade × total, total calculado × documento, valor × FPP, FPP não encontrada, tamanho fora da grade padrão, item sem layout, prazo/condição não reconhecidos.

Arquivos: `lib/lancamentoSkill.js` (leitura pura, testável), `lib/pdfImagens.js` (imagens do PDF), `app/api/pp/lancamento/route.js`, `app/pedidoEditor.jsx`.
Grade: numeração adulta (> 16) deixa de cair na seção "Infantil".
