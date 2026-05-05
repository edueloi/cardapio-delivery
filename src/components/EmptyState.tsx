import React from "react";
import { cn } from "@/src/lib/utils";

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  iconWrapClassName?: string;
  iconClassName?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  iconWrapClassName,
  iconClassName,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50/70 px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white",
            iconWrapClassName
          )}
        >
          <Icon size={24} className={cn("text-zinc-400", iconClassName)} />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-black text-zinc-900">{title}</p>
        {description && <p className="text-xs leading-relaxed text-zinc-500">{description}</p>}
      </div>

      {action}
    </div>
  );
}
