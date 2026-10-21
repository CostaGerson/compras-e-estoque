# v375 — Pedido sem PV: NF conferida pelos produtos do PCP

- Sem códigos do PV, cada item da NF é ligado ao produto do PCP (`cronoItens`) de nome mais parecido (sem acento e sem o tamanho, ≥ 60% das palavras). A NF só vai para o pedido se **todos** os itens couberem no saldo de cada produto; senão é de outro pedido. Fecha quando todos os produtos do PCP foram entregues.
- Proteções: NF cujo nº já fechou outro pedido (gravado à mão ou pela regra por valor) não é reaproveitada; a **O.C.** da NF que pertence a outro pedido (inclusive já faturado) impede o casamento. A O.C. agora vem também do PCP quando o PV não trouxe.
- Uma vez (`FinConfig PEDIDOS|REFAZ_V375`): desfeitas as baixas da v374 por peças nos pedidos sem PV, para refazer pelos produtos.
- Teste com as NFs 2027–2031 e os produtos do PCP: 2027→26090010 e 2029→26090011 (totais); 2028→26090029 (69/70), 2031→26080048 (179/180), 2030→26090036 (60/200).
