import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Plus, Minus, X, Send, Loader2,
  ChevronRight, Utensils, Phone, User,
  Search, Smartphone,
  ChevronLeft,
  ShoppingBag,
  Cake,
  Ticket,
  RotateCcw,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, ProductVariant, Order } from "../../types";
import SelectionGroupPicker, { parseSelectionGroup, getSelectionGroupOptions, formatSelectionGroupNote } from "./SelectionGroupPicker";
import { COUNTER_ORDER_TABLE_ID } from "../../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Tradução de status para o cliente que está acompanhando a senha do balcão.
// `billed` é quem diz se o pagamento já foi confirmado pelo operador no caixa —
// o pedido pode estar em PENDING/PREPARING sem ainda ter sido pago (ex: cliente
// escolheu pagar no balcão, ou o operador ainda não bateu o pagamento no PDV).
function getStatusLabel(status: string, billed: boolean) {
  if (status === "AWAITING_PAYMENT") return "Aguardando Pagamento";
  if (["PENDING", "PREPARING"].includes(status)) {
    return billed ? "Pedido pago — na fila de preparo" : "Pedido recebido — aguardando confirmação do pagamento";
  }
  if (status === "SHIPPED") return "Pronto! Pode retirar no balcão";
  if (status === "DELIVERED") return "Pedido entregue";
  if (status === "MERGED") return "Pedido concluído no caixa";
  if (status === "CANCELLED") return "Pedido cancelado";
  return status;
}

// Mensagem de instrução dinâmica
function getInstructionText(status: string, billed: boolean) {
  if (status === "AWAITING_PAYMENT") {
    return "Pague no caixa e acompanhe pela tela — chamaremos sua senha quando estiver pronto.";
  }
  if (["PENDING", "PREPARING"].includes(status)) {
    return billed
      ? "Pagamento confirmado! Seu pedido já está na fila de preparo. Fique atento à sua senha."
      : "Recebemos seu pedido. Dirija-se ao caixa para confirmar o pagamento — assim que confirmado, entra na fila de preparo.";
  }
  if (status === "SHIPPED") {
    return "Seu pedido está pronto! Dirija-se ao balcão para retirar.";
  }
  return "";
}

export default function CounterMenuView() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  // "checkin" = formulário inicial | "menu" = cardápio/carrinho | "ticket" = senha exibida após pedido
  const [step, setStep] = useState<"checkin" | "menu" | "ticket">("checkin");
  // Dentro do checkin: primeiro só o telefone. Se o cliente já existir, pula
  // direto pro cardápio sem pedir mais nada; se não existir, pede nome+aniversário
  // pra completar o cadastro antes de liberar o cardápio.
  const [checkinPhase, setCheckinPhase] = useState<"phone" | "details">("phone");
  const [customer, setCustomer] = useState({ name: "", phone: "", birthday: "" });
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerFound, setCustomerFound] = useState(false);
  const [cart, setCart] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<{ id: string, label: string, price: number }[]>([]);
  // Itens escolhidos do grupo de seleção embutido (ex: os 2 sabores de "2 espetos
  // tradicionais") — preço fixo do produto, a escolha aqui só define quais sabores
  // aparecem na observação do pedido, nunca soma valor.
  const [selectedGroupItemIds, setSelectedGroupItemIds] = useState<string[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  // Lista (não um único pedido) — o cliente pode ter mais de uma senha em aberto ao
  // mesmo tempo (ex: fez um pedido, saiu/atualizou a página, voltou e pediu de novo sem
  // a primeira senha ter ficado pronta ainda). Cada uma fica visível até ser retirada.
  const [ticketOrders, setTicketOrders] = useState<Order[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  const counterStorageKey = `counter_order_${slug}`;
  const cartStorageKey = `counter_cart_${slug}`;

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (tenant?.categories && tenant.categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(tenant.categories[0].id);
    }
  }, [tenant, selectedCategoryId]);

  useEffect(() => {
    fetch(`/api/tenants/${slug}`)
      .then(r => r.json())
      .then(data => {
        setTenant(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/tenants/${slug}/promotions`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setPromotions(data))
      .catch(() => {});

    const savedCart = localStorage.getItem(cartStorageKey);
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error("Failed to parse saved cart"); }
    }

    // Se já existem senhas de balcão salvas, retoma a tela de acompanhamento em vez do
    // check-in. Formato é uma lista — mas usuários que já tinham uma senha salva antes
    // dessa mudança guardaram um objeto único `{orderId}`, não um array; o fallback abaixo
    // cobre os dois formatos pra não perder a senha de quem já estava com um pedido em aberto.
    const savedTickets = localStorage.getItem(counterStorageKey);
    if (savedTickets) {
      try {
        const parsed = JSON.parse(savedTickets);
        const list: { orderId: string }[] = Array.isArray(parsed) ? parsed : [parsed];
        const orderIds = list.map((t) => t.orderId).filter(Boolean);
        if (orderIds.length > 0) {
          fetchTicketOrders(orderIds);
        }
      } catch (e) {
        console.error("Failed to parse saved counter orders");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Persist cart to localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } else {
      localStorage.removeItem(cartStorageKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, slug]);

  // Produto tem grupo de seleção embutido (ex: "2 espetos tradicionais") e ainda não
  // foi escolhido — abre o picker passo a passo automaticamente ao abrir o produto.
  useEffect(() => {
    const sg = parseSelectionGroup(selectedProduct);
    if (sg && selectedGroupItemIds.length !== sg.qty) {
      setShowGroupPicker(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

  // Busca cliente pelo telefone (rota pública, sem autenticação). Se existir, pula
  // direto pro cardápio; se não existir, pede nome+aniversário pra completar o cadastro.
  useEffect(() => {
    const digits = customer.phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    let cancelled = false;
    setCustomerLookupLoading(true);
    fetch(`/api/tenants/${slug}/public-customer/${digits}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data?.name) {
          setCustomer(c => ({ ...c, name: data.name }));
          setCustomerFound(true);
          setStep("menu");
        } else {
          setCustomerFound(false);
          setCheckinPhase("details");
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCustomerLookupLoading(false); });
    return () => { cancelled = true; };
  }, [customer.phone, slug]);

  useEffect(() => {
    if (!tenant) return;

    // Balcão não tem mesa/sala própria — só entra na sala geral do tenant.
    socket.emit("join-tenant", tenant.id);

    const handleOrderStatusUpdated = (updatedOrder: Order) => {
      setTicketOrders(prev => {
        if (!prev.some(o => o.id === updatedOrder.id)) return prev;
        // Pedido retirado/cancelado sai da lista — o cliente não precisa mais acompanhá-lo.
        if (["DELIVERED", "CANCELLED", "MERGED"].includes(updatedOrder.status)) {
          const remaining = prev.filter(o => o.id !== updatedOrder.id);
          removeStoredTicket(updatedOrder.id);
          return remaining;
        }
        return prev.map(o => (o.id === updatedOrder.id ? updatedOrder : o));
      });
    };
    socket.on("order-status-updated", handleOrderStatusUpdated);

    return () => {
      socket.off("order-status-updated", handleOrderStatusUpdated);
    };
  }, [tenant]);

  // Lê a lista de tickets salvos no formato atual (array); tolera o formato antigo
  // (objeto único) de quem já tinha uma senha salva antes desta mudança.
  const readStoredTickets = (): { orderId: string; counterTicketNumber?: number }[] => {
    const raw = localStorage.getItem(counterStorageKey);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  };

  const addStoredTicket = (orderId: string, counterTicketNumber?: number) => {
    const list = readStoredTickets();
    localStorage.setItem(counterStorageKey, JSON.stringify([...list, { orderId, counterTicketNumber }]));
  };

  const removeStoredTicket = (orderId: string) => {
    const list = readStoredTickets().filter((t) => t.orderId !== orderId);
    if (list.length > 0) {
      localStorage.setItem(counterStorageKey, JSON.stringify(list));
    } else {
      localStorage.removeItem(counterStorageKey);
    }
  };

  // Busca o status atual de cada senha salva. Pedidos já finalizados (retirados/
  // cancelados) saem da lista e do storage; os demais aparecem na tela de acompanhamento,
  // uma senha por card, até cada um ficar pronto.
  const fetchTicketOrders = async (orderIds: string[]) => {
    const results = await Promise.all(
      orderIds.map((orderId) =>
        fetch(`/api/orders/counter/${slug}/${orderId}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    const active: Order[] = [];
    for (let i = 0; i < results.length; i++) {
      const order = results[i];
      const orderId = orderIds[i];
      if (!order || ["DELIVERED", "CANCELLED", "MERGED"].includes(order.status)) {
        removeStoredTicket(orderId);
      } else {
        active.push(order);
      }
    }
    if (active.length > 0) {
      setTicketOrders(active);
      setStep("ticket");
    } else {
      setTicketOrders([]);
      setStep("checkin");
    }
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  useEffect(() => {
    if (promotions.length <= 1) return;
    const t = setInterval(() => setPromoIndex(i => (i + 1) % promotions.length), 5000);
    return () => clearInterval(t);
  }, [promotions.length]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomer({ ...customer, phone: formatPhone(e.target.value) });
  };

  const handleCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = customer.phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    // Fase telefone: a busca já roda no useEffect acima; se ainda estiver
    // carregando ou o telefone acabou de mudar, só espera — o próprio efeito
    // decide se pula pro cardápio (cliente existente) ou libera os campos de
    // nome/aniversário (cliente novo). Se já estamos na fase de detalhes,
    // confirma o cadastro e libera o cardápio.
    if (checkinPhase === "details" && customer.name) {
      setStep("menu");
    }
  };

  const openPromotionProduct = (promo: any) => {
    if (!promo.product) return;
    const found = tenant?.categories?.flatMap(c => c.products).find(p => p.id === promo.product.id);
    if (found) {
      setSelectedProduct(found);
      setSelectedVariant(found.variants && found.variants.length > 0 ? found.variants[0] : null);
      setSelectedExtras([]);
      setSelectedGroupItemIds([]);
      setQty(1);
      setNotes("");
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedProduct(null);
    const container = scrollContainerRef.current;
    const el = document.getElementById(`cat-${catId}`);
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = elRect.top + container.scrollTop - containerRect.top - 10;
      container.scrollTo({
        top,
        behavior: "smooth"
      });
    }
  };

  const handleOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    const orderData = {
      customerName: customer.name,
      customerPhone: customer.phone.replace(/\D/g, ""),
      tenantId: tenant?.id,
      tenantSlug: slug,
      orderType: "DINE_IN",
      tableId: COUNTER_ORDER_TABLE_ID,
      paymentMethod: "CASH",
      birthday: customer.birthday || undefined,
      items: cart.map(item => ({
        productId: item.productId,
        productVariantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes
      })),
      total
    };
    console.log("Sending Counter Order Payload:", orderData);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const created = await res.json();
        setCart([]);
        localStorage.removeItem(cartStorageKey);
        // Adiciona à lista em vez de sobrescrever — se já havia uma senha em aberto (ex:
        // cliente fez "novo pedido" sem a anterior ter ficado pronta), as duas continuam
        // visíveis até cada uma ser retirada.
        addStoredTicket(created.id, created.counterTicketNumber);
        setTicketOrders(prev => [...prev, created]);
        setStep("ticket");
      } else {
        showToast("Não foi possível enviar o pedido.");
      }
    } catch (e) {
      showToast("Não foi possível enviar o pedido.");
    } finally {
      setIsOrdering(false);
    }
  };

  const handleNewOrder = () => {
    // Mantém nome/telefone preenchidos — é a mesma pessoa no mesmo tablet/balcão,
    // já identificada, então pula direto pro cardápio sem passar pelo checkin de novo.
    // As senhas já em aberto NÃO são apagadas aqui — o cliente pode estar pedindo de novo
    // justamente porque a senha anterior ainda não ficou pronta, e precisa continuar
    // vendo as duas até cada uma ser retirada.
    localStorage.removeItem(cartStorageKey);
    setCart([]);
    setStep(customer.phone ? "menu" : "checkin");
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;
  if (!tenant) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-serif">Restaurante não encontrado</div>;

  return (
    <div className="h-screen overflow-hidden bg-[#0b0f14] text-[#f5f5f5] selection:bg-[#C9A227]/30 font-sans relative flex flex-col lg:flex-row">

      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none lg:absolute">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-[#0a0a0a]" />
        <img
          src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=2070"
          className="w-full h-full object-cover opacity-20 blur-sm scale-105"
        />
      </div>

      {/* ── CHECK-IN STEP ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {step === "checkin" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md"
          >
            <div className="w-full max-w-sm space-y-12 text-center relative z-10">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto w-24 h-24 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center ring-2 ring-white/10"
              >
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} className="w-full h-full object-cover" alt={tenant.name} />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-2xl font-black text-black"
                    style={{ background: "linear-gradient(135deg, #C9A227, #a37d1a)" }}
                  >
                    {tenant.name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                  </div>
                )}
              </motion.div>

              <div className="space-y-2">
                <h1 className="text-3xl font-serif text-white tracking-wide">Bem-vindo ao {tenant.name}</h1>
              </div>

              <form onSubmit={handleCheckin} className="space-y-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    required
                    autoFocus
                    value={customer.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-10 text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none transition-all"
                  />
                  {customerLookupLoading && (
                    <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500/60 animate-spin" />
                  )}
                </div>
                {checkinPhase === "details" && !customerFound && (
                  <>
                    <p className="text-xs text-white/40 -mt-1">Não te encontramos — como podemos te chamar?</p>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input
                        required
                        autoFocus
                        value={customer.name}
                        onChange={e => setCustomer({...customer, name: e.target.value})}
                        placeholder="Seu Nome"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Cake className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input
                        value={customer.birthday}
                        onChange={e => setCustomer({...customer, birthday: e.target.value})}
                        placeholder="Aniversário (opcional)"
                        type="date"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none transition-all [color-scheme:dark]"
                      />
                    </div>
                  </>
                )}
                <button
                  disabled={customerLookupLoading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/30 active:scale-95 uppercase tracking-widest text-xs"
                >
                  {checkinPhase === "details" && !customerFound ? "Confirmar e Ver Cardápio" : "Continuar"}
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TICKET STEP (senha(s) do balcão) ────────────────────────────── */}
      <AnimatePresence>
        {step === "ticket" && ticketOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md overflow-y-auto"
          >
            <div className="w-full max-w-sm space-y-8 text-center relative z-10 py-8">
              <div className="space-y-2">
                <p className="text-amber-500/60 text-xs font-black tracking-widest uppercase">{tenant.name}</p>
                <h1 className="text-xl font-serif text-white tracking-wide">
                  {ticketOrders.length > 1 ? "Suas senhas" : "Sua senha é"}
                </h1>
              </div>

              {/* Mais de uma senha em aberto — ex: cliente pediu de novo antes da anterior
                  ficar pronta. Cada card mostra status independente até ser retirado. */}
              <div className="space-y-6">
                {ticketOrders.map((order) => (
                  <div key={order.id} className="space-y-5">
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`mx-auto flex flex-col items-center justify-center gap-1 shadow-2xl shadow-amber-500/10 rounded-[2.5rem] border-2 border-amber-500/30 bg-amber-500/5 ${
                        ticketOrders.length > 1 ? "w-40 h-40" : "w-56 h-56"
                      }`}
                    >
                      <span className="text-[10px] font-black text-amber-500/60 uppercase tracking-[0.3em]">Nº</span>
                      <span className={`font-black text-amber-400 tracking-tighter tabular-nums ${ticketOrders.length > 1 ? "text-5xl" : "text-7xl"}`}>
                        {order.counterTicketNumber ?? "—"}
                      </span>
                    </motion.div>

                    <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-full mx-auto w-fit ${
                      ["SHIPPED", "DELIVERED", "MERGED"].includes(order.status) ? "bg-green-500/10 border border-green-500/20" :
                      order.status === "CANCELLED" ? "bg-red-500/10 border border-red-500/20" :
                      "bg-white/5 border border-white/10"
                    }`}>
                      <motion.span
                        animate={order.status === "PENDING" || order.status === "PREPARING" ? { scale: [1, 1.4, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                        className={`w-1.5 h-1.5 rounded-full ${
                          ["SHIPPED", "DELIVERED", "MERGED"].includes(order.status) ? "bg-green-400" :
                          order.status === "CANCELLED" ? "bg-red-400" : "bg-amber-400"
                        }`}
                      />
                      <span className={`text-xs font-bold ${
                        ["SHIPPED", "DELIVERED", "MERGED"].includes(order.status) ? "text-green-400" :
                        order.status === "CANCELLED" ? "text-red-400" : "text-amber-300"
                      }`}>
                        {getStatusLabel(order.status, order.billed === true)}
                      </span>
                    </div>

                    <p className="text-white/40 text-sm max-w-[280px] mx-auto leading-relaxed">
                      {getInstructionText(order.status, order.billed === true)}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleNewOrder}
                className="mx-auto flex items-center gap-2 text-white/30 hover:text-amber-400 transition-all text-[11px] font-bold uppercase tracking-widest"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Fazer novo pedido
              </button>
            </div>{/* end w-full max-w-sm */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MENU STEP ────────────────────────────────────────────────────── */}
      {step === "menu" && (
        <>
          {/* Sidebar Desktop (Keep Dark) */}
          <aside className="hidden lg:flex w-64 xl:w-72 flex-col bg-[#111827] border-r border-white/[0.06] h-full shrink-0 z-50 relative transition-all">
            <div className="p-6 xl:p-8 flex flex-col h-full">
              {/* Logo */}
              <div className="mb-12">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} className="w-14 h-14 rounded-2xl object-cover shadow-xl ring-2 ring-white/10 mb-3" alt={tenant.name} />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-black shadow-xl mb-3"
                    style={{ background: "linear-gradient(135deg, #C9A227, #a37d1a)" }}
                  >
                    {tenant.name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                  </div>
                )}
                <div className="text-white font-black text-xl leading-tight tracking-tight uppercase line-clamp-2">
                  {tenant.name}
                </div>
                <p className="text-[10px] font-black text-white/20 tracking-[0.3em] mt-2 uppercase">Balcão</p>
              </div>

              {/* Categories */}
              <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
                {tenant.categories?.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setSelectedProduct(null);
                    }}
                    className={`w-full flex items-center justify-between p-3 xl:p-4 rounded-xl transition-all group ${
                      selectedCategoryId === cat.id && !selectedProduct
                      ? 'bg-white/5 text-amber-500'
                      : 'text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={`text-[9px] xl:text-[10px] font-black uppercase tracking-widest ${
                      selectedCategoryId === cat.id && !selectedProduct ? 'text-amber-500' : 'text-white'
                    }`}>
                      {cat.name}
                    </span>
                    <ChevronRight className={`w-3 h-3 xl:w-4 xl:h-4 transition-transform ${
                      selectedCategoryId === cat.id && !selectedProduct ? 'translate-x-1 opacity-100' : 'opacity-40 group-hover:opacity-100'
                    }`} />
                  </button>
                ))}
              </nav>

              {/* Footer Sidebar */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 xl:p-4 bg-white/5 rounded-2xl">
                  <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <User className="w-3 h-3 xl:w-4 xl:h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest leading-none mb-1">Cliente</p>
                    <p className="text-[10px] xl:text-xs font-medium text-white truncate">{customer.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0b0f14]">
            {/* Mobile/Tablet Header */}
            <header className="sticky top-0 z-40 lg:hidden shrink-0 bg-[#0b0f14]/95 backdrop-blur-xl border-b border-white/[0.06]">
              {/* Row 1: Logo, Name, Phone request */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-3 min-w-0">
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} className="w-10 h-10 rounded-xl object-cover ring-1 ring-white/15" alt={tenant.name} />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-black"
                      style={{ background: "linear-gradient(135deg, #C9A227, #a37d1a)" }}
                    >
                      {tenant.name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-[9px] font-black text-[#C9A227] uppercase tracking-widest leading-none">Balcão</p>
                    </div>
                    <p className="text-base font-black text-white leading-tight mt-1 truncate">{tenant.name}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowQR(true)}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:text-[#C9A227] active:scale-95 transition-all shrink-0"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>

              {/* Row 2: Full-width Search */}
              <div className="px-4 py-2">
                <div className="w-full bg-white/5 border border-white/10 rounded-2xl flex items-center px-4 py-2.5 gap-2.5 focus-within:border-amber-500/40 transition-all">
                  <Search className="w-4 h-4 text-white/30 shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar no cardápio..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs w-full text-white placeholder:text-white/20"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")}>
                      <X className="w-3.5 h-3.5 text-white/30" />
                    </button>
                  )}
                </div>
              </div>

              {/* Categories Horizontal Scroll */}
              <div className="flex gap-2 px-4 pb-3 pt-1 overflow-x-auto scrollbar-hide">
                {tenant.categories?.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`shrink-0 px-4.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                      selectedCategoryId === cat.id && !selectedProduct
                        ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/15'
                        : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10 border-white/5'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </header>


            {/* Desktop Header (Visible on LG) */}
            <header className="hidden lg:flex sticky top-0 z-40 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-8 py-4 items-center justify-between shrink-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-2">
                  <Ticket className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">BALCÃO</span>
                </div>

                <div className="bg-white/5 border border-white/[0.06] rounded-full px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-white">PT</span>
                </div>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2">
                <div className="relative group">
                  <div className="flex items-center gap-3 bg-white/5 border border-white/[0.06] rounded-full px-5 py-2 focus-within:border-[#C9A227]/50 transition-all">
                    <Search className="w-4 h-4 text-[#C9A227]" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar no cardápio..."
                      className="bg-transparent border-none outline-none text-xs text-white w-40 xl:w-60 placeholder:text-white/20"
                    />
                    {searchTerm && (
                      <button onClick={() => setSearchTerm("")} className="hover:text-white text-white/20">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <button
                  onClick={() => setShowQR(true)}
                  className="flex items-center gap-2 text-white hover:text-amber-500 transition-all group"
                >
                  <Smartphone className="w-5 h-5 group-hover:text-amber-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:block">Pedir pelo Celular</span>
                </button>
              </div>
            </header>

            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto lg:p-12 relative custom-scrollbar pb-32 lg:pb-12 bg-[#0b0f14] lg:min-h-0">

              {/* Promotions Carousel / Fallback Banner — só na primeira categoria ou sem filtro */}
              {promotions.length > 0 && !selectedProduct && (!selectedCategoryId || selectedCategoryId === tenant.categories?.[0]?.id) && (
                <div className="hidden lg:block w-full h-[280px] rounded-[2rem] overflow-hidden relative mb-8 shadow-2xl">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={promoIndex}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.5 }}
                      onClick={() => openPromotionProduct(promotions[promoIndex])}
                      className={`absolute inset-0 ${promotions[promoIndex].product ? 'cursor-pointer' : ''}`}
                    >
                      {promotions[promoIndex].imageUrl ? (
                        <img src={promotions[promoIndex].imageUrl} className="w-full h-full object-cover" alt={promotions[promoIndex].title} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-900/40 to-zinc-900" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end">
                        <div className="space-y-2">
                          <div className="bg-amber-500 text-black px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit">
                            Promoção
                          </div>
                          <h2 className="text-3xl font-serif text-white tracking-tight">{promotions[promoIndex].title}</h2>
                          {promotions[promoIndex].description && (
                            <p className="text-white/60 max-w-md text-sm leading-relaxed line-clamp-1">{promotions[promoIndex].description}</p>
                          )}
                        </div>
                        {promotions[promoIndex].product && (
                          <div className="text-right">
                            <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-1">A partir de</p>
                            <p className="text-3xl font-black text-white tracking-tighter">{fmt(promotions[promoIndex].promoPrice || promotions[promoIndex].product.price)}</p>
                          </div>
                        )}
                      </div>
                      {promotions.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {promotions.map((_: any, i: number) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); setPromoIndex(i); }}
                              className={`w-2 h-2 rounded-full transition-all ${i === promoIndex ? 'bg-amber-500 w-6' : 'bg-white/30'}`}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Mobile Promotions Carousel */}
              {promotions.length > 0 && !selectedProduct && (
                <div className="lg:hidden relative w-full h-52 overflow-hidden mb-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={promoIndex}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.4 }}
                      onClick={() => openPromotionProduct(promotions[promoIndex])}
                      className={`absolute inset-0 ${promotions[promoIndex].product ? 'cursor-pointer' : ''}`}
                    >
                      {promotions[promoIndex].imageUrl ? (
                        <img src={promotions[promoIndex].imageUrl} className="w-full h-full object-cover" alt={promotions[promoIndex].title} />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-amber-900/40 to-zinc-900" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                      <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
                        <div className="space-y-1">
                          <div className="bg-amber-500 text-black px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit">Promoção</div>
                          <h2 className="text-xl font-serif text-white tracking-tight">{promotions[promoIndex].title}</h2>
                        </div>
                        {promotions[promoIndex].product && (
                          <p className="text-2xl font-black text-white">{fmt(promotions[promoIndex].promoPrice || promotions[promoIndex].product.price)}</p>
                        )}
                      </div>
                      {promotions.length > 1 && (
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          {promotions.map((_: any, i: number) => (
                            <button key={i} onClick={(e) => { e.stopPropagation(); setPromoIndex(i); }} className={`w-1.5 h-1.5 rounded-full transition-all ${i === promoIndex ? 'bg-amber-500 w-4' : 'bg-white/40'}`} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Categories & Products */}
              <div className="p-4 lg:p-0 space-y-8 lg:space-y-12">
                {tenant.categories?.filter(cat =>
                  (!selectedCategoryId || cat.id === selectedCategoryId || !isDesktop) &&
                  (!searchTerm || cat.products.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase())))
                ).map(cat => (
                  <section id={`cat-${cat.id}`} key={cat.id} className={`space-y-4 lg:space-y-6 ${selectedCategoryId && selectedCategoryId !== cat.id && !searchTerm ? 'lg:hidden' : ''}`}>
                    <h2 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-3">
                      {cat.name}
                      <div className="h-px flex-1 bg-white/[0.06]" />
                    </h2>

                    {/* Mobile/Tablet: 2-column grid of cards */}
                    <div className="grid grid-cols-2 gap-3 lg:hidden">
                      {cat.products.filter(p =>
                        !searchTerm ||
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map(p => (
                        <motion.button
                          key={p.id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setSelectedProduct(p); setSelectedVariant(p.variants && p.variants.length > 0 ? p.variants[0] : null); setSelectedExtras([]); setSelectedGroupItemIds([]); setQty(1); setNotes(""); }}
                          className="group text-left bg-[#161d27] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-amber-500/30 transition-all active:bg-[#1c2532]"
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-white/5 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <Utensils className="w-8 h-8 text-white/20" />
                            )}
                          </div>
                          <div className="p-3 space-y-1">
                            <h3 className="text-[13px] font-bold text-white leading-tight line-clamp-2">{p.name}</h3>
                            {p.description && (
                              <p className="text-[10px] text-white/40 line-clamp-1 leading-relaxed">{p.description}</p>
                            )}
                            <div className="flex items-center justify-between pt-1">
                              <p className="text-sm font-black text-amber-400">{fmt(p.price)}</p>
                              <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                <Plus className="w-3.5 h-3.5 text-black" />
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                    {/* Desktop: cards */}
                    <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                      {cat.products.filter(p =>
                        !searchTerm ||
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map(p => (
                        <motion.div
                          key={p.id}
                          whileHover={{ y: -4, scale: 1.01 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setSelectedProduct(p); setSelectedVariant(p.variants && p.variants.length > 0 ? p.variants[0] : null); setSelectedExtras([]); setSelectedGroupItemIds([]); setQty(1); setNotes(""); }}
                          className="group flex flex-col rounded-3xl bg-[#161d27] border border-white/[0.06] hover:bg-[#1c2532] hover:border-[#C9A227]/30 transition-all cursor-pointer overflow-hidden"
                        >
                          <div className="aspect-[4/3] overflow-hidden bg-white/5 shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img
                                src={p.imageUrl}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <Utensils className="w-10 h-10 text-white/20" />
                            )}
                          </div>
                          <div className="flex-1 p-5 space-y-2 flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-white group-hover:text-[#C9A227] transition-colors text-base leading-tight">{p.name}</h3>
                              {p.description && (
                                <p className="text-xs text-[#9ca3af] line-clamp-2 leading-relaxed mt-1">{p.description}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <p className="text-base font-black text-[#C9A227]">{fmt(p.price)}</p>
                              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-black transition-all">
                                <Plus className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            {/* ── QR CODE MODAL (Order by Phone) ────────────────────────────── */}
            <AnimatePresence>
              {showQR && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="fixed inset-0 z-[120] bg-zinc-950/90 backdrop-blur-2xl flex items-center justify-center p-8 lg:absolute lg:inset-0 lg:z-50"
                >
                  <div className="bg-zinc-900 border border-white/10 rounded-[3rem] p-10 max-w-sm w-full text-center space-y-8 shadow-2xl relative">
                    <button
                      onClick={() => setShowQR(false)}
                      className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="space-y-2">
                      <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                        <Smartphone className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-serif text-white">Continuar no Celular</h3>
                      <p className="text-sm text-white/30 px-4">Escaneie o QR Code abaixo para continuar seu pedido direto do seu smartphone.</p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-inner mx-auto w-fit">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}&bgcolor=ffffff&color=000000`}
                        alt="QR Code para celular"
                        className="w-48 h-48"
                      />
                    </div>

                    <div className="pt-4">
                      <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-center gap-3 border border-white/5">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Sincronizado com o Balcão</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cart FAB (Mobile + Desktop) */}
            <AnimatePresence>
              {cart.length > 0 && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-8 left-4 right-4 z-50 flex justify-center lg:bottom-12 lg:right-12 lg:left-auto"
                >
                  <button
                    onClick={handleOrder}
                    disabled={isOrdering}
                    className="w-full max-w-md bg-amber-500 text-black rounded-3xl p-4 flex items-center justify-between shadow-[0_20px_50px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative lg:max-w-xs lg:rounded-[2rem]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />

                    <div className="flex items-center gap-4 relative z-10">
                      <div className="w-12 h-12 rounded-2xl bg-black/10 flex items-center justify-center">
                        <Send className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">Enviar Pedido</p>
                        <p className="text-sm font-black leading-none">{cart.length} {cart.length === 1 ? 'Item' : 'Itens'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                      <div className="h-8 w-px bg-black/10 mx-2" />
                      <span className="text-lg font-black tracking-tighter">
                        {isOrdering ? <Loader2 className="w-6 h-6 animate-spin" /> : fmt(total)}
                      </span>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── FULL SCREEN PRODUCT MODAL (REFINED) ───────────────────── */}
            <AnimatePresence>
              {selectedProduct && (
                <motion.div
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className="fixed inset-0 z-[110] bg-[#fafafa] flex flex-col overflow-y-auto lg:absolute lg:inset-0 lg:z-40 lg:bg-[#0f1722]/95 lg:backdrop-blur-xl lg:flex-row lg:overflow-hidden"
                >
                  {/* Header / Image Area */}
                  <div className="relative h-[35vh] shrink-0 lg:h-full lg:w-[45%] xl:w-[40%] lg:border-r lg:border-white/5 bg-slate-100 lg:bg-white/5 flex items-center justify-center">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        className="w-full h-full object-cover"
                        alt={selectedProduct.name}
                      />
                    ) : (
                      <Utensils className="w-16 h-16 text-slate-300 lg:text-white/20" />
                    )}

                    <button
                      onClick={() => {
                        setSelectedProduct(null);
                        setSelectedVariant(null);
                        setQty(1);
                        setNotes("");
                        setSelectedExtras([]);
      setSelectedGroupItemIds([]);
                      }}
                      className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center text-white lg:bg-black/40 lg:border lg:border-white/10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>

                    {/* Desktop Product Overlay */}
                    <div className="hidden lg:flex absolute inset-x-0 bottom-0 pt-32 pb-12 px-12 flex-col gap-2 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent z-20">
                      <div className="bg-amber-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] w-fit">
                        {tenant.categories?.find(c => c.id === selectedProduct.categoryId)?.name || 'Detalhes'}
                      </div>
                      <h2 className="text-4xl xl:text-5xl font-serif text-white tracking-tight leading-tight">{selectedProduct.name}</h2>
                      <p className="text-white/60 text-base xl:text-lg font-medium max-w-md mt-2 line-clamp-3">{selectedProduct.description}</p>
                    </div>
                  </div>

                  {/* Content Area (Light on Mobile, Dark on Desktop) */}
                  <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa] lg:bg-[#0f1722] relative">
                    <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 lg:px-12 xl:px-16 lg:pt-16 xl:pt-20 custom-scrollbar">
                      {/* Mobile Product Info */}
                      <div className="space-y-4 lg:hidden">
                        <h2 className="text-xl font-bold text-zinc-900">{selectedProduct.name}</h2>
                        <p className="text-xs text-zinc-400 font-medium leading-relaxed">{selectedProduct.description}</p>
                        <p className="text-lg font-bold text-zinc-900">{fmt(selectedVariant ? selectedVariant.price : selectedProduct.price)}</p>
                      </div>

                      <div className="hidden lg:flex items-center justify-between pb-8 border-b border-white/5">
                        <div>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Preço Unitário</p>
                          <p className="text-4xl font-black text-amber-500 tracking-tighter">{fmt(selectedVariant ? selectedVariant.price : selectedProduct.price)}</p>
                        </div>
                      </div>

                      {/* Variants */}
                      {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-zinc-900 lg:text-white/30 lg:uppercase lg:tracking-widest">Escolha o tamanho</p>
                          <div className="space-y-2">
                            {selectedProduct.variants.map((v) => {
                              const outOfStock = !!v.inventoryItem && v.inventoryItem.quantity <= 0;
                              return (
                              <button
                                key={v.id}
                                onClick={() => !outOfStock && setSelectedVariant(v)}
                                disabled={outOfStock}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                                  outOfStock ? 'border-zinc-100 bg-zinc-50 lg:border-white/10 lg:bg-white/5 opacity-50 cursor-not-allowed' :
                                  selectedVariant?.id === v.id
                                    ? 'border-amber-500 bg-amber-50 lg:bg-amber-500/10'
                                    : 'border-zinc-100 bg-zinc-50 lg:border-white/10 lg:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedVariant?.id === v.id ? 'border-amber-500' : 'border-zinc-300 lg:border-white/20'}`}>
                                    {selectedVariant?.id === v.id && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                                  </div>
                                  <div className="text-left">
                                    <span className="text-sm font-bold text-zinc-900 lg:text-white">{v.name}</span>
                                    {outOfStock && <p className="text-[10px] text-red-500 font-bold">Esgotado</p>}
                                  </div>
                                </div>
                                <span className="text-sm font-bold text-zinc-700 lg:text-white/70">{fmt(v.price)}</span>
                              </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Customization (Light Style for Mobile) */}
                      <div className="space-y-6">
                        {(() => {
                          let parsedExtras: { id: string, label: string, price: number }[] = [];
                          try { parsedExtras = selectedProduct.extras ? JSON.parse(selectedProduct.extras) : []; } catch {}
                          return parsedExtras.length > 0 ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-zinc-900 lg:text-amber-500 lg:uppercase lg:tracking-[0.2em]">Adicionais</h4>
                                <span className="bg-zinc-100 text-zinc-400 text-[10px] px-2 py-0.5 rounded lg:hidden">Opcional</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {parsedExtras.map((ex) => {
                                  const isSelected = selectedExtras.some(e => e.id === ex.id);
                                  return (
                                    <button
                                      key={ex.id}
                                      onClick={() => setSelectedExtras(prev =>
                                        isSelected ? prev.filter(e => e.id !== ex.id) : [...prev, ex]
                                      )}
                                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                        isSelected
                                          ? 'bg-amber-500 text-black border-amber-500 lg:bg-amber-500 lg:border-amber-500 lg:text-black'
                                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 lg:bg-white/5 lg:text-white/70 lg:border-white/10 hover:border-amber-400'
                                      }`}
                                    >
                                      {ex.label}{ex.price > 0 ? ` +${fmt(ex.price)}` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {(() => {
                          const sg = parseSelectionGroup(selectedProduct);
                          if (!sg) return null;
                          const options = getSelectionGroupOptions(tenant, sg);
                          if (options.length === 0) return null;
                          const isComplete = selectedGroupItemIds.length === sg.qty;
                          return (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-zinc-900 lg:text-amber-500 lg:uppercase lg:tracking-[0.2em]">{sg.label || `Escolha ${sg.qty} ${sg.qty > 1 ? "itens" : "item"}`}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500 lg:bg-white/10 lg:text-white/60'}`}>{selectedGroupItemIds.length}/{sg.qty}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowGroupPicker(true)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                                  isComplete
                                    ? 'bg-amber-500/10 border-amber-500 lg:bg-amber-500/20'
                                    : 'bg-zinc-50 border-zinc-200 lg:bg-white/5 lg:border-white/10 hover:border-amber-400'
                                }`}
                              >
                                <span className="text-sm font-bold text-zinc-900 lg:text-white truncate">
                                  {isComplete
                                    ? selectedGroupItemIds.map(id => options.find(p => p.id === id)?.name).filter(Boolean).join(' + ')
                                    : 'Toque para escolher'}
                                </span>
                                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                              </button>
                            </div>
                          );
                        })()}

                        <div className="space-y-3">
                          <p className="text-sm font-bold text-zinc-900 lg:text-white/30 lg:uppercase lg:tracking-widest">Observações</p>
                          <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Insira aqui suas observações"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-red-500 transition-all min-h-[100px] resize-none lg:bg-white/5 lg:border-white/10 lg:text-white"
                          />
                          <div className="text-right text-[10px] text-zinc-400">{notes.length}/140</div>
                        </div>
                      </div>

                      {/* Quantity Selection */}
                      <div className="flex items-center justify-between py-6 border-t border-zinc-100 lg:border-none lg:py-0">
                        <p className="text-sm font-bold text-zinc-900 lg:text-white/20">Quantidade</p>
                        <div className="flex items-center gap-6">
                          <button
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 lg:bg-white/5 lg:text-white"
                          >
                            <Minus className="w-5 h-5" />
                          </button>
                          <span className="text-lg font-bold text-zinc-900 w-6 text-center lg:text-white">{qty}</span>
                          <button
                            onClick={() => setQty(qty + 1)}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-100 text-red-500 lg:bg-white/5 lg:text-white"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="sticky bottom-0 p-4 bg-white border-t border-zinc-100 lg:p-12 lg:bg-zinc-900/50 lg:border-none">
                      {(() => {
                        const sg = parseSelectionGroup(selectedProduct);
                        const selectionIncomplete = !!sg && selectedGroupItemIds.length !== sg.qty;
                        return (
                          <>
                            {selectionIncomplete && (
                              <button
                                onClick={() => setShowGroupPicker(true)}
                                className="w-full text-center text-xs font-bold text-red-500 mb-2 underline"
                              >
                                Escolha {sg!.qty} {sg!.qty > 1 ? "itens" : "item"} para continuar ({selectedGroupItemIds.length}/{sg!.qty})
                              </button>
                            )}
                            <button
                              disabled={selectionIncomplete}
                              onClick={() => {
                                const extrasLabel = selectedExtras.length > 0
                                  ? selectedExtras.map(e => e.price > 0 ? `${e.label} (+${fmt(e.price)})` : e.label).join(', ')
                                  : '';
                                const extrasPrice = selectedExtras.reduce((s, e) => s + e.price, 0);
                                const groupOptions = sg ? getSelectionGroupOptions(tenant, sg) : [];
                                const groupLabel = sg ? formatSelectionGroupNote(sg, selectedGroupItemIds, groupOptions) : '';
                                const fullNotes = [groupLabel, extrasLabel, notes].filter(Boolean).join(' | ');
                                const basePrice = selectedVariant ? selectedVariant.price : selectedProduct.price;
                                const displayName = selectedVariant ? `${selectedProduct.name} — ${selectedVariant.name}` : selectedProduct.name;
                                setCart([...cart, {
                                  productId: selectedProduct.id,
                                  variantId: selectedVariant?.id,
                                  name: displayName,
                                  price: basePrice + extrasPrice,
                                  quantity: qty,
                                  notes: fullNotes
                                }]);
                                setSelectedProduct(null);
                                setSelectedVariant(null);
                                setQty(1);
                                setNotes("");
                                setSelectedExtras([]);
                                setSelectedGroupItemIds([]);
                              }}
                              className="w-full h-14 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#A8841C] text-black font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-between px-6 lg:h-16 lg:rounded-2xl lg:px-10 lg:text-xs lg:uppercase lg:tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center gap-3">
                                <ShoppingBag className="w-5 h-5" />
                                <span>Adicionar</span>
                              </div>
                              <span className="text-base font-black">{fmt(((selectedVariant ? selectedVariant.price : selectedProduct.price) + selectedExtras.reduce((s, e) => s + e.price, 0)) * qty)}</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Grupo de seleção embutido — fluxo passo a passo (ex: "2 espetos") */}
            {showGroupPicker && selectedProduct && (() => {
              const sg = parseSelectionGroup(selectedProduct);
              if (!sg) return null;
              const options = getSelectionGroupOptions(tenant, sg);
              return (
                <SelectionGroupPicker
                  group={sg}
                  options={options}
                  onConfirm={(ids) => { setSelectedGroupItemIds(ids); setShowGroupPicker(false); }}
                  onCancel={() => {
                    setShowGroupPicker(false);
                    if (selectedGroupItemIds.length === 0) setSelectedProduct(null);
                  }}
                />
              );
            })()}
            {/* Toast Feedback */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                  className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] bg-zinc-900 border border-[#C9A227]/30 text-[#C9A227] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 lg:bottom-12"
                >
                  <div className="w-2 h-2 rounded-full bg-[#C9A227] animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-widest">{toast}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
