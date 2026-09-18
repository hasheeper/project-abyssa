import { useLayoutEffect, useRef, useState } from "react";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import type { BattleSurfaceEnemy } from "./battle-surface-model";
import { compactEnemyStage, enemyHealthLayers, enemyRepositionProgress, intentLinkPath, layoutEnemyStage, reconcileEnemySeats, type IntentLink } from "./enemy-stage-model";

type LineNodes = { paths: SVGPathElement[]; socket: SVGCircleElement | null };
const writeStyle = (node: HTMLElement, name: string, value: string) => {
  if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
};

export function useEnemyStageLayout(enemies: BattleSurfaceEnemy[], formationKey: string, partyIds: string[], settled: boolean) {
  const signature = enemies.map(enemy=>enemy.id).join("|");
  const [memory,setMemory] = useState({key:formationKey,signature,seats:enemies});
  if (memory.key !== formationKey || memory.signature !== signature) {
    setMemory({key:formationKey,signature,seats:memory.key === formationKey ? reconcileEnemySeats(memory.seats,enemies) : enemies});
  }
  const live = new Map(enemies.map(enemy=>[enemy.id,enemy]));
  const seats = memory.seats.map(enemy=>live.get(enemy.id) ?? enemy);
  const stageRef = useRef<HTMLElement|null>(null);
  const measuredUi = useRef({formation: formationKey, widths: new Map<string,number>()});
  const lineNodes = useRef(new Map<string,LineNodes>());
  const {reduced}=useUiMotion();
  const [reflowing,setReflowing]=useState(false);
  const motion=useRef({frame:null as number|null,key:"",formation:"",topology:"",width:0,height:0,running:false,positions:new Map<string,number>()});
  const paintRef=useRef<()=>void>(()=>{}),publishRef=useRef<()=>void>(()=>{});
  const settleRef=useRef<()=>void>(()=>{});
  const [lines,setLines] = useState<{width:number;height:number;links:IntentLink[]}>({width:0,height:0,links:[]});
  const measurementKey = JSON.stringify([formationKey,partyIds,settled,reduced,
    seats.map(enemy=>[enemy.id,enemy.art,enemy.artBounds,enemy.artStyle,enemy.frenzyActive,enemy.frenzyWarning]),
    enemies.map(enemy=>[enemy.id,enemy.name,enemy.defeated,enemy.intent?.targetId,enemy.intent?.title,enemy.intent?.value,enemy.blocked,enemy.maxHp>32?enemyHealthLayers(enemy.hp,enemy.maxHp).number:null])]);
  useLayoutEffect(()=>()=>{if(motion.current.frame!==null)cancelAnimationFrame(motion.current.frame);},[]);
  useLayoutEffect(()=>{
    const stage = stageRef.current;
    const field = stage?.closest<HTMLElement>(".abyssa-expedition-regions__battlefield");
    if (!stage || !field) return;
    let cancelled = false;
    let measurementFrame: number | null = null;
    const measure = () => {
      if (cancelled || document.hidden) return;
      const width=stage.clientWidth,height=stage.clientHeight;
      if (!width || !height) return;
      const formation=stage.querySelector<HTMLElement>(".abyssa-expedition-enemies__formation");
      if (!formation) return;
      if (measuredUi.current.formation !== formationKey) measuredUi.current={formation:formationKey,widths:new Map()};
      const widths=measuredUi.current.widths;
      const nodes=[...formation.querySelectorAll<HTMLElement>(".abyssa-expedition-enemy")];
      const stageBox=stage.getBoundingClientRect();
      const scaleX=stageBox.width/stage.offsetWidth,scaleY=stageBox.height/stage.offsetHeight;
      if (!scaleX || !scaleY) return;
      // First read batch: intrinsic text and stationary party targets. Never
      // interleave these reads with per-enemy dimension writes.
      const textWidth=(node:Element|null)=>{
        if(!node)return 0;
        const range=document.createRange();
        range.selectNodeContents(node);
        return typeof range.getBoundingClientRect==="function"?range.getBoundingClientRect().width/scaleX:0;
      };
      nodes.forEach(node=>{
        const nextWidth=Math.max(textWidth(node.querySelector("header strong"))+14,textWidth(node.querySelector(".abyssa-expedition-intent b"))+50,94);
        widths.set(node.dataset.enemyId!,Math.max(nextWidth,widths.get(node.dataset.enemyId!)??0));
      });
      const originX=stageBox.left+stage.clientLeft*scaleX,originY=stageBox.top+stage.clientTop*scaleY;
      const targets=new Map([...field.querySelectorAll<HTMLElement>(".abyssa-expedition-party-card")].flatMap(card=>{
        const column=card.closest<HTMLElement>(".abyssa-expedition-party-column");
        if (!column) return [];
        const box=column.getBoundingClientRect();
        return [[card.dataset.character,{x:(box.left+box.width/2-originX)/scaleX,y:(box.top-originY)/scaleY+card.offsetTop-7}] as const];
      }));
      const envelope=layoutEnemyStage(seats,width,height,seats.map(enemy=>widths.get(enemy.id)??94));
      const layout=compactEnemyStage(seats,envelope,enemies,width);
      const slots=new Map(layout.map(slot=>[slot.id,slot]));
      const units=nodes.flatMap(node=>{
        const slot=slots.get(node.dataset.enemyId!);
        return slot?[{node,slot,img:node.querySelector<HTMLImageElement>(":scope > img"),intent:node.querySelector<HTMLElement>(".abyssa-expedition-intent")}]:[];
      });
      // Fixed layout target. Only the compositor translation changes during reflow.
      units.forEach(({node,slot,img})=>{
        if (img) for (const [name,value] of Object.entries({width:`${slot.canvasWidth}px`,height:`${slot.canvasHeight}px`,left:`${slot.artLeft}px`,top:`${slot.artTop}px`,"transform-origin":slot.origin})) writeStyle(img,name,value);
        for (const [name,value] of Object.entries({
          width:`${slot.frameWidth}px`,left:`${slot.center-slot.frameWidth/2}px`,
          "--enemy-hover-zoom":String(slot.zoom),"--enemy-depth":String(slot.depth),
          "--enemy-frame-left":"0px","--enemy-frame-width":`${slot.frameWidth}px`,
          "--enemy-ui-width":`${slot.uiWidth}px`,"--enemy-hit-width":`${slot.visibleWidth}px`,
          "--enemy-hit-height":`${slot.visibleHeight}px`,"--enemy-foot":`${slot.foot}px`,
          "--enemy-frame-top":`${Math.max(30,Math.min(36,height-slot.foot-slot.visibleHeight*slot.zoom-3))}px`,
        })) writeStyle(node,name,value);
      });
      // Intent wrapping depends on the new UI width: one batched read, then write.
      const caps=units.map(({intent,slot})=>Math.min(slot.frameWidth-4,(intent?.offsetWidth??24)+14));
      units.forEach(({node,slot},index)=>{
        writeStyle(node,"--enemy-cap-left",`${(slot.frameWidth-caps[index])/2}px`);
        writeStyle(node,"--enemy-cap-width",`${caps[index]}px`);
      });
      const links:IntentLink[]=enemies.flatMap(enemy=>{
        if (enemy.defeated || !enemy.intent?.targetId) return [];
        const target=targets.get(enemy.intent.targetId),seat=slots.get(enemy.id);
        return target&&seat?[{id:enemy.id,fromX:seat.center,fromY:height-5,toX:target.x,toY:target.y}]:[];
      }).filter(link=>link.toY>link.fromY);
      const state=motion.current;
      const currentLinks=()=>links.map(link=>({...link,fromX:state.positions.get(link.id)??link.fromX}));
      publishRef.current=()=>{
        const next={width,height:Math.max(height,...links.map(link=>link.toY+4)),links:currentLinks()};
        setLines(current=>JSON.stringify(current)===JSON.stringify(next)?current:next);
      };
      // One clock for unit and socket; no geometry reads, DOM queries or React
      // updates on animation frames. Entry owns translate until the scene settles.
      paintRef.current=()=>{
        units.forEach(({node,slot})=>{
          const delta=(state.positions.get(slot.id)??slot.center)-slot.center;
          writeStyle(node,"translate",state.running?`${delta}px 0`:"");
          writeStyle(node,"will-change",state.running?"translate":"");
        });
        for(const link of currentLinks()) {
          const group=lineNodes.current.get(link.id);
          const path=intentLinkPath(link);
          group?.paths.forEach(node=>node.setAttribute("d",path));
          group?.socket?.setAttribute("cx",String(link.fromX));
        }
      };
      settleRef.current=()=>{
        if(state.frame!==null)cancelAnimationFrame(state.frame);
        state.frame=null;state.running=false;
        state.positions=new Map(layout.map(slot=>[slot.id,slot.center]));
        setReflowing(false);paintRef.current();publishRef.current();
      };
      const key=JSON.stringify([formationKey,width,height,layout.map(slot=>[slot.id,slot.center,slot.frameWidth])]);
      if(key!==state.key||state.running&&(reduced||!settled)) {
        const animate=settled&&!reduced&&state.formation===formationKey&&state.width===width&&state.height===height&&(state.topology!==signature||state.running);
        const moves=layout.map(slot=>({id:slot.id,from:animate?(state.positions.get(slot.id)??slot.center):slot.center,to:slot.center}));
        if(state.frame!==null)cancelAnimationFrame(state.frame);
        state.frame=null;
        state.positions=new Map(moves.map(move=>[move.id,move.from]));
        Object.assign(state,{key,formation:formationKey,topology:signature,width,height});
        state.running=animate&&moves.some(move=>Math.abs(move.from-move.to)>.35);
        if(!state.running)state.positions=new Map(layout.map(slot=>[slot.id,slot.center]));
        setReflowing(state.running);
        if(state.running) {
          const started=performance.now();
          const step=(now:number)=>{
            const progress=enemyRepositionProgress(now-started);
            moves.forEach(move=>state.positions.set(move.id,move.from+(move.to-move.from)*progress));
            if(progress<1) {paintRef.current();state.frame=requestAnimationFrame(step);}
            else settleRef.current();
          };
          state.frame=requestAnimationFrame(step);
        }
      }
      paintRef.current();
      publishRef.current();
    };
    const scheduleMeasure=()=>{
      if(cancelled||document.hidden||measurementFrame!==null)return;
      measurementFrame=requestAnimationFrame(()=>{measurementFrame=null;measure();});
    };
    const animationEnded=(event:AnimationEvent)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      if ((target.matches(".abyssa-expedition-enemy")&&["expedition-enemy-enter","manor-seat-in"].includes(event.animationName))
        || (target.matches(".abyssa-expedition-party-column")&&event.animationName==="manor-party-in")) scheduleMeasure();
    };
    const visibilityChanged=()=>{
      if(document.hidden) {
        if(measurementFrame!==null)cancelAnimationFrame(measurementFrame);
        measurementFrame=null;
        settleRef.current();
      } else scheduleMeasure();
    };
    measure();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(scheduleMeasure):null;
    observer?.observe(stage);
    field.querySelectorAll(".abyssa-expedition-party-column").forEach(node=>observer?.observe(node));
    stage.addEventListener("load",scheduleMeasure,true);
    field.addEventListener("animationend",animationEnded,true);
    window.addEventListener("resize",scheduleMeasure);
    document.addEventListener("visibilitychange",visibilityChanged);
    const fonts=document.fonts;
    fonts?.addEventListener("loadingdone",scheduleMeasure);
    if(fonts?.status==="loading")void fonts.ready.then(scheduleMeasure);
    return ()=>{
      cancelled=true;
      if(measurementFrame!==null)cancelAnimationFrame(measurementFrame);
      observer?.disconnect();
      stage.removeEventListener("load",scheduleMeasure,true);
      field.removeEventListener("animationend",animationEnded,true);
      window.removeEventListener("resize",scheduleMeasure);
      document.removeEventListener("visibilitychange",visibilityChanged);
      fonts?.removeEventListener("loadingdone",scheduleMeasure);
    };
  },[measurementKey]);
  // React may mount/remove sockets after measurement publishes new line data.
  // Refresh references on commits, never inside the animation loop.
  useLayoutEffect(()=>{
    lineNodes.current=new Map([...stageRef.current?.querySelectorAll<SVGGElement>(".abyssa-expedition-enemies__intent-lines g")??[]].map(group=>[
      group.dataset.enemyId!,{paths:[...group.querySelectorAll<SVGPathElement>("path")],socket:group.querySelector<SVGCircleElement>("circle")},
    ]));
    paintRef.current();
  },[lines]);
  return {stageRef,seats,lines,reflowing};
}
