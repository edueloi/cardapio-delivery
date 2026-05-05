import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { 
  ShoppingCart, Plus, Minus, X, Send, Loader2, 
  ChevronRight, Utensils, Phone, User, CheckCircle2,
  Receipt, History, Check
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
  const [toast, setToast] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] selection:bg-amber-500/30 font-sans relative overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none">
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
        <div className="relative z-10 pb-32">
          {/* Header */}
          <header className="sticky top-0 z-40 bg-black/40 backdrop-blur-2xl border-b border-white/5 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setShowBill(true)}
                  className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 hover:bg-white/10 transition-all"
                >
                  <Receipt className="w-4 h-4 text-amber-500" />
                  <div className="text-left hidden sm:block">
                    <p className="text-[8px] font-black uppercase text-white/40 tracking-widest">Minha Conta</p>
                    <p className="text-xs font-black text-white">{fmt(totalBill)}</p>
                  </div>
                </button>
                <div className="h-8 w-px bg-white/5" />
                <div>
                  <h1 className="text-lg font-serif text-white leading-none">{tenant.name}</h1>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-1">
                    {tableId === 'Balcao' ? 'Balcão' : `Mesa ${tableId}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-0.5">Olá,</p>
                <p className="text-sm font-serif text-white">{customer.name.split(" ")[0]}</p>
              </div>
            </div>
          </header>

          {/* Categories & Products */}
          <div className="px-6 py-8 space-y-12 max-w-md mx-auto">
            {tenant.categories?.map(cat => (
              <section key={cat.id} className="space-y-6">
                <h2 className="text-xs font-black text-amber-500 uppercase tracking-[0.2em] flex items-center gap-3">
                  {cat.name}
                  <div className="flex-1 h-px bg-white/5" />
                </h2>
                <div className="space-y-4">
                  {cat.products.map(p => (
                    <motion.div 
                      key={p.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedProduct(p)}
                      className="group flex gap-4 p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 transition-all"
                    >
                      <div className="flex-1 space-y-2">
                        <h3 className="font-bold text-white group-hover:text-amber-500 transition-colors">{p.name}</h3>
                        <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">{p.description}</p>
                        <p className="text-sm font-black text-amber-500 pt-1">{fmt(p.price)}</p>
                      </div>
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5">
                        <img src={p.imageUrl || "/placeholder.png"} className="w-full h-full object-cover" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Cart FAB */}
          <AnimatePresence>
            {cart.length > 0 && (
              <motion.div 
                initial={{ y: 100, opacity: 0 }} 
                animate={{ y: 0, opacity: 1 }} 
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-8 left-4 right-4 z-50 flex justify-center"
              >
                <button 
                  onClick={handleOrder}
                  disabled={isOrdering}
                  className="w-full max-w-md bg-amber-500 text-black rounded-3xl p-4 flex items-center justify-between shadow-[0_20px_50px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-95 transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-black/10 flex items-center justify-center">
                      <Send className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">Enviar para Cozinha</p>
                      <p className="text-sm font-black leading-none">{cart.length} {cart.length === 1 ? 'Item' : 'Itens'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    <div className="h-8 w-px bg-black/10 mx-2" />
                    <span className="text-lg font-black tracking-tighter">
                      {isOrdering ? <Loader2 className="w-6 h-6 animate-spin" /> : fmt(total)}
                    </span>
                    <ChevronRight className="w-5 h-5 opacity-40 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

          {/* Toast Notification (Refined Pill) */}
          <AnimatePresence>
            {toast && (
              <motion.div 
                initial={{ y: -100, x: "-50%", opacity: 0 }}
                animate={{ y: 20, x: "-50%", opacity: 1 }}
                exit={{ y: -100, x: "-50%", opacity: 0 }}
                className="fixed top-0 left-1/2 z-[150] bg-white/10 backdrop-blur-2xl border border-white/20 px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 min-w-[240px] justify-center"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-black" />
                </div>
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{toast}</span>
              </motion.div>
            )}
          </AnimatePresence>

      {/* ── BILL / MY TABLE MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showBill && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
          >
            <header className="p-8 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-serif text-white">Minha Mesa</h2>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Resumo do consumo</p>
                </div>
              </div>
              <button 
                onClick={() => setShowBill(false)}
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {orders.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center opacity-20">
                    <History className="w-10 h-10" />
                  </div>
                  <p className="text-sm text-white/30 font-medium">Você ainda não enviou pedidos para a cozinha.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order, idx) => (
                    <div key={order.id} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Pedido #{orders.length - idx}</span>
                        <span className="text-[10px] font-black text-white/30">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="space-y-3">
                        {order.items.map((item: any, i: number) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-white/40">{item.quantity}x</span>
                              <span className="text-sm font-medium text-white">{item.product.name}</span>
                            </div>
                            <span className="text-xs font-black text-white/60">{fmt(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 bg-zinc-900 border-t border-white/5 space-y-4">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Total Acumulado</span>
                <span className="text-2xl font-black text-white tracking-tighter tabular-nums">{fmt(totalBill)}</span>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBill(false)}
                  className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
                >
                  Continuar
                </button>
                <button 
                  onClick={() => {
                    if (tenant) {
                      socket.emit("request-checkout", { tenantId: tenant.id, tableId, customerName: customer.name });
                      showToast("Garçom chamado!");
                      setShowBill(false);
                    }
                  }}
                  className="flex-1 h-11 rounded-xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20"
                >
                  Pedir Conta
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FULL SCREEN PRODUCT MODAL (REFINED) ─────────────────────────── */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.05 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col overflow-y-auto"
          >
            {/* Header / Image Area (Reduced Size) */}
            <div className="relative h-[32vh] shrink-0">
              <img 
                src={selectedProduct.imageUrl || "/placeholder.png"} 
                className="w-full h-full object-cover" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
              
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 left-6 w-10 h-10 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area (More Compact) */}
            <div className="flex-1 px-8 pt-2 pb-10 space-y-8">
              <div className="space-y-2">
                <div className="flex justify-between items-baseline gap-4">
                  <h2 className="text-2xl font-serif text-white leading-tight tracking-tight">{selectedProduct.name}</h2>
                  <span className="text-lg font-black text-amber-500 tracking-tighter">{fmt(selectedProduct.price)}</span>
                </div>
                <p className="text-sm text-white/30 font-medium leading-relaxed max-w-sm">{selectedProduct.description}</p>
              </div>

              {/* Customization (Slimmer) */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20 whitespace-nowrap">Observações</span>
                  <div className="h-px w-full bg-white/5" />
                </div>
                <input 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex: sem cebola, ponto da carne..."
                  className="w-full bg-transparent border-b border-white/5 py-2 text-white placeholder:text-white/10 focus:outline-none focus:border-amber-500/30 transition-all text-xs"
                />
              </div>

              {/* Quantity Selection (More Delicate) */}
              <div className="flex flex-col items-center gap-4 py-2">
                <p className="text-[8px] font-black uppercase tracking-widest text-white/10">Quantidade</p>
                <div className="flex items-center gap-8">
                  <button 
                    onClick={() => setQty(Math.max(1, qty - 1))} 
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/5 text-white/20 hover:text-white transition-all active:scale-90"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-serif text-3xl w-8 text-center text-white tabular-nums">{qty}</span>
                  <button 
                    onClick={() => setQty(qty + 1)} 
                    className="w-10 h-10 flex items-center justify-center rounded-full border border-white/5 text-white/20 hover:text-white transition-all active:scale-90"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Action Bar (Refined & Slim) */}
            <div className="sticky bottom-0 p-6 bg-zinc-950/80 backdrop-blur-md">
              <button 
                onClick={() => {
                  setCart([...cart, { productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, quantity: qty, notes }]);
                  setSelectedProduct(null);
                  setQty(1);
                  setNotes("");
                }}
                className="w-full h-12 rounded-xl bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-all flex items-center justify-center gap-4 group"
              >
                <span>Adicionar ao Pedido</span>
                <div className="h-3 w-px bg-black/20" />
                <span className="text-sm tracking-tighter tabular-nums">{fmt(selectedProduct.price * qty)}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
