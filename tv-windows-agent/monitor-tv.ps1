#requires -Version 5.1
# BoxSys — Agente de Painel de TV para Windows
#
# Roda em loop, verificando se existe uma tela conectada via HDMI. Quando detecta,
# abre o Painel de Pedidos no Microsoft Edge em modo kiosk (tela cheia, sem UI) já
# posicionado nessa tela. Quando o HDMI é desconectado, fecha a janela sozinho.
#
# Configuração real (URL do estabelecimento) fica em config.json, na mesma pasta
# deste script — gerado pelo instalador (instalar.ps1), nunca editado à mão aqui.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $scriptDir "config.json"

if (-not (Test-Path $configPath)) {
  throw "config.json não encontrado em $scriptDir — rode o instalador primeiro."
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$url = $config.url
if (-not $url) { throw "config.json não tem o campo 'url'." }

$profileTag = "BoxSysPainelTV"
$profilePath = Join-Path $env:LOCALAPPDATA $profileTag

# ── Localiza o Microsoft Edge ────────────────────────────────────────────────
$edgePaths = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge não encontrado neste computador." }

# ── Detecção de conexão HDMI real via QueryDisplayConfig (Win32) ─────────────
# .NET Screen.AllScreens só diz "monitor secundário", sem dizer o TIPO de conexão
# (HDMI, DisplayPort, USB-C etc). Para saber se é HDMI de verdade, precisamos
# chamar a API nativa do Windows (User32 QueryDisplayConfig / DisplayConfigGetDeviceInfo),
# que devolve o "outputTechnology" de cada saída de vídeo ativa.
$hdmiDetectorSource = @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class HdmiDetector {
    [StructLayout(LayoutKind.Sequential)]
    public struct LUID { public uint LowPart; public int HighPart; }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_SOURCE_INFO {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_TARGET_INFO {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public uint outputTechnology;
        public uint rotation;
        public uint scaling;
        public ulong refreshRateNum;
        public ulong refreshRateDen;
        public uint scanLineOrdering;
        public bool targetAvailable;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct DISPLAYCONFIG_PATH_INFO {
        public DISPLAYCONFIG_PATH_SOURCE_INFO sourceInfo;
        public DISPLAYCONFIG_PATH_TARGET_INFO targetInfo;
        public uint flags;
    }

    [DllImport("user32.dll")]
    public static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPathArrayElements, out uint numModeInfoArrayElements);

    [DllImport("user32.dll")]
    public static extern int QueryDisplayConfig(uint flags, ref uint numPathArrayElements, [Out] DISPLAYCONFIG_PATH_INFO[] pathArray, ref uint numModeInfoArrayElements, IntPtr modeInfoArray, IntPtr currentTopologyId);

    const uint QDC_ONLY_ACTIVE_PATHS = 0x00000002;
    const uint DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI = 0x00000003;
    const int ERROR_SUCCESS = 0;

    // Retorna true se existir ao menos um caminho de vídeo ATIVO cuja saída seja HDMI.
    public static bool IsHdmiConnected() {
        uint pathCount, modeCount;
        int result = GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, out pathCount, out modeCount);
        if (result != ERROR_SUCCESS || pathCount == 0) return false;

        var paths = new DISPLAYCONFIG_PATH_INFO[pathCount];
        IntPtr modeInfoArray = Marshal.AllocHGlobal((int)(modeCount * 64)); // tamanho generoso, não lemos essa parte
        try {
            result = QueryDisplayConfig(QDC_ONLY_ACTIVE_PATHS, ref pathCount, paths, ref modeCount, modeInfoArray, IntPtr.Zero);
            if (result != ERROR_SUCCESS) return false;

            foreach (var path in paths) {
                if (path.targetInfo.outputTechnology == DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI) {
                    return true;
                }
            }
            return false;
        } finally {
            Marshal.FreeHGlobal(modeInfoArray);
        }
    }
}
"@
Add-Type -TypeDefinition $hdmiDetectorSource -Language CSharp

function Get-TVScreen {
  # Só considera telas que não são a principal (evita reabrir na tela do próprio notebook)
  # E só se existir de fato uma saída HDMI ativa no sistema.
  if (-not [HdmiDetector]::IsHdmiConnected()) { return $null }
  return [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
}

function Get-TVBrowserProcesses {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" |
    Where-Object { $_.CommandLine -like "*$profileTag*" }
}

Write-Host "[BoxSys TV] Monitor iniciado. URL: $url"

while ($true) {
  try {
    $tv = Get-TVScreen
    $browserAberto = @(Get-TVBrowserProcesses)

    if ($tv -and $browserAberto.Count -eq 0) {
      $area = $tv.Bounds
      $argumentos = @(
        "--kiosk"
        "`"$url`""
        "--edge-kiosk-type=fullscreen"
        "--no-first-run"
        "--user-data-dir=`"$profilePath`""
        "--window-position=$($area.X),$($area.Y)"
        "--window-size=$($area.Width),$($area.Height)"
      )
      Start-Process -FilePath $edge -ArgumentList $argumentos
      Write-Host "[BoxSys TV] HDMI detectado — abrindo painel em $($area.Width)x$($area.Height) @ ($($area.X),$($area.Y))"
    }

    if (-not $tv -and $browserAberto.Count -gt 0) {
      foreach ($processo in $browserAberto) {
        Stop-Process -Id $processo.ProcessId -Force -ErrorAction SilentlyContinue
      }
      Write-Host "[BoxSys TV] HDMI desconectado — painel fechado"
    }
  } catch {
    Write-Host "[BoxSys TV] Erro no ciclo de monitoramento: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 2
}
