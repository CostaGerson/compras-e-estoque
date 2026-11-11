#!/bin/bash
# Instala o deploy automático (uma vez só): serviço que confere o GitHub a cada 10 segundos.
chmod +x /opt/compras-e-estoque/tools/deploy/auto-deploy.sh
( crontab -l 2>/dev/null | grep -v ce-auto-deploy ) | crontab -      # tira a versão antiga (cron de 1 minuto)
cat > /etc/systemd/system/ce-auto-deploy.service <<'UNIT'
[Unit]
Description=Deploy automatico Compras e Estoque
After=network-online.target docker.service

[Service]
ExecStart=/opt/compras-e-estoque/tools/deploy/auto-deploy.sh
Restart=always
RestartSec=5
StandardOutput=append:/var/log/ce-auto-deploy.log
StandardError=append:/var/log/ce-auto-deploy.log

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now ce-auto-deploy
systemctl restart ce-auto-deploy
echo "Deploy automatico ligado (confere a cada 10 s). Acompanhar: tail -f /var/log/ce-auto-deploy.log"
