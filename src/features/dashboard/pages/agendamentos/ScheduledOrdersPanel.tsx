import React, { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { EmptyState, PageWrapper, SectionTitle } from "../../../../components";
import { Order } from "../../../../types";
import { OrdersList } from "../pedidos";

export function ScheduledOrdersPanel({
  orders,
  updateStatus,
  slug,
}: {
  orders: Order[];
  updateStatus: any;
  slug: string;
}) {
  const scheduled = useMemo(() => {
    return orders
      .filter((o) => o.scheduledDate && o.status !== "CANCELLED")
      .sort((a, b) => {
        const da = new Date(a.scheduledDate!).getTime();
        const db = new Date(b.scheduledDate!).getTime();
        return da - db;
      });
  }, [orders]);

  // Group by scheduledDate
  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of scheduled) {
      const key = o.scheduledDate!.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()];
  }, [scheduled]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    if (isToday) return "Hoje";
    if (isTomorrow) return "Amanhã";
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  };

  if (grouped.length === 0) {
    return (
      <PageWrapper>
        <SectionTitle title="Agendamentos" description="Pedidos sob encomenda com data marcada" icon={CalendarClock} className="mb-6" />
        <EmptyState
          title="Nenhum agendamento"
          description="Quando o Modo Encomenda estiver ativo e clientes fizerem pedidos com data, eles aparecerão aqui."
          icon={CalendarClock}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SectionTitle title="Agendamentos" description="Pedidos sob encomenda agrupados por data" icon={CalendarClock} className="mb-6" />
      <div className="space-y-8">
        {grouped.map(([date, dayOrders]) => {
          const d = new Date(date + "T12:00:00");
          const isPast = d < new Date(new Date().toDateString());
          return (
            <div key={date}>
              {/* Date header */}
              <div className={`flex items-center gap-3 mb-3 px-1`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPast ? "bg-slate-100" : "bg-amber-50"}`}>
                  <CalendarClock className={`w-5 h-5 ${isPast ? "text-slate-400" : "text-amber-500"}`} />
                </div>
                <div>
                  <p className={`text-sm font-black capitalize ${isPast ? "text-slate-400" : "text-slate-800"}`}>{fmtDate(date)}</p>
                  <p className="text-[10px] font-bold text-slate-400">{dayOrders.length} pedido{dayOrders.length !== 1 ? "s" : ""}</p>
                </div>
                {isPast && <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-100 px-2.5 py-1 rounded-full">Passado</span>}
              </div>
              <OrdersList filteredOrders={dayOrders} updateStatus={updateStatus} slug={slug} />
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}

