#requires -Version 5.1
#requires -RunAsAdministrator
# BoxSys — Desinstalador do Agente de Painel de TV para Windows

$ErrorActionPreference = "SilentlyContinue"

Write-Host "Removendo o Agente de Painel de TV do BoxSys..." -ForegroundColor Cyan

$taskName = "BoxSysPainelTV"
Stop-ScheduledTask -TaskName $taskName
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false

Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
  Where-Object { $_.CommandLine -like "*BoxSysPainelTV*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-Process -Name "powershell" -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine -like "*monitor-tv.ps1*" } |
  Stop-Process -Force

Remove-Item -Path "C:\BoxSys\PainelTV" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Agente removido. O atalho na TV nao vai mais abrir sozinho." -ForegroundColor Green
Read-Host "Pressione Enter para fechar"
