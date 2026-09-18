import { expect, it } from "vitest";
import { CHAPTER_ONE_CATALOG } from "../../game-runtime/chapter-one-context";
import { G2Recorder } from "../../game-core/session/testing/tide-guided-g2";
import { g2Command, g2RunRef, G2ApplicationHarness } from "./tide-guided-g2-playthrough";
import { GameStorageError } from "../contracts";

it("recovers the Norma event and chapter ending, and settles once only after the blanket scene", async () => {
  const h=new G2ApplicationHarness(CHAPTER_ONE_CATALOG);
  await h.create();
  const trace=new G2Recorder(CHAPTER_ONE_CATALOG).until(s=>s.tutorial!.stage==="claimable").trace;
  let eventChecked=false, endingChecked=false;
  for (const row of trace) {
    const before=h.state();
    if (before.tutorial!.story?.id==="S4-1") {
      expect((await h.send({type:"settle-expedition",runRef:g2RunRef,terminalRef:before.result!.id})).result.ok).toBe(false);
      await h.recover();
      endingChecked=true;
    }
    if (row.label==="E1.attempt") {
      expect(h.runtime.queries.tutorial(h.raw())?.guide?.operation).toMatchObject({type:"event",actorId:"norma"});
      const original=h.raw(), commit=h.store.commit.bind(h.store);
      h.store.commit=async()=>{throw new GameStorageError("storage-quota","test event rollback");};
      const failed=await h.send(g2Command(row.operation));
      expect(failed.result).toMatchObject({ok:false,error:{code:"storage-quota"}});
      expect(h.raw()).toEqual(original);
      h.store.commit=commit;
      expect(await h.runtime.dispatch(failed.request)).toMatchObject({ok:true});
      expect(await h.runtime.dispatch(failed.request)).toMatchObject({ok:true,replayed:true});
      expect(h.state().run.eventResults).toMatchObject([{actorId:"norma",faceId:"face.norma.01",method:"strong"}]);
      expect(h.state().run.eventRng).toMatchObject({seed:7,cursor:1});
      await h.recover();
      eventChecked=true;
    } else await h.commit(g2Command(row.operation));
  }
  expect(eventChecked && endingChecked).toBe(true);
  expect(h.state().tutorial!.readStoryIds).toEqual(["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1"]);
  expect(h.raw().snapshot.campaign.funds.party).toBe(0);
  const terminalRef=h.state().result!.id;
  const claim=await h.commit({type:"settle-expedition",runRef:g2RunRef,terminalRef});
  expect(await h.runtime.dispatch(claim.request)).toMatchObject({ok:true,replayed:true});
  expect((await h.send({type:"settle-expedition",runRef:g2RunRef,terminalRef})).result.ok).toBe(false);
  const c=h.raw().snapshot.campaign;
  expect(c.funds.party).toBe(44);
  expect(c.settlements).toHaveLength(1);
  expect(c.settlements[0].totalGold).toBe(36);
  expect(h.runtime.queries.journey(h.raw())?.returnFeedback).toEqual([
    "草药、古籍与旧毛毯都已物归原主。可以在洋馆休整，为下一趟旅程做准备。",
  ]);
  expect(c.clock).toEqual({day:1,phase:"day"});
  expect(c.tutorial).toMatchObject({status:"completed",cargoIds:CHAPTER_ONE_CATALOG.data.tutorial!.reward.cargoIds});
  expect(c.manor.takeover).toBeNull();
  expect(c.growthGrants).toEqual([]);
  expect(c.inventory).toEqual([]);
  // The six-slot bag must survive command parsing, battle validation and archive
  // replay, not just render six empty squares in the preparation screen.
  for (const definitionId of Object.keys(CHAPTER_ONE_CATALOG.data.economy!.prices)) {
    await h.commit({type:"purchase-supply",shopId:"shop.mansion",definitionId,quantity:1,quoteVersion:1});
  }
  const allItems = Object.keys(CHAPTER_ONE_CATALOG.data.journey!.items);
  expect(allItems).toHaveLength(7);
  const beforeDeparture = h.raw();
  const departure = {type:"start-expedition" as const,runId:"six-slot-run",routeId:"old-manor.first-clear",
    partyIds:CHAPTER_ONE_CATALOG.data.initialParty,itemIds:allItems,seed:19};
  expect((await h.send(departure)).result.ok).toBe(false);
  expect(h.raw()).toEqual(beforeDeparture);
  await h.commit({...departure,itemIds:allItems.slice(0,6)});
  expect(h.state().run.supplies.map(item=>item.definitionId)).toEqual(allItems.slice(0,6));
  await h.recover();
  expect(h.state().run.supplies).toHaveLength(6);
},90_000);
