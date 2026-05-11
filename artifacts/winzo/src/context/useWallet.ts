import { useContext } from "react";
import { WalletContext, WalletContextType } from "./WalletContext";

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
