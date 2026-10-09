import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Plus, Minus, X, Send, Loader2,
  ChevronLeft, ChevronRight, Utensils, Phone, User,
  Search, Smartphone,
  ShoppingBag,
  Cake,
  RotateCcw,
  Trash2,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, ProductVariant, Order } from "../../types";
import SelectionGroupPicker, { parseSelectionGroups, getSelectionGroupOptions, formatSelectionGroupsNote, selectionGroupsComplete } from "./SelectionGroupPicker";
import { COUNTER_ORDER_TABLE_ID } from "../../types";
import { Button, IconButton, Input, Textarea, Modal, Tabs, Badge, EmptyState } from "@/src/components";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Tradução de status para o cliente que está acompanhando a senha do balcão.
// `billed` é quem diz se o pagamento já foi confirmado pelo operador no caixa —
// o pedido pode estar em PENDING/PREPARING sem ainda ter sido pago (ex: cliente
// escolheu pagar no balcão, ou o operador ainda não bateu o pagamento no PDV).
function getStatusLabel(status: string, billed: boolean) {
  // AWAITING_PAYMENT é o status de "já retirado no balcão, falta só fechar a conta no
  // caixa" — sem checar billed aqui, a tela do cliente ficava presa em "Aguardando
  // Pagamento" pra sempre, mesmo depois do PDV marcar o pagamento como feito (o
  // faturamento no PDV muda só o billed, não o status).
  if (status === "AWAITING_PAYMENT") return billed ? "Pagamento confirmado" : "Aguardando Pagamento";
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
    return billed
      ? "Pagamento confirmado. Obrigado pela preferência!"
      : "Pague no caixa e acompanhe pela tela — chamaremos sua senha quando estiver pronto.";
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

// ── Tema escuro do balcão: componentes do sistema com classes escuras ───────
const COUNTER_BG_IMAGE = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=2070";
const DARK_OUTLINE = "!bg-slate-800 !border-white/10 !text-slate-100 hover:!bg-slate-700";
const DARK_INPUT = "[&_.group]:!bg-slate-800 [&_.group]:!rounded-xl [&_.group]:!border-white/10 [&_input]:!text-white [&_.ds-label]:!text-slate-300";
const DARK_MODAL = "!bg-slate-900 !border-white/10 [&_.ui-modal-header]:!border-white/10 [&_.ui-modal-actions]:!bg-slate-900 [&_.ui-modal-actions]:!border-white/10 [&_.ui-modal-title]:!text-white [&_.ui-modal-header_p]:!text-slate-400 [&_.ui-modal-header_button]:!text-slate-300 [&_.ui-modal-header_button]:!bg-transparent [&_.bg-white]:!bg-slate-800 [&_.bg-slate-50]:!bg-slate-800 [&_.bg-slate-100]:!bg-slate-700 [&_.border-slate-200]:!border-white/10 [&_.text-slate-800]:!text-white [&_.text-slate-500]:!text-slate-400 [&_.bg-blue-50]:!bg-blue-500/15 [&_.text-blue-700]:!text-blue-300";
const DARK_TABS = "[&_[role=tablist]]:!border-white/10 [&_[role=tab]]:!text-slate-400 [&_[role=tab][aria-selected=true]]:!text-blue-400 [&_[role=tab][aria-selected=true]]:!border-blue-500";
const BADGE_DARK: Record<string, string> = {
  default: "!bg-white/10 !text-slate-200 !border-white/10",
  primary: "!bg-blue-500/15 !text-blue-300 !border-blue-500/30",
  success: "!bg-emerald-500/15 !text-emerald-300 !border-emerald-500/30",
  warning: "!bg-amber-500/15 !text-amber-300 !border-amber-500/30",
  danger: "!bg-red-500/15 !text-red-300 !border-red-500/30",
};
type BtnProps = React.ComponentProps<typeof Button>;
const DButton = ({ className = "", ...p }: BtnProps) => (
  <Button {...p} className={`${p.variant === "outline" ? DARK_OUTLINE : ""} ${className}`} />
);
type IconBtnProps = React.ComponentProps<typeof IconButton>;
const DIconButton = ({ className = "", ...p }: IconBtnProps) => (
  <IconButton {...p} className={`${p.variant === "outline" ? DARK_OUTLINE : "hover:!bg-white/10"} ${className}`} />
);
const DBadge = ({ color = "default", className = "", ...p }: React.ComponentProps<typeof Badge>) => (
  <Badge color={color} {...p} className={`${BADGE_DARK[color as string] ?? BADGE_DARK.default} ${className}`} />
);
const DEmpty = ({ className = "", ...p }: React.ComponentProps<typeof EmptyState>) => (
  <EmptyState {...p} className={`!border-white/10 !bg-slate-900/60 [&_p]:!text-slate-300 ${className}`} />
);

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
  const [selectedGroupItemIds, setSelectedGroupItemIds] = useState<string[][]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  // Comer no local ou levar pra viagem — perguntado antes de enviar o pedido do balcão.
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  // Carrinho aberto em bottom-sheet (celular/tablet).
  const [showCart, setShowCart] = useState(false);
  // Visão de promoções (item do menu lateral) em vez do banner acima da lista.
  const [showPromos, setShowPromos] = useState(false);
  const [promoPaused, setPromoPaused] = useState(false);
  const promoTouchX = useRef(0);

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
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  const counterStorageKey = `counter_order_${slug}`;
  const cartStorageKey = `counter_cart_${slug}`;

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (tenant?.categories && tenant.categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(tenant.categories[0].id);
    }
  }, [tenant, selectedCategoryId]);

  // Carrinho salvo antes de um produto ser desativado não pode continuar oferecendo
  // esse item ao cliente. Complementos de grupos são tratados separadamente pelo picker.
  useEffect(() => {
    if (!tenant) return;
    const availableIds = new Set(tenant.categories?.flatMap((category) =>
      category.products.filter((product) => product.available !== false).map((product) => product.id),
    ));
    setCart((current) => current.filter((item) => availableIds.has(item.productId)));
  }, [tenant]);

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
    const groups = parseSelectionGroups(selectedProduct);
    if (groups.length > 0 && !selectionGroupsComplete(groups, selectedGroupItemIds)) {
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
    if (promotions.length <= 1 || promoPaused) return;
    const t = setInterval(() => setPromoIndex(i => (i + 1) % promotions.length), 5000);
    return () => clearInterval(t);
  }, [promotions.length, promoPaused]);

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
    const found = tenant?.categories?.flatMap(c => c.products).find(p => p.id === promo.product.id && p.available !== false);
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

  const handleOrder = async (chosenConsumptionType: "EAT_IN" | "TAKEOUT") => {
    if (cart.length === 0) return;
    setShowConsumptionModal(false);
    setIsOrdering(true);
    const orderData = {
      customerName: customer.name,
      customerPhone: customer.phone.replace(/\D/g, ""),
      tenantId: tenant?.id,
      tenantSlug: slug,
      orderType: "DINE_IN",
      tableId: COUNTER_ORDER_TABLE_ID,
      consumptionType: chosenConsumptionType,
      paymentMethod: "CASH",
      birthday: customer.birthday || undefined,
      items: cart.map(item => ({
        productId: item.productId,
        productVariantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes,
        selectedExtras: item.extras || []
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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>;
  if (!tenant) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <DEmpty icon={Utensils} title="Restaurante não encontrado" className="w-full max-w-sm bg-slate-900 py-10" />
    </div>
  );

  const initials = tenant.name?.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const renderLogo = (sizeClass: string) =>
    tenant.logoUrl ? (
      <img src={tenant.logoUrl} className={`${sizeClass} shrink-0 rounded-lg object-cover`} alt={tenant.name} />
    ) : (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-semibold text-white`}>
        {initials}
      </div>
    );

  const searchLower = searchTerm.toLowerCase();
  const matchesSearch = (p: Product) =>
    p.available !== false && (!searchTerm || p.name.toLowerCase().includes(searchLower) || p.description?.toLowerCase().includes(searchLower));

  const openProduct = (p: Product) => {
    setSelectedProduct(p);
    setSelectedVariant(p.variants && p.variants.length > 0 ? p.variants[0] : null);
    setSelectedExtras([]);
    setSelectedGroupItemIds([]);
    setQty(1);
    setNotes("");
  };

  const closeProduct = () => {
    setSelectedProduct(null);
    setSelectedVariant(null);
    setQty(1);
    setNotes("");
    setSelectedExtras([]);
    setSelectedGroupItemIds([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const changeCartQty = (idx: number, delta: number) => {
    setCart((current) =>
      current.flatMap((item, i) => {
        if (i !== idx) return [item];
        const next = item.quantity + delta;
        return next <= 0 ? [] : [{ ...item, quantity: next }];
      }),
    );
  };

  const removeCartItem = (idx: number) => setCart((current) => current.filter((_, i) => i !== idx));

  const categoryTabs = (tenant.categories || []).map((cat) => ({ id: cat.id, label: cat.name }));

  const statusColor = (status: string): "success" | "danger" | "warning" =>
    ["SHIPPED", "DELIVERED", "MERGED"].includes(status) ? "success" : status === "CANCELLED" ? "danger" : "warning";

  const renderCartItems = () => (
    <ul className="space-y-3">
      {cart.map((item, idx) => (
        <li key={idx} className="rounded-lg border border-white/10 bg-slate-900 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-snug text-white">{item.name}</p>
              {item.notes && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{item.notes}</p>}
            </div>
            <p className="shrink-0 text-[13px] font-semibold text-white">{fmt(item.price * item.quantity)}</p>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <DIconButton variant="outline" size="lg" aria-label="Diminuir quantidade" onClick={() => changeCartQty(idx, -1)}>
                <Minus size={14} />
              </DIconButton>
              <span className="w-8 text-center text-sm font-medium text-white">{item.quantity}</span>
              <DIconButton variant="outline" size="lg" aria-label="Aumentar quantidade" onClick={() => changeCartQty(idx, 1)}>
                <Plus size={14} />
              </DIconButton>
            </div>
            <DIconButton variant="ghost" size="lg" aria-label={`Remover ${item.name}`} onClick={() => removeCartItem(idx)} className="text-slate-400 hover:text-red-400">
              <Trash2 size={16} />
            </DIconButton>
          </div>
        </li>
      ))}
    </ul>
  );

  const goPromo = (delta: number) => setPromoIndex((i) => (i + delta + promotions.length) % promotions.length);

  const renderPromotions = () => {
    const promo: any = promotions[promoIndex % promotions.length];
    const multi = promotions.length > 1;
    return (
      <div
        tabIndex={0}
        role="region"
        aria-label="Promoções"
        onMouseEnter={() => setPromoPaused(true)}
        onMouseLeave={() => setPromoPaused(false)}
        onFocus={() => setPromoPaused(true)}
        onBlur={() => setPromoPaused(false)}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") goPromo(-1); if (e.key === "ArrowRight") goPromo(1); }}
        onTouchStart={(e) => { setPromoPaused(true); promoTouchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - promoTouchX.current;
          if (Math.abs(dx) > 40) goPromo(dx < 0 ? 1 : -1);
          setPromoPaused(false);
        }}
        className="relative aspect-[16/9] max-h-[260px] w-full overflow-hidden rounded-lg border border-white/10 bg-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:aspect-auto md:h-full md:max-h-none md:min-h-[420px]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={promoIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            {promo.imageUrl && <img src={promo.imageUrl} className="h-full w-full object-cover" alt={promo.title} />}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-3 pb-9 pt-16 sm:p-4 sm:pb-10 md:p-8 md:pb-14 md:pt-32">
              <div className="min-w-0 space-y-1">
                <DBadge color="primary">Promoção</DBadge>
                <h2 className="truncate text-sm font-medium text-white sm:text-lg md:text-3xl">{promo.title}</h2>
                {promo.description && <p className="line-clamp-2 text-xs text-slate-300">{promo.description}</p>}
              </div>
              {promo.product && (
                <div className="shrink-0 space-y-2 text-right">
                  <div>
                    <p className="text-[11px] text-slate-300">A partir de</p>
                    <p className="text-lg font-semibold text-white sm:text-xl">{fmt(promo.promoPrice || promo.product.price)}</p>
                  </div>
                  <DButton size="md" className="h-10" iconLeft={<Plus size={14} />} onClick={() => openPromotionProduct(promo)}>Ver</DButton>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        {multi && (
          <>
            <DIconButton variant="outline" size="lg" aria-label="Promoção anterior" onClick={() => goPromo(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 md:left-4 md:!h-14 md:!w-14 !bg-slate-950/60">
              <ChevronLeft size={16} />
            </DIconButton>
            <DIconButton variant="outline" size="lg" aria-label="Próxima promoção" onClick={() => goPromo(1)} className="absolute right-2 top-1/2 -translate-y-1/2 md:right-4 md:!h-14 md:!w-14 !bg-slate-950/60">
              <ChevronRight size={16} />
            </DIconButton>
            <div className="absolute inset-x-0 bottom-1 flex justify-center md:bottom-3">
              {promotions.map((_: any, i: number) => (
                <button key={i} type="button" aria-label={`Ir para promoção ${i + 1}`} onClick={() => setPromoIndex(i)} className="flex h-6 w-6 items-center justify-center">
                  <span className={`h-2 rounded-full transition-all ${i === promoIndex ? "w-5 bg-blue-500" : "w-2 bg-white/60"}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderProduct = (inline: boolean) => {
    if (!selectedProduct) return null;
    const groups = parseSelectionGroups(selectedProduct);
    const selectionIncomplete = groups.length > 0 && !selectionGroupsComplete(groups, selectedGroupItemIds);
    const doneCount = groups.reduce((acc, g, i) => acc + (selectedGroupItemIds[i]?.length ?? 0), 0);
    const totalCount = groups.reduce((acc, g) => acc + g.qty, 0);
    const unitPrice = selectedVariant ? selectedVariant.price : selectedProduct.price;
    let parsedExtras: { id: string, label: string, price: number }[] = [];
    try { parsedExtras = selectedProduct.extras ? JSON.parse(selectedProduct.extras) : []; parsedExtras = parsedExtras.filter((ex: any) => !ex.autoApplyOnTakeout); } catch {}
    const categoryName = tenant.categories?.find(c => c.id === selectedProduct.categoryId)?.name;

    const footerNode = (
                  <div className="space-y-2">
                    {selectionIncomplete && (
                      <button
                        type="button"
                        onClick={() => setShowGroupPicker(true)}
                        className="w-full text-center text-xs font-medium text-red-400 underline"
                      >
                        Escolha {totalCount} {totalCount > 1 ? "itens" : "item"} para continuar ({doneCount}/{totalCount})
                      </button>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 items-center gap-1">
                        <DIconButton variant="outline" size="lg" aria-label="Diminuir quantidade" onClick={() => setQty(Math.max(1, qty - 1))}>
                          <Minus size={14} />
                        </DIconButton>
                        <span className="w-8 text-center text-sm font-medium text-white">{qty}</span>
                        <DIconButton variant="outline" size="lg" aria-label="Aumentar quantidade" onClick={() => setQty(qty + 1)}>
                          <Plus size={14} />
                        </DIconButton>
                      </div>
                      <DButton
                        size="lg"
                        className="h-11 min-w-0 flex-1"
                        disabled={selectionIncomplete}
                        iconLeft={<ShoppingBag size={14} />}
                        onClick={() => {
                          const extrasLabel = selectedExtras.length > 0
                            ? selectedExtras.map(e => e.price > 0 ? `${e.label} (+${fmt(e.price)})` : e.label).join(', ')
                            : '';
                          const extrasPrice = selectedExtras.reduce((s, e) => s + e.price, 0);
                          const optionsByGroup = groups.map(g => getSelectionGroupOptions(tenant, g));
                          const groupLabel = groups.length > 0 ? formatSelectionGroupsNote(groups, selectedGroupItemIds, optionsByGroup) : '';
                          const fullNotes = [groupLabel, extrasLabel, notes].filter(Boolean).join(' | ');
                          const basePrice = selectedVariant ? selectedVariant.price : selectedProduct.price;
                          const displayName = selectedVariant ? `${selectedProduct.name} — ${selectedVariant.name}` : selectedProduct.name;
                          setCart([...cart, {
                            productId: selectedProduct.id,
                            variantId: selectedVariant?.id,
                            name: displayName,
                            price: basePrice + extrasPrice,
                            quantity: qty,
                            notes: fullNotes,
                            extras: selectedExtras.map(e => ({ id: e.id }))
                          }]);
                          setSelectedProduct(null);
                          setSelectedVariant(null);
                          setQty(1);
                          setNotes("");
                          setSelectedExtras([]);
                          setSelectedGroupItemIds([]);
                        }}
                      >
                        Adicionar · {fmt((unitPrice + selectedExtras.reduce((s, e) => s + e.price, 0)) * qty)}
                      </DButton>
                    </div>
                  </div>
    );
    const imageNode = (
                  <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} className="h-full w-full object-cover" alt={selectedProduct.name} />
                    ) : (
                      <Utensils className="h-12 w-12 text-slate-600" />
                    )}
                  </div>

    );
    const detailsNode = (
                <div className="space-y-4">
                  <div className="space-y-1">
                    {selectedProduct.description && <p className="text-xs leading-relaxed text-slate-400">{selectedProduct.description}</p>}
                    <p className="text-lg font-semibold text-blue-400">{fmt(unitPrice)}</p>
                  </div>

                  {/* Variants */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">Escolha o tamanho</p>
                      <div className="space-y-2">
                        {selectedProduct.variants.map((v) => {
                          const outOfStock = !!v.inventoryItem && v.inventoryItem.quantity <= 0;
                          const active = selectedVariant?.id === v.id;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() => !outOfStock && setSelectedVariant(v)}
                              disabled={outOfStock}
                              className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                outOfStock ? "cursor-not-allowed border-white/10 bg-slate-950 opacity-50" :
                                active ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900 hover:border-blue-500/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-blue-600" : "border-slate-300"}`}>
                                  {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                </span>
                                <div className="text-left">
                                  <span className="text-[13px] font-medium text-white">{v.name}</span>
                                  {outOfStock && <p className="text-[11px] font-medium text-red-400">Esgotado</p>}
                                </div>
                              </div>
                              <span className="text-[13px] font-medium text-slate-200">{fmt(v.price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {parsedExtras.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-medium text-slate-600">Adicionais</h4>
                        <DBadge color="default" size="sm">Opcional</DBadge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsedExtras.map((ex) => {
                          const isSelected = selectedExtras.some(e => e.id === ex.id);
                          return (
                            <button
                              type="button"
                              key={ex.id}
                              onClick={() => setSelectedExtras(prev =>
                                isSelected ? prev.filter(e => e.id !== ex.id) : [...prev, ex]
                              )}
                              className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-white/10 bg-slate-900 text-slate-200 hover:border-blue-500/50"
                              }`}
                            >
                              {ex.label}{ex.price > 0 ? ` +${fmt(ex.price)}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    if (groups.length === 0) return null;
                    const optionsByGroup = groups.map(g => getSelectionGroupOptions(tenant, g));
                    if (optionsByGroup.every(o => o.length === 0)) return null;
                    const isComplete = selectionGroupsComplete(groups, selectedGroupItemIds);
                    const summary = groups
                      .map((g, i) => (selectedGroupItemIds[i] || [])
                        .map(id => optionsByGroup[i].find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(' + '))
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-medium text-slate-600">
                            {groups.length > 1 ? "Personalize seu pedido" : (groups[0].label || `Escolha ${groups[0].qty} ${groups[0].qty > 1 ? "itens" : "item"}`)}
                          </h4>
                          <DBadge color={isComplete ? "success" : "default"} size="sm">{doneCount}/{totalCount}</DBadge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGroupPicker(true)}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isComplete ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900 hover:border-blue-500/50"
                          }`}
                        >
                          <span className="truncate text-[13px] font-medium text-white">
                            {isComplete ? summary : "Toque para escolher"}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </div>
                    );
                  })()}

                  <div className="space-y-1">
                    <Textarea
                      label="Observações"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Insira aqui suas observações"
                      className="min-h-[88px] !bg-slate-800 !border-white/10 !text-white" wrapperClassName="[&_.ds-label]:!text-slate-300"
                    />
                    <div className="text-right text-[11px] text-slate-400">{notes.length}/140</div>
                  </div>
                </div>
    );
    const bodyNode = (
                <div className="space-y-4">
                  <div className="flex aspect-[4/3] max-h-[220px] w-full md:aspect-square md:max-h-none items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} className="h-full w-full object-cover" alt={selectedProduct.name} />
                    ) : (
                      <Utensils className="h-12 w-12 text-slate-600" />
                    )}
                  </div>

                  <div className="space-y-1">
                    {selectedProduct.description && <p className="text-xs leading-relaxed text-slate-400">{selectedProduct.description}</p>}
                    <p className="text-lg font-semibold text-blue-400">{fmt(unitPrice)}</p>
                  </div>

                  {/* Variants */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-600">Escolha o tamanho</p>
                      <div className="space-y-2">
                        {selectedProduct.variants.map((v) => {
                          const outOfStock = !!v.inventoryItem && v.inventoryItem.quantity <= 0;
                          const active = selectedVariant?.id === v.id;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() => !outOfStock && setSelectedVariant(v)}
                              disabled={outOfStock}
                              className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                outOfStock ? "cursor-not-allowed border-white/10 bg-slate-950 opacity-50" :
                                active ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900 hover:border-blue-500/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-blue-600" : "border-slate-300"}`}>
                                  {active && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                                </span>
                                <div className="text-left">
                                  <span className="text-[13px] font-medium text-white">{v.name}</span>
                                  {outOfStock && <p className="text-[11px] font-medium text-red-400">Esgotado</p>}
                                </div>
                              </div>
                              <span className="text-[13px] font-medium text-slate-200">{fmt(v.price)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {parsedExtras.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-medium text-slate-600">Adicionais</h4>
                        <DBadge color="default" size="sm">Opcional</DBadge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parsedExtras.map((ex) => {
                          const isSelected = selectedExtras.some(e => e.id === ex.id);
                          return (
                            <button
                              type="button"
                              key={ex.id}
                              onClick={() => setSelectedExtras(prev =>
                                isSelected ? prev.filter(e => e.id !== ex.id) : [...prev, ex]
                              )}
                              className={`min-h-[40px] rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-white/10 bg-slate-900 text-slate-200 hover:border-blue-500/50"
                              }`}
                            >
                              {ex.label}{ex.price > 0 ? ` +${fmt(ex.price)}` : ""}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(() => {
                    if (groups.length === 0) return null;
                    const optionsByGroup = groups.map(g => getSelectionGroupOptions(tenant, g));
                    if (optionsByGroup.every(o => o.length === 0)) return null;
                    const isComplete = selectionGroupsComplete(groups, selectedGroupItemIds);
                    const summary = groups
                      .map((g, i) => (selectedGroupItemIds[i] || [])
                        .map(id => optionsByGroup[i].find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(' + '))
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-medium text-slate-600">
                            {groups.length > 1 ? "Personalize seu pedido" : (groups[0].label || `Escolha ${groups[0].qty} ${groups[0].qty > 1 ? "itens" : "item"}`)}
                          </h4>
                          <DBadge color={isComplete ? "success" : "default"} size="sm">{doneCount}/{totalCount}</DBadge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowGroupPicker(true)}
                          className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isComplete ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900 hover:border-blue-500/50"
                          }`}
                        >
                          <span className="truncate text-[13px] font-medium text-white">
                            {isComplete ? summary : "Toque para escolher"}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </button>
                      </div>
                    );
                  })()}

                  <div className="space-y-1">
                    <Textarea
                      label="Observações"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Insira aqui suas observações"
                      className="min-h-[88px] !bg-slate-800 !border-white/10 !text-white" wrapperClassName="[&_.ds-label]:!text-slate-300"
                    />
                    <div className="text-right text-[11px] text-slate-400">{notes.length}/140</div>
                  </div>
                </div>
    );
    const pickerOptions = groups.map(g => getSelectionGroupOptions(tenant, g));
            const inlineBody = showGroupPicker && groups.length > 0 ? (
              <SelectionGroupPicker
                variant="admin"
                inline
                className="text-white [&_.bg-white]:!bg-slate-800 [&_.bg-slate-50]:!bg-slate-800 [&_.bg-slate-100]:!bg-slate-700 [&_.border-slate-200]:!border-white/10 [&_.text-slate-800]:!text-white [&_.text-slate-500]:!text-slate-400 [&_.bg-blue-50]:!bg-blue-500/15 [&_.text-blue-700]:!text-blue-300"
                groups={groups}
                optionsByGroup={pickerOptions}
                initialSelections={selectedGroupItemIds.length ? selectedGroupItemIds : undefined}
                onConfirm={(idsByGroup) => { setSelectedGroupItemIds(idsByGroup); setShowGroupPicker(false); }}
                onCancel={() => {
                  setShowGroupPicker(false);
                  if (selectedGroupItemIds.length === 0) setSelectedProduct(null);
                }}
              />
            ) : null;
            if (inline) {
              return (
                <div className="w-full space-y-4">
                  <DButton variant="outline" size="lg" iconLeft={<ChevronLeft size={14} />} onClick={closeProduct}>Voltar</DButton>
                  <div className="grid gap-6 rounded-lg border border-white/10 bg-slate-900 p-4 md:grid-cols-[minmax(220px,38%)_minmax(0,1fr)] md:gap-5 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)] lg:gap-8 lg:p-6 xl:grid-cols-[minmax(360px,500px)_minmax(0,1fr)]">
                    <div className="md:sticky md:top-0 md:self-start">{imageNode}</div>
                    <div className="flex min-w-0 flex-col gap-4">
                      <div className="space-y-1">
                        <h2 className="text-lg font-medium text-white">{selectedProduct.name}</h2>
                        {categoryName && <DBadge color="default" size="sm">{categoryName}</DBadge>}
                      </div>
                      {inlineBody ?? (
                        <>
                          {detailsNode}
                          <div className="border-t border-white/10 pt-4">{footerNode}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <Modal
                isOpen
                onClose={closeProduct}
                title={selectedProduct.name}
                subtitle={categoryName}
                size="lg"
                className={`max-sm:self-end ${DARK_MODAL}`}
                footer={footerNode}
              >
                {bodyNode}
              </Modal>
            );
          };

  const inlineProduct = isDesktop && !!selectedProduct;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-950 font-sans text-white lg:flex-row">

      {/* ── CHECK-IN STEP ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {step === "checkin" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black"
          >
            <img src={COUNTER_BG_IMAGE} alt="" className="pointer-events-none fixed inset-0 h-full w-full scale-110 object-cover blur-xl" />
            <div className="pointer-events-none fixed inset-0 bg-black/70" />
            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-lg backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="overflow-hidden rounded-full ring-2 ring-white/10">{renderLogo("h-20 w-20 !rounded-none")}</div>
                  <h1 className="font-serif text-2xl text-white">Bem-vindo ao {tenant.name}</h1>
                  <p className="text-xs text-slate-300">Informe seu telefone para ver o cardápio e fazer seu pedido.</p>
                </div>

                <form onSubmit={handleCheckin} className="space-y-3">
                  <Input wrapperClassName={DARK_INPUT}
                    required
                    autoFocus
                    size="lg"
                    value={customer.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    iconLeft={<Phone size={16} />}
                    iconRight={customerLookupLoading ? <Loader2 size={16} className="animate-spin text-blue-400" /> : undefined}
                  />
                  {checkinPhase === "details" && !customerFound && (
                    <>
                      <p className="text-xs text-slate-400">Não te encontramos — como podemos te chamar?</p>
                      <Input wrapperClassName={DARK_INPUT}
                        required
                        autoFocus
                        size="lg"
                        value={customer.name}
                        onChange={e => setCustomer({ ...customer, name: e.target.value })}
                        placeholder="Seu Nome"
                        iconLeft={<User size={16} />}
                      />
                      <Input wrapperClassName={DARK_INPUT}
                        size="lg"
                        label="Aniversário (opcional)"
                        value={customer.birthday}
                        onChange={e => setCustomer({ ...customer, birthday: e.target.value })}
                        type="date"
                        className="[color-scheme:dark]"
                        iconLeft={<Cake size={16} />}
                      />
                    </>
                  )}
                  <DButton type="submit" size="lg" fullWidth className="h-12 text-sm" disabled={customerLookupLoading}>
                    {checkinPhase === "details" && !customerFound ? "Confirmar e Ver Cardápio" : "Continuar"}
                  </DButton>
                </form>
              </div>
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
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950"
          >
            {/* min-h-full (em vez de centralizar o próprio container fixed) — com 2+
                senhas o conteúdo pode passar da altura da tela, e centralizar o
                container inteiro cortava a primeira senha lá em cima sem dar pra
                rolar até ela (limitação clássica de flex + overflow). */}
            <div className="flex min-h-full flex-col items-center justify-center p-4">
              <div className="w-full max-w-sm space-y-4 py-4">
                <div className="space-y-1 text-center">
                  <p className="text-xs text-slate-400">{tenant.name}</p>
                  <h1 className="text-base font-medium text-white sm:text-lg">
                    {ticketOrders.every((o) => o.counterTicketNumber == null)
                      ? "Pedido confirmado"
                      : ticketOrders.length > 1 ? "Suas senhas" : "Sua senha é"}
                  </h1>
                </div>

                {/* Mais de uma senha em aberto — ex: cliente pediu de novo antes da anterior
                    ficar pronta. Cada card mostra status independente até ser retirado. */}
                <div className="space-y-3">
                  {ticketOrders.map((order) => (
                    <div key={order.id} className="space-y-3 rounded-lg border border-white/10 bg-slate-900/80 backdrop-blur-sm p-4 text-center shadow-sm">
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="mx-auto flex flex-col items-center justify-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 py-5"
                      >
                        {order.counterTicketNumber != null ? (
                          <>
                            <span className="text-[11px] font-medium text-blue-300">Nº</span>
                            <span className="text-6xl font-semibold tabular-nums text-blue-300">
                              {order.counterTicketNumber}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[11px] font-medium text-blue-300">Pedido</span>
                            <span className="px-3 text-center text-xl font-semibold text-blue-300">
                              {order.customerName || "Confirmado"}
                            </span>
                          </>
                        )}
                      </motion.div>

                      <div className="flex justify-center">
                        <DBadge color={statusColor(order.status)} dot size="md" className="whitespace-normal text-center">
                          {getStatusLabel(order.status, order.billed === true)}
                        </DBadge>
                      </div>

                      {getInstructionText(order.status, order.billed === true) && (
                        <p className="text-xs leading-relaxed text-slate-400">
                          {getInstructionText(order.status, order.billed === true)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <DButton variant="outline" size="lg" fullWidth className="h-11" iconLeft={<RotateCcw size={14} />} onClick={handleNewOrder}>
                  Fazer novo pedido
                </DButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MENU STEP ────────────────────────────────────────────────────── */}
      {step === "menu" && (
        <>
          {/* Sidebar de categorias — desktop/notebook, recolhível */}
          <aside className={`relative z-20 hidden shrink-0 flex-col border-r border-white/10 bg-slate-900/90 backdrop-blur md:flex w-48 lg:w-56 xl:w-64`}>
            <div className="flex items-center gap-3 border-b border-white/10 p-3">
              <div className="min-w-0 flex-1"><p className="text-[11px] text-slate-400">Balcão</p><p className="line-clamp-2 text-sm font-medium text-white">{tenant.name}</p></div>
                          </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {promotions.length > 0 && (
                <button
                  type="button"
                  title="Promoções"
                  onClick={() => { setShowPromos(true); setSelectedProduct(null); }}
                  className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${showPromos ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"} `}
                >
                  <span className="flex min-w-0 items-center gap-2"><Tag size={14} className="shrink-0" /><span className="truncate">Promoções</span></span>
                  <DBadge color="primary" size="sm">{promotions.length}</DBadge>
                </button>
              )}
              {tenant.categories?.map(cat => {
                const active = !showPromos && selectedCategoryId === cat.id && !selectedProduct;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    title={cat.name}
                    onClick={() => {
                      setShowPromos(false);
                      setSelectedCategoryId(cat.id);
                      setSelectedProduct(null);
                    }}
                    className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"
                    } `}
                  >
                    <span className="truncate">{cat.name}</span>
                    <ChevronRight size={14} className={active ? "opacity-100" : "opacity-40"} />
                  </button>
                );
              })}
            </nav>
            <div className={`border-t border-white/10 p-3`}>
              <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                <User size={14} className="shrink-0 text-blue-400" />
                <div className="min-w-0"><p className="text-[11px] text-slate-400">Cliente</p><p className="truncate text-xs font-medium text-white">{customer.name}</p></div>
              </div>
            </div>
          </aside>

          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="relative z-30 shrink-0 overflow-hidden border-b border-white/10 bg-slate-900">
            <div className="relative flex items-center gap-3 px-3 py-3 sm:px-4">
              {renderLogo("h-12 w-12")}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[11px] font-medium text-slate-400">Balcão</p>
                </div>
                <p className="truncate text-sm font-medium text-white">{tenant.name}</p>
              </div>

              <div className="hidden w-64 sm:block xl:w-80">
                <Input wrapperClassName={DARK_INPUT}
                  size="lg"
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  iconLeft={<Search size={16} />}
                  iconRight={searchTerm ? (
                    <button type="button" aria-label="Limpar busca" onClick={() => setSearchTerm("")} className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-200">
                      <X size={14} />
                    </button>
                  ) : undefined}
                />
              </div>

              <DBadge color="default" icon={<User size={12} />} className="hidden max-w-[160px] truncate xl:hidden">{customer.name}</DBadge>

              <DButton size="lg" className="relative hidden md:inline-flex" aria-label="Abrir carrinho" iconLeft={<ShoppingBag size={14} />} onClick={() => setShowCart(true)}>
                <motion.span key={cartCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">{cartCount}</motion.span>
                {fmt(total)}
              </DButton>
              <DIconButton variant="outline" size="lg" aria-label="Pedir pelo celular" onClick={() => setShowQR(true)} className="xl:hidden">
                <Smartphone size={16} />
              </DIconButton>
              <DButton variant="outline" size="lg" iconLeft={<Smartphone size={14} />} onClick={() => setShowQR(true)} className="hidden xl:inline-flex">
                Pedir pelo Celular
              </DButton>
            </div>

            <div className="relative px-3 pb-2 sm:hidden">
              <Input wrapperClassName={DARK_INPUT}
                size="lg"
                type="text"
                placeholder="Buscar no cardápio..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                iconLeft={<Search size={16} />}
                iconRight={searchTerm ? (
                  <button type="button" aria-label="Limpar busca" onClick={() => setSearchTerm("")} className="flex h-6 w-6 items-center justify-center text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                ) : undefined}
              />
            </div>

            {categoryTabs.length > 0 && (
              <div className="relative px-3 sm:px-4 md:hidden">
                <Tabs
                  items={promotions.length > 0 ? [{ id: "__promos", label: "Promoções", badge: promotions.length }, ...categoryTabs] : categoryTabs}
                  value={showPromos ? "__promos" : (selectedCategoryId ?? categoryTabs[0].id)}
                  onChange={(id: string) => { if (id === "__promos") { setShowPromos(true); setSelectedProduct(null); } else { setShowPromos(false); scrollToCategory(id); } }}
                  label="Categorias do cardápio"
                  className={`space-y-0 [&>*+*]:hidden ${DARK_TABS}`}
                >
                  {null}
                </Tabs>
              </div>
            )}
          </header>

          <div className="flex min-h-0 flex-1">
            <div ref={scrollContainerRef} className="min-w-0 flex-1 overflow-y-auto bg-slate-950/75 backdrop-blur-sm p-3 pb-24 sm:p-4 md:pb-4">
              <div className={`space-y-4 ${!inlineProduct && showPromos && promotions.length > 0 ? "md:h-full" : ""}`}>

                {inlineProduct && renderProduct(true)}
                {!inlineProduct && showPromos && promotions.length > 0 && renderPromotions()}

                {/* Categories & Products */}
                {!inlineProduct && !showPromos && tenant.categories?.filter(cat =>
                  (!selectedCategoryId || cat.id === selectedCategoryId || !isDesktop) &&
                  cat.products.some(matchesSearch)
                ).map(cat => (
                  <section id={`cat-${cat.id}`} key={cat.id} className="space-y-3">
                    <h2 className="flex items-center gap-2 text-sm font-medium text-white">
                      {cat.name}
                      <DBadge color="default" size="sm">{cat.products.filter(matchesSearch).length}</DBadge>
                    </h2>

                    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" } as React.CSSProperties}>
                      {cat.products.filter(matchesSearch).map(p => {
                        const inCartQty = cart.filter(i => i.productId === p.id).reduce((acc, i) => acc + i.quantity, 0);
                        return (
                          <div
                            key={p.id}
                            className={`group relative flex flex-col overflow-hidden rounded-lg border bg-slate-900 transition-all duration-150 ${
                              inCartQty > 0 ? "border-blue-500 ring-1 ring-blue-500" : "border-white/10 hover:border-blue-500/50 hover:shadow-sm"
                            }`}
                          >
                            <button
                              type="button"
                              aria-label={`Adicionar ${p.name}`}
                              className="absolute inset-0 z-0 h-full w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                              onClick={() => openProduct(p)}
                            />
                            <div className="pointer-events-none relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-800">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              ) : (
                                <Utensils className="h-8 w-8 text-slate-600" />
                              )}
                              {inCartQty > 0 && (
                                <span className="absolute left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white shadow">
                                  {inCartQty}
                                </span>
                              )}
                            </div>
                            <div className="pointer-events-none flex flex-1 flex-col justify-between gap-2 p-2.5">
                              <h3 className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-snug text-white">{p.name}</h3>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-blue-400">{fmt(p.price)}</p>
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white">
                                  <Plus size={16} />
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {!inlineProduct && !showPromos && tenant.categories?.every(cat => !cat.products.some(matchesSearch)) && (
                  <DEmpty icon={Search} title="Nenhum produto encontrado" description="Tente buscar por outro nome." className="bg-slate-900 py-10" />
                )}
              </div>
            </div>

          </div>
          </div>

          {/* Barra inferior do carrinho — celular/tablet */}
          <AnimatePresence>
            {cart.length > 0 && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-900 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg md:hidden"
              >
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">{cartCount} {cartCount === 1 ? "item" : "itens"}</p>
                    <p className="text-lg font-semibold leading-tight text-white">{fmt(total)}</p>
                  </div>
                  <DButton size="lg" className="h-11 min-w-[140px]" iconLeft={<ShoppingBag size={14} />} loading={isOrdering} onClick={() => setShowCart(true)}>
                    Ver pedido
                  </DButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── CARRINHO (bottom-sheet no celular) ───────────────────────── */}
          <Modal
            isOpen={showCart}
            onClose={() => setShowCart(false)}
            title="Seu pedido"
            subtitle={`${cartCount} ${cartCount === 1 ? "item" : "itens"}`}
            size="md"
            position="right"
            className={DARK_MODAL}
            footer={
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total</span>
                  <span className="text-lg font-semibold text-white">{fmt(total)}</span>
                </div>
                <DButton
                  size="lg"
                  fullWidth
                  className="h-11"
                  iconLeft={<Send size={14} />}
                  loading={isOrdering}
                  onClick={() => { setShowCart(false); setShowConsumptionModal(true); }}
                >
                  Enviar pedido
                </DButton>
              </div>
            }
          >
            {renderCartItems()}
          </Modal>

          {/* ── QR CODE MODAL (Order by Phone) ────────────────────────────── */}
          <Modal
            isOpen={showQR}
            onClose={() => setShowQR(false)}
            title="Continuar no Celular"
            subtitle="Escaneie o QR Code para continuar seu pedido direto do seu smartphone."
            size="xs"
            className={`max-sm:self-end ${DARK_MODAL}`}
          >
            <div className="space-y-4 text-center">
              <div className="mx-auto w-fit rounded-lg border border-white/10 bg-slate-900 p-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}&bgcolor=ffffff&color=000000`}
                  alt="QR Code para celular"
                  className="h-44 w-44"
                />
              </div>
              <DBadge color="success" dot>Sincronizado com o Balcão</DBadge>
            </div>
          </Modal>

          {/* ── COMER NO LOCAL OU VIAGEM ────────────────────────────── */}
          <Modal
            isOpen={showConsumptionModal}
            onClose={() => { if (!isOrdering) setShowConsumptionModal(false); }}
            title="Comer no local ou viagem?"
            size="xs"
            className={`max-sm:self-end ${DARK_MODAL}`}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleOrder("EAT_IN")}
                  disabled={isOrdering}
                  className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900 p-3 text-slate-100 transition-colors hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
                >
                  <Utensils size={24} />
                  <span className="text-[13px] font-medium">Comer no local</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOrder("TAKEOUT")}
                  disabled={isOrdering}
                  className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900 p-3 text-slate-100 transition-colors hover:border-blue-400 hover:bg-blue-500/10 hover:text-blue-300 disabled:opacity-50"
                >
                  <ShoppingBag size={24} />
                  <span className="text-[13px] font-medium">Viagem</span>
                </button>
              </div>
              {isOrdering && (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando pedido...
                </div>
              )}
            </div>
          </Modal>

          {/* ── PRODUTO (bottom-sheet no celular) ───────────────────────── */}
          {!isDesktop && renderProduct(false)}

          {/* Grupos de seleção embutidos — fluxo passo a passo (ex: marmita com Guarnição/Arroz/Feijão) */}
          {!isDesktop && showGroupPicker && selectedProduct && (() => {
            const groups = parseSelectionGroups(selectedProduct);
            if (groups.length === 0) return null;
            const optionsByGroup = groups.map(g => getSelectionGroupOptions(tenant, g));
            return (
              <SelectionGroupPicker
                variant="admin"
                className={DARK_MODAL}
                groups={groups}
                optionsByGroup={optionsByGroup}
                initialSelections={selectedGroupItemIds.length ? selectedGroupItemIds : undefined}
                onConfirm={(idsByGroup) => { setSelectedGroupItemIds(idsByGroup); setShowGroupPicker(false); }}
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
                className="fixed bottom-24 left-1/2 z-[300] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-medium text-white shadow-lg xl:bottom-6"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                <span>{toast}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
