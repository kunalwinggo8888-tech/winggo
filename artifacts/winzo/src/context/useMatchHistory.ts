import { useContext } from "react";
import { MatchHistoryContext, MatchHistoryContextType } from "./MatchHistoryContext";

export function useMatchHistory(): MatchHistoryContextType {
  const ctx = useContext(MatchHistoryContext);
  if (!ctx) throw new Error("useMatchHistory must be used inside MatchHistoryProvider");
  return ctx;
}
