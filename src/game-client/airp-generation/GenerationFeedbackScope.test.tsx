import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {GenerationFeedbackScope} from "./GenerationFeedbackScope";
import {formalAirpFixture} from "../../game-application/testing/airp-game-fixture";
import {createPlayerRuntime} from "../../game-runtime/player-runtime";
import {GameSession} from "../session";
import {flowKey} from "../../shared/ui/patterns/flow/contracts";
import {disposeBackgroundTasks,registerBackgroundFactory,rememberBackgroundTask,taskSessionFor} from "./background-tasks";
import * as routing from "../../shared/routing/location";
import { FlowReadingSurface } from "./FlowReadingSurface";
import { airpGameView } from "../../game-runtime/airp-game-runtime";

afterEach(()=>{cleanup();disposeBackgroundTasks();vi.restoreAllMocks();window.history.replaceState(null,"","/");});

async function planNoticeFixture() {
  const f=await formalAirpFixture(),planId=await f.prepare();
  const page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>"notice-guard",newSeed:()=>1,close(){}}));
  const owner=taskSessionFor(page);await owner.refresh();await page.refresh();
  const key=flowKey({...page.locator,family:"expedition",jobId:planId,frameId:planId});
  rememberBackgroundTask(owner,{key,title:"出征安排",location:"地图",phase:"running",status:"正在安排这次出征…"},"map","plan");
  const start=async()=>{const permit=await f.flow.gm.departurePermit(planId);await f.send({type:"start-expedition",...permit.departure});await f.flow.sync();};
  return {...f,page,owner,planId,start};
}

it("rechecks the saved departure when a stale MAP notice is clicked before React has repainted",async()=>{
  const f=await planNoticeFixture();
  window.history.replaceState(null,"","/#/battle?save=formal-airp&epoch=epoch%3A1");
  const navigate=vi.spyOn(routing,"navigateTo").mockReturnValue(true);
  render(<GenerationFeedbackScope session={f.page}><p>战斗页面</p></GenerationFeedbackScope>);
  const staleButton=screen.getByRole("button",{name:/出征安排.*查看进度/});
  await f.start();
  // Valid committed record, deliberately exposed before the render subscription fires.
  vi.spyOn(f.page,"getSnapshot").mockReturnValue({...f.page.getSnapshot(),record:f.raw()});
  fireEvent.click(staleButton);
  expect(navigate).not.toHaveBeenCalled();
  f.page.dispose();
},15000);

it("prevents cross-page notification navigation during an active expedition",async()=>{
  const f=await planNoticeFixture();await f.start();await f.page.refresh();await f.owner.refresh();
  const nodeId=airpGameView(f.raw())!.node!.id,key=flowKey({...f.page.locator,family:"expedition",jobId:nodeId,frameId:nodeId});
  // A legacy return address must not grant permission to abandon the active run.
  rememberBackgroundTask(f.owner,{key,title:"旧页面任务",location:"地图",phase:"waiting",status:"进度已保存"},"map","node");
  const navigate=vi.spyOn(routing,"navigateTo").mockReturnValue(true);
  render(<GenerationFeedbackScope session={f.page}><p>战斗页面</p></GenerationFeedbackScope>);
  const button=screen.getByRole("button",{name:/旧页面任务.*归来后查看/});
  expect(button).toHaveAttribute("aria-disabled","true");
  fireEvent.click(button);expect(navigate).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:/出征安排/})).toBeNull();
  f.page.dispose();
},15000);

it("suspends task cues throughout locked AVG reading",async()=>{
  const f=await planNoticeFixture(),navigate=vi.spyOn(routing,"navigateTo").mockReturnValue(true);
  render(<GenerationFeedbackScope session={f.page}><FlowReadingSurface blocked={false} locked dissolve={false}><p>正在阅读</p></FlowReadingSurface></GenerationFeedbackScope>);
  const button=screen.getByRole("button",{name:/出征安排.*查看进度/});
  await waitFor(()=>expect(button).toBeDisabled());
  fireEvent.click(button);expect(navigate).not.toHaveBeenCalled();
  f.page.dispose();
},15000);
it.each(["mansion","map"] as const)("reopens a mansion task from %s with navigation only across pages",async currentPage=>{
  const f=await formalAirpFixture(),page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>"notice",newSeed:()=>1,close(){}}));
  const owner=taskSessionFor(page),key=flowKey({...page.locator,family:"director",jobId:"job",frameId:"job"});
  rememberBackgroundTask(owner,{key,title:"当前交谈",location:"洋馆",phase:"readable",status:"这一幕已备好"},"mansion","director",true);
  window.history.replaceState(null,"",`/#/${currentPage}?save=formal-airp&epoch=epoch%3A1`);
  const navigate=vi.spyOn(routing,"navigateTo").mockReturnValue(true),refresh=vi.spyOn(page,"refresh").mockResolvedValue(undefined);
  render(<GenerationFeedbackScope session={page}><p>当前页面</p></GenerationFeedbackScope>);
  fireEvent.click(screen.getByRole("button",{name:/当前交谈.*查看进度/}));
  if(currentPage==="mansion"){
    await waitFor(()=>expect(refresh).toHaveBeenCalledOnce());
    expect(navigate).not.toHaveBeenCalled();
  } else {
    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate.mock.calls[0][0]).toBe("#/mansion?save=formal-airp&epoch=epoch%3A1");
    expect(refresh).not.toHaveBeenCalled();
  }
  page.dispose();
});
