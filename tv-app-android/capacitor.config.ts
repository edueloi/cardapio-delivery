import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.boxsys.paineltv',
  appName: 'Painel TV BoxSys',
  // Mesmo padrão do app de cozinha: carrega direto do servidor real em vez de
  // empacotar os assets, assim reflete sempre a última versão sem gerar um novo
  // APK a cada deploy. "/tv-app" é a tela de boot/pareamento (src/pages/TvAppPage.tsx),
  // que redireciona pro Painel de Pedidos (/:slug/display) assim que vinculado.
  webDir: 'android-webdir',
  server: {
    url: 'https://boxsys.com.br/tv-app',
    cleartext: false,
  },
  android: {
    backgroundColor: '#000000',
  },
};

export default config;
