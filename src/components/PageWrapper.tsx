import React from "react";
import { cn } from "@/src/lib/utils";
import { uiTheme } from './theme';

// ─────────────────────────────────────────────────────────────────────────────
// PageWrapper — Design System
//
// Wrapper responsivo padrão para páginas do admin.
// Ajustado para ocupar melhor a largura em layouts com sidebar,
// evitando "sobras" laterais e excesso de respiro vertical.
// ─────────────────────────────────────────────────────────────────────────────

interface PageWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Adiciona padding-bottom extra para não sobrepor o bottom-nav no mobile */
  mobileBottomPad?: boolean;
}

// Dentro de outro PageWrapper (ex.: o do shell do admin) o espaçamento não duplica.
const PageWrapperContext = React.createContext(false);

export function PageWrapper({
  children,
  className,
  mobileBottomPad = true,
  ...props
}: PageWrapperProps) {
  const nested = React.useContext(PageWrapperContext);
  if (nested) {
    return <div className={cn("w-full max-w-none min-w-0", className)} {...props}>{children}</div>;
  }
  return (
    <PageWrapperContext.Provider value={true}>
    <div
      className={cn(
        // Ocupa toda a largura útil do painel
        "w-full max-w-none min-w-0",
        // Padding horizontal mais equilibrado para admin
        // Sem padding horizontal no mobile para "cara de app", recupera respiro no desktop
        "px-0 sm:px-4 lg:px-5 xl:px-6",
        // Padding vertical menor para reduzir o "vazio" no topo
        "pt-3 sm:pt-4",
        // Bottom spacing
        mobileBottomPad ? "pb-24 sm:pb-5" : "pb-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
    </PageWrapperContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionTitle — Cabeçalho de seção/página
// ─────────────────────────────────────────────────────────────────────────────

interface SectionTitleProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
  /** Separador inferior */
  divider?: boolean;
}

export function SectionTitle({
  title,
  description,
  icon: Icon,
  action,
  className,
  divider = false,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        divider && "mb-4 border-b border-zinc-100 pb-4 sm:mb-5 sm:pb-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            <Icon size={15} className="text-blue-600" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-medium text-slate-900 sm:text-lg">
            {title}
          </h1>

          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {action}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatGrid — Grid responsivo para cards de estatística
// ─────────────────────────────────────────────────────────────────────────────

interface StatGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}

export function StatGrid({
  children,
  cols = 4,
  className,
  ...props
}: StatGridProps) {
  const colsMap: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-2 sm:gap-3", colsMap[cols], className)} {...props}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContentCard — Card de conteúdo simples
// ─────────────────────────────────────────────────────────────────────────────

interface ContentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
}

export function ContentCard({
  children,
  title,
  padding = "md",
  className,
  ...props
}: ContentCardProps) {
  const paddingMap = {
    none: "",
    sm: "p-3",
    md: "p-3",
    lg: "p-4",
  };

  return (
    <div
      className={cn(
        uiTheme.surface,
        paddingMap[padding],
        className
      )}
      {...props}
    >
      {title && <h3 className="mb-3 text-[13px] font-medium text-slate-800">{title}</h3>}
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FormRow — Row de formulário com label + campo, responsivo
// ─────────────────────────────────────────────────────────────────────────────

interface FormRowProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}

export function FormRow({ children, cols = 2, className }: FormRowProps) {
  const colsMap = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  };

  return <div className={cn("grid gap-3", colsMap[cols], className)}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider — Separador horizontal
// ─────────────────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn("border-t border-zinc-100", className)} />;
}
