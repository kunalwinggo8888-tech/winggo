/**
 * MatchHistoryContext — WINGGO
 * Persists per-match results in localStorage.
 * Provides addMatch() so any game screen can record outcomes.
 */
import { createContext, useState, useCallback, useEffect, ReactNode } from "react";
import { saveMatchToFirestore } from "@/firebase/firestore.service";
import { useAuth } from "@/context/useAuth";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface TeamStat {
  teamName: string;
  icon: string;
  color: string;
  score: number;
  isPlayer: boolean;
}

export interface MatchRecord {
  id: string;
  gameId: string;
  gameName: string;
  gameIcon: string;
  date: string;
  result: "win" | "loss";
  entryFee: number;
  prize: number;
  userScore?: number;
  opponentScore?: number;
  teamStats?: TeamStat[];
  opponentName?: string;
  isGodMode?: boolean;
  roomId?: string;
}

export interface MatchHistoryContextType {
  matches: MatchRecord[];
  addMatch: (m: Omit<MatchRecord, "id" | "date">) => void;
  clearHistory: () => void;
  totalEarnings: number;
  totalMatches: number;
  wins: number;
}

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

export const MatchHistoryContext = createContext<MatchHistoryContextType | null>(null);

const LS_KEY = "winggo_match_history";

function loadMatches(uid: string | null): MatchRecord[] {
  if (!uid) return [];
  try {
    const raw = localStorage.getItem(`${LS_KEY}_${uid}`);
    return raw ? (JSON.parse(raw) as MatchRecord[]) : [];
  } catch {
    return [];
  }
}

function saveMatches(uid: string, matches: MatchRecord[]) {
  try {
    localStorage.setItem(`${LS_KEY}_${uid}`, JSON.stringify(matches.slice(0, 200)));
  } catch { /* storage full — non-fatal */ }
}

export function MatchHistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [matches, setMatches] = useState<MatchRecord[]>(() => loadMatches(uid));

  useEffect(() => {
    setMatches(loadMatches(uid));
  }, [uid]);

  const addMatch = useCallback((m: Omit<MatchRecord, "id" | "date">) => {
    const record: MatchRecord = {
      ...m,
      id:   `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
    };
    setMatches((prev) => {
      const next = [record, ...prev].slice(0, 200);
      if (uid) saveMatches(uid, next);
      return next;
    });
    // Also save to Firestore so admin panel can read match history
    if (uid) saveMatchToFirestore(uid, record).catch(() => {/* non-fatal */});
  }, [uid]);

  const clearHistory = useCallback(() => {
    setMatches([]);
    if (uid) try { localStorage.removeItem(`${LS_KEY}_${uid}`); } catch { /* ignore */ }
  }, [uid]);

  const totalEarnings = matches.reduce((sum, m) => sum + (m.prize || 0), 0);
  const wins          = matches.filter((m) => m.result === "win").length;

  return (
    <MatchHistoryContext.Provider value={{
      matches, addMatch, clearHistory,
      totalEarnings, totalMatches: matches.length, wins,
    }}>
      {children}
    </MatchHistoryContext.Provider>
  );
}
