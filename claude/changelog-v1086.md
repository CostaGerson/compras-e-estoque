# v1086 (24/11/2026) — Compras › Devoluções (devolução por item da OC, OD e crédito com fornecedor)

- **OC › Devolver itens** (OC enviada, com NF ou recebida): quantidade por item + motivo.
  - A quantidade devolvida **volta ao PIC** (item novo, mesmo artigo, fornecedor e preço como sugestão; PIC reabre) e entra na guia Devoluções (`OcDevolucao`).
  - Com **NF do fornecedor anexada à OC** → demanda URGENTE no ADM (Brenda; sem ela, o primeiro do ADMINISTRATIVO) `NF_DEVOLUCAO`: chave copiável, nº/série/emissão/valor, XML e PDF da NF, destinatário (razão, CNPJ, IE, endereço), natureza e CFOP sugeridos (5201/6201), itens com item da NF, código, NCM, CFOP da NF, quantidade, unitário e total, motivo. O retorno ao concluir (nº da NF de devolução) fica nos itens.
  - O item mostra "↩ N devolvido(s)" e a OC ganha a nota no histórico.
- **Guia Devoluções** (Compras › Devoluções e fase nova): itens em devolução, seleção do mesmo fornecedor → **OD** (`OrdemDevolucao`, imprimível) → **crédito** com o fornecedor (`FornecedorCredito`).
- **Créditos por fornecedor** (cards): clique → boletos em aberto do fornecedor com a sugestão do crédito (vencimento mais próximo primeiro). Boleto coberto fica PAGO (sem movimento no banco); parcial tem o valor reduzido (nota e alteração no título). Ou "Guardar para novas compras".
- **Gerar OC** para fornecedor com crédito: pergunta se usa o crédito → reserva até o total da OC (OC abatida; "a pagar" no card e na impressão). Quando a NF da OC chega: **usar o crédito para baixar as contas da NF** ou **aceitar a NF com valor** (o crédito volta ao saldo). OC cancelada devolve a reserva.
- Arquivos: `lib/devolucoes.js`, `app/api/compras/devolucoes/route.js`, `app/devolucoesCompras.jsx`, `app/compras.jsx`, `app/adm.jsx`, `lib/pic.js`, `lib/admDemandas.js`, `app/page.jsx`.

## v1087 — cancelar um item da OC
- Em cada item da OC (aberta, enviada ou com NF): **cancelar item** com motivo. O item volta ao PIC (sem OC) para outra compra, o PIC reabre e a OC guarda a nota. Último item → a OC é cancelada. Com NF anexada, avisa para usar Devolver itens se o material chegou.
