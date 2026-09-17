import type { Server } from "socket.io";

/** Eventos de tempo real do cardápio, mesas, cozinha e painel. */
export function registerSocketEvents(io: Server) {
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-tenant", (tenantId) => {
      socket.join(`tenant-${tenantId}`);
      console.log(`Socket ${socket.id} joined tenant room: ${tenantId}`);
    });

    socket.on("join-table", (tableRoom) => {
      socket.join(tableRoom);
      console.log(`Socket ${socket.id} joined table room: ${tableRoom}`);
    });

    socket.on("request-checkout", ({ tenantId, tableId, customerName }) => {
      console.log(`Table ${tableId} of tenant ${tenantId} requested checkout`);
      io.to(`tenant-${tenantId}`).emit("checkout-requested", { tableId, customerName });
    });

    socket.on("request-waiter", ({ tenantId, tableId, customerName, note, requestBill }) => {
      console.log(`Table ${tableId} called waiter (bill=${requestBill})`);
      io.to(`tenant-${tenantId}`).emit("waiter-called", { tableId, customerName, note, requestBill });
    });

    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });
}
