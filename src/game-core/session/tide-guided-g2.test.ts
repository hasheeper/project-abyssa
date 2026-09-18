import { beforeAll, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { GUIDED_TIDE_CATALOG_DATA } from "../../content/gameplay/demo-v11/content";
import { G2Recorder, G2_CONTENT_DIGEST, G2_STANDARD_OPERATION_DIGEST } from "./testing/tide-guided-g2";
import { canonicalJson } from "../contracts/validation";
import { sha256 } from "../contracts/sha256";
import { tutorialGuideOperation } from "./tutorial-guide";
import { roomInstance } from "./demo-expedition";
import type { D5ExpeditionState } from "./d5-types";
import type { D5JourneyOperation } from "./d5-expedition";
import { TIDE_CAVE_CATALOG_DATA } from "../../content/gameplay/demo-v7/content";
import { AIRP_POOL_CATALOG_DATA } from "../../content/gameplay/demo-v9/content";
import { AIRP_ONLINE_CATALOG_DATA } from "../../content/gameplay/demo-v10/content";

const catalog = validateD5Catalog(GUIDED_TIDE_CATALOG_DATA);
let standard: G2Recorder;
beforeAll(() => { standard = new G2Recorder(catalog).until(s => s.tutorial!.stage === "claimable"); }, 15_000);
const at = (label: string) => {
  const i = standard.trace.findIndex(t => t.label === label && t.operation.type !== "resume");
  if (i < 0) throw Error(`Missing ${label}`);
  return structuredClone(standard.states[i]);
};
const branch = (state: D5ExpeditionState) => { const r = new G2Recorder(catalog); r.state = r.engine.restore(state); return r; };
const exit = (r: G2Recorder) => r.step({type: "tutorial-guide", planId: catalog.data.tutorial!.guide!.id, mode: "free", attempt: r.state.tutorial!.attempt});
function lose(r: G2Recorder, reroll = false) {
  for (let i = 0; i < 400 && r.state.tutorial!.stage !== "failed"; i++) {
    const e = r.state.encounter!;
    r.step(e.phase === "roll" ? {type: "battle", command: {type: "roll"}} : e.phase === "act" && e.formation.length ? {type: "battle", command: {type: reroll && e.rerolls > 0 ? "reroll" : "end-turn"}} : {type: "resume"});
  }
  expect(r.state.tutorial!.stage).toBe("failed");
  return r;
}

it("executes the five-room release through real guide gates, independent E1 and free Boss", () => {
  const r = standard;
  expect(catalog.ref.digest).toBe(G2_CONTENT_DIGEST);
  expect(r.trace).toHaveLength(111);
  expect(sha256(canonicalJson(r.trace.map(t => t.operation)))).toBe(G2_STANDARD_OPERATION_DIGEST);
  expect(r.state.result?.completion?.roomIds).toHaveLength(5);
  expect(r.state.result?.completion?.encounterIds).toHaveLength(4);
  expect(r.state.result?.totalGold).toBe(36);
  expect(r.state.run.eventRng.cursor).toBe(1);
  expect(r.state.run.eventResults).toMatchObject([{actorId: "elora", faceId: "face.elora.03", method: "strong", cost: 0, reward: 0}]);
  expect(r.state.tutorial!.guide).toMatchObject({mode: "free", reason: "completed", cursor: catalog.data.tutorial!.guide!.steps.length});
  expect(r.state.tutorial!.readStoryIds).toEqual(["S3-1", "S3-2", "S3-3", "S3-4", "S3-5", "S4-1", "S4-2"]);
  expect(r.state.tutorial!.choices).toEqual([{storyId: "S3-4", step: 0, choice: "A"}]);
  const row = (id: string) => r.trace.find(t => t.label === id && t.operation.type !== "resume")!;
  expect(row("T3.R1.roll").after.dice.map(d => d.faceIndex! + 1)).toEqual([2,2,4,5,5]);
  expect(row("E1.attempt").after.rng).toEqual(row("E1.attempt").before.rng);
  expect(row("E1.attempt").after.party).toEqual(row("E1.attempt").before.party);
  expect(row("E1.attempt").after.supplies).toEqual(row("E1.attempt").before.supplies);
  expect(row("T3.R1.end").events.map(e => e.type)).toEqual(["hand-settled", "covenant-triggered", "damage-applied"]);
  for (let i = 0; i < r.trace.length; i++) {
    const before = r.engine.restore(JSON.parse(JSON.stringify(r.states[i])));
    const replay = r.engine.dispatch(before, r.trace[i].operation);
    expect(replay.events).toEqual(r.trace[i].events);
    expect(replay.state).toEqual(r.states[i + 1] ?? r.state);
  }
}, 20_000);

it("rejects out-of-step rolls, actors, targets, items, exits and early END without touching the input", () => {
  const r = branch(at("T1.R1.kael.fix")), before = structuredClone(r.state), roomId = roomInstance(r.state.run);
  const operations: D5JourneyOperation[] = [
    {type: "battle", command: {type: "end-turn"}}, {type: "battle", command: {type: "reroll"}},
    {type: "battle", command: {type: "toggle-load", actorId: "eustice"}},
    {type: "advance", roomId}, {type: "event", roomId, choice: "skip", actorId: null},
    {type: "exit", roomId, choice: "leave"}, {type: "tutorial-read", storyId: "S3-2", step: 0, choice: "continue"},
    {type: "tutorial-guide", planId: "foreign", attempt: 1, mode: "free"},
    {type: "tutorial-guide", planId: "tide.guide.v1", attempt: 2, mode: "free"},
  ];
  for (const op of operations) expect(() => r.engine.dispatch(r.state, op)).toThrow();
  expect(r.state).toEqual(before);
  r.next();
  const correct = tutorialGuideOperation(catalog, r.state)!;
  expect(correct.type).toBe("battle");
  expect(() => r.engine.dispatch(r.state, {type: "battle", command: {type: "act", actorId: "kael", choice: "attack", targetId: r.state.encounter!.enemies[1].id}})).toThrow();
  r.step(correct);
});

it("keeps hidden hints distinct from leaving the guide, and UNDO restores actual proofs", () => {
  const r = branch(at("T2.R2.guard-bow.fix")), original = structuredClone(r.state);
  r.step({type: "tutorial-hints", enabled: false});
  expect(r.state.tutorial!.guide).toEqual(original.tutorial!.guide);
  expect(() => r.engine.dispatch(r.state, {type: "battle", command: {type: "end-turn"}})).toThrow();
  r.next(); r.next();
  expect(r.state.tutorial!.guide!.cursor).toBe(original.tutorial!.guide!.cursor + 2);
  expect(r.state.encounter!.enemies[1].intent!.blocked).toBe(2);
  r.step({type: "battle", command: {type: "undo"}});
  expect(r.state.encounter!.enemies[1].intent!.blocked).toBe(0);
  expect(r.state.tutorial!.guide!.cursor).toBe(original.tutorial!.guide!.cursor + 1);
  r.step({type: "battle", command: {type: "undo"}});
  expect(r.state.tutorial!.guide).toEqual(original.tutorial!.guide);
  expect(r.state.tutorial!.hintsEnabled).toBe(false);
  r.next(); exit(r);
  r.step({type: "battle", command: {type: "undo"}});
  expect(r.state.tutorial!.guide).toMatchObject({mode: "free", reason: "exited", cursor: original.tutorial!.guide!.cursor});
  expect(r.engine.restore(r.state)).toEqual(r.state);
});

it("requires a current E1 result observation and rejects stale identity, step and basis", () => {
  const r = branch(at("E1.result")), expected = tutorialGuideOperation(catalog, r.state)!;
  expect(expected.type).toBe("tutorial-observe");
  if (expected.type !== "tutorial-observe") throw Error("Expected observation");
  for (const change of [{attempt: 2}, {stepId: "E1.attempt"}, {planId: "other"}, {basis: "0".repeat(64)}])
    expect(() => r.engine.dispatch(r.state, {...expected, ...change})).toThrow();
  expect(() => r.engine.dispatch(r.state, {type: "advance", roomId: roomInstance(r.state.run)})).toThrow();
  r.step({type: "tutorial-hints", enabled: false});
  expect(() => r.engine.dispatch(r.state, expected)).toThrow();
  r.next();
  expect(() => r.engine.dispatch(r.state, expected)).toThrow();
  r.next();
  expect(r.state.run.room).toBe(3);
  expect(r.state.run.encounterSequence).toBe(3);
});

it("rejects forged result faces, methods, absent room proof, and noncontiguous guide proofs", () => {
  const before = at("E1.attempt"), after = at("E1.result");
  const attempt = tutorialGuideOperation(catalog, before)!;
  for (const op of [
    {type: "event", roomId: roomInstance(before.run), choice: "skip", actorId: null},
    {type: "event", roomId: roomInstance(before.run), choice: "attempt", actorId: "kael"},
    {type: "event", roomId: roomInstance(before.run), choice: "read", actorId: null},
    {type: "event", roomId: "foreign", choice: "attempt", actorId: "elora"},
    {type: "battle", command: {type: "reroll"}},
  ] as const) expect(() => standard.engine.dispatch(before, op)).toThrow();
  expect(standard.engine.dispatch(standard.engine.restore(before), attempt).state).toEqual(after);
  expect(() => standard.engine.dispatch(after, attempt)).toThrow();
  for (const corrupt of [
    (s: D5ExpeditionState) => { s.run.eventResults[0].faceId = "face.elora.01"; },
    (s: D5ExpeditionState) => { s.run.eventResults[0].method = "failed"; },
    (s: D5ExpeditionState) => { s.run.eventResults = []; },
    (s: D5ExpeditionState) => { s.run.completedRoomIds.pop(); },
    (s: D5ExpeditionState) => { s.run.eventRng.cursor = 0; },
    (s: D5ExpeditionState) => { s.tutorial!.guide!.proofs[0].eventIds = ["foreign:event:1"]; },
    (s: D5ExpeditionState) => { s.tutorial!.guide!.proofs[1].stepId = "E1.attempt"; },
    (s: D5ExpeditionState) => { s.tutorial!.guide!.cursor++; },
  ]) { const forged = structuredClone(after); corrupt(forged); expect(() => standard.engine.restore(forged)).toThrow(); }
});

it.each(["attempt", "skip"] as const)("allows a real event %s after explicit exit, without any guide completion requirement", choice => {
  const r = branch(at("E1.attempt")); exit(r);
  const before = structuredClone(r.state);
  r.step({type: "event", roomId: roomInstance(r.state.run), choice, actorId: choice === "attempt" ? "kael" : null});
  expect(r.state.run.eventResults[0].method).toBe(choice === "attempt" ? "failed" : "skip");
  expect(r.state.run.eventRng.cursor).toBe(choice === "attempt" ? 1 : 0);
  expect(r.state.run.rng).toEqual(before.run.rng);
  r.until(s => s.tutorial!.stage === "claimable");
  expect(r.state.result?.completion?.roomIds).toHaveLength(5);
  expect(r.state.tutorial!.guide).toMatchObject({reason: "exited", mode: "free"});
}, 15_000);

it.each(["T1.R1.roll", "T2.R1.roll", "T3.R1.roll"])("restores a real wipe at %s from the encounter checkpoint, preserving explicit exit", label => {
  const r = branch(at(label)), checkpoint = structuredClone(r.state.tutorial!.checkpoint.state); exit(r); lose(r);
  const sequence = r.state.run.sequence;
  r.step({type: "tutorial-retry", scope: "encounter", attempt: 1});
  expect(r.state.run.party).toEqual(checkpoint.run.party);
  expect(r.state.run.supplies).toEqual(checkpoint.run.supplies);
  expect(r.state.run.rng).toEqual(checkpoint.run.rng);
  expect(r.state.run.eventRng).toEqual(checkpoint.run.eventRng);
  expect(r.state.run.eventResults).toEqual(checkpoint.run.eventResults);
  expect(r.state.run.sequence).toBeGreaterThan(sequence);
  expect(r.state.tutorial!.guide).toMatchObject({reason: "exited", mode: "free"});
  expect(r.state.tutorial!.story).toBeNull();
  r.step({type: "battle", command: {type: "roll"}});
  expect(r.engine.restore(r.state)).toEqual(r.state);
}, 15_000);

it("restores T3's guided lesson after a free-play wipe without drawing E1 again", () => {
  const state = standard.states.find(s => s.run.room === 3 && s.encounter?.round === 2 && s.encounter.phase === "roll")!;
  const r = lose(branch(state), true);
  r.step({type: "tutorial-retry", scope: "encounter", attempt: 1});
  expect(r.state.tutorial!.guide!.mode).toBe("guided");
  expect(r.state.run.eventResults).toEqual(state.run.eventResults);
  expect(r.state.run.eventRng.cursor).toBe(1);
  expect(catalog.data.tutorial!.guide!.steps[r.state.tutorial!.guide!.cursor].id).toBe("T3.R1.roll");
  r.until(s => s.tutorial!.guide!.mode === "free");
  expect(r.state.run.eventRng.cursor).toBe(1);
}, 15_000);

it("retains the E1 result and attitude on Boss retry; chapter retry rewinds draws and supplies only", () => {
  const boss = standard.states.find(s => s.run.room === 4 && s.encounter?.phase === "roll")!;
  const r = lose(branch(boss));
  r.step({type: "tutorial-retry", scope: "encounter", attempt: 1});
  expect(r.state.run.rng).toEqual(boss.run.rng);
  expect(r.state.run.eventResults).toEqual(boss.run.eventResults);
  expect(r.state.tutorial!.choices).toEqual(boss.tutorial!.choices);
  expect(r.state.tutorial!.guide!.mode).toBe("free");
  lose(r);
  const sequence = r.state.run.sequence;
  r.step({type: "tutorial-retry", scope: "chapter", attempt: 2});
  expect(r.state.run.eventResults).toEqual([]);
  expect(r.state.run.eventRng.cursor).toBe(0);
  expect(r.state.run.supplies.map(s => s.charges)).toEqual([4,2]);
  expect(r.state.run.rng.combat.seed).toBe(8267);
  expect(r.state.tutorial!.guide).toMatchObject({mode: "guided", cursor: 0, proofs: []});
  expect(r.state.tutorial!.choices).toEqual(boss.tutorial!.choices);
  expect(r.state.run.sequence).toBeGreaterThan(sequence);
  r.until(s => s.tutorial!.stage === "claimable");
  expect(r.state.run.eventResults).toEqual(boss.run.eventResults);
  expect(r.state.tutorial!.choices).toHaveLength(1);
}, 25_000);

it.each(["B", "C"] as const)("sends attitude %s to the identical free Boss", choice => {
  const state = standard.states.find(s => s.tutorial!.story?.id === "S3-4")!, r = branch(state);
  r.until(s => s.run.room === 4, choice);
  const boss = standard.states.find(s => s.run.room === 4)!;
  expect(r.state.encounter).toEqual(boss.encounter);
  expect(r.state.run.rng).toEqual(boss.run.rng);
  expect(r.state.tutorial!.choices[0].choice).toBe(choice);
  expect(tutorialGuideOperation(catalog, r.state)).toBeNull();
});

it.each([TIDE_CAVE_CATALOG_DATA, AIRP_POOL_CATALOG_DATA, AIRP_ONLINE_CATALOG_DATA])("keeps content $contentVersion four-room states, seeds and command readers unchanged", data => {
  const old = validateD5Catalog(data), r = new G2Recorder(old, 123);
  expect(r.state.run.roomIds[0]).toHaveLength(4);
  expect(r.state.tutorial!.continuationSeed).toBe(123);
  expect(r.state.tutorial!.guide).toBeUndefined();
  expect(() => r.engine.dispatch(r.state, {type: "tutorial-guide", mode: "free", planId: "tide.guide.v1", attempt: 1})).toThrow();
  expect(() => r.engine.dispatch(r.state, {type: "tutorial-observe", planId: "tide.guide.v1", attempt: 1, stepId: "E1.result", basis: "0".repeat(64)})).toThrow();
  const forged = structuredClone(r.state); forged.tutorial!.guide = standard.state.tutorial!.guide;
  expect(() => r.engine.restore(forged)).toThrow();
});
