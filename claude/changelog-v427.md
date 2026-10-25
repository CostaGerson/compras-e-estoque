# v427 — Rotas com Google Maps (chave GOOGLE_MAPS_KEY no .env da VPS)

- **Autocomplete de endereço** (Places API New) na demanda de rota e no endereço da fábrica: sugestões do Google enquanto digita (espera 350 ms parado; sessão de autocomplete); o endereço escolhido já vem com as coordenadas ("localizado no mapa ✓").
- **Geocoding do Google** para endereços digitados ou vindos do cadastro (cache em `GeoCache`; o que o OpenStreetMap não achou é tentado de novo no Google).
- **Distância e tempo por ruas** (Routes API · Compute Route Matrix, sem trânsito) no cálculo da melhor sequência e na rota salva; cada trecho fica guardado (`RotaTrecho`), reordenar não consulta de novo. Moto = 85% do tempo do carro. Sem a chave ou com erro, volta para a linha reta.
- `docker-compose.yml`: passa `GOOGLE_MAPS_KEY` para o app.
