# ── MenuFlow Deploy Script ────────────────────────────────────────────────────
# Uso: .\deploy.ps1
# Uso (só código, sem rebuild .exe): .\deploy.ps1 -SkipElectron

param(
  [switch]$SkipElectron  # passe -SkipElectron para não rebuildar o .exe
)

$VPS_USER  = "root"
$VPS_HOST  = "72.62.8.195"
$VPS_PATH  = "/var/www/develoi-cardapio"
$VPS_PORT  = "22"
$PM2_NAME  = "develoi-cardapio"

$ErrorActionPreference = "Stop"

function Banner($msg, $color = "Cyan") {
  Write-Host ""
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $color
  Write-Host "  $msg" -ForegroundColor $color
  Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $color
}

function Step($msg)    { Write-Host "`n▶ $msg" -ForegroundColor Yellow }
function Ok($msg)      { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Fail($msg)    { Write-Host "  ✗ $msg" -ForegroundColor Red; exit 1 }

Banner "MenuFlow — Deploy"

# ── 1. Build Electron + upload .exe ──────────────────────────────────────────
if (-not $SkipElectron) {
  Step "Gerando instaladores Electron (.exe)..."
  Push-Location "..\pdv-desktop"
  nvs use 22 | Out-Null
  npm run build
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Build Electron falhou" }

  Copy-Item "release\MenuFlow PDV Setup 1.0.0.exe" "..\cardapio-delivery\public\downloads\MenuFlow-PDV-Setup-1.0.0.exe" -Force
  Copy-Item "release\PDV-Develoi-Portable.exe"     "..\cardapio-delivery\public\downloads\PDV-Develoi-Portable.exe"     -Force
  Pop-Location
  Ok "Instaladores copiados para public/downloads/"

  Step "Enviando .exe para a VPS via SCP..."
  # Garante que a pasta existe na VPS
  ssh -p $VPS_PORT "${VPS_USER}@${VPS_HOST}" "mkdir -p ${VPS_PATH}/public/downloads"
  scp -P $VPS_PORT `
    "public\downloads\MenuFlow-PDV-Setup-1.0.0.exe" `
    "public\downloads\PDV-Develoi-Portable.exe" `
    "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/public/downloads/"
  if ($LASTEXITCODE -ne 0) { Fail "Upload SCP falhou" }
  Ok "Instaladores enviados para a VPS"
} else {
  Write-Host "`n  ⏭ Build Electron ignorado (-SkipElectron)" -ForegroundColor DarkGray
}

# ── 2. Git push ───────────────────────────────────────────────────────────────
Step "Enviando código (git push)..."
git add -A
$hasChanges = git status --porcelain
if ($hasChanges) {
  git commit -m "deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
}
git push
if ($LASTEXITCODE -ne 0) { Fail "git push falhou" }
Ok "Código enviado"

# ── 3. Deploy na VPS ──────────────────────────────────────────────────────────
Step "Executando deploy na VPS..."
$remoteCmd = @"
cd ${VPS_PATH} &&
git pull origin main &&
npm install &&
npm run build &&
pm2 restart ${PM2_NAME}
"@

ssh -p $VPS_PORT "${VPS_USER}@${VPS_HOST}" $remoteCmd
if ($LASTEXITCODE -ne 0) { Fail "Deploy na VPS falhou" }
Ok "Servidor reiniciado"

Banner "Deploy concluído!" "Green"
Write-Host "  Acesse: http://${VPS_HOST}" -ForegroundColor White
Write-Host ""
