#!/bin/bash
# Deploy automático: confere o GitHub a cada 10 segundos (serviço systemd ce-auto-deploy).
# Commit novo em main → pull + rebuild na hora. Log em /var/log/ce-auto-deploy.log
cd /opt/compras-e-estoque || exit 1
while true; do
  if git fetch -q origin main 2>/dev/null && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    echo "=== $(date '+%d/%m/%Y %H:%M:%S') deploy de $(git rev-parse --short origin/main): $(git log -1 --format=%s origin/main)"
    git pull -q --ff-only origin main || git reset -q --hard origin/main
    docker compose up -d --build 2>&1 | tail -5
    echo "=== fim $(date '+%H:%M:%S')"
  fi
  sleep 10
done
