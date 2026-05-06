import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { type LucideIcon, LogOut, Menu, Monitor, Utensils, X } from "lucide-react";
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
  children: ReactNode;
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
  children,
}: DashboardShellProps) {
  const tenantInitial = tenantName?.[0] || "G";
  const tenantLabel = tenantName || "Cardápio Develoi";

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans relative">
      {/* Mobile topbar */}
      <div className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-[#0D1B3E] text-white sticky top-0 z-40">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-9 h-9 bg-[#C9A227] rounded-xl flex items-center justify-center font-bold text-white uppercase text-sm shrink-0">
            {tenantInitial}
          </div>
          <div className="font-black tracking-tight text-sm uppercase truncate">Painel</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Link
            to={`/${slug}`}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#C9A227]/60 hover:text-[#C9A227] hover:bg-white/10 transition-colors"
            aria-label="Ver cardápio"
          >
            <Utensils className="w-4 h-4" />
          </Link>
          <button
            onClick={onToggleMobileMenu}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] bg-[#0D1B3E] text-slate-300 flex flex-col transition-transform duration-300 ease-in-out md:w-72 md:max-w-none md:translate-x-0 md:sticky md:top-0 md:h-screen shrink-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo / tenant header */}
        <div className="p-5 md:p-6 flex items-center justify-between border-b border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-9 h-9 bg-[#C9A227] rounded-xl flex items-center justify-center font-bold text-white uppercase shrink-0">
              {tenantInitial}
            </div>
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#C9A227]/70 leading-none mb-0.5">
                Cardápio Develoi
              </span>
              <span className="block text-sm font-bold text-white tracking-tight leading-none truncate">
                {tenantLabel}
              </span>
            </div>
          </div>
          <button onClick={onCloseMobileMenu} className="md:hidden text-slate-500 hover:text-white shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-5 md:py-6 px-4 space-y-6 overflow-y-auto custom-scrollbar">
          {navigationGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="px-3 text-[9px] font-black uppercase tracking-[0.25em] text-white/20">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.tab)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-bold transition-all cursor-pointer group ${
                      activeTab === item.tab
                        ? "bg-[#C9A227] text-white shadow-lg shadow-[#C9A227]/20"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110",
                      activeTab === item.tab ? "text-white" : "text-slate-500 group-hover:text-[#C9A227]"
                    )} />
                    <span className="text-[11px] text-left uppercase tracking-wider">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Ver cardápio + logout */}
        <div className="p-4 border-t border-white/10 space-y-1">
          <Link
            to={`/${slug}`}
            className="flex items-center gap-3 w-full p-2.5 text-slate-400 hover:text-[#C9A227] transition-colors rounded-xl hover:bg-white/10"
          >
            <Utensils className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest">Ver Cardápio</span>
          </Link>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-3 w-full p-2.5 text-slate-400 hover:text-red-400 transition-colors rounded-xl hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">Sair</span>
            </button>
          )}
        </div>

        {/* Status footer */}
        <div className="p-5 md:p-6 bg-black/20">
          <div className="flex items-center gap-2 text-[10px] text-green-400/80 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Server Online
          </div>
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

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="hidden md:block bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 md:px-8 py-2.5 md:py-4">
            <div className="flex items-center justify-between gap-6 min-h-[48px]">
              <div className="flex items-center gap-4 min-w-0">
                <h2 className="text-xl font-bold text-[#0D1B3E]">Painel Operacional</h2>
                <span className="bg-[#fdf8e8] text-[#A8841C] text-[10px] px-2 py-1 rounded font-bold uppercase border border-[#C9A227]/30 tracking-wide">
                  {tenantName || "Unidade"}
                </span>
              </div>

              <div className="flex items-center gap-6">
                <Link
                  to={`/${slug}/display`}
                  target="_blank"
                  className="text-slate-400 hover:text-[#C9A227] transition-colors flex items-center gap-2 group"
                >
                  <span className="text-xs font-bold uppercase tracking-widest group-hover:underline">
                    Painel TV
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                    <Monitor className="w-4 h-4" />
                  </div>
                </Link>
                <Link
                  to={`/${slug}`}
                  className="text-slate-400 hover:text-[#C9A227] transition-colors flex items-center gap-2 group"
                >
                  <span className="text-xs font-bold uppercase tracking-widest group-hover:underline">
                    Ver Cardápio
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                    <Utensils className="w-4 h-4" />
                  </div>
                </Link>
                <div className="hidden xl:flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-slate-600">Bot Atendimento: Ativo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-[#C9A227] rounded-full flex items-center justify-center font-bold text-white text-sm">
                    {tenantInitial}
                  </div>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      title="Sair"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors border border-slate-200"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="px-2 py-2 sm:p-5 md:p-8 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
