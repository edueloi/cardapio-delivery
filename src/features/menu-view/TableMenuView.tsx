import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Plus, Minus, X, Send, Loader2,
  ChevronLeft, ChevronRight, Utensils, Phone, User,
  Receipt, History, Search, Smartphone, Bell,
  ShoppingBag, Users, Trash2, Tag, CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, ProductVariant } from "../../types";
import SelectionGroupPicker, { parseSelectionGroups, getSelectionGroupOptions, formatSelectionGroupsNote, selectionGroupsComplete } from "./SelectionGroupPicker";
import { Button, IconButton, Input, Textarea, Modal, Tabs, Badge, EmptyState } from "@/src/components";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// ── Tema escuro da mesa: componentes do sistema com classes escuras ───────
const TABLE_BG_IMAGE = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=2070";
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

export default function TableMenuView() {
  const { slug, tableId } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"checkin" | "menu" | "success">("checkin");
  const [customer, setCustomer] = useState({ name: "", phone: "", guests: "1" });
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
  // Carrinho aberto em Drawer lateral (bottom-sheet no celular).
  const [showCart, setShowCart] = useState(false);
  // Visão de promoções (item do menu de categorias) em vez do banner acima da lista.
  const [showPromos, setShowPromos] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [promoPaused, setPromoPaused] = useState(false);
  const promoTouchX = useRef<number | null>(null);
  const [showBill, setShowBill] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [waiterNote, setWaiterNote] = useState("");
  const [waiterRequestBill, setWaiterRequestBill] = useState(false);
  const [waiterSent, setWaiterSent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isMd, setIsMd] = useState(window.innerWidth >= 768);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => { setIsDesktop(window.innerWidth >= 1024); setIsMd(window.innerWidth >= 768); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Produto tem grupo de seleção embutido (ex: "2 espetos tradicionais") e ainda não
  // foi escolhido — abre o picker passo a passo automaticamente ao abrir o produto.
  useEffect(() => {
    const groups = parseSelectionGroups(selectedProduct);
    if (groups.length > 0 && !selectionGroupsComplete(groups, selectedGroupItemIds)) {
      setShowGroupPicker(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct]);

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

    const savedCart = localStorage.getItem(`table_cart_${slug}_${tableId}`);
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error("Failed to parse saved cart"); }
    }

    // Restore session — if name+phone saved, skip checkin
    const savedName = localStorage.getItem(`table_name_${slug}_${tableId}`);
    const savedPhone = localStorage.getItem(`table_phone_${slug}_${tableId}`);
    const savedGuests = localStorage.getItem(`table_guests_${slug}_${tableId}`);
    if (savedName && savedPhone) {
      setCustomer({ name: savedName, phone: savedPhone, guests: savedGuests || "1" });
      setStep("menu");
    }
  }, [slug, tableId]);

  // Persist cart to localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(`table_cart_${slug}_${tableId}`, JSON.stringify(cart));
    } else {
      localStorage.removeItem(`table_cart_${slug}_${tableId}`);
    }
  }, [cart, slug, tableId]);

  useEffect(() => {
    if (!tenant) return;

    // Join real-time rooms
    socket.emit("join-tenant", tenant.id);
    if (tableId) {
      socket.emit("join-table", `${tenant.id}-mesa-${tableId}`);
    }

    const handleTableUpdate = () => {
      fetchActiveOrders();
      // If we are in the menu and orders are now empty, it means the admin cleared the table
      // We check if the fetch returns empty in the fetchActiveOrders itself
    };
    socket.on("table-update", handleTableUpdate);

    return () => {
      socket.off("table-update", handleTableUpdate);
    };
  }, [tenant, tableId]);

  const fetchActiveOrders = () => {
    fetch(`/api/orders/table/${slug}/${tableId}`)
      .then(r => r.json())
      .then(data => {
        setOrders(data);

        // AUTO-RESET LOGIC:
        // If the admin cleared the table (data is empty)
        // AND we are currently in the menu step
        // we should clear the local session to allow the next customer to check in.
        if (data.length === 0 && step === "menu") {
          localStorage.removeItem(`table_name_${slug}_${tableId}`);
          localStorage.removeItem(`table_phone_${slug}_${tableId}`);
          localStorage.removeItem(`table_guests_${slug}_${tableId}`);
          localStorage.removeItem(`table_cart_${slug}_${tableId}`);
          setCustomer({ name: "", phone: "", guests: "1" });
          setCart([]);
          setStep("checkin");
        }
      })
      .catch(() => {});
  };

  const totalBill = orders.reduce((acc, order) => acc + (order.total || 0), 0);

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

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    if (customer.name && customer.phone) {
      localStorage.setItem(`table_name_${slug}_${tableId}`, customer.name);
      localStorage.setItem(`table_phone_${slug}_${tableId}`, customer.phone);
      localStorage.setItem(`table_guests_${slug}_${tableId}`, customer.guests);
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

  const handleOrder = async () => {
    if (cart.length === 0) return;
    setIsOrdering(true);
    const orderData = {
      customerName: customer.name,
      customerPhone: customer.phone.replace(/\D/g, ""),
      tenantId: tenant?.id,
      tenantSlug: slug,
      orderType: "DINE_IN",
      tableId: tableId,
      paymentMethod: "CASH",
      guestCount: parseInt(customer.guests) || 1,
      items: cart.map(item => ({
        productId: item.productId,
        productVariantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes,
        selectedExtras: item.extras || []
      })),
      total
    };
    console.log("Sending Order Payload:", orderData);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        setCart([]);
        localStorage.removeItem(`table_cart_${slug}_${tableId}`);
        showToast("Pedido enviado para a cozinha!");
        fetchActiveOrders();
      }
    } finally {
      setIsOrdering(false);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-blue-400" /></div>;
  if (!tenant) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <DEmpty icon={Utensils} title="Restaurante não encontrado" className="w-full max-w-sm bg-slate-900 py-10" />
    </div>
  );

  const tableLabel = tableId === 'Balcao' ? 'Balcão' : `Mesa ${tableId}`;
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
    !searchTerm || p.name.toLowerCase().includes(searchLower) || !!p.description?.toLowerCase().includes(searchLower);

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

  const scrollToCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    setShowBill(false);
    setSelectedProduct(null);
    const container = scrollContainerRef.current;
    const el = document.getElementById(`cat-${catId}`);
    if (container && el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      container.scrollTo({ top: elRect.top + container.scrollTop - containerRect.top - 10, behavior: "smooth" });
    }
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

  const openWaiter = () => { setShowWaiterModal(true); setWaiterSent(false); setWaiterNote(""); setWaiterRequestBill(false); };

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

  const renderPromotions = () => {
    const n = promotions.length;
    const idx = Math.min(promoIndex, n - 1);
    const go = (d: number) => setPromoIndex((idx + d + n) % n);
    return (
      <div
        className="relative space-y-3 outline-none md:flex md:h-full md:min-h-[420px] md:flex-col md:space-y-0"
        tabIndex={0}
        role="region"
        aria-roledescription="carrossel"
        aria-label="Promoções"
        onMouseEnter={() => setPromoPaused(true)}
        onMouseLeave={() => setPromoPaused(false)}
        onFocus={() => setPromoPaused(true)}
        onBlur={() => setPromoPaused(false)}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}
        onTouchStart={(e) => { setPromoPaused(true); promoTouchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const start = promoTouchX.current;
          promoTouchX.current = null;
          setPromoPaused(false);
          if (start == null || n <= 1) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
      >
        <div className="relative overflow-hidden rounded-lg border border-white/10 bg-slate-800 md:min-h-0 md:flex-1">
          <div className="flex transition-transform duration-500 md:h-full" style={{ transform: `translateX(-${idx * 100}%)` }}>
            {promotions.map((promo: any, i: number) => (
              <div
                key={promo.id ?? i}
                onClick={() => openPromotionProduct(promo)}
                className={`relative aspect-[16/9] max-h-[260px] w-full shrink-0 md:aspect-auto md:h-full md:max-h-none ${promo.product ? "cursor-pointer" : ""}`}
                aria-hidden={i !== idx}
              >
                {promo.imageUrl && <img src={promo.imageUrl} className="h-full w-full object-cover" alt={promo.title} />}
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-3 pt-16 sm:p-4 md:p-8 md:pb-14 md:pt-32">
                  <div className="min-w-0 space-y-1">
                    <DBadge color="primary">Promoção</DBadge>
                    <h2 className="truncate text-sm font-medium text-white sm:text-base md:text-3xl">{promo.title}</h2>
                    {promo.description && <p className="line-clamp-2 text-xs text-slate-300">{promo.description}</p>}
                  </div>
                  {promo.product && (
                    <div className="shrink-0 space-y-2 text-right">
                      <div>
                        <p className="text-[11px] text-slate-300">A partir de</p>
                        <p className="text-lg font-semibold text-white">{fmt(promo.promoPrice || promo.product.price)}</p>
                      </div>
                      <DButton size="md" className="h-10" iconLeft={<Plus size={14} />} onClick={(e) => { e.stopPropagation(); openPromotionProduct(promo); }}>Ver</DButton>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {n > 1 && (
            <>
              <DIconButton variant="outline" size="lg" aria-label="Promoção anterior" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 !bg-slate-950/70 md:left-4 md:!h-14 md:!w-14">
                <ChevronLeft size={16} />
              </DIconButton>
              <DIconButton variant="outline" size="lg" aria-label="Próxima promoção" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 !bg-slate-950/70 md:right-4 md:!h-14 md:!w-14">
                <ChevronRight size={16} />
              </DIconButton>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="flex items-center justify-center md:absolute md:inset-x-0 md:bottom-3">
            {promotions.map((_: any, i: number) => (
              <button key={i} type="button" aria-label={`Ir para promoção ${i + 1}`} onClick={() => setPromoIndex(i)} className="flex h-6 w-6 items-center justify-center">
                <span className={`h-2 rounded-full transition-all ${i === idx ? "w-5 bg-blue-500" : "w-2 bg-white/30"}`} />
              </button>
            ))}
          </div>
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
                      <Utensils className="h-12 w-12 text-slate-300" />
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
                      <p className="text-xs font-medium text-slate-300">Escolha o tamanho</p>
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
                        <h4 className="text-xs font-medium text-slate-300">Adicionais</h4>
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
                          <h4 className="text-xs font-medium text-slate-300">
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
                      <Utensils className="h-12 w-12 text-slate-300" />
                    )}
                  </div>

                  <div className="space-y-1">
                    {selectedProduct.description && <p className="text-xs leading-relaxed text-slate-400">{selectedProduct.description}</p>}
                    <p className="text-lg font-semibold text-blue-400">{fmt(unitPrice)}</p>
                  </div>

                  {/* Variants */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-300">Escolha o tamanho</p>
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
                        <h4 className="text-xs font-medium text-slate-300">Adicionais</h4>
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
                          <h4 className="text-xs font-medium text-slate-300">
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

  const inlineProduct = isMd && !!selectedProduct;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-slate-950 font-sans text-white lg:flex-row">

      {/* ── CHECK-IN STEP ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {step === "checkin" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950"
          >
            <img src={TABLE_BG_IMAGE} alt="" className="pointer-events-none fixed inset-0 h-full w-full scale-105 object-cover opacity-30 blur-sm" />
            <div className="pointer-events-none fixed inset-0 bg-slate-950/60" />
            <div className="relative flex min-h-full items-center justify-center p-4">
              <div className="w-full max-w-sm space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-blue-500/30">
                  <Utensils className="h-8 w-8 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h1 className="font-serif text-2xl tracking-wide text-white sm:text-3xl">Bem-vindo ao {tenant.name}</h1>
                  <p className="text-sm font-medium text-blue-300">{tableId === 'Balcao' ? 'Atendimento no Balcão' : `Mesa ${tableId}`}</p>
                </div>
                <form onSubmit={handleCheckin} className="space-y-3">
                  <Input wrapperClassName={DARK_INPUT}
                    required
                    size="lg"
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                    placeholder="Seu Nome"
                    iconLeft={<User size={16} />}
                  />
                  <Input wrapperClassName={DARK_INPUT}
                    required
                    size="lg"
                    value={customer.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    iconLeft={<Phone size={16} />}
                  />
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Users size={16} />
                      <span className="text-xs">Pessoas na mesa</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DIconButton type="button" variant="outline" size="lg" aria-label="Diminuir pessoas"
                        onClick={() => setCustomer(c => ({ ...c, guests: String(Math.max(1, parseInt(c.guests) - 1)) }))}>
                        <Minus size={14} />
                      </DIconButton>
                      <span className="w-8 text-center text-sm font-medium text-white">{customer.guests}</span>
                      <DIconButton type="button" variant="outline" size="lg" aria-label="Aumentar pessoas"
                        onClick={() => setCustomer(c => ({ ...c, guests: String(Math.min(20, parseInt(c.guests) + 1)) }))}>
                        <Plus size={14} />
                      </DIconButton>
                    </div>
                  </div>
                  <DButton type="submit" size="lg" fullWidth className="h-11">
                    Entrar no Restaurante
                  </DButton>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MENU STEP ────────────────────────────────────────────────────── */}
      {step === "menu" && (
        <>
          {/* Sidebar de categorias — tablet/notebook/desktop, sempre aberta (sem botão de recolher) */}
          <aside className="relative z-20 hidden w-56 shrink-0 flex-col border-r border-white/10 bg-slate-900 lg:flex xl:w-64">
            <div className="flex items-center gap-3 border-b border-white/10 p-3">
              {renderLogo("h-10 w-10")}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400">{tableLabel}</p>
                <p className="line-clamp-2 text-sm font-medium text-white">{tenant.name}</p>
              </div>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {promotions.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setShowPromos(true); setShowBill(false); setSelectedProduct(null); }}
                  className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${showPromos ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"}`}
                >
                  <span className="flex min-w-0 items-center gap-2"><Tag size={14} className="shrink-0" /><span className="truncate">Promoções</span></span>
                  <DBadge color="primary" size="sm">{promotions.length}</DBadge>
                </button>
              )}
              {tenant.categories?.map(cat => {
                const active = !showPromos && selectedCategoryId === cat.id && !showBill;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setShowPromos(false);
                      setSelectedCategoryId(cat.id);
                      setShowBill(false);
                      setSelectedProduct(null);
                    }}
                    className={`flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                      active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <ChevronRight size={14} className={active ? "opacity-100" : "opacity-40"} />
                  </button>
                );
              })}
            </nav>
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
                <User size={14} className="shrink-0 text-blue-400" />
                <div className="min-w-0"><p className="text-[11px] text-slate-400">Cliente</p><p className="truncate text-xs font-medium text-white">{customer.name}</p></div>
              </div>
            </div>
          </aside>

          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="relative z-30 shrink-0 overflow-hidden border-b border-white/10 bg-slate-900">
            <div className="relative flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
              <div className="lg:hidden">{renderLogo("h-10 w-10")}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[11px] font-medium text-slate-300">{tableLabel}</p>
                </div>
                <p className="truncate text-sm font-medium text-white lg:hidden">{tenant.name}</p>
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

              <DIconButton variant="outline" size="lg" aria-label="Chamar garçom" onClick={openWaiter} className="xl:hidden">
                <Bell size={16} />
              </DIconButton>
              <DButton variant="outline" size="lg" iconLeft={<Bell size={14} />} onClick={openWaiter} className="hidden xl:inline-flex">
                Chamar Garçom
              </DButton>

              <DIconButton variant="outline" size="lg" aria-label="Pedir pelo celular" onClick={() => setShowQR(true)} className="hidden lg:inline-flex xl:hidden">
                <Smartphone size={16} />
              </DIconButton>
              <DButton variant="outline" size="lg" iconLeft={<Smartphone size={14} />} onClick={() => setShowQR(true)} className="hidden xl:inline-flex">
                Pedir pelo Celular
              </DButton>

              <DButton variant="outline" size="lg" aria-label="Minha conta" iconLeft={<Receipt size={14} />} onClick={() => setShowBill(true)}>
                <span className="hidden xl:inline">Minha Conta</span>
                <span className="font-semibold">{fmt(totalBill)}</span>
              </DButton>

              <DButton size="lg" className="relative hidden lg:inline-flex" aria-label="Abrir carrinho" iconLeft={<ShoppingBag size={14} />} onClick={() => setShowCart(true)}>
                <motion.span key={cartCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-white/20 px-1.5 text-[11px] font-semibold">{cartCount}</motion.span>
                {fmt(total)}
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
              <div className="relative px-3 sm:px-4 lg:hidden">
                <Tabs
                  items={promotions.length > 0 ? [{ id: "__promos", label: "Promoções", badge: promotions.length }, ...categoryTabs] : categoryTabs}
                  value={showPromos ? "__promos" : (selectedCategoryId ?? categoryTabs[0].id)}
                  onChange={(id: string) => { if (id === "__promos") { setShowPromos(true); setShowBill(false); setSelectedProduct(null); } else { setShowPromos(false); scrollToCategory(id); } }}
                  label="Categorias do cardápio"
                  className={`space-y-0 [&>*+*]:hidden ${DARK_TABS}`}
                >
                  {null}
                </Tabs>
              </div>
            )}
          </header>

          <div className="flex min-h-0 flex-1 bg-slate-950">
            <div ref={scrollContainerRef} className="min-w-0 flex-1 overflow-y-auto p-3 pb-24 sm:p-4 lg:pb-4">
              <div className={`space-y-4 ${!inlineProduct && showPromos && promotions.length > 0 ? "md:h-full" : ""}`}>

                {inlineProduct && renderProduct(true)}

                {!inlineProduct && showPromos && promotions.length > 0 && renderPromotions()}

                {/* Categories & Products */}
                {!inlineProduct && !showPromos && tenant.categories?.filter(cat =>
                  (!!searchTerm || !selectedCategoryId || cat.id === selectedCategoryId || !isDesktop) &&
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
                className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-900 p-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg lg:hidden"
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

          {/* ── CARRINHO (drawer lateral; bottom-sheet no celular) ───────── */}
          <Modal
            isOpen={showCart}
            onClose={() => setShowCart(false)}
            title="Seu pedido"
            subtitle={`${tableLabel} · ${cartCount} ${cartCount === 1 ? "item" : "itens"}`}
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
                  disabled={cart.length === 0}
                  onClick={() => { setShowCart(false); handleOrder(); }}
                >
                  Enviar pedido
                </DButton>
              </div>
            }
          >
            {cart.length === 0 ? (
              <DEmpty icon={ShoppingBag} title="Carrinho vazio" description="Adicione itens do cardápio." className="py-8" />
            ) : renderCartItems()}
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
              <div className="mx-auto w-fit rounded-lg border border-white/10 bg-white p-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}&bgcolor=ffffff&color=000000`}
                  alt="QR Code para celular"
                  className="h-44 w-44"
                />
              </div>
              <DBadge color="success" dot>Sincronizado com a Mesa {tableId}</DBadge>
            </div>
          </Modal>

          {/* ── WAITER MODAL ──────────────────────────────────────────────── */}
          <Modal
            isOpen={showWaiterModal}
            onClose={() => setShowWaiterModal(false)}
            title={waiterSent ? "Garçom avisado!" : "Chamar Garçom"}
            subtitle={waiterSent ? "Aguarde, já vamos até você." : `${tableLabel} — ${customer.name}`}
            size="xs"
            className={`max-sm:self-end ${DARK_MODAL}`}
            footer={waiterSent ? (
              <DButton size="lg" fullWidth className="h-11" onClick={() => setShowWaiterModal(false)}>Fechar</DButton>
            ) : (
              <div className="flex gap-2">
                <DButton variant="outline" size="lg" className="h-11 flex-1" onClick={() => setShowWaiterModal(false)}>Cancelar</DButton>
                <DButton
                  size="lg"
                  className="h-11 flex-1"
                  iconLeft={<Bell size={14} />}
                  onClick={() => {
                    if (tenant) {
                      socket.emit("request-waiter", {
                        tenantId: tenant.id,
                        tableId,
                        customerName: customer.name,
                        note: waiterNote,
                        requestBill: waiterRequestBill,
                      });
                      setWaiterSent(true);
                    }
                  }}
                >Chamar</DButton>
              </div>
            )}
          >
            {waiterSent ? (
              <div className="flex justify-center py-4">
                <CheckCircle2 className="h-12 w-12 text-blue-400" />
              </div>
            ) : (
              <div className="space-y-4">
                <label className="flex min-h-[40px] cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={waiterRequestBill}
                    onChange={() => setWaiterRequestBill(v => !v)}
                    className="h-5 w-5 rounded accent-blue-600"
                  />
                  <span className="text-[13px] font-medium text-slate-200">Solicitar a conta</span>
                </label>
                <Textarea
                  label="Observação (opcional)"
                  value={waiterNote}
                  onChange={e => setWaiterNote(e.target.value)}
                  placeholder="Ex: precisamos de mais guardanapos, trocar o pedido..."
                  rows={3}
                  className="min-h-[88px] !bg-slate-800 !border-white/10 !text-white" wrapperClassName="[&_.ds-label]:!text-slate-300"
                />
              </div>
            )}
          </Modal>

          {/* ── MINHA MESA / CONTA ───────────────────────────────────────── */}
          <Modal
            isOpen={showBill}
            onClose={() => setShowBill(false)}
            title="Minha Mesa"
            subtitle={`${tableLabel} · Resumo do consumo`}
            size="md"
            position="right"
            className={DARK_MODAL}
            footer={
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total acumulado</span>
                  <span className="text-lg font-semibold tabular-nums text-white">{fmt(totalBill)}</span>
                </div>
                <div className="flex gap-2">
                  <DButton variant="outline" size="lg" className="h-11 flex-1" onClick={() => setShowBill(false)}>
                    Continuar Pedindo
                  </DButton>
                  <DButton
                    size="lg"
                    className="h-11 flex-1"
                    onClick={() => {
                      if (tenant) {
                        socket.emit("request-checkout", { tenantId: tenant.id, tableId, customerName: customer.name });
                        showToast("Garçom chamado!");
                        setShowBill(false);
                      }
                    }}
                  >
                    Finalizar e Pedir Conta
                  </DButton>
                </div>
              </div>
            }
          >
            {orders.length === 0 ? (
              <DEmpty icon={History} title="Nenhum pedido ainda" description="Você ainda não enviou pedidos para a cozinha." className="py-8" />
            ) : (
              <div className="space-y-3">
                {orders.map((order, idx) => (
                  <div key={order.id} className="space-y-2 rounded-lg border border-white/10 bg-slate-900 p-3">
                    <div className="flex items-center justify-between">
                      <DBadge color="primary" size="sm">Pedido #{orders.length - idx}</DBadge>
                      <span className="text-[11px] text-slate-400">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="space-y-1.5">
                      {order.items.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs text-slate-400">{item.quantity}x</span>
                            <span className="truncate text-[13px] font-medium text-white">{item.product.name}</span>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-slate-200">{fmt(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>

          {!isMd && renderProduct(false)}

          {/* Grupos de seleção embutidos — fluxo passo a passo (ex: marmita com Guarnição/Arroz/Feijão) */}
          {showGroupPicker && selectedProduct && !isMd && (() => {
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
                className="fixed bottom-24 left-1/2 z-[300] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-white/10 bg-slate-800 px-4 py-2.5 text-xs font-medium text-white shadow-lg lg:bottom-6"
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
