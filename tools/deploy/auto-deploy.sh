#!/bin/bash
# Deploy automático: roda a cada minuto (cron). Se o GitHub tiver commit novo em main, faz pull e rebuild.
# Log em /var/log/ce-auto-deploy.log
cd /opt/compras-e-estoque || exit 1
exec 9>/tmp/ce-auto-deploy.lock
flock -n 9 || exit 0                                    # já tem um deploy rodando
git fetch -q origin main || exit 0
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] && exit 0
sleep 60                                                # espera commits em sequência chegarem juntos
git fetch -q origin main
echo "=== $(date '+%d/%m/%Y %H:%M:%S') deploy de $(git rev-parse --short origin/main): $(git log -1 --format=%s origin/main)"
git pull -q --ff-only origin main || { git reset -q --hard origin/main; }
docker compose up -d --build 2>&1 | tail -5
echo "=== fim $(date '+%H:%M:%S')"
