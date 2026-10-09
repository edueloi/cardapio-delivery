import React from "react";
import { cn } from "@/src/lib/utils";
import { uiTheme } from './theme';

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
        "overflow-hidden",
        uiTheme.surface,
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex flex-col gap-3 border-b border-slate-100 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between",
            headerClassName
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50",
                  iconWrapClassName
                )}
              >
                <Icon size={14} className={cn("text-blue-600", iconClassName)} />
              </div>
            )}

            {(title || description) && (
              <div className="min-w-0">
                {title && (
                  <h3 className="text-sm font-medium text-slate-900">{title}</h3>
                )}
                {description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
                )}
              </div>
            )}
          </div>

          {action && <div className="w-full lg:w-auto">{action}</div>}
        </div>
      )}

      <div className={cn("p-3", contentClassName)}>{children}</div>
    </section>
  );
}
