# v789 — personalização exclusiva na tarefa de layout + selo da versão

- **Tarefa de layout do arte finalista (Ayrllon):** cada item mostra a **personalização exclusiva** do pedido (nome, número… por peça, agrupada por tamanho), com "copiar lista" para colar no Excel/Corel. Também sai na prévia/OP aberta pela tarefa. Vem de `opDaTarefa` (`dadosUnitarios` do `PpItem`).
- **Selo da versão:** commit sem "vN:" no começo (ex.: `d1cb044` do ajuste do PCP) mostrava o hash. Agora o `auto-deploy.sh` usa a última versão numerada (`v788+d1cb044`) e o selo mostra só `v788`. O script novo vale depois de `systemctl restart ce-auto-deploy` na VPS.
- Regra: todo commit no main começa com `vN:`.
