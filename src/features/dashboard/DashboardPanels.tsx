import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ClipboardList, 
  Utensils, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
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
  Plus
} from "lucide-react";
import socket from "../../lib/socket";
import { apiFetch } from "../../lib/api";
import { Order, Tenant, CashRegister } from "../../types";
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
  GridTable
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
              className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden"
              style={{ borderLeftWidth: 4, borderLeftColor: st.border }}
            >
              {/* Row principal */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-zinc-50"
                onClick={() => toggleOrder(order.id, isHistory)}
              >
                {/* ID + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-zinc-800">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${st.color}`}>
                      {st.label}
                    </span>
                    <OrderWaitTime createdAt={order.createdAt} status={order.status} />
                  </div>
                  <p className="text-xs text-zinc-500 font-medium mt-0.5 truncate">
                    {order.customerName} · {order.items?.map(i => `${i.quantity}x ${i.product?.name}`).join(', ')}
                  </p>
                </div>

                {/* Valor + hora */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-zinc-800">{fmt(order.total)}</p>
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {/* Chevron */}
                <ChevronRight className={`w-4 h-4 text-zinc-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
              </div>

              {/* Ações rápidas */}
              <div className="px-4 pb-3 flex gap-2" onClick={e => e.stopPropagation()}>
                {order.status === 'PENDING' && (
                  <Button size="sm" variant="primary" className="flex-1" onClick={() => updateStatus(order.id, 'PREPARING')}>
                    Aceitar Pedido
                  </Button>
                )}
                {order.status === 'PREPARING' && (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateStatus(order.id, 'SHIPPED')}>
                    {order.orderType === 'DELIVERY' ? 'Despachar' : 'Marcar Pronto'}
                  </Button>
                )}
                {order.status === 'SHIPPED' && (
                  <Button size="sm" variant="success" className="flex-1" onClick={() => updateStatus(order.id, 'DELIVERED')}>
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
                    className="overflow-hidden"
                  >
                    <div className="border-t border-zinc-100 bg-zinc-50/60 p-4 space-y-4">

                      {/* Itens */}
                      <div className="space-y-2">
                        <p className="ds-label">Itens do pedido</p>
                        {order.items?.map((item, idx) => (
                          <div key={idx} className="bg-white rounded-xl border border-zinc-100 px-3 py-2.5 flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-zinc-800">{item.quantity}x {item.product?.name}</p>
                              {item.notes && (
                                <p className="text-[11px] text-orange-600 font-medium mt-1 flex items-center gap-1">
                                  <Utensils className="w-3 h-3 shrink-0" /> {item.notes}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold text-zinc-400 shrink-0">{fmt(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Info cliente */}
                      <div className="bg-white rounded-xl border border-zinc-100 px-3 py-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600">
                            <Phone className="w-3 h-3 text-zinc-300" />
                            {order.customerPhone}
                          </div>
                          <Badge color={order.orderType === 'DELIVERY' ? 'warning' : 'info'}>
                            {order.orderType === 'DELIVERY' ? 'Delivery' : 'Retirada'}
                          </Badge>
                        </div>
                        {order.address && (
                          <p className="text-xs text-zinc-400 italic">{order.address}</p>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                          <span className="ds-label">Pagamento</span>
                          <span className="text-xs font-black text-blue-600">{order.paymentMethod}</span>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="flex items-center justify-between bg-zinc-900 rounded-xl px-4 py-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total</span>
                        <span className="text-base font-black text-white">{fmt(order.total)}</span>
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

const DEFAULT_HOURS = Object.fromEntries(DAY_KEYS_UI.map(d => [d, { enabled: !["sun"].includes(d), open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" }]));

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

interface AddressForm {
  cep: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; country: string;
}

const EMPTY_ADDR: AddressForm = { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "Brasil" };

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: tenant?.whatsapp || "",
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

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || "", description: tenant.description || "", logoUrl: tenant.logoUrl || "", whatsapp: tenant.whatsapp || "", isOpen: tenant.isOpen ?? true });
      setAddr(parseAddress(tenant.address) ?? { ...EMPTY_ADDR });
      try { setHours(tenant.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
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
      await apiFetch(`/api/owner/tenants/${tenant?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, address: JSON.stringify(addr), businessHours: JSON.stringify(hours) })
      });
      refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: string, field: string, value: any) =>
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }));

  const setA = (field: keyof AddressForm, value: string) => setAddr(a => ({ ...a, [field]: value }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <ContentCard padding="lg">
        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ImageUploader label="Logo / Imagem da Unidade" value={form.logoUrl} onChange={(val) => setForm({...form, logoUrl: val})} description="Aparecerá no topo do cardápio digital." />
            <div className="space-y-4">
              <Input label="Nome do estabelecimento" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pastel do Edu" />
              <Input label="WhatsApp de contato" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} placeholder="5511999999999" hint="DDI + DDD + número" />
            </div>
          </div>
          <Input label="Slogan / Descrição curta" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Os melhores pastéis da cidade" />

          {/* Address */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Endereço</p>
            <div className="space-y-3">
              {/* CEP */}
              <div className="flex gap-3 items-end">
                <Input
                  label="CEP"
                  value={addr.cep}
                  onChange={e => { setA("cep", e.target.value); setCepError(""); }}
                  onBlur={e => fetchCep(e.target.value)}
                  placeholder="00000-000"
                  wrapperClassName="w-44"
                  error={cepError || undefined}
                />
                <Button type="button" variant="outline" size="sm" loading={cepLoading}
                  onClick={() => fetchCep(addr.cep)} className="mb-0.5">
                  Buscar CEP
                </Button>
                <p className="text-xs text-slate-400 mb-2">Preenchimento automático via ViaCEP</p>
              </div>

              {/* Street + number */}
              <div className="grid grid-cols-3 gap-3">
                <Input label="Logradouro" value={addr.street} onChange={e => setA("street", e.target.value)} placeholder="Rua, Av, Travessa..." wrapperClassName="col-span-2" />
                <Input label="Número" value={addr.number} onChange={e => setA("number", e.target.value)} placeholder="123" />
              </div>

              {/* Complement + neighborhood */}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Complemento" value={addr.complement} onChange={e => setA("complement", e.target.value)} placeholder="Apto, Sala, Bloco..." />
                <Input label="Bairro" value={addr.neighborhood} onChange={e => setA("neighborhood", e.target.value)} placeholder="Bairro" />
              </div>

              {/* City + state + country */}
              <div className="grid grid-cols-3 gap-3">
                <Input label="Cidade" value={addr.city} onChange={e => setA("city", e.target.value)} placeholder="Cidade" wrapperClassName="col-span-1" />
                <Input label="Estado (UF)" value={addr.state} onChange={e => setA("state", e.target.value.toUpperCase().slice(0,2))} placeholder="SP" />
                <Input label="País" value={addr.country} onChange={e => setA("country", e.target.value)} placeholder="Brasil" />
              </div>

              {/* Preview */}
              {(addr.street || addr.city) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-500 font-medium">
                  📍 {buildAddressString(addr)}
                </div>
              )}
            </div>
          </div>

          {/* isOpen toggle */}
          <div className="rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-slate-900">Estabelecimento aberto agora</p>
              <p className="text-xs text-slate-500 mt-0.5">Desativar fecha o cardápio imediatamente e o bot avisa clientes.</p>
            </div>
            <Switch checked={form.isOpen} onCheckedChange={v => setForm(f => ({ ...f, isOpen: v }))} />
          </div>

          {/* Business hours */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Horários de funcionamento</p>
            <div className="space-y-2">
              {DAY_KEYS_UI.map(day => {
                const d = hours[day] ?? { enabled: false, open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" };
                const timeInput = (val: string, field: string) => (
                  <input type="time" value={val} onChange={e => setDay(day, field, e.target.value)}
                    className="bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                );
                return (
                  <div key={day} className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Switch checked={d.enabled} onCheckedChange={v => setDay(day, "enabled", v)} />
                      <span className="w-20 text-sm font-bold text-slate-700 shrink-0">{DAY_LABELS[day]}</span>
                      {d.enabled ? (
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          {timeInput(d.open, "open")}
                          <span className="text-xs text-slate-400 font-bold">até</span>
                          {timeInput(d.close, "close")}
                          <button
                            type="button"
                            onClick={() => setDay(day, "breakEnabled", !d.breakEnabled)}
                            className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border transition-colors ${d.breakEnabled ? "bg-amber-50 border-amber-300 text-amber-700" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                          >
                            {d.breakEnabled ? "▸ Intervalo" : "+ Intervalo"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold flex-1">Fechado</span>
                      )}
                    </div>
                    {/* Break row */}
                    {d.enabled && d.breakEnabled && (
                      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-dashed border-amber-200 bg-amber-50/50">
                        <span className="w-20 shrink-0" />
                        <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest shrink-0">Intervalo</span>
                        <div className="flex items-center gap-2">
                          {timeInput(d.breakStart ?? "12:00", "breakStart")}
                          <span className="text-xs text-slate-400 font-bold">até</span>
                          {timeInput(d.breakEnd ?? "13:00", "breakEnd")}
                        </div>
                        <span className="text-[10px] text-amber-500 ml-1">Pausa / almoço</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Link */}
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Link do cardápio</p>
              <p className="text-sm font-bold text-blue-800 break-all">{window.location.origin}/{tenant?.slug}</p>
            </div>
            <Button type="button" variant="outline" size="xs" className="w-full sm:w-auto"
              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${tenant?.slug}`); }}>
              Copiar link
            </Button>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            {saved && <span className="text-sm font-bold text-green-600">✓ Salvo!</span>}
            <Button type="submit" loading={saving} iconLeft={<CheckCircle2 className="w-4 h-4" />}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </ContentCard>
    </div>
  );
}

export function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");

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
    variants: [] as { name: string, price: string, description: string, inventoryItemId: string }[]
  });

  useEffect(() => {
    if (tenant) {
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
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim(), tenantId: tenant?.id })
        });
      }
      refresh();
      closeCatModal();
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Excluir categoria e todos os produtos dela?")) return;
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (selectedCat === id) setSelectedCat("all");
    refresh();
  };

  const openNewProduct = (categoryId: string) => {
    setEditingProduct(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", variants: [] });
    setProdModal({ open: true, categoryId });
  };

  const openEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setProdForm({
      name: prod.name, description: prod.description || "", price: String(prod.price),
      imageUrl: prod.imageUrl || "", inventoryItemId: prod.inventoryItemId || "",
      variants: prod.variants?.map((v: any) => ({ name: v.name, price: String(v.price), description: v.description || "", inventoryItemId: v.inventoryItemId || "" })) || []
    });
    setProdModal({ open: true, categoryId: prod.categoryId });
  };

  const closeProdModal = () => { setProdModal({ open: false, categoryId: null }); setEditingProduct(null); };

  const saveProduct = async () => {
    if (!prodForm.name || !prodModal.categoryId) return;
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    await apiFetch(url, {
      method: editingProduct ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prodForm, categoryId: prodModal.categoryId, tenantId: tenant?.id, available: true })
    });
    refresh();
    closeProdModal();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    refresh();
  };

  const addVariantField = () => setProdForm(prev => ({ ...prev, variants: [...prev.variants, { name: "", price: "", description: "", inventoryItemId: "" }] }));
  const removeVariantField = (i: number) => setProdForm(prev => ({ ...prev, variants: prev.variants.filter((_, idx) => idx !== i) }));
  const updateVariantField = (i: number, field: string, value: string) => setProdForm(prev => ({ ...prev, variants: prev.variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v) }));

  const categories = tenant?.categories || [];
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

          {/* Products */}
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
              <div key={prod.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                  {prod.imageUrl
                    ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-5 h-5" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{prod.name}</p>
                  <p className="text-xs text-slate-400 font-medium">
                    {prod.variants?.length > 0
                      ? `${prod.variants.length} variações • desde ${fmt(Math.min(...prod.variants.map((v: any) => v.price)))}`
                      : fmt(prod.price)
                    }
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
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
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Vincular ao estoque (opcional)</label>
              <select value={prodForm.inventoryItemId} onChange={e => setProdForm({ ...prodForm, inventoryItemId: e.target.value })}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                <option value="">Sem vínculo de estoque</option>
                {inventoryItems.map(item => <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit})</option>)}
              </select>
            </div>
          )}

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


