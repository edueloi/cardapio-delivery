import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Send,
  Loader2,
  ChevronLeft,
  Search,
  CreditCard,
  Wallet,
  Banknote,
  Truck,
  Store,
  MapPin,
  History,
  MessageSquare,
  CheckCircle2,
  Clock,
  ChevronRight,
  Bike,
  CalendarDays,
  Flame,
  Star,
  Tag,
  Info,
  Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, Order, ProductVariant } from "../../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function checkIsOpen(tenant: Tenant | null): boolean {
  if (!tenant) return false;
  if (tenant.isOpen === false) return false;
  if (!tenant.businessHours) return true;
  try {
    const hours = JSON.parse(tenant.businessHours);
    const dayKey = DAY_KEYS[new Date().getDay()];
    const day = hours[dayKey];
    if (!day?.enabled) return false;
    const [oh, om] = day.open.split(":").map(Number);
    const [ch, cm] = day.close.split(":").map(Number);
    const mins = new Date().getHours() * 60 + new Date().getMinutes();
    if (mins < oh * 60 + om || mins >= ch * 60 + cm) return false;
    if (day.breakEnabled && day.breakStart && day.breakEnd) {
      const [bsh, bsm] = day.breakStart.split(":").map(Number);
      const [beh, bem] = day.breakEnd.split(":").map(Number);
      if (mins >= bsh * 60 + bsm && mins < beh * 60 + bem) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function getTodayHours(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const hours = JSON.parse(raw);
    const dayKey = DAY_KEYS[new Date().getDay()];
    const d = hours[dayKey];
    if (!d?.enabled) return "Fechado hoje";
    return `${d.open}–${d.close}`;
  } catch {
    return null;
  }
}

function getNextOpenInfo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const hours = JSON.parse(raw);
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = DAY_KEYS[d.getDay()];
      const day = hours[key];
      if (day?.enabled) return `Abre ${i === 1 ? "amanhã" : labels[d.getDay()]} às ${day.open}`;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Masks ───────────────────────────────────────────────────────────────────
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  notes: string;
}

// ─── Status config ────────────────────────────────────────────────────────────
const ORDER_STATUS = {
  PENDING:   { label: "Aguardando",  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-400" },
  PREPARING: { label: "Na cozinha",  color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
  SHIPPED:   { label: "A caminho",   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-400"   },
  DELIVERED: { label: "Entregue",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-400"  },
  CANCELLED: { label: "Cancelado",   color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-400"    },
};

const PAYMENT_METHODS_CONFIG = [
  { id: "PIX", key: "pix", label: "Pix", icon: Send, emoji: "💎", color: "from-emerald-500 to-teal-600" },
  { id: "CREDIT", key: "credit", label: "Crédito", icon: CreditCard, emoji: "💳", color: "from-blue-500 to-indigo-600" },
  { id: "DEBIT", key: "debit", label: "Débito", icon: CreditCard, emoji: "💳", color: "from-violet-500 to-purple-600" },
  { id: "MEAL", key: "meal", label: "Vale Refeição", icon: Wallet, emoji: "🍱", color: "from-orange-500 to-amber-600" },
  { id: "FOOD", key: "food", label: "Vale Alimentação", icon: Wallet, emoji: "🛒", color: "from-green-500 to-emerald-600" },
  { id: "CASH", key: "cash", label: "Dinheiro", icon: Banknote, emoji: "💵", color: "from-slate-600 to-slate-700" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function MenuViewPage() {
  const { slug } = useParams();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [productNotes, setProductNotes] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [panel, setPanel] = useState<"none" | "cart" | "orders" | "info">("none");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"info" | "payment" | "review">("info");
  const [orderSent, setOrderSent] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [deliveryFeeLabel, setDeliveryFeeLabel] = useState("Grátis");
  const [deliveryBlocked, setDeliveryBlocked] = useState(false);
  const [feeLoading, setFeeLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    orderType: "DELIVERY" as "DELIVERY" | "PICKUP",
    cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
    paymentMethod: "CASH" as "PIX" | "CREDIT" | "DEBIT" | "MEAL" | "FOOD" | "CASH",
    paymentDetail: "",
    scheduledDate: "",
    scheduledTime: "",
  });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);

  const storeOpen = useMemo(() => checkIsOpen(tenant), [tenant]);
  const todayHours = useMemo(() => getTodayHours(tenant?.businessHours ?? null), [tenant]);
  const nextOpenInfo = useMemo(() => getNextOpenInfo(tenant?.businessHours ?? null), [tenant]);
  const total = cart.reduce((acc, item) => acc + (item.variant ? item.variant.price : item.product.price) * item.quantity, 0);
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  useEffect(() => {
    fetch(`/api/tenants/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setTenant(null); setLoading(false); return; }
        setTenant(data);
        if (data.categories?.length > 0) setActiveCategory(data.categories[0]?.id ?? "");
        setLoading(false);
      })
      .catch(() => { setTenant(null); setLoading(false); });

    socket.on("order-status-updated", (updated: Order) => {
      setActiveOrder((prev) => (prev?.id === updated.id ? updated : prev));
    });
    return () => { socket.off("order-status-updated"); };
  }, [slug]);

  useEffect(() => {
    const savedName = localStorage.getItem(`customer_name_${slug}`);
    const savedPhone = localStorage.getItem(`customer_phone_${slug}`);
    if (savedName || savedPhone) setForm((f) => ({ ...f, name: savedName ?? "", phone: maskPhone(savedPhone ?? "") }));
  }, [slug]);

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm((f) => ({ ...f, street: d.logradouro || "", neighborhood: d.bairro || "", city: d.localidade || "", state: d.uf || "" }));
        fetchDeliveryFee(digits);
      }
    } catch {}
  };

  const fetchDeliveryFee = async (cepDigits: string) => {
    if (!slug) return;
    setFeeLoading(true);
    try {
      const r = await fetch(`/api/tenants/${slug}/delivery-fee?cep=${cepDigits}`);
      const d = await r.json();
      setDeliveryFee(d.fee ?? 0);
      setDeliveryFeeLabel(d.label ?? "Grátis");
      setDeliveryBlocked(d.blocked === true);
    } catch {
      setDeliveryFee(0);
      setDeliveryFeeLabel("Grátis");
      setDeliveryBlocked(false);
    } finally {
      setFeeLoading(false);
    }
  };

  useEffect(() => {
    if (panel !== "orders") return;
    const phone = localStorage.getItem(`customer_phone_${slug}`);
    if (!phone) return;
    fetch(`/api/tenants/${slug}/customer-orders/${phone}`)
      .then((r) => r.json())
      .then(setCustomerOrders)
      .catch(() => {});
  }, [panel, slug]);

  // Scroll spy
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) setActiveCategory(e.target.id); });
      },
      { rootMargin: "-10% 0px -75% 0px" }
    );
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [tenant]);

  // Auto-scroll category nav pill into view
  useEffect(() => {
    if (!categoryNavRef.current) return;
    const active = categoryNavRef.current.querySelector(`[data-cat="${activeCategory}"]`) as HTMLElement;
    if (active) active.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeCategory]);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants?.length ? product.variants[0] : null);
    setProductNotes("");
    setProductQty(1);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart((prev) => [...prev, { product: selectedProduct, variant: selectedVariant ?? undefined, quantity: productQty, notes: productNotes }]);
    setSelectedProduct(null);
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const buildAddressStr = () => {
    if (form.orderType === "PICKUP") return "Retirada no Local";
    const parts = [
      form.street && form.number ? `${form.street}, ${form.number}` : form.street,
      form.complement, form.neighborhood,
      form.city && form.state ? `${form.city} - ${form.state}` : form.city,
      form.cep ? `CEP ${form.cep}` : "",
    ].filter(Boolean);
    return parts.join(", ");
  };

  const handleCheckout = async () => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone.replace(/\D/g, ""),
          address: buildAddressStr(),
          orderType: form.orderType,
          paymentMethod: form.paymentMethod,
          paymentDetail: form.paymentDetail,
          scheduledDate: form.scheduledDate || null,
          scheduledTime: (form as any).scheduledTime || null,
          tenantId: tenant?.id,
          deliveryFee,
          items: cart.map((item) => ({
            productId: item.product.id,
            productVariantId: item.variant?.id,
            quantity: item.quantity,
            notes: item.notes,
          })),
        }),
      });
      if (res.ok) {
        const order = await res.json();
        localStorage.setItem(`customer_name_${slug}`, form.name);
        localStorage.setItem(`customer_phone_${slug}`, form.phone.replace(/\D/g, ""));
        setActiveOrder(order);
        setOrderSent(true);
        setCart([]);
        setIsCheckoutOpen(false);
        setCheckoutStep("info");
        setPanel("none");
        setCartOpen(false);
      }
    } catch {}
  };

  const filteredCategories = useMemo(() => {
    if (!tenant?.categories) return [];
    return tenant.categories
      .map((cat) => ({
        ...cat,
        products: cat.products.filter(
          (p) =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [tenant, searchQuery]);

  // Featured products: first 6 products across all categories that have an image
  const featuredProducts = useMemo(() => {
    if (!tenant?.categories) return [];
    return tenant.categories
      .flatMap((c) => c.products)
      .filter((p) => p.imageUrl)
      .slice(0, 8);
  }, [tenant]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-transparent border-t-[#C9A227]"
          />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Carregando cardápio…</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="text-6xl mb-6">🍽️</div>
        <h1 className="text-2xl font-black text-slate-800 mb-2">Cardápio não encontrado</h1>
        <p className="text-slate-400 text-sm">Este estabelecimento não está disponível.</p>
      </div>
    );
  }

  const enabledPayments = (() => {
    try {
      if (tenant.paymentMethods) return JSON.parse(tenant.paymentMethods);
      return { pix: { enabled: true }, credit: { enabled: true }, debit: { enabled: true }, cash: { enabled: true } };
    } catch {
      return { pix: { enabled: true }, credit: { enabled: true }, debit: { enabled: true }, cash: { enabled: true } };
    }
  })();

  return (
    <div className="min-h-screen bg-[#F7F7F8]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* ══ DESKTOP LAYOUT: 2 columns ═══════════════════════════════════════════ */}
      <div className="lg:flex lg:min-h-screen">

        {/* ── DESKTOP LEFT SIDEBAR ─────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col lg:w-[380px] xl:w-[420px] shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white shadow-[1px_0_0_rgba(0,0,0,0.06)]">
          {/* Store hero */}
          <div className="relative overflow-hidden flex-shrink-0" style={{ background: "linear-gradient(160deg, #0f0f1a 0%, #1a1a35 100%)" }}>
            {/* Glow */}
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #C9A227 0%, transparent 70%)" }} />
            <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)" }} />

            <div className="relative p-8 pb-6">
              {/* Logo */}
              <div className="mb-5">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} className="w-20 h-20 rounded-2xl object-cover shadow-2xl ring-2 ring-white/10" alt="logo" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-2xl" style={{ background: "linear-gradient(135deg, #C9A227, #a37d1a)" }}>
                    {tenant.name?.[0] ?? "S"}
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-black text-white tracking-tight mb-1">{tenant.name}</h1>
              {tenant.description && <p className="text-white/50 text-sm leading-relaxed mb-4">{tenant.description}</p>}

              {/* Status row */}
              <div className="flex flex-wrap gap-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${storeOpen ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${storeOpen ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                  {storeOpen ? "Aberto agora" : "Fechado"}
                </div>
                {todayHours && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/50 text-[11px] font-medium">
                    <Clock className="w-3 h-3" />
                    {storeOpen ? todayHours : (nextOpenInfo ?? todayHours)}
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/50 text-[11px] font-medium">
                  <Bike className="w-3 h-3" />
                  Delivery
                </div>
              </div>
            </div>
          </div>

          {/* Desktop cart area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {cartCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <ShoppingCart className="w-7 h-7 text-slate-200" />
                </div>
                <p className="text-sm font-bold text-slate-400">Seu carrinho está vazio</p>
                <p className="text-xs text-slate-300 mt-1">Adicione itens do cardápio</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                      <span className="text-[10px] font-black text-white">{cartCount}</span>
                    </div>
                    <span className="text-sm font-black text-slate-800">Meu Carrinho</span>
                  </div>
                  <button onClick={() => setCart([])} className="text-[10px] font-black uppercase text-red-400 tracking-widest hover:text-red-500 transition-colors">
                    Limpar
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item, idx) => (
                      <motion.div
                        key={`${item.product.id}-${idx}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        layout
                        className="bg-slate-50 rounded-xl p-3 flex gap-3 border border-slate-100"
                      >
                        <img
                          src={item.product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"}
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                          alt={item.product.name}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-800 leading-snug">{item.product.name}</p>
                            <button onClick={() => removeItem(idx)} className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors border border-slate-200 shrink-0">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                          {item.variant && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">{item.variant.name}</span>}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-0.5">
                              <button onClick={() => updateQty(idx, -1)} className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <span className="text-[11px] font-black w-4 text-center">{item.quantity}</span>
                              <button onClick={() => updateQty(idx, 1)} className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <span className="text-xs font-black text-amber-500">{fmt((item.variant ? item.variant.price : item.product.price) * item.quantity)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="p-4 border-t border-slate-100 space-y-3 shrink-0">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Subtotal</span><span>{fmt(total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 font-medium">
                      <span>Entrega</span><span className="text-green-500">Calculada no checkout</span>
                    </div>
                    <div className="flex justify-between font-black text-sm text-slate-900 pt-1.5 border-t border-slate-100">
                      <span>Total</span><span className="text-amber-500">{fmt(total)}</span>
                    </div>
                  </div>
                  {!storeOpen && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 text-center">
                      <p className="text-[11px] font-bold text-red-500">Estabelecimento fechado — pedidos pausados</p>
                    </div>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setPanel("none"); setIsCheckoutOpen(true); }}
                    disabled={!storeOpen}
                    className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${storeOpen ? "text-white shadow-lg shadow-amber-900/10" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                    style={storeOpen ? { background: "linear-gradient(135deg, #C9A227 0%, #a37d1a 100%)" } : {}}
                  >
                    <Send className="w-4 h-4" />
                    Finalizar Pedido
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* Desktop quick links */}
          <div className="border-t border-slate-100 p-4 flex gap-2 shrink-0">
            <button
              onClick={() => setPanel("orders")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border border-slate-100"
            >
              <History className="w-3.5 h-3.5" /> Meus Pedidos
            </button>
            <button
              onClick={() => setPanel("info")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border border-slate-100"
            >
              <Info className="w-3.5 h-3.5" /> Info da Loja
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* ── MOBILE HEADER ─────────────────────────────────────────────── */}
          <div className="lg:hidden relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0f0f1a 0%, #1a1a35 100%)" }}>
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #C9A227 0%, transparent 70%)" }} />

            <div className="relative px-4 pt-10 pb-5">
              <div className="flex items-start gap-4 mb-4">
                {tenant.logoUrl ? (
                  <img src={tenant.logoUrl} className="w-16 h-16 rounded-2xl object-cover shadow-xl ring-2 ring-white/10 shrink-0" alt="logo" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl shrink-0" style={{ background: "linear-gradient(135deg, #C9A227, #a37d1a)" }}>
                    {tenant.name?.[0] ?? "S"}
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-1">
                  <h1 className="text-xl font-black text-white tracking-tight leading-tight">{tenant.name}</h1>
                  {tenant.description && <p className="text-white/40 text-xs mt-1 leading-relaxed line-clamp-2">{tenant.description}</p>}
                </div>
              </div>

              {/* Status pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${storeOpen ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${storeOpen ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                  {storeOpen ? "Aberto agora" : (nextOpenInfo ?? "Fechado")}
                </div>
                {todayHours && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 text-white/40 text-[11px] font-medium">
                    <Clock className="w-3 h-3" /> {todayHours}
                  </div>
                )}
                <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/10 text-white/40 text-[11px] font-medium">
                  <Bike className="w-3 h-3" /> Delivery
                </div>
              </div>

              {/* Mobile quick actions */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setPanel("orders")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-white/60 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <History className="w-3.5 h-3.5" /> Meus Pedidos
                </button>
                <button
                  onClick={() => setPanel("info")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold text-white/60 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <Info className="w-3.5 h-3.5" /> Info da Loja
                </button>
              </div>

              {/* Schedule banner */}
              {tenant.scheduleMode && (() => {
                let parsedDays: any[] = [];
                try { parsedDays = tenant.scheduleDays ? JSON.parse(tenant.scheduleDays) : []; } catch {}
                const enabledDays = parsedDays.filter((d: any) => d.enabled);
                const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                return (
                  <div className="rounded-2xl overflow-hidden mb-2" style={{ background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.3)" }}>
                    <div className="px-4 py-3 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">Encomendas</p>
                    </div>
                    {tenant.scheduleType === "OWNER_DEFINES" && enabledDays.length > 0 ? (
                      <div className="px-4 pb-3">
                        <div className="flex flex-wrap gap-1.5">
                          {enabledDays.map((d: any) => (
                            <div key={d.weekday} className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/30 rounded-full px-2.5 py-1">
                              <span className="text-[10px] font-black text-amber-200">{weekLabels[d.weekday]}</span>
                              {d.times?.length > 0 && <span className="text-[9px] text-amber-300/70">{d.times.join(", ")}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="px-4 pb-3 text-[10px] text-amber-200/70">Escolha a data no checkout.</p>
                    )}
                  </div>
                );
              })()}

              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-3.5 pl-10 pr-10 rounded-2xl text-sm font-medium text-white placeholder:text-white/30 focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4 text-white/40" />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom curve */}
            <div className="h-6 bg-[#F7F7F8] rounded-t-[24px]" />
          </div>

          {/* ── DESKTOP SEARCH BAR ─────────────────────────────────────────── */}
          <div className="hidden lg:block sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-3">
            <div className="flex items-center gap-4 max-w-3xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-10 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 bg-slate-50 border border-slate-100 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 transition-colors">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── CLOSED BANNER ──────────────────────────────────────────────── */}
          {!storeOpen && (
            <div className="mx-4 lg:mx-6 mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-700">Estabelecimento fechado</p>
                <p className="text-xs text-red-400 mt-0.5">{nextOpenInfo ?? "Você pode navegar, mas pedidos não estão disponíveis agora."}</p>
              </div>
            </div>
          )}

          {/* ── CATEGORY NAV ───────────────────────────────────────────────── */}
          <nav ref={categoryNavRef} className="sticky top-0 lg:top-[57px] z-30 overflow-x-auto no-scrollbar" style={{ background: "rgba(247,247,248,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
            <div className="flex gap-2 px-4 lg:px-6 py-3 w-max min-w-full">
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  data-cat={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`relative px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all duration-200 ${activeCategory === cat.id ? "text-white shadow-md shadow-slate-900/20" : "bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-slate-100"}`}
                  style={activeCategory === cat.id ? { background: "#0f0f1a" } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </nav>

          {/* ── FEATURED HORIZONTAL SCROLL ────────────────────────────────── */}
          {featuredProducts.length > 0 && !searchQuery && (
            <div className="pt-5 pb-2">
              <div className="flex items-center gap-2 px-4 lg:px-6 mb-3">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Destaques</span>
              </div>
              <div className="flex gap-3 px-4 lg:px-6 overflow-x-auto no-scrollbar pb-2">
                {featuredProducts.map((product, idx) => (
                  <FeaturedCard key={product.id} product={product} delay={idx * 0.05} onOpen={() => openProduct(product)} />
                ))}
              </div>
            </div>
          )}

          {/* ── PRODUCT SECTIONS ───────────────────────────────────────────── */}
          <div className="px-4 lg:px-6 pt-4 pb-36 lg:pb-10 space-y-8 max-w-4xl">
            {filteredCategories.length === 0 && searchQuery ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-slate-200" />
                </div>
                <h3 className="text-base font-black text-slate-700">Nenhum resultado</h3>
                <p className="text-slate-400 text-sm mt-1.5">Não encontramos "<span className="text-slate-600 font-bold">{searchQuery}</span>"</p>
                <button onClick={() => setSearchQuery("")} className="mt-4 text-[11px] font-black uppercase tracking-widest text-[#C9A227] hover:opacity-70 transition-opacity">
                  Limpar busca
                </button>
              </motion.div>
            ) : (
              filteredCategories.map((category, catIdx) => (
                <motion.section
                  key={category.id}
                  id={category.id}
                  ref={(el) => { sectionRefs.current[category.id] = el; }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.4, delay: catIdx * 0.04 }}
                  className="scroll-mt-28"
                >
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">{category.name}</h2>
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-full">{category.products.length}</span>
                  </div>

                  {/* Product grid: 1 col mobile, 2 col lg */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {category.products.map((product, pIdx) => (
                      <ProductCard key={product.id} product={product} delay={pIdx * 0.04} onOpen={() => openProduct(product)} />
                    ))}
                  </div>
                </motion.section>
              ))
            )}
          </div>
        </main>
      </div>

      {/* ── ACTIVE ORDER TRACKER (mobile) ────────────────────────────────────── */}
      <AnimatePresence>
        {activeOrder && activeOrder.status !== "DELIVERED" && activeOrder.status !== "CANCELLED" && (
          <motion.div
            key="tracker"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="fixed bottom-28 left-4 right-4 max-w-sm mx-auto z-40 lg:bottom-8 lg:left-auto lg:right-6 lg:max-w-xs"
          >
            <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 p-4 border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                  <Loader2 className="w-5 h-5 text-amber-500" />
                </motion.div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Pedido em andamento</p>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {activeOrder.status === "PENDING" ? "Aguardando confirmação…" :
                   activeOrder.status === "PREPARING" ? "Na cozinha 🍳" :
                   activeOrder.status === "SHIPPED" ? (activeOrder.orderType === "DELIVERY" ? "Saiu para entrega! 🛵" : "Pronto para retirada!") : ""}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE CART FAB ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            key="cart-fab"
            initial={{ y: 120, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 280, damping: 22 } }}
            exit={{ y: 120, opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="fixed bottom-5 left-4 right-4 max-w-sm mx-auto z-40 lg:hidden"
          >
            <motion.button
              onClick={() => setPanel("cart")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-[20px] text-white shadow-2xl shadow-black/30"
              style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1e293b 100%)" }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4 text-white" />
                  </div>
                  <motion.div
                    key={cartCount}
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] font-black border border-[#0f0f1a]"
                  >
                    {cartCount}
                  </motion.div>
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-white/40">Ver carrinho</span>
                  <span className="text-sm font-bold">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
                </div>
              </div>
              <motion.span key={total} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-black text-amber-400">
                {fmt(total)}
              </motion.span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCT DETAIL SHEET ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedProduct(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 34 }}
              className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
            >
              {/* Image */}
              <div className="relative h-52 sm:h-64 shrink-0 overflow-hidden bg-slate-100">
                <img
                  src={selectedProduct.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"}
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }} />
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {/* Price badge on image */}
                <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg">
                  <span className="text-base font-black text-amber-500">
                    {fmt(selectedVariant ? selectedVariant.price : selectedProduct.price)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Name + description */}
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">{selectedProduct.name}</h2>
                    {selectedProduct.description && (
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed">{selectedProduct.description}</p>
                    )}
                  </div>

                  {/* Variants */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escolha o tamanho</p>
                      <div className="space-y-2">
                        {selectedProduct.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariant(v)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-all ${selectedVariant?.id === v.id ? "border-amber-400 bg-amber-50" : "border-slate-100 bg-white hover:border-slate-200"}`}
                          >
                            <div className="text-left">
                              <span className={`text-sm font-bold ${selectedVariant?.id === v.id ? "text-amber-700" : "text-slate-700"}`}>{v.name}</span>
                              {v.description && <p className="text-[10px] text-slate-400 mt-0.5">{v.description}</p>}
                            </div>
                            <span className={`text-sm font-black ${selectedVariant?.id === v.id ? "text-amber-500" : "text-slate-800"}`}>{fmt(v.price)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Alguma observação?</p>
                    <textarea
                      value={productNotes}
                      onChange={(e) => setProductNotes(e.target.value)}
                      placeholder="Ex: sem cebola, ponto mal passado…"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-300 transition-all resize-none min-h-[72px] font-medium text-slate-700"
                    />
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between py-3.5 border-y border-slate-100">
                    <span className="text-sm font-bold text-slate-700">Quantidade</span>
                    <div className="flex items-center gap-4 bg-slate-50 rounded-2xl p-1.5 border border-slate-100">
                      <button onClick={() => setProductQty((q) => Math.max(1, q - 1))} className="w-9 h-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors border border-slate-100">
                        <Minus className="w-4 h-4" />
                      </button>
                      <motion.span key={productQty} initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-base font-black w-6 text-center text-slate-800">{productQty}</motion.span>
                      <button onClick={() => setProductQty((q) => q + 1)} className="w-9 h-9 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors border border-slate-100">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add button */}
              <div className="p-4 bg-white border-t border-slate-50 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={addToCart}
                  className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-black text-sm shadow-xl shadow-amber-900/10 transition-all"
                  style={{ background: "linear-gradient(135deg, #C9A227 0%, #a37d1a 100%)" }}
                >
                  <span>Adicionar ao carrinho</span>
                  <span>{fmt((selectedVariant ? selectedVariant.price : selectedProduct.price) * productQty)}</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SLIDE PANELS (Cart / Orders / Info) ──────────────────────────────── */}
      <AnimatePresence>
        {panel !== "none" && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPanel("none")}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]"
            />
            <motion.div
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[120] flex flex-col shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <button onClick={() => setPanel("none")} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                  </button>
                  <h2 className="text-base font-black text-slate-900">
                    {panel === "cart" ? "Meu Carrinho" : panel === "orders" ? "Meus Pedidos" : "Info da Loja"}
                  </h2>
                </div>
                {panel === "cart" && cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-[10px] font-black uppercase text-red-400 tracking-widest px-3 py-1.5 bg-red-50 rounded-full hover:bg-red-100 transition-colors">
                    Limpar
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {panel === "cart" && <CartPanel cart={cart} total={total} deliveryFee={deliveryFee} storeOpen={storeOpen} fmt={fmt} updateQty={updateQty} removeItem={removeItem} onCheckout={() => { setPanel("none"); setIsCheckoutOpen(true); }} />}
                {panel === "orders" && <OrdersPanel orders={customerOrders} fmt={fmt} phone={localStorage.getItem(`customer_phone_${slug}`)} />}
                {panel === "info" && <InfoPanel tenant={tenant} enabledPayments={enabledPayments} />}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CHECKOUT MODAL ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsCheckoutOpen(false); setCheckoutStep("info"); }} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="relative bg-white w-full max-w-lg sm:rounded-[28px] rounded-t-[28px] shadow-2xl max-h-[95vh] flex flex-col"
            >
              <div className="flex justify-center pt-3 pb-1 shrink-0 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-slate-200" />
              </div>

              <div className="px-5 pb-4 pt-3 flex items-center gap-3 shrink-0 border-b border-slate-100">
                {checkoutStep !== "info" && (
                  <button
                    onClick={() => setCheckoutStep(checkoutStep === "review" ? "payment" : "info")}
                    className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                  </button>
                )}
                <div className="flex-1">
                  <h2 className="text-base font-black text-slate-900">
                    {checkoutStep === "info" ? "Seus Dados" : checkoutStep === "payment" ? "Forma de Pagamento" : "Confirmar Pedido"}
                  </h2>
                  <div className="flex gap-1 mt-1.5">
                    {(["info", "payment", "review"] as const).map((s) => (
                      <div key={s} className={`h-1 rounded-full transition-all duration-300 ${checkoutStep === s ? "flex-1 bg-amber-400" : "w-5 bg-slate-200"}`} />
                    ))}
                  </div>
                </div>
                <button onClick={() => { setIsCheckoutOpen(false); setCheckoutStep("info"); }} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
                <AnimatePresence mode="wait">
                  {checkoutStep === "info" && (
                    <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                        {(["DELIVERY", "PICKUP"] as const).map((type) => (
                          <button key={type} onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${form.orderType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}>
                            {type === "DELIVERY" ? <><Truck className="w-3.5 h-3.5" /> Delivery</> : <><Store className="w-3.5 h-3.5" /> Retirada</>}
                          </button>
                        ))}
                      </div>

                      <CField label="Nome completo">
                        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Como devo te chamar?" className={cinput} />
                      </CField>
                      <CField label="WhatsApp">
                        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" type="tel" inputMode="numeric" className={cinput} />
                      </CField>

                      {form.orderType === "DELIVERY" && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Endereço de entrega</p>
                          <div className="flex gap-2">
                            <CField label="CEP" className="flex-1">
                              <div className="relative">
                                <input value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))} onBlur={(e) => fetchCep(e.target.value)} placeholder="00000-000" inputMode="numeric" className={cinput} />
                                {feeLoading && <Loader2 className="w-4 h-4 animate-spin text-amber-400 absolute right-3 top-1/2 -translate-y-1/2" />}
                              </div>
                            </CField>
                            <button type="button" onClick={() => fetchCep(form.cep)} className="self-end mb-0.5 px-4 py-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap">
                              Buscar
                            </button>
                          </div>

                          {form.cep.replace(/\D/g, "").length === 8 && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${deliveryBlocked ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                              {deliveryBlocked ? <X className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                              {deliveryBlocked ? "Fora da área de entrega" : `Taxa de entrega: ${deliveryFeeLabel}`}
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2">
                            <CField label="Rua / Av." className="col-span-2">
                              <input value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} placeholder="Rua, Avenida…" className={cinput} />
                            </CField>
                            <CField label="Número">
                              <input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="123" inputMode="numeric" className={cinput} />
                            </CField>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <CField label="Complemento">
                              <input value={form.complement} onChange={(e) => setForm((f) => ({ ...f, complement: e.target.value }))} placeholder="Apto, Sala…" className={cinput} />
                            </CField>
                            <CField label="Bairro">
                              <input value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} placeholder="Bairro" className={cinput} />
                            </CField>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <CField label="Cidade" className="col-span-2">
                              <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Cidade" className={cinput} />
                            </CField>
                            <CField label="UF">
                              <input value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" className={cinput} maxLength={2} />
                            </CField>
                          </div>
                        </div>
                      )}

                      {form.orderType === "PICKUP" && (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Retirada no local</p>
                            <p className="text-sm font-bold text-blue-800">{tenant.address || "Consulte o estabelecimento"}</p>
                          </div>
                        </div>
                      )}

                      {/* Schedule mode */}
                      {tenant.scheduleMode && (() => {
                        const scheduleType = tenant.scheduleType ?? "CLIENT_CHOOSES";
                        let parsedDays: any[] = [];
                        try { parsedDays = tenant.scheduleDays ? JSON.parse(tenant.scheduleDays) : []; } catch {}
                        const enabledDays = parsedDays.filter((d: any) => d.enabled);

                        if (scheduleType === "OWNER_DEFINES" && enabledDays.length > 0) {
                          const slots: { date: string; label: string; time: string }[] = [];
                          const now = new Date();
                          for (let i = 1; i <= 56; i++) {
                            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
                            const dayConfig = enabledDays.find((ed: any) => ed.weekday === d.getDay());
                            if (!dayConfig) continue;
                            const iso = d.toISOString().split("T")[0];
                            const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
                            for (const t of (dayConfig.times || [])) {
                              slots.push({ date: iso, label, time: t });
                            }
                          }
                          const slotKey = form.scheduledDate && (form as any).scheduledTime ? `${form.scheduledDate}|${(form as any).scheduledTime}` : "";
                          return (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-amber-500" /> Data e Horário</p>
                              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-3">
                                {tenant.scheduleNotes && <p className="text-xs text-amber-700 italic">{tenant.scheduleNotes}</p>}
                                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                                  {slots.slice(0, 20).map(slot => {
                                    const key = `${slot.date}|${slot.time}`;
                                    return (
                                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, scheduledDate: slot.date, scheduledTime: slot.time } as any))}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${slotKey === key ? "bg-amber-400 border-amber-400 text-white" : "bg-white border-amber-200 text-slate-700 hover:border-amber-300"}`}>
                                        <span className="capitalize">{slot.label}</span>
                                        <span className="font-black">{slot.time}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-amber-500" /> Data da Encomenda</p>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                              {tenant.scheduleNotes && <p className="text-xs text-amber-700 italic">{tenant.scheduleNotes}</p>}
                              <input type="date" value={form.scheduledDate} min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-400" />
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const scheduleOk = !tenant.scheduleMode || (!!form.scheduledDate && (tenant.scheduleType !== "OWNER_DEFINES" || !!(form as any).scheduledTime));
                        const canContinue = !!form.name && form.phone.replace(/\D/g, "").length >= 10 && !(form.orderType === "DELIVERY" && deliveryBlocked) && scheduleOk;
                        return (
                          <motion.button whileTap={{ scale: 0.97 }} disabled={!canContinue} onClick={() => setCheckoutStep("payment")}
                            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all mt-2 ${canContinue ? "text-white shadow-lg" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                            style={canContinue ? { background: "linear-gradient(135deg, #0f0f1a 0%, #1e293b 100%)" } : {}}>
                            Continuar <ChevronRight className="w-4 h-4" />
                          </motion.button>
                        );
                      })()}
                    </motion.div>
                  )}

                  {checkoutStep === "payment" && (
                    <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS_CONFIG.filter(m => enabledPayments[m.key]?.enabled !== false).map((m) => (
                          <button key={m.id} onClick={() => setForm((f) => ({ ...f, paymentMethod: m.id }))}
                            className={`flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border-2 text-sm font-bold transition-all ${form.paymentMethod === m.id ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-500 border-slate-100 hover:border-slate-200"}`}>
                            <span className="text-base">{m.emoji}</span> {m.label}
                          </button>
                        ))}
                      </div>

                      {(form.paymentMethod === "CREDIT" || form.paymentMethod === "DEBIT" || form.paymentMethod === "MEAL" || form.paymentMethod === "FOOD") && (
                        <CField label="Bandeira">
                          <select value={form.paymentDetail} onChange={(e) => setForm((f) => ({ ...f, paymentDetail: e.target.value }))} className={cinput}>
                            <option value="">Escolha a bandeira</option>
                            {["Visa", "Mastercard", "Elo", "Alelo", "Sodexo", "Ticket", "VR Benefícios", "VeroCard"].map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </CField>
                      )}

                      {form.paymentMethod === "CASH" && (
                        <CField label={(() => {
                          try { const p = tenant?.paymentMethods ? JSON.parse(tenant.paymentMethods) : {}; return p.cash?.allowChange === false ? "Observação" : "Troco para quanto? (opcional)"; } catch { return "Troco para quanto? (opcional)"; }
                        })()}>
                          <input value={form.paymentDetail} onChange={(e) => setForm((f) => ({ ...f, paymentDetail: e.target.value }))} placeholder="Ex: R$ 50,00 — deixe em branco se não precisar" className={cinput} />
                        </CField>
                      )}

                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setCheckoutStep("review")}
                        className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white shadow-lg mt-2"
                        style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1e293b 100%)" }}>
                        Revisar Pedido <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  )}

                  {checkoutStep === "review" && (
                    <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                      <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seus dados</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800">{form.name}</span>
                          <span className="text-xs text-slate-500">{form.phone}</span>
                        </div>
                        {form.orderType === "DELIVERY" && <p className="text-xs text-slate-500 leading-relaxed">{buildAddressStr()}</p>}
                        {form.orderType === "PICKUP" && <p className="text-xs text-slate-500">Retirada no local</p>}
                        {form.scheduledDate && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <CalendarDays className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-xs font-black text-amber-700">
                              Encomenda para {new Date(form.scheduledDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Itens do pedido</p>
                        {cart.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                            <span className="text-slate-700 font-medium">{item.quantity}× {item.product.name}{item.variant ? ` (${item.variant.name})` : ""}</span>
                            <span className="font-bold text-slate-800">{fmt((item.variant ? item.variant.price : item.product.price) * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-400 font-bold">
                          <span>Subtotal</span><span>{fmt(total)}</span>
                        </div>
                        {form.orderType === "DELIVERY" && (
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-400">Taxa de entrega</span>
                            <span className={deliveryFee === 0 ? "text-green-600" : "text-slate-700"}>{deliveryFeeLabel}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t border-slate-100">
                          <span>Total</span>
                          <span className="text-amber-500">{fmt(total + (form.orderType === "DELIVERY" ? deliveryFee : 0))}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center border border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Pagamento</span>
                        <span className="text-xs font-black text-slate-800">
                          {PAYMENT_METHODS_CONFIG.find(m => m.id === form.paymentMethod)?.label ?? form.paymentMethod}
                          {form.paymentDetail ? ` · ${form.paymentDetail}` : ""}
                        </span>
                      </div>

                      <motion.button whileTap={{ scale: 0.97 }} onClick={handleCheckout}
                        className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-black text-sm shadow-xl mt-2"
                        style={{ background: "linear-gradient(135deg, #C9A227 0%, #a37d1a 100%)" }}>
                        <span>Confirmar e Enviar</span>
                        <div className="flex items-center gap-2">
                          <span>{fmt(total + (form.orderType === "DELIVERY" ? deliveryFee : 0))}</span>
                          <Send className="w-4 h-4" />
                        </div>
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SUCCESS OVERLAY ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {orderSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white p-10 text-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }}
              className="w-28 h-28 rounded-full bg-green-50 flex items-center justify-center mb-8"
            >
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h2 className="text-3xl font-black text-slate-900 mb-3">Pedido Enviado!</h2>
              <p className="text-slate-400 text-sm max-w-xs leading-relaxed">Nossa equipe já recebeu seu pedido e está preparando.</p>
            </motion.div>
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOrderSent(false)}
              className="mt-10 px-12 py-4 rounded-2xl text-white font-black shadow-xl"
              style={{ background: "linear-gradient(135deg, #0f0f1a 0%, #1e293b 100%)" }}
            >
              Entendido!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Checkout field helpers ───────────────────────────────────────────────────
const cinput = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 transition-all text-slate-700";

function CField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      {children}
    </div>
  );
}

// ─── FeaturedCard (horizontal scroll) ────────────────────────────────────────
function FeaturedCard({ product, delay, onOpen }: { product: Product; delay: number; onOpen: () => void }) {
  const price = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.price;

  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileTap={{ scale: 0.96 }}
      className="shrink-0 w-36 text-left group"
    >
      <div className="relative w-36 h-36 rounded-2xl overflow-hidden shadow-md shadow-black/10 mb-2">
        <img
          src={product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          alt={product.name}
          loading="lazy"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)" }} />
        <div className="absolute bottom-2.5 left-2.5">
          <span className="text-xs font-black text-white">{fmt(price)}</span>
        </div>
        <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
          <Plus className="w-3 h-3 text-slate-700" />
        </div>
      </div>
      <p className="text-xs font-bold text-slate-700 leading-snug line-clamp-2 group-hover:text-amber-600 transition-colors">{product.name}</p>
    </motion.button>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────
function ProductCard({ product, delay, onOpen }: { product: Product; delay: number; onOpen: () => void }) {
  const minPrice = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.price;
  const hasVariants = product.variants && product.variants.length > 0;
  const hasImage = !!product.imageUrl;

  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.35 }}
      whileTap={{ scale: 0.98 }}
      className="w-full text-left group"
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:border-amber-200 hover:shadow-md transition-all duration-300">
        {/* Image top (if exists) */}
        {hasImage && (
          <div className="relative w-full h-40 overflow-hidden bg-slate-50">
            <img
              src={product.imageUrl!}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              alt={product.name}
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 50%)" }} />
            <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-white shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-4 h-4 text-slate-700" />
            </div>
          </div>
        )}

        {/* Text body */}
        <div className={`p-3.5 flex gap-2 ${!hasImage ? "" : ""}`}>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-amber-600 transition-colors">{product.name}</h3>
            {product.description && (
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
            )}
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-sm font-black text-amber-500">
                {hasVariants ? "A partir de " : ""}
                {fmt(minPrice)}
              </span>
              {!hasImage && (
                <span className="ml-auto w-7 h-7 rounded-xl bg-slate-900 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </div>
          </div>

          {/* Thumbnail for products WITHOUT a full-width image */}
          {!hasImage && (
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-50 shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-2xl">
                🍽️
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── CartPanel ───────────────────────────────────────────────────────────────
function CartPanel({ cart, total, deliveryFee, storeOpen, fmt, updateQty, removeItem, onCheckout }: {
  cart: CartItem[]; total: number; deliveryFee: number; storeOpen: boolean; fmt: (n: number) => string;
  updateQty: (i: number, d: number) => void; removeItem: (i: number) => void; onCheckout: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-5">
          <ShoppingCart className="w-9 h-9 text-slate-200" />
        </div>
        <h3 className="text-lg font-black text-slate-800">Carrinho vazio</h3>
        <p className="text-slate-400 text-sm mt-2 max-w-[200px]">Adicione itens do cardápio para começar.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {cart.map((item, idx) => (
            <motion.div
              key={`${item.product.id}-${idx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              layout
              className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3 shadow-sm"
            >
              <img
                src={item.product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"}
                className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-50"
                alt={item.product.name}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.product.name}</h4>
                  <button onClick={() => removeItem(idx)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-400 transition-colors shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {item.variant && <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">{item.variant.name}</span>}
                {item.notes && <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">"{item.notes}"</p>}
                <div className="flex items-center justify-between mt-2.5">
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                    <button onClick={() => updateQty(idx, -1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black w-5 text-center text-slate-800">{item.quantity}</span>
                    <button onClick={() => updateQty(idx, 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-sm font-black text-amber-500">{fmt((item.variant ? item.variant.price : item.product.price) * item.quantity)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="p-5 border-t border-slate-100 space-y-4 shrink-0 bg-white">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Subtotal</span><span>{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Taxa de entrega</span>
            <span className="text-green-500">Calculada no checkout</span>
          </div>
          <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
            <span>Total</span>
            <span className="text-amber-500">{fmt(total)}</span>
          </div>
        </div>
        {!storeOpen && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            <p className="text-xs font-bold text-red-500">Estabelecimento fechado — pedidos pausados</p>
          </div>
        )}
        <motion.button
          whileTap={{ scale: storeOpen ? 0.97 : 1 }}
          onClick={onCheckout}
          disabled={!storeOpen}
          className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${storeOpen ? "text-white shadow-xl" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
          style={storeOpen ? { background: "linear-gradient(135deg, #C9A227 0%, #a37d1a 100%)" } : {}}
        >
          <Send className="w-4 h-4" />
          <span>Finalizar Pedido</span>
        </motion.button>
      </div>
    </div>
  );
}

// ─── OrdersPanel ─────────────────────────────────────────────────────────────
function OrdersPanel({ orders, fmt, phone }: { orders: Order[]; fmt: (n: number) => string; phone: string | null }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-5">
          <History className="w-9 h-9 text-slate-200" />
        </div>
        <h3 className="text-lg font-black text-slate-800">Sem pedidos</h3>
        <p className="text-slate-400 text-sm mt-2">Você ainda não fez nenhum pedido por aqui.</p>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-3 pb-8">
      {orders.map((order) => {
        const st = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] ?? ORDER_STATUS.PENDING;
        return (
          <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`bg-white rounded-2xl border ${st.border} p-4 space-y-3 shadow-sm`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pedido #{order.id.slice(-4).toUpperCase()}</span>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full ${st.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                <span className={`text-[10px] font-black ${st.color}`}>{st.label}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>{item.quantity}x {item.product?.name}</span>
                  <span>{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
              <span className="text-sm font-black text-amber-500">{fmt(order.total)}</span>
            </div>
          </motion.div>
        );
      })}
      {phone && <p className="text-center text-[10px] text-slate-300 font-bold tracking-widest uppercase pt-2">{phone}</p>}
    </div>
  );
}

// ─── InfoPanel ───────────────────────────────────────────────────────────────
function InfoPanel({ tenant, enabledPayments }: { tenant: Tenant; enabledPayments: Record<string, { enabled: boolean }> }) {
  const DAY_LABELS: Record<string, string> = { sun: "Dom", mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb" };

  let hours: Record<string, { enabled: boolean; open: string; close: string }> | null = null;
  try { if (tenant.businessHours) hours = JSON.parse(tenant.businessHours); } catch {}

  const addressStr = (() => {
    if (!tenant.address) return null;
    try {
      const a = JSON.parse(tenant.address);
      const parts = [
        a.street && a.number ? `${a.street}, ${a.number}` : a.street || "",
        a.complement, a.neighborhood,
        a.city && a.state ? `${a.city} - ${a.state}` : a.city || a.state,
        a.cep ? `CEP ${a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
      ].filter(Boolean);
      return parts.length ? parts.join(", ") : null;
    } catch {
      return typeof tenant.address === "string" && !tenant.address.startsWith("{") ? tenant.address : null;
    }
  })();

  const whatsappStr = (() => {
    if (!tenant.whatsapp) return null;
    const d = String(tenant.whatsapp).replace(/\D/g, "");
    const clean = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return clean;
  })();

  const cardClass = "bg-white rounded-2xl border border-slate-100 p-4 shadow-sm";
  const iconWrap = (color: string) => `w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0`;

  return (
    <div className="p-4 space-y-3 pb-8">
      {addressStr && (
        <div className={cardClass}>
          <div className="flex gap-3">
            <div className={iconWrap("bg-blue-50")}>
              <MapPin className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Endereço</p>
              <p className="text-sm font-bold text-slate-800 leading-relaxed">{addressStr}</p>
            </div>
          </div>
        </div>
      )}

      {whatsappStr && (
        <div className={cardClass}>
          <div className="flex gap-3">
            <div className={iconWrap("bg-green-50")}>
              <Phone className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">WhatsApp</p>
              <p className="text-sm font-bold text-slate-800">{whatsappStr}</p>
            </div>
          </div>
        </div>
      )}

      {hours && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 mb-4">
            <div className={iconWrap("bg-amber-50")}>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horários</p>
          </div>
          <div className="space-y-2">
            {DAY_KEYS.map((key) => {
              const d = hours![key];
              const isToday = DAY_KEYS[new Date().getDay()] === key;
              return (
                <div key={key} className={`flex items-center justify-between py-1.5 rounded-lg ${isToday ? "bg-amber-50 px-2 -mx-2" : ""}`}>
                  <span className={`text-xs font-bold ${isToday ? "text-amber-700" : "text-slate-500"}`}>{DAY_LABELS[key]}{isToday && " ·"}{isToday && <span className="text-amber-500"> hoje</span>}</span>
                  <span className={`text-xs font-black ${d?.enabled ? (isToday ? "text-amber-600" : "text-slate-700") : "text-slate-300"}`}>
                    {d?.enabled ? `${d.open} – ${d.close}` : "Fechado"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <div className={iconWrap("bg-violet-50")}>
            <CreditCard className="w-4 h-4 text-violet-500" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pagamentos Aceitos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS_CONFIG.filter(m => enabledPayments[m.key]?.enabled !== false).map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
