# v532 — Baixa da OC (material recebido)

- Na OC aberta, botão **Baixar OC · material recebido** (à esquerda, abaixo das NFs). Janela com anexos (fotos, comprovante, canhoto — escolher, arrastar ou Ctrl+V; até 15 MB cada) e justificativa.
- **Sem NF anexada** (nenhuma NF do movimento fiscal ligada nem XML/PDF na OC) a justificativa é **obrigatória**.
- OC baixada = situação RECEBIDA, sai de "Em andamento" e vai para a guia **Baixadas**. Mostra quem baixou, quando, a justificativa e os arquivos; **desfazer baixa** volta a OC e os itens liberados.
- A situação "recebida" não pode mais ser escolhida no seletor — só pela baixa.
- **Liberação para o PCP (Maycon):** quando todas as OCs dos materiais de um item de pedido (do PIC dele) estão baixadas, o item vira ENTREGUE com `liberadoEm` e passa a sair em `/api/ext/compras` (`origemMaterial: "OC"`). O aviso da baixa diz quais pedidos foram liberados.
- Banco: `OrdemCompra.baixaEm`, `baixaPorNome`, `baixaJustificativa`; arquivos da baixa em `OcArquivo` com tipo `BAIXA`.
