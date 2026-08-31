import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { type LucideIcon, LogOut, Menu, Monitor, Utensils, X, ShieldCheck, ChefHat, ExternalLink, PanelLeftClose, PanelLeftOpen, PanelTopClose, Settings2, AlertTriangle, ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/src/lib/utils";
import DashboardAccountMenu from "./DashboardAccountMenu";

const SIDEBAR_COLLAPSED_KEY = "boxsys_sidebar_collapsed";
const LAYOUT_MODE_KEY = "boxsys_layout_mode";
type LayoutMode = "sidebar" | "topbar";

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
  /** Contagem de pedidos por status, só pro item "live-orders" — 3 bolinhas coloridas (pendente/preparo/pronto). */
  navigationOrderCounts?: { pending: number; preparing: number; ready: number };
  headerBadges?: ReactNode;
  /** Nome do usuário logado, mostrado como indicador fixo no topo — pra saber quem está operando o painel. */
  accountName?: string | null;
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
  navigationOrderCounts,
  headerBadges,
  accountName,
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

  // Layout do menu — lateral (padrão) ou no topo, tipo barra de menu de app desktop.
  // Preferência persistida por navegador, mesma lógica do isCollapsed acima.
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    try { return (window.localStorage.getItem(LAYOUT_MODE_KEY) as LayoutMode) || "sidebar"; } catch { return "sidebar"; }
  });
  const isTopbarLayout = layoutMode === "topbar";
  const [openTopGroupId, setOpenTopGroupId] = useState<string | null>(null);
  // Posição do dropdown aberto (calculada a partir do botão clicado) — o dropdown é
  // renderizado via portal direto no <body>, fora da barra de navegação, porque essa
  // barra tem overflow-x-auto (pra rolar quando há muitas categorias) e um dropdown
  // "position: absolute" dentro dela fica recortado pela altura do header em vez de
  // flutuar por cima do conteúdo da página.
  const [topGroupMenuPos, setTopGroupMenuPos] = useState<{ left: number; top: number } | null>(null);
  const topGroupButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // "Esconder menu do sistema" — controlada de fora (menu nativo do app desktop Electron,
  // ver Exibir → Esconder menu do sistema em pdv-desktop/src/main.js), não por um botão
  // daqui. Some com a sidebar/barra de categorias inteira quando ativa. Fora do Electron
  // isso nunca é ligado (não existe UI no site pra ativar sozinho), então o padrão "false"
  // é seguro.
  const [hideSystemNav, setHideSystemNav] = useState(() => {
    try { return window.localStorage.getItem("boxsys_hide_system_nav") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => setHideSystemNav(!!(e as CustomEvent).detail);
    window.addEventListener("boxsys:hide-system-nav-changed", handler);
    return () => window.removeEventListener("boxsys:hide-system-nav-changed", handler);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? "1" : "0"); } catch {}
  }, [isCollapsed]);

  useEffect(() => {
    try { window.localStorage.setItem(LAYOUT_MODE_KEY, layoutMode); } catch {}
  }, [layoutMode]);

  // Fecha o dropdown de categoria aberto ao clicar fora dele.
  useEffect(() => {
    if (!openTopGroupId) return;
    const handler = () => setOpenTopGroupId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [openTopGroupId]);

  return (
    <>
      <div className="bg-[#F4F6FA] flex flex-col 2xl:flex-row font-sans relative h-screen h-[100dvh] overflow-hidden">

      {/* ══ MOBILE TOPBAR ══ */}
      <div className="2xl:hidden shrink-0 z-40 bg-[#0A1628] border-b border-white/[0.07]">
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
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-[#C9A227] hover:bg-white/10 transition-colors"
            >
              <Utensils className="w-4 h-4" />
            </a>
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

      {/* ══ SIDEBAR ══ — só no modo lateral; no modo topo (isTopbarLayout) a navegação
          inteira vira a barra de categorias dentro do header, mais abaixo. No mobile,
          o menu sempre usa a sidebar deslizante independente da preferência de desktop.
          hideSystemNav (app desktop) esconde a sidebar completamente, mesmo no mobile —
          quem ligou essa opção já tem o menu nativo do Windows cobrindo a navegação. */}
      {!hideSystemNav && (!isTopbarLayout || isMobileMenuOpen) && (
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[82vw] max-w-[300px] bg-[#0A1628] text-slate-300 flex flex-col",
        "transition-[transform,width] duration-300 ease-in-out",
        isTopbarLayout ? "2xl:hidden" : "2xl:max-w-none 2xl:translate-x-0 2xl:sticky 2xl:top-0 2xl:h-screen shrink-0",
        isCollapsed && !isTopbarLayout ? "2xl:w-20" : "2xl:w-64",
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
            <button onClick={onCloseMobileMenu} className="2xl:hidden w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle — só desktop */}
        <button
          onClick={() => setIsCollapsed((v) => !v)}
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "hidden 2xl:flex items-center gap-3 px-3 py-2.5 mx-2.5 mt-2 rounded-xl text-slate-500 hover:bg-white/[0.06] hover:text-white transition-all",
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
                  const orderCounts = item.tab === "live-orders" ? navigationOrderCounts : undefined;
                  const hasOrderDots = orderCounts && (orderCounts.pending > 0 || orderCounts.preparing > 0 || orderCounts.ready > 0);
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
                      {hasOrderDots && !isCollapsed && (
                        <span className="flex items-center gap-1 shrink-0">
                          {orderCounts!.pending > 0 && (
                            <span title={`${orderCounts!.pending} pendente(s)`} className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-[#0A1628] text-[9px] font-black leading-none">
                              {orderCounts!.pending > 9 ? "9+" : orderCounts!.pending}
                            </span>
                          )}
                          {orderCounts!.preparing > 0 && (
                            <span title={`${orderCounts!.preparing} em preparo`} className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-orange-500 text-white text-[9px] font-black leading-none">
                              {orderCounts!.preparing > 9 ? "9+" : orderCounts!.preparing}
                            </span>
                          )}
                          {orderCounts!.ready > 0 && (
                            <span title={`${orderCounts!.ready} pronto(s)`} className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-emerald-500 text-white text-[9px] font-black leading-none">
                              {orderCounts!.ready > 9 ? "9+" : orderCounts!.ready}
                            </span>
                          )}
                        </span>
                      )}
                      {hasOrderDots && isCollapsed && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow" />
                      )}
                      {!hasOrderDots && alertCount > 0 && (
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
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            title={isCollapsed ? "Ver Cardápio" : undefined}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] group transition-all",
              isCollapsed && "justify-center"
            )}
          >
            <Utensils className="w-4 h-4 shrink-0 group-hover:text-[#C9A227] transition-colors" />
            {!isCollapsed && <span className="text-[12px] font-semibold tracking-wide">Ver Cardápio</span>}
          </a>
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
      )}

      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 2xl:hidden"
            onClick={onCloseMobileMenu}
          />
        )}
      </AnimatePresence>

      {/* ══ CONTEÚDO PRINCIPAL ══ */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* ══ FAIXA MÍNIMA DE NAVEGAÇÃO — modo topo + tela sem header (ex: PDV) ══
            No modo lateral, a sidebar continua visível mesmo com hideHeader, então
            sempre existe como sair da tela. No modo topo não existe sidebar — sem esta
            faixa, hideHeader prendia o operador na tela (ex: PDV) sem nenhum jeito de
            trocar de aba. Fica bem fina pra não roubar o espaço vertical que hideHeader
            existe pra garantir. */}
        {hideHeader && isTopbarLayout && (
          <div className="hidden 2xl:flex items-center gap-2 h-8 px-3 bg-[#0A1628] shrink-0 overflow-x-auto">
            <div className="w-5 h-5 rounded bg-white flex items-center justify-center shrink-0 p-0.5">
              <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
            </div>
            {navigationGroups.map((group) => (
              <TopGroupDropdown
                key={group.id}
                buttonRef={(el) => { topGroupButtonRefs.current[group.id] = el; }}
                label={group.label}
                icon={group.items[0]?.icon}
                isOpen={openTopGroupId === group.id}
                isActive={group.items.some((i) => i.tab === activeTab)}
                menuPos={topGroupMenuPos}
                compact
                onToggle={() => {
                  const btn = topGroupButtonRefs.current[group.id];
                  if (btn) {
                    const rect = btn.getBoundingClientRect();
                    setTopGroupMenuPos({ left: rect.left, top: rect.bottom + 4 });
                  }
                  setOpenTopGroupId((v) => (v === group.id ? null : group.id));
                }}
              >
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onSelectTab(item.tab); setOpenTopGroupId(null); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                        isActive ? "bg-[#C9A227]/10 text-[#0A1628]" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <item.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-[#C9A227]" : "text-slate-400")} />
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </TopGroupDropdown>
            ))}
          </div>
        )}

        {/* ══ DESKTOP TOPBAR ══ */}
          {!hideHeader && (
        <header className={cn(
          "hidden 2xl:flex items-center justify-between gap-4 bg-white border-b border-slate-200/80 z-30 h-16 shrink-0",
          isLiveOrdersTab ? "px-4 lg:px-5" : "px-6 lg:px-8"
        )}>

          {/* Esquerda — no modo lateral, breadcrumb da aba ativa; no modo topo, o logo
              seguido das categorias com dropdown, tipo barra de menu de app desktop
              (Arquivo/Editar/Exibir), com ícone + rótulo de cada grupo. Os dropdowns
              são renderizados via portal (ver TopGroupDropdown mais abaixo) porque a
              barra tem overflow-x-auto e um "position: absolute" comum ficaria
              recortado pela altura do header em vez de flutuar por cima da página. */}
          {isTopbarLayout && !hideSystemNav ? (
            <nav className="flex items-center gap-3 h-full min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 p-1">
                <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center gap-1 h-full min-w-0 overflow-x-auto">
                {navigationGroups.map((group) => (
                  <TopGroupDropdown
                    key={group.id}
                    buttonRef={(el) => { topGroupButtonRefs.current[group.id] = el; }}
                    label={group.label}
                    icon={group.items[0]?.icon}
                    isOpen={openTopGroupId === group.id}
                    isActive={group.items.some((i) => i.tab === activeTab)}
                    menuPos={topGroupMenuPos}
                    onToggle={() => {
                      const btn = topGroupButtonRefs.current[group.id];
                      if (btn) {
                        const rect = btn.getBoundingClientRect();
                        setTopGroupMenuPos({ left: rect.left, top: rect.bottom + 4 });
                      }
                      setOpenTopGroupId((v) => (v === group.id ? null : group.id));
                    }}
                  >
                    {group.items.map((item) => {
                      const isActive = activeTab === item.tab;
                      const alertCount = navigationAlerts?.[item.tab] || 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { onSelectTab(item.tab); setOpenTopGroupId(null); }}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold transition-colors",
                            isActive ? "bg-[#C9A227]/10 text-[#0A1628]" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          <item.icon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-[#C9A227]" : "text-slate-400")} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {alertCount > 0 && (
                            <span className="shrink-0 min-w-[16px] h-[16px] px-1 rounded-full bg-amber-400 text-[#0A1628] text-[9px] font-black flex items-center justify-center">
                              {alertCount > 9 ? "9+" : alertCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </TopGroupDropdown>
                ))}

                {/* Categoria "Mais" — reúne o que no menu lateral fica fora dos grupos
                    principais: painéis externos (TV/Cozinha) e os atalhos do rodapé
                    (Ver Cardápio, Super Admin, Sair), pra nada do menu de hoje sumir. */}
                <TopGroupDropdown
                  buttonRef={(el) => { topGroupButtonRefs.current.__more__ = el; }}
                  label="Mais"
                  icon={MoreHorizontal}
                  isOpen={openTopGroupId === "__more__"}
                  isActive={false}
                  menuPos={topGroupMenuPos}
                  onToggle={() => {
                    const btn = topGroupButtonRefs.current.__more__;
                    if (btn) {
                      const rect = btn.getBoundingClientRect();
                      setTopGroupMenuPos({ left: rect.left, top: rect.bottom + 4 });
                    }
                    setOpenTopGroupId((v) => (v === "__more__" ? null : "__more__"));
                  }}
                >
                  <p className="px-3 pt-1 pb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-300">Painéis</p>
                  <a
                    href={`/${slug}/display`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Monitor className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1">Painel TV</span>
                    <ExternalLink className="w-3 h-3 text-slate-300" />
                  </a>
                  <a
                    href={`/cozinha/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ChefHat className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1">Painel Cozinha</span>
                    <ExternalLink className="w-3 h-3 text-slate-300" />
                  </a>
                  <div className="my-1 border-t border-slate-100" />
                  <a
                    href={`/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpenTopGroupId(null)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Utensils className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1">Ver Cardápio</span>
                    <ExternalLink className="w-3 h-3 text-slate-300" />
                  </a>
                  {isSuperAdmin && (
                    <Link
                      to="/superadmin"
                      onClick={() => setOpenTopGroupId(null)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      Super Admin
                    </Link>
                  )}
                  {onLogout && (
                    <button
                      onClick={() => { setOpenTopGroupId(null); onLogout(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] font-semibold text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      Sair
                    </button>
                  )}
                </TopGroupDropdown>
              </div>
            </nav>
          ) : (
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
          )}

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
              {accountName && (
                <button
                  onClick={() => setIsAccountMenuOpen(true)}
                  title="Usuário logado"
                  className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all"
                >
                  <span className="w-6 h-6 rounded-full bg-[#0A1628] text-[#C9A227] flex items-center justify-center text-[10px] font-black shrink-0">
                    {accountName.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[12px] font-bold text-[#0A1628] max-w-[140px] truncate">
                    {accountName}
                  </span>
                </button>
              )}
              <button
                onClick={() => setLayoutMode((v) => (v === "topbar" ? "sidebar" : "topbar"))}
                title={isTopbarLayout ? "Usar menu lateral" : "Usar menu no topo"}
                className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-[#0A1628] transition-all"
              >
                {isTopbarLayout ? <PanelLeftOpen className="w-4 h-4" /> : <PanelTopClose className="w-4 h-4" />}
              </button>
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
                    : "px-3 py-3 sm:p-4 lg:p-5 2xl:p-7")
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

// Cada categoria do menu de topo usa este wrapper pra abrir seu dropdown via portal
// direto no <body>, na posição calculada do botão (ver onToggle em DashboardShell) —
// precisa ser um componente de módulo (não aninhado dentro de DashboardShell), senão
// o React recria sua identidade a cada render do pai e remonta a árvore inteira à toa.
function TopGroupDropdown({
  buttonRef,
  label,
  icon: Icon,
  isOpen,
  isActive,
  onToggle,
  menuPos,
  compact = false,
  children,
}: {
  buttonRef: (el: HTMLButtonElement | null) => void;
  label: string;
  icon?: LucideIcon;
  isOpen: boolean;
  isActive: boolean;
  onToggle: () => void;
  menuPos: { left: number; top: number } | null;
  /** Versão mini pra faixa fina de navegação usada em telas com hideHeader (ex: PDV) —
      texto claro (fundo escuro) em vez do estilo padrão de fundo branco. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="h-full flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 rounded-lg font-bold transition-colors whitespace-nowrap",
          compact ? "px-2 h-6 text-[10px]" : "px-3 h-9 text-[12px]",
          compact
            ? (isActive || isOpen ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/10")
            : (isActive || isOpen ? "bg-[#0A1628] text-white" : "text-slate-500 hover:bg-slate-100")
        )}
      >
        {Icon && <Icon className={compact ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} />}
        {label}
        <ChevronDown className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3", "transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && menuPos && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{ position: "fixed", left: menuPos.left, top: menuPos.top }}
            className="w-56 bg-white rounded-xl shadow-2xl border border-slate-200/80 py-1.5 z-[100]"
          >
            {children}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
