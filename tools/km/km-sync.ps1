# v399/v408 - Agente KM -> Compras & Estoque (Meridian)
# Le os pedidos do banco do KM (somente leitura, usuario de consulta) e envia para o sistema na VPS.
#
# Uso (PowerShell, dentro de C:\projetos\compras-e-estoque\tools\km):
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Configurar   (1a vez: senha do banco e token; fica criptografado neste usuario do Windows)
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Previa       (mostra o que vai entrar, sem gravar)
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1               (sincroniza agora)
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Instalar     (roda sozinho a cada 1 minuto; -Minutos N para outro intervalo)
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Desinstalar
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Clientes     (v521: manda TODOS os clientes do KM agora; com -Previa so mostra)
#   powershell -ExecutionPolicy Bypass -File .\km-sync.ps1 -Produtos     (v595: manda o cadastro de itens do KM agora)
# v521: clientes do KM vao sozinhos de hora em hora e quando alguem clica "Buscar do KM" na tela Clientes
# v595: itens (produtos) do KM vao sozinhos de hora em hora (minuto 10)
param([switch]$Configurar, [switch]$Previa, [switch]$Instalar, [switch]$Desinstalar, [int]$Minutos = 1, [switch]$Silencioso, [switch]$Clientes, [switch]$Produtos)
$ErrorActionPreference = "Stop"

$pasta  = Join-Path $env:LOCALAPPDATA "km-sync"
$cfgArq = Join-Path $pasta "config.json"
$logArq = Join-Path $pasta "log.txt"
$tarefa = "KM Sync - Compras e Estoque"
New-Item -ItemType Directory -Force -Path $pasta | Out-Null

function Log($m) {
  $l = "{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m
  Add-Content -Path $logArq -Value $l
  Write-Host $l
  if ((Get-Item $logArq).Length -gt 2MB) { Get-Content $logArq -Tail 2000 | Set-Content "$logArq.tmp"; Move-Item -Force "$logArq.tmp" $logArq }
}
function Segredo([string]$t) { ConvertTo-SecureString $t -AsPlainText -Force | ConvertFrom-SecureString }
function Abrir([string]$t) {
  $s = ConvertTo-SecureString $t
  [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}

if ($Configurar) {
  $c = [ordered]@{
    host = "192.168.0.107"; porta = "5435"; banco = "mentorsoft"; usuario = "mentorbi"
    url  = "http://147.93.35.189:3010"
    psql = (Join-Path $HOME "pgsql-cli\pgsql\bin\psql.exe")
  }
  $h = Read-Host "Servidor do KM [$($c.host)]";    if ($h) { $c.host = $h }
  $u = Read-Host "Usuario do banco [$($c.usuario)]"; if ($u) { $c.usuario = $u }
  $s = Read-Host "Senha do banco ($($c.usuario))" -AsSecureString
  $c.senha = ConvertFrom-SecureString $s
  $t = Read-Host "Token do sistema (KM_SYNC_TOKEN)" -AsSecureString
  $c.token = ConvertFrom-SecureString $t
  $c | ConvertTo-Json | Set-Content $cfgArq
  # copia o agente para a pasta local (a tarefa agendada nao depende da pasta do projeto)
  Copy-Item -Force (Join-Path $PSScriptRoot "km-sync.ps1") (Join-Path $pasta "km-sync.ps1")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-pedidos.sql") (Join-Path $pasta "km-pedidos.sql")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-clientes.sql") (Join-Path $pasta "km-clientes.sql")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-produtos.sql") (Join-Path $pasta "km-produtos.sql")
  Write-Host "Configurado em $cfgArq"
  exit 0
}

if ($Desinstalar) { Unregister-ScheduledTask -TaskName $tarefa -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "Tarefa removida."; exit 0 }

if ($Instalar) {
  if (-not (Test-Path $cfgArq)) { throw "Rode antes com -Configurar." }
  Copy-Item -Force (Join-Path $PSScriptRoot "km-sync.ps1") (Join-Path $pasta "km-sync.ps1")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-pedidos.sql") (Join-Path $pasta "km-pedidos.sql")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-clientes.sql") (Join-Path $pasta "km-clientes.sql")
  Copy-Item -Force (Join-Path $PSScriptRoot "km-produtos.sql") (Join-Path $pasta "km-produtos.sql")
  if ($Minutos -lt 1) { $Minutos = 1 }
  # lancador .vbs: roda o PowerShell sem abrir/piscar janela
  $vbs = Join-Path $pasta "km-sync.vbs"
  $ps1 = Join-Path $pasta "km-sync.ps1"
  $q = [char]34
  $linha = 'CreateObject("WScript.Shell").Run "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ' + $q + $q + $ps1 + $q + $q + ' -Silencioso", 0, False'
  Set-Content -Path $vbs -Encoding ASCII -Value $linha
  $acao = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
  $gat  = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutos) -RepetitionDuration (New-TimeSpan -Days 3650)
  $cfgT = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
  Register-ScheduledTask -TaskName $tarefa -Action $acao -Trigger $gat -Settings $cfgT -Description "Envia os pedidos do KM para o Compras e Estoque a cada $Minutos minuto(s)" -Force | Out-Null
  Write-Host "Instalado: roda a cada $Minutos minuto(s), sem janela, enquanto este usuario estiver logado. Log: $logArq"
  exit 0
}

# ---------- sincronizacao ----------
if (-not (Test-Path $cfgArq)) { throw "Rode antes com -Configurar." }
$c = Get-Content $cfgArq -Raw | ConvertFrom-Json
$sql = Join-Path $PSScriptRoot "km-pedidos.sql"
if (-not (Test-Path $sql)) { $sql = Join-Path $pasta "km-pedidos.sql" }
if (-not (Test-Path $c.psql)) { throw "psql nao encontrado em $($c.psql)" }
$saida = Join-Path $pasta "pedidos.json"

# ---------- v521: clientes do KM ----------
function RodarSql([string]$nome, [string]$arqSaida, [string]$abertos = "") {
  $f = Join-Path $PSScriptRoot $nome
  if (-not (Test-Path $f)) { $f = Join-Path $pasta $nome }
  if (-not (Test-Path $f)) { Log "ERRO: $nome nao encontrado"; return $false }
  try {
    $env:PGPASSWORD = Abrir $c.senha
    $env:PGCLIENTENCODING = "UTF8"
    $ErrorActionPreference = "Continue"
    & $c.psql -h $c.host -p $c.porta -U $c.usuario -d $c.banco -X -q -t -A -v ON_ERROR_STOP=1 -v "abertos=$abertos" -f $f -o $arqSaida 2>&1 | ForEach-Object { Log "psql: $_" }
    $cod = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
  } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
  if ($cod -ne 0) { Log "ERRO: psql ($nome) terminou com codigo $cod"; return $false }
  return $true
}
function EnviarClientes([bool]$soPrevia) {
  $arq = Join-Path $pasta "clientes.json"
  if (-not (RodarSql "km-clientes.sql" $arq)) { return }
  $u = $c.url.TrimEnd("/") + "/api/km/clientes" + $(if ($soPrevia) { "?previa=1" } else { "" })
  try {
    $w = Invoke-WebRequest -UseBasicParsing -Uri $u -Method Post -Body ([IO.File]::ReadAllBytes($arq)) -ContentType "application/json; charset=utf-8" -Headers @{ "x-km-token" = (Abrir $c.token) } -TimeoutSec 300
    $r = [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray()) | ConvertFrom-Json
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = "$msg - $($_.ErrorDetails.Message)" }
    Log "ERRO ao enviar clientes: $msg"; return
  }
  if ($soPrevia) {
    $p = Join-Path $HOME "km_clientes_previa.json"
    [IO.File]::WriteAllText($p, ($r | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
    Log ("CLIENTES (previa): {0} recebidos -> {1}" -f $r.recebidos, $p)
    notepad $p
  } else {
    Log ("CLIENTES: {0} recebidos | {1} novos | {2} atualizados | {3} sem mudanca | {4} sem nome{5}" -f $r.recebidos, $r.novos, $r.atualizados, $r.iguais, $r.semNome, $(if ($r.erros.Count) { " | ERROS: " + ($r.erros -join "; ") } else { "" }))
  }
}
if ($Clientes) { EnviarClientes ([bool]$Previa); exit 0 }

# ---------- v595: itens (produtos) do KM ----------
function EnviarProdutos([bool]$soPrevia) {
  $arq = Join-Path $pasta "produtos.json"
  if (-not (RodarSql "km-produtos.sql" $arq)) { return }
  $u = $c.url.TrimEnd("/") + "/api/km/produtos" + $(if ($soPrevia) { "?previa=1" } else { "" })
  try {
    $w = Invoke-WebRequest -UseBasicParsing -Uri $u -Method Post -Body ([IO.File]::ReadAllBytes($arq)) -ContentType "application/json; charset=utf-8" -Headers @{ "x-km-token" = (Abrir $c.token) } -TimeoutSec 300
    $r = [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray()) | ConvertFrom-Json
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = "$msg - $($_.ErrorDetails.Message)" }
    Log "ERRO ao enviar produtos: $msg"; return
  }
  Log ("PRODUTOS{0}: {1} recebidos | {2} gravados{3}" -f $(if ($soPrevia) { " (previa)" } else { "" }), $r.recebidos, [int]$r.gravados, $(if ($r.erros.Count) { " | ERROS: " + ($r.erros -join "; ") } else { "" }))
}
if ($Produtos) { EnviarProdutos ([bool]$Previa); exit 0 }

# pedidos em andamento no sistema (consultados no KM mesmo fora do filtro)
$abertos = ""
try {
  $wa = Invoke-WebRequest -UseBasicParsing -Uri ($c.url.TrimEnd("/") + "/api/km/sync?abertos=1") -Headers @{ "x-km-token" = (Abrir $c.token) } -TimeoutSec 60
  $abertos = ([Text.Encoding]::UTF8.GetString($wa.RawContentStream.ToArray())) -replace "[^0-9,]", ""
} catch { Log "aviso: nao consegui a lista de pedidos em andamento ($($_.Exception.Message))" }

try {
  $env:PGPASSWORD = Abrir $c.senha
  $env:PGCLIENTENCODING = "UTF8"
  $ErrorActionPreference = "Continue"   # PowerShell 5.1: stderr do psql nao pode virar excecao
  & $c.psql -h $c.host -p $c.porta -U $c.usuario -d $c.banco -X -q -t -A -v ON_ERROR_STOP=1 -v "abertos=$abertos" -f $sql -o $saida 2>&1 | ForEach-Object { Log "psql: $_" }
  $cod = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($cod -ne 0) { Log "ERRO: psql terminou com codigo $cod"; exit 1 }
} finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }

$bytes = [IO.File]::ReadAllBytes($saida)
$url = $c.url.TrimEnd("/") + "/api/km/sync" + $(if ($Previa) { "?previa=1" } else { "" })
try {
  $w = Invoke-WebRequest -UseBasicParsing -Uri $url -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -Headers @{ "x-km-token" = (Abrir $c.token) } -TimeoutSec 300
  $txt = [Text.Encoding]::UTF8.GetString($w.RawContentStream.ToArray())   # PowerShell 5.1 leria a resposta como Latin-1
  $r = $txt | ConvertFrom-Json
} catch {
  $msg = $_.Exception.Message
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = "$msg - $($_.ErrorDetails.Message)" }
  Log "ERRO ao enviar: $msg"
  exit 1
}

if ($Previa) {
  $arq = Join-Path $HOME "km_previa.json"
  [IO.File]::WriteAllText($arq, ($r | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
  Log ("PREVIA: {0} recebidos, {1} ignorados (sem saldo/cancelados) -> {2}" -f $r.recebidos, $r.ignorados, $arq)
  notepad $arq
} else {
  $mudou = ([int]$r.novos + [int]$r.atualizados + [int]$r.faturados + [int]$r.entradas + [int]$r.cancelados + [int]$r.pendentesContas + [int]$r.nfsAvisadas + $r.erros.Count) -gt 0
  if ($mudou -or -not $Silencioso -or (Get-Date).Minute -eq 0) {   # agendado e sem mudanca: registra so uma vez por hora (manual: sempre)
    Log ("OK: {0} recebidos | {1} novos | {2} atualizados | {3} sem mudanca | {4} entradas | {5} faturados | {6} NF sem contas | {7} cancelados | NF KM sem arquivo {10} | ignorados {9}{8}" -f `
      $r.recebidos, $r.novos, $r.atualizados, $r.iguais, $r.entradas, $r.faturados, [int]$r.pendentesContas, $r.cancelados, $(if ($r.erros.Count) { " | ERROS: " + ($r.erros -join "; ") } else { "" }), $(if ($r.ignoradosLista) { "$($r.ignorados) (" + (($r.ignoradosLista | Select-Object -First 15) -join ", ") + ")" } else { "0" }), [int]$r.nfsSemArquivo)
  }
}

# v521 - clientes: de hora em hora (minuto 5) ou quando pedido pela tela Clientes
if (-not $Previa) {
  $pediu = "0"
  try {
    $wp = Invoke-WebRequest -UseBasicParsing -Uri ($c.url.TrimEnd("/") + "/api/km/clientes?pendente=1") -Headers @{ "x-km-token" = (Abrir $c.token) } -TimeoutSec 30
    $pediu = ([Text.Encoding]::UTF8.GetString($wp.RawContentStream.ToArray())).Trim()
  } catch { }
  if ($pediu -eq "1" -or (Get-Date).Minute -eq 5) { EnviarClientes $false }
  if ((Get-Date).Minute -eq 10) { EnviarProdutos $false }   # v595
}
