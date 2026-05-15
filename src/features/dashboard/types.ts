import type { LucideIcon, LayoutDashboard, Receipt, Clock, ClipboardList, History, Utensils, Package, BarChart3, MessageSquare, UserCog, Users, Settings } from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "live-orders"
  | "scheduled"
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
  "scheduled": "agendamentos",
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
  ownerOnly?: boolean; // hidden from STAFF/ADMIN regardless of permissions
}

export interface DashboardNavigationGroup {
  id: string;
  label: string;
  items: DashboardNavigationItem[];
}

// Membership returned from /api/auth/me or tenant endpoint
export interface MyMembership {
  id: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null; // null = all allowed (OWNER), array = explicit allowlist
}

// All tab ids that can be restricted by permissions
export const ALL_PERMISSION_TABS: DashboardTabId[] = [
  "overview", "pos", "live-orders", "scheduled", "kds", "tables",
  "history", "menu", "inventory", "finance", "reports",
  "customers", "loyalty", "promotions", "whatsapp",
  "profile", "staff", "downloads",
];

// Tabs always visible to OWNER, never to non-owners regardless of permissions
export const OWNER_ONLY_TABS: DashboardTabId[] = ["profile", "staff"];

// Helper: can this membership access a given tab?
export function canAccess(membership: MyMembership | null, tab: DashboardTabId): boolean {
  if (!membership || membership.role === "OWNER") return true;
  if (OWNER_ONLY_TABS.includes(tab)) return false;
  if (membership.permissions === null) return true;
  return membership.permissions.includes(tab);
}
