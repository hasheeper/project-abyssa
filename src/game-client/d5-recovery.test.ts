import { expect, it, vi } from "vitest";
import { parseLocator, gameHref, locatorMatchesRun } from "./navigation";
import { GameSession, type ClientRuntime } from "./session";
import { readVersionedPending, writeVersionedPending } from "./versioned-pending-request";
import type { D5GameRecord } from "../game-application";

// Coordinator-only stub: gameplay validation and result provenance are covered by the real service tests.
const head = {saveId:"save",epoch:"epoch",revision:2};
const ref = {kind:"memory" as const,id:"memory",attempt:2};
const record = {schemaVersion:4,head,commits:[],snapshot:{campaign:{activeRunRef:ref,memory:{...ref,node:"return-pending"},chapterCompletion:{id:"complete"},stories:[{id:"story",eventId:"story.marietta.return"}],settlements:[]}}} as unknown as D5GameRecord;
const storage = () => {const items = new Map<string,string>();return {getItem:(k:string)=>items.get(k)??null,setItem:(k:string,v:string)=>{items.set(k,v);},removeItem:(k:string)=>{items.delete(k);}};};
it("keeps memory attempts distinct from expeditions and rejects mixed/stale URLs", () => {
  const locator = {saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:2}};
  expect(parseLocator(gameHref("battle",locator).split("?")[1])).toEqual(locator);
  expect(parseLocator("?save=save&epoch=epoch&memory=memory&attempt=2&expedition=memory")).toBeNull();
  expect(locatorMatchesRun(record,{...locator,memory:{id:"memory",attempt:1}})).toBe(false);
  expect(locatorMatchesRun(record,{saveId:"save",epoch:"epoch",expeditionId:"memory"})).toBe(false);
  const store = storage();
  writeVersionedPending(store,{protocolVersion:4,saveId:"save",expectedHead:head,clientRequestId:"read",command:{type:"read-memory",runRef:{attempt:2,id:"memory",kind:"memory"},node:"teaching",step:0}});
  expect(readVersionedPending(store,record)).not.toBeNull();
  const left = structuredClone(record); left.snapshot.campaign.activeRunRef = null; left.snapshot.campaign.memory!.node = "left";
  writeVersionedPending(store,{protocolVersion:4,saveId:"save",expectedHead:head,clientRequestId:"retry",command:{type:"retry-memory",runRef:ref}});
  expect(readVersionedPending(store,left)).not.toBeNull();
});
it("replays a pending return result from the exact memory URL and never resumes a stale attempt",async () => {
  const store = storage();
  const request = {protocolVersion:4 as const,saveId:"save",expectedHead:head,clientRequestId:"claim",command:{type:"complete-story" as const,sessionId:"story"}};
  writeVersionedPending(store,request);
  const dispatch = vi.fn(async () => ({ok:true,replayed:true,receipt:{version:4,status:"committed",before:head,after:head}}));
  const continuation = vi.fn(()=>null);
  const runtime = {application:{open:async()=>({ok:true,record}),dispatch,resumeEnemyTurn:vi.fn()},queries:{continuation},close:vi.fn()} as unknown as ClientRuntime;
  const session = new GameSession(runtime,{saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:2}},store);
  await session.refresh(); expect(dispatch).toHaveBeenCalledWith(request);expect(session.getSnapshot().status).toBe("ready");session.dispose();
  dispatch.mockClear();
  const stale = new GameSession(runtime,{saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:1}},storage());
  continuation.mockClear();await stale.refresh();expect(dispatch).not.toHaveBeenCalled();expect(continuation).not.toHaveBeenCalled();stale.dispose();
  const completed = structuredClone(record);
  completed.snapshot.campaign.activeRunRef = null; completed.snapshot.campaign.stories = []; completed.snapshot.campaign.memory!.node = "completed";
  completed.commits = [{requestId:"claim",kind:"story-completed"}] as D5GameRecord["commits"];
  runtime.application.open = vi.fn(async()=>({ok:true as const,record:completed}));
  writeVersionedPending(store,request);
  const lost = new GameSession(runtime,{saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:2}},store);
  await lost.refresh(); expect(dispatch).toHaveBeenCalledWith(request);expect(readVersionedPending(store,completed)).toBeNull();lost.dispose();
});
