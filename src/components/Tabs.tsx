import React, { createContext, useContext, useId, useState, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Tabs — Design System
//
// Dois modos, mesmo visual (abas sublinhadas, texto-xs, azul no ativo):
//  1. Controlado por itens (padrão MFC, preferido):
//       <Tabs items={tabs} value={tab} onChange={setTab} label="Estoque">...</Tabs>
//  2. Composto (legado): <Tabs defaultTab="a"><TabList><Tab id="a"/></TabList><TabPanel id="a"/></Tabs>
// ─────────────────────────────────────────────────────────────────────────────

interface TabItem<T extends string> { id: T; label: string; icon?: React.ElementType; badge?: string | number; disabled?: boolean;
  /** Vira data-tour no botão da aba (usado pelos tours de onboarding). */
  dataTour?: string; }

interface ItemsTabsProps<T extends string> {
  items: readonly TabItem<T>[];
  value: T;
  // Sintaxe de método: parâmetro bivariante, aceita setState de união de strings sem genérico explícito.
  onChange(value: T): void;
  label: string;
  children: ReactNode;
  className?: string;
}

interface CompoundTabsProps {
  defaultTab: string;
  children: ReactNode;
  onChange?: (id: string) => void;
  className?: string;
}

const tabButton = "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40";
const tabActive = "border-blue-600 text-blue-700";
const tabIdle = "border-transparent text-slate-500 hover:text-slate-800";
const tabListClass = "flex max-w-full gap-1 overflow-x-auto overscroll-x-contain border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function TabBadge({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none", active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>{children}</span>;
}

function ItemsTabs<T extends string>({ items, value, onChange, label, children, className }: ItemsTabsProps<T>) {
  const id = useId();
  const selectByKey = (event: React.KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    onChange(items[next].id);
    document.getElementById(`${id}-${items[next].id}`)?.focus();
  };
  return (
    <div className={cn("min-w-0 space-y-3", className)}>
      <div role="tablist" aria-label={label} className={tabListClass}>
        {items.map((tab, index) => (
          <button key={tab.id} id={`${id}-${tab.id}`} data-tour={tab.dataTour} role="tab" type="button" disabled={tab.disabled}
            aria-selected={value === tab.id} aria-controls={`${id}-panel`} tabIndex={value === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)} onKeyDown={event => selectByKey(event, index)}
            className={cn(tabButton, value === tab.id ? tabActive : tabIdle)}>
            {tab.icon && <tab.icon size={14} />}{tab.label}
            {tab.badge !== undefined && <TabBadge active={value === tab.id}>{tab.badge}</TabBadge>}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} tabIndex={0} className="min-w-0 focus-visible:outline-blue-500">{children}</div>
    </div>
  );
}

// ── Modo composto (legado) ─────────────────────────────────────────────────

const TabsContext = createContext<{ active: string; setActive: (id: string) => void }>({ active: "", setActive: () => {} });

function CompoundTabs({ defaultTab, children, onChange, className }: CompoundTabsProps) {
  const [active, setActiveState] = useState(defaultTab);
  const setActive = (id: string) => { setActiveState(id); onChange?.(id); };
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={cn("min-w-0 space-y-3", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function Tabs<T extends string>(props: ItemsTabsProps<T>): React.ReactElement;
export function Tabs(props: CompoundTabsProps): React.ReactElement;
export function Tabs(props: ItemsTabsProps<string> | CompoundTabsProps) {
  return "items" in props ? <ItemsTabs {...props} /> : <CompoundTabs {...props} />;
}

export function TabList({ children, className }: { children: ReactNode; className?: string; /** Mantido por compatibilidade. */ variant?: "pill" | "underline" }) {
  return <div role="tablist" className={cn(tabListClass, className)}>{children}</div>;
}

interface TabProps { id: string; children: ReactNode; icon?: ReactNode; badge?: string | number; disabled?: boolean; }

export function Tab({ id, children, icon, badge, disabled = false }: TabProps) {
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === id;
  return (
    <button type="button" role="tab" aria-selected={isActive} disabled={disabled} onClick={() => !disabled && setActive(id)}
      className={cn(tabButton, isActive ? tabActive : tabIdle)}>
      {icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      {children}
      {badge !== undefined && <TabBadge active={isActive}>{badge}</TabBadge>}
    </button>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  const { active } = useContext(TabsContext);
  if (active !== id) return null;
  return <div role="tabpanel">{children}</div>;
}

export default Tabs;
