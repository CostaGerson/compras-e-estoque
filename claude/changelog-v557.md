# v557 — CT-e no movimento fiscal + fretes na Análise da logística

- **Movimento fiscal** aceita CT-e (XML e/ou DACTE em PDF, juntos ou separados). Vira conta a pagar do frete
  (tomador Meridian/NORT), título `FRETE COMPRA|ENTREGA CT-e N · NF X`, conta-caixa 2111210 (frete compra) ou 2111220 (frete entrega).
  Tomador de outra empresa → sugestão "só registrar". Conferência mostra rota, volumes, peso, previsão e as NFs atendidas.
- Tipo do frete pela NF do CT-e: emitente Meridian/NORT → **ENTREGA** (qualquer natureza); senão → **COMPRA**.
- Novo modelo `FreteCte` (dados logísticos, ligado à FiscalNota do CT-e; apagar o registro fiscal apaga o frete).
- **Análise da logística**: guias Custo logístico · Frete compra · Frete entrega · Fretes baixados (`app/fretesLogistica.jsx`, `lib/fretes.js`, `api/logistica/fretes`).
  Lista: emissão CT-e, transportadora, origem, destino, remetente, valor da NF (sem NF no sistema: valor da carga do CT-e, com *), valor do frete, % frete/NF e downloads PDF/XML da NF e do CT-e.
  Clique na linha: volumes, peso, emissão NF/CT-e, previsão, entrega, tempo de transporte, atraso, OC, pedido(s) e conta a pagar.
- Baixa: frete compra baixa sozinho com a **baixa da OC** da NF (reabrir a OC desfaz); frete entrega (ou compra sem OC) por "Baixar frete" com data.
- **Pedido › Financeiro**: card Fretes — entrega pelas NFs casadas; compra pelas OCs com itens do pedido. Com downloads.
- Ligações (NF, OC, pedido) resolvidas na leitura pela chave da NF: CT-e subido antes da NF liga sozinho depois.
