import React from "react";
import { cn } from "@/src/lib/utils";

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

export function PageWrapper({
  children,
  className,
  mobileBottomPad = true,
  ...props
}: PageWrapperProps) {
  return (
    <div
      className={cn(
        // Ocupa toda a largura útil do painel
        "w-full max-w-none min-w-0",
        // Padding horizontal mais equilibrado para admin
        "px-4 sm:px-5 lg:px-6 xl:px-8",
        // Padding vertical menor para reduzir o "vazio" no topo
        "pt-3 sm:pt-4 lg:pt-5",
        // Bottom spacing
        mobileBottomPad ? "pb-24 sm:pb-5 lg:pb-6" : "pb-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50">
            <Icon size={18} className="text-amber-600" />
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-black tracking-tight text-zinc-900 sm:text-xl lg:text-2xl">
            {title}
          </h1>

          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      {action && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
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
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-3 sm:gap-4", colsMap[cols], className)} {...props}>
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
  padding = "md",
  className,
  ...props
}: ContentCardProps) {
  const paddingMap = {
    none: "",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6 lg:p-7",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white shadow-sm sm:rounded-3xl",
        paddingMap[padding],
        className
      )}
      {...props}
    >
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

  return <div className={cn("grid gap-4", colsMap[cols], className)}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider — Separador horizontal
// ─────────────────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn("border-t border-zinc-100", className)} />;
}