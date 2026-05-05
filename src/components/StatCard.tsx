import React from "react";
import { motion } from "motion/react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// StatCard — Design System
//
// Responsivo:
//  • Mobile (2 colunas): valor grande, ícone menor, menos padding
//  • Tablet+ (4 colunas): versão completa com hover animado
//
// Variantes de cor de ícone: default (amber) | success | info | danger | purple | warning
// ─────────────────────────────────────────────────────────────────────────────

export type StatCardColor = "default" | "success" | "info" | "danger" | "purple" | "warning";

const colorMap: Record<StatCardColor, { wrap: string; icon: string; glow: string }> = {
  default: {
    wrap: "bg-amber-50 border-amber-100 group-hover:bg-amber-500 group-hover:border-amber-500",
    icon: "text-amber-600 group-hover:text-white",
    glow: "bg-amber-500/5",
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
  delay = 0,
}: StatCardProps) {
  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={cn(
        "bg-white rounded-2xl border border-zinc-200 shadow-sm",
        "hover:shadow-md transition-all duration-300 group",
        "relative overflow-hidden",
        // Padding responsivo: menor no mobile
        "p-4 sm:p-5",
        className
      )}
    >
      {/* Círculo decorativo de fundo */}
      <div
        className={cn(
          "absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 rounded-full -mr-8 -mt-8 sm:-mr-10 sm:-mt-10",
          "transition-transform group-hover:scale-150 duration-700",
          c.glow
        )}
      />

      {/* Header: ícone + trend */}
      <div className="flex justify-between items-start mb-3 sm:mb-4 relative z-10">
        <div
          className={cn(
            "p-2 sm:p-2.5 rounded-xl border transition-all duration-300",
            c.wrap
          )}
        >
          <Icon size={16} className={cn("transition-colors duration-300 sm:hidden", c.icon)} />
          <Icon size={18} className={cn("hidden sm:block transition-colors duration-300", c.icon)} />
        </div>

        {trend && (
          <div
            className={cn(
              "flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg border text-[9px] sm:text-[10px] font-bold",
              trend.isUp
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-red-50 text-red-500 border-red-200"
            )}
          >
            {trend.isUp
              ? <ArrowUpRight size={10} className="sm:hidden" />
              : <ArrowDownRight size={10} className="sm:hidden" />
            }
            {trend.isUp
              ? <ArrowUpRight size={11} className="hidden sm:block" />
              : <ArrowDownRight size={11} className="hidden sm:block" />
            }
            {trend.value}%
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative z-10">
        <p className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5 sm:mb-1 truncate">
          {title}
        </p>
        <h3 className="text-base sm:text-2xl font-black text-zinc-900 tracking-tight leading-none">
          {value}
        </h3>
        {description && (
          <p className="hidden sm:flex text-[9px] sm:text-[10px] text-zinc-400 mt-1 sm:mt-1.5 font-medium items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-zinc-300 shrink-0" />
            <span className="truncate">{description}</span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
