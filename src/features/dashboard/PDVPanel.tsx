import React, { useState, useMemo } from "react";
import { 
  Search, Plus, Minus, X, ShoppingCart, 
  Trash2, CreditCard, Banknote, QrCode, 
  User, CheckCircle2, Receipt, Package,
  ChevronRight, ArrowLeft,
  Utensils
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, Order, PaymentConfig } from "../../types";
import { apiJson } from "../../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface PDVPanelProps {
  tenant: Tenant;
  onOrderCreated?: () => void;
  checkoutRequests?: Array<{ tableId: string; customerName: string; timestamp: number }>;
  onClearTable?: (tableId: string) => void;
  orders?: Order[];
}

export default function PDVPanel({ tenant, onOrderCreated, checkoutRequests = [], onClearTable, orders = [] }: PDVPanelProps) {
  const [activeTab, setActiveTab] = useState<"products" | "tables" | "comandas">("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(tenant.categories?.[0]?.id || null);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [comandaNumber, setComandaNumber] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR">("CASH");
  const [cardBrand, setCardBrand] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<string>("");

  const paymentConfig = useMemo(() => {
    try {
      return tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) as PaymentConfig : {};
    } catch (e) {
      return {};
    }
  }, [tenant.paymentMethods]);

  const CARD_BRANDS = useMemo(() => {
    const methodMap: Record<string, keyof PaymentConfig> = {
      'CREDIT': 'credit',
      'DEBIT': 'debit',
      'VR': 'meal',
      'PIX': 'pix'
    };
    
    const configKey = methodMap[paymentMethod];
    const methodConfig = configKey ? (paymentConfig[configKey] as any) : null;
    
    if (methodConfig?.acceptedBrands && methodConfig.acceptedBrands.length > 0) {
      return methodConfig.acceptedBrands;
    }

    // Fallback defaults if nothing configured for this specific method
    return ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "VR", "Sodexo", "Ticket", "Alelo"];
  }, [paymentConfig, paymentMethod]);

  const filteredProducts = useMemo(() => {
    let products: Product[] = [];
    tenant.categories.forEach(cat => {
      if (!selectedCategoryId || cat.id === selectedCategoryId) {
        products = [...products, ...cat.products];
      }
    });

    if (searchTerm) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return products;
  }, [tenant, selectedCategoryId, searchTerm]);

  const total = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    
    const orderData = {
      customerName: selectedTableId ? `Mesa ${selectedTableId}` : "Venda PDV",
      customerPhone: "00000000000",
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      orderType: selectedTableId ? "DINE_IN" : "TAKEAWAY",
      paymentMethod: paymentMethod,
      paymentMetadata: {
        amountReceived: paymentMethod === "CASH" ? Number(amountReceived) : total,
        change: paymentMethod === "CASH" ? (Number(amountReceived) - total) : 0,
        cardBrand: cardBrand,
        tableId: selectedTableId
      },
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
      total,
      status: "DELIVERED"
    };

    try {
      await apiJson("/api/orders", {
        method: "POST",
        body: JSON.stringify(orderData)
      });
      
      if (selectedTableId && onClearTable) {
        await onClearTable(selectedTableId);
      }

      setCart([]);
      setSelectedTableId(null);
      setShowCheckout(false);
      onOrderCreated?.();
      alert("Venda realizada com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao processar venda.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadTable = (tableId: string) => {
    const tableOrders = orders.filter(o => o.tableId === tableId && o.status !== 'CANCELLED' && o.status !== 'DELIVERED');
    const items: Array<{ product: Product; quantity: number }> = [];
    
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.product) {
          const existing = items.find(i => i.product.id === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            items.push({ product: item.product, quantity: item.quantity });
          }
        }
      });
    });

    setCart(items);
    setSelectedTableId(tableId);
    setActiveTab("products");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
      {/* Left Column: Selection Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Tabs */}
        <div className="flex bg-slate-50 border-b border-slate-100">
          <button 
            onClick={() => setActiveTab("products")}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === "products" ? 'border-[#C9A227] text-[#C9A227] bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Produtos
          </button>
          <button 
            onClick={() => setActiveTab("tables")}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 relative ${
              activeTab === "tables" ? 'border-[#C9A227] text-[#C9A227] bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Mesas
            {checkoutRequests.length > 0 && (
              <span className="absolute top-3 right-1/4 w-5 h-5 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full animate-bounce">
                {checkoutRequests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("comandas")}
            className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
              activeTab === "comandas" ? 'border-[#C9A227] text-[#C9A227] bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Comandas
          </button>
        </div>

        {activeTab === "products" ? (
          <>
            {/* Search & Categories */}
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Pesquisar produto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-[#C9A227] focus:ring-4 focus:ring-[#C9A227]/5 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                <button 
                  onClick={() => setSelectedCategoryId(null)}
                  className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                    !selectedCategoryId ? 'bg-[#0D1B3E] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  Todos
                </button>
                {tenant.categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      selectedCategoryId === cat.id ? 'bg-[#0D1B3E] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 custom-scrollbar">
              {filteredProducts.map(product => (
                <button 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="group flex flex-col bg-white border border-slate-100 rounded-2xl p-3 text-left hover:border-[#C9A227]/50 hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-slate-50">
                    <img src={product.imageUrl || "/placeholder.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{product.name}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mb-2">{product.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-sm font-black text-[#C9A227]">{fmt(product.price)}</span>
                    <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#C9A227] group-hover:text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                  </div>

                  {product.inventoryItem && (
                    <div className="absolute top-2 right-2 bg-white/90 backdrop-blur shadow-sm border border-slate-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">
                      {product.inventoryItem.quantity} un
                    </div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : activeTab === "tables" ? (
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50">
            {checkoutRequests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                  <Receipt className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Nenhuma mesa aguardando fechamento</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {checkoutRequests.map(req => (
                  <button 
                    key={req.timestamp}
                    onClick={() => handleLoadTable(req.tableId)}
                    className="bg-white p-6 rounded-3xl border-2 border-slate-100 hover:border-[#C9A227] hover:shadow-xl transition-all text-left space-y-4 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-[#C9A227] group-hover:text-white transition-colors">
                        <Utensils className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-black uppercase text-slate-400">{new Date(req.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-800">Mesa {req.tableId}</h4>
                      <p className="text-xs font-bold text-slate-400">{req.customerName}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#C9A227]">Ver Itens</span>
                      <ChevronRight className="w-4 h-4 text-[#C9A227]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50">
             <div className="flex items-center justify-between">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Comandas Ativas</h4>
               <button 
                 onClick={() => {
                   setComandaNumber("");
                   setShowComandaModal(true);
                 }}
                 className="bg-[#0D1B3E] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all"
               >
                 <Plus className="w-3 h-3" />
                 Nova Comanda
               </button>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
               {orders.filter(o => o.orderType === 'DINE_IN' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && !o.tableId).map(comanda => (
                 <button 
                   key={comanda.id}
                   onClick={() => {
                     setCart(comanda.items.filter(i => i.product).map(i => ({ product: i.product!, quantity: i.quantity })));
                     setSelectedComandaId(comanda.id);
                     setComandaNumber(comanda.customerName || "");
                     setActiveTab("products");
                   }}
                   className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-[#C9A227] hover:shadow-lg transition-all text-left space-y-3 group"
                 >
                   <div className="flex items-center justify-between">
                     <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center">
                       <CreditCard className="w-5 h-5" />
                     </div>
                     <span className="text-[10px] font-black text-[#C9A227]">{fmt(comanda.total)}</span>
                   </div>
                   <div>
                     <h4 className="text-lg font-black text-slate-800">Comanda {comanda.customerName}</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{comanda.items.length} itens lançados</p>
                   </div>
                 </button>
               ))}
               
               {orders.filter(o => o.orderType === 'DINE_IN' && o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && !o.tableId).length === 0 && (
                 <div className="col-span-full py-20 text-center opacity-30">
                    <p className="text-sm font-black uppercase tracking-widest">Nenhuma comanda aberta</p>
                 </div>
               )}
             </div>
          </div>
        )}
      </div>

      {/* Right Column: Order Details */}
      <div className="w-full lg:w-96 flex flex-col bg-[#0D1B3E] rounded-[2rem] text-white overflow-hidden shadow-xl relative">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black uppercase tracking-widest">
              {selectedTableId ? `Mesa ${selectedTableId}` : 'Novo Pedido'}
            </h3>
            {selectedTableId && (
              <button 
                onClick={() => {
                  setSelectedTableId(null);
                  setCart([]);
                }}
                className="text-white/40 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {selectedTableId ? 'Fechamento de Conta' : 'Venda Rápida Balcão'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Carrinho Vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <img src={item.product.imageUrl || "/placeholder.png"} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                  <p className="text-[10px] font-black text-[#C9A227]">{fmt(item.product.price)}</p>
                </div>
                <div className="flex items-center gap-3 bg-white/5 rounded-xl p-1">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:text-[#C9A227] transition-colors"><Minus className="w-3 h-3" /></button>
                  <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:text-[#C9A227] transition-colors"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-white/20 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-black/20 border-t border-white/5 space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest">
              <span>Subtotal</span>
              <span>{fmt(total)}</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest text-[#C9A227]">Total</span>
              <span className="text-3xl font-black tracking-tighter tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              disabled={cart.length === 0}
              onClick={() => {
                if (selectedTableId || selectedComandaId) {
                  setShowCheckout(true);
                } else {
                  setShowComandaModal(true);
                }
              }}
              className="bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
            >
              Lançar
              <Package className="w-4 h-4" />
            </button>
            <button 
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-[#C9A227]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-[10px]"
            >
              Pagar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Comanda Number Modal */}
        <AnimatePresence>
          {showComandaModal && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm space-y-6 shadow-2xl"
              >
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Abrir Comanda</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase">Identifique o cliente ou o cartão</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Número ou Nome</label>
                  <input 
                    type="text"
                    autoFocus
                    value={comandaNumber}
                    onChange={e => setComandaNumber(e.target.value)}
                    placeholder="Ex: 05 ou João"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 text-xl font-black text-slate-800 focus:border-[#C9A227] outline-none text-center"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowComandaModal(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={!comandaNumber}
                    onClick={async () => {
                      setIsProcessing(true);
                      const orderData = {
                        customerName: comandaNumber,
                        customerPhone: "00000000000",
                        tenantId: tenant.id,
                        tenantSlug: tenant.slug,
                        orderType: "DINE_IN",
                        paymentMethod: "CASH",
                        items: cart.map(item => ({
                          productId: item.product.id,
                          quantity: item.quantity,
                        })),
                        total,
                        status: "PENDING" // Comanda stays open as pending
                      };
                      try {
                        await apiJson("/api/orders", { method: "POST", body: JSON.stringify(orderData) });
                        setCart([]);
                        setComandaNumber("");
                        setShowComandaModal(false);
                        onOrderCreated?.();
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    className="bg-[#0D1B3E] hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    Abrir/Lançar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Checkout Modal Overlay */}
        <AnimatePresence>
          {showCheckout && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20, opacity: 0 }} 
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="bg-[#0D1B3E] w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row"
              >
                {/* Modal Left: Info Summary */}
                <div className="w-full md:w-80 bg-black/20 p-8 flex flex-col justify-between border-r border-white/5">
                  <div>
                    <button onClick={() => setShowCheckout(false)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group">
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
                    </button>
                    
                    <div className="space-y-1 mb-8">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Resumo do Pedido</p>
                      <h3 className="text-xl font-black text-white truncate">
                        {selectedTableId ? `Mesa ${selectedTableId}` : 'Venda Balcão'}
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-white/40 font-bold uppercase">Itens</span>
                        <span className="font-black text-white">{cart.length}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-white/40 font-bold uppercase">Subtotal</span>
                        <span className="font-black text-white">{fmt(total)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-white/10">
                    <p className="text-[10px] font-black uppercase text-[#C9A227] tracking-[0.3em] mb-1">Total a Pagar</p>
                    <h2 className="text-4xl font-black tracking-tighter text-white tabular-nums">{fmt(total)}</h2>
                  </div>
                </div>

                {/* Modal Right: Payment Options */}
                <div className="flex-1 p-8 space-y-8 bg-[#0D1B3E]">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Payment Methods */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Forma de Pagamento</p>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: "CASH", label: "Dinheiro", icon: Banknote, desc: "Espécie" },
                          { id: "DEBIT", label: "Débito", icon: CreditCard, desc: "À vista" },
                          { id: "CREDIT", label: "Crédito", icon: CreditCard, desc: "Parcelado" },
                          { id: "PIX", label: "PIX", icon: QrCode, desc: "Instantâneo" },
                          { id: "VR", label: "Refeição/VR", icon: Receipt, desc: "Ticket/VR" }
                        ].map((method) => (
                          <button 
                            key={method.id}
                            onClick={() => {
                              setPaymentMethod(method.id as any);
                              if (method.id !== "CASH") setAmountReceived("");
                              if (method.id === "CASH") setCardBrand("");
                            }}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left group ${
                              paymentMethod === method.id 
                                ? 'bg-[#C9A227] border-[#C9A227] text-white shadow-xl shadow-[#C9A227]/20' 
                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              paymentMethod === method.id ? 'bg-white/20' : 'bg-white/5'
                            }`}>
                              <method.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] font-black uppercase tracking-widest ${paymentMethod === method.id ? 'text-white' : 'text-white'}`}>{method.label}</p>
                              <p className={`text-[9px] font-bold opacity-50 truncate ${paymentMethod === method.id ? 'text-white' : 'text-white/40'}`}>{method.desc}</p>
                            </div>
                            {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Secondary Context (Change or Card Brands) */}
                    <div className="space-y-4">
                      {paymentMethod === "CASH" ? (
                        <div className="space-y-4 h-full">
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Cálculo de Troco</p>
                          <div className="bg-white/5 rounded-[2rem] p-6 border border-white/10 flex flex-col justify-between h-[280px]">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest ml-1">Valor Recebido</label>
                              <input 
                                type="number"
                                value={amountReceived}
                                onChange={e => setAmountReceived(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-black text-white focus:border-[#C9A227] outline-none text-center"
                              />
                            </div>
                            
                            <div className="pt-6 border-t border-white/5 flex flex-col items-center">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Troco a devolver</p>
                              <p className={`text-4xl font-black tabular-nums ${Number(amountReceived) >= total ? 'text-green-400' : 'text-white/20'}`}>
                                {Number(amountReceived) > total ? fmt(Number(amountReceived) - total) : 'R$ 0,00'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : paymentMethod !== "PIX" ? (
                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Bandeira do Cartão</p>
                          <div className="grid grid-cols-2 gap-2">
                            {CARD_BRANDS.map(brand => (
                              <button 
                                key={brand}
                                onClick={() => setCardBrand(brand)}
                                className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all min-h-[48px] flex items-center justify-center text-center leading-tight ${
                                  cardBrand === brand 
                                    ? 'bg-white text-[#0D1B3E] border-white shadow-lg' 
                                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                }`}
                              >
                                {brand}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 bg-white/5 rounded-[2rem] border border-white/10 p-8">
                          <div className="w-20 h-20 bg-[#C9A227]/10 rounded-full flex items-center justify-center animate-pulse">
                            <QrCode className="w-10 h-10 text-[#C9A227]" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white">PIX Selecionado</p>
                            <p className="text-[10px] text-white/40 font-medium max-w-[180px]">Confirme o recebimento no app do banco antes de concluir.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      disabled={isProcessing || (paymentMethod === "CASH" && Number(amountReceived) < total && amountReceived !== "")}
                      onClick={handleCheckout}
                      className="w-full bg-[#C9A227] hover:bg-[#E8B93A] text-white font-black py-5 rounded-2xl transition-all shadow-2xl shadow-[#C9A227]/40 flex items-center justify-center gap-3 uppercase tracking-[0.25em] text-sm active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Finalizar Venda
                          <CheckCircle2 className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
