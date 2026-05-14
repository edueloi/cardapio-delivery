import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ClipboardList, 
  Utensils, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  ChevronLeft,
  Phone,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Menu,
  X,
  Info,
  CircleDollarSign,
  TrendingUp,
  Wallet,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Monitor,
  Trash2,
  Image as ImageIcon,
  Package,
  AlertTriangle,
  CalendarClock,
  ArrowRightLeft,
  Plus,
  CreditCard,
  QrCode,
  Banknote,
  Truck,
  Store,
  Clock3,
  Bell,
  LayoutGrid,
  ListChecks,
  Timer,
  Search,
  Filter,
  Eye,
  FileText,
  FileDown,
  Download
} from "lucide-react";
import socket from "../../lib/socket";
import { apiFetch, apiJson } from "../../lib/api";
import { Order, Tenant, CashRegister, DeliveryConfig, DeliveryZone, PaymentConfig, PaymentMethodConfig } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Button, 
  DashboardShell,
  IconButton, 
  PageWrapper, 
  SectionTitle, 
  StatGrid, 
  ContentCard, 
  StatCard, 
  Badge, 
  StatusBadge, 
  PaymentBadge,
  FilterLineSegmented,
  EmptyState,
  Modal,
  ModalFooter,
  Input,
  Select,
  Textarea,
  Switch,
  StatCardColor,
  GridTable,
  FilterLine,
  FilterLineSection,
  FilterLineItem,
  FilterLineSearch,
  FilterLineDateRange,
  DatePicker,
  usePagination
} from "../../components";
import { DASHBOARD_NAVIGATION } from "./config/navigation";
import { type DashboardOrderTabId, type DashboardTabId } from "./types";

export function WhatsAppWidget() {
  return (
    <div className="bg-[#075E54] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden group border-b-4 border-emerald-800 h-full">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest opacity-80">SmartBot Ativo</span>
        </div>
        <div className="space-y-4">
          <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-400/20">
            <div className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Status Automação</div>
            <div className="text-xs italic truncate font-medium">Auto-atendimento em execução...</div>
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold px-1">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Conectado
            </span>
            <span className="opacity-60 text-[9px]">API ONLINE</span>
          </div>
        </div>
        <button className="mt-6 w-full bg-white text-[#075E54] py-3 rounded-xl font-black text-xs shadow-md active:scale-95 hover:bg-emerald-50 transition-all uppercase tracking-wider">
          Configurar Respostas
        </button>
      </div>
      <div className="absolute -right-16 -bottom-16 text-emerald-400/10 text-[180px] font-bold rotate-12 pointer-events-none group-hover:rotate-0 transition-transform duration-700">
        💬
      </div>
    </div>
  );
}

function OrderWaitTime({ createdAt, status }: { createdAt: string, status: string }) {
  const [wait, setWait] = useState("");

  useEffect(() => {
    if (status === 'DELIVERED' || status === 'CANCELLED') {
      setWait("--");
      return;
    }
    const update = () => {
      const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
      setWait(`${diff} min`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (wait === "--") return null;

  return <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{wait}</span>;
}

const STATUS_MAP = {
  PENDING:   { label: 'Aguardando', color: 'bg-amber-100 text-amber-700',  border: '#F59E0B' },
  PREPARING: { label: 'Em Preparo', color: 'bg-blue-100 text-blue-700',    border: '#3B82F6' },
  SHIPPED:   { label: 'Pronto',     color: 'bg-orange-100 text-orange-700', border: '#F97316' },
  DELIVERED: { label: 'Concluído',  color: 'bg-green-100 text-green-700',  border: '#22C55E' },
} as const;

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export function OrdersList({
  filteredOrders,
  updateStatus,
  slug,
  activeOrderId,
}: {
  filteredOrders: Order[];
  updateStatus: any;
  slug?: string;
  activeOrderId?: string;
}) {
  const navigate = useNavigate();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(activeOrderId ?? null);

  useEffect(() => {
    setExpandedOrder(activeOrderId ?? null);
  }, [activeOrderId]);

  const toggleOrder = (orderId: string, isHistory: boolean) => {
    if (isHistory && slug) {
      if (expandedOrder === orderId) {
        navigate(`/dashboard/${slug}/historico`);
        setExpandedOrder(null);
      } else {
        navigate(`/dashboard/${slug}/historico/${orderId}`);
        setExpandedOrder(orderId);
      }
    } else {
      setExpandedOrder(expandedOrder === orderId ? null : orderId);
    }
  };

  if (filteredOrders.length === 0) {
    return (
      <EmptyState
        title="Nenhum pedido aqui por enquanto"
        description="Os pedidos aparecerão aqui conforme forem chegando."
        icon={ClipboardList}
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <AnimatePresence mode="popLayout">
        {filteredOrders.map(order => {
          const st = STATUS_MAP[order.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.PENDING;
          const isHistory = order.status === "DELIVERED" || order.status === "CANCELLED";
          const isExpanded = expandedOrder === order.id;

          return (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="ds-card-premium overflow-hidden border-l-4"
              style={{ borderLeftColor: st.border }}
            >
              {/* Row principal */}
              <div
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer active:bg-slate-50 transition-colors"
                onClick={() => toggleOrder(order.id, isHistory)}
              >
                {/* ID + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-800 tracking-tight">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider ${st.color}`}>
                      {st.label}
                    </span>
                    <OrderWaitTime createdAt={order.createdAt} status={order.status} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                    {order.orderType === 'DINE_IN' ? `[Mesa ${order.tableId || '?'}] ` : ''}{order.customerName}
                  </p>
                </div>

                {/* Valor + hora */}
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-slate-800">{fmt(order.total)}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight className={`w-3.5 h-3.5 text-slate-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              {/* Ações rápidas */}
              <div className="px-3 pb-3 flex gap-2" onClick={e => e.stopPropagation()}>
                {order.status === 'PENDING' && (
                  <Button size="sm" variant="primary" className="flex-1 rounded-xl" onClick={() => updateStatus(order.id, 'PREPARING')}>
                    Aceitar Pedido
                  </Button>
                )}
                {order.status === 'PREPARING' && (
                  <Button size="sm" variant="secondary" className="flex-1 rounded-xl" onClick={() => updateStatus(order.id, 'SHIPPED')}>
                    {order.orderType === 'DELIVERY' ? 'Despachar' : 'Marcar Pronto'}
                  </Button>
                )}
                {order.status === 'SHIPPED' && (
                  <Button size="sm" variant="success" className="flex-1 rounded-xl" onClick={() => updateStatus(order.id, 'DELIVERED')}>
                    Confirmar Entrega
                  </Button>
                )}
              </div>

              {/* Detalhes expandidos */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden bg-slate-50/50"
                  >
                    <div className="border-t border-slate-100 p-4 space-y-4">

                      {/* Itens */}
                      <div className="space-y-2">
                        <p className="ds-label tracking-[0.2em]">Conteúdo do Pedido</p>
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200/60 px-3 py-2 flex items-start justify-between gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                            <div>
                              <p className="text-xs font-bold text-slate-800 tracking-tight">{item.quantity}x {item.product?.name}</p>
                              {item.notes && (
                                <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1 uppercase tracking-wide">
                                  <Utensils className="w-2.5 h-2.5 shrink-0" /> {item.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-[11px] font-black text-slate-400 shrink-0 tabular-nums">{fmt(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Info cliente */}
                      <div className="bg-white rounded-xl border border-slate-200/60 p-3 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                            <Phone className="w-3 h-3 text-slate-300" />
                            {maskPhone(order.customerPhone)}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-[0.15em] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200/50">
                            {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? `Mesa ${order.tableId}` : 'Retirada'}
                          </span>
                        </div>
                        {order.address && (
                          <p className="text-[10px] text-slate-400 font-medium italic border-l-2 border-slate-200 pl-2 leading-relaxed">
                            {order.address}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="ds-label">Método de Pagamento</span>
                          <PaymentBadge method={order.paymentMethod.toLowerCase() as any} size="sm" />
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-2.5 shadow-lg shadow-slate-900/10">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Final</span>
                        <span className="text-sm font-black text-white tabular-nums">{fmt(order.total)}</span>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function StaffList({ tenant }: { tenant: Tenant | null }) {
  return (
    <ContentCard padding="none" className="overflow-hidden">
      <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
         <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Equipe Digital</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Colaboradores ativos na rede</p>
         </div>
         <Button variant="primary" size="md" className="w-full sm:w-auto">
            Novo Membro
         </Button>
      </div>
      <div className="p-5 sm:p-8 space-y-4">
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 bg-white border border-zinc-100 rounded-2xl transition-all hover:border-amber-200 hover:shadow-lg hover:shadow-slate-100">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-amber-600 flex items-center justify-center rounded-2xl text-white font-black border border-amber-700/10 shadow-lg shadow-amber-100">
                {tenant?.name?.[0] || 'ED'}
              </div>
              <div>
                <p className="font-black text-slate-800 text-base leading-none">Eduardo Eloi (Administrador)</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color="primary">Acesso Full</Badge>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                  <Badge color="success" dot>Online agora</Badge>
                </div>
              </div>
            </div>
            <IconButton variant="ghost" size="sm">
               <ChevronRight className="w-5 h-5" />
            </IconButton>
         </div>
         
         <EmptyState 
            title="Expanda sua Equipe" 
            description="Configure atendentes, cozinheiros e motoboys para um fluxo automatizado."
            icon={ClipboardList}
         />
      </div>
    </ContentCard>
  );
}

// Componente de Upload de Imagem Reutilizável
function ImageUploader({ value, onChange, label, description }: { value: string, onChange: (val: string) => void, label: string, description?: string }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">{label}</label>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="relative w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group shrink-0 shadow-inner">
          {uploading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : value ? (
            <>
              <img src={value} className="w-full h-full object-cover" alt="Preview" />
              <div 
                onClick={() => onChange("")}
                className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1">
                   <Trash2 className="w-5 h-5" />
                   <span className="text-[8px] font-black uppercase tracking-widest">Remover</span>
                </div>
              </div>
            </>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center hover:bg-slate-50 transition-colors">
              <ImageIcon className="w-6 h-6 text-slate-300" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        <div className="flex-1 py-1">
           <p className="text-[10px] text-slate-400 font-medium italic leading-tight">
              {description || "Escolha uma imagem do seu dispositivo para carregar. Formatos aceitos: PNG, JPG, WEBP."}
           </p>
           {value && (
              <div className="mt-2 text-[9px] bg-green-50 text-green-600 font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                 <CheckCircle2 className="w-3 h-3" />
                 Imagem Carregada
              </div>
           )}
        </div>
      </div>
    </div>
  );
}

const DAY_KEYS_UI = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS: Record<string, string> = { sun:"Domingo", mon:"Segunda", tue:"Terça", wed:"Quarta", thu:"Quinta", fri:"Sexta", sat:"Sábado" };

function TimeInput({ value, onChange, colorClass = "text-slate-800", bgClass = "bg-white", borderClass = "border-slate-200" }: {
  value: string;
  onChange: (v: string) => void;
  colorClass?: string;
  bgClass?: string;
  borderClass?: string;
}) {
  const [raw, setRaw] = React.useState(value);

  React.useEffect(() => { setRaw(value); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^\d]/g, "");
    if (v.length > 4) v = v.slice(0, 4);
    
    let formatted = v;
    if (v.length >= 3) {
      formatted = v.slice(0, 2) + ":" + v.slice(2);
    }
    
    setRaw(formatted);

    if (v.length === 4) {
      const hh = parseInt(v.slice(0, 2));
      const mm = parseInt(v.slice(2, 4));
      if (hh <= 23 && mm <= 59) {
        onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      }
    }
  }

  function handleBlur() {
    // ao sair do campo, corrige e normaliza
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length === 4) {
      let hh = Math.min(Number(digits.slice(0, 2)), 23);
      let mm = Math.min(Number(digits.slice(2, 4)), 59);
      const normalized = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      setRaw(normalized);
      onChange(normalized);
    } else {
      setRaw(value); // reverte se incompleto
    }
  }

  return (
    <div className={`flex items-center ${bgClass} border ${borderClass} rounded-xl px-4 py-3 flex-1 min-w-[100px]`}>
      <input
        type="text"
        inputMode="numeric"
        maxLength={5}
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00:00"
        className={`bg-transparent text-lg font-black focus:outline-none w-full text-center ${colorClass}`}
      />
    </div>
  );
}

const DEFAULT_HOURS = Object.fromEntries(DAY_KEYS_UI.map(d => [d, { enabled: !["sun"].includes(d), open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" }]));

const DEFAULT_PAYMENTS: PaymentConfig = {
  pix: { enabled: true, label: "Pix" },
  credit: { enabled: true, label: "Cartão de Crédito" },
  debit: { enabled: true, label: "Cartão de Débito" },
  meal: { enabled: false, label: "Vale Refeição" },
  food: { enabled: false, label: "Vale Alimentação" },
  cash: { enabled: true, label: "Dinheiro", allowChange: true }
};

function parseAddress(raw: string | null | undefined) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function buildAddressString(addr: AddressForm): string {
  const parts = [
    addr.street && addr.number ? `${addr.street}, ${addr.number}` : addr.street || "",
    addr.complement,
    addr.neighborhood,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city || addr.state,
    addr.country !== "Brasil" ? addr.country : "",
    addr.cep ? `CEP ${addr.cep}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  // Remove 55 prefix if present for masking
  const clean = (digits.startsWith("55") && digits.length >= 12) ? digits.slice(2) : digits;
  
  if (clean.length <= 2) return clean.length > 0 ? `(${clean}` : "";
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}

function unmaskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Se já tem 12 ou 13 dígitos e começa com 55, mantém. 
  // Caso contrário, se tem 10 ou 11 (DDD + número), adiciona 55.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

interface AddressForm {
  cep: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; country: string;
}

const EMPTY_ADDR: AddressForm = { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "Brasil" };

const CARD_BRANDS_LIST = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'elo', label: 'Elo' },
  { id: 'amex', label: 'American Express' },
  { id: 'hipercard', label: 'Hipercard' },
  { id: 'vr', label: 'VR Refeição' },
  { id: 'sodexo', label: 'Sodexo' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'alelo', label: 'Alelo' }
];

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [activeTab, setActiveTab] = useState<"general" | "hours" | "delivery" | "payments">("general");
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: maskPhone(tenant?.whatsapp) || "",
    isOpen: tenant?.isOpen ?? true,
  });
  const [addr, setAddr] = useState<AddressForm>(() => parseAddress(tenant?.address) ?? { ...EMPTY_ADDR });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [hours, setHours] = useState<Record<string, { enabled: boolean; open: string; close: string; breakEnabled?: boolean; breakStart?: string; breakEnd?: string }>>(() => {
    try { return tenant?.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS; } catch { return DEFAULT_HOURS; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const parseDeliveryConfig = (raw?: string | null): DeliveryConfig => {
    try { return raw ? JSON.parse(raw) : { mode: "free" }; } catch { return { mode: "free" }; }
  };

  const [delivery, setDelivery] = useState<DeliveryConfig>(() => parseDeliveryConfig(tenant?.deliveryConfig));

  const [payments, setPayments] = useState<PaymentConfig>(() => {
    try { return tenant?.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS; } catch { return DEFAULT_PAYMENTS; }
  });

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || "", description: tenant.description || "", logoUrl: tenant.logoUrl || "", whatsapp: maskPhone(tenant.whatsapp) || "", isOpen: tenant.isOpen ?? true });
      setAddr(parseAddress(tenant.address) ?? { ...EMPTY_ADDR });
      try { setHours(tenant.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
      setDelivery(parseDeliveryConfig(tenant.deliveryConfig));
      try { setPayments(tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS); } catch { setPayments(DEFAULT_PAYMENTS); }
    }
  }, [tenant]);

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setAddr(a => ({ ...a, cep: digits, street: data.logradouro || a.street, neighborhood: data.bairro || a.neighborhood, city: data.localidade || a.city, state: data.uf || a.state, country: "Brasil" }));
    } catch { setCepError("Erro ao buscar CEP."); }
    finally { setCepLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiJson(`/api/owner/tenants/${tenant?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ 
          ...form, 
          whatsapp: unmaskPhone(form.whatsapp),
          address: JSON.stringify(addr), 
          businessHours: JSON.stringify(hours), 
          deliveryConfig: JSON.stringify(delivery),
          paymentMethods: JSON.stringify(payments)
        })
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: string, field: string, value: any) =>
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }));

  const setA = (field: keyof AddressForm, value: string) => setAddr(a => ({ ...a, [field]: value }));

  return (
    <PageWrapper>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <SectionTitle 
          title="Configurações da Unidade" 
          description="Gerencie as informações e regras do seu estabelecimento" 
          icon={Settings} 
        />
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {[
            { id: "general", label: "Loja", icon: Store },
            { id: "hours", label: "Horários", icon: Clock3 },
            { id: "delivery", label: "Entrega", icon: Truck },
            { id: "payments", label: "Pagamentos", icon: Wallet },
          ].map((tab) => (
            <button 
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-6">
        {activeTab === "general" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <ImageUploader label="Logo / Imagem da Unidade" value={form.logoUrl} onChange={(val) => setForm({...form, logoUrl: val})} description="Aparecerá no topo do cardápio digital." />
                <div className="space-y-4">
                  <Input label="Nome do estabelecimento" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pastel do Edu" />
                  <Input label="WhatsApp de contato" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" hint="Digite apenas o DDD + Número" />
                </div>
              </div>
              <Input label="Slogan / Descrição curta" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Os melhores pastéis da cidade" />
            </ContentCard>

            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">Localização</p>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <Input
                    label="CEP"
                    value={addr.cep}
                    onChange={e => { setA("cep", e.target.value); setCepError(""); }}
                    onBlur={e => fetchCep(e.target.value)}
                    placeholder="00000-000"
                    wrapperClassName="w-full sm:w-44"
                    error={cepError || undefined}
                  />
                  <Button type="button" variant="outline" size="sm" loading={cepLoading}
                    onClick={() => fetchCep(addr.cep)} className="w-full sm:w-auto mb-0.5">
                    Buscar CEP
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Logradouro" value={addr.street} onChange={e => setA("street", e.target.value)} placeholder="Rua, Av, Travessa..." wrapperClassName="md:col-span-2" />
                  <Input label="Número" value={addr.number} onChange={e => setA("number", e.target.value)} placeholder="123" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Complemento" value={addr.complement} onChange={e => setA("complement", e.target.value)} placeholder="Apto, Sala, Bloco..." />
                  <Input label="Bairro" value={addr.neighborhood} onChange={e => setA("neighborhood", e.target.value)} placeholder="Bairro" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Cidade" value={addr.city} onChange={e => setA("city", e.target.value)} placeholder="Cidade" />
                  <Input label="Estado (UF)" value={addr.state} onChange={e => setA("state", e.target.value.toUpperCase().slice(0,2))} placeholder="SP" />
                  <Input label="País" value={addr.country} onChange={e => setA("country", e.target.value)} placeholder="Brasil" />
                </div>
              </div>

              {/* Preview */}
              {(addr.street || addr.city) && (
                <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 font-medium">
                  📍 {buildAddressString(addr)}
                </div>
              )}
            </ContentCard>

            <ContentCard padding="lg">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900">Status do Estabelecimento</p>
                  <p className="text-xs text-slate-500 mt-1">Forçar fechamento imediato do cardápio digital.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${form.isOpen ? 'text-green-500' : 'text-red-500'}`}>
                    {form.isOpen ? 'Loja Aberta' : 'Loja Fechada'}
                  </span>
                  <Switch checked={form.isOpen} onCheckedChange={v => setForm(f => ({ ...f, isOpen: v }))} />
                </div>
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">Horários de Funcionamento</p>
              <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {DAY_KEYS_UI.map(day => {
                  const d = hours[day] ?? { enabled: false, open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" };
                  return (
                    <div key={day} className={`transition-colors ${d.enabled ? "bg-white" : "bg-slate-50/60"}`}>
                      <div className="px-6 py-6 space-y-4">
                        <div className="flex items-center gap-4">
                          <Switch checked={d.enabled} onCheckedChange={v => setDay(day, "enabled", v)} />
                          <span className={`text-sm font-black shrink-0 ${d.enabled ? "text-slate-800" : "text-slate-400"}`}>
                            {DAY_LABELS[day]}
                          </span>
                          {!d.enabled && <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 ml-auto">Fechado</span>}
                        </div>

                        {d.enabled && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-2 flex-1">
                              <TimeInput value={d.open} onChange={v => setDay(day, "open", v)} />
                              <span className="text-slate-300 font-bold text-sm">–</span>
                              <TimeInput value={d.close} onChange={v => setDay(day, "close", v)} />
                            </div>
                            <button
                              type="button"
                              onClick={() => setDay(day, "breakEnabled", !d.breakEnabled)}
                              className={`h-[44px] px-4 rounded-xl flex items-center justify-center gap-2 border text-[10px] font-black uppercase tracking-widest transition-all w-full sm:w-auto ${d.breakEnabled ? "bg-amber-50 border-amber-300 text-amber-600" : "bg-white border-slate-200 text-slate-400 hover:border-[#C9A227] hover:text-[#C9A227]"}`}
                            >
                              {d.breakEnabled ? <Clock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                              <span>{d.breakEnabled ? "Remover Pausa" : "Adicionar Intervalo"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {d.enabled && d.breakEnabled && (
                        <div className="bg-amber-50/30 px-6 py-6 border-t border-amber-100/50">
                          <div className="flex flex-col gap-4">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pausa Automática</span>
                            <div className="flex items-center gap-2">
                              <TimeInput value={d.breakStart ?? "12:00"} onChange={v => setDay(day, "breakStart", v)} colorClass="text-amber-700" bgClass="bg-amber-50/50" borderClass="border-amber-200" />
                              <span className="text-amber-300 font-bold text-sm">–</span>
                              <TimeInput value={d.breakEnd ?? "13:00"} onChange={v => setDay(day, "breakEnd", v)} colorClass="text-amber-700" bgClass="bg-amber-50/50" borderClass="border-amber-200" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "delivery" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">Regras de Entrega</p>
              <div className="space-y-8">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { id: "free", label: "Grátis", icon: CheckCircle2 },
                    { id: "fixed", label: "Taxa Fixa", icon: CircleDollarSign },
                    { id: "zones", label: "Por Bairro/CEP", icon: Truck },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDelivery(d => ({ ...d, mode: opt.id }))}
                      className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${delivery.mode === opt.id ? "bg-[#0D1B3E] text-white border-[#0D1B3E] shadow-xl shadow-slate-900/10" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {delivery.mode === "fixed" && (
                  <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm">
                      <CircleDollarSign className="w-8 h-8" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Valor Único de Entrega</label>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-slate-400">R$</span>
                        <input
                          type="number" min="0" step="0.50"
                          value={delivery.fixedFee ?? ""}
                          onChange={e => setDelivery(d => ({ ...d, fixedFee: parseFloat(e.target.value) || 0 }))}
                          className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-3 text-lg font-black text-slate-800 focus:border-[#C9A227] outline-none transition-all shadow-sm"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {delivery.mode === "zones" && (
                  <div className="space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-800">Cobranca fallback</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Para locais não cadastrados</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-400">R$</span>
                        <input
                          type="number" min="0" step="0.50"
                          value={delivery.defaultFee ?? ""}
                          onChange={e => setDelivery(d => ({ ...d, defaultFee: parseFloat(e.target.value) || 0 }))}
                          className="w-24 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 focus:border-[#C9A227] outline-none"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Zonas de Entrega</p>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{delivery.zones?.length || 0} zonas</span>
                      </div>
                      {delivery.zones?.map((zone, idx) => (
                        <div key={zone.id} className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between group hover:border-[#C9A227]/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#C9A227]/10 group-hover:text-[#C9A227] transition-all">
                              <Truck className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">{zone.label}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">CEP: {zone.ceps.join(", ")}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-black text-[#C9A227]">{zone.fee === 0 ? "GRÁTIS" : fmt(zone.fee)}</span>
                            <button 
                              type="button"
                              onClick={() => setDelivery(d => ({ ...d, zones: d.zones?.filter((_, i) => i !== idx) }))}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <ZoneAdder onAdd={z => setDelivery(d => ({ ...d, zones: [...(d.zones || []), z] }))} />
                    </div>
                  </div>
                )}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {activeTab === "payments" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-6">Meios de Pagamento Disponíveis</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: "pix", label: "PIX Dinâmico", icon: QrCode, desc: "Aprovação instantânea" },
                  { id: "credit", label: "Cartão de Crédito", icon: CreditCard, desc: "Visa, Master, Elo..." },
                  { id: "debit", label: "Cartão de Débito", icon: CreditCard, desc: "Pagamento à vista" },
                  { id: "meal", label: "Vale Refeição (VR)", icon: Utensils, desc: "Sodexo, Alelo, VR" },
                  { id: "food", label: "Vale Alimentação (VA)", icon: Package, desc: "Ticket, Alelo" },
                ].map((method) => {
                  const methodConfig = payments[method.id as keyof PaymentConfig] as PaymentMethodConfig;
                  const isEnabled = methodConfig?.enabled;
                  const acceptedBrands = methodConfig?.acceptedBrands || [];
                  const allBrands = [...CARD_BRANDS_LIST.map(b => b.label), ...(payments.customBrands || [])];

                  return (
                    <div 
                      key={method.id}
                      className={`p-6 rounded-[2rem] border transition-all space-y-4 ${
                        isEnabled ? 'bg-white border-[#C9A227]/30 shadow-xl shadow-[#C9A227]/5' : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            isEnabled ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <method.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{method.label}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{method.desc}</p>
                          </div>
                        </div>
                        <Switch 
                          checked={isEnabled} 
                          onCheckedChange={v => setPayments({
                            ...payments,
                            [method.id]: { ...(methodConfig || { label: method.label }), enabled: v }
                          })}
                        />
                      </div>

                      {isEnabled && (
                        <div className="pt-4 border-t border-slate-50 space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bandeiras Aceitas</p>
                          <div className="flex flex-wrap gap-2">
                            {allBrands.map(brand => {
                              const isSelected = acceptedBrands.includes(brand);
                              return (
                                <button
                                  key={brand}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected 
                                      ? acceptedBrands.filter(b => b !== brand)
                                      : [...acceptedBrands, brand];
                                    setPayments({
                                      ...payments,
                                      [method.id]: { ...methodConfig, acceptedBrands: next }
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                                    isSelected 
                                      ? 'bg-[#0D1B3E] border-[#0D1B3E] text-white shadow-md' 
                                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                                  }`}
                                >
                                  {brand}
                                </button>
                              );
                            })}
                          </div>
                          
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              placeholder="Nova bandeira..."
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val) {
                                    const custom = payments.customBrands || [];
                                    if (!custom.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        customBrands: [...custom, val],
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    } else if (!acceptedBrands.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    }
                                    e.currentTarget.value = "";
                                  }
                                }
                              }}
                              className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold outline-none focus:border-[#C9A227] transition-all"
                            />
                            <div className="p-2 text-slate-300">
                              <Plus className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div 
                  key="cash"
                  className={`p-6 rounded-[2rem] border transition-all sm:col-span-2 ${
                    payments.cash?.enabled ? 'bg-white border-[#C9A227]/30 shadow-xl shadow-[#C9A227]/5' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        payments.cash?.enabled ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'bg-slate-200 text-slate-400'
                      }`}>
                        <Banknote className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800">Dinheiro no Local</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pagamento na entrega ou balcão</p>
                      </div>
                    </div>
                    <Switch 
                      checked={payments.cash?.enabled} 
                      onCheckedChange={v => setPayments({
                        ...payments,
                        cash: { ...(payments.cash || { label: "Dinheiro", allowChange: true }), enabled: v }
                      })}
                    />
                  </div>
                  {payments.cash?.enabled && (
                    <label className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl cursor-pointer transition-all hover:bg-slate-100">
                      <input 
                        type="checkbox" 
                        checked={payments.cash?.allowChange !== false}
                        onChange={e => setPayments({
                          ...payments,
                          cash: { ...payments.cash!, allowChange: e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-[#C9A227]"
                      />
                      <span className="text-xs font-bold text-slate-600">Perguntar sobre troco no checkout</span>
                    </label>
                  )}
                </div>
              </div>
            </ContentCard>
          </motion.div>
        )}

        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4">
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/50 p-4 rounded-[2rem] shadow-2xl flex items-center justify-between gap-4">
            <div className="hidden sm:block pl-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status das Alterações</p>
              <p className="text-xs font-bold text-slate-800">
                {saved ? "✅ Tudo salvo!" : saving ? "⏳ Salvando..." : "✍️ Alterações pendentes"}
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => refresh()}
                className="flex-1 sm:flex-none"
              >
                Descartar
              </Button>
              <Button 
                type="submit" 
                variant="primary" 
                loading={saving}
                className="flex-1 sm:min-w-[200px]"
                iconLeft={<CheckCircle2 className="w-4 h-4" />}
              >
                {saved ? "Salvo com Sucesso" : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </PageWrapper>
  );
}

export function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [localCategories, setLocalCategories] = useState<any[]>([]);

  // Category modal
  const [catModal, setCatModal] = useState<{ open: boolean; editing: { id: string; name: string } | null }>({ open: false, editing: null });
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Product modal
  const [prodModal, setProdModal] = useState<{ open: boolean; categoryId: string | null }>({ open: false, categoryId: null });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [prodForm, setProdForm] = useState({
    name: "", description: "", price: "", imageUrl: "", inventoryItemId: "",
    available: true, pdvOnly: false, autoDisableWhenOutOfStock: false,
    variants: [] as { name: string, price: string, description: string, inventoryItemId: string }[],
    extras: [] as { id: string, label: string, price: string }[]
  });
  const [extraInput, setExtraInput] = useState({ label: "", price: "" });

  useEffect(() => {
    if (tenant) {
      setLocalCategories(tenant.categories || []);
      apiFetch(`/api/tenants/${tenant.slug}/inventory`)
        .then(res => res.json())
        .then(data => setInventoryItems(data))
        .catch(() => {});
    }
  }, [tenant]);

  const openNewCategory = () => { setCatName(""); setCatModal({ open: true, editing: null }); };
  const openEditCategory = (cat: { id: string; name: string }) => { setCatName(cat.name); setCatModal({ open: true, editing: cat }); };
  const closeCatModal = () => setCatModal({ open: false, editing: null });

  const saveCategory = async () => {
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      if (catModal.editing) {
        await apiFetch(`/api/categories/${catModal.editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim() })
        });
        setLocalCategories(cats => cats.map(c => c.id === catModal.editing!.id ? { ...c, name: catName.trim() } : c));
      } else {
        const res = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim(), tenantId: tenant?.id })
        });
        const newCat = await res.json();
        setLocalCategories(cats => [...cats, { ...newCat, products: [] }]);
      }
      closeCatModal();
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Excluir categoria e todos os produtos dela?")) return;
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (selectedCat === id) setSelectedCat("all");
    setLocalCategories(cats => cats.filter(c => c.id !== id));
  };

  const openNewProduct = (categoryId: string) => {
    setEditingProduct(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", available: true, pdvOnly: false, autoDisableWhenOutOfStock: false, variants: [], extras: [] });
    setExtraInput({ label: "", price: "" });
    setProdModal({ open: true, categoryId });
  };

  const openEditProduct = (prod: any) => {
    setEditingProduct(prod);
    let parsedExtras: { id: string, label: string, price: string }[] = [];
    try {
      const raw = prod.extras ? JSON.parse(prod.extras) : [];
      parsedExtras = raw.map((e: any) => ({ id: e.id, label: e.label, price: String(e.price ?? 0) }));
    } catch {}
    setProdForm({
      name: prod.name, description: prod.description || "", price: String(prod.price),
      imageUrl: prod.imageUrl || "", inventoryItemId: prod.inventoryItemId || "",
      available: prod.available !== false,
      pdvOnly: prod.pdvOnly || false,
      autoDisableWhenOutOfStock: prod.autoDisableWhenOutOfStock || false,
      variants: prod.variants?.map((v: any) => ({ name: v.name, price: String(v.price), description: v.description || "", inventoryItemId: v.inventoryItemId || "" })) || [],
      extras: parsedExtras
    });
    setExtraInput({ label: "", price: "" });
    setProdModal({ open: true, categoryId: prod.categoryId });
  };



  const closeProdModal = () => { setProdModal({ open: false, categoryId: null }); setEditingProduct(null); };

  const saveProduct = async () => {
    if (!prodForm.name || !prodModal.categoryId) return;
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const res = await apiFetch(url, {
      method: editingProduct ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...prodForm,
        extras: JSON.stringify(prodForm.extras.map(e => ({ id: e.id, label: e.label, price: parseFloat(e.price) || 0 }))),
        categoryId: prodModal.categoryId,
        tenantId: tenant?.id
      })
    });
    const saved = await res.json();
    if (editingProduct) {
      setLocalCategories(cats => cats.map(cat => ({
        ...cat,
        products: cat.products?.map((p: any) => p.id === saved.id ? { ...p, ...saved } : p)
      })));
    } else {
      setLocalCategories(cats => cats.map(cat =>
        cat.id === prodModal.categoryId
          ? { ...cat, products: [...(cat.products || []), saved] }
          : cat
      ));
    }
    closeProdModal();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    setLocalCategories(cats => cats.map(cat => ({
      ...cat,
      products: cat.products?.filter((p: any) => p.id !== id)
    })));
  };

  const toggleProductAvailability = async (prod: any) => {
    const newAvailable = !prod.available;
    setLocalCategories(cats => cats.map(cat => ({
      ...cat,
      products: cat.products?.map((p: any) => p.id === prod.id ? { ...p, available: newAvailable } : p)
    })));
    await apiFetch(`/api/products/${prod.id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: newAvailable })
    });
  };

  const addVariantField = () => setProdForm(prev => ({ ...prev, variants: [...prev.variants, { name: "", price: "", description: "", inventoryItemId: "" }] }));
  const removeVariantField = (i: number) => setProdForm(prev => ({ ...prev, variants: prev.variants.filter((_, idx) => idx !== i) }));
  const updateVariantField = (i: number, field: string, value: string) => setProdForm(prev => ({ ...prev, variants: prev.variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v) }));

  const categories = localCategories;
  const visibleCategories = categories
    .filter(cat => selectedCat === "all" || cat.id === selectedCat)
    .map(cat => ({
      ...cat,
      products: (cat.products || []).filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter(cat => !search || cat.products.length > 0);

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Category filter dropdown */}
        <div className="relative flex-1">
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            className="w-full appearance-none bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
          >
            <option value="all">Todas as categorias ({categories.length})</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name} ({cat.products?.length || 0})</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.6"/><path d="M10 10L12.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold text-slate-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <Button onClick={openNewCategory} iconLeft={<Plus className="w-4 h-4" />} className="shrink-0 w-full sm:w-auto">
          Nova Categoria
        </Button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
          <Utensils className="w-12 h-12 text-slate-300" />
          <div>
            <p className="text-slate-700 font-black text-base">Comece criando uma categoria</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
              Categorias organizam seu cardápio — ex: <span className="font-bold">Pastéis</span>, <span className="font-bold">Bebidas</span>, <span className="font-bold">Sobremesas</span>. Depois disso você adiciona os produtos dentro de cada uma.
            </p>
          </div>
          <Button onClick={openNewCategory} iconLeft={<Plus className="w-4 h-4" />}>
            Adicionar primeira categoria
          </Button>
        </div>
      )}

      {/* Category + product list */}
      {visibleCategories.map(cat => (
        <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Category header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{cat.name}
              <span className="ml-2 text-zinc-400 font-bold normal-case tracking-normal">{cat.products?.length || 0} itens</span>
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => openNewProduct(cat.id)}
                className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#C9A227] hover:text-[#A8841C] px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Produto
              </button>
              <button
                onClick={() => openEditCategory(cat)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                title="Editar categoria"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {cat.products?.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-slate-400 font-medium">Nenhum produto ainda.</p>
                <button onClick={() => openNewProduct(cat.id)} className="mt-2 text-xs font-black text-[#C9A227] hover:underline">
                  + Adicionar produto
                </button>
              </div>
            )}
            {cat.products?.map(prod => (
              <div key={prod.id} className={`flex items-center gap-3 px-4 py-3 transition-all duration-300 ${!prod.available ? 'bg-slate-50/50 opacity-70' : 'bg-white'}`}>
                <div className={`w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 transition-all duration-500 ${!prod.available ? 'grayscale opacity-60 scale-95 border-2 border-slate-200' : 'border border-transparent'}`}>
                  {prod.imageUrl
                    ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-5 h-5" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold truncate transition-colors ${!prod.available ? 'text-slate-400 italic' : 'text-slate-800'}`}>{prod.name}</p>
                    {!prod.available && (
                      <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-white bg-slate-400 px-1.5 py-0.5 rounded-full shadow-sm">Inativo</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
                    {prod.variants?.length > 0
                      ? `${prod.variants.length} variações • desde ${fmt(Math.min(...prod.variants.map((v: any) => v.price)))}`
                      : fmt(prod.price)
                    }
                    {prod.inventoryItem && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className={`font-black uppercase text-[10px] ${
                          prod.inventoryItem.quantity <= 0
                            ? "text-red-500"
                            : prod.inventoryItem.quantity < 5
                              ? "text-amber-500"
                              : "text-green-600"
                        }`}>
                          {prod.inventoryItem.quantity <= 0
                            ? "Esgotado"
                            : `${prod.inventoryItem.quantity} ${prod.inventoryItem.unit || 'un'}`
                          }
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleProductAvailability(prod)}
                    title={prod.available ? "Desativar produto" : "Ativar produto"}
                    className={`p-2 rounded-lg transition-colors ${prod.available ? 'text-green-500 hover:text-slate-400 hover:bg-slate-100' : 'text-slate-300 hover:text-green-500 hover:bg-green-50'}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      {prod.available
                        ? <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>
                        : <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="M6 6L10 10M10 6L6 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>
                      }
                    </svg>
                  </button>
                  <button onClick={() => openEditProduct(prod)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteProduct(prod.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Search no result */}
      {search && visibleCategories.length === 0 && categories.length > 0 && (
        <div className="text-center py-10 text-slate-400 text-sm font-medium">
          Nenhum produto encontrado para "<span className="font-bold">{search}</span>"
        </div>
      )}

      {/* Modal: categoria */}
      <Modal
        isOpen={catModal.open}
        onClose={closeCatModal}
        title={catModal.editing ? "Editar categoria" : "Nova categoria"}
        size="sm"
        mobileStyle="bottom-sheet"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {catModal.editing && (
              <Button variant="ghost" className="text-red-500 hover:bg-red-50 sm:mr-auto" onClick={() => { closeCatModal(); deleteCategory(catModal.editing!.id); }}>
                Excluir categoria
              </Button>
            )}
            <Button variant="outline" onClick={closeCatModal}>Cancelar</Button>
            <Button onClick={saveCategory} loading={catSaving}>{catModal.editing ? "Salvar" : "Criar categoria"}</Button>
          </div>
        }
      >
        <div className="p-4 sm:p-5">
          <Input
            label="Nome da categoria"
            placeholder="Ex: Pastéis, Bebidas, Sobremesas..."
            value={catName}
            onChange={e => setCatName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveCategory()}
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-2">Categorias agrupam os produtos no cardápio do cliente.</p>
        </div>
      </Modal>

      {/* Modal: produto */}
      <Modal
        isOpen={prodModal.open}
        onClose={closeProdModal}
        title={editingProduct ? "Editar produto" : "Novo produto"}
        size="lg"
        mobileStyle="fullscreen"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeProdModal}>Cancelar</Button>
            <Button onClick={saveProduct}>{editingProduct ? "Salvar alterações" : "Adicionar produto"}</Button>
          </div>
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do produto" placeholder="Ex: Pastel de carne" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} />
            <Input label="Preço base (R$)" placeholder="0,00" value={prodForm.price} onChange={e => setProdForm({ ...prodForm, price: e.target.value })} />
          </div>
          <Input label="Descrição (opcional)" placeholder="Ingredientes, detalhes..." value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} />

          <ImageUploader label="Foto do produto" value={prodForm.imageUrl} onChange={val => setProdForm({ ...prodForm, imageUrl: val })} description="Fotos de alta qualidade convertem mais vendas." />

          {inventoryItems.length > 0 && (
            <div className="space-y-2">
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Vincular ao estoque (opcional)</label>
              <select value={prodForm.inventoryItemId} onChange={e => setProdForm({ ...prodForm, inventoryItemId: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">Sem vínculo de estoque</option>
                {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>)}
              </select>
              {prodForm.inventoryItemId && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none mt-1">
                  <input
                    type="checkbox"
                    checked={prodForm.autoDisableWhenOutOfStock}
                    onChange={e => setProdForm({ ...prodForm, autoDisableWhenOutOfStock: e.target.checked })}
                    className="w-4 h-4 rounded accent-amber-500"
                  />
                  <span className="text-xs font-semibold text-slate-600">Desativar automaticamente quando o estoque zerar</span>
                </label>
              )}
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Produto ativo no cardápio</p>
              <p className="text-xs text-slate-400">Clientes conseguem ver e pedir este produto</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, available: !f.available }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.available ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.available ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Exclusivo PDV</p>
              <p className="text-xs text-slate-400">Visível apenas no PDV, não aparece no cardápio online</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, pdvOnly: !f.pdvOnly }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.pdvOnly ? 'bg-blue-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.pdvOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Adicionais / Extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Adicionais / Observações</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Ex: Gelo, Limão, Sem Cebola, Molho extra. O cliente seleciona antes de adicionar ao carrinho.</p>
            <div className="flex gap-2 mb-3">
              <input
                placeholder="Nome (ex: Gelo)"
                value={extraInput.label}
                onChange={e => setExtraInput(prev => ({ ...prev, label: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && extraInput.label.trim()) {
                    e.preventDefault();
                    setProdForm(prev => ({ ...prev, extras: [...prev.extras, { id: crypto.randomUUID(), label: extraInput.label.trim(), price: extraInput.price }] }));
                    setExtraInput({ label: "", price: "" });
                  }
                }}
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0"
              />
              <input
                placeholder="R$ (0 = grátis)"
                value={extraInput.price}
                onChange={e => setExtraInput(prev => ({ ...prev, price: e.target.value }))}
                className="w-28 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => {
                  if (!extraInput.label.trim()) return;
                  setProdForm(prev => ({ ...prev, extras: [...prev.extras, { id: crypto.randomUUID(), label: extraInput.label.trim(), price: extraInput.price }] }));
                  setExtraInput({ label: "", price: "" });
                }}
                className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600"
              >+</button>
            </div>
            {prodForm.extras.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prodForm.extras.map((ex) => (
                  <span key={ex.id} className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                    {ex.label}{parseFloat(ex.price) > 0 ? ` +R$${parseFloat(ex.price).toFixed(2)}` : ' (grátis)'}
                    <button onClick={() => setProdForm(prev => ({ ...prev, extras: prev.extras.filter(e => e.id !== ex.id) }))} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Variantes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tamanhos / Variantes</span>
              <button onClick={addVariantField} className="text-xs font-black text-[#C9A227] hover:underline">+ Adicionar</button>
            </div>
            <div className="space-y-2">
              {prodForm.variants.map((v, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input placeholder="Nome (ex: 500ml)" value={v.name} onChange={e => updateVariantField(idx, 'name', e.target.value)}
                    className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0" />
                  <input placeholder="R$" value={v.price} onChange={e => updateVariantField(idx, 'price', e.target.value)}
                    className="w-20 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  <button onClick={() => removeVariantField(idx)} className="p-2 text-slate-300 hover:text-red-500 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function FinancePanel({ slug }: { slug: string, tenant: Tenant }) {
  const [summary, setSummary] = useState<{ daily: number, dailyCount: number, weekly: number, monthly: number } | null>(null);
  const [currentCash, setCurrentCash] = useState<CashRegister & { expectedBalance?: number } | null>(null);
  const [history, setHistory] = useState<CashRegister[]>([]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [sumRes, cashRes, historyRes] = await Promise.all([
        apiFetch(`/api/tenants/${slug}/finance-summary`),
        apiFetch(`/api/tenants/${slug}/cash/current`),
        apiFetch(`/api/tenants/${slug}/cash/history`)
      ]);
      setSummary(await sumRes.json());
      setCurrentCash(await cashRes.json());
      setHistory(await historyRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFinanceData(); }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <PageWrapper>
      <SectionTitle title="Financeiro" description="Fluxo de caixa e receitas do estabelecimento" icon={Wallet} className="mb-6" />

      {/* Stats */}
      <StatGrid cols={3} className="mb-6">
        <StatCard
          title="Hoje"
          value={fmt(summary?.daily || 0)}
          icon={TrendingUp}
          description={`${summary?.dailyCount || 0} pedidos concluídos`}
          color="info"
          delay={0.1}
        />
        <StatCard
          title="Na semana"
          value={fmt(summary?.weekly || 0)}
          icon={Calendar}
          description="Últimos 7 dias"
          color="purple"
          delay={0.2}
        />
        <StatCard
          title="No mês"
          value={fmt(summary?.monthly || 0)}
          icon={CircleDollarSign}
          description={new Date().toLocaleString('pt-BR', { month: 'long' })}
          color="success"
          delay={0.3}
        />
      </StatGrid>

      {/* Caixa */}
      <ContentCard className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${currentCash ? 'bg-green-50 text-green-600' : 'bg-zinc-100 text-zinc-400'}`}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-black text-zinc-800 tracking-tight">Status do Caixa</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${currentCash ? 'bg-green-500 animate-pulse' : 'bg-zinc-300'}`} />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  {currentCash ? 'Aberto' : 'Fechado'}
                </span>
              </div>
            </div>
          </div>
          {!currentCash ? (
            <Button variant="primary" onClick={() => setShowOpenModal(true)}>Abrir Caixa</Button>
          ) : (
            <Button variant="danger" onClick={() => setShowCloseModal(true)}>Fechar Caixa</Button>
          )}
        </div>

        {currentCash && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-zinc-100">
            {[
              { label: "Abertura", value: new Date(currentCash.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), sub: "hoje" },
              { label: "Fundo de troco", value: fmt(currentCash.openingBalance), sub: "saldo inicial" },
              { label: "Vendas (dinheiro)", value: fmt((currentCash.expectedBalance || 0) - currentCash.openingBalance), sub: "no sistema", highlight: true },
              { label: "Total esperado", value: fmt(currentCash.expectedBalance || 0), sub: "na gaveta", highlight: true },
            ].map(({ label, value, sub, highlight }) => (
              <div key={label}>
                <p className="ds-label mb-1">{label}</p>
                <p className={`text-sm font-black ${highlight ? 'text-blue-600' : 'text-zinc-800'}`}>{value}</p>
                <p className="text-[10px] text-zinc-400 font-medium uppercase mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Histórico */}
      <SectionTitle title="Últimos Fechamentos" icon={History} className="mb-4" />
      <GridTable
        data={history}
        keyExtractor={cash => cash.id}
        columns={[
          {
            header: "Data / Hora",
            render: cash => (
              <div>
                <span className="font-bold text-zinc-800">{new Date(cash.openedAt).toLocaleDateString('pt-BR')}</span>
                <p className="text-[10px] text-zinc-400 font-bold uppercase mt-0.5">
                  {new Date(cash.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {cash.closedAt && ` → ${new Date(cash.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            )
          },
          {
            header: "Entrada / Saída",
            render: cash => (
              <div className="flex gap-4">
                <div>
                  <p className="ds-label mb-0.5">Iniciou</p>
                  <p className="text-xs font-bold text-zinc-600">{fmt(cash.openingBalance)}</p>
                </div>
                <div>
                  <p className="ds-label mb-0.5">Retirou</p>
                  <p className="text-xs font-black text-zinc-800">{fmt(cash.closingBalance || 0)}</p>
                </div>
              </div>
            )
          },
          {
            header: "Diferença",
            render: cash => {
              const diff = (cash.closingBalance || 0) - (cash.expectedBalance || 0);
              if (!cash.closedAt) return <span className="text-zinc-300 text-sm">—</span>;
              return (
                <Badge color={Math.abs(diff) < 0.01 ? "success" : diff > 0 ? "info" : "danger"}>
                  {Math.abs(diff) < 0.01 ? "Exato" : fmt(Math.abs(diff))}
                </Badge>
              );
            }
          },
          {
            header: "Ações",
            className: "text-right",
            render: () => <Button variant="ghost" size="xs">Ver Notas</Button>
          }
        ]}
      />

      <CashRegisterModal
        isOpen={showOpenModal}
        type="open"
        slug={slug}
        onClose={() => setShowOpenModal(false)}
        onSuccess={() => { setShowOpenModal(false); fetchFinanceData(); }}
      />
      <CashRegisterModal
        isOpen={showCloseModal}
        type="close"
        slug={slug}
        expected={currentCash?.expectedBalance || 0}
        onClose={() => setShowCloseModal(false)}
        onSuccess={() => { setShowCloseModal(false); fetchFinanceData(); }}
      />
    </PageWrapper>
  );
}

function CashRegisterModal({ isOpen, type, slug, expected, onClose, onSuccess }: {
  isOpen: boolean,
  type: 'open' | 'close',
  slug: string,
  expected?: number,
  onClose: () => void,
  onSuccess: () => void
}) {
  const [value, setValue] = useState(type === 'close' ? String(expected || 0) : "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/tenants/${slug}/cash/${type === 'open' ? 'open' : 'close'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'open' ? { openingBalance: value } : { closingBalance: value, notes })
      });
      if (res.ok) onSuccess();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const diff = type === 'close' && expected ? parseFloat(value || "0") - expected : 0;
  const isOpen_ = type === 'open';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOpen_ ? "Abrir Caixa" : "Fechar Caixa"}
      size="sm"
      mobileStyle="bottom-sheet"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            variant={isOpen_ ? "primary" : "danger"}
            onClick={handleSubmit}
            disabled={loading || !value}
            className="sm:min-w-[160px]"
          >
            {loading ? "Aguarde..." : isOpen_ ? "Confirmar Abertura" : "Confirmar Fechamento"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="space-y-4">
        {type === 'close' && expected !== undefined && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div>
              <p className="ds-label text-blue-500">Esperado pelo sistema</p>
              <p className="text-xs text-blue-400 mt-0.5 font-medium">Vendas em dinheiro + saldo inicial</p>
            </div>
            <span className="text-base font-black text-blue-600">{fmt(expected)}</span>
          </div>
        )}

        <Input
          label={isOpen_ ? "Valor inicial em caixa" : "Valor contado em espécie"}
          type="number"
          step="0.01"
          placeholder="0,00"
          addonLeft="R$"
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />

        {type === 'close' && Math.abs(diff) > 0.01 && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${diff > 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <Info className={`w-4 h-4 shrink-0 ${diff > 0 ? 'text-green-500' : 'text-red-500'}`} />
            <div>
              <p className={`text-xs font-black uppercase ${diff > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {diff > 0 ? 'Sobra' : 'Quebra'} de {fmt(Math.abs(diff))}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Valor contado vs esperado</p>
            </div>
          </div>
        )}

        {type === 'close' && (
          <Textarea
            label="Observações"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Alguma divergência ou anotação..."
            rows={3}
          />
        )}
      </div>
    </Modal>
  );
}

export function InventoryPanel({ tenant }: { tenant: Tenant | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "low" | "expired" | "internal" | "sale">("all");



  const fetchData = async () => {
    if (!tenant) return;
    try {
      const [iRes, cRes] = await Promise.all([
        apiFetch(`/api/tenants/${tenant.slug}/inventory`),
        apiFetch(`/api/tenants/${tenant.slug}/inventory/categories`)
      ]);
      setItems(await iRes.json());
      setCategories(await cRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const filteredItems = items.filter(item => {
    const nameStr = item.name || "";
    const codeStr = item.code || "";
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          codeStr.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === "low") return matchesSearch && item.minStock && item.quantity <= item.minStock;
    if (filterType === "expired") return matchesSearch && item.expirationDate && new Date(item.expirationDate) < new Date();
    if (filterType === "internal") return matchesSearch && item.usage === "INTERNAL";
    if (filterType === "sale") return matchesSearch && item.usage === "SALE";
    
    return matchesSearch;
  });

  const stats = {
    totalItems: items.length,
    lowStock: items.filter(i => i.minStock && i.quantity <= i.minStock).length,
    expired: items.filter(i => i.expirationDate && new Date(i.expirationDate) < new Date()).length,
    nearExpiry: items.filter(i => {
      if (!i.expirationDate) return false;
      const days = (new Date(i.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7;
    }).length,
    totalValue: items.reduce((acc, i) => acc + (i.purchasePrice || 0) * i.quantity, 0)
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Inventário...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total em Estoque" 
          value={stats.totalItems} 
          icon={Package} 
          color="info"
        />
        <StatCard 
          title="Itens Críticos" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="warning"
        />
        <StatCard 
          title="Próximos do Vencimento" 
          value={stats.nearExpiry} 
          icon={CalendarClock} 
          color="warning"
        />
        <StatCard 
          title="Valor em Insumos" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)} 
          icon={ArrowRightLeft} 
          color="success"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <FilterLineSegmented 
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'low', label: 'Críticos' },
              { value: 'expired', label: 'Vencidos' },
              { value: 'sale', label: 'Para Venda' },
              { value: 'internal', label: 'Consumo' }
            ]}
            value={filterType}
            onChange={val => setFilterType(val as any)}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <Input 
              placeholder="Buscar por nome ou código..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 md:w-64"
              size="sm"
            />
            <Button 
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              size="sm"
              className="w-full sm:w-auto"
              iconLeft={<Plus className="w-4 h-4" />}
            >
              Novo Item
            </Button>
          </div>
        </div>

        <GridTable 
          data={filteredItems}
          keyExtractor={item => item.id}
          emptyMessage="Nenhum item encontrado no inventário."
          columns={[
            {
              header: "Produto",
              render: item => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200/50">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">{item.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">#{item.code || 'S/COD'} • {item.brand || 'Marca n/d'}</p>
                  </div>
                </div>
              )
            },
            {
              header: "Categoria",
              render: item => (
                <Badge color="primary" size="sm">
                  {item.category?.name || 'Geral'}
                </Badge>
              )
            },
            {
              header: "Quantidade",
              className: "text-center",
              render: item => {
                const isLow = item.minStock && item.quantity <= item.minStock;
                return (
                  <div className="flex flex-col items-center">
                    <span className={`text-sm font-black ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.quantity} {item.unit || 'un'}
                    </span>
                    {item.weight && <p className="text-[9px] text-slate-400 italic">({item.weight})</p>}
                  </div>
                );
              }
            },
            {
              header: "Custos",
              render: item => (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400">Compra: <span className="text-slate-800 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.purchasePrice || 0)}</span></p>
                  {item.sellingPrice && (
                    <p className="text-[10px] font-bold text-slate-400">Venda: <span className="text-emerald-600 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.sellingPrice)}</span></p>
                  )}
                </div>
              )
            },
            {
              header: "Status/Validade",
              render: item => {
                const isLow = item.minStock && item.quantity <= item.minStock;
                const isExpired = item.expirationDate && new Date(item.expirationDate) < new Date();
                const isNearExpiry = item.expirationDate && !isExpired && (new Date(item.expirationDate).getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);
                
                return (
                   <div className="space-y-1.5 min-w-[140px]">
                      {isLow && (
                         <Badge color="warning" size="sm" dot>Estoque Crítico</Badge>
                      )}
                      {item.expirationDate ? (
                        <Badge color={isExpired ? "danger" : isNearExpiry ? "warning" : "success"} size="sm">
                          {isExpired ? 'Expirou: ' : 'Vence em: '}
                          {new Date(item.expirationDate).toLocaleDateString()}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-200 font-black uppercase italic">Sem Início</span>
                      )}
                   </div>
                );
              }
            },
            {
              header: "Ações",
              className: "text-right",
              render: item => (
                <div className="flex items-center justify-end gap-1">
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                  >
                    <Settings className="w-4 h-4" />
                  </IconButton>
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    className="text-red-400 hover:text-red-600"
                    onClick={async () => {
                      if (confirm("Deseja realmente remover este item do estoque?")) {
                        await apiFetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
                        fetchData();
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
                </div>
              )
            }
          ]}
        />
      </div>

      <AnimatePresence>
        {showItemForm && (
          <InventoryItemModal 
            tenant={tenant}
            item={editingItem}
            categories={categories}
            onClose={() => setShowItemForm(false)}
            onSave={() => { setShowItemForm(false); fetchData(); }}
            refreshCategories={fetchData}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InventoryItemModal({ tenant, item, categories, onClose, onSave, refreshCategories }: {
  tenant: Tenant | null,
  item: any | null,
  categories: any[],
  onClose: () => void,
  onSave: () => void,
  refreshCategories: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name || "",
    code: item?.code || "",
    brand: item?.brand || "",
    purchasePrice: item?.purchasePrice || "",
    sellingPrice: item?.sellingPrice || "",
    quantity: item?.quantity || "",
    minStock: item?.minStock || "",
    unit: item?.unit || "un",
    weight: item?.weight || "",
    usage: item?.usage || "SALE",
    categoryId: item?.categoryId || "",
    expirationDate: item?.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : "",
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : ""
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = item ? `/api/inventory/items/${item.id}` : `/api/inventory/items`;
    const method = item ? 'PATCH' : 'POST';
    await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tenantId: tenant?.id,
        purchasePrice: parseFloat(form.purchasePrice.toString()) || 0,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice.toString()) : null,
        quantity: parseFloat(form.quantity.toString()) || 0,
        minStock: form.minStock ? parseFloat(form.minStock.toString()) : null
      })
    });
    setLoading(false);
    onSave();
  };

  const SectionHeader = ({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) => (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} className="text-white" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={item ? "Editar Item" : "Novo Item de Estoque"}
        size="xl"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button variant="primary" onClick={() => {}} disabled={loading}
              className="sm:min-w-[160px]"
              type="submit"
              form="inventory-form"
            >
              {loading ? "Salvando..." : item ? "Salvar Alterações" : "Cadastrar Item"}
            </Button>
          </ModalFooter>
        }
      >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-3">

          {/* Identificação */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={Info} label="Identificação" color="bg-blue-500" />
            <Input
              label="Nome"
              required
              size="sm"
              placeholder="Ex: Coca-Cola 350ml"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input label="SKU" size="sm" placeholder="78900..." value={form.code} onChange={e => set("code", e.target.value)} />
              <Input label="Marca" size="sm" placeholder="Ambev" value={form.brand} onChange={e => set("brand", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-label">Categoria</label>
              <div className="flex gap-1.5">
                <Select
                  size="sm"
                  value={form.categoryId}
                  onChange={e => set("categoryId", e.target.value)}
                  wrapperClassName="flex-1 min-w-0"
                >
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="w-8 h-8 shrink-0 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <Select label="Uso" size="sm" value={form.usage} onChange={e => set("usage", e.target.value)}>
              <option value="SALE">Venda direta</option>
              <option value="INTERNAL">Insumo interno</option>
            </Select>
          </div>

          {/* Estoque */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={Package} label="Estoque" color="bg-orange-500" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Quantidade" required size="sm" type="number" step="0.001" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
              <Input label="Mín. alerta" size="sm" type="number" step="0.01" placeholder="0" value={form.minStock} onChange={e => set("minStock", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Unidade" size="sm" placeholder="un, kg..." value={form.unit} onChange={e => set("unit", e.target.value)} />
              <Input label="Peso/Volume" size="sm" placeholder="500g, 1.5L" value={form.weight} onChange={e => set("weight", e.target.value)} />
            </div>
          </div>

          {/* Financeiro */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={CircleDollarSign} label="Financeiro" color="bg-emerald-500" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Custo (R$)" size="sm" type="number" step="0.01" placeholder="0,00" value={form.purchasePrice} onChange={e => set("purchasePrice", e.target.value)} />
              <Input label="Venda (R$)" size="sm" type="number" step="0.01" placeholder="0,00" value={form.sellingPrice} onChange={e => set("sellingPrice", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Compra" size="sm" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
              <Input label="Validade" size="sm" type="date" value={form.expirationDate} onChange={e => set("expirationDate", e.target.value)} />
            </div>
          </div>

        </form>
      </Modal>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Nova Categoria"
        size="sm"
        mobileStyle="center"
      >
        <CategoryForm
          tenantId={tenant?.id || ""}
          onSuccess={() => { refreshCategories(); setIsCategoryModalOpen(false); }}
          onClose={() => setIsCategoryModalOpen(false)}
          isInventory
        />
      </Modal>
    </>
  );
}

function CategoryForm({ tenantId, onSuccess, onClose, isInventory = false }: { tenantId: string, onSuccess: () => void, onClose: () => void, isInventory?: boolean }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = isInventory ? "/api/inventory/categories" : "/api/categories";
    await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tenantId })
    });
    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome da categoria"
        required
        autoFocus
        placeholder="Ex: Embalagens, Frios..."
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <ModalFooter>
        <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>Voltar</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Criar Categoria"}
        </Button>
      </ModalFooter>
    </form>
  );
}

// ─── ZoneAdder ────────────────────────────────────────────────────────────────
function ZoneAdder({ onAdd }: { onAdd: (zone: DeliveryZone) => void }) {
  const [cepInput, setCepInput] = useState("");
  const [fee, setFee] = useState("");
  const [cepInfo, setCepInfo] = useState<{ cep: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fmtCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const searchCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) { setCepInfo(null); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (d.erro) { setError("CEP não encontrado"); setCepInfo(null); return; }
      setCepInfo({ cep: digits, label: [d.bairro, d.localidade, d.uf].filter(Boolean).join(", ") });
    } catch {
      setError("Erro ao buscar CEP");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!cepInfo) return;
    onAdd({
      id: Date.now().toString(),
      label: cepInfo.label,
      ceps: [cepInfo.cep],
      fee: parseFloat(fee) || 0,
    });
    setCepInput("");
    setFee("");
    setCepInfo(null);
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-3 bg-slate-50/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar zona por CEP</p>

      {/* CEP search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={cepInput}
            onChange={e => { setCepInput(fmtCep(e.target.value)); setCepInfo(null); setError(""); }}
            onBlur={e => searchCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={() => searchCep(cepInput)}
          className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap"
        >
          Buscar
        </button>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {/* CEP result */}
      {cepInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs font-bold text-green-800 flex-1">
            {cepInput} — {cepInfo.label}
          </span>
        </div>
      )}

      {/* Fee */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-400 shrink-0">Taxa R$</span>
        <input
          type="number" min="0" step="0.50"
          value={fee}
          onChange={e => setFee(e.target.value)}
          placeholder="0,00"
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <span className="text-xs text-slate-400">(0 = grátis)</span>
      </div>

      <Button
        type="button" size="xs" variant="outline"
        disabled={!cepInfo}
        onClick={handleAdd}
      >
        + Adicionar zona
      </Button>
    </div>
  );
}


export function TableManagement({ 
  tenant, 
  checkoutRequests = [], 
  onClearTable 
}: { 
  tenant: Tenant; 
  checkoutRequests?: Array<{ tableId: string }>;
  onClearTable?: (tableId: string) => void;
}) {
  const [tables, setTables] = useState<string[]>(["1", "2", "3", "4", "5"]);
  const [newTable, setNewTable] = useState("");

  const addTable = () => {
    if (newTable && !tables.includes(newTable)) {
      setTables([...tables, newTable].sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      }));
      setNewTable("");
    }
  };

  const removeTable = (id: string) => {
    setTables(tables.filter(t => t !== id));
  };

  const menuUrl = `${window.location.origin}/${tenant.slug}/mesa/`;

  return (
    <ContentCard padding="none" className="overflow-hidden">
      <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Gestão de QR Codes</h3>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Gere códigos para Balcão ou Mesas específicas</p>
      </div>
      
      <div className="p-6 sm:p-8 space-y-10">
        
        {/* Balcão Section */}
        <section className="space-y-4">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ponto de Venda Geral</h4>
          <div className="max-w-sm bg-amber-50 border border-amber-100 rounded-[2rem] p-6 space-y-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-2xl font-black text-amber-900">Balcão</h4>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Pedido sem mesa fixa</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700">
                <Monitor className="w-5 h-5" />
              </div>
            </div>

            <div className="aspect-square bg-white rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-amber-200 p-4">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(menuUrl + 'Balcao')}`} 
                alt="QR Balcão"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                variant="primary" 
                size="sm" 
                className="flex-1 text-[10px] bg-amber-600 border-amber-600 hover:bg-amber-700"
                onClick={() => {
                  const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(menuUrl + 'Balcao')}`;
                  window.open(link, '_blank');
                }}
              >
                Imprimir QR Balcão
              </Button>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 w-full" />

        {/* Dynamic Tables Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Mesas do Salão</h4>
            <div className="flex gap-2">
              <input 
                value={newTable} 
                onChange={e => setNewTable(e.target.value)} 
                placeholder="Nº da Mesa" 
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 w-28"
              />
              <Button variant="primary" size="sm" onClick={addTable}>
                + Adicionar Mesa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {tables.map(table => {
              const isRequestingAccount = checkoutRequests.some(r => r.tableId === table);
              
              return (
                <div 
                  key={table} 
                  className={`bg-white border rounded-3xl p-4 space-y-3 hover:shadow-xl hover:shadow-slate-100 transition-all group relative ${
                    isRequestingAccount 
                      ? "border-red-500 shadow-lg shadow-red-100 animate-pulse" 
                      : "border-zinc-100 hover:border-amber-400"
                  }`}
                >
                  <button 
                    onClick={() => removeTable(table)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="text-center">
                    <h4 className="text-lg font-black text-slate-800 leading-tight">Mesa {table}</h4>
                    {isRequestingAccount && (
                      <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-1">Pediu a Conta!</p>
                    )}
                  </div>

                  <div className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center p-2 border border-slate-100">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(menuUrl + table)}`} 
                      alt={`QR Mesa ${table}`}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {isRequestingAccount ? (
                      <button 
                        onClick={() => onClearTable?.(table)}
                        className="text-[9px] font-black uppercase text-white bg-red-600 py-2 rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                      >
                        Liberar Mesa
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(menuUrl + table)}`;
                          window.open(link, '_blank');
                        }}
                        className="text-[9px] font-black uppercase text-amber-600 bg-amber-50 py-2 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Baixar QR
                      </button>
                    )}
                    <button 
                      onClick={() => window.open(menuUrl + table, '_blank')}
                      className="text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Testar Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {tables.length === 0 && (
            <EmptyState 
              title="Nenhuma mesa no salão" 
              description="Cadastre as mesas para gerar os códigos individuais."
              icon={Monitor}
            />
          )}
        </section>
      </div>
    </ContentCard>
  );
}

export function KitchenKDSPanel({
  orders,
  updateStatus,
  waiterCalls = [],
  onDismissWaiterCall,
}: {
  orders: Order[];
  updateStatus: (id: string, status: string) => void;
  waiterCalls?: Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>;
  onDismissWaiterCall?: (ts: number) => void;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "consolidated">("grid");
  const pendingOrders = orders.filter(o => o.status === "PENDING");
  const preparingOrders = orders.filter(o => o.status === "PREPARING");
  const kitchenOrders = [...pendingOrders, ...preparingOrders];

  // Calculate consolidated items (pending + preparing)
  const consolidated = kitchenOrders.reduce((acc: Record<string, { name: string; quantity: number }>, order) => {
    order.items.forEach(item => {
      const key = item.productId;
      if (!acc[key]) acc[key] = { name: item.product?.name || "Produto", quantity: 0 };
      acc[key].quantity += item.quantity;
    });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Waiter Call Alerts */}
      {waiterCalls.length > 0 && (
        <div className="space-y-2">
          {waiterCalls.map(w => (
            <div key={w.timestamp} className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shrink-0 animate-pulse">
                <Bell className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-amber-800 uppercase tracking-widest">
                  {w.requestBill ? "Pedir Conta" : "Chamada"} — Mesa {w.tableId}
                </p>
                <p className="text-sm font-bold text-amber-700 truncate">{w.customerName}</p>
                {w.note && <p className="text-xs text-amber-600 italic truncate">{w.note}</p>}
              </div>
              <button
                onClick={() => onDismissWaiterCall?.(w.timestamp)}
                className="shrink-0 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-black text-[10px] font-black uppercase rounded-xl transition-all"
              >
                Ciente
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionTitle
          title="Cozinha (KDS)"
          description="Gestão de produção em tempo real"
          icon={Utensils}
        />
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === "grid" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Cards
          </button>
          <button 
            onClick={() => setViewMode("consolidated")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              viewMode === "consolidated" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            Resumo
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="space-y-6">
          {/* Pending (new orders) */}
          {pendingOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-600">
                  Novos Pedidos ({pendingOrders.length})
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pendingOrders.map(order => (
                  <KDSTicket
                    key={order.id}
                    order={order}
                    onComplete={() => updateStatus(order.id, 'PREPARING')}
                    actionLabel="Iniciar Preparo"
                    highlight="yellow"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Preparing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-600">
                Em Preparo ({preparingOrders.length})
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {preparingOrders.map(order => (
                <KDSTicket
                  key={order.id}
                  order={order}
                  onComplete={() => updateStatus(order.id, 'SHIPPED')}
                  actionLabel="Concluir Pedido"
                  highlight="orange"
                />
              ))}
              {preparingOrders.length === 0 && pendingOrders.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-200">
                    <Clock className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum pedido na cozinha no momento</p>
                </div>
              )}
              {preparingOrders.length === 0 && pendingOrders.length > 0 && (
                <div className="col-span-full py-10 text-center">
                  <p className="text-sm text-slate-400">Nenhum pedido em preparo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ContentCard>
          <div className="space-y-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-4">
              Total de Itens para Produção (Novos + Em Preparo)
            </p>
            {Object.keys(consolidated).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nenhum item na fila</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(consolidated).map(([id, item]) => (
                  <div key={id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-sm font-black text-slate-800">{item.name}</span>
                    <span className="text-lg font-black text-[#C9A227] bg-white w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border border-[#C9A227]/10">
                      {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ContentCard>
      )}
    </div>
  );
}

function KDSTicket({ order, onComplete, actionLabel = "Concluir Pedido", highlight = "orange" }: {
  order: Order;
  onComplete: () => void;
  actionLabel?: string;
  highlight?: "yellow" | "orange";
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(order.createdAt).getTime();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 60000));
    }, 10000);
    setElapsed(Math.floor((Date.now() - start) / 60000));
    return () => clearInterval(timer);
  }, [order.createdAt]);

  const getUrgencyColor = () => {
    if (highlight === "yellow") return "border-yellow-300 bg-yellow-50";
    if (elapsed > 20) return "border-red-500 bg-red-50/30";
    if (elapsed > 10) return "border-amber-500 bg-amber-50/30";
    return "border-slate-200 bg-white";
  };

  return (
    <motion.div
      layout
      className={`border-2 rounded-3xl p-5 space-y-4 flex flex-col shadow-sm transition-colors ${getUrgencyColor()}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-slate-800">#{order.id.slice(-4).toUpperCase()}</span>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              order.orderType === 'DELIVERY' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            }`}>
              {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? `Mesa ${order.tableId}` : 'Retirada'}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 mt-1">{order.customerName}</p>
        </div>
        <div className="flex flex-col items-end">
          <div className={`flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full ${
            elapsed > 15 ? 'text-red-600 bg-red-100 animate-pulse' : 'text-slate-500 bg-slate-100'
          }`}>
            <Timer className="w-3.5 h-3.5" />
            {elapsed} min
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2.5">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-3 bg-white/60 rounded-2xl border border-slate-100/50">
            <span className="text-sm font-black text-[#C9A227] min-w-[20px]">{item.quantity}x</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 leading-tight">{item.product?.name}</p>
              {item.notes && (
                <div className="mt-1 flex items-start gap-1.5 text-[10px] font-black text-amber-600 uppercase tracking-tight italic">
                  <Bell className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{item.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={onComplete}
        variant="primary"
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 ${highlight === "yellow" ? "!bg-yellow-400 !text-black hover:!bg-yellow-300" : ""}`}
      >
        {actionLabel}
      </Button>
    </motion.div>
  );
}

const HISTORY_PREFS_KEY = 'orderHistory_prefs_v1';

function loadHistoryPrefs(slug: string) {
  try {
    const raw = localStorage.getItem(`${HISTORY_PREFS_KEY}_${slug}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function saveHistoryPrefs(slug: string, prefs: object) {
  try {
    localStorage.setItem(`${HISTORY_PREFS_KEY}_${slug}`, JSON.stringify(prefs));
  } catch {}
}

function exportOrdersCSV(orders: Order[]) {
  const header = ['ID', 'Data', 'Horário', 'Cliente', 'Telefone', 'Tipo', 'Mesa', 'Status', 'Pagamento', 'Total'];
  const rows = orders.map(o => [
    `#${o.id.slice(-6).toUpperCase()}`,
    new Date(o.createdAt).toLocaleDateString('pt-BR'),
    new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    o.customerName,
    o.customerPhone || '',
    o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? 'Mesa' : 'Retirada',
    o.tableId || '',
    o.status === 'DELIVERED' ? 'Concluído' : 'Cancelado',
    o.paymentMethod,
    String(o.total),
  ]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const NOW = new Date();
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function OrderHistoryPanel({
  orders,
  slug
}: {
  orders: Order[];
  slug: string;
}) {
  const prefs = loadHistoryPrefs(slug);

  const [searchTerm, setSearchTerm] = useState<string>(prefs?.searchTerm ?? "");
  const [typeFilter, setTypeFilter] = useState<string>(prefs?.typeFilter ?? "all");
  const [paymentFilter, setPaymentFilter] = useState<string>(prefs?.paymentFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<string>(prefs?.statusFilter ?? "all");
  // date mode: 'range' | 'month'
  const [dateMode, setDateMode] = useState<'range' | 'month'>(prefs?.dateMode ?? 'month');
  const [dateFrom, setDateFrom] = useState<string | null>(prefs?.dateFrom ?? null);
  const [dateTo, setDateTo] = useState<string | null>(prefs?.dateTo ?? null);
  const [selMonth, setSelMonth] = useState<number>(prefs?.selMonth ?? NOW.getMonth());
  const [selYear, setSelYear] = useState<number>(prefs?.selYear ?? NOW.getFullYear());

  // persist prefs on change
  useEffect(() => {
    saveHistoryPrefs(slug, { searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear });
  }, [slug, searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear]);

  const filtered = useMemo(() => {
    return orders
      .filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED')
      .filter(o => {
        const d = new Date(o.createdAt);

        if (dateMode === 'month') {
          if (d.getMonth() !== selMonth || d.getFullYear() !== selYear) return false;
        } else {
          if (dateFrom) {
            const from = new Date(dateFrom + 'T00:00:00');
            if (d < from) return false;
          }
          if (dateTo) {
            const to = new Date(dateTo + 'T23:59:59');
            if (d > to) return false;
          }
        }

        const q = searchTerm.toLowerCase();
        const matchSearch = !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
        const matchType = typeFilter === 'all' || o.orderType === typeFilter;
        const matchPayment = paymentFilter === 'all' || o.paymentMethod === paymentFilter;
        const matchStatus = statusFilter === 'all' || o.status === statusFilter;
        return matchSearch && matchType && matchPayment && matchStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, searchTerm, typeFilter, paymentFilter, statusFilter, dateMode, dateFrom, dateTo, selMonth, selYear]);

  const totalSales = useMemo(() => filtered.reduce((acc, o) => acc + (o.status === 'DELIVERED' ? o.total : 0), 0), [filtered]);
  const avgTicket = filtered.filter(o => o.status === 'DELIVERED').length > 0
    ? totalSales / filtered.filter(o => o.status === 'DELIVERED').length
    : 0;
  const cancelled = filtered.filter(o => o.status === 'CANCELLED').length;

  const { page, pageSize, setPage, setPageSize, paginatedData, totalPages } = usePagination(filtered, 20);

  const yearOptions = useMemo(() => {
    const years = new Set(orders.map(o => new Date(o.createdAt).getFullYear()));
    years.add(NOW.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const typeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'DELIVERY', label: 'Delivery' },
    { value: 'DINE_IN', label: 'Mesa' },
    { value: 'PICKUP', label: 'Retirada' },
  ];
  const paymentOptions = [
    { value: 'all', label: 'Pagamento' },
    { value: 'PIX', label: 'Pix' },
    { value: 'CREDIT', label: 'Crédito' },
    { value: 'DEBIT', label: 'Débito' },
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'VR', label: 'VR/VA' },
  ];
  const statusOptions = [
    { value: 'all', label: 'Status' },
    { value: 'DELIVERED', label: 'Concluído' },
    { value: 'CANCELLED', label: 'Cancelado' },
  ];

  const columns = useMemo(() => [
    {
      header: 'ID',
      render: (o: Order) => (
        <span className="text-xs font-black text-slate-800 tabular-nums">#{o.id.slice(-6).toUpperCase()}</span>
      ),
    },
    {
      header: 'Data / Hora',
      render: (o: Order) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-slate-700">
            {new Date(o.createdAt).toLocaleDateString('pt-BR')}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      header: 'Cliente',
      render: (o: Order) => (
        <p className="text-xs font-bold text-slate-700 truncate max-w-[130px]">{o.customerName}</p>
      ),
    },
    {
      header: 'Tipo',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          {o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? `Mesa ${o.tableId || ''}` : 'Retirada'}
        </span>
      ),
    },
    {
      header: 'Status',
      hideOnMobile: true,
      render: (o: Order) => (
        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
          o.status === 'DELIVERED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {o.status === 'DELIVERED' ? 'Concluído' : 'Cancelado'}
        </span>
      ),
    },
    {
      header: 'Pagamento',
      hideOnMobile: true,
      render: (o: Order) => <PaymentBadge method={o.paymentMethod.toLowerCase() as any} size="sm" />,
    },
    {
      header: 'Valor',
      render: (o: Order) => (
        <span className="text-xs font-black text-slate-800 tabular-nums">{fmt(o.total)}</span>
      ),
    },
    {
      header: '',
      render: (o: Order) => (
        <Link
          to={`/dashboard/${slug}/historico/${o.id}`}
          className="p-2 text-slate-300 hover:text-amber-500 transition-colors inline-block"
        >
          <Eye className="w-4 h-4" />
        </Link>
      ),
    },
  ], [slug]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <SectionTitle
          title="Histórico de Pedidos"
          description="Relatório detalhado de vendas finalizadas"
          icon={History}
        />
        <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => exportOrdersCSV(filtered)}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <StatGrid cols={3} className="mb-2">
        <StatCard title="Vendas Filtradas" value={fmt(totalSales)} icon={CircleDollarSign} color="success" />
        <StatCard title="Total de Pedidos" value={filtered.length} icon={Package} color="info" />
        <StatCard title="Ticket Médio" value={fmt(avgTicket)} icon={TrendingUp} color="warning" />
      </StatGrid>

      {/* Filter bar */}
      <FilterLine>
        {/* Linha 1: Modo de data + seletores */}
        <FilterLineSection grow wrap>
          {/* Segmentado Mês / Período */}
          <FilterLineItem fullOnMobile={false}>
            <FilterLineSegmented
              value={dateMode}
              onChange={v => { setDateMode(v as 'range' | 'month'); }}
              options={[
                { value: 'month', label: 'Por Mês' },
                { value: 'range', label: 'Período' },
              ]}
              size="sm"
            />
          </FilterLineItem>

          {dateMode === 'month' ? (
            <>
              {/* Seletor de Mês */}
              <FilterLineItem fullOnMobile={false}>
                <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2 h-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (selMonth === 0) { setSelMonth(11); setSelYear(y => y - 1); }
                      else setSelMonth(m => m - 1);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-black text-zinc-700 w-8 text-center">{MONTH_NAMES[selMonth]}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selMonth === 11) { setSelMonth(0); setSelYear(y => y + 1); }
                      else setSelMonth(m => m + 1);
                    }}
                    className="p-1 text-zinc-400 hover:text-amber-500 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </FilterLineItem>

              {/* Seletor de Ano */}
              <FilterLineItem fullOnMobile={false}>
                <select
                  value={selYear}
                  onChange={e => { setSelYear(Number(e.target.value)); }}
                  className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-700 outline-none focus:border-amber-400"
                >
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </FilterLineItem>
            </>
          ) : (
            <FilterLineItem grow>
              <FilterLineDateRange
                from={dateFrom}
                to={dateTo}
                onFromChange={v => setDateFrom(v)}
                onToChange={v => setDateTo(v)}
              />
            </FilterLineItem>
          )}
        </FilterLineSection>

        {/* Linha 2: Busca + dropdowns */}
        <FilterLineSection grow wrap>
          <FilterLineItem grow>
            <FilterLineSearch
              value={searchTerm}
              onChange={v => setSearchTerm(v)}
              placeholder="Buscar por ID ou cliente..."
            />
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={paymentFilter}
              onChange={e => setPaymentFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {paymentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>

          <FilterLineItem fullOnMobile={false}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-black text-zinc-600 outline-none focus:border-amber-400"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterLineItem>
        </FilterLineSection>
      </FilterLine>

      <GridTable
        data={paginatedData}
        columns={columns}
        keyExtractor={o => o.id}
        emptyMessage={
          <EmptyState
            icon={History}
            title="Nenhum pedido encontrado"
            description="Tente ajustar os filtros de data ou busca"
          />
        }
        noDesktopCard={false}
        pagination={{
          total: filtered.length,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: setPageSize,
        }}
      />
    </div>
  );
}
