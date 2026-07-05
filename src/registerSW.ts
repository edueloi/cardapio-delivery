import { registerSW } from "virtual:pwa-register";

// Checa por uma versão nova do app periodicamente e recarrega automaticamente quando
// encontra uma — sem isso, o Service Worker antigo pode continuar servindo JS/CSS
// desatualizados por dias, mesmo depois de logout/login ou reload manual da página.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update();
    }, 60 * 1000);
  },
  onNeedRefresh() {
    updateSW(true);
  },
});
