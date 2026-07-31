# Compras & Estoque — Meridian

Sistema de gestão de material e financeiro (Next.js + Prisma + Postgres + Docker).

## Subir na VPS (primeira vez)
```
cd /opt/compras-e-estoque
cp .env.example .env     # depois edite o .env e coloque uma senha forte em DB_PASSWORD
docker compose up -d --build
```
App: http://IP-DA-VPS:3010

## Atualizar (após git pull)
```
cd /opt/compras-e-estoque
git pull
docker compose up -d --build
```
