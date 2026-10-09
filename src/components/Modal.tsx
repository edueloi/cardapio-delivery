import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Button, IconButton } from './Button';

export interface ModalProps {
  isOpen?: boolean;
  /** Alias de isOpen (API legada). */
  open?: boolean;
  /** Texto auxiliar sob o título. */
  subtitle?: string;
  /** Impede fechar ao clicar fora ou com Esc. */
  persistent?: boolean;
  /** Sobrepõe o z-index (modal aberto sobre drawers). */
  zIndex?: number;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'auto';
  hideCloseButton?: boolean;
  mobileStyle?: 'bottom-sheet' | 'fullscreen' | 'center';
  backdropBlur?: 'none' | 'sm' | 'md';
  position?: 'center' | 'right';
}

const widths = { xs: 340, sm: 400, md: 480, lg: 600, xl: 720, '2xl': 860, full: 1280, auto: 600 };
const openModals: string[] = [];
let previousOverflow = '';
const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"], [contenteditable="true"]';

export function Modal({ isOpen: isOpenProp, open, subtitle, persistent = false, zIndex, onClose: onCloseProp, title, children, footer, className, size = 'md', hideCloseButton = false, mobileStyle = 'center', position = 'center' }: ModalProps) {
  const isOpen = isOpenProp ?? open ?? false;
  const onClose = persistent ? () => {} : onCloseProp;
  const id = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [layer, setLayer] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openModals.length === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModals.push(id);
    setLayer(openModals.length);
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== id || event.defaultPrevented) return;
      if ((event.target as HTMLElement)?.closest('[data-ui-popover]')) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusable) || []).filter(el => el.getClientRects().length > 0);
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      const index = openModals.indexOf(id);
      if (index !== -1) openModals.splice(index, 1);
      if (openModals.length === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen, id]);

  if (!isOpen || typeof document === 'undefined') return null;
  // Mantém o rodapé fixo também nas telas que o passam como filho.
  const parts = React.Children.toArray(children);
  const embeddedFooters = parts.filter(child => React.isValidElement(child) && child.type === ModalFooter);
  const body = parts.filter(child => !embeddedFooters.includes(child));
  const actions = footer || embeddedFooters.map((child: any) => React.cloneElement(child, { className: undefined }));

  return createPortal(
    <div className={cn('ui-modal-overlay', position === 'right' && 'ui-modal-overlay--right')} style={{ zIndex: zIndex ?? 100 + layer * 10 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title ? id + '-title' : undefined} aria-label={!title ? 'Janela de diálogo' : undefined} tabIndex={-1}
        className={cn('ui-modal', position === 'right' && 'ui-modal--right', mobileStyle === 'fullscreen' && 'ui-modal--fullscreen', className)}
        style={{ '--modal-width': widths[size] + 'px' } as React.CSSProperties}>
        <header className="ui-modal-header">
          <div className="min-w-0">
            <h2 id={id + '-title'} className="ui-modal-title">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {!hideCloseButton && <IconButton aria-label="Fechar modal" onClick={onClose} size="sm"><X size={16} /></IconButton>}
        </header>
        <div className="ui-modal-body">{body}</div>
        {(footer || embeddedFooters.length > 0) && <div className="ui-modal-actions">{actions}</div>}
      </div>
    </div>, document.body
  );
}

interface ModalFooterProps { children: React.ReactNode; align?: 'left' | 'right' | 'between'; className?: string; }
export function ModalFooter({ children, align = 'right', className }: ModalFooterProps) {
  return <div className={cn('ui-modal-footer', align === 'between' ? 'justify-between' : align === 'left' ? 'justify-start' : 'justify-end', className)}>{children}</div>;
}

interface ConfirmModalProps {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string;
  message: string | React.ReactNode; confirmLabel?: string; cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'success'; loading?: boolean;
}
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', loading = false }: ConfirmModalProps) {
  return <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title} size="sm" footer={
    <ModalFooter><Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button><Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></ModalFooter>
  }><div className="text-[13px] leading-relaxed text-slate-600">{message}</div></Modal>;
}

export default Modal;
