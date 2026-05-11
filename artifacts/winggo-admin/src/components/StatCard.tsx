import { motion } from "framer-motion";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  glow?: string;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}

export default function StatCard({ icon, label, value, sub, color, glow, trend, trendUp, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}22`,
        boxShadow: glow ? `0 0 24px ${glow}` : undefined,
      }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`, transform: "translate(30%,-30%)" }} />

      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          {icon}
        </div>
        {trend && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: trendUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              color: trendUp ? "#34d399" : "#f87171",
            }}>
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>

      <div className="text-2xl font-black text-white leading-none mb-1">{value}</div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>{sub}</div>}
    </motion.div>
  );
}
