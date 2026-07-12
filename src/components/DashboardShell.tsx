import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { type LucideIcon, LogOut, Menu, Monitor, Utensils, X, ShieldCheck, ChefHat, ExternalLink, PanelLeftClose, PanelLeftOpen, Settings2, AlertTriangle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import DashboardAccountMenu from "./DashboardAccountMenu";

const SIDEBAR_COLLAPSED_KEY = "boxsys_sidebar_collapsed";

interface DashboardNavigationItem {
  id: string;
  label: string;
  tab: string;
  icon: LucideIcon;
}

interface DashboardNavigationGroup {
  id: string;
  label: string;
  items: DashboardNavigationItem[];
}

interface DashboardShellProps {
  tenantName?: string;
  tenantLogoUrl?: string | null;
  slug: string;
  activeTab: string;
  navigationGroups: DashboardNavigationGroup[];
  /** Contagem de alertas por tab (ex: { inventory: 3 }) — mostra um triângulo de aviso com o número ao lado do item. */
  navigationAlerts?: Partial<Record<string, number>>;
  headerBadges?: ReactNode;
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onSelectTab: (tab: string) => void;
  onLogout?: () => void;
  isSuperAdmin?: boolean;
  /** Esconde a topbar de breadcrumb/notificações/avatar — usado em telas que precisam do espaço vertical inteiro (ex: PDV). */
  hideHeader?: boolean;
  children: ReactNode;
}

function findActiveItem(groups: DashboardNavigationGroup[], activeTab: string) {
  for (const g of groups) {
    const item = g.items.find((i) => i.tab === activeTab);
    if (item) return { item, group: g };
  }
  return null;
}

export default function DashboardShell({
  tenantName,
  tenantLogoUrl,
  slug,
  activeTab,
  navigationGroups,
  navigationAlerts,
  headerBadges,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onSelectTab,
  onLogout,
  isSuperAdmin = false,
  hideHeader = false,
  children,
}: DashboardShellProps) {
  const active        = findActiveItem(navigationGroups, activeTab);
  const ActiveIcon    = active?.item.icon;
  const logoSrc       = "/images/logo.png";
  const isLiveOrdersTab = activeTab === "live-orders";

  // Sidebar compacta (só ícones) — preferência persistida por navegador, independente do tenant.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try { return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"; } catch { return false; }
  });
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? "1" : "0"); } catch {}
  }, [isCollapsed]);

  return (
    <>
      <div className="bg-[#F4F6FA] flex flex-col xl:flex-row font-sans relative h-screen h-[100dvh] overflow-hidden">

      {/* ══ MOBILE TOPBAR ══ */}
      <div className="xl:hidden shrink-0 z-40 bg-[#0A1628] border-b border-white/[0.07]">
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
              <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <p className="text-[12px] font-black text-white leading-tight truncate max-w-[170px]">Box Sys</p>
          </div>

          {/* Ações mobile */}
          <div className="flex items-center gap-1 shrink-0">
            <Link
              to={`/${slug}`}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-[#C9A227] hover:bg-white/10 transition-colors"
            >
              <Utensils className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setIsAccountMenuOpen(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMobileMenu}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Breadcrumb da aba ativa — mobile */}
        {active && (
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <div className="flex items-center gap-1.5 bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-lg px-2.5 py-1">
              {ActiveIcon && <ActiveIcon className="w-3 h-3 text-[#C9A227]" />}
              <span className="text-[11px] font-black uppercase tracking-wider text-[#C9A227]">
                {active.item.label}
              </span>
            </div>
          </div>
        )}

        {headerBadges && (
          <div className="px-4 pb-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {headerBadges}
            </div>
          </div>
        )}
      </div>

      {/* ══ SIDEBAR ══ */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] bg-[#0A1628] text-slate-300 flex flex-col",
        "transition-[transform,width] duration-300 ease-in-out",
        "xl:max-w-none xl:translate-x-0 xl:sticky xl:top-0 xl:h-screen shrink-0",
        isCollapsed ? "xl:w-20" : "xl:w-64",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo header */}
        <div className={cn("pt-5 pb-4 flex items-center border-b border-white/[0.07]", isCollapsed ? "px-3 justify-center" : "px-5 justify-between")}>
          <div className={cn("flex items-center gap-3 min-w-0", isCollapsed && "justify-center")}>
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5">
              <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && <p className="text-[13px] font-black text-white/90 leading-none truncate">Box Sys</p>}
          </div>
          {!isCollapsed && (
            <button onClick={onCloseMobileMenu} className="xl:hidden w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle — só desktop */}
        <button
          onClick={() => setIsCollapsed((v) => !v)}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "hidden xl:flex items-center gap-3 px-3 py-2.5 mx-2.5 mt-2 rounded-xl text-slate-500 hover:bg-white/[0.06] hover:text-white transition-all",
            isCollapsed && "justify-center"
          )}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4 shrink-0" /> : <PanelLeftClose className="w-4 h-4 shrink-0" />}
          {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Recolher</span>}
        </button>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navigationGroups.map((group) => (
            <div key={group.id}>
              {!isCollapsed && (
                <p className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-white/20">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  const alertCount = navigationAlerts?.[item.tab] || 0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.tab)}
                      title={isCollapsed ? (alertCount > 0 ? `${item.label} — ${alertCount} alerta(s)` : item.label) : undefined}
                      className={cn(
                        "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                        isCollapsed && "justify-center",
                        isActive
                          ? "bg-[#C9A227] text-white shadow-lg shadow-[#C9A227]/20"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      <item.icon className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-[#C9A227]"
                      )} />
                      {!isCollapsed && (
                        <span className="text-[12px] font-semibold tracking-wide leading-none flex-1">
                          {item.label}
                        </span>
                      )}
                      {alertCount > 0 && (
                        isCollapsed ? (
                          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[15px] h-[15px] px-0.5 rounded-full bg-amber-400 text-[#0A1628] text-[9px] font-black leading-none shadow">
                            {alertCount > 9 ? "9+" : alertCount}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 shrink-0 bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded-md">
                            <AlertTriangle className="w-3 h-3" />
                            <span className="text-[10px] font-black leading-none">{alertCount > 99 ? "99+" : alertCount}</span>
                          </span>
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Painéis externos — abrem em nova aba, fora do fluxo de abas do dashboard */}
          <div>
            {!isCollapsed && (
              <p className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-white/20">
                Painéis
              </p>
            )}
            <div className="space-y-0.5">
              <a
                href={`/${slug}/display`}
                target="_blank"
                rel="noopener noreferrer"
                title={isCollapsed ? "Painel TV" : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group text-slate-400 hover:bg-white/[0.06] hover:text-white",
                  isCollapsed && "justify-center"
                )}
              >
                <Monitor className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-[#C9A227] transition-colors" />
                {!isCollapsed && (
                  <>
                    <span className="text-[12px] font-semibold tracking-wide leading-none flex-1">Painel TV</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-white/20 group-hover:text-white/40" />
                  </>
                )}
              </a>
              <a
                href={`/cozinha/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title={isCollapsed ? "Painel Cozinha" : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group text-slate-400 hover:bg-white/[0.06] hover:text-white",
                  isCollapsed && "justify-center"
                )}
              >
                <ChefHat className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-[#C9A227] transition-colors" />
                {!isCollapsed && (
                  <>
                    <span className="text-[12px] font-semibold tracking-wide leading-none flex-1">Painel Cozinha</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-white/20 group-hover:text-white/40" />
                  </>
                )}
              </a>
            </div>
          </div>
        </nav>

        {/* Footer links */}
        <div className="p-2.5 border-t border-white/[0.07] space-y-0.5">
          <Link
            to={`/${slug}`}
            title={isCollapsed ? "Ver Cardápio" : undefined}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] group transition-all",
              isCollapsed && "justify-center"
            )}
          >
            <Utensils className="w-4 h-4 shrink-0 group-hover:text-[#C9A227] transition-colors" />
            {!isCollapsed && <span className="text-[12px] font-semibold tracking-wide">Ver Cardápio</span>}
          </Link>
          {isSuperAdmin && (
            <Link
              to="/superadmin"
              title={isCollapsed ? "Super Admin" : undefined}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-amber-400/60 hover:text-amber-400 rounded-xl hover:bg-amber-400/10 transition-all",
                isCollapsed && "justify-center"
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="text-[12px] font-semibold tracking-wide">Super Admin</span>}
            </Link>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              title={isCollapsed ? "Sair" : undefined}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 text-slate-500 hover:text-red-400 rounded-xl hover:bg-white/[0.06] transition-all group",
                isCollapsed && "justify-center"
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="text-[12px] font-semibold tracking-wide">Sair</span>}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 xl:hidden"
            onClick={onCloseMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* ══ CONTEÚDO PRINCIPAL ══ */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* ══ DESKTOP TOPBAR ══ */}
          {!hideHeader && (
        <header className={cn(
          "hidden xl:flex items-center justify-between gap-4 bg-white border-b border-slate-200/80 z-30 h-16 shrink-0",
          isLiveOrdersTab ? "px-4 lg:px-5" : "px-6 lg:px-8"
        )}>

          {/* Esquerda — breadcrumb da aba ativa */}
          <div className="flex items-center gap-3 min-w-0">
            {active ? (
              <>
                <div className="w-9 h-9 rounded-xl bg-[#0A1628] flex items-center justify-center shrink-0">
                  {ActiveIcon && <ActiveIcon className="w-4 h-4 text-[#C9A227]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 leading-none mb-0.5">
                    {active.group.label}
                  </p>
                  <h2 className="text-[15px] font-black text-[#0A1628] leading-none truncate">
                    {active.item.label}
                  </h2>
                </div>
              </>
            ) : (
              <h2 className="text-[15px] font-black text-[#0A1628]">Painel Operacional</h2>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            {headerBadges && (
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max items-center justify-end gap-2 pr-1">
                  {headerBadges}
                </div>
              </div>
            )}

            {/* Direita — ações */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsAccountMenuOpen(true)}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-[#0A1628] transition-all"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
        )}

          <div
            className={cn(
              "flex-1 min-h-0 overflow-y-auto custom-scrollbar",
              hideHeader
                ? "flex flex-col p-2 sm:p-3"
                : (isLiveOrdersTab
                    ? "px-2 py-2 sm:px-3 sm:py-3 lg:px-4 lg:py-4"
                    : "px-3 py-3 sm:p-5 md:p-7")
            )}
          >
            {children}
          </div>
        </main>
      </div>
      <DashboardAccountMenu
        isOpen={isAccountMenuOpen}
        onClose={() => setIsAccountMenuOpen(false)}
        tenantName={tenantName || "Box Sys"}
        tenantLogoUrl={tenantLogoUrl}
        slug={slug}
        onSelectTab={onSelectTab}
      />
    </>
  );
}
