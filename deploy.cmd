@echo off
cd /d C:\projetos\compras-e-estoque
git pull --rebase
if exist "compras-e-estoque-%~1.zip" (
  powershell -NoProfile -Command "Expand-Archive -Path 'compras-e-estoque-%~1.zip' -DestinationPath '%TEMP%\ce-%~1' -Force"
  robocopy "%TEMP%\ce-%~1\compras-e-estoque" "C:\projetos\compras-e-estoque" /E /IS /IT >nul
)
git add -A
git commit -m "%~1: %~2"
git push
ssh root@147.93.35.189 "cd /opt/compras-e-estoque && git pull && docker compose up -d --build"
