/**
 * Game Bot Service — WINGGO User App
 * Manages bot users for populating games and leaderboards
 */
import { doc, setDoc, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { db, FIREBASE_ENABLED } from "./config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface BotUser {
  uid: string;
  displayName: string;
  photoURL: string;
  isBot: true;
  botLevel: number; // 1-5, affects skill
  gamesPlayed: number;
  totalWinnings: number;
  createdAt: number;
}

// ─── BOT NAMES ─────────────────────────────────────────────────────────────────

const BOT_NAMES = [
  "ProGamer_X", "SpeedRunner99", "ChampionKing", "MasterPlayer", "GameWizard",
  "LuckyStrike", "WinnerBoy", "AcePlayer", "StarGamer", "LegendX",
  "ThunderBolt", "FlashPlayer", "NinjaGamer", "ShadowKnight", "FireStorm",
  "IceQueen", "RockStar", "MegaMind", "SuperBot", "ElitePlayer",
];

const BOT_AVATARS = [
  "🤖", "🎮", "🏆", "⚡", "🔥", "💎", "🌟", "🎯", "🚀", "💪",
];

// ─── BOT GENERATION ─────────────────────────────────────────────────────────────

/**
 * Generate a random bot user with realistic stats
 */
export function generateBotUser(level: number = 1): BotUser {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
  const uid = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Higher level = more games played and higher winnings
  const baseGames = level * 50 + Math.floor(Math.random() * 100);
  const baseWinnings = level * 500 + Math.floor(Math.random() * 2000);
  
  return {
    uid,
    displayName: `${name}_${level}`,
    photoURL: avatar,
    isBot: true,
    botLevel: level,
    gamesPlayed: baseGames,
    totalWinnings: baseWinnings,
    createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000, // Random time in last 30 days
  };
}

/**
 * Create bot user in Firebase
 */
export async function createBotUser(bot: BotUser): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  
  // Create user document
  await setDoc(doc(db, "users", bot.uid), {
    uid: bot.uid,
    displayName: bot.displayName,
    photoURL: bot.photoURL,
    isBot: true,
    botLevel: bot.botLevel,
    gamesPlayed: bot.gamesPlayed,
    totalDeposits: 0,
    totalWithdrawals: 0,
    createdAt: bot.createdAt,
    kycStatus: "approved",
    referralCode: `BOT${bot.botLevel}`,
    referredBy: null,
  });
  
  // Create wallet with winning balance
  const winningBalance = Math.floor(bot.totalWinnings * 0.6); // 60% of winnings in wallet
  await setDoc(doc(db, "wallets", bot.uid), {
    uid: bot.uid,
    winning: winningBalance,
    deposit: 0,
    bonus: bot.totalWinnings - winningBalance,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update bot stats after a game
 */
export async function updateBotStats(
  botUid: string,
  won: boolean,
  amount: number
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  
  const batch = [
    updateDoc(doc(db, "users", botUid), {
      gamesPlayed: increment(1),
      totalWinnings: won ? increment(amount) : increment(0),
    }),
    updateDoc(doc(db, "wallets", botUid), {
      winning: won ? increment(amount) : increment(0),
      updatedAt: serverTimestamp(),
    }),
  ];
  
  await Promise.all(batch);
}

/**
 * Create multiple bot users for testing/leaderboard population
 */
export async function createBotPool(count: number = 10): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  
  const bots: BotUser[] = [];
  for (let i = 0; i < count; i++) {
    const level = Math.floor(Math.random() * 5) + 1; // Level 1-5
    bots.push(generateBotUser(level));
  }
  
  await Promise.all(bots.map(createBotUser));
}

// ─── BOT SIMULATION ───────────────────────────────────────────────────────────

/**
 * Simulate bot playing a game and updating leaderboard
 */
export async function simulateBotGame(
  botUid: string,
  gameType: "ludo" | "worldwar" | "carrom",
  score: number
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  
  // Update user stats
  await updateBotStats(botUid, true, score);
  
  // Update RTDB leaderboard (if using RTDB)
  // This would typically be done by thegame server, but for simulation:
  const leaderboardPath = `leaderboards/${gameType}/${botUid}`;
  // Note: RTDB updates would go here if RTDB is configured
}

/**
 * Get bot decision for game (win/lose based on bot level)
 */
export function getBotDecision(botLevel: number): { win: boolean; score: number } {
  // Higher level bots have higher win rate
  const winRate = 0.3 + (botLevel * 0.12); // Level 1: 42%, Level 5: 90%
  const win = Math.random() < winRate;
  
  // Score based on level
  const baseScore = botLevel * 1000;
  const variance = Math.floor(Math.random() * 500);
  const score = win ? baseScore + variance : Math.floor(baseScore * 0.5);
  
  return { win, score };
}
