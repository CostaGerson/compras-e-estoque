# v529 — Rotas: hoje volta a aparecer com demanda passada pendente

- Bug da v521: com demanda pendente de dia anterior, a semana passava a começar nesse dia (ex.: 19/10) e hoje + próximos dias saíam da tela. Rotas concluídas ficam ocultas nos dias passados, então parecia que tudo tinha sumido. Nenhum dado foi apagado.
- Agora: os dias passados com pendência (até 14 dias) entram como cards vermelhos **antes** de hoje; hoje continua grande, com o mapa ao lado, e a semana segue a partir dele.
- Demanda cancelada não conta mais como pendência.
