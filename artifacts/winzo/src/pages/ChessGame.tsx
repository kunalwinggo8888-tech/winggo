/**
 * ChessGame — WINGGO Premium Chess
 * Full legal-move generation, check/checkmate detection, bot AI (captures-first).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Color = "w" | "b";
type PType = "K"|"Q"|"R"|"B"|"N"|"P";
interface Piece { t: PType; c: Color }
type Board = (Piece|null)[][];
type Phase = "matchmaking"|"playing"|"result";

const SYMBOLS: Record<PType,Record<Color,string>> = {
  K:{ w:"♔", b:"♚" }, Q:{ w:"♕", b:"♛" },
  R:{ w:"♖", b:"♜" }, B:{ w:"♗", b:"♝" },
  N:{ w:"♘", b:"♞" }, P:{ w:"♙", b:"♟" },
};

function initBoard(): Board {
  const b: Board = Array.from({length:8},()=>Array(8).fill(null));
  const back: PType[] = ["R","N","B","Q","K","B","N","R"];
  back.forEach((t,c)=>{ b[0][c]={t,c:"b"}; b[7][c]={t,c:"w"}; });
  for(let c=0;c<8;c++){ b[1][c]={t:"P",c:"b"}; b[6][c]={t:"P",c:"w"}; }
  return b;
}
function cloneBoard(b:Board):Board { return b.map(r=>[...r]); }

function inBounds(r:number,c:number){ return r>=0&&r<8&&c>=0&&c<8; }

function pseudoMoves(board:Board, r:number, c:number): [number,number][] {
  const p = board[r][c]; if(!p) return [];
  const moves:[number,number][] = [];
  const opp = (col:Color) => col==="w"?"b":"w";
  const add = (nr:number,nc:number)=>{
    if(!inBounds(nr,nc)) return false;
    if(board[nr][nc]?.c===p.c) return false;
    moves.push([nr,nc]);
    return !board[nr][nc];
  };
  const slide = (dr:number,dc:number)=>{ let nr=r+dr,nc=c+dc; while(inBounds(nr,nc)){ if(!add(nr,nc)) break; nr+=dr; nc+=dc; } };

  if(p.t==="R"){ [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>slide(dr,dc)); }
  if(p.t==="B"){ [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc)); }
  if(p.t==="Q"){ [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr,dc])=>slide(dr,dc)); }
  if(p.t==="N"){ [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>add(r+dr,c+dc)); }
  if(p.t==="K"){ [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>add(r+dr,c+dc)); }
  if(p.t==="P"){
    const dir=p.c==="w"?-1:1, start=p.c==="w"?6:1;
    if(inBounds(r+dir,c)&&!board[r+dir][c]) { moves.push([r+dir,c]); if(r===start&&!board[r+2*dir][c]) moves.push([r+2*dir,c]); }
    for(const dc of[-1,1]) if(inBounds(r+dir,c+dc)&&board[r+dir][c+dc]?.c===opp(p.c)) moves.push([r+dir,c+dc]);
  }
  return moves;
}

function findKing(board:Board,color:Color):[number,number]|null {
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) if(board[r][c]?.t==="K"&&board[r][c]?.c===color) return [r,c];
  return null;
}
function isInCheck(board:Board,color:Color):boolean {
  const kp=findKing(board,color); if(!kp) return false;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p=board[r][c]; if(!p||p.c===color) continue;
    if(pseudoMoves(board,r,c).some(([nr,nc])=>nr===kp[0]&&nc===kp[1])) return true;
  }
  return false;
}
function legalMoves(board:Board,r:number,c:number):[number,number][] {
  const p=board[r][c]; if(!p) return [];
  return pseudoMoves(board,r,c).filter(([nr,nc])=>{
    const nb=cloneBoard(board); nb[nr][nc]=nb[r][c]; nb[r][c]=null;
    return !isInCheck(nb,p.c);
  });
}
function allLegalMoves(board:Board,color:Color):{from:[number,number];to:[number,number]}[] {
  const moves:{from:[number,number];to:[number,number]}[]=[];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(board[r][c]?.c!==color) continue;
    legalMoves(board,r,c).forEach(to=>moves.push({from:[r,c],to}));
  }
  return moves;
}
function applyMove(board:Board,fr:number,fc:number,tr:number,tc:number):Board {
  const nb=cloneBoard(board);
  const p=nb[fr][fc]!;
  // Pawn promotion
  if(p.t==="P"&&(tr===0||tr===7)) nb[tr][tc]={t:"Q",c:p.c}; else nb[tr][tc]=p;
  nb[fr][fc]=null;
  return nb;
}
function botMove(board:Board):Board {
  const moves=allLegalMoves(board,"b");
  if(moves.length===0) return board;
  const captures=moves.filter(({to:[r,c]})=>board[r][c]!==null);
  const checks=moves.filter(({from:[fr,fc],to:[tr,tc]})=>{
    const nb=applyMove(board,fr,fc,tr,tc); return isInCheck(nb,"w");
  });
  const pool=checks.length>0?checks:captures.length>0?captures:moves;
  const m=pool[Math.floor(Math.random()*pool.length)];
  return applyMove(board,m.from[0],m.from[1],m.to[0],m.to[1]);
}

const delay=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));

function MatchmakingScreen({ entryFee, onFound }: { entryFee:number; onFound:()=>void }) {
  const [cd,setCd]=useState(3);
  const prize=Math.floor(entryFee*2*(1-PLATFORM_PCT));
  useEffect(()=>{
    const t=setInterval(()=>setCd(c=>{if(c<=1){clearInterval(t);setTimeout(onFound,300);return 0;}return c-1;}),900);
    return()=>clearInterval(t);
  },[onFound]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{background:"rgba(148,163,184,0.12)",border:"2px solid rgba(148,163,184,0.4)"}}
        animate={{scale:[1,1.07,1],boxShadow:["0 0 30px rgba(148,163,184,0.2)","0 0 60px rgba(148,163,184,0.5)","0 0 30px rgba(148,163,184,0.2)"]}}
        transition={{duration:1.4,repeat:Infinity}}>♟️</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Finding Opponent...</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>Matching skill level</div></div>
      <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(255,215,0,0.07)",border:"1px solid rgba(255,215,0,0.25)"}}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{entryFee}</div></div>
        <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
        <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>WIN UP TO</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{prize}</div></div>
      </div>
      <div className="text-center text-[10px] font-bold" style={{color:"rgba(255,165,0,0.7)"}}>⏳ {cd}s — bot connecting...</div>
    </div>
  );
}

interface Props { onBack:()=>void; initialFee?:number }

export default function ChessGame({ onBack, initialFee=10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [board,setBoard]=useState<Board>(initBoard);
  const [turn,setTurn]=useState<Color>("w");
  const [selected,setSelected]=useState<[number,number]|null>(null);
  const [highlights,setHighlights]=useState<[number,number][]>([]);
  const [status,setStatus]=useState("");
  const [winner,setWinner]=useState<"player"|"bot"|null>(null);
  const [moveCount,setMoveCount]=useState(0);
  const botTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));

  function checkGameEnd(b:Board,nextColor:Color):boolean {
    if(isInCheck(b,nextColor)){
      const moves=allLegalMoves(b,nextColor);
      if(moves.length===0){
        const w=nextColor==="b"?"player":"bot";
        setWinner(w); setPhase("result");
        setStatus(nextColor==="b"?"♟ Checkmate! You win! 🎉":"♟ Checkmate! Bot wins.");
        if(w==="player") addWinning(prize,`♟️ Chess — Won ₹${prize}`);
        return true;
      }
      setStatus(`${nextColor==="w"?"Your":"Bot's"} king is in check!`);
    } else {
      const moves=allLegalMoves(b,nextColor);
      if(moves.length===0){ setStatus("Stalemate — draw!"); setPhase("result"); setWinner(null); return true; }
      setStatus(nextColor==="w"?"Your turn — move a piece":"Bot is thinking...");
    }
    return false;
  }

  function handleCellClick(r:number,c:number){
    if(turn!=="w"||phase!=="playing") return;
    const p=board[r][c];
    if(selected){
      const [sr,sc]=selected;
      if(highlights.some(([hr,hc])=>hr===r&&hc===c)){
        const nb=applyMove(board,sr,sc,r,c);
        setBoard(nb); setSelected(null); setHighlights([]);
        setMoveCount(m=>m+1);
        if(!checkGameEnd(nb,"b")) setTurn("b");
      } else {
        if(p?.c==="w"){ setSelected([r,c]); setHighlights(legalMoves(board,r,c)); }
        else { setSelected(null); setHighlights([]); }
      }
    } else {
      if(p?.c==="w"){ setSelected([r,c]); setHighlights(legalMoves(board,r,c)); }
    }
  }

  // Bot turn
  useEffect(()=>{
    if(turn!=="b"||phase!=="playing") return;
    botTimer.current=setTimeout(async()=>{
      const nb=botMove(board);
      setBoard(nb); setMoveCount(m=>m+1);
      await delay(100);
      if(!checkGameEnd(nb,"w")) setTurn("w");
    }, 900+Math.random()*600);
    return()=>{ if(botTimer.current) clearTimeout(botTimer.current); };
  },[turn,phase,board]);

  // Timeout: 80 moves each = draw
  useEffect(()=>{
    if(moveCount>=160&&phase==="playing"){ setPhase("result"); setStatus("Draw by 80-move rule."); }
  },[moveCount,phase]);

  function handleRematch(){
    setPhase("matchmaking"); setBoard(initBoard()); setTurn("w");
    setSelected(null); setHighlights([]); setStatus(""); setWinner(null); setMoveCount(0);
  }

  const LIGHT="#d4b896", DARK="#8b6544";

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden"
      style={{background:"radial-gradient(ellipse at top,#0a0a00 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">♟️</span><span className="font-black text-white text-base">Chess</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(255,215,0,0.08)",border:"1px solid rgba(255,215,0,0.22)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking" && <MatchmakingScreen entryFee={initialFee} onFound={()=>{setPhase("playing");setStatus("Your turn — move a piece");}} />}

      {phase==="playing" && (
        <div className="flex-1 flex flex-col gap-2 px-2 py-2">
          {/* Status bar */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)"}}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{background:"#1a1a1a",border:"1.5px solid #fff"}}/>
              <span className="text-xs font-black text-white">🤖 Bot</span>
            </div>
            <span className="text-xs font-bold" style={{color: status.includes("check")?"#ef4444":"rgba(255,255,255,0.5)"}}>
              {status}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">You 👤</span>
              <div className="w-3 h-3 rounded-full" style={{background:"#f0f0f0",border:"1.5px solid #888"}}/>
            </div>
          </div>

          {/* Board */}
          <div className="relative w-full" style={{aspectRatio:"1",borderRadius:12,overflow:"hidden",boxShadow:"0 0 40px rgba(0,0,0,0.8)",border:"2px solid rgba(255,215,0,0.2)"}}>
            <div className="absolute inset-0 grid" style={{gridTemplateColumns:"repeat(8,1fr)",gridTemplateRows:"repeat(8,1fr)"}}>
              {Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>{
                const isLight=(r+c)%2===0;
                const piece=board[r][c];
                const isSel=selected?.[0]===r&&selected?.[1]===c;
                const isHL=highlights.some(([hr,hc])=>hr===r&&hc===c);
                const isCapture=isHL&&board[r][c]!==null;
                return (
                  <div key={`${r}-${c}`} onClick={()=>handleCellClick(r,c)}
                    className="relative flex items-center justify-center cursor-pointer"
                    style={{
                      background: isSel?"rgba(255,215,0,0.5)":isHL?(isCapture?"rgba(239,68,68,0.35)":"rgba(34,197,94,0.3)"):isLight?LIGHT:DARK,
                      transition:"background 0.1s",
                    }}>
                    {isHL&&!isCapture&&<div style={{width:"35%",height:"35%",borderRadius:"50%",background:"rgba(34,197,94,0.5)"}}/>}
                    {isHL&&isCapture&&<div style={{position:"absolute",inset:2,borderRadius:4,border:"2px solid rgba(239,68,68,0.7)"}}/>}
                    {piece&&(
                      <motion.span
                        key={`${piece.t}${piece.c}${r}${c}`}
                        initial={{scale:0.8}} animate={{scale:1}}
                        style={{
                          fontSize:"clamp(18px,4.5vw,32px)",
                          lineHeight:1,
                          textShadow:piece.c==="w"?"0 1px 3px rgba(0,0,0,0.5)":"0 1px 3px rgba(255,255,255,0.2)",
                          zIndex:2,position:"relative",
                          filter:piece.c==="w"?"drop-shadow(0 0 3px rgba(255,255,255,0.6))":"drop-shadow(0 0 3px rgba(0,0,0,0.8))",
                        }}>
                        {SYMBOLS[piece.t][piece.c]}
                      </motion.span>
                    )}
                  </div>
                );
              }))}
            </div>
            {/* Rank labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col pointer-events-none" style={{width:14}}>
              {[8,7,6,5,4,3,2,1].map(n=><div key={n} className="flex-1 flex items-center justify-center" style={{fontSize:8,fontWeight:700,color:"rgba(255,215,0,0.4)"}}>{n}</div>)}
            </div>
            <div className="absolute bottom-0 left-0 w-full flex pointer-events-none" style={{height:14}}>
              {["a","b","c","d","e","f","g","h"].map(l=><div key={l} className="flex-1 flex items-center justify-center" style={{fontSize:8,fontWeight:700,color:"rgba(255,215,0,0.4)"}}>{l}</div>)}
            </div>
          </div>

          {/* Prize + resign */}
          <div className="flex items-center gap-3 px-3">
            <div className="flex-1 px-3 py-2 rounded-xl text-center" style={{background:"rgba(255,215,0,0.07)",border:"1px solid rgba(255,215,0,0.2)"}}>
              <div className="text-[9px] font-bold" style={{color:"rgba(255,215,0,0.5)"}}>PRIZE POOL</div>
              <div className="text-base font-black" style={{color:"#FFD700"}}>₹{prize}</div>
            </div>
            <button onClick={()=>{setPhase("result");setWinner("bot");setStatus("You resigned.");}}
              className="px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
              style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444"}}>
              🏳 Resign
            </button>
          </div>
        </div>
      )}

      {phase==="result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8"
          initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:winner==="player"?"rgba(255,215,0,0.15)":"rgba(239,68,68,0.1)",border:`3px solid ${winner==="player"?"rgba(255,215,0,0.5)":"rgba(239,68,68,0.4)"}`,boxShadow:winner==="player"?"0 0 60px rgba(255,215,0,0.4)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {winner==="player"?"♟️🏆":winner===null?"🤝":"♟️💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:winner==="player"?"#FFD700":winner===null?"#94a3b8":"#ef4444"}}>
              {winner==="player"?"Checkmate! 🎉":winner===null?"Draw!":"Bot Wins!"}
            </div>
            <div className="text-sm mt-1" style={{color:"rgba(255,255,255,0.4)"}}>{status}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4"
              style={{background:winner==="player"?"rgba(255,215,0,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{winner==="player"?"Winnings":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:winner==="player"?"#FFD700":"#ef4444"}}>
                {winner==="player"?`+₹${prize}`:winner===null?"₹0":`-₹${initialFee}`}
              </span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
            style={{background:"linear-gradient(135deg,#94a3b8,#475569)",color:"#fff",boxShadow:"0 0 28px rgba(148,163,184,0.3)"}}>
            ♟️ Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
