import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  Search, Plus, Minus, X, ShoppingCart,
  Trash2, CreditCard, Banknote, QrCode,
  CheckCircle2, Receipt, Package,
  ChevronRight, ArrowLeft,
  Utensils, Tag, User, Phone, Percent,
  Printer, StickyNote, Hash, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, Order, PaymentConfig } from "../../types";
import { apiJson } from "../../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
  price: number; // allows manual override
}

interface PDVPanelProps {
  tenant: Tenant;
  onOrderCreated?: () => void;
  checkoutRequests?: Array<{ tableId: string; customerName: string; timestamp: number }>;
  onClearTable?: (tableId: string) => void;
  orders?: Order[];
}

const PAYMENT_METHODS = [
  { id: "CASH",   label: "Dinheiro",      icon: Banknote,    desc: "Espécie" },
  { id: "DEBIT",  label: "Débito",        icon: CreditCard,  desc: "À vista" },
  { id: "CREDIT", label: "Crédito",       icon: CreditCard,  desc: "Parcelado" },
  { id: "PIX",    label: "PIX",           icon: QrCode,      desc: "Instantâneo" },
  { id: "VR",     label: "Refeição/VR",   icon: Receipt,     desc: "Ticket/VR" },
];

export default function PDVPanel({
  tenant,
  onOrderCreated,
  checkoutRequests = [],
  onClearTable,
  orders = [],
}: PDVPanelProps) {
  const [activeTab, setActiveTab] = useState<"products" | "tables" | "comandas">("products");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [comandaNumber, setComandaNumber] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR">("CASH");
  const [cardBrand, setCardBrand] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);

  // Discount
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Item notes editor
  const [editingItemNotes, setEditingItemNotes] = useState<string | null>(null);

  // Success flash
  const [showSuccess, setShowSuccess] = useState(false);

  const lastOrderRef = useRef<any>(null);

  const paymentConfig = useMemo(() => {
    try { return tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) as PaymentConfig : {}; }
    catch { return {}; }
  }, [tenant.paymentMethods]);

  const CARD_BRANDS = useMemo(() => {
    const methodMap: Record<string, keyof PaymentConfig> = { CREDIT: "credit", DEBIT: "debit", VR: "meal" };
    const key = methodMap[paymentMethod];
    const cfg = key ? (paymentConfig[key] as any) : null;
    if (cfg?.acceptedBrands?.length) return cfg.acceptedBrands as string[];
    return ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "VR", "Sodexo", "Ticket", "Alelo"];
  }, [paymentConfig, paymentMethod]);

  const filteredProducts = useMemo(() => {
    let products: Product[] = [];
    tenant.categories.forEach((cat) => {
      if (!selectedCategoryId || cat.id === selectedCategoryId) {
        products = [...products, ...cat.products];
      }
    });
    if (searchTerm) {
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return products.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tenant, selectedCategoryId, searchTerm]);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue || "0");
    if (!v) return 0;
    return discountType === "PERCENT" ? subtotal * (v / 100) : Math.min(v, subtotal);
  }, [subtotal, discountValue, discountType]);

  const total = Math.max(0, subtotal - discountAmount);
  const change = paymentMethod === "CASH" ? Math.max(0, Number(amountReceived) - total) : 0;

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, notes: "", price: product.price }];
    });
  }, []);

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.product.id !== productId));

  const updateQuantity = (productId: string, delta: number) =>
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    );

  const updateItemNotes = (productId: string, notes: string) =>
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, notes } : i)));

  const clearCart = () => {
    setCart([]);
    setSelectedTableId(null);
    setSelectedComandaId(null);
    setCustomerName("");
    setCustomerPhone("");
    setDiscountValue("");
    setAmountReceived("");
    setCardBrand("");
  };

  const handleLoadTable = (tableId: string) => {
    const tableOrders = orders.filter(
      (o) => o.tableId === tableId && o.status !== "CANCELLED" && o.status !== "DELIVERED"
    );
    const items: CartItem[] = [];
    tableOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.product) {
          const existing = items.find((i) => i.product.id === item.productId);
          if (existing) { existing.quantity += item.quantity; }
          else { items.push({ product: item.product, quantity: item.quantity, notes: item.notes || "", price: item.price }); }
        }
      });
    });
    setCart(items);
    setSelectedTableId(tableId);
    setActiveTab("products");
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    const orderData = {
      customerName: customerName || (selectedTableId ? `Mesa ${selectedTableId}` : "Venda PDV"),
      customerPhone: customerPhone || "00000000000",
      orderType: selectedTableId ? "DINE_IN" : "TAKEAWAY",
      tableId: selectedTableId || undefined,
      paymentMethod,
      paymentMetadata: {
        amountReceived: paymentMethod === "CASH" ? Number(amountReceived) : total,
        change,
        cardBrand,
        installments: paymentMethod === "CREDIT" ? installments : 1,
      },
      discount: discountValue ? parseFloat(discountValue) : 0,
      discountType,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || undefined,
      })),
    };

    try {
      const order = await apiJson(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify(orderData),
      });
      lastOrderRef.current = order;

      if (selectedTableId && onClearTable) await onClearTable(selectedTableId);

      clearCart();
      setShowCheckout(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      onOrderCreated?.();
    } catch (err) {
      console.error(err);
      alert("Erro ao processar venda.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    const order = lastOrderRef.current;
    if (!order) return;
    const html = `
      <html><head><title>Cupom</title>
      <style>body{font-family:monospace;font-size:12px;margin:20px}h2{text-align:center}table{width:100%}td{padding:2px 4px}.total{font-size:16px;font-weight:bold}.separator{border-top:1px dashed #000;margin:8px 0}</style>
      </head><body>
      <h2>${tenant.name}</h2>
      <p style="text-align:center">${new Date().toLocaleString("pt-BR")}</p>
      <div class="separator"></div>
      ${order.items?.map((i: any) => `<table><tr><td>${i.quantity}x ${i.product?.name || ""}</td><td style="text-align:right">${fmt(i.price * i.quantity)}</td></tr>${i.notes ? `<tr><td colspan="2" style="padding-left:12px;font-style:italic;font-size:11px">Obs: ${i.notes}</td></tr>` : ""}</table>`).join("")}
      <div class="separator"></div>
      ${discountAmount > 0 ? `<table><tr><td>Desconto</td><td style="text-align:right">-${fmt(discountAmount)}</td></tr></table>` : ""}
      <table><tr><td class="total">TOTAL</td><td class="total" style="text-align:right">${fmt(order.total)}</td></tr></table>
      <p>Pagamento: ${paymentMethod}</p>
      ${paymentMethod === "CASH" ? `<p>Recebido: ${fmt(Number(amountReceived))}<br>Troco: ${fmt(change)}</p>` : ""}
      <div class="separator"></div>
      <p style="text-align:center">Obrigado pela preferência!</p>
      </body></html>
    `;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printReceipt) {
      desktop.printReceipt(html);
    } else {
      const win = window.open("", "_blank", "width=380,height=600");
      if (!win) return;
      win.document.write(html);
      win.print();
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-2 lg:gap-4 h-full min-h-0">
      {/* ── Success flash ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm"
          >
            <CheckCircle2 className="w-5 h-5" />
            Venda realizada com sucesso!
            <button onClick={handlePrintReceipt} className="ml-2 underline text-xs font-bold opacity-80">
              Imprimir cupom
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left: Product Selection ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex bg-white border-b border-slate-100 px-3 gap-1 pt-2">
          {(["products", "tables", "comandas"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-2.5 pt-1.5 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 relative rounded-t-lg ${
                activeTab === tab
                  ? "border-[#C9A227] text-[#0D1B3E]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              }`}
            >
              {tab === "products" ? "Produtos" : tab === "tables" ? "Mesas" : "Comandas"}
              {tab === "tables" && checkoutRequests.length > 0 && (
                <span className="absolute -top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full">
                  {checkoutRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <>
            {/* Search + categories */}
            <div className="p-3 border-b border-slate-100 bg-white space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#C9A227] focus:bg-white outline-none transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                    !selectedCategoryId
                      ? "bg-[#0D1B3E] text-white border-[#0D1B3E] shadow-sm"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  Todos ({tenant.categories.reduce((s, c) => s + c.products.length, 0)})
                </button>
                {tenant.categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                      selectedCategoryId === cat.id
                        ? "bg-[#C9A227] text-black border-[#C9A227] shadow-sm"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                    }`}
                  >
                    {cat.name} ({cat.products.length})
                  </button>
                ))}
              </div>
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
                  <Package className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`group flex flex-col text-left rounded-2xl overflow-hidden transition-all duration-200 relative ${
                          inCart
                            ? "ring-2 ring-[#C9A227] shadow-xl shadow-[#C9A227]/15 bg-white"
                            : "ring-1 ring-slate-200 bg-white hover:ring-[#C9A227]/50 hover:shadow-lg"
                        }`}
                      >
                        {/* Image — square, object-contain so full product is visible */}
                        <div className="w-full aspect-square bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden relative flex items-center justify-center p-3">
                          <img
                            src={product.imageUrl || "/placeholder.png"}
                            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
                            alt={product.name}
                          />
                          {/* Cart qty badge */}
                          {inCart && (
                            <div className="absolute top-2 right-2 min-w-[26px] h-[26px] px-1.5 bg-[#C9A227] text-black text-xs font-black rounded-full flex items-center justify-center shadow-lg">
                              {inCart.quantity}
                            </div>
                          )}
                          {/* Stock badge */}
                          {product.inventoryItem && (
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold rounded-lg px-2 py-0.5 uppercase tracking-wide">
                              {product.inventoryItem.quantity} un
                            </div>
                          )}
                          {/* Add overlay on hover */}
                          {!inCart && (
                            <div className="absolute inset-0 bg-[#C9A227]/0 group-hover:bg-[#C9A227]/8 transition-colors duration-200 flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-10 h-10 bg-[#C9A227] rounded-full flex items-center justify-center shadow-xl">
                                <Plus className="w-5 h-5 text-black" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="px-3 py-2.5 flex flex-col gap-0.5">
                          <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1 leading-snug">{product.name}</h4>
                          {product.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[15px] font-black text-[#C9A227] leading-none">{fmt(product.price)}</span>
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                              inCart
                                ? "bg-[#C9A227] text-black shadow-md"
                                : "bg-slate-100 text-slate-400 group-hover:bg-[#C9A227] group-hover:text-black"
                            }`}>
                              <Plus className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tables Tab */}
        {activeTab === "tables" && (() => {
          // Build active tables from orders (PENDING, PREPARING, SHIPPED = still open)
          const activeTableMap = new Map<string, { tableId: string; customerName: string; total: number; orderCount: number; lastAt: string; wantsCheckout: boolean }>();
          orders.forEach((o) => {
            if (!o.tableId || o.orderType !== "DINE_IN") return;
            if (o.status === "DELIVERED" || o.status === "CANCELLED") return;
            const existing = activeTableMap.get(o.tableId);
            if (existing) {
              existing.total += o.total;
              existing.orderCount += 1;
              if (o.createdAt > existing.lastAt) existing.lastAt = o.createdAt;
            } else {
              activeTableMap.set(o.tableId, {
                tableId: o.tableId,
                customerName: o.customerName,
                total: o.total,
                orderCount: 1,
                lastAt: o.createdAt,
                wantsCheckout: checkoutRequests.some(r => r.tableId === o.tableId),
              });
            }
          });
          // Mark checkout requests even if no order yet in state
          checkoutRequests.forEach((r) => {
            if (!activeTableMap.has(r.tableId)) {
              activeTableMap.set(r.tableId, { tableId: r.tableId, customerName: r.customerName, total: 0, orderCount: 0, lastAt: new Date(r.timestamp).toISOString(), wantsCheckout: true });
            } else {
              activeTableMap.get(r.tableId)!.wantsCheckout = true;
            }
          });
          const activeTables = Array.from(activeTableMap.values()).sort((a, b) => Number(a.tableId) - Number(b.tableId));

          return (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
              {activeTables.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Utensils className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                    Nenhuma mesa com pedido ativo
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeTables.map((tbl) => (
                    <button
                      key={tbl.tableId}
                      onClick={() => handleLoadTable(tbl.tableId)}
                      className={`bg-white p-6 rounded-3xl border-2 hover:shadow-xl transition-all text-left space-y-4 group ${tbl.wantsCheckout ? 'border-red-300 hover:border-red-500' : 'border-slate-100 hover:border-[#C9A227]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${tbl.wantsCheckout ? 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white' : 'bg-amber-50 text-amber-500 group-hover:bg-[#C9A227] group-hover:text-white'}`}>
                          <Utensils className="w-6 h-6" />
                        </div>
                        {tbl.wantsCheckout && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-red-500 bg-red-50 px-2 py-1 rounded-full">Pedir Conta</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-800">Mesa {tbl.tableId}</h4>
                        <p className="text-xs font-bold text-slate-400">{tbl.customerName}</p>
                      </div>
                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-700">{fmt(tbl.total)}</span>
                        <div className="flex items-center gap-1 text-[#C9A227]">
                          <span className="text-[10px] font-black uppercase tracking-widest">Abrir</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Comandas Tab */}
        {activeTab === "comandas" && (
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Comandas Ativas</h4>
              <button
                onClick={() => { setComandaNumber(""); setShowComandaModal(true); }}
                className="bg-[#0D1B3E] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Plus className="w-3 h-3" />
                Nova Comanda
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders
                .filter((o) => o.orderType === "DINE_IN" && !["DELIVERED", "CANCELLED"].includes(o.status) && !o.tableId)
                .map((comanda) => (
                  <button
                    key={comanda.id}
                    onClick={() => {
                      setCart(
                        comanda.items
                          .filter((i) => i.product)
                          .map((i) => ({ product: i.product!, quantity: i.quantity, notes: i.notes || "", price: i.price }))
                      );
                      setSelectedComandaId(comanda.id);
                      setComandaNumber(comanda.customerName || "");
                      setActiveTab("products");
                    }}
                    className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-[#C9A227] hover:shadow-lg transition-all text-left space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black text-[#C9A227]">{fmt(comanda.total)}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-800">Comanda {comanda.customerName}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {comanda.items.length} itens
                      </p>
                    </div>
                  </button>
                ))}
              {orders.filter((o) => o.orderType === "DINE_IN" && !["DELIVERED", "CANCELLED"].includes(o.status) && !o.tableId).length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30">
                  <p className="text-sm font-black uppercase tracking-widest">Nenhuma comanda aberta</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Order/Cart Panel ── */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-[#0D1B3E] rounded-[2rem] text-white overflow-hidden shadow-xl relative shrink-0">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-black uppercase tracking-widest">
              {selectedTableId ? `Mesa ${selectedTableId}` : "Novo Pedido"}
            </h3>
            {(selectedTableId || cart.length > 0) && (
              <button onClick={clearCart} className="text-white/30 hover:text-red-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            {selectedTableId ? "Fechamento de Conta" : "Venda Rápida Balcão"}
          </p>
        </div>

        {/* Customer info (compact) */}
        <div className="px-6 py-3 border-b border-white/5 grid grid-cols-2 gap-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
            <input
              type="text"
              placeholder="Nome do cliente"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
            <input
              type="tel"
              placeholder="Telefone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
            />
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Carrinho Vazio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="bg-white/5 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img
                      src={item.product.imageUrl || "/placeholder.png"}
                      className="w-full h-full object-cover"
                      alt={item.product.name}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                    <p className="text-[10px] font-black text-[#C9A227]">{fmt(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 rounded-lg px-1 py-1">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:text-[#C9A227] transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:text-[#C9A227] transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-black tabular-nums text-white/70">
                    {fmt(item.price * item.quantity)}
                  </span>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-white/20 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Notes toggle */}
                {editingItemNotes === item.product.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Observação (ex: sem cebola)"
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.product.id, e.target.value)}
                      onBlur={() => setEditingItemNotes(null)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingItemNotes(item.product.id)}
                    className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <StickyNote className="w-3 h-3" />
                    {item.notes ? (
                      <span className="italic text-white/50">{item.notes}</span>
                    ) : (
                      <span>Adicionar observação</span>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/5 space-y-3">
          {/* Discount row */}
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 rounded-xl overflow-hidden border border-white/10">
              <button
                onClick={() => setDiscountType("FIXED")}
                className={`px-3 py-2 text-[10px] font-black transition-all ${discountType === "FIXED" ? "bg-[#C9A227] text-black" : "text-white/40"}`}
              >
                R$
              </button>
              <button
                onClick={() => setDiscountType("PERCENT")}
                className={`px-3 py-2 text-[10px] font-black transition-all ${discountType === "PERCENT" ? "bg-[#C9A227] text-black" : "text-white/40"}`}
              >
                %
              </button>
            </div>
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
              <input
                type="number"
                placeholder={discountType === "PERCENT" ? "Desconto %" : "Desconto R$"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
              />
            </div>
            {discountAmount > 0 && (
              <span className="text-xs font-black text-green-400 whitespace-nowrap">-{fmt(discountAmount)}</span>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-black uppercase text-white/30">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[10px] font-black uppercase text-green-400">
                <span>Desconto</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-end">
              <span className="text-xs font-black uppercase tracking-widest text-[#C9A227]">Total</span>
              <span className="text-3xl font-black tracking-tighter tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={cart.length === 0}
              onClick={() => {
                if (selectedTableId || selectedComandaId) setShowCheckout(true);
                else setShowComandaModal(true);
              }}
              className="bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              Lançar
              <Package className="w-4 h-4" />
            </button>
            <button
              disabled={cart.length === 0}
              onClick={() => setShowCheckout(true)}
              className="bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3 rounded-2xl transition-all shadow-xl shadow-[#C9A227]/20 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              Pagar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Comanda Modal ── */}
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
                    <Hash className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Abrir Comanda</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase">Identifique o cliente ou o cartão</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                    Número ou Nome
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={comandaNumber}
                    onChange={(e) => setComandaNumber(e.target.value)}
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
                    disabled={!comandaNumber || isProcessing}
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        await apiJson(`/api/tenants/${tenant.slug}/pdv/order`, {
                          method: "POST",
                          body: JSON.stringify({
                            customerName: comandaNumber,
                            customerPhone: "00000000000",
                            orderType: "DINE_IN",
                            paymentMethod: "CASH",
                            items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes || undefined })),
                            status: "PENDING",
                          }),
                        });
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
                    {isProcessing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : "Abrir / Lançar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Checkout Modal ── */}
        <AnimatePresence>
          {showCheckout && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="bg-[#0D1B3E] w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
              >
                {/* Left: Summary */}
                <div className="w-full md:w-80 bg-black/20 p-8 flex flex-col border-r border-white/5 overflow-y-auto">
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-6 group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
                  </button>

                  <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Resumo</p>
                  <h3 className="text-xl font-black text-white mb-6 truncate">
                    {selectedTableId ? `Mesa ${selectedTableId}` : customerName || "Venda Balcão"}
                  </h3>

                  <div className="space-y-2 flex-1">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex justify-between text-xs border-b border-white/5 pb-2">
                        <span className="text-white/70 truncate mr-2">
                          {item.quantity}x {item.product.name}
                          {item.notes && <span className="text-[10px] italic text-white/30 block">{item.notes}</span>}
                        </span>
                        <span className="font-black text-white whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <div className="flex justify-between text-xs text-white/40">
                      <span>Subtotal</span><span>{fmt(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-green-400">
                        <span>Desconto</span><span>-{fmt(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest">Total</span>
                      <span className="text-2xl font-black text-white tabular-nums">{fmt(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Payment */}
                <div className="flex-1 p-8 space-y-6 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Payment methods */}
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Forma de Pagamento</p>
                      <div className="space-y-2">
                        {PAYMENT_METHODS.map((method) => {
                          const Icon = method.icon;
                          return (
                            <button
                              key={method.id}
                              onClick={() => {
                                setPaymentMethod(method.id as any);
                                if (method.id !== "CASH") setAmountReceived("");
                                if (method.id === "CASH") setCardBrand("");
                              }}
                              className={`flex items-center gap-3 p-3 rounded-2xl border w-full transition-all ${
                                paymentMethod === method.id
                                  ? "bg-[#C9A227] border-[#C9A227] shadow-xl shadow-[#C9A227]/20"
                                  : "bg-white/5 border-white/10 hover:bg-white/10"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${paymentMethod === method.id ? "bg-white/20" : "bg-white/5"}`}>
                                <Icon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-[11px] font-black uppercase tracking-widest text-white">{method.label}</p>
                                <p className="text-[9px] text-white/40 font-bold">{method.desc}</p>
                              </div>
                              {paymentMethod === method.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Context panel */}
                    <div className="space-y-3">
                      {paymentMethod === "CASH" && (
                        <>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Troco</p>
                          <div className="bg-white/5 rounded-[1.5rem] p-6 border border-white/10 space-y-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest ml-1">Valor Recebido</label>
                              <input
                                type="number"
                                value={amountReceived}
                                onChange={(e) => setAmountReceived(e.target.value)}
                                placeholder="0,00"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-2xl font-black text-white focus:border-[#C9A227] outline-none text-center"
                              />
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-1">Troco</p>
                              <p className={`text-3xl font-black tabular-nums ${change > 0 ? "text-green-400" : "text-white/20"}`}>
                                {fmt(change)}
                              </p>
                            </div>
                          </div>
                        </>
                      )}

                      {paymentMethod === "CREDIT" && (
                        <>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Parcelamento</p>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[1, 2, 3, 4, 5, 6].map((n) => (
                              <button
                                key={n}
                                onClick={() => setInstallments(n)}
                                className={`py-2 rounded-xl text-[11px] font-black transition-all ${
                                  installments === n ? "bg-[#C9A227] text-black" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                                }`}
                              >
                                {n}x {n === 1 ? "à vista" : fmt(total / n)}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Bandeira</p>
                          <div className="grid grid-cols-2 gap-2">
                            {CARD_BRANDS.map((brand) => (
                              <button
                                key={brand}
                                onClick={() => setCardBrand(brand)}
                                className={`p-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                                  cardBrand === brand
                                    ? "bg-white text-[#0D1B3E] border-white"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                }`}
                              >
                                {brand}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {paymentMethod === "DEBIT" && (
                        <>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Bandeira</p>
                          <div className="grid grid-cols-2 gap-2">
                            {CARD_BRANDS.map((brand) => (
                              <button
                                key={brand}
                                onClick={() => setCardBrand(brand)}
                                className={`p-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                                  cardBrand === brand
                                    ? "bg-white text-[#0D1B3E] border-white"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                }`}
                              >
                                {brand}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {paymentMethod === "VR" && (
                        <>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest mb-2">Bandeira VR</p>
                          <div className="grid grid-cols-2 gap-2">
                            {CARD_BRANDS.map((brand) => (
                              <button
                                key={brand}
                                onClick={() => setCardBrand(brand)}
                                className={`p-2 rounded-xl border text-[10px] font-black uppercase transition-all ${
                                  cardBrand === brand
                                    ? "bg-white text-[#0D1B3E] border-white"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                }`}
                              >
                                {brand}
                              </button>
                            ))}
                          </div>
                        </>
                      )}

                      {paymentMethod === "PIX" && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 bg-white/5 rounded-[1.5rem] border border-white/10 p-8">
                          <div className="w-16 h-16 bg-[#C9A227]/10 rounded-full flex items-center justify-center animate-pulse">
                            <QrCode className="w-8 h-8 text-[#C9A227]" />
                          </div>
                          <div>
                            <p className="text-sm font-black uppercase tracking-widest text-white">PIX</p>
                            <p className="text-[10px] text-white/40 max-w-[160px] mx-auto mt-1">
                              Confirme o recebimento antes de finalizar.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Finalize button */}
                  <button
                    disabled={
                      isProcessing ||
                      (paymentMethod === "CASH" && amountReceived !== "" && Number(amountReceived) < total)
                    }
                    onClick={handleCheckout}
                    className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-5 rounded-2xl transition-all shadow-2xl shadow-[#C9A227]/40 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Finalizar Venda
                        <CheckCircle2 className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
