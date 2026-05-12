/**
 * CallBreakGame — WINGGO Call Break (Spade Trump Trick-Taking)
 * 4 players (You + 3 bots), bid system, 13 tricks, 5 rounds, score tracking.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Suit = "♠"|"♥"|"♦"|"♣";
interface Card { suit:Suit; rank:number }
type Phase = "matchmaking"|"bidding"|"playing"|"roundEnd"|"result";
const TRUMP:Suit="♠";
const SUITS:Suit[]=["♠","♥","♦","♣"];
const RANKS=Array.from({length:13},(_,i)=>i+1);
const TRUMP_ORDER=[14,13,12,11,10,9,8,7,6,5,4,3,2]; // Ace high for trump

function shuffle<T>(a:T[]):T[]{ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function isRed(s:Suit){ return s==="♥"||s==="♦"; }
function rankStr(r:number){ return r===1?"A":r===11?"J":r===12?"Q":r===13?"K":String(r); }
function rankVal(r:number){ return r===1?14:r; }
function cardBeats(challenger:Card, current:Card, led:Suit):boolean{
  if(challenger.suit===TRUMP&&current.suit!==TRUMP) return true;
  if(current.suit===TRUMP&&challenger.suit!==TRUMP) return false;
  if(challenger.suit===current.suit) return rankVal(challenger.rank)>rankVal(current.rank);
  return false;
}

function makeDeal():Card[][]{
  const deck:Card[]=[];
  for(const s of SUITS) for(const r of RANKS) deck.push({suit:s,rank:r});
  const sh=shuffle(deck);
  return [sh.slice(0,13),sh.slice(13,26),sh.slice(26,39),sh.slice(39,52)];
}

function CardView({ card, small, selected, onClick }:{card:Card;small?:boolean;selected?:boolean;onClick?:()=>void}){
  const w=small?26:38, h=small?38:54;
  const red=isRed(card.suit), isTrump=card.suit===TRUMP;
  return (
    <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:selected?"#fff9e0":"#fff",border:`1.5px solid ${selected?"rgba(255,215,0,0.9)":isTrump?"rgba(80,80,255,0.4)":red?"rgba(220,38,38,0.3)":"rgba(0,0,0,0.2)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"2px 3px",boxShadow:selected?"0 0 12px rgba(255,215,0,0.5)":isTrump?"0 0 6px rgba(80,80,255,0.3)":"0 2px 4px rgba(0,0,0,0.4)",flexShrink:0,cursor:onClick?"pointer":"default"}}>
      <span style={{fontSize:small?7:9,fontWeight:900,color:red?"#dc2626":isTrump?"#3b3bff":"#1a1a1a",lineHeight:1,alignSelf:"flex-start"}}>{rankStr(card.rank)}{card.suit}</span>
      <span style={{fontSize:small?9:13,color:red?"#dc2626":isTrump?"#3b3bff":"#1a1a1a",lineHeight:1}}>{card.suit}</span>
      <span style={{fontSize:small?7:9,fontWeight:900,color:red?"#dc2626":isTrump?"#3b3bff":"#1a1a1a",lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{rankStr(card.rank)}{card.suit}</span>
    </div>
  );
}

const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const PLAYERS=["You","Bot A","Bot B","Bot C"];

interface Props { onBack:()=>void; initialFee?:number }

export default function CallBreakGame({ onBack, initialFee=10 }:Props){
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [hands,setHands]=useState<Card[][]>([[],[],[],[]]);
  const [bids,setBids]=useState([0,0,0,0]);
  const [roundScores,setRoundScores]=useState([0,0,0,0]); // tricks won this round
  const [totalScores,setTotalScores]=useState([0,0,0,0]); // cumulative
  const [trick,setTrick]=useState<{card:Card;player:number}[]>([]);
  const [currentPlayer,setCurrentPlayer]=useState(0);
  const [round,setRound]=useState(1);
  const [bidInput,setBidInput]=useState(2);
  const [biddingIdx,setBiddingIdx]=useState(0);
  const [trickWinner,setTrickWinner]=useState<number|null>(null);
  const [msg,setMsg]=useState("");
  const busy=useRef(false);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));
  const MAX_ROUNDS=5;

  function startRound(){
    const deal=makeDeal();
    // Sort hands: spades first, then by rank desc
    const sorted=deal.map(h=>[...h].sort((a,b)=>{
      if(a.suit===TRUMP&&b.suit!==TRUMP) return -1;
      if(b.suit===TRUMP&&a.suit!==TRUMP) return 1;
      if(a.suit!==b.suit) return a.suit.localeCompare(b.suit);
      return rankVal(b.rank)-rankVal(a.rank);
    }));
    setHands(sorted); setBids([0,0,0,0]); setRoundScores([0,0,0,0]);
    setTrick([]); setCurrentPlayer(0); setBiddingIdx(0); setBidInput(2);
    setMsg(`Round ${round} — Bidding phase`); setPhase("bidding"); busy.current=false;
  }

  async function submitBid(){
    if(biddingIdx!==0) return;
    const nb=[...bids]; nb[0]=bidInput; setBids(nb);
    setBiddingIdx(1);
    // Bots bid
    await delay(500);
    const nb2=[...nb];
    for(let i=1;i<4;i++){
      await delay(600);
      const trumpCount=hands[i].filter(c=>c.suit===TRUMP).length;
      nb2[i]=Math.max(1,Math.min(8,trumpCount+Math.floor(Math.random()*2)));
      setBids([...nb2]); setBiddingIdx(i+1);
    }
    await delay(400);
    setPhase("playing"); setMsg("Your turn — play a card"); busy.current=false;
  }

  function getLedSuit():Suit|null{ return trick.length>0?trick[0].card.suit:null; }

  function getPlayable(hand:Card[]):Card[]{
    const led=getLedSuit();
    if(!led) return hand;
    const hasLed=hand.some(c=>c.suit===led);
    if(hasLed) return hand.filter(c=>c.suit===led);
    return hand; // can play anything
  }

  async function handlePlayCard(card:Card){
    if(currentPlayer!==0||phase!=="playing"||busy.current) return;
    const playable=getPlayable(hands[0]);
    if(!playable.some(c=>c.suit===card.suit&&c.rank===card.rank)){
      setMsg("Invalid card — you must follow suit if possible"); return;
    }
    busy.current=true;
    const newTrick=[...trick,{card,player:0}];
    const newHand=hands[0].filter(c=>!(c.suit===card.suit&&c.rank===card.rank));
    setHands(h=>{const n=[...h];n[0]=newHand;return n;}); setTrick(newTrick);
    await playBots(newTrick,newHand);
  }

  async function playBots(t:{card:Card;player:number}[], ph:Card[]){
    let tr=[...t];
    for(let i=1;i<4;i++){
      await delay(800+Math.random()*400);
      const hand=i===1?hands[1]:i===2?hands[2]:hands[3];
      const led=getLedSuitFrom(tr);
      const playable=getPlayableFrom(hand,led);
      // Bot strategy: play highest trump if can win, else lowest playable
      const trumps=playable.filter(c=>c.suit===TRUMP).sort((a,b)=>rankVal(b.rank)-rankVal(a.rank));
      const current=tr.reduce((best,{card:c})=>(!best||cardBeats(c,best,led??c.suit))?c:best,null as Card|null);
      let play:Card;
      if(trumps.length>0&&(!current||current.suit!==TRUMP)) play=trumps[0];
      else play=playable.sort((a,b)=>rankVal(a.rank)-rankVal(b.rank))[0];
      tr=[...tr,{card:play,player:i}];
      setHands(h=>{const n=[...h];n[i]=h[i].filter(c=>!(c.suit===play.suit&&c.rank===play.rank));return n;});
      setTrick([...tr]);
    }
    // Determine trick winner
    const led=getLedSuitFrom(tr);
    let winner=tr[0];
    for(const entry of tr.slice(1)){ if(cardBeats(entry.card,winner.card,led??entry.card.suit)) winner=entry; }
    setTrickWinner(winner.player);
    await delay(900);
    const newRS=[...roundScores]; newRS[winner.player]++; setRoundScores(newRS);
    setTrickWinner(null); setTrick([]);
    if(ph.length===0){
      // Round over
      busy.current=false;
      finishRound(newRS);
    } else {
      setCurrentPlayer(winner.player);
      setMsg(winner.player===0?"Your turn — play a card":`${PLAYERS[winner.player]} won the trick`);
      if(winner.player!==0){
        busy.current=false;
        await delay(500);
        await botsPlayLead([],winner.player,ph);
      } else busy.current=false;
    }
  }

  async function botsPlayLead(t:{card:Card;player:number}[], startPlayer:number, ph:Card[]){
    if(startPlayer===0) return;
    busy.current=true;
    let tr=[...t];
    for(let i=startPlayer;i!==0;i=(i+1)%4){
      await delay(800);
      const hand=hands[i];
      const led=getLedSuitFrom(tr);
      const playable=getPlayableFrom(hand,led);
      const play=playable.sort((a,b)=>rankVal(b.rank)-rankVal(a.rank))[0];
      tr=[...tr,{card:play,player:i}];
      setHands(h=>{const n=[...h];n[i]=h[i].filter(c=>!(c.suit===play.suit&&c.rank===play.rank));return n;});
      setTrick([...tr]);
    }
    busy.current=false;
    setCurrentPlayer(0); setMsg("Your turn — play a card");
  }

  function getLedSuitFrom(t:{card:Card}[]){return t.length>0?t[0].card.suit:null;}
  function getPlayableFrom(hand:Card[],led:Suit|null){
    if(!led) return hand;
    const hasLed=hand.some(c=>c.suit===led);
    return hasLed?hand.filter(c=>c.suit===led):hand;
  }

  function finishRound(rs:number[]){
    // Score: made bid = bid pts, failed = -bid pts, bonus for each extra trick
    const ts=[...totalScores];
    for(let i=0;i<4;i++){
      if(rs[i]>=bids[i]) ts[i]+=bids[i]+(rs[i]-bids[i])*0.1;
      else ts[i]-=bids[i];
    }
    setTotalScores(ts);
    if(round>=MAX_ROUNDS){ setPhase("result"); const won=ts[0]>=ts[1]&&ts[0]>=ts[2]&&ts[0]>=ts[3]; if(won) addWinning(prize,`♠️ Call Break — Won ₹${prize}`); }
    else { setRound(r=>r+1); setPhase("roundEnd"); }
  }

  const won=totalScores[0]>=totalScores[1]&&totalScores[0]>=totalScores[2]&&totalScores[0]>=totalScores[3];

  return (
    <div className="flex flex-col min-h-screen" style={{background:"radial-gradient(ellipse at top,#000a1a 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">♠️</span><span className="font-black text-white text-base">Call Break</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(65,105,225,0.1)",border:"1px solid rgba(65,105,225,0.25)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking"&&(
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl" style={{background:"rgba(65,105,225,0.12)",border:"2px solid rgba(65,105,225,0.4)"}} animate={{scale:[1,1.07,1]}} transition={{duration:1.4,repeat:Infinity}}>♠️</motion.div>
          <div className="text-center"><div className="text-white font-black text-xl">Call Break</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>4-player Spade trump trick-taking</div></div>
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(65,105,225,0.07)",border:"1px solid rgba(65,105,225,0.3)"}}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{initialFee}</div></div>
            <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>WIN UP TO</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{prize}</div></div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={()=>startRound()}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#4169E1,#1a237e)",color:"#fff",boxShadow:"0 0 28px rgba(65,105,225,0.45)"}}>
            ♠️ Start Game
          </motion.button>
        </div>
      )}

      {phase==="bidding"&&(
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5">
          <div className="text-white font-black text-xl">Bidding Phase</div>
          <div className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Round {round} of {MAX_ROUNDS} — Spades are trump ♠</div>
          {/* Bids so far */}
          <div className="w-full grid grid-cols-4 gap-2">
            {PLAYERS.map((p,i)=>(
              <div key={i} className="flex flex-col items-center px-2 py-2 rounded-xl" style={{background:i===biddingIdx?"rgba(65,105,225,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${i===biddingIdx?"rgba(65,105,225,0.5)":"rgba(255,255,255,0.08)"}`}}>
                <span className="text-xs font-bold text-white">{i===0?"You":p}</span>
                <span className="text-xl font-black" style={{color:bids[i]>0?"#FFD700":"rgba(255,255,255,0.2)"}}>{bids[i]>0?bids[i]:"—"}</span>
              </div>
            ))}
          </div>
          {biddingIdx===0&&(
            <div className="w-full flex flex-col gap-3">
              <div className="text-center text-sm font-bold" style={{color:"rgba(255,255,255,0.5)"}}>Your bid (1–8 tricks)</div>
              <div className="flex items-center gap-4 justify-center">
                <button onClick={()=>setBidInput(b=>Math.max(1,b-1))} className="w-10 h-10 rounded-full font-black text-xl cursor-pointer" style={{background:"rgba(255,255,255,0.08)",color:"white"}}>−</button>
                <span className="text-4xl font-black" style={{color:"#FFD700"}}>{bidInput}</span>
                <button onClick={()=>setBidInput(b=>Math.min(8,b+1))} className="w-10 h-10 rounded-full font-black text-xl cursor-pointer" style={{background:"rgba(255,255,255,0.08)",color:"white"}}>+</button>
              </div>
              <motion.button whileTap={{scale:0.96}} onClick={submitBid}
                className="w-full py-3.5 rounded-2xl font-black cursor-pointer"
                style={{background:"linear-gradient(135deg,#4169E1,#1a237e)",color:"#fff",boxShadow:"0 0 20px rgba(65,105,225,0.4)"}}>
                Confirm Bid: {bidInput}
              </motion.button>
            </div>
          )}
          {biddingIdx>0&&biddingIdx<4&&<div className="text-sm" style={{color:"rgba(255,255,255,0.4)"}}>Bots bidding...</div>}
        </div>
      )}

      {phase==="playing"&&(
        <div className="flex-1 flex flex-col gap-2 px-2 py-2">
          {/* Score bar */}
          <div className="grid grid-cols-4 gap-1">
            {PLAYERS.map((p,i)=>(
              <div key={i} className="flex flex-col items-center py-1.5 px-1 rounded-xl" style={{background:currentPlayer===i?"rgba(65,105,225,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${currentPlayer===i?"rgba(65,105,225,0.5)":"rgba(255,255,255,0.07)"}`}}>
                <span className="text-[9px] font-bold" style={{color:"rgba(255,255,255,0.4)"}}>{i===0?"You":p}</span>
                <span className="text-sm font-black text-white">{roundScores[i]}/{bids[i]}</span>
                <span className="text-[8px]" style={{color:"rgba(255,215,0,0.5)"}}>tot:{totalScores[i].toFixed(1)}</span>
              </div>
            ))}
          </div>

          {/* Trick area */}
          <div className="rounded-2xl p-3 flex items-center justify-center gap-3 min-h-[90px]" style={{background:"rgba(65,105,225,0.05)",border:"1px solid rgba(65,105,225,0.2)"}}>
            {trick.length===0&&<span className="text-xs" style={{color:"rgba(255,255,255,0.2)"}}>Trick area — play a card</span>}
            {trick.map((t,i)=>(
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[9px]" style={{color:trickWinner===t.player?"#FFD700":"rgba(255,255,255,0.35)"}}>{t.player===0?"You":PLAYERS[t.player]}</span>
                <CardView card={t.card} selected={trickWinner===t.player}/>
              </div>
            ))}
          </div>

          <div className="text-center text-xs font-bold px-2" style={{color:"rgba(255,255,255,0.4)"}}>{msg}</div>

          {/* Player hand */}
          <div className="rounded-2xl p-2" style={{background:"rgba(255,215,0,0.04)",border:"1px solid rgba(255,215,0,0.15)"}}>
            <div className="text-[9px] font-bold mb-1 text-center" style={{color:"rgba(255,215,0,0.5)"}}>YOUR HAND — tap to play {trick.length===0?"(lead a card)":"(follow suit if possible)"}</div>
            <div className="flex gap-1 flex-wrap justify-center">
              {hands[0].map((card,i)=>{
                const playable=getPlayable(hands[0]);
                const canPlay=currentPlayer===0&&phase==="playing"&&!busy.current&&playable.some(c=>c.suit===card.suit&&c.rank===card.rank);
                return <CardView key={i} card={card} small selected={false} onClick={canPlay?()=>handlePlayCard(card):undefined}/>;
              })}
            </div>
          </div>
        </div>
      )}

      {phase==="roundEnd"&&(
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5">
          <div className="font-black text-2xl text-white">Round {round-1} Complete!</div>
          <div className="w-full grid grid-cols-4 gap-2">
            {PLAYERS.map((p,i)=>(
              <div key={i} className="flex flex-col items-center py-3 rounded-2xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)"}}>
                <span className="text-xs font-bold" style={{color:"rgba(255,255,255,0.4)"}}>{i===0?"You":p}</span>
                <span className="text-2xl font-black" style={{color:roundScores[i]>=bids[i]?"#22c55e":"#ef4444"}}>{roundScores[i]}</span>
                <span className="text-[9px]" style={{color:"rgba(255,255,255,0.3)"}}>bid {bids[i]}</span>
                <span className="text-sm font-black" style={{color:"#FFD700"}}>{totalScores[i].toFixed(1)}</span>
              </div>
            ))}
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={startRound}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{background:"linear-gradient(135deg,#4169E1,#1a237e)",color:"#fff",boxShadow:"0 0 20px rgba(65,105,225,0.4)"}}>
            ♠️ Next Round ({round}/{MAX_ROUNDS})
          </motion.button>
        </div>
      )}

      {phase==="result"&&(
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:won?"rgba(255,215,0,0.15)":"rgba(239,68,68,0.1)",border:`3px solid ${won?"rgba(255,215,0,0.5)":"rgba(239,68,68,0.4)"}`,boxShadow:won?"0 0 60px rgba(255,215,0,0.4)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {won?"🏆":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:won?"#FFD700":"#ef4444"}}>{won?"You Win! 🎉":"Bot Wins!"}</div>
            <div className="text-sm mt-1" style={{color:"rgba(255,255,255,0.4)"}}>Your score: {totalScores[0].toFixed(1)}</div>
          </div>
          <div className="w-full grid grid-cols-4 gap-2">
            {PLAYERS.map((p,i)=>(
              <div key={i} className="flex flex-col items-center py-3 rounded-2xl" style={{background:i===0&&won?"rgba(255,215,0,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${i===0&&won?"rgba(255,215,0,0.3)":"rgba(255,255,255,0.08)"}`}}>
                <span className="text-[9px] font-bold" style={{color:"rgba(255,255,255,0.4)"}}>{i===0?"You":p}</span>
                <span className="text-xl font-black" style={{color:i===0&&won?"#FFD700":"white"}}>{totalScores[i].toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4" style={{background:won?"rgba(255,215,0,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{won?"Winnings":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:won?"#FFD700":"#ef4444"}}>{won?`+₹${prize}`:`-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={()=>{setPhase("matchmaking");setRound(1);setTotalScores([0,0,0,0]);}}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{background:"linear-gradient(135deg,#4169E1,#1a237e)",color:"#fff",boxShadow:"0 0 28px rgba(65,105,225,0.4)"}}>
            ♠️ Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
