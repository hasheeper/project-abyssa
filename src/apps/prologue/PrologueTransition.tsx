import { useLayoutEffect, useRef } from "react";
import { STAGE_CANVAS_WIDTH as W, STAGE_CANVAS_HEIGHT as H } from "../../shared/stage";
import { clamp } from "./renderer";

type Point = {x:number;y:number};
type Shard = {points:Point[];x:number;y:number;spin:number;speed:number};
function glassShards(): Shard[] {
  const rings:Point[][]=[];const count=18,cx=W*.5,cy=H*.29;
  const random=(n:number)=>{const f=Math.sin(n*127.1+33)*43758.545;return f-Math.floor(f);};
  for(let ring=0;ring<4;ring++)rings.push(Array.from({length:count},(_,i)=>{
    const a=i/count*Math.PI*2+(ring%2)*.07, r=[0,170,470,1900][ring]*(.9+random(i+ring*count)*.2);
    return {x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};
  }));
  const triangles:Point[][]=[];
  for(let ring=1;ring<4;ring++)for(let i=0;i<count;i++){
    const j=(i+1)%count; triangles.push([rings[ring-1][i],rings[ring][i],rings[ring][j]]);
    if(ring>1)triangles.push([rings[ring-1][i],rings[ring][j],rings[ring-1][j]]);
  }
  return triangles.map((points,i)=>({points,x:points.reduce((s,p)=>s+p.x,0)/3,y:points.reduce((s,p)=>s+p.y,0)/3,spin:(random(i+99)-.5)*1.8,speed:.45+random(i+19)*.8}));
}
const shards=glassShards();
export type OutgoingFrame = {image:HTMLCanvasElement;duration:number;kind:"dissolve"|"memory"|"glass"};
/** A gentle dip during the dissolve avoids piling bright, intricate plates together. */
export function memoryDissolveAt(progress:number) {
  const p=clamp(progress), t=clamp((p-.08)/.84);
  return { opacity:1-t*t*(3-2*t), veil:.20*Math.sin(Math.PI*p)**2 };
}
export function PrologueTransition({frame,ready,onDone}:{frame:OutgoingFrame;ready:boolean;onDone():void}) {
  const ref=useRef<HTMLCanvasElement>(null), done=useRef(onDone), incomingReady=useRef(ready);
  done.current=onDone;incomingReady.current=ready;
  useLayoutEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext("2d")!;canvas.width=frame.image.width;canvas.height=frame.image.height;
    ctx.scale(canvas.width/W,canvas.height/H);
    let raf=0,elapsed=0,last=0;
    const triangle=(s:Shard)=>{ctx.beginPath();s.points.forEach((p,i)=>{if(!i)ctx.moveTo(p.x-s.x,p.y-s.y);else ctx.lineTo(p.x-s.x,p.y-s.y);});ctx.closePath();};
    function draw(){
      ctx.clearRect(0,0,W,H);
      if(frame.kind==="memory"){
        const {opacity,veil}=memoryDissolveAt(elapsed/frame.duration);
        ctx.globalAlpha=opacity;ctx.drawImage(frame.image,0,0,W,H);ctx.globalAlpha=1;
        ctx.fillStyle=`rgba(23,19,17,${veil})`;ctx.fillRect(0,0,W,H);
      }
      else if(frame.kind!=="glass"){ctx.globalAlpha=1-clamp(elapsed/frame.duration);ctx.drawImage(frame.image,0,0,W,H);ctx.globalAlpha=1;}
      else if(elapsed<850){
        ctx.drawImage(frame.image,0,0,W,H);
        const flare=Math.sin(Math.PI*clamp(elapsed/370));
        ctx.fillStyle=`rgba(252,244,221,${flare*.70})`;ctx.fillRect(0,0,W,H);
        // Three unequal stress snaps, then the surface gives way.
        const reach=elapsed<290?0:elapsed<445?170:elapsed<650?470:1900;
        ctx.lineWidth=.85;ctx.strokeStyle="rgba(226,230,241,.65)";ctx.shadowColor="#020208";ctx.shadowBlur=3;
        for(const shard of shards)if(Math.hypot(shard.x-W*.5,shard.y-H*.29)<reach){ctx.save();ctx.translate(shard.x,shard.y);triangle(shard);ctx.stroke();ctx.restore();}
        ctx.shadowBlur=0;
      }else{
        const t=clamp((elapsed-850)/(frame.duration-850));
        for(const s of shards){
          ctx.save(); const progress=t*t*s.speed;
          ctx.translate(s.x+(s.x-W*.5)*progress*2.1,s.y+(s.y-H*.29)*progress*1.2+progress*H*.50);
          ctx.rotate(s.spin*t);ctx.scale(1+t*.40,Math.max(.07,Math.cos(t*(1.4+s.speed))));
          triangle(s);ctx.clip();ctx.globalAlpha=1-clamp((t-.65)/.35);
          ctx.drawImage(frame.image,-s.x,-s.y,W,H);ctx.fillStyle=`rgba(180,200,230,${Math.sin(t*Math.PI)*.10})`;ctx.fillRect(-s.x,-s.y,W,H);ctx.restore();
        }
      }
    }
    function tick(now:number){
      const delta=last?now-last:0;last=now;
      if(incomingReady.current && !document.hidden && delta<200)elapsed+=delta;
      draw();
      if(elapsed>=frame.duration){done.current();return;}raf=requestAnimationFrame(tick);
    }
    // Cover the new scene synchronously; otherwise its first frame flashes through
    // the empty transition canvas before the first RAF can paint the outgoing CG.
    draw();raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
  },[frame]);
  return <canvas className="prologue-transition" data-kind={frame.kind} ref={ref} aria-hidden="true"/>;
}
