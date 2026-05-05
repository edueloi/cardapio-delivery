import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingProps {
  onComplete?: () => void;
}

const LoadingScreen: React.FC<LoadingProps> = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3500); // Um pouco mais de tempo para a nova animação brilhar

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: [0.43, 0.13, 0.23, 0.96] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
          <div className="relative flex flex-col items-center">
            {/* Ícone que aparece primeiro */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1.8, opacity: 1, y: 0 }} // Ícone ainda maior
              transition={{ 
                duration: 0.8, 
                ease: [0.34, 1.56, 0.64, 1],
              }}
              className="mb-8" // Reduzi a margem abaixo do ícone
            >
              <img 
                src="/images/favicon-menu-flow.png" 
                alt="MenuFlow Icon" 
                className="w-24 h-24 object-contain drop-shadow-2xl"
              />
            </motion.div>

            {/* Texto surgindo do ícone */}
            <div className="overflow-hidden py-2 px-4">
              <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ 
                  delay: 0.5, 
                  duration: 0.7, 
                  ease: "circOut" 
                }}
                className="flex items-center text-7xl font-bold tracking-tighter"
              >
                <span style={{ color: '#001D3D' }}>Menu</span>
                <span style={{ color: '#D49E00' }}>Flow</span>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 1.2, duration: 0.8, ease: "easeInOut" }}
              className="mt-4 flex flex-col items-center w-full"
            >
              <div className="w-64 h-[1px] bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
              
              <div className="flex items-center space-x-6">
                <div className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: '#D49E00' }}>
                  Cardápios & Bots
                </div>
                
                <div className="h-4 w-[1px] bg-gray-300"></div>

                <div className="text-[11px] uppercase tracking-[0.15em] flex items-center font-medium" style={{ color: '#001D3D' }}>
                  <span className="opacity-50 mr-2 italic text-[9px]">by</span>
                  <img 
                    src="/images/develoi.png" 
                    alt="Develoi" 
                    className="h-10 object-contain"
                  />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Partículas sutis de carregamento */}
          <motion.div 
            className="absolute bottom-20 flex space-x-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gray-200"
                animate={{ scale: [1, 1.5, 1], backgroundColor: ["#E5E7EB", "#D49E00", "#E5E7EB"] }}
                transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
