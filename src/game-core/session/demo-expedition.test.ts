import { describe, expect, it } from "vitest";
import { MANOR_CATALOG } from "../../game-runtime/manor-context";
import { validateDemoCatalog } from "../contracts";
import { createDemoBattleEngine } from "../battle";
import { createDemoCampaign, startDemoExpedition, settleDemoExpedition } from "./demo";
import { asDemoBattle, fromDemoBattle, continueDemoExpedition, advanceDemoRoom, chooseDemoExit, layerReady, roomInstance, validateDemoExpedition, type DemoExpeditionState } from "./demo-expedition";
import { useDemoItem, chooseDemoEvent } from "./demo-items-events";
import { layerGold } from "../battle/rules/v2/journey-validation";

const c = MANOR_CATALOG, profile = c.data.journey!.defaultProfileId;
function start(items = c.data.journey!.defaultItems) {
  return startDemoExpedition(c, profile, createDemoCampaign(c, profile), {runId: "test-run", routeId: c.data.journey!.defaultRouteId, partyIds: c.data.initialParty, seed: 19, itemIds: items});
}
function action(s: DemoExpeditionState, command: unknown) { return fromDemoBattle(createDemoBattleEngine(c).dispatch(asDemoBattle(s)!, command).state); }
function recover(s: DemoExpeditionState) {
  for (let i = 0; i < 50; i++) {
    const e = s.encounter;
    if (!(e && (e.phase === "enemy" || e.phase === "complete" || e.phase === "act" && !e.formation.length)) && !layerReady(c.data, s)) return s;
    s = continueDemoExpedition(c, s).state;
  }
  throw new Error("non-terminating recovery");
}
function win(s: DemoExpeditionState) {
  // Isolated lifecycle fixture: production/browser tests use normal player actions.
  if (!s.encounter) throw new Error("battle required");
  s.encounter.enemies.forEach(e => {e.hp = 0; e.intent = null;}); s.encounter.formation = [];
  s.run.looseGold = s.encounter.enemies.reduce((n, e) => n + c.data.enemies[e.definitionId].bounty, 0);
  s = action(s, {type: "roll"}); s = action(s, {type: "end-turn"}); return recover(s);
}
function layerTwo() {
  let s = win(start().expedition!);
  s = advanceDemoRoom(c, s, roomInstance(s.run)).state;
  s = chooseDemoEvent(c, s, roomInstance(s.run), "read", null).state;
  s = recover(s); return advanceDemoRoom(c, s, roomInstance(s.run)).state;
}
describe("manor expedition boundaries", () => {
  it("publishes a closed five-player segment and keeps Marietta dossier-only", () => {
    expect(c.data.characters.marietta.release?.deferredCovenantId).toBe("covenant.marietta");
    expect(() => startDemoExpedition(c, profile, createDemoCampaign(c, profile), {runId: "x", routeId: c.data.journey!.defaultRouteId, seed: 1, partyIds: ["kael", "marietta"]})).toThrow();
    const broken = structuredClone(c.data); broken.profiles[profile].availableCharacterIds.push("marietta");
    expect(() => validateDemoCatalog(broken)).toThrow();
  });
  it("reserves four bound supplies exactly once and rejects duplicate/extra slots", () => {
    const s = start(); expect(s.campaign.supplies).toEqual([]); expect(s.expedition!.run.supplies.map(x => x.charges)).toEqual([4,2,2,2]);
    expect(() => start(["item.food", "item.food"])).toThrow();
    expect(() => start(Object.keys(c.data.journey!.items).slice(0, 5))).toThrow();
  });
  it("waits at event and corridor; banks only after the event, once", () => {
    let s = win(start().expedition!);
    expect(s.node).toBe("room-complete"); expect(s.run.bankedGold).toBe(0);
    expect(() => continueDemoExpedition(c, s)).toThrow();
    s = advanceDemoRoom(c, s, roomInstance(s.run)).state;
    expect(s.node).toBe("event"); expect(() => continueDemoExpedition(c, s)).toThrow();
    s = chooseDemoEvent(c, s, roomInstance(s.run), "skip", null).state;
    const room = roomInstance(s.run); s = recover(s);
    expect(s.run.layerResults).toHaveLength(1); expect(s.run.looseGold).toBe(0);
    expect(() => chooseDemoEvent(c, s, room, "read", null)).toThrow(); expect(() => continueDemoExpedition(c, s)).toThrow();
    expect(() => chooseDemoExit(c, s, room, "leave")).toThrow();
  });
  it("pays the third-layer exit once, returns remaining supplies, advances time and supports a second run", () => {
    const snapshot = start(); let s = layerTwo(); s = win(s);
    s = advanceDemoRoom(c, s, roomInstance(s.run)).state; s = recover(chooseDemoEvent(c, s, roomInstance(s.run), "skip", null).state);
    s = advanceDemoRoom(c, s, roomInstance(s.run)).state; s = win(s);
    s = advanceDemoRoom(c, s, roomInstance(s.run)).state; expect(s.node).toBe("exit");
    expect(() => continueDemoExpedition(c, s)).toThrow(); expect(() => chooseDemoExit(c, s, roomInstance(s.run), "continue")).toThrow();
    s = chooseDemoExit(c, s, roomInstance(s.run), "leave").state;
    if (s.node !== "finished") throw new Error("terminal required"); snapshot.expedition = s;
    const settled = settleDemoExpedition(c, profile, snapshot, s.run.id, s.result.id);
    expect(settled.campaign.clock.phase).toBe("day"); expect(settled.campaign.funds.party).toBe(s.result.totalGold);
    expect(settleDemoExpedition(c, profile, settled, s.run.id, s.result.id)).toEqual(settled);
    expect(settled.campaign.supplies).toHaveLength(4);
    const second = startDemoExpedition(c, profile, settled, {runId: "second", routeId: s.run.routeId, partyIds: c.data.initialParty, seed: 12, itemIds: ["item.food", "item.potion", "item.lucky-charm", "item.divination-slip"]});
    expect(second.expedition!.run.supplies.map(x => x.charges)).toEqual([4,2,1,2]); expect(second.campaign.supplies).toHaveLength(2);
    expect(second.expedition!.run.party.every(m => m.hp === m.config.maxHp && !m.temporaryRust.length)).toBe(true);
  });
  it("loses only current loose gold and half this run's bank on a wipe", () => {
    let s = layerTwo(); const bank = s.run.bankedGold; s.run.looseGold = 7;
    s.run.party.forEach(m => {m.hp = 0; m.pendingSeal = false;});
    s.encounter!.phase = "complete"; s.encounter!.outcome = "wipe"; s.run.completedEncounterIds.push(s.encounter!.id);
    s = recover(s); expect(s.node).toBe("finished");
    expect(s.result?.totalGold).toBe(Math.floor(bank / 2)); expect(s.result?.lostLooseGold).toBe(7);
  });
  it("makes event fees, one RNG draw and result atomic; repeat cannot roll again", () => {
    let s = win(layerTwo()); s = advanceDemoRoom(c, s, roomInstance(s.run)).state;
    const before = structuredClone(s), id = roomInstance(s.run);
    const result = chooseDemoEvent(c, s, id, "attempt", "elora");
    expect(s).toEqual(before); expect(result.state.run.eventRng.cursor).toBe(before.run.eventRng.cursor + 1);
    expect(result.state.run.rng).toEqual(before.run.rng);
    const fact = result.state.run.eventResults.at(-1)!;
    expect(result.state.run.looseGold).toBe(before.run.looseGold - 2 + fact.reward);
    expect(() => chooseDemoEvent(c, result.state, id, "attempt", "kael")).toThrow();
    s.run.looseGold = 1; expect(() => chooseDemoEvent(c, s, id, "attempt", "elora")).toThrow();
    expect(chooseDemoEvent(c, s, id, "skip", null).state.node).toBe("room-complete");
  });
  it("uses integer half-up layer arithmetic", () => { expect(layerGold(11,60,125,110)).toBe(24); expect(layerGold(1,0,150,100)).toBe(2); });
  it("rejects forged room completion and terminal rewards", () => {
    const s = start().expedition!; s.run.completedRoomIds.push(s.run.roomIds[2][0]); expect(() => validateDemoExpedition(c, s)).toThrow();
  });
});
describe("manor supply rules", () => {
  it("charges food appetite across rounds and never heals a downed member", () => {
    let s = start().expedition!, id = s.run.supplies[0].instanceId; s.run.party[0].hp = 1;
    s = useDemoItem(c, s, id, {kind: "member", id: "kael"}).state;
    s = useDemoItem(c, s, id, {kind: "member", id: "kael"}).state;
    expect(s.run.foodUses.kael).toBe(2); expect(s.encounter!.itemsUsed).toBe(2);
    s.encounter!.itemsUsed = 0; s.run.party[0].hp = 1;
    expect(() => useDemoItem(c, s, id, {kind: "member", id: "kael"})).toThrow();
    s.run.party[1].hp = 0; expect(() => useDemoItem(c, s, id, {kind: "member", id: "eustice"})).toThrow();
  });
  it("cleanses and rolls only the unrolled sealed die, atomically", () => {
    let s = start().expedition!; s.encounter!.dice[0].sealed = true;
    s = action(s, {type: "roll"}); const before = structuredClone(s), id = s.run.supplies.find(x => x.definitionId === "item.holy-water")!.instanceId;
    const r = useDemoItem(c, s, id, {kind: "member", id: "kael"}); s = r.state;
    expect(s.encounter!.dice[0].sealed).toBe(false); expect(s.encounter!.dice[0].faceIndex).not.toBeNull();
    expect(s.encounter!.dice.slice(1)).toEqual(before.encounter!.dice.slice(1)); expect(s.run.rng.combat.cursor).toBe(before.run.rng.combat.cursor + 1);
    expect(r.events.find(e => e.type === "dice-rolled")?.payload).toEqual({ownerIds: ["kael"], reroll: false});
    s = action(s, {type: "undo"}); expect(s.run.supplies).toEqual(before.run.supplies); expect(s.encounter).toEqual(before.encounter);
  });
  it("grants a third reroll without moving fixed or used dice", () => {
    let s = start(["item.lucky-charm"]).expedition!; s = action(s, {type: "roll"});
    s = action(s, {type: "toggle-load", actorId: "kael"}); const face = s.encounter!.dice[0].faceIndex;
    s = useDemoItem(c, s, s.run.supplies[0].instanceId, {kind: "round"}).state; expect(s.encounter!.rerolls).toBe(3);
    s = action(s, {type: "reroll"}); expect(s.encounter!.dice[0].faceIndex).toBe(face);
  });
  it("maintenance removes only an existing temporary overlay", () => {
    let s = start(["item.maintenance-kit"]).expedition!, id = s.run.supplies[0].instanceId;
    expect(() => useDemoItem(c, s, id, {kind: "member", id: "kael", faceId: "face.kael.01"})).toThrow();
    s.run.party[1].temporaryRust = ["face.eustice.01"];
    s = useDemoItem(c, s, id, {kind: "member", id: "eustice", faceId: "face.eustice.01"}).state;
    expect(s.run.party[1].temporaryRust).toEqual([]);
  });
  it("divination is persisted without drawing any RNG or charging twice", () => {
    let s = win(start(["item.divination-slip"]).expedition!), id = s.run.supplies[0].instanceId;
    const rng = structuredClone(s.run.rng), eventRng = structuredClone(s.run.eventRng);
    s = useDemoItem(c, s, id, {kind: "information", scope: "next-layer"}).state;
    expect(s.run.revealed).toEqual(["layer:2"]); expect(s.run.rng).toEqual(rng); expect(s.run.eventRng).toEqual(eventRng);
    expect(() => useDemoItem(c, s, id, {kind: "information", scope: "next-layer"})).toThrow();
  });
});
