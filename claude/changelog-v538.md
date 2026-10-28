# v538 — Retorno Bradesco: "transferido para desconto" = título antecipado

- No .RET, ocorrência 09/10 (baixa) com **motivo 20** (título baixado e transferido para desconto) agora é ação **Antecipado (desconto)**, não mais crítica.
- Aplicar: a conta a receber fica PAGO pelo valor de face, `cobranca DESCONTADO`, forma DESCONTO, `antecipadoForma BRADESCO`, `antecipadoEm` = data da ocorrência. Entra no **em aberto virtual** e em "antecipados aguardando" até o cliente pagar (liquidação pelo retorno de pagamento ou relatórios do Bradesco), com as regras de recompra já existentes.
- Contas que já tinham ficado com a crítica (ex.: NF 2010 3/3, retorno 344 de 27/10) são corrigidas sozinhas ao abrir o contas a receber (`corrigirCriticasDesconto` no `sincronizarAntecipados`); a crítica sai.
