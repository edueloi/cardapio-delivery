import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Minus, X, ShoppingCart,
  Trash2, CreditCard, Banknote, QrCode,
  CheckCircle2, Receipt, Package,
  ChevronRight, ArrowLeft,
  Utensils, Tag, User, Phone, Percent,
  Printer, StickyNote, Hash, AlertCircle, Smartphone, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, Order, PaymentConfig, PaymentMethodConfig, StoneConfig } from "../../types";
import { apiJson } from "../../lib/api";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const maskCpf = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

// Máscara monetária estilo caixa eletrônico: digita os centavos, o valor "empurra" pra esquerda.
// Trabalha sempre com o valor em centavos (string de dígitos) para não perder precisão.
const maskCurrencyDigits = (digits: string) => digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
const digitsToNumber = (digits: string) => (parseInt(digits || "0", 10) || 0) / 100;
const formatCurrencyDigits = (digits: string) => fmt(digitsToNumber(digits)).replace("R$", "").trim();
const numberToDigits = (n: number) => String(Math.round(n * 100));

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
  /** "waiter" = garçom: só lança pedidos em mesa/comanda, sem acesso a pagamento/caixa. */
  mode?: "full" | "waiter";
}

const BASE_PAYMENT_METHODS = [
  { id: "CASH",   label: "Dinheiro",      icon: Banknote,    desc: "Espécie" },
  { id: "DEBIT",  label: "Débito",        icon: CreditCard,  desc: "À vista" },
  { id: "CREDIT", label: "Crédito",       icon: CreditCard,  desc: "Parcelado" },
  { id: "PIX",    label: "PIX",           icon: QrCode,      desc: "Instantâneo" },
  { id: "VR",     label: "Refeição/VR",   icon: Receipt,     desc: "Ticket/VR" },
  { id: "STONE",  label: "Maquininha",    icon: Smartphone,  desc: "Stone / Pagar.me" },
];

export default function PDVPanel({
  tenant,
  onOrderCreated,
  checkoutRequests = [],
  onClearTable,
  orders = [],
  mode = "full",
}: PDVPanelProps) {
  const isWaiterMode = mode === "waiter";
  const [activeTab, setActiveTab] = useState<"products" | "tables" | "comandas">("products");
  // Em telas menores que lg, o carrinho vira um painel deslizante aberto sob demanda
  // (por um botão flutuante), em vez de ficar sempre empilhado ocupando a tela.
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [comandaNumber, setComandaNumber] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  const [registeredTables, setRegisteredTables] = useState<Array<{ id: string; label: string }>>([]);

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR" | "STONE">("CASH");
  const [cardBrand, setCardBrand] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);

  // Stone terminal flow
  const [stonePaymentType, setStonePaymentType] = useState<"credit" | "debit" | "pix">("credit");
  const [stoneStatus, setStoneStatus] = useState<"idle" | "sending" | "waiting" | "paid" | "failed">("idle");
  const [stoneChargeId, setStoneChargeId] = useState<string | null>(null);
  const stonePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // Discount
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Caixa (abertura/fechamento) — venda só é permitida com caixa aberto
  const [currentCash, setCurrentCash] = useState<{ id: string; openingBalance: number; openedAt: string; expectedBalance: number } | null>(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [closingBalanceInput, setClosingBalanceInput] = useState("");
  const [cashActionLoading, setCashActionLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  const fetchCurrentCash = useCallback(async () => {
    try {
      const data = await apiJson<typeof currentCash>(`/api/tenants/${tenant.slug}/cash/current`);
      setCurrentCash(data);
    } catch {
      setCurrentCash(null);
    } finally {
      setCashLoading(false);
    }
  }, [tenant.slug]);

  useEffect(() => {
    if (!isWaiterMode) void fetchCurrentCash();
    else setCashLoading(false);
  }, [fetchCurrentCash, isWaiterMode]);

  const handleOpenCash = async () => {
    setCashActionLoading(true);
    setCashError("");
    try {
      await apiJson(`/api/tenants/${tenant.slug}/cash/open`, {
        method: "POST",
        body: JSON.stringify({ openingBalance: digitsToNumber(openingBalanceInput) }),
      });
      setShowOpenCashModal(false);
      setOpeningBalanceInput("");
      await fetchCurrentCash();
    } catch (err: any) {
      setCashError(err?.message ?? "Erro ao abrir o caixa.");
    } finally {
      setCashActionLoading(false);
    }
  };

  const handleCloseCash = async () => {
    setCashActionLoading(true);
    setCashError("");
    try {
      await apiJson(`/api/tenants/${tenant.slug}/cash/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance: digitsToNumber(closingBalanceInput) }),
      });
      setShowCloseCashModal(false);
      setClosingBalanceInput("");
      await fetchCurrentCash();
    } catch (err: any) {
      setCashError(err?.message ?? "Erro ao fechar o caixa.");
    } finally {
      setCashActionLoading(false);
    }
  };

  // Item notes editor
  const [editingItemNotes, setEditingItemNotes] = useState<string | null>(null);

  // Success flash
  const [showSuccess, setShowSuccess] = useState(false);
  const [nfceStatus, setNfceStatus] = useState<"idle" | "loading" | "authorized" | "rejected">("idle");
  const [nfceMessage, setNfceMessage] = useState("");

  const lastOrderRef = useRef<any>(null);

  const paymentConfig = useMemo(() => {
    try { return tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) as PaymentConfig : {}; }
    catch { return {}; }
  }, [tenant.paymentMethods]);

  const stoneCfg = useMemo<StoneConfig | null>(() => {
    try { return tenant.stoneConfig ? JSON.parse(tenant.stoneConfig) as StoneConfig : null; }
    catch { return null; }
  }, [tenant.stoneConfig]);

  const fiscalEnabled = useMemo(() => {
    try {
      const cfg = tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig as string) : null;
      return cfg?.enabled === true;
    } catch { return false; }
  }, [tenant.fiscalConfig]);

  const handleEmitNfce = async () => {
    const order = lastOrderRef.current;
    if (!order?.id) return;
    setNfceStatus("loading");
    setNfceMessage("");
    try {
      const res = await apiJson(`/api/owner/tenants/${tenant.id}/nfce/emit`, {
        method: "POST",
        body: JSON.stringify({ orderId: order.id }),
      }) as any;
      if (res.status === "AUTHORIZED") {
        setNfceStatus("authorized");
        setNfceMessage(`NFC-e ${res.numero} autorizada — Chave: ${res.chave?.slice(-8)}`);
      } else {
        setNfceStatus("rejected");
        setNfceMessage(res.motivo ?? "NFC-e rejeitada pela SEFAZ");
      }
    } catch (err: any) {
      setNfceStatus("rejected");
      setNfceMessage(err?.message ?? "Erro ao emitir NFC-e");
    }
  };

  // Mapeia cada forma de pagamento do PDV para a chave correspondente em PaymentConfig
  // (configurada em Configurações → Pagamentos), usada tanto para saber se está habilitada
  // quanto para buscar as bandeiras aceitas.
  const PAYMENT_CONFIG_KEY_MAP: Partial<Record<string, keyof PaymentConfig>> = {
    CASH: "cash", PIX: "pix", CREDIT: "credit", DEBIT: "debit", VR: "meal",
  };

  const PAYMENT_METHODS = useMemo(() => {
    return BASE_PAYMENT_METHODS.filter((m) => {
      if (m.id === "STONE") return !!stoneCfg?.enabled;
      const key = PAYMENT_CONFIG_KEY_MAP[m.id];
      const cfg = key ? (paymentConfig[key] as any) : undefined;
      // Sem configuração salva ainda = habilitado por padrão (não bloqueia quem nunca configurou)
      return cfg?.enabled !== false;
    });
  }, [stoneCfg, paymentConfig]);

  // Se a forma selecionada foi desabilitada nas Configurações, troca para a primeira disponível
  useEffect(() => {
    if (PAYMENT_METHODS.length === 0) return;
    if (!PAYMENT_METHODS.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(PAYMENT_METHODS[0].id as any);
    }
  }, [PAYMENT_METHODS, paymentMethod]);

  const CARD_BRANDS = useMemo(() => {
    const key = PAYMENT_CONFIG_KEY_MAP[paymentMethod];
    const cfg = key ? (paymentConfig[key] as any) : null;
    if (cfg?.acceptedBrands?.length) return cfg.acceptedBrands as string[];
    return ["Visa", "Mastercard", "Elo", "American Express", "Hipercard", "VR", "Sodexo", "Ticket", "Alelo"];
  }, [paymentConfig, paymentMethod]);

  const filteredProducts = useMemo(() => {
    let products: Product[] = [];
    tenant.categories?.forEach((cat) => {
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

  const feeInfo = useMemo(() => {
    if (paymentMethod === "PIX") {
      const cfg = paymentConfig.pix;
      const percent = cfg?.brandFees?.["PIX"]?.installmentFees?.["1"] ?? 0;
      const passToCustomer = !!cfg?.passFeeToCustomer;
      return { percent, amount: total * (percent / 100), passToCustomer };
    }
    const methodKey = paymentMethod === "CREDIT" ? "credit" : paymentMethod === "DEBIT" ? "debit" : null;
    if (!methodKey || !cardBrand) return { percent: 0, amount: 0, passToCustomer: false };
    const cfg = paymentConfig[methodKey] as PaymentMethodConfig | undefined;
    const installmentKey = methodKey === "credit" ? String(installments) : "1";
    const percent = cfg?.brandFees?.[cardBrand]?.installmentFees?.[installmentKey] ?? 0;
    const passToCustomer = !!cfg?.passFeeToCustomer;
    const amount = total * (percent / 100);
    return { percent, amount, passToCustomer };
  }, [paymentMethod, cardBrand, installments, paymentConfig, total]);

  const finalTotal = feeInfo.passToCustomer ? total + feeInfo.amount : total;
  const change = paymentMethod === "CASH" ? Math.max(0, digitsToNumber(amountReceived) - total) : 0;

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
    setCustomerCpf("");
    setDiscountValue("");
    setAmountReceived("");
    setCardBrand("");
    setStoneStatus("idle");
    setStoneChargeId(null);
    setNfceStatus("idle");
    setNfceMessage("");
    setShowCartDrawer(false);
    if (stonePollRef.current) clearInterval(stonePollRef.current);
  };

  // Cleanup stone polling on unmount
  useEffect(() => () => { if (stonePollRef.current) clearInterval(stonePollRef.current); }, []);

  useEffect(() => {
    apiJson(`/api/tenants/${tenant.slug}/tables`)
      .then((data) => setRegisteredTables(Array.isArray(data) ? data as Array<{ id: string; label: string }> : []))
      .catch(() => setRegisteredTables([]));
  }, [tenant.slug]);

  // Atalhos de teclado: F2 pagar, F4 desconto, Esc fecha o modal/checkout aberto.
  // Ignorados quando o foco está em campo de texto (exceto Esc), para não atrapalhar digitação.
  useEffect(() => {
    if (isWaiterMode) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        if (showCheckout) setShowCheckout(false);
        else if (showComandaModal) setShowComandaModal(false);
        else if (showOpenCashModal) setShowOpenCashModal(false);
        else if (showCloseCashModal) setShowCloseCashModal(false);
        return;
      }

      if (isTyping) return;

      if (e.key === "F2") {
        e.preventDefault();
        if (cart.length > 0 && currentCash && !showCheckout) setShowCheckout(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        if (!showCheckout) discountInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isWaiterMode, cart.length, currentCash, showCheckout, showComandaModal, showOpenCashModal, showCloseCashModal]);

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

  // Lança o pedido em uma mesa/comanda já aberta, sem cobrar — usado pelo modo garçom
  // e pelo botão "Lançar" quando a mesa/comanda já está selecionada.
  const handleLaunchOrder = async () => {
    if (cart.length === 0 || (!selectedTableId && !selectedComandaId)) return;
    setIsProcessing(true);
    try {
      await apiJson(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName || (selectedTableId ? `Mesa ${selectedTableId}` : "Comanda"),
          customerPhone: customerPhone || "00000000000",
          orderType: "DINE_IN",
          tableId: selectedTableId || undefined,
          paymentMethod: "CASH",
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, price: item.price, notes: item.notes || undefined })),
          status: "PENDING",
        }),
      });
      clearCart();
      onOrderCreated?.();
      setActiveTab("tables");
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !currentCash) return;
    setIsProcessing(true);

    const isStone = paymentMethod === "STONE";

    const orderData = {
      customerName: customerName || (selectedTableId ? `Mesa ${selectedTableId}` : "Venda PDV"),
      customerPhone: customerPhone || "00000000000",
      customerCpf: customerCpf.replace(/\D/g, "").length === 11 ? customerCpf.replace(/\D/g, "") : undefined,
      orderType: selectedTableId ? "DINE_IN" : "TAKEAWAY",
      tableId: selectedTableId || undefined,
      paymentMethod: isStone ? `STONE_${stonePaymentType.toUpperCase()}` : paymentMethod,
      paymentMetadata: {
        amountReceived: paymentMethod === "CASH" ? digitsToNumber(amountReceived) : finalTotal,
        change,
        cardBrand,
        installments: paymentMethod === "CREDIT" ? installments : 1,
      },
      discount: discountValue ? parseFloat(discountValue) : 0,
      discountType,
      cardBrand: cardBrand || undefined,
      installments: paymentMethod === "CREDIT" ? installments : 1,
      // Stone orders start as PENDING until terminal confirms
      status: isStone ? "PENDING" : undefined,
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
      }) as { id: string; [key: string]: unknown };
      lastOrderRef.current = order;

      if (isStone) {
        setIsProcessing(false);
        await handleStonePay(order.id);
        return;
      }

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

  const handleStonePay = async (pendingOrderId: string) => {
    setStoneStatus("sending");
    try {
      const result = await apiJson(`/api/tenants/${tenant.slug}/stone/charge`, {
        method: "POST",
        body: JSON.stringify({ orderId: pendingOrderId, amount: total, paymentType: stonePaymentType }),
      }) as { chargeId: string; status: string };
      setStoneChargeId(result.chargeId);
      setStoneStatus("waiting");

      // Poll every 5s for up to 3 minutes
      let attempts = 0;
      stonePollRef.current = setInterval(async () => {
        attempts++;
        try {
          const poll = await apiJson(`/api/tenants/${tenant.slug}/stone/charge/${result.chargeId}`) as { status: string; chargeId: string };
          if (poll.status === "paid") {
            clearInterval(stonePollRef.current!);
            stonePollRef.current = null;
            setStoneStatus("paid");
            setTimeout(() => {
              clearCart();
              setShowCheckout(false);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 3000);
              onOrderCreated?.();
            }, 1500);
          } else if (poll.status === "failed" || poll.status === "canceled" || attempts > 36) {
            clearInterval(stonePollRef.current!);
            stonePollRef.current = null;
            setStoneStatus("failed");
          }
        } catch { /* ignore poll errors */ }
      }, 5000);
    } catch (err) {
      console.error(err);
      setStoneStatus("failed");
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
      ${paymentMethod === "CASH" ? `<p>Recebido: ${fmt(digitsToNumber(amountReceived))}<br>Troco: ${fmt(change)}</p>` : ""}
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

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="relative flex flex-col lg:flex-row gap-2 lg:gap-4 h-full min-h-0">
      {/* ── Success flash + NFC-e ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2"
          >
            <div className="bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Venda realizada com sucesso!
              <button onClick={handlePrintReceipt} className="ml-2 underline text-xs font-bold opacity-80">
                Imprimir cupom
              </button>
            </div>
            {/* Botão NFC-e — aparece apenas se fiscal estiver habilitado */}
            {fiscalEnabled && nfceStatus === "idle" && (
              <button
                onClick={handleEmitNfce}
                className="bg-[#C9A227] text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-black hover:bg-[#b8911f] transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Emitir NFC-e
              </button>
            )}
            {fiscalEnabled && nfceStatus === "loading" && (
              <div className="bg-slate-800 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-black">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando para SEFAZ...
              </div>
            )}
            {fiscalEnabled && nfceStatus === "authorized" && (
              <div className="bg-green-600 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-black">
                <CheckCircle2 className="w-4 h-4" />
                {nfceMessage}
              </div>
            )}
            {fiscalEnabled && nfceStatus === "rejected" && (
              <div className="bg-red-500 text-white px-5 py-2.5 rounded-xl shadow-xl flex items-center gap-2 text-xs font-black max-w-xs text-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {nfceMessage}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left: Product Selection ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {/* Cash register status bar */}
        {!isWaiterMode && !cashLoading && (
          <div className={`flex items-center justify-between gap-3 px-5 py-2.5 border-b shrink-0 ${
            currentCash ? "bg-emerald-50/60 border-emerald-100" : "bg-red-50/60 border-red-100"
          }`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${currentCash ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {currentCash ? (
                <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700 truncate">
                  Caixa aberto <span className="font-bold normal-case text-emerald-600/80">· Fundo {fmt(currentCash.openingBalance)} · Esperado {fmt(currentCash.expectedBalance)}</span>
                </p>
              ) : (
                <p className="text-[11px] font-black uppercase tracking-wide text-red-700">Caixa fechado — abra para começar a vender</p>
              )}
            </div>
            <button
              onClick={() => currentCash ? setShowCloseCashModal(true) : setShowOpenCashModal(true)}
              className={`shrink-0 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                currentCash
                  ? "bg-white text-red-600 border border-red-200 hover:bg-red-50"
                  : "bg-[#0D1B3E] text-white hover:bg-[#0D1B3E]/90"
              }`}
            >
              {currentCash ? "Fechar Caixa" : "Abrir Caixa"}
            </button>
          </div>
        )}

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
                  Todos ({tenant.categories?.reduce((s, c) => s + c.products.length, 0) ?? 0})
                </button>
                {tenant.categories?.map((cat) => (
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
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-md"
                              alt={product.name}
                            />
                          ) : (
                            <Utensils className="w-8 h-8 text-slate-300" />
                          )}
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
                        <div className="px-3 py-2.5 flex flex-col gap-1 border-t border-slate-100">
                          <h4 className="text-[13px] font-bold text-slate-800 line-clamp-1 leading-snug">{product.name}</h4>
                          {product.description && (
                            <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[17px] font-black text-[#0D1B3E] leading-none tabular-nums">{fmt(product.price)}</span>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
                              inCart
                                ? "bg-[#C9A227] text-black shadow-md shadow-[#C9A227]/30"
                                : "bg-[#0D1B3E]/5 text-[#0D1B3E] group-hover:bg-[#C9A227] group-hover:text-black"
                            }`}>
                              <Plus className="w-4 h-4" strokeWidth={2.5} />
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
          const availableTables = registeredTables.filter((t) => !activeTableMap.has(t.label));

          return (
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 space-y-6">
              {availableTables.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Mesas Disponíveis</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availableTables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleLoadTable(t.label)}
                        className="bg-white border border-slate-200 hover:border-[#C9A227] rounded-2xl py-3 text-center transition-all"
                      >
                        <span className="text-sm font-black text-slate-700">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTables.length === 0 && availableTables.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                    <Utensils className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                    Nenhuma mesa cadastrada
                  </p>
                </div>
              ) : activeTables.length === 0 ? null : (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Mesas Ocupadas</p>
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

      {/* ── Floating cart button (mobile/tablet, < lg) ── */}
      {!showCartDrawer && (
        <button
          onClick={() => setShowCartDrawer(true)}
          className="lg:hidden fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-[#C9A227] text-black shadow-2xl shadow-black/30 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 bg-[#0D1B3E] text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-[#F4F6FA]">
              {cartItemCount}
            </span>
          )}
        </button>
      )}

      {/* ── Right: Order/Cart Panel ── */}
      <div className={`${
        showCartDrawer
          ? "fixed inset-0 z-40 lg:static lg:z-auto"
          : "hidden lg:flex"
      } w-full lg:w-[380px] xl:w-[420px] flex-col bg-[#0D1B3E] rounded-none lg:rounded-[2rem] text-white overflow-hidden shadow-xl relative shrink-0`}>
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowCartDrawer(false)}
                className="lg:hidden w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center shrink-0 transition-colors -ml-1"
                title="Voltar para os produtos"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="hidden lg:flex w-9 h-9 rounded-xl bg-[#C9A227]/15 text-[#C9A227] items-center justify-center shrink-0">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-widest leading-none">
                  {selectedTableId ? `Mesa ${selectedTableId}` : "Novo Pedido"}
                </h3>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
                  {selectedTableId ? "Fechamento de Conta" : "Venda Rápida Balcão"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <span className="bg-[#C9A227] text-black text-[10px] font-black rounded-full min-w-[22px] h-[22px] px-1.5 flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {(selectedTableId || cart.length > 0) && (
                <button onClick={clearCart} className="text-white/30 hover:text-red-400 transition-colors" title="Limpar pedido">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
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
          {fiscalEnabled && (
            <div className="relative col-span-2">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
              <input
                type="text"
                placeholder="CPF na nota (opcional — Nota Fiscal Paulista)"
                value={customerCpf}
                maxLength={14}
                onChange={(e) => setCustomerCpf(maskCpf(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
              />
            </div>
          )}
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
              <div key={item.product.id} className="bg-white/[0.04] border border-white/5 rounded-xl p-3 space-y-2 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        className="w-full h-full object-cover"
                        alt={item.product.name}
                      />
                    ) : (
                      <Utensils className="w-4 h-4 text-white/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                    <p className="text-[10px] font-bold text-white/40">{fmt(item.price)} un.</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 rounded-lg px-1 py-1 shrink-0">
                    <button onClick={() => updateQuantity(item.product.id, -1)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-[#C9A227] transition-colors">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-black w-5 text-center tabular-nums">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, 1)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-white/10 hover:text-[#C9A227] transition-colors">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-black tabular-nums text-[#C9A227] w-16 text-right shrink-0">
                    {fmt(item.price * item.quantity)}
                  </span>
                  <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-white/20 hover:text-red-400 transition-colors shrink-0">
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
                ref={discountInputRef}
                type="number"
                placeholder={discountType === "PERCENT" ? "Desconto %" : "Desconto R$"}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                title="Atalho: F4"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-8 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-white/20">F4</span>
            </div>
            {discountAmount > 0 && (
              <span className="text-xs font-black text-green-400 whitespace-nowrap">-{fmt(discountAmount)}</span>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase text-white/30">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[10px] font-black uppercase text-green-400">
                <span>Desconto</span>
                <span className="tabular-nums">-{fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2 mt-1 border-t border-white/10">
              <span className="text-xs font-black uppercase tracking-widest text-[#C9A227]">Total</span>
              <span className="text-3xl font-black tracking-tighter tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className={isWaiterMode ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={() => {
                if (selectedTableId || selectedComandaId) void handleLaunchOrder();
                else setShowComandaModal(true);
              }}
              className={`${isWaiterMode ? "bg-[#C9A227] hover:bg-[#E8B93A] text-black shadow-xl shadow-[#C9A227]/20" : "bg-white/5 hover:bg-white/10 text-white"} disabled:opacity-30 font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]`}
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Lançar Pedido
                  <Package className="w-4 h-4" />
                </>
              )}
            </button>
            {!isWaiterMode && (
              <button
                disabled={cart.length === 0 || !currentCash}
                title={!currentCash ? "Abra o caixa para receber pagamentos" : "Atalho: F2"}
                onClick={() => setShowCheckout(true)}
                className="relative bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3 rounded-2xl transition-all shadow-xl shadow-[#C9A227]/20 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                Pagar
                <ChevronRight className="w-4 h-4" />
                <span className="absolute top-1 right-1.5 text-[8px] font-bold opacity-40">F2</span>
              </button>
            )}
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
                className="bg-[#0D1B3E] w-full max-w-3xl rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col md:flex-row max-h-[85vh] relative"
              >
                {/* Botão fechar — sempre visível, no canto do modal */}
                <button
                  onClick={() => setShowCheckout(false)}
                  title="Fechar"
                  className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Left: Summary */}
                <div className="w-full md:w-72 bg-black/20 p-6 flex flex-col border-r border-white/5 overflow-y-auto shrink-0">
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-5 group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cancelar</span>
                  </button>

                  <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Resumo</p>
                  <h3 className="text-lg font-black text-white mb-4 truncate">
                    {selectedTableId ? `Mesa ${selectedTableId}` : customerName || "Venda Balcão"}
                  </h3>

                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
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

                  <div className="mt-4 pt-4 border-t border-white/10 space-y-1.5">
                    <div className="flex justify-between text-xs text-white/40">
                      <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-green-400">
                        <span>Desconto</span><span className="tabular-nums">-{fmt(discountAmount)}</span>
                      </div>
                    )}
                    {feeInfo.amount > 0 && (
                      <div className="flex justify-between text-xs text-amber-400">
                        <span>Taxa maquininha ({feeInfo.percent.toFixed(2).replace(".", ",")}%){feeInfo.passToCustomer ? "" : " — absorvida"}</span>
                        <span className="tabular-nums">{feeInfo.passToCustomer ? "+" : ""}{fmt(feeInfo.amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 mt-1 border-t border-white/10">
                      <span className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest self-end">Total</span>
                      <span className="text-2xl font-black text-white tabular-nums">{fmt(finalTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Payment */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                <div className="overflow-y-auto min-h-0 p-6 pt-14">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Payment methods */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Forma de Pagamento</p>
                      <div className="space-y-1.5">
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
                              className={`flex items-center gap-3 p-2.5 rounded-xl border w-full transition-all ${
                                paymentMethod === method.id
                                  ? "bg-[#C9A227] border-[#C9A227] shadow-lg shadow-[#C9A227]/20"
                                  : "bg-white/5 border-white/10 hover:bg-white/10"
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${paymentMethod === method.id ? "bg-white/20" : "bg-white/5"}`}>
                                <Icon className="w-3.5 h-3.5 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white">{method.label}</p>
                                <p className="text-[9px] text-white/40 font-bold">{method.desc}</p>
                              </div>
                              {paymentMethod === method.id && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Context panel */}
                    <div className="space-y-2.5">
                      {paymentMethod === "CASH" && (
                        <>
                          <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Troco</p>
                          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest ml-1">Valor Recebido</label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-white/30">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  autoFocus
                                  value={formatCurrencyDigits(amountReceived)}
                                  onChange={(e) => setAmountReceived(maskCurrencyDigits(e.target.value))}
                                  placeholder="0,00"
                                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xl font-black text-white focus:border-[#C9A227] outline-none text-center [appearance:textfield]"
                                />
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3).map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => setAmountReceived(numberToDigits(v))}
                                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-1.5 text-[10px] font-black text-white/70 transition-colors"
                                >
                                  {fmt(v)}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/10">
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Troco</p>
                              <p className={`text-xl font-black tabular-nums ${change > 0 ? "text-green-400" : "text-white/20"}`}>
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

                      {paymentMethod === "STONE" && (
                        <div className="space-y-4">
                          {stoneStatus === "idle" && (
                            <>
                              <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Tipo de pagamento</p>
                              <div className="grid grid-cols-3 gap-2">
                                {(["credit", "debit", "pix"] as const).map((t) => (
                                  <button
                                    key={t}
                                    onClick={() => setStonePaymentType(t)}
                                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                      stonePaymentType === t
                                        ? "bg-[#C9A227] text-black"
                                        : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                                    }`}
                                  >
                                    {t === "credit" ? "Crédito" : t === "debit" ? "Débito" : "PIX"}
                                  </button>
                                ))}
                              </div>
                              <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex items-start gap-3">
                                <Smartphone className="w-5 h-5 text-[#C9A227] shrink-0 mt-0.5" />
                                <p className="text-[10px] text-white/50 leading-relaxed">
                                  O valor será enviado para a maquininha Stone. O cliente paga na maquinha e o sistema confirma automaticamente.
                                </p>
                              </div>
                            </>
                          )}

                          {stoneStatus === "sending" && (
                            <div className="flex flex-col items-center justify-center gap-4 py-8">
                              <div className="w-12 h-12 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
                              <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Enviando para maquininha...</p>
                            </div>
                          )}

                          {stoneStatus === "waiting" && (
                            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                              <div className="w-16 h-16 bg-[#C9A227]/10 rounded-full flex items-center justify-center">
                                <Smartphone className="w-8 h-8 text-[#C9A227] animate-pulse" />
                              </div>
                              <div>
                                <p className="text-sm font-black uppercase tracking-widest text-white">Aguardando pagamento</p>
                                <p className="text-[10px] text-white/40 mt-1">O cliente deve pagar na maquininha agora.</p>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-white/30">
                                <div className="w-1.5 h-1.5 bg-[#C9A227] rounded-full animate-pulse" />
                                Verificando a cada 5 segundos...
                              </div>
                              <button
                                onClick={() => { setStoneStatus("idle"); if (stonePollRef.current) clearInterval(stonePollRef.current); }}
                                className="text-[10px] font-black text-red-400/60 hover:text-red-400 uppercase tracking-widest transition-colors mt-2"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}

                          {stoneStatus === "paid" && (
                            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-8 h-8 text-green-400" />
                              </div>
                              <p className="text-sm font-black uppercase tracking-widest text-green-400">Pagamento confirmado!</p>
                            </div>
                          )}

                          {stoneStatus === "failed" && (
                            <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                              </div>
                              <p className="text-sm font-black uppercase tracking-widest text-red-400">Pagamento falhou</p>
                              <button
                                onClick={() => setStoneStatus("idle")}
                                className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest border border-white/10 px-4 py-2 rounded-xl transition-colors"
                              >
                                Tentar novamente
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Finalize button — sempre visível, fora da área rolável */}
                  {paymentMethod !== "STONE" || stoneStatus === "idle" ? (
                    <div className="px-6 py-4 border-t border-white/5 shrink-0 bg-black/20">
                      <button
                        disabled={
                          isProcessing ||
                          (paymentMethod === "CASH" && amountReceived !== "" && digitsToNumber(amountReceived) < total)
                        }
                        onClick={handleCheckout}
                        className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3.5 rounded-xl transition-all shadow-lg shadow-[#C9A227]/25 flex items-center justify-center gap-2.5 uppercase tracking-widest text-xs"
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            {paymentMethod === "STONE" ? "Enviar para Maquininha" : "Finalizar Venda"}
                            {paymentMethod === "STONE" ? <Smartphone className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Abrir Caixa Modal ── */}
        <AnimatePresence>
          {showOpenCashModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-[#0D1B3E] w-full max-w-sm rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl border border-white/5 max-h-[90vh] overflow-y-auto"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <Banknote className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-widest">Abrir Caixa</h3>
                  <p className="text-xs text-white/40">Informe o valor em dinheiro disponível para o fundo de troco.</p>
                </div>
                {cashError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold rounded-xl px-4 py-2.5 text-center">
                    {cashError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Fundo de Caixa</label>
                  <div className="relative">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-lg sm:text-2xl font-black text-white/30">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={formatCurrencyDigits(openingBalanceInput)}
                      onChange={(e) => setOpeningBalanceInput(maskCurrencyDigits(e.target.value))}
                      placeholder="0,00"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-14 pr-4 sm:pr-5 text-xl sm:text-2xl font-black text-white text-center focus:border-emerald-400 outline-none [appearance:textfield]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setShowOpenCashModal(false); setCashError(""); }}
                    className="bg-white/5 hover:bg-white/10 text-white/60 font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={cashActionLoading}
                    onClick={handleOpenCash}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                  >
                    {cashActionLoading ? "Abrindo..." : "Abrir Caixa"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Fechar Caixa Modal ── */}
        <AnimatePresence>
          {showCloseCashModal && currentCash && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-[#0D1B3E] w-full max-w-sm rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-2xl border border-white/5 max-h-[90vh] overflow-y-auto"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-widest">Fechar Caixa</h3>
                  <p className="text-xs text-white/40">Confira o dinheiro em caixa antes de confirmar o fechamento.</p>
                </div>
                {cashError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold rounded-xl px-4 py-2.5 text-center">
                    {cashError}
                  </div>
                )}
                <div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/10">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Fundo de abertura</span>
                    <span className="font-bold text-white tabular-nums">{fmt(currentCash.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Esperado em caixa</span>
                    <span className="font-black text-emerald-400 tabular-nums">{fmt(currentCash.expectedBalance)}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Valor Contado</label>
                    <button
                      type="button"
                      onClick={() => setClosingBalanceInput(numberToDigits(currentCash.expectedBalance))}
                      className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Usar esperado
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-lg sm:text-2xl font-black text-white/30">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoFocus
                      value={formatCurrencyDigits(closingBalanceInput)}
                      onChange={(e) => setClosingBalanceInput(maskCurrencyDigits(e.target.value))}
                      placeholder="0,00"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 sm:py-4 pl-11 sm:pl-14 pr-4 sm:pr-5 text-xl sm:text-2xl font-black text-white text-center focus:border-red-400 outline-none [appearance:textfield]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setShowCloseCashModal(false); setCashError(""); }}
                    className="bg-white/5 hover:bg-white/10 text-white/60 font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={cashActionLoading}
                    onClick={handleCloseCash}
                    className="bg-red-500 hover:bg-red-400 disabled:opacity-50 text-white font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                  >
                    {cashActionLoading ? "Fechando..." : "Confirmar Fechamento"}
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
