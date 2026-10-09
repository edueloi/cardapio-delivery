import React from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { uiTheme } from './theme';

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — Design System
//
// Responsivo:
//  • Mobile (2 colunas): valor grande, ícone menor, menos padding
//  • Tablet+ (4 colunas): versão completa com hover animado
//
// Variantes de cor de ícone: default (azul) | success | info | danger | purple | warning
// ─────────────────────────────────────────────────────────────────────────────

export type StatCardColor = "default" | "success" | "info" | "danger" | "purple" | "warning";

const colorMap: Record<StatCardColor, { wrap: string; icon: string; glow: string }> = {
  default: {
    wrap: "bg-blue-50 border-blue-100 group-hover:bg-blue-500 group-hover:border-blue-500",
    icon: "text-blue-600 group-hover:text-white",
    glow: "bg-blue-500/5",
  },
  success: {
    wrap: "bg-emerald-50 border-emerald-100 group-hover:bg-emerald-500 group-hover:border-emerald-500",
    icon: "text-emerald-600 group-hover:text-white",
    glow: "bg-emerald-500/5",
  },
  info: {
    wrap: "bg-blue-50 border-blue-100 group-hover:bg-blue-500 group-hover:border-blue-500",
    icon: "text-blue-600 group-hover:text-white",
    glow: "bg-blue-500/5",
  },
  danger: {
    wrap: "bg-red-50 border-red-100 group-hover:bg-red-500 group-hover:border-red-500",
    icon: "text-red-600 group-hover:text-white",
    glow: "bg-red-500/5",
  },
  purple: {
    wrap: "bg-violet-50 border-violet-100 group-hover:bg-violet-500 group-hover:border-violet-500",
    icon: "text-violet-600 group-hover:text-white",
    glow: "bg-violet-500/5",
  },
  warning: {
    wrap: "bg-yellow-50 border-yellow-100 group-hover:bg-yellow-500 group-hover:border-yellow-500",
    icon: "text-yellow-600 group-hover:text-white",
    glow: "bg-yellow-500/5",
  },
};

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isUp: boolean };
  description?: string;
  color?: StatCardColor;
  className?: string;
  isCurrency?: boolean;
  variant?: "default" | "flat";
  /** Animação com delay para entrada escalonada */
  delay?: number;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
  color = "default",
  className,
  isCurrency = false,
  variant = "default",
  delay = 0,
}: StatCardProps) {
  const c = colorMap[color];

  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
    : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2, ease: "easeOut" }}
      className={cn(
        "rounded-lg shadow-none relative overflow-hidden transition-all duration-200 group p-3",
        variant === "default" ? `${uiTheme.surface} hover:border-slate-300` : "bg-slate-50/50 border border-transparent hover:bg-slate-50",
        className
      )}
    >
      {/* Header: ícone + trend */}
      <div className="flex justify-between items-center mb-1.5 relative z-10">
        <div
          className={cn(
            "p-1.5 rounded-lg border transition-all duration-300",
            c.wrap
          )}
        >
          <Icon size={14} className={cn("transition-colors duration-300", c.icon)} />
        </div>

        {trend && (
          <div
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-medium",
              trend.isUp
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-red-50 text-red-500 border-red-200"
            )}
          >
            {trend.isUp
              ? <ArrowUpRight size={10} />
              : <ArrowDownRight size={10} />
            }
            {trend.value}%
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative z-10">
        <p className="text-[11px] font-medium text-slate-500 mb-0.5 truncate">
          {title}
        </p>
        <h3 className="text-base font-medium text-slate-900 leading-none">
          {formattedValue}
        </h3>
        {description && (
          <p className="text-[11px] text-slate-500 mt-1 font-normal leading-snug">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
