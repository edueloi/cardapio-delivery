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

// Cada tela chama socket.emit("join-tenant", tenantId) uma vez, ao carregar. Mas toda
// reconexão (queda de rede, servidor reiniciado, socket "zumbi" no PDV desktop em modo
// kiosk que nunca perde foco/visibilidade — o listener acima nunca dispara ali) gera um
// socket.id novo no servidor, que sai de todas as rooms. Sem reentrar na room do tenant,
// a aba fica "conectada" mas surda: nenhum evento (new-order, order-created, etc.) chega
// mais até um F5 manual. Guardamos os tenantIds já pedidos e reemitimos "join-tenant" em
// todo "connect" (o socket.io dispara "connect" tanto na conexão inicial quanto em cada
// reconexão bem-sucedida), então isso cobre as duas coisas sem duplicar o join inicial.
const joinedTenantIds = new Set<string>();
const originalEmit = socket.emit.bind(socket);
(socket as any).emit = (event: string, ...args: any[]) => {
  if (event === "join-tenant" && typeof args[0] === "string") {
    joinedTenantIds.add(args[0]);
  }
  return originalEmit(event, ...args);
};
socket.on("connect", () => {
  for (const tenantId of joinedTenantIds) {
    originalEmit("join-tenant", tenantId);
  }
});

export default socket;
