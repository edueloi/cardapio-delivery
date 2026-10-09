import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Search, Plus, Minus, X, ShoppingCart,
  Trash2, CreditCard, Banknote, QrCode,
  CheckCircle2, Receipt, Package,
  ChevronRight, ChevronDown, ArrowLeft,
  Utensils, Tag, User, Phone, Percent,
  Printer, Hash, AlertCircle, Smartphone, Lock, ExternalLink, Download, Zap,
  MoreHorizontal, DoorClosed, Maximize2, Minimize2, Split, Truck, MessageSquarePlus, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Tenant, Product, ProductExtra, Order, PaymentConfig, PaymentMethodConfig, StoneConfig, CieloConfig, Customer, PrintingConfig } from "../../../../types";
import { dineInOrderLabel, DEFAULT_PRINTING_CONFIG } from "../../../../types";
import { apiJson } from "../../../../lib/api";
import { useToast, Button, IconButton, Input, Select, Tabs, Badge, Alert, EmptyState, Switch, Modal, ModalFooter, Textarea } from "../../../../components";
import { downloadReceiptPdf, printReceiptPdf, printCashClosingReportPdf, downloadDanfePdf, printDanfePdf } from "../../../../lib/receipt";
import type { DanfeData } from "../../../../types";
import socket from "../../../../lib/socket";
import SelectionGroupPicker, { parseSelectionGroups, getSelectionGroupOptions, formatSelectionGroupsNote, selectionGroupsComplete } from "../../../menu-view/SelectionGroupPicker";

const PDV_TABS = [
  { id: "products", label: "Produtos", icon: Package },
  { id: "tables", label: "Mesas", icon: Utensils },
  { id: "comandas", label: "Comandas", icon: Hash },
  { id: "delivery", label: "Delivery", icon: Truck },
] as const;

const SPLIT_MODE_TABS = [
  { id: "equal", label: "Valor igual" },
  { id: "item", label: "Por item" },
] as const;

const CASH_OPEN_TABS = [
  { id: "simple", label: "Digitar valor", icon: Banknote },
  { id: "count", label: "Contar cédulas", icon: Hash },
] as const;

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

// Denominações de cédulas e moedas em circulação no Brasil, da maior pra menor — ordem
// que o operador normalmente segue ao contar a gaveta na abertura de caixa.
const CASH_DENOMINATIONS: { value: number; label: string; kind: "bill" | "coin" }[] = [
  { value: 200, label: "R$ 200", kind: "bill" },
  { value: 100, label: "R$ 100", kind: "bill" },
  { value: 50, label: "R$ 50", kind: "bill" },
  { value: 20, label: "R$ 20", kind: "bill" },
  { value: 10, label: "R$ 10", kind: "bill" },
  { value: 5, label: "R$ 5", kind: "bill" },
  { value: 2, label: "R$ 2", kind: "bill" },
  { value: 1, label: "R$ 1", kind: "coin" },
  { value: 0.5, label: "50 centavos", kind: "coin" },
  { value: 0.25, label: "25 centavos", kind: "coin" },
  { value: 0.1, label: "10 centavos", kind: "coin" },
  { value: 0.05, label: "5 centavos", kind: "coin" },
];

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

// Item de comanda já aberta vem do backend com selectedExtras como JSON string (é assim
// que fica salvo no banco); item recém-adicionado ao carrinho já é array de ProductExtra.
// Normaliza os dois formatos pra reenviar no pedido mesclado do checkout.
function parseExtrasForResend(raw: unknown): ProductExtra[] {
  if (Array.isArray(raw)) return raw as ProductExtra[];
  if (typeof raw === "string" && raw) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const BASE_PAYMENT_METHODS = [
  { id: "CASH",   label: "Dinheiro",      icon: Banknote,    desc: "Espécie" },
  { id: "DEBIT",  label: "Débito",        icon: CreditCard,  desc: "À vista" },
  { id: "CREDIT", label: "Crédito",       icon: CreditCard,  desc: "Parcelado" },
  { id: "PIX",    label: "PIX",           icon: QrCode,      desc: "Instantâneo" },
  { id: "VR",     label: "Refeição/VR",   icon: Receipt,     desc: "Ticket/VR" },
  { id: "STONE",  label: "Maquininha",    icon: Smartphone,  desc: "Stone / Pagar.me" },
  { id: "CIELO",  label: "Maquininha Cielo", icon: Smartphone, desc: "Cielo LIO Smart" },
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
  // Desconto definido já na abertura da comanda (ex: cliente com cortesia combinada de
  // antemão) — separado do discountValue/discountType do rodapé do carrinho, que é o
  // desconto aplicado na hora de FECHAR a venda. Fica salvo no pedido-base da comanda
  // (Order.discount/discountType) e é ecoado de volta pelo handleLoadComanda.
  const [comandaDiscountType, setComandaDiscountType] = useState<"PERCENT" | "FIXED">("FIXED");
  const [comandaDiscountValue, setComandaDiscountValue] = useState("");
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
  // é emitida automaticamente assim que a venda for concluída. A configuração da loja
  // também pode tornar a emissão automática para todas as vendas do PDV.
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
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DEBIT" | "CREDIT" | "PIX" | "VR" | "STONE" | "CIELO">("CASH");
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

  // Cielo terminal flow
  const [cieloPaymentType, setCieloPaymentType] = useState<"credit" | "debit" | "pix">("credit");
  const [cieloStatus, setCieloStatus] = useState<"idle" | "sending" | "waiting" | "paid" | "failed">("idle");
  const [cieloChargeId, setCieloChargeId] = useState<string | null>(null);
  const cieloPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [closingBalanceInput, setClosingBalanceInput] = useState("");
  const [cashActionLoading, setCashActionLoading] = useState(false);
  const [cashError, setCashError] = useState("");
  // Tela de abertura de caixa (cheia, some os produtos por trás) — "simple" é digitar o
  // valor direto, "count" é contar cédulas/moedas uma a uma e somar automaticamente.
  const [cashOpenMode, setCashOpenMode] = useState<"simple" | "count">("simple");
  const [cashCounts, setCashCounts] = useState<Record<number, string>>({});

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
    // A segunda via é uma regra geral de impressão automática. Quando ativada nas
    // configurações, vale para qualquer origem (PDV, balcão, cardápio e delivery).
    const clientCopy = buildReceiptDataFromOrder(
      order,
      printingConfig.autoPrintEstablishmentCopy ? "CLIENTE" : undefined,
    );
    if (clientCopy) doPrint(clientCopy);
    if (printingConfig.autoPrintEstablishmentCopy) {
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
      // Pedido de maquininha (Stone/Cielo) nasce PENDING e chega aqui pelo socket assim que
      // criado — mas ainda não foi pago. Não imprime agora; handleStonePay/handleCieloPay
      // já cuidam de imprimir quando o pagamento for de fato confirmado.
      const isTerminalPending = order.status === "PENDING" && /^(?:STONE|CIELO)_/.test(String(order.paymentMethod || ""));
      if (isTerminalPending) return;
      globalAutoPrintedOrderIds.add(order.id);
      printOrderAuto(order);
    };
    socket.on("order-created", handler);
    return () => { socket.off("order-created", handler); };
  }, [printingConfig.autoPrintOnOrderCreate, printOrderAuto]);

  const cashCountedTotal = CASH_DENOMINATIONS.reduce(
    (sum, d) => sum + d.value * (Number(cashCounts[d.value]) || 0), 0,
  );
  const cashOpeningAmount = cashOpenMode === "count" ? cashCountedTotal : digitsToNumber(openingBalanceInput);

  const handleOpenCash = async () => {
    setCashActionLoading(true);
    setCashError("");
    try {
      await apiJson(`/api/tenants/${tenant.slug}/cash/open`, {
        method: "POST",
        body: JSON.stringify({ openingBalance: cashOpeningAmount }),
      });
      setOpeningBalanceInput("");
      setCashCounts({});
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
  const [successPaused, setSuccessPaused] = useState(false);
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

  const cieloCfg = useMemo<CieloConfig | null>(() => {
    try { return tenant.cieloConfig ? JSON.parse(tenant.cieloConfig) as CieloConfig : null; }
    catch { return null; }
  }, [tenant.cieloConfig]);

  const fiscalConfig = useMemo(() => {
    try {
      return tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig as string) : null;
    } catch { return null; }
  }, [tenant.fiscalConfig]);

  const fiscalEnabled = fiscalConfig?.enabled === true;
  // O aviso de venda realizada fica 12 s (tempo de baixar/imprimir) e pausa com o mouse em cima.
  // Com NFC-e habilitada ele só fecha no X, para não sumir no meio da emissão.
  useEffect(() => {
    if (!showSuccess || fiscalEnabled || successPaused) return;
    const timer = window.setTimeout(() => setShowSuccess(false), 12000);
    return () => window.clearTimeout(timer);
  }, [showSuccess, fiscalEnabled, successPaused]);
  const autoEmitNfce = fiscalConfig?.autoEmitNfce === true;
  const autoPrintDanfe = autoEmitNfce && fiscalConfig?.autoPrintDanfe === true;
  const shouldEmitNfce = fiscalEnabled && (requestNfce || autoEmitNfce);

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
        if (autoPrintDanfe) {
          try {
            const danfe = await apiJson<DanfeData>(`/api/owner/tenants/${tenant.id}/nfce/danfe/${order.id}`);
            const desktop = (window as any).pdvDesktop;
            if (desktop?.printDanfe) desktop.printDanfe(danfe);
            else printDanfePdf(danfe, tenant.receiptPaperWidth);
          } catch (printError: any) {
            toast.error(printError?.message ?? "NFC-e autorizada, mas não foi possível imprimir o DANFE.");
          }
        }
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
      if (m.id === "CIELO") return !!cieloCfg?.enabled;
      const key = PAYMENT_CONFIG_KEY_MAP[m.id];
      const cfg = key ? (paymentConfig[key] as any) : undefined;
      // Sem configuração salva ainda = habilitado por padrão (não bloqueia quem nunca configurou)
      return cfg?.enabled !== false;
    });
  }, [stoneCfg, cieloCfg, paymentConfig]);

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
    method: SplitPaymentMethod | "STONE" | "CIELO",
    brand?: string,
    installmentsCount = 1,
    amount = 0
  ) => {
    if (method === "STONE" || method === "CIELO" || method === "CASH") {
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

  const normalizedCardBrand = paymentMethod === "STONE" || paymentMethod === "CIELO"
    ? undefined
    : getNormalizedBrandForMethod(paymentMethod as SplitPaymentMethod, cardBrand);
  const creditInstallmentOptions = useMemo(
    () => getInstallmentOptionsForMethod("CREDIT", normalizedCardBrand),
    [getInstallmentOptionsForMethod, normalizedCardBrand]
  );

  useEffect(() => {
    if (paymentMethod === "STONE" || paymentMethod === "CIELO") {
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
        products = [...products, ...cat.products.filter((p) => p.available !== false)];
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
    const allProducts = (tenant.categories?.flatMap((cat) => cat.products) ?? []).filter((p) => p.available !== false);
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
      // comandaGroupId (quando presente) é a fonte de verdade: nunca reseta nem
      // colide, ao contrário de counterTicketNumber (senha sequencial que se repete
      // todo dia). Pedidos criados antes dessa coluna existir não têm esse campo —
      // pra esses, mantemos o filtro por senha + mesmo dia do pedido-base como
      // aproximação. Sem alguma dessas duas travas, um pedido de outro dia pendurado
      // sem status final (nunca virou DELIVERED/CANCELLED/MERGED) era resgatado aqui
      // só por coincidir a mesma senha, e seus itens apareciam misturados no carrinho
      // da comanda de hoje — produto que ninguém pediu surgindo do nada.
      const baseGroupId = selectedComandaBaseOrder?.comandaGroupId ?? null;
      const baseCreatedAt = selectedComandaBaseOrder?.createdAt ? new Date(selectedComandaBaseOrder.createdAt) : null;
      const baseDayStart = baseCreatedAt ? new Date(baseCreatedAt.getFullYear(), baseCreatedAt.getMonth(), baseCreatedAt.getDate()) : null;
      const baseDayEnd = baseDayStart ? new Date(baseDayStart.getTime() + 24 * 60 * 60 * 1000) : null;
      return orders.filter(
        (order) =>
          (
            (selectedComandaBaseOrder?.counterTicketNumber != null &&
              order.counterTicketNumber === selectedComandaBaseOrder.counterTicketNumber &&
              (baseGroupId
                ? order.comandaGroupId === baseGroupId
                : (!baseDayStart || !baseDayEnd || (new Date(order.createdAt) >= baseDayStart && new Date(order.createdAt) < baseDayEnd)))) ||
            order.id === selectedComandaId
          ) &&
          order.orderType === "DINE_IN" &&
          !order.tableId &&
          !["DELIVERED", "CANCELLED", "MERGED"].includes(order.status) && !order.billed
      );
    }
    return [];
  }, [orders, selectedComandaBaseOrder?.counterTicketNumber, selectedComandaBaseOrder?.createdAt, selectedComandaId, selectedTableId]);

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

  // discountValue guarda dígitos mascarados (centavos) quando FIXED (ex: "1000" = R$ 10,00),
  // igual ao padrão de amountReceived — mas percentual continua sendo lido direto, sem máscara.
  const getDiscountNumericValue = useCallback((value: string, type: "PERCENT" | "FIXED") => {
    if (!value) return 0;
    return type === "FIXED" ? digitsToNumber(value) : parseFloat(value) || 0;
  }, []);

  const discountAmount = useMemo(() => {
    const v = getDiscountNumericValue(discountValue, discountType);
    if (!v) return 0;
    return discountType === "PERCENT" ? subtotal * (v / 100) : Math.min(v, subtotal);
  }, [subtotal, discountValue, discountType, getDiscountNumericValue]);

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
  const activeSplitRate = paymentMethod === "STONE" || paymentMethod === "CIELO"
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
      // Item já veio salvo do backend — selectedExtras chega como JSON string.
      selectedExtras: parseExtrasForResend((item as any).selectedExtras),
    })),
    ...cart.map((item) => ({
      productId: item.product.id,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      price: item.price,
      notes: item.notes || undefined,
      selectedExtras: item.selectedExtras || [],
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
      return Array.isArray(parsed) ? parsed.filter((extra: ProductExtra) => !extra.autoApplyOnTakeout) : [];
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
    setCieloStatus("idle");
    setCieloChargeId(null);
    setNfceStatus("idle");
    setNfceMessage("");
    setShowCartDrawer(false);
    setPaymentSplits([]);
    setIsSplitMode(false);
    setGroupSplitCount("2");
    if (stonePollRef.current) clearInterval(stonePollRef.current);
    if (cieloPollRef.current) clearInterval(cieloPollRef.current);
  };

  // Adiciona a forma de pagamento atualmente selecionada como uma parcela do split,
  // usando o valor restante como sugestão (some 100% do que falta por padrão).
  const handleAddPaymentSplit = () => {
    if (paymentMethod === "STONE" || paymentMethod === "CIELO" || splitRemaining <= 0) return;
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
    if (paymentMethod === "CIELO") {
      toast.warning("A divisão por grupo não está disponível para maquininha Cielo.");
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
    if (paymentMethod === "CIELO") {
      toast.warning("A divisão por item não está disponível para maquininha Cielo.");
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

  // Cleanup stone/cielo polling on unmount
  useEffect(() => () => {
    if (stonePollRef.current) clearInterval(stonePollRef.current);
    if (cieloPollRef.current) clearInterval(cieloPollRef.current);
  }, []);

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
  }, [isWaiterMode, checkoutItems.length, cart.length, currentCash, showCheckout, showComandaModal, orderDetailsView, showCloseCashModal, showPriceCheckModal, showMoreOptionsMenu]);

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
    // Desconto definido na abertura da comanda (fica salvo só no pedido-base, comanda.discount)
    // "gruda" aqui: sem isso, reabrir uma comanda com desconto voltava ao estado padrão (sem
    // desconto), como se o operador tivesse que redigitar toda vez que reabrisse a tela.
    if (comanda.discount) {
      const type = comanda.discountType || "FIXED";
      // discountValue guarda dígitos mascarados (centavos) quando FIXED — comanda.discount vem
      // em reais puro do backend (ex: 10.5), precisa converter pro mesmo formato do input.
      setDiscountValue(type === "FIXED" ? String(Math.round(comanda.discount * 100)) : String(comanda.discount));
      setDiscountType(type);
    } else {
      setDiscountValue("");
      setDiscountType("FIXED");
    }
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
          discount: comandaDiscountValue
            ? (comandaDiscountType === "FIXED" ? digitsToNumber(comandaDiscountValue) : parseFloat(comandaDiscountValue))
            : undefined,
          discountType: comandaDiscountValue ? comandaDiscountType : undefined,
          items: cart.map((i) => ({
            productId: i.product.id,
            productVariantId: i.productVariantId,
            quantity: i.quantity,
            price: i.price,
            notes: i.notes || undefined,
            selectedExtras: i.selectedExtras || [],
          })),
          ...(isWaiterMode ? { source: "waiter" } : {}),
        }),
      });

      setCart([]);
      setComandaNumber("");
      setComandaDiscountValue("");
      setComandaDiscountType("FIXED");
      setShowComandaModal(false);
      onOrderCreated?.();

      if (createdOrder?.id) {
        if (printingConfig.autoPrintOnOrderCreate && !globalAutoPrintedOrderIds.has(createdOrder.id)) {
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
          items: cart.map((item) => ({ productId: item.product.id, productVariantId: item.productVariantId, quantity: item.quantity, price: item.price, notes: item.notes || undefined, selectedExtras: item.selectedExtras || [] })),
          ...(isWaiterMode ? { source: "waiter" } : {}),
        }),
      });
      if (printingConfig.autoPrintOnOrderCreate && launchedOrder?.id && !globalAutoPrintedOrderIds.has(launchedOrder.id)) {
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
    const isCielo = paymentMethod === "CIELO";
    const useSplit = isSplitMode && paymentSplits.length > 0;

    // Ação "Fechar Conta" é exclusivamente de faturamento. Como essa tela é aberta
    // com o carrinho limpo, nunca pode cair no fluxo de criar pedido novo: isso geraria
    // uma nova via automática ao receber uma comanda já existente.
    if (isClosingAccount && cart.length > 0) {
      toast.error("Há itens novos no carrinho. Lance-os na comanda antes de fechar a conta.");
      setIsProcessing(false);
      return;
    }

    // Se o carrinho está vazio (só tem itens já lançados) e tem mesa/comanda selecionada,
    // apenas faturamos o contexto atual sem criar um novo pedido (mantendo na cozinha se for o caso).
    const isPayingExistingContext = cart.length === 0 && (selectedTableId || selectedComandaId);

    if (isPayingExistingContext && !isStone && !isCielo) {
      try {
        const billResult = await apiJson<{ orders?: any[]; receiptOrder?: any }>(`/api/tenants/${tenant.slug}/pdv/bill-context`, {
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
            discount: getDiscountNumericValue(discountValue, discountType),
            discountType,
          }),
        });

        // Sem isso, o botão "Imprimir" da tela de sucesso ficava sem pedido pra imprimir
        // (lastOrderRef nunca era preenchido nesse fluxo de fechar mesa/comanda existente,
        // só no de venda nova) — clicar nele não fazia nada, silenciosamente.
        const finalReceiptOrder = billResult?.receiptOrder ?? billResult?.orders?.[0] ?? null;
        lastOrderRef.current = finalReceiptOrder;
        // Ao fechar, deixa a via final (com pagamento, desconto e demais ajustes)
        // disponível no botão Imprimir da tela de sucesso. Não dispara sozinha: as
        // vias automáticas já foram emitidas na abertura, evitando uma terceira folha.

        // Limpa a seleção visual (não chama onClearComanda para não dar MERGED e apagar da cozinha)
        if (selectedTableId) setSelectedTableId(null);
        if (selectedComandaId) setSelectedComandaId(null);
        
        clearCart();
        setShowCheckout(false);
        setShowSuccess(true);
        // Com fiscal habilitado, deixa o aviso aberto até fechar manualmente — 3s não dá
        // tempo de digitar/conferir o CPF-CNPJ e emitir a NFC-e antes de sumir sozinho.
          if (shouldEmitNfce) void handleEmitNfce();
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
      paymentMethod: useSplit ? "SPLIT" : isStone ? `STONE_${stonePaymentType.toUpperCase()}` : isCielo ? `CIELO_${cieloPaymentType.toUpperCase()}` : paymentMethod,
      paymentMetadata: useSplit
        ? { splits: normalizedPaymentSplits.map(({ id, ...s }) => s) }
        : {
            amountReceived: paymentMethod === "CASH" ? digitsToNumber(amountReceived) : finalTotal,
            change,
            cardBrand: normalizedCardBrand,
            installments: paymentMethod === "CREDIT" ? installments : 1,
          },
      discount: getDiscountNumericValue(discountValue, discountType),
      discountType,
      cardBrand: normalizedCardBrand,
      installments: paymentMethod === "CREDIT" ? installments : 1,
      serviceChargeIncluded: serviceChargeChecked && !!serviceChargeConfig?.enabled,
      // Stone/Cielo orders start as PENDING until terminal confirms
      status: isStone || isCielo ? "PENDING" : undefined,
      items: checkoutItems.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || undefined,
        selectedExtras: item.selectedExtras || [],
      })),
    };

    try {
      const order = await apiJson(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify(orderData),
      }) as { id: string; [key: string]: unknown };
      lastOrderRef.current = order;
      // Pedido de maquininha (Stone/Cielo) só imprime depois que o terminal confirmar
      // o pagamento (ver handleStonePay/handleCieloPay) — nunca antes, pra cozinha não
      // receber um pedido cujo pagamento ainda pode ser recusado/cancelado na maquininha.
      if (!isStone && !isCielo && printingConfig.autoPrintOnOrderCreate && (order as any).id && !globalAutoPrintedOrderIds.has((order as any).id)) {
        globalAutoPrintedOrderIds.add((order as any).id);
        // Com DANFE automático, reserva o pedido para que o socket não imprima o
        // cupom comercial antes da autorização da NFC-e.
        if (!autoPrintDanfe) printOrderAuto(order);
      }

      if (isStone) {
        setIsProcessing(false);
        await handleStonePay(order.id);
        return;
      }

      if (isCielo) {
        setIsProcessing(false);
        await handleCieloPay(order.id);
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
      if (shouldEmitNfce) void handleEmitNfce();
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
            if (printingConfig.autoPrintOnOrderCreate && !globalAutoPrintedOrderIds.has(pendingOrderId)) {
              globalAutoPrintedOrderIds.add(pendingOrderId);
              if (!autoPrintDanfe) printOrderAuto(lastOrderRef.current as any);
            }
            setTimeout(() => {
              clearCart();
              setShowCheckout(false);
              setShowSuccess(true);
                      if (shouldEmitNfce) void handleEmitNfce();
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

  const handleCieloPay = async (pendingOrderId: string) => {
    setCieloStatus("sending");
    try {
      const result = await apiJson(`/api/tenants/${tenant.slug}/cielo/charge`, {
        method: "POST",
        body: JSON.stringify({ orderId: pendingOrderId, amount: finalTotal, paymentType: cieloPaymentType }),
      }) as { chargeId: string; status: string };
      setCieloChargeId(result.chargeId);
      setCieloStatus("waiting");

      // Poll every 5s for up to 3 minutes
      let attempts = 0;
      cieloPollRef.current = setInterval(async () => {
        attempts++;
        try {
          const poll = await apiJson(`/api/tenants/${tenant.slug}/cielo/charge/${result.chargeId}`) as { status: string; chargeId: string };
          if (poll.status === "PAID" || poll.status === "CLOSED") {
            clearInterval(cieloPollRef.current!);
            cieloPollRef.current = null;
            setCieloStatus("paid");
            if (printingConfig.autoPrintOnOrderCreate && !globalAutoPrintedOrderIds.has(pendingOrderId)) {
              globalAutoPrintedOrderIds.add(pendingOrderId);
              if (!autoPrintDanfe) printOrderAuto(lastOrderRef.current as any);
            }
            setTimeout(() => {
              clearCart();
              setShowCheckout(false);
              setShowSuccess(true);
                      if (shouldEmitNfce) void handleEmitNfce();
              onOrderCreated?.();
            }, 1500);
          } else if (poll.status === "CANCELLED" || poll.status === "CANCELED" || attempts > 36) {
            clearInterval(cieloPollRef.current!);
            cieloPollRef.current = null;
            setCieloStatus("failed");
          }
        } catch { /* ignore poll errors */ }
      }, 5000);
    } catch (err) {
      console.error(err);
      setCieloStatus("failed");
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
    // selectedExtras (JSON de ProductExtra[]) inclui tanto os adicionais escolhidos manualmente
    // quanto os aplicados automaticamente (ex: embalagem em pedidos para viagem) — esses últimos
    // nunca entram em "notes" (montado só na escolha manual no carrinho), então sem ler
    // selectedExtras aqui o adicional automático nunca aparece na notinha.
    const extrasLabels = (i: any): string[] => {
      if (!i.selectedExtras) return [];
      try {
        const extras: Array<{ label: string; price?: number }> = typeof i.selectedExtras === "string" ? JSON.parse(i.selectedExtras) : i.selectedExtras;
        return extras.map((extra) => extra.price && extra.price > 0 ? `${extra.label} (+${fmt(extra.price)})` : extra.label);
      } catch {
        return [];
      }
    };
    const items = (order.items || []).map((i: any) => ({
      quantity: i.quantity,
      name: itemDisplayName(i),
      price: i.price,
      notes: i.notes || undefined,
      extras: extrasLabels(i),
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
      operatorName: order.operatorName || operatorName || undefined,
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

  // Caixa fechado (e a loja exige caixa) bloqueia a tela inteira do PDV — antes só
  // desabilitava o botão de finalizar venda, deixando a grade de produtos visível por
  // trás como se desse pra operar normalmente. Igual ao store-stock: nada de produto
  // aparece até abrir o caixa, com opção de digitar o valor ou contar cédulas/moedas.
  if (!isWaiterMode && !cashLoading && cashRequired && !currentCash) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 overflow-y-auto py-6 px-4">
        <div className={`w-full bg-white rounded-lg p-5 sm:p-8 space-y-5 sm:space-y-6 shadow-sm border border-slate-200 my-auto transition-all ${
          cashOpenMode === "count" ? "max-w-4xl" : "max-w-sm"
        }`}>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <Banknote className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">Caixa Fechado</h3>
            <p className="text-xs text-slate-500">Abra o caixa informando o fundo de troco para começar a vender.</p>
          </div>

          <Tabs
            label="Modo de abertura do caixa"
            items={CASH_OPEN_TABS}
            value={cashOpenMode}
            onChange={(v) => setCashOpenMode(v as typeof cashOpenMode)}
            className="!space-y-0"
          >
            {null}
          </Tabs>

          {cashError && (
            <Alert variant="error">
              {cashError}
            </Alert>
          )}

          {cashOpenMode === "simple" ? (
            <div className="space-y-1.5">
              <Input
                label="Fundo de Caixa"
                type="text"
                inputMode="numeric"
                autoFocus
                value={formatCurrencyDigits(openingBalanceInput)}
                onChange={(e) => setOpeningBalanceInput(maskCurrencyDigits(e.target.value))}
                placeholder="0,00"
                addonLeft="R$"
                className="text-center text-base font-semibold"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-[11px] font-semibold text-slate-500 block">
                Quantidade de cada cédula/moeda
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[50vh] sm:max-h-80 overflow-y-auto pr-0.5">
                {CASH_DENOMINATIONS.map((d) => {
                  const qty = Number(cashCounts[d.value]) || 0;
                  const subtotal = qty * d.value;
                  return (
                    <div key={d.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      qty > 0 ? "border-emerald-400/40 bg-emerald-500/5" : "border-slate-200 bg-slate-50"
                    }`}>
                      <Badge color={d.kind === "bill" ? "success" : "warning"}>
                        {d.kind === "bill" ? "Nota" : "Moeda"}
                      </Badge>
                      <span className="text-[12px] font-semibold text-slate-600 flex-1 min-w-0 truncate">{d.label}</span>
                      <Input
                        type="text" inputMode="numeric" placeholder="0"
                        value={cashCounts[d.value] ?? ""}
                        onChange={(e) => setCashCounts((prev) => ({ ...prev, [d.value]: e.target.value.replace(/\D/g, "") }))}
                        wrapperClassName="w-16 shrink-0"
                        className="text-center font-semibold"
                      />
                      <span className="text-[11px] font-mono font-semibold text-slate-500 w-16 text-right shrink-0">
                        {subtotal > 0 ? fmt(subtotal) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[11px] font-semibold text-emerald-700">Total contado</span>
                <span className="text-[18px] font-mono font-semibold text-emerald-700">{fmt(cashCountedTotal)}</span>
              </div>
            </div>
          )}

          <Button
            size="lg"
            fullWidth
            className="!h-11"
            loading={cashActionLoading}
            onClick={handleOpenCash}
          >
            {`Abrir Caixa · ${fmt(cashOpeningAmount)}`}
          </Button>
        </div>
      </div>
    );
  }

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
            onMouseEnter={() => setSuccessPaused(true)}
            onMouseLeave={() => setSuccessPaused(false)}
          >
            <div className="bg-green-500 text-white px-5 py-3 rounded-lg shadow-sm flex flex-wrap items-center justify-center gap-2.5 font-semibold text-xs sm:text-sm w-full">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Venda realizada!
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="secondary" size="sm" onClick={handleDownloadReceipt} iconLeft={<Download size={14} />}>Baixar PDF</Button>
                <Button variant="secondary" size="sm" onClick={handlePrintReceipt} iconLeft={<Printer size={14} />}>Imprimir</Button>
                <IconButton variant="secondary" size="sm" aria-label="Fechar" onClick={() => setShowSuccess(false)} title="Fechar"><X size={14} /></IconButton>
              </div>
            </div>
            {/* Botão NFC-e — aparece apenas se fiscal estiver habilitado */}
            {fiscalEnabled && nfceStatus === "idle" && (
              <Button size="lg" onClick={handleEmitNfce} iconLeft={<Receipt size={14} />}>Emitir NFC-e</Button>
            )}
            {fiscalEnabled && nfceStatus === "loading" && (
              <div className="bg-slate-800 text-white px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 text-xs font-semibold">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando para SEFAZ...
              </div>
            )}
            {fiscalEnabled && nfceStatus === "authorized" && (
              <div className="bg-green-600 text-white px-5 py-2.5 rounded-lg shadow-sm flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {nfceMessage}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button variant="secondary" size="sm" onClick={handleDownloadDanfe} iconLeft={<Download size={14} />}>Baixar DANFE</Button>
                  <Button variant="secondary" size="sm" onClick={handlePrintDanfe} iconLeft={<Printer size={14} />}>Imprimir DANFE</Button>
                </div>
              </div>
            )}
            {fiscalEnabled && nfceStatus === "rejected" && (
              <div className="bg-red-500 text-white px-5 py-2.5 rounded-lg shadow-sm flex items-center gap-2 text-xs font-semibold max-w-xs text-center">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {nfceMessage}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Left: Product Selection ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Atalhos de tela — abrir em nova janela (só no dashboard) e fullscreen do navegador (sempre) */}

        {/* Cash register status bar — só chega aqui com caixa aberto (o bloqueio de tela
            cheia acima intercepta o caso fechado antes de renderizar este trecho) */}
        {!isWaiterMode && !cashLoading && cashRequired && currentCash && (
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b shrink-0 bg-emerald-50/60 border-emerald-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500 animate-pulse" />
              <p className="text-[11px] font-semibold text-emerald-700 truncate">
                Caixa aberto <span className="font-semibold normal-case text-emerald-600/80">· Fundo {fmt(currentCash.openingBalance)} · Esperado {fmt(currentCash.expectedBalance)}</span>
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 !text-red-600 !border-red-200 hover:!bg-red-50" onClick={() => setShowCloseCashModal(true)}>Fechar Caixa</Button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b border-slate-100 px-2">
          <Tabs
            label="Modo do PDV"
            items={(isWaiterMode ? PDV_TABS.filter((t) => t.id !== "delivery") : PDV_TABS).map((t) => ({
              ...t,
              badge:
                t.id === "tables" && checkoutRequests.length > 0 ? checkoutRequests.length
                : t.id === "comandas" && activeComandas.length > 0 ? activeComandas.length
                : t.id === "delivery" && pendingDeliveryOrders.length > 0 ? pendingDeliveryOrders.length
                : undefined,
            }))}
            value={activeTab}
            onChange={(v) => setActiveTab(v as typeof activeTab)}
            className="!space-y-0"
          >
            {null}
          </Tabs>
        </div>

        {/* Products Tab */}
        {activeTab === "products" && (
          <>
            {/* Search + categories */}
            <div className="p-2 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
                <Input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  iconLeft={<Search size={14} />}
                  className="pl-9"
                />
                {searchTerm && (
                  <IconButton variant="ghost" size="sm" aria-label="Limpar busca" onClick={() => setSearchTerm("")} className="absolute right-1 top-1/2 -translate-y-1/2">
                    <X size={14} />
                  </IconButton>
                )}
              </div>
              {!isExternalFullscreen && (
                <div className="relative sm:w-56 shrink-0">
                  <Select
                    value={selectedCategoryId ?? "all"}
                    onChange={(e) => setSelectedCategoryId(e.target.value === "all" ? null : e.target.value)}
                  >
                    <option value="all">Todos ({tenant.categories?.reduce((s, c) => s + c.products.filter((p) => p.available !== false).length, 0) ?? 0})</option>
                    {tenant.categories?.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.products.filter((p) => p.available !== false).length})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            {currentContextLabel && (
              <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-amber-700">Editando no PDV</p>
                  <p className="text-sm font-semibold text-slate-800">{currentContextLabel}</p>
                  <p className="text-[11px] text-slate-500">
                    {contextLoadMessage || "Itens já lançados ficam separados dos novos itens para não duplicar a comanda."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
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
                    className={`w-full min-h-[36px] text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      selectedCategoryId === null ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"
                    }`}
                  >
                    Todas ({tenant.categories?.reduce((s, c) => s + c.products.filter((p) => p.available !== false).length, 0) ?? 0})
                  </button>
                  {tenant.categories?.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full min-h-[36px] text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors truncate ${
                        selectedCategoryId === cat.id ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white"
                      }`}
                    >
                      {cat.name} ({cat.products.filter((p) => p.available !== false).length})
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
                <EmptyState icon={Package} title="Nenhum produto encontrado" className="h-full py-20" />
              ) : (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" } as React.CSSProperties}
                >
                  {filteredProducts.map((product) => {
                    const inCart = cart.find((i) => i.product.id === product.id);
                    const stockQty = product.inventoryItem ? Number(product.inventoryItem.quantity) : null;
                    const lowStock = stockQty !== null && stockQty <= 5;
                    const customizable = hasProductCustomizations(product);
                    return (
                      <div
                        key={product.id}
                        className={`group relative flex flex-col overflow-hidden rounded-lg border bg-white transition-all duration-150 ${
                          inCart ? "border-blue-500 ring-1 ring-blue-500" : "border-slate-200 hover:border-blue-300 hover:shadow-sm"
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Adicionar ${product.name}`}
                          className="absolute inset-0 z-0 h-full w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                          onClick={() => {
                            if (customizable) openProductOptions(product);
                            else addToCart(product);
                          }}
                        />

                        {/* Imagem */}
                        <div className="pointer-events-none relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-slate-100">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          ) : (
                            <Utensils className="h-8 w-8 text-slate-300" />
                          )}
                          {inCart && (
                            <span className="absolute left-2 top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white shadow">
                              {inCart.quantity}
                            </span>
                          )}
                          {stockQty !== null && (
                            <span className={`absolute bottom-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white ${lowStock ? "bg-amber-600/90" : "bg-slate-900/60"}`}>
                              {stockQty} un
                            </span>
                          )}
                        </div>

                        {/* Opções / observações */}
                        <IconButton
                          variant="outline"
                          size="sm"
                          aria-label="Opções e observações"
                          title="Opções e observações"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductOptions(product);
                          }}
                          className="absolute right-2 top-2 z-10 border-white/0 bg-white/90 shadow-sm backdrop-blur hover:bg-white"
                        >
                          <MessageSquarePlus size={14} />
                        </IconButton>

                        {/* Nome e preço */}
                        <div className="pointer-events-none flex flex-1 flex-col justify-between gap-1.5 p-2.5">
                          <h4 className="line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug text-slate-800">{product.name}</h4>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold tabular-nums text-blue-700">{fmt(product.price)}</span>
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white transition-colors group-hover:bg-blue-700">
                              <Plus size={14} />
                            </span>
                          </div>
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
          const activeTableMap = new Map<string, { tableId: string; customerName: string; total: number; orderCount: number; lastAt: string; wantsCheckout: boolean; hasDiscount: boolean }>();
          orders.forEach((o) => {
            if (!o.tableId || o.orderType !== "DINE_IN") return;
            if (o.status === "DELIVERED" || o.status === "CANCELLED" || o.status === "MERGED") return;
            if (o.billed) return;
            const existing = activeTableMap.get(o.tableId);
            if (existing) {
              existing.total += o.total;
              existing.orderCount += 1;
              existing.hasDiscount = existing.hasDiscount || !!o.discount;
              if (o.createdAt > existing.lastAt) existing.lastAt = o.createdAt;
            } else {
              activeTableMap.set(o.tableId, {
                tableId: o.tableId,
                customerName: o.customerName,
                total: o.total,
                orderCount: 1,
                lastAt: o.createdAt,
                wantsCheckout: checkoutRequests.some(r => r.tableId === o.tableId),
                hasDiscount: !!o.discount,
              });
            }
          });
          // Mark checkout requests even if no order yet in state
          checkoutRequests.forEach((r) => {
            if (!activeTableMap.has(r.tableId)) {
              activeTableMap.set(r.tableId, { tableId: r.tableId, customerName: r.customerName, total: 0, orderCount: 0, lastAt: new Date(r.timestamp).toISOString(), wantsCheckout: true, hasDiscount: false });
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
                  <p className="text-[11px] font-semibold text-slate-400 mb-3">Mesas Disponíveis</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {availableTables.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleLoadTable(t.label)}
                        className="bg-white border border-slate-200 hover:border-blue-600 rounded-lg py-3 text-center transition-all"
                      >
                        <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTables.length === 0 && availableTables.length === 0 ? (
                <EmptyState icon={Utensils} title="Nenhuma mesa cadastrada" className="h-full" />
              ) : activeTables.length === 0 ? null : (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 mb-3">Mesas Ocupadas</p>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
                  >
                  {activeTables.map((tbl) => (
                    <button
                      key={tbl.tableId}
                      onClick={() => setOrderDetailsView({ type: "table", tableId: tbl.tableId })}
                      className={`relative bg-white p-4 rounded-lg border-2 hover:shadow-sm transition-all text-left flex items-center gap-3 group ${tbl.wantsCheckout ? 'border-red-300 hover:border-red-500' : 'border-slate-100 hover:border-blue-600'}`}
                    >
                      {tbl.wantsCheckout && (
                        <span className="absolute -top-2 -right-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm animate-pulse">
                          Pediu Conta
                        </span>
                      )}
                      <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 transition-colors leading-none ${tbl.wantsCheckout ? 'bg-red-50 text-red-500 group-hover:bg-red-500 group-hover:text-white' : 'bg-amber-50 text-amber-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                        <Utensils className="w-4 h-4 mb-0.5" />
                        <span className="text-[10px] font-semibold">{tbl.tableId}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-800 truncate">Mesa {tbl.tableId}</h4>
                        <p className="text-[11px] font-semibold text-slate-400 truncate">{tbl.customerName || `${tbl.orderCount} ${tbl.orderCount === 1 ? "pedido" : "pedidos"}`}</p>
                        {tbl.hasDiscount && (
                          <p className="text-[10px] font-semibold text-emerald-600">Com desconto</p>
                        )}
                        <p className="text-sm font-semibold text-blue-600 mt-0.5">{fmt(tbl.total)}</p>
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
              <h4 className="text-xs font-semibold text-slate-400">Comandas Ativas</h4>
              <Button
                size="lg"
                onClick={() => { setComandaNumber(""); setConsumptionType("EAT_IN"); setShowComandaModal(true); }}
                iconLeft={<Plus size={14} />}
              >
                Nova Comanda
              </Button>
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
            >
              {activeComandas.map((comanda) => (
                  <button
                    key={comanda.id}
                    onClick={() => setOrderDetailsView({ type: "comanda", comanda })}
                    className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-600 hover:shadow-sm transition-all text-left flex items-center gap-3 group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex flex-col items-center justify-center shrink-0 leading-none transition-colors">
                      {comanda.counterTicketNumber != null ? (
                        <>
                          <span className="text-[10px] font-semibold opacity-70">Senha</span>
                          <span className="text-base font-semibold tabular-nums">{String(comanda.counterTicketNumber).padStart(2, "0")}</span>
                        </>
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-slate-800 truncate">
                        {comanda.customerName || dineInOrderLabel(comanda)}
                      </h4>
                      <p className="text-[11px] font-semibold text-slate-400">
                        {comanda.items.length} {comanda.items.length === 1 ? "item" : "itens"}
                      </p>
                      {!!comanda.discount && (
                        <p className="text-[10px] font-semibold text-emerald-600">Com desconto</p>
                      )}
                      <p className="text-sm font-semibold text-blue-600 mt-0.5">{fmt(comanda.total)}</p>
                    </div>
                  </button>
                ))}
              {activeComandas.length === 0 && (
                <EmptyState icon={Hash} title="Nenhuma comanda aberta" className="col-span-full py-20" />
              )}
            </div>
          </div>
        )}

        {/* Delivery Tab — pedidos entregues fora do PDV, aguardando faturar */}
        {activeTab === "delivery" && (
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-slate-400">Delivery Aguardando Faturar</h4>
            </div>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}
            >
              {pendingDeliveryOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => {
                    setBillingOrder(order);
                    // Pré-seleciona a forma de pagamento que o cliente já escolheu ao fazer
                    // o pedido, em vez de sempre abrir em "Dinheiro" por padrão.
                    const m = order.paymentMethod;
                    setBillingPaymentMethod(
                      m === "CREDIT" || m === "STONE_CREDIT" || m === "CIELO_CREDIT" ? "CREDIT"
                      : m === "DEBIT" || m === "STONE_DEBIT" || m === "CIELO_DEBIT" ? "DEBIT"
                      : m === "PIX" || m === "STONE_PIX" || m === "CIELO_PIX" ? "PIX"
                      : m === "VR" ? "VR"
                      : "CASH"
                    );
                  }}
                  className="bg-white p-4 rounded-lg border border-slate-200 hover:border-blue-600 hover:shadow-sm transition-all text-left flex items-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{order.customerName}</h4>
                    <p className="text-[11px] font-semibold text-slate-400">
                      {order.items.length} {order.items.length === 1 ? "item" : "itens"} · Entregue
                    </p>
                    <p className="text-sm font-semibold text-blue-600 mt-0.5">{fmt(order.total)}</p>
                  </div>
                </button>
              ))}
              {pendingDeliveryOrders.length === 0 && (
                <EmptyState icon={Truck} title="Nenhum delivery aguardando faturar" className="col-span-full py-20" />
              )}
            </div>
          </div>
        )}

        {/* Barra de atalhos — desktop apenas (teclado físico) */}
        {!isWaiterMode && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <span className="flex items-center gap-1.5 pr-2 text-slate-400">
              <Zap className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold">Atalhos</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => discountInputRef.current?.focus()}>
              Desconto <kbd className="text-[10px] font-medium bg-slate-200 text-slate-500 rounded px-1 py-0.5">F4</kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleUndoLastItem} disabled={cart.length === 0}>
              Cancelar Item <kbd className="text-[10px] font-medium bg-slate-200 text-slate-500 rounded px-1 py-0.5">F6</kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPriceCheckModal(true)}>
              Consultar Preço <kbd className="text-[10px] font-medium bg-slate-200 text-slate-500 rounded px-1 py-0.5">F7</kbd>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowMoreOptionsMenu((v) => !v)}>
              Mais Opções <kbd className="text-[10px] font-medium bg-slate-200 text-slate-500 rounded px-1 py-0.5">F8</kbd>
            </Button>
          </div>
        )}
      </div>

      {/* ── Floating cart button (mobile/tablet, < lg) ── */}
      {!showCartDrawer && (
        <button
          onClick={() => setShowCartDrawer(true)}
          className="lg:hidden fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-6 h-6" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center border-2 border-white">
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
      } w-full sm:w-auto lg:w-[380px] xl:w-[420px] flex-col bg-white rounded-t-lg sm:rounded-lg text-slate-900 overflow-hidden border border-slate-200 relative shrink-0`}>
        {/* Header */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <IconButton variant="outline" size="md" aria-label="Voltar para os produtos" onClick={() => setShowCartDrawer(false)} title="Voltar para os produtos" className="lg:hidden shrink-0">
                <ArrowLeft size={16} />
              </IconButton>
              <div className="hidden lg:flex w-7 h-7 rounded-lg bg-blue-600/15 text-blue-600 items-center justify-center shrink-0">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-none">
                  {currentContextLabel || "Novo Pedido"}
                </h3>
                <p className="text-slate-500 text-[10px] font-semibold mt-0.5">
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
                <span className="bg-blue-600 text-white text-[11px] font-semibold rounded-full min-w-[20px] h-[20px] px-1.5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
              {(selectedTableId || selectedComandaId || cart.length > 0) && (
                <Button variant="ghost" size="sm" onClick={clearCart} iconLeft={<X size={14} />} className="!text-slate-500 hover:!text-red-600 hover:!bg-red-50">
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Customer info (compact) */}
        <div className="px-3.5 py-2 border-b border-slate-200 relative">
          {linkedCustomer ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-semibold">
                {linkedCustomer.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-slate-900 truncate">{linkedCustomer.name}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {linkedCustomer.phone}
                  {tenant.loyaltyConfig?.enabled && (
                    <span className="text-blue-600"> · {linkedCustomer.loyaltyPoints} pts</span>
                  )}
                </p>
              </div>
              <IconButton variant="ghost" size="sm" aria-label="Remover cliente" onClick={handleClearLinkedCustomer} title="Remover cliente" className="shrink-0">
                <X size={14} />
              </IconButton>
            </div>
          ) : (
            <button
              onClick={() => setCustomerSearchOpen(true)}
              className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-blue-600/50 rounded-lg px-2.5 py-2 transition-colors text-left"
            >
              <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500 flex-1">Cliente (opcional)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          {fiscalEnabled && (
            <div className="relative mt-1.5">
              <Input
                type="text"
                placeholder="CPF ou CNPJ na nota (opcional)"
                value={customerCpf}
                maxLength={18}
                showCount={false}
                iconLeft={<Hash size={13} />}
                className="pl-8"
                onChange={(e) => setCustomerCpf(maskCpfCnpj(e.target.value))}
              />
            </div>
          )}

          {/* Popover de busca/cadastro de cliente */}
          {customerSearchOpen && (
            <div className="absolute left-3.5 right-3.5 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="p-2.5 border-b border-slate-200">
                <div className="relative">
                  <Input
                    autoFocus
                    type="text"
                    placeholder="Buscar por nome, telefone ou CPF..."
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    iconLeft={<Search size={13} />}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="max-h-52 overflow-y-auto custom-scrollbar">
                {customerSearchLoading && (
                  <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Buscando...</p>
                )}
                {!customerSearchLoading && customerSearchTerm.trim().length >= 2 && customerSearchResults.length === 0 && (
                  <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Nenhum cliente encontrado — pode cadastrar digitando nome e telefone abaixo.</p>
                )}
                {customerSearchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-semibold">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{c.phone}</p>
                    </div>
                    {tenant.loyaltyConfig?.enabled && (
                      <span className="text-[10px] font-semibold text-blue-600 shrink-0">{c.loyaltyPoints} pts</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-slate-200 grid grid-cols-2 gap-1.5">
                <Input
                  type="text"
                  placeholder="Nome"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <div className="relative">
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                    status={customerPhone && !isPhoneComplete(customerPhone) ? "error" : "default"}
                  />
                  {customerPhone && !isPhoneComplete(customerPhone) && (
                    <p className="text-[10px] text-red-600 mt-0.5 ml-1">Telefone incompleto</p>
                  )}
                </div>
                <Button
                  onClick={() => setCustomerSearchOpen(false)}
                  disabled={!!customerPhone && !isPhoneComplete(customerPhone)}
                  className="col-span-2 mt-0.5"
                >
                  {customerName || customerPhone ? "Usar estes dados" : "Fechar"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {existingContextItems.length === 0 && cart.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="Carrinho Vazio" className="h-full" />
          ) : (
            <>
              {existingContextItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-400">Já lançado na conta</p>
                    <span className="text-[11px] font-semibold text-blue-600">{fmt(existingContextSubtotal)}</span>
                  </div>
                  {existingContextItems.map((item) => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold truncate">{item.product?.name}</h4>
                        <p className="text-[11px] font-semibold text-slate-500">{item.quantity}x {fmt(item.price)} un.</p>
                        {item.notes && <p className="text-[11px] text-slate-400 mt-0.5">{item.notes}</p>}
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-slate-600 w-16 text-right shrink-0">
                        {fmt(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {cart.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-slate-400">Novos itens desta edição</p>
                    <span className="text-[11px] font-semibold text-emerald-600">{fmt(cart.reduce((acc, item) => acc + item.price * item.quantity, 0))}</span>
                  </div>
                  {cart.map((item, itemIndex) => (
                    <div key={`${item.product.id}-${itemIndex}`} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-2 hover:border-blue-200 transition-colors">
                      <div className="flex items-start gap-2.5">
                        {item.product.imageUrl ? (
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200 bg-slate-50" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Utensils size={14} className="text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-slate-700 leading-snug line-clamp-2 break-words">
                            {item.product.name}
                            {item.productVariantId && item.product.variants ? (() => {
                              const v = item.product.variants.find(v => v.id === item.productVariantId);
                              return v ? ` (${v.name})` : "";
                            })() : ""}
                          </h4>
                          {item.notes && <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{item.notes}</p>}
                        </div>
                        <div className="flex items-center shrink-0 -mt-1 -mr-1">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Editar observações e variações"
                            onClick={(e) => {
                              e.stopPropagation();
                              openProductOptions(item.product, itemIndex);
                            }}
                            title="Editar Observações/Variações"
                            className="border-transparent text-slate-400 hover:text-blue-600"
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Remover item"
                            title="Remover item"
                            onClick={() => removeFromCart(itemIndex)}
                            className="border-transparent text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg shrink-0">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Diminuir quantidade"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(itemIndex, -1); }}
                            className="border-transparent touch-manipulation"
                          >
                            <Minus size={12} />
                          </IconButton>
                          <span className="text-xs font-semibold w-7 text-center tabular-nums text-slate-700">{item.quantity}</span>
                          <IconButton
                            variant="ghost"
                            size="sm"
                            aria-label="Aumentar quantidade"
                            onClick={(e) => { e.stopPropagation(); updateQuantity(itemIndex, 1); }}
                            className="border-transparent touch-manipulation"
                          >
                            <Plus size={12} />
                          </IconButton>
                        </div>
                        <div className="flex flex-col items-end leading-tight min-w-0">
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">{fmt(item.price)} × {item.quantity}</span>
                          <span className="text-sm font-semibold tabular-nums text-slate-800 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0">
          {/* Discount row */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-50 rounded-lg overflow-hidden border border-slate-200">
              <Button
                variant={discountType === "FIXED" ? "primary" : "ghost"}
                size="lg"
                className="!min-w-[40px] !rounded-none"
                onClick={() => { setDiscountType("FIXED"); setDiscountValue(""); }}
              >
                R$
              </Button>
              <Button
                variant={discountType === "PERCENT" ? "primary" : "ghost"}
                size="lg"
                className="!min-w-[40px] !rounded-none"
                onClick={() => { setDiscountType("PERCENT"); setDiscountValue(""); }}
              >
                %
              </Button>
            </div>
            <div className="relative flex-1">
              {discountType === "FIXED" ? (
                <Input
                  ref={discountInputRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formatCurrencyDigits(discountValue)}
                  onChange={(e) => setDiscountValue(maskCurrencyDigits(e.target.value))}
                  title="Atalho: F4"
                  iconLeft={<Tag size={13} />}
                  className="pl-8 pr-8"
                />
              ) : (
                <Input
                  ref={discountInputRef}
                  type="number"
                  placeholder="Desconto %"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  title="Atalho: F4"
                  iconLeft={<Tag size={13} />}
                  className="pl-8 pr-8"
                />
              )}
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">F4</span>
            </div>
            {discountAmount > 0 && (
              <span className="text-xs font-semibold text-emerald-600 whitespace-nowrap">-{fmt(discountAmount)}</span>
            )}
          </div>

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[11px] font-semibold text-emerald-600">
                <span>Desconto</span>
                <span className="tabular-nums">-{fmt(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-2 mt-1 border-t border-slate-200">
              <span className="text-xs font-semibold text-blue-600">Total</span>
              <span className="text-2xl font-semibold tabular-nums text-slate-900">{fmt(total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className={isWaiterMode || isClosingAccount ? "grid grid-cols-1" : "grid grid-cols-2 gap-3"}>
            {!isClosingAccount && (
              <Button
                variant={isWaiterMode ? "primary" : "outline"}
                size="lg"
                className="!h-11"
                disabled={cart.length === 0}
                loading={isProcessing}
                onClick={() => {
                  if (selectedTableId || selectedComandaId) void handleLaunchOrder();
                  else { setConsumptionType("EAT_IN"); setShowComandaModal(true); }
                }}
                iconRight={<Package size={14} />}
              >
                {selectedTableId || selectedComandaId ? "Adicionar Itens" : "Lançar Pedido"}
              </Button>
            )}
            {!isWaiterMode && (
              <Button
                size="lg"
                className="relative !h-11"
                disabled={checkoutItems.length === 0 || (cashRequired && !currentCash)}
                title={cashRequired && !currentCash ? "Abra o caixa para receber pagamentos" : "Atalho: F2"}
                onClick={() => { setShowCheckout(true); setShowCartDrawer(false); }}
                iconRight={<ChevronRight size={14} />}
              >
                Pagar
                <span className="ml-1 text-[10px] font-medium opacity-60">F2</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de Consulta de Preço (F7) — só consulta, não adiciona ao carrinho ── */}
      <Modal
        open={showPriceCheckModal}
        onClose={() => { setShowPriceCheckModal(false); setPriceCheckTerm(""); }}
        title="Consultar Preço"
        subtitle="Atalho F7"
        size="sm"
      >
        <div className="space-y-3">
          <Input
            autoFocus
            type="text"
            value={priceCheckTerm}
            onChange={(e) => setPriceCheckTerm(e.target.value)}
            placeholder="Nome do produto..."
            iconLeft={<Search size={14} />}
            className="pl-9"
          />
          <div className="space-y-1">
            {priceCheckTerm.trim() === "" ? (
              <EmptyState icon={Search} title="Digite o nome do produto para consultar o preço." />
            ) : priceCheckResults.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum produto encontrado." />
            ) : (
              priceCheckResults.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <span className="text-[13px] font-medium text-slate-700 truncate">{p.name}</span>
                  <span className="text-[13px] font-semibold text-slate-900 tabular-nums shrink-0">{fmt(p.price)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ── Menu de Mais Opções (F8) ── */}
      <Modal
        open={showMoreOptionsMenu}
        onClose={() => setShowMoreOptionsMenu(false)}
        title="Mais Opções"
        subtitle="Atalho F8"
        size="xs"
      >
        <div className="space-y-1">
          {cashRequired && currentCash && (
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="!justify-start !h-10"
              onClick={() => { setShowMoreOptionsMenu(false); setShowCloseCashModal(true); }}
              iconLeft={<DoorClosed size={14} className="text-red-500" />}
            >
              Fechar Caixa
            </Button>
          )}
          {(selectedTableId || selectedComandaId || cart.length > 0) && (
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="!justify-start !h-10"
              onClick={() => { setShowMoreOptionsMenu(false); clearCart(); }}
              iconLeft={<Trash2 size={14} className="text-red-500" />}
            >
              Limpar Pedido Atual
            </Button>
          )}
          {onOpenFullscreen && (
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              className="!justify-start !h-10"
              onClick={() => { setShowMoreOptionsMenu(false); onOpenFullscreen(); }}
              iconLeft={<ExternalLink size={14} />}
            >
              Nova Janela
            </Button>
          )}
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            className="!justify-start !h-10"
            onClick={() => { setShowMoreOptionsMenu(false); toggleBrowserFullscreen(); }}
            iconLeft={isBrowserFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          >
            {isBrowserFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          </Button>
        </div>
      </Modal>

      {/* ── Modal de Detalhes da Mesa/Comanda ── */}
      {orderDetailsView && (() => {
          const isTable = orderDetailsView.type === "table";
          const title = isTable ? `Mesa ${orderDetailsView.tableId}` : dineInOrderLabel(orderDetailsView.comanda);
          // comandaGroupId (quando presente) é a fonte de verdade — nunca reseta nem
          // colide. counterTicketNumber se repete todo dia; pedidos anteriores à
          // migration que introduziu comandaGroupId caem no fallback por senha+dia
          // (mesma causa do bug corrigido em currentContextOrders).
          const comandaGroupIdRef = !isTable ? orderDetailsView.comanda.comandaGroupId ?? null : null;
          const comandaCreatedAt = !isTable && orderDetailsView.comanda.createdAt ? new Date(orderDetailsView.comanda.createdAt) : null;
          const comandaDayStart = comandaCreatedAt ? new Date(comandaCreatedAt.getFullYear(), comandaCreatedAt.getMonth(), comandaCreatedAt.getDate()) : null;
          const comandaDayEnd = comandaDayStart ? new Date(comandaDayStart.getTime() + 24 * 60 * 60 * 1000) : null;
          const relatedOrders = isTable
            ? orders.filter((o) => o.tableId === orderDetailsView.tableId && o.status !== "CANCELLED" && o.status !== "DELIVERED" && o.status !== "MERGED" && !o.billed)
            : orders.filter((o) =>
                (
                  (orderDetailsView.comanda.counterTicketNumber != null &&
                    o.counterTicketNumber === orderDetailsView.comanda.counterTicketNumber &&
                    (comandaGroupIdRef
                      ? o.comandaGroupId === comandaGroupIdRef
                      : (!comandaDayStart || !comandaDayEnd || (new Date(o.createdAt) >= comandaDayStart && new Date(o.createdAt) < comandaDayEnd)))) ||
                  o.id === orderDetailsView.comanda.id
                ) &&
                o.status !== "CANCELLED" &&
                o.status !== "DELIVERED" &&
                o.status !== "MERGED" &&
                !o.billed
              );
          const detailSubtotal = relatedOrders.reduce((acc, order) => acc + order.total, 0);

          return (
            <Modal
              open
              onClose={() => setOrderDetailsView(null)}
              title={title}
              subtitle={`${relatedOrders.length} pedido${relatedOrders.length !== 1 ? "s" : ""} em aberto`}
              size="md"
              footer={
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-xs font-medium text-slate-500">Total da conta</span>
                    <span className="text-lg font-semibold tabular-nums text-slate-900">{fmt(detailSubtotal)}</span>
                  </div>
                  <ModalFooter>
                    <Button
                      variant="outline"
                      onClick={() => isTable ? handleLoadTable(orderDetailsView.tableId) : handleLoadComanda(orderDetailsView.comanda)}
                      iconLeft={<Plus size={14} />}
                    >
                      Abrir no PDV
                    </Button>
                    {!isWaiterMode && (
                      <Button
                        disabled={relatedOrders.length === 0}
                        onClick={() => handleGoToCheckoutFromDetails(orderDetailsView)}
                        iconRight={<ChevronRight size={14} />}
                      >
                        Fechar Conta
                      </Button>
                    )}
                  </ModalFooter>
                </div>
              }
            >
                <div className="space-y-3">
                  {relatedOrders.length === 0 ? (
                    <EmptyState icon={Utensils} title="Nenhum item lançado ainda" description="Abra no PDV para lançar os primeiros itens." />
                  ) : (
                    relatedOrders.map((order, idx) => (
                      <div key={order.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800">Pedido {idx + 1}</p>
                            <p className="text-[11px] text-slate-500">#{order.id.slice(-6).toUpperCase()} · {fmt(order.total)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="xs"
                            iconLeft={<Trash2 size={12} />}
                            className="shrink-0 !text-red-600 hover:!bg-red-50"
                            onClick={() => setPendingLossConfirm({ kind: "order", orderId: order.id })}
                            disabled={detailActionId === `cancel-${order.id}`}
                          >
                            {detailActionId === `cancel-${order.id}` ? "Cancelando..." : "Cancelar pedido"}
                          </Button>
                        </div>

                        <ul className="divide-y divide-slate-100">
                          {order.items.filter((item) => item.product).map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-medium text-slate-800">
                                  <span className="mr-1 tabular-nums text-slate-500">{item.quantity}x</span>
                                  {item.product?.name}
                                  {item.productVariant?.name ? ` (${item.productVariant.name})` : ""}
                                </p>
                                {item.notes && <p className="mt-0.5 text-[11px] italic text-slate-500">{item.notes}</p>}
                              </div>
                              <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-slate-800">{fmt(item.price * item.quantity)}</span>
                              <div className="flex shrink-0 items-center gap-1">
                                {item.quantity > 1 && (
                                  <IconButton
                                    variant="outline"
                                    size="sm"
                                    aria-label="Remover uma unidade"
                                    title="Remover 1 unidade"
                                    onClick={() => setPendingLossConfirm({ kind: "item", orderId: order.id, itemId: item.id, nextQuantity: item.quantity - 1, label: `${item.product?.name}` })}
                                    disabled={detailActionId === item.id}
                                  >
                                    <Minus size={13} />
                                  </IconButton>
                                )}
                                <IconButton
                                  variant="outline"
                                  size="sm"
                                  aria-label="Cancelar item"
                                  title="Cancelar item"
                                  className="!text-red-600 hover:!border-red-200 hover:!bg-red-50"
                                  onClick={() => setPendingLossConfirm({ kind: "item", orderId: order.id, itemId: item.id, nextQuantity: 0, label: `${item.quantity}x ${item.product?.name}` })}
                                  loading={detailActionId === item.id}
                                >
                                  <Trash2 size={13} />
                                </IconButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </div>
            </Modal>
          );
        })()}

      {/* ── Confirmação de perda ao cancelar item/pedido lançado ── */}
      <Modal
        open={!!pendingLossConfirm}
        onClose={() => setPendingLossConfirm(null)}
        title={pendingLossConfirm?.kind === "item" ? `Cancelar "${pendingLossConfirm.label}"?` : "Cancelar este pedido?"}
        size="sm"
        zIndex={400}
        footer={
          <ModalFooter align="between">
            <Button variant="ghost" onClick={() => setPendingLossConfirm(null)}>Voltar</Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => resolveLossConfirm(false)}>Não, devolver ao estoque</Button>
              <Button variant="danger" onClick={() => resolveLossConfirm(true)}>Sim, houve perda</Button>
            </div>
          </ModalFooter>
        }
      >
        <p className="text-[13px] text-slate-600">
          Houve gasto/perda no preparo (item já feito, não pode ser reaproveitado)? Se sim, o item será descontado do estoque.
        </p>
      </Modal>

      {/* ── Comanda Modal ── */}
      <Modal
        open={showComandaModal}
        onClose={() => { setShowComandaModal(false); setComandaNumber(""); setConsumptionType("EAT_IN"); setComandaDiscountValue(""); setComandaDiscountType("FIXED"); }}
        title="Abrir Comanda"
        subtitle="Identifique o cliente ou o cartão"
        size="sm"
        zIndex={300}
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => { setShowComandaModal(false); setComandaNumber(""); setConsumptionType("EAT_IN"); setComandaDiscountValue(""); setComandaDiscountType("FIXED"); }}>Cancelar</Button>
            <Button
              disabled={(tenant.counterTicketMode !== "NAME" && nextTicketLoading) || !consumptionType}
              loading={isProcessing}
              onClick={() => void handleCreateComanda()}
            >
              Abrir / Lançar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          {/* Comer no local ou viagem — obrigatório pra toda comanda de balcão (sem mesa) */}
          <div className="space-y-1">
            <label className="ds-label">Comer no local ou viagem?</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={consumptionType === "EAT_IN" ? "primary" : "outline"}
                size="lg"
                onClick={() => setConsumptionType("EAT_IN")}
                iconLeft={<Utensils size={14} />}
              >
                Comer no local
              </Button>
              <Button
                variant={consumptionType === "TAKEOUT" ? "primary" : "outline"}
                size="lg"
                onClick={() => setConsumptionType("TAKEOUT")}
                iconLeft={<Package size={14} />}
              >
                Viagem
              </Button>
            </div>
          </div>

          {/* Próxima senha — some se a loja desativou a senha sequencial do Balcão
              em Configurações (Senha do Balcão: Nome do cliente). Mostrada como uma
              linha compacta em vez de um card grande — é só um número de apoio. */}
          {tenant.counterTicketMode !== "NAME" && (
            <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
              <p className="text-[11px] font-medium text-slate-500">Próxima senha</p>
              {nextTicketLoading ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-xl font-semibold text-blue-600 tabular-nums">
                  Nº {nextTicket ?? "—"}
                </span>
              )}
            </div>
          )}

          {/* Identificação opcional */}
          <Input
            label="Nome / Identificação (opcional)"
            type="text"
            autoFocus
            value={comandaNumber}
            onChange={(e) => setComandaNumber(e.target.value)}
            placeholder="Ex: João ou Mesa VIP"
            hint={tenant.counterTicketMode === "NAME" ? "Deixe em branco se não quiser identificar o pedido" : "Deixe em branco para usar só a senha numérica"}
          />

          {/* Desconto na abertura (opcional) — vale sobre o total da comanda inteira,
              incluindo itens lançados depois, até o fechamento. */}
          <div className="space-y-1">
            <label className="ds-label">Desconto na comanda (opcional)</label>
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-50 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                <Button
                  variant={comandaDiscountType === "FIXED" ? "primary" : "ghost"}
                  size="lg"
                  className="!min-w-[40px] !rounded-none"
                  onClick={() => { setComandaDiscountType("FIXED"); setComandaDiscountValue(""); }}
                >
                  R$
                </Button>
                <Button
                  variant={comandaDiscountType === "PERCENT" ? "primary" : "ghost"}
                  size="lg"
                  className="!min-w-[40px] !rounded-none"
                  onClick={() => { setComandaDiscountType("PERCENT"); setComandaDiscountValue(""); }}
                >
                  %
                </Button>
              </div>
              {comandaDiscountType === "FIXED" ? (
                <Input
                  wrapperClassName="flex-1 min-w-0"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={formatCurrencyDigits(comandaDiscountValue)}
                  onChange={(e) => setComandaDiscountValue(maskCurrencyDigits(e.target.value))}
                />
              ) : (
                <Input
                  wrapperClassName="flex-1 min-w-0"
                  type="number"
                  placeholder="Desconto %"
                  value={comandaDiscountValue}
                  onChange={(e) => setComandaDiscountValue(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Faturar Delivery Modal ── */}
      <Modal
        open={!!billingOrder}
        onClose={() => setBillingOrder(null)}
        title="Faturar Delivery"
        subtitle={billingOrder ? `${billingOrder.customerName} · ${fmt(billingOrder.total)}` : undefined}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setBillingOrder(null)}>Cancelar</Button>
            <Button
              loading={isBilling}
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
            >
              Confirmar e Faturar
            </Button>
          </ModalFooter>
        }
      >
        {billingOrder && (
          <div className="space-y-3">
            <label className="ds-label">Como foi pago?</label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 space-y-1">
              {billingOrder.items.filter((item) => item.product).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                  <span className="font-medium text-slate-600 truncate">{item.quantity}x {item.product?.name}</span>
                  <span className="font-semibold text-slate-700 whitespace-nowrap">{fmt(item.price * item.quantity)}</span>
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
                <Button
                  key={opt.id}
                  variant={billingPaymentMethod === opt.id ? "primary" : "outline"}
                  size="lg"
                  onClick={() => setBillingPaymentMethod(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Tela de Pagamento — tela cheia, não modal flutuante, pra ter espaço de sobra
          pros controles (Cancelar, Finalizar, Voltar, Adicionar mais itens) ── */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white flex flex-col"
          >
              {/* Header — título e botão cancelar sempre visíveis, fora da área de conteúdo,
                  pra nunca competir por espaço com "Dividir Pagamento" ou outros controles. */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400">Pagamento</span>
              </div>

              <div className="flex-1 flex flex-col md:flex-row min-h-0">
              {/* Left: Summary */}
              <div className="w-full md:w-80 lg:w-96 bg-slate-50 p-4 flex flex-col border-r border-slate-200 overflow-y-auto custom-scrollbar shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 self-start"
                  iconLeft={<ArrowLeft size={14} />}
                  onClick={() => {
                    // isClosingAccount fica true quando o pagamento foi aberto direto do
                    // "Fechar Conta" numa comanda (handleGoToCheckoutFromDetails) e nunca era
                    // resetado ao voltar — o botão "Adicionar Itens" do carrinho fica escondido
                    // pra sempre (só "Pagar"), mesmo a comanda ainda podendo receber mais itens.
                    setIsClosingAccount(false);
                    setShowCheckout(false);
                    setShowCartDrawer(true);
                  }}
                >
                  Voltar ao Carrinho
                </Button>

                <Button
                  variant={showAddItemsPanel ? "primary" : "outline"}
                  size="lg"
                  className="mb-3"
                  onClick={() => setShowAddItemsPanel((v) => !v)}
                  iconLeft={<Plus size={14} />}
                >
                  {showAddItemsPanel ? "Fechar produtos" : "Adicionar mais itens"}
                </Button>

                <p className="text-[11px] font-semibold text-slate-500 mb-1">Resumo</p>
                <h3 className="text-base font-semibold text-slate-900 mb-3 truncate">
                  {currentContextLabel || customerName || "Venda Balcão"}
                </h3>

                {isCounterSale && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                      Comer no local ou viagem?
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        variant={consumptionType === "EAT_IN" ? "primary" : "outline"}
                        size="lg"
                        onClick={() => setConsumptionType("EAT_IN")}
                        iconLeft={<Utensils size={14} />}
                      >
                        Comer no local
                      </Button>
                      <Button
                        variant={consumptionType === "TAKEOUT" ? "primary" : "outline"}
                        size="lg"
                        onClick={() => setConsumptionType("TAKEOUT")}
                        iconLeft={<Package size={14} />}
                      >
                        Viagem
                      </Button>
                    </div>
                  </div>
                )}

                {/* Cliente / CPF-CNPJ na nota — mesmo estado usado no carrinho, só que
                    acessível aqui também, pra não precisar voltar pra vincular ou
                    corrigir o documento antes de finalizar e emitir a NF. */}
                <div className="relative mb-3 space-y-1.5">
                  {linkedCustomer ? (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-semibold">
                        {linkedCustomer.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-slate-900 truncate">{linkedCustomer.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{linkedCustomer.phone}</p>
                      </div>
                      <IconButton variant="ghost" size="sm" aria-label="Remover cliente" onClick={handleClearLinkedCustomer} title="Remover cliente" className="shrink-0">
                        <X size={14} />
                      </IconButton>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCustomerSearchOpen(true)}
                      className="w-full flex items-center gap-2 bg-slate-50 border border-slate-200 hover:border-blue-600/50 rounded-lg px-2.5 py-2 transition-colors text-left"
                    >
                      <User className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-slate-500 flex-1">Cliente (opcional)</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                  {fiscalEnabled && (
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="CPF ou CNPJ na nota (opcional)"
                        value={customerCpf}
                        maxLength={18}
                        showCount={false}
                        iconLeft={<Hash size={13} />}
                        className="pl-8"
                        onChange={(e) => setCustomerCpf(maskCpfCnpj(e.target.value))}
                      />
                    </div>
                  )}
                  {!autoEmitNfce && fiscalEnabled && (
                    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 cursor-pointer hover:border-blue-600/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={requestNfce}
                        onChange={(e) => setRequestNfce(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
                      />
                      <span className="text-[11px] font-semibold text-slate-600">Cliente pediu Nota Fiscal (NFC-e)</span>
                    </label>
                  )}
                  {autoEmitNfce && fiscalEnabled && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="text-[11px] font-semibold text-emerald-700">NFC-e automática ativada</span>
                    </div>
                  )}

                  {/* Popover de busca/cadastro de cliente — cópia do que já existe no
                      carrinho, pois aquele fica escondido atrás desta tela em tela cheia. */}
                  {customerSearchOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                      <div className="p-2.5 border-b border-slate-200">
                        <div className="relative">
                          <Input
                            autoFocus
                            type="text"
                            placeholder="Buscar por nome, telefone ou CPF..."
                            value={customerSearchTerm}
                            onChange={(e) => setCustomerSearchTerm(e.target.value)}
                            iconLeft={<Search size={13} />}
                            className="pl-8"
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto custom-scrollbar">
                        {customerSearchLoading && (
                          <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Buscando...</p>
                        )}
                        {!customerSearchLoading && customerSearchTerm.trim().length >= 2 && customerSearchResults.length === 0 && (
                          <p className="px-3 py-3 text-[11px] text-slate-400 text-center">Nenhum cliente encontrado — pode cadastrar digitando nome e telefone abaixo.</p>
                        )}
                        {customerSearchResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="w-6 h-6 rounded-full bg-blue-600/20 text-blue-600 flex items-center justify-center shrink-0 text-[11px] font-semibold">
                              {c.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-900 truncate">{c.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{c.phone}</p>
                            </div>
                            {tenant.loyaltyConfig?.enabled && (
                              <span className="text-[10px] font-semibold text-blue-600 shrink-0">{c.loyaltyPoints} pts</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="p-2 border-t border-slate-200 grid grid-cols-2 gap-1.5">
                        <Input
                          type="text"
                          placeholder="Nome"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <div className="relative">
                          <Input
                            type="tel"
                            placeholder="(00) 00000-0000"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(maskPhone(e.target.value))}
                            status={customerPhone && !isPhoneComplete(customerPhone) ? "error" : "default"}
                          />
                          {customerPhone && !isPhoneComplete(customerPhone) && (
                            <p className="text-[10px] text-red-600 mt-0.5 ml-1">Telefone incompleto</p>
                          )}
                        </div>
                        <Button
                          onClick={() => setCustomerSearchOpen(false)}
                          disabled={!!customerPhone && !isPhoneComplete(customerPhone)}
                          className="col-span-2 mt-0.5"
                        >
                          {customerName || customerPhone ? "Usar estes dados" : "Fechar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {billableLines.map((line) => (
                    <div key={line.lineKey} className="border-b border-slate-200 pb-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600 truncate mr-2">
                          {line.quantity}x {line.name}
                          {line.notes && <span className="text-[11px] italic text-slate-400 block">{line.notes}</span>}
                        </span>
                        <span className="font-semibold text-slate-900 whitespace-nowrap">{fmt(line.total)}</span>
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
                                className={`text-[11px] font-medium min-h-[28px] px-2.5 py-1 rounded-full border transition-colors ${
                                  active
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
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

                <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Desconto</span><span className="tabular-nums">-{fmt(discountAmount)}</span>
                    </div>
                  )}
                  {feeInfo.amount > 0 && (
                    <div className="flex justify-between text-xs text-amber-600">
                      <span>Taxa maquininha ({feeInfo.percent.toFixed(2).replace(".", ",")}%){feeInfo.passToCustomer ? "" : " — absorvida"}</span>
                      <span className="tabular-nums">{feeInfo.passToCustomer ? "+" : ""}{fmt(feeInfo.amount)}</span>
                    </div>
                  )}
                  {!!serviceChargeConfig?.enabled && (
                    <label className="flex items-center justify-between text-xs text-blue-600 cursor-pointer gap-2">
                      <span className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={serviceChargeChecked}
                          onChange={(e) => setServiceChargeChecked(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-blue-600"
                        />
                        Taxa de serviço ({(serviceChargeConfig.percent || 0).toFixed(0)}%)
                      </span>
                      <span className="tabular-nums">{serviceChargeAmount > 0 ? `+${fmt(serviceChargeAmount)}` : fmt(0)}</span>
                    </label>
                  )}
                  <div className="flex justify-between pt-2 mt-1 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-blue-600 self-end">Total</span>
                    <span className="text-2xl font-semibold text-slate-900 tabular-nums">{fmt(finalTotal)}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="lg"
                  className="mt-3"
                  onClick={handlePrintPreCheckout}
                  iconLeft={<Printer size={14} />}
                >
                  Imprimir Pedido
                </Button>
              </div>

              {/* Middle: Adicionar mais itens — mesma grade de produtos do PDV, embutida
                  aqui pra não precisar sair da tela de pagamento (e perder a divisão por
                  pessoa já montada) só pra lançar um item esquecido. */}
              {showAddItemsPanel && (
                <div className="w-full md:w-72 lg:w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-0">
                  <div className="p-3 border-b border-slate-200 shrink-0">
                    <Input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar produto..."
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5">
                    {filteredProducts.length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 py-8">Nenhum produto encontrado</p>
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
                            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg border text-left transition-colors ${
                              inCart ? "bg-blue-600/10 border-blue-600/40" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            <div className="w-11 h-11 bg-slate-50 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                              {product.imageUrl ? (
                                <img src={product.imageUrl} className="w-full h-full object-cover" alt={product.name} />
                              ) : (
                                <Utensils className="w-5 h-5 text-slate-400" />
                              )}
                              {inCart && (
                                <div className="absolute top-0.5 left-0.5 min-w-[15px] h-[15px] px-1 bg-blue-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center shadow">
                                  {inCart.quantity}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-semibold text-slate-900 truncate">{product.name}</p>
                              <p className="text-[11px] text-slate-500">{fmt(product.price)}</p>
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
                      <p className="text-[11px] font-semibold text-slate-500">Forma de Pagamento</p>
                      {paymentMethod !== "STONE" && paymentMethod !== "CIELO" && (
                        <Button
                          variant={isSplitMode ? "primary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setIsSplitMode((v) => !v);
                            if (isSplitMode) {
                              setPaymentSplits([]);
                              setItemPersonAssignment({});
                            }
                          }}
                          iconLeft={<Split size={14} />}
                        >
                          Dividir Pagamento
                        </Button>
                      )}
                    </div>

                    {isSplitMode && (
                      <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <Tabs
                          label="Modo de divisão"
                          items={SPLIT_MODE_TABS}
                          value={splitByItem ? "item" : "equal"}
                          onChange={(v) => setSplitByItem(v === "item")}
                          className="!space-y-0"
                        >
                          {null}
                        </Tabs>

                        {!splitByItem ? (
                          <>
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 mb-1">Divisão por grupo</p>
                            <Input
                              type="number"
                              min={2}
                              value={groupSplitCount}
                              onChange={(e) => setGroupSplitCount(e.target.value.replace(/\D/g, ""))}
                              placeholder="2"
                            />
                          </div>
                          <Button size="lg" onClick={handleGenerateGroupSplit}>
                            Gerar
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Se sobrar centavos, o ajuste fica na primeira pessoa.
                        </p>
                          </>
                        ) : (
                          <>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-400">Pessoas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {splitPersonLabels.map((label, idx) => (
                              <span key={idx} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full pl-2.5 pr-1 py-1">
                                <span className="text-[11px] font-semibold text-slate-900">{label}</span>
                                {splitPersonLabels.length > 2 && (
                                  <IconButton variant="ghost" size="xs" aria-label="Remover pessoa" onClick={() => handleRemoveSplitPerson(idx)} className="border-transparent text-slate-400 hover:text-red-600">
                                    <X size={12} />
                                  </IconButton>
                                )}
                              </span>
                            ))}
                            <Button variant="outline" size="sm" onClick={handleAddSplitPerson} iconLeft={<Plus size={14} />}>
                              Pessoa
                            </Button>
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Toque nas pessoas ao lado de cada item no Resumo pra marcar de quem é. Itens sem marcação são divididos igualmente entre todos.
                          </p>
                          <Button size="lg" fullWidth onClick={handleGenerateItemSplit}>
                            Gerar divisão por item
                          </Button>
                        </div>
                          </>
                        )}
                        {paymentSplits.length === 0 ? (
                          <p className="text-[11px] text-slate-400 text-center py-2">Gere a divisão por grupo ou escolha a forma abaixo e clique em "Adicionar Forma".</p>
                        ) : (
                          normalizedPaymentSplits.map((split) => {
                            return (
              <div key={split.id} className="flex items-start gap-2 bg-slate-50 rounded-lg px-2.5 py-2">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  {split.personLabel && (
                                    <div className="flex items-baseline gap-1.5">
                                      <span className="text-[11px] font-semibold text-blue-600 shrink-0">{split.personLabel}:</span>
                                      <span className="text-[11px] text-slate-500 truncate">{split.personItems || "sem itens marcados"}</span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-4 gap-1">
                                    {PAYMENT_METHODS.filter((method) => method.id !== "STONE" && method.id !== "CIELO").map((method) => {
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
                                              ? "bg-blue-600 border-blue-600"
                                              : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                          }`}
                                        >
                                          <Icon className={`w-3 h-3 ${active ? "text-white" : "text-slate-600"}`} />
                                          <span className={`text-[10px] font-semibold  leading-none ${active ? "text-white" : "text-slate-600"}`}>{method.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {getBrandsForPaymentMethod(split.method).length > 0 && (
                                    <Select
                                      value={split.cardBrand || ""}
                                      onChange={(e) => handleUpdateSplitCardBrand(split.id, e.target.value)}
                                    >
                                      <option value="">Selecione a bandeira</option>
                                      {getBrandsForPaymentMethod(split.method).map((brand) => (
                                        <option key={brand} value={brand}>{brand}</option>
                                      ))}
                                    </Select>
                                  )}
                                  {split.method === "CREDIT" && (
                                    <Select
                                      value={split.installments || 1}
                                      onChange={(e) => handleUpdateSplitInstallments(split.id, Number(e.target.value))}
                                    >
                                      {getInstallmentOptionsForMethod(split.method, split.cardBrand).map((option) => (
                                        <option key={option} value={option}>
                                          {option}x {option === 1 ? "\u00E0 vista" : fmt(split.amount / option)}
                                        </option>
                                      ))}
                                    </Select>
                                  )}
                                </div>
                                <div className="relative w-24">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatCurrencyDigits(numberToDigits(split.amount))}
                                    onChange={(e) => handleUpdateSplitAmount(split.id, digitsToNumber(maskCurrencyDigits(e.target.value.replace(/\D/g, ""))))}
                                    className="pl-6 pr-1.5 text-right"
                                  />
                                </div>
                                <IconButton variant="ghost" size="sm" aria-label="Remover forma de pagamento" onClick={() => handleRemovePaymentSplit(split.id)} className="shrink-0 border-transparent text-slate-400 hover:text-red-600">
                                  <X size={14} />
                                </IconButton>
                              </div>
                            );
                          })
                        )}
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-500">
                            {splitOverpaidAmount > 0 ? "Excedente" : "Falta pagar"}
                          </span>
                          <span className={`text-xs font-semibold tabular-nums ${splitOverpaidAmount > 0 ? "text-red-600" : splitRemaining > 0 ? "text-blue-600" : "text-emerald-600"}`}>
                            {fmt(splitOverpaidAmount > 0 ? splitOverpaidAmount : splitRemaining)}
                          </span>
                        </div>
                        {splitOverpaidAmount > 0 && (
                          <p className="text-[10px] text-red-600">
                            Ajuste os valores das divis\u00F5es para fechar a conta sem excedente.
                          </p>
                        )}
                        {splitRemaining > 0 && (
                          <>
                            <p className="text-[10px] font-semibold text-slate-400 pt-1">Escolha a forma pra adicionar</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {PAYMENT_METHODS.filter((m) => m.id !== "STONE" && m.id !== "CIELO").map((method) => {
                                const Icon = method.icon;
                                const active = paymentMethod === method.id;
                                return (
                                  <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${
                                      active
                                        ? "bg-blue-600 border-blue-600"
                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                                    }`}
                                  >
                                    <Icon className={`w-3.5 h-3.5 ${active ? "text-white" : "text-slate-600"}`} />
                                    <span className={`text-[10px] font-semibold  ${active ? "text-white" : "text-slate-600"}`}>{method.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {paymentMethod !== "STONE" && paymentMethod !== "CIELO" && getBrandsForPaymentMethod(paymentMethod as SplitPaymentMethod).length > 0 && (
                              <Select
                                value={normalizedCardBrand || ""}
                                onChange={(e) => setCardBrand(e.target.value)}
                              >
                                {getBrandsForPaymentMethod(paymentMethod as SplitPaymentMethod).map((brand) => (
                                  <option key={brand} value={brand}>{brand}</option>
                                ))}
                              </Select>
                            )}
                            {paymentMethod === "CREDIT" && (
                              <Select
                                value={installments}
                                onChange={(e) => setInstallments(Number(e.target.value))}
                              >
                                {creditInstallmentOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}x {option === 1 ? "\u00E0 vista" : fmt(splitRemaining / option)}
                                  </option>
                                ))}
                              </Select>
                            )}
                            <Button variant="outline" size="lg" fullWidth onClick={handleAddPaymentSplit} iconLeft={<Plus size={14} />}>
                              Adicionar {PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.label} ({fmt(splitRemaining)})
                            </Button>
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
                              className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-2 sm:py-2.5 rounded-lg border transition-all ${
                                active
                                  ? "bg-blue-600 border-blue-600 "
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-600"}`} />
                              <span className={`text-[10px] font-semibold   leading-none ${active ? "text-white" : "text-slate-600"}`}>
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
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-blue-600 ml-1">Valor Recebido</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            autoFocus
                            value={formatCurrencyDigits(amountReceived)}
                            onChange={(e) => setAmountReceived(maskCurrencyDigits(e.target.value))}
                            placeholder="0,00"
                            addonLeft="R$"
                            className="text-center text-base font-semibold"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          {[finalTotal, Math.ceil(finalTotal / 10) * 10, Math.ceil(finalTotal / 50) * 50].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3).map((v) => (
                            <Button
                              key={v}
                              variant="outline"
                              size="lg"
                              className="flex-1"
                              onClick={() => setAmountReceived(numberToDigits(v))}
                            >
                              {fmt(v)}
                            </Button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          <p className="text-[11px] font-semibold text-slate-500">Troco</p>
                          <p className={`text-xl font-semibold tabular-nums ${change > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                            {fmt(change)}
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentMethod === "CREDIT" && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                        <p className="text-[11px] font-semibold text-slate-500">Parcelamento</p>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {creditInstallmentOptions.map((n) => (
                            <Button
                              key={n}
                              variant={installments === n ? "primary" : "outline"}
                              size="lg"
                              onClick={() => setInstallments(n)}
                            >
                              {n}x {n === 1 ? "à vista" : fmt(finalTotal / n)}
                            </Button>
                          ))}
                        </div>
                        {CARD_BRANDS.length > 0 && (
                          <>
                            <p className="text-[11px] font-semibold text-slate-500 pt-1">Bandeira</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {CARD_BRANDS.map((brand) => (
                                <Button key={brand} variant={cardBrand === brand ? "primary" : "outline"} size="lg" onClick={() => setCardBrand(brand)}>{brand}</Button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {paymentMethod === "DEBIT" && CARD_BRANDS.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                        <p className="text-[11px] font-semibold text-slate-500">Bandeira</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CARD_BRANDS.map((brand) => (
                            <Button key={brand} variant={cardBrand === brand ? "primary" : "outline"} size="lg" onClick={() => setCardBrand(brand)}>{brand}</Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod === "VR" && CARD_BRANDS.length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2.5">
                        <p className="text-[11px] font-semibold text-slate-500">Bandeira VR</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CARD_BRANDS.map((brand) => (
                            <Button key={brand} variant={cardBrand === brand ? "primary" : "outline"} size="lg" onClick={() => setCardBrand(brand)}>{brand}</Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentMethod === "PIX" && (
                      <div className="flex flex-col items-center justify-center text-center gap-2.5 bg-slate-50 rounded-lg border border-slate-200 p-5">
                        <div className="w-12 h-12 bg-blue-600/10 rounded-full flex items-center justify-center animate-pulse">
                          <QrCode className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">PIX</p>
                          <p className="text-[11px] text-slate-500 max-w-[200px] mx-auto mt-1">
                            Confirme o recebimento antes de finalizar.
                          </p>
                        </div>
                      </div>
                    )}

                    {paymentMethod === "STONE" && (
                      <div className="space-y-4">
                        {stoneStatus === "idle" && (
                          <>
                            <p className="text-[11px] font-semibold text-slate-500">Tipo de pagamento</p>
                            <div className="grid grid-cols-3 gap-2">
                              {(["credit", "debit", "pix"] as const).map((t) => (
                                <Button key={t} variant={stonePaymentType === t ? "primary" : "outline"} size="lg" onClick={() => setStonePaymentType(t)}>{t === "credit" ? "Crédito" : t === "debit" ? "Débito" : "PIX"}</Button>
                              ))}
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-start gap-3">
                              <Smartphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                O valor será enviado para a maquininha Stone. O cliente paga na maquinha e o sistema confirma automaticamente.
                              </p>
                            </div>
                          </>
                        )}

                        {stoneStatus === "sending" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[11px] font-semibold text-slate-600">Enviando para maquininha...</p>
                          </div>
                        )}

                        {stoneStatus === "waiting" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center">
                              <Smartphone className="w-8 h-8 text-blue-600 animate-pulse" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Aguardando pagamento</p>
                              <p className="text-[11px] text-slate-500 mt-1">O cliente deve pagar na maquininha agora.</p>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                              Verificando a cada 5 segundos...
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 !text-red-600 hover:!bg-red-50"
                              onClick={() => { setStoneStatus("idle"); if (stonePollRef.current) clearInterval(stonePollRef.current); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}

                        {stoneStatus === "paid" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-sm font-semibold text-emerald-600">Pagamento confirmado!</p>
                          </div>
                        )}

                        {stoneStatus === "failed" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                              <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <p className="text-sm font-semibold text-red-600">Pagamento falhou</p>
                            <Button variant="outline" onClick={() => setStoneStatus("idle")}>
                              Tentar novamente
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === "CIELO" && (
                      <div className="space-y-4">
                        {cieloStatus === "idle" && (
                          <>
                            <p className="text-[11px] font-semibold text-slate-500">Tipo de pagamento</p>
                            <div className="grid grid-cols-3 gap-2">
                              {(["credit", "debit", "pix"] as const).map((t) => (
                                <Button key={t} variant={cieloPaymentType === t ? "primary" : "outline"} size="lg" onClick={() => setCieloPaymentType(t)}>{t === "credit" ? "Crédito" : t === "debit" ? "Débito" : "PIX"}</Button>
                              ))}
                            </div>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-start gap-3">
                              <Smartphone className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                O valor será enviado para a maquininha Cielo. O cliente paga na maquinha e o sistema confirma automaticamente.
                              </p>
                            </div>
                          </>
                        )}

                        {cieloStatus === "sending" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-8">
                            <div className="w-12 h-12 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <p className="text-[11px] font-semibold text-slate-600">Enviando para maquininha...</p>
                          </div>
                        )}

                        {cieloStatus === "waiting" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                            <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center">
                              <Smartphone className="w-8 h-8 text-blue-600 animate-pulse" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Aguardando pagamento</p>
                              <p className="text-[11px] text-slate-500 mt-1">O cliente deve pagar na maquininha agora.</p>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                              Verificando a cada 5 segundos...
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 !text-red-600 hover:!bg-red-50"
                              onClick={() => { setCieloStatus("idle"); if (cieloPollRef.current) clearInterval(cieloPollRef.current); }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}

                        {cieloStatus === "paid" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <p className="text-sm font-semibold text-emerald-600">Pagamento confirmado!</p>
                          </div>
                        )}

                        {cieloStatus === "failed" && (
                          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                              <AlertCircle className="w-8 h-8 text-red-600" />
                            </div>
                            <p className="text-sm font-semibold text-red-600">Pagamento falhou</p>
                            <Button variant="outline" onClick={() => setCieloStatus("idle")}>
                              Tentar novamente
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

                {/* Finalize button — sempre visível, fora da área rolável */}
                {(paymentMethod !== "STONE" || stoneStatus === "idle") && (paymentMethod !== "CIELO" || cieloStatus === "idle") ? (
                  <div className="px-3 sm:px-6 py-2 sm:py-3 border-t border-slate-200 shrink-0 bg-slate-50 space-y-1.5 sm:space-y-2">
                    {!isWaiterMode && (
                      <div className="flex items-center justify-center gap-4 text-[10px] font-semibold text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">F2</kbd> Finalizar venda
                        </span>
                        <span className="flex items-center gap-1.5">
                          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">ESC</kbd> Cancelar
                        </span>
                      </div>
                    )}
                    <div className="flex items-stretch gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="lg"
                        className="shrink-0 basis-1/3 !h-11 !text-red-600 !border-red-200 hover:!bg-red-50"
                        onClick={() => { setShowCheckout(false); setShowCartDrawer(true); }}
                        title="Cancelar pagamento e voltar ao carrinho"
                        iconLeft={<X size={14} />}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="lg"
                        className="flex-1 !h-11"
                        loading={isProcessing}
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
                        iconRight={
                          isSplitMode && (splitOverpaidAmount > 0 || splitRemaining > 0)
                            ? undefined
                            : paymentMethod === "STONE" || paymentMethod === "CIELO" ? <Smartphone size={14} /> : <CheckCircle2 size={14} />
                        }
                      >
                        {isSplitMode && splitOverpaidAmount > 0
                          ? <>Excedente {fmt(splitOverpaidAmount)}</>
                          : isSplitMode && splitRemaining > 0
                          ? <>Falta {fmt(splitRemaining)}</>
                          : paymentMethod === "STONE" || paymentMethod === "CIELO" ? "Enviar para Maquininha" : "Finalizar Venda"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fechar Caixa Modal ── */}
      <Modal
        open={!!showCloseCashModal && !!currentCash}
        onClose={() => { setShowCloseCashModal(false); setCashError(""); }}
        title="Fechar Caixa"
        subtitle="Confira o dinheiro em caixa antes de confirmar."
        size="xs"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => { setShowCloseCashModal(false); setCashError(""); }}>Cancelar</Button>
            <Button variant="danger" loading={cashActionLoading} onClick={handleCloseCash}>Confirmar</Button>
          </ModalFooter>
        }
      >
        {currentCash && (
          <div className="space-y-3">
            {cashError && <Alert variant="error">{cashError}</Alert>}
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-200">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Fundo de abertura</span>
                <span className="font-semibold text-slate-900 tabular-nums">{fmt(currentCash.openingBalance)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Esperado em caixa</span>
                <span className="font-semibold text-emerald-600 tabular-nums">{fmt(currentCash.expectedBalance)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="ds-label">Valor Contado</label>
                <Button
                  variant="ghost"
                  size="xs"
                  className="!text-emerald-600"
                  onClick={() => setClosingBalanceInput(numberToDigits(currentCash.expectedBalance))}
                >
                  Usar esperado
                </Button>
              </div>
              <Input
                type="text"
                inputMode="numeric"
                autoFocus
                value={formatCurrencyDigits(closingBalanceInput)}
                onChange={(e) => setClosingBalanceInput(maskCurrencyDigits(e.target.value))}
                placeholder="0,00"
                addonLeft="R$"
                className="text-center text-base font-semibold"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Variações e Observações do Produto */}
      {productOptionsModal && (
        <Modal
          open
          onClose={closeProductOptions}
          title={productOptionsModal.name}
          size="md"
          zIndex={150}
          footer={
            <ModalFooter>
                  <Button variant="outline" onClick={closeProductOptions}>Cancelar</Button>
                  <Button
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
                  >
                    {productModalEditIndex !== null ? "Salvar" : "Adicionar"}
                    </Button>
            </ModalFooter>
          }
        >
              <div className="space-y-6">
                {productOptionsModal.variants && productOptionsModal.variants.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-slate-400">
                      Variações (Escolha 1)
                    </label>
                    <div className="space-y-2">
                      {productOptionsModal.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                            productModalVariantId === variant.id
                              ? "bg-blue-50 border-blue-600 text-blue-600"
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
                            productModalVariantId === variant.id ? "border-blue-600" : "border-slate-300"
                          }`}>
                            {productModalVariantId === variant.id && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{variant.name}</p>
                          </div>
                          <span className="font-semibold text-sm shrink-0">{fmt(variant.price)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {parseProductExtras(productOptionsModal).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[11px] font-semibold text-slate-400">
                        Adicionais
                      </label>
                      <span className="text-[11px] font-semibold text-slate-400">Opcional</span>
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
                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                              isSelected
                                ? "bg-blue-50 text-blue-600 border-blue-600"
                                : "bg-white text-slate-600 border-slate-200 hover:border-blue-600/50 hover:bg-slate-50"
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
                        <label className="text-[11px] font-semibold text-slate-400">
                          {groups.length > 1 ? "Personalize o pedido" : (groups[0].label || `Escolha ${groups[0].qty} ${groups[0].qty > 1 ? "itens" : "item"}`)}
                        </label>
                        <Badge color={isComplete ? "success" : "default"}>
                          {doneCount}/{totalCount}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowGroupPicker(true)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-left transition-all ${
                          isComplete
                            ? "bg-blue-50 border-blue-600"
                            : "bg-white border-slate-200 hover:border-blue-600/50 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-700 truncate">
                          {isComplete ? summary : "Toque para escolher"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      </button>
                    </div>
                  );
                })()}

                <div className="space-y-3">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Observações e Adicionais
                  </label>
                  <Textarea
                    value={productModalNotes}
                    onChange={(e) => setProductModalNotes(e.target.value)}
                    placeholder="Ex: Sem cebola, ponto da carne, etc..."
                  />
                </div>
              </div>

        </Modal>
      )}
      {/* Grupos de seleção embutidos — fluxo passo a passo (ex: marmita com Guarnição/Arroz/Feijão) */}
      {showGroupPicker && productOptionsModal && (() => {
        const groups = parseSelectionGroups(productOptionsModal);
        if (groups.length === 0) return null;
        const optionsByGroup = groups.map((g) => getSelectionGroupOptions(tenant, g));
        return (
          <SelectionGroupPicker
            variant="admin"
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
