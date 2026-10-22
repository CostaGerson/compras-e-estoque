# v393 — Pedidos em andamento: filtros por card/aviso, NORT fora da lista; ordenar qualquer lista pelo título da coluna

- **Card "Pedidos em andamento · a faturar" zerado**: `vlEntregar` vinha como Decimal do Prisma e a soma concatenava texto → NaN → 0. Agora é número na listagem.
- Internos NORT saem da lista principal; aparecem só ao clicar no aviso "interno(s) NORT".
- Cards (em andamento, a receber no mês, fora do mês, antes do mês, entradas lançadas/a lançar) e avisos (concluídos no PCP sem/com NF, NF sugerida,
  NF no KM, condição não reconhecida, programação/entrega vencida, sem PV, sem Cronograma, antigos fora do PCP) são clicáveis: a lista mostra só os
  pedidos que compõem o card/aviso ("Mostrando: … · n" + "mostrar todos"). Antigos fora do PCP vêm na resposta marcados `oculto` (`?ocultos=1`), fora dos totais.
- `app/ordenarTabelas.jsx` (no layout): clicar no título de qualquer coluna de qualquer tabela do sistema ordena (crescente/A→Z, decrescente/Z→A, original).
  Números BR, R$, %, datas dd/mm/aaaa, texto pt-BR natural; vazios no fim; linhas "Total" fixas; linha de detalhe acompanha a principal
  (`data-chave` / `data-anexo`, ou célula única com colspan); mantém a ordem quando a tela recarrega. Tabelas com ordenação própria (onClick no cabeçalho)
  ou `data-sem-ordenar` ficam de fora.
