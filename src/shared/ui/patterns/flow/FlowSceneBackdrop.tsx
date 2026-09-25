import { useLayoutEffect, useRef } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionStyle } from "motion/react";
import { flowSceneTransition, type FlowOrigin, type ScenePart } from "./flow-motion";
import { FLOW_HANDOFF as handoff } from "./flow-handoff";

const REST = "brightness(0.84) saturate(0.84) contrast(0.95)";
const DIM = "brightness(0.45) saturate(0.7) contrast(0.95)";

/** Opaque scene in the center, feathered into the surrounding scrim and mansion. */
export function FlowSceneBackdrop({ src, present, reduced, from, exitTo, onExpanded }: {
  src?: string; present: boolean; reduced: boolean; from: FlowOrigin; exitTo: "rail" | "reader"; onExpanded?:()=>void;
}) {
  const rail = from === "rail";
  const expanding = !present && exitTo === "reader";
  const shown = present || expanding;
  const expanded=useRef(onExpanded); expanded.current=onExpanded;
  const progress=useMotionValue(0);
  const left=useTransform(progress,[0,1],[handoff.from.left,handoff.to.left]);
  const top=useTransform(progress,[0,1],[handoff.from.top,handoff.to.top]);
  const width=useTransform(progress,[0,1],[handoff.from.width,handoff.to.width]);
  const height=useTransform(progress,[0,1],[handoff.from.height,handoff.to.height]);
  const aperture=useTransform(progress,[0,1],[1,handoff.aperture]);
  const shade=useTransform(progress,[.12,.85],[1,0]);
  const readerOpacity=useTransform(progress,[.18,.94],[0,1]);
  const viewOpacity=useMotionValue(0),panelAperture=useMotionValue(reduced?1:rail ? .92 : .8);
  useLayoutEffect(()=>{
    const track=flowSceneTransition("view",present,reduced,from,exitTo);
    // Explicitly retarget even if both entrances end at opacity 1. A fast Read
    // click must finish establishing the room before the expansion hands over.
    const fade=animate(viewOpacity,shown?1:0,track),open=animate(panelAperture,1,track);
    return()=>{fade.stop();open.stop();};
  },[present,shown,reduced,from,exitTo,viewOpacity,panelAperture]);
  useLayoutEffect(()=>{
    if(!expanding){progress.jump(0);return;}
    let active=true;
    // Reduced motion snaps geometry; the reader retains its short opacity entrance.
    if(reduced)progress.jump(1);
    const controls=animate(progress,1,{duration:(reduced?handoff.reducedMs:handoff.expandMs)/1000,
      delay:reduced?0:handoff.delayMs/1000,ease:[...handoff.expandEase]});
    const finish=()=>{if(!active)return;active=false;progress.jump(1);expanded.current?.();};
    const hidden=()=>{if(document.hidden){controls.stop();finish();}};
    void controls.then(finish);
    document.addEventListener("visibilitychange",hidden);hidden();
    return()=>{active=false;controls.stop();document.removeEventListener("visibilitychange",hidden);};
  },[expanding,reduced,progress]);
  const transition = (part: ScenePart) => flowSceneTransition(part, present, reduced, from, exitTo);
  return <div className="flow-scene" aria-hidden="true" data-exit-to={exitTo}>
    <motion.div className="flow-scene__curtain"
      initial={{ opacity: 0, scale: reduced || rail ? 1 : .94 }}
      animate={{ opacity: present ? 1 : 0, scale: 1 }} transition={expanding?{duration:reduced ? .08 : .4,delay:reduced?0:.36}:transition("curtain")}/>
    {expanding && <motion.div className="flow-scene__reader-floor" style={{opacity:readerOpacity}}/>}
    {src && <motion.div className="flow-scene__view"
      style={{left,top,width,height,opacity:viewOpacity,"--flow-aperture":panelAperture,"--flow-unfold":aperture,"--flow-shade-opacity":shade} as MotionStyle}>
      <motion.img src={src} alt="" draggable={false}
        initial={{ scale: reduced ? 1 : rail ? 1.012 : 1.04, filter: reduced ? REST : DIM }}
        animate={{ scale: 1, filter: REST }} transition={expanding?{duration:reduced?0:.4}:transition("settle")}/>
      {expanding && <motion.div className="flow-scene__reader-background" style={{backgroundImage:`url("${src}")`,opacity:readerOpacity}}/>}
    </motion.div>}
  </div>;
}
