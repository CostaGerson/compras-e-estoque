# v677 — Tributário: tabela de NCM por classe (planilha NCM_Produtos) e ICMS interestadual

- **Produtos (NCM)** vira tabela de **classes** (um NCM por classe = tipo de peça do item), com a tributação de cada uma: ICMS (tributação, CST, alíquota interna MG), PIS/COFINS lucro presumido (CST, %), IPI (CST, %), além de NCM, CEST, origem, unidade, GTIN e o que entra na classe. Dá para criar classe nova.
- Carga única da planilha (`CLASSES_NCM` em `lib/tributario.js`, marca `TRIB|NCM_PLANILHA_V1`):
  CAMISETA 6109.10.00 · POLO 6205.20.00 (polos e camisas de malha) · CAMISA 6206.90.00 (social/operacional/administrativa de tecido plano) · JAQUETA 6101.90.90 · CALÇA 6104.69.00 · BERMUDA 6103.49.00 · JALECO 6202.99.00 · GUARDA-PÓ 6309.00.10 · AGASALHO 6101.30.00 · BLUSÃO DE FRIO 6101.30.00 · BLUSÃO INDUSTRIAL 6206.90.00 · CONJUNTO AGASALHO 6101.20.00 · CASACO 6102.90.00 · SUÉTER 6110.90.00 · BLAZER 6104.39.00 · VESTIDO 6104.49.00 · BONÉ 6505.19.00 · LENÇO 6202.99.00 · MEIA 6115.10.22 · SAPATO 6404.20.00.
  Todas: ICMS tributado CST 00 (18% MG), PIS/COFINS CST 01 (0,65% / 3%), IPI CST 51 (0%).
- Nova aba **ICMS interestadual**: matriz origem × destino da planilha (`lib/icmsInterestadual.js`, `aliquotaIcms(origem, destino)`), com aviso do FCP.
