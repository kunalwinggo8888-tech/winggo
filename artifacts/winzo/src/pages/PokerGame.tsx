/**
 * PokerGame — WINGGO Texas Hold'em Poker (Heads-up)
 * Pre-flop → Flop → Turn → River → Showdown. Fold/Check/Call/Raise.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Suit = "♠"|"♥"|"♦"|"♣";
interface Card { suit:Suit; rank:number; faceUp:boolean }
type Phase = "matchmaking"|"playing"|"result";
type Street = "preflop"|"flop"|"turn"|"river"|"showdown";
type Action = "fold"|"check"|"call"|"raise";

const SUITS:Suit[]=["♠","♥","♦","♣"];
function shuffle<T>(a:T[]):T[]{ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function makeDeck():Card[]{ const d:Card[]=[]; for(const s of SUITS) for(let r=1;r<=13;r++) d.push({suit:s,rank:r,faceUp:false}); return shuffle(d); }
function isRed(s:Suit){ return s==="♥"||s==="♦"; }
function rankStr(r:number){ return r===1?"A":r===11?"J":r===12?"Q":r===13?"K":String(r); }

// --- Hand evaluation ---
function rankValue(r:number){ return r===1?14:r; }
function handRank(cards:Card[]):{rank:number;desc:string}{
  if(cards.length<5) return {rank:0,desc:"?"};
  const vals=cards.map(c=>rankValue(c.rank)).sort((a,b)=>b-a);
  const suits=cards.map(c=>c.suit);
  const counts:Record<number,number>={};
  for(const v of vals) counts[v]=(counts[v]||0)+1;
  const pairs=Object.entries(counts).filter(([,n])=>n===2).length;
  const trips=Object.entries(counts).filter(([,n])=>n===3).length;
  const quads=Object.entries(counts).filter(([,n])=>n===4).length;
  const isFlush=suits.every(s=>s===suits[0]);
  const straight=vals.every((v,i)=>i===0||vals[i-1]-v===1)||(vals[0]===14&&vals[1]===5&&vals[2]===4&&vals[3]===3&&vals[4]===2);
  if(isFlush&&straight) return {rank:8,desc:"Straight Flush!"};
  if(quads) return {rank:7,desc:"Four of a Kind!"};
  if(trips&&pairs) return {rank:6,desc:"Full House!"};
  if(isFlush) return {rank:5,desc:"Flush!"};
  if(straight) return {rank:4,desc:"Straight!"};
  if(trips) return {rank:3,desc:"Three of a Kind"};
  if(pairs===2) return {rank:2,desc:"Two Pair"};
  if(pairs===1) return {rank:1,desc:"One Pair"};
  return {rank:0,desc:`High ${rankStr(vals[0])}`};
}

function bestHand(hole:Card[],community:Card[]):{rank:number;desc:string}{
  const all=[...hole,...community].map(c=>({...c,faceUp:true}));
  if(all.length<5) return {rank:0,desc:"?"};
  // Try all C(n,5) combos
  let best={rank:-1,desc:""};
  function choose(idx:number,chosen:Card[]){
    if(chosen.length===5){ const h=handRank(chosen); if(h.rank>best.rank) best=h; return; }
    if(idx>=all.length) return;
    choose(idx+1,[...chosen,all[idx]]); choose(idx+1,chosen);
  }
  choose(0,[]);
  return best;
}

function CardView({ card, small }:{ card:Card; small?:boolean }){
  const w=small?34:48, h=small?48:68;
  if(!card.faceUp) return <div style={{width:w,height:h,borderRadius:8,background:"linear-gradient(135deg,#1a0a3e,#0d0820)",border:"1.5px solid rgba(255,215,0,0.3)",flexShrink:0}}/>;
  const red=isRed(card.suit);
  return (
    <div style={{width:w,height:h,borderRadius:8,background:"#fff",border:`1px solid ${red?"rgba(220,38,38,0.35)":"rgba(0,0,0,0.2)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"3px 4px",boxShadow:"0 2px 8px rgba(0,0,0,0.5)",flexShrink:0}}>
      <span style={{fontSize:small?9:11,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-start"}}>{rankStr(card.rank)}{card.suit}</span>
      <span style={{fontSize:small?12:18,color:red?"#dc2626":"#1a1a1a",lineHeight:1}}>{card.suit}</span>
      <span style={{fontSize:small?9:11,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{rankStr(card.rank)}{card.suit}</span>
    </div>
  );
}

const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));

interface Props { onBack:()=>void; initialFee?:number }

export default function PokerGame({ onBack, initialFee=10 }:Props){
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [deck,setDeck]=useState<Card[]>([]);
  const [playerCards,setPlayerCards]=useState<Card[]>([]);
  const [botCards,setBotCards]=useState<Card[]>([]);
  const [community,setCommunity]=useState<Card[]>([]);
  const [pot,setPot]=useState(0);
  const [playerStack,setPlayerStack]=useState(initialFee*10);
  const [botStack,setBotStack]=useState(initialFee*10);
  const [playerBet,setPlayerBet]=useState(0);
  const [botBet,setBotBet]=useState(0);
  const [street,setStreet]=useState<Street>("preflop");
  const [msg,setMsg]=useState("");
  const [winner,setWinner]=useState<"player"|"bot"|"tie"|null>(null);
  const [showBotCards,setShowBotCards]=useState(false);
  const busy=useRef(false);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));
  const BB=Math.max(1,Math.floor(initialFee/2));

  function startRound(){
    const d=makeDeck();
    const ph=[{...d[0],faceUp:true},{...d[1],faceUp:true}];
    const bh=[{...d[2],faceUp:false},{...d[3],faceUp:false}];
    setDeck(d.slice(4)); setPlayerCards(ph); setBotCards(bh);
    setCommunity([]); setStreet("preflop");
    setPot(BB*3); setPlayerBet(BB); setBotBet(BB*2);
    setPlayerStack(s=>s-BB); setBotStack(s=>s-BB*2);
    setMsg("Pre-flop — Act!"); setWinner(null); setShowBotCards(false);
    busy.current=false;
  }

  async function dealNext(d:Card[], comm:Card[], str:Street){
    if(str==="preflop"){
      const f=[{...d[0],faceUp:true},{...d[1],faceUp:true},{...d[2],faceUp:true}];
      setCommunity(f); setDeck(d.slice(3)); setStreet("flop"); setMsg("Flop — Act!"); setPlayerBet(0); setBotBet(0);
    } else if(str==="flop"){
      const t={...d[0],faceUp:true};
      setCommunity([...comm,t]); setDeck(d.slice(1)); setStreet("turn"); setMsg("Turn — Act!"); setPlayerBet(0); setBotBet(0);
    } else if(str==="turn"){
      const r={...d[0],faceUp:true};
      setCommunity([...comm,r]); setDeck(d.slice(1)); setStreet("river"); setMsg("River — Act!"); setPlayerBet(0); setBotBet(0);
    } else {
      // Showdown
      setStreet("showdown");
      const ph=bestHand(playerCards,[...comm]).rank;
      const bh=bestHand(botCards,[...comm]).rank;
      const bhd=bestHand(botCards,[...comm]).desc;
      const phd=bestHand(playerCards,[...comm]).desc;
      setShowBotCards(true);
      await delay(800);
      let w:"player"|"bot"|"tie";
      if(ph>bh) w="player"; else if(bh>ph) w="bot"; else w="tie";
      setWinner(w);
      if(w==="player"){ setPlayerStack(s=>s+pot); addWinning(Math.floor(pot*0.9),`♦️ Poker — Won ₹${Math.floor(pot*0.9)}`); }
      else if(w==="tie"){ setPlayerStack(s=>s+Math.floor(pot/2)); }
      else setBotStack(s=>s+pot);
      setMsg(w==="player"?`You win! ${phd}`:w==="tie"?`Tie! ${phd} vs ${bhd}`:`Bot wins! ${bhd}`);
      setPhase("result");
    }
  }

  async function botDecision(d:Card[], comm:Card[], str:Street){
    await delay(1000+Math.random()*800);
    const bh=bestHand(botCards,[...comm]).rank;
    const strong=bh>=3;
    // Bot action
    if(playerBet>botBet){
      if(strong){ setBotBet(playerBet); setPot(p=>p+(playerBet-botBet)); setBotStack(s=>s-(playerBet-botBet)); }
      else { setWinner("player"); setPlayerStack(s=>s+pot+playerBet); addWinning(Math.floor((pot+playerBet)*0.9),`♦️ Poker — Won`); setMsg("Bot folded! You win!"); setPhase("result"); return; }
    }
    dealNext(d,comm,str);
  }

  async function handleAction(action:Action){
    if(busy.current) return; busy.current=true;
    if(action==="fold"){ setWinner("bot"); setBotStack(s=>s+pot); setMsg("You folded. Bot wins."); setPhase("result"); return; }
    const raise=action==="raise"?BB*4:0;
    const call=Math.max(0,botBet-playerBet);
    const add=action==="raise"?call+raise:call;
    if(add>0){ setPlayerBet(b=>b+add); setPlayerStack(s=>s-add); setPot(p=>p+add); }
    setMsg("Bot thinking..."); busy.current=false;
    await botDecision(deck,community,street);
  }

  function handleRematch(){
    setPhase("matchmaking"); setDeck([]); setPlayerCards([]); setBotCards([]); setCommunity([]);
    setPot(0); setPlayerStack(initialFee*10); setBotStack(initialFee*10); setPlayerBet(0); setBotBet(0);
    setStreet("preflop"); setMsg(""); setWinner(null); setShowBotCards(false); busy.current=false;
  }

  const callAmt=Math.max(0,botBet-playerBet);
  const canCheck=callAmt===0;

  return (
    <div className="flex flex-col min-h-screen" style={{background:"radial-gradient(ellipse at top,#001a00 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">♦️</span><span className="font-black text-white text-base">Poker</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(0,200,81,0.1)",border:"1px solid rgba(0,200,81,0.25)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
            style={{background:"rgba(0,200,81,0.12)",border:"2px solid rgba(0,200,81,0.4)"}}
            animate={{scale:[1,1.07,1]}} transition={{duration:1.4,repeat:Infinity}}>♦️</motion.div>
          <div className="text-center"><div className="text-white font-black text-xl">Poker Table</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>Texas Hold'em Heads-Up</div></div>
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(0,200,81,0.07)",border:"1px solid rgba(0,200,81,0.3)"}}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{initialFee}</div></div>
            <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>POT</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{initialFee*2}</div></div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={()=>{setPhase("playing");startRound();}}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#00c851,#007e33)",color:"#fff",boxShadow:"0 0 28px rgba(0,200,81,0.45)"}}>
            ♦️ Deal Cards
          </motion.button>
        </div>
      )}

      {phase==="playing" && (
        <div className="flex-1 flex flex-col gap-3 px-3 py-3">
          {/* Bot */}
          <div className="rounded-2xl p-3" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-white">🤖 Bot</span>
              <span className="text-xs font-bold" style={{color:"rgba(34,197,94,0.7)"}}>Stack: {botStack}</span>
            </div>
            <div className="flex gap-2 justify-center">
              {botCards.map((c,i)=><CardView key={i} card={showBotCards?{...c,faceUp:true}:c}/>)}
            </div>
          </div>

          {/* Community + pot */}
          <div className="rounded-2xl p-3 text-center" style={{background:"rgba(0,200,81,0.05)",border:"1px solid rgba(0,200,81,0.2)"}}>
            <div className="text-[10px] font-bold mb-2" style={{color:"rgba(0,200,81,0.6)"}}>COMMUNITY CARDS — {street.toUpperCase()}</div>
            <div className="flex gap-2 justify-center mb-2">
              {community.map((c,i)=><CardView key={i} card={c}/>)}
              {Array.from({length:5-community.length},(_,i)=>(
                <div key={i} style={{width:48,height:68,borderRadius:8,border:"1.5px dashed rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.02)",flexShrink:0}}/>
              ))}
            </div>
            <div className="font-black text-xl" style={{color:"#FFD700"}}>POT: {pot}</div>
          </div>

          {/* Player */}
          <div className="rounded-2xl p-3" style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.15)"}}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-white">👤 You</span>
              <span className="text-xs font-bold" style={{color:"rgba(255,215,0,0.7)"}}>Stack: {playerStack}</span>
            </div>
            <div className="flex gap-2 justify-center mb-2">
              {playerCards.map((c,i)=><CardView key={i} card={c}/>)}
            </div>
            {playerCards.length>0&&community.length>0&&(
              <div className="text-center text-xs font-bold" style={{color:"rgba(255,255,255,0.4)"}}>
                {bestHand(playerCards,community).desc}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="text-center text-sm font-bold" style={{color:"rgba(255,255,255,0.5)"}}>{msg}</div>

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button whileTap={{scale:0.95}} onClick={()=>handleAction("fold")}
              className="flex-1 py-3 rounded-2xl font-black text-sm cursor-pointer"
              style={{background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444"}}>
              🏳 Fold
            </motion.button>
            <motion.button whileTap={{scale:0.95}} onClick={()=>handleAction(canCheck?"check":"call")}
              className="flex-1 py-3 rounded-2xl font-black text-sm cursor-pointer"
              style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"white"}}>
              {canCheck?"✓ Check":`📞 Call ${callAmt}`}
            </motion.button>
            <motion.button whileTap={{scale:0.95}} onClick={()=>handleAction("raise")}
              className="flex-1 py-3 rounded-2xl font-black text-sm cursor-pointer"
              style={{background:"linear-gradient(135deg,#00c851,#007e33)",color:"#fff",boxShadow:"0 0 16px rgba(0,200,81,0.3)"}}>
              📈 Raise
            </motion.button>
          </div>
        </div>
      )}

      {phase==="result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:winner==="player"?"rgba(0,200,81,0.15)":winner==="tie"?"rgba(148,163,184,0.12)":"rgba(239,68,68,0.1)",border:`3px solid ${winner==="player"?"rgba(0,200,81,0.5)":winner==="tie"?"rgba(148,163,184,0.4)":"rgba(239,68,68,0.4)"}`,boxShadow:winner==="player"?"0 0 60px rgba(0,200,81,0.4)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {winner==="player"?"🏆":winner==="tie"?"🤝":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:winner==="player"?"#00c851":winner==="tie"?"#94a3b8":"#ef4444"}}>{winner==="player"?"You Win! 🎉":winner==="tie"?"It's a Tie!":"Bot Wins!"}</div>
            <div className="text-sm mt-1" style={{color:"rgba(255,255,255,0.4)"}}>{msg}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4" style={{background:winner==="player"?"rgba(0,200,81,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{winner==="player"?"Winnings":winner==="tie"?"Refund":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:winner==="player"?"#00c851":winner==="tie"?"#94a3b8":"#ef4444"}}>{winner==="player"?`+₹${Math.floor(pot*0.9)}`:winner==="tie"?`₹${Math.floor(pot/2)}`:`-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#00c851,#007e33)",color:"#fff",boxShadow:"0 0 28px rgba(0,200,81,0.45)"}}>
            ♦️ New Hand
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
