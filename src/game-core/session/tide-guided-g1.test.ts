import { describe, expect, it } from "vitest";
import { validateD5Catalog } from "../contracts/d5-validation";
import { AIRP_POOL_CATALOG_DATA } from "../../content/gameplay/demo-v9/content";
import { MORNING_DEPARTURE_CATALOG_DATA } from "../../content/gameplay/demo-v6/content";
import { drawRngValue } from "../battle/persistence/rng";
import { roomInstance } from "./demo-expedition";
import {
  G1Recorder, G1_CONTINUATION_SEED, g1BattleOne, g1EventCatalog, g1ReachEvent, g1Payload,
  g1Candidate, g1ReachBoss, g1FinishBoss, g1SeedSieve, g1RngEvidence,
} from "./testing/tide-guided-g1";

const catalog = validateD5Catalog(AIRP_POOL_CATALOG_DATA);

it("replays the exact 8267 opening through real commands and preserves early legal hand/covenant effects", () => {
  const r = new G1Recorder(catalog, 19);
  g1BattleOne(r);
  expect(r.trace.find(t => t.label === "T1.R1.roll")!.after.dice.map(d => d.faceIndex! + 1)).toEqual([2,2,1,1,3]);
  expect(r.trace.find(t => t.label === "T1.R2.roll")!.after.dice.map(d => d.faceIndex! + 1)).toEqual([6,4,6,5,4]);
  expect(r.events.filter(e => e.type === "covenant-triggered").map(e => e.actorId)).toContain("kororo");
  expect(r.state.run.party.map(m => m.hp)).toEqual([3,2,3,3,3]);
  const replay = new G1Recorder(catalog, 19);
  for (const row of r.trace) {
    replay.state = replay.engine.restore(JSON.parse(JSON.stringify(replay.state)));
    expect(replay.step(row.operation, row.label)).toEqual(row.events);
    expect(replay.trace.at(-1)!.after).toEqual(row.after);
  }
  expect(replay.state).toEqual(r.state);
}, 15_000);

it("freezes T2 reroll/single-intent guard and T3 focus/two-pair/real knives in one continuous RNG stream", () => {
  expect(g1SeedSieve(G1_CONTINUATION_SEED)).toBe(true);
  const r = g1Candidate(G1_CONTINUATION_SEED, catalog);
  const row = (label: string) => r.trace.find(t => t.label === label)!;
  const faces = (label: string) => row(label).after.dice.map(d => d.faceIndex! + 1);
  expect(faces("T2.R1.roll")).toEqual([3,2,5,3,4]);
  expect(faces("T2.R1.reroll")).toEqual([5,2,3,1,3]);
  expect(faces("T2.R2.roll")).toEqual([2,5,4,4,5]);
  const guard = row("T2.R2.guard-bow");
  expect(guard.before.enemies.map(e => e.intent?.targetId)).toEqual(["eustice", "eustice"]);
  expect(guard.after.enemies.map(e => e.intent?.blocked)).toEqual([0,2]);
  expect(row("T2.R2.resolve.1").events.find(e => e.type === "damage-applied")!.payload).toMatchObject({applied: 0, targetId: "eustice"});
  expect(row("S3-3.food").after.party.map(m => m.hp)).toEqual([3,3,3,3,3]);
  expect(row("S3-3.food").after.supplies.map(s => s.charges)).toEqual([3,2]);
  expect(faces("T3.R1.roll")).toEqual([2,2,4,5,5]);
  const end = row("T3.R1.end");
  expect(end.before.dice.map(d => d.spent)).toEqual([true,true,false,true,true]);
  expect(end.after.handBonus - end.before.handBonus).toBeCloseTo(.3);
  expect(end.after.handBonus).toBeCloseTo(2);
  expect(end.events.map(e => e.type)).toEqual(["hand-settled", "covenant-triggered", "damage-applied"]);
  expect(end.events.map(e => e.id)).toEqual(["g1-run:event:83", "g1-run:event:84", "g1-run:event:85"]);
  expect(end.events[2]).toMatchObject({actorId: "norma", payload: {applied: 1, hpAfter: 5}});
  expect(r.state.run.rng.combat).toMatchObject({seed: G1_CONTINUATION_SEED, cursor: 33});
  expect(r.state.run.eventRng).toMatchObject({seed: 1019416702, cursor: 0});
  const draws = g1RngEvidence(r.initial, r.trace);
  expect(draws.filter(d => d.seed === 8267)).toHaveLength(13);
  expect(draws.filter(d => d.seed === G1_CONTINUATION_SEED)).toHaveLength(33);
  expect(draws.some(d => d.stream === "event")).toBe(false);
  expect(r.events.some(e => e.type === "unit-downed")).toBe(false);
  const replay = new G1Recorder(catalog, G1_CONTINUATION_SEED);
  for (const item of r.trace) {
    replay.state = replay.engine.restore(JSON.parse(JSON.stringify(replay.state)));
    expect(replay.step(item.operation, item.label)).toEqual(item.events);
    expect(replay.trace.at(-1)!.after).toEqual(item.after);
  }
  expect(replay.state).toEqual(r.state);
}, 15_000);

it("continues into a winnable Boss with different target/defense policies, without reseeding or restoring supplies", () => {
  const r = g1Candidate(G1_CONTINUATION_SEED, catalog);
  g1ReachBoss(r);
  const start = structuredClone(r.state);
  expect(start.run.rng.combat.cursor).toBe(39);
  expect(start.run.party.map(m => m.hp)).toEqual([3,3,3,3,3]);
  expect(start.run.supplies.map(s => s.charges)).toEqual([3,2]);
  const results = (["crossbow-first", "chief-first", "ignore-intents"] as const).map(strategy => {
    r.state = r.engine.restore(start);
    return g1FinishBoss(r, strategy);
  });
  expect(results.map(s => [s.won, s.rounds, s.damage, s.guards])).toEqual([[true,3,1,2],[true,3,1,4],[true,3,8,0]]);
  expect(results.every(s => s.downed.length === 0 && s.terminal?.totalGold === 36)).toBe(true);
  expect(results.every(s => s.terminal?.completion?.roomIds.length === 4 && s.terminal?.completion?.encounterIds.length === 4)).toBe(true);
  expect(results.every(s => s.final.rng.combat.seed === G1_CONTINUATION_SEED && s.final.eventRng.cursor === 0)).toBe(true);
}, 15_000);

describe("G1 isolated E1 fixture — not the new five-room tutorial", () => {
  const original = JSON.stringify(MORNING_DEPARTURE_CATALOG_DATA);
  const eventCatalog = g1EventCatalog(MORNING_DEPARTURE_CATALOG_DATA);
  const seedForSlot = (slot: number) => {
    for (let seed = 1; seed < 1000; seed++) {
      const d = drawRngValue({algorithm: "mulberry32", seed: (seed ^ 0x3c6ef372) >>> 0, cursor: 0});
      if (Math.floor(d.value * 6) + 1 === slot) return seed;
    }
    throw Error("No fixture seed");
  };
  it("uses the same selected continuation seed for Elora's first strong event face, without running its combat heal", () => {
    const r = g1ReachEvent(eventCatalog, G1_CONTINUATION_SEED), before = structuredClone(r.state);
    const events = r.step({type: "event", roomId: roomInstance(r.state.run), choice: "attempt", actorId: "elora"}, "E1.attempt");
    expect(r.state.run.eventResults[0]).toMatchObject({faceId: "face.elora.03", method: "strong", cost: 0, reward: 0});
    expect(r.state.run.eventRng).toEqual({algorithm: "mulberry32", seed: 1019416702, cursor: 1});
    expect(r.state.run.party).toEqual(before.run.party);
    expect(r.state.run.rng).toEqual(before.run.rng);
    expect(events.some(e => e.type === "healing-applied")).toBe(false);
  });
  it.each([[1,"strong"], [5,"weak"], [4,"failed"]] as const)("resolves Elora slot %i as %s once, on the independent stream", (slot, method) => {
    const r = g1ReachEvent(eventCatalog, seedForSlot(slot));
    const before = structuredClone(r.state), roomId = roomInstance(before.run);
    const operation = {type: "event", roomId, choice: "attempt", actorId: "elora"} as const;
    const result = r.engine.dispatch(before, operation);
    expect(before).toEqual(r.state);
    expect(result.state.run.eventRng.cursor).toBe(1);
    expect(result.state.run.rng).toEqual(before.run.rng);
    expect(result.state.run.party).toEqual(before.run.party);
    expect(result.state.run.supplies).toEqual(before.run.supplies);
    expect(result.state.run.looseGold).toBe(before.run.looseGold);
    expect(result.state.run.eventResults).toEqual([{roomId, eventId: "event.g1.tide-cache", choiceId: "attempt", actorId: "elora", faceId: before.run.party.find(m => m.id === "elora")!.config.faces[slot - 1].id, method, cost: 0, reward: 0}]);
    expect(result.events.map(e => e.type)).toEqual(["event-resolved", "room-completed"]);
    expect(result.state.run.completedRoomIds.filter(id => id === roomId)).toHaveLength(1);
    expect(r.engine.dispatch(r.engine.restore(JSON.parse(JSON.stringify(before))), operation)).toEqual(result);
    expect(r.engine.restore(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
    expect(() => r.engine.dispatch(result.state, operation)).toThrow();
    expect(() => r.engine.dispatch(result.state, {type: "battle", command: {type: "undo"}})).toThrow();
    const forged = structuredClone(result.state); forged.run.eventResults[0].method = method === "strong" ? "failed" : "strong";
    expect(() => r.engine.restore(forged)).toThrow();
    expect(JSON.stringify(MORNING_DEPARTURE_CATALOG_DATA)).toBe(original);
  });
  it("skips with no draw, and rejects reading, missing actors and battle rerolls without changing the pending event", () => {
    const r = g1ReachEvent(eventCatalog, 19), before = structuredClone(r.state), roomId = roomInstance(r.state.run);
    for (const operation of [
      {type: "event", roomId, choice: "attempt", actorId: null},
      {type: "event", roomId, choice: "attempt", actorId: "marietta"},
      {type: "event", roomId, choice: "read", actorId: null},
      {type: "battle", command: {type: "reroll"}},
    ] as const) expect(() => r.engine.dispatch(r.state, operation)).toThrow();
    expect(r.state).toEqual(before);
    const result = r.engine.dispatch(before, {type: "event", roomId, choice: "skip", actorId: null});
    expect(result.state.run.eventRng).toEqual(before.run.eventRng);
    expect(result.state.run.rng).toEqual(before.run.rng);
    expect(g1Payload(result.events[0])).toMatchObject({method: "skip", faceId: null, cost: 0, reward: 0});
    expect(r.engine.restore(JSON.parse(JSON.stringify(result.state)))).toEqual(result.state);
  });
});
