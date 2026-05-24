import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { type LucideIcon, LogOut, Menu, Monitor, Utensils, X, ShieldCheck, Bell } from "lucide-react";
import { cn } from "@/src/lib/utils";

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
  slug: string;
  activeTab: string;
  navigationGroups: DashboardNavigationGroup[];
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
  onSelectTab: (tab: string) => void;
  onLogout?: () => void;
  isSuperAdmin?: boolean;
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
  slug,
  activeTab,
  navigationGroups,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onSelectTab,
  onLogout,
  isSuperAdmin = false,
  children,
}: DashboardShellProps) {
  const tenantInitial = tenantName?.[0]?.toUpperCase() || "G";
  const tenantLabel   = tenantName || "Box Sys";
  const active        = findActiveItem(navigationGroups, activeTab);
  const ActiveIcon    = active?.item.icon;

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col md:flex-row font-sans relative">

      {/* ══ MOBILE TOPBAR ══ */}
      <div className="md:hidden sticky top-0 z-40 bg-[#0A1628] border-b border-white/[0.07]">
        <div className="flex items-center justify-between gap-3 px-4 h-14">
          {/* Logo + nome */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0 p-1">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A227]/70 leading-none">Box Sys</p>
              <p className="text-[12px] font-black text-white leading-tight truncate max-w-[130px]">{tenantLabel}</p>
            </div>
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
      </div>

      {/* ══ SIDEBAR ══ */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] bg-[#0A1628] text-slate-300 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        "md:w-64 md:max-w-none md:translate-x-0 md:sticky md:top-0 md:h-screen shrink-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo header */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/[0.07]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5">
              <img src="/images/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#C9A227]/60 leading-none mb-0.5">Box Sys</p>
              <p className="text-[13px] font-black text-white/90 leading-none truncate">{tenantLabel}</p>
            </div>
          </div>
          <button onClick={onCloseMobileMenu} className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto">
          {navigationGroups.map((group) => (
            <div key={group.id}>
              <p className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-white/20">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectTab(item.tab)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                        isActive
                          ? "bg-[#C9A227] text-white shadow-lg shadow-[#C9A227]/20"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
                      )}
                    >
                      <item.icon className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-slate-500 group-hover:text-[#C9A227]"
                      )} />
                      <span className="text-[12px] font-semibold tracking-wide leading-none">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer links */}
        <div className="p-2.5 border-t border-white/[0.07] space-y-0.5">
          <Link
            to={`/${slug}`}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] group transition-all"
          >
            <Utensils className="w-4 h-4 shrink-0 group-hover:text-[#C9A227] transition-colors" />
            <span className="text-[12px] font-semibold tracking-wide">Ver Cardápio</span>
          </Link>
          {isSuperAdmin && (
            <Link
              to="/superadmin"
              className="flex items-center gap-3 w-full px-3 py-2.5 text-amber-400/60 hover:text-amber-400 rounded-xl hover:bg-amber-400/10 transition-all"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span className="text-[12px] font-semibold tracking-wide">Super Admin</span>
            </Link>
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={onCloseMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* ══ CONTEÚDO PRINCIPAL ══ */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

        {/* ══ DESKTOP TOPBAR ══ */}
        <header className="hidden md:flex items-center justify-between gap-4 bg-white border-b border-slate-200/80 sticky top-0 z-30 px-6 lg:px-8 h-16 shrink-0">

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

            {/* Badge tenant */}
            <div className="hidden sm:flex items-center gap-1.5 bg-[#0A1628]/5 border border-[#0A1628]/10 rounded-lg px-2.5 py-1.5 ml-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
              <span className="text-[11px] font-black text-[#0A1628]/60 uppercase tracking-wider">{tenantLabel}</span>
            </div>
          </div>

          {/* Direita — ações */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Painel TV */}
            <Link
              to={`/${slug}/display`}
              target="_blank"
              className="hidden lg:flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all group"
            >
              <Monitor className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0A1628] transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-[#0A1628]">
                Painel TV
              </span>
            </Link>

            {/* Ver Cardápio */}
            <Link
              to={`/${slug}`}
              className="hidden lg:flex items-center gap-2 h-9 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-all group"
            >
              <Utensils className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0A1628] transition-colors" />
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-[#0A1628]">
                Ver Cardápio
              </span>
            </Link>

            {/* Divider */}
            <div className="hidden lg:block w-px h-6 bg-slate-200" />

            {/* Notificações placeholder */}
            <button className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-[#0A1628] transition-all">
              <Bell className="w-4 h-4" />
            </button>

            {/* Avatar */}
            <div className="flex items-center gap-2.5 bg-[#0A1628] rounded-xl px-3 py-1.5">
              <div className="w-6 h-6 rounded-lg bg-[#C9A227] flex items-center justify-center font-black text-white text-[11px]">
                {tenantInitial}
              </div>
              <span className="text-[12px] font-bold text-white/80 hidden xl:block max-w-[100px] truncate">
                {tenantLabel}
              </span>
            </div>
          </div>
        </header>

        <div className="px-3 py-3 sm:p-5 md:p-7 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
