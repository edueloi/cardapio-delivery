import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

interface LoadingProps {
  onComplete?: () => void;
  durationMs?: number;
  badgeText?: string;
  statusText?: string;
  description?: string;
}

const LoadingScreen: React.FC<LoadingProps> = ({
  onComplete,
  durationMs = 3200,
  badgeText = 'Inicializando',
  statusText = 'Carregando',
  description = 'Preparando seu ambiente com rapidez, estabilidade e uma experiência mais limpa na abertura.',
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(false);
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [durationMs]);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          initial={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.7, ease: [0.22, 1, 0.36, 1]}}
          className="fixed inset-0 z-[9999] overflow-hidden bg-[#F8FAFC]"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(212,158,0,0.14),_transparent_34%),radial-gradient(circle_at_bottom,_rgba(0,29,61,0.08),_transparent_30%)]" />
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />

          <motion.div
            initial={{opacity: 0, scale: 0.8}}
            animate={{opacity: 1, scale: 1}}
            transition={{duration: 0.9, ease: [0.22, 1, 0.36, 1]}}
            className="absolute left-1/2 top-[14%] h-40 w-40 -translate-x-1/2 rounded-full bg-[#D49E00]/12 blur-3xl"
          />

          <div className="relative flex min-h-screen items-center justify-center px-6">
            <div className="flex w-full max-w-xl flex-col items-center text-center">
              <motion.div
                initial={{opacity: 0, y: 12}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.6, ease: 'easeOut'}}
                className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0B2343]/10 bg-white/85 px-4 py-2 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-md"
              >
                <motion.span
                  className="h-2 w-2 rounded-full bg-[#D49E00]"
                  animate={{scale: [1, 1.35, 1], opacity: [0.7, 1, 0.7]}}
                  transition={{duration: 1.4, repeat: Infinity, ease: 'easeInOut'}}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">
                  {badgeText}
                </span>
              </motion.div>

              <motion.div
                initial={{opacity: 0, y: 20, scale: 0.9}}
                animate={{opacity: 1, y: 0, scale: 1}}
                transition={{delay: 0.12, duration: 0.8, ease: [0.22, 1, 0.36, 1]}}
                className="relative mb-8"
              >
                <div className="absolute inset-0 rounded-[2rem] bg-[#D49E00]/12 blur-2xl" />
                <div className="relative rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.35)]">
                  <div className="rounded-[1.4rem] bg-white p-3">
                    <img
                      src="/images/logo.png"
                      alt="Logo Box Sys"
                      className="h-16 w-16 object-contain"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{opacity: 0, y: 26}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.25, duration: 0.75, ease: [0.22, 1, 0.36, 1]}}
                className="space-y-4"
              >
                <h1 className="text-5xl font-black tracking-[-0.08em] text-[#0B2343] sm:text-6xl">
                  Box<span className="text-[#D49E00]">Sys</span>
                </h1>

                <div className="flex items-center justify-center gap-4 text-[11px] font-semibold uppercase tracking-[0.34em]">
                  <span className="text-[#C99000]">Sistema de Gestão</span>
                  <span className="h-4 w-px bg-slate-300" />
                  <span className="text-[#0B2343]">{statusText}</span>
                </div>

                <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                  {description}
                </p>
              </motion.div>

              <motion.div
                initial={{opacity: 0, y: 18}}
                animate={{opacity: 1, y: 0}}
                transition={{delay: 0.45, duration: 0.7, ease: 'easeOut'}}
                className="mt-8 w-full max-w-[280px]"
              >
                <div className="overflow-hidden rounded-full bg-slate-200/80 p-[3px] shadow-inner">
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/70">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-[#0B2343] via-[#D49E00] to-[#0B2343]"
                      initial={{scaleX: 0.18, originX: 0}}
                      animate={{scaleX: 1, originX: 0}}
                      transition={{duration: 2.5, ease: [0.22, 1, 0.36, 1]}}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[12px] text-slate-400">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="h-2 w-2 rounded-full bg-slate-300"
                      animate={{
                        y: [0, -4, 0],
                        backgroundColor: ['#CBD5E1', '#D49E00', '#CBD5E1'],
                      }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: dot * 0.16,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
