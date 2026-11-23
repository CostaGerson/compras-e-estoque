# v1052 (23/11/2026) — grupos de clientes nas FPPs

- **Campo Cliente da FPP**: os grupos de clientes (Dados › Clientes › grupos) aparecem primeiro na lista, marcados **GRUPO** com o nº de empresas. Escolher o grupo grava `Fpp.clienteGrupoId` (sem cliente específico e sem criar cadastro com o nome do grupo).
- **FPPs salvas**: cada FPP traz o grupo (o escolhido ou o da empresa). A guia **Cliente** junta num card só ("GRUPO X") as FPPs de todas as empresas do grupo e as feitas para o grupo; a busca pelo nome do grupo traz todas elas.
- **Lançamento de pedido**: na busca de FPP para indexar, as FPPs do grupo do cliente contam como "do cliente" (aparecem primeiro).
- Banco: `Fpp.clienteGrupoId`.
