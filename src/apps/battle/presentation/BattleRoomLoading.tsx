import { useEffect, useState } from "react";
import { LoadingPlaque } from "../../../shared/transition/LoadingPlaque";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import { ROOM_LOADING_NOTICE_MS } from "./journey-motion";
import "./battle-room-loading.css";

/** A resource hold inside the enemy stage. Never replaces the party/dice/frame. */
export function BattleRoomLoading({state,location,onRetry}:{
  state:"loading"|"error"|"revealing"; location?:string; onRetry:()=>void;
}) {
  const {reduced}=useUiMotion();
  const [announced,setAnnounced]=useState(false);
  useEffect(()=>{
    if(state==="error"){setAnnounced(true);return;}
    if(state!=="loading")return;
    const timer=window.setTimeout(()=>setAnnounced(true),ROOM_LOADING_NOTICE_MS);
    return ()=>window.clearTimeout(timer);
  },[state]);
  const message=announced||state==="error";
  return <div className="battle-room-loading scene-loading-surface" data-state={state} data-reduced={reduced||undefined}
    role={state==="error"?"alert":"status"} aria-label="下一层场景载入" aria-busy={state==="loading"}>
    {message&&<LoadingPlaque className="battle-room-loading__plaque">
      <span className="scene-loading-channel">克雷格旧庄园</span>
      <h2 className="scene-loading-title">{state==="error"?"战场画面准备失败":location??"正在准备下一层"}</h2>
      <p>{state==="error"?"画面未能载入，进度已保存。":"正在载入场景…"}</p>
      {state==="error"&&<button type="button" className="scene-loading-action" onClick={onRetry}>重新加载画面</button>}
    </LoadingPlaque>}
  </div>;
}
