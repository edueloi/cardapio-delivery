# /atualizar-tv-windows — Gerar e publicar o Agente de Painel de TV para Windows

Quando o usuário invocar `/atualizar-tv-windows`, execute os passos abaixo. Confirme com o
usuário antes do passo de deploy (copiar pra VPS), pois substitui o instalador que já está
em produção — o resto (build) é seguro e reversível.

## O que é isto

Um agente Windows (não é o app Android/Fire Stick — ver `tv-app-android/` e a skill
`/atualizar-app-tv` pra esse) pra quem usa um **PC/notebook Windows ligado numa TV via
HDMI**. O agente roda em segundo plano desde o logon do Windows, detecta quando o HDMI é
conectado (via API nativa `QueryDisplayConfig`, não apenas "segunda tela genérica") e abre
o Painel de Pedidos (`https://boxsys.com.br/:slug/display`) no Microsoft Edge em modo
kiosk, posicionado exatamente na tela da TV. Ao desconectar o HDMI, fecha sozinho.

Projeto fonte: `tv-windows-agent/` (não confundir com `tv-app-android/`, que é outro
produto, pro Android TV/Fire Stick).

## 1. Onde mexer

- `tv-windows-agent/monitor-tv.ps1` — o script que roda em loop, detecta HDMI e
  abre/fecha o Edge. É a lógica de verdade.
- `tv-windows-agent/instalar.ps1` — o instalador (pergunta o slug, grava
  `C:\BoxSys\PainelTV\config.json`, registra a Tarefa Agendada). Contém o placeholder
  `__MONITOR_SCRIPT_CONTENT__` que o build injeta com o conteúdo de `monitor-tv.ps1` —
  **nunca** editar esse texto do placeholder de forma que ele apareça duas vezes no
  arquivo (nem em comentário), senão o `.Replace()` do build duplica o conteúdo errado.
- `tv-windows-agent/desinstalar.ps1` — remove a Tarefa Agendada e os arquivos.
- `tv-windows-agent/build.ps1` — mescla os dois scripts acima e compila em `.exe` via
  PS2EXE.

## 2. Codificação — cuidado com acentos

Os arquivos `.ps1` deste projeto usam `—` e acentos (á, ã, ç). O **Windows PowerShell 5.1**
(não o PowerShell Core) lê `.ps1` sem BOM assumindo o codepage ANSI local, corrompendo
esses caracteres e quebrando o parse (erros bizarros tipo "token inesperado" numa linha
que "parece" normal). Depois de editar qualquer `.ps1` deste projeto, sempre regravar como
UTF-8 **com BOM**:

```powershell
$f = "tv-windows-agent\NOME_DO_ARQUIVO.ps1"
$content = Get-Content -Path $f -Raw -Encoding UTF8
$utf8Bom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($f, $content, $utf8Bom)
```

E validar a sintaxe antes de compilar:

```powershell
$errors = $null; $tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Host "ERROR: $($_.Message) at line $($_.Extent.StartLineNumber)" } } else { Write-Host "OK" }
```

## 3. Build do instalador

Requer o módulo `ps2exe` (`Install-Module -Name ps2exe -Scope CurrentUser -Force` na
primeira vez — só precisa uma vez por máquina de build).

```powershell
cd tv-windows-agent
.\build.ps1
```

Gera `tv-windows-agent\dist\BoxSys-PainelTV-Windows-Setup.exe`. O script já valida a
sintaxe do arquivo mesclado antes/depois — se aparecer erro de parse no mesclado mas não
nos arquivos individuais, é quase certo que é o bug do placeholder duplicado (ver seção 1).

## 4. Publicar o novo instalador

```powershell
cp "tv-windows-agent\dist\BoxSys-PainelTV-Windows-Setup.exe" "public\downloads\BoxSys-PainelTV-Windows-Setup.exe"
```

Depois, no deploy pra VPS, copiar esse arquivo também via scp, já que
`public/downloads/*.exe` está no `.gitignore` e não vai pelo git push normal:

```bash
scp -i ~/.ssh/id_ed25519_vps -o BatchMode=yes \
  "public/downloads/BoxSys-PainelTV-Windows-Setup.exe" \
  root@72.62.8.195:/var/www/develoi-cardapio/dist/downloads/BoxSys-PainelTV-Windows-Setup.exe
```

Confirmar que subiu certo:
```bash
curl -s -o /dev/null -w "%{http_code} %{size_download} bytes\n" https://boxsys.com.br/tv-windows
```

## 5. Avisar quem já tem o agente instalado

O agente **não se autoatualiza**. Quem já instalou continua funcionando normalmente com a
versão antiga (a lógica de detecção HDMI/kiosk não muda sozinha). Só peça pra reinstalar
(baixar de novo `boxsys.com.br/tv-windows` e rodar) se a mudança foi no `monitor-tv.ps1`
(ex: corrigir a detecção de HDMI, mudar o comportamento do kiosk) — rodar o instalador de
novo sobrescreve `C:\BoxSys\PainelTV\monitor-tv.ps1` e recria a Tarefa Agendada, sem perder
a configuração de slug já salva (o instalador detecta e sugere o slug atual como padrão).

## Contexto

- A URL real do Painel de Pedidos é `https://boxsys.com.br/{slug}/display` (rota
  `/:slug/display` em `src/App.tsx` → `PublicDashboardPage.tsx`). O instalador monta essa
  URL a partir do slug digitado pelo usuário.
- Detecção de HDMI via `QueryDisplayConfig`/`DISPLAYCONFIG_PATH_INFO` (Win32), não apenas
  ".NET Screen.AllScreens é secundária" — isso evita abrir o painel se alguém conectar um
  segundo monitor comum (DisplayPort/USB-C) sem ser a TV.
  `DISPLAYCONFIG_OUTPUT_TECHNOLOGY_HDMI = 0x3`.
  Precisa rodar como usuário com sessão interativa (a Tarefa Agendada usa
  `LogonType Interactive`, não `ServiceAccount`) — sem isso, `Screen.AllScreens` e o
  `Start-Process` do Edge não têm acesso à sessão gráfica.
- Perfil do Edge isolado (`--user-data-dir` com pasta própria em `%LOCALAPPDATA%`) — pra
  identificar e fechar só a janela do painel, sem afetar outras janelas do Edge que o
  usuário possa ter aberto normalmente na mesma máquina.
- Fechar manualmente a qualquer momento: `Alt+F4` na janela do painel (o `--kiosk` do Edge
  não bloqueia isso). Reabre sozinho no próximo ciclo (2s) se o HDMI continuar conectado —
  pra parar de vez, desinstalar (`desinstalar.ps1`) ou desconectar o HDMI.
