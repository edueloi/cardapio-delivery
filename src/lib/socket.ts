import { io } from "socket.io-client";

const socket = io(); // Connects to the same host that serves the page

// Celular/tablet suspende a conexão WebSocket quando a tela apaga ou o app vai
// pra segundo plano (economia de bateria do navegador). Ao voltar, o socket pode
// ficar "zumbi" — parece conectado mas não recebe mais eventos — até o próximo
// reconnect automático, que pode demorar. Isso fazia telas como o painel de
// cozinha perderem pedidos em tempo real até alguém dar refresh manual.
// Forçar reconexão sempre que a aba volta a ficar visível/ativa cobre esse caso
// para qualquer tela do app que use este socket compartilhado.
if (typeof document !== "undefined") {
  const reconnectIfNeeded = () => {
    if (document.visibilityState === "visible" && !socket.connected) {
      socket.connect();
    }
  };
  document.addEventListener("visibilitychange", reconnectIfNeeded);
  window.addEventListener("focus", reconnectIfNeeded);
  window.addEventListener("online", reconnectIfNeeded);
}

export default socket;
