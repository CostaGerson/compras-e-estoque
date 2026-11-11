#!/bin/bash
# Instala o deploy automático (uma vez só). Liga o cron que roda auto-deploy.sh a cada minuto.
chmod +x /opt/compras-e-estoque/tools/deploy/auto-deploy.sh
( crontab -l 2>/dev/null | grep -v ce-auto-deploy; echo "* * * * * /opt/compras-e-estoque/tools/deploy/auto-deploy.sh >> /var/log/ce-auto-deploy.log 2>&1 # ce-auto-deploy" ) | crontab -
echo "Deploy automatico ligado. Acompanhar: tail -f /var/log/ce-auto-deploy.log"
