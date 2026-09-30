import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // TEMPORÁRIO — não remover sem antes ler o comentário abaixo.
        //
        // Depois da separação de boxsys.com.br (antes servia o app inteiro; agora é a
        // landing estática + proxy condicional só pras rotas do cardápio/PDV), alguns
        // celulares com o Service Worker ANTIGO ainda registrado ficaram presos: o SW
        // antigo intercepta a navegação e serve, do cache dele, um index.html/JS de
        // antes da mudança — sem nunca buscar a versão nova de verdade. Sintoma: QR
        // Code do cardápio de balcão ("boxsys.com.br/:slug/balcao") caindo na landing
        // em vez do cardápio, só nesses aparelhos (outros celulares/PC funcionavam OK).
        //
        // selfDestroying: true é o mecanismo oficial do vite-plugin-pwa pra esse caso:
        // gera um SW especial que qualquer SW antigo, ao checar update sozinho (o
        // navegador faz isso periodicamente por conta própria), instala — e esse SW
        // especial se desregistra, apaga TODOS os caches do Service Worker e força
        // reload, sem precisar o cliente fazer nada manualmente. Efeito colateral:
        // desliga o PWA pra TODO MUNDO enquanto isso (some o ícone de "instalado na
        // tela inicial", sem cache offline) — não é cirúrgico, é limpeza geral.
        //
        // REVERTER: depois de alguns dias (tempo pra garantir que os celulares com bug
        // já passaram por essa limpeza), remover a linha `selfDestroying: true` abaixo
        // e fazer deploy de novo — o PWA volta ao normal sozinho. Não mexer em mais
        // nada aqui enquanto isso (nome do SW, manifest, workbox) — ver doc oficial:
        // https://vite-pwa-org.netlify.app/guide/unregister-service-worker
        selfDestroying: true,
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['images/app_celular.png', 'favicon.ico'],
        manifest: {
          name: 'Menu BoxSys PDV',
          short_name: 'Menu BoxSys',
          description: 'Cardápio digital e PDV Box Sys',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/painel',
          scope: '/',
          icons: [
            {
              src: '/images/app_celular.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/images/app_celular.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globIgnores: ['**/images/*.png'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: '/index.html',
          // Rotas de download direto de arquivo (APK, instalador .exe, uploads) precisam
          // sair do controle do Service Worker — sem isso, navegar pra essas URLs no
          // navegador (não via fetch/curl) é interceptado por navigateFallback e serve o
          // index.html do SPA em vez de deixar o download acontecer de verdade.
          navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/, /^\/tv$/, /^\/tv-windows$/, /^\/downloads/, /^\/uploads/],
          // O SW novo assume controle imediatamente (sem esperar todas as abas antigas
          // fecharem) — evita usuários ficarem travados em uma versão desatualizada.
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
