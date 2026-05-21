import {
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Download,
  Factory,
  Heart,
  History,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Star,
  Users,
  Utensils,
  Wallet,
} from "lucide-react";
import type { DashboardNavigationGroup } from "../types";

export const DASHBOARD_NAVIGATION: DashboardNavigationGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "overview",  label: "Visão Geral",        tab: "overview",     icon: LayoutDashboard },
      { id: "pos",       label: "PDV — Caixa",        tab: "pos",          icon: Receipt },
      { id: "orders",    label: "Painel de Pedidos",  tab: "live-orders",  icon: Clock },
      { id: "scheduled", label: "Agendamentos",       tab: "scheduled",    icon: CalendarDays },
      { id: "kds",       label: "Monitor de Cozinha", tab: "kds",          icon: Utensils },
      { id: "tables",    label: "Mesas e QR Code",    tab: "tables",       icon: ClipboardList },
      { id: "history",   label: "Histórico",          tab: "history",      icon: History },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo & Estoque",
    items: [
      { id: "menu",      label: "Cardápio",           tab: "menu",         icon: Utensils },
      { id: "inventory", label: "Estoque",            tab: "inventory",    icon: Package },
      { id: "production", label: "Produção",          tab: "production",   icon: Factory },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    items: [
      { id: "finance",   label: "Fluxo de Caixa",     tab: "finance",      icon: Wallet },
      { id: "reports",   label: "Relatórios",         tab: "reports",      icon: BarChart3 },
    ],
  },
  {
    id: "clientes",
    label: "Clientes & Marketing",
    items: [
      { id: "customers",   label: "Clientes — CRM",  tab: "customers",    icon: Users },
      { id: "loyalty",    label: "Fidelidade",        tab: "loyalty",      icon: Heart },
      { id: "promotions", label: "Promoções",         tab: "promotions",   icon: Star },
      { id: "whatsapp",   label: "WhatsApp",          tab: "whatsapp",     icon: MessageSquare },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { id: "profile",    label: "Configurações",      tab: "profile",      icon: Settings,      ownerOnly: true },
      { id: "staff",      label: "Equipe",             tab: "staff",        icon: ClipboardList, ownerOnly: true },
      { id: "downloads",  label: "Downloads",          tab: "downloads",    icon: Download },
    ],
  },
];
