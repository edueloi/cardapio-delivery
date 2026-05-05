import type { LucideIcon } from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "live-orders"
  | "history"
  | "menu"
  | "inventory"
  | "finance"
  | "whatsapp"
  | "profile"
  | "staff";

export type DashboardOrderTabId = "pending" | "preparing" | "shipped";

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
