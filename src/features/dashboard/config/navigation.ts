import {
  BarChart3,
  Bike,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Download,
  Factory,
  FileText,
  Heart,
  History,
  LayoutDashboard,
  Layers,
  MessageSquare,
  Monitor,
  Package,
  Receipt,
  Settings,
  Star,
  Truck,
  Users,
  UserCog,
  Utensils,
  Wallet,
  ArrowLeftRight,
  BookOpen,
} from "lucide-react";
import type { DashboardNavigationGroup } from "../types";

export const DASHBOARD_NAVIGATION: DashboardNavigationGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "overview",  label: "Visão Geral",        tab: "overview",     icon: LayoutDashboard },
      { id: "pos",       label: "PDV — Caixa",        tab: "pos",          icon: Receipt },
      { id: "waiter",    label: "Garçom",             tab: "waiter",       icon: UserCog },
      { id: "orders",    label: "Painel de Pedidos",  tab: "live-orders",  icon: Clock },
      { id: "drivers",   label: "Entregadores",       tab: "drivers",      icon: Bike },
      { id: "display-panel", label: "Config. Painel TV", tab: "display-panel", icon: Monitor },
      { id: "scheduled", label: "Agendamentos",       tab: "scheduled",    icon: CalendarDays },

      { id: "tables",    label: "Mesas e QR Code",    tab: "tables",       icon: ClipboardList },
      { id: "history",   label: "Histórico",          tab: "history",      icon: History },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo & Estoque",
    items: [
      { id: "menu",       label: "Cardápio",           tab: "menu",         icon: Utensils },
      { id: "inventory",  label: "Estoque",            tab: "inventory",    icon: Package },
      { id: "production", label: "Produção",           tab: "production",   icon: Factory },
      { id: "suppliers",  label: "Fornecedores",       tab: "suppliers",    icon: Truck },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { id: "finance",   label: "Fluxo de Caixa",     tab: "finance",      icon: Wallet },
      { id: "entries",   label: "Entradas e Saídas",  tab: "entries",      icon: ArrowLeftRight },
      { id: "reports",   label: "Relatórios",         tab: "reports",      icon: BarChart3 },
      { id: "nfce",      label: "Notas Fiscais",      tab: "nfce",         icon: FileText },
    ],
  },
  {
    id: "clientes",
    label: "Clientes & Marketing",
    items: [
      { id: "customers",   label: "Clientes — CRM",  tab: "customers",    icon: Users },
      { id: "loyalty",    label: "Fidelidade",        tab: "loyalty",      icon: Heart },
      { id: "promotions", label: "Promoções",         tab: "promotions",   icon: Star },
      { id: "bundles",    label: "Combos",             tab: "bundles",      icon: Layers },
      { id: "whatsapp",   label: "WhatsApp",          tab: "whatsapp",     icon: MessageSquare },
    ],
  },
  // Integração iFood (grupo "Integrações") escondida do menu até termos client_id de
  // desenvolvedor aprovado pelo iFood — código e rotas seguem prontos, só sem entrada visível.
  {
    id: "administracao",
    label: "Administração",
    items: [
      { id: "profile",    label: "Configurações",      tab: "profile",      icon: Settings,      ownerOnly: true },
      { id: "staff",      label: "Equipe",             tab: "staff",        icon: ClipboardList, ownerOnly: true },
      { id: "downloads",  label: "Downloads",          tab: "downloads",    icon: Download },
      { id: "manual",     label: "Manual e Ajuda",     tab: "manual",       icon: BookOpen },
    ],
  },
];
