/**
 * Twenty1Game — WINGGO 21 Card (Blackjack)
 * Hit / Stand, dealer AI (hits until ≥17), card flip animations, wallet integration.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Suit = "♠" | "♥" | "♦" | "♣";
interface Card { suit: Suit; rank: number; faceUp: boolean; }
type Phase = "matchmaking" | "playing" | "result";
type Result = "win" | "loss" | "push" | null;

function makeDeck(): Card[] {
  const suits: Suit[] = ["♠","♥","♦","♣"];
  const d: Card[] = [];
  for (const s of suits) for (let r = 1; r <= 13; r++) d.push({ suit: s, rank: r, faceUp: false });
  return shuffle(d);
}
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i+1)); [b[i],b[j]] = [b[j],b[i]]; }
  return b;
}
function rankStr(r: number) { return r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r); }
function isRed(s: Suit) { return s === "♥" || s === "♦"; }
function cardVal(r: number) { return r === 1 ? 11 : r >= 10 ? 10 : r; }
function handVal(hand: Card[]) {
  let sum = 0; let aces = 0;
  for (const c of hand.filter(c => c.faceUp)) { if (c.rank === 1) { aces++; sum += 11; } else sum += Math.min(c.rank, 10); }
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function CardView({ card, small }: { card: Card; small?: boolean }) {
  const w = small ? 38 : 54, h = small ? 54 : 76;
  const fs = small ? 9 : 12, fsm = small ? 14 : 22;
  if (!card.faceUp) return (
    <div style={{ width: w, height: h, borderRadius: 8, background: "linear-gradient(135deg,#1a0a3e,#0d0820)", border: "1.5px solid rgba(255,215,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink: 0 }}>
      <span style={{ fontSize: fsm, opacity: 0.6 }}>🂠</span>
    </div>
  );
  const red = isRed(card.suit);
  return (
    <div style={{ width: w, height: h, borderRadius: 8, background: "#fff", border: "1px solid rgba(0,0,0,0.15)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"space-between", padding: "3px 4px", boxShadow:"0 2px 8px rgba(0,0,0,0.5)", flexShrink: 0 }}>
      <span style={{ fontSize: fs, fontWeight:900, color: red?"#dc2626":"#1a1a1a", lineHeight:1, alignSelf:"flex-start" }}>{rankStr(card.rank)}{card.suit}</span>
      <span style={{ fontSize: fsm+2, lineHeight:1, color: red?"#dc2626":"#1a1a1a" }}>{card.suit}</span>
      <span style={{ fontSize: fs, fontWeight:900, color: red?"#dc2626":"#1a1a1a", lineHeight:1, alignSelf:"flex-end", transform:"rotate(180deg)" }}>{rankStr(card.rank)}{card.suit}</span>
    </div>
  );
}

function HandDisplay({ hand, label, total, flip }: { hand: Card[]; label: string; total: number; flip?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color:"rgba(255,255,255,0.45)" }}>{label}</span>
        <span className="text-sm font-black" style={{ color: total > 21 ? "#ef4444" : "#FFD700" }}>{total}</span>
      </div>
      <div className="flex gap-1.5 justify-center flex-wrap">
        <AnimatePresence>
          {hand.map((card, i) => (
            <motion.div key={i} initial={{ scale:0.5, opacity:0, y: flip ? -30 : 30 }} animate={{ scale:1, opacity:1, y:0 }} transition={{ delay: i*0.1, type:"spring", stiffness:280 }}>
              <CardView card={card} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MatchmakingScreen({ entryFee, onFound }: { entryFee: number; onFound: () => void }) {
  const [cd, setCd] = useState(3);
  const prize = Math.floor(entryFee * 2 * (1-PLATFORM_PCT));
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if(c<=1){clearInterval(t);setTimeout(onFound,300);return 0;}return c-1;}),900);
    return ()=>clearInterval(t);
  },[onFound]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background:"rgba(255,215,0,0.1)", border:"2px solid rgba(255,215,0,0.4)" }}
        animate={{ scale:[1,1.07,1], boxShadow:["0 0 30px rgba(255,215,0,0.2)","0 0 60px rgba(255,215,0,0.5)","0 0 30px rgba(255,215,0,0.2)"] }}
        transition={{ duration:1.4, repeat:Infinity }}>🃏</motion.div>
      <div className="text-center">
        <div className="text-white font-black text-xl">Finding Dealer...</div>
        <div className="text-sm mt-0.5" style={{ color:"rgba(255,255,255,0.4)" }}>Setting up casino table</div>
      </div>
      <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{ background:"rgba(255,215,0,0.07)", border:"1px solid rgba(255,215,0,0.25)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color:"rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color:"#FFD700" }}>₹{entryFee}</div></div>
        <div className="h-8 w-px" style={{ background:"rgba(255,255,255,0.12)" }}/>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color:"rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color:"#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-center text-[10px] font-bold" style={{ color:"rgba(255,165,0,0.7)" }}>⏳ {cd}s — dealer joining...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function Twenty1Game({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [result, setResult] = useState<Result>(null);
  const [msg, setMsg] = useState("");
  const busy = useRef(false);
  const prize = Math.floor(initialFee * 2 * (1-PLATFORM_PCT));

  function dealGame() {
    const d = makeDeck();
    const p: Card[] = [{ ...d[0], faceUp:true }, { ...d[1], faceUp:true }];
    const dealer: Card[] = [{ ...d[2], faceUp:true }, { ...d[3], faceUp:false }];
    setDeck(d.slice(4));
    setPlayerHand(p);
    setDealerHand(dealer);
    setResult(null);
    setMsg("");
    // Natural blackjack?
    const pv = handVal(p);
    if (pv === 21) {
      // reveal dealer then check
      setTimeout(() => finishRound(d.slice(4), p, dealer.map(c=>({...c,faceUp:true}))), 600);
    }
  }

  function startGame() { setPhase("playing"); dealGame(); }

  async function finishRound(deckLeft: Card[], pHand: Card[], dHand: Card[]) {
    busy.current = true;
    // Dealer plays
    let dh = [...dHand.map(c=>({...c,faceUp:true}))];
    let dk = [...deckLeft];
    setDealerHand(dh);
    await delay(500);
    while (handVal(dh) < 17 && dk.length > 0) {
      dh = [...dh, { ...dk[0], faceUp:true }];
      dk = dk.slice(1);
      setDealerHand([...dh]);
      await delay(600);
    }
    const pv = handVal(pHand);
    const dv = handVal(dh);
    let res: Result;
    if (pv > 21) { res = "loss"; setMsg("Bust! You went over 21."); }
    else if (dv > 21) { res = "win"; setMsg("Dealer busts! You win!"); }
    else if (pv > dv) { res = "win"; setMsg("You win! Higher hand."); }
    else if (dv > pv) { res = "loss"; setMsg("Dealer wins. Better luck!"); }
    else { res = "push"; setMsg("Push — it's a tie!"); }
    setResult(res);
    setPhase("result");
    if (res === "win") addWinning(prize, `🃏 21 Card — Won ₹${prize}`);
    if (res === "push") addWinning(initialFee, `🃏 21 Card — Push refund ₹${initialFee}`);
    busy.current = false;
  }

  async function handleHit() {
    if (busy.current || phase !== "playing") return;
    if (deck.length === 0) return;
    const newCard = { ...deck[0], faceUp: true };
    const newDeck = deck.slice(1);
    const newHand = [...playerHand, newCard];
    setDeck(newDeck);
    setPlayerHand(newHand);
    if (handVal(newHand) >= 21) {
      await delay(400);
      finishRound(newDeck, newHand, dealerHand);
    }
  }

  async function handleStand() {
    if (busy.current || phase !== "playing") return;
    busy.current = true;
    await finishRound(deck, playerHand, dealerHand);
  }

  function handleRematch() {
    setPhase("matchmaking");
    setDeck([]); setPlayerHand([]); setDealerHand([]);
    setResult(null); setMsg("");
    busy.current = false;
  }

  const pVal = handVal(playerHand);
  const dVal = handVal(dealerHand.map(c => c.faceUp ? c : { ...c, faceUp: false }));
  const showingDVal = handVal(dealerHand.filter(c => c.faceUp));

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background:"radial-gradient(ellipse at top,#0a1a00 0%,#07060e 60%)", maxWidth:480, margin:"0 auto" }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background:"rgba(7,6,14,0.92)", backdropFilter:"blur(20px)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color:"rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🃏</span><span className="font-black text-white text-base">21 Card</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.22)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color:"#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase === "matchmaking" && <MatchmakingScreen entryFee={initialFee} onFound={startGame} />}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col gap-4 px-4 py-4">
          {/* Dealer hand */}
          <div className="rounded-2xl p-4" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)" }}>
            <HandDisplay hand={dealerHand} label="🤖 Dealer" total={showingDVal} flip />
          </div>

          {/* Prize info */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-center px-4 py-2 rounded-xl" style={{ background:"rgba(255,215,0,0.07)", border:"1px solid rgba(255,215,0,0.2)" }}>
              <div className="text-[10px] font-bold" style={{ color:"rgba(255,215,0,0.5)" }}>PRIZE POOL</div>
              <div className="text-lg font-black" style={{ color:"#FFD700" }}>₹{prize}</div>
            </div>
            <div className="text-2xl font-black" style={{ color:"rgba(255,255,255,0.2)" }}>VS</div>
            <div className="text-center px-4 py-2 rounded-xl" style={{ background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.2)" }}>
              <div className="text-[10px] font-bold" style={{ color:"rgba(34,197,94,0.5)" }}>TARGET</div>
              <div className="text-lg font-black" style={{ color:"#22c55e" }}>21</div>
            </div>
          </div>

          {/* Player hand */}
          <div className="rounded-2xl p-4" style={{ background:"rgba(255,215,0,0.04)", border:"1px solid rgba(255,215,0,0.15)" }}>
            <HandDisplay hand={playerHand} label="👤 You" total={pVal} />
          </div>

          {/* Status */}
          <div className="text-center">
            <span className="text-sm font-bold" style={{ color: pVal > 21 ? "#ef4444" : pVal === 21 ? "#FFD700" : "rgba(255,255,255,0.5)" }}>
              {pVal > 21 ? "💥 Bust!" : pVal === 21 ? "🎉 Blackjack!" : `Your total: ${pVal}`}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <motion.button whileTap={{ scale:0.95 }} onClick={handleHit}
              className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
              style={{ background:"linear-gradient(135deg,#22c55e,#15803d)", color:"#fff", boxShadow:"0 0 24px rgba(34,197,94,0.4)" }}>
              🃏 HIT
            </motion.button>
            <motion.button whileTap={{ scale:0.95 }} onClick={handleStand}
              className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
              style={{ background:"linear-gradient(135deg,#FFD700,#ff8c00)", color:"#000", boxShadow:"0 0 24px rgba(255,215,0,0.4)" }}>
              ✋ STAND
            </motion.button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8"
          initial={{ opacity:0, y:40 }} animate={{ opacity:1, y:0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: result==="win"?"rgba(255,215,0,0.15)":result==="push"?"rgba(100,100,255,0.15)":"rgba(239,68,68,0.12)", border:`3px solid ${result==="win"?"rgba(255,215,0,0.5)":result==="push"?"rgba(100,100,255,0.4)":"rgba(239,68,68,0.4)"}`, boxShadow: result==="win"?"0 0 60px rgba(255,215,0,0.4)":result==="push"?"0 0 40px rgba(100,100,255,0.3)":"0 0 40px rgba(239,68,68,0.3)" }}>
            {result==="win"?"🏆":result==="push"?"🤝":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: result==="win"?"#FFD700":result==="push"?"#6666ff":"#ef4444" }}>{result==="win"?"You Win! 🎉":result==="push"?"It's a Push":"Dealer Wins"}</div>
            <div className="text-sm mt-1" style={{ color:"rgba(255,255,255,0.4)" }}>{msg}</div>
          </div>
          {/* Hands summary */}
          <div className="w-full rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex justify-around px-4 py-3" style={{ background:"rgba(255,255,255,0.04)" }}>
              <div className="text-center"><div className="text-xs" style={{ color:"rgba(255,255,255,0.4)" }}>Your Hand</div><div className="text-xl font-black text-white">{handVal(playerHand)}</div></div>
              <div className="text-center"><div className="text-xs" style={{ color:"rgba(255,255,255,0.4)" }}>Dealer Hand</div><div className="text-xl font-black text-white">{handVal(dealerHand.map(c=>({...c,faceUp:true})))}</div></div>
            </div>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: result==="win"?"rgba(255,215,0,0.06)":result==="push"?"rgba(100,100,255,0.05)":"rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{result==="win"?"Winnings":result==="push"?"Refund":"You Lost"}</span>
              <span className="text-xl font-black" style={{ color: result==="win"?"#FFD700":result==="push"?"#6666ff":"#ef4444" }}>{result==="win"?`+₹${prize}`:result==="push"?`₹${initialFee}`:` -₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale:0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
            style={{ background:"linear-gradient(135deg,#FFD700,#ff8c00)", color:"#000", boxShadow:"0 0 28px rgba(255,215,0,0.45)" }}>
            🃏 Deal Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color:"rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
