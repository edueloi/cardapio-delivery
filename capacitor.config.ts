import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.boxsys.cozinha',
  appName: 'Cozinha BoxSys',
  // Pasta mínima (não o dist/ do site inteiro) — o app carrega tudo do servidor real via
  // "server.url" abaixo, então empacotar o dist/ só infla o APK à toa (ex: os instaladores
  // .exe do PDV desktop que moram em public/downloads/ acabavam indo junto, +160MB).
  webDir: 'android-webdir',
  // Carrega direto do servidor real em vez de empacotar os assets — assim o app
  // sempre reflete a última versão do painel de cozinha, sem precisar gerar um
  // novo APK a cada deploy. A rota "/" nesse domínio já cai na tela de login.
  server: {
    url: 'https://cozinha.boxsys.com.br',
    cleartext: false,
  },
  android: {
    backgroundColor: '#0D1B3E',
  },
};

export default config;
