import React from "react";
import { cn } from "@/src/lib/utils";

interface PanelCardProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
  contentClassName?: string;
  headerClassName?: string;
  iconWrapClassName?: string;
  iconClassName?: string;
}

export function PanelCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
  headerClassName,
  iconWrapClassName,
  iconClassName,
  ...props
}: PanelCardProps) {
  const hasHeader = !!(title || Icon || action);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-4 border-b border-zinc-100 px-4 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between",
            headerClassName
          )}
        >
          <div className="flex min-w-0 items-start gap-4">
            {Icon && (
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50",
                  iconWrapClassName
                )}
              >
                <Icon size={20} className={cn("text-amber-600", iconClassName)} />
              </div>
            )}

            {(title || description) && (
              <div className="min-w-0">
                {title && (
                  <h3 className="text-base font-black tracking-tight text-zinc-900">{title}</h3>
                )}
                {description && (
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
                )}
              </div>
            )}
          </div>

          {action && <div className="w-full lg:w-auto">{action}</div>}
        </div>
      )}

      <div className={cn("p-4 sm:p-6", contentClassName)}>{children}</div>
    </section>
  );
}
