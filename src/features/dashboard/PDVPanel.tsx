import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Minus, X, ShoppingCart,
  Trash2, CreditCard, Banknote, QrCode,
  CheckCircle2, Receipt, Package,
  ChevronRight, ChevronDown, ArrowLeft,
  Utensils, Tag, User, Phone, Percent,
  Printer, Hash, AlertCircle, Smartphone, Lock, ExternalLink, Download, Zap,
  MoreHorizontal, DoorOpen, DoorClosed, Maximize2, Minimize2, Split, Truck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, Order, PaymentConfig, PaymentMethodConfig, StoneConfig, Customer } from "../../types";
import { dineInOrderLabel } from "../../types";
import { apiJson } from "../../lib/api";
import { useToast } from "../../components";
import { downloadReceiptPdf, printReceiptPdf } from "../../lib/receipt";
import socket from "../../lib/socket";

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
  onClearComanda?: (orderId: string) => void;
  orders?: Order[];
  /** "waiter" = garçom: só lança pedidos em mesa/comanda, sem acesso a pagamento/caixa. */
  mode?: "full" | "waiter";
  /** Nome de quem está operando — gravado em cada pedido lançado (usado no placar do garçom). */
  operatorName?: string | null;
  /** Chamados de garçom/pedir conta em aberto, para exibir alerta na grade de mesas. */
  waiterCalls?: Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>;
  /** Quando embutido no dashboard, abre a versão em tela cheia (nova aba) — omitido na própria tela cheia. */
  onOpenFullscreen?: () => void;
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
  onClearComanda,
  orders = [],
  mode = "full",
  operatorName,
  waiterCalls = [],
  onOpenFullscreen,
}: PDVPanelProps) {
  const toast = useToast();
  const isWaiterMode = mode === "waiter";
  // Tela cheia do PDV externo (/pdv/:slug) — só existe onOpenFullscreen quando embutido no dashboard
  const isExternalFullscreen = !onOpenFullscreen && !isWaiterMode;

  // Tela cheia de verdade (Fullscreen API do navegador, tipo F11) — diferente de
  // onOpenFullscreen, que abre o PDV externo numa aba/janela separada.
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleBrowserFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const [activeTab, setActiveTab] = useState<"products" | "tables" | "comandas" | "delivery">(isWaiterMode ? "tables" : "products");
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
  // true quando veio do fluxo "Fechar Conta" — só pagar, sem opção de lançar mais itens
  const [isClosingAccount, setIsClosingAccount] = useState(false);
  const [registeredTables, setRegisteredTables] = useState<Array<{ id: string; label: string }>>([]);

  // Modal de detalhes da mesa/comanda — mostrado antes de ir pro carrinho, ao clicar "Abrir"
  const [orderDetailsView, setOrderDetailsView] = useState<{ type: "table"; tableId: string } | { type: "comanda"; comanda: Order } | null>(null);

  // Faturamento de pedidos de Delivery — chegam prontos/entregues pelo Painel de Pedidos
  // (fora do PDV) mas o pagamento (dinheiro/cartão na entrega) ainda não foi lançado no caixa.
  const [billingOrder, setBillingOrder] = useState<Order | null>(null);
  const [billingPaymentMethod, setBillingPaymentMethod] = useState<"CASH" | "CREDIT" | "DEBIT" | "PIX" | "VR">("CASH");
  const [isBilling, setIsBilling] = useState(false);

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  // Cliente vinculado por busca (fidelidade) — null quando os campos acima são digitados
  // à mão sem bater com nenhum cadastro. O vínculo em si com a venda acontece pelo telefone
  // no backend (awardLoyaltyPoints usa upsert por tenantId_phone), isso aqui é só UX:
  // mostra o histórico/pontos do cliente já cadastrado e evita redigitar os dados.
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR" | "STONE">("CASH");
  const [cardBrand, setCardBrand] = useState<string>("");
  const [amountReceived, setAmountReceived] = useState<string>("");
  const [installments, setInstallments] = useState<number>(1);

  // Split de pagamento — mais de uma forma na mesma venda (ex: parte dinheiro, parte cartão).
  // Cada entrada consome um pedaço do total; o restante é o que ainda falta pagar.
  const [paymentSplits, setPaymentSplits] = useState<Array<{ id: string; method: "CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR"; amount: number; cardBrand?: string }>>([]);
  const [isSplitMode, setIsSplitMode] = useState(false);

  // Stone terminal flow
  const [stonePaymentType, setStonePaymentType] = useState<"credit" | "debit" | "pix">("credit");
  const [stoneStatus, setStoneStatus] = useState<"idle" | "sending" | "waiting" | "paid" | "failed">("idle");
  const [stoneChargeId, setStoneChargeId] = useState<string | null>(null);
  const stonePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);

  // Discount
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Taxa de serviço — vem pré-marcada se ativada nas configurações, mas sempre pode ser desmarcada no pagamento
  const [serviceChargeChecked, setServiceChargeChecked] = useState(true);

  // Caixa (abertura/fechamento) — por padrão venda só é permitida com caixa aberto, mas a
  // loja pode desligar essa exigência em Configurações (venda liberada direto, sem fundo/sangria).
  const cashRequired = tenant.requireCashRegister !== false;
  const [currentCash, setCurrentCash] = useState<{ id: string; openingBalance: number; openedAt: string; expectedBalance: number } | null>(null);
  const [cashLoading, setCashLoading] = useState(true);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [closingBalanceInput, setClosingBalanceInput] = useState("");
  const [cashActionLoading, setCashActionLoading] = useState(false);
  const [cashError, setCashError] = useState("");

  // Busca cliente cadastrado por nome, telefone ou CPF (com debounce) — usada no "Adicionar
  // cliente" do PDV pra vincular a venda a um cadastro já existente (fidelidade) sem o
  // operador precisar redigitar nome/telefone que o cliente já informou antes.
  useEffect(() => {
    if (!customerSearchOpen || customerSearchTerm.trim().length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setCustomerSearchLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiJson<{ customers: Customer[] }>(
          `/api/tenants/${tenant.slug}/customers?search=${encodeURIComponent(customerSearchTerm.trim())}&limit=8`
        );
        setCustomerSearchResults(data.customers || []);
      } catch {
        setCustomerSearchResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [customerSearchOpen, customerSearchTerm, tenant.slug]);

  const handleSelectCustomer = (customer: Customer) => {
    setLinkedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    if (customer.cpf) setCustomerCpf(maskCpf(customer.cpf));
    setCustomerSearchOpen(false);
    setCustomerSearchTerm("");
  };

  const handleClearLinkedCustomer = () => {
    setLinkedCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCpf("");
  };

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

  // Outro operador pode abrir/fechar o caixa em outra aba/dispositivo enquanto esta tela já
  // está aberta — sem isso, ficava presa mostrando "Caixa Fechado" (ou vice-versa) até um F5.
  useEffect(() => {
    if (isWaiterMode) return;
    const handler = () => void fetchCurrentCash();
    socket.on("cash-status-changed", handler);
    return () => { socket.off("cash-status-changed", handler); };
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

  // Barra de atalhos: F6 desfaz o último item, F7 consulta preço sem adicionar ao carrinho, F8 abre mais opções
  const [showPriceCheckModal, setShowPriceCheckModal] = useState(false);
  const [priceCheckTerm, setPriceCheckTerm] = useState("");
  const [showMoreOptionsMenu, setShowMoreOptionsMenu] = useState(false);

  // Success flash
  const [showSuccess, setShowSuccess] = useState(false);
  const [nfceStatus, setNfceStatus] = useState<"idle" | "loading" | "authorized" | "rejected">("idle");
  const [nfceMessage, setNfceMessage] = useState("");

  const lastOrderRef = useRef<any>(null);

  const paymentConfig = useMemo(() => {
    try { return tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) as PaymentConfig : {}; }
    catch { return {}; }
  }, [tenant.paymentMethods]);

  // Sincroniza o checkbox de taxa de serviço com o valor padrão configurado pelo dono
  useEffect(() => {
    setServiceChargeChecked(!!paymentConfig.serviceCharge?.enabled);
  }, [paymentConfig.serviceCharge?.enabled]);

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
    return (cfg?.acceptedBrands?.length ? cfg.acceptedBrands : []) as string[];
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

  // Consulta de preço (F7) — busca em todos os produtos, independente da categoria selecionada no PDV
  const priceCheckResults = useMemo(() => {
    if (!priceCheckTerm.trim()) return [];
    const allProducts = tenant.categories?.flatMap((cat) => cat.products) ?? [];
    const term = priceCheckTerm.toLowerCase();
    return allProducts
      .filter((p) => p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 20);
  }, [tenant, priceCheckTerm]);

  const activeComandas = useMemo(
    () => orders.filter((o) => o.orderType === "DINE_IN" && !["DELIVERED", "CANCELLED", "MERGED"].includes(o.status) && !o.tableId),
    [orders]
  );

  // Delivery entregue mas ainda sem venda lançada no caixa (pagamento na entrega,
  // fora do fluxo do PDV) — precisa ser faturado manualmente aqui.
  const pendingDeliveryOrders = useMemo(
    () => orders.filter((o) => o.orderType === "DELIVERY" && o.status === "DELIVERED" && !o.billed),
    [orders]
  );

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue || "0");
    if (!v) return 0;
    return discountType === "PERCENT" ? subtotal * (v / 100) : Math.min(v, subtotal);
  }, [subtotal, discountValue, discountType]);

  const total = Math.max(0, subtotal - discountAmount);

  // Taxa de serviço — configurável em Configurações, sempre opcional no momento do pagamento
  const serviceChargeConfig = paymentConfig.serviceCharge;
  const serviceChargeAmount = (serviceChargeConfig?.enabled && serviceChargeChecked)
    ? subtotal * ((serviceChargeConfig.percent || 0) / 100)
    : 0;

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

  const finalTotal = (feeInfo.passToCustomer ? total + feeInfo.amount : total) + serviceChargeAmount;
  const change = paymentMethod === "CASH" ? Math.max(0, digitsToNumber(amountReceived) - finalTotal) : 0;

  const splitAllocated = paymentSplits.reduce((acc, s) => acc + s.amount, 0);
  const splitRemaining = Math.max(0, Math.round((finalTotal - splitAllocated) * 100) / 100);

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

  // F6 — desfaz o último item lançado no carrinho (a linha inteira, não uma unidade)
  const handleUndoLastItem = () => {
    setCart((prev) => prev.slice(0, -1));
  };

  const updateQuantity = (productId: string, delta: number) =>
    setCart((prev) =>
      prev.map((i) =>
        i.product.id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    );

  const clearCart = () => {
    setCart([]);
    setSelectedTableId(null);
    setSelectedComandaId(null);
    setIsClosingAccount(false);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerCpf("");
    setLinkedCustomer(null);
    setDiscountValue("");
    setAmountReceived("");
    setCardBrand("");
    setServiceChargeChecked(!!paymentConfig.serviceCharge?.enabled);
    setStoneStatus("idle");
    setStoneChargeId(null);
    setNfceStatus("idle");
    setNfceMessage("");
    setShowCartDrawer(false);
    setPaymentSplits([]);
    setIsSplitMode(false);
    if (stonePollRef.current) clearInterval(stonePollRef.current);
  };

  // Adiciona a forma de pagamento atualmente selecionada como uma parcela do split,
  // usando o valor restante como sugestão (some 100% do que falta por padrão).
  const handleAddPaymentSplit = () => {
    if (paymentMethod === "STONE" || splitRemaining <= 0) return;
    setPaymentSplits((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, method: paymentMethod, amount: splitRemaining, cardBrand: cardBrand || undefined },
    ]);
    setCardBrand("");
  };

  const handleRemovePaymentSplit = (id: string) => {
    setPaymentSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSplitAmount = (id: string, amount: number) => {
    setPaymentSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: Math.max(0, amount) } : s)));
  };

  // Cleanup stone polling on unmount
  useEffect(() => () => { if (stonePollRef.current) clearInterval(stonePollRef.current); }, []);

  // Guarda a versão mais recente de handleCheckout (declarado abaixo) para o atalho F2 do checkout.
  const handleCheckoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    apiJson(`/api/tenants/${tenant.slug}/tables`)
      .then((data) => setRegisteredTables(Array.isArray(data) ? data as Array<{ id: string; label: string }> : []))
      .catch(() => setRegisteredTables([]));
  }, [tenant.slug]);

  // Atalhos de teclado: F2 pagar, F4 desconto, F6 desfaz último item, F7 consulta preço,
  // F8 mais opções, Esc fecha o modal/checkout aberto.
  // Ignorados quando o foco está em campo de texto (exceto Esc), para não atrapalhar digitação.
  useEffect(() => {
    if (isWaiterMode) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        if (showCheckout) setShowCheckout(false);
        else if (showComandaModal) setShowComandaModal(false);
        else if (orderDetailsView) setOrderDetailsView(null);
        else if (showOpenCashModal) setShowOpenCashModal(false);
        else if (showCloseCashModal) setShowCloseCashModal(false);
        else if (showPriceCheckModal) setShowPriceCheckModal(false);
        else if (showMoreOptionsMenu) setShowMoreOptionsMenu(false);
        return;
      }

      if (isTyping) return;

      if (e.key === "F2") {
        e.preventDefault();
        if (showCheckout) {
          handleCheckoutRef.current?.();
        } else if (cart.length > 0 && (!cashRequired || currentCash)) {
          setShowCheckout(true);
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        if (!showCheckout) discountInputRef.current?.focus();
      } else if (e.key === "F6") {
        e.preventDefault();
        if (!showCheckout && cart.length > 0) handleUndoLastItem();
      } else if (e.key === "F7") {
        e.preventDefault();
        if (!showCheckout) setShowPriceCheckModal(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (!showCheckout) setShowMoreOptionsMenu((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isWaiterMode, cart.length, currentCash, showCheckout, showComandaModal, orderDetailsView, showOpenCashModal, showCloseCashModal, showPriceCheckModal, showMoreOptionsMenu]);

  const handleLoadTable = (tableId: string) => {
    const tableOrders = orders.filter(
      (o) => o.tableId === tableId && o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "MERGED"
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
    setOrderDetailsView(null);
    setActiveTab("products");
    setIsClosingAccount(false);
  };

  const handleLoadComanda = (comanda: Order) => {
    setCart(
      comanda.items
        .filter((i) => i.product)
        .map((i) => ({ product: i.product!, quantity: i.quantity, notes: i.notes || "", price: i.price }))
    );
    setSelectedComandaId(comanda.id);
    setComandaNumber(comanda.customerName || "");
    setOrderDetailsView(null);
    setActiveTab("products");
    setIsClosingAccount(false);
  };

  // Vai direto pro pagamento de uma mesa/comanda já aberta, sem passar por "Adicionar mais itens"
  const handleGoToCheckoutFromDetails = (view: NonNullable<typeof orderDetailsView>) => {
    if (view.type === "table") handleLoadTable(view.tableId);
    else handleLoadComanda(view.comanda);
    setIsClosingAccount(true);
    setShowCheckout(true);
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
          operatorName: operatorName || undefined,
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, price: item.price, notes: item.notes || undefined })),
          ...(isWaiterMode ? { source: "waiter" } : {}),
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
    if (cart.length === 0 || (cashRequired && !currentCash)) return;
    if (isSplitMode && (paymentSplits.length === 0 || splitRemaining > 0)) return;
    setIsProcessing(true);

    const isStone = paymentMethod === "STONE";
    const useSplit = isSplitMode && paymentSplits.length > 0;

    const orderData = {
      customerName: customerName || (selectedTableId ? `Mesa ${selectedTableId}` : "Venda PDV"),
      customerPhone: customerPhone || "00000000000",
      customerCpf: customerCpf.replace(/\D/g, "").length === 11 ? customerCpf.replace(/\D/g, "") : undefined,
      orderType: selectedTableId ? "DINE_IN" : "TAKEAWAY",
      tableId: selectedTableId || undefined,
      paymentMethod: useSplit ? "SPLIT" : isStone ? `STONE_${stonePaymentType.toUpperCase()}` : paymentMethod,
      paymentMetadata: useSplit
        ? { splits: paymentSplits.map(({ id, ...s }) => s) }
        : {
            amountReceived: paymentMethod === "CASH" ? digitsToNumber(amountReceived) : finalTotal,
            change,
            cardBrand,
            installments: paymentMethod === "CREDIT" ? installments : 1,
          },
      discount: discountValue ? parseFloat(discountValue) : 0,
      discountType,
      cardBrand: cardBrand || undefined,
      installments: paymentMethod === "CREDIT" ? installments : 1,
      serviceChargeIncluded: serviceChargeChecked && !!serviceChargeConfig?.enabled,
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
      if (selectedComandaId && onClearComanda) await onClearComanda(selectedComandaId);

      clearCart();
      setShowCheckout(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      onOrderCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar venda.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    handleCheckoutRef.current = () => {
      if (isProcessing) return;
      if (isSplitMode && (paymentSplits.length === 0 || splitRemaining > 0)) return;
      if (paymentMethod === "CASH" && amountReceived !== "" && digitsToNumber(amountReceived) < total) return;
      void handleCheckout();
    };
  }, [handleCheckout, isProcessing, isSplitMode, paymentSplits, splitRemaining, paymentMethod, amountReceived, total]);

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

  const buildReceiptData = () => {
    const order = lastOrderRef.current;
    if (!order) return null;
    const items = (order.items || []).map((i: any) => ({
      quantity: i.quantity,
      name: i.product?.name || "",
      price: i.price,
      notes: i.notes || undefined,
    }));
    const orderSubtotal = items.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
    let paymentDetail: { amountReceived?: number; change?: number; splits?: Array<{ method: string; amount: number; cardBrand?: string }> } = {};
    try { paymentDetail = order.paymentDetail ? JSON.parse(order.paymentDetail) : {}; } catch {}
    return {
      tenantName: tenant.name,
      tenantAddress: tenant.address || undefined,
      orderId: order.id,
      counterTicketNumber: (order as any).counterTicketNumber ?? null,
      paperWidthMm: (tenant.receiptPaperWidth === 58 ? 58 : 80) as 58 | 80,
      createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
      customerName: order.customerName,
      items,
      subtotal: orderSubtotal,
      discountAmount: order.discount || 0,
      feeAmount: order.feeAmount || undefined,
      feePercent: order.feePercent || undefined,
      feePassedToCustomer: order.feePassedToCustomer,
      serviceFeeAmount: order.serviceFeeAmount || undefined,
      serviceFeePercent: order.serviceFeePercent || undefined,
      total: order.total,
      paymentMethod: order.paymentMethod,
      amountReceived: order.paymentMethod === "CASH" ? paymentDetail.amountReceived : undefined,
      change: order.paymentMethod === "CASH" ? paymentDetail.change : undefined,
      paymentSplits: order.paymentMethod === "SPLIT" ? paymentDetail.splits : undefined,
    };
  };

  const handleDownloadReceipt = () => {
    const data = buildReceiptData();
    if (!data) return;
    downloadReceiptPdf(data);
  };

  const handlePrintReceipt = () => {
    const data = buildReceiptData();
    if (!data) return;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printReceipt) {
      desktop.printReceipt(data);
    } else {
      printReceiptPdf(data);
    }
  };

  // Imprime o pedido ANTES de finalizar a venda, pro cliente conferir os itens
  // e valores (sem dados de pagamento, que ainda não existem nesse momento).
  const handlePrintPreCheckout = () => {
    if (cart.length === 0) return;
    const data = {
      tenantName: tenant.name,
      tenantAddress: tenant.address || undefined,
      isPreCheckout: true,
      customerName: customerName || (selectedTableId ? `Mesa ${selectedTableId}` : undefined),
      items: cart.map((item) => ({
        quantity: item.quantity,
        name: item.product.name,
        price: item.price,
        notes: item.notes || undefined,
      })),
      subtotal,
      discountAmount: discountAmount || undefined,
      feeAmount: feeInfo.passToCustomer ? feeInfo.amount : undefined,
      feePercent: feeInfo.passToCustomer ? feeInfo.percent : undefined,
      feePassedToCustomer: feeInfo.passToCustomer,
      serviceFeeAmount: serviceChargeAmount || undefined,
      serviceFeePercent: serviceChargeChecked ? serviceChargeConfig?.percent : undefined,
      total: finalTotal,
    };
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printReceipt) {
      desktop.printReceipt(data);
    } else {
      printReceiptPdf(data);
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
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 px-4 w-full max-w-sm"
          >
            <div className="bg-green-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center justify-center gap-2.5 font-black text-xs sm:text-sm w-full">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Venda realizada!
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDownloadReceipt}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PDF
                </button>
                <button
                  onClick={handlePrintReceipt}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>
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
        {/* Atalhos de tela — abrir em nova janela (só no dashboard) e fullscreen do navegador (sempre) */}
        {!isWaiterMode && (
          <div className="flex justify-end items-center gap-1 px-3 pt-2.5">
            {onOpenFullscreen && (
              <button
                onClick={onOpenFullscreen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Nova Janela
              </button>
            )}
            <button
              onClick={toggleBrowserFullscreen}
              title="Tela cheia (F11)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-50 transition-colors"
            >
              {isBrowserFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {isBrowserFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            </button>
          </div>
        )}
        {/* Cash register status bar */}
        {!isWaiterMode && !cashLoading && cashRequired && (
          <div className={`flex items-center justify-between gap-3 px-3 py-1.5 border-b shrink-0 ${
            currentCash ? "bg-emerald-50/60 border-emerald-100" : "bg-red-50/60 border-red-100"
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentCash ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
              {currentCash ? (
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 truncate">
                  Caixa aberto <span className="font-bold normal-case text-emerald-600/80">· Fundo {fmt(currentCash.openingBalance)} · Esperado {fmt(currentCash.expectedBalance)}</span>
                </p>
              ) : (
                <p className="text-[10px] font-black uppercase tracking-wide text-red-700">Caixa fechado — abra para começar a vender</p>
              )}
            </div>
            <button
              onClick={() => currentCash ? setShowCloseCashModal(true) : setShowOpenCashModal(true)}
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors ${
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
        <div className="flex bg-white border-b border-slate-100 px-2 gap-1 pt-1">
          {(isWaiterMode ? (["products", "tables", "comandas"] as const) : (["products", "tables", "comandas", "delivery"] as const)).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-1.5 pt-1 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 relative rounded-t-lg ${
                activeTab === tab
                  ? "border-[#C9A227] text-[#0D1B3E]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              }`}
            >
              {tab === "products" ? "Produtos" : tab === "tables" ? "Mesas" : tab === "comandas" ? "Comandas" : "Delivery"}
              {tab === "tables" && checkoutRequests.length > 0 && (
                <span className="absolute -top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-[9px] flex items-center justify-center rounded-full">
                  {checkoutRequests.length}
                </span>
              )}
              {tab === "comandas" && activeComandas.length > 0 && (
                <span className="absolute -top-1 right-1/4 w-4 h-4 bg-[#C9A227] text-black text-[9px] font-black flex items-center justify-center rounded-full">
                  {activeComandas.length}
                </span>
              )}
              {tab === "delivery" && pendingDeliveryOrders.length > 0 && (
                <span className="absolute -top-1 right-1/4 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full">
                  {pendingDeliveryOrders.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <>
            {/* Search + categories */}
            <div className="p-2 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-8 pr-4 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#C9A227] focus:bg-white outline-none transition-all"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {!isExternalFullscreen && (
                <div className="relative sm:w-56 shrink-0">
                  <select
                    value={selectedCategoryId ?? "all"}
                    onChange={(e) => setSelectedCategoryId(e.target.value === "all" ? null : e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-4 pr-9 text-sm font-bold text-slate-700 focus:border-[#C9A227] focus:bg-white outline-none transition-all cursor-pointer"
                  >
                    <option value="all">Todos ({tenant.categories?.reduce((s, c) => s + c.products.length, 0) ?? 0})</option>
                    {tenant.categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.products.length})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Coluna de categorias — só no PDV externo em tela cheia, como no mockup de referência */}
              {isExternalFullscreen && (
                <div className="w-32 shrink-0 border-r border-slate-100 bg-slate-50/60 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors ${
                      selectedCategoryId === null ? "bg-[#0D1B3E] text-white" : "text-slate-500 hover:bg-white"
                    }`}
                  >
                    Todas ({tenant.categories?.reduce((s, c) => s + c.products.length, 0) ?? 0})
                  </button>
                  {tenant.categories?.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors truncate ${
                        selectedCategoryId === cat.id ? "bg-[#0D1B3E] text-white" : "text-slate-500 hover:bg-white"
                      }`}
                    >
                      {cat.name} ({cat.products.length})
                    </button>
                  ))}
                </div>
              )}

            {/* Product grid */}
            <div
              className="flex-1 overflow-y-auto p-3 custom-scrollbar"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px) + 72px)" }}
            >
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 opacity-30">
                  <Package className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="text-sm font-black uppercase tracking-widest text-slate-500">Nenhum produto encontrado</p>
                </div>
              ) : (
                <div
                  className="flex flex-col gap-1.5 lg:grid lg:gap-2.5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" } as React.CSSProperties}
                >
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className={`group text-left rounded-xl lg:rounded-2xl overflow-hidden transition-all duration-200 relative flex items-center gap-3 p-2 lg:flex-col lg:p-0 lg:items-stretch lg:gap-0 ${
                          inCart
                            ? "ring-2 ring-[#C9A227] shadow-md shadow-[#C9A227]/15 bg-white"
                            : "ring-1 ring-slate-200 bg-white hover:ring-[#C9A227]/50 hover:shadow-md"
                        }`}
                      >
                        {/* Image — hidden on celular/tablet (só nome/descrição/preço); volta a aparecer em telas grandes (lg+) */}
                        <div className="hidden lg:flex w-full aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden relative items-center justify-center">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              alt={product.name}
                            />
                          ) : (
                            <Utensils className="w-6 h-6 text-slate-300" />
                          )}
                          {/* Cart qty badge */}
                          {inCart && (
                            <div className="absolute top-1 left-1 min-w-[16px] h-[16px] px-1 bg-[#C9A227] text-black text-[9px] font-black rounded-full flex items-center justify-center shadow">
                              {inCart.quantity}
                            </div>
                          )}
                          {/* Stock badge */}
                          {product.inventoryItem && (
                            <div className="absolute bottom-1 left-1 bg-black/50 backdrop-blur-sm text-white text-[7px] font-bold rounded px-1 py-0.5 uppercase tracking-wide">
                              {product.inventoryItem.quantity} un
                            </div>
                          )}
                          {/* Botão + flutuante sobre a foto */}
                          <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200 shadow-lg ${
                            inCart
                              ? "bg-[#C9A227] text-black"
                              : "bg-[#0D1B3E] text-white group-hover:bg-[#C9A227] group-hover:text-black"
                          }`}>
                            <Plus className="w-3 h-3" strokeWidth={2.5} />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5 lg:px-1.5 lg:py-1">
                          <h4 className="text-[13px] lg:text-[10.5px] font-bold text-slate-800 line-clamp-1 leading-snug">{product.name}</h4>
                          {product.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 leading-tight lg:hidden">{product.description}</p>
                          )}
                          <div className="flex items-center justify-between mt-0.5 lg:mt-0">
                            <span className="text-[14px] lg:text-[11px] font-black text-[#0D1B3E] leading-none tabular-nums">{fmt(product.price)}</span>
                            <div className={`lg:hidden w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 shrink-0 ${
                              inCart
                                ? "bg-[#C9A227] text-black"
                                : "bg-[#0D1B3E]/5 text-[#0D1B3E] group-hover:bg-[#C9A227] group-hover:text-black"
                            }`}>
                              <Plus className="w-4 h-4" strokeWidth={2.5} />
                            </div>
                          </div>
                        </div>
                        {/* Badge de quantidade no carrinho — visível na linha compacta mobile/tablet */}
                        {inCart && (
                          <div className="lg:hidden shrink-0 min-w-[22px] h-[22px] px-1.5 bg-[#C9A227] text-black text-[11px] font-black rounded-full flex items-center justify-center">
                            {inCart.quantity}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
                  <div
                    className="grid gap-2.5"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
                  >
                  {activeTables.map((tbl) => (
                    <button
                      key={tbl.tableId}
                      onClick={() => setOrderDetailsView({ type: "table", tableId: tbl.tableId })}
                      className={`bg-white p-3 rounded-xl border hover:shadow-sm transition-all text-left flex items-center gap-2.5 group ${tbl.wantsCheckout ? 'border-red-300 hover:border-red-500' : 'border-slate-100 hover:border-[#C9A227]'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${tbl.wantsCheckout ? 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white' : 'bg-amber-50 text-amber-500 group-hover:bg-[#C9A227] group-hover:text-white'}`}>
                        <Utensils className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-black text-slate-800 truncate">
                          Mesa {tbl.tableId}
                          {tbl.wantsCheckout && <span className="ml-1.5 text-[8px] font-black uppercase text-red-500">· Conta</span>}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{tbl.customerName}</p>
                      </div>
                      <span className="text-xs font-black text-slate-700 shrink-0">{fmt(tbl.total)}</span>
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
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {activeComandas.map((comanda) => (
                  <button
                    key={comanda.id}
                    onClick={() => setOrderDetailsView({ type: "comanda", comanda })}
                    className="bg-white p-3 rounded-xl border border-slate-100 hover:border-[#C9A227] hover:shadow-sm transition-all text-left flex items-center gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-black text-slate-800 truncate">{dineInOrderLabel(comanda)}</h4>
                      <p className="text-[10px] font-bold text-slate-400">
                        {comanda.items.length} {comanda.items.length === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <span className="text-xs font-black text-[#C9A227] shrink-0">{fmt(comanda.total)}</span>
                  </button>
                ))}
              {activeComandas.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30">
                  <p className="text-sm font-black uppercase tracking-widest">Nenhuma comanda aberta</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delivery Tab — pedidos entregues fora do PDV, aguardando faturar */}
        {activeTab === "delivery" && (
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Delivery Aguardando Faturar</h4>
            </div>
            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
            >
              {pendingDeliveryOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => { setBillingOrder(order); setBillingPaymentMethod("CASH"); }}
                  className="bg-white p-3 rounded-xl border border-slate-100 hover:border-[#C9A227] hover:shadow-sm transition-all text-left flex items-center gap-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                    <Truck className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-800 truncate">{order.customerName}</h4>
                    <p className="text-[10px] font-bold text-slate-400">
                      {order.items.length} {order.items.length === 1 ? "item" : "itens"} · Entregue
                    </p>
                  </div>
                  <span className="text-xs font-black text-[#C9A227] shrink-0">{fmt(order.total)}</span>
                </button>
              ))}
              {pendingDeliveryOrders.length === 0 && (
                <div className="col-span-full py-20 text-center opacity-30">
                  <p className="text-sm font-black uppercase tracking-widest">Nenhum delivery aguardando faturar</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Barra de atalhos — desktop apenas (teclado físico) */}
        {!isWaiterMode && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <span className="flex items-center gap-1.5 pr-2 text-slate-400">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[9px] font-black uppercase tracking-widest">Atalhos</span>
            </span>
            <button
              onClick={() => discountInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-white hover:text-[#0D1B3E] hover:shadow-sm transition-all"
            >
              Desconto <kbd className="text-[8px] font-black bg-slate-200 text-slate-500 rounded px-1 py-0.5">F4</kbd>
            </button>
            <button
              onClick={handleUndoLastItem}
              disabled={cart.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-white hover:text-[#0D1B3E] hover:shadow-sm transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none"
            >
              Cancelar Item <kbd className="text-[8px] font-black bg-slate-200 text-slate-500 rounded px-1 py-0.5">F6</kbd>
            </button>
            <button
              onClick={() => setShowPriceCheckModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-white hover:text-[#0D1B3E] hover:shadow-sm transition-all"
            >
              Consultar Preço <kbd className="text-[8px] font-black bg-slate-200 text-slate-500 rounded px-1 py-0.5">F7</kbd>
            </button>
            <button
              onClick={() => setShowMoreOptionsMenu((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-white hover:text-[#0D1B3E] hover:shadow-sm transition-all"
            >
              Mais Opções <kbd className="text-[8px] font-black bg-slate-200 text-slate-500 rounded px-1 py-0.5">F8</kbd>
            </button>
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

      {/* ── Cart modal backdrop (mobile/tablet) ── */}
      {showCartDrawer && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCartDrawer(false)}
        />
      )}

      {/* ── Right: Order/Cart Panel ── */}
      <div className={`${
        showCartDrawer
          ? "fixed flex inset-x-0 bottom-0 top-4 sm:inset-x-6 sm:inset-y-6 lg:static lg:inset-auto z-40 lg:z-auto"
          : "hidden lg:flex"
      } w-full sm:w-auto lg:w-[380px] xl:w-[420px] flex-col bg-[#0D1B3E] rounded-t-[2rem] sm:rounded-[2rem] lg:rounded-[2rem] text-white overflow-hidden shadow-2xl relative shrink-0`}>
        {/* Header */}
        <div className="p-3.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCartDrawer(false)}
                className="lg:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center shrink-0 transition-colors -ml-1"
                title="Voltar para os produtos"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="hidden lg:flex w-7 h-7 rounded-lg bg-[#C9A227]/15 text-[#C9A227] items-center justify-center shrink-0">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest leading-none">
                  {selectedTableId ? `Mesa ${selectedTableId}` : "Novo Pedido"}
                </h3>
                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                  {selectedTableId ? "Fechamento de Conta" : "Venda Rápida Balcão"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {cart.length > 0 && (
                <span className="bg-[#C9A227] text-black text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {(selectedTableId || cart.length > 0) && (
                <button
                  onClick={clearCart}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                >
                  <X className="w-3 h-3 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wide whitespace-nowrap">Limpar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Customer info (compact) */}
        <div className="px-3.5 py-2 border-b border-white/5 relative">
          {linkedCustomer ? (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
              <div className="w-7 h-7 rounded-full bg-[#C9A227]/20 text-[#C9A227] flex items-center justify-center shrink-0 text-[11px] font-black uppercase">
                {linkedCustomer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{linkedCustomer.name}</p>
                <p className="text-[9px] text-white/40 truncate">
                  {linkedCustomer.phone}
                  {tenant.loyaltyConfig?.enabled && (
                    <span className="text-[#C9A227]"> · {linkedCustomer.loyaltyPoints} pts</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleClearLinkedCustomer}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                title="Remover cliente"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCustomerSearchOpen(true)}
              className="w-full flex items-center gap-2 bg-white/5 border border-white/10 hover:border-[#C9A227]/50 rounded-lg px-2.5 py-2 transition-colors text-left"
            >
              <User className="w-3.5 h-3.5 text-white/40 shrink-0" />
              <span className="text-[11px] font-bold text-white/50 flex-1">Cliente (opcional)</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/30" />
            </button>
          )}

          {fiscalEnabled && (
            <div className="relative mt-1.5">
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

          {/* Popover de busca/cadastro de cliente */}
          {customerSearchOpen && (
            <div className="absolute left-3.5 right-3.5 top-full mt-1 z-30 bg-[#111d3d] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="p-2.5 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Buscar por nome, telefone ou CPF..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-8 pr-3 text-xs text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto custom-scrollbar">
                {customerSearchLoading && (
                  <p className="px-3 py-3 text-[10px] text-white/30 text-center">Buscando...</p>
                )}
                {!customerSearchLoading && customerSearchTerm.trim().length >= 2 && customerSearchResults.length === 0 && (
                  <p className="px-3 py-3 text-[10px] text-white/30 text-center">Nenhum cliente encontrado — pode cadastrar digitando nome e telefone abaixo.</p>
                )}
                {customerSearchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#C9A227]/20 text-[#C9A227] flex items-center justify-center shrink-0 text-[10px] font-black uppercase">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{c.name}</p>
                      <p className="text-[9px] text-white/40 truncate">{c.phone}</p>
                    </div>
                    {tenant.loyaltyConfig?.enabled && (
                      <span className="text-[9px] font-black text-[#C9A227] shrink-0">{c.loyaltyPoints} pts</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-white/5 grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Nome"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[11px] text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
                />
                <input
                  type="tel"
                  placeholder="Telefone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg py-1.5 px-2.5 text-[11px] text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
                />
                <button
                  onClick={() => setCustomerSearchOpen(false)}
                  className="col-span-2 mt-0.5 bg-[#C9A227] hover:bg-[#E8B93A] text-black text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors"
                >
                  {customerName || customerPhone ? "Usar estes dados" : "Fechar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Carrinho Vazio</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="bg-white/[0.04] border border-white/5 rounded-xl p-2.5 flex items-center gap-3 hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold truncate">{item.product.name}</h4>
                  <p className="text-[10px] font-bold text-white/40">{fmt(item.price)} un.</p>
                </div>
                <div className="flex items-center gap-1 bg-black/20 rounded-lg px-0.5 py-0.5 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, -1); }}
                    className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 hover:text-[#C9A227] transition-colors touch-manipulation"
                  >
                    <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </button>
                  <span className="text-xs font-black w-5 text-center tabular-nums">{item.quantity}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateQuantity(item.product.id, 1); }}
                    className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 hover:text-[#C9A227] transition-colors touch-manipulation"
                  >
                    <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                  </button>
                </div>
                <span className="text-xs font-black tabular-nums text-[#C9A227] w-16 text-right shrink-0">
                  {fmt(item.price * item.quantity)}
                </span>
                <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-white/20 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/5 space-y-3 shrink-0">
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
          <div className={isWaiterMode || isClosingAccount ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {!isClosingAccount && (
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
            )}
            {!isWaiterMode && (
              <button
                disabled={cart.length === 0 || (cashRequired && !currentCash)}
                title={cashRequired && !currentCash ? "Abra o caixa para receber pagamentos" : "Atalho: F2"}
                onClick={() => { setShowCheckout(true); setShowCartDrawer(false); }}
                className="relative bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3 rounded-2xl transition-all shadow-xl shadow-[#C9A227]/20 flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
              >
                Pagar
                <ChevronRight className="w-4 h-4" />
                <span className="absolute top-1 right-1.5 text-[8px] font-bold opacity-40">F2</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de Consulta de Preço (F7) — só consulta, não adiciona ao carrinho ── */}
      <AnimatePresence>
        {showPriceCheckModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => { setShowPriceCheckModal(false); setPriceCheckTerm(""); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Atalho F7</p>
                    <h3 className="text-lg font-black text-slate-800 leading-none">Consultar Preço</h3>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPriceCheckModal(false); setPriceCheckTerm(""); }}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={priceCheckTerm}
                    onChange={(e) => setPriceCheckTerm(e.target.value)}
                    placeholder="Nome do produto..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#C9A227] focus:bg-white outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-1.5">
                {priceCheckTerm.trim() === "" ? (
                  <p className="text-center text-xs text-slate-400 py-10">Digite o nome do produto para consultar o preço.</p>
                ) : priceCheckResults.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-10">Nenhum produto encontrado.</p>
                ) : (
                  priceCheckResults.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                      <span className="text-sm font-bold text-slate-700 truncate">{p.name}</span>
                      <span className="text-sm font-black text-[#0D1B3E] tabular-nums shrink-0">{fmt(p.price)}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Menu de Mais Opções (F8) ── */}
      <AnimatePresence>
        {showMoreOptionsMenu && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setShowMoreOptionsMenu(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center shrink-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">Atalho F8</p>
                    <h3 className="text-lg font-black text-slate-800 leading-none">Mais Opções</h3>
                  </div>
                </div>
                <button
                  onClick={() => setShowMoreOptionsMenu(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 space-y-1">
                {cashRequired && (
                  <button
                    onClick={() => { setShowMoreOptionsMenu(false); currentCash ? setShowCloseCashModal(true) : setShowOpenCashModal(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    {currentCash ? <DoorClosed className="w-4 h-4 text-red-500 shrink-0" /> : <DoorOpen className="w-4 h-4 text-emerald-500 shrink-0" />}
                    <span className="text-sm font-bold text-slate-700">{currentCash ? "Fechar Caixa" : "Abrir Caixa"}</span>
                  </button>
                )}
                {(selectedTableId || cart.length > 0) && (
                  <button
                    onClick={() => { setShowMoreOptionsMenu(false); clearCart(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-700">Limpar Pedido Atual</span>
                  </button>
                )}
                {onOpenFullscreen && (
                  <button
                    onClick={() => { setShowMoreOptionsMenu(false); onOpenFullscreen(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                  >
                    <ExternalLink className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="text-sm font-bold text-slate-700">Nova Janela</span>
                  </button>
                )}
                <button
                  onClick={() => { setShowMoreOptionsMenu(false); toggleBrowserFullscreen(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  {isBrowserFullscreen ? <Minimize2 className="w-4 h-4 text-slate-500 shrink-0" /> : <Maximize2 className="w-4 h-4 text-slate-500 shrink-0" />}
                  <span className="text-sm font-bold text-slate-700">{isBrowserFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal de Detalhes da Mesa/Comanda ── */}
      <AnimatePresence>
      {orderDetailsView && (() => {
          const isTable = orderDetailsView.type === "table";
          const title = isTable ? `Mesa ${orderDetailsView.tableId}` : dineInOrderLabel(orderDetailsView.comanda);
          const relatedOrders = isTable
            ? orders.filter((o) => o.tableId === orderDetailsView.tableId && o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "MERGED")
            : [orderDetailsView.comanda];
          const detailItems: Array<{ key: string; name: string; quantity: number; price: number; notes: string }> = [];
          relatedOrders.forEach((order) => {
            order.items.forEach((item) => {
              if (!item.product) return;
              const existing = detailItems.find((i) => i.key === item.productId && i.notes === (item.notes || ""));
              if (existing) existing.quantity += item.quantity;
              else detailItems.push({ key: item.productId, name: item.product.name, quantity: item.quantity, price: item.price, notes: item.notes || "" });
            });
          });
          const detailSubtotal = detailItems.reduce((acc, i) => acc + i.price * i.quantity, 0);

          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Detalhes</p>
                    <h3 className="text-xl font-black text-slate-800">{title}</h3>
                  </div>
                  <button
                    onClick={() => setOrderDetailsView(null)}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-2">
                  {detailItems.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-10">Nenhum item lançado ainda.</p>
                  ) : (
                    detailItems.map((item) => (
                      <div key={item.key + item.notes} className="flex justify-between items-start text-sm border-b border-slate-50 pb-2.5">
                        <div className="pr-3">
                          <span className="font-bold text-slate-700">{item.quantity}x {item.name}</span>
                          {item.notes && <p className="text-[11px] italic text-slate-400 mt-0.5">{item.notes}</p>}
                        </div>
                        <span className="font-black text-slate-800 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 pt-4 border-t border-slate-100 bg-slate-50 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</span>
                    <span className="text-2xl font-black text-slate-800">{fmt(detailSubtotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => isTable ? handleLoadTable(orderDetailsView.tableId) : handleLoadComanda(orderDetailsView.comanda)}
                      className="bg-white border border-slate-200 hover:border-[#C9A227] text-slate-700 font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Itens
                    </button>
                    {!isWaiterMode && (
                      <button
                        disabled={detailItems.length === 0}
                        onClick={() => handleGoToCheckoutFromDetails(orderDetailsView)}
                        className="bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3.5 rounded-2xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        Fechar Conta
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Comanda Modal ── */}
      <AnimatePresence>
        {showComandaModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
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
                          operatorName: operatorName || undefined,
                          items: cart.map((i) => ({ productId: i.product.id, quantity: i.quantity, price: i.price, notes: i.notes || undefined })),
                          ...(isWaiterMode ? { source: "waiter" } : {}),
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

      {/* ── Faturar Delivery Modal ── */}
      <AnimatePresence>
        {billingOrder && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <Truck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Faturar Delivery</h3>
                <p className="text-xs text-slate-400 font-bold uppercase">{billingOrder.customerName} · {fmt(billingOrder.total)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                  Como foi pago?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "CASH", label: "Dinheiro" },
                    { id: "CREDIT", label: "Crédito" },
                    { id: "DEBIT", label: "Débito" },
                    { id: "PIX", label: "Pix" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setBillingPaymentMethod(opt.id)}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                        billingPaymentMethod === opt.id
                          ? "border-[#C9A227] bg-[#C9A227]/10 text-[#0D1B3E]"
                          : "border-slate-100 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setBillingOrder(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={isBilling}
                  onClick={async () => {
                    if (!billingOrder) return;
                    setIsBilling(true);
                    try {
                      await apiJson(`/api/tenants/${tenant.slug}/pdv/bill-order/${billingOrder.id}`, {
                        method: "POST",
                        body: JSON.stringify({ paymentMethod: billingPaymentMethod, operatorName: operatorName || undefined }),
                      });
                      setBillingOrder(null);
                      onOrderCreated?.();
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsBilling(false);
                    }
                  }}
                  className="bg-[#0D1B3E] hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isBilling ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : "Confirmar e Faturar"}
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
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-[#0D1B3E] w-full h-full sm:w-[90vw] sm:h-[85vh] max-w-6xl rounded-[1.5rem] shadow-2xl border border-white/5 overflow-hidden flex flex-col relative"
            >
              {/* Header — título e botão cancelar sempre visíveis, fora da área de conteúdo,
                  pra nunca competir por espaço com "Dividir Pagamento" ou outros controles. */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
                <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">Pagamento</span>
                <button
                  onClick={() => { setShowCheckout(false); setShowCartDrawer(true); }}
                  title="Cancelar pagamento e voltar ao carrinho"
                  className="flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-300 hover:text-red-200 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Cancelar</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left: Summary */}
              <div className="w-full md:w-64 bg-black/20 p-4 flex flex-col border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0">
                <button
                  onClick={() => { setShowCheckout(false); setShowCartDrawer(true); }}
                  className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-3 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Voltar ao Carrinho</span>
                </button>

                <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Resumo</p>
                <h3 className="text-base font-black text-white mb-3 truncate">
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
                  {!!serviceChargeConfig?.enabled && (
                    <label className="flex items-center justify-between text-xs text-[#C9A227] cursor-pointer gap-2">
                      <span className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={serviceChargeChecked}
                          onChange={(e) => setServiceChargeChecked(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[#C9A227]"
                        />
                        Taxa de serviço ({(serviceChargeConfig.percent || 0).toFixed(0)}%)
                      </span>
                      <span className="tabular-nums">{serviceChargeAmount > 0 ? `+${fmt(serviceChargeAmount)}` : fmt(0)}</span>
                    </label>
                  )}
                  <div className="flex justify-between pt-2 mt-1 border-t border-white/10">
                    <span className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest self-end">Total</span>
                    <span className="text-2xl font-black text-white tabular-nums">{fmt(finalTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePrintPreCheckout}
                  className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white transition-colors text-[10px] font-black uppercase tracking-wide"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir Pedido
                </button>
              </div>

              {/* Right: Payment */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="overflow-y-auto min-h-0 p-4 sm:p-5 custom-scrollbar">
                <div className="space-y-3">
                  {/* Payment methods — faixa horizontal compacta no topo */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Forma de Pagamento</p>
                      {paymentMethod !== "STONE" && (
                        <button
                          onClick={() => {
                            setIsSplitMode((v) => !v);
                            if (isSplitMode) setPaymentSplits([]);
                          }}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-colors ${
                            isSplitMode ? "bg-[#C9A227] text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                          }`}
                        >
                          <Split className="w-3 h-3" />
                          Dividir Pagamento
                        </button>
                      )}
                    </div>

                    {isSplitMode && (
                      <div className="space-y-1.5 bg-white/[0.03] border border-white/10 rounded-xl p-2.5">
                        {paymentSplits.length === 0 ? (
                          <p className="text-[10px] text-white/30 text-center py-2">Escolha a forma abaixo e clique em "Adicionar Forma".</p>
                        ) : (
                          paymentSplits.map((split) => {
                            const label = PAYMENT_METHODS.find((m) => m.id === split.method)?.label || split.method;
                            return (
                              <div key={split.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-2.5 py-2">
                                <span className="text-[10px] font-black text-white flex-1 truncate">
                                  {label}{split.cardBrand ? ` · ${split.cardBrand}` : ""}
                                </span>
                                <div className="relative w-24">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-white/30">R$</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatCurrencyDigits(numberToDigits(split.amount))}
                                    onChange={(e) => handleUpdateSplitAmount(split.id, digitsToNumber(maskCurrencyDigits(e.target.value.replace(/\D/g, ""))))}
                                    className="w-full bg-black/20 border border-white/10 rounded-md py-1 pl-6 pr-1.5 text-[10px] font-black text-white text-right outline-none focus:border-[#C9A227]"
                                  />
                                </div>
                                <button onClick={() => handleRemovePaymentSplit(split.id)} className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        )}
                        <div className="flex items-center justify-between pt-1.5 border-t border-white/10">
                          <span className="text-[9px] font-black uppercase text-white/40">Falta pagar</span>
                          <span className={`text-xs font-black tabular-nums ${splitRemaining > 0 ? "text-[#C9A227]" : "text-emerald-400"}`}>{fmt(splitRemaining)}</span>
                        </div>
                        {splitRemaining > 0 && (
                          <>
                            <p className="text-[9px] font-black uppercase text-white/30 pt-1">Escolha a forma pra adicionar</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {PAYMENT_METHODS.filter((m) => m.id !== "STONE").map((method) => {
                                const Icon = method.icon;
                                const active = paymentMethod === method.id;
                                return (
                                  <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${
                                      active
                                        ? "bg-[#C9A227] border-[#C9A227]"
                                        : "bg-white/5 border-white/10 hover:bg-white/10"
                                    }`}
                                  >
                                    <Icon className={`w-3.5 h-3.5 ${active ? "text-black" : "text-white/60"}`} />
                                    <span className={`text-[8px] font-black uppercase ${active ? "text-black" : "text-white/60"}`}>{method.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <button
                              onClick={handleAddPaymentSplit}
                              className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/15 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Adicionar {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label} ({fmt(splitRemaining)})
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {!isSplitMode && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                        {PAYMENT_METHODS.map((method) => {
                          const Icon = method.icon;
                          const active = paymentMethod === method.id;
                          return (
                            <button
                              key={method.id}
                              onClick={() => {
                                setPaymentMethod(method.id as any);
                                if (method.id !== "CASH") setAmountReceived("");
                                if (method.id === "CASH") setCardBrand("");
                              }}
                              className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border transition-all ${
                                active
                                  ? "bg-[#C9A227] border-[#C9A227] shadow-lg shadow-[#C9A227]/20"
                                  : "bg-white/5 border-white/10 hover:bg-white/10"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${active ? "text-black" : "text-white/70"}`} />
                              <span className={`text-[9px] font-black uppercase tracking-wide leading-none ${active ? "text-black" : "text-white/70"}`}>
                                {method.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Context panel — some fora do modo split: cada parcela ali já trata valor
                      e bandeira, então troco/parcelamento/PIX do método "solo" não se aplicam. */}
                  {!isSplitMode && (
                  <div className="space-y-1.5">
                    {paymentMethod === "CASH" && (
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-[#C9A227] tracking-widest ml-1">Valor Recebido</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-white/30">R$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              autoFocus
                              value={formatCurrencyDigits(amountReceived)}
                              onChange={(e) => setAmountReceived(maskCurrencyDigits(e.target.value))}
                              placeholder="0,00"
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-base font-black text-white focus:border-[#C9A227] outline-none text-center [appearance:textfield]"
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
                    )}

                    {paymentMethod === "CREDIT" && (
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2.5">
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Parcelamento</p>
                        <div className="grid grid-cols-3 gap-1.5">
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
                        {CARD_BRANDS.length > 0 && (
                          <>
                            <p className="text-[10px] font-black uppercase text-white/40 tracking-widest pt-1">Bandeira</p>
                            <div className="grid grid-cols-2 gap-1.5">
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
                      </div>
                    )}

                    {paymentMethod === "DEBIT" && CARD_BRANDS.length > 0 && (
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2.5">
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Bandeira</p>
                        <div className="grid grid-cols-2 gap-1.5">
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
                      </div>
                    )}

                    {paymentMethod === "VR" && CARD_BRANDS.length > 0 && (
                      <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2.5">
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Bandeira VR</p>
                        <div className="grid grid-cols-2 gap-1.5">
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
                      </div>
                    )}

                    {paymentMethod === "PIX" && (
                      <div className="flex flex-col items-center justify-center text-center gap-2.5 bg-white/5 rounded-2xl border border-white/10 p-5">
                        <div className="w-12 h-12 bg-[#C9A227]/10 rounded-full flex items-center justify-center animate-pulse">
                          <QrCode className="w-6 h-6 text-[#C9A227]" />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase tracking-widest text-white">PIX</p>
                          <p className="text-[10px] text-white/40 max-w-[200px] mx-auto mt-1">
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
                  )}
                </div>
              </div>

                {/* Finalize button — sempre visível, fora da área rolável */}
                {paymentMethod !== "STONE" || stoneStatus === "idle" ? (
                  <div className="px-4 sm:px-6 py-3 border-t border-white/5 shrink-0 bg-black/20 space-y-2">
                    {!isWaiterMode && (
                      <div className="flex items-center justify-center gap-4 text-[9px] font-bold text-white/30">
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-black">F2</kbd> Finalizar venda
                        </span>
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-black">ESC</kbd> Cancelar
                        </span>
                      </div>
                    )}
                    <button
                      disabled={
                        isProcessing ||
                        (isSplitMode && (paymentSplits.length === 0 || splitRemaining > 0)) ||
                        (!isSplitMode && paymentMethod === "CASH" && amountReceived !== "" && digitsToNumber(amountReceived) < total)
                      }
                      onClick={handleCheckout}
                      className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3 rounded-xl transition-all shadow-lg shadow-[#C9A227]/25 flex items-center justify-center gap-2.5 uppercase tracking-widest text-xs"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : isSplitMode && splitRemaining > 0 ? (
                        <>Falta {fmt(splitRemaining)}</>
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
  );
}
