import { GameSession, type ClientRuntime } from "../session";
import type { SaveLocator } from "../navigation";
import { observeCommits } from "../observe-commits";
import type { FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { directorStage } from "../../game-runtime/airp-director-view";
import { airpGameView, pendingHomeBoundary } from "../../game-runtime/airp-game-runtime";
import type { AnyGameRecord, D5GameRecord } from "../../game-application";

type Driver = {getSnapshot: () => {busy:boolean;pendingResult:boolean;error:string|null;jobId?:string|null;stage?:string|null;phase?:string};subscribe:(listener:()=>void)=>()=>void;cancel:()=>void};
type Host = {session:GameSession;observer:ReturnType<typeof observeCommits>;drivers:Map<Driver,{off:()=>void;lane:TaskLane}>;views:Map<string,BackgroundTask>};
export type TaskLane = "director" | "plan" | "node" | "settlement";
export type BackgroundTask = {view:FlowTaskView;saveId:string;epoch:string;page:"mansion"|"map"|"battle";lane:TaskLane;minimized:boolean};
const factories = new WeakMap<GameSession,()=>ClientRuntime>(), hosts = new Map<string,Host>();
const commandsInFlight=new WeakMap<GameSession,Promise<unknown>>();
export function serializeTaskCommand<T>(session:GameSession,operation:()=>Promise<T>):Promise<T> {
  const next=(commandsInFlight.get(session)??Promise.resolve()).catch(()=>{}).then(operation);
  commandsInFlight.set(session,next);void next.finally(()=>{if(commandsInFlight.get(session)===next)commandsInFlight.delete(session);}).catch(()=>{});return next;
}
const listeners = new Set<()=>void>();
let snapshot:readonly BackgroundTask[] = [];
let activeIdentity:string|undefined;
const keyOf = (locator:SaveLocator) => JSON.stringify([locator.saveId,locator.epoch]);
const publish = () => {snapshot=[...hosts.values()].flatMap(h=>[...h.views.values()]);listeners.forEach(l=>l());};
/** Saved lifecycle wins over the outgoing page's last rendered notification. */
export function backgroundTaskIsCurrent(task:BackgroundTask,record:AnyGameRecord|null) {
  if(!record)return true; // A host that has not loaded yet cannot retire saved work.
  if(record.schemaVersion!==4 || record.head.saveId!==task.saveId || record.head.epoch!==task.epoch)return false;
  const [, , family,jobId]=JSON.parse(task.view.key) as string[];
  if(family==="director") {
    const job=record.airpDirector?.jobs.find(j=>j.id===jobId);
    return !!job && (job.kind==="scene" ? record.airpDirector?.reading?.jobId===jobId && !record.airpDirector.reading.completed
      : job.kind==="day" ? !record.airpDirector?.days.some(day=>day.jobId===jobId) : !job.excerpt);
  }
  const current=airpGameView(record),home=pendingHomeBoundary(record);
  if(current?.plan.id===jobId) {
    const run=record.snapshot.run;
    return current.plan.status!=="started" && !(run?.kind==="expedition" && run.id===current.plan.frames.at(-1)?.departure.runId);
  }
  return current?.node?.id===jobId || home?.factId===jobId;
}
function driverOwnsTask(record:AnyGameRecord|null,jobId:string|null|undefined,lane:TaskLane,task:BackgroundTask) {
  if(!jobId || task.lane!==lane)return false;
  const taskId=(JSON.parse(task.view.key) as string[])[3];
  if(lane!=="settlement")return jobId===taskId;
  return record?.schemaVersion===4 && record.airpGame?.settlement.jobs.some(j=>j.id===jobId && j.frames.at(-1)?.input.scope.boundaryId===taskId);
}
function taskRecorded(record:D5GameRecord,task:BackgroundTask) {
  const [, , family,id]=JSON.parse(task.view.key) as string[];
  if(family==="director")return record.airpDirector?.jobs.some(j=>j.id===id);
  return record.airpGame?.gm.jobs.some(j=>j.id===id) || Object.values(record.airpGame?.nodes??{}).some(ledger=>ledger.jobs.some(j=>j.id===id)) || record.facts.some(f=>f.id===id);
}
function pruneCompletedTasks(host:Host,newKey?:string) {
  const state=host.session.getSnapshot(),record=state.record;
  if(state.status!=="ready" || record?.schemaVersion!==4)return;
  let changed=false;
  for(const [key,task] of host.views) {
    // A page can observe a newly committed job before the background port refreshes.
    // Retire known obsolete work now; judge an unseen job on the next saved refresh.
    if(key===newKey&&!taskRecorded(record,task))continue;
    const ownedRequest=[...host.drivers].some(([driver,{lane}])=>{
      const status=driver.getSnapshot();
      return (status.busy||status.pendingResult) && driverOwnsTask(record,status.jobId,lane,task);
    });
    if(!ownedRequest&&!backgroundTaskIsCurrent(task,record)){host.views.delete(key);changed=true;}
  }
  if(changed)publish();
}
function releaseInactiveHost(host:Host) {
  const key=keyOf(host.session.locator);
  if(hosts.get(key)!==host || !activeIdentity || key===activeIdentity || [...host.drivers.keys()].some(d=>d.getSnapshot().busy||d.getSnapshot().pendingResult))return false;
  for(const {off} of host.drivers.values())off();
  host.observer.close();host.session.dispose();hosts.delete(key);return true;
}
export const backgroundTasks = {subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},getSnapshot:()=>snapshot};

/** Page registration does not allocate a task runtime until AIRP actually asks for it. */
export function registerBackgroundFactory(session:GameSession,factory:()=>ClientRuntime) {factories.set(session,factory);}
export function taskSessionFor(page:GameSession):GameSession {
  const factory=factories.get(page); if(!factory)return page; // injected/standalone sessions retain their owner
  const key=keyOf(page.locator);let host=hosts.get(key);if(host)return host.session;
  let observer:ReturnType<typeof observeCommits>;
  const commands=["use-format","begin","result","fail","enable-commissions","configure","respond","revalidate-low","prepare-day","prepare-replan","reconnect","accept-day","open","pause","show","prepare-memory","read","choose","deliver","defer","decline"].map(name=>`airp-director-${name}`);
  const session=new GameSession(factory(),{saveId:page.locator.saveId,epoch:page.locator.epoch},window.sessionStorage,record=>observer?.notify(record.head),{continueRuns:false,commandTypes:commands});
  observer=observeCommits(session.locator,()=>session.refresh({background:true}));
  host={session,observer,drivers:new Map(),views:new Map()};hosts.set(key,host);
  const owner=host;
  session.subscribe(()=>pruneCompletedTasks(owner));
  return session;
}
export function registerBackgroundDriver(session:GameSession,driver:Driver,lane:TaskLane="director") {
  const host=hosts.get(keyOf(session.locator));if(!host||host.drivers.has(driver))return;
  let generation=0;
  const update=()=>{
    const revision=++generation;
    if(releaseInactiveHost(host)){publish();return;}
    const status=driver.getSnapshot();
    for(const task of host.views.values()) {
      if(!driverOwnsTask(host.session.getSnapshot().record,status.jobId,lane,task))continue;
      if(status.busy)task.view={...task.view,phase:"running",status:status.phase==="saving"?"正在保存这一幕…":"正在准备，稍后可查看"};
      else if(status.pendingResult)task.view={...task.view,phase:"unsaved",status:"内容已生成，尚未保存"};
      else if(status.error)task.view={...task.view,phase:"failed",status:"本次生成未完成"};
    }
    publish();
    if(status.busy)return;
    void host.session.refresh({background:true,notify:true}).then(()=>{
      if(revision!==generation||host.session.getSnapshot().status==="disposed")return;
      const record=host.session.getSnapshot().record;if(record?.schemaVersion!==4)return;
      pruneCompletedTasks(host);
      for(const [key,task] of host.views) {
        if(task.lane!==lane)continue;
        const [, , family,jobId]=JSON.parse(key) as string[];
        const owns=driverOwnsTask(record,status.jobId,lane,task);
        if(owns&&status.pendingResult)continue;
        if(family==="director") {
          const job=record.airpDirector?.jobs.find(j=>j.id===jobId);
          if(!job) {host.views.delete(key);continue;}
          if(job.kind==="scene"&&record.airpDirector?.reading?.jobId!==jobId){host.views.delete(key);continue;}
          const stage=directorStage(job);
          if(owns&&status.error&&stage&&(!status.stage||status.stage===stage))continue;
          if(job.text&&!stage)task.view={...task.view,phase:"readable",status:"这一幕已备好"};
          else task.view={...task.view,phase:"waiting",status:"进度已保存，可返回查看"};
        } else {
          if(owns&&status.error)continue;
          const current=airpGameView(record), home=pendingHomeBoundary(record);
          if(current?.node?.id===jobId&&current.node.text&&!current.node.selected)task.view={...task.view,phase:"readable",status:"这一幕已备好"};
          else if(current?.plan.id===jobId&&current.plan.status!=="started"||home?.factId===jobId)task.view={...task.view,phase:"waiting",status:"进度已保存，可返回查看"};
          else host.views.delete(key);
        }
      }
      publish();
    }).catch(()=>{});
  };
  host.drivers.set(driver,{off:driver.subscribe(update),lane});
}
export function backgroundTaskPresentation(session:GameSession|undefined,key:string) {
  const task=session && hosts.get(keyOf(session.locator))?.views.get(key);
  return task ? task.minimized ? "background" : "open" : undefined;
}
export function requestBackgroundTaskOpen(session:GameSession,key:string) {
  const task=hosts.get(keyOf(session.locator))?.views.get(key);
  if(task){task.minimized=false;publish();}
}
export function rememberBackgroundTask(session:GameSession,view:FlowTaskView,page:BackgroundTask["page"],lane:TaskLane,minimized=true) {
  const host=hosts.get(keyOf(session.locator));if(!host)return;
  // No closures or React nodes from the outgoing page are retained.
  if(view.phase==="done")host.views.delete(view.key);
  else host.views.set(view.key,{view:{key:view.key,title:view.title,location:view.location,phase:view.phase,status:view.status},saveId:session.locator.saveId,epoch:session.locator.epoch,page,lane,minimized});
  pruneCompletedTasks(host,view.key);
  publish();
}
/** New save/epoch cancels old calls. Pending output remains exportable if that save is revisited. */
export function activateBackgroundIdentity(locator:SaveLocator) {
  activeIdentity=keyOf(locator);
  for(const [key,host] of hosts)if(key!==keyOf(locator)) {
    for(const driver of host.drivers.keys())driver.cancel();
    releaseInactiveHost(host);
  }
  publish();
}
export function disposeBackgroundTasks() {
  for(const host of hosts.values()){for(const [driver,{off}] of host.drivers){driver.cancel();off();}host.observer.close();host.session.dispose();}
  hosts.clear();activeIdentity=undefined;publish();
}
if(typeof window!=="undefined")window.addEventListener("beforeunload",event=>{
  if([...hosts.values()].some(h=>[...h.drivers.keys()].some(d=>{const s=d.getSnapshot();return s.busy||s.pendingResult;}))){event.preventDefault();event.returnValue="";}
});
