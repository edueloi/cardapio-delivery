import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/src/lib/utils";

// Toast no padrão do sistema (pílula escura compacta no topo à direita).
// API: useToast() -> { show, toast, success, error, warning, info }.

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps extends ToastItem {
  onClose: (id: string) => void;
  /** Mantido por compatibilidade. */
  isMobile?: boolean;
}

interface ToastContextType {
  show: (message: string, type?: ToastType, duration?: number) => void;
  /** Alias de show (API do store). */
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={20} color="#10b981" />,
  error: <XCircle size={20} color="#ef4444" />,
  warning: <AlertTriangle size={20} color="#f59e0b" />,
  info: <Info size={20} color="#60a5fa" />,
};

export function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(t);
  }, [id, duration, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      role={type === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex min-w-0 max-w-[min(350px,calc(100vw-32px))] items-center gap-2.5 rounded-lg bg-[#363636] px-2.5 py-2",
        "text-[13px] font-semibold leading-snug text-white shadow-[0_3px_10px_rgb(0_0_0/10%),0_3px_3px_rgb(0_0_0/5%)]"
      )}
    >
      <span className="shrink-0">{icons[type]}</span>
      <span className="min-w-0 flex-1 break-words leading-snug">{message}</span>
      <button
        onClick={() => onClose(id)}
        aria-label="Fechar notificação"
        className="shrink-0 rounded p-1 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, message, duration }]); // máx 4 toasts
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ctx: ToastContextType = {
    show,
    toast: show,
    success: (m, d) => show(m, "success", d),
    error: (m, d) => show(m, "error", d),
    warning: (m, d) => show(m, "warning", d),
    info: (m, d) => show(m, "info", d),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed left-4 right-4 top-4 z-[9999] flex flex-col items-end gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <Toast key={t.id} {...t} onClose={remove} />
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
