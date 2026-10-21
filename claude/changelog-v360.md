# v360 — Notas de saída num envio só (ZIP com XML e DANFE)

- **Contabilidade:** os cards "Notas de saída · XML" e "· PDF" viram um só, **"Notas de saída · XML e DANFE"** (categoria `SAIDAS`, só ZIP, um por mês — novo envio substitui). O ZIP vai para o pacote da contabilidade do jeito que foi enviado (pasta `NOTAS DE SAIDA`). Meses antigos que já tinham arquivos nos cards velhos continuam mostrando esses cards.
- **Leitura:** o ZIP é aberto mesmo com ZIP dentro de ZIP; cada XML de NF-e alimenta `FinNfSaida` (cruzamento dos recebimentos). Eventos de cancelamento (tpEvento 110111) tiram a nota do cruzamento.
- **Movimento fiscal:** nota do ZIP que não estava lançada lá entra como registro (com XML e o DANFE casado pela chave):
  - gera recebível → linha **vermelha** com a crítica *"NF subida por importação na contabilidade, verificar contas"* (`acao = CONTABILIDADE`) e aviso no topo;
  - cancelada, remessa, retorno e afins → só **registrada**, sem crítica.
  - Ao importar a mesma nota pelo movimento fiscal, ela é tratada como nova e o registro da contabilidade dá lugar ao lançamento normal (o aviso some).
- Teste com o ZIP de setembro/2026: 86 XMLs, 74 DANFEs → 63 notas lidas, 10 canceladas, 3 eventos ignorados; das não lançadas, remessas/retorno/canceladas só registradas.
