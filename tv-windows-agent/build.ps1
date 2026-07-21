#requires -Version 5.1
# BoxSys — Build do instalador do Agente de Painel de TV (Windows)
#
# Injeta o conteúdo real de monitor-tv.ps1 dentro de instalar.ps1 (no lugar do
# placeholder __MONITOR_SCRIPT_CONTENT__) e compila tudo num único .exe standalone
# via PS2EXE — assim o instalador final não depende de nenhum arquivo externo.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Module -ListAvailable ps2exe)) {
  throw "Módulo ps2exe não encontrado. Rode: Install-Module -Name ps2exe -Scope CurrentUser -Force"
}
Import-Module ps2exe

$installerTemplate = Join-Path $scriptDir "instalar.ps1"
$monitorScript = Join-Path $scriptDir "monitor-tv.ps1"
$outputDir = Join-Path $scriptDir "dist"
$mergedScript = Join-Path $outputDir "_instalar-merged.ps1"
$outputExe = Join-Path $outputDir "BoxSys-PainelTV-Windows-Setup.exe"

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$templateContent = Get-Content $installerTemplate -Raw -Encoding UTF8
$monitorContent = Get-Content $monitorScript -Raw -Encoding UTF8

if ($templateContent -notmatch "__MONITOR_SCRIPT_CONTENT__") {
  throw "Placeholder __MONITOR_SCRIPT_CONTENT__ não encontrado em instalar.ps1."
}

$monitorContentTrimmed = $monitorContent.TrimEnd()
$merged = $templateContent.Replace("__MONITOR_SCRIPT_CONTENT__", "$monitorContentTrimmed`r`n")
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($mergedScript, $merged, $utf8Bom)

Write-Host "Script mesclado gerado em $mergedScript" -ForegroundColor Green

Invoke-PS2EXE `
  -InputFile $mergedScript `
  -OutputFile $outputExe `
  -Title "BoxSys - Instalador do Painel de TV" `
  -Description "Instala o agente que abre o Painel de Pedidos na TV via HDMI" `
  -Company "BoxSys" `
  -Version "1.0.0.0" `
  -RequireAdmin `
  -NoConsole:$false

Write-Host ""
Write-Host "Instalador gerado: $outputExe" -ForegroundColor Cyan
