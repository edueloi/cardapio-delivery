import type { LucideIcon, LayoutDashboard, Receipt, Clock, ClipboardList, History, Utensils, Package, BarChart3, MessageSquare, UserCog, Users, Settings } from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "live-orders"
  | "history"
  | "menu"
  | "inventory"
  | "finance"
  | "whatsapp"
  | "profile"
  | "staff"
  | "tables"
  | "pos"
  | "loyalty"
  | "kds"
  | "customers"
  | "reports"
  | "downloads"
  | "promotions";

export type DashboardOrderTabId = "pending" | "preparing" | "shipped";

export const TAB_TO_PATH: Record<DashboardTabId, string> = {
  "overview": "visao-geral",
  "live-orders": "pedidos",
  "history": "historico",
  "menu": "cardapio",
  "inventory": "estoque",
  "finance": "financeiro",
  "whatsapp": "whatsapp",
  "profile": "configuracoes",
  "staff": "equipe",
  "tables": "mesas",
  "pos": "pdv",
  "loyalty": "fidelidade",
  "kds": "cozinha",
  "customers": "clientes",
  "reports": "relatorios",
  "downloads": "downloads",
  "promotions": "promocoes",
};

export const PATH_TO_TAB: Record<string, DashboardTabId> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab as DashboardTabId])
);

export interface DashboardNavigationItem {
  id: string;
  label: string;
  tab: DashboardTabId;
  icon: LucideIcon;
}

export interface DashboardNavigationGroup {
  id: string;
  label: string;
  items: DashboardNavigationItem[];
}
