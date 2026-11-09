# v709 — Dados do cliente final e envio no pedido do portal

- **Novo pedido (portal)** começa por **1. Dados do cliente e envio**: escolhe **Pessoa física** ou **Pessoa jurídica**.
  - PF: nome completo, CPF (validado), endereço de entrega, WhatsApp com DDD, e-mail.
  - PJ: contato (quem está tratando), cargo, razão social, CNPJ (validado), inscrição estadual (ou ISENTO), endereço, WhatsApp, e-mail.
  - Endereço: CEP (preenche rua, bairro, cidade e UF pelo ViaCEP), rua, número, complemento, bairro, cidade, UF.
- Não envia com dado faltando (validação no navegador e no servidor — `lib/clienteFinal.js`).
- Gravado em `Pp.clienteFinal`; aparece em **Meus pedidos**, no **lançamento interno** (bloco "Cliente final e envio") e na impressão do **PV/OP**; resumo também na observação do pedido.
