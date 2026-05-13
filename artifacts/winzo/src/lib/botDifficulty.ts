/**
 * WINGGO Dynamic Bot Difficulty System
 * ──────────────────────────────────────
 * Bot intelligence scales automatically with entry fee:
 *   ≤ ₹2   → 🟢 Beginner  (40% error rate — player wins more often)
 *   ≤ ₹5   → 🟡 Pro       (10% error rate — balanced competitive)
 *   > ₹5   → 🔴 God Mode  ( 0% error rate — near unbeatable)
 */

export type DifficultyLevel = "Beginner" | "Pro" | "God Mode";

export interface BotDifficulty {
  level: DifficultyLevel;
  emoji: string;
  color: string;
  glowColor: string;
  errorRate: number;      // 0.0 (perfect) – 1.0 (always wrong)
  reactionTime: number;   // ms
  decisionPower: "low" | "medium" | "maximum";
  botName: string;
  winChance: number;      // probability the bot beats a typical player (0–1)
}

// ── Bot name pools ────────────────────────────────────────────────────────────

const BOT_NAMES: Record<DifficultyLevel, string[]> = {
  "Beginner": [
    "Raju123", "NewPlayer99", "Bunty_G", "Chintu42",
    "Lucky_Noob", "Pappu_Play", "Guddu007", "ChampNew",
  ],
  "Pro": [
    "ProGamer_X", "Vikram_Ace", "RahulStrike", "CoolDude777",
    "Striker9", "Master_V", "ZoroPlay", "PrimeShooter",
  ],
  "God Mode": [
    "UNBEATABLE", "GOD_AI_X", "PERFECT_BOT", "EliteForce",
    "ZeroError", "MaxPower99", "APEX_AI", "OMNISCIENT",
  ],
};

// ── Core factory ──────────────────────────────────────────────────────────────

export function getBotDifficulty(fee: number): BotDifficulty {
  if (fee <= 2) {
    return {
      level: "Beginner",
      emoji: "🟢",
      color: "#22c55e",
      glowColor: "rgba(34,197,94,0.35)",
      errorRate: 0.40,
      reactionTime: 1500,
      decisionPower: "low",
      botName: BOT_NAMES["Beginner"][Math.floor(Math.random() * BOT_NAMES["Beginner"].length)],
      winChance: 0.28,
    };
  }

  if (fee <= 5) {
    return {
      level: "Pro",
      emoji: "🟡",
      color: "#FFD700",
      glowColor: "rgba(255,215,0,0.35)",
      errorRate: 0.10,
      reactionTime: 500,
      decisionPower: "medium",
      botName: BOT_NAMES["Pro"][Math.floor(Math.random() * BOT_NAMES["Pro"].length)],
      winChance: 0.50,
    };
  }

  return {
    level: "God Mode",
    emoji: "🔴",
    color: "#ef4444",
    glowColor: "rgba(239,68,68,0.35)",
    errorRate: 0.00,
    reactionTime: 100,
    decisionPower: "maximum",
    botName: BOT_NAMES["God Mode"][Math.floor(Math.random() * BOT_NAMES["God Mode"].length)],
    winChance: 0.78,
  };
}

/**
 * Generate a bot score for a given max possible score,
 * scaled to the difficulty's win-chance and error-rate.
 *
 * @param maxScore   The maximum score achievable in the game
 * @param difficulty The bot difficulty object
 * @param variance   Optional ±% variance added on top (default 0.12)
 */
export function getBotScore(
  maxScore: number,
  difficulty: BotDifficulty,
  variance = 0.12,
): number {
  const base = maxScore * difficulty.winChance;
  const swing = maxScore * variance;
  return Math.max(0, Math.floor(base + (Math.random() - 0.5) * 2 * swing));
}

/**
 * Returns true if the bot succeeds at an action (hit, score, goal, etc.)
 * Uses the bot's winChance as the success probability.
 */
export function botSucceeds(difficulty: BotDifficulty): boolean {
  return Math.random() < difficulty.winChance;
}

/**
 * Small human-like delay that respects the bot's reactionTime.
 * Useful for async game flows.
 */
export function botDelay(difficulty: BotDifficulty): Promise<void> {
  const jitter = difficulty.reactionTime * 0.3 * Math.random();
  return new Promise((r) => setTimeout(r, difficulty.reactionTime + jitter));
}
