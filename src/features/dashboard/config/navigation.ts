import {
  CircleDollarSign,
  ClipboardList,
  Clock,
  History,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  Utensils,
} from "lucide-react";
import type { DashboardNavigationGroup } from "../types";

export const DASHBOARD_NAVIGATION: DashboardNavigationGroup[] = [
  {
    id: "operacao",
    label: "Operação",
    items: [
      { id: "overview", label: "Visão Geral", tab: "overview", icon: LayoutDashboard },
      { id: "orders", label: "Painel de Pedidos", tab: "live-orders", icon: Clock },
      { id: "history", label: "Histórico", tab: "history", icon: History },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    items: [
      { id: "menu", label: "Cardápio", tab: "menu", icon: Utensils },
      { id: "inventory", label: "Estoque", tab: "inventory", icon: Package },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [
      { id: "finance", label: "Financeiro", tab: "finance", icon: CircleDollarSign },
      { id: "whatsapp", label: "WhatsApp", tab: "whatsapp", icon: MessageSquare },
      { id: "profile", label: "Configurações", tab: "profile", icon: Settings },
      { id: "staff", label: "Equipe", tab: "staff", icon: ClipboardList },
    ],
  },
];
