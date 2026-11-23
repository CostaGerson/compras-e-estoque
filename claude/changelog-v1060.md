# v1060 (23/11/2026) — OC em PNG anexada à coleta/compra

- **Criar rota de coleta** a partir da OC (OC › "Criar rota de coleta" ou ao gerar a OC com coleta): a demanda nova já vem com a **OC em imagem** nos anexos (`OC0022.png`) — logo, nº, fornecedor (endereço/telefone), condição, recebimento, prazo, NF, cada artigo com quantidade, valor unitário e total, e o total da OC. Vale para objetivo Coleta ou Compra. Dá para tirar o anexo antes de salvar.
- **App do motorista**: anexo em imagem vira botão grande **🧾 Ver OC 0022** que abre em tela cheia (pinça para ampliar, "abrir" em outra aba, × para fechar). Outros anexos seguem como link.
- `app/ocImagem.js` (`desenharOc`, `anexoDaOc`).
- Demandas de coleta já criadas antes desta versão não ganham a imagem automaticamente (anexar manualmente, se precisar).
