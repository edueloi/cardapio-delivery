import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence, Variants } from "motion/react";
import { cn } from "@/src/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Modal — Design System
//
// Comportamento responsivo automático:
//  • Mobile (<640px): bottom-sheet com handle iOS ou fullscreen
//  • Tablet/Desktop: modal centralizado com bordas arredondadas
//
// Tamanhos (desktop):
//  xs  → 360px   (confirmações simples)
//  sm  → 448px   (forms pequenos)
//  md  → 512px   (padrão geral)
//  lg  → 640px   (forms médios)
//  xl  → 768px   (forms grandes / detalhes)
//  2xl → 900px   (painéis complexos / split)
//  full → 95vw   (tabelas / relatórios)
//
// Slots:
//  title    → header fixo com botão fechar
//  children → body scrollável
//  footer   → rodapé fixo com ações (use ModalFooter)
// ─────────────────────────────────────────────────────────────────────────────

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "auto";
  hideCloseButton?: boolean;
  /** Mobile presentation mode */
  mobileStyle?: "bottom-sheet" | "fullscreen" | "center";
  backdropBlur?: "none" | "sm" | "md";
}

const sizeClasses: Record<string, string> = {
  xs:   "sm:max-w-[360px]",
  sm:   "sm:max-w-[448px]",
  md:   "sm:max-w-[512px]",
  lg:   "sm:max-w-[640px]",
  xl:   "sm:max-w-[768px]",
  "2xl":"sm:max-w-[900px]",
  full: "sm:max-w-[95dvw] sm:w-full",
  auto: "sm:w-auto",
};

const backdropConfigs: Record<string, string> = {
  none: "",
  sm:   "backdrop-blur-[2px]",
  md:   "backdrop-blur-[4px]",
};

// ── Animações ──────────────────────────────────────────────────────────────
const bottomSheetVariants: Variants = {
  hidden:  { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 26, stiffness: 240, mass: 0.8 } },
  exit:    { opacity: 0, y: "100%", transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] } },
};

const fullscreenVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.96, y: 24 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 26, stiffness: 240 } },
  exit:    { opacity: 0, scale: 0.96, y: -16, transition: { duration: 0.18, ease: "easeIn" } },
};

const desktopVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.97, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 28, stiffness: 320, mass: 0.7 } },
  exit:    { opacity: 0, scale: 0.97, y: -12, transition: { duration: 0.15, ease: "easeIn" } },
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  size = "md",
  hideCloseButton = false,
  mobileStyle = "bottom-sheet",
  backdropBlur = "sm",
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Bloqueia scroll do body enquanto o modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const isBottomSheet   = isMobile && mobileStyle === "bottom-sheet";
  const isMobileFullscreen = isMobile && mobileStyle === "fullscreen";

  const variants = isMobile
    ? isMobileFullscreen ? fullscreenVariants : bottomSheetVariants
    : desktopVariants;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className={cn(
              "fixed inset-0 z-[100] bg-zinc-900/45",
              backdropConfigs[backdropBlur]
            )}
          />

          {/* Container de posicionamento */}
          <div
            className={cn(
              "fixed inset-0 z-[101] flex pointer-events-none",
              isBottomSheet
                ? "items-end sm:items-center sm:justify-center p-0 sm:p-6"
                : "items-center justify-center p-4 sm:p-6"
            )}
          >
            <motion.div
              key="modal-content"
              variants={variants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className={cn(
                "w-full bg-white relative flex flex-col pointer-events-auto overflow-hidden",
                // Mobile styles
                isBottomSheet && [
                  "rounded-t-[2rem] sm:rounded-3xl",
                  "max-h-[92dvh] sm:max-h-[88vh]",
                  "shadow-[0_-12px_48px_rgba(0,0,0,0.12)]",
                ],
                isMobileFullscreen && [
                  "h-[100dvh] w-full rounded-none",
                ],
                // Desktop styles
                !isBottomSheet && !isMobileFullscreen && [
                  "rounded-3xl",
                  "max-h-[90dvh] sm:max-h-[88vh]",
                ],
                "sm:rounded-3xl sm:shadow-[0_25px_60px_rgba(0,0,0,0.15)] sm:border sm:border-zinc-200/60",
                sizeClasses[size],
                className
              )}
            >
              {/* iOS Grab Handle */}
              {isBottomSheet && (
                <div className="w-full flex justify-center pt-3 pb-0 shrink-0 sm:hidden">
                  <div className="w-10 h-[5px] rounded-full bg-zinc-200" />
                </div>
              )}

              {/* Header */}
              {title && (
                <div
                  className={cn(
                    "flex items-center justify-between shrink-0",
                    "px-5 sm:px-7",
                    "border-b border-zinc-100",
                    isBottomSheet ? "pt-5 pb-4 sm:py-5" : "py-4 sm:py-5"
                  )}
                >
                  <div className="text-sm sm:text-[15px] font-black text-zinc-900 uppercase tracking-wide truncate pr-4 font-display">
                    {title}
                  </div>
                  {!hideCloseButton && (
                    <button
                      onClick={onClose}
                      aria-label="Fechar"
                      className="p-2 -mr-1 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all active:scale-90 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shrink-0"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              )}

              {/* Body — scrollável */}
              <div className="flex-1 overflow-y-auto overscroll-contain w-full p-5 sm:p-7 relative scroll-smooth">
                {/* Botão fechar flutuante (quando sem título) */}
                {!title && !hideCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label="Fechar"
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 shadow-sm border border-zinc-200/60 text-zinc-500 hover:text-zinc-900 transition-all active:scale-90"
                  >
                    <X size={17} strokeWidth={2.5} />
                  </button>
                )}
                {children}
              </div>

              {/* Footer fixo */}
              {footer && (
                <div
                  className={cn(
                    "shrink-0 border-t border-zinc-100",
                    "px-5 py-4 sm:px-7 sm:py-5",
                    // Safe area para dispositivos com home bar
                    "pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-5"
                  )}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ModalFooter — Padrão de rodapé de ações
//
// Mobile: botões empilhados (ação principal primeiro visualmente, mas
//         flex-col-reverse garante ordem lógica correta)
// Desktop: alinhados à direita
// ─────────────────────────────────────────────────────────────────────────────

interface ModalFooterProps {
  children: React.ReactNode;
  align?: "left" | "right" | "between";
  className?: string;
}

export function ModalFooter({ children, align = "right", className }: ModalFooterProps) {
  const alignMap = {
    left:    "sm:justify-start",
    right:   "sm:justify-end",
    between: "sm:justify-between",
  };

  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:items-center",
        alignMap[align],
        className
      )}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmModal — Modal de confirmação simples (sim/não)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary" | "success";
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
}: ConfirmModalProps) {
  const btnVariantMap = {
    danger:  "bg-red-500 hover:bg-red-600 text-white",
    primary: "bg-amber-500 hover:bg-amber-600 text-white",
    success: "bg-emerald-500 hover:bg-emerald-600 text-white",
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xs"
      mobileStyle="center"
      footer={
        <ModalFooter>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-[10px] border border-zinc-200 bg-white text-sm font-bold text-zinc-700 hover:bg-zinc-50 transition-all w-full sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "h-10 px-5 rounded-[10px] text-sm font-bold transition-all w-full sm:w-auto",
              "disabled:opacity-50 disabled:cursor-not-allowed active:scale-95",
              btnVariantMap[variant]
            )}
          >
            {loading ? "Aguarde..." : confirmLabel}
          </button>
        </ModalFooter>
      }
    >
      <p className="text-sm text-zinc-600 leading-relaxed">{message}</p>
    </Modal>
  );
}
