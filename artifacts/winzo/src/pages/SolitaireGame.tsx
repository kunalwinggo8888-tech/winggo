/**
 * SolitaireGame — WINGGO Klondike Solitaire
 * 7 tableau piles, 4 foundations (A→K per suit), stock/waste, click-to-move.
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Suit = "♠"|"♥"|"♦"|"♣";
interface Card { suit:Suit; rank:number; faceUp:boolean; id:string }
type Phase = "matchmaking"|"playing"|"result";

const SUITS:Suit[]=["♠","♥","♦","♣"];
function isRed(s:Suit){ return s==="♥"||s==="♦"; }
function rankStr(r:number){ return r===1?"A":r===11?"J":r===12?"Q":r===13?"K":String(r); }

function makeDeck():Card[]{
  const d:Card[]=[];
  for(const s of SUITS) for(let r=1;r<=13;r++) d.push({suit:s,rank:r,faceUp:false,id:`${s}${r}`});
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}

interface GameState {
  tableau: Card[][];
  foundations: Card[][];   // 4 piles, one per suit
  stock: Card[];
  waste: Card[];
}

function initGame():GameState{
  const deck=makeDeck();
  const tableau:Card[][]=[];
  let idx=0;
  for(let i=0;i<7;i++){
    const pile:Card[]=[];
    for(let j=0;j<=i;j++){ pile.push({...deck[idx++],faceUp:j===i}); }
    tableau.push(pile);
  }
  const foundations: Card[][] = [[], [], [], []];
  return { tableau, foundations, stock:deck.slice(idx).map(c=>({...c,faceUp:false})), waste:[] };
}

function canPlaceOnFoundation(card:Card, foundation:Card[]):boolean{
  if(foundation.length===0) return card.rank===1;
  const top=foundation[foundation.length-1];
  return card.suit===top.suit && card.rank===top.rank+1;
}
function canPlaceOnTableau(card:Card, pile:Card[]):boolean{
  if(pile.length===0) return card.rank===13;
  const top=pile[pile.length-1];
  return top.faceUp && isRed(card.suit)!==isRed(top.suit) && card.rank===top.rank-1;
}

function CardView({ card, small, selected, onClick }:{card:Card;small?:boolean;selected?:boolean;onClick?:()=>void}){
  const w=small?30:42, h=small?42:60;
  if(!card.faceUp) return (
    <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:"linear-gradient(135deg,#2a1060,#0d0820)",border:`1.5px solid ${selected?"rgba(255,215,0,0.8)":"rgba(255,215,0,0.25)"}`,flexShrink:0,cursor:onClick?"pointer":"default"}}/>
  );
  const red=isRed(card.suit);
  return (
    <div onClick={onClick} style={{width:w,height:h,borderRadius:6,background:selected?"#fff9e0":"#fff",border:`1.5px solid ${selected?"rgba(255,215,0,0.9)":red?"rgba(220,38,38,0.3)":"rgba(0,0,0,0.2)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"space-between",padding:"2px 3px",boxShadow:selected?"0 0 12px rgba(255,215,0,0.6)":"0 2px 6px rgba(0,0,0,0.5)",flexShrink:0,cursor:onClick?"pointer":"default"}}>
      <span style={{fontSize:small?8:10,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-start"}}>{rankStr(card.rank)}{card.suit}</span>
      <span style={{fontSize:small?11:16,color:red?"#dc2626":"#1a1a1a",lineHeight:1}}>{card.suit}</span>
      <span style={{fontSize:small?8:10,fontWeight:900,color:red?"#dc2626":"#1a1a1a",lineHeight:1,alignSelf:"flex-end",transform:"rotate(180deg)"}}>{rankStr(card.rank)}{card.suit}</span>
    </div>
  );
}

interface Sel { type:"tableau"|"waste"|"foundation"; pileIdx:number; cardIdx:number }

interface Props { onBack:()=>void; initialFee?:number }

export default function SolitaireGame({ onBack, initialFee=10 }:Props){
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [gs,setGs]=useState<GameState>(initGame);
  const [sel,setSel]=useState<Sel|null>(null);
  const [score,setScore]=useState(0);
  const [moves,setMoves]=useState(0);
  const [cdVal,setCdVal]=useState(3);
  const [won,setWon]=useState(false);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));

  // Matchmaking countdown
  const [mmRunning,setMmRunning]=useState(false);
  function startMM(){
    setMmRunning(true);
    let c=3; setCdVal(c);
    const t=setInterval(()=>{ c--; setCdVal(c); if(c<=0){clearInterval(t);setPhase("playing");}},900);
  }

  function checkWin(state:GameState):boolean{
    return state.foundations.every(f=>f.length===13);
  }

  function drawStock(){
    setGs(prev=>{
      if(prev.stock.length===0){
        if(prev.waste.length===0) return prev;
        return {...prev, stock:[...prev.waste].reverse().map(c=>({...c,faceUp:false})), waste:[]};
      }
      const top={...prev.stock[prev.stock.length-1],faceUp:true};
      return {...prev, stock:prev.stock.slice(0,-1), waste:[...prev.waste,top]};
    });
    setSel(null); setMoves(m=>m+1);
  }

  function handleSelect(src:Sel){
    if(!sel){
      setSel(src); return;
    }
    // Try to move
    const moved=tryMove(gs,sel,src);
    if(moved){
      const newGs=moved;
      setGs(newGs); setSel(null); setMoves(m=>m+1); setScore(s=>s+10);
      if(checkWin(newGs)){ setWon(true); setPhase("result"); addWinning(prize,`🃏 Solitaire — Won ₹${prize}`); }
    } else {
      // Select new source
      setSel(src);
    }
  }

  function tryMove(state:GameState, from:Sel, to:Sel):GameState|null{
    const ns:GameState={ tableau:state.tableau.map(p=>[...p]), foundations:state.foundations.map(p=>[...p]), stock:[...state.stock], waste:[...state.waste] };
    let cards:Card[]=[];

    // Extract cards from source
    if(from.type==="waste"){
      const top=ns.waste[ns.waste.length-1];
      if(!top) return null;
      cards=[top]; ns.waste.pop();
    } else if(from.type==="tableau"){
      const pile=ns.tableau[from.pileIdx];
      cards=pile.slice(from.cardIdx);
      ns.tableau[from.pileIdx]=pile.slice(0,from.cardIdx);
      // Flip top card
      const tp=ns.tableau[from.pileIdx];
      if(tp.length>0&&!tp[tp.length-1].faceUp) ns.tableau[from.pileIdx][tp.length-1]={...tp[tp.length-1],faceUp:true};
    } else if(from.type==="foundation"){
      const top=ns.foundations[from.pileIdx][ns.foundations[from.pileIdx].length-1];
      if(!top) return null;
      cards=[top]; ns.foundations[from.pileIdx].pop();
    }
    if(cards.length===0) return null;

    // Place cards at destination
    if(to.type==="foundation"){
      if(cards.length!==1) return null;
      if(!canPlaceOnFoundation(cards[0],ns.foundations[to.pileIdx])) return null;
      ns.foundations[to.pileIdx].push({...cards[0],faceUp:true});
    } else if(to.type==="tableau"){
      if(!canPlaceOnTableau(cards[0],ns.tableau[to.pileIdx])) return null;
      ns.tableau[to.pileIdx].push(...cards.map(c=>({...c,faceUp:true})));
    } else return null;

    return ns;
  }

  // Auto-move to foundation
  function autoMove(){
    let state=gs; let moved=false;
    for(let fi=0;fi<4;fi++){
      for(let ti=0;ti<7;ti++){
        const pile=state.tableau[ti]; if(!pile.length) continue;
        const top=pile[pile.length-1];
        if(canPlaceOnFoundation(top,state.foundations[fi])){
          const res=tryMove(state,{type:"tableau",pileIdx:ti,cardIdx:pile.length-1},{type:"foundation",pileIdx:fi,cardIdx:0});
          if(res){ state=res; moved=true; setScore(s=>s+10); }
        }
      }
      const waste=state.waste;
      if(waste.length>0&&canPlaceOnFoundation(waste[waste.length-1],state.foundations[fi])){
        const res=tryMove(state,{type:"waste",pileIdx:0,cardIdx:0},{type:"foundation",pileIdx:fi,cardIdx:0});
        if(res){ state=res; moved=true; setScore(s=>s+10); }
      }
    }
    if(moved){ setGs(state); setSel(null); if(checkWin(state)){ setWon(true); setPhase("result"); addWinning(prize,`🃏 Solitaire — Won ₹${prize}`); } }
  }

  function handleRematch(){ setPhase("matchmaking"); setGs(initGame()); setSel(null); setScore(0); setMoves(0); setWon(false); setMmRunning(false); setCdVal(3); }

  const SUIT_ORDER:Suit[]=["♠","♥","♦","♣"];

  return (
    <div className="flex flex-col min-h-screen" style={{background:"radial-gradient(ellipse at top,#1a003a 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🃏</span><span className="font-black text-white text-base">Solitaire</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.22)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
            style={{background:"rgba(155,89,182,0.15)",border:"2px solid rgba(155,89,182,0.5)"}}
            animate={{scale:[1,1.07,1]}} transition={{duration:1.4,repeat:Infinity}}>🃏</motion.div>
          <div className="text-center"><div className="text-white font-black text-xl">{mmRunning?`Starting in ${cdVal}s...`:"Classic Solitaire"}</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>Complete all foundations to win</div></div>
          <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(155,89,182,0.08)",border:"1px solid rgba(155,89,182,0.3)"}}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{initialFee}</div></div>
            <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
            <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>WIN UP TO</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{prize}</div></div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={startMM} disabled={mmRunning}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#9b59b6,#6a1b9a)",color:"#fff",boxShadow:"0 0 28px rgba(155,89,182,0.5)"}}>
            {mmRunning?`⏳ ${cdVal}s`:"🃏 Deal Cards"}
          </motion.button>
        </div>
      )}

      {phase==="playing" && (
        <div className="flex-1 flex flex-col gap-2 px-2 py-2 overflow-auto">
          {/* Top row: stock / waste / foundations */}
          <div className="flex gap-1.5 items-start">
            {/* Stock */}
            <div onClick={drawStock} className="cursor-pointer" style={{width:42,height:60,borderRadius:6,background:gs.stock.length>0?"linear-gradient(135deg,#2a1060,#0d0820)":"rgba(255,255,255,0.05)",border:"1.5px dashed rgba(255,215,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {gs.stock.length>0?<span style={{fontSize:20}}>🂠</span>:<span style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>↺</span>}
            </div>
            {/* Waste */}
            <div style={{width:42,height:60,borderRadius:6,border:"1.5px dashed rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
              {gs.waste.length>0&&<CardView card={gs.waste[gs.waste.length-1]} selected={sel?.type==="waste"} onClick={()=>handleSelect({type:"waste",pileIdx:0,cardIdx:0})}/>}
            </div>
            <div className="flex-1"/>
            {/* Foundations */}
            {[0,1,2,3].map(fi=>(
              <div key={fi} onClick={()=>{ if(sel) handleSelect({type:"foundation",pileIdx:fi,cardIdx:0}); }}
                style={{width:42,height:60,borderRadius:6,border:`1.5px dashed rgba(255,215,0,${gs.foundations[fi].length>0?0.4:0.2})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:sel?"pointer":"default",background:"rgba(255,215,0,0.04)"}}>
                {gs.foundations[fi].length>0
                  ?<CardView card={gs.foundations[fi][gs.foundations[fi].length-1]}/>
                  :<span style={{fontSize:16,opacity:0.3}}>{SUIT_ORDER[fi]}</span>}
              </div>
            ))}
          </div>

          {/* Score/moves + auto */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-bold" style={{color:"rgba(255,215,0,0.6)"}}>Score: {score}</span>
            <span className="text-xs" style={{color:"rgba(255,255,255,0.25)"}}>• Moves: {moves}</span>
            <div className="flex-1"/>
            <button onClick={autoMove} className="text-xs font-black px-3 py-1 rounded-lg cursor-pointer" style={{background:"rgba(255,215,0,0.1)",border:"1px solid rgba(255,215,0,0.25)",color:"#FFD700"}}>Auto ⚡</button>
          </div>

          {/* Tableau */}
          <div className="flex gap-1.5">
            {gs.tableau.map((pile,ti)=>(
              <div key={ti} className="flex-1 flex flex-col" style={{minHeight:60}}>
                {/* Empty pile drop target */}
                {pile.length===0&&(
                  <div onClick={()=>{ if(sel) handleSelect({type:"tableau",pileIdx:ti,cardIdx:0}); }}
                    style={{width:"100%",height:60,borderRadius:6,border:"1.5px dashed rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.02)",cursor:sel?"pointer":"default"}}/>
                )}
                {pile.map((card,ci)=>{
                  const isSrcSel=sel?.type==="tableau"&&sel.pileIdx===ti&&sel.cardIdx===ci;
                  const isPartOfSel=sel?.type==="tableau"&&sel.pileIdx===ti&&ci>=sel.cardIdx;
                  return (
                    <div key={card.id} style={{marginTop:ci===0?0:-36,zIndex:ci,position:"relative"}}>
                      <CardView card={card} selected={isPartOfSel}
                        onClick={()=>{
                          if(!card.faceUp) return;
                          if(sel) handleSelect({type:"tableau",pileIdx:ti,cardIdx:ci});
                          else setSel({type:"tableau",pileIdx:ti,cardIdx:ci});
                        }}/>
                    </div>
                  );
                })}
                {/* Drop target overlay at bottom of pile */}
                {pile.length>0&&sel&&(
                  <div onClick={()=>handleSelect({type:"tableau",pileIdx:ti,cardIdx:pile.length})}
                    style={{height:12,cursor:"pointer"}}/>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase==="result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8"
          initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:won?"rgba(155,89,182,0.2)":"rgba(239,68,68,0.12)",border:`3px solid ${won?"rgba(155,89,182,0.5)":"rgba(239,68,68,0.4)"}`,boxShadow:won?"0 0 60px rgba(155,89,182,0.5)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {won?"🏆":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:won?"#9b59b6":"#ef4444"}}>{won?"Solitaire Complete! 🎉":"Incomplete"}</div>
            <div className="text-sm mt-1" style={{color:"rgba(255,255,255,0.4)"}}>Score: {score} • Moves: {moves}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4" style={{background:won?"rgba(155,89,182,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{won?"Winnings":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:won?"#9b59b6":"#ef4444"}}>{won?`+₹${prize}`:`-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{background:"linear-gradient(135deg,#9b59b6,#6a1b9a)",color:"#fff",boxShadow:"0 0 28px rgba(155,89,182,0.4)"}}>
            🃏 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
