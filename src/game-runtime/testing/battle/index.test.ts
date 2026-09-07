import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createBattleEngine, type BattleState } from "../../../game-core/battle";
import { validateCatalog, sha256, canonicalJson } from "../../../game-core/contracts";
import { LEGACY_CATALOG } from "../../../content/gameplay/legacy-v1/catalog";
import * as legacy from "../../legacy-battle";
import frozen from "../../../game-core/battle/testing/fixtures/s1-extraction.json";

const catalog = validateCatalog(LEGACY_CATALOG);
const makeEngine = () => createBattleEngine(catalog, catalog.data.defaultRouteId);
const start = () => makeEngine().create({ seed: 19, partyIds: [...catalog.data.defaultParty] });

describe("Explicit Catalog engine", () => {
  it("runs with no browser and matches portable SHA-256 against platform crypto", () => {
    expect(typeof window).toBe("undefined");
    for (const text of ["", "abc", "勇者与魔王🎲", canonicalJson(LEGACY_CATALOG), "a".repeat(1000)]) {
      expect(sha256(text)).toBe(createHash("sha256").update(text).digest("hex"));
    }
  });
  it("owns initial RNG metadata and rejects pre-terminal completion", () => {
    const engine = makeEngine(), state = start();
    expect(state.rng).toEqual(legacy.createExpeditionFromSeed(19).rng);
    expect(engine.dispatch(state, { type: "roll-dice" }).state.dice.map(d => d.faceIndex)).toEqual([2,4,5,1,3]);
    expect(() => engine.complete(state)).toThrow("not finished");
    expect(engine.dispatch(state, { type: "next-round" }).state).toBe(state);
  });
  it("injects reordered smaller formations, a sixth candidate, and another encounter without global leakage", () => {
    const alternative = structuredClone(LEGACY_CATALOG);
    alternative.catalogId = "audit.alternative";
    alternative.characters.sixth = { ...structuredClone(alternative.characters.eustice), id: "sixth" };
    alternative.characters.sixth.faces = alternative.characters.sixth.faces.map(face => ({ ...face, power: 9 }));
    alternative.encounters["legacy.encounter.1"].slots = [["legacy.enemy.5.0.0"]];
    const other = createBattleEngine(validateCatalog(alternative), alternative.defaultRouteId);
    const engine = makeEngine(), old = start();
    let state = other.create({ seed: 19, partyIds: ["sixth", "kael"] });
    expect(state.party.map(p => p.id)).toEqual(["sixth", "kael"]);
    expect(state.dice.map(d => d.ownerId)).toEqual(["sixth", "kael"]);
    expect(state.enemies).toHaveLength(1);
    state = other.dispatch(state, { type: "roll-dice" }).state;
    expect(other.select(state).faces.sixth?.power).toBe(9);
    expect(other.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(engine.dispatch(old, { type: "roll-dice" }).state.dice.map(d => d.faceIndex)).toEqual([2,4,5,1,3]);
    expect(() => engine.restore(state)).toThrow("Unknown ID: sixth");
    expect(Object.isFrozen(catalog.data.characters.kael.faces)).toBe(true);
  });
  it("runs the actual rules to terminal through repeated serialization and restoration", () => {
    const engine = makeEngine(); let state = start();
    for (let i=0;i<100 && state.mode.type!=="finished";i++) {
      const type = ({"awaiting-roll":"roll-dice","player-turn":"end-turn","enemy-turn":"next-round","greed":"leave-expedition"} as const)[state.mode.type];
      const transition = engine.dispatch(state, {type});
      expect(transition.error).toBeNull(); state = engine.restore(JSON.parse(JSON.stringify(transition.state)));
    }
    expect(state.mode.type).toBe("finished"); expect(engine.complete(state).result).not.toBeNull();
  });
  it.each(["bad-command", "grantGold"])("rejects unknown command %s", type => {
    expect(() => makeEngine().dispatch(start(), {type})).toThrow("$command.type");
  });
  it.each([
    ["string gold", (s: BattleState) => { (s as unknown as Record<string,unknown>).gold = "999"; }],
    ["unknown member", (s: BattleState) => { s.party[0].id = "missing"; }],
    ["unknown enemy", (s: BattleState) => { s.enemies[0].definitionId = "missing"; }],
    ["bad RNG", (s: BattleState) => { s.rng.combat.seed = -1; }],
    ["unknown field", (s: BattleState) => { Object.assign(s, {grantGold: 99}); }],
    ["bad checkpoint", (s: BattleState) => { s.undoStack = [{action:"bad", state:{}}] as typeof s.undoStack; }],
    ["pending effect", (s: BattleState) => { s.pendingEffects = [{id:"a",definitionId:"missing",payload:{},causeId:null,depth:0}]; }]
  ] as const)("rejects %s at the load boundary", (_name, mutate) => {
    const state = makeEngine().dispatch(start(), {type:"roll-dice"}).state; mutate(state);
    expect(() => makeEngine().restore(state)).toThrow();
  });
  it("rejects unknown definitions even when the item has no remaining charges", () => {
    const state = start();
    const item = {kind:"item" as const, instanceId:"i", definitionId:"missing", sourceId:"campaign", ownerId:null, tags:[], data:{}, charges:0,maxCharges:1};
    state.loadout.items.push(item); state.loadoutAtStart.items.push(item);
    expect(() => makeEngine().restore(state)).toThrow("Unknown ID");
  });
  it("validates catalog identity, all references and code-free handler capability", () => {
    expect(() => validateCatalog(LEGACY_CATALOG, {...catalog.ref,digest:"wrong"})).toThrow("identity");
    const invalid = structuredClone(LEGACY_CATALOG); invalid.rulesVersion = 2 as 1;
    expect(() => validateCatalog(invalid)).toThrow("Unsupported rules");
    invalid.rulesVersion = 1; invalid.characters.kael.faces = [];
    expect(() => validateCatalog(invalid)).toThrow("six faces");
    const handler = structuredClone(LEGACY_CATALOG);
    handler.effects[handler.frenzyActiveId].reactions = [{priority:0,eventTypes:["damage-applied"],data:{}}];
    expect(() => validateCatalog(handler)).toThrow("handler");
    expect(() => validateCatalog({...LEGACY_CATALOG, run:()=>{}})).toThrow("JSON");
  });
  it("imports supported historical schemas and interrupted turns without rewriting the old fixture", () => {
    const engine = makeEngine();
    for (const entry of frozen.migrations) expect(engine.importLegacy(JSON.stringify(entry.input)).party).toHaveLength(5);
    const state = engine.importLegacy(frozen.interruptedSave);
    expect(state.mode.type).toBe("enemy-turn");
    expect(engine.restore(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });
});
