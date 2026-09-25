import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import { GenerationFlow, generationAction } from "./GenerationFlow";
import { GenerationFeedbackScope, useGenerationNotice } from "./GenerationFeedbackScope";
import type { FlowTaskView } from "../../shared/ui/patterns/flow/contracts";
import { SceneFeedback } from "../../shared/ui/patterns/SceneFeedback";
import { formalAirpFixture } from "../../game-application/testing/airp-game-fixture";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { GameSession } from "../session";
import { disposeBackgroundTasks, registerBackgroundFactory, rememberBackgroundTask, requestBackgroundTaskOpen, taskSessionFor } from "./background-tasks";
import { flowKey } from "../../shared/ui/patterns/flow/contracts";
import { useFlowReaderEntrance } from "./FlowReaderEntrance";

afterEach(()=>{cleanup();disposeBackgroundTasks();});
const base:FlowTaskView={key:"one",title:"书房交谈",location:"洋馆",phase:"running",status:"正在书写"};
it("restores a locked saved reader ahead of a stale minimized cue and ignores its close callback", async () => {
  const f=await formalAirpFixture(),page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>"restore-reader",newSeed:()=>1,close(){}}));
  const owner=taskSessionFor(page),key=flowKey({...page.locator,family:"director",jobId:"scene",frameId:"scene"});
  rememberBackgroundTask(owner,{...base,key},"mansion","director",true);
  let close=()=>{};
  const view=(active:boolean)=><GenerationFlow task={{...base,key}} actions={[]} readerLocked initialReader active={active} backgroundOwner={owner}
    reader={exit=>{close=exit;return <p>保存的第一句</p>;}}/>;
  const mounted=render(view(true));
  expect(screen.getByText("保存的第一句")).toBeInTheDocument();
  expect(document.querySelector(".flow-dialog,.flow-scene")).toBeNull();
  act(()=>close()); mounted.rerender(view(false));
  expect(screen.getByText("保存的第一句")).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:/查看进度/})).toBeNull();
  page.dispose();
});

it("keeps the explicit expansion when Read persists entry before its operation resolves", async () => {
  function Harness(){
    const [entered,setEntered]=useState(false);
    const action=generationAction("read","开始阅读",true,async()=>{setEntered(true);},"presentation");
    return <GenerationFlow task={{...base,primary:action}} actions={[action]} readerLocked initialReader={entered} background="/room.webp" reader={()=><p>已保存阅读</p>}/>;
  }
  render(<UiMotionProvider preference="reduced"><Harness/></UiMotionProvider>);
  fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(document.querySelector(".flow-scene")).toHaveAttribute("data-exit-to","reader"));
  expect(document.querySelector(".flow-reader")).toHaveAttribute("data-blocked");
  await waitFor(()=>expect(document.querySelector(".flow-reader")).not.toHaveAttribute("data-blocked"));
  expect(screen.getByText("已保存阅读")).toBeInTheDocument();
});

it("keeps keyboard focus and background controls behind a locked reader", () => {
  const leave=vi.fn();
  render(<><button onClick={leave}>背景菜单</button><GenerationFlow task={base} actions={[]} initialReader readerLocked reader={()=><button>阅读控件</button>}/></>);
  const background=screen.getByRole("button",{name:"背景菜单"});
  act(()=>background.focus());
  expect(document.querySelector(".flow-reader")).toContainElement(document.activeElement as HTMLElement);
  fireEvent.click(background);expect(leave).not.toHaveBeenCalled();
  fireEvent.keyDown(document.activeElement!,{key:"Escape"});
  expect(screen.getByRole("button",{name:"阅读控件"})).toBeInTheDocument();
});

it("minimizes without a call, updates the same task, then enters reading only after explicit action and exit",async()=>{
  const read=vi.fn(),cancel=vi.fn();let ready:()=>void=()=>{};
  function Harness(){
    const [done,setDone]=useState(false);ready=()=>setDone(true);
    const action=generationAction("read","开始阅读",true,read,"presentation");
    return <GenerationFlow background="/frozen-room.webp" task={{...base,phase:done?"readable":"running",status:done?"这一幕已备好":"正在书写",primary:done?action:undefined}}
      actions={[action,generationAction("stop","停止请求",true,cancel,"stop")]} reader={done?()=> <p>实际阅读层</p>:undefined}/>;
  }
  render(<UiMotionProvider preference="reduced"><GenerationFeedbackScope><Harness/></GenerationFeedbackScope></UiMotionProvider>);
  expect(read).not.toHaveBeenCalled();
  const initialScene = document.querySelector(".flow-scene");
  expect(initialScene?.querySelector("img")).toHaveAttribute("src", "/frozen-room.webp");
  fireEvent.click(screen.getByRole("button",{name:"收起，任务继续保留"}));
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal","true");
  expect(document.querySelector(".flow-scene")).toBe(initialScene);
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.querySelector(".flow-scene")).toBeNull();
  const cue=screen.getByRole("button",{name:/书房交谈.*查看进度/});
  act(()=>ready());
  expect(screen.getByRole("button",{name:/书房交谈.*这一幕已备好/})).toBe(cue);
  expect(screen.queryByText("实际阅读层")).toBeNull();
  fireEvent.click(cue);await screen.findByRole("dialog");
  const readingScene = document.querySelector(".flow-scene");
  const readingView = readingScene?.querySelector(".flow-scene__view");
  await waitFor(()=>expect(readingView).toHaveStyle({opacity:"1"}));
  fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  expect(screen.queryByText("实际阅读层")).toBeNull();
  await waitFor(()=>expect(readingScene).toHaveAttribute("data-exit-to","reader"));
  expect(readingView).toHaveStyle({opacity:"1"});
  await waitFor(()=>expect(document.querySelector(".flow-reader")).not.toHaveAttribute("data-blocked"));
  expect(screen.getByText("实际阅读层")).toBeInTheDocument();expect(read).toHaveBeenCalledTimes(1);expect(cancel).not.toHaveBeenCalled();
  expect(document.querySelector(".flow-scene, .flow-dialog")).toBeNull();
});

it("keeps the same room beyond modal exit and waits for prepared reading assets before handing over", async () => {
  const read=vi.fn(),advance=vi.fn();let prepared=()=>{};
  function Reader(){const entrance=useFlowReaderEntrance();prepared=()=>entrance!.prepared();return <button onClick={advance}>第一句</button>;}
  const action=generationAction("read","开始阅读",true,read,"presentation");
  render(<GenerationFlow task={{...base,phase:"readable",primary:action}} actions={[action]}
    background="/same-room.webp" reader={()=><Reader/>}/>);
  const scene=document.querySelector(".flow-scene"),image=scene!.querySelector("img"),view=scene!.querySelector(".flow-scene__view");
  fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(scene).toHaveAttribute("data-exit-to","reader"));
  const reader=document.querySelector(".flow-reader");
  expect(reader).toHaveAttribute("inert");
  const key=new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true});
  fireEvent(window,key);expect(key.defaultPrevented).toBe(true);expect(advance).not.toHaveBeenCalled();
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.querySelector(".flow-scene")).toBe(scene);
  await waitFor(()=>expect(view).toHaveStyle({left:"0px",top:"0px",width:"1600px",height:"848px"}),{timeout:1400});
  expect(view).toHaveStyle({opacity:"1"});
  expect(scene!.querySelector("img")).toBe(image);
  expect(reader).toHaveAttribute("data-blocked");
  act(()=>prepared());
  await waitFor(()=>expect(reader).not.toHaveAttribute("inert"));
  expect(document.querySelector(".flow-scene")).toBeNull();
  expect(screen.getByRole("button",{name:"第一句"})).toBeInTheDocument();
  expect(read).toHaveBeenCalledTimes(1);expect(advance).not.toHaveBeenCalled();
});

it("a failed reading command retains the panel and never starts the background expansion", async () => {
  const action=generationAction("read","开始阅读",true,vi.fn().mockRejectedValue(Error("storage unavailable")),"presentation");
  render(<UiMotionProvider preference="reduced"><GenerationFlow task={{...base,phase:"readable",primary:action}} actions={[action]}
    background="/room.webp" reader={()=><p>不应提前阅读</p>}/></UiMotionProvider>);
  fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(action.run).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(document.querySelector(".flow-scene")).toHaveAttribute("data-exit-to","rail");
  expect(screen.queryByText("不应提前阅读")).toBeNull();
});

it("can reduce motion during expansion without mounting a second reader or dispatching another read", async () => {
  let prepared=()=>{};
  const read=vi.fn();
  function Reader(){const entrance=useFlowReaderEntrance();prepared=()=>entrance!.prepared();return <p>减弱动效阅读</p>;}
  const action=generationAction("read","开始阅读",true,read,"presentation");
  const frame=(preference:"system"|"reduced")=><UiMotionProvider preference={preference}><GenerationFlow task={{...base,phase:"readable",primary:action}} actions={[action]}
    background="/room.webp" reader={()=><Reader/>}/></UiMotionProvider>;
  const mounted=render(frame("system"));fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(document.querySelector(".flow-reader")).toHaveAttribute("inert"));
  const reader=screen.getByText("减弱动效阅读");
  mounted.rerender(frame("reduced"));act(()=>prepared());
  await waitFor(()=>expect(document.querySelector(".flow-scene")).toBeNull());
  expect(screen.getByText("减弱动效阅读")).toBe(reader);expect(read).toHaveBeenCalledTimes(1);
});

it("discards delayed preparation and resets geometry when the current scene changes during a handoff", async () => {
  let prepared=()=>{};
  function Reader(){const entrance=useFlowReaderEntrance();prepared=()=>entrance!.prepared();return <p>旧阅读</p>;}
  const action=generationAction("read","开始阅读",true,vi.fn(),"presentation");
  const view=(key:string)=><UiMotionProvider preference="reduced"><GenerationFlow task={{...base,key,phase:"readable",primary:action}} actions={[action]} background={`/${key}.webp`} reader={()=><Reader/>}/></UiMotionProvider>;
  const mounted=render(view("old"));fireEvent.click(screen.getByRole("button",{name:"开始阅读"}));
  await waitFor(()=>expect(document.querySelector(".flow-reader")).toHaveAttribute("inert"));
  const oldPrepared=prepared;
  mounted.rerender(view("new"));act(()=>oldPrepared());
  expect(screen.queryByText("旧阅读")).toBeNull();
  await waitFor(()=>expect(screen.getByRole("dialog")).toBeInTheDocument());
  expect(document.querySelector(".flow-scene__view")).toHaveStyle({width:"1440px",height:"810px"});
  expect(document.querySelector(".flow-scene img")).toHaveAttribute("src","/new.webp");
});

it("keeps the scene mounted on progress updates and bypasses it when resuming a reader", async () => {
  const view = (status: string, initialReader = false) => <UiMotionProvider preference="reduced">
    <GenerationFlow task={{...base,status}} actions={[]} background="/frozen-room.webp"
      initialReader={initialReader} reader={()=><p>恢复阅读</p>}/>
  </UiMotionProvider>;
  const mounted = render(view("正在书写"));
  const scene = document.querySelector(".flow-scene"), surface = document.querySelector(".confirmation-dialog__backing");
  const sceneView = scene?.querySelector(".flow-scene__view");
  await waitFor(()=>expect(sceneView).toHaveStyle({opacity:"1"}));
  mounted.rerender(view("正在校对"));
  expect(document.querySelector(".flow-scene")).toBe(scene);
  expect(document.querySelector(".confirmation-dialog__backing")).toBe(surface);
  expect(scene?.querySelector(".flow-scene__view")).toBe(sceneView);
  expect(sceneView).toHaveStyle({opacity:"1"});
  mounted.unmount();
  render(view("这一幕已备好", true));
  expect(screen.getByText("恢复阅读")).toBeInTheDocument();
  expect(document.querySelector(".flow-scene, .flow-dialog")).toBeNull();
});
it("removes focus filters after entrance and does not blur again when progress changes", async () => {
  const view = (status: string) => <GenerationFlow task={{...base,status}} actions={[]} background="/frozen-room.webp"/>;
  const mounted = render(view("正在书写"));
  const dialog = screen.getByRole("dialog"), content = dialog.querySelector<HTMLElement>(".flow-content")!;
  const backing = dialog.querySelector<HTMLElement>(".flow-backing")!;
  expect(content.style.filter).toMatch(/blur\([1-9]/);
  await waitFor(() => expect(content).toHaveStyle({filter: "none", opacity: "1"}), {timeout: 1800});
  mounted.rerender(view("正在校对"));
  expect(dialog.querySelector(".flow-content")).toBe(content);
  expect(content).toHaveStyle({filter: "none"});
  expect(backing.style.getPropertyValue("backdrop-filter")).toBe("");
  expect(screen.getByText("正在校对")).toBeInTheDocument();
});
it("clears an in-flight focus blur when reduced motion is enabled without rebuilding the flow", async () => {
  const view = (preference: "system" | "reduced", status = base.status) => <UiMotionProvider preference={preference}>
    <GenerationFlow task={{...base,status}} actions={[]} background="/frozen-room.webp"/>
  </UiMotionProvider>;
  const mounted = render(view("system"));
  const dialog = screen.getByRole("dialog");
  const content = dialog.querySelector<HTMLElement>(".flow-content")!;
  const glass = dialog.querySelector(".flow-backing");
  expect(content.style.filter).toMatch(/blur\([1-9]/);
  mounted.rerender(view("reduced", "正在校对"));
  await waitFor(() => expect(["none", "blur(0px)"]).toContain(content.style.filter), {timeout: 200});
  expect(screen.getByRole("dialog")).toBe(dialog);
  expect(dialog.querySelector(".flow-backing")).toBe(glass);
  expect(screen.getByText("正在校对")).toBeInTheDocument();
});
it("keeps Stop callable while a generation action is still awaiting its response",async()=>{
  let finish:()=>void=()=>{};const deferred=new Promise<void>(resolve=>{finish=resolve;});const stop=vi.fn();
  function Harness(){const [busy,setBusy]=useState(false);const start=generationAction("start","开始生成",true,()=>{setBusy(true);return deferred;});
    const cancel=generationAction("stop","停止请求",true,stop,"stop");
    return <GenerationFlow task={{...base,primary:busy?undefined:start,secondary:busy?cancel:undefined}} actions={[start,cancel]}/>;}
  render(<UiMotionProvider preference="reduced"><Harness/></UiMotionProvider>);
  fireEvent.click(screen.getByRole("button",{name:"开始生成"}));fireEvent.click(screen.getByRole("button",{name:"停止请求"}));
  expect(stop).toHaveBeenCalledTimes(1);await act(async()=>finish());
});
it("keeps an existing paused job reachable and does not reopen on a new job identity",async()=>{
  const renderFlow=(key:string)=><UiMotionProvider preference="reduced"><GenerationFeedbackScope>
    <GenerationFlow task={{...base,key}} actions={[]} initiallyClosed initiallyExposed/>
    <SceneFeedback dock paused entries={[{id:"reward",kind:"reward",reward:{id:"item",kind:"item",name:"战利品",quantity:1}}]} onDismiss={()=>{}}/>
  </GenerationFeedbackScope></UiMotionProvider>;
  const view=render(renderFlow("old-job"));
  expect(screen.queryByRole("dialog")).toBeNull();
  const cue=screen.getByRole("button",{name:/书房交谈.*查看进度/});expect(cue).not.toBeDisabled();
  view.rerender(renderFlow("new-job"));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getAllByRole("button",{name:/书房交谈.*查看进度/}).find(button=>!button.hasAttribute("disabled"))!);
  await screen.findByRole("dialog");
});
it("gives the fourth task a real destination and stacks rewards under the same column",async()=>{
  const open=vi.fn();function Task({id}:{id:string}){useGenerationNotice({...base,key:id,title:`任务${id}`},true,()=>open(id));return null;}
  render(<UiMotionProvider preference="reduced"><GenerationFeedbackScope>
    {["1","2","3","4"].map(id=><Task key={id} id={id}/>)}
    <SceneFeedback dock entries={[1,2,3,4].map(n=>({id:String(n),kind:"reward",durationMs:null,reward:{id:String(n),kind:"item",name:`战利品${n}`,quantity:1}}))} onDismiss={()=>{}}/>
  </GenerationFeedbackScope></UiMotionProvider>);
  expect(screen.getAllByRole("button",{name:/查看进度/})).toHaveLength(3);
  expect(document.querySelectorAll('.flow-side-rail .scene-feedback__presentation')).toHaveLength(3);
  fireEvent.click(screen.getByRole("button",{name:"其余 1 项进度"}));
  const dialog=await screen.findByRole("dialog");
  expect(dialog.parentElement?.querySelector(".flow-scene__curtain")).toBeInTheDocument();
  expect(dialog.parentElement?.querySelector(".flow-scene__view")).toBeNull();
  const row=within(dialog).getByText("任务4").closest("button")!;fireEvent.click(row);
  await waitFor(()=>expect(open).toHaveBeenCalledWith("4"));expect(open).toHaveBeenCalledTimes(1);
});

it("preserves minimized presentation across page remounts until the player opens that task",async()=>{
  const f=await formalAirpFixture(),page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>"ui-host",newSeed:()=>1,close(){}}));
  const owner=taskSessionFor(page),key=flowKey({...page.locator,family:"director",jobId:"scene",frameId:"scene"});
  const flow=<UiMotionProvider preference="reduced"><GenerationFeedbackScope session={page}>
    <GenerationFlow task={{...base,key}} actions={[]} backgroundOwner={owner}/>
  </GenerationFeedbackScope></UiMotionProvider>;
  const first=render(flow);fireEvent.click(screen.getByRole("button",{name:"收起，任务继续保留"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());first.unmount();
  const second=render(flow);expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button",{name:/书房交谈.*查看进度/})).not.toBeDisabled();second.unmount();
  requestBackgroundTaskOpen(page,key);
  render(flow);await screen.findByRole("dialog");page.dispose();
});

it("retains all six reward events and gives queued entries their full visible lifetime",async()=>{
  const dismissed=vi.fn();let resume=()=>{};
  function Rewards(){
    const [paused,setPaused]=useState(true);resume=()=>setPaused(false);
    const [ids,setIds]=useState([1,2,3,4,5,6]);
    return <SceneFeedback dock paused={paused} entries={ids.map(id=>({id:String(id),kind:"reward",durationMs:40,reward:{id:String(id),kind:"item",name:`道具${id}`,quantity:1}}))}
      onDismiss={id=>{dismissed(id);setIds(current=>current.filter(value=>String(value)!==id));}}/>;
  }
  render(<UiMotionProvider preference="reduced"><GenerationFeedbackScope><Rewards/></GenerationFeedbackScope></UiMotionProvider>);
  expect(document.querySelectorAll('.flow-rewards [data-present="true"]')).toHaveLength(3);
  await act(async()=>{await new Promise(resolve=>setTimeout(resolve,180));});expect(dismissed).not.toHaveBeenCalled();
  act(()=>resume());
  await waitFor(()=>expect(dismissed).toHaveBeenCalledTimes(6));
  expect(new Set(dismissed.mock.calls.map(([id])=>id))).toEqual(new Set(["1","2","3","4","5","6"]));
});
