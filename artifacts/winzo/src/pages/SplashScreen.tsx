import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black z-50 overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
    >
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.h1 
          className="text-7xl md:text-9xl font-black tracking-tighter"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <span className="text-white">WIN</span>
          <span 
            className="text-[#FFD700]"
            style={{
              textShadow: "0 0 10px rgba(255, 215, 0, 0.7), 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3)"
            }}
          >
            ZO
          </span>
        </motion.h1>
        
        <motion.div 
          className="mt-16 text-[#FFD700]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
        >
          <Loader2 className="w-8 h-8 animate-spin" />
        </motion.div>
      </div>
    </motion.div>
  );
}
