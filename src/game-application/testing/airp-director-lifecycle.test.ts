import { expect, it } from "vitest";
import { directorRuntime, directorPlan, directorScene, directorOutput, type DirectorFixture } from "./airp-director-playthrough";
import { poolTestRuntime } from "./airp-pool-playthrough";
import { nextD5PlayCommand } from "./d5-playthrough";
import { AIRP_DIRECTOR_CATALOG } from "../../game-runtime/airp-director-context";
import { DIRECTOR_FIXED_CARDS } from "../../content/gameplay/airp-director/content";
import { validateD5Record } from "../versions/d5-validate";
import { D5_RUN_READERS, directorHash } from "../../game-core/session";
import { compileDirectorJob } from "../airp-director/jobs";
import { emptyUsage } from "../airp-generation/contracts";

async function dusk(f: DirectorFixture) {
  for (let i = 0; i < 4 && (await f.read()).snapshot.campaign.clock.phase !== "dusk"; i++) await f.send({type: "advance-phase"});
}
async function accept(f: DirectorFixture, id: string) {await directorScene(f, id); await f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"}); await directorScene(f, id);}

it("atomically replaces only unpublished reservations, retaining the day ledger and original proposals", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  const original = (await f.read()).airpDirector!.events[0];
  await directorPlan(f, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"}, true);
  let r = await f.read(); expect(r.airpDirector!.days).toHaveLength(1); expect(r.airpDirector!.jobs.filter(j => j.kind === "day")).toHaveLength(2);
  expect(r.airpDirector!.events[0]).toMatchObject({id: original.id, status: "cancelled", publishedPhase: null, endedPhase: null});
  expect(r.airpDirector!.budgets).toHaveLength(0);
  await dusk(f); r = await f.read();
  const id = r.airpDirector!.events[1].id; expect(r.airpDirector!.budgets[0].publishedIds).toEqual([id]);
  await expect(f.send({type: "airp-director-prepare-replan"})).rejects.toThrow();
  await accept(f, id); await directorScene(f, id);
  await expect(f.send({type: "airp-director-prepare-replan"})).rejects.toThrow();
}, 25000);

it("rejects a late replacement after its original event was published", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  await f.send({type: "airp-director-prepare-replan"});
  const job = (await f.read()).airpDirector!.jobs.at(-1)!;
  await directorOutput(f, job, "director", JSON.stringify({version: 1, day: 1, reason: "留白", focus: null, entries: []}));
  await dusk(f);
  await expect(f.send({type: "airp-director-accept-day", jobId: job.id})).rejects.toThrow();
  expect((await f.read()).airpDirector!.events[0].status).toBe("offered");
}, 15000);

it("carries only this liaison's read request and reply, without promoting private knowledge to shared memory", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"}); await dusk(f);
  const id = (await f.read()).airpDirector!.events[0].id; await accept(f, id);
  await directorScene(f, id);
  let r = await f.read(), action = r.airpDirector!.jobs.at(-1)!;
  expect(action.scene!.taskReports.map(s => s.fromActorIds)).toEqual([["elora"], ["elora"]]);
  expect(action.scene!.previous).toHaveLength(0);
  await f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"}); await directorScene(f, id);
  r = await f.read(); const reply = r.airpDirector!.jobs.at(-1)!;
  await f.send({type: "airp-director-open", eventId: id});
  r = await f.read(); const result = r.airpDirector!.jobs.at(-1)!;
  expect(result.scene!.taskReports).toEqual([{sceneId: reply.id, text: reply.text!.lines.map(l => `${l.speaker}：${l.text}`).join("\n"),
    fromActorIds: reply.scene!.actorIds, toActorIds: ["elora"], via: "player-task-relay", evidenceIds: r.airpDirector!.memories.find(m => m.id === `memory:${reply.id}`)!.evidenceIds}]);
  expect(result.scene!.previous.some(s => s.sceneId === reply.id)).toBe(false);
  expect(r.airpDirector!.memories.find(m => m.id === `memory:${reply.id}`)!.knownBy).not.toContain("elora");
}, 30000);

it("refusal is durable, consumes the daily slot and cannot be revived by retries", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"}); await dusk(f);
  const id = (await f.read()).airpDirector!.events[0].id; await directorScene(f, id);
  await f.send({type: "airp-director-decline", eventId: id});
  let r = await f.read(); expect(r.airpDirector!.events[0]).toMatchObject({status: "closed", closeReason: "declined", endedPhase: 2});
  await directorScene(f, id); r = await f.read();
  expect(r.airpDirector!.budgets[0].publishedIds).toEqual([id]);
  await expect(f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"})).rejects.toThrow();
  expect(r.snapshot.campaign.settlements).toHaveLength(0);
}, 20000);

it("missed consequential cards record their admitted aftermath once without giving the player unseen knowledge", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.watch-note"});
  for (let i = 0; i < 7; i++) await f.send({type: "advance-phase"});
  const r = await f.read(), e = r.airpDirector!.events[0], records = r.airpDirector!.memories.filter(m => m.id === `aftermath:${e.id}`);
  expect(e).toMatchObject({status: "closed", exposed: false, closeReason: "missed", endedPhase: 6});
  expect(records).toHaveLength(1); expect(records[0].knownBy).not.toContain("kael");
  expect(r.snapshot.campaign.settlements).toHaveLength(0);
}, 15000);

it("generated but unshown free scenes are not exposure; expired definitions can return without invented memory", async () => {
  const f = await directorRuntime(), card = structuredClone(DIRECTOR_FIXED_CARDS[2].card);
  card.id = "free-unshown"; card.themeKey = "free-unshown";
  await directorPlan(f, {kind: "free", card}); await dusk(f);
  const id = (await f.read()).airpDirector!.events[0].id;
  await f.send({type: "airp-director-open", eventId: id});
  let job = (await f.read()).airpDirector!.jobs.at(-1)!;
  job = await directorOutput(f, job, "planning", "仅当前提议的三段规划。");
  job = await directorOutput(f, job, "writing", "<planning>演出。</planning><prose>柯萝萝：「どうぞ。（请坐。）」</prose>");
  await directorOutput(f, job, "formatting", JSON.stringify({creationRecord: "封装", lines: [{speaker: "kororo", emotion: "neutral", text: "「どうぞ。（请坐。）」"}]}));
  await f.send({type: "airp-director-pause"});
  for (let i = 0; i < 10; i++) await f.send({type: "advance-phase"});
  let r = await f.read(); const old = r.airpDirector!.events[0];
  expect(old).toMatchObject({status: "reserve", exposed: false, endedPhase: null});
  expect(r.airpDirector!.memories).toHaveLength(0);
  await directorPlan(f, {kind: "reserve", eventId: id}); await dusk(f);
  r = await f.read(); expect(r.airpDirector!.events[1].card).toEqual(old.card);
  expect(r.airpDirector!.events[1]).toMatchObject({status: "offered", exposed: false, readSceneIds: []});
}, 25000);

it("reissues an unexposed reserve with the frozen definition only on a later day and counts the new publication", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"});
  for (let i = 0; i < 10; i++) await f.send({type: "advance-phase"});
  const old = (await f.read()).airpDirector!.events[0];
  await expect(directorPlan(f, {kind: "reserve", eventId: old.id})).rejects.toThrow();
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  await directorPlan(f, {kind: "reserve", eventId: old.id}); await dusk(f);
  const r = await f.read(), current = r.airpDirector!.events[1];
  expect(current.id).not.toBe(old.id); expect(current.card).toEqual(old.card); expect(current.status).toBe("offered");
  expect(r.airpDirector!.events[0].status).toBe("cancelled");
  expect(r.airpDirector!.budgets.at(-1)?.publishedIds).toEqual([current.id]);
}, 20000);

it("wait actions use game phases; accepted tasks survive offer expiry and finish only after reading the result", async () => {
  const f = await directorRuntime(), card = structuredClone(DIRECTOR_FIXED_CARDS[1].card);
  card.id = "wait-test"; card.themeKey = "wait-test"; card.form = "household"; card.volatility = "inert"; card.offerPhases = 8; card.aftermath = null;
  card.actions = [{id: "do", kind: "do", actorId: "elora", locationId: "plaza", intent: "整理", choices: card.choices}, {id: "wait", kind: "wait", phases: 8, actorId: "elora", locationId: "plaza", intent: "约好两日后再聊", choices: card.choices}];
  await directorPlan(f, {kind: "free", card}); await dusk(f); const id = (await f.read()).airpDirector!.events[0].id; await accept(f, id);
  await directorScene(f, id); await f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"}); await directorScene(f, id);
  await directorScene(f, id); await f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"});
  for (let i = 0; i < 7; i++) await f.send({type: "advance-phase"});
  expect((await f.read()).airpDirector!.events[0].status).toBe("waiting-action");
  await f.send({type: "advance-phase"}); expect((await f.read()).airpDirector!.events[0].status).toBe("feedback");
  await directorScene(f, id); expect((await f.read()).airpDirector!.events[0].status).toBe("ready");
  await directorScene(f, id); expect((await f.read()).airpDirector!.events[0].status).toBe("resolved");
}, 30000);

it("requires a real post-acceptance patrol and target evidence, retaining existing content and full author sources", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.elora.old-medicine-case"}); await dusk(f);
  const id = (await f.read()).airpDirector!.events[0].id; await accept(f, id); await directorScene(f, id);
  await f.send({type: "airp-director-choose", eventId: id, choiceId: "participate"});
  const departure = f.runtime.queries.journey(await f.read())!;
  expect(departure.defaultRouteId).toBe(AIRP_DIRECTOR_CATALOG.data.manor!.maintenanceRouteId);
  expect(departure.maintenance).toBe(true);
  let r = await f.send({type: "start-expedition", runId: "director-patrol", routeId: departure.defaultRouteId, partyIds: AIRP_DIRECTOR_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19});
  for (let i = 0; r.snapshot.run && i < 700; i++) {
    const command = nextD5PlayCommand(AIRP_DIRECTOR_CATALOG, r);
    r = await f.send(command.type === "choose-exit" ? {...command, choice: "leave"} : command);
  }
  expect(r.snapshot.run).toBeNull(); expect(r.snapshot.campaign.settlements.at(-1)?.outcome).toBe("extracted");
  expect(r.airpDirector!.events[0]).toMatchObject({status: "feedback", actionOutcome: "succeeded"});
  await dusk(f); await directorScene(f, id); await directorScene(f, id);
  r = await f.read(); expect(r.airpDirector!.events[0].status).toBe("resolved");
  expect(r.airpDirector!.events[0].evidenceIds.length).toBeGreaterThan(4);
  const last = r.airpDirector!.jobs.filter(j => j.kind === "scene").at(-1)!;
  const material = r.airpDirector!.materials[last.materialHash], input = compileDirectorJob(material, {...last, attempts: [], text: null});
  for (const source of material.resources.sources) expect(input.messages.some(m => m.content.includes(source.text))).toBe(true);
  expect(last.scene!.facts.some(f => f.text.includes("extracted"))).toBe(true);
}, 60000);

it("keeps a separate extractive updater and one legal parent followup, without erasing cooldown", async () => {
  const f = await directorRuntime(); await directorPlan(f, {kind: "fixed", definitionId: "ripple.kororo.quiet-cup"}); await dusk(f);
  const id = (await f.read()).airpDirector!.events[0].id; await accept(f, id); await directorScene(f, id);
  let r = await f.read(); const scene = r.airpDirector!.jobs.filter(j => j.kind === "scene").at(-1)!;
  await f.send({type: "airp-director-prepare-memory", jobId: scene.id});
  const memory = (await f.read()).airpDirector!.jobs.at(-1)!;
  const input = compileDirectorJob(r.airpDirector!.materials[scene.materialHash], memory);
  expect(input.stage).toBe("memory"); expect(input.messages).toHaveLength(2); expect(input.messages[1].content).not.toContain("<planning>");
  await directorOutput(f, memory, "memory", JSON.stringify({sourceSceneId: scene.id, quotes: [{line: 0, text: scene.text!.lines[0].text}]}));
  await f.send({type: "advance-phase"}); await f.send({type: "advance-phase"});
  await directorPlan(f, {kind: "followup", parentId: id}); await dusk(f);
  r = await f.read(); const followup = r.airpDirector!.events[1]; expect(followup.parentId).toBe(id); expect(followup.card.actions).toHaveLength(0);
  await directorScene(f, followup.id); r = await f.read();
  expect(r.airpDirector!.events[1].status).toBe("resolved"); expect(r.airpDirector!.events[0].endedPhase).toBe(2); expect(r.airpDirector!.events[0].followupConsumed).toBe(true);
  expect(r.airpDirector!.jobs.at(-1)!.scene!.previous.length).toBeGreaterThan(0);
}, 30000);

it("exact restore replays all state and recovers a lost receipt; state tampering and cross-version commands are rejected", async () => {
  const f = await directorRuntime(); await directorPlan(f, null);
  const r = await f.read(), archive = JSON.stringify({archiveVersion: 4, record: r});
  const restored = poolTestRuntime(undefined, r.head.saveId);
  expect((await restored.runtime.application.restoreSave({archive, clientRequestId: "restore"})).ok).toBe(true);
  expect(await restored.read()).toEqual(r);
  const commit = r.commits.at(-1)!, fact = r.facts.at(-1)!;
  if (fact.kind !== "airp-director") throw Error("missing source");
  const retry = await restored.runtime.application.dispatch({protocolVersion: 4, saveId: r.head.saveId, expectedHead: commit.previous, clientRequestId: commit.requestId, command: fact.payload.command});
  expect(retry.ok && retry.replayed).toBe(true); expect(await restored.read()).toEqual(r);
  const changed = structuredClone(r); changed.airpDirector!.days = [];
  expect(() => validateD5Record(changed, AIRP_DIRECTOR_CATALOG, D5_RUN_READERS)).toThrow();
  const invalid = await f.runtime.application.dispatch({protocolVersion: 4, saveId: r.head.saveId, expectedHead: r.head, clientRequestId: "invalid-direct", command: {type: "airp-direct-followup", instanceId: "unknown"}});
  expect(invalid.ok).toBe(false);
  expect(directorHash(await restored.read())).toBe(directorHash(r));
}, 20000);

it("malformed output remains durable and revisions are bounded; client cannot inject a world or an arbitrary effect", async () => {
  const f = await directorRuntime(); await f.send({type: "airp-director-prepare-day"});
  const job = (await f.read()).airpDirector!.jobs.at(-1)!;
  await f.send({type: "airp-director-begin", jobId: job.id, attemptId: "bad-attempt", stage: "director", at: 1});
  await f.send({type: "airp-director-result", jobId: job.id, attemptId: "bad-attempt", output: '{"rewardGold":999}', usage: emptyUsage(), at: 2});
  expect((await f.read()).airpDirector!.jobs[0].attempts[0]).toMatchObject({status: "failed", output: '{"rewardGold":999}'});
  await f.send({type: "airp-director-prepare-day"}); await f.send({type: "airp-director-prepare-day"});
  await expect(f.send({type: "airp-director-prepare-day"})).rejects.toThrow();
  const r = await f.read();
  const injected = await f.runtime.application.dispatch({protocolVersion: 4, saveId: r.head.saveId, expectedHead: r.head, clientRequestId: "inject", command: {type: "airp-director-prepare-day", world: {eligible: true}}});
  expect(injected.ok).toBe(false); expect(r.airpDirector!.events).toHaveLength(0);
}, 15000);
