import React from "react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Badge — Design System
//
// Cores semânticas:
//   default   → zinc
//   primary   → azul (cor da marca)
//   success   → emerald
//   warning   → amber escuro
//   danger    → red
//   info      → blue
//   purple    → violet (misto/pagamentos combinados)
//
// Tamanhos: sm | md
// dot: exibe um ponto colorido antes do label
// ─────────────────────────────────────────────────────────────────────────────

type BadgeColor =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple"
  | "orange"
  | "teal";

interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  size?: "sm" | "md";
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  pill?: boolean;
}

const colorMap: Record<BadgeColor, string> = {
  default:  "bg-zinc-100 text-zinc-700 border border-zinc-200",
  primary:  "bg-blue-50 text-blue-700 border border-blue-200",
  success:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  warning:  "bg-yellow-50 text-yellow-700 border border-yellow-200",
  danger:   "bg-red-50 text-red-700 border border-red-200",
  info:     "bg-blue-50 text-blue-700 border border-blue-200",
  purple:   "bg-violet-50 text-violet-700 border border-violet-200",
  orange:   "bg-orange-50 text-orange-700 border border-orange-200",
  teal:     "bg-teal-50 text-teal-700 border border-teal-200",
};

const dotColorMap: Record<BadgeColor, string> = {
  default:  "bg-zinc-400",
  primary:  "bg-blue-500",
  success:  "bg-emerald-500",
  warning:  "bg-yellow-500",
  danger:   "bg-red-500",
  info:     "bg-blue-500",
  purple:   "bg-violet-500",
  orange:   "bg-orange-500",
  teal:     "bg-teal-500",
};

export function Badge({
  children,
  color = "default",
  size = "sm",
  dot = false,
  icon,
  pill = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tracking-normal leading-none shrink-0",
        size === "sm" ? "px-1.5 py-0.5 text-[11px] rounded-md"
                      : "px-2 py-1 text-[11px] rounded-lg",
        pill && "rounded-full",
        colorMap[color],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColorMap[color])} />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// ─── StatusBadge – wrapper semântico para status de agendamento/comanda ───────
type AppStatus =
  | "scheduled"    // agendado
  | "confirmed"    // confirmado
  | "in_progress"  // em atendimento
  | "completed"    // concluído
  | "cancelled"    // cancelado
  | "no_show"      // não compareceu
  | "open"         // aberto (comanda)
  | "paid"         // pago
  | "pending"      // pendente
  | "partial";     // parcial

const statusConfig: Record<AppStatus, { label: string; color: BadgeColor }> = {
  scheduled:   { label: "Agendado",        color: "info" },
  confirmed:   { label: "Confirmado",      color: "success" },
  in_progress: { label: "Em atendimento",  color: "primary" },
  completed:   { label: "Concluído",       color: "success" },
  cancelled:   { label: "Cancelado",       color: "danger" },
  no_show:     { label: "Não compareceu",  color: "danger" },
  open:        { label: "Aberta",          color: "primary" },
  paid:        { label: "Paga",            color: "success" },
  pending:     { label: "Pendente",        color: "warning" },
  partial:     { label: "Parcial",         color: "purple" },
};

interface StatusBadgeProps {
  status: AppStatus;
  size?: "sm" | "md";
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = "sm", dot = true, className }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  if (!cfg) return null;
  return (
    <Badge color={cfg.color} size={size} dot={dot} className={className}>
      {cfg.label}
    </Badge>
  );
}

// ─── PaymentBadge – wrapper para formas de pagamento ─────────────────────────
type PaymentMethod = "cash" | "card" | "pix" | "mixed" | "transfer" | "voucher";

const paymentConfig: Record<PaymentMethod, { label: string; color: BadgeColor }> = {
  cash:     { label: "Dinheiro", color: "success" },
  card:     { label: "Cartão",   color: "info" },
  pix:      { label: "Pix",      color: "purple" },
  mixed:    { label: "Misto",    color: "purple" },
  transfer: { label: "Transf.",  color: "default" },
  voucher:  { label: "Voucher",  color: "orange" },
};

interface PaymentBadgeProps {
  method: PaymentMethod;
  size?: "sm" | "md";
  className?: string;
}

export function PaymentBadge({ method, size = "sm", className }: PaymentBadgeProps) {
  const cfg = paymentConfig[method];
  if (!cfg) return null;
  return (
    <Badge color={cfg.color} size={size} dot className={className}>
      {cfg.label}
    </Badge>
  );
}

// ─── API legada (variant) ─────────────────────────────────────────────────────
type LegacyVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral" | "purple";
const legacyColor: Record<LegacyVariant, BadgeColor> = {
  default: "default", neutral: "default", success: "success", warning: "warning", danger: "danger", info: "info", purple: "purple",
};

export default function LegacyBadge({ variant = "default", children, icon, dot, className }: {
  variant?: LegacyVariant; children: React.ReactNode; icon?: React.ReactNode; dot?: boolean; className?: string;
}) {
  return <Badge color={legacyColor[variant]} dot={dot} icon={!dot ? icon : undefined} className={className}>{children}</Badge>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: BadgeColor }> = {
    pending: { label: "Pendente", color: "warning" }, confirmed: { label: "Confirmado", color: "info" },
    paid: { label: "Pago", color: "success" }, completed: { label: "Concluído", color: "success" },
    delivered: { label: "Entregue", color: "success" }, shipped: { label: "Enviado", color: "info" },
    cancelled: { label: "Cancelado", color: "danger" }, canceled: { label: "Cancelado", color: "danger" },
  };
  const cfg = map[status] ?? { label: status, color: "default" as BadgeColor };
  return <Badge color={cfg.color} dot>{cfg.label}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge color={active ? "success" : "default"} dot>{active ? "Ativo" : "Inativo"}</Badge>;
}

export function FinanceTypeBadge({ type }: { type: "income" | "expense" }) {
  return <Badge color={type === "income" ? "success" : "danger"} dot>{type === "income" ? "Receita" : "Despesa"}</Badge>;
}
