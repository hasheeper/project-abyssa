import { describe, expect, it } from "vitest";
import { FULL_MANOR_CATALOG_DATA } from "../../../../content/gameplay/demo-v1/manor-full";
import { MANOR_CATALOG_DATA } from "../../../../content/gameplay/demo-v1/manor";
import { validateDemoCatalog, validateManorCatalog } from "../../../contracts";
import { createDemoBattleEngine } from "../../demo-engine";
import { createDemoCampaign, startDemoExpedition } from "../../../session";
import { demoIntentPower, manorGuestCount, releaseManorGuests, summonManorGuest } from "./manor";
import { damageEnemy, damageMember, finishEncounter } from "../v2/combat";

const catalog = validateManorCatalog(FULL_MANOR_CATALOG_DATA), engine = createDemoBattleEngine(catalog);
function bossBattle(partyIds = catalog.data.initialParty, content = catalog) {
  const engine = createDemoBattleEngine(content);
  const state = engine.create({runId: "boss-run", routeId: content.data.manor!.firstClearRouteId, seed: 7, partyIds, progress: {appliedGrowthIds: [], equipment: []}});
  state.run.layer = 5; state.run.room = 0; state.run.encounterSequence = 5;
  state.run.completedRoomIds = state.run.roomIds.flat().slice(0, -1);
  state.run.completedEncounterIds = [1,2,3,4].map(i => `${state.run.id}:encounter:${i}`);
  return engine.startEncounter(state.run).state;
}
const boss = (state: ReturnType<typeof bossBattle>) => state.encounter.enemies[1];
function rolled() {return engine.dispatch(bossBattle(), {type: "roll"}).state;}
function attacker(state: ReturnType<typeof rolled>, targetId: string) {
  const die = state.encounter.dice.find(d => d.ownerId === "kororo")!;
  die.faceIndex = 3; die.loaded = true;
  return engine.dispatch(state, {type: "act", actorId: "kororo", choice: "attack", targetId});
}
describe("full manor rules", () => {
  it("keeps the published segment version separate and rejects capability smuggling", () => {
    expect(validateDemoCatalog(MANOR_CATALOG_DATA).ref.rulesVersion).toBe(2);
    expect(() => validateDemoCatalog(FULL_MANOR_CATALOG_DATA)).toThrow();
    expect(() => validateManorCatalog({...FULL_MANOR_CATALOG_DATA, rulesVersion: 2})).toThrow();
    expect(() => validateDemoCatalog({...MANOR_CATALOG_DATA, manor: catalog.data.manor})).toThrow();
  });
  it("updates live toast after killing a guest without removing guard, and undo restores both", () => {
    const state = rolled(); boss(state).intent!.blocked = 2;
    expect(demoIntentPower(state, boss(state))).toBe(4);
    const result = attacker(state, state.encounter.enemies[0].id);
    expect(manorGuestCount(result.state)).toBe(1);
    expect(engine.select(result.state).enemies.find(e => e.id === boss(state).id)?.damage).toBe(1);
    expect(boss(result.state).intent!.blocked).toBe(2);
    expect(result.events.some(e => e.type === "banquet-seats-changed")).toBe(true);
    const undone = engine.dispatch(result.state, {type: "undo"}).state;
    expect(demoIntentPower(undone, boss(undone))).toBe(4);
    expect(boss(undone).intent!.blocked).toBe(2);
  });
  it("resolves a toast using the same live amount", () => {
    let state = rolled();
    boss(state).intent!.targetId = state.run.party[0].id;
    boss(state).intent!.blocked = 2;
    state = attacker(state, state.encounter.enemies[0].id).state;
    state = engine.dispatch(state, {type: "end-turn"}).state;
    const target = state.run.party[0], hp = target.hp;
    const result = engine.dispatch(state, {type: "resolve-next-enemy"});
    expect(result.state.run.party[0].hp).toBe(Math.max(0, hp - 1));
  });
  it("does not retarget a toast after its locked target falls", () => {
    let state=rolled();
    const target=state.run.party[0].id;
    boss(state).intent!.targetId=target;
    damageMember(catalog.data,{state,events:[]},target,99,state.encounter.enemies[0].id);
    state=engine.dispatch(state,{type:"end-turn"}).state;
    state=engine.dispatch(state,{type:"resolve-next-enemy"}).state;
    const before=state.run.party.map(p=>p.hp);
    const result=engine.dispatch(state,{type:"resolve-next-enemy"});
    expect(result.state.run.party.map(p=>p.hp)).toEqual(before);
    expect(result.events.some(e=>e.type==="damage-applied")).toBe(false);
  });
  it("keeps a bound heiress on the same action cursor", () => {
    let state=rolled();
    boss(state).boundRound=state.encounter.round;
    boss(state).escaped=true;boss(state).threaded=true;
    state=engine.dispatch(state,{type:"end-turn"}).state;
    while(state.encounter.cursor<state.encounter.enemyOrder.length) state=engine.dispatch(state,{type:"resolve-next-enemy"}).state;
    state=engine.dispatch(state,{type:"next-round"}).state;
    expect(boss(state).chargeReady).toBe(false);
    expect(boss(state).intent!.kind).toBe("attack");
  });
  it("does not consume full seats and exhausts exactly six zero-bounty summons", () => {
    const state=rolled(), ctx={state,events:[] as import("../../domain/demo-state").DemoEvent[]};
    summonManorGuest(catalog.data,ctx,boss(state));
    summonManorGuest(catalog.data,ctx,boss(state));
    expect(state.encounter.manor!.summoned).toBe(1);
    for(let serial=1;serial<=6;serial++) {
      damageEnemy(catalog.data,ctx,state.encounter.enemies.at(-1)!.id,99,"kael");
      summonManorGuest(catalog.data,ctx,boss(state));
    }
    expect(state.encounter.manor!.summoned).toBe(6);
    expect(state.encounter.enemies).toHaveLength(9);
    expect(state.run.looseGold).toBe(0);
    expect(ctx.events.filter(e=>e.type==="enemy-summoned")).toHaveLength(6);
    expect(engine.restore(state)).toEqual(state);
  });
  it("summons on the right, waits until next round, and uses a bounded zero-bounty reserve", () => {
    let state = bossBattle();
    boss(state).chargeReady = true;
    // Start the second round with the persisted boss cursor.
    state = engine.dispatch(state, {type: "roll"}).state;
    state = engine.dispatch(state, {type: "end-turn"}).state;
    while (state.encounter.phase === "enemy" && state.encounter.cursor < state.encounter.enemyOrder.length) state = engine.dispatch(state, {type: "resolve-next-enemy"}).state;
    state = engine.dispatch(state, {type: "next-round"}).state;
    expect(boss(state).intent!.kind).toBe("summon");
    state = engine.dispatch(state, {type: "roll"}).state;
    state = engine.dispatch(state, {type: "end-turn"}).state;
    while (state.encounter.cursor < 2) state = engine.dispatch(state, {type: "resolve-next-enemy"}).state;
    const guest = state.encounter.enemies.at(-1)!;
    expect(guest.origin?.kind).toBe("summoned");
    expect(guest.intent).toBeNull();
    expect(state.encounter.formation.at(-1)).toBe(guest.id);
    expect(state.encounter.enemyOrder).not.toContain(guest.id);
    expect(state.encounter.manor!.summoned).toBe(1);
    expect(engine.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
    const forged = structuredClone(state); forged.encounter.enemies.at(-1)!.origin!.serial = 8;
    expect(() => engine.restore(forged)).toThrow();
  });
  it("releases the remaining guests without killing them and closes only once", () => {
    const state = rolled(); boss(state).hp = 4;
    const result = attacker(state, boss(state).id);
    expect(result.state.encounter.formation).toEqual([]);
    expect(result.state.encounter.enemies[0].hp).toBe(3);
    expect(result.state.encounter.enemies[0].disposition).toBe("released");
    expect(result.state.run.looseGold).toBe(18);
    expect(result.events.filter(e => e.type === "enemy-defeated")).toHaveLength(0);
    expect(engine.select(result.state).canUndo).toBe(false);
    const closed = engine.dispatch(result.state, {type: "end-turn"});
    expect(closed.state.encounter.outcome).toBe("victory");
    expect(closed.events.filter(e => e.type === "hand-settled")).toHaveLength(1);
    expect(() => engine.dispatch(closed.state, {type: "end-turn"})).toThrow();
  });
  it("finishes a cleave's locked secondary hit before releasing the boss", () => {
    // Rule-only Marietta fixture; this does not unlock her in a player campaign.
    const data = structuredClone(FULL_MANOR_CATALOG_DATA);
    data.catalogId = "abyssa.fixture.manor-cleave";
    delete data.characters.marietta.release;
    const fixture = validateManorCatalog(data), engine = createDemoBattleEngine(fixture);
    const state = engine.dispatch(bossBattle(["kael", "eustice", "marietta", "kororo", "norma"], fixture), {type: "roll"}).state;
    const [left, heiress, right] = state.encounter.enemies;
    damageEnemy(fixture.data, {state, events: []}, left.id, 99, "kael");
    heiress.hp = 2; right.hp = 1;
    const die = state.encounter.dice.find(d => d.ownerId === "marietta")!;
    die.faceIndex = 0; die.loaded = true;
    const result = engine.dispatch(state, {type: "act", actorId: "marietta", choice: "attack", targetId: heiress.id});
    expect(result.state.encounter.enemies[2]).toMatchObject({hp: 0, disposition: "defeated"});
    expect(result.state.run.looseGold).toBe(24);
    const damage = result.events.filter(e => e.type === "damage-applied");
    expect(damage.map(e => (e.payload as {targetId: string}).targetId)).toEqual([heiress.id, right.id]);
    expect(result.events.findIndex(e => e.type === "enemy-released")).toBeGreaterThan(result.events.indexOf(damage[1]));
    expect(engine.dispatch(result.state, {type: "end-turn"}).state.encounter.outcome).toBe("victory");
  });
  it("lets a covenant rescue the heiress and still finishes the later healing covenant once", () => {
    const state = rolled(); boss(state).hp = 2; state.run.party[0].hp = 1;
    const faces: Record<string, number> = {kael: 0, eustice: 2, elora: 0, kororo: 3, norma: 0};
    state.encounter.dice.forEach(d => {d.faceIndex = faces[d.ownerId]; d.loaded = true;});
    const result = engine.dispatch(state, {type: "end-turn"});
    expect(result.state.encounter.outcome).toBe("victory");
    expect(result.state.encounter.manor!.released).toBe(true);
    expect(result.state.run.party[0].hp).toBe(2);
    expect(result.events.filter(e => e.type === "hand-settled")).toHaveLength(1);
    expect(result.events.filter(e => e.type === "covenant-triggered").map(e => e.actorId)).toEqual(["eustice", "elora"]);
    expect(result.state.run.looseGold).toBe(18);
    expect(() => engine.dispatch(result.state, {type: "resolve-next-enemy"})).toThrow();
  });
  it("gives a mutual-wipe batch precedence over rescue and its bounty", () => {
    const ctx = {state: rolled(), events: [] as import("../../domain/demo-state").DemoEvent[]};
    const heiress = boss(ctx.state);
    damageEnemy(catalog.data, ctx, heiress.id, 99, "kael");
    ctx.state.run.party.forEach(p => damageMember(catalog.data, ctx, p.id, 99, heiress.id));
    releaseManorGuests(catalog.data, ctx); finishEncounter(ctx);
    expect(engine.restore(ctx.state).encounter.outcome).toBe("wipe");
    expect(ctx.state.encounter.manor!.released).toBe(false);
    expect(ctx.state.run.looseGold).toBe(0);
    expect(ctx.events.some(e => e.type === "enemy-released")).toBe(false);
  });
  it("rejects an unearned maintenance route and validates the fresh campaign", () => {
    const snapshot = createDemoCampaign(catalog, "profile.demo.first-run");
    expect(() => startDemoExpedition(catalog, "profile.demo.first-run", snapshot, {runId: "bad", routeId: "old-manor.maintenance", seed: 7, partyIds: catalog.data.initialParty})).toThrow();
  });
});
