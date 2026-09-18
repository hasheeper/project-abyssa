import { expect, it } from "vitest";
import { MemoryGameDatabase, MemoryGameStore } from "../../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt, D5Command, D5GameRecord } from "../index";
import { validateD5Catalog } from "../../game-core/contracts";
import { TIDE_CAVE_CATALOG_DATA } from "../../content/gameplay/demo-v7/content";
import { PLAYER_CATALOGS } from "../../game-runtime/player-runtime";
import { createVersionedGameRuntime } from "../../game-runtime/versioned-runtime";
import { FIRST_MORNING_V1_CATALOG } from "../../game-runtime/first-morning-context";

const catalog = validateD5Catalog(TIDE_CAVE_CATALOG_DATA);
async function fixture(contentVersion: 3 | 5 | 6) {
  const db = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(db);
  const runtime = createVersionedGameRuntime(store, PLAYER_CATALOGS);
  const sourceCatalog = PLAYER_CATALOGS.find(c => c.version === 4 && c.catalog.ref.contentVersion === contentVersion)!.catalog;
  expect(await runtime.create({contentRef: sourceCatalog.ref, request: {protocolVersion: 4, saveId: "source", epoch: "epoch", clientRequestId: "create", profileId: "profile.demo.first-run"}})).toMatchObject({ok: true});
  const raw = () => db.records.get("source")! as D5GameRecord;
  let sequence = 0;
  const send = async (command: D5Command) => {
    const request = {protocolVersion: 4, saveId: "source", expectedHead: raw().head, clientRequestId: `test:${++sequence}`, command};
    const result = command.type === "resume-run" ? await runtime.resume(request) : await runtime.dispatch(request);
    if (!result.ok) throw Error(JSON.stringify(result.error));
    return result;
  };
  const upgrade = (saveId: string) => runtime.continueSave({contentRef: catalog.ref, sourceSaveId: "source", expectedSourceHead: raw().head, saveId, epoch: saveId, clientRequestId: saveId, kind: "upgrade"});
  return {db, runtime, raw, send, upgrade};
}

it("preserves content6 prologue/morning cursors and choices while adding only pending tutorial progress", async () => {
  const f = await fixture(6);
  await f.send({type: "advance-prologue", shotId: "A1-01"});
  const cg = structuredClone(f.raw());
  expect(await f.upgrade("cg-copy")).toMatchObject({ok: true});
  expect(await f.runtime.open("cg-copy")).toMatchObject({ok: true, record: {contentRef: catalog.ref, snapshot: {campaign: {prologue: cg.snapshot.campaign.prologue, opening: cg.snapshot.campaign.opening, tutorial: {status: "pending"}}}}});
  expect(f.raw()).toEqual(cg);
  await f.send({type: "complete-prologue", shotId: "A1-02", choice: "skip"});
  for (let step = 0; step <= 6; step++) await f.send({type: "advance-opening", step, choice: step === 6 ? "B" : "continue"});
  const morning = structuredClone(f.raw());
  expect(await f.upgrade("morning-copy")).toMatchObject({ok: true});
  const upgraded = await f.runtime.open("morning-copy");
  if (!upgraded.ok || upgraded.record.schemaVersion !== 4) throw Error("Upgrade failed");
  const {tutorial, ...campaign} = upgraded.record.snapshot.campaign;
  expect(tutorial).toEqual({status: "pending"});
  expect(campaign).toEqual(morning.snapshot.campaign);
  expect(campaign.opening).toEqual({status: "playing", step: 7, choices: [{step: 6, choice: "B"}]});
  expect(f.raw()).toEqual(morning);
});

it("extends the original v5 ending into S2 without fabricating choices or tutorial completion", async () => {
  const f = await fixture(5);
  await f.send({type: "complete-prologue", shotId: "A1-01", choice: "skip"});
  for (let step = 0; step <= 66; step++) await f.send({type: "advance-opening", step, choice: FIRST_MORNING_V1_CATALOG.data.opening!.choiceSteps.includes(step) ? "A" : "continue"});
  const source = structuredClone(f.raw());
  expect(source.snapshot.campaign.opening?.status).toBe("viewed");
  expect(await f.upgrade("extended")).toMatchObject({ok: true});
  expect(await f.runtime.open("extended")).toMatchObject({ok: true, record: {snapshot: {campaign: {opening: {...source.snapshot.campaign.opening, step: 67, status: "playing"}, tutorial: {status: "pending"}, funds: source.snapshot.campaign.funds}}}});
  expect(f.raw()).toEqual(source);
}, 20_000);

it("rejects upgrades during a real manor run, then exempts its settled history without awarding the tutorial", async () => {
  const f = await fixture(3), runRef = {kind: "expedition" as const, id: "old-run"};
  await f.send({type: "start-expedition", runId: runRef.id, routeId: catalog.data.manor!.firstClearRouteId, partyIds: catalog.data.initialParty, itemIds: [], seed: 19});
  const active = structuredClone(f.raw());
  expect(await f.upgrade("too-early")).toMatchObject({ok: false, error: {code: "run-active"}});
  expect(f.raw()).toEqual(active);
  for (let i = 0; i < 180; i++) {
    const run = f.raw().snapshot.run;
    if (run?.kind !== "expedition") break;
    if (run.state.node === "finished") {
      await f.send({type: "settle-expedition", runRef, terminalRef: run.state.result.id});
      break;
    }
    await f.send(run.state.encounter?.phase === "roll" ? {type: "battle-command", runRef, command: {type: "roll"}}
      : run.state.encounter?.phase === "act" ? {type: "battle-command", runRef, command: {type: "end-turn"}}
      : {type: "resume-run", runRef});
  }
  const source = structuredClone(f.raw());
  expect(source.snapshot.campaign.settlements).toHaveLength(1);
  expect(await f.upgrade("exempt")).toMatchObject({ok: true});
  const upgraded = await f.runtime.open("exempt");
  if (!upgraded.ok || upgraded.record.schemaVersion !== 4) throw Error("Upgrade failed");
  const campaign = upgraded.record.snapshot.campaign;
  expect(campaign.tutorial).toEqual({status: "exempt", reason: "pre-tutorial-save"});
  expect(campaign.funds).toEqual(source.snapshot.campaign.funds);
  expect(campaign.clock).toEqual(source.snapshot.campaign.clock);
  expect(campaign.settlements).toEqual(source.snapshot.campaign.settlements);
  expect(f.raw()).toEqual(source);
}, 30_000);
