import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { FlowDialog, FlowSideRail } from "../../shared/ui/patterns/flow/FlowSurfaces";
import { flowDisplayReducer, type FlowAction, type FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { SceneLayer } from "../SceneLayer";
import { useGenerationNotice } from "./GenerationFeedbackScope";
import { backgroundTaskPresentation, rememberBackgroundTask, type BackgroundTask, type TaskLane } from "./background-tasks";
import type { GameSession } from "../session";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { FlowSceneBackdrop } from "../../shared/ui/patterns/flow/FlowSceneBackdrop";
import { FlowReaderEntrance } from "./FlowReaderEntrance";
import { FlowReadingSurface } from "./FlowReadingSurface";
import "./generation-flow.css";

export type GenerationAction = FlowAction & { run: () => void | Promise<unknown> };
export function generationAction(id: string, label: string, enabled: boolean, run: GenerationAction["run"], effect: FlowAction["effect"] = "request"): GenerationAction {
  return {id, label, enabled, run, effect};
}

/** Presentation changes never start or stop requests. A live reader is explicitly entered. */
export function GenerationFlow({task, actions, children, details, footer, variant, reader, initialReader = false, readerLocked = false, initiallyClosed = false, initiallyExposed = !initiallyClosed,
  onPresentationChange, onBackground, background, launcher, active, backgroundOwner, returnPage = "mansion", lane = "director"}: {
  task: FlowTaskView; actions: readonly GenerationAction[]; children?: ReactNode; details?: ReactNode; footer?: ReactNode;
  variant?: "guide";
  reader?: (close: () => void) => ReactNode; initialReader?: boolean; readerLocked?: boolean; initiallyClosed?: boolean;
  /** Existing paused jobs retain a notice; an unused launcher stays quiet. */
  initiallyExposed?: boolean;
  onPresentationChange?: (visible: boolean) => void; onBackground?: () => void; background?: string;
  launcher?: (open: () => void) => ReactNode;
  active?: boolean;
  backgroundOwner?: GameSession; returnPage?: BackgroundTask["page"]; lane?: TaskLane;
}) {
  const {reduced}=useUiMotion();
  const restoredPresentation = backgroundTaskPresentation(backgroundOwner,task.key);
  const [display, dispatch] = useReducer(flowDisplayReducer, readerLocked && initialReader && reader ? {phase:"reader",key:task.key}
    : restoredPresentation === "background" ? {phase:"background"}
    : restoredPresentation === "open" ? {phase:"open",key:task.key}
    : initialReader && reader ? {phase: "reader", key:task.key}
    : initiallyClosed ? {phase:"background"} : {phase:"open",key:task.key});
  const previousKey = useRef(task.key), fromRail = useRef(false), running = useRef(false);
  const [exposed, setExposed] = useState(initiallyExposed || restoredPresentation !== undefined);
  const callbacks = useRef({onPresentationChange, onBackground}); callbacks.current = {onPresentationChange,onBackground};
  const current = useRef({task, actions, reader}); current.current = {task, actions, reader};
  const enteringReader=display.phase==="entering-reader"&&display.key===task.key;
  const showingReader=(display.phase==="reader"||enteringReader)&&display.key===task.key;
  const dissolve=enteringReader||display.phase==="reader"&&display.entrance==="dissolve";
  useEffect(() => {if(backgroundOwner && exposed)rememberBackgroundTask(backgroundOwner,task,returnPage,lane,display.phase==="background");}, [backgroundOwner,task,returnPage,lane,exposed,display.phase]);
  const wasBackground = useRef(display.phase === "background");
  const previousActive = useRef(active);
  useEffect(() => {
    if (previousActive.current === active) return;
    previousActive.current = active;
    if (active) {setExposed(true); dispatch({type:"open",key:task.key});}
    else if (display.phase === "open") dispatch({type:"minimize",key:task.key});
    else if (!readerLocked && (display.phase === "reader" || display.phase === "entering-reader")) dispatch({type:"leave-reader",key:task.key});
  }, [active, task.key, display.phase, readerLocked]);
  useLayoutEffect(() => {
    if (previousKey.current === task.key) return;
    previousKey.current = task.key; fromRail.current = false;
    // A newly assigned job must not reopen a flow the player already minimized.
    dispatch({type:"reset"});
    if (readerLocked && initialReader && reader) dispatch({type:"restore-reader",key:task.key});
    else if (display.phase !== "background") dispatch({type:"open",key:task.key});
  }, [task.key]);
  useLayoutEffect(() => {
    // Saved reader entry wins over a stale minimized notice. The explicit Read
    // action owns its expansion; automatic continuation/restoration enters directly.
    if (readerLocked && initialReader && reader && !running.current && !showingReader)
      dispatch({type:"restore-reader",key:task.key});
  }, [readerLocked, initialReader, !!reader, showingReader, task.key]);
  const visible = display.phase !== "background";
  useLayoutEffect(() => {
    if ((display.phase === "reader" || display.phase === "entering-reader") && !reader) {dispatch({type:"leave-reader",key:display.key}); dispatch({type:"open",key:task.key});}
  }, [display, reader, task.key]);
  useEffect(() => {callbacks.current.onPresentationChange?.(visible);}, [visible]);
  useEffect(() => {
    if (display.phase === "background" && !wasBackground.current) callbacks.current.onBackground?.();
    wasBackground.current = display.phase === "background";
  }, [display.phase]);
  useEffect(()=>{
    if(!enteringReader)return;
    // The modal can finish before the room expansion. Keep that short gap
    // from reaching document-level shortcuts or advancing the hidden reader.
    const hold=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();};
    window.addEventListener("keydown",hold,true);window.addEventListener("keyup",hold,true);
    return ()=>{window.removeEventListener("keydown",hold,true);window.removeEventListener("keyup",hold,true);};
  },[enteringReader]);
  const open = () => {setExposed(true); fromRail.current = true; dispatch({type:"open",key:task.key});};
  const scoped = useGenerationNotice(task, exposed && !visible, open);
  const perform = async (key: string, action: FlowAction) => {
    const latest = current.current;
    const selected = latest.actions.find(a => a.id === action.id);
    if (key !== latest.task.key || !selected?.enabled) return;
    if (selected.effect === "stop") {await selected.run(); return;}
    if (running.current) return;
    running.current = true;
    try {
      await selected.run();
      if (action.id === "read" && current.current.task.key === key && current.current.reader) dispatch({type:"read", key});
    } finally {running.current = false;}
  };
  const closeReader = () => {if (!readerLocked) dispatch({type:"leave-reader",key:task.key});};
  const panel = display.phase === "open" || display.phase === "closing" || enteringReader&&!display.panelGone;
  const exitTo=enteringReader?"reader":"rail";
  const readerContent=showingReader && <FlowReadingSurface blocked={enteringReader} locked={readerLocked} dissolve={dissolve}>
    {reader?.(closeReader)}
  </FlowReadingSurface>;
  return <>
    {launcher?.(open)}
    <SceneLayer active={panel || showingReader} className="generation-flow-layer">
      {(panel||enteringReader) && <FlowSceneBackdrop key={`scene:${task.key}`} src={background} present={display.phase==="open"} reduced={reduced}
        from={fromRail.current?"rail":"center"} exitTo={exitTo} onExpanded={()=>dispatch({type:"expanded",key:task.key})}/>}
      {enteringReader && <div className="flow-reader-shield" aria-hidden="true" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}/>}
      <FlowDialog open={display.phase === "open"} task={task} variant={variant} sceneOutside from={fromRail.current ? "rail" : "center"}
        exitTo={exitTo}
        onMinimize={key => dispatch({type:"minimize",key})} onAction={(key, action) => {void perform(key,action).catch(() => {});}}
        onPresentChange={present => {if (!present) dispatch({type:"exited",key:task.key});}} details={details} footer={footer}>
        {children}
      </FlowDialog>
      {dissolve&&showingReader ? <FlowReaderEntrance key={`reader:${task.key}`} blocked={enteringReader} onPrepared={()=>dispatch({type:"prepared",key:task.key})}>
        {readerContent}
      </FlowReaderEntrance> : readerContent}
    </SceneLayer>
    {!scoped && <SceneLayer active={exposed && !visible} className="generation-dock-layer"><FlowSideRail tasks={[task]} feedback={[]}
      onOpen={open} onShowAll={open} onDismissFeedback={() => {}} announcement=""/></SceneLayer>}
  </>;
}
