import { expect, it } from "vitest";
import { GUIDED_TIDE_CATALOG_DATA } from "../../content/gameplay/demo-v11/content";
import { CHAPTER_ONE_CATALOG_DATA } from "../../content/gameplay/demo-v12/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { G2_CONTENT_DIGEST, G2Recorder } from "./testing/tide-guided-g2";

const CHAPTER_ONE_CATALOG = validateD5Catalog(CHAPTER_ONE_CATALOG_DATA);

it("retains the published v11 digest and publishes Norma and the six-story ending separately", () => {
  expect(validateD5Catalog(GUIDED_TIDE_CATALOG_DATA).ref.digest).toBe(G2_CONTENT_DIGEST);
  expect(CHAPTER_ONE_CATALOG.ref.contentVersion).toBe(12);
  expect(CHAPTER_ONE_CATALOG.data.tutorial!.returnStoryIds).toEqual(["S3-5","S4-1"]);
  expect(CHAPTER_ONE_CATALOG.data.tutorial!.guide!.id).toBe("tide.guide.v2");
  const wrongEnding=structuredClone(CHAPTER_ONE_CATALOG_DATA);
  wrongEnding.tutorial!.returnStoryIds.push("S4-2");
  expect(()=>validateD5Catalog(wrongEnding)).toThrow();
});

it.each(["A","B","C"] as const)("runs real Norma E1, four battles and ending choice %s without a seventh story", choice => {
  const r=new G2Recorder(CHAPTER_ONE_CATALOG).until(s=>s.tutorial!.stage==="claimable",choice);
  expect(r.state.result?.completion?.encounterIds).toHaveLength(4);
  expect(r.state.result?.completion?.roomIds).toHaveLength(5);
  expect(r.state.run.eventResults).toMatchObject([{actorId:"norma",faceId:"face.norma.01",method:"strong",cost:0,reward:0}]);
  expect(r.state.run.eventRng.cursor).toBe(1);
  expect(r.state.tutorial!.readStoryIds).toEqual(["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1"]);
  expect(r.state.tutorial!.choices).toEqual([{storyId:"S3-4",step:0,choice}]);
  expect(r.state.tutorial!.guide).toMatchObject({mode:"free",reason:"completed"});
  const event=r.trace.find(row=>row.label==="E1.attempt")!;
  expect(event.after.rng).toEqual(event.before.rng);
  expect(event.after.party).toEqual(event.before.party);
  expect(event.after.supplies).toEqual(event.before.supplies);
  expect(r.state.result!.totalGold).toBe(36);
  expect(r.trace.at(-1)?.operation).toMatchObject({type:"tutorial-read",storyId:"S4-1"});
  expect(r.engine.restore(JSON.parse(JSON.stringify(r.state)))).toEqual(r.state);
}, 30_000); // Full four-battle replay and restore, not a single rule operation.
