import React from 'react';
import { cn } from '@/src/lib/utils';

/** Campo de leitura, usado dentro de uma lista de descrição (<dl>). */
export function DetailField({ label, value, className }: { label: string; value?: string | number | null; className?: string }) {
  const text = value == null ? '' : String(value).trim();
  return <div className={cn('min-w-0 border-b border-slate-100 py-2.5', className)}>
    <dt className="text-[11px] text-slate-500">{label}</dt>
    <dd className={cn('mt-1 text-[13px] break-words leading-relaxed', text ? 'text-slate-800' : 'text-slate-400')}>{text || 'Não informado'}</dd>
  </div>;
}
