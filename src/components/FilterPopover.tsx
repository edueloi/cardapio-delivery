import React, { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from './Button';

interface FilterPopoverProps {
  /** Quantidade de filtros ativos (badge no botão). */
  activeCount?: number;
  /** Chamado ao abrir (útil para copiar os filtros atuais para um rascunho). */
  onOpen?: () => void;
  /** Chamado ao clicar em "Aplicar". O painel fecha em seguida. */
  onApply: () => void;
  /** Chamado ao clicar em "Limpar filtros". */
  onClear: () => void;
  title?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Botão "Filtros" com badge + painel. No desktop abre como popover ancorado ao botão;
 * abaixo de `sm` vira bottom sheet com fundo escurecido.
 */
export const FilterPopover: React.FC<FilterPopoverProps> = ({
  activeCount = 0, onOpen, onApply, onClear, title = 'Filtros', label = 'Filtros', children, className = '',
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // No mobile o backdrop cuida do fechamento; no desktop fecha ao clicar fora.
      if (window.innerWidth < 640) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen?.();
    setOpen((o) => !o);
  };

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <Button
        type="button"
        variant={activeCount > 0 ? 'primary' : 'outline'}
        size="sm"
        iconLeft={<SlidersHorizontal size={14} />}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="h-[34px]"
      >
        {label}
        {activeCount > 0 && (
          <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-blue-600">
            {activeCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40 sm:hidden" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-lg border border-slate-200 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-[380px] sm:max-w-[calc(100vw-2rem)] sm:rounded-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <span className="text-xs font-semibold text-slate-800">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar filtros"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">{children}</div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>Limpar filtros</Button>
              <Button type="button" variant="primary" size="sm" onClick={() => { onApply(); setOpen(false); }}>Aplicar</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
