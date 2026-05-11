/**
 * LoginTransitionScreen — WINGGO
 * Premium WinZO-style loading animation shown after login/signup succeeds.
 * Animated 4-step progress, completes in ~2.5 seconds then calls onComplete().
 * Acts as a visual bridge so the dashboard never appears before minimum load time.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isNewUser?: boolean;
  onComplete: () => void;
}

const STEPS = [
  { label: "Signed In Successfully",  delay: 0 },
  { label: "Loading Your Profile",    delay: 600 },
  { label: "Loading Wallet Balance",  delay: 1100 },
  { label: "Opening WINGGO",          delay: 1700 },
];

export default function LoginTransitionScreen({ isNewUser = false, onComplete }: Props) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress]             = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setCompletedSteps((prev) => [...prev, i]);
        setProgress(((i + 1) / STEPS.length) * 100);
      }, step.delay);
      timers.push(t);
    });

    // Complete and advance to dashboard after all steps animate
    const done = setTimeout(onComplete, 2400);
    timers.push(done);

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 55%, #000 100%)",
        maxWidth: 480,
        margin: "0 auto",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.4 } }}
    >
      {/* Pulsing ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(255,215,0,0.08) 0%, transparent 65%)" }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity }}
      />

      {/* Floating ring */}
      <motion.div
        className="absolute rounded-full border"
        style={{ width: 320, height: 320, borderColor: "rgba(255,215,0,0.06)" }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative z-10 flex flex-col items-center w-full px-10 gap-8">

        {/* Logo */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ scale: 0.7, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-black tracking-tighter leading-none select-none" style={{ fontSize: "72px" }}>
            <span className="text-white">WIN</span>
            <span style={{
              color: "#FFD700",
              textShadow: "0 0 16px rgba(255,215,0,0.9), 0 0 40px rgba(255,215,0,0.5)",
            }}>GGO</span>
          </h1>
          <motion.p
            className="text-xs font-bold tracking-[0.25em] uppercase"
            style={{ color: "rgba(255,215,0,0.55)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          >
            {isNewUser ? "Welcome Aboard! 🎉" : "Welcome Back! 👋"}
          </motion.p>
        </motion.div>

        {/* Steps */}
        <div className="w-full space-y-3">
          {STEPS.map((step, i) => {
            const done    = completedSteps.includes(i);
            const active  = !done && completedSteps.includes(i - 1) || (i === 0 && completedSteps.length === 0);
            return (
              <motion.div
                key={step.label}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: done
                    ? "rgba(255,215,0,0.07)"
                    : active
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.02)",
                  border: done
                    ? "1px solid rgba(255,215,0,0.25)"
                    : "1px solid rgba(255,255,255,0.06)",
                  transition: "all 0.35s ease",
                }}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
              >
                {/* Icon */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: done
                      ? "linear-gradient(135deg,#FFD700,#ff8c00)"
                      : "rgba(255,255,255,0.06)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.span
                        key="check"
                        className="text-xs font-black text-black"
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 16 }}
                      >
                        ✓
                      </motion.span>
                    ) : active ? (
                      <motion.span
                        key="spin"
                        className="inline-block w-3.5 h-3.5 rounded-full border-2"
                        style={{ borderColor: "rgba(255,215,0,0.4)", borderTopColor: "#FFD700" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <motion.span
                        key="dot"
                        className="w-2 h-2 rounded-full"
                        style={{ background: "rgba(255,255,255,0.15)" }}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Label */}
                <span
                  className="text-sm font-semibold"
                  style={{
                    color: done ? "#FFD700" : active ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                    transition: "color 0.3s ease",
                  }}
                >
                  {step.label}
                  {active && (
                    <motion.span
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    >…</motion.span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>
              Loading…
            </span>
            <span className="text-xs font-black" style={{ color: "#FFD700" }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#FFD700,#ff8c00)" }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Bottom hint */}
        <motion.p
          className="text-xs text-center"
          style={{ color: "rgba(255,255,255,0.2)" }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🔒 Connecting securely…
        </motion.p>
      </div>
    </motion.div>
  );
}
