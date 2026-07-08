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
  CheckCircle2,
  Clock,
  ChevronRight,
  Bike,
  CalendarDays,
  Flame,
  Info,
  Phone,
  Package,
  Layers,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, Order, ProductVariant, ProductBundle, BundleCartItem, BundleStepSelection } from "../../types";
import BundleModal from "./BundleModal";

// ─── Theme ────────────────────────────────────────────────────────────────────
const BRAND = "#C9A227";
const BRAND_DARK = "#a37d1a";
const BRAND_LIGHT = "#FFF8E7";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  } catch { return true; }
}

function getTodayHours(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const hours = JSON.parse(raw);
    const dayKey = DAY_KEYS[new Date().getDay()];
    const d = hours[dayKey];
    if (!d?.enabled) return "Fechado hoje";
    return `${d.open}–${d.close}`;
  } catch { return null; }
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
  } catch { return null; }
}

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
  type?: "product";
  product: Product;
  variant?: ProductVariant;
  quantity: number;
  notes: string;
}

type AnyCartItem = CartItem | BundleCartItem;

const ORDER_STATUS = {
  PENDING:   { label: "Aguardando",  color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200",  dot: "bg-amber-400" },
  PREPARING: { label: "Na cozinha",  color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
  SHIPPED:   { label: "A caminho",   color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   dot: "bg-blue-400"   },
  DELIVERED: { label: "Entregue",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  dot: "bg-green-400"  },
  CANCELLED: { label: "Cancelado",   color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200",    dot: "bg-red-400"    },
};

const PAYMENT_METHODS_CONFIG = [
  { id: "PIX",    key: "pix",    label: "Pix",               icon: Send,       emoji: "💎", color: "from-emerald-500 to-teal-600" },
  { id: "CREDIT", key: "credit", label: "Crédito",           icon: CreditCard, emoji: "💳", color: "from-blue-500 to-indigo-600" },
  { id: "DEBIT",  key: "debit",  label: "Débito",            icon: CreditCard, emoji: "💳", color: "from-violet-500 to-purple-600" },
  { id: "MEAL",   key: "meal",   label: "Vale Refeição",     icon: Wallet,     emoji: "🍱", color: "from-orange-500 to-amber-600" },
  { id: "FOOD",   key: "food",   label: "Vale Alimentação",  icon: Wallet,     emoji: "🛒", color: "from-green-500 to-emerald-600" },
  { id: "CASH",   key: "cash",   label: "Dinheiro",          icon: Banknote,   emoji: "💵", color: "from-slate-600 to-slate-700" },
] as const;

// ─── Tenant Splash Screen ─────────────────────────────────────────────────────
function TenantSplash({ tenant, onDone }: { tenant: Tenant; onDone: () => void }) {
  const initials = tenant.name
    ? tenant.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #1a1a1a 60%, #111 100%)" }}
    >
      {/* Glow rings */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1.2], opacity: [0, 0.18, 0.12] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }}
      />
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.8, 1.6], opacity: [0, 0.08, 0.06] }}
        transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
        className="absolute w-96 h-96 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }}
      />

      {/* Logo or initials */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative mb-7"
      >
        {tenant.logoUrl ? (
          <div className="relative">
            <motion.div
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-3xl blur-2xl scale-110"
              style={{ background: BRAND, opacity: 0.3 }}
            />
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="relative w-28 h-28 rounded-3xl object-cover shadow-2xl ring-2 ring-white/10"
            />
          </div>
        ) : (
          <div className="relative">
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-3xl blur-2xl scale-125"
              style={{ background: BRAND }}
            />
            <div
              className="relative w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl ring-2 ring-white/10"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
            >
              <span className="text-4xl font-black text-white tracking-tighter">{initials}</span>
            </div>
          </div>
        )}
      </motion.div>

      {/* Name */}
      <div className="overflow-hidden mb-2">
        <motion.h1
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6, ease: "circOut" }}
          className="text-3xl font-black text-white tracking-tight text-center px-8"
        >
          {tenant.name}
        </motion.h1>
      </div>

      {tenant.description && (
        <div className="overflow-hidden">
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5, ease: "circOut" }}
            className="text-sm text-white/40 text-center px-10 leading-relaxed"
          >
            {tenant.description}
          </motion.p>
        </div>
      )}

      {/* Loading dots */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="absolute bottom-16 flex gap-2"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            animate={{ scale: [1, 1.6, 1], opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
            style={{ background: BRAND }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// Formata o endereço do estabelecimento (guardado como JSON) em uma linha legível.
// tenant.address nunca deve ser renderizado direto — vem como '{"street":...}'.
function formatTenantAddress(rawAddress: string | null | undefined): string | null {
  if (!rawAddress) return null;
  try {
    const a = JSON.parse(rawAddress);
    const parts = [
      a.street && a.number ? `${a.street}, ${a.number}` : a.street || "",
      a.complement, a.neighborhood,
      a.city && a.state ? `${a.city} - ${a.state}` : a.city || a.state,
      a.cep ? `CEP ${a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : "",
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return typeof rawAddress === "string" && !rawAddress.startsWith("{") ? rawAddress : null;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MenuViewPage() {
  const { slug } = useParams();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<ProductBundle | null>(null);
  const [cart, setCart] = useState<AnyCartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "",
    orderType: "DELIVERY" as "DELIVERY" | "PICKUP",
    cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
    paymentMethod: "CASH" as "PIX" | "CREDIT" | "DEBIT" | "MEAL" | "FOOD" | "CASH",
    paymentDetail: "",
    scheduledDate: "", scheduledTime: "",
    isPreorder: false,
  });

  // Cliente já cadastrado (identificado pelo telefone) — endereços salvos e pontos de fidelidade
  const [savedCustomer, setSavedCustomer] = useState<{ name: string; loyaltyPoints: number; addresses: any[] } | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new" | null>(null);
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const storeOpen = tenant?.effectiveIsOpen ?? (tenant ? checkIsOpen(tenant) : false);
  const deliveryOpen = tenant?.isDeliveryOpen ?? true;
  const todayHours = useMemo(() => getTodayHours(tenant?.businessHours ?? null), [tenant]);
  const nextOpenInfo = useMemo(() => getNextOpenInfo(tenant?.businessHours ?? null), [tenant]);
  const total = cart.reduce((acc, item) => {
    if ((item as BundleCartItem).type === "bundle") return acc + (item as BundleCartItem).bundle.price * item.quantity;
    const ci = item as CartItem;
    return acc + (ci.variant ? ci.variant.price : ci.product.price) * item.quantity;
  }, 0);
  const cartCount = cart.reduce((a, b) => a + b.quantity, 0);

  useEffect(() => {
    fetch(`/api/tenants/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setTenant(null); setLoading(false); setSplashDone(true); return; }
        setTenant(data);
        if (data.categories?.length > 0) setActiveCategory(data.categories[0]?.id ?? "");
        setLoading(false);
      })
      .catch(() => { setTenant(null); setLoading(false); setSplashDone(true); });

    fetch(`/api/tenants/${slug}/bundles`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBundles(data); })
      .catch(() => {});

    socket.on("order-status-updated", (updated: Order) => {
      setActiveOrder((prev) => (prev?.id === updated.id ? updated : prev));
    });
    return () => { socket.off("order-status-updated"); };
  }, [slug]);

  // Quando delivery é pausado pelo estabelecimento, redireciona automaticamente para Retirada
  useEffect(() => {
    if (!deliveryOpen && form.orderType === "DELIVERY") {
      setForm(f => ({ ...f, orderType: "PICKUP" }));
    }
  }, [deliveryOpen]);

  useEffect(() => {
    const savedName = localStorage.getItem(`customer_name_${slug}`);
    const savedPhone = localStorage.getItem(`customer_phone_${slug}`);
    if (savedName || savedPhone)
      setForm((f) => ({ ...f, name: savedName ?? "", phone: maskPhone(savedPhone ?? "") }));
  }, [slug]);

  // Ao completar o telefone (11 dígitos = celular com DDD), busca se o cliente já existe.
  // Se existir, pré-preenche o nome e mostra os endereços salvos para escolha rápida.
  useEffect(() => {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length !== 11) {
      setSavedCustomer(null);
      setSelectedAddressId(null);
      return;
    }
    let cancelled = false;
    setCustomerLookupLoading(true);
    fetch(`/api/tenants/${slug}/public-customer/${digits}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSavedCustomer(data);
        if (data) {
          setForm((f) => ({ ...f, name: f.name || data.name }));
          const defaultAddr = data.addresses?.find((a: any) => a.isDefault) || data.addresses?.[0];
          setSelectedAddressId(defaultAddr ? defaultAddr.id : (data.addresses?.length ? null : "new"));
        } else {
          setSelectedAddressId("new");
        }
      })
      .catch(() => { if (!cancelled) { setSavedCustomer(null); setSelectedAddressId("new"); } })
      .finally(() => { if (!cancelled) setCustomerLookupLoading(false); });
    return () => { cancelled = true; };
  }, [form.phone, slug]);

  // Ao escolher um endereço salvo, preenche os campos do formulário automaticamente
  useEffect(() => {
    if (!selectedAddressId || selectedAddressId === "new" || !savedCustomer) return;
    const addr = savedCustomer.addresses.find((a: any) => a.id === selectedAddressId);
    if (!addr) return;
    setForm((f) => ({
      ...f,
      cep: addr.cep || "", street: addr.street || "", number: addr.number || "",
      complement: addr.complement || "", neighborhood: addr.neighborhood || "",
      city: addr.city || "", state: addr.state || "",
    }));
  }, [selectedAddressId, savedCustomer]);

  // Scroll spy + header collapse
  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = heroRef.current?.offsetHeight ?? 200;
      setHeaderCollapsed(window.scrollY > heroHeight - 60);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveCategory(e.target.id); }); },
      { rootMargin: "-10% 0px -75% 0px" }
    );
    Object.values(sectionRefs.current).forEach((ref) => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, [tenant]);

  useEffect(() => {
    if (!categoryNavRef.current) return;
    const active = categoryNavRef.current.querySelector(`[data-cat="${activeCategory}"]`) as HTMLElement;
    if (active) active.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
  }, [activeCategory]);

  useEffect(() => {
    if (panel !== "orders") return;
    const phone = localStorage.getItem(`customer_phone_${slug}`);
    if (!phone) return;
    fetch(`/api/tenants/${slug}/customer-orders/${phone}`)
      .then((r) => r.json())
      .then(setCustomerOrders)
      .catch(() => {});
  }, [panel, slug]);

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
      setDeliveryFee(0); setDeliveryFeeLabel("Grátis"); setDeliveryBlocked(false);
    } finally { setFeeLoading(false); }
  };

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 112;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedVariant(product.variants?.length ? product.variants[0] : null);
    setProductNotes(""); setProductQty(1);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart((prev) => [...prev, { product: selectedProduct, variant: selectedVariant ?? undefined, quantity: productQty, notes: productNotes }]);
    setSelectedProduct(null);
  };

  const updateQty = (idx: number, delta: number) =>
    setCart((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));

  const removeItem = (idx: number) => setCart((prev) => prev.filter((_, i) => i !== idx));

  const addBundle = (bundle: ProductBundle, selections: BundleStepSelection[], notes: string, qty: number) => {
    const item: BundleCartItem = { type: "bundle", bundle, selections, quantity: qty, notes };
    setCart((prev) => [...prev, item]);
    setSelectedBundle(null);
  };

  const buildAddressStr = () => {
    if (form.orderType === "PICKUP") return "Retirada no Local";
    return [
      form.street && form.number ? `${form.street}, ${form.number}` : form.street,
      form.complement, form.neighborhood,
      form.city && form.state ? `${form.city} - ${form.state}` : form.city,
      form.cep ? `CEP ${form.cep}` : "",
    ].filter(Boolean).join(", ");
  };

  const handleCheckout = async () => {
    try {
      // Separar itens normais de bundles
      const regularItems = cart
        .filter((i) => (i as BundleCartItem).type !== "bundle")
        .map((i) => {
          const ci = i as CartItem;
          return { productId: ci.product.id, productVariantId: ci.variant?.id, quantity: ci.quantity, notes: ci.notes };
        });

      // Bundles viram notas do pedido (não têm productId próprio)
      const bundleNotes = cart
        .filter((i) => (i as BundleCartItem).type === "bundle")
        .map((i) => {
          const bi = i as BundleCartItem;
          const lines = bi.selections.map((s) => {
            if (s.flavorMode === "half") return `${s.stepLabel}: ½ ${s.halfA?.productName} + ½ ${s.halfB?.productName}`;
            return `${s.stepLabel}: ${s.productName}${s.variantName ? ` (${s.variantName})` : ""}`;
          });
          return `[COMBO: ${bi.bundle.name}${bi.quantity > 1 ? ` x${bi.quantity}` : ""}]\n${lines.join("\n")}${bi.notes ? `\nObs: ${bi.notes}` : ""}`;
        })
        .join("\n\n");

      // Para bundles sem produto real, criamos um item fake com o preço total do combo
      // Usamos o primeiro produto de referência do bundle como âncora, ou skiamos se não houver
      const bundleItems = cart
        .filter((i) => (i as BundleCartItem).type === "bundle")
        .flatMap((i) => {
          const bi = i as BundleCartItem;
          // Enviar como item com productId do primeiro produto selecionado no combo
          const firstSel = bi.selections[0];
          if (!firstSel) return [];
          const pid = firstSel.productId ?? firstSel.halfA?.productId;
          if (!pid) return [];
          return [{
            productId: pid,
            productVariantId: firstSel.variantId ?? firstSel.halfA?.variantId ?? null,
            quantity: bi.quantity,
            // Override de preço: preço do combo total / qty (o servidor recalcula pelo produto, mas anotamos no notes)
            notes: `[COMBO: ${bi.bundle.name}] ${bi.selections.map(s => s.flavorMode === "half" ? `${s.stepLabel}: ½${s.halfA?.productName}+½${s.halfB?.productName}` : `${s.stepLabel}: ${s.productName}`).join(" | ")}${bi.notes ? ` | Obs: ${bi.notes}` : ""}`,
          }];
        });

      const allNotes = [bundleNotes].filter(Boolean).join("\n\n");

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
          notes: allNotes || null,
          items: [...regularItems, ...bundleItems],
        }),
      });
      if (res.ok) {
        const order = await res.json();
        localStorage.setItem(`customer_name_${slug}`, form.name);
        localStorage.setItem(`customer_phone_${slug}`, form.phone.replace(/\D/g, ""));

        // Salva o endereço novo digitado (não um já existente escolhido) para reaproveitar na próxima compra
        if (form.orderType === "DELIVERY" && selectedAddressId === "new" && form.street) {
          fetch(`/api/tenants/${slug}/public-customer/${form.phone.replace(/\D/g, "")}/address`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: form.name, cep: form.cep.replace(/\D/g, ""), street: form.street,
              number: form.number, complement: form.complement, neighborhood: form.neighborhood,
              city: form.city, state: form.state,
            }),
          }).catch(() => {});
        }

        setActiveOrder(order);
        setOrderSent(true);
        setCart([]);
        setIsCheckoutOpen(false);
        setCheckoutStep("info");
        setPanel("none");
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

  const featuredProducts = useMemo(() => {
    if (!tenant?.categories) return [];
    return tenant.categories.flatMap((c) => c.products).filter((p) => p.imageUrl).slice(0, 8);
  }, [tenant]);

  const enabledPayments = (() => {
    try {
      if (tenant?.paymentMethods) return JSON.parse(tenant.paymentMethods);
      return { pix: { enabled: true }, credit: { enabled: true }, debit: { enabled: true }, cash: { enabled: true } };
    } catch {
      return { pix: { enabled: true }, credit: { enabled: true }, debit: { enabled: true }, cash: { enabled: true } };
    }
  })();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #1a1a1a 60%, #111 100%)" }}>
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-full border-[3px] border-transparent"
            style={{ borderTopColor: BRAND, borderRightColor: `${BRAND}40` }}
          />
          <p className="text-[11px] font-black text-white/30 tracking-[0.25em] uppercase">Carregando cardápio…</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="text-6xl mb-4">🍽️</div>
        <h1 className="text-xl font-black text-slate-800 mb-2">Cardápio não encontrado</h1>
        <p className="text-slate-400 text-sm">Este estabelecimento não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5]" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif" }}>

      {/* ── TENANT SPLASH ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!splashDone && <TenantSplash tenant={tenant} onDone={() => setSplashDone(true)} />}
      </AnimatePresence>

      {/* ══ DESKTOP LAYOUT ═══════════════════════════════════════════════════════ */}
      <div className="lg:flex lg:min-h-screen">

        {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col lg:w-[360px] xl:w-[400px] shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white shadow-[1px_0_0_rgba(0,0,0,0.06)]">
          {/* Store hero */}
          <div className="relative overflow-hidden shrink-0" style={{ background: "linear-gradient(160deg, #111 0%, #1e1e1e 100%)" }}>
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-15" style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />
            <div className="relative p-7 pb-6">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} className="w-18 h-18 w-[72px] h-[72px] rounded-2xl object-cover shadow-2xl ring-2 ring-white/10 mb-4" alt="logo" />
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-2xl mb-4" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
                  {tenant.name?.[0] ?? "S"}
                </div>
              )}
              <h1 className="text-xl font-black text-white tracking-tight mb-1">{tenant.name}</h1>
              {tenant.description && <p className="text-white/40 text-xs leading-relaxed mb-4 line-clamp-2">{tenant.description}</p>}
              <div className="flex flex-wrap gap-2">
                <StatusPill open={storeOpen} nextInfo={nextOpenInfo} />
                {todayHours && <InfoPill icon={<Clock className="w-3 h-3" />} text={todayHours} />}
                <InfoPill icon={<Bike className="w-3 h-3" />} text="Delivery" />
              </div>
            </div>
          </div>

          {/* Desktop cart */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {cartCount === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                  <ShoppingCart className="w-7 h-7 text-slate-200" />
                </div>
                <p className="text-sm font-bold text-slate-400">Seu carrinho está vazio</p>
                <p className="text-xs text-slate-300 mt-1">Adicione itens do cardápio</p>
              </div>
            ) : (
              <DesktopCart cart={cart} total={total} deliveryFee={deliveryFee} storeOpen={storeOpen} fmt={fmt} updateQty={updateQty} removeItem={removeItem} onCheckout={() => { setPanel("none"); setIsCheckoutOpen(true); }} onClear={() => setCart([])} cartCount={cartCount} />
            )}
          </div>

          <div className="border-t border-slate-100 p-4 flex gap-2 shrink-0">
            <button onClick={() => setPanel("orders")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border border-slate-100">
              <History className="w-3.5 h-3.5" /> Meus Pedidos
            </button>
            <button onClick={() => setPanel("info")} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors border border-slate-100">
              <Info className="w-3.5 h-3.5" /> Info da Loja
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

          {/* ── MOBILE HERO HEADER ──────────────────────────────────────────── */}
          <div
            ref={heroRef}
            className="lg:hidden relative overflow-hidden"
            style={{ background: "linear-gradient(170deg, #0d0d0d 0%, #181818 50%, #111 100%)" }}
          >
            {/* Ambient glow */}
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 pointer-events-none" style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 65%)` }} />
            <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />

            <div className="relative px-5 pt-14 pb-4">
              {/* Logo centered + large */}
              <div className="flex flex-col items-center text-center mb-5">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="mb-4 relative"
                >
                  {tenant.logoUrl ? (
                    <>
                      <div className="absolute inset-0 rounded-3xl blur-xl scale-110" style={{ background: BRAND, opacity: 0.25 }} />
                      <img src={tenant.logoUrl} className="relative w-[88px] h-[88px] rounded-3xl object-cover shadow-2xl ring-2 ring-white/10" alt="logo" />
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 rounded-3xl blur-xl scale-110" style={{ background: BRAND, opacity: 0.3 }} />
                      <div className="relative w-[88px] h-[88px] rounded-3xl flex items-center justify-center shadow-2xl ring-2 ring-white/10" style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})` }}>
                        <span className="text-3xl font-black text-white">{(tenant.name || "S").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}</span>
                      </div>
                    </>
                  )}
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  className="text-[24px] font-black text-white tracking-tight leading-tight"
                >
                  {tenant.name}
                </motion.h1>
                {tenant.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.4 }}
                    className="text-white/40 text-[12px] mt-1.5 leading-relaxed line-clamp-2 max-w-xs"
                  >
                    {tenant.description}
                  </motion.p>
                )}
              </div>

              {/* Status row */}
              <div className="flex flex-wrap justify-center gap-2 mb-5">
                <StatusPill open={storeOpen} nextInfo={nextOpenInfo} />
                {todayHours && <InfoPill icon={<Clock className="w-3 h-3" />} text={todayHours} />}
                <InfoPill icon={<Bike className="w-3 h-3" />} text="Delivery" />
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <motion.button
                  onClick={() => setPanel("orders")}
                  whileTap={{ scale: 0.94 }}
                  className="relative flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[13px] font-black text-white overflow-hidden group"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <div className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity" style={{ background: `linear-gradient(135deg, ${BRAND}25 0%, transparent 100%)` }} />
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <History className="w-3.5 h-3.5 text-white/80" />
                  </div>
                  <span className="text-white/80">Meus Pedidos</span>
                </motion.button>
                <motion.button
                  onClick={() => setPanel("info")}
                  whileTap={{ scale: 0.94 }}
                  className="relative flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[13px] font-black text-white overflow-hidden group"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
                >
                  <div className="absolute inset-0 opacity-0 group-active:opacity-100 transition-opacity" style={{ background: `linear-gradient(135deg, ${BRAND}25 0%, transparent 100%)` }} />
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.1)" }}>
                    <Info className="w-3.5 h-3.5 text-white/80" />
                  </div>
                  <span className="text-white/80">Info da Loja</span>
                </motion.button>
              </div>

              {/* Encomenda banner */}
              {(tenant.scheduleMode || tenant.orderMode === "PREORDER_ONLY" || tenant.orderMode === "BOTH") && (() => {
                let parsedDays: any[] = [];
                try { parsedDays = tenant.scheduleDays ? JSON.parse(tenant.scheduleDays) : []; } catch {}
                const enabledDays = parsedDays.filter((d: any) => d.enabled);
                const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                const modeLabel = tenant.orderMode === "PREORDER_ONLY" ? "Só Encomenda" : "Delivery + Encomenda";
                return (
                  <div className="rounded-2xl overflow-hidden mb-3" style={{ background: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.25)" }}>
                    <div className="px-4 py-3 flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">{modeLabel}</p>
                    </div>
                    {tenant.scheduleType === "OWNER_DEFINES" && enabledDays.length > 0 ? (
                      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                        {enabledDays.map((d: any) => (
                          <div key={d.weekday} className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/25 rounded-full px-2.5 py-1">
                            <span className="text-[10px] font-black text-amber-200">{weekLabels[d.weekday]}</span>
                            {d.times?.length > 0 && <span className="text-[9px] text-amber-300/70">{d.times.join(", ")}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="px-4 pb-3 text-[11px] text-amber-200/70">{tenant.scheduleNotes || "Escolha a data no checkout."}</p>
                    )}
                  </div>
                );
              })()}

              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-3.5 pl-11 pr-10 rounded-2xl text-[13px] font-medium text-white placeholder:text-white/30 focus:outline-none"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-4 h-4 text-white/40" />
                  </button>
                )}
              </div>
            </div>

            {/* Curved bottom edge */}
            <div className="h-7 bg-[#F5F5F5] rounded-t-[28px]" />
          </div>

          {/* ── DESKTOP SEARCH BAR ────────────────────────────────────────── */}
          <div className="hidden lg:block sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-6 py-3">
            <div className="flex items-center gap-4 max-w-3xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar no cardápio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-10 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 bg-slate-50 border border-slate-100 transition-all"
                  style={{ "--tw-ring-color": `${BRAND}4D` } as any}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 transition-colors">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── CLOSED BANNER ─────────────────────────────────────────────── */}
          {!storeOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 lg:mx-6 mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-red-700">Estabelecimento fechado</p>
                <p className="text-xs text-red-400 mt-0.5">{nextOpenInfo ?? "Você pode navegar, mas pedidos não estão disponíveis agora."}</p>
              </div>
            </motion.div>
          )}

          {/* ── CATEGORY NAV ──────────────────────────────────────────────── */}
          <nav
            ref={categoryNavRef}
            className="sticky top-0 lg:top-[57px] z-30 overflow-x-auto no-scrollbar"
            style={{
              background: "rgba(245,245,245,0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex gap-2 px-4 lg:px-6 py-3 w-max min-w-full">
              {filteredCategories.map((cat) => (
                <motion.button
                  key={cat.id}
                  data-cat={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  whileTap={{ scale: 0.93 }}
                  className={`relative px-4 py-2.5 rounded-full whitespace-nowrap text-[13px] font-black transition-all duration-200 ${
                    activeCategory === cat.id
                      ? "text-white shadow-lg"
                      : "bg-white text-slate-500 hover:text-slate-700 border border-slate-100 shadow-sm"
                  }`}
                  style={activeCategory === cat.id ? { background: `linear-gradient(135deg, #0d0d0d 0%, #2a2a2a 100%)`, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" } : {}}
                >
                  {activeCategory === cat.id && (
                    <motion.div
                      layoutId="cat-pill"
                      className="absolute inset-0 rounded-full"
                      style={{ background: `linear-gradient(135deg, #0d0d0d 0%, #2a2a2a 100%)` }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative">{cat.name}</span>
                </motion.button>
              ))}
            </div>
          </nav>

          {/* ── COMBOS SECTION ────────────────────────────────────────────── */}
          {bundles.length > 0 && !searchQuery && (
            <div className="pt-5 pb-2">
              <div className="flex items-center gap-2 px-4 lg:px-6 mb-3.5">
                <Package className="w-4 h-4" style={{ color: BRAND }} />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">Combos</span>
              </div>
              <div className="flex gap-3 px-4 lg:px-6 overflow-x-auto no-scrollbar pb-1">
                {bundles.map((bundle, idx) => (
                  <BundleCard key={bundle.id} bundle={bundle} delay={idx * 0.05} onOpen={() => setSelectedBundle(bundle)} />
                ))}
              </div>
            </div>
          )}

          {/* ── FEATURED HORIZONTAL SCROLL ────────────────────────────────── */}
          {featuredProducts.length > 0 && !searchQuery && (
            <div className="pt-5 pb-2">
              <div className="flex items-center gap-2 px-4 lg:px-6 mb-3.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">Destaques</span>
              </div>
              <div className="flex gap-3 px-4 lg:px-6 overflow-x-auto no-scrollbar pb-1">
                {featuredProducts.map((product, idx) => (
                  <FeaturedCard key={product.id} product={product} delay={idx * 0.04} onOpen={() => openProduct(product)} />
                ))}
              </div>
            </div>
          )}

          {/* ── PRODUCT SECTIONS ──────────────────────────────────────────── */}
          <div className="px-4 lg:px-6 pt-4 pb-36 lg:pb-10 space-y-8 max-w-4xl">
            {filteredCategories.length === 0 && searchQuery ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-4 shadow-sm">
                  <Search className="w-7 h-7 text-slate-200" />
                </div>
                <h3 className="text-base font-black text-slate-700">Nenhum resultado</h3>
                <p className="text-slate-400 text-sm mt-1.5">Não encontramos "<span className="text-slate-600 font-bold">{searchQuery}</span>"</p>
                <button onClick={() => setSearchQuery("")} className="mt-4 text-[11px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity" style={{ color: BRAND }}>
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
                    <h2 className="text-[13px] font-black text-slate-800 uppercase tracking-[0.12em]">{category.name}</h2>
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-2 py-0.5 rounded-full shadow-sm">{category.products.length}</span>
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

      {/* ── ACTIVE ORDER TRACKER ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeOrder && activeOrder.status !== "DELIVERED" && activeOrder.status !== "CANCELLED" && (
          <motion.div
            key="tracker"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-28 left-4 right-4 max-w-sm mx-auto z-40 lg:bottom-8 lg:left-auto lg:right-6 lg:max-w-xs"
          >
            <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-black/20">
              {/* Background */}
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)" }} />
              <motion.div
                className="absolute inset-0 opacity-20"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ background: `linear-gradient(90deg, transparent, ${BRAND}, transparent)`, backgroundSize: "200% 100%" }}
              />
              <div className="relative flex items-center gap-3.5 px-4 py-3.5">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border border-white/10" style={{ background: `${BRAND}25` }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="w-5 h-5" style={{ color: BRAND }} />
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5" style={{ color: BRAND }}>Pedido em andamento</p>
                  <p className="text-[13px] font-black text-white truncate">
                    {activeOrder.status === "PENDING" ? "Aguardando confirmação…" :
                     activeOrder.status === "PREPARING" ? "Na cozinha 🍳" :
                     activeOrder.status === "SHIPPED" ? (activeOrder.orderType === "DELIVERY" ? "Saiu para entrega! 🛵" : "Pronto para retirada! ✅") : ""}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND, boxShadow: `0 0 8px ${BRAND}` }}>
                  <motion.div
                    animate={{ scale: [1, 1.8, 1], opacity: [1, 0, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: BRAND }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MOBILE CART FAB ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            key="cart-fab"
            initial={{ y: 120, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }}
            exit={{ y: 120, opacity: 0, scale: 0.85, transition: { duration: 0.22 } }}
            className="fixed bottom-6 left-4 right-4 max-w-sm mx-auto z-40 lg:hidden"
          >
            {/* Glow shadow behind button */}
            <div className="absolute -inset-1 rounded-[28px] blur-xl opacity-40" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #111 100%)` }} />
            <motion.button
              onClick={() => setPanel("cart")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="relative w-full flex items-center justify-between px-4 py-3.5 rounded-[24px] text-white shadow-2xl shadow-black/40 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #111 0%, #1e1e1e 100%)" }}
            >
              {/* Shimmer strip */}
              <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(105deg, transparent 40%, ${BRAND} 50%, transparent 60%)` }} />

              <div className="flex items-center gap-3">
                <div className="relative">
                  <motion.div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
                    animate={{ boxShadow: [`0 0 0px ${BRAND}00`, `0 0 16px ${BRAND}80`, `0 0 0px ${BRAND}00`] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </motion.div>
                  <motion.div
                    key={cartCount}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 18 }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-[#111] shadow-md"
                  >
                    {cartCount}
                  </motion.div>
                </div>
                <div className="text-left">
                  <span className="block text-[9px] font-black uppercase tracking-[0.2em] text-white/35">Ver carrinho</span>
                  <span className="text-[14px] font-black text-white">{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <motion.span
                  key={total}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-[15px] font-black"
                  style={{ color: BRAND }}
                >
                  {fmt(total)}
                </motion.span>
                <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-white/60" />
                </div>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRODUCT DETAIL SHEET ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="relative bg-white w-full max-w-lg rounded-t-[36px] sm:rounded-[36px] overflow-hidden shadow-2xl max-h-[94vh] flex flex-col"
            >
              {/* Drag handle */}
              <div className="absolute top-3 left-0 right-0 z-20 flex justify-center sm:hidden pointer-events-none">
                <div className="w-10 h-1 rounded-full bg-black/15" />
              </div>

              {/* Image hero */}
              <div className="relative h-64 sm:h-72 shrink-0 overflow-hidden" style={{ background: "#111" }}>
                <img
                  src={selectedProduct.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800"}
                  className="w-full h-full object-cover"
                  alt={selectedProduct.name}
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 45%, transparent 70%)" }} />

                {/* Close button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-5 right-5 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl flex items-center justify-center text-white border border-white/10"
                >
                  <X className="w-4 h-4" />
                </motion.button>

                {/* Price badge */}
                <motion.div
                  key={selectedVariant?.id ?? "base"}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute bottom-5 left-5 right-5 flex items-end justify-between"
                >
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight drop-shadow-lg">{selectedProduct.name}</h2>
                  </div>
                  <div className="rounded-2xl px-4 py-2.5 shadow-xl shrink-0 ml-3" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}>
                    <span className="text-base font-black text-white">
                      {fmt(selectedVariant ? selectedVariant.price : selectedProduct.price)}
                    </span>
                  </div>
                </motion.div>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                <div className="p-5 space-y-5">
                  {selectedProduct.description && (
                    <p className="text-sm text-slate-500 leading-relaxed">{selectedProduct.description}</p>
                  )}

                  {/* Variants */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escolha o tamanho</p>
                      <div className="space-y-2">
                        {selectedProduct.variants.map((v) => {
                          const outOfStock = !!v.inventoryItem && v.inventoryItem.quantity <= 0;
                          return (
                          <motion.button
                            key={v.id}
                            onClick={() => !outOfStock && setSelectedVariant(v)}
                            whileTap={outOfStock ? undefined : { scale: 0.98 }}
                            disabled={outOfStock}
                            className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all duration-200 ${
                              outOfStock ? "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed" :
                              selectedVariant?.id === v.id ? "shadow-md" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                            }`}
                            style={!outOfStock && selectedVariant?.id === v.id ? { borderColor: BRAND, background: BRAND_LIGHT } : {}}
                          >
                            <div className="flex items-center gap-3">
                              {v.imageUrl && (
                                <img src={v.imageUrl} alt={v.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                              )}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedVariant?.id === v.id ? "border-amber-400" : "border-slate-200"}`}>
                                {selectedVariant?.id === v.id && <div className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND }} />}
                              </div>
                              <div className="text-left">
                                <span className={`text-sm font-bold ${selectedVariant?.id === v.id ? "text-amber-800" : "text-slate-700"}`}>{v.name}</span>
                                {outOfStock ? (
                                  <p className="text-[10px] text-red-500 font-bold mt-0.5">Esgotado</p>
                                ) : v.description && <p className="text-[10px] text-slate-400 mt-0.5">{v.description}</p>}
                              </div>
                            </div>
                            <span className={`text-sm font-black ${selectedVariant?.id === v.id ? "text-amber-500" : "text-slate-800"}`}>{fmt(v.price)}</span>
                          </motion.button>
                          );
                        })}
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
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none transition-all resize-none min-h-[80px] font-medium text-slate-700"
                      style={{ focusBorderColor: BRAND } as any}
                    />
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-700">Quantidade</span>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-2 border border-slate-100">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setProductQty((q) => Math.max(1, q - 1))}
                        className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center border border-slate-100"
                        style={{ color: productQty === 1 ? "#CBD5E1" : "#374151" }}
                      >
                        <Minus className="w-4 h-4" />
                      </motion.button>
                      <motion.span
                        key={productQty}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className="text-lg font-black w-7 text-center text-slate-900"
                      >
                        {productQty}
                      </motion.span>
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={() => setProductQty((q) => q + 1)}
                        className="w-10 h-10 rounded-xl shadow-sm flex items-center justify-center text-white"
                        style={{ background: `linear-gradient(135deg, #111 0%, #333 100%)` }}
                      >
                        <Plus className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add to cart CTA */}
              <div className="p-4 pb-6 bg-white border-t border-slate-50 shrink-0">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={addToCart}
                  className="w-full flex items-center justify-between px-6 py-4 rounded-2xl text-white font-black text-[15px] shadow-2xl relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(255,255,255,0.1)" }}
                  />
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <span>Adicionar ao carrinho</span>
                  </div>
                  <motion.span
                    key={`${selectedVariant?.id}-${productQty}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-black text-white"
                  >
                    {fmt((selectedVariant ? selectedVariant.price : selectedProduct.price) * productQty)}
                  </motion.span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── SLIDE PANELS ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {panel !== "none" && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPanel("none")} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110]" />
            <motion.div
              key="panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[120] flex flex-col shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
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

      {/* ── CHECKOUT MODAL ────────────────────────────────────────────────────── */}
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
                  <button onClick={() => setCheckoutStep(checkoutStep === "review" ? "payment" : "info")} className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                  </button>
                )}
                <div className="flex-1">
                  <h2 className="text-base font-black text-slate-900">
                    {checkoutStep === "info" ? "Seus Dados" : checkoutStep === "payment" ? "Forma de Pagamento" : "Confirmar Pedido"}
                  </h2>
                  <div className="flex gap-1 mt-1.5">
                    {(["info", "payment", "review"] as const).map((s) => (
                      <div key={s} className={`h-1 rounded-full transition-all duration-300 ${checkoutStep === s ? "flex-1" : "w-5 bg-slate-200"}`} style={checkoutStep === s ? { background: BRAND } : {}} />
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
                      {tenant.orderMode === "BOTH" && (
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tipo de pedido</p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setForm(f => ({ ...f, isPreorder: false, scheduledDate: "", scheduledTime: "" }))}
                              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 text-xs font-bold transition-all ${!form.isPreorder ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                              <span className="text-lg">🛵</span><span>Entrega imediata</span>
                              <span className={`text-[9px] ${!form.isPreorder ? "text-slate-300" : "text-slate-400"}`}>Pedido normal</span>
                            </button>
                            <button type="button" onClick={() => setForm(f => ({ ...f, isPreorder: true }))}
                              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 text-xs font-bold transition-all ${form.isPreorder ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-500 hover:border-amber-300"}`}>
                              <span className="text-lg">📦</span><span>Encomenda</span>
                              <span className={`text-[9px] ${form.isPreorder ? "text-amber-600" : "text-slate-400"}`}>Escolha a data</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {tenant.orderMode === "PREORDER_ONLY" && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-3">
                          <span className="text-xl shrink-0">📦</span>
                          <div>
                            <p className="text-xs font-black text-amber-800 mb-0.5">Estabelecimento trabalha por encomenda</p>
                            <p className="text-[11px] text-amber-700">{tenant.scheduleNotes || "Escolha a data de entrega abaixo."}</p>
                          </div>
                        </div>
                      )}

                      {(!tenant.orderMode || tenant.orderMode === "DELIVERY_ONLY" || (tenant.orderMode === "BOTH" && !form.isPreorder)) && (
                        <div className="space-y-2">
                          {!deliveryOpen && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center gap-2.5">
                              <span className="text-base shrink-0">🛵</span>
                              <p className="text-[11px] font-bold text-orange-700">Delivery pausado no momento — disponível apenas Retirada no Balcão.</p>
                            </div>
                          )}
                          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            {(["DELIVERY", "PICKUP"] as const).filter(type => type !== "DELIVERY" || deliveryOpen).map((type) => (
                              <button key={type} onClick={() => setForm((f) => ({ ...f, orderType: type }))}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${form.orderType === type ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"}`}>
                                {type === "DELIVERY" ? <><Truck className="w-3.5 h-3.5" /> Delivery</> : <><Store className="w-3.5 h-3.5" /> Retirada</>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <CField label="Nome completo">
                        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Como devo te chamar?" className={cinput} />
                      </CField>
                      <CField label="WhatsApp">
                        <div className="relative">
                          <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" type="tel" inputMode="numeric" className={cinput} />
                          {customerLookupLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />}
                        </div>
                      </CField>

                      {savedCustomer && (
                        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-emerald-800 truncate">Bem-vindo(a) de volta, {savedCustomer.name}!</p>
                            {savedCustomer.loyaltyPoints > 0 && (
                              <p className="text-[10px] text-emerald-600 font-bold">Você tem {savedCustomer.loyaltyPoints} pontos de fidelidade</p>
                            )}
                          </div>
                        </div>
                      )}

                      {form.orderType === "DELIVERY" && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Endereço de entrega</p>

                          {savedCustomer && savedCustomer.addresses.length > 0 && (
                            <div className="space-y-2">
                              {savedCustomer.addresses.map((addr: any) => (
                                <button
                                  key={addr.id}
                                  type="button"
                                  onClick={() => setSelectedAddressId(addr.id)}
                                  className={`w-full flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                                    selectedAddressId === addr.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${selectedAddressId === addr.id ? "text-slate-900" : "text-slate-400"}`} />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-slate-800 truncate">
                                      {addr.label || "Endereço"}{addr.isDefault ? " · Padrão" : ""}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate">
                                      {addr.street}{addr.number ? `, ${addr.number}` : ""}{addr.neighborhood ? ` — ${addr.neighborhood}` : ""}
                                    </p>
                                  </div>
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => { setSelectedAddressId("new"); setForm((f) => ({ ...f, cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" })); }}
                                className={`w-full flex items-center gap-2 p-3 rounded-2xl border-2 border-dashed text-xs font-bold transition-all ${
                                  selectedAddressId === "new" ? "border-slate-900 text-slate-900" : "border-slate-200 text-slate-400 hover:border-slate-300"
                                }`}
                              >
                                <Plus className="w-3.5 h-3.5" /> Usar outro endereço
                              </button>
                            </div>
                          )}

                          {(selectedAddressId === "new" || !savedCustomer || savedCustomer.addresses.length === 0) && (
                            <>
                          <div className="flex gap-2">
                            <CField label="CEP" className="flex-1">
                              <div className="relative">
                                <input value={form.cep} onChange={(e) => setForm((f) => ({ ...f, cep: maskCep(e.target.value) }))} onBlur={(e) => fetchCep(e.target.value)} placeholder="00000-000" inputMode="numeric" className={cinput} />
                                {feeLoading && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2" style={{ color: BRAND }} />}
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
                            </>
                          )}
                        </div>
                      )}

                      {form.orderType === "PICKUP" && (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Retirada no local</p>
                            <p className="text-sm font-bold text-blue-800">{formatTenantAddress(tenant.address) || "Consulte o estabelecimento"}</p>
                          </div>
                        </div>
                      )}

                      {(() => {
                        const needsSchedule = tenant.orderMode === "PREORDER_ONLY" || (tenant.orderMode === "BOTH" && form.isPreorder);
                        if (!needsSchedule && !tenant.scheduleMode) return null;
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
                            for (const t of (dayConfig.times || [])) slots.push({ date: iso, label, time: t });
                          }
                          const slotKey = form.scheduledDate && form.scheduledTime ? `${form.scheduledDate}|${form.scheduledTime}` : "";
                          return (
                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" style={{ color: BRAND }} /> Data e Horário</p>
                              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-3">
                                {tenant.scheduleNotes && tenant.orderMode !== "PREORDER_ONLY" && <p className="text-xs text-amber-700 italic">{tenant.scheduleNotes}</p>}
                                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                                  {slots.slice(0, 20).map(slot => {
                                    const key = `${slot.date}|${slot.time}`;
                                    return (
                                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, scheduledDate: slot.date, scheduledTime: slot.time }))}
                                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${slotKey === key ? "text-white border-amber-400" : "bg-white border-amber-200 text-slate-700 hover:border-amber-300"}`}
                                        style={slotKey === key ? { background: BRAND } : {}}>
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
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" style={{ color: BRAND }} /> Data da Encomenda</p>
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                              {tenant.scheduleNotes && tenant.orderMode !== "PREORDER_ONLY" && <p className="text-xs text-amber-700 italic">{tenant.scheduleNotes}</p>}
                              <input type="date" value={form.scheduledDate} min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-amber-400" />
                            </div>
                          </div>
                        );
                      })()}

                      {(() => {
                        const needsSchedule = tenant.orderMode === "PREORDER_ONLY" || (tenant.orderMode === "BOTH" && form.isPreorder) || tenant.scheduleMode;
                        const scheduleOk = !needsSchedule || (!!form.scheduledDate && (tenant.scheduleType !== "OWNER_DEFINES" || !!form.scheduledTime));
                        const canContinue = !!form.name && form.phone.replace(/\D/g, "").length >= 10 && !(form.orderType === "DELIVERY" && deliveryBlocked) && scheduleOk;
                        return (
                          <motion.button whileTap={{ scale: 0.97 }} disabled={!canContinue} onClick={() => setCheckoutStep("payment")}
                            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all mt-2 ${canContinue ? "text-white shadow-lg" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                            style={canContinue ? { background: "linear-gradient(135deg, #111 0%, #333 100%)" } : {}}>
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
                        <CField label={(() => { try { const p = tenant?.paymentMethods ? JSON.parse(tenant.paymentMethods) : {}; return p.cash?.allowChange === false ? "Observação" : "Troco para quanto? (opcional)"; } catch { return "Troco para quanto? (opcional)"; } })()}>
                          <input value={form.paymentDetail} onChange={(e) => setForm((f) => ({ ...f, paymentDetail: e.target.value }))} placeholder="Ex: R$ 50,00 — deixe em branco se não precisar" className={cinput} />
                        </CField>
                      )}
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setCheckoutStep("review")} className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white shadow-lg mt-2" style={{ background: "linear-gradient(135deg, #111 0%, #333 100%)" }}>
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
                            <CalendarDays className="w-3.5 h-3.5 shrink-0" style={{ color: BRAND }} />
                            <span className="text-xs font-black text-amber-700">
                              Encomenda para {new Date(form.scheduledDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Itens do pedido</p>
                        {cart.map((item, idx) => {
                          if ((item as BundleCartItem).type === "bundle") {
                            const bi = item as BundleCartItem;
                            return (
                              <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                                <span className="text-slate-700 font-medium flex items-center gap-1.5">
                                  <Package className="w-3 h-3 shrink-0" style={{ color: BRAND }} />
                                  {bi.quantity}× {bi.bundle.name}
                                </span>
                                <span className="font-bold text-slate-800">{fmt(bi.bundle.price * bi.quantity)}</span>
                              </div>
                            );
                          }
                          const ci = item as CartItem;
                          return (
                            <div key={idx} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                              <span className="text-slate-700 font-medium">{ci.quantity}× {ci.product.name}{ci.variant ? ` (${ci.variant.name})` : ""}</span>
                              <span className="font-bold text-slate-800">{fmt((ci.variant ? ci.variant.price : ci.product.price) * ci.quantity)}</span>
                            </div>
                          );
                        })}
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
                          <span style={{ color: BRAND }}>{fmt(total + (form.orderType === "DELIVERY" ? deliveryFee : 0))}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-4 py-3 flex justify-between items-center border border-slate-100">
                        <span className="text-xs font-bold text-slate-500">Pagamento</span>
                        <span className="text-xs font-black text-slate-800">
                          {PAYMENT_METHODS_CONFIG.find(m => m.id === form.paymentMethod)?.label ?? form.paymentMethod}
                          {form.paymentDetail ? ` · ${form.paymentDetail}` : ""}
                        </span>
                      </div>
                      <motion.button whileTap={{ scale: 0.97 }} onClick={handleCheckout} className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-black text-sm shadow-xl mt-2" style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}>
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

      {/* ── BUNDLE MODAL ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedBundle && tenant?.categories && (
          <BundleModal
            key={selectedBundle.id}
            bundle={selectedBundle}
            categories={tenant.categories}
            onClose={() => setSelectedBundle(null)}
            onAdd={(selections, notes, qty) => addBundle(selectedBundle, selections, notes, qty)}
          />
        )}
      </AnimatePresence>

      {/* ── SUCCESS OVERLAY ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {orderSent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-10 text-center overflow-hidden"
            style={{ background: "linear-gradient(160deg, #0d0d0d 0%, #1a1a1a 100%)" }}
          >
            {/* Background glow */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 1.6], opacity: [0, 0.15, 0.1] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute w-96 h-96 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, #22c55e 0%, transparent 70%)" }}
            />

            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.05 }}
              className="relative mb-8"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                className="w-32 h-32 rounded-full bg-green-500/20 border-2 border-green-500/30 flex items-center justify-center"
              >
                <CheckCircle2 className="w-16 h-16 text-green-400" />
              </motion.div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
              <h2 className="text-4xl font-black text-white mb-3 tracking-tight">Pedido Enviado!</h2>
              <p className="text-white/40 text-sm max-w-xs leading-relaxed mx-auto">
                Nossa equipe já recebeu seu pedido e está preparando com carinho.
              </p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setOrderSent(false)}
              className="mt-10 px-14 py-4 rounded-2xl text-white font-black text-base shadow-2xl relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
            >
              Entendido!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ open }: { open: boolean; nextInfo?: string | null }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${open ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      {open ? "Aberto agora" : "Fechado"}
    </div>
  );
}

function InfoPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/50 text-[11px] font-medium">
      {icon}{text}
    </div>
  );
}

// ─── BundleCard ───────────────────────────────────────────────────────────────
function BundleCard({ bundle, delay, onOpen }: { bundle: ProductBundle; delay: number; onOpen: () => void }) {
  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileTap={{ scale: 0.94 }}
      className="shrink-0 w-[200px] text-left group"
    >
      <div className="relative w-[200px] rounded-3xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(135deg, #111 0%, #1e1e1e 100%)" }}>
        {bundle.imageUrl ? (
          <div className="relative h-[120px] overflow-hidden">
            <img
              src={bundle.imageUrl}
              alt={bundle.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
              loading="lazy"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)" }} />
          </div>
        ) : (
          <div className="h-[80px] flex items-center justify-center">
            <Layers className="w-8 h-8 text-white/20" />
          </div>
        )}
        <div className="px-3.5 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-black text-white leading-snug line-clamp-2">{bundle.name}</p>
              {bundle.description && (
                <p className="text-[11px] text-white/40 mt-1 line-clamp-2 leading-relaxed">{bundle.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[14px] font-black" style={{ color: BRAND }}>{fmt(bundle.price)}</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black text-white/70 border border-white/10" style={{ background: "rgba(255,255,255,0.08)" }}>
              <Package className="w-3 h-3" />
              <span>Monte</span>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── FeaturedCard ─────────────────────────────────────────────────────────────
function FeaturedCard({ product, delay, onOpen }: { product: Product; delay: number; onOpen: () => void }) {
  const price = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.price;

  return (
    <motion.button
      onClick={onOpen}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileTap={{ scale: 0.94 }}
      className="shrink-0 w-[140px] text-left group"
    >
      <div className="relative w-[140px] h-[140px] rounded-3xl overflow-hidden shadow-lg mb-2.5">
        <img
          src={product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400"}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
          alt={product.name}
          loading="lazy"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)" }} />

        {/* Price */}
        <div className="absolute bottom-3 left-3">
          <span className="text-[12px] font-black text-white drop-shadow">{fmt(price)}</span>
        </div>

        {/* Add button */}
        <motion.div
          whileTap={{ scale: 0.85 }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
        >
          <Plus className="w-3.5 h-3.5 text-white" />
        </motion.div>
      </div>
      <p className="text-[12px] font-black text-slate-700 leading-snug line-clamp-2 px-0.5">{product.name}</p>
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
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      whileTap={{ scale: 0.97 }}
      className="w-full text-left group"
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-200 transition-all duration-300">
        <div className="p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-900 text-[14px] leading-snug line-clamp-1">{product.name}</h3>
            {product.description && (
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
            )}
            <div className="mt-2">
              {hasVariants && <span className="text-[9px] font-bold text-slate-400 block leading-none mb-0.5">a partir de</span>}
              <span className="text-[15px] font-black" style={{ color: BRAND }}>{fmt(minPrice)}</span>
            </div>
          </div>
          <div className="relative w-[104px] h-[104px] rounded-2xl overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center border border-slate-100">
            {hasImage ? (
              <img
                src={product.imageUrl!}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                alt={product.name}
                loading="lazy"
              />
            ) : (
              <span className="text-3xl">🍽️</span>
            )}
            <div className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md" style={{ background: BRAND }}>
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── DesktopCart ──────────────────────────────────────────────────────────────
function DesktopCart({ cart, total, deliveryFee, storeOpen, fmt, updateQty, removeItem, onCheckout, onClear, cartCount }: {
  cart: AnyCartItem[]; total: number; deliveryFee: number; storeOpen: boolean; fmt: (n: number) => string;
  updateQty: (i: number, d: number) => void; removeItem: (i: number) => void; onCheckout: () => void; onClear: () => void; cartCount: number;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: BRAND }}>
            <span className="text-[10px] font-black text-white">{cartCount}</span>
          </div>
          <span className="text-sm font-black text-slate-800">Meu Carrinho</span>
        </div>
        <button onClick={onClear} className="text-[10px] font-black uppercase text-red-400 tracking-widest hover:text-red-500 transition-colors">
          Limpar
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        <AnimatePresence mode="popLayout">
          {cart.map((item, idx) => {
            const isBundle = (item as BundleCartItem).type === "bundle";
            if (isBundle) {
              const bi = item as BundleCartItem;
              return (
                <motion.div key={`bundle-${idx}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} layout className="bg-slate-900 rounded-xl p-3 flex gap-2.5 border border-slate-800">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${BRAND}20` }}>
                    <Package className="w-4 h-4" style={{ color: BRAND }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[11px] font-black text-white leading-snug">{bi.bundle.name}</p>
                      <button onClick={() => removeItem(idx)} className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    <p className="text-[9px] text-white/30 font-medium mt-0.5 line-clamp-1">{bi.selections.map(s => s.flavorMode === "half" ? `½${s.halfA?.productName}+½${s.halfB?.productName}` : s.productName).join(" · ")}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1 bg-white/10 rounded-md p-0.5">
                        <button onClick={() => updateQty(idx, -1)} className="w-4 h-4 rounded flex items-center justify-center text-white/50 hover:bg-white/10"><Minus className="w-2.5 h-2.5" /></button>
                        <span className="text-[10px] font-black w-3 text-center text-white">{bi.quantity}</span>
                        <button onClick={() => updateQty(idx, 1)} className="w-4 h-4 rounded flex items-center justify-center text-white/50 hover:bg-white/10"><Plus className="w-2.5 h-2.5" /></button>
                      </div>
                      <span className="text-[11px] font-black" style={{ color: BRAND }}>{fmt(bi.bundle.price * bi.quantity)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            }
            const ci = item as CartItem;
            return (
              <motion.div key={`${ci.product.id}-${idx}`} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} layout className="bg-slate-50 rounded-xl p-3 flex gap-3 border border-slate-100">
                <img src={ci.product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"} className="w-12 h-12 rounded-lg object-cover shrink-0" alt={ci.product.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800 leading-snug">{ci.product.name}</p>
                    <button onClick={() => removeItem(idx)} className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors border border-slate-200 shrink-0">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  {ci.variant && <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: BRAND }}>{ci.variant.name}</span>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 bg-white rounded-lg border border-slate-200 p-0.5">
                      <button onClick={() => updateQty(idx, -1)} className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"><Minus className="w-2.5 h-2.5" /></button>
                      <span className="text-[11px] font-black w-4 text-center">{ci.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors"><Plus className="w-2.5 h-2.5" /></button>
                    </div>
                    <span className="text-xs font-black" style={{ color: BRAND }}>{fmt((ci.variant ? ci.variant.price : ci.product.price) * ci.quantity)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="p-4 border-t border-slate-100 space-y-3 shrink-0">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400 font-medium"><span>Subtotal</span><span>{fmt(total)}</span></div>
          <div className="flex justify-between text-xs text-slate-400 font-medium"><span>Entrega</span><span className="text-green-500">No checkout</span></div>
          <div className="flex justify-between font-black text-sm text-slate-900 pt-1.5 border-t border-slate-100">
            <span>Total</span><span style={{ color: BRAND }}>{fmt(total)}</span>
          </div>
        </div>
        {!storeOpen && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-2.5 text-center">
            <p className="text-[11px] font-bold text-red-500">Estabelecimento fechado</p>
          </div>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onCheckout}
          disabled={!storeOpen}
          className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${storeOpen ? "text-white shadow-lg" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
          style={storeOpen ? { background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` } : {}}
        >
          <Send className="w-4 h-4" /> Finalizar Pedido
        </motion.button>
      </div>
    </div>
  );
}

// ─── CartPanel (mobile slide) ─────────────────────────────────────────────────
function CartPanel({ cart, total, deliveryFee, storeOpen, fmt, updateQty, removeItem, onCheckout }: {
  cart: AnyCartItem[]; total: number; deliveryFee: number; storeOpen: boolean; fmt: (n: number) => string;
  updateQty: (i: number, d: number) => void; removeItem: (i: number) => void; onCheckout: () => void;
}) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-8">
        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-5 border border-slate-100">
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
          {cart.map((item, idx) => {
            const isBundle = (item as BundleCartItem).type === "bundle";
            if (isBundle) {
              const bi = item as BundleCartItem;
              return (
                <motion.div key={`bundle-${idx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} layout className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "linear-gradient(135deg, #111 0%, #1a1a1a 100%)" }}>
                  <div className="p-4 flex gap-3">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-white/10" style={{ background: `${BRAND}20` }}>
                      <Package className="w-6 h-6" style={{ color: BRAND }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: BRAND }}>Combo</p>
                          <h4 className="text-sm font-black text-white leading-snug">{bi.bundle.name}</h4>
                        </div>
                        <button onClick={() => removeItem(idx)} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {bi.selections.map((s, si) => (
                          <p key={si} className="text-[11px] text-white/40 leading-relaxed line-clamp-1">
                            {s.flavorMode === "half"
                              ? `${s.stepLabel}: ½ ${s.halfA?.productName} + ½ ${s.halfB?.productName}`
                              : `${s.stepLabel}: ${s.productName}${s.variantName ? ` (${s.variantName})` : ""}`}
                          </p>
                        ))}
                      </div>
                      {bi.notes && <p className="text-[11px] text-white/30 italic mt-1.5 line-clamp-1">"{bi.notes}"</p>}
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-center gap-2 bg-white/10 rounded-xl p-1">
                          <button onClick={() => updateQty(idx, -1)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black w-5 text-center text-white">{bi.quantity}</span>
                          <button onClick={() => updateQty(idx, 1)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:text-white transition-colors">
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-black" style={{ color: BRAND }}>{fmt(bi.bundle.price * bi.quantity)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            }
            const ci = item as CartItem;
            return (
              <motion.div key={`${ci.product.id}-${idx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} layout className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-3 shadow-sm">
                <img src={ci.product.imageUrl ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-50" alt={ci.product.name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{ci.product.name}</h4>
                    <button onClick={() => removeItem(idx)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-400 transition-colors shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {ci.variant && <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: BRAND }}>{ci.variant.name}</span>}
                  {ci.notes && <p className="text-[11px] text-slate-400 italic mt-1 line-clamp-1">"{ci.notes}"</p>}
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1 border border-slate-100">
                      <button onClick={() => updateQty(idx, -1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs font-black w-5 text-center text-slate-800">{ci.quantity}</span>
                      <button onClick={() => updateQty(idx, 1)} className="w-7 h-7 bg-white rounded-lg shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="text-sm font-black" style={{ color: BRAND }}>{fmt((ci.variant ? ci.variant.price : ci.product.price) * ci.quantity)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="p-5 border-t border-slate-100 space-y-4 shrink-0 bg-white">
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>Subtotal</span><span>{fmt(total)}</span></div>
          <div className="flex justify-between text-xs font-bold text-slate-400"><span>Taxa de entrega</span><span className="text-green-500">No checkout</span></div>
          <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
            <span>Total</span><span style={{ color: BRAND }}>{fmt(total)}</span>
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
          style={storeOpen ? { background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` } : {}}
        >
          <Send className="w-4 h-4" /> Finalizar Pedido
        </motion.button>
      </div>
    </div>
  );
}

// ─── OrdersPanel ─────────────────────────────────────────────────────────────
function OrdersPanel({ orders, fmt, phone }: { orders: Order[]; fmt: (n: number) => string; phone: string | null }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-8">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center mb-6 border border-slate-100 shadow-sm"
        >
          <History className="w-10 h-10 text-slate-200" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 className="text-lg font-black text-slate-800">Sem pedidos</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-[200px] mx-auto leading-relaxed">Você ainda não fez nenhum pedido por aqui.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 pb-8">
      <AnimatePresence mode="popLayout">
        {orders.map((order, idx) => {
          const st = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS] ?? ORDER_STATUS.PENDING;
          const isExpanded = expanded === order.id;
          const itemsPreview = order.items?.slice(0, 2) ?? [];
          const extraCount = (order.items?.length ?? 0) - 2;

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
            >
              {/* Card header — always visible */}
              <motion.button
                layout="position"
                onClick={() => setExpanded(isExpanded ? null : order.id)}
                whileTap={{ scale: 0.98 }}
                className={`w-full text-left bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-colors duration-200 ${isExpanded ? "" : "hover:border-slate-200"}`}
                style={{ borderColor: isExpanded ? BRAND : "#F1F5F9" }}
              >
                {/* Status bar */}
                <div className={`h-1 w-full ${st.dot}`} />

                <div className="p-4">
                  {/* Top row */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Pedido #{order.id.slice(-5).toUpperCase()}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${st.bg}`}>
                      <motion.span
                        animate={order.status === "PREPARING" || order.status === "PENDING" ? { scale: [1, 1.4, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.6 }}
                        className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                      />
                      <span className={`text-[10px] font-black ${st.color}`}>{st.label}</span>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {itemsPreview.map(i => `${i.quantity}× ${i.product?.name}`).join(" · ")}
                        {extraCount > 0 && <span className="text-slate-400"> +{extraCount} mais</span>}
                      </p>
                    </div>
                    <span className="text-sm font-black shrink-0" style={{ color: BRAND }}>{fmt(order.total)}</span>
                  </div>

                  {/* Expand hint */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {isExpanded ? "Fechar detalhes" : "Ver detalhes"}
                    </span>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                    </motion.div>
                  </div>
                </div>
              </motion.button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-50 rounded-b-2xl border-2 border-t-0 mx-0 p-4 space-y-3" style={{ borderColor: BRAND }}>
                      {/* All items */}
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Itens do pedido</p>
                        <div className="space-y-2">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: BRAND }}>
                                  {item.quantity}
                                </div>
                                <span className="text-xs font-bold text-slate-700">{item.product?.name}</span>
                              </div>
                              <span className="text-xs font-black text-slate-600">{fmt(item.price * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order details */}
                      <div className="grid grid-cols-2 gap-2">
                        {order.orderType && (
                          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Tipo</p>
                            <div className="flex items-center gap-1.5">
                              {order.orderType === "DELIVERY" ? <Bike className="w-3.5 h-3.5 text-blue-500" /> : <Store className="w-3.5 h-3.5 text-purple-500" />}
                              <span className="text-[11px] font-bold text-slate-700">{order.orderType === "DELIVERY" ? "Entrega" : "Retirada"}</span>
                            </div>
                          </div>
                        )}
                        {(order as any).paymentMethod && (
                          <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Pagamento</p>
                            <span className="text-[11px] font-bold text-slate-700">
                              {PAYMENT_METHODS_CONFIG.find(m => m.id === (order as any).paymentMethod)?.label ?? (order as any).paymentMethod}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Total row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Total do pedido</span>
                        <span className="text-base font-black" style={{ color: BRAND }}>{fmt(order.total)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {phone && <p className="text-center text-[10px] text-slate-300 font-bold tracking-widest uppercase pt-2">{phone}</p>}
    </div>
  );
}

// ─── InfoPanel ────────────────────────────────────────────────────────────────
function InfoPanel({ tenant, enabledPayments }: { tenant: Tenant; enabledPayments: Record<string, { enabled: boolean }> }) {
  const DAY_LABELS: Record<string, string> = { sun: "Dom", mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb" };
  let hours: Record<string, { enabled: boolean; open: string; close: string }> | null = null;
  try { if (tenant.businessHours) hours = JSON.parse(tenant.businessHours); } catch {}

  const addressStr = formatTenantAddress(tenant.address);

  const whatsappStr = (() => {
    if (!tenant.whatsapp) return null;
    const d = String(tenant.whatsapp).replace(/\D/g, "");
    const clean = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return clean;
  })();

  const card = "bg-white rounded-2xl border border-slate-100 p-4 shadow-sm";
  const iconBox = (color: string) => `w-9 h-9 rounded-xl ${color} flex items-center justify-center shrink-0`;

  return (
    <div className="p-4 space-y-3 pb-8">
      {addressStr && (
        <div className={card}>
          <div className="flex gap-3">
            <div className={iconBox("bg-blue-50")}><MapPin className="w-4 h-4 text-blue-500" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Endereço</p>
              <p className="text-sm font-bold text-slate-800 leading-relaxed">{addressStr}</p>
            </div>
          </div>
        </div>
      )}
      {whatsappStr && (
        <div className={card}>
          <div className="flex gap-3">
            <div className={iconBox("bg-green-50")}><Phone className="w-4 h-4 text-green-500" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">WhatsApp</p>
              <p className="text-sm font-bold text-slate-800">{whatsappStr}</p>
            </div>
          </div>
        </div>
      )}
      {hours && (
        <div className={card}>
          <div className="flex items-center gap-3 mb-4">
            <div className={iconBox("bg-amber-50")}><Clock className="w-4 h-4 text-amber-500" /></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horários</p>
          </div>
          <div className="space-y-2">
            {DAY_KEYS.map((key) => {
              const d = hours![key];
              const isToday = DAY_KEYS[new Date().getDay()] === key;
              return (
                <div key={key} className={`flex items-center justify-between py-1.5 rounded-lg ${isToday ? "bg-amber-50 px-2 -mx-2" : ""}`}>
                  <span className={`text-xs font-bold ${isToday ? "text-amber-700" : "text-slate-500"}`}>
                    {DAY_LABELS[key]}{isToday && <span className="text-amber-500"> · hoje</span>}
                  </span>
                  <span className={`text-xs font-black ${d?.enabled ? (isToday ? "text-amber-600" : "text-slate-700") : "text-slate-300"}`}>
                    {d?.enabled ? `${d.open} – ${d.close}` : "Fechado"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={card}>
        <div className="flex items-center gap-3 mb-4">
          <div className={iconBox("bg-violet-50")}><CreditCard className="w-4 h-4 text-violet-500" /></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pagamentos Aceitos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS_CONFIG.filter(m => enabledPayments[m.key]?.enabled !== false).map(m => (
            <div key={m.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
              <span>{m.emoji}</span><span>{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Checkout field helper ────────────────────────────────────────────────────
const cinput = "w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-amber-300 transition-all text-slate-700";

function CField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</label>
      {children}
    </div>
  );
}
