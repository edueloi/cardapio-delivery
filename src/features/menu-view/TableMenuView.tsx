import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { 
  ShoppingCart, Plus, Minus, X, Send, Loader2, 
  ChevronRight, Utensils, Phone, User, CheckCircle2,
  Receipt, History, Check, Search, Smartphone, Bell,
  ChevronLeft,
  MoreVertical,
  BookOpen,
  ShoppingBag,
  MapPin,
  MoreHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../../lib/socket";
import type { Tenant, Product, Order, ProductVariant } from "../../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export default function TableMenuView() {
  const { slug, tableId } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"checkin" | "menu" | "success">("checkin");
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [cart, setCart] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [isOrdering, setIsOrdering] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [showBill, setShowBill] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

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

    const savedCart = localStorage.getItem(`table_cart_${slug}_${tableId}`);
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch (e) { console.error("Failed to parse saved cart"); }
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

    socket.on("table-update", () => {
      fetchActiveOrders();
      // If we are in the menu and orders are now empty, it means the admin cleared the table
      // We check if the fetch returns empty in the fetchActiveOrders itself
    });
    
    return () => {
      socket.off("table-update");
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
          localStorage.removeItem(`table_cart_${slug}_${tableId}`);
          setCustomer({ name: "", phone: "" });
          setCart([]);
          setStep("checkin");
        }
      })
      .catch(() => {});
  };

  const totalBill = orders.reduce((acc, order) => acc + (order.total || 0), 0);

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
      setStep("menu");
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
      items: cart.map(item => ({
        productId: item.productId,
        productVariantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes
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

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;
  if (!tenant) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-serif">Restaurante não encontrado</div>;

  return (
    <div className="min-h-screen bg-[#0b0f14] text-[#f5f5f5] selection:bg-[#C9A227]/30 font-sans relative overflow-x-hidden lg:flex lg:h-screen">
      
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
                className="mx-auto w-20 h-20 rounded-full border-2 border-amber-500/20 flex items-center justify-center"
              >
                <Utensils className="w-8 h-8 text-amber-500" />
              </motion.div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-serif text-white tracking-wide">Bem-vindo ao {tenant.name}</h1>
                <p className="text-amber-500/60 text-sm font-medium tracking-widest uppercase">
                  {tableId === 'Balcao' ? 'Atendimento no Balcão' : `Mesa ${tableId}`}
                </p>
              </div>

              <form onSubmit={handleCheckin} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    required
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                    placeholder="Seu Nome"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input 
                    required
                    value={customer.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:border-amber-500/50 focus:outline-none transition-all"
                  />
                </div>
                <button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-amber-500/30 active:scale-95 uppercase tracking-widest text-xs">
                  Entrar no Restaurante
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MENU STEP ────────────────────────────────────────────────────── */}
      {step === "menu" && (
        <>
          {/* Sidebar Desktop (Keep Dark) */}
          <aside className="hidden lg:flex w-64 xl:w-72 flex-col bg-[#111827] border-r border-white/[0.06] h-full shrink-0 z-50 relative transition-all">
            <div className="p-6 xl:p-8 flex flex-col h-full">
              {/* Logo VUCA Style */}
              <div className="mb-12">
                <div className="text-white font-black text-3xl leading-[0.8] tracking-tighter uppercase">
                  VU<br />CA
                </div>
                <p className="text-[10px] font-black text-white/20 tracking-[0.3em] mt-2 uppercase">Mesa {tableId}</p>
              </div>

              {/* Categories */}
              <nav className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar">
                {tenant.categories?.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setShowBill(false);
                      setSelectedProduct(null);
                    }}
                    className={`w-full flex items-center justify-between p-3 xl:p-4 rounded-xl transition-all group ${
                      selectedCategoryId === cat.id && !showBill && !selectedProduct
                      ? 'bg-white/5 text-amber-500' 
                      : 'text-white hover:bg-white/5'
                    }`}
                  >
                    <span className={`text-[9px] xl:text-[10px] font-black uppercase tracking-widest ${
                      selectedCategoryId === cat.id && !showBill && !selectedProduct ? 'text-amber-500' : 'text-white'
                    }`}>
                      {cat.name}
                    </span>
                    <ChevronRight className={`w-3 h-3 xl:w-4 xl:h-4 transition-transform ${
                      selectedCategoryId === cat.id && !showBill && !selectedProduct ? 'translate-x-1 opacity-100' : 'opacity-40 group-hover:opacity-100'
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

          <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-white lg:bg-[#0b0f14]">
            {/* Mobile Header (Search Style as in Image) */}
            <header className="sticky top-0 z-40 bg-white p-4 lg:hidden shrink-0">
              <div className="flex items-center gap-3">
                <div className="text-red-600 font-black text-xl leading-none tracking-tighter">
                  VU<br />CA
                </div>
                <div className="flex-1 bg-[#f4f5f7] rounded-xl flex items-center px-3 py-2 gap-2">
                  <Search className="w-4 h-4 text-zinc-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar produtos" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full placeholder:text-zinc-400"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="p-1">
                      <X className="w-3 h-3 text-zinc-400" />
                    </button>
                  )}
                </div>
                <button className="p-2">
                  <MoreVertical className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            </header>


            {/* Desktop Header (Visible on LG) */}
            <header className="hidden lg:flex sticky top-0 z-40 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-8 py-4 items-center justify-between shrink-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-full px-5 py-2">
                  <Utensils className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">MESA {tableId}</span>
                </div>
                
                <div className="bg-white/5 border border-white/[0.06] rounded-full px-4 py-2 flex items-center gap-2">
                  <span className="text-xs text-white">PT</span>
                </div>
              </div>

              <div className="absolute left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-8">
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
                  <button 
                    onClick={() => {
                      if (tenant) {
                        socket.emit("request-waiter", { tenantId: tenant.id, tableId, customerName: customer.name });
                        showToast("Garçom chamado!");
                      }
                    }}
                    className="flex items-center gap-2 text-white hover:text-[#C9A227] transition-all group"
                  >
                    <Bell className="w-5 h-5 group-hover:text-[#C9A227]" />
                    <span className="text-[9px] font-black uppercase tracking-widest hidden xl:block">Chamar Garçom</span>
                  </button>
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
                <button 
                  onClick={() => setShowBill(true)}
                  className="flex items-center gap-2 text-amber-500 hover:text-amber-400 transition-all group"
                >
                  <Receipt className="w-5 h-5" />
                  <span className="text-[9px] font-black uppercase tracking-widest hidden xl:block">Minha Conta</span>
                  <div className="ml-2 bg-amber-500 text-black px-2 py-0.5 rounded-full text-[10px] font-black">
                    {fmt(totalBill)}
                  </div>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto lg:p-12 relative custom-scrollbar pb-24 lg:pb-12">
              {/* Mobile Restaurant Info (As in Image) */}
              <div className="lg:hidden p-4 space-y-4">
                <div className="h-32 bg-zinc-100 rounded-xl overflow-hidden relative">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/food.png')] bg-repeat" />
                </div>
                <div className="flex items-start gap-4 -mt-12 relative px-2">
                  <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg border border-zinc-100 overflow-hidden">
                    <img src={tenant.logoUrl || "/placeholder.png"} className="w-full h-full object-cover rounded-full" />
                  </div>
                  <div className="pt-8">
                    <h1 className="text-lg font-bold text-zinc-900">{tenant.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded">Aberto</span>
                      <div className="flex items-center text-[10px] text-zinc-400 gap-1">
                        <span className="text-amber-500">★</span> 5.0 • 0 km
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-100/80 rounded-xl p-4 flex items-start gap-3 border border-zinc-200">
                  <div className="w-5 h-5 rounded-full bg-zinc-400 flex items-center justify-center text-white shrink-0 mt-0.5 italic font-serif text-xs">i</div>
                  <p className="text-[11px] text-zinc-600 font-medium leading-relaxed">
                    Este restaurante está aceitando pedidos no momento, você já pode realizar suas escolhas.
                  </p>
                </div>
              </div>

              {/* Desktop Category Banner */}
              {(!selectedCategoryId || selectedCategoryId === tenant.categories?.[0]?.id) && !showBill && !selectedProduct && (
                <div className="hidden lg:block w-full h-[380px] rounded-[2.5rem] overflow-hidden relative mb-12 shadow-2xl">
                  <img 
                    src={tenant.categories?.[0]?.products?.[0]?.imageUrl || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=1200"} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end">
                    <div className="space-y-3">
                      <div className="bg-amber-500 text-black px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit">
                        Destaque do Dia
                      </div>
                      <h2 className="text-5xl font-serif text-white tracking-tight">{tenant.categories?.[0]?.products?.[0]?.name}</h2>
                      <p className="text-white/60 max-w-xl text-sm leading-relaxed">{tenant.categories?.[0]?.products?.[0]?.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">A partir de</p>
                      <p className="text-4xl font-black text-white tracking-tighter">{fmt(tenant.categories?.[0]?.products?.[0]?.price || 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Categories & Products */}
              <div className="px-6 py-8 space-y-12 max-w-md mx-auto lg:max-w-none lg:p-0">
                {tenant.categories?.filter(cat => 
                  (!selectedCategoryId || cat.id === selectedCategoryId || !isDesktop) && 
                  (!searchTerm || cat.products.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase())))
                ).map(cat => (
                  <section key={cat.id} className={`space-y-6 ${selectedCategoryId && selectedCategoryId !== cat.id && !searchTerm ? 'lg:hidden' : ''} px-4 lg:px-0`}>
                    <h2 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-3 lg:text-[#C9A227] lg:text-sm lg:tracking-[0.2em]">
                      {cat.name}
                      <div className="h-px flex-1 bg-zinc-100 lg:hidden" />
                      <div className="hidden lg:block h-px flex-1 bg-white/[0.06]" />
                    </h2>
                    
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
                      {cat.products.filter(p => 
                        !searchTerm || 
                        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map(p => (
                        <div key={p.id}>
                          {/* Mobile List Style (Horizontal) */}
                          <button 
                            onClick={() => setSelectedProduct(p)}
                            className="w-full flex items-center gap-4 py-4 bg-white border-b border-zinc-100 lg:hidden text-left active:bg-zinc-50 transition-colors"
                          >
                            <div className="flex-1 space-y-1">
                              <h3 className="text-sm font-bold text-zinc-900">{p.name}</h3>
                              <p className="text-[11px] text-zinc-400 font-medium line-clamp-2 leading-relaxed">{p.description}</p>
                              <p className="text-sm font-black text-zinc-900 mt-1">{fmt(p.price)}</p>
                            </div>
                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-zinc-50">
                              <img src={p.imageUrl || "/placeholder.png"} className="w-full h-full object-cover" />
                            </div>
                          </button>

                          {/* Desktop Card Style (Premium Dark) */}
                          <motion.div 
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedProduct(p)}
                            className="hidden lg:flex group gap-6 p-6 rounded-[2.5rem] bg-[#161d27] border border-white/[0.06] hover:bg-[#1c2532] hover:border-[#C9A227]/30 transition-all cursor-pointer items-center"
                          >
                            <div className="flex-1 space-y-2">
                              <h3 className="font-bold text-white group-hover:text-[#C9A227] transition-colors text-lg">{p.name}</h3>
                              <p className="text-sm text-[#9ca3af] line-clamp-2 leading-relaxed">{p.description}</p>
                              <p className="text-base font-black text-[#C9A227] pt-1">{fmt(p.price)}</p>
                            </div>
                            <div className="w-28 h-28 rounded-[1.5rem] overflow-hidden bg-white/5">
                              <img src={p.imageUrl || "/placeholder.png"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            </div>
                          </motion.div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            {/* Mobile Bottom Navigation (As in Image) */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-4 py-3 flex items-center justify-between z-40 pb-safe">
              <button className="flex flex-col items-center gap-1 text-zinc-400">
                <BookOpen className="w-5 h-5" />
                <span className="text-[9px] font-bold">Cardápio</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-red-500">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-[9px] font-bold">Delivery</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-zinc-400">
                <History className="w-5 h-5" />
                <span className="text-[9px] font-bold">Espera</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-zinc-400">
                <MapPin className="w-5 h-5" />
                <span className="text-[9px] font-bold">Mesa</span>
              </button>
              <button className="flex flex-col items-center gap-1 text-zinc-400">
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[9px] font-bold">Mais</span>
              </button>
            </nav>

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
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Sincronizado com a Mesa {tableId}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Cart FAB (Mobile Only) */}
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

            {/* ── BILL / MY TABLE MODAL (Moved Inside) ───────────────────────── */}
            <AnimatePresence>
              {showBill && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col lg:absolute lg:inset-0 lg:bg-zinc-950/95 lg:backdrop-blur-xl lg:z-40"
                >
                  <header className="p-8 flex items-center justify-between border-b border-white/5 lg:px-12">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-amber-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-serif text-white lg:text-3xl">Minha Mesa</h2>
                        <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Resumo do consumo</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowBill(false)}
                      className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-all active:scale-90"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </header>

                  <div className="flex-1 overflow-y-auto p-8 space-y-8 lg:px-12 lg:py-12">
                    <div className="max-w-2xl mx-auto w-full space-y-8">
                      {orders.length === 0 ? (
                        <div className="h-full py-20 flex flex-col items-center justify-center text-center space-y-4">
                          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center opacity-20">
                            <History className="w-10 h-10" />
                          </div>
                          <p className="text-sm text-white/30 font-medium">Você ainda não enviou pedidos para a cozinha.</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {orders.map((order, idx) => (
                            <div key={order.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4 lg:p-8">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Pedido #{orders.length - idx}</span>
                                <span className="text-[10px] font-black text-white/30">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="space-y-3">
                                {order.items.map((item: any, i: number) => (
                                  <div key={i} className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-black text-white/40">{item.quantity}x</span>
                                      <span className="text-sm font-medium text-white lg:text-base">{item.product.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-white/60 lg:text-sm">{fmt(item.price * item.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-8 bg-zinc-900 border-t border-white/5 lg:px-12 lg:py-10">
                    <div className="max-w-2xl mx-auto w-full space-y-6">
                      <div className="flex justify-between items-center px-2">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Total Acumulado</span>
                        <span className="text-2xl font-black text-white tracking-tighter tabular-nums lg:text-4xl">{fmt(totalBill)}</span>
                      </div>
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setShowBill(false)}
                          className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-white/70 text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white/10 transition-all active:scale-95"
                        >
                          Continuar Pedindo
                        </button>
                        <button 
                          onClick={() => {
                            if (tenant) {
                              socket.emit("request-checkout", { tenantId: tenant.id, tableId, customerName: customer.name });
                              showToast("Garçom chamado!");
                              setShowBill(false);
                            }
                          }}
                          className="flex-1 h-14 rounded-2xl bg-amber-500 text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-amber-500/20"
                        >
                          Finalizar e Pedir Conta
                        </button>
                      </div>
                    </div>
                  </div>
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
                  <div className="relative h-[35vh] shrink-0 lg:h-full lg:w-[45%] xl:w-[40%] lg:border-r lg:border-white/5">
                    <img 
                      src={selectedProduct.imageUrl || "/placeholder.png"} 
                      className="w-full h-full object-cover" 
                      alt={selectedProduct.name}
                    />
                    
                    <button 
                      onClick={() => {
                        setSelectedProduct(null);
                        setQty(1);
                        setNotes("");
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
                        <p className="text-lg font-bold text-zinc-900">{fmt(selectedProduct.price)}</p>
                        
                        <div className="bg-zinc-100 rounded-lg p-4 flex items-start gap-3 border border-zinc-200">
                          <div className="w-4 h-4 rounded-full bg-zinc-400 flex items-center justify-center text-white shrink-0 mt-0.5 italic font-serif text-[10px]">i</div>
                          <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                            Este restaurante não está aceitando pedidos no momento, mas você ainda pode visualizar o cardápio.
                          </p>
                        </div>
                      </div>

                      <div className="hidden lg:flex items-center justify-between pb-8 border-b border-white/5">
                        <div>
                          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1">Preço Unitário</p>
                          <p className="text-4xl font-black text-amber-500 tracking-tighter">{fmt(selectedProduct.price)}</p>
                        </div>
                      </div>

                      {/* Customization (Light Style for Mobile) */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold text-zinc-900 lg:text-amber-500 lg:uppercase lg:tracking-[0.2em]">Gostaria de acrescentar algo?</h4>
                            <span className="bg-zinc-100 text-zinc-400 text-[10px] px-2 py-0.5 rounded lg:hidden">Opcional</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-zinc-50 border border-zinc-100 rounded-xl lg:bg-white/5 lg:border-white/10">
                              <span className="text-sm text-zinc-700 lg:text-white">Opção Exemplo</span>
                              <Plus className="w-4 h-4 text-red-500" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-zinc-900 lg:text-white/30 lg:uppercase lg:tracking-widest">Observações</p>
                          <textarea 
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Insira aqui suas observações"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:border-red-500 transition-all min-h-[100px] resize-none lg:bg-white/5 lg:border-white/10 lg:text-white"
                          />
                          <div className="text-right text-[10px] text-zinc-400">0/140</div>
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
                      <button 
                        onClick={() => {
                          setCart([...cart, { productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, quantity: qty, notes }]);
                          setSelectedProduct(null);
                          setQty(1);
                          setNotes("");
                        }}
                        className="w-full h-14 rounded-xl bg-gradient-to-r from-[#C9A227] to-[#A8841C] text-black font-bold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-between px-6 lg:h-16 lg:rounded-2xl lg:px-10 lg:text-xs lg:uppercase lg:tracking-[0.2em]"
                      >
                        <div className="flex items-center gap-3">
                          <ShoppingBag className="w-5 h-5" />
                          <span>Adicionar</span>
                        </div>
                        <span className="text-base font-black">{fmt(selectedProduct.price * qty)}</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
