# v1046 (23/11/2026) — cancelar OC devolve os itens para a cotação

- **Ordens de compra › Cancelar OC** (botão vermelho, e também ao escolher "cancelada" na Situação): pede o motivo e avisa quando a OC já foi enviada ou tem NF.
  - Os itens saem da OC e voltam para a cotação: dá para gerar outra OC ou **dispensar compras**.
  - As cotações que geraram a OC voltam a **respondidas**. O PIC volta a aberto, os itens de compra voltam a PIC e a compra avulsa comprada volta a aberta.
  - A rota de coleta da OC ainda não feita (aberta ou no bloco) é cancelada.
  - A observação da OC guarda quem cancelou, quando, o motivo e os itens que ela tinha.
  - OC recebida (baixada) não cancela: reabra a baixa antes.
- Antes, mudar a situação para "cancelada" só trocava o rótulo e os itens continuavam presos à OC. Ao subir, as OCs já canceladas com itens são soltas uma vez (`soltarOcsCanceladas`).
- `lib/pic.js`: `cancelarOc`, `soltarOcsCanceladas`.
