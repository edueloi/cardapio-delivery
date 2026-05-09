# ── MenuFlow Deploy Script ────────────────────────────────────────────────────
# Uso: .\deploy.ps1
#
# O que faz:
#   1. Build do frontend (Vite)
#   2. Git push para o repositório
#   3. Upload dos instaladores .exe para a VPS via SCP
#   4. Restart do servidor na VPS via SSH
#
# Configure as variáveis abaixo antes de usar:

# ── CONFIGURAÇÃO ──────────────────────────────────────────────────────────────
$VPS_USER   = "root"                        # usuário SSH da VPS
$VPS_HOST   = "SEU_IP_OU_DOMINIO"          # IP ou domínio da VPS
$VPS_PATH   = "/var/www/menuflow"           # pasta do projeto na VPS
$VPS_PORT   = "22"                          # porta SSH (normalmente 22)
# Se usar chave SSH: $SSH_KEY = "C:\Users\Eduardo\.ssh\id_rsa"
# Se usar senha: deixe $SSH_KEY = ""
$SSH_KEY    = ""
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  MenuFlow — Deploy" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Build Electron app (gera os .exe)
Write-Host "▶ Gerando instaladores Electron..." -ForegroundColor Yellow
Push-Location "..\pdv-desktop"
nvs use 22 | Out-Null
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Build Electron falhou" -ForegroundColor Red; exit 1 }

# Copia .exe para public/downloads
Copy-Item "release\MenuFlow PDV Setup 1.0.0.exe" "..\cardapio-delivery\public\downloads\MenuFlow-PDV-Setup-1.0.0.exe" -Force
Copy-Item "release\PDV-Develoi-Portable.exe"     "..\cardapio-delivery\public\downloads\PDV-Develoi-Portable.exe"     -Force
Write-Host "  ✓ Instaladores copiados para public/downloads/" -ForegroundColor Green
Pop-Location

# 2. Build frontend
Write-Host ""
Write-Host "▶ Build do frontend (Vite)..." -ForegroundColor Yellow
nvs use 22 | Out-Null
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "✗ Build falhou" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Build concluído" -ForegroundColor Green

# 3. Git push
Write-Host ""
Write-Host "▶ Enviando código para o repositório..." -ForegroundColor Yellow
git add -A
git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>$null
git push
Write-Host "  ✓ Código enviado" -ForegroundColor Green

# 4. Upload dos .exe para a VPS via SCP
Write-Host ""
Write-Host "▶ Enviando instaladores para a VPS..." -ForegroundColor Yellow

$scpArgs = @("-P", $VPS_PORT)
if ($SSH_KEY) { $scpArgs += @("-i", $SSH_KEY) }

scp @scpArgs `
  "public\downloads\MenuFlow-PDV-Setup-1.0.0.exe" `
  "public\downloads\PDV-Develoi-Portable.exe" `
  "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/public/downloads/"

if ($LASTEXITCODE -ne 0) { Write-Host "✗ Upload SCP falhou" -ForegroundColor Red; exit 1 }
Write-Host "  ✓ Instaladores enviados para a VPS" -ForegroundColor Green

# 5. Restart do servidor na VPS
Write-Host ""
Write-Host "▶ Reiniciando servidor na VPS..." -ForegroundColor Yellow

$sshArgs = @("-p", $VPS_PORT)
if ($SSH_KEY) { $sshArgs += @("-i", $SSH_KEY) }

ssh @sshArgs "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && git pull && npm install --production && pm2 restart menuflow"

if ($LASTEXITCODE -ne 0) { Write-Host "✗ Restart falhou — verifique manualmente na VPS" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  ✓ Deploy concluído com sucesso!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
