import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginScreen() {
  return (
    <motion.div 
      className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
    >
      {/* Ambient background glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#FFD700]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/50 p-8 rounded-2xl shadow-2xl relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black tracking-tighter mb-2">
            <span className="text-white">WIN</span>
            <span 
              className="text-[#FFD700]"
              style={{
                textShadow: "0 0 10px rgba(255, 215, 0, 0.5)"
              }}
            >
              ZO
            </span>
          </h1>
          <p className="text-zinc-400 text-sm font-medium tracking-wide uppercase">Enter the Arena</p>
        </div>

        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="player@winzo.gg" 
              className="bg-zinc-900 border-zinc-800 focus:border-[#FFD700]/50 focus:ring-[#FFD700]/20 text-white h-12"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <a href="#" className="text-xs text-[#FFD700] hover:text-[#FFD700]/80 transition-colors">
                Forgot password?
              </a>
            </div>
            <Input 
              id="password" 
              type="password" 
              placeholder="••••••••" 
              className="bg-zinc-900 border-zinc-800 focus:border-[#FFD700]/50 focus:ring-[#FFD700]/20 text-white h-12"
            />
          </div>

          <Button className="w-full h-12 bg-[#FFD700] hover:bg-[#FFD700]/90 text-black font-bold text-lg rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all hover:shadow-[0_0_25px_rgba(255,215,0,0.5)] cursor-pointer">
            LOGIN
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-zinc-500">
            Don't have an account?{' '}
            <a href="#" className="text-[#FFD700] font-semibold hover:underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
