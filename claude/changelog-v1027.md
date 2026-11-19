# v1027 (19/11/2026) — Comprovante pelo iPhone

- Atalho do iPhone **Enviar ao ERP** (menu Compartilhar do WhatsApp, app do banco, Fotos, Arquivos): manda foto ou PDF para `POST /api/fin/comprovantes/enviar?t=<chave>` (formulário, campo `arquivo`). A resposta, em texto, aparece no celular.
- Chave pessoal por usuário (`FinConfig COMPROVANTE_CEL|<id>`), em Contas a pagar › **Comprovante pelo iPhone**. A tela também tem o passo a passo do atalho e o botão de gerar uma chave nova.
- Leitura: o relatório do Bradesco é lido pelo texto do PDF (`lerComprovantes`). Foto, print ou PDF de outro banco é lido pela IA (`lerPelaIA`). HEIC vira JPEG de até 2000 px (`heic-convert` + `sharp`).
- **Baixa automática** só quando há UMA conta a pagar em aberto com: valor igual, vencimento = data do pagamento e o nome do destinatário no fornecedor (inteiro ou todas as palavras). Comprovante vai como anexo.
- Fora disso: o comprovante fica como **PENDENTE DE CONFIRMAÇÃO** (model `FinComprovanteEnvio`), com faixa amarela no Contas a pagar e linha amarela na conta sugerida. No cartão: o motivo, ver comprovante, data, valor e a conta (sugestões ou busca). **Confirmar** baixa a conta e anexa o comprovante; se a conta já estava paga, só anexa. **Rejeitar** apaga o comprovante e a conta continua em aberto.
- Travas: o mesmo comprovante não entra duas vezes (hash do arquivo pendente + chave da transação no anexo). Conta da semana fica de fora.
- `baixarComprovantes` passou a aceitar anexo em imagem (`mime`).
