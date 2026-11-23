# v1044 (23/11/2026) — compras: "Aguardando cotação"

- Item que está no PIC mas não tem nenhuma cotação (nem OC) aparecia como **Em cotação · cotação não gerada**. Agora tem etapa própria: **Aguardando cotação** (`SEM_COTACAO`, em `painelDemandas`).
- Na linha, o aviso diz o que falta — "sem quantidade · ajuste no PIC", "sem fornecedor · gere no PIC" ou "gere a cotação no PIC" — e abre o PIC ao clicar.
- **Em cotação** fica só para quem tem cotação gerada/enviada. Vale também na lista de itens das compras avulsas.
- Em 23/11 eram 9 itens nessa situação (PIC 0009, 0010 e 0011), entre eles a ENTRETELA BORDADO (Avulsa 00017, PIC 0010, sem quantidade e sem fornecedor).
