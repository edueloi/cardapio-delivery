import React, { useState, useMemo } from "react";
import { 
  Search, Plus, Minus, X, ShoppingCart, 
  Trash2, CreditCard, Banknote, QrCode, 
  User, CheckCircle2, Receipt, Package,
  ChevronRight, ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, Order } from "../../types";
import { apiJson } from "../../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface PDVPanelProps {
  tenant: Tenant;
  onOrderCreated?: () => void;
}

export default function PDVPanel({ tenant, onOrderCreated }: PDVPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(tenant.categories?.[0]?.id || null);
  const [cart, setCart] = useState<Array<{ product: Product; quantity: number }>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR">("CASH");
  const [cardBrand, setCardBrand] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<string>("");

  const CARD_BRANDS = ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "VR", "Sodexo", "Ticket", "Alelo"];

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
      customerName: "Venda PDV",
      customerPhone: "00000000000",
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      orderType: "TAKEAWAY",
      paymentMethod: paymentMethod,
      paymentMetadata: {
        amountReceived: paymentMethod === "CASH" ? Number(amountReceived) : total,
        change: paymentMethod === "CASH" ? (Number(amountReceived) - total) : 0,
        cardBrand: cardBrand
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
      setCart([]);
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
      {/* Left Column: Products Selection */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
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

              {/* Inventory Badge */}
              {product.inventoryItem && (
                <div className="absolute top-2 right-2 bg-white/90 backdrop-blur shadow-sm border border-slate-100 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-500">
                  {product.inventoryItem.quantity} un
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right Column: Order Details */}
      <div className="w-full lg:w-96 flex flex-col bg-[#0D1B3E] rounded-[2rem] text-white overflow-hidden shadow-xl relative">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-black uppercase tracking-widest">Novo Pedido</h3>
            <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-[#C9A227]">
              PDV Balcão
            </div>
          </div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Caixa Aberto</p>
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

          <button 
            disabled={cart.length === 0}
            onClick={() => setShowCheckout(true)}
            className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-2xl transition-all shadow-xl shadow-[#C9A227]/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            Pagar Agora
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Checkout Modal Overlay */}
        <AnimatePresence>
          {showCheckout && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-[#0D1B3E] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <button onClick={() => setShowCheckout(false)} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
                </button>
                <h3 className="text-sm font-black uppercase tracking-widest">Finalizar Venda</h3>
                <div className="w-10" />
              </div>

              <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Valor a Receber</p>
                  <h2 className="text-5xl font-black tracking-tighter text-[#C9A227]">{fmt(total)}</h2>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Forma de Pagamento</p>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: "CASH", label: "Dinheiro", icon: Banknote, desc: "Manual no caixa" },
                        { id: "DEBIT", label: "Débito", icon: CreditCard, desc: "Cartão à vista" },
                        { id: "CREDIT", label: "Crédito", icon: CreditCard, desc: "Cartão parcelado" },
                        { id: "PIX", label: "PIX", icon: QrCode, desc: "Transferência inst." },
                        { id: "VR", label: "Refeição/VR", icon: Receipt, desc: "Vale alimentação" }
                      ].map((method) => (
                        <button 
                          key={method.id}
                          onClick={() => {
                            setPaymentMethod(method.id as any);
                            if (method.id === "CASH") setCardBrand("");
                          }}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                            paymentMethod === method.id ? 'bg-[#C9A227] border-[#C9A227] text-black' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                          }`}
                        >
                          <method.icon className="w-5 h-5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest">{method.label}</p>
                            <p className={`text-[8px] font-medium opacity-60 truncate ${paymentMethod === method.id ? 'text-black' : 'text-white'}`}>{method.desc}</p>
                          </div>
                          {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {paymentMethod === "CASH" ? (
                      <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Cálculo de Troco</p>
                        <div className="space-y-4 bg-white/5 rounded-2xl p-6 border border-white/10">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-[#C9A227]">Valor Recebido</label>
                            <input 
                              type="number"
                              value={amountReceived}
                              onChange={e => setAmountReceived(e.target.value)}
                              placeholder="0,00"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xl font-black text-white focus:border-[#C9A227] outline-none"
                            />
                          </div>
                          {Number(amountReceived) > total && (
                            <div className="pt-4 border-t border-white/5 space-y-1">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Troco do Cliente</p>
                              <p className="text-3xl font-black text-green-400 tabular-nums">{fmt(Number(amountReceived) - total)}</p>
                            </div>
                          )}
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
                              className={`p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                cardBrand === brand ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                              }`}
                            >
                              {brand}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <QrCode className="w-16 h-16 text-[#C9A227]" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Aguardando confirmação do PIX</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-black/20 border-t border-white/5">
                <button 
                  disabled={isProcessing}
                  onClick={handleCheckout}
                  className="w-full bg-[#C9A227] hover:bg-[#E8B93A] text-black font-black py-5 rounded-2xl transition-all shadow-2xl shadow-[#C9A227]/30 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                >
                  {isProcessing ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : "Concluir Venda"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
