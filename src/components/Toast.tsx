import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/src/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Toast — Design System
//
// Posicionamento responsivo:
//  • Mobile:  full-width na base da tela, com safe-area-inset-bottom
//  • Desktop: canto inferior direito, largura fixa 380px
//
// Animação:
//  • Mobile:  sobe do fundo (y: 100% → 0)
//  • Desktop: entra pela direita (x: 60px → 0)
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps extends ToastItem {
  onClose: (id: string) => void;
  isMobile?: boolean;
}

const toastConfig = {
  success: {
    icon: <Check className="w-4 h-4" strokeWidth={3} />,
    accent: 'bg-emerald-500',
    iconBg:   'bg-emerald-50 border-emerald-200 text-emerald-600',
    title:    'Sucesso',
    titleColor: 'text-emerald-600',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: <X className="w-4 h-4" strokeWidth={3} />,
    accent: 'bg-rose-500',
    iconBg:   'bg-rose-50 border-rose-200 text-rose-600',
    title:    'Erro',
    titleColor: 'text-rose-600',
    bar: 'bg-rose-500',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />,
    accent: 'bg-amber-500',
    iconBg:   'bg-amber-50 border-amber-200 text-amber-600',
    title:    'Atenção',
    titleColor: 'text-amber-600',
    bar: 'bg-amber-500',
  },
  info: {
    icon: <Info className="w-4 h-4" strokeWidth={2.5} />,
    accent: 'bg-blue-500',
    iconBg:   'bg-blue-50 border-blue-200 text-blue-600',
    title:    'Informativo',
    titleColor: 'text-blue-600',
    bar: 'bg-blue-500',
  },
};

export function Toast({ id, type, message, onClose, isMobile }: ToastProps) {
  const cfg = toastConfig[type];

  useEffect(() => {
    const t = setTimeout(() => onClose(id), 5000);
    return () => clearTimeout(t);
  }, [id, onClose]);

  return (
    <motion.div
      layout
      initial={isMobile ? { y: 80, opacity: 0, scale: 0.96 } : { x: 60, opacity: 0, scale: 0.97 }}
      animate={isMobile ? { y: 0, opacity: 1, scale: 1 } : { x: 0, opacity: 1, scale: 1 }}
      exit={isMobile ? { y: 80, opacity: 0, scale: 0.96 } : { x: 60, opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className={cn(
        "group pointer-events-auto relative flex overflow-hidden",
        "bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-zinc-100",
        // Mobile: full width, arredondado
        "w-full rounded-2xl",
        // Desktop: largura fixa
        "sm:w-[380px] sm:rounded-2xl"
      )}
    >
      {/* Acento lateral */}
      <div className={cn("w-1.5 shrink-0 transition-all group-hover:w-2", cfg.accent)} />

      {/* Conteúdo */}
      <div className="flex flex-1 items-center p-3.5 sm:p-4 gap-3 sm:gap-4">
        {/* Ícone */}
        <div className={cn("flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl border", cfg.iconBg)}>
          {cfg.icon}
        </div>

        {/* Texto */}
        <div className="flex flex-1 flex-col min-w-0 pr-1">
          <p className={cn("text-[10px] sm:text-[11px] font-black uppercase tracking-widest", cfg.titleColor)}>
            {cfg.title}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-zinc-700 leading-snug mt-0.5 break-words">
            {message}
          </p>
        </div>

        {/* Fechar */}
        <button
          onClick={() => onClose(id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-300 hover:bg-zinc-50 hover:text-zinc-500 transition-all"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-zinc-50/80">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 5, ease: "linear" }}
          className={cn("h-full", cfg.bar)}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ToastProvider
// ─────────────────────────────────────────────────────────────────────────────

interface ToastContextType {
  show: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]); // máx 4 toasts
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    show,
    success: (m) => show(m, 'success'),
    error:   (m) => show(m, 'error'),
    warning: (m) => show(m, 'warning'),
    info:    (m) => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Container de toasts — posição responsiva */}
      <div
        className={cn(
          "fixed z-[9999] flex flex-col gap-2 pointer-events-none",
          // Mobile: bottom, full width com padding e safe-area
          "bottom-0 left-0 right-0 px-3 flex-col",
          // Desktop: canto inferior direito
          "sm:bottom-6 sm:right-6 sm:left-auto sm:px-0 sm:w-auto sm:items-end",
        )}
        style={{
          // Safe area para dispositivos com home bar (iPhone, etc.)
          paddingBottom: isMobile
            ? `calc(0.75rem + env(safe-area-inset-bottom, 0px))`
            : undefined,
        }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onClose={remove} isMobile={isMobile} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastContextType => {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
