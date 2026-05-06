import {
  CircleDollarSign,
  ClipboardList,
  Clock,
  Heart,
  History,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
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
      { id: "pos", label: "PDV (Venda Rápida)", tab: "pos", icon: Receipt },
      { id: "orders", label: "Painel de Pedidos", tab: "live-orders", icon: Clock },
      { id: "kds", label: "Monitor de Cozinha", tab: "kds", icon: Utensils },
      { id: "tables", label: "Mesas e QR Code", tab: "tables", icon: ClipboardList },
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
      { id: "loyalty", label: "Fidelidade & CRM", tab: "loyalty", icon: Heart },
      { id: "whatsapp", label: "WhatsApp", tab: "whatsapp", icon: MessageSquare },
      { id: "profile", label: "Configurações", tab: "profile", icon: Settings },
      { id: "staff", label: "Equipe", tab: "staff", icon: ClipboardList },
    ],
  },
];
