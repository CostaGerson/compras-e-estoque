# v1028 (19/11/2026) — Comprovante do celular lido sem IA

- Foto ou print → **OCR** (tesseract `por`, instalado no Dockerfile) → texto. PDF que não é relatório do Bradesco → texto do PDF. A IA saiu do fluxo.
- `lib/finComprovanteTexto.js` (`lerTextoComprovante`) lê o layout "rótulo valor" dos apps de banco (Inter, Itaú, Nubank, Bradesco…):
  - valor (linha "Valor…" ou o 1º R$);
  - data (pagamento > transação > "Data" > agendamento; também "19 NOV 2026");
  - bloco de quem recebe ("Quem vai receber", "Destino", "Recebedor", "Favorecido"…) com Nome e CPF/CNPJ. CPF mascarado → 6 dígitos do meio;
  - ID E2E/da transação (trava contra duplicidade).
- Pix **agendado / aguardando aprovação** nunca baixa sozinho: fica pendente com o aviso "confirme só depois que ele for pago".
- Testado com o print do Inter (Pix aguardando aprovação, R$ 1.210,00, Gisley Valadares Viana): lido certo e ficou pendente com a sugestão da conta.
