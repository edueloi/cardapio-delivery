import React, { useState, useEffect, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  closestCenter, useDroppable, type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  ChefHat,
  Users,
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
  Download,
  Smartphone,
  MapPin,
  Ruler,
  Building2,
  ExternalLink,
  Edit3,
  Save,
  CheckCircle
} from "lucide-react";
import socket from "../../lib/socket";
import { apiFetch, apiJson } from "../../lib/api";
import { Order, Tenant, CashRegister, DeliveryConfig, DeliveryZone, KmRange, PaymentConfig, PaymentMethodConfig, StoneConfig, FiscalConfig, DisplayPanelConfig, dineInOrderLabel } from "../../types";
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
  ConfirmModal,
  Input,
  CurrencyInput,
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
  usePagination,
  useToast
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
                            {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? dineInOrderLabel(order) : 'Retirada'}
                          </span>
                        </div>
                        {order.address && (
                          <p className="text-[10px] text-slate-400 font-medium italic border-l-2 border-slate-200 pl-2 leading-relaxed">
                            {order.address}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="ds-label">Método de Pagamento</span>
                          {order.orderType === "DINE_IN" ? (
                            <span className="text-[10px] font-bold text-slate-400 italic">A definir no fechamento</span>
                          ) : (
                            <PaymentBadge method={order.paymentMethod.toLowerCase() as any} size="sm" />
                          )}
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

// ─── Permission tabs metadata for the editor ──────────────────────────────────
const PERM_TABS = [
  { id: "overview",    label: "Visão Geral",       group: "Operação" },
  { id: "pos",         label: "PDV — Caixa",       group: "Operação" },
  { id: "waiter",      label: "Garçom",            group: "Operação" },
  { id: "live-orders", label: "Painel de Pedidos", group: "Operação" },
  { id: "scheduled",   label: "Agendamentos",      group: "Operação" },
  { id: "kds",         label: "Monitor de Cozinha",group: "Operação" },
  { id: "tables",      label: "Mesas e QR Code",   group: "Operação" },
  { id: "history",     label: "Histórico",         group: "Operação" },
  { id: "menu",        label: "Cardápio",          group: "Catálogo" },
  { id: "inventory",   label: "Estoque",           group: "Catálogo" },
  { id: "production",  label: "Produção",          group: "Catálogo" },
  { id: "suppliers",   label: "Fornecedores",      group: "Catálogo" },
  { id: "finance",     label: "Fluxo de Caixa",    group: "Financeiro" },
  { id: "entries",     label: "Entradas e Saídas", group: "Financeiro" },
  { id: "reports",     label: "Relatórios",        group: "Financeiro" },
  { id: "customers",   label: "Clientes CRM",      group: "Marketing" },
  { id: "loyalty",     label: "Fidelidade",        group: "Marketing" },
  { id: "promotions",  label: "Promoções",         group: "Marketing" },
  { id: "whatsapp",    label: "WhatsApp",          group: "Marketing" },
  { id: "downloads",   label: "Downloads",         group: "Administração" },
] as const;

const PERM_GROUPS = ["Operação", "Catálogo", "Financeiro", "Marketing", "Administração"];

// ─── Presets de cargo — atalhos que já marcam o pacote de permissões certo ────
const ROLE_PRESETS = [
  { id: "waiter",    label: "Garçom",       tabs: ["waiter", "tables"] },
  { id: "cashier",   label: "Caixa / PDV",  tabs: ["pos", "tables", "live-orders", "history"] },
  { id: "kitchen",   label: "Cozinha",      tabs: ["kds", "live-orders"] },
  { id: "custom",    label: "Personalizado", tabs: null },
] as const;

function matchRolePreset(permissions: string[] | null): string {
  if (permissions === null) return "custom";
  const sorted = [...permissions].sort().join(",");
  const found = ROLE_PRESETS.find(p => p.tabs && [...p.tabs].sort().join(",") === sorted);
  return found?.id ?? "custom";
}

interface StaffMember {
  id: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null;
  createdAt: string;
  account: { id: string; email: string; name: string };
}

interface PendingInvite {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null;
  createdAt: string;
  expiresAt: string;
}

function PermissionsEditor({
  permissions,
  onChange,
}: {
  permissions: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const isAll = permissions === null;
  const toggle = (id: string) => {
    if (isAll) {
      onChange(PERM_TABS.map(t => t.id).filter(t => t !== id));
    } else {
      const has = permissions.includes(id);
      const next = has ? permissions.filter(p => p !== id) : [...permissions, id];
      onChange(next);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => onChange(null)}
        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${isAll ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"}`}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isAll ? "border-white bg-white" : "border-slate-300"}`}>
          {isAll && <div className="w-2.5 h-2.5 rounded-full bg-[#0D1B3E]" />}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest">Acesso total (todas as telas)</span>
      </div>

      {PERM_GROUPS.map(group => (
        <div key={group}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {PERM_TABS.filter(t => t.group === group).map(tab => {
              const enabled = isAll || permissions!.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => toggle(tab.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    enabled
                      ? "bg-white border-[#C9A227]/40 shadow-sm text-slate-800"
                      : "bg-slate-50 border-slate-100 text-slate-400 opacity-60"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${enabled ? "bg-[#C9A227] border-[#C9A227]" : "border-slate-300"}`}>
                    {enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-black leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StaffList({ tenant }: { tenant: Tenant | null }) {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StaffMember | null>(null);
  const [cancelInviteConfirm, setCancelInviteConfirm] = useState<PendingInvite | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteSentMessage, setInviteSentMessage] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [inviteName, setInviteName] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[] | null>(null);
  const [invitePreset, setInvitePreset] = useState<string>("custom");
  const [inviteError, setInviteError] = useState("");

  // Edit form
  const [editRole, setEditRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [editName, setEditName] = useState("");
  const [editPerms, setEditPerms] = useState<string[] | null>(null);
  const [editPreset, setEditPreset] = useState<string>("custom");

  const applyPreset = (presetId: string, setPerms: (p: string[] | null) => void, setPreset: (p: string) => void) => {
    setPreset(presetId);
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset?.tabs) setPerms([...preset.tabs]);
  };

  const fetchMembers = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff`) as { members: StaffMember[]; pendingInvites: PendingInvite[] };
      setMembers(data.members);
      setPendingInvites(data.pendingInvites);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, [tenant?.id]);

  const handleInvite = async () => {
    if (!tenant || !inviteEmail.trim()) return;
    setSaving(true);
    setInviteError("");
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, name: inviteName || null, permissions: invitePerms }),
      }) as StaffMember & { pending?: boolean; message?: string };
      if (data.pending) {
        setInviteSentMessage(data.message || "Convite enviado por e-mail.");
        await fetchMembers();
      } else {
        setMembers(prev => [...prev, data as StaffMember]);
      }
      setInviteModal(false);
      setInviteEmail(""); setInviteName(""); setInviteRole("STAFF"); setInvitePerms(null); setInvitePreset("custom");
    } catch (err: any) {
      setInviteError(err.message || "Erro ao adicionar membro.");
    } finally { setSaving(false); }
  };

  const handleCancelInvite = async () => {
    if (!tenant || !cancelInviteConfirm) return;
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/staff/invite/${cancelInviteConfirm.id}`, { method: "DELETE" });
      setPendingInvites(prev => prev.filter(i => i.id !== cancelInviteConfirm.id));
    } catch { /* ignore */ }
    finally { setCancelInviteConfirm(null); }
  };

  const handleUpdate = async () => {
    if (!tenant || !editingMember) return;
    setSaving(true);
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff/${editingMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: editRole, name: editName || null, permissions: editPerms }),
      }) as StaffMember;
      setMembers(prev => prev.map(m => m.id === data.id ? data : m));
      setEditingMember(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!tenant || !deleteConfirm) return;
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/staff/${deleteConfirm.id}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.id !== deleteConfirm.id));
    } catch { /* ignore */ }
    finally { setDeleteConfirm(null); }
  };

  const openEdit = (m: StaffMember) => {
    setEditingMember(m);
    setEditRole(m.role as "ADMIN" | "STAFF");
    setEditName(m.name || "");
    setEditPerms(m.permissions);
    setEditPreset(matchRolePreset(m.permissions));
  };

  const roleColor = (role: string) => role === "OWNER" ? "bg-[#0D1B3E] text-white" : role === "ADMIN" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const roleLabel = (role: string) => role === "OWNER" ? "Proprietário" : role === "ADMIN" ? "Admin" : "Staff";
  const permLabel = (perms: string[] | null) => perms === null ? "Acesso total" : perms.length === 0 ? "Sem acesso" : `${perms.length} tela${perms.length > 1 ? "s" : ""}`;

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <SectionTitle title="Equipe" description="Gerencie membros e defina o que cada um pode acessar" icon={ClipboardList} />
        <Button variant="primary" onClick={() => { setInviteSentMessage(""); setInviteModal(true); }} iconLeft={<Plus className="w-4 h-4" />}>
          Adicionar membro
        </Button>
      </div>

      {inviteSentMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 text-xs font-bold flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{inviteSentMessage}
        </div>
      )}

      <ContentCard padding="none" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 && pendingInvites.length === 0 ? (
          <EmptyState
            title="Nenhum membro ainda"
            description="Adicione colaboradores e defina exatamente o que cada um pode ver e fazer."
            icon={ClipboardList}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/60 transition-colors">
                <div className="w-11 h-11 rounded-2xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center font-black text-sm shrink-0">
                  {(m.name || m.account.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm truncate">{m.name || m.account.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.account.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleColor(m.role)}`}>{roleLabel(m.role)}</span>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{permLabel(m.permissions)}</span>
                </div>
                {m.role !== "OWNER" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(m)} className="p-2 rounded-xl text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-100 transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(m)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pendingInvites.map(i => (
              <div key={i.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/60 transition-colors bg-amber-50/30">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shrink-0">
                  {(i.name || i.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm truncate">{i.name || i.email}</p>
                  <p className="text-[10px] text-amber-600 truncate font-bold">Convite pendente — {i.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleColor(i.role)}`}>{roleLabel(i.role)}</span>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{permLabel(i.permissions)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setCancelInviteConfirm(i)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModal}
        onClose={() => { setInviteModal(false); setInviteError(""); }}
        title="Adicionar membro"
        size="md"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setInviteModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleInvite} loading={saving} disabled={!inviteEmail.trim()}>Adicionar</Button>
          </ModalFooter>
        }
      >
        <div className="p-4 sm:p-5 space-y-5">
          {inviteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{inviteError}
            </div>
          )}
          <Input label="E-mail do usuário" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="joao@email.com" type="email" />
          <Input label="Nome (opcional)" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ex: João — Caixa" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Função</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ADMIN", "STAFF"] as const).map(r => (
                <button key={r} type="button" onClick={() => setInviteRole(r)}
                  className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${inviteRole === r ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {r === "ADMIN" ? "Admin" : "Staff"}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-2 ml-1">{inviteRole === "ADMIN" ? "Admin pode fazer tudo que o proprietário definir, exceto configurações e equipe." : "Staff tem acesso limitado às telas selecionadas."}</p>
          </div>
          {inviteRole === "STAFF" && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Cargo (atalho de permissões)</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id, setInvitePerms, setInvitePreset)}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${invitePreset === p.id ? "bg-[#C9A227] border-[#C9A227] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 ml-1">Escolha um cargo para marcar automaticamente as telas certas, ou ajuste manualmente abaixo.</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Permissões de acesso</p>
            <PermissionsEditor permissions={invitePerms} onChange={(next) => { setInvitePerms(next); setInvitePreset(matchRolePreset(next)); }} />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title={`Editar — ${editingMember?.name || editingMember?.account.name}`}
        size="md"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleUpdate} loading={saving}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="p-4 sm:p-5 space-y-5">
          <Input label="Nome / apelido" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Maria — Atendimento" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Função</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ADMIN", "STAFF"] as const).map(r => (
                <button key={r} type="button" onClick={() => setEditRole(r)}
                  className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${editRole === r ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {r === "ADMIN" ? "Admin" : "Staff"}
                </button>
              ))}
            </div>
          </div>
          {editRole === "STAFF" && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Cargo (atalho de permissões)</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id, setEditPerms, setEditPreset)}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${editPreset === p.id ? "bg-[#C9A227] border-[#C9A227] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 ml-1">Escolha um cargo para marcar automaticamente as telas certas, ou ajuste manualmente abaixo.</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Permissões de acesso</p>
            <PermissionsEditor permissions={editPerms} onChange={(next) => { setEditPerms(next); setEditPreset(matchRolePreset(next)); }} />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Remover membro"
        message={<>Tem certeza que deseja remover <strong>{deleteConfirm?.name || deleteConfirm?.account.name}</strong> da equipe?</>}
        confirmLabel="Remover"
        variant="danger"
      />

      {/* Cancel Invite Confirm */}
      <ConfirmModal
        isOpen={!!cancelInviteConfirm}
        onClose={() => setCancelInviteConfirm(null)}
        onConfirm={handleCancelInvite}
        title="Cancelar convite"
        message={<>Tem certeza que deseja cancelar o convite para <strong>{cancelInviteConfirm?.name || cancelInviteConfirm?.email}</strong>?</>}
        confirmLabel="Cancelar convite"
        variant="danger"
      />
    </PageWrapper>
  );
}

// Componente de Upload de Imagem Reutilizável
const MAX_UPLOAD_SIZE_MB = 5;

function ImageUploader({ value, onChange, label, description }: { value: string, onChange: (val: string) => void, label: string, description?: string }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo depois de um erro
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB). Escolha um arquivo menor.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        if (res.status === 413) throw new Error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB).`);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar imagem");
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
           <p className="text-[9px] text-slate-300 font-medium leading-tight mt-1">
              Recomendado: imagem quadrada (ex: 500x500px), máximo {MAX_UPLOAD_SIZE_MB}MB.
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

// Modal de vínculo de estoque
function InventoryLinkField({
  inventoryItems,
  value,
  onChange,
  autoDisable,
  onAutoDisableChange,
  allCategories,
  editingProductId,
}: {
  inventoryItems: any[];
  value: string;
  onChange: (val: string) => void;
  autoDisable: boolean;
  onAutoDisableChange: (val: boolean) => void;
  allCategories: any[];
  editingProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Apenas itens de VENDA (não uso interno)
  const saleItems = inventoryItems.filter(item => item.usage !== 'INTERNAL');

  // Verifica quais itens já estão vinculados a outros produtos (exceto o editando)
  const allProducts = allCategories.flatMap((c: any) => c.products || []);
  const usedItemIds = new Set(
    allProducts
      .filter((p: any) => p.id !== editingProductId && p.inventoryItemId)
      .map((p: any) => p.inventoryItemId)
  );

  const selectedItem = saleItems.find(i => i.id === value);

  const filtered = saleItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Vincular ao estoque (opcional)</label>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-bold text-left hover:border-amber-300 hover:bg-amber-50/30 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        {selectedItem ? (
          <div className="flex-1 min-w-0">
            <span className="text-slate-800 truncate block">{selectedItem.name}</span>
            <span className={`text-[10px] font-black uppercase ${selectedItem.quantity <= 0 ? "text-red-500" : selectedItem.quantity < 5 ? "text-amber-500" : "text-green-600"}`}>
              {selectedItem.quantity <= 0 ? "Esgotado" : `${selectedItem.quantity} ${selectedItem.unit || 'un'}`}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">Sem vínculo de estoque</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {value && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={autoDisable} onChange={e => onAutoDisableChange(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-xs font-semibold text-slate-600">Desativar automaticamente quando o estoque zerar</span>
        </label>
      )}

      {saleItems.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">Nenhum item de venda cadastrado no estoque.</p>
      )}

      {/* Modal de seleção */}
      <Modal isOpen={open} onClose={() => { setOpen(false); setSearch(""); }} title="Vincular ao Estoque" size="md" mobileStyle="bottom-sheet"
        footer={<ModalFooter><Button variant="ghost" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>Remover vínculo</Button><Button variant="outline" onClick={() => { setOpen(false); setSearch(""); }}>Fechar</Button></ModalFooter>}
      >
        <div className="space-y-3 p-1">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-colors ${!value ? "bg-amber-50 border border-amber-200 text-amber-800" : "hover:bg-slate-50 text-slate-500"}`}
            >
              Sem vínculo de estoque
            </button>
            {filtered.map((item: any) => {
              const alreadyUsed = usedItemIds.has(item.id);
              const isSelected = value === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={alreadyUsed && !isSelected}
                  onClick={() => { onChange(item.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-amber-50 border border-amber-200" :
                    alreadyUsed ? "opacity-50 cursor-not-allowed bg-slate-50" :
                    "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 truncate">{item.name}</p>
                    <p className={`text-[10px] font-black uppercase ${item.quantity <= 0 ? "text-red-500" : item.quantity < 5 ? "text-amber-500" : "text-green-600"}`}>
                      {item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || 'un'}`}
                    </p>
                    {alreadyUsed && !isSelected && <p className="text-[10px] text-slate-400 font-semibold">Já vinculado a outro produto</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Nenhum item encontrado</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Modal de vínculo de produção
function ProductionLinkField({
  recipes,
  value,
  onChange,
  allCategories,
  editingProductId,
}: {
  recipes: any[];
  value: string;
  onChange: (val: string) => void;
  allCategories: any[];
  editingProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeRecipes = recipes.filter((r: any) => r.active);

  // Verifica quais receitas já estão vinculadas a outros produtos
  const allProducts = allCategories.flatMap((c: any) => c.products || []);
  const usedRecipeIds = new Set(
    allProducts
      .filter((p: any) => p.id !== editingProductId && p.recipeId)
      .map((p: any) => p.recipeId)
  );

  const selectedRecipe = activeRecipes.find((r: any) => r.id === value);

  const filtered = activeRecipes.filter((r: any) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (activeRecipes.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase tracking-widest text-orange-600">Vincular à produção (opcional)</label>
      <p className="text-[11px] text-slate-500 -mt-1">Ao vender, os insumos da receita são descontados do estoque automaticamente.</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-orange-50/60 border border-orange-200 rounded-xl px-3 py-2.5 text-sm font-bold text-left hover:border-orange-300 hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {selectedRecipe ? (
          <div className="flex-1 min-w-0">
            <span className="text-slate-800 truncate block">{selectedRecipe.name}</span>
            <span className="text-[10px] text-orange-600 font-semibold">Rende {selectedRecipe.outputQuantity} {selectedRecipe.outputUnit}</span>
          </div>
        ) : (
          <span className="text-slate-400">Sem vínculo de produção</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {selectedRecipe && (
        <div className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-[11px] text-orange-800 space-y-1">
          <p className="font-black">📋 {selectedRecipe.name}</p>
          <p className="text-orange-600">A cada <b>1 unidade</b> vendida, o sistema desconta <b>1/{selectedRecipe.outputQuantity} {selectedRecipe.outputUnit}</b> dos insumos.</p>
          {selectedRecipe.ingredients?.length > 0 && (
            <p className="text-orange-500">Insumos: {selectedRecipe.ingredients.map((i: any) => i.itemName).join(", ")}</p>
          )}
        </div>
      )}

      {/* Modal de seleção */}
      <Modal isOpen={open} onClose={() => { setOpen(false); setSearch(""); }} title="Vincular à Produção" size="md" mobileStyle="bottom-sheet"
        footer={<ModalFooter><Button variant="ghost" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>Remover vínculo</Button><Button variant="outline" onClick={() => { setOpen(false); setSearch(""); }}>Fechar</Button></ModalFooter>}
      >
        <div className="space-y-3 p-1">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar receita..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-colors ${!value ? "bg-orange-50 border border-orange-200 text-orange-800" : "hover:bg-slate-50 text-slate-500"}`}
            >
              Sem vínculo de produção
            </button>
            {filtered.map((recipe: any) => {
              const alreadyUsed = usedRecipeIds.has(recipe.id);
              const isSelected = value === recipe.id;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={alreadyUsed && !isSelected}
                  onClick={() => { onChange(recipe.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-orange-50 border border-orange-200" :
                    alreadyUsed ? "opacity-50 cursor-not-allowed bg-slate-50" :
                    "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800">{recipe.name}</p>
                    <p className="text-[10px] text-orange-600 font-semibold">Rende {recipe.outputQuantity} {recipe.outputUnit}</p>
                    {recipe.ingredients?.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate">Insumos: {recipe.ingredients.map((i: any) => i.itemName).join(", ")}</p>
                    )}
                    {alreadyUsed && !isSelected && <p className="text-[10px] text-slate-400 font-semibold">Já vinculado a outro produto</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Nenhuma receita encontrada</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

const DAY_KEYS_UI = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS: Record<string, string> = { sun:"Domingo", mon:"Segunda", tue:"Terça", wed:"Quarta", thu:"Quinta", fri:"Sexta", sat:"Sábado" };

function TimeInput({ value, onChange, label, accent = false }: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  accent?: boolean;
}) {
  const [raw, setRaw] = React.useState(value);

  React.useEffect(() => { setRaw(value); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^\d]/g, "");
    if (v.length > 4) v = v.slice(0, 4);
    let formatted = v;
    if (v.length >= 3) formatted = v.slice(0, 2) + ":" + v.slice(2);
    setRaw(formatted);
    if (v.length === 4) {
      const hh = parseInt(v.slice(0, 2));
      const mm = parseInt(v.slice(2, 4));
      if (hh <= 23 && mm <= 59)
        onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  }

  function handleBlur() {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length === 4) {
      const hh = Math.min(Number(digits.slice(0, 2)), 23);
      const mm = Math.min(Number(digits.slice(2, 4)), 59);
      const normalized = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      setRaw(normalized);
      onChange(normalized);
    } else {
      setRaw(value);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>}
      <div className={`
        group relative flex items-center overflow-hidden transition-all duration-200
        rounded-[10px] border shadow-sm
        ${accent
          ? "bg-amber-50 border-amber-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20"
          : "bg-zinc-50 border-zinc-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/10 focus-within:bg-white"
        }
      `}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="00:00"
          className={`
            bg-transparent px-3 py-2 text-xs font-black tracking-widest
            focus:outline-none w-[68px] text-center
            ${accent ? "text-amber-700 placeholder:text-amber-300" : "text-zinc-800 placeholder:text-zinc-300"}
          `}
        />
      </div>
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

// ─── ScheduleDay default helpers ──────────────────────────────────────────────
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_SCHEDULE_DAYS = WEEKDAY_LABELS.map((label, i) => ({
  weekday: i, label, enabled: false, times: ["09:00", "18:00"],
}));

function parseScheduleDays(raw?: string | null) {
  try { return raw ? JSON.parse(raw) : DEFAULT_SCHEDULE_DAYS; } catch { return DEFAULT_SCHEDULE_DAYS; }
}

// ── Condomínios do tenant ─────────────────────────────────────────────────────

const DAY_KEYS_COND = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS_COND: Record<string,string> = { sun:"Dom", mon:"Seg", tue:"Ter", wed:"Qua", thu:"Qui", fri:"Sex", sat:"Sáb" };

function CondominiumsCard({ tenant }: { tenant: Tenant | null }) {
  const [condos, setCondos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localAddr, setLocalAddr] = useState("");
  const [localHours, setLocalHours] = useState<Record<string, { enabled: boolean; open: string; close: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    apiJson<any[]>(`/api/owner/tenants/${tenant.id}/condominiums`)
      .then(d => setCondos(Array.isArray(d) ? d : []))
      .catch((e) => { console.error("[CondominiumsCard] erro:", e); setCondos([]); })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  function startEdit(condo: any) {
    setEditingId(condo.id);
    setLocalAddr(condo.localAddress || "");
    try {
      setLocalHours(condo.localHours ? JSON.parse(condo.localHours) : getDefaultHours());
    } catch { setLocalHours(getDefaultHours()); }
  }

  function getDefaultHours() {
    return Object.fromEntries(DAY_KEYS_COND.map(d => [d, { enabled: !["sun"].includes(d), open: "08:00", close: "22:00" }]));
  }

  async function handleSave(condId: string) {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/condominiums/${condId}`, {
        method: "PATCH",
        body: JSON.stringify({ localAddress: localAddr || null, localHours: JSON.stringify(localHours) }),
      });
      setCondos(prev => prev.map(c => c.id === condId ? { ...c, localAddress: localAddr || null, localHours: JSON.stringify(localHours) } : c));
      setEditingId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  if (loading) return null;
  if (condos.length === 0) return null;

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-900">Condomínios vinculados</p>
          <p className="text-xs text-slate-500">Configure seu endereço local e horários em cada condomínio.</p>
        </div>
        {saved && <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-bold"><CheckCircle className="w-3.5 h-3.5" /> Salvo!</span>}
      </div>

      <div className="space-y-3">
        {condos.map(condo => {
          const isEditing = editingId === condo.id;
          let hoursPreview = "";
          if (condo.localHours) {
            try {
              const h = JSON.parse(condo.localHours);
              const days = DAY_KEYS_COND.filter(d => h[d]?.enabled).map(d => DAY_LABELS_COND[d]);
              hoursPreview = days.length > 0 ? days.join(", ") : "Sem horários";
            } catch {}
          }

          return (
            <div key={condo.id} className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Header do condo */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                {condo.logoUrl
                  ? <img src={condo.logoUrl} alt="" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-amber-500" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">{condo.name}</p>
                  <a href={`/cond/${condo.slug}`} target="_blank" rel="noreferrer"
                    className="text-[10px] text-amber-600 hover:underline font-mono flex items-center gap-1">
                    /cond/{condo.slug} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <button type="button" onClick={() => isEditing ? setEditingId(null) : startEdit(condo)}
                  className={`p-2 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 ${isEditing ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}>
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? "Cancelar" : "Editar"}
                </button>
              </div>

              {/* Info resumida (quando não editando) */}
              {!isEditing && (
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>{condo.localAddress || <span className="text-slate-400 italic">Sem endereço local definido</span>}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{hoursPreview || <span className="text-slate-400 italic">Sem horários definidos — aparece fechado</span>}</span>
                  </div>
                </div>
              )}

              {/* Formulário de edição */}
              {isEditing && (
                <div className="px-4 py-4 space-y-4">
                  {/* Endereço local */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                      Endereço neste local
                    </label>
                    <input
                      value={localAddr}
                      onChange={e => setLocalAddr(e.target.value)}
                      placeholder="Ex: Bloco A, Loja 12 — Rua das Flores, 100"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-all"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Este endereço será exibido para clientes neste condomínio.</p>
                  </div>

                  {/* Horários por dia */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Horários neste local
                    </label>
                    <div className="space-y-2">
                      {DAY_KEYS_COND.map(d => {
                        const day = localHours[d] ?? { enabled: false, open: "08:00", close: "22:00" };
                        return (
                          <div key={d} className="flex items-center gap-3">
                            <button type="button" onClick={() => setLocalHours(h => ({ ...h, [d]: { ...day, enabled: !day.enabled } }))}
                              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${day.enabled ? "bg-amber-400" : "bg-slate-200"}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm mx-auto transition-transform ${day.enabled ? "translate-x-2" : "-translate-x-2"}`} />
                            </button>
                            <span className={`text-xs font-black w-8 flex-shrink-0 ${day.enabled ? "text-slate-900" : "text-slate-400"}`}>{DAY_LABELS_COND[d]}</span>
                            {day.enabled ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" value={day.open}
                                  onChange={e => setLocalHours(h => ({ ...h, [d]: { ...day, open: e.target.value } }))}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-300" />
                                <span className="text-xs text-slate-400">até</span>
                                <input type="time" value={day.close}
                                  onChange={e => setLocalHours(h => ({ ...h, [d]: { ...day, close: e.target.value } }))}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-300" />
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Fechado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button type="button" onClick={() => handleSave(condo.id)} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm">
                    {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save className="w-4 h-4" /> Salvar configurações</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ContentCard>
  );
}

function KitchenPasswordCard({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson<{ hasPassword: boolean }>(`/api/admin/${tenantId}/kitchen/config`)
      .then((data) => setHasPassword(data.hasPassword))
      .catch(() => setHasPassword(false));
  }, [tenantId]);

  const handleSave = async () => {
    if (password && password.length < 4) {
      toast.error("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiJson<{ hasPassword: boolean }>(`/api/admin/${tenantId}/kitchen/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setHasPassword(data.hasPassword);
      setPassword("");
      toast.success(data.hasPassword ? "Senha da cozinha salva!" : "Senha da cozinha removida.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <ChefHat className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Painel de Cozinha</p>
        {hasPassword !== null && (
          <span className={`ml-auto text-[9px] font-black uppercase px-2 py-1 rounded-full ${hasPassword ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {hasPassword ? "Configurado" : "Não configurado"}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Defina uma senha para abrir a tela <strong>/cozinha/{"{sua-loja}"}</strong> em um tablet ou TV fixo na cozinha —
        não precisa de conta de funcionário, só dessa senha. Fica conectado indefinidamente até alguém sair manualmente.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
            {hasPassword ? "Nova senha (deixe em branco para manter a atual)" : "Senha da cozinha"}
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <button
          type="button"
          disabled={saving || !password}
          onClick={handleSave}
          className="bg-[#0D1B3E] hover:bg-slate-800 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </ContentCard>
  );
}

interface KitchenStaffMember {
  id: string;
  name: string;
  username: string;
  active: boolean;
  createdAt: string;
}

interface KitchenAccessRequestItem {
  id: string;
  name: string;
  username: string;
  storeQuery: string;
  contact: string | null;
  createdAt: string;
}

function KitchenAccessRequestsCard({ tenantId, onApproved }: { tenantId: string; onApproved: () => void }) {
  const toast = useToast();
  const [requests, setRequests] = useState<KitchenAccessRequestItem[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvePassword, setApprovePassword] = useState("");

  const fetchRequests = () => {
    apiJson<KitchenAccessRequestItem[]>(`/api/admin/${tenantId}/kitchen/access-requests`)
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]));
  };

  useEffect(() => { fetchRequests(); }, [tenantId]);

  const handleApprove = async (requestId: string) => {
    if (approvePassword.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/access-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: approvePassword }),
      });
      setApprovingId(null);
      setApprovePassword("");
      fetchRequests();
      onApproved();
      toast.success("Acesso aprovado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar solicitação.");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/access-requests/${requestId}/reject`, { method: "POST" });
      fetchRequests();
      toast.success("Solicitação rejeitada.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao rejeitar solicitação.");
    }
  };

  if (requests.length === 0) return null;

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <Bell className="w-4 h-4 text-amber-500" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solicitações de Acesso</p>
        <span className="ml-auto text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700">
          {requests.length} pendente{requests.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Pedidos de acesso feitos por funcionários direto em cozinha.boxsys.com.br. Aprove definindo uma senha,
        ou rejeite se não reconhecer a pessoa.
      </p>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700">{r.name} <span className="text-slate-400 font-normal">@{r.username}</span></p>
                {r.contact && <p className="text-[10px] text-slate-400">Contato: {r.contact}</p>}
              </div>
              {approvingId !== r.id && (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setApprovingId(r.id); setApprovePassword(""); }} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700">Aprovar</button>
                  <button onClick={() => handleReject(r.id)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Rejeitar</button>
                </div>
              )}
            </div>
            {approvingId === r.id && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={approvePassword}
                  onChange={(e) => setApprovePassword(e.target.value)}
                  placeholder="Defina a senha (mín. 4 caracteres)"
                  autoFocus
                  className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold outline-none focus:border-[#C9A227]"
                />
                <button onClick={() => handleApprove(r.id)} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700 shrink-0">Confirmar</button>
                <button onClick={() => { setApprovingId(null); setApprovePassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 shrink-0">Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ContentCard>
  );
}

function KitchenStaffCard({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [staff, setStaff] = useState<KitchenStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");

  const fetchStaff = () => {
    apiJson<KitchenStaffMember[]>(`/api/admin/${tenantId}/kitchen/staff`)
      .then((data) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, [tenantId]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Informe o nome do funcionário."); return; }
    if (!username.trim()) { toast.error("Informe um usuário (único no sistema)."); return; }
    if (password.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), password }),
      });
      setName(""); setUsername(""); setPassword("");
      fetchStaff();
      toast.success("Funcionário cadastrado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: KitchenStaffMember) => {
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !member.active }),
      });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar funcionário.");
    }
  };

  const handleResetPassword = async (memberId: string) => {
    if (editPassword.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: editPassword }),
      });
      setEditingId(null);
      setEditPassword("");
      toast.success("Senha atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar senha.");
    }
  };

  const handleDelete = async (member: KitchenStaffMember) => {
    if (!window.confirm(`Remover ${member.name} do acesso à cozinha?`)) return;
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${member.id}`, { method: "DELETE" });
      fetchStaff();
      toast.success("Funcionário removido.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover funcionário.");
    }
  };

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <Users className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Equipe da Cozinha</p>
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Cadastre cada pessoa que trabalha na cozinha com nome, usuário e senha próprios — assim o app mostra
        quem está com o pedido em mãos, e a pessoa consegue logar direto em <strong>cozinha.boxsys.com.br</strong> com
        esse usuário (não precisa mais digitar o nome da loja). Continua funcionando junto com a senha única acima.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-6">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: joao.pizzaria"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Senha</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <button
          type="button"
          disabled={saving || !name.trim() || !username.trim() || !password}
          onClick={handleCreate}
          className="bg-[#0D1B3E] hover:bg-slate-800 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
        >
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </div>

      {!loading && staff.length === 0 && (
        <p className="text-xs text-slate-300 text-center py-4">Nenhum funcionário cadastrado ainda.</p>
      )}

      {staff.length > 0 && (
        <div className="space-y-2">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${member.active ? "bg-green-500" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-slate-700 truncate block">{member.name}</span>
                <span className="text-[10px] text-slate-400">@{member.username}</span>
              </div>

              {editingId === member.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Nova senha"
                    autoFocus
                    className="bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold w-32 outline-none focus:border-[#C9A227]"
                  />
                  <button onClick={() => handleResetPassword(member.id)} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700">Salvar</button>
                  <button onClick={() => { setEditingId(null); setEditPassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setEditingId(member.id); setEditPassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Trocar senha</button>
                  <button onClick={() => handleToggleActive(member)} className={`text-[10px] font-black uppercase ${member.active ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}>
                    {member.active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleDelete(member)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Remover</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  );
}

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "hours" | "delivery" | "payments" | "maquinhas" | "fiscal">("general");
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: maskPhone(tenant?.whatsapp) || "",
    isOpen: tenant?.isOpen ?? true,
    orderMode: (tenant?.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH",
    scheduleMode: tenant?.scheduleMode ?? false,
    scheduleType: (tenant?.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES",
    scheduleNotes: tenant?.scheduleNotes || "",
    waiterNotifyOnReady: tenant?.waiterNotifyOnReady ?? true,
  });
  const [scheduleDays, setScheduleDays] = useState<any[]>(() => parseScheduleDays(tenant?.scheduleDays));
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

  const DEFAULT_STONE: StoneConfig = { enabled: false, secretKey: "", stonecode: "" };
  const [stone, setStone] = useState<StoneConfig>(() => {
    try { return tenant?.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE; } catch { return DEFAULT_STONE; }
  });

  const DEFAULT_FISCAL: FiscalConfig = {
    enabled: false, ambiente: "homologacao", cnpj: "", ie: "", crt: "1",
    serie: 1, proximoNumero: 1, csc: "", cscId: "1", uf: "SP", cMun: "3550308", xMun: "São Paulo",
  };
  const [fiscal, setFiscal] = useState<FiscalConfig>(() => {
    try { return tenant?.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL; } catch { return DEFAULT_FISCAL; }
  });

  const DEFAULT_DISPLAY_PANEL: DisplayPanelConfig = { showDelivery: false, showPickup: true, showDineIn: true };
  const [displayPanel, setDisplayPanel] = useState<DisplayPanelConfig>(() => {
    try { return tenant?.displayPanelConfig ? { ...DEFAULT_DISPLAY_PANEL, ...JSON.parse(tenant.displayPanelConfig) } : DEFAULT_DISPLAY_PANEL; }
    catch { return DEFAULT_DISPLAY_PANEL; }
  });

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || "", description: tenant.description || "", logoUrl: tenant.logoUrl || "", whatsapp: maskPhone(tenant.whatsapp) || "", isOpen: tenant.isOpen ?? true, orderMode: (tenant.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH", scheduleMode: tenant.scheduleMode ?? false, scheduleType: (tenant.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES", scheduleNotes: tenant.scheduleNotes || "", waiterNotifyOnReady: tenant.waiterNotifyOnReady ?? true });
      setScheduleDays(parseScheduleDays(tenant.scheduleDays));
      setAddr(parseAddress(tenant.address) ?? { ...EMPTY_ADDR });
      try { setHours(tenant.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
      setDelivery(parseDeliveryConfig(tenant.deliveryConfig));
      try { setPayments(tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS); } catch { setPayments(DEFAULT_PAYMENTS); }
      try { setStone(tenant.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE); } catch { setStone(DEFAULT_STONE); }
      try { setFiscal(tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL); } catch { setFiscal(DEFAULT_FISCAL); }
      try { setDisplayPanel(tenant.displayPanelConfig ? { ...DEFAULT_DISPLAY_PANEL, ...JSON.parse(tenant.displayPanelConfig) } : DEFAULT_DISPLAY_PANEL); } catch { setDisplayPanel(DEFAULT_DISPLAY_PANEL); }
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
          paymentMethods: JSON.stringify(payments),
          stoneConfig: JSON.stringify(stone),
          fiscalConfig: JSON.stringify(fiscal),
          displayPanelConfig: JSON.stringify(displayPanel),
          scheduleDays: JSON.stringify(scheduleDays),
        })
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar configurações");
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
            { id: "maquinhas", label: "Maquinhas", icon: Smartphone },
            { id: "fiscal", label: "Fiscal", icon: FileText },
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
              <div className="divide-y divide-slate-100 space-y-0">
                <div className="flex items-center justify-between gap-4 pb-5">
                  <div>
                    <p className="text-sm font-black text-slate-900">Status do Estabelecimento</p>
                    <p className="text-xs text-slate-500 mt-1">Forçar fechamento imediato do cardápio digital.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${form.isOpen ? 'text-green-500' : 'text-red-500'}`}>
                      {form.isOpen ? 'Aberta' : 'Fechada'}
                    </span>
                    <Switch checked={form.isOpen} onCheckedChange={v => setForm(f => ({ ...f, isOpen: v }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 py-5 border-t border-zinc-100">
                  <div>
                    <p className="text-sm font-black text-slate-900">Avisar Garçom quando a Comanda Ficar Pronta</p>
                    <p className="text-xs text-slate-500 mt-1">Notifica o garçom, em qualquer tela do sistema, quando a cozinha marcar a comanda da mesa como pronta para servir.</p>
                  </div>
                  <Switch checked={form.waiterNotifyOnReady} onCheckedChange={v => setForm(f => ({ ...f, waiterNotifyOnReady: v }))} />
                </div>
                {/* ── Modo de Operação (Delivery / Encomenda / Misto) ── */}
                <div className="pt-5 border-t border-zinc-100">
                  <div className="mb-3">
                    <p className="text-sm font-black text-slate-900">Modo de Operação</p>
                    <p className="text-xs text-slate-500 mt-0.5">Define como os clientes podem fazer pedidos no cardápio digital.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                    {([
                      { value: "DELIVERY_ONLY",  label: "Só Delivery",          desc: "Entregas imediatas — cliente recebe no mesmo dia", icon: "🛵" },
                      { value: "PREORDER_ONLY",  label: "Só Encomenda",         desc: "Você define os dias de entrega (ex: só sábados). Cliente pede e você entrega na próxima data disponível", icon: "📦" },
                      { value: "BOTH",           label: "Delivery + Encomenda", desc: "Aceita tanto entregas imediatas quanto encomendas com data definida por você", icon: "✨" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          orderMode: opt.value,
                          scheduleMode: opt.value !== "DELIVERY_ONLY",
                        }))}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${form.orderMode === opt.value ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white hover:border-amber-300"}`}
                      >
                        <p className="text-base mb-0.5">{opt.icon}</p>
                        <p className={`text-xs font-black ${form.orderMode === opt.value ? "text-amber-700" : "text-slate-700"}`}>{opt.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>

                  {form.orderMode !== "DELIVERY_ONLY" && (
                    <div className="space-y-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                      {/* Tipo de agendamento */}
                      <div>
                        <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Quando o estabelecimento entrega?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {([
                            { value: "CLIENT_CHOOSES", label: "Cliente informa a data", desc: "O cliente digita a data desejada — você decide se aceita ou não" },
                            { value: "OWNER_DEFINES",  label: "Você define os dias (recomendado)", desc: "Configure os dias e horários fixos de entrega. O cliente vê apenas as datas disponíveis" },
                          ] as const).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, scheduleType: opt.value }))}
                              className={`text-left p-3 rounded-xl border-2 transition-all ${form.scheduleType === opt.value ? "border-amber-400 bg-white" : "border-amber-200 bg-amber-50/50 hover:border-amber-300"}`}
                            >
                              <p className={`text-xs font-black ${form.scheduleType === opt.value ? "text-amber-700" : "text-slate-600"}`}>{opt.label}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dias e horários (só para OWNER_DEFINES) */}
                      {form.scheduleType === "OWNER_DEFINES" && (
                        <div>
                          <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-2">Dias e turnos de entrega</p>
                          <div className="space-y-2">
                            {scheduleDays.map((day: any, idx: number) => (
                              <div key={day.weekday} className={`rounded-xl border p-3 transition-all ${day.enabled ? "bg-white border-amber-200" : "bg-amber-50/40 border-amber-100"}`}>
                                <div className="flex items-center gap-3 mb-2">
                                  <Switch
                                    checked={day.enabled}
                                    onCheckedChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, enabled: v } : d))}
                                  />
                                  <span className={`text-xs font-black w-16 shrink-0 ${day.enabled ? "text-slate-800" : "text-slate-400"}`}>{day.label}</span>
                                  {day.enabled && (
                                    <div className="flex flex-wrap gap-1.5 flex-1">
                                      {day.times.map((t: string, ti: number) => (
                                        <div key={ti} className="flex items-center gap-1 bg-amber-100 border border-amber-200 rounded-lg px-2 py-0.5">
                                          <TimeInput
                                            value={t}
                                            onChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.map((tt: string, tii: number) => tii === ti ? v : tt) } : d))}
                                          />
                                          {day.times.length > 1 && (
                                            <button type="button" onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.filter((_: string, tii: number) => tii !== ti) } : d))} className="text-amber-400 hover:text-red-500 transition-colors">
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: [...d.times, "12:00"] } : d))}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-dashed border-amber-300 text-amber-500 hover:border-amber-400 transition-colors text-[10px] font-bold"
                                      >
                                        <Plus className="w-3 h-3" /> horário
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Aviso para o cliente */}
                      <div>
                        <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1.5">Mensagem para o cliente (opcional)</p>
                        <textarea
                          value={form.scheduleNotes}
                          onChange={e => setForm(f => ({ ...f, scheduleNotes: e.target.value }))}
                          placeholder="Ex: Encomendas entregues toda semana aos sábados a partir das 10h. Pedido mínimo 48h antes."
                          rows={2}
                          className="w-full rounded-[10px] border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ContentCard>

            <ContentCard padding="lg">
              <div className="flex items-center gap-3 mb-1">
                <Monitor className="w-4 h-4 text-slate-400" />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Painel TV</p>
              </div>
              <p className="text-[10px] text-slate-400 mb-6">
                Escolha quais tipos de pedido aparecem na tela pública de acompanhamento (aquela que fica exposta pro cliente ver "seu pedido está pronto").
                Delivery fica desativado por padrão, já que é entregue no endereço do cliente, não retirado no local.
              </p>
              <div className="space-y-3">
                {([
                  { key: "showDineIn" as const, label: "Mesa / Salão", desc: "Pedidos feitos nas mesas do estabelecimento." },
                  { key: "showPickup" as const, label: "Retirada no Balcão", desc: "Cliente busca o pedido presencialmente." },
                  { key: "showDelivery" as const, label: "Delivery", desc: "Pedido é entregue no endereço do cliente — geralmente não faz sentido aparecer aqui." },
                ]).map((opt) => (
                  <div key={opt.key} className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <div>
                      <p className="text-xs font-black text-slate-700">{opt.label}</p>
                      <p className="text-[11px] text-slate-400">{opt.desc}</p>
                    </div>
                    <Switch
                      checked={displayPanel[opt.key]}
                      onCheckedChange={(v) => setDisplayPanel({ ...displayPanel, [opt.key]: v })}
                    />
                  </div>
                ))}
              </div>
            </ContentCard>

            {tenant?.id && <KitchenPasswordCard tenantId={tenant.id} />}
            {tenant?.id && <KitchenAccessRequestsCard tenantId={tenant.id} onApproved={() => {}} />}
            {tenant?.id && <KitchenStaffCard tenantId={tenant.id} />}

          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-5">Horários de Funcionamento</p>
              <div className="space-y-2">
                {DAY_KEYS_UI.map(day => {
                  const d = hours[day] ?? { enabled: false, open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" };
                  return (
                    <div key={day} className={`rounded-xl border transition-all duration-200 ${d.enabled ? "bg-white border-zinc-200" : "bg-zinc-50 border-zinc-100"}`}>
                      {/* Row principal */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <Switch checked={d.enabled} onCheckedChange={v => setDay(day, "enabled", v)} />
                        <span className={`text-xs font-black w-[72px] shrink-0 ${d.enabled ? "text-zinc-800" : "text-zinc-400"}`}>
                          {DAY_LABELS[day]}
                        </span>
                        {d.enabled ? (
                          <>
                            <div className="flex items-end gap-2 flex-1">
                              <TimeInput label="Abertura" value={d.open} onChange={v => setDay(day, "open", v)} />
                              <span className="text-zinc-300 font-bold text-sm pb-2 select-none">–</span>
                              <TimeInput label="Fechamento" value={d.close} onChange={v => setDay(day, "close", v)} />
                            </div>
                            <button
                              type="button"
                              onClick={() => setDay(day, "breakEnabled", !d.breakEnabled)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                                d.breakEnabled
                                  ? "bg-amber-50 border-amber-200 text-amber-600"
                                  : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-amber-200 hover:text-amber-500"
                              }`}
                            >
                              {d.breakEnabled ? <Clock className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                              <span className="hidden sm:inline">{d.breakEnabled ? "Pausa" : "Intervalo"}</span>
                            </button>
                          </>
                        ) : (
                          <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-zinc-300">Fechado</span>
                        )}
                      </div>
                      {/* Pausa */}
                      {d.enabled && d.breakEnabled && (
                        <div className="flex items-end gap-2 px-4 py-3 border-t border-amber-100 bg-amber-50/30">
                          <div className="w-[111px] shrink-0 pb-2">
                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Intervalo</span>
                          </div>
                          <TimeInput label="Início" value={d.breakStart ?? "12:00"} onChange={v => setDay(day, "breakStart", v)} accent />
                          <span className="text-amber-300 font-bold text-sm pb-2 select-none">–</span>
                          <TimeInput label="Fim" value={d.breakEnd ?? "13:00"} onChange={v => setDay(day, "breakEnd", v)} accent />
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
                    { id: "km", label: "Por Distância (KM)", icon: Ruler },
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

                {delivery.mode === "km" && (
                  <div className="space-y-6">
                    {/* Origin CEP */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-[#C9A227]" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">CEP de Origem (seu estabelecimento)</p>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">O cálculo de distância parte deste CEP até o CEP do cliente.</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={delivery.originCep
                          ? delivery.originCep.replace(/^(\d{5})(\d{1,3})$/, "$1-$2")
                          : ""}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                          setDelivery(d => ({ ...d, originCep: digits }));
                        }}
                        placeholder="00000-000"
                        className="w-40 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800 focus:border-[#C9A227] outline-none transition-all shadow-sm"
                      />
                    </div>

                    {/* KM ranges */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Faixas de Distância</p>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{delivery.kmRanges?.length || 0} faixas</span>
                      </div>

                      {[...(delivery.kmRanges || [])].sort((a, b) => a.upToKm - b.upToKm).map((range, idx, arr) => {
                        const from = idx === 0 ? 0 : arr[idx - 1].upToKm;
                        return (
                          <div key={range.id} className="bg-white border border-slate-100 rounded-2xl p-5 flex items-center justify-between group hover:border-[#C9A227]/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#C9A227]/10 group-hover:text-[#C9A227] transition-all">
                                <Ruler className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">
                                  {from === 0 ? `Até ${range.upToKm} km` : `De ${from} km até ${range.upToKm} km`}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Faixa {idx + 1}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-black text-[#C9A227]">{range.fee === 0 ? "GRÁTIS" : fmt(range.fee)}</span>
                              <button
                                type="button"
                                onClick={() => setDelivery(d => ({ ...d, kmRanges: d.kmRanges?.filter(r => r.id !== range.id) }))}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <KmRangeAdder onAdd={r => setDelivery(d => ({ ...d, kmRanges: [...(d.kmRanges || []), r] }))} />
                    </div>

                    {/* Beyond last range */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-4">
                      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Além da última faixa</p>
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                          onClick={() => setDelivery(d => ({ ...d, kmAllowBeyond: !(d.kmAllowBeyond ?? true) }))}
                          className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${(delivery.kmAllowBeyond ?? true) ? "bg-[#C9A227]" : "bg-slate-300"}`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(delivery.kmAllowBeyond ?? true) ? "translate-x-5" : "translate-x-0.5"}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-700">Aceitar pedidos além da última faixa</span>
                      </label>
                      {(delivery.kmAllowBeyond ?? true) && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-400">Taxa R$</span>
                          <input
                            type="number" min="0" step="0.50"
                            value={delivery.kmDefaultFee ?? ""}
                            onChange={e => setDelivery(d => ({ ...d, kmDefaultFee: parseFloat(e.target.value) || 0 }))}
                            className="w-28 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-800 focus:border-[#C9A227] outline-none"
                            placeholder="0,00"
                          />
                          <span className="text-[10px] text-slate-400">(0 = grátis)</span>
                        </div>
                      )}
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
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isEnabled ? 'bg-white border-[#C9A227]/30 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isEnabled ? 'bg-[#C9A227]/10 text-[#C9A227]' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <method.icon className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-slate-800 truncate">{method.label}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">{method.desc}</p>
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
                        <div className="pt-3 border-t border-slate-50 space-y-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Bandeiras Aceitas</p>
                          <div className="flex flex-wrap gap-1.5">
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

        {activeTab === "maquinhas" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Stone / Pagar.me */}
            <ContentCard padding="lg">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${stone.enabled ? "bg-[#00A859]/10 text-[#00A859]" : "bg-slate-100 text-slate-400"}`}>
                  <Smartphone className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800">Stone / Pagar.me</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Maquininha física via API Pagar.me</p>
                </div>
                <Switch checked={stone.enabled} onCheckedChange={v => setStone({ ...stone, enabled: v })} />
              </div>

              {stone.enabled && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-amber-700 leading-relaxed font-medium">
                      <p className="font-black mb-1">Como configurar:</p>
                      <ol className="list-decimal ml-3 space-y-1">
                        <li>Acesse o <strong>Partner Hub da Stone</strong> ou painel do Pagar.me.</li>
                        <li>Copie sua <strong>Secret Key</strong> (sk_live_... ou sk_test_...).</li>
                        <li>O <strong>Stonecode</strong> é o código do estabelecimento que vincula ao terminal físico.</li>
                        <li>Salve as configurações — a maquininha aparecerá como opção no PDV.</li>
                      </ol>
                    </div>
                  </div>

                  <Input
                    label="Secret Key (Pagar.me)"
                    value={stone.secretKey}
                    onChange={e => setStone({ ...stone, secretKey: e.target.value })}
                    placeholder="sk_live_xxxxxxxxxxxx"
                    type="password"
                  />
                  <Input
                    label="Stonecode (código do estabelecimento)"
                    value={stone.stonecode}
                    onChange={e => setStone({ ...stone, stonecode: e.target.value })}
                    placeholder="Ex: 123456789"
                  />

                  <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 border border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-[#00A859]/10 text-[#00A859] flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-700 mb-1">Fluxo de pagamento</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        No PDV, selecione "Maquininha" e o tipo (crédito, débito ou PIX). O sistema envia a cobrança automaticamente para o terminal físico. O cliente paga e o sistema confirma.
                      </p>
                    </div>
                  </div>

                  {stone.secretKey && (
                    <div className="flex items-center gap-2 text-[10px] text-green-600 font-bold bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Credenciais configuradas — salve para ativar.
                    </div>
                  )}
                </div>
              )}

              {!stone.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1">Maquininha desativada</p>
                  <p className="text-[10px]">Ative acima para configurar a integração com a Stone.</p>
                </div>
              )}
            </ContentCard>

            {/* Taxas da Maquininha */}
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Taxas da Maquininha</p>
              <p className="text-[10px] text-slate-400 mb-6">Configure o percentual cobrado pela adquirente por bandeira/provedor. Esses valores alimentam o custo exibido no financeiro e, se ativado, o acréscimo cobrado do cliente no PDV.</p>

              {/* PIX — taxa única do provedor, sem bandeira/parcela */}
              {payments.pix?.enabled && (
                <div className="mb-6 pb-6 border-b border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <p className="text-sm font-black text-slate-800">Pix</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repassar taxa ao cliente</span>
                      <Switch
                        checked={!!payments.pix.passFeeToCustomer}
                        onCheckedChange={(v) => setPayments({ ...payments, pix: { ...payments.pix!, passFeeToCustomer: v } })}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3 max-w-xs">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-1">Taxa do provedor</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={payments.pix.brandFees?.["PIX"]?.installmentFees?.["1"] ?? ""}
                        onChange={(e) => {
                          const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                          setPayments({
                            ...payments,
                            pix: { ...payments.pix!, brandFees: { PIX: { installmentFees: { "1": pct } } } },
                          });
                        }}
                        placeholder="0,0"
                        className="w-16 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-bold outline-none focus:border-[#C9A227] transition-all"
                      />
                      <span className="text-xs font-bold text-slate-400">%</span>
                    </div>
                  </div>
                </div>
              )}

              {(["credit", "debit"] as const).map((methodKey) => {
                const methodConfig = payments[methodKey] as PaymentMethodConfig | undefined;
                if (!methodConfig?.enabled) return null;
                const brands = methodConfig.acceptedBrands?.length ? methodConfig.acceptedBrands : [];
                const installmentsRange = methodKey === "credit" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1];
                const brandFees = methodConfig.brandFees || {};

                const updateFee = (brand: string, installment: number, value: string) => {
                  const pct = parseFloat(value.replace(",", ".")) || 0;
                  const current = brandFees[brand]?.installmentFees || {};
                  setPayments({
                    ...payments,
                    [methodKey]: {
                      ...methodConfig,
                      brandFees: {
                        ...brandFees,
                        [brand]: { installmentFees: { ...current, [String(installment)]: pct } },
                      },
                    },
                  });
                };

                const addBrand = (name: string) => {
                  const trimmed = name.trim();
                  if (!trimmed || brands.includes(trimmed)) return;
                  setPayments({
                    ...payments,
                    [methodKey]: { ...methodConfig, acceptedBrands: [...brands, trimmed] },
                  });
                };

                const removeBrand = (name: string) => {
                  const { [name]: _removed, ...restFees } = brandFees;
                  setPayments({
                    ...payments,
                    [methodKey]: {
                      ...methodConfig,
                      acceptedBrands: brands.filter((b) => b !== name),
                      brandFees: restFees,
                    },
                  });
                };

                return (
                  <div key={methodKey} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b last:border-0 border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <p className="text-sm font-black text-slate-800">
                        {methodKey === "credit" ? "Cartão de Crédito" : "Cartão de Débito"}
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Repassar taxa ao cliente</span>
                        <Switch
                          checked={!!methodConfig.passFeeToCustomer}
                          onCheckedChange={(v) => setPayments({
                            ...payments,
                            [methodKey]: { ...methodConfig, passFeeToCustomer: v },
                          })}
                        />
                      </label>
                    </div>

                    {/* Cards por bandeira — responsivo, uma bandeira por bloco */}
                    <div className="space-y-3">
                      {brands.map((brand) => (
                        <div key={brand} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">{brand}</p>
                            <button
                              type="button"
                              onClick={() => removeBrand(brand)}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                              title="Remover bandeira"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {installmentsRange.map((n) => (
                              <div key={n} className="flex flex-col gap-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">
                                  {methodKey === "credit" ? `${n}x` : "à vista"}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={brandFees[brand]?.installmentFees?.[String(n)] ?? ""}
                                    onChange={(e) => updateFee(brand, n, e.target.value)}
                                    placeholder="0,0"
                                    className="w-full min-w-0 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-bold outline-none focus:border-[#C9A227] transition-all"
                                  />
                                  <span className="text-[10px] font-bold text-slate-400 shrink-0">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Adicionar nova bandeira */}
                    <div className="flex gap-2 mt-3">
                      <input
                        type="text"
                        placeholder="Adicionar bandeira (ex: Cabal, Banricompras...)"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addBrand(e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                        className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-[#C9A227] transition-all"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousSibling as HTMLInputElement);
                          addBrand(input.value);
                          input.value = "";
                        }}
                        className="shrink-0 px-3 py-2 bg-[#0D1B3E] text-white rounded-xl hover:bg-[#0D1B3E]/90 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {brands.length === 0 && (
                      <p className="text-[10px] text-slate-400 mt-2">Nenhuma bandeira cadastrada ainda — adicione acima ou na aba "Pagamentos".</p>
                    )}
                  </div>
                );
              })}

              {!payments.pix?.enabled && !payments.credit?.enabled && !payments.debit?.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1">Nenhum meio de pagamento habilitado</p>
                  <p className="text-[10px]">Ative Pix, Crédito ou Débito na aba "Pagamentos" para configurar as taxas.</p>
                </div>
              )}
            </ContentCard>

            {/* Taxa de Serviço */}
            <ContentCard padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Taxa de Serviço</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ativar</span>
                  <Switch
                    checked={!!payments.serviceCharge?.enabled}
                    onCheckedChange={(v) => setPayments({
                      ...payments,
                      serviceCharge: { enabled: v, percent: payments.serviceCharge?.percent ?? 10 },
                    })}
                  />
                </label>
              </div>
              <p className="text-[10px] text-slate-400 mb-6">
                Percentual sobre o subtotal dos itens (ex: 10% em mesas). Quando ativada, vem pré-marcada no pagamento do PDV,
                mas o operador sempre pode desmarcar ou ajustar caso o cliente não queira pagar.
              </p>

              {payments.serviceCharge?.enabled && (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3 max-w-xs">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-1">Percentual</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={payments.serviceCharge?.percent ?? ""}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                        setPayments({
                          ...payments,
                          serviceCharge: { enabled: true, percent: pct },
                        });
                      }}
                      placeholder="10"
                      className="w-16 text-center bg-white border border-slate-200 rounded-lg py-1.5 text-xs font-bold outline-none focus:border-[#C9A227] transition-all"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                </div>
              )}
            </ContentCard>

            {/* Futuras integrações */}
            <ContentCard padding="lg">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Outras Maquininhas (em breve)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 opacity-40 pointer-events-none select-none">
                {["Cielo", "Rede", "GetNet", "PagSeguro", "Mercado Pago"].map(name => (
                  <div key={name} className="p-4 rounded-2xl border border-slate-100 text-center">
                    <CreditCard className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-[10px] font-black text-slate-400 uppercase">{name}</p>
                  </div>
                ))}
              </div>
            </ContentCard>
          </motion.div>
        )}

        {/* ── ABA FISCAL ─────────────────────────────────────────────────── */}
        {activeTab === "fiscal" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <ContentCard padding="lg">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${fiscal.enabled ? "bg-amber-50 text-[#C9A227]" : "bg-slate-100 text-slate-400"}`}>
                  <FileText className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800">Módulo Fiscal — NFC-e</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nota Fiscal do Consumidor Eletrônica (Modelo 65)</p>
                </div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setFiscal(f => ({ ...f, enabled: !f.enabled }))}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${fiscal.enabled ? "bg-[#C9A227]" : "bg-slate-300"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${fiscal.enabled ? "translate-x-7" : "translate-x-1"}`} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{fiscal.enabled ? "Ativo" : "Inativo"}</span>
                </label>
              </div>

              {fiscal.enabled && (
                <div className="space-y-6 pt-4 border-t border-slate-100">
                  {/* Ambiente */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Ambiente SEFAZ</p>
                    <div className="flex gap-3">
                      {(["homologacao", "producao"] as const).map(env => (
                        <button key={env} type="button"
                          onClick={() => setFiscal(f => ({ ...f, ambiente: env }))}
                          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${fiscal.ambiente === env ? "bg-[#0D1B3E] text-white border-[#0D1B3E]" : "bg-white text-slate-400 border-slate-200"}`}
                        >
                          {env === "homologacao" ? "🧪 Homologação (teste)" : "🚀 Produção"}
                        </button>
                      ))}
                    </div>
                    {fiscal.ambiente === "homologacao" && (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[10px] text-amber-700 font-medium">
                        Em homologação as notas <strong>não têm valor fiscal</strong>. Use para testar a integração com a SEFAZ antes de ir para produção.
                      </div>
                    )}
                  </div>

                  {/* Dados do Emitente */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Dados do Emitente</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CNPJ</label>
                        <input type="text" maxLength={18} value={fiscal.cnpj}
                          onChange={e => setFiscal(f => ({ ...f, cnpj: e.target.value }))}
                          placeholder="00.000.000/0000-00"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Inscrição Estadual (IE)</label>
                        <input type="text" value={fiscal.ie}
                          onChange={e => setFiscal(f => ({ ...f, ie: e.target.value }))}
                          placeholder="000.000.000.000"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Regime Tributário (CRT)</label>
                        <select value={fiscal.crt} onChange={e => setFiscal(f => ({ ...f, crt: e.target.value as any }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        >
                          <option value="1">1 — Simples Nacional</option>
                          <option value="2">2 — Simples Nacional (excesso sublimite)</option>
                          <option value="3">3 — Regime Normal</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">UF</label>
                        <select value={fiscal.uf} onChange={e => setFiscal(f => ({ ...f, uf: e.target.value }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        >
                          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Código IBGE do Município</label>
                        <input type="text" value={fiscal.cMun}
                          onChange={e => setFiscal(f => ({ ...f, cMun: e.target.value }))}
                          placeholder="Ex: 3550308 (São Paulo)"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Nome do Município</label>
                        <input type="text" value={fiscal.xMun}
                          onChange={e => setFiscal(f => ({ ...f, xMun: e.target.value }))}
                          placeholder="Ex: São Paulo"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* NFC-e — Série e número */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Numeração NFC-e</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Série</label>
                        <input type="number" min={1} max={999} value={fiscal.serie}
                          onChange={e => setFiscal(f => ({ ...f, serie: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Próximo Número</label>
                        <input type="number" min={1} value={fiscal.proximoNumero}
                          onChange={e => setFiscal(f => ({ ...f, proximoNumero: parseInt(e.target.value) || 1 }))}
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-black text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CSC */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">CSC — Código de Segurança do Contribuinte</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[10px] text-slate-500 mb-3 leading-relaxed">
                      O CSC é cadastrado no portal da SEFAZ do seu estado. Em SP: <span className="font-black text-slate-700">NF-e / Minha Conta</span>. Você receberá o Token e o ID do token.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">ID do CSC</label>
                        <input type="text" value={fiscal.cscId}
                          onChange={e => setFiscal(f => ({ ...f, cscId: e.target.value }))}
                          placeholder="Ex: 1"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Token CSC</label>
                        <input type="password" value={fiscal.csc}
                          onChange={e => setFiscal(f => ({ ...f, csc: e.target.value }))}
                          placeholder="Token UUID da SEFAZ"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Certificado A1 */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Certificado Digital A1 (.pfx)</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      {fiscal.certBase64 ? (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black text-slate-700">Certificado carregado</p>
                            <p className="text-[10px] text-slate-400">Clique em "Trocar" para substituir</p>
                          </div>
                          <button type="button" onClick={() => setFiscal(f => ({ ...f, certBase64: undefined, certPassword: undefined }))}
                            className="text-[10px] font-black text-red-500 hover:text-red-700 px-3 py-1 rounded-lg border border-red-200 hover:border-red-300 transition-colors"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#C9A227]/10 text-slate-400 group-hover:text-[#C9A227] flex items-center justify-center transition-all">
                            <FileDown className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-700">Selecionar arquivo .pfx</p>
                            <p className="text-[10px] text-slate-400">Certificado A1 emitido pela AC</p>
                          </div>
                          <input type="file" accept=".pfx,.p12" className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = ev => {
                                const b64 = (ev.target?.result as string).split(",")[1];
                                setFiscal(f => ({ ...f, certBase64: b64 }));
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                      )}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Senha do Certificado</label>
                        <input type="password" value={fiscal.certPassword ?? ""}
                          onChange={e => setFiscal(f => ({ ...f, certPassword: e.target.value }))}
                          placeholder="Senha do arquivo .pfx"
                          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!fiscal.enabled && (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-[11px] font-black uppercase tracking-widest mb-1">Módulo Fiscal Inativo</p>
                  <p className="text-[10px]">Ative acima para configurar a emissão de NFC-e.</p>
                </div>
              )}
            </ContentCard>
          </motion.div>
        )}

        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 p-2.5 sm:p-3 rounded-2xl shadow-xl flex items-center justify-between gap-3">
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

      <CondominiumsCard tenant={tenant} />
    </PageWrapper>
  );
}

function SortableProductRow({
  prod, dragEnabled, fmt, toggleProductAvailability, openEditProduct, setDeleteProductConfirm,
}: {
  prod: any;
  dragEnabled: boolean;
  fmt: (n: number) => string;
  toggleProductAvailability: (prod: any) => void;
  openEditProduct: (prod: any) => void;
  setDeleteProductConfirm: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prod.id,
    data: { type: "product", categoryId: prod.categoryId },
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${!prod.available ? 'bg-slate-50/50 opacity-70' : 'bg-white'} ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      {dragEnabled && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar ou mover"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.3" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="8" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/>
          </svg>
        </button>
      )}
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
          {(prod as any).scheduleRule && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">📅 Agendado</span>
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
        <button onClick={() => setDeleteProductConfirm(prod.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ProductRowGhost({ prod, fmt }: { prod: any; fmt: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-2xl border border-[#C9A227]/40 rotate-1">
      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0">
        {prod.imageUrl
          ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-5 h-5" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{prod.name}</p>
        <p className="text-xs text-slate-400 font-medium">{fmt(prod.price)}</p>
      </div>
    </div>
  );
}

function EmptyCategoryDropZone({ categoryId, isDraggingProduct, openNewProduct }: {
  categoryId: string;
  isDraggingProduct: boolean;
  openNewProduct: (categoryId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${categoryId}-empty`, data: { type: "category-drop", categoryId } });
  return (
    <div
      ref={setNodeRef}
      className={`px-4 py-6 text-center transition-colors ${isOver ? 'bg-amber-50' : ''}`}
    >
      <p className="text-xs text-slate-400 font-medium">
        {isDraggingProduct ? "Solte aqui para mover para esta categoria" : "Nenhum produto ainda."}
      </p>
      <button onClick={() => openNewProduct(categoryId)} className="mt-2 text-xs font-black text-[#C9A227] hover:underline">
        + Adicionar produto
      </button>
    </div>
  );
}

function SortableCategoryCard({
  cat, dragEnabled, openNewProduct, openEditCategory, openEditProduct,
  toggleProductAvailability, setDeleteProductConfirm, fmt,
}: {
  cat: any;
  dragEnabled: boolean;
  openNewProduct: (categoryId: string) => void;
  openEditCategory: (cat: any) => void;
  openEditProduct: (prod: any) => void;
  toggleProductAvailability: (prod: any) => void;
  setDeleteProductConfirm: (id: string) => void;
  fmt: (n: number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    data: { type: "category" },
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const productIds = (cat.products || []).map((p: any) => p.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-4 last:mb-0 ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      {/* Category header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {dragEnabled && (
            <button
              {...attributes}
              {...listeners}
              className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
              title="Arrastar para reordenar categoria"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="5" cy="4" r="1.3" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/>
                <circle cx="5" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="8" r="1.3" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/>
              </svg>
            </button>
          )}
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs truncate">{cat.name}
            <span className="ml-2 text-zinc-400 font-bold normal-case tracking-normal">{cat.products?.length || 0} itens</span>
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
          <EmptyCategoryDropZone categoryId={cat.id} isDraggingProduct={dragEnabled} openNewProduct={openNewProduct} />
        )}
        <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
          {cat.products?.map((prod: any) => (
            <SortableProductRow
              key={prod.id}
              prod={{ ...prod, categoryId: cat.id }}
              dragEnabled={dragEnabled}
              fmt={fmt}
              toggleProductAvailability={toggleProductAvailability}
              openEditProduct={openEditProduct}
              setDeleteProductConfirm={setDeleteProductConfirm}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  // Lazy initializer: popula de imediato com o que o tenant já trouxer, evitando
  // o "flash vazio" que aparecia sempre que esta tela era desmontada e remontada
  // (ex: trocar para "Estoque" e voltar) antes do useEffect abaixo rodar.
  const [localCategories, setLocalCategories] = useState<any[]>(() => tenant?.categories || []);

  // Category modal
  const [catModal, setCatModal] = useState<{ open: boolean; editing: { id: string; name: string } | null }>({ open: false, editing: null });
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Delete confirm modals
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{ id: string; name: string } | null>(null);

  // Product modal
  const [prodModal, setProdModal] = useState<{ open: boolean; categoryId: string | null }>({ open: false, categoryId: null });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);
  const [prodForm, setProdForm] = useState({
    name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", recipeId: "",
    available: true, pdvOnly: false, kitchenPrint: false, autoDisableWhenOutOfStock: false,
    scheduleRuleEnabled: false,
    scheduleRuleType: "weekday" as "weekday" | "daterange" | "both",
    scheduleRuleWeekdays: [] as number[],
    scheduleRuleStartTime: "",
    scheduleRuleEndTime: "",
    scheduleRuleStartDate: "",
    scheduleRuleEndDate: "",
    variants: [] as { _key: string, name: string, price: string, description: string, inventoryItemId: string }[],
    extras: [] as { id: string, label: string, price: string }[],
    // Fiscal NFC-e
    ncm: "", cfop: "5102", csosn: "400", unitCom: "UN", origem: 0, aliqIcms: 0,
  });
  const [extraInput, setExtraInput] = useState({ label: "", price: "" });

  useEffect(() => {
    if (tenant) {
      setLocalCategories(tenant.categories || []);
      apiFetch(`/api/tenants/${tenant.slug}/inventory`)
        .then(res => res.json())
        .then(data => setInventoryItems(data))
        .catch(() => {});
      apiFetch(`/api/tenants/${tenant.slug}/production/recipes`)
        .then(res => res.json())
        .then(data => setProductionRecipes(Array.isArray(data) ? data : []))
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
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (selectedCat === id) setSelectedCat("all");
    setLocalCategories(cats => cats.filter(c => c.id !== id));
  };

  const openNewProduct = (categoryId: string) => {
    setEditingProduct(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", recipeId: "", available: true, pdvOnly: false, kitchenPrint: false, autoDisableWhenOutOfStock: false, scheduleRuleEnabled: false, scheduleRuleType: "weekday", scheduleRuleWeekdays: [], scheduleRuleStartTime: "", scheduleRuleEndTime: "", scheduleRuleStartDate: "", scheduleRuleEndDate: "", variants: [], extras: [], ncm: "", cfop: "5102", csosn: "400", unitCom: "UN", origem: 0, aliqIcms: 0 });
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
    let scheduleRuleEnabled = false;
    let scheduleRuleType: "weekday" | "daterange" | "both" = "weekday";
    let scheduleRuleWeekdays: number[] = [];
    let scheduleRuleStartTime = "";
    let scheduleRuleEndTime = "";
    let scheduleRuleStartDate = "";
    let scheduleRuleEndDate = "";
    try {
      if (prod.scheduleRule) {
        const rule = JSON.parse(prod.scheduleRule);
        scheduleRuleEnabled = true;
        scheduleRuleType = rule.type || "weekday";
        scheduleRuleWeekdays = rule.weekdays || [];
        scheduleRuleStartTime = rule.weekdayStartTime || "";
        scheduleRuleEndTime = rule.weekdayEndTime || "";
        scheduleRuleStartDate = rule.startDate || "";
        scheduleRuleEndDate = rule.endDate || "";
      }
    } catch {}
    setProdForm({
      name: prod.name, description: prod.description || "", price: String(prod.price),
      imageUrl: prod.imageUrl || "", inventoryItemId: prod.inventoryItemId || "", recipeId: prod.recipeId || "",
      available: prod.available !== false,
      pdvOnly: prod.pdvOnly || false,
      kitchenPrint: prod.kitchenPrint === true,
      autoDisableWhenOutOfStock: prod.autoDisableWhenOutOfStock || false,
      scheduleRuleEnabled,
      scheduleRuleType,
      scheduleRuleWeekdays,
      scheduleRuleStartTime,
      scheduleRuleEndTime,
      scheduleRuleStartDate,
      scheduleRuleEndDate,
      variants: prod.variants?.map((v: any) => ({ _key: v.id || crypto.randomUUID(), name: v.name, price: String(v.price), description: v.description || "", inventoryItemId: v.inventoryItemId || "" })) || [],
      extras: parsedExtras,
      ncm: prod.ncm || "", cfop: prod.cfop || "5102", csosn: prod.csosn || "400",
      unitCom: prod.unitCom || "UN", origem: prod.origem ?? 0, aliqIcms: prod.aliqIcms ?? 0,
    });
    setExtraInput({ label: "", price: "" });
    setProdModal({ open: true, categoryId: prod.categoryId });
  };



  const closeProdModal = () => { setProdModal({ open: false, categoryId: null }); setEditingProduct(null); };

  const saveProduct = async () => {
    if (!prodForm.name || !prodModal.categoryId) return;
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    let scheduleRule: string | null = null;
    if (prodForm.scheduleRuleEnabled) {
      const rule: any = { type: prodForm.scheduleRuleType };
      if (prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") {
        rule.weekdays = prodForm.scheduleRuleWeekdays;
        if (prodForm.scheduleRuleStartTime) rule.weekdayStartTime = prodForm.scheduleRuleStartTime;
        if (prodForm.scheduleRuleEndTime) rule.weekdayEndTime = prodForm.scheduleRuleEndTime;
      }
      if (prodForm.scheduleRuleType === "daterange" || prodForm.scheduleRuleType === "both") {
        rule.startDate = prodForm.scheduleRuleStartDate;
        rule.endDate = prodForm.scheduleRuleEndDate;
      }
      scheduleRule = JSON.stringify(rule);
    }
    const res = await apiFetch(url, {
      method: editingProduct ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...prodForm,
        extras: JSON.stringify(prodForm.extras.map(e => ({ id: e.id, label: e.label, price: parseFloat(e.price) || 0 }))),
        scheduleRule,
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
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    setLocalCategories(cats => cats.map(cat => ({
      ...cat,
      products: cat.products?.filter((p: any) => p.id !== id)
    })));
  };

  // ── Drag-and-drop: categorias e produtos (@dnd-kit) ────────────────────────
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );
  const [activeDragCategory, setActiveDragCategory] = useState<any | null>(null);
  const [activeDragProduct, setActiveDragProduct] = useState<any | null>(null);

  const reorderCategories = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId || !tenant) return;
    const current = [...localCategories];
    const fromIdx = current.findIndex(c => c.id === draggedId);
    const toIdx = current.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...current];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalCategories(reordered);
    try {
      await apiFetch('/api/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, orderedIds: reordered.map(c => c.id) }),
      });
    } catch {
      setLocalCategories(current); // reverte em caso de falha
    }
  };

  const reorderOrMoveProduct = async (
    draggedProductId: string,
    fromCategoryId: string,
    targetProductId: string | null,
    toCategoryId: string
  ) => {
    if (!tenant) return;
    const previous = localCategories.map(c => ({ ...c, products: [...(c.products || [])] }));

    let next = localCategories.map(c => ({ ...c, products: [...(c.products || [])] }));
    const fromCat = next.find(c => c.id === fromCategoryId);
    const draggedProd = fromCat?.products.find((p: any) => p.id === draggedProductId);
    if (!fromCat || !draggedProd) return;

    // Remove da categoria de origem
    fromCat.products = fromCat.products.filter((p: any) => p.id !== draggedProductId);

    const toCat = next.find(c => c.id === toCategoryId);
    if (!toCat) return;
    const targetIdx = targetProductId ? toCat.products.findIndex((p: any) => p.id === targetProductId) : -1;
    const insertAt = targetIdx === -1 ? toCat.products.length : targetIdx;
    toCat.products.splice(insertAt, 0, { ...draggedProd, categoryId: toCategoryId });

    setLocalCategories(next);
    try {
      await apiFetch('/api/products/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          categoryId: toCategoryId,
          orderedIds: toCat.products.map((p: any) => p.id),
          movedProductId: fromCategoryId !== toCategoryId ? draggedProductId : undefined,
          targetCategoryId: fromCategoryId !== toCategoryId ? toCategoryId : undefined,
        }),
      });
    } catch {
      setLocalCategories(previous); // reverte em caso de falha
    }
  };

  const duplicateProductToCatalog = async () => {
    if (!editingProduct || !prodModal.categoryId) return;
    const res = await apiFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${prodForm.name} (cópia)`,
        description: prodForm.description,
        price: prodForm.price,
        imageUrl: prodForm.imageUrl,
        available: prodForm.available,
        categoryId: prodModal.categoryId,
        tenantId: tenant?.id,
      })
    });
    const saved = await res.json();
    setLocalCategories(cats => cats.map(cat =>
      cat.id === prodModal.categoryId
        ? { ...cat, products: [...(cat.products || []), saved] }
        : cat
    ));
    toast.success(`"${saved.name}" duplicado no catálogo com sucesso!`);
  };

  const duplicateProductToInventory = async () => {
    if (!editingProduct || !tenant) return;
    const res = await apiFetch('/api/inventory/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: prodForm.name,
        tenantId: tenant.id,
        quantity: 0,
        unit: 'un',
        usage: 'SALE',
        purchasePrice: parseFloat(prodForm.price) || 0,
        sellingPrice: parseFloat(prodForm.price) || 0,
      })
    });
    const saved = await res.json();
    toast.success(`"${saved.name}" criado no Estoque! Vá em Estoque para configurar quantidade e unidades.`);
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

  const addVariantField = () => setProdForm(prev => ({ ...prev, variants: [...prev.variants, { _key: crypto.randomUUID(), name: "", price: "", description: "", inventoryItemId: "" }] }));
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

  // Arrastar só faz sentido quando a ordem exibida é a ordem real (sem filtro de busca/categoria)
  const dragEnabled = !search && selectedCat === "all";

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

      {/* Category + product list — um único DndContext cobre categorias e produtos,
          permitindo arrastar um produto de uma categoria para outra. */}
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => {
          if (!dragEnabled) return;
          const kind = (e.active.data.current as any)?.type;
          if (kind === "category") {
            setActiveDragCategory(categories.find(c => c.id === e.active.id) || null);
          } else if (kind === "product") {
            const cat = categories.find(c => c.id === (e.active.data.current as any).categoryId);
            setActiveDragProduct(cat?.products?.find((p: any) => p.id === e.active.id) || null);
          }
        }}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          setActiveDragCategory(null);
          setActiveDragProduct(null);
          if (!dragEnabled || !over || active.id === over.id) return;

          const activeType = (active.data.current as any)?.type;
          const overType = (over.data.current as any)?.type;

          if (activeType === "category" && overType === "category") {
            void reorderCategories(String(active.id), String(over.id));
            return;
          }

          if (activeType === "product") {
            const fromCategoryId = (active.data.current as any).categoryId;
            if (overType === "product") {
              const toCategoryId = (over.data.current as any).categoryId;
              void reorderOrMoveProduct(String(active.id), fromCategoryId, String(over.id), toCategoryId);
            } else if (overType === "category-drop") {
              // Soltou sobre o corpo de uma categoria vazia
              void reorderOrMoveProduct(String(active.id), fromCategoryId, null, String(over.id));
            }
          }
        }}
        onDragCancel={() => { setActiveDragCategory(null); setActiveDragProduct(null); }}
      >
        <SortableContext items={visibleCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {visibleCategories.map(cat => (
            <SortableCategoryCard
              key={cat.id}
              cat={cat}
              dragEnabled={dragEnabled}
              openNewProduct={openNewProduct}
              openEditCategory={openEditCategory}
              openEditProduct={openEditProduct}
              toggleProductAvailability={toggleProductAvailability}
              setDeleteProductConfirm={setDeleteProductConfirm}
              fmt={fmt}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeDragCategory && (
            <div className="bg-white rounded-2xl border-2 border-[#C9A227] shadow-2xl px-4 py-3 opacity-95 rotate-1">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{activeDragCategory.name}</h3>
            </div>
          )}
          {activeDragProduct && <ProductRowGhost prod={activeDragProduct} fmt={fmt} />}
        </DragOverlay>
      </DndContext>

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
              <Button variant="ghost" className="text-red-500 hover:bg-red-50 sm:mr-auto" onClick={() => { closeCatModal(); setDeleteCategoryConfirm({ id: catModal.editing!.id, name: catName }); }}>
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
          <div className="flex flex-col gap-2">
            {editingProduct && (
              <div className="flex gap-2 flex-wrap pb-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={duplicateProductToCatalog}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100"
                >
                  <span>📋</span> Duplicar no Catálogo
                </button>
                <button
                  type="button"
                  onClick={duplicateProductToInventory}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-100"
                >
                  <span>📦</span> Criar no Estoque
                </button>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeProdModal}>Cancelar</Button>
              <Button onClick={saveProduct}>{editingProduct ? "Salvar alterações" : "Adicionar produto"}</Button>
            </div>
          </div>
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do produto" placeholder="Ex: Pastel de carne" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} />
            <CurrencyInput label="Preço base (R$)" value={prodForm.price} onChange={v => setProdForm({ ...prodForm, price: v })} />
          </div>
          <Input label="Descrição (opcional)" placeholder="Ingredientes, detalhes..." value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} />

          <ImageUploader label="Foto do produto" value={prodForm.imageUrl} onChange={val => setProdForm({ ...prodForm, imageUrl: val })} description="Fotos de alta qualidade convertem mais vendas." />

          {/* Vínculo de estoque */}
          <InventoryLinkField
            inventoryItems={inventoryItems}
            value={prodForm.inventoryItemId}
            onChange={val => setProdForm({ ...prodForm, inventoryItemId: val })}
            autoDisable={prodForm.autoDisableWhenOutOfStock}
            onAutoDisableChange={val => setProdForm({ ...prodForm, autoDisableWhenOutOfStock: val })}
            allCategories={localCategories}
            editingProductId={editingProduct?.id}
          />

          {/* Vínculo de receita de produção */}
          <ProductionLinkField
            recipes={productionRecipes}
            value={prodForm.recipeId}
            onChange={val => setProdForm({ ...prodForm, recipeId: val })}
            allCategories={localCategories}
            editingProductId={editingProduct?.id}
          />

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

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Vai para a cozinha</p>
              <p className="text-xs text-slate-400">Ative para itens que precisam de preparo — bebidas/embalagens ficam desativadas por padrão</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, kitchenPrint: !f.kitchenPrint }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.kitchenPrint === true ? 'bg-orange-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.kitchenPrint === true ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Disponibilidade Automática */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Disponibilidade Automática</p>
                <p className="text-xs text-slate-400">Produto aparece/some do cardápio online automaticamente</p>
              </div>
              <button
                type="button"
                onClick={() => setProdForm(f => ({ ...f, scheduleRuleEnabled: !f.scheduleRuleEnabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.scheduleRuleEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.scheduleRuleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {prodForm.scheduleRuleEnabled && (
              <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                {/* Tipo de regra */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Tipo de regra</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: "weekday",   label: "Dia da semana" },
                      { value: "daterange", label: "Período (datas)" },
                      { value: "both",      label: "Os dois" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProdForm(f => ({ ...f, scheduleRuleType: opt.value }))}
                        className={`text-[10px] font-black py-1.5 px-2 rounded-lg border-2 transition-all ${prodForm.scheduleRuleType === opt.value ? "border-amber-400 bg-white text-amber-700" : "border-amber-200 text-slate-500 hover:border-amber-300"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dias da semana */}
                {(prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Dias ativos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, idx) => {
                        const active = prodForm.scheduleRuleWeekdays.includes(idx);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setProdForm(f => ({
                              ...f,
                              scheduleRuleWeekdays: active
                                ? f.scheduleRuleWeekdays.filter(d => d !== idx)
                                : [...f.scheduleRuleWeekdays, idx]
                            }))}
                            className={`w-10 h-8 text-xs font-black rounded-lg border-2 transition-all ${active ? "border-amber-400 bg-amber-400 text-white" : "border-amber-200 bg-white text-slate-500 hover:border-amber-300"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Horário nos dias ativos */}
                {(prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Horário (opcional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Aparece às</label>
                        <input
                          type="time"
                          value={prodForm.scheduleRuleStartTime}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleStartTime: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Some às</label>
                        <input
                          type="time"
                          value={prodForm.scheduleRuleEndTime}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleEndTime: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic mt-1.5">Deixe em branco para ficar visível o dia todo (00:00–23:59).</p>
                  </div>
                )}

                {/* Período de datas */}
                {(prodForm.scheduleRuleType === "daterange" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Período de visibilidade</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Data início</label>
                        <input
                          type="date"
                          value={prodForm.scheduleRuleStartDate}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleStartDate: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Data fim</label>
                        <input
                          type="date"
                          value={prodForm.scheduleRuleEndDate}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleEndDate: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
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

          {/* Dados Fiscais NFC-e */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors list-none">
              <FileText className="w-3.5 h-3.5" />
              Dados Fiscais (NFC-e)
            </summary>
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <p className="text-[10px] text-slate-400 font-medium">Preencha apenas se o módulo fiscal (NFC-e) estiver ativo nas configurações da loja.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">NCM</label>
                  <input type="text" maxLength={10} value={prodForm.ncm}
                    onChange={e => setProdForm(f => ({ ...f, ncm: e.target.value.replace(/\D/g, "") }))}
                    placeholder="00000000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CFOP</label>
                  <select value={prodForm.cfop} onChange={e => setProdForm(f => ({ ...f, cfop: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value="5102">5102 — Venda mercadoria adquirida</option>
                    <option value="5405">5405 — Venda c/ ST</option>
                    <option value="5101">5101 — Venda de produção própria</option>
                    <option value="5933">5933 — Simples Nacional — serviço</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CSOSN</label>
                  <select value={prodForm.csosn} onChange={e => setProdForm(f => ({ ...f, csosn: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value="400">400 — Isento ICMS (Simples)</option>
                    <option value="102">102 — Tributada sem permissão crédito</option>
                    <option value="103">103 — Isento faixa receita bruta</option>
                    <option value="500">500 — ICMS cobrado por ST</option>
                    <option value="900">900 — Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Unidade</label>
                  <select value={prodForm.unitCom} onChange={e => setProdForm(f => ({ ...f, unitCom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    {["UN","KG","G","L","ML","CX","PC","PT","PAR","DZ"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Origem</label>
                  <select value={prodForm.origem} onChange={e => setProdForm(f => ({ ...f, origem: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (mercado interno)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Alíq. ICMS %</label>
                  <input type="number" min={0} max={100} step={0.01} value={prodForm.aliqIcms}
                    onChange={e => setProdForm(f => ({ ...f, aliqIcms: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Variantes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tamanhos / Variantes</span>
              <button onClick={addVariantField} className="text-xs font-black text-[#C9A227] hover:underline">+ Adicionar</button>
            </div>
            <div className="space-y-2">
              {prodForm.variants.map((v, idx) => (
                <div key={v._key} className="flex gap-2 items-center">
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

      {/* Modal: confirmar exclusão de produto */}
      <ConfirmModal
        isOpen={!!deleteProductConfirm}
        onClose={() => setDeleteProductConfirm(null)}
        onConfirm={() => { deleteProduct(deleteProductConfirm!); setDeleteProductConfirm(null); }}
        title="Excluir produto"
        message="Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />

      {/* Modal: confirmar exclusão de categoria */}
      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(null)}
        onConfirm={() => { deleteCategory(deleteCategoryConfirm!.id); setDeleteCategoryConfirm(null); }}
        title="Excluir categoria"
        message={<>Tem certeza que deseja excluir a categoria <strong>"{deleteCategoryConfirm?.name}"</strong> e todos os seus produtos? Essa ação não pode ser desfeita.</>}
        confirmLabel="Excluir tudo"
        variant="danger"
      />
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
  const [filterType, setFilterType] = useState<"all" | "low" | "expiring" | "expired" | "internal" | "sale">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);



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
    const matchesCategory = filterCategory === "all" || item.categoryId === filterCategory;

    if (!matchesSearch || !matchesCategory) return false;
    if (filterType === "low") return item.minStock && item.quantity <= item.minStock;
    if (filterType === "expired") return item.expirationDate && new Date(item.expirationDate) < new Date();
    if (filterType === "expiring") {
      if (!item.expirationDate) return false;
      const days = (new Date(item.expirationDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 5;
    }
    if (filterType === "internal") return item.usage === "INTERNAL";
    if (filterType === "sale") return item.usage === "SALE";
    return true;
  });

  const stats = {
    totalItems: items.length,
    lowStock: items.filter(i => i.minStock && i.quantity <= i.minStock).length,
    expired: items.filter(i => i.expirationDate && new Date(i.expirationDate) < new Date()).length,
    nearExpiry: items.filter(i => {
      if (!i.expirationDate) return false;
      const days = (new Date(i.expirationDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 5;
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
        <div
          className={`cursor-pointer transition-transform hover:scale-[1.02] ${stats.nearExpiry > 0 ? "ring-2 ring-amber-400 ring-offset-2 rounded-2xl" : ""}`}
          onClick={() => stats.nearExpiry > 0 && setFilterType("expiring")}
          title={stats.nearExpiry > 0 ? "Ver itens a vencer em até 5 dias" : ""}
        >
          <StatCard
            title="Próximos do Vencimento"
            value={stats.nearExpiry}
            icon={CalendarClock}
            color={stats.nearExpiry > 0 ? "warning" : "info"}
          />
        </div>
        <StatCard 
          title="Valor em Insumos" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)} 
          icon={ArrowRightLeft} 
          color="success"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/30">
          {/* Row 1: tabs de tipo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterLineSegmented
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'low', label: 'Críticos' },
                { value: 'expiring', label: stats.nearExpiry > 0 ? `⚠ A Vencer (${stats.nearExpiry})` : 'A Vencer' },
                { value: 'expired', label: 'Vencidos' },
                { value: 'sale', label: 'Para Venda' },
                { value: 'internal', label: 'Consumo' },
              ]}
              value={filterType}
              onChange={val => setFilterType(val as any)}
            />
            <Button
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              size="sm"
              iconLeft={<Plus className="w-4 h-4" />}
            >
              Novo Item
            </Button>
          </div>

          {/* Row 2: busca + filtro categoria */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-white outline-none focus:border-amber-400 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6" />
              </svg>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="pl-8 pr-8 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-white outline-none focus:border-amber-400 transition-colors appearance-none cursor-pointer text-slate-700 min-w-[160px]"
              >
                <option value="all">Todas as categorias</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({items.filter(i => i.categoryId === cat.id).length})
                  </option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
              {filterCategory !== "all" && (
                <button
                  onClick={() => setFilterCategory("all")}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                  title="Limpar filtro"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Badge de filtro ativo */}
          {filterCategory !== "all" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Filtrando por:</span>
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-black px-2 py-0.5 rounded-full">
                {categories.find(c => c.id === filterCategory)?.name}
                <button onClick={() => setFilterCategory("all")} className="hover:text-red-500 transition-colors">×</button>
              </span>
              <span className="text-[10px] text-slate-400">{filteredItems.length} item(s)</span>
            </div>
          )}
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
                const hasConversion = item.purchaseUnit && item.purchaseQty && item.stockUnit;
                const granularTotal = hasConversion ? item.quantity * item.purchaseQty : null;
                return (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-sm font-black ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.quantity} {item.unit || item.purchaseUnit || 'un'}
                    </span>
                    {hasConversion && granularTotal !== null && (
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">
                        ≈ {granularTotal.toLocaleString("pt-BR")} {item.stockUnit}
                      </span>
                    )}
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
                const daysLeft = item.expirationDate
                  ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000)
                  : null;
                const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;

                return (
                  <div className="space-y-1.5 min-w-[140px]">
                    {isLow && (
                      <Badge color="warning" size="sm" dot>Estoque Crítico</Badge>
                    )}
                    {item.expirationDate ? (
                      <div className="space-y-0.5">
                        <Badge color={isExpired ? "danger" : isNearExpiry ? "warning" : "success"} size="sm">
                          {isExpired
                            ? `Venceu: ${new Date(item.expirationDate).toLocaleDateString("pt-BR")}`
                            : `Vence em: ${new Date(item.expirationDate).toLocaleDateString("pt-BR")}`}
                        </Badge>
                        {isNearExpiry && !isExpired && (
                          <p className="text-[10px] font-black text-amber-600 animate-pulse">
                            ⚠ {daysLeft === 0 ? "Vence hoje!" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restante${daysLeft === 1 ? "" : "s"}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300 font-bold italic">Sem validade</span>
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
                    onClick={() => setDeletingItem(item)}
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

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleteLoading(true);
          try {
            await apiFetch(`/api/inventory/items/${deletingItem.id}`, { method: 'DELETE' });
            fetchData();
          } finally {
            setDeleteLoading(false);
            setDeletingItem(null);
          }
        }}
        title="Remover item do estoque"
        message={
          <span>
            Tem certeza que deseja remover <strong>{deletingItem?.name}</strong> do estoque?
            {deletingItem?.quantity > 0 && (
              <span className="block mt-2 text-amber-600 text-xs font-semibold">
                Ainda há {deletingItem.quantity} {deletingItem.unit || "un"} em estoque.
              </span>
            )}
          </span>
        }
        confirmLabel="Remover"
        loading={deleteLoading}
        variant="danger"
      />
    </div>
  );
}

const UNIT_GROUPS = [
  {
    label: "Massa",
    units: [
      { value: "g",  label: "g — Grama" },
      { value: "kg", label: "kg — Quilograma" },
      { value: "mg", label: "mg — Miligrama" },
    ],
  },
  {
    label: "Volume",
    units: [
      { value: "ml", label: "ml — Mililitro" },
      { value: "l",  label: "l — Litro" },
    ],
  },
  {
    label: "Contagem",
    units: [
      { value: "un",   label: "un — Unidade" },
      { value: "dz",   label: "dz — Dúzia" },
      { value: "cx",   label: "cx — Caixa" },
      { value: "pct",  label: "pct — Pacote" },
      { value: "fd",   label: "fd — Fardo" },
      { value: "saco", label: "saco — Saco" },
    ],
  },
  {
    label: "Comprimento",
    units: [
      { value: "cm", label: "cm — Centímetro" },
      { value: "m",  label: "m — Metro" },
    ],
  },
];

function UnitSelectInput({
  label,
  value,
  onChange,
  hint,
  size = "sm",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(rect.bottom + 210 > window.innerHeight);
    }
    setOpen((o) => !o);
  };

  const allUnits = UNIT_GROUPS.flatMap((g) => g.units);
  const _matched = allUnits.find((u) => u.value === value.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </label>
      <div
        className="flex items-center gap-1 border border-zinc-200 rounded-lg bg-white cursor-pointer hover:border-amber-400 focus-within:border-amber-400 transition-colors px-2"
        style={{ height: size === "sm" ? "34px" : "40px" }}
        onClick={handleToggle}
      >
        <input
          className="flex-1 text-xs font-bold bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="un, kg, ml…"
          autoComplete="off"
        />
        <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && <p className="text-[9px] text-amber-600 mt-0.5">{hint}</p>}
      {open && (
        <div className={`absolute z-50 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-y-auto max-h-48 ${openUp ? "bottom-full mb-1" : "top-full mt-1"} left-0`}>
          {UNIT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-zinc-50 border-b border-zinc-100 sticky top-0">
                {group.label}
              </div>
              {group.units.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => { onChange(u.value); setOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center gap-2 hover:bg-amber-50 transition-colors ${
                    value === u.value ? "bg-amber-50 text-amber-700 font-black" : "text-slate-700 font-semibold"
                  }`}
                >
                  <span className="font-black text-slate-900 w-6 shrink-0">{u.value}</span>
                  <span className="text-slate-500 text-[10px] flex-1 truncate">{u.label.split(" — ")[1]}</span>
                  {value === u.value && (
                    <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
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
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : "",
    // Conversão inteligente
    purchaseUnit: item?.purchaseUnit || "",
    purchaseQty: item?.purchaseQty || "",
    stockUnit: item?.stockUnit || "",
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
        minStock: form.minStock ? parseFloat(form.minStock.toString()) : null,
        purchaseUnit: form.purchaseUnit || null,
        purchaseQty: form.purchaseQty ? parseFloat(form.purchaseQty.toString()) : null,
        stockUnit: form.stockUnit || null,
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
              <UnitSelectInput label="Unidade de armazenamento" value={form.unit} onChange={v => set("unit", v)} />
              <Input label="Peso/Volume" size="sm" placeholder="500g, 1.5L" value={form.weight} onChange={e => set("weight", e.target.value)} />
            </div>
          </div>

          {/* Conversão de Unidades */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-3">
            <SectionHeader icon={ArrowRightLeft} label="Conversão de Unidades (opcional)" color="bg-amber-500" />
            <p className="text-[11px] text-amber-700 leading-relaxed -mt-1">
              Use quando compra em uma unidade mas consome em outra. Ex: compra <b>1 garrafa (un)</b> de óleo que contém <b>1000 ml</b> — na produção desconta em <b>ml</b>.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <UnitSelectInput
                  label="Unidade de compra"
                  value={form.purchaseUnit}
                  onChange={v => set("purchaseUnit", v)}
                  hint="como você compra"
                />
              </div>
              <div>
                <Input
                  label="Conteúdo por unidade"
                  size="sm"
                  type="number"
                  step="0.001"
                  placeholder="1000"
                  value={form.purchaseQty}
                  onChange={e => set("purchaseQty", e.target.value)}
                />
                <p className="text-[9px] text-amber-600 mt-0.5">quantidade contida</p>
              </div>
              <div>
                <UnitSelectInput
                  label="Unidade granular"
                  value={form.stockUnit}
                  onChange={v => set("stockUnit", v)}
                  hint="usada na produção"
                />
              </div>
            </div>
            {/* Preview da conversão */}
            {form.purchaseUnit && form.purchaseQty && form.stockUnit && (
              <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-base">🔄</span>
                <p className="text-[12px] text-amber-800 font-bold">
                  1 <span className="text-amber-600">{form.purchaseUnit}</span>
                  {" = "}
                  <span className="text-amber-600">{form.purchaseQty} {form.stockUnit}</span>
                  {form.quantity ? (
                    <span className="text-slate-500 font-normal ml-1">
                      → estoque total:{" "}
                      <b className="text-amber-700">
                        {(parseFloat(form.quantity.toString()) * parseFloat(form.purchaseQty.toString())).toLocaleString("pt-BR")} {form.stockUnit}
                      </b>
                    </span>
                  ) : null}
                </p>
              </div>
            )}
            {(form.purchaseUnit || form.purchaseQty || form.stockUnit) &&
             !(form.purchaseUnit && form.purchaseQty && form.stockUnit) && (
              <p className="text-[10px] text-amber-500 italic">Preencha os 3 campos para ativar a conversão automática.</p>
            )}
          </div>

          {/* Financeiro */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={CircleDollarSign} label="Financeiro" color="bg-emerald-500" />
            <div className="grid grid-cols-2 gap-2">
              <CurrencyInput label="Custo (R$)" size="sm" value={form.purchasePrice} onChange={v => set("purchasePrice", v)} />
              <CurrencyInput label="Venda (R$)" size="sm" value={form.sellingPrice} onChange={v => set("sellingPrice", v)} />
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

// ─── KmRangeAdder ─────────────────────────────────────────────────────────────
function KmRangeAdder({ onAdd }: { onAdd: (range: KmRange) => void }) {
  const [upToKm, setUpToKm] = useState("");
  const [fee, setFee] = useState("");

  const handleAdd = () => {
    const km = parseFloat(upToKm);
    if (!km || km <= 0) return;
    onAdd({ id: Date.now().toString(), upToKm: km, fee: parseFloat(fee) || 0 });
    setUpToKm("");
    setFee("");
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-3 bg-slate-50/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar faixa de distância</p>
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-xs font-bold text-slate-400 shrink-0">Até</span>
          <input
            type="number" min="0.1" step="0.5"
            value={upToKm}
            onChange={e => setUpToKm(e.target.value)}
            placeholder="5"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs font-bold text-slate-400 shrink-0">km</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-xs font-bold text-slate-400 shrink-0">Taxa R$</span>
          <input
            type="number" min="0" step="0.50"
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder="0,00"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>
      <Button type="button" size="xs" variant="outline" disabled={!upToKm || parseFloat(upToKm) <= 0} onClick={handleAdd}>
        + Adicionar faixa
      </Button>
    </div>
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
  const [tableRecords, setTableRecords] = useState<Array<{ id: string; label: string }>>([]);
  const [newTable, setNewTable] = useState("");
  const [tablesLoading, setTablesLoading] = useState(true);
  const [addTableError, setAddTableError] = useState("");

  const fetchTables = async () => {
    try {
      const data = await apiJson(`/api/tenants/${tenant.slug}/tables`) as Array<{ id: string; label: string }>;
      setTableRecords(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setTablesLoading(false); }
  };

  useEffect(() => { fetchTables(); }, [tenant.slug]);

  const tables = tableRecords.map(t => t.label);

  const addTable = async () => {
    const label = newTable.trim();
    if (!label || tables.includes(label)) return;
    setAddTableError("");
    try {
      const created = await apiJson(`/api/tenants/${tenant.slug}/tables`, {
        method: "POST",
        body: JSON.stringify({ label }),
      }) as { id: string; label: string };
      setTableRecords(prev => [...prev, created].sort((a, b) => {
        const numA = parseInt(a.label);
        const numB = parseInt(b.label);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.label.localeCompare(b.label);
      }));
      setNewTable("");
    } catch (err: any) {
      setAddTableError(err?.message || "Erro ao adicionar mesa.");
    }
  };

  const removeTable = async (label: string) => {
    const record = tableRecords.find(t => t.label === label);
    if (!record) return;
    setTableRecords(prev => prev.filter(t => t.id !== record.id));
    try {
      await apiJson(`/api/tenants/${tenant.slug}/tables/${record.id}`, { method: "DELETE" });
    } catch { fetchTables(); }
  };

  const menuUrl = `${window.location.origin}/${tenant.slug}/mesa/`;
  const counterUrl = `${window.location.origin}/${tenant.slug}/balcao`;

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
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(counterUrl)}`}
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
                  const link = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(counterUrl)}`;
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
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <input
                  value={newTable}
                  onChange={e => setNewTable(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addTable(); }}
                  placeholder="Nº da Mesa"
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 w-28"
                />
                <Button variant="primary" size="sm" onClick={addTable}>
                  + Adicionar Mesa
                </Button>
              </div>
              {addTableError && <p className="text-[10px] font-bold text-red-500">{addTableError}</p>}
            </div>
          </div>

          {tablesLoading ? (
            <div className="flex items-center justify-center p-16">
              <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <>
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
          </>
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
  const hasKitchenItem = (o: Order) => o.items.some(item => item.product?.kitchenPrint === true);
  const pendingOrders = orders.filter(o => o.status === "PENDING" && hasKitchenItem(o));
  const preparingOrders = orders.filter(o => o.status === "PREPARING" && hasKitchenItem(o));
  const kitchenOrders = [...pendingOrders, ...preparingOrders];

  // Calculate consolidated items (pending + preparing) — só itens marcados para cozinha
  const consolidated = kitchenOrders.reduce((acc: Record<string, { name: string; quantity: number }>, order) => {
    order.items.filter(item => item.product?.kitchenPrint === true).forEach(item => {
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
              {order.orderType === 'DELIVERY' ? 'Delivery' : order.orderType === 'DINE_IN' ? dineInOrderLabel(order) : 'Retirada'}
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
        {order.items.filter((item) => item.product?.kitchenPrint === true).map((item, idx) => (
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
        {order.items.every((item) => item.product?.kitchenPrint !== true) && (
          <p className="text-xs text-slate-300 italic text-center py-4">Nenhum item de cozinha neste pedido</p>
        )}
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
          {o.orderType === 'DELIVERY' ? 'Delivery' : o.orderType === 'DINE_IN' ? dineInOrderLabel(o) : 'Retirada'}
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

// ─── ScheduledOrdersPanel ─────────────────────────────────────────────────────
export function ScheduledOrdersPanel({
  orders,
  updateStatus,
  slug,
}: {
  orders: Order[];
  updateStatus: any;
  slug: string;
}) {
  const scheduled = useMemo(() => {
    return orders
      .filter((o) => o.scheduledDate && o.status !== "CANCELLED")
      .sort((a, b) => {
        const da = new Date(a.scheduledDate!).getTime();
        const db = new Date(b.scheduledDate!).getTime();
        return da - db;
      });
  }, [orders]);

  // Group by scheduledDate
  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of scheduled) {
      const key = o.scheduledDate!.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.entries()];
  }, [scheduled]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso + "T12:00:00");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    if (isToday) return "Hoje";
    if (isTomorrow) return "Amanhã";
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  };

  if (grouped.length === 0) {
    return (
      <PageWrapper>
        <SectionTitle title="Agendamentos" description="Pedidos sob encomenda com data marcada" icon={CalendarClock} className="mb-6" />
        <EmptyState
          title="Nenhum agendamento"
          description="Quando o Modo Encomenda estiver ativo e clientes fizerem pedidos com data, eles aparecerão aqui."
          icon={CalendarClock}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SectionTitle title="Agendamentos" description="Pedidos sob encomenda agrupados por data" icon={CalendarClock} className="mb-6" />
      <div className="space-y-8">
        {grouped.map(([date, dayOrders]) => {
          const d = new Date(date + "T12:00:00");
          const isPast = d < new Date(new Date().toDateString());
          return (
            <div key={date}>
              {/* Date header */}
              <div className={`flex items-center gap-3 mb-3 px-1`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPast ? "bg-slate-100" : "bg-amber-50"}`}>
                  <CalendarClock className={`w-5 h-5 ${isPast ? "text-slate-400" : "text-amber-500"}`} />
                </div>
                <div>
                  <p className={`text-sm font-black capitalize ${isPast ? "text-slate-400" : "text-slate-800"}`}>{fmtDate(date)}</p>
                  <p className="text-[10px] font-bold text-slate-400">{dayOrders.length} pedido{dayOrders.length !== 1 ? "s" : ""}</p>
                </div>
                {isPast && <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-100 px-2.5 py-1 rounded-full">Passado</span>}
              </div>
              <OrdersList filteredOrders={dayOrders} updateStatus={updateStatus} slug={slug} />
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}
