#requires -Version 5.1
#requires -RunAsAdministrator
# BoxSys — Instalador do Agente de Painel de TV para Windows
#
# Copia o monitor pra C:\BoxSys\PainelTV, salva a URL do estabelecimento em
# config.json, e registra uma Tarefa Agendada que roda o monitor sempre que o
# Windows liga (mesmo sem login, se o PC tiver logon automático configurado) —
# mais confiável que um atalho na pasta Startup, que só dispara após login manual.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  BoxSys — Instalador do Painel de TV (Windows + HDMI)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Pergunta o slug/URL do estabelecimento ────────────────────────────────
$installDir = "C:\BoxSys\PainelTV"
$existingConfig = Join-Path $installDir "config.json"
$defaultSlug = ""
if (Test-Path $existingConfig) {
  try {
    $prev = Get-Content $existingConfig -Raw | ConvertFrom-Json
    if ($prev.slug) { $defaultSlug = $prev.slug }
  } catch {}
}

$promptSuffix = if ($defaultSlug) { " (atual: $defaultSlug)" } else { "" }
$slug = Read-Host "Digite o identificador (slug) do seu estabelecimento no BoxSys$promptSuffix"
if (-not $slug -and $defaultSlug) { $slug = $defaultSlug }
if (-not $slug) { throw "Slug não informado. Instalação cancelada." }
$slug = $slug.Trim().Trim('/')

$url = "https://boxsys.com.br/$slug/display"
Write-Host ""
Write-Host "URL do painel: $url" -ForegroundColor Yellow
Write-Host ""

# ── 2. Grava os arquivos ──────────────────────────────────────────────────────
# O conteúdo de monitor-tv.ps1 vem embutido logo abaixo — necessário porque este
# instalador é compilado em .exe (PS2EXE) e distribuído sozinho, sem nenhum arquivo
# ao lado pra copiar. O build.ps1 injeta o conteúdo real no lugar do placeholder.
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

$monitorScriptContent = @'
__MONITOR_SCRIPT_CONTENT__
'@
Set-Content -Path (Join-Path $installDir "monitor-tv.ps1") -Value $monitorScriptContent -Encoding UTF8

$config = @{ slug = $slug; url = $url } | ConvertTo-Json
Set-Content -Path (Join-Path $installDir "config.json") -Value $config -Encoding UTF8

Write-Host "Arquivos copiados para $installDir" -ForegroundColor Green

# ── 3. Registra a Tarefa Agendada (roda o monitor ao ligar o Windows) ────────
$taskName = "BoxSysPainelTV"
$monitorScript = Join-Path $installDir "monitor-tv.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$monitorScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null

Write-Host "Tarefa agendada '$taskName' criada — inicia sozinho a cada login do Windows." -ForegroundColor Green

# ── 4. Inicia agora mesmo, sem esperar o próximo login ───────────────────────
Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Instalação concluída!" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Conecte o cabo HDMI na TV — o Painel de Pedidos abre sozinho em"
Write-Host "tela cheia. Ao desconectar o HDMI, ele fecha automaticamente."
Write-Host ""
Write-Host "Para fechar manualmente a qualquer momento: Alt+F4 na janela do painel."
Write-Host "Para desinstalar: rode desinstalar.ps1 nesta mesma pasta."
Write-Host ""
Read-Host "Pressione Enter para fechar"
