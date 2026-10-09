import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { uiTheme } from './theme';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: keyof typeof uiTheme.alert;
  title?: React.ReactNode;
  action?: React.ReactNode;
}

const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

/** Aviso compacto no mesmo padrão dos painéis administrativos. */
export function Alert({ variant = 'info', title, children, action, className, ...props }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex min-w-0 items-start gap-2 rounded-md border p-3 text-xs leading-relaxed', uiTheme.alert[variant], className)} {...props}>
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">
        {title && <div className="font-medium">{title}</div>}
        {children && <div className={cn(title && 'mt-1')}>{children}</div>}
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}
