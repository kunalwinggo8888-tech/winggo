/**
 * DiscFootballGame — WINGGO Disc Football (Arcade Flick Game)
 * Top-down arena, click+drag to aim, release to flick, bot opponent, first to 5 goals.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking"|"playing"|"result";
const W=340, H=500;
const DISC_R=14, PLAYER_R=20, BOT_R=20, GOAL_W=90, GOAL_H=20;
const FRICTION=0.975, MAX_SPEED=14;

interface Vec2 { x:number; y:number }
function len(v:Vec2){ return Math.sqrt(v.x*v.x+v.y*v.y); }
function norm(v:Vec2):Vec2{ const l=len(v); return l>0?{x:v.x/l,y:v.y/l}:{x:0,y:0}; }
function scale(v:Vec2,s:number):Vec2{ return {x:v.x*s,y:v.y*s}; }
function add(a:Vec2,b:Vec2):Vec2{ return {x:a.x+b.x,y:a.y+b.y}; }
function sub(a:Vec2,b:Vec2):Vec2{ return {x:a.x-b.x,y:a.y-b.y}; }

const PLAYER_START:Vec2={x:W/2,y:H*0.75};
const BOT_START:Vec2={x:W/2,y:H*0.25};
const DISC_START:Vec2={x:W/2,y:H/2};
const PLAYER_GOAL={x:W/2-GOAL_W/2,y:H-GOAL_H,w:GOAL_W,h:GOAL_H};
const BOT_GOAL={x:W/2-GOAL_W/2,y:0,w:GOAL_W,h:GOAL_H};

interface State {
  disc:Vec2; discV:Vec2;
  player:Vec2; bot:Vec2;
  pScore:number; bScore:number;
}

function initState():State{
  return {disc:{...DISC_START},discV:{x:0,y:0},player:{...PLAYER_START},bot:{...BOT_START},pScore:0,bScore:0};
}

function MatchmakingScreen({ entryFee, onFound }:{ entryFee:number; onFound:()=>void }){
  const [cd,setCd]=useState(3);
  const prize=Math.floor(entryFee*2*(1-PLATFORM_PCT));
  useEffect(()=>{
    const t=setInterval(()=>setCd(c=>{if(c<=1){clearInterval(t);setTimeout(onFound,300);return 0;}return c-1;}),900);
    return()=>clearInterval(t);
  },[onFound]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{background:"rgba(0,255,135,0.12)",border:"2px solid rgba(0,255,135,0.4)"}}
        animate={{scale:[1,1.07,1],rotate:[0,10,-10,0]}} transition={{duration:1.6,repeat:Infinity}}>🥏</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Finding Opponent...</div><div className="text-sm mt-0.5" style={{color:"rgba(255,255,255,0.4)"}}>Neon Disc Arena</div></div>
      <div className="flex items-center gap-4 px-6 py-3 rounded-2xl" style={{background:"rgba(0,255,135,0.07)",border:"1px solid rgba(0,255,135,0.3)"}}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.55)"}}>ENTRY</div><div className="text-xl font-black" style={{color:"#FFD700"}}>₹{entryFee}</div></div>
        <div className="h-8 w-px" style={{background:"rgba(255,255,255,0.12)"}}/>
        <div className="text-center"><div className="text-[10px] font-bold" style={{color:"rgba(34,197,94,0.6)"}}>WIN UP TO</div><div className="text-xl font-black" style={{color:"#22c55e"}}>₹{prize}</div></div>
      </div>
      <div className="text-center text-[10px] font-bold" style={{color:"rgba(255,165,0,0.7)"}}>⏳ {cd}s — bot joining...</div>
    </div>
  );
}

interface Props { onBack:()=>void; initialFee?:number }

export default function DiscFootballGame({ onBack, initialFee=10 }:Props){
  const { total, addWinning } = useWallet();
  const [phase,setPhase]=useState<Phase>("matchmaking");
  const [state,setState]=useState<State>(initState);
  const [winner,setWinner]=useState<"player"|"bot"|null>(null);
  const [goalFlash,setGoalFlash]=useState<"player"|"bot"|null>(null);
  const [aimLine,setAimLine]=useState<{start:Vec2;end:Vec2}|null>(null);
  const [isDragging,setIsDragging]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const stateRef=useRef<State>(initState());
  const animRef=useRef<number>(0);
  const dragStart=useRef<Vec2|null>(null);
  const dragCurrent=useRef<Vec2|null>(null);
  const prize=Math.floor(initialFee*2*(1-PLATFORM_PCT));
  const WIN_GOALS=5;

  function resetPositions(st:State,scorer:"player"|"bot"):State{
    return {...st,disc:{...DISC_START},discV:{x:0,y:0},player:{...PLAYER_START},bot:{...BOT_START}};
  }

  const checkGoal=useCallback((st:State):[State,boolean]=>{
    const {disc,discV}=st;
    let newSt={...st};
    // Bot goal (top): player scores
    if(disc.y-DISC_R<=BOT_GOAL.h&&disc.x>=BOT_GOAL.x&&disc.x<=BOT_GOAL.x+BOT_GOAL.w){
      newSt={...newSt,pScore:st.pScore+1};
      setGoalFlash("player"); setTimeout(()=>setGoalFlash(null),900);
      if(newSt.pScore>=WIN_GOALS){ setWinner("player"); setPhase("result"); addWinning(prize,`🥏 Disc Football — Won ₹${prize}`); }
      return [resetPositions(newSt,"player"),true];
    }
    // Player goal (bottom): bot scores
    if(disc.y+DISC_R>=PLAYER_GOAL.y&&disc.x>=PLAYER_GOAL.x&&disc.x<=PLAYER_GOAL.x+PLAYER_GOAL.w){
      newSt={...newSt,bScore:st.bScore+1};
      setGoalFlash("bot"); setTimeout(()=>setGoalFlash(null),900);
      if(newSt.bScore>=WIN_GOALS){ setWinner("bot"); setPhase("result"); }
      return [resetPositions(newSt,"bot"),true];
    }
    return [st,false];
  },[prize,addWinning]);

  const gameLoop=useCallback(()=>{
    const st=stateRef.current;
    let {disc,discV,player,bot}=st;

    // Move disc
    let dx=disc.x+discV.x, dy=disc.y+discV.y;
    let vx=discV.x*FRICTION, vy=discV.y*FRICTION;

    // Wall bounce
    if(dx-DISC_R<0){dx=DISC_R;vx=Math.abs(vx);}
    if(dx+DISC_R>W){dx=W-DISC_R;vx=-Math.abs(vx);}
    if(dy-DISC_R<20){dy=20+DISC_R;vy=Math.abs(vy);} // above bot goal
    if(dy+DISC_R>H-20){dy=H-20-DISC_R;vy=-Math.abs(vy);} // below player goal

    // Speed cap
    const spd=len({x:vx,y:vy});
    if(spd>MAX_SPEED){const f=MAX_SPEED/spd;vx*=f;vy*=f;}
    if(spd<0.1){vx=0;vy=0;}

    // Bot AI: move toward disc
    const botDir=norm(sub({x:dx,y:dy},{x:bot.x,y:bot.y}));
    let bx=bot.x+botDir.x*2.8, by=bot.y+botDir.y*2.8;
    bx=Math.max(BOT_R,Math.min(W-BOT_R,bx));
    by=Math.max(BOT_R,Math.min(H/2-BOT_R,by)); // bot stays in top half

    // Player-disc collision
    const pdDist=len(sub({x:dx,y:dy},player));
    if(pdDist<DISC_R+PLAYER_R){
      const dir=norm(sub({x:dx,y:dy},player));
      dx=player.x+dir.x*(DISC_R+PLAYER_R+1);
      dy=player.y+dir.y*(DISC_R+PLAYER_R+1);
      vx=dir.x*8; vy=dir.y*8;
    }
    // Bot-disc collision
    const bdDist=len(sub({x:dx,y:dy},{x:bx,y:by}));
    if(bdDist<DISC_R+BOT_R){
      const dir=norm(sub({x:dx,y:dy},{x:bx,y:by}));
      dx=bx+dir.x*(DISC_R+BOT_R+1);
      dy=by+dir.y*(DISC_R+BOT_R+1);
      // Bot shoots toward player goal
      const toGoal=norm(sub({x:W/2,y:H-GOAL_H/2},{x:dx,y:dy}));
      vx=toGoal.x*10+dir.x*4; vy=toGoal.y*10+dir.y*4;
    }

    const newSt={...st,disc:{x:dx,y:dy},discV:{x:vx,y:vy},bot:{x:bx,y:by}};
    const [finalSt,_]=checkGoal(newSt);
    stateRef.current=finalSt;
    setState({...finalSt});

    // Draw canvas
    const canvas=canvasRef.current;
    if(canvas){
      const ctx=canvas.getContext("2d")!;
      ctx.clearRect(0,0,W,H);

      // Arena background
      ctx.fillStyle="#0a1a0a";
      ctx.fillRect(0,0,W,H);

      // Field lines
      ctx.strokeStyle="rgba(0,255,135,0.15)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
      ctx.beginPath(); ctx.arc(W/2,H/2,60,0,Math.PI*2); ctx.stroke();

      // Goals
      ctx.fillStyle="rgba(255,215,0,0.15)"; ctx.strokeStyle="#FFD700"; ctx.lineWidth=3;
      ctx.fillRect(BOT_GOAL.x,BOT_GOAL.y,BOT_GOAL.w,BOT_GOAL.h);
      ctx.strokeRect(BOT_GOAL.x,BOT_GOAL.y,BOT_GOAL.w,BOT_GOAL.h);
      ctx.fillRect(PLAYER_GOAL.x,PLAYER_GOAL.y,PLAYER_GOAL.w,PLAYER_GOAL.h);
      ctx.strokeRect(PLAYER_GOAL.x,PLAYER_GOAL.y,PLAYER_GOAL.w,PLAYER_GOAL.h);

      // Aim line
      if(dragStart.current&&dragCurrent.current&&isDragging){
        const s=dragStart.current, c=dragCurrent.current;
        ctx.strokeStyle="rgba(255,215,0,0.5)"; ctx.lineWidth=2;
        ctx.setLineDash([6,4]);
        ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(c.x,c.y); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Bot
      const grad2=ctx.createRadialGradient(bx,by,0,bx,by,BOT_R);
      grad2.addColorStop(0,"#ff4444"); grad2.addColorStop(1,"#b91c1c");
      ctx.fillStyle=grad2;
      ctx.shadowColor="rgba(239,68,68,0.8)"; ctx.shadowBlur=12;
      ctx.beginPath(); ctx.arc(bx,by,BOT_R,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle="white"; ctx.font="bold 11px sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("🤖",bx,by);

      // Player
      const px=finalSt.player.x, py=finalSt.player.y;
      const grad1=ctx.createRadialGradient(px,py,0,px,py,PLAYER_R);
      grad1.addColorStop(0,"#FFD700"); grad1.addColorStop(1,"#ff8c00");
      ctx.fillStyle=grad1;
      ctx.shadowColor="rgba(255,215,0,0.8)"; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.arc(px,py,PLAYER_R,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle="black"; ctx.fillText("👤",px,py);

      // Disc
      const dxf=finalSt.disc.x, dyf=finalSt.disc.y;
      const gradD=ctx.createRadialGradient(dxf,dyf,0,dxf,dyf,DISC_R);
      gradD.addColorStop(0,"#ffffff"); gradD.addColorStop(0.5,"#00E5FF"); gradD.addColorStop(1,"#0077aa");
      ctx.fillStyle=gradD;
      ctx.shadowColor="rgba(0,229,255,0.9)"; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(dxf,dyf,DISC_R,0,Math.PI*2); ctx.fill();
      ctx.shadowBlur=0;

      ctx.textAlign="left"; ctx.textBaseline="alphabetic";
    }

    animRef.current=requestAnimationFrame(gameLoop);
  },[checkGoal,isDragging]);

  useEffect(()=>{
    if(phase==="playing"){
      stateRef.current=state;
      animRef.current=requestAnimationFrame(gameLoop);
    }
    return()=>cancelAnimationFrame(animRef.current);
  },[phase,gameLoop]);

  function getCanvasPos(e:React.TouchEvent|React.MouseEvent,canvas:HTMLCanvasElement):Vec2{
    const rect=canvas.getBoundingClientRect();
    const scaleX=W/rect.width, scaleY=H/rect.height;
    if("touches" in e){
      const t=e.touches[0]||e.changedTouches[0];
      return {x:(t.clientX-rect.left)*scaleX,y:(t.clientY-rect.top)*scaleY};
    }
    const me=e as React.MouseEvent;
    return {x:(me.clientX-rect.left)*scaleX,y:(me.clientY-rect.top)*scaleY};
  }

  function onPointerDown(e:React.TouchEvent<HTMLCanvasElement>|React.MouseEvent<HTMLCanvasElement>){
    const canvas=canvasRef.current!; const pos=getCanvasPos(e,canvas);
    const pl=stateRef.current.player;
    if(len(sub(pos,pl))<PLAYER_R*2){ dragStart.current=pos; dragCurrent.current=pos; setIsDragging(true); }
  }
  function onPointerMove(e:React.TouchEvent<HTMLCanvasElement>|React.MouseEvent<HTMLCanvasElement>){
    if(!isDragging||!dragStart.current) return;
    const canvas=canvasRef.current!; const pos=getCanvasPos(e,canvas);
    dragCurrent.current=pos;
  }
  function onPointerUp(e:React.TouchEvent<HTMLCanvasElement>|React.MouseEvent<HTMLCanvasElement>){
    if(!isDragging||!dragStart.current) return;
    const canvas=canvasRef.current!; const pos=getCanvasPos(e,canvas);
    const ds=dragStart.current;
    const diff=sub(ds,pos); // opposite direction
    const spd=Math.min(len(diff)/4,MAX_SPEED);
    const dir=norm(diff);
    // Move player and flick
    stateRef.current={...stateRef.current,player:{...stateRef.current.player},discV:scale(dir,spd)};
    dragStart.current=null; dragCurrent.current=null; setIsDragging(false);
  }

  function handleRematch(){ setState(initState()); stateRef.current=initState(); setWinner(null); setPhase("matchmaking"); }

  return (
    <div className="flex flex-col min-h-screen" style={{background:"radial-gradient(ellipse at top,#001a08 0%,#07060e 60%)",maxWidth:480,margin:"0 auto"}}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={{background:"rgba(7,6,14,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{color:"rgba(255,255,255,0.55)"}}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🥏</span><span className="font-black text-white text-base">Disc Football</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{background:"rgba(0,255,135,0.08)",border:"1px solid rgba(0,255,135,0.22)"}}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{color:"#FFD700"}}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase==="matchmaking"&&<MatchmakingScreen entryFee={initialFee} onFound={()=>setPhase("playing")}/>}

      {phase==="playing"&&(
        <div className="flex-1 flex flex-col items-center gap-2 px-2 py-2">
          {/* Scoreboard */}
          <div className="flex items-center gap-4 px-4 py-2 rounded-2xl" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
            <div className="text-center"><span className="text-[10px] font-bold" style={{color:"rgba(239,68,68,0.6)"}}>🤖 Bot</span><div className="text-2xl font-black" style={{color:"#ef4444"}}>{state.bScore}</div></div>
            <div className="text-center"><span className="text-[10px] font-bold" style={{color:"rgba(255,255,255,0.3)"}}>FIRST TO {WIN_GOALS}</span></div>
            <div className="text-center"><span className="text-[10px] font-bold" style={{color:"rgba(255,215,0,0.6)"}}>You 👤</span><div className="text-2xl font-black" style={{color:"#FFD700"}}>{state.pScore}</div></div>
          </div>

          {/* Goal flash */}
          {goalFlash&&(
            <motion.div className="absolute z-40 font-black text-4xl text-center" style={{top:"40%",left:"50%",transform:"translate(-50%,-50%)",textShadow:"0 0 30px rgba(255,215,0,0.8)"}}
              initial={{scale:0.5,opacity:0}} animate={{scale:1.3,opacity:1}} exit={{scale:2,opacity:0}} transition={{duration:0.4}}>
              {goalFlash==="player"?"⚽ GOAL! 🎉":"😬 Bot Scores!"}
            </motion.div>
          )}

          {/* Canvas */}
          <canvas ref={canvasRef} width={W} height={H}
            style={{borderRadius:16,border:"2px solid rgba(0,255,135,0.3)",boxShadow:"0 0 40px rgba(0,255,135,0.15)",touchAction:"none",width:"100%",maxWidth:W}}
            onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp}
            onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}/>

          <div className="text-center text-xs font-bold" style={{color:"rgba(255,255,255,0.3)"}}>
            Drag from your gold player 👤 and release to flick the disc
          </div>
        </div>
      )}

      {phase==="result"&&(
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{opacity:0,y:40}} animate={{opacity:1,y:0}}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{background:winner==="player"?"rgba(0,255,135,0.15)":"rgba(239,68,68,0.1)",border:`3px solid ${winner==="player"?"rgba(0,255,135,0.5)":"rgba(239,68,68,0.4)"}`,boxShadow:winner==="player"?"0 0 60px rgba(0,255,135,0.4)":"0 0 40px rgba(239,68,68,0.3)"}}>
            {winner==="player"?"🏆":"💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{color:winner==="player"?"#00ff87":"#ef4444"}}>{winner==="player"?"You Win! 🎉":"Bot Wins!"}</div>
            <div className="text-sm mt-1" style={{color:"rgba(255,255,255,0.4)"}}>Final: You {state.pScore} — Bot {state.bScore}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.1)"}}>
            <div className="flex items-center justify-between px-4 py-4" style={{background:winner==="player"?"rgba(0,255,135,0.06)":"rgba(239,68,68,0.05)"}}>
              <span className="text-base font-black text-white">{winner==="player"?"Winnings":"You Lost"}</span>
              <span className="text-xl font-black" style={{color:winner==="player"?"#00ff87":"#ef4444"}}>{winner==="player"?`+₹${prize}`:`-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{scale:0.96}} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{background:"linear-gradient(135deg,#00ff87,#007e3a)",color:"#000",boxShadow:"0 0 28px rgba(0,255,135,0.45)"}}>
            🥏 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{color:"rgba(255,255,255,0.3)"}}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
