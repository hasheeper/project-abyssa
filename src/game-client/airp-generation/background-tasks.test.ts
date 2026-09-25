import { afterEach, expect, it, vi } from "vitest";
import { formalAirpFixture } from "../../game-application/testing/airp-game-fixture";
import { createPlayerRuntime } from "../../game-runtime/player-runtime";
import { GameSession } from "../session";
import { activateBackgroundIdentity, backgroundTaskPresentation, backgroundTasks, disposeBackgroundTasks, registerBackgroundDriver, registerBackgroundFactory, rememberBackgroundTask, requestBackgroundTaskOpen, serializeTaskCommand, taskSessionFor } from "./background-tasks";
import { flowKey } from "../../shared/ui/patterns/flow/contracts";
import { MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt } from "../../game-application";
import { createExpeditionGMDriver } from "../../game-runtime/airp-expedition-gm-driver";
import { clcProposal } from "../../game-application/testing/airp-expedition-gm-fixture";
import { emptyUsage } from "../../game-application/airp-generation/contracts";

afterEach(disposeBackgroundTasks);

it("keeps a newly committed plan until the background port catches up with the page", async () => {
  const f=await formalAirpFixture(),page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>"new-plan",newSeed:()=>1,close(){}}));
  const owner=taskSessionFor(page);await owner.refresh();
  const id=await f.flow.prepare(f.departure),key=flowKey({...page.locator,family:"expedition",jobId:id,frameId:id});
  rememberBackgroundTask(owner,{key,title:"出征安排",location:"地图",phase:"waiting",status:"准备就绪"},"map","plan");
  expect(backgroundTasks.getSnapshot().map(t=>t.view.key)).toEqual([key]);
  await owner.refresh();
  expect(backgroundTasks.getSnapshot().map(t=>t.view.key)).toEqual([key]);
  page.dispose();
},15000);

it("does not resurrect a departed plan when the outgoing page writes its final busy frame", async () => {
  const f = await formalAirpFixture(), planId = await f.prepare();
  const page = new GameSession(f.runtime, {saveId:"formal-airp",epoch:"epoch:1"}, {getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page, () => createPlayerRuntime(f.store, {newId:()=>"retired-plan",newSeed:()=>1,close(){}}));
  const owner = taskSessionFor(page); await owner.refresh();
  const key = flowKey({...page.locator,family:"expedition",jobId:planId,frameId:planId});
  const stale = {key,title:"出征安排",location:"地图",phase:"running" as const,status:"正在安排这次出征…"};
  rememberBackgroundTask(owner, stale, "map", "plan");
  const permit = await f.flow.gm.departurePermit(planId);
  await f.send({type:"start-expedition",...permit.departure}); await f.flow.sync(); await owner.refresh();
  expect(backgroundTasks.getSnapshot()).toEqual([]);
  rememberBackgroundTask(owner, stale, "map", "plan");
  expect(backgroundTasks.getSnapshot()).toEqual([]);
  page.dispose();
},15000);

it("retires a departed plan even while an unrelated settlement driver is running", async () => {
  const f = await formalAirpFixture(), planId = await f.prepare();
  const page = new GameSession(f.runtime, {saveId:"formal-airp",epoch:"epoch:1"}, {getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page, () => createPlayerRuntime(f.store, {newId:()=>"other-lane",newSeed:()=>1,close(){}}));
  const owner = taskSessionFor(page); await owner.refresh();
  registerBackgroundDriver(owner, {cancel(){},subscribe:()=>()=>{},getSnapshot:()=>({busy:true,pendingResult:false,error:null,jobId:"another-settlement"})}, "settlement");
  const key = flowKey({...page.locator,family:"expedition",jobId:planId,frameId:planId});
  rememberBackgroundTask(owner, {key,title:"出征安排",location:"地图",phase:"waiting",status:"安排已备好"}, "map", "plan");
  const permit = await f.flow.gm.departurePermit(planId);
  await f.send({type:"start-expedition",...permit.departure}); await f.flow.sync(); await owner.refresh();
  expect(backgroundTasks.getSnapshot()).toEqual([]);
  page.dispose();
},15000);
it("retains a separate lightweight save port after the page is disposed, without accepting gameplay commands",async()=>{
  const f=await formalAirpFixture();let id=0;const close=vi.fn();
  const factory=()=>createPlayerRuntime(f.store,{newId:()=>`background:${++id}`,newSeed:()=>1,close});
  const page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,factory);const task=taskSessionFor(page);await task.refresh();page.dispose();
  expect(task.getSnapshot().status).toBe("ready");expect(close).not.toHaveBeenCalled();
  const revision=f.raw().head.revision;expect(await task.dispatch({type:"airp-director-pause"})).not.toBeNull();expect(f.raw().head.revision).toBeGreaterThan(revision);
  expect(await task.dispatch({type:"advance-phase"})).toBeNull();
  const next=new GameSession(f.runtime,page.locator,{getItem:()=>null,setItem(){},removeItem(){}});registerBackgroundFactory(next,factory);
  expect(taskSessionFor(next)).toBe(task);next.dispose();
});
it("keeps pending output isolated on epoch change, cancels calls and stores no UI callback in remote cues",async()=>{
  const f=await formalAirpFixture();let id=0;
  const page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>`pending:${++id}`,newSeed:()=>1,close(){}}));
  const task=taskSessionFor(page),cancel=vi.fn();registerBackgroundDriver(task,{cancel,subscribe:()=>()=>{},getSnapshot:()=>({busy:false,pendingResult:true,error:null,jobId:"job"})});
  const key=flowKey({...page.locator,family:"director",jobId:"job",frameId:"job"});
  rememberBackgroundTask(task,{key,title:"交谈",location:"洋馆",phase:"unsaved",status:"尚未保存",primary:{id:"bad",label:"test",enabled:true,effect:"request",run:()=>{}} as any},"mansion","director");
  expect(backgroundTasks.getSnapshot()[0].view.primary).toBeUndefined();
  // Install a fully validated new identity; changing only head.epoch would corrupt the fixture's lineage.
  const replacementStore=new MemoryGameStore<AnyGameRecord,AnyReceipt>();
  const replacementRuntime=createPlayerRuntime(replacementStore,{newId:()=>"replacement",newSeed:()=>1,close(){}});
  expect(await replacementRuntime.application.create({protocolVersion:4,contentVersion:22,profileId:"profile.demo.first-run",saveId:"formal-airp",epoch:"epoch:2",clientRequestId:"create-replacement"})).toMatchObject({ok:true});
  f.database.records.set("formal-airp",(await replacementStore.read("formal-airp"))!);
  activateBackgroundIdentity({saveId:"formal-airp",epoch:"epoch:2"});expect(cancel).toHaveBeenCalledOnce();
  await task.refresh();expect(task.getSnapshot().error?.code).toBe("identity-mismatch");
  if(!("airpGame" in task.runtime))throw Error("AIRP runtime required");
  const scoped=task.runtime.airpGame.forSave("formal-airp",22,"epoch:1");await expect(scoped.host.read()).rejects.toThrow("档案身份已变化");
  expect(await task.dispatch({type:"airp-director-pause"})).toBeNull();
  expect(f.raw().head.epoch).toBe("epoch:2");page.dispose();
});

it("finishes and saves an actual driver after page disposal, then exposes its saved progress",async()=>{
  const f=await formalAirpFixture();let serial=0;
  const page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  registerBackgroundFactory(page,()=>createPlayerRuntime(f.store,{newId:()=>`driver:${++serial}`,newSeed:()=>1,close(){}}));
  const task=taskSessionFor(page);
  if(!("airpGame" in task.runtime))throw Error("AIRP runtime required");
  const flow=task.runtime.airpGame.forSave("formal-airp",22,"epoch:1"),id=await flow.prepare(f.departure);
  const proposal=JSON.stringify(clcProposal(await flow.gm.read()));
  let resolve!:()=>void;const response=new Promise<void>(r=>{resolve=r;});
  const provider=vi.fn(async()=>{await response;return {text:proposal,usage:emptyUsage(),finishReason:"stop" as const};});
  const driver=createExpeditionGMDriver({provider,lock:async(_key,_signal,operation)=>operation()});
  registerBackgroundDriver(task,driver,"plan");
  const key=flowKey({...page.locator,family:"expedition",jobId:id,frameId:id});
  rememberBackgroundTask(task,{key,title:"出征安排",location:"地图",phase:"waiting",status:"准备就绪"},"map","plan");
  expect(backgroundTaskPresentation(task,key)).toBe("background");
  const run=driver.run(flow.host.gm,id,{config:{baseUrl:"https://test.invalid/v1",model:"test-gm",timeoutMs:10000},key:"secret-fixture-key"});
  await vi.waitFor(()=>expect(provider).toHaveBeenCalledOnce());
  page.dispose();expect(task.getSnapshot().status).not.toBe("disposed");
  resolve();await run;
  expect(driver.getSnapshot()).toMatchObject({busy:false,pendingResult:false,phase:"accepted"});
  await vi.waitFor(()=>expect(backgroundTasks.getSnapshot()[0].view).toMatchObject({phase:"waiting",status:"进度已保存，可返回查看"}));
  expect((await flow.gm.read()).ledger.jobs.find(job=>job.id===id)?.status).toBe("accepted");
  expect(provider).toHaveBeenCalledOnce();
  expect(backgroundTaskPresentation(task,key)).toBe("background");
  requestBackgroundTaskOpen(task,key);expect(backgroundTaskPresentation(task,key)).toBe("open");
  // An old cue can outlive its page while this lane moves to another job.
  rememberBackgroundTask(task,{key,title:"出征安排",location:"地图",phase:"failed",status:"旧错误"},"map","plan");
  let changed!:()=>void;
  registerBackgroundDriver(task,{cancel(){},subscribe:listener=>{changed=listener;return()=>{};},getSnapshot:()=>({busy:false,pendingResult:false,error:"另一项安排失败",jobId:"another-plan"})},"plan");
  changed();
  await vi.waitFor(()=>expect(backgroundTasks.getSnapshot()[0].view).toMatchObject({phase:"waiting",status:"进度已保存，可返回查看"}));
  await flow.gm.cancel(id);await task.refresh({background:true});
  expect(backgroundTasks.getSnapshot()).toEqual([]);
});

it("serializes pause and result commands instead of sharing the same in-flight command",async()=>{
  const f=await formalAirpFixture(),page=new GameSession(f.runtime,{saveId:"formal-airp",epoch:"epoch:1"},{getItem:()=>null,setItem(){},removeItem(){}});
  let finish!:()=>void;const held=new Promise<void>(resolve=>{finish=resolve;});const order:string[]=[];
  const pause=serializeTaskCommand(page,async()=>{order.push("pause");await held;order.push("paused");return "first";});
  const save=serializeTaskCommand(page,async()=>{order.push("saved");return "second";});
  await vi.waitFor(()=>expect(order).toEqual(["pause"]));
  finish();expect(await Promise.all([pause,save])).toEqual(["first","second"]);
  expect(order).toEqual(["pause","paused","saved"]);page.dispose();
});
