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
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white",
            iconWrapClassName
          )}
        >
          <Icon size={16} className={cn("text-slate-400", iconClassName)} />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        {description && <p className="text-xs leading-relaxed text-zinc-500">{description}</p>}
      </div>

      {action}
    </div>
  );
}
