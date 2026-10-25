# v425 — Logística › Rotas

- **Calendário** semanal (ou mensal), no estilo da Agenda; o dia de hoje é o maior card. Clicar num dia cria a demanda de rota naquele dia. Urgente = vermelho e no topo; frete = azul; concluída = verde.
- **Demanda de rota** (`RotaDemanda`): objetivo (coleta, entrega, compra), destinatário com busca nos terceirizados, fornecedores e clientes (endereço, contato e telefone preenchidos sozinhos), data, horário (fixo, manhã, tarde, até as, após as, de/até, qualquer), motorista (folha: cargo com MOTORISTA; freelancers com função motorista), veículo (carro/moto), urgente, observação.
- **Frete:** transportadora → cria demanda ADM "COTAR FRETE" (`AdmDemanda.tipo = COTACAO_FRETE`) que só conclui com anexo da cotação + valor + prazo + transportadoras cotadas (download do anexo na demanda); Fretebras → valor máximo e nº de volumes. Frete não entra nas rotas.
- **Mapa do dia** (Leaflet + OpenStreetMap/CARTO): RMBH; ao lado, Minas ou Brasil quando há pontos fora da RMBH. Endereços localizados pelo Nominatim (OpenStreetMap), com cache (`GeoCache`).
- **Montar rota:** selecionar demandas do dia → motorista, veículo e saída → melhor sequência (menor distância respeitando os horários: força bruta até 7 paradas, depois vizinho mais próximo + 2-opt; distância em linha reta × 1,35, carro 28 km/h, moto 34 km/h, 15 min por parada) → ajustar com as setas → salvar ou **despachar**.
- **Despacho:** link(s) do Google Maps (fábrica → paradas → fábrica, até 9 paradas por link) e botão para enviar a rota no WhatsApp do motorista (telefone da ficha do RH ou do freelancer); motorista com usuário recebe também mensagem no sistema. Rota fica **em execução** (`RotaBloco`).
- **Execução:** o motorista (usuário ligado à pessoa da folha) vê "Minha rota", conclui cada parada e registra "Cheguei na fábrica"; a rota fecha e ele fica disponível. O administrativo acompanha e pode fazer o mesmo.
- Endereço da fábrica configurável (botão Fábrica).
