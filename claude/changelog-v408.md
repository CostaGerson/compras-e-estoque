# v408 — NF emitida no KM sem XML/PDF no sistema: crítica no Movimento fiscal + mensagem

- **Leitura**: o agente do KM passa a mandar, além dos pedidos, todas as NFs de saída não canceladas dos últimos 60 dias (`livsaida`: nº, emissão, valor, pedido, cliente, CNPJ). As NFs que já vinham nos pedidos (`pedidos[].nfs` e `PedidoVenda.kmNfs`) também entram — funciona mesmo antes de reinstalar o agente.
- **Modelo novo** `KmNfSaida` (chave nº|emissão). `lib/kmNfs.js` roda a cada sincronização: grava, concilia com `FiscalNota` de SAÍDA com XML ou PDF (mesmo nº; CNPJ igual quando os dois têm — vale também o ZIP da contabilidade), marca cancelada a NF que sumiu da lista do KM.
- **Movimento fiscal**: NF do KM sem arquivo aparece em vermelho ("emitida no KM", natureza = pedido) com **Importar** e **Vistar**; aviso no topo com a contagem. Não entra nos totais. Some sozinha quando o XML/PDF sobe.
- **Mensagens**: a partir do dia seguinte à emissão, uma mensagem por lote (cada NF só uma vez) para master + FINANCEIRO + ADMINISTRATIVO.
- Agente: log mostra "NF KM sem arquivo N". Depois do `git pull` no PC, rodar `km-sync.ps1 -Instalar` para copiar o SQL novo para a pasta da tarefa.
