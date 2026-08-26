import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Minus, X, ShoppingCart,
  Trash2, CreditCard, Banknote, QrCode,
  CheckCircle2, Receipt, Package,
  ChevronRight, ChevronDown, ArrowLeft,
  Utensils, Tag, User, Phone, Percent,
  Printer, Hash, AlertCircle, Smartphone, Lock, ExternalLink, Download, Zap,
  MoreHorizontal, DoorOpen, DoorClosed, Maximize2, Minimize2, Split, Truck, MessageSquarePlus, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, ProductExtra, Order, PaymentConfig, PaymentMethodConfig, StoneConfig, Customer, PrintingConfig } from "../../../../types";
import { dineInOrderLabel, DEFAULT_PRINTING_CONFIG } from "../../../../types";
import { apiJson } from "../../../../lib/api";
import { useToast } from "../../../../components";
import { downloadReceiptPdf, printReceiptPdf, printCashClosingReportPdf, downloadDanfePdf, printDanfePdf } from "../../../../lib/receipt";
import type { DanfeData } from "../../../../types";
import socket from "../../../../lib/socket";
import SelectionGroupPicker, { parseSelectionGroups, getSelectionGroupOptions, formatSelectionGroupsNote, selectionGroupsComplete } from "../../../menu-view/SelectionGroupPicker";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Compartilhado entre TODAS as instâncias de PDVPanel montadas na mesma aba/janela —
// a tela dedicada (/pdv/:slug) e a aba "PDV" do Dashboard podem estar abertas ao mesmo
// tempo, e cada uma recebe o mesmo evento "order-created" pelo socket. Um Set por
// componente (useRef) não via a outra instância imprimir, então o mesmo pedido saía
// duas vezes — uma por instância. Módulo compartilhado resolve isso pra qualquer
// combinação de telas abertas no mesmo processo.
const globalAutoPrintedOrderIds = new Set<string>();

// Aceita CPF (11 dígitos, pessoa física) ou CNPJ (14 dígitos, pessoa jurídica) —
// formata como CPF enquanto o usuário digita até 11 dígitos, e vira máscara de
// CNPJ automaticamente a partir do 12º dígito.
const maskCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
};

const isPhoneComplete = (v: string) => v.replace(/\D/g, "").length === 11;

// Máscara monetária estilo caixa eletrônico: digita os centavos, o valor "empurra" pra esquerda.
// Trabalha sempre com o valor em centavos (string de dígitos) para não perder precisão.
const maskCurrencyDigits = (digits: string) => digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
const digitsToNumber = (digits: string) => (parseInt(digits || "0", 10) || 0) / 100;
const formatCurrencyDigits = (digits: string) => fmt(digitsToNumber(digits)).replace("R$", "").trim();
const numberToDigits = (n: number) => String(Math.round(n * 100));
const roundMoney = (n: number) => Math.round(n * 100) / 100;
const splitValueByCount = (amount: number, count: number) => {
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;
  return Array.from({ length: count }, (_unused, index) => (baseCents + (index === 0 ? remainderCents : 0)) / 100);
};

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
  customNotes?: string;
  price: number; // allows manual override
  productVariantId?: string;
  selectedExtras?: ProductExtra[];
  // IDs escolhidos dos grupos de seleção embutidos no produto (ex: numa marmita, os
  // itens de Guarnição/Arroz/Feijão) — guardado à parte pra poder reabrir e editar a
  // escolha depois, já que `notes` só guarda o texto formatado, não os IDs.
  selectedGroupItemIds?: string[][];
}

type SplitPaymentMethod = "CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR";

interface PaymentSplitEntry {
  id: string;
  method: SplitPaymentMethod;
  amount: number;
  cardBrand?: string;
  installments?: number;
  /** Só presente quando o split veio da divisão por item — nome da pessoa e itens que ela está pagando, pra conferência visual antes de finalizar. */
  personLabel?: string;
  personItems?: string;
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
  const [productOptionsModal, setProductOptionsModal] = useState<Product | null>(null);
  const [productModalNotes, setProductModalNotes] = useState("");
  const [productModalVariantId, setProductModalVariantId] = useState<string>("");
  const [productModalSelectedExtras, setProductModalSelectedExtras] = useState<ProductExtra[]>([]);
  // Itens escolhidos do grupo de seleção embutido no produto (ex: os 2 sabores de
  // "2 espetos tradicionais") — preço fixo, só define o que aparece na observação.
  const [productModalGroupItemIds, setProductModalGroupItemIds] = useState<string[][]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [productModalEditIndex, setProductModalEditIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  // Painel de produtos dentro da própria tela de pagamento — pra dar pra adicionar item
  // esquecido sem sair do checkout e perder a divisão por pessoa já montada.
  const [showAddItemsPanel, setShowAddItemsPanel] = useState(false);
  const [showComandaModal, setShowComandaModal] = useState(false);
  const [comandaNumber, setComandaNumber] = useState("");
  const [nextTicket, setNextTicket] = useState<number | null>(null);
  const [nextTicketLoading, setNextTicketLoading] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedComandaId, setSelectedComandaId] = useState<string | null>(null);
  // Comer no local ou para viagem — só perguntado em venda direta de balcão (sem mesa/comanda).
  // Começa em "Comer no local" (caso mais comum) — o operador só precisa agir quando for viagem.
  const [consumptionType, setConsumptionType] = useState<"EAT_IN" | "TAKEOUT" | null>("EAT_IN");
  const [contextLoadMessage, setContextLoadMessage] = useState("");
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
  // Cliente pediu Nota Fiscal — marcado no fechamento do pagamento; se marcado, a NFC-e
  // é emitida automaticamente assim que a venda for concluída, sem precisar de um clique
  // extra depois (a emissão nunca acontece sozinha se isso não for marcado).
  const [requestNfce, setRequestNfce] = useState(false);
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
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitEntry[]>([]);
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [groupSplitCount, setGroupSplitCount] = useState("2");
  // Divisão por item — em vez de dividir o valor igualmente, cada item do pedido é
  // marcado com uma "pessoa" (índice em splitPersonLabels); o que não for marcado é
  // dividido em partes iguais entre todas as pessoas na hora de gerar os splits.
  const [splitByItem, setSplitByItem] = useState(false);
  const [splitPersonLabels, setSplitPersonLabels] = useState<string[]>(["Pessoa 1", "Pessoa 2"]);
  const [itemPersonAssignment, setItemPersonAssignment] = useState<Record<string, number | null>>({});
  const [detailActionId, setDetailActionId] = useState<string | null>(null);

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
    if (customer.cpf) setCustomerCpf(maskCpfCnpj(customer.cpf));
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

  // Busca a próxima senha disponível sempre que o modal de comanda abre
  useEffect(() => {
    if (!showComandaModal) return;
    setNextTicketLoading(true);
    setNextTicket(null);
    apiJson<{ nextTicket: number }>(`/api/tenants/${tenant.slug}/next-ticket`)
      .then((data) => setNextTicket(data.nextTicket))
      .catch(() => setNextTicket(null))
      .finally(() => setNextTicketLoading(false));
  }, [showComandaModal, tenant.slug]);

  // Outro operador pode abrir/fechar o caixa em outra aba/dispositivo enquanto esta tela já
  // está aberta — sem isso, ficava presa mostrando "Caixa Fechado" (ou vice-versa) até um F5.
  useEffect(() => {
    if (isWaiterMode) return;
    const handler = () => void fetchCurrentCash();
    socket.on("cash-status-changed", handler);
    return () => { socket.off("cash-status-changed", handler); };
  }, [fetchCurrentCash, isWaiterMode]);

  const printingConfig = useMemo<PrintingConfig>(() => {
    try {
      return tenant.printingConfig
        ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) }
        : DEFAULT_PRINTING_CONFIG;
    } catch {
      return DEFAULT_PRINTING_CONFIG;
    }
  }, [tenant.printingConfig]);

  const printOrderAuto = useCallback((order: any) => {
    const desktop = (window as any).pdvDesktop;
    const doPrint = (data: any) => {
      if (desktop?.printReceipt) desktop.printReceipt(data);
      else printReceiptPdf(data);
    };
    const isDineIn = order.orderType === "DINE_IN";
    const clientCopy = buildReceiptDataFromOrder(order, isDineIn ? "CLIENTE" : undefined);
    if (clientCopy) doPrint(clientCopy);
    if (isDineIn && printingConfig.autoPrintEstablishmentCopy) {
      const establishmentCopy = buildReceiptDataFromOrder(order, "ESTABELECIMENTO");
      if (establishmentCopy) doPrint(establishmentCopy);
    }
  }, [printingConfig]);

  // Toda venda/lançamento criado a partir DESTA aba já imprime na hora, logo depois da
  // chamada HTTP ter sucesso (ver handleCheckout/handleCreateComanda/handleLaunchOrder) —
  // sem precisar do socket. O Set global evita imprimir de novo quando o "order-created"
  // desse mesmo pedido chega de volta pelo socket (toda aba do tenant recebe o evento,
  // inclusive quem acabou de criar o pedido, e inclusive outras instâncias de PDVPanel
  // abertas ao mesmo tempo — ver comentário no módulo).

  // Pedidos criados por QUALQUER origem (QR Code da mesa/comanda pelo cliente, delivery
  // público, ou outra aba do PDV/garçom) chegam aqui em tempo real — é o que garante que o
  // app desktop (Electron) imprime mesmo pedidos que essa aba não iniciou.
  useEffect(() => {
    if (!printingConfig.autoPrintOnOrderCreate) return;
    const handler = (order: any) => {
      if (!order?.id || globalAutoPrintedOrderIds.has(order.id)) return;
      globalAutoPrintedOrderIds.add(order.id);
      printOrderAuto(order);
    };
    socket.on("order-created", handler);
    return () => { socket.off("order-created", handler); };
  }, [printingConfig.autoPrintOnOrderCreate, printOrderAuto]);

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
      const result = await apiJson<{ summary?: any }>(`/api/tenants/${tenant.slug}/cash/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance: digitsToNumber(closingBalanceInput) }),
      });
      if (result?.summary) {
        let printingConfigNow: PrintingConfig = DEFAULT_PRINTING_CONFIG;
        try {
          printingConfigNow = tenant.printingConfig
            ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) }
            : DEFAULT_PRINTING_CONFIG;
        } catch {}
        if (printingConfigNow.autoPrintCashClosingReport) {
          const summaryWithBalance = {
            ...result.summary,
            closingBalance: digitsToNumber(closingBalanceInput),
          };
          const desktop = (window as any).pdvDesktop;
          if (desktop?.printCashClosingReport) {
            desktop.printCashClosingReport(tenant.name, summaryWithBalance);
          } else {
            printCashClosingReportPdf(tenant.name, summaryWithBalance, (tenant.receiptPaperWidth === 58 ? 58 : 80) as 58 | 80);
          }
        }
      }
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

  // CNPJ do estabelecimento pro cabeçalho da notinha — vem da config fiscal mesmo
  // quando o fiscal não está habilitado (é só informação do cabeçalho, não emissão de nota).
  const tenantCnpj = useMemo(() => {
    try {
      const cfg = tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig as string) : null;
      return cfg?.cnpj || undefined;
    } catch { return undefined; }
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

  const fetchDanfeData = async (): Promise<DanfeData | null> => {
    const order = lastOrderRef.current;
    if (!order?.id) return null;
    try {
      return await apiJson<DanfeData>(`/api/owner/tenants/${tenant.id}/nfce/danfe/${order.id}`);
    } catch (err: any) {
      alert(err?.message ?? "Erro ao carregar dados da NFC-e.");
      return null;
    }
  };

  const handleDownloadDanfe = async () => {
    const data = await fetchDanfeData();
    if (data) downloadDanfePdf(data, tenant.receiptPaperWidth);
  };

  const handlePrintDanfe = async () => {
    const data = await fetchDanfeData();
    if (!data) return;
    const desktop = (window as any).pdvDesktop;
    if (desktop?.printDanfe) {
      desktop.printDanfe(data);
    } else {
      printDanfePdf(data, tenant.receiptPaperWidth);
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

  const getBrandsForPaymentMethod = useCallback((method: SplitPaymentMethod) => {
    const key = PAYMENT_CONFIG_KEY_MAP[method];
    const cfg = key ? (paymentConfig[key] as any) : null;
    return (cfg?.acceptedBrands?.length ? cfg.acceptedBrands : []) as string[];
  }, [paymentConfig]);

  const getInstallmentOptionsForMethod = useCallback((method: SplitPaymentMethod, brand?: string) => {
    if (method !== "CREDIT") return [1];
    const cfg = paymentConfig.credit;
    const keys = brand
      ? Object.keys(cfg?.brandFees?.[brand]?.installmentFees || {})
      : Object.values(cfg?.brandFees || {}).flatMap((fee) => Object.keys(fee.installmentFees || {}));
    const unique = [...new Set(keys.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    return unique.length > 0 ? unique : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }, [paymentConfig]);

  const getNormalizedBrandForMethod = useCallback((method: SplitPaymentMethod, brand?: string) => {
    const brands = getBrandsForPaymentMethod(method);
    if (brands.length === 0) return undefined;
    return brand && brands.includes(brand) ? brand : brands[0];
  }, [getBrandsForPaymentMethod]);

  const getNormalizedInstallmentsForMethod = useCallback((method: SplitPaymentMethod, brand?: string, current?: number) => {
    if (method !== "CREDIT") return undefined;
    const options = getInstallmentOptionsForMethod(method, brand);
    return options.includes(current || 0) ? current : (options[0] || 1);
  }, [getInstallmentOptionsForMethod]);

  const getFeeInfoForMethod = useCallback((
    method: SplitPaymentMethod | "STONE",
    brand?: string,
    installmentsCount = 1,
    amount = 0
  ) => {
    if (method === "STONE" || method === "CASH") {
      return { percent: 0, amount: 0, passToCustomer: false, rate: 0 };
    }
    if (method === "PIX") {
      const cfg = paymentConfig.pix;
      const percent = cfg?.brandFees?.["PIX"]?.installmentFees?.["1"] ?? 0;
      const passToCustomer = !!cfg?.passFeeToCustomer;
      return {
        percent,
        amount: roundMoney(amount * (percent / 100)),
        passToCustomer,
        rate: passToCustomer ? percent / 100 : 0,
      };
    }

    const configKey = method === "CREDIT" ? "credit" : method === "DEBIT" ? "debit" : "meal";
    const cfg = paymentConfig[configKey] as PaymentMethodConfig | undefined;
    const normalizedBrand = getNormalizedBrandForMethod(method, brand);
    if (!cfg || !normalizedBrand) {
      return { percent: 0, amount: 0, passToCustomer: false, rate: 0 };
    }

    const normalizedInstallments = method === "CREDIT"
      ? getNormalizedInstallmentsForMethod(method, normalizedBrand, installmentsCount) || 1
      : 1;
    const installmentKey = method === "CREDIT" ? String(normalizedInstallments) : "1";
    const percent = cfg?.brandFees?.[normalizedBrand]?.installmentFees?.[installmentKey] ?? 0;
    const passToCustomer = !!cfg?.passFeeToCustomer;
    return {
      percent,
      amount: roundMoney(amount * (percent / 100)),
      passToCustomer,
      rate: passToCustomer ? percent / 100 : 0,
    };
  }, [getNormalizedBrandForMethod, getNormalizedInstallmentsForMethod, paymentConfig]);

  const normalizedCardBrand = paymentMethod === "STONE"
    ? undefined
    : getNormalizedBrandForMethod(paymentMethod as SplitPaymentMethod, cardBrand);
  const creditInstallmentOptions = useMemo(
    () => getInstallmentOptionsForMethod("CREDIT", normalizedCardBrand),
    [getInstallmentOptionsForMethod, normalizedCardBrand]
  );

  useEffect(() => {
    if (paymentMethod === "STONE") {
      if (cardBrand) setCardBrand("");
      return;
    }

    const method = paymentMethod as SplitPaymentMethod;
    const nextBrand = getNormalizedBrandForMethod(method, cardBrand);
    const hasBrands = getBrandsForPaymentMethod(method).length > 0;
    if (!hasBrands && cardBrand) {
      setCardBrand("");
    } else if (hasBrands && nextBrand !== cardBrand) {
      setCardBrand(nextBrand || "");
    }

    if (method !== "CREDIT") {
      if (installments !== 1) setInstallments(1);
      return;
    }

    const nextInstallments = getNormalizedInstallmentsForMethod(method, nextBrand, installments) || 1;
    if (nextInstallments !== installments) {
      setInstallments(nextInstallments);
    }
  }, [paymentMethod, cardBrand, installments, getBrandsForPaymentMethod, getNormalizedBrandForMethod, getNormalizedInstallmentsForMethod]);

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

  const activeComandas = useMemo(() => {
    // counterTicketNumber reseta todo dia — sem filtrar por hoje, uma comanda de
    // balcão esquecida (nunca faturada) de um dia anterior nunca some da lista e,
    // se algum dia a senha se repetir, é resgatada aqui como se fosse a de hoje.
    // Ao tentar pagar, o bill-context recusa (com razão: caixa de dias diferentes
    // não pode se misturar), mas pro operador isso só parece um erro sem explicação.
    //
    // Cada pedido (linha do banco) aparece como seu próprio card aqui, mesmo que
    // divida a mesma senha com outro — nunca somamos itens/valores de pedidos
    // diferentes num só card. Ao abrir/pagar uma comanda, o fechamento (bill-context)
    // já soma corretamente todas as linhas daquela senha por conta própria; isso aqui
    // é só a lista, não precisa (nem deve) pré-somar visualmente.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return orders
      .filter((order) =>
        order.orderType === "DINE_IN" &&
        !["DELIVERED", "CANCELLED", "MERGED"].includes(order.status) &&
        !order.tableId &&
        !order.billed &&
        new Date(order.createdAt) >= startOfToday
      )
      .sort((a, b) => {
        const ticketA = a.counterTicketNumber ?? Number.MAX_SAFE_INTEGER;
        const ticketB = b.counterTicketNumber ?? Number.MAX_SAFE_INTEGER;
        if (ticketA !== ticketB) return ticketA - ticketB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [orders]);

  // Delivery entregue mas ainda sem venda lançada no caixa (pagamento na entrega,
  // fora do fluxo do PDV) — precisa ser faturado manualmente aqui.
  const pendingDeliveryOrders = useMemo(
    () => orders.filter((o) => o.orderType === "DELIVERY" && o.status === "DELIVERED" && !o.billed),
    [orders]
  );

  const selectedComandaBaseOrder = useMemo(
    () => selectedComandaId ? orders.find((order) => order.id === selectedComandaId) ?? null : null,
    [orders, selectedComandaId]
  );

  const currentContextOrders = useMemo(() => {
    if (selectedTableId) {
      return orders.filter(
        (order) =>
          order.orderType === "DINE_IN" &&
          order.tableId === selectedTableId &&
          !["DELIVERED", "CANCELLED", "MERGED"].includes(order.status) && !order.billed
      );
    }
    if (selectedComandaId) {
      return orders.filter(
        (order) =>
          (
            (selectedComandaBaseOrder?.counterTicketNumber != null && order.counterTicketNumber === selectedComandaBaseOrder.counterTicketNumber) ||
            order.id === selectedComandaId
          ) &&
          order.orderType === "DINE_IN" &&
          !order.tableId &&
          !["DELIVERED", "CANCELLED", "MERGED"].includes(order.status) && !order.billed
      );
    }
    return [];
  }, [orders, selectedComandaBaseOrder?.counterTicketNumber, selectedComandaId, selectedTableId]);

  const existingContextItems = useMemo(
    () =>
      currentContextOrders.flatMap((order) =>
        (order.items || [])
          .filter((item) => item.product)
          .map((item) => ({
            orderId: order.id,
            orderLabel: dineInOrderLabel(order),
            status: order.status,
            ...item,
          }))
      ),
    [currentContextOrders]
  );

  const existingContextSubtotal = useMemo(
    () => existingContextItems.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [existingContextItems]
  );

  const subtotal = existingContextSubtotal + cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  // Linhas cobráveis do pedido, com uma chave de linha estável — usada pra divisão por
  // item (itemPersonAssignment). Itens do carrinho não têm id próprio (só existem no
  // banco após o checkout), então a chave usa o índice na lista combinada.
  // Uma linha por PEDIDO (comportamento normal: "2x Espeto Carne" numa linha só).
  const billableLinesGrouped = useMemo(
    () => [
      ...existingContextItems.map((item) => ({
        lineKey: `existing-${item.id}`,
        quantity: item.quantity,
        price: item.price,
        name: item.product?.name || "",
        notes: (item as any).notes as string | undefined,
        total: item.price * item.quantity,
      })),
      ...cart.map((item, idx) => ({
        lineKey: `cart-${idx}`,
        quantity: item.quantity,
        price: item.price,
        name: item.product?.name || "",
        notes: item.notes,
        total: item.price * item.quantity,
      })),
    ],
    [existingContextItems, cart]
  );

  // Uma entrada por UNIDADE — "2x Espeto Carne" vira duas entradas independentes (uma
  // por espeto), cada uma com sua própria lineKey, pra dar pra marcar 1 espeto pra uma
  // pessoa e o outro pra outra. Só usada dentro da divisão de pagamento por item —
  // fora dela o resumo continua agrupado (billableLinesGrouped), como sempre foi.
  const billableLinesByUnit = useMemo(
    () => [
      ...existingContextItems.flatMap((item) =>
        Array.from({ length: item.quantity }, (_unused, unitIdx) => ({
          lineKey: `existing-${item.id}-${unitIdx}`,
          quantity: 1,
          price: item.price,
          name: item.product?.name || "",
          notes: (item as any).notes as string | undefined,
          total: item.price,
        }))
      ),
      ...cart.flatMap((item, idx) =>
        Array.from({ length: item.quantity }, (_unused, unitIdx) => ({
          lineKey: `cart-${idx}-${unitIdx}`,
          quantity: 1,
          price: item.price,
          name: item.product?.name || "",
          notes: item.notes,
          total: item.price,
        }))
      ),
    ],
    [existingContextItems, cart]
  );

  const billableLines = isSplitMode && splitByItem ? billableLinesByUnit : billableLinesGrouped;

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

  const feeInfo = useMemo(
    () => getFeeInfoForMethod(paymentMethod, normalizedCardBrand, installments, total),
    [getFeeInfoForMethod, installments, normalizedCardBrand, paymentMethod, total]
  );

  const normalizedPaymentSplits = useMemo(
    () =>
      paymentSplits.map((split) => {
        const nextBrand = getNormalizedBrandForMethod(split.method, split.cardBrand);
        return {
          ...split,
          cardBrand: nextBrand,
          installments: split.method === "CREDIT"
            ? (getNormalizedInstallmentsForMethod(split.method, nextBrand, split.installments) || 1)
            : undefined,
        };
      }),
    [getNormalizedBrandForMethod, getNormalizedInstallmentsForMethod, paymentSplits]
  );

  const splitAllocated = normalizedPaymentSplits.reduce((acc, s) => acc + s.amount, 0);
  const splitFeeAmount = useMemo(
    () =>
      roundMoney(
        normalizedPaymentSplits.reduce(
          (acc, split) => acc + getFeeInfoForMethod(split.method, split.cardBrand, split.installments || 1, split.amount).amount,
          0
        )
      ),
    [getFeeInfoForMethod, normalizedPaymentSplits]
  );
  const baseTotalWithoutSplitFee = total + serviceChargeAmount;
  const activeSplitRate = paymentMethod === "STONE"
    ? 0
    : getFeeInfoForMethod(paymentMethod as SplitPaymentMethod, normalizedCardBrand, installments, 1).rate;
  const splitDifference = roundMoney(baseTotalWithoutSplitFee + splitFeeAmount - splitAllocated);
  const splitRemaining = isSplitMode && splitDifference > 0
    ? roundMoney(splitDifference / Math.max(0.01, 1 - activeSplitRate))
    : 0;
  const splitOverpaidAmount = isSplitMode && splitDifference < 0 ? Math.abs(splitDifference) : 0;
  const splitHasInvalidConfig = isSplitMode && normalizedPaymentSplits.some((split) => split.amount <= 0);
  const splitCanFinalize = !isSplitMode || (
    normalizedPaymentSplits.length > 0 &&
    !splitHasInvalidConfig &&
    Math.abs(splitDifference) < 0.01
  );
  const finalTotal = isSplitMode && normalizedPaymentSplits.length > 0
    ? roundMoney(splitAllocated + (splitDifference > 0 ? splitRemaining : 0))
    : roundMoney((feeInfo.passToCustomer ? total + feeInfo.amount : total) + serviceChargeAmount);
  const change = paymentMethod === "CASH" ? Math.max(0, digitsToNumber(amountReceived) - finalTotal) : 0;
  const existingContextItemCount = existingContextItems.reduce((acc, item) => acc + item.quantity, 0);
  const pendingCartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const checkoutItems = [
    ...existingContextItems.map((item) => ({
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || undefined,
    })),
    ...cart.map((item) => ({
      productId: item.product.id,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || undefined,
    })),
  ];
  const selectedComandaOrder = selectedComandaBaseOrder;
  const currentContextLabel = selectedTableId
    ? `Mesa ${selectedTableId}`
    : selectedComandaOrder
    ? dineInOrderLabel(selectedComandaOrder)
    : null;
  // Venda direta de balcão (sem mesa/comanda) — única situação em que perguntamos
  // se é pra comer no local ou levar pra viagem.
  const isCounterSale = !selectedTableId && !selectedComandaId;

  useEffect(() => {
    if (selectedComandaId && currentContextOrders.length === 0 && cart.length === 0) {
      setSelectedComandaId(null);
      setContextLoadMessage("");
    }
  }, [selectedComandaId, currentContextOrders.length, cart.length]);

  const parseProductExtras = useCallback((product: Product | null | undefined): ProductExtra[] => {
    if (!product?.extras) return [];
    try {
      const parsed = JSON.parse(product.extras);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const hasProductCustomizations = useCallback((product: Product) => {
    return (product.variants?.length || 0) > 0 || parseProductExtras(product).length > 0 || parseSelectionGroups(product).length > 0;
  }, [parseProductExtras]);

  const buildCartNotes = useCallback((selectedExtras: ProductExtra[], notes: string) => {
    const extrasLabel = selectedExtras.length > 0
      ? [...selectedExtras]
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
        .map((extra) => extra.price && extra.price > 0 ? `${extra.label} (+${fmt(extra.price)})` : extra.label)
        .join(", ")
      : "";
    return [extrasLabel, notes.trim()].filter(Boolean).join(" | ");
  }, []);

  const getCartItemPrice = useCallback((product: Product, variantId?: string, selectedExtras: ProductExtra[] = []) => {
    let price = product.price;
    if (variantId && product.variants) {
      const variant = product.variants.find(v => v.id === variantId);
      if (variant) price = variant.price;
    }
    return price + selectedExtras.reduce((acc, extra) => acc + (extra.price || 0), 0);
  }, []);

  const openProductOptions = useCallback((product: Product, editIndex: number | null = null) => {
    const editingItem = editIndex !== null ? cart[editIndex] : null;
    setProductOptionsModal(product);
    setProductModalNotes(editingItem?.customNotes || "");
    setProductModalVariantId(
      editingItem?.productVariantId ||
      (product.variants && product.variants.length > 0 ? product.variants[0].id : "")
    );
    setProductModalSelectedExtras(editingItem?.selectedExtras || []);
    const groupItemIds = editingItem?.selectedGroupItemIds || [];
    setProductModalGroupItemIds(groupItemIds);
    setProductModalEditIndex(editIndex);
    const groups = parseSelectionGroups(product);
    if (groups.length > 0 && !selectionGroupsComplete(groups, groupItemIds)) setShowGroupPicker(true);
  }, [cart]);

  const closeProductOptions = useCallback(() => {
    setProductOptionsModal(null);
    setProductModalNotes("");
    setProductModalVariantId("");
    setProductModalSelectedExtras([]);
    setProductModalGroupItemIds([]);
    setProductModalEditIndex(null);
  }, []);

  const addToCart = useCallback((product: Product, variantId?: string, notes: string = "", selectedExtras: ProductExtra[] = []) => {
    setCart((prev) => {
      // Se tiver variantId ou notes, não agrupa automaticamente, a menos que seja exato
      // Mas para simplificar, se tiver notes, cria um novo item sempre (para notas diferentes não mesclarem)
      const finalNotes = buildCartNotes(selectedExtras, notes);
      const existingIndex = prev.findIndex((i) => i.product.id === product.id && i.productVariantId === variantId && i.notes === finalNotes);
      
      const price = getCartItemPrice(product, variantId, selectedExtras);

      if (existingIndex >= 0) {
        const newCart = [...prev];
        newCart[existingIndex] = { ...newCart[existingIndex], quantity: newCart[existingIndex].quantity + 1 };
        return newCart;
      }
      return [...prev, { product, quantity: 1, notes: finalNotes, customNotes: notes.trim(), price, productVariantId: variantId, selectedExtras }];
    });
  }, [buildCartNotes, getCartItemPrice]);

  const removeFromCart = (index: number) =>
    setCart((prev) => prev.filter((_, i) => i !== index));

  // F6 — desfaz o último item lançado no carrinho (a linha inteira, não uma unidade)
  const handleUndoLastItem = () => {
    setCart((prev) => prev.slice(0, -1));
  };

  const updateQuantity = (index: number, delta: number) =>
    setCart((prev) =>
      prev.map((i, idx) =>
        idx === index ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      )
    );

  const clearCart = () => {
    setCart([]);
    setSelectedTableId(null);
    setSelectedComandaId(null);
    setConsumptionType("EAT_IN");
    setRequestNfce(false);
    setContextLoadMessage("");
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
    setGroupSplitCount("2");
    if (stonePollRef.current) clearInterval(stonePollRef.current);
  };

  // Adiciona a forma de pagamento atualmente selecionada como uma parcela do split,
  // usando o valor restante como sugestão (some 100% do que falta por padrão).
  const handleAddPaymentSplit = () => {
    if (paymentMethod === "STONE" || splitRemaining <= 0) return;
    const method = paymentMethod as SplitPaymentMethod;
    const nextBrand = getNormalizedBrandForMethod(method, cardBrand);
    const nextInstallments = getNormalizedInstallmentsForMethod(method, nextBrand, installments);
    setPaymentSplits((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        method,
        amount: splitRemaining,
        cardBrand: nextBrand,
        installments: method === "CREDIT" ? nextInstallments : undefined,
      },
    ]);
  };

  const handleRemovePaymentSplit = (id: string) => {
    setPaymentSplits((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSplitAmount = (id: string, amount: number) => {
    setPaymentSplits((prev) => prev.map((s) => (s.id === id ? { ...s, amount: Math.max(0, amount) } : s)));
  };

  const handleUpdateSplitMethod = (id: string, method: SplitPaymentMethod) => {
    setPaymentSplits((prev) =>
      prev.map((split) =>
        split.id === id
          ? (() => {
              const nextBrand = getNormalizedBrandForMethod(method, split.cardBrand);
              return {
                ...split,
                method,
                cardBrand: nextBrand,
                installments: method === "CREDIT"
                  ? (getNormalizedInstallmentsForMethod(method, nextBrand, split.installments) || 1)
                  : undefined,
              };
            })()
          : split
      )
    );
  };

  const handleUpdateSplitCardBrand = (id: string, nextBrand: string) => {
    setPaymentSplits((prev) =>
      prev.map((split) =>
        split.id === id
          ? {
              ...split,
              cardBrand: nextBrand || undefined,
              installments: split.method === "CREDIT"
                ? (getNormalizedInstallmentsForMethod(split.method, nextBrand || undefined, split.installments) || 1)
                : undefined,
            }
          : split
      )
    );
  };

  const handleUpdateSplitInstallments = (id: string, nextInstallments: number) => {
    setPaymentSplits((prev) =>
      prev.map((split) => (
        split.id === id
          ? { ...split, installments: split.method === "CREDIT" ? nextInstallments : undefined }
          : split
      ))
    );
  };

  const handleGenerateGroupSplit = () => {
    const count = Number(groupSplitCount);
    if (!Number.isInteger(count) || count < 2) {
      toast.warning("Informe pelo menos 2 pessoas para dividir.");
      return;
    }
    if (paymentMethod === "STONE") {
      toast.warning("A divisão por grupo não está disponível para maquininha Stone.");
      return;
    }

    const method = paymentMethod as SplitPaymentMethod;
    const nextBrand = getNormalizedBrandForMethod(method, cardBrand);
    const nextInstallments = getNormalizedInstallmentsForMethod(method, nextBrand, installments) || 1;
    const rate = getFeeInfoForMethod(method, nextBrand, nextInstallments, 1).rate;
    const projectedTotal = roundMoney(baseTotalWithoutSplitFee / Math.max(0.01, 1 - rate));
    const splitAmounts = splitValueByCount(projectedTotal, count);

    setPaymentSplits(
      Array.from({ length: count }, (_unused, index) => ({
        id: `group-${Date.now()}-${index}`,
        method,
        amount: splitAmounts[index],
        cardBrand: nextBrand,
        installments: method === "CREDIT" ? nextInstallments : undefined,
      }))
    );
    setIsSplitMode(true);
    toast.success(`Divisão gerada para ${count} pessoas.`);
  };

  // Quanto cada pessoa deve pagar, considerando os itens marcados pra ela + uma fração
  // igual dos itens não marcados (ninguém escolheu de quem é) — em centavos exatos, com
  // o resto de arredondamento absorvido pela primeira pessoa, igual à divisão por grupo.
  // Também devolve os nomes dos itens de cada pessoa, pra mostrar na linha do split e o
  // operador conferir visualmente antes de finalizar (ex: "só comprei uma Coca").
  const computePersonAmounts = (personCount: number) => {
    const perPersonCents = Array.from({ length: personCount }, () => 0);
    const perPersonItems: string[][] = Array.from({ length: personCount }, () => []);
    const unassignedLines: typeof billableLines = [];
    for (const line of billableLines) {
      const personIdx = itemPersonAssignment[line.lineKey];
      if (personIdx != null && personIdx < personCount) {
        perPersonCents[personIdx] += Math.round(line.total * 100);
        perPersonItems[personIdx].push(`${line.quantity}x ${line.name}`);
      } else {
        unassignedLines.push(line);
      }
    }
    const unassignedTotalCents = unassignedLines.reduce((acc, l) => acc + Math.round(l.total * 100), 0);
    if (unassignedTotalCents > 0) {
      const share = splitValueByCount(unassignedTotalCents / 100, personCount);
      share.forEach((amount, idx) => {
        perPersonCents[idx] += Math.round(amount * 100);
        if (unassignedLines.length > 0) perPersonItems[idx].push("parte dos itens não marcados");
      });
    }
    return {
      amounts: perPersonCents.map((cents) => cents / 100),
      items: perPersonItems.map((names) => names.join(", ")),
    };
  };

  const handleGenerateItemSplit = () => {
    if (paymentMethod === "STONE") {
      toast.warning("A divisão por item não está disponível para maquininha Stone.");
      return;
    }
    const personCount = splitPersonLabels.length;
    if (personCount < 2) {
      toast.warning("Adicione pelo menos 2 pessoas para dividir por item.");
      return;
    }
    const { amounts, items } = computePersonAmounts(personCount);
    // Aplica a mesma taxa de maquininha proporcionalmente, igual à divisão por grupo,
    // pra que a soma dos splits ainda bata com finalTotal (incluindo taxa) no final.
    const method = paymentMethod as SplitPaymentMethod;
    const nextBrand = getNormalizedBrandForMethod(method, cardBrand);
    const nextInstallments = getNormalizedInstallmentsForMethod(method, nextBrand, installments) || 1;
    const rate = getFeeInfoForMethod(method, nextBrand, nextInstallments, 1).rate;
    const grossFactor = 1 / Math.max(0.01, 1 - rate);

    setPaymentSplits(
      amounts.map((amount, index) => ({
        id: `person-${Date.now()}-${index}`,
        method,
        amount: roundMoney(amount * grossFactor),
        cardBrand: nextBrand,
        installments: method === "CREDIT" ? nextInstallments : undefined,
        personLabel: splitPersonLabels[index],
        personItems: items[index] || undefined,
      }))
    );
    setIsSplitMode(true);
    toast.success(`Divisão por item gerada para ${personCount} pessoas.`);
  };

  const handleAddSplitPerson = () => {
    setSplitPersonLabels((prev) => [...prev, `Pessoa ${prev.length + 1}`]);
  };

  const handleRemoveSplitPerson = (index: number) => {
    setSplitPersonLabels((prev) => prev.filter((_, i) => i !== index));
    setItemPersonAssignment((prev) => {
      const next: Record<string, number | null> = {};
      for (const [lineKey, personIdx] of Object.entries(prev)) {
        if (personIdx == null) { next[lineKey] = null; continue; }
        if (personIdx === index) { next[lineKey] = null; continue; }
        next[lineKey] = personIdx > index ? personIdx - 1 : personIdx;
      }
      return next;
    });
  };

  const handleAssignItemToPerson = (lineKey: string, personIndex: number) => {
    setItemPersonAssignment((prev) => ({
      ...prev,
      [lineKey]: prev[lineKey] === personIndex ? null : personIndex,
    }));
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
        } else if (checkoutItems.length > 0 && (!cashRequired || currentCash)) {
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
  }, [isWaiterMode, checkoutItems.length, cart.length, currentCash, showCheckout, showComandaModal, orderDetailsView, showOpenCashModal, showCloseCashModal, showPriceCheckModal, showMoreOptionsMenu]);

  const handleLoadTable = (tableId: string) => {
    setCart([]);
    setSelectedTableId(tableId);
    setSelectedComandaId(null);
    setConsumptionType("EAT_IN");
    setContextLoadMessage(`Mesa ${tableId} aberta no PDV. Os itens já lançados ficam separados dos novos itens.`);
    setOrderDetailsView(null);
    setActiveTab("products");
    setIsClosingAccount(false);
    setShowCartDrawer(false);
    toast.success(`Mesa ${tableId} aberta no PDV.`);
  };

  const handleLoadComanda = (comanda: Order) => {
    setCart([]);
    setSelectedTableId(comanda.tableId || null);
    setSelectedComandaId(comanda.id);
    setComandaNumber(comanda.customerName || "");
    setConsumptionType(comanda.consumptionType || null);
    setContextLoadMessage(`${dineInOrderLabel(comanda)} aberta no PDV. O que já foi lançado aparece separado do que será adicionado agora.`);
    setOrderDetailsView(null);
    setActiveTab("products");
    setIsClosingAccount(false);
    setShowCartDrawer(false);
    toast.success(`${dineInOrderLabel(comanda)} aberta no PDV.`);
  };

  // Vai direto pro pagamento de uma mesa/comanda já aberta, sem passar por "Adicionar mais itens"
  const handleGoToCheckoutFromDetails = (view: NonNullable<typeof orderDetailsView>) => {
    if (view.type === "table") handleLoadTable(view.tableId);
    else handleLoadComanda(view.comanda);
    setIsClosingAccount(true);
    setShowCheckout(true);
  };

  const handleCreateComanda = async () => {
    if (nextTicketLoading) return;
    setIsProcessing(true);
    try {
      const createdOrder = await apiJson<Order>(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify({
          customerName: comandaNumber.trim() || undefined,
          customerPhone: "00000000000",
          orderType: "DINE_IN",
          consumptionType,
          counterTicketNumber: nextTicket || undefined,
          status: cart.length > 0 ? "PENDING" : "AWAITING_PAYMENT",
          paymentMethod: "CASH",
          operatorName: operatorName || undefined,
          items: cart.map((i) => ({
            productId: i.product.id,
            productVariantId: i.productVariantId,
            quantity: i.quantity,
            price: i.price,
            notes: i.notes || undefined,
          })),
          ...(isWaiterMode ? { source: "waiter" } : {}),
        }),
      });

      setCart([]);
      setComandaNumber("");
      setShowComandaModal(false);
      onOrderCreated?.();

      if (createdOrder?.id) {
        if (printingConfig.autoPrintOnOrderCreate) {
          globalAutoPrintedOrderIds.add(createdOrder.id);
          printOrderAuto(createdOrder);
        }
        handleLoadComanda(createdOrder);
        setActiveTab("products");
      } else {
        toast.success("Comanda criada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar comanda.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Lança o pedido em uma mesa/comanda já aberta, sem cobrar — usado pelo modo garçom
  // e pelo botão "Lançar" quando a mesa/comanda já está selecionada.
  const handleLaunchOrder = async () => {
    if (cart.length === 0 || (!selectedTableId && !selectedComandaId)) return;
    setIsProcessing(true);
    try {
      const launchedOrder = await apiJson<Order>(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify({
          // Sempre pega uma senha NOVA (fila) — nunca reaproveita a da comanda anterior,
          // senão atropela quem já pediu depois. Só herda o nome do cliente, se tinha um.
          customerName: customerName || selectedComandaOrder?.customerName || undefined,
          customerPhone: customerPhone || "00000000000",
          orderType: "DINE_IN",
          consumptionType: !selectedTableId ? consumptionType : undefined,
          tableId: selectedTableId || undefined,
          counterTicketNumber: selectedComandaOrder?.counterTicketNumber || undefined,
          status: "PENDING",
          paymentMethod: "CASH",
          operatorName: operatorName || undefined,
          items: cart.map((item) => ({ productId: item.product.id, productVariantId: item.productVariantId, quantity: item.quantity, price: item.price, notes: item.notes || undefined })),
          ...(isWaiterMode ? { source: "waiter" } : {}),
        }),
      });
      if (printingConfig.autoPrintOnOrderCreate && launchedOrder?.id) {
        globalAutoPrintedOrderIds.add(launchedOrder.id);
        printOrderAuto(launchedOrder);
      }
      setCart([]);
      setDiscountValue("");
      setAmountReceived("");
      setPaymentSplits([]);
      setIsSplitMode(false);
      setGroupSplitCount("2");
      onOrderCreated?.();
      setContextLoadMessage(`${currentContextLabel || "Comanda"} atualizada. Os novos itens já foram lançados.`);
      toast.success("Itens adicionados à comanda.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao lançar itens.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    // Sem essa trava, um F2/Enter repetido ou duplo clique em "Finalizar" antes da
    // primeira chamada terminar disparava uma segunda venda inteira (e um segundo
    // recibo impresso) — isProcessing era setado mas nunca checado aqui no início.
    if (isProcessing) return;
    if (checkoutItems.length === 0 || (cashRequired && !currentCash)) return;
    if (isSplitMode && !splitCanFinalize) return;
    if (!isSplitMode && paymentMethod === "CASH" && digitsToNumber(amountReceived) < finalTotal) return;
    if (isCounterSale && !consumptionType) {
      toast.error("Selecione se é para comer no local ou para viagem.");
      return;
    }
    setIsProcessing(true);

    const isStone = paymentMethod === "STONE";
    const useSplit = isSplitMode && paymentSplits.length > 0;

    // Se o carrinho está vazio (só tem itens já lançados) e tem mesa/comanda selecionada,
    // apenas faturamos o contexto atual sem criar um novo pedido (mantendo na cozinha se for o caso).
    const isPayingExistingContext = cart.length === 0 && (selectedTableId || selectedComandaId);

    if (isPayingExistingContext && !isStone) {
      try {
        const billResult = await apiJson<{ orders?: any[] }>(`/api/tenants/${tenant.slug}/pdv/bill-context`, {
          method: "POST",
          body: JSON.stringify({
            tableId: selectedTableId || undefined,
            counterTicketNumber: selectedComandaBaseOrder?.counterTicketNumber || undefined,
            paymentMethod: useSplit ? "SPLIT" : paymentMethod,
            paymentMetadata: useSplit
              ? { splits: normalizedPaymentSplits.map(({ id, ...s }) => s) }
              : {
                  amountReceived: paymentMethod === "CASH" ? digitsToNumber(amountReceived) : finalTotal,
                  change,
                  cardBrand: normalizedCardBrand,
                  installments: paymentMethod === "CREDIT" ? installments : 1,
                },
            operatorName,
            cardBrand: normalizedCardBrand,
            installments: paymentMethod === "CREDIT" ? installments : 1,
          }),
        });

        // Sem isso, o botão "Imprimir" da tela de sucesso ficava sem pedido pra imprimir
        // (lastOrderRef nunca era preenchido nesse fluxo de fechar mesa/comanda existente,
        // só no de venda nova) — clicar nele não fazia nada, silenciosamente.
        lastOrderRef.current = billResult?.orders?.[0] ?? null;

        // Limpa a seleção visual (não chama onClearComanda para não dar MERGED e apagar da cozinha)
        if (selectedTableId) setSelectedTableId(null);
        if (selectedComandaId) setSelectedComandaId(null);
        
        clearCart();
        setShowCheckout(false);
        setShowSuccess(true);
        // Com fiscal habilitado, deixa o aviso aberto até fechar manualmente — 3s não dá
        // tempo de digitar/conferir o CPF-CNPJ e emitir a NFC-e antes de sumir sozinho.
        if (!fiscalEnabled) setTimeout(() => setShowSuccess(false), 3000);
        if (fiscalEnabled && requestNfce) void handleEmitNfce();
        onOrderCreated?.();
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Erro ao faturar contexto.");
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const orderData = {
      customerName: customerName || currentContextLabel || "Venda PDV",
      customerPhone: customerPhone || "00000000000",
      customerCpf: [11, 14].includes(customerCpf.replace(/\D/g, "").length) ? customerCpf.replace(/\D/g, "") : undefined,
      orderType: selectedTableId || selectedComandaId ? "DINE_IN" : "TAKEAWAY",
      tableId: selectedTableId || undefined,
      consumptionType: isCounterSale ? consumptionType : undefined,
      paymentMethod: useSplit ? "SPLIT" : isStone ? `STONE_${stonePaymentType.toUpperCase()}` : paymentMethod,
      paymentMetadata: useSplit
        ? { splits: normalizedPaymentSplits.map(({ id, ...s }) => s) }
        : {
            amountReceived: paymentMethod === "CASH" ? digitsToNumber(amountReceived) : finalTotal,
            change,
            cardBrand: normalizedCardBrand,
            installments: paymentMethod === "CREDIT" ? installments : 1,
          },
      discount: discountValue ? parseFloat(discountValue) : 0,
      discountType,
      cardBrand: normalizedCardBrand,
      installments: paymentMethod === "CREDIT" ? installments : 1,
      serviceChargeIncluded: serviceChargeChecked && !!serviceChargeConfig?.enabled,
      // Stone orders start as PENDING until terminal confirms
      status: isStone ? "PENDING" : undefined,
      items: checkoutItems.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
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
      if (printingConfig.autoPrintOnOrderCreate && (order as any).id) {
        globalAutoPrintedOrderIds.add((order as any).id);
        printOrderAuto(order);
      }

      if (isStone) {
        setIsProcessing(false);
        await handleStonePay(order.id);
        return;
      }

      if (selectedTableId && onClearTable) await onClearTable(selectedTableId);
      if (selectedComandaId && onClearComanda) {
        for (const order of currentContextOrders) {
          await onClearComanda(order.id);
        }
      }

      clearCart();
      setShowCheckout(false);
      setShowSuccess(true);
      if (!fiscalEnabled) setTimeout(() => setShowSuccess(false), 3000);
      if (fiscalEnabled && requestNfce) void handleEmitNfce();
      onOrderCreated?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar venda.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateOpenOrderItemQuantity = async (orderId: string, orderItemId: string, nextQuantity: number, hadLoss: boolean) => {
    setDetailActionId(orderItemId);
    try {
      await apiJson(`/api/tenants/${tenant.slug}/pdv/orders/${orderId}/items/${orderItemId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: nextQuantity, hadLoss }),
      });
      if (nextQuantity === 0) toast.success(hadLoss ? "Item cancelado (baixa no estoque como perda)." : "Item cancelado e devolvido ao estoque.");
      else toast.success("Quantidade atualizada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar item.");
    } finally {
      setDetailActionId(null);
    }
  };

  const handleCancelOpenOrder = async (orderId: string, hadLoss: boolean) => {
    setDetailActionId(`cancel-${orderId}`);
    try {
      await apiJson(`/api/tenants/${tenant.slug}/pdv/orders/${orderId}/cancel-open`, {
        method: "POST",
        body: JSON.stringify({ hadLoss }),
      });
      if (selectedComandaId === orderId) {
        setSelectedComandaId(null);
        setContextLoadMessage("");
      }
      setOrderDetailsView((current) => current && current.type === "comanda" && current.comanda.id === orderId ? null : current);
      toast.success(hadLoss ? "Pedido cancelado (estoque baixado como perda)." : "Pedido cancelado e estoque devolvido.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao cancelar pedido.");
    } finally {
      setDetailActionId(null);
    }
  };

  // Antes de cancelar item/pedido já lançado, pergunta se houve perda (item já
  // preparado/desperdiçado) — se sim, a baixa de estoque original fica valendo como
  // perda; se não, devolve ao estoque normalmente. Ver handleUpdateOpenOrderItemQuantity
  // e handleCancelOpenOrder (parâmetro hadLoss).
  const [pendingLossConfirm, setPendingLossConfirm] = useState<
    | { kind: "item"; orderId: string; itemId: string; nextQuantity: number; label: string }
    | { kind: "order"; orderId: string }
    | null
  >(null);

  const resolveLossConfirm = (hadLoss: boolean) => {
    if (!pendingLossConfirm) return;
    if (pendingLossConfirm.kind === "item") {
      void handleUpdateOpenOrderItemQuantity(pendingLossConfirm.orderId, pendingLossConfirm.itemId, pendingLossConfirm.nextQuantity, hadLoss);
    } else {
      void handleCancelOpenOrder(pendingLossConfirm.orderId, hadLoss);
    }
    setPendingLossConfirm(null);
  };

  useEffect(() => {
    handleCheckoutRef.current = () => {
      if (isProcessing) return;
      if (isSplitMode && !splitCanFinalize) return;
      if (!isSplitMode && paymentMethod === "CASH" && digitsToNumber(amountReceived) < finalTotal) return;
      void handleCheckout();
    };
  }, [handleCheckout, isProcessing, isSplitMode, splitCanFinalize, paymentMethod, amountReceived, finalTotal]);

  const handleStonePay = async (pendingOrderId: string) => {
    setStoneStatus("sending");
    try {
      const result = await apiJson(`/api/tenants/${tenant.slug}/stone/charge`, {
        method: "POST",
        body: JSON.stringify({ orderId: pendingOrderId, amount: finalTotal, paymentType: stonePaymentType }),
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
              if (!fiscalEnabled) setTimeout(() => setShowSuccess(false), 3000);
              if (fiscalEnabled && requestNfce) void handleEmitNfce();
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

  // Nome do item pro recibo — inclui a variação escolhida (ex: "Pizza (G)") quando houver,
  // senão o pedido impresso não mostra qual tamanho/opção foi vendido.
  const itemDisplayName = (i: any) => {
    const base = i.product?.name || "";
    const variantName = i.productVariant?.name;
    return variantName ? `${base} (${variantName})` : base;
  };

  const buildReceiptDataFromOrder = (order: any, copyLabel?: "CLIENTE" | "ESTABELECIMENTO") => {
    if (!order) return null;
    const items = (order.items || []).map((i: any) => ({
      quantity: i.quantity,
      name: itemDisplayName(i),
      price: i.price,
      notes: i.notes || undefined,
    }));
    const orderSubtotal = items.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
    let paymentDetail: { amountReceived?: number; change?: number; splits?: Array<{ method: string; amount: number; cardBrand?: string; installments?: number }> } = {};
    try { paymentDetail = order.paymentDetail ? JSON.parse(order.paymentDetail) : {}; } catch {}

    const isNumericName = order.customerName && /^\d+$/.test(order.customerName);

    return {
      tenantName: tenant.name,
      tenantAddress: tenant.address || undefined,
      tenantCnpj,
      tenantPhone: tenant.whatsapp || undefined,
      orderId: order.id,
      tableId: order.tableId,
      counterTicketNumber: order.counterTicketNumber != null ? order.counterTicketNumber : (isNumericName && !order.tableId ? Number(order.customerName) : null),
      consumptionType: order.consumptionType || undefined,
      paperWidthMm: (tenant.receiptPaperWidth === 58 ? 58 : 80) as 58 | 80,
      createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
      customerName: (!isNumericName || order.tableId) ? order.customerName : undefined,
      // Comanda recém-aberta/lançamento na cozinha ainda não foi paga — o campo
      // paymentMethod nesse caso é só o valor padrão do banco ("CASH"), não uma forma
      // de pagamento de verdade. Sem isso, a notinha mostrava "Pagamento: Dinheiro"
      // pra pedido que ninguém cobrou ainda. Só mostra quando billed=true (faturado)
      // ou status DELIVERED (venda instantânea, paga na hora).
      isPreCheckout: !(order.billed === true || order.status === "DELIVERED"),
      copyLabel,
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

  const buildReceiptData = () => buildReceiptDataFromOrder(lastOrderRef.current);

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
    if (checkoutItems.length === 0) return;
    const receiptCustomerName = customerName || currentContextLabel || "";
    const isNumericName = receiptCustomerName && /^\d+$/.test(receiptCustomerName);
    const data = {
      tenantName: tenant.name,
      tenantAddress: tenant.address || undefined,
      tenantCnpj,
      tenantPhone: tenant.whatsapp || undefined,
      isPreCheckout: true,
      tableId: selectedTableId || undefined,
      counterTicketNumber: (isNumericName && !selectedTableId) ? Number(receiptCustomerName) : null,
      consumptionType: isCounterSale ? consumptionType || undefined : undefined,
      customerName: (!isNumericName || selectedTableId) ? receiptCustomerName : undefined,
      items: [...existingContextItems, ...cart.map((item) => ({
        quantity: item.quantity,
        product: item.product,
        price: item.price,
        notes: item.notes,
      }))].map((item) => ({
        quantity: item.quantity,
        name: item.product?.name || "",
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

  const cartItemCount = existingContextItemCount + pendingCartItemCount;

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
                {fiscalEnabled && (
                  <button
                    onClick={() => setShowSuccess(false)}
                    title="Fechar"
                    className="flex items-center justify-center w-7 h-7 bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
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
              <div className="bg-green-600 text-white px-5 py-2.5 rounded-xl shadow-xl flex flex-wrap items-center justify-center gap-2 text-xs font-black">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {nfceMessage}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownloadDanfe}
                    className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar DANFE
                  </button>
                  <button
                    onClick={handlePrintDanfe}
                    className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir DANFE
                  </button>
                </div>
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-[#C9A227] focus:bg-white outline-none transition-all"
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
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-9 text-sm font-bold text-slate-700 focus:border-[#C9A227] focus:bg-white outline-none transition-all cursor-pointer"
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

            {currentContextLabel && (
              <div className="mx-3 mt-3 rounded-2xl border border-[#C9A227]/30 bg-amber-50 px-4 py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Editando no PDV</p>
                  <p className="text-sm font-black text-slate-800">{currentContextLabel}</p>
                  <p className="text-[11px] text-slate-500">
                    {contextLoadMessage || "Itens já lançados ficam separados dos novos itens para não duplicar a comanda."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                  <span className="rounded-full bg-white px-3 py-1 border border-amber-200">
                    Já lançado: {existingContextItemCount} {existingContextItemCount === 1 ? "item" : "itens"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 border border-slate-200">
                    Novo agora: {pendingCartItemCount} {pendingCartItemCount === 1 ? "item" : "itens"}
                  </span>
                </div>
              </div>
            )}

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
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" } as React.CSSProperties}
                >
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className={`group rounded-xl overflow-hidden transition-all duration-200 relative flex items-center gap-3 p-2 ${
                          inCart
                            ? "ring-2 ring-[#C9A227] shadow-md shadow-[#C9A227]/15 bg-white"
                            : "ring-1 ring-slate-200 bg-white hover:ring-[#C9A227]/50 hover:shadow-md"
                        }`}
                      >
                        <button
                          className="absolute inset-0 w-full h-full cursor-pointer text-left focus:outline-none"
                          onClick={() => {
                            if (hasProductCustomizations(product)) {
                              openProductOptions(product);
                            } else {
                              addToCart(product);
                            }
                          }}
                        />

                        {/* Image */}
                        <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0 pointer-events-none">
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
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center pointer-events-none">
                          <h4 className="text-[13px] font-bold text-slate-800 line-clamp-2 leading-snug">{product.name}</h4>
                          <span className="text-[14px] font-black text-[#0D1B3E] leading-none mt-1">{fmt(product.price)}</span>
                        </div>

                        {/* Right Actions */}
                        <div className="flex flex-col items-center gap-1 shrink-0 relative z-10 px-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openProductOptions(product);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-[#0D1B3E] hover:text-white hover:border-[#0D1B3E] transition-colors"
                            title="Opções e Observações"
                          >
                            <MessageSquarePlus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
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
            if (o.status === "DELIVERED" || o.status === "CANCELLED" || o.status === "MERGED") return;
            if (o.billed) return;
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
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
                  >
                  {activeTables.map((tbl) => (
                    <button
                      key={tbl.tableId}
                      onClick={() => setOrderDetailsView({ type: "table", tableId: tbl.tableId })}
                      className={`relative bg-white p-4 rounded-2xl border-2 hover:shadow-md transition-all text-left flex items-center gap-3 group ${tbl.wantsCheckout ? 'border-red-300 hover:border-red-500' : 'border-slate-100 hover:border-[#C9A227]'}`}
                    >
                      {tbl.wantsCheckout && (
                        <span className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-sm animate-pulse">
                          Pediu Conta
                        </span>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 transition-colors leading-none ${tbl.wantsCheckout ? 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-[#C9A227] group-hover:text-white'}`}>
                        <Utensils className="w-4 h-4 mb-0.5" />
                        <span className="text-[9px] font-black">{tbl.tableId}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-slate-800 truncate">Mesa {tbl.tableId}</h4>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{tbl.customerName || `${tbl.orderCount} ${tbl.orderCount === 1 ? "pedido" : "pedidos"}`}</p>
                        <p className="text-sm font-black text-[#C9A227] mt-0.5">{fmt(tbl.total)}</p>
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
                onClick={() => { setComandaNumber(""); setConsumptionType("EAT_IN"); setShowComandaModal(true); }}
                className="bg-[#0D1B3E] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Plus className="w-3 h-3" />
                Nova Comanda
              </button>
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
            >
              {activeComandas.map((comanda) => (
                  <button
                    key={comanda.id}
                    onClick={() => setOrderDetailsView({ type: "comanda", comanda })}
                    className="bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-[#C9A227] hover:shadow-md transition-all text-left flex items-center gap-3 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#C9A227]/10 text-[#C9A227] group-hover:bg-[#C9A227] group-hover:text-white flex flex-col items-center justify-center shrink-0 leading-none transition-colors">
                      {comanda.counterTicketNumber != null ? (
                        <>
                          <span className="text-[8px] font-black uppercase tracking-widest opacity-70">Senha</span>
                          <span className="text-base font-black tabular-nums">{String(comanda.counterTicketNumber).padStart(2, "0")}</span>
                        </>
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-800 truncate">
                        {comanda.customerName || dineInOrderLabel(comanda)}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400">
                        {comanda.items.length} {comanda.items.length === 1 ? "item" : "itens"}
                      </p>
                      <p className="text-sm font-black text-[#C9A227] mt-0.5">{fmt(comanda.total)}</p>
                    </div>
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
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
            >
              {pendingDeliveryOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => { setBillingOrder(order); setBillingPaymentMethod("CASH"); }}
                  className="bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-[#C9A227] hover:shadow-md transition-all text-left flex items-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-black text-slate-800 truncate">{order.customerName}</h4>
                    <p className="text-[10px] font-bold text-slate-400">
                      {order.items.length} {order.items.length === 1 ? "item" : "itens"} · Entregue
                    </p>
                    <p className="text-sm font-black text-[#C9A227] mt-0.5">{fmt(order.total)}</p>
                  </div>
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
                  {currentContextLabel || "Novo Pedido"}
                </h3>
                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                  {selectedTableId
                    ? "Mesa aberta em edição"
                    : selectedComandaId
                    ? "Comanda aberta em edição"
                    : "Venda rápida balcão"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {cartItemCount > 0 && (
                <span className="bg-[#C9A227] text-black text-[10px] font-black rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
              {(selectedTableId || selectedComandaId || cart.length > 0) && (
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
                placeholder="CPF ou CNPJ na nota (opcional)"
                value={customerCpf}
                maxLength={18}
                onChange={(e) => setCustomerCpf(maskCpfCnpj(e.target.value))}
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
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                    className={`w-full bg-white/5 border rounded-lg py-1.5 px-2.5 text-[11px] text-white placeholder-white/20 focus:outline-none transition-colors ${
                      customerPhone && !isPhoneComplete(customerPhone)
                        ? "border-red-500/50 focus:border-red-500"
                        : "border-white/10 focus:border-[#C9A227]"
                    }`}
                  />
                  {customerPhone && !isPhoneComplete(customerPhone) && (
                    <p className="text-[9px] text-red-400 mt-0.5 ml-1">Telefone incompleto</p>
                  )}
                </div>
                <button
                  onClick={() => setCustomerSearchOpen(false)}
                  disabled={!!customerPhone && !isPhoneComplete(customerPhone)}
                  className="col-span-2 mt-0.5 bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors"
                >
                  {customerName || customerPhone ? "Usar estes dados" : "Fechar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {existingContextItems.length === 0 && cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white flex items-center justify-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">Carrinho Vazio</p>
            </div>
          ) : (
            <>
              {existingContextItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Já lançado na conta</p>
                    <span className="text-[10px] font-black text-[#C9A227]">{fmt(existingContextSubtotal)}</span>
                  </div>
                  {existingContextItems.map((item) => (
                    <div key={item.id} className="bg-white/[0.04] border border-white/5 rounded-xl p-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold truncate">{item.product?.name}</h4>
                        <p className="text-[10px] font-bold text-white/40">{item.quantity}x {fmt(item.price)} un.</p>
                        {item.notes && <p className="text-[10px] text-white/30 mt-0.5">{item.notes}</p>}
                      </div>
                      <span className="text-xs font-black tabular-nums text-white/70 w-16 text-right shrink-0">
                        {fmt(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Novos itens desta edição</p>
                    <span className="text-[10px] font-black text-emerald-400">{fmt(cart.reduce((acc, item) => acc + item.price * item.quantity, 0))}</span>
                  </div>
                  {cart.map((item, itemIndex) => (
                    <div key={`${item.product.id}-${itemIndex}`} className="bg-white/[0.04] border border-white/5 rounded-xl p-2.5 flex items-center gap-3 hover:border-white/10 transition-colors">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold truncate">
                          {item.product.name}
                          {item.productVariantId && item.product.variants ? (() => {
                            const v = item.product.variants.find(v => v.id === item.productVariantId);
                            return v ? ` (${v.name})` : "";
                          })() : ""}
                        </h4>
                        <p className="text-[10px] font-bold text-white/40">{fmt(item.price)} un.</p>
                        {item.notes && <p className="text-[10px] text-white/30 truncate mt-0.5">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 bg-black/20 rounded-lg px-0.5 py-0.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(itemIndex, -1); }}
                          className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 hover:text-[#C9A227] transition-colors touch-manipulation"
                        >
                          <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                        <span className="text-xs font-black w-5 text-center tabular-nums">{item.quantity}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(itemIndex, 1); }}
                          className="w-8 h-8 sm:w-5 sm:h-5 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 hover:text-[#C9A227] transition-colors touch-manipulation"
                        >
                          <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                      </div>
                      <span className="text-xs font-black tabular-nums text-[#C9A227] w-16 text-right shrink-0">
                        {fmt(item.price * item.quantity)}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductOptions(item.product, itemIndex);
                          }}
                          className="p-1 text-white/20 hover:text-[#C9A227] transition-colors"
                          title="Editar Observações/Variações"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeFromCart(itemIndex)} className="p-1 text-white/20 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
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
                  else { setConsumptionType("EAT_IN"); setShowComandaModal(true); }
                }}
                className={`${isWaiterMode ? "bg-[#C9A227] hover:bg-[#E8B93A] text-black shadow-xl shadow-[#C9A227]/20" : "bg-white/5 hover:bg-white/10 text-white"} disabled:opacity-30 font-black py-3 rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]`}
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {selectedTableId || selectedComandaId ? "Adicionar Itens" : "Lançar Pedido"}
                    <Package className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
            {!isWaiterMode && (
              <button
                disabled={checkoutItems.length === 0 || (cashRequired && !currentCash)}
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
                {(selectedTableId || selectedComandaId || cart.length > 0) && (
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
            ? orders.filter((o) => o.tableId === orderDetailsView.tableId && o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "MERGED" && !o.billed)
            : orders.filter((o) =>
                (
                  (orderDetailsView.comanda.counterTicketNumber != null && o.counterTicketNumber === orderDetailsView.comanda.counterTicketNumber) ||
                  o.id === orderDetailsView.comanda.id
                ) &&
                o.status !== "CANCELLED" &&
                o.status !== "DELIVERED" &&
                o.status !== "MERGED" &&
                !o.billed
              );
          const detailSubtotal = relatedOrders.reduce((acc, order) => acc + order.total, 0);

          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Detalhes</p>
                    <h3 className="text-base font-black text-slate-800 truncate">{title}</h3>
                  </div>
                  <button
                    onClick={() => setOrderDetailsView(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
                  {relatedOrders.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-10">Nenhum item lançado ainda.</p>
                  ) : (
                    relatedOrders.map((order, idx) => (
                      <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Pedido {idx + 1} · #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <button
                            onClick={() => setPendingLossConfirm({ kind: "order", orderId: order.id })}
                            disabled={detailActionId === `cancel-${order.id}`}
                            className="shrink-0 rounded-lg border border-red-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                          >
                            {detailActionId === `cancel-${order.id}` ? "Cancelando..." : "Cancelar"}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {order.items.filter((item) => item.product).map((item) => (
                            <div key={item.id} className="rounded-lg bg-white px-2.5 py-2 border border-slate-200">
                              <div className="flex items-start justify-between gap-2">
                                <div className="pr-2 min-w-0">
                                  <span className="text-xs font-bold text-slate-700">
                                    {item.quantity}x {item.product?.name}
                                    {item.productVariant?.name ? ` (${item.productVariant.name})` : ""}
                                  </span>
                                  {item.notes && <p className="text-[10px] italic text-slate-400 mt-0.5">{item.notes}</p>}
                                </div>
                                <span className="text-xs font-black text-slate-800 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                              </div>

                              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                                {item.quantity > 1 && (
                                  <button
                                    onClick={() => setPendingLossConfirm({ kind: "item", orderId: order.id, itemId: item.id, nextQuantity: item.quantity - 1, label: `${item.product?.name}` })}
                                    disabled={detailActionId === item.id}
                                    className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    -1
                                  </button>
                                )}
                                <button
                                  onClick={() => setPendingLossConfirm({ kind: "item", orderId: order.id, itemId: item.id, nextQuantity: 0, label: `${item.quantity}x ${item.product?.name}` })}
                                  disabled={detailActionId === item.id}
                                  className="rounded-md border border-red-200 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                                >
                                  {detailActionId === item.id ? "Salvando..." : "Cancelar"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 pt-3 border-t border-slate-100 bg-slate-50 space-y-3 shrink-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total</span>
                    <span className="text-xl font-black text-slate-800">{fmt(detailSubtotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => isTable ? handleLoadTable(orderDetailsView.tableId) : handleLoadComanda(orderDetailsView.comanda)}
                      className="bg-white border border-slate-200 hover:border-[#C9A227] text-slate-700 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Abrir no PDV
                    </button>
                    {!isWaiterMode && (
                      <button
                        disabled={relatedOrders.length === 0}
                        onClick={() => handleGoToCheckoutFromDetails(orderDetailsView)}
                        className="bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
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

      {/* ── Confirmação de perda ao cancelar item/pedido lançado ── */}
      <AnimatePresence>
        {pendingLossConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setPendingLossConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl"
            >
              <div className="space-y-1.5 text-center">
                <h3 className="text-base font-black text-slate-800">
                  {pendingLossConfirm.kind === "item" ? `Cancelar "${pendingLossConfirm.label}"?` : "Cancelar este pedido?"}
                </h3>
                <p className="text-xs text-slate-500">
                  Houve gasto/perda no preparo (item já feito, não pode ser reaproveitado)?
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => resolveLossConfirm(true)}
                  className="w-full rounded-xl border border-red-200 bg-red-50 text-red-600 font-black py-3 text-xs uppercase tracking-widest hover:bg-red-100 transition-colors"
                >
                  Sim, houve perda — descontar do estoque
                </button>
                <button
                  onClick={() => resolveLossConfirm(false)}
                  className="w-full rounded-xl border border-slate-200 bg-white text-slate-600 font-black py-3 text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                >
                  Não, devolver ao estoque
                </button>
                <button
                  onClick={() => setPendingLossConfirm(null)}
                  className="w-full text-slate-400 font-bold py-2 text-[11px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Voltar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Comanda Modal ── */}
      <AnimatePresence>
        {showComandaModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => { setShowComandaModal(false); setComandaNumber(""); setConsumptionType("EAT_IN"); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center mx-auto mb-4">
                  <Hash className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">Abrir Comanda</h3>
                <p className="text-xs text-slate-400 font-bold uppercase">Identifique o cliente ou o cartão</p>
              </div>
              <div className="space-y-4">
                {/* Comer no local ou viagem — obrigatório pra toda comanda de balcão (sem mesa) */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                    Comer no local ou viagem?
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setConsumptionType("EAT_IN")}
                      className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                        consumptionType === "EAT_IN"
                          ? "bg-[#C9A227] border-[#C9A227] text-black"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <Utensils className="w-3.5 h-3.5" />
                      Comer no local
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsumptionType("TAKEOUT")}
                      className={`flex items-center justify-center gap-1.5 py-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                        consumptionType === "TAKEOUT"
                          ? "bg-[#C9A227] border-[#C9A227] text-black"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      Viagem
                    </button>
                  </div>
                </div>

                {/* Próxima senha em destaque — some se a loja desativou a senha sequencial
                    do Balcão em Configurações (Senha do Balcão: Nome do cliente). */}
                {tenant.counterTicketMode !== "NAME" && (
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Próxima senha</p>
                    <div className="mx-auto w-28 h-28 rounded-[2rem] border-2 border-[#C9A227]/30 bg-[#C9A227]/5 flex flex-col items-center justify-center gap-0.5 shadow-lg">
                      <span className="text-[9px] font-black text-[#C9A227]/60 uppercase tracking-[0.3em]">Nº</span>
                      {nextTicketLoading ? (
                        <div className="w-5 h-5 border-2 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="text-5xl font-black text-[#C9A227] tracking-tighter tabular-nums">
                          {nextTicket ?? "—"}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2">Gerada automaticamente pelo sistema</p>
                  </div>
                )}

                {/* Identificação opcional */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">
                    Nome / Identificação <span className="normal-case font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={comandaNumber}
                    onChange={(e) => setComandaNumber(e.target.value)}
                    placeholder="Ex: João ou Mesa VIP"
                    className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-5 text-base font-bold text-slate-800 focus:border-[#C9A227] outline-none text-center"
                  />
                  <p className="text-[9px] text-slate-400 mt-1 text-center">
                    {tenant.counterTicketMode === "NAME" ? "Deixe em branco se não quiser identificar o pedido" : "Deixe em branco para usar só a senha numérica"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setShowComandaModal(false); setComandaNumber(""); setConsumptionType("EAT_IN"); }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={isProcessing || (tenant.counterTicketMode !== "NAME" && nextTicketLoading) || !consumptionType}
                  onClick={() => void handleCreateComanda()}
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
                <div className="max-h-32 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 space-y-1">
                  {billingOrder.items.filter((item) => item.product).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                      <span className="font-bold text-slate-600 truncate">{item.quantity}x {item.product?.name}</span>
                      <span className="font-black text-slate-700 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
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

      {/* ── Tela de Pagamento — tela cheia, não modal flutuante, pra ter espaço de sobra
          pros controles (Cancelar, Finalizar, Voltar, Adicionar mais itens) ── */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0D1B3E] flex flex-col"
          >
              {/* Header — título e botão cancelar sempre visíveis, fora da área de conteúdo,
                  pra nunca competir por espaço com "Dividir Pagamento" ou outros controles. */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 shrink-0">
                <span className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em]">Pagamento</span>
              </div>

              <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left: Summary */}
              <div className="w-full md:w-80 lg:w-96 bg-black/20 p-4 flex flex-col border-r border-white/5 overflow-y-auto custom-scrollbar shrink-0">
                <button
                  onClick={() => {
                    // isClosingAccount fica true quando o pagamento foi aberto direto do
                    // "Fechar Conta" numa comanda (handleGoToCheckoutFromDetails) e nunca era
                    // resetado ao voltar — o botão "Adicionar Itens" do carrinho fica escondido
                    // pra sempre (só "Pagar"), mesmo a comanda ainda podendo receber mais itens.
                    setIsClosingAccount(false);
                    setShowCheckout(false);
                    setShowCartDrawer(true);
                  }}
                  className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-3 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Voltar ao Carrinho</span>
                </button>

                <button
                  onClick={() => setShowAddItemsPanel((v) => !v)}
                  className={`flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-xl border text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors mb-3 ${
                    showAddItemsPanel
                      ? "bg-[#C9A227] border-[#C9A227] text-black"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddItemsPanel ? "Fechar produtos" : "Adicionar mais itens"}
                </button>

                <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1">Resumo</p>
                <h3 className="text-base font-black text-white mb-3 truncate">
                  {currentContextLabel || customerName || "Venda Balcão"}
                </h3>

                {isCounterSale && (
                  <div className="mb-3">
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em] mb-1.5">
                      Comer no local ou viagem?
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setConsumptionType("EAT_IN")}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                          consumptionType === "EAT_IN"
                            ? "bg-[#C9A227] border-[#C9A227] text-black"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <Utensils className="w-3.5 h-3.5" />
                        Comer no local
                      </button>
                      <button
                        onClick={() => setConsumptionType("TAKEOUT")}
                        className={`flex items-center justify-center gap-1.5 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                          consumptionType === "TAKEOUT"
                            ? "bg-[#C9A227] border-[#C9A227] text-black"
                            : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        <Package className="w-3.5 h-3.5" />
                        Viagem
                      </button>
                    </div>
                  </div>
                )}

                {/* Cliente / CPF-CNPJ na nota — mesmo estado usado no carrinho, só que
                    acessível aqui também, pra não precisar voltar pra vincular ou
                    corrigir o documento antes de finalizar e emitir a NF. */}
                <div className="relative mb-3 space-y-1.5">
                  {linkedCustomer ? (
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2">
                      <div className="w-6 h-6 rounded-full bg-[#C9A227]/20 text-[#C9A227] flex items-center justify-center shrink-0 text-[10px] font-black uppercase">
                        {linkedCustomer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{linkedCustomer.name}</p>
                        <p className="text-[9px] text-white/40 truncate">{linkedCustomer.phone}</p>
                      </div>
                      <button
                        onClick={handleClearLinkedCustomer}
                        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                        title="Remover cliente"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCustomerSearchOpen(true)}
                      className="w-full flex items-center gap-2 bg-white/5 border border-white/10 hover:border-[#C9A227]/50 rounded-lg px-2.5 py-2 transition-colors text-left"
                    >
                      <User className="w-3 h-3 text-white/40 shrink-0" />
                      <span className="text-[11px] font-bold text-white/50 flex-1">Cliente (opcional)</span>
                      <ChevronRight className="w-3 h-3 text-white/30" />
                    </button>
                  )}
                  {fiscalEnabled && (
                    <div className="relative">
                      <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30" />
                      <input
                        type="text"
                        placeholder="CPF ou CNPJ na nota (opcional)"
                        value={customerCpf}
                        maxLength={18}
                        onChange={(e) => setCustomerCpf(maskCpfCnpj(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-7 pr-2.5 text-[11px] text-white placeholder-white/20 focus:border-[#C9A227] outline-none"
                      />
                    </div>
                  )}
                  {/* A NFC-e só sai se o atendente marcar isso aqui, no fechamento do
                      pagamento — emitir sozinho pra toda venda não é o esperado. */}
                  {fiscalEnabled && (
                    <label className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 cursor-pointer hover:border-[#C9A227]/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={requestNfce}
                        onChange={(e) => setRequestNfce(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-[#C9A227] shrink-0"
                      />
                      <span className="text-[11px] font-bold text-white/70">Cliente pediu Nota Fiscal (NFC-e)</span>
                    </label>
                  )}

                  {/* Popover de busca/cadastro de cliente — cópia do que já existe no
                      carrinho, pois aquele fica escondido atrás desta tela em tela cheia. */}
                  {customerSearchOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#111d3d] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
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
                        <div className="relative">
                          <input
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                            className={`w-full bg-white/5 border rounded-lg py-1.5 px-2.5 text-[11px] text-white placeholder-white/20 focus:outline-none transition-colors ${
                              customerPhone && !isPhoneComplete(customerPhone)
                                ? "border-red-500/50 focus:border-red-500"
                                : "border-white/10 focus:border-[#C9A227]"
                            }`}
                          />
                          {customerPhone && !isPhoneComplete(customerPhone) && (
                            <p className="text-[9px] text-red-400 mt-0.5 ml-1">Telefone incompleto</p>
                          )}
                        </div>
                        <button
                          onClick={() => setCustomerSearchOpen(false)}
                          disabled={!!customerPhone && !isPhoneComplete(customerPhone)}
                          className="col-span-2 mt-0.5 bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-40 disabled:cursor-not-allowed text-black text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors"
                        >
                          {customerName || customerPhone ? "Usar estes dados" : "Fechar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {billableLines.map((line) => (
                    <div key={line.lineKey} className="border-b border-white/5 pb-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/70 truncate mr-2">
                          {line.quantity}x {line.name}
                          {line.notes && <span className="text-[10px] italic text-white/30 block">{line.notes}</span>}
                        </span>
                        <span className="font-black text-white whitespace-nowrap">{fmt(line.total)}</span>
                      </div>
                      {isSplitMode && splitByItem && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {splitPersonLabels.map((label, personIdx) => {
                            const active = itemPersonAssignment[line.lineKey] === personIdx;
                            return (
                              <button
                                key={personIdx}
                                type="button"
                                onClick={() => handleAssignItemToPerson(line.lineKey, personIdx)}
                                className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border transition-colors ${
                                  active
                                    ? "bg-[#C9A227] border-[#C9A227] text-black"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
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

              {/* Middle: Adicionar mais itens — mesma grade de produtos do PDV, embutida
                  aqui pra não precisar sair da tela de pagamento (e perder a divisão por
                  pessoa já montada) só pra lançar um item esquecido. */}
              {showAddItemsPanel && (
                <div className="w-full md:w-72 lg:w-80 bg-[#0A1425] border-r border-white/5 flex flex-col shrink-0 min-h-0">
                  <div className="p-3 border-b border-white/5 shrink-0">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar produto..."
                      className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-[12px] text-white placeholder:text-white/30 outline-none focus:border-[#C9A227]"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
                    {filteredProducts.length === 0 ? (
                      <p className="text-center text-[11px] text-white/30 py-8">Nenhum produto encontrado</p>
                    ) : (
                      filteredProducts.map((product) => {
                        const inCart = cart.find((i) => i.product.id === product.id);
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              if (hasProductCustomizations(product)) {
                                openProductOptions(product);
                              } else {
                                addToCart(product);
                              }
                            }}
                            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl border text-left transition-colors ${
                              inCart ? "bg-[#C9A227]/10 border-[#C9A227]/40" : "bg-white/5 border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <div className="w-11 h-11 bg-white/5 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} className="w-full h-full object-cover" alt={product.name} />
                              ) : (
                                <Utensils className="w-5 h-5 text-white/20" />
                              )}
                              {inCart && (
                                <div className="absolute top-0.5 left-0.5 min-w-[15px] h-[15px] px-1 bg-[#C9A227] text-black text-[9px] font-black rounded-full flex items-center justify-center shadow">
                                  {inCart.quantity}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-bold text-white truncate">{product.name}</p>
                              <p className="text-[10px] text-white/40">{fmt(product.price)}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

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
                            if (isSplitMode) {
                              setPaymentSplits([]);
                              setItemPersonAssignment({});
                            }
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
                        <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-black/20 rounded-lg">
                          <button
                            type="button"
                            onClick={() => setSplitByItem(false)}
                            className={`py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-colors ${!splitByItem ? "bg-[#C9A227] text-black" : "text-white/40 hover:text-white"}`}
                          >
                            Valor igual
                          </button>
                          <button
                            type="button"
                            onClick={() => setSplitByItem(true)}
                            className={`py-1.5 rounded-md text-[9px] font-black uppercase tracking-wide transition-colors ${splitByItem ? "bg-[#C9A227] text-black" : "text-white/40 hover:text-white"}`}
                          >
                            Por item
                          </button>
                        </div>

                        {!splitByItem ? (
                          <>
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <div>
                            <p className="text-[9px] font-black uppercase text-white/30 mb-1">Divisão por grupo</p>
                            <input
                              type="number"
                              min={2}
                              value={groupSplitCount}
                              onChange={(e) => setGroupSplitCount(e.target.value.replace(/\D/g, ""))}
                              placeholder="2"
                              className="w-full bg-black/20 border border-white/10 rounded-lg py-2 px-3 text-[11px] font-black text-white outline-none focus:border-[#C9A227]"
                            />
                          </div>
                          <button
                            onClick={handleGenerateGroupSplit}
                            className="h-[38px] px-3 rounded-lg bg-[#C9A227] text-black text-[10px] font-black uppercase tracking-wide hover:bg-[#E8B93A] transition-colors"
                          >
                            Gerar
                          </button>
                        </div>
                        <p className="text-[9px] text-white/35">
                          Se sobrar centavos, o ajuste fica na primeira pessoa.
                        </p>
                          </>
                        ) : (
                          <>
                        <div className="space-y-1.5">
                          <p className="text-[9px] font-black uppercase text-white/30">Pessoas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {splitPersonLabels.map((label, idx) => (
                              <span key={idx} className="flex items-center gap-1 bg-black/20 border border-white/10 rounded-full pl-2.5 pr-1 py-1">
                                <span className="text-[10px] font-black text-white">{label}</span>
                                {splitPersonLabels.length > 2 && (
                                  <button onClick={() => handleRemoveSplitPerson(idx)} className="text-white/30 hover:text-red-400 transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            <button
                              onClick={handleAddSplitPerson}
                              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-2.5 py-1 text-[10px] font-black text-white/60 hover:text-white transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Pessoa
                            </button>
                          </div>
                          <p className="text-[9px] text-white/35">
                            Toque nas pessoas ao lado de cada item no Resumo pra marcar de quem é. Itens sem marcação são divididos igualmente entre todos.
                          </p>
                          <button
                            onClick={handleGenerateItemSplit}
                            className="w-full h-[38px] rounded-lg bg-[#C9A227] text-black text-[10px] font-black uppercase tracking-wide hover:bg-[#E8B93A] transition-colors"
                          >
                            Gerar divisão por item
                          </button>
                        </div>
                          </>
                        )}
                        {paymentSplits.length === 0 ? (
                          <p className="text-[10px] text-white/30 text-center py-2">Gere a divisão por grupo ou escolha a forma abaixo e clique em "Adicionar Forma".</p>
                        ) : (
                          normalizedPaymentSplits.map((split) => {
                            return (
              <div key={split.id} className="flex items-start gap-2 bg-white/5 rounded-lg px-2.5 py-2">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  {split.personLabel && (
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-[10px] font-black text-[#C9A227] uppercase shrink-0">{split.personLabel}:</span>
                                      <span className="text-[10px] text-white/50 truncate">{split.personItems || "sem itens marcados"}</span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-4 gap-1">
                                    {PAYMENT_METHODS.filter((method) => method.id !== "STONE").map((method) => {
                                      const Icon = method.icon;
                                      const active = split.method === method.id;
                                      return (
                                        <button
                                          key={method.id}
                                          type="button"
                                          onClick={() => handleUpdateSplitMethod(split.id, method.id as SplitPaymentMethod)}
                                          title={method.label}
                                          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md border transition-all ${
                                            active
                                              ? "bg-[#C9A227] border-[#C9A227]"
                                              : "bg-black/20 border-white/10 hover:bg-white/10"
                                          }`}
                                        >
                                          <Icon className={`w-3 h-3 ${active ? "text-black" : "text-white/60"}`} />
                                          <span className={`text-[7px] font-black uppercase leading-none ${active ? "text-black" : "text-white/60"}`}>{method.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {getBrandsForPaymentMethod(split.method).length > 0 && (
                                    <select
                                      value={split.cardBrand || ""}
                                      onChange={(e) => handleUpdateSplitCardBrand(split.id, e.target.value)}
                                      style={{ colorScheme: "dark" }}
                                      className="w-full bg-black/20 border border-white/10 rounded-md py-1 px-2 text-[10px] font-black text-white outline-none focus:border-[#C9A227]"
                                    >
                                      <option value="">Selecione a bandeira</option>
                                      {getBrandsForPaymentMethod(split.method).map((brand) => (
                                        <option key={brand} value={brand}>{brand}</option>
                                      ))}
                                    </select>
                                  )}
                                  {split.method === "CREDIT" && (
                                    <select
                                      value={split.installments || 1}
                                      onChange={(e) => handleUpdateSplitInstallments(split.id, Number(e.target.value))}
                                      style={{ colorScheme: "dark" }}
                                      className="w-full bg-black/20 border border-white/10 rounded-md py-1 px-2 text-[10px] font-black text-white outline-none focus:border-[#C9A227]"
                                    >
                                      {getInstallmentOptionsForMethod(split.method, split.cardBrand).map((option) => (
                                        <option key={option} value={option}>
                                          {option}x {option === 1 ? "\u00E0 vista" : fmt(split.amount / option)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
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
                          <span className="text-[9px] font-black uppercase text-white/40">
                            {splitOverpaidAmount > 0 ? "Excedente" : "Falta pagar"}
                          </span>
                          <span className={`text-xs font-black tabular-nums ${splitOverpaidAmount > 0 ? "text-red-400" : splitRemaining > 0 ? "text-[#C9A227]" : "text-emerald-400"}`}>
                            {fmt(splitOverpaidAmount > 0 ? splitOverpaidAmount : splitRemaining)}
                          </span>
                        </div>
                        {splitOverpaidAmount > 0 && (
                          <p className="text-[9px] text-red-300">
                            Ajuste os valores das divis\u00F5es para fechar a conta sem excedente.
                          </p>
                        )}
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
                            {paymentMethod !== "STONE" && getBrandsForPaymentMethod(paymentMethod as SplitPaymentMethod).length > 0 && (
                              <select
                                value={normalizedCardBrand || ""}
                                onChange={(e) => setCardBrand(e.target.value)}
                                style={{ colorScheme: "dark" }}
                                className="w-full bg-black/20 border border-white/10 rounded-md py-2 px-2.5 text-[10px] font-black text-white outline-none focus:border-[#C9A227]"
                              >
                                {getBrandsForPaymentMethod(paymentMethod as SplitPaymentMethod).map((brand) => (
                                  <option key={brand} value={brand}>{brand}</option>
                                ))}
                              </select>
                            )}
                            {paymentMethod === "CREDIT" && (
                              <select
                                value={installments}
                                onChange={(e) => setInstallments(Number(e.target.value))}
                                style={{ colorScheme: "dark" }}
                                className="w-full bg-black/20 border border-white/10 rounded-md py-2 px-2.5 text-[10px] font-black text-white outline-none focus:border-[#C9A227]"
                              >
                                {creditInstallmentOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}x {option === 1 ? "\u00E0 vista" : fmt(splitRemaining / option)}
                                  </option>
                                ))}
                              </select>
                            )}
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
                              className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-2 sm:py-2.5 rounded-xl border transition-all ${
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
                          {[finalTotal, Math.ceil(finalTotal / 10) * 10, Math.ceil(finalTotal / 50) * 50].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3).map((v) => (
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
                          {creditInstallmentOptions.map((n) => (
                            <button
                              key={n}
                              onClick={() => setInstallments(n)}
                              className={`py-2 rounded-xl text-[11px] font-black transition-all ${
                                installments === n ? "bg-[#C9A227] text-black" : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                              }`}
                            >
                              {n}x {n === 1 ? "à vista" : fmt(finalTotal / n)}
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
                  <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-white/5 shrink-0 bg-black/20 space-y-1.5 sm:space-y-2">
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
                    <div className="flex items-stretch gap-1.5 sm:gap-2">
                      <button
                        onClick={() => { setShowCheckout(false); setShowCartDrawer(true); }}
                        title="Cancelar pagamento e voltar ao carrinho"
                        className="shrink-0 basis-1/3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-300 hover:text-red-200 font-black py-2 sm:py-3 rounded-xl transition-all flex items-center justify-center gap-1 sm:gap-2.5 uppercase tracking-widest text-[9px] sm:text-xs"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        Cancelar
                      </button>
                      <button
                        disabled={
                          isProcessing ||
                          (isSplitMode && !splitCanFinalize) ||
                          (!isSplitMode && paymentMethod === "CASH" && digitsToNumber(amountReceived) < finalTotal) ||
                          (isCounterSale && !consumptionType)
                        }
                        title={
                          isCounterSale && !consumptionType
                            ? "Selecione \"Comer no local\" ou \"Viagem\" antes de finalizar"
                            : !isSplitMode && paymentMethod === "CASH" && digitsToNumber(amountReceived) < finalTotal
                            ? "Informe o valor recebido"
                            : undefined
                        }
                        onClick={handleCheckout}
                        className="flex-1 bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-30 text-black font-black py-2 sm:py-3 rounded-xl transition-all shadow-lg shadow-[#C9A227]/25 flex items-center justify-center gap-1 sm:gap-2.5 uppercase tracking-widest text-[9px] sm:text-xs"
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : isSplitMode && splitOverpaidAmount > 0 ? (
                          <>Excedente {fmt(splitOverpaidAmount)}</>
                        ) : isSplitMode && splitRemaining > 0 ? (
                          <>Falta {fmt(splitRemaining)}</>
                        ) : (
                          <>
                            {paymentMethod === "STONE" ? "Enviar para Maquininha" : "Finalizar Venda"}
                            {paymentMethod === "STONE" ? <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
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

      {/* Modal de Variações e Observações do Produto */}
      <AnimatePresence>
        {productOptionsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between px-6 py-5 bg-slate-50 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-black text-slate-800 truncate pr-4">{productOptionsModal.name}</h3>
                <button
                  onClick={closeProductOptions}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                {productOptionsModal.variants && productOptionsModal.variants.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Variações (Escolha 1)
                    </label>
                    <div className="space-y-2">
                      {productOptionsModal.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            productModalVariantId === variant.id
                              ? "bg-amber-50 border-[#C9A227] text-[#C9A227]"
                              : "bg-white border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="variant"
                            value={variant.id}
                            checked={productModalVariantId === variant.id}
                            onChange={() => setProductModalVariantId(variant.id)}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            productModalVariantId === variant.id ? "border-[#C9A227]" : "border-slate-300"
                          }`}>
                            {productModalVariantId === variant.id && <div className="w-2.5 h-2.5 rounded-full bg-[#C9A227]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{variant.name}</p>
                          </div>
                          <span className="font-black text-sm shrink-0">{fmt(variant.price)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {parseProductExtras(productOptionsModal).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Adicionais
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">Opcional</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {parseProductExtras(productOptionsModal).map((extra) => {
                        const isSelected = productModalSelectedExtras.some((selected) => selected.id === extra.id);
                        return (
                          <button
                            key={extra.id}
                            type="button"
                            onClick={() => setProductModalSelectedExtras((prev) =>
                              isSelected ? prev.filter((selected) => selected.id !== extra.id) : [...prev, extra]
                            )}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                              isSelected
                                ? "bg-amber-50 text-[#C9A227] border-[#C9A227]"
                                : "bg-white text-slate-600 border-slate-200 hover:border-[#C9A227]/50 hover:bg-slate-50"
                            }`}
                          >
                            {extra.label}
                            {(extra.price || 0) > 0 ? ` +${fmt(extra.price || 0)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  const groups = parseSelectionGroups(productOptionsModal);
                  if (groups.length === 0) return null;
                  const optionsByGroup = groups.map((g) => getSelectionGroupOptions(tenant, g));
                  if (optionsByGroup.every((o) => o.length === 0)) return null;
                  const isComplete = selectionGroupsComplete(groups, productModalGroupItemIds);
                  const doneCount = groups.reduce((acc, g, i) => acc + (productModalGroupItemIds[i]?.length ?? 0), 0);
                  const totalCount = groups.reduce((acc, g) => acc + g.qty, 0);
                  const summary = groups
                    .map((g, i) => (productModalGroupItemIds[i] || [])
                      .map((id) => optionsByGroup[i].find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(" + "))
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {groups.length > 1 ? "Personalize o pedido" : (groups[0].label || `Escolha ${groups[0].qty} ${groups[0].qty > 1 ? "itens" : "item"}`)}
                        </label>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isComplete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {doneCount}/{totalCount}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGroupPicker(true)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isComplete
                            ? "bg-amber-50 border-[#C9A227]"
                            : "bg-white border-slate-200 hover:border-[#C9A227]/50 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-sm font-bold text-slate-700 truncate">
                          {isComplete ? summary : "Toque para escolher"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Observações e Adicionais
                  </label>
                  <textarea
                    value={productModalNotes}
                    onChange={(e) => setProductModalNotes(e.target.value)}
                    placeholder="Ex: Sem cebola, ponto da carne, etc..."
                    className="w-full h-24 bg-slate-50 border-2 border-slate-100 rounded-xl p-3.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#C9A227] focus:bg-white resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  onClick={closeProductOptions}
                  className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold py-2 text-sm rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={(() => {
                    const groups = parseSelectionGroups(productOptionsModal);
                    return groups.length > 0 && !selectionGroupsComplete(groups, productModalGroupItemIds);
                  })()}
                  onClick={() => {
                    const groups = parseSelectionGroups(productOptionsModal);
                    const optionsByGroup = groups.map((g) => getSelectionGroupOptions(tenant, g));
                    const groupLabel = groups.length > 0 ? formatSelectionGroupsNote(groups, productModalGroupItemIds, optionsByGroup) : "";
                    const notesWithGroup = [groupLabel, productModalNotes.trim()].filter(Boolean).join(" | ");
                    if (productModalEditIndex !== null && productOptionsModal) {
                      setCart(prev => {
                        const newCart = [...prev];
                        const notes = buildCartNotes(productModalSelectedExtras, notesWithGroup);
                        const price = getCartItemPrice(productOptionsModal, productModalVariantId || undefined, productModalSelectedExtras);
                        newCart[productModalEditIndex] = {
                          ...newCart[productModalEditIndex],
                          notes,
                          customNotes: notesWithGroup,
                          productVariantId: productModalVariantId || undefined,
                          price,
                          selectedExtras: productModalSelectedExtras,
                          selectedGroupItemIds: productModalGroupItemIds,
                        };
                        return newCart;
                      });
                    } else {
                      addToCart(productOptionsModal!, productModalVariantId || undefined, notesWithGroup, productModalSelectedExtras);
                      setCart(prev => {
                        const newCart = [...prev];
                        const lastIndex = newCart.length - 1;
                        if (lastIndex >= 0) newCart[lastIndex] = { ...newCart[lastIndex], selectedGroupItemIds: productModalGroupItemIds };
                        return newCart;
                      });
                    }
                    closeProductOptions();
                  }}
                  className="flex-[2] bg-[#C9A227] hover:bg-[#b58f20] text-white font-black py-2 text-sm rounded-lg transition-all active:scale-[0.98] shadow-md shadow-[#C9A227]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {productModalEditIndex !== null ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Grupos de seleção embutidos — fluxo passo a passo (ex: marmita com Guarnição/Arroz/Feijão) */}
      {showGroupPicker && productOptionsModal && (() => {
        const groups = parseSelectionGroups(productOptionsModal);
        if (groups.length === 0) return null;
        const optionsByGroup = groups.map((g) => getSelectionGroupOptions(tenant, g));
        return (
          <SelectionGroupPicker
            groups={groups}
            optionsByGroup={optionsByGroup}
            initialSelections={productModalGroupItemIds.length ? productModalGroupItemIds : undefined}
            onConfirm={(idsByGroup) => { setProductModalGroupItemIds(idsByGroup); setShowGroupPicker(false); }}
            onCancel={() => setShowGroupPicker(false)}
          />
        );
      })()}
    </div>
  );
}
