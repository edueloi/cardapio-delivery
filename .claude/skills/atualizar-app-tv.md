# /atualizar-app-tv — Gerar e publicar nova versão do Painel TV (Android TV / Fire Stick)

Quando o usuário invocar `/atualizar-app-tv`, execute os passos abaixo. Confirme com o
usuário antes do passo de deploy (copiar pra VPS), pois substitui o APK que já está em
produção — o resto (build) é seguro e reversível.

## 1. Subir a versão (se houve mudança de código nativo)

Editar `tv-app-android/android/app/build.gradle`:
- `versionCode` — incrementar em +1 a cada release
- `versionName` — ex: "1.0" → "1.1"

Se a mudança foi só na página web (`src/pages/TvAppPage.tsx`), **não precisa gerar novo
APK** — o app carrega direto do servidor (`server.url` no `capacitor.config.ts` aponta pra
`https://boxsys.com.br/tv-app`), então o deploy normal do site já é suficiente. Só gere um
APK novo se mexeu em algo nativo (Manifest, MainActivity, BootReceiver, ícone, etc).

## 2. Build do APK release assinado

```powershell
cd tv-app-android\android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\gradlew.bat assembleRelease
```

O APK sai em `tv-app-android\android\app\build\outputs\apk\release\app-release.apk`.

Se der erro `JAVA_HOME is set to an invalid directory`, o JDK 21 pode ter sido movido —
procurar outro em `C:\Program Files\Java\` ou `C:\Program Files\Android\Android
Studio\jbr`.

Se der erro `Keystore file ... not found`, conferir se `tv-app-android\android\keystore.properties`
existe (é local, nunca vai pro git — ver seção "Credenciais" abaixo).

## 3. Publicar o novo APK

```powershell
cp "tv-app-android\android\app\build\outputs\apk\release\app-release.apk" "public\downloads\BoxSys-PainelTV.apk"
```

Depois, no deploy pra VPS (ver skill/fluxo de deploy do projeto), copiar esse arquivo
também via scp, já que `public/downloads/*.apk` está no `.gitignore` e não vai pelo git
push normal:

```bash
scp -i ~/.ssh/id_ed25519_vps -o BatchMode=yes \
  "public/downloads/BoxSys-PainelTV.apk" \
  root@72.62.8.195:/var/www/develoi-cardapio/dist/downloads/BoxSys-PainelTV.apk
```

Confirmar que subiu certo:
```bash
curl -s -o /dev/null -w "%{http_code} %{size_download} bytes\n" https://boxsys.com.br/downloads/BoxSys-PainelTV.apk
```

## 4. Avisar quem já tem o app instalado

O app **não se autoatualiza** (não há checagem de versão embutida). Quem já tem uma TV
pareada continua funcionando normalmente mesmo sem atualizar (a lógica de pareamento e o
Painel de Pedidos em si vêm do servidor, sempre atualizados). Só reinstale o APK numa TV
específica se a mudança foi nativa (ex: corrigir o auto-boot, mudar o tema) — nesse caso,
repita a instalação via Downloader com a mesma URL, o Android substitui o app existente
mantendo os dados (o `deviceToken` fica salvo no `localStorage` do WebView e sobrevive à
reinstalação, contanto que a assinatura da keystore seja a mesma).

## Credenciais da keystore (não versionadas — cuidado ao manusear)

- **Arquivo**: `tv-app-android/painel-tv-release.jks` (não está no git)
- **Config usada pelo Gradle**: `tv-app-android/android/keystore.properties` (não está no
  git, contém as senhas em texto — é o arquivo que o `build.gradle` lê via
  `signingConfigs.release`)
- **Alias**: `painel-tv-boxsys`
- **Validade**: ~27 anos (gerada em 2026-07-12)

**Se perder o arquivo `.jks` ou o `keystore.properties`**: não tem como recuperar a senha
nem gerar outra keystore com a mesma assinatura. Qualquer APK novo seria tratado pelo
Android como um app *diferente* do já instalado nas TVs — quem já tem o app instalado
precisaria desinstalar o antigo e instalar o novo do zero (perde o pareamento, precisa
gerar novo código e vincular de novo em Configurações → TVs). Por isso:
- Faça backup do arquivo `.jks` e do `keystore.properties` num local seguro fora do
  computador (gerenciador de senhas, storage próprio) — eles NUNCA vão para o
  GitHub por design (estão no `.gitignore` do projeto).
- Não recrie a keystore "só pra testar" — cada `keytool -genkeypair` gera uma
  assinatura nova e incompatível com a anterior.

## Contexto

- Projeto Capacitor separado do app de cozinha, em `tv-app-android/` (não confundir com
  `android/` na raiz, que é o app de cozinha `br.com.boxsys.cozinha`).
- `appId` do app de TV: `br.com.boxsys.paineltv`
- O app é só uma casca WebView — toda a lógica de pareamento/UI vive em
  `src/pages/TvAppPage.tsx` e nas rotas `/api/tv/*` do `server.ts`, então a grande maioria
  das mudanças não exige rebuild do APK, só deploy normal do site.
