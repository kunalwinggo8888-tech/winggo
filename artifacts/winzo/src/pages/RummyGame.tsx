/**
 * RummyGame — WINGGO 13-Card Indian Rummy
 * Draw/Discard loop, meld validation (pure sequence required), bot AI.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Suit = "♠"|"♥"|"♦"|"♣";
interface Card { suit:Suit; rank:number; faceUp:boolean; id:string; isJoker?:boolean }
type Phase = "matchmaking"|"playing"|"result";
type Turn = "player"|"bot";
type GameStep = "draw"|"discard";

const SUITS:Suit[]=["♠","♥","♦","♣"];
function shuffle<T>(a:T[]):T[]{ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function isRed(s:Suit){ return s==="♥"||s==="♦"; }
function rankStr(r:number){ return r===1?"A":r===11?"J":r===12?"Q":r===13?"K":String(r); }

function makeDeck():Card[]{
  const d:Card[]=[];
  for(const s of SUITS) for(let r=1;r<=13;r++) d.push({suit:s,rank:r,faceUp:false,id:`${s}${r}`});
  // Add printed joker as ♠-Joker
  d.push({suit:"♠",rank:0,faceUp:false,id:"JOKER",isJoker:true});
  return shuffle(d);
}

// A "meld" is a sequence (3+ consecutive same suit) or set (3-4 same rank different suits)
function isSequence(cards:Card[],jokerRank:number):boolean{
  if(cards.length<3) return false;
  const normals=cards.filter(c=>!c.isJoker&&c.rank!==jokerRank);
  const jokers=cards.length-normals.length;
  if(normals.length===0) return true;
  const suit=normals[0].suit;
  if(!normals.every(c=>c.suit===suit)) return false;
  const sorted=[...normals].sort((a,b)=>a.rank-b.rank);
  let gaps=0;
  for(let i=1;i<sorted.length;i++) gaps+=sorted[i].rank-sorted[i-1].rank-1;
  return gaps<=jokers;
}
function isPureSequence(cards:Card[]):boolean{
  if(cards.length<3) return false;
  const suit=cards[0].suit;
  if(!cards.every(c=>c.suit===suit&&!c.isJoker)) return false;
  const sorted=[...cards].sort((a,b)=>a.rank-b.rank);
  for(let i=1;i<sorted.length;i++) if(sorted[i].rank!==sorted[i-1].rank+1) return false;
  return true;
}
function isSet(cards:Card[],jokerRank:number):boolean{
  if(cards.length<3||cards.length>4) return false;
  const normals=cards.filter(c=>!c.isJoker&&c.rank!==jokerRank);
  if(normals.length===0) return true;
  const rank=normals[0].rank;
  return normals.every(c=>c.rank===rank);
}
function isMeld(cards:Card[],jokerRank:number):boolean{
  return isSequence(cards,jokerRank)||isSet(cards,jokerRank);
}

// Validate full hand (13 cards): at least 1 pure sequence, rest in valid melds
function validateDeclare(hand:Card[],jokerRank:number):{valid:boolean;msg:string}{
  if(hand.length!==13) return {valid:false,msg:"Must have 13 cards"};
  // Try all partitions into 4 groups (sizes can vary but sum to 13)
  // Simplified: check if at least one pure sequence exists, then try greedy grouping
  function tryPartitions(cards:Card[],hasPure:boolean,groups:Card[][]):{valid:boolean;hasPure:boolean}|null{
    if(cards.length===0) return hasPure?{valid:true,hasPure}:null;
    for(let len=3;len<=Math.min(cards.length,cards.length);len++){
      const group=cards.slice(0,len);
      if(!isMeld(group,jokerRank)) continue;
      const pure=hasPure||isPureSequence(group);
      const res=tryPartitions(cards.slice(len),pure,[...groups,group]);
      if(res) return res;
    }
    return null;
  }
  // Sort hand to help grouping
  const sorted=[...hand].sort((a,b)=>a.suit.localeCompare(b.suit)||a.rank-b.rank);
  const res=tryPartitions(sorted,false,[]);
  if(res?.valid) return {valid:true,msg:"Valid Declaration! 🎉"};
  return {valid:false,msg:"Invalid melds — need at least 1 pure sequence"};
}

function CardView({ card, small, selected, onClick }:{card:Card;small?:boolean;selected?:boolean;onClick?:()=>void}){
  const w=small?28:42, h=small?40:60;
  if(!card.faceUp&&!card.isJoker) return <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:"linear-gradient(135deg,#1a0a3e,#0d0820)",border:`1.5px solid ${selected?"rgba(255,215,0,0.8)":"rgba(255,215,0,0.25)"}`,flexShrink:0,cursor:onClick?"pointer":"default"}}/>;
  if(card.isJoker) return (
    <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:"linear-gradient(135deg,#FFD700,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:onClick?"pointer":"default",border:`1.5px solid ${selected?"white":"rgba(255,255,255,0.5)"}`,boxShadow:selected?"0 0 12px rgba(255,215,0,0.8)":"0 2px 6px rgba(0,0,0,0.5)"}}>
      <span style={{fontSize:small?11:16,fontWeight:900,color:"#000"}}>🃏</span>
    </div>
  );
  const red=isRed(card.suit);
  return (
    <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:selected?"#fff9e0":"#fff",border:`1.5px solid ${selected?"rgba(255,215,0,0.9)":red?"rgba(220,38,38,0.3)":"rgba(0,0,0,0.2)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"2px 3px",boxShadow:selected?"0 0 12px rgba(255,215,0,0.6)":"0 2px 6px rgba(0,0,0,0.5)",flexShrink:0,cursor:onClick?"pointer":"default"}}>
      <span style={{fontSize:small?7:9,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-start"}}>{rankStr(card.rank)}{card.suit}</span>
      <span style={{fontSize:small?10:14,color:red?"#dc2626":"#1a1a1a",lineHeight:1}}>{card.suit}</span>
      <span style={{fontSize:small?7:9,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{rankStr(card.rank)}{card.suit}</span>
    </div>
  );
}

const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
interface Props { onBack:()=>void; initialFee?:number }

export default function RummyGame({ onBack, initialFee=10 }:Props){
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [deck,setDeck]=useState<Card[]>([]);
  const [discardPile,setDiscardPile]=useState<Card[]>([]);
  const [playerHand,setPlayerHand]=useState<Card[]>([]);
  const [botHand,setBotHand]=useState<Card[]>([]);
  const [jokerRank,setJokerRank]=useState(0);
  const [turn,setTurn]=useState<Turn>("player");
  const [step,setStep]=useState<GameStep>("draw");
  const [selIdx,setSelIdx]=useState<number|null>(null);
  const [drawnCard,setDrawnCard]=useState<Card|null>(null);
  const [msg,setMsg]=useState("");
  const [winner,setWinner]=useState<"player"|"bot"|null>(null);
  const [declareMsg,setDeclareMsg]=useState("");
  const botBusy=useRef(false);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));

  function startGame(){
    const d=makeDeck();
    // Pick a random non-joker card as wild joker rank
    const wild=d.find(c=>!c.isJoker&&c.rank>0)!;
    const jRank=wild.rank;
    setJokerRank(jRank);
    const ph=d.slice(0,13).map(c=>({...c,faceUp:true}));
    const bh=d.slice(13,26).map(c=>({...c,faceUp:false}));
    const rest=d.slice(26);
    const disc=[{...rest[0],faceUp:true}];
    setDeck(rest.slice(1)); setDiscardPile(disc);
    setPlayerHand(ph); setBotHand(bh);
    setTurn("player"); setStep("draw"); setMsg(`Joker rank: ${rankStr(jRank)} — Draw a card!`);
    setDrawnCard(null); setSelIdx(null); setWinner(null); setDeclareMsg(""); botBusy.current=false;
  }

  function drawFromDeck(){
    if(step!=="draw"||turn!=="player") return;
    if(deck.length===0){ setMsg("Deck empty!"); return; }
    const card={...deck[0],faceUp:true};
    setDeck(d=>d.slice(1)); setDrawnCard(card);
    setPlayerHand(h=>[...h,card]);
    setStep("discard"); setMsg("Now discard a card from your hand");
  }

  function drawFromDiscard(){
    if(step!=="draw"||turn!=="player") return;
    if(discardPile.length===0) return;
    const card={...discardPile[discardPile.length-1],faceUp:true};
    setDiscardPile(p=>p.slice(0,-1)); setDrawnCard(card);
    setPlayerHand(h=>[...h,card]);
    setStep("discard"); setMsg("Now discard a card from your hand");
  }

  function discardCard(idx:number){
    if(step!=="discard"||turn!=="player") return;
    const card=playerHand[idx];
    const newHand=playerHand.filter((_,i)=>i!==idx);
    setPlayerHand(newHand); setDiscardPile(p=>[...p,{...card,faceUp:true}]);
    setDrawnCard(null); setSelIdx(null);
    if(newHand.length===0){ endGame("player"); return; }
    setTurn("bot"); setStep("draw"); setMsg("Bot is playing...");
  }

  function handleDeclare(){
    const res=validateDeclare(playerHand,jokerRank);
    setDeclareMsg(res.msg);
    if(res.valid) endGame("player");
  }

  function endGame(w:"player"|"bot"){
    setWinner(w); setPhase("result");
    if(w==="player") addWinning(prize,`🃏 Rummy — Won ₹${prize}`);
  }

  // Bot turn
  useEffect(()=>{
    if(turn!=="bot"||phase!=="playing"||botBusy.current) return;
    botBusy.current=true;
    (async()=>{
      await delay(1200+Math.random()*800);
      // Bot draws from deck
      let bh=[...botHand];
      let dk=[...deck];
      if(dk.length===0){ endGame("player"); return; }
      bh=[...bh,{...dk[0],faceUp:false}]; dk=dk.slice(1);
      setDeck(dk); setBotHand(bh);
      await delay(700);
      // Bot discards: try to keep sequences/sets, discard least useful
      const sorted=[...bh].sort((a,b)=>{
        // Score: high isolated cards are bad
        const suit=bh.filter(c=>c.suit===a.suit);
        const nearby=suit.filter(c=>Math.abs(c.rank-a.rank)<=2).length;
        return nearby-1; // fewer nearby = more likely to discard
      });
      const disc=sorted[0];
      bh=bh.filter(c=>c.id!==disc.id);
      setBotHand(bh); setDiscardPile(p=>[...p,{...disc,faceUp:true}]);
      // Bot declare check
      const botFull=[...bh].map(c=>({...c,faceUp:true}));
      if(bh.length===12){ // bot has 13 after draw, 12 after discard - means won
        // simplified: bot never declares, only player can
      }
      botBusy.current=false;
      setTurn("player"); setStep("draw"); setMsg("Your turn — draw a card");
    })();
  },[turn,phase,botHand,deck]);

  return (
    <div className="flex flex-col min-h-screen" style={{background:"radial-gradient(ellipse at top,#1a0010 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🃏</span><span className="font-black text-white text-base">Rummy</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.25)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
            style={{background:"rgba(255,107,107,0.12)",border:"2px solid rgba(255,107,107,0.4)"}}
            animate={{scale:[1,1.07,1]}} transition={{duration:1.4,repeat:Infinity}}>🃏</motion.div>
          <div className="text-center"><div className="text-white font-black text-xl">13-Card Rummy</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>Form melds & declare to win</div></div>
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(255,107,107,0.07)",border:"1px solid rgba(255,107,107,0.3)"}}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{initialFee}</div></div>
            <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>WIN UP TO</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{prize}</div></div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={()=>{setPhase("playing");startGame();}}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#ff6b6b,#c0392b)",color:"#fff",boxShadow:"0 0 28px rgba(255,107,107,0.45)"}}>
            🃏 Deal Cards
          </motion.button>
        </div>
      )}

      {phase==="playing" && (
        <div className="flex-1 flex flex-col gap-2 px-2 py-2 overflow-auto">
          {/* Bot hand */}
          <div className="rounded-2xl p-2" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="text-xs font-bold mb-1.5 text-center" style={{color:"rgba(255,255,255,0.35)"}}>🤖 Bot — {botHand.length} cards</div>
            <div className="flex gap-1 justify-center flex-wrap">
              {botHand.map((_,i)=><div key={i} style={{width:24,height:36,borderRadius:4,background:"linear-gradient(135deg,#1a0a3e,#0d0820)",border:"1px solid rgba(255,215,0,0.2)"}}/>)}
            </div>
          </div>

          {/* Deck + Discard */}
          <div className="flex items-center justify-center gap-4 py-1">
            <div className="flex flex-col items-center gap-1">
              <div onClick={drawFromDeck} className="cursor-pointer" style={{width:48,height:68,borderRadius:8,background:turn==="player"&&step==="draw"?"linear-gradient(135deg,#2a1060,#0d0820)":"rgba(255,255,255,0.05)",border:`2px solid ${turn==="player"&&step==="draw"?"rgba(255,215,0,0.6)":"rgba(255,215,0,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:turn==="player"&&step==="draw"?"0 0 16px rgba(255,215,0,0.3)":"none"}}>
                <span style={{fontSize:24}}>🂠</span>
              </div>
              <span className="text-[9px]" style={{color:"rgba(255,255,255,0.3)"}}>Deck ({deck.length})</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              {discardPile.length>0
                ?<div onClick={drawFromDiscard} className="cursor-pointer" style={{boxShadow:turn==="player"&&step==="draw"?"0 0 12px rgba(255,107,107,0.4)":"none"}}><CardView card={discardPile[discardPile.length-1]}/></div>
                :<div style={{width:48,height:68,borderRadius:8,border:"2px dashed rgba(255,255,255,0.15)"}}/>}
              <span className="text-[9px]" style={{color:"rgba(255,255,255,0.3)"}}>Discard</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div style={{width:48,height:68,borderRadius:8,background:"linear-gradient(135deg,#FFD700,#ff8c00)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"2px solid rgba(255,255,255,0.4)"}}>
                <span style={{fontSize:24}}>🃏</span>
              </div>
              <span className="text-[9px]" style={{color:"rgba(255,215,0,0.5)"}}>Joker: {rankStr(jokerRank)}</span>
            </div>
          </div>

          {/* Status */}
          <div className="text-center px-3 py-1.5 rounded-xl mx-2" style={{background:"rgba(255,255,255,0.03)"}}>
            <span className="text-xs font-bold" style={{color: turn==="player"?"rgba(255,215,0,0.8)":"rgba(255,255,255,0.4)"}}>{msg}</span>
          </div>
          {declareMsg&&<div className="text-center text-xs font-bold" style={{color:"#ef4444"}}>{declareMsg}</div>}

          {/* Player hand */}
          <div className="rounded-2xl p-2" style={{background:"rgba(255,107,107,0.05)",border:"1px solid rgba(255,107,107,0.2)"}}>
            <div className="text-xs font-bold mb-1.5 text-center" style={{color:"rgba(255,107,107,0.7)"}}>👤 Your Hand — {playerHand.length} cards {step==="discard"?"(tap to discard)":""}</div>
            <div className="flex gap-1 justify-center flex-wrap">
              {playerHand.map((card,i)=>(
                <CardView key={card.id} card={card} small selected={selIdx===i||card.id===drawnCard?.id}
                  onClick={()=>{
                    if(step==="discard"){ discardCard(i); }
                    else { setSelIdx(selIdx===i?null:i); }
                  }}/>
              ))}
            </div>
          </div>

          {/* Declare button */}
          <div className="px-2">
            <motion.button whileTap={{scale:0.96}} onClick={handleDeclare}
              disabled={step!=="discard"||turn!=="player"}
              className="w-full py-3.5 rounded-2xl font-black text-sm cursor-pointer"
              style={{background:step==="discard"&&turn==="player"?"linear-gradient(135deg,#FFD700,#ff8c00)":"rgba(255,255,255,0.05)",color:step==="discard"&&turn==="player"?"#000":"rgba(255,255,255,0.25)",boxShadow:step==="discard"&&turn==="player"?"0 0 24px rgba(255,215,0,0.4)":"none",border:step==="discard"&&turn==="player"?"none":"1px solid rgba(255,255,255,0.08)"}}>
              📣 DECLARE (discard first)
            </motion.button>
          </div>
        </div>
      )}

      {phase==="result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:winner==="player"?"rgba(255,215,0,0.15)":"rgba(239,68,68,0.1)",border:`3px solid ${winner==="player"?"rgba(255,215,0,0.5)":"rgba(239,68,68,0.4)"}`,boxShadow:winner==="player"?"0 0 60px rgba(255,215,0,0.4)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {winner==="player"?"🏆":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:winner==="player"?"#FFD700":"#ef4444"}}>{winner==="player"?"You Win! 🎉":"Bot Wins!"}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4" style={{background:winner==="player"?"rgba(255,215,0,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{winner==="player"?"Winnings":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:winner==="player"?"#FFD700":"#ef4444"}}>{winner==="player"?`+₹${prize}`:`-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={()=>{setPhase("matchmaking");setPlayerHand([]);setBotHand([]);setDeck([]);setDiscardPile([]);setWinner(null);setDeclareMsg("");}}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#ff6b6b,#c0392b)",color:"#fff",boxShadow:"0 0 28px rgba(255,107,107,0.4)"}}>
            🃏 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
