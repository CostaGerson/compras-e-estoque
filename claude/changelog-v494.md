# v494 — NF do fornecedor na OC pelo movimento fiscal + conferência NF × OC

- **Subir NF na OC** (botão ou arrastar): abre a mesma tela de importação/lançamento de contas do Movimento fiscal (`ImportarNfs` com `ocId`). A nota fica registrada em `FiscalNota` (Movimento fiscal, Dados › Notas fiscais, Uploads) com `ocId`, e a OC vai para NF emitida.
- **Conferência NF × OC** (`lib/ocNf.js`, `GET /api/compras/oc/nf?oc=`): casa os itens da NF com os da OC (nome parecido + quantidade/valor) e critica quantidade, valor unitário, itens faltando/sobrando, total dos produtos, prazo de pagamento (dias das duplicatas × condição da OC) e CNPJ do emitente fora do cadastro do fornecedor.
- **Ações**: "Corrigir a OC pela NF" (itens + condição; atualiza PIC, artigo e cotação), "aceitar este CNPJ" (entra no cadastro do fornecedor ou, se for de outro, só na OC — `OrdemCompra.cnpjsAceitos`), "excluir" a NF da OC (opcionalmente também do movimento fiscal, contas para a lixeira).
- Busca de fornecedor por palavras em qualquer ordem: nome fantasia/comercial, razão social, cidade e CNPJ.
