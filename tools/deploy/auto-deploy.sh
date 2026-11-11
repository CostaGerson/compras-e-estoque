#!/bin/bash
# Deploy automático: confere o GitHub a cada 10 segundos (serviço systemd ce-auto-deploy).
# Commit novo em main → pull + rebuild na hora. Log em /var/log/ce-auto-deploy.log
# v770 — grava a versão no build (app/versao.json) e a situação do deploy (backup/deploy-status.json) para o selo no topo do sistema
cd /opt/compras-e-estoque || exit 1
status() { mkdir -p backup; printf '{"estado":"%s","versao":"%s","commit":"%s","mensagem":%s,"em":"%s"}\n' "$1" "$V" "$C" "$(git log -1 --format=%s HEAD | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().strip()))')" "$(date -Iseconds)" > backup/deploy-status.json; }
while true; do
  # constrói quando o GitHub tem commit diferente do último construído (backup/ultimo-deploy)
  if git fetch -q origin main 2>/dev/null && [ "$(cat backup/ultimo-deploy 2>/dev/null)" != "$(git rev-parse origin/main)" ]; then
    git pull -q --ff-only origin main || git reset -q --hard origin/main
    C=$(git rev-parse --short HEAD); V=$(git log -1 --format=%s HEAD | grep -oE '^v[0-9]+' || echo "$C")
    echo "=== $(date '+%d/%m/%Y %H:%M:%S') deploy de $V ($C): $(git log -1 --format=%s HEAD)"
    status CONSTRUINDO
    printf '{"versao":"%s","commit":"%s","construidoEm":"%s"}\n' "$V" "$C" "$(date -Iseconds)" > app/versao.json
    git rev-parse HEAD > backup/ultimo-deploy
    if docker compose up -d --build > /tmp/ce-build.log 2>&1; then status NO_AR; else status ERRO; fi
    tail -5 /tmp/ce-build.log
    echo "=== fim $(date '+%H:%M:%S')"
  fi
  sleep 10
done
