import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SceneLayer } from "../SceneLayer";
import { FlowInbox, FlowSideRail } from "../../shared/ui/patterns/flow/FlowSurfaces";
import type { FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { FeedbackDockContext, type DockFeedback } from "../../shared/ui/patterns/feedback/FeedbackDockContext";
import type { SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import "./generation-flow.css";
import { activeRunId, type GameSession } from "../session";
import { backgroundTaskIsCurrent, backgroundTasks, requestBackgroundTaskOpen, type BackgroundTask } from "./background-tasks";
import { gameHref, parseLocator, recordLocator } from "../navigation";
import { navigateTo, readRoute } from "../../shared/routing/location";

type TaskNotice = { view: FlowTaskView; visible: boolean; open: () => void };
const Tasks = createContext<((key: string, entry: TaskNotice | null) => void) | null>(null);
const emptySubscribe=()=>()=>{}, emptySnapshot=()=>null;
const blockingSurface="[data-ui-modal-present],.story-reading,.flow-reader[data-reader-locked]";
export function useGenerationNotice(view: FlowTaskView, visible: boolean, open: () => void) {
  const report = useContext(Tasks), openRef = useRef(open);
  openRef.current = open;
  useLayoutEffect(() => { report?.(view.key, {view, visible, open: () => openRef.current()}); }, [report, view, visible]);
  useLayoutEffect(() => () => report?.(view.key, null), [report, view.key]);
  return !!report;
}

/** One column inside the active Stage. No model calls, inventory mutations or hidden pages. */
export function GenerationFeedbackScope({children,session}: {children: ReactNode;session?:GameSession}) {
  const [tasks, setTasks] = useState(new Map<string, TaskNotice>());
  const [feedback, setFeedback] = useState(new Map<string, DockFeedback>());
  const reportTask = useCallback((key: string, entry: TaskNotice | null) => setTasks(current => {
    const next = new Map(current); if (entry) next.set(key, entry); else next.delete(key); return next;
  }), []);
  const reportFeedback = useCallback((key: string, entry: DockFeedback | null) => setFeedback(current => {
    const next = new Map(current); if (entry) next.set(key, entry); else next.delete(key); return next;
  }), []);
  const [blocked, setBlocked] = useState(false), [inbox, setInbox] = useState(false), [inboxPresent, setInboxPresent] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const pageState=useSyncExternalStore(session?.subscribe??emptySubscribe,session?.getSnapshot??emptySnapshot);
  const remote=useSyncExternalStore(backgroundTasks.subscribe,backgroundTasks.getSnapshot);
  const remoteTasks=useMemo(()=>remote.filter(t=>t.saveId===session?.locator.saveId&&t.epoch===session.locator.epoch&&!tasks.has(t.view.key)&&backgroundTaskIsCurrent(t,pageState?.record??null)),[remote,tasks,session,pageState?.record]);
  const canVisit=(task:BackgroundTask)=>!pageState?.record || !activeRunId(pageState.record) || task.page==="battle";
  const lastPhases = useRef(new Map<string, string>()), selected = useRef<string | null>(null);
  useEffect(() => {
    const update = () => setBlocked(!!document.querySelector(blockingSurface));
    const observer = new MutationObserver(update); observer.observe(document.body, {childList:true, subtree:true}); update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const current=new Map(tasks);
    for(const task of remoteTasks)current.set(task.view.key,{view:task.view,visible:true,open:()=>{}});
    for (const [key, entry] of current) {
      const previous = lastPhases.current.get(key);
      if (previous && previous !== entry.view.phase && entry.visible && ["readable", "failed", "unsaved"].includes(entry.view.phase))
        setAnnouncement(`${entry.view.title}，${entry.view.status}`);
      lastPhases.current.set(key, entry.view.phase);
    }
    for (const key of lastPhases.current.keys()) if (!current.has(key)) lastPhases.current.delete(key);
  }, [tasks,remote,session]);
  const available = [...tasks.values()].filter(t => t.visible).map(t => t.view).concat(remoteTasks.map(t=>canVisit(t)?t.view:{...t.view,entry:{enabled:false,label:"归来后查看"}}));
  const notices = useMemo(() => [...feedback.entries()].flatMap(([owner, source]) => source.entries
    .filter((e): e is Extract<SceneFeedbackEntry, {kind: "notice" | "reward"}> => e.kind !== "result")
    .map(e => ({...e, id: JSON.stringify([owner, e.id])}))), [feedback]);
  const open = (key: string) => {
    if(document.querySelector(".story-reading,.flow-reader[data-reader-locked]"))return;
    const local=tasks.get(key);if(local){local.open();return;}
    const task=remoteTasks.find(t=>t.view.key===key), record=session?.getSnapshot().record;
    if(task&&session){
      // A fading notice may still receive a click after the current save advances.
      if(!backgroundTaskIsCurrent(task,record??null) || record&&activeRunId(record)&&task.page!=="battle")return;
      requestBackgroundTaskOpen(session,key);
      const route=readRoute(), current=route&&parseLocator(route.search);
      // Refresh the resident host so it can open the requested task in place.
      // Re-entering the same route would replay the mansion's scene transition.
      if(route?.page===task.page && current?.saveId===session.locator.saveId && current.epoch===session.locator.epoch)
        void session.refresh({background:true});
      else navigateTo(gameHref(task.page,record?recordLocator(record):session.locator));
    }
  };
  const dismiss = (id: string) => { const [owner, original] = JSON.parse(id) as [string, string]; feedback.get(owner)?.dismiss(original); };
  return <Tasks.Provider value={reportTask}><FeedbackDockContext.Provider value={reportFeedback}>{children}
    <SceneLayer active={!!available.length || !!notices.length} className="generation-dock-layer">
      <FlowSideRail tasks={available} feedback={notices.slice(0, 3)} onOpen={open} onDismissFeedback={dismiss}
        onShowAll={() => setInbox(true)} announcement={announcement} suspended={blocked} feedbackPaused={[...feedback.values()].some(source=>source.paused)}/>
    </SceneLayer>
    <SceneLayer active={inbox || inboxPresent}>
      <FlowInbox open={inbox} identity="current-progress" tasks={available}
        onClose={() => setInbox(false)} onSelect={key => {selected.current = key; setInbox(false);}}
        onPresentChange={present => {setInboxPresent(present); if (!present && selected.current) {const key = selected.current; selected.current = null; open(key);}}}/>
    </SceneLayer>
  </FeedbackDockContext.Provider></Tasks.Provider>;
}
