import { describe, it, expect } from "vitest";
import { D5_CATALOG_DATA } from "../../content/gameplay/demo-v2/foundation";
import { FULL_MANOR_CATALOG_DATA } from "../../content/gameplay/demo-v1/manor-full";
import { validateD5Catalog } from "../contracts/d5-validation";
import { validateManorCatalog } from "../contracts/demo-validation";
import { resolveDemoCharacter } from "../battle/rules/v2/configuration";
import { projectD5Progress } from "./d5-progress";
import { validateD5Snapshot } from "./d5-snapshot";
import { d5Catalog, d5Scenario } from "./testing/d5-fixtures";

describe("D5-B isolated content and progression evidence", () => {
  it("assembles a distinct immutable v4 package without changing the published v3 digest", () => {
    const before = validateManorCatalog(FULL_MANOR_CATALOG_DATA).ref;
    expect(d5Catalog.ref).toMatchObject({ catalogId: "abyssa.demo", contentVersion: 2, rulesVersion: 4 });
    expect(Object.keys(d5Catalog.data.progression.growthEvents)).toHaveLength(10);
    expect(Object.isFrozen(d5Catalog.data.progression.chapter.progress)).toBe(true);
    expect(validateManorCatalog(FULL_MANOR_CATALOG_DATA).ref).toEqual(before);
    expect(() => validateManorCatalog(D5_CATALOG_DATA)).toThrow();
    expect(() => validateD5Catalog(FULL_MANOR_CATALOG_DATA)).toThrow();
  });
  it.each(["party", "initial-party", "growth", "growth-definition", "gift", "extra", "seeded-profile", "template", "digest"])("rejects malformed content: %s", field => {
    const c = structuredClone(D5_CATALOG_DATA);
    if (field === "party") c.progression.chapter.partyIds[1] = "marietta";
    if (field === "initial-party") c.initialParty.pop();
    if (field === "growth") delete c.progression.growthEvents["event.growth.elora.lv3"];
    if (field === "growth-definition") {
      delete c.growth["growth.elora.lv3"];
      delete c.progression.growthEvents["event.growth.elora.lv3"];
    }
    if (field === "gift") c.progression.gift.definitionIds.push("equipment.third");
    if (field === "extra") Object.assign(c, { stray: true });
    if (field === "seeded-profile") c.profiles[c.journey!.defaultProfileId].progress.appliedGrowthIds.push("growth.elora.lv2");
    if (field === "template") c.progression.chapter.progress.appliedGrowthIds.push("growth.elora.lv3");
    expect(() => validateD5Catalog(c, field === "digest" ? { ...d5Catalog.ref, digest: "0".repeat(64) } : undefined)).toThrow();
  });
  it("requires personal participation, a new post-Lv2 departure and takeover for Lv3", () => {
    const s = d5Scenario(); s.depart("early"); const early = s.settle();
    s.claim("event.growth.eustice.lv2", early.id);
    const before = structuredClone(s.entries);
    s.claim("event.growth.eustice.lv3", early.id);
    expect(s.state).toThrow(/Level 3/);
    s.entries.splice(0, s.entries.length, ...before);
    s.depart("clear"); const clear = s.settle("cleared");
    s.claim("event.growth.eustice.lv3", clear.id);
    expect(resolveDemoCharacter(d5Catalog.data, s.state().progress, "eustice").level).toBe(3);
  });
  it("does not count nonparticipants or wipes and refuses simulation evidence", () => {
    const s = d5Scenario(); s.depart("three", ["kael", "elora", "norma"]); const t = s.settle();
    s.claim("event.growth.kororo.lv2", t.id); expect(s.state).toThrow(/participate/);
    const w = d5Scenario(); w.depart("wipe"); const wt = w.settle("wipe");
    w.claim("event.growth.elora.lv2", wt.id); expect(w.state).toThrow(/qualifying/);
    const bad = structuredClone(s.entries.slice(0, 2)); Object.assign(bad[1], { origin: "simulation" });
    expect(() => projectD5Progress(d5Catalog, bad)).toThrow();
  });
  it("requires an authoritative final story cursor and rejects duplicate grants", () => {
    const s = d5Scenario(); s.depart("early"); const t = s.settle();
    s.add({ type: "story-started", sessionId: "scene", eventId: "event.growth.elora.lv2", basisId: t.id });
    s.add({ type: "story-completed", sessionId: "scene" }); expect(s.state).toThrow(/not been reached/);
    s.entries.pop(); s.add({ type: "story-advanced", sessionId: "scene", step: 0, choice: "skip" });
    s.add({ type: "story-completed", sessionId: "scene" }); expect(s.state().progress.appliedGrowthIds).toEqual(["growth.elora.lv2"]);
    s.claim("event.growth.elora.lv2", t.id); expect(s.state).toThrow(/completed/);
  });
  it("preserves deferred reading positions while another event completes", () => {
    const s = d5Scenario(); s.depart("early"); const t = s.settle();
    s.add({ type: "story-started", sessionId: "one", eventId: "event.growth.elora.lv2", basisId: t.id });
    s.add({ type: "story-advanced", sessionId: "one", step: 0, choice: "continue" });
    s.add({ type: "story-advanced", sessionId: "one", step: 1, choice: "later" });
    s.claim("event.growth.eustice.lv2", t.id);
    s.add({ type: "story-started", sessionId: "one", eventId: "event.growth.elora.lv2", basisId: t.id });
    expect(s.state().stories[0]).toMatchObject({ id: "one", step: 1, deferred: false });
  });
  it("creates only two owned equipment instances and returns reservations with unchanged identities", () => {
    const s = d5Scenario(); s.depart("early"); const t = s.settle();
    const grant = s.claim("event.demo.preparation-gift", t.id), inventory = s.state().inventory;
    expect(inventory).toHaveLength(2); expect(inventory.every(i => i.grantId === grant.id)).toBe(true);
    const item = inventory[0];
    s.add({ type: "equipment-moved", instanceId: item.instanceId, fromOwnerId: null, toOwnerId: "kororo" });
    const config = resolveDemoCharacter(d5Catalog.data, s.state().progress, "kororo");
    expect(config.faces.slice(0, 3).every(f => f.actionId === "action.attack" && f.fate === "asleep")).toBe(true);
    s.depart("again"); expect(s.state().inventory[0].location).toEqual({ kind: "reserved", ownerId: "kororo", runId: "again" });
    const before = structuredClone(s.entries);
    s.add({ type: "equipment-moved", instanceId: item.instanceId, fromOwnerId: "kororo", toOwnerId: "norma" }); expect(s.state).toThrow(/mansion/);
    s.entries.splice(0, s.entries.length, ...before); s.settle();
    expect(s.state().inventory[0]).toEqual({ ...item, location: { kind: "equipped", ownerId: "kororo" } });
    s.add({ type: "equipment-moved", instanceId: item.instanceId, fromOwnerId: "kororo", toOwnerId: "norma" });
    expect(s.state().progress.equipment[0].ownerId).toBe("norma");
  });
  it.each(["kael", "marietta", "occupied", "foreign-owner", "unknown-item"])("rejects illegal equipment target/allocation: %s", test => {
    const s = d5Scenario(); s.depart("early"); const t = s.settle(); s.claim("event.demo.preparation-gift", t.id);
    const items = s.state().inventory;
    if (test === "occupied") s.add({ type: "equipment-moved", instanceId: items[1].instanceId, fromOwnerId: null, toOwnerId: "elora" });
    s.add({ type: "equipment-moved", instanceId: test === "unknown-item" ? "foreign" : items[0].instanceId, fromOwnerId: test === "foreign-owner" ? "eustice" : null, toOwnerId: test === "kael" || test === "marietta" ? test : "elora" });
    expect(s.state).toThrow();
  });
  it("does not open memory on a third-layer return and cannot jump straight into its ending", () => {
    const s = d5Scenario(); s.depart("early"); s.settle(); s.enterMemory(); expect(s.state).toThrow(/First clear/);
    const c = d5Scenario(); c.firstClear(); c.enterMemory(); c.entries.splice(-3);
    c.add({ type: "memory-advanced", runRef: { kind: "memory", id: "memory-one", attempt: 1 }, node: "return-pending" });
    expect(c.state).toThrow(/skip a battle/);
  });
  it("isolates memory failure/retry and rejects missing combat validators or stale attempts", () => {
    const s = d5Scenario(); s.firstClear(); const world = s.state(); s.enterMemory(); s.memoryEnd(false);
    expect(s.state()).toMatchObject({ clock: world.clock, funds: world.funds, settlements: world.settlements, chapterCompletion: null });
    expect(() => projectD5Progress(d5Catalog, s.entries)).toThrow(/reader is not installed/);
    s.add({ type: "memory-retried", runId: "memory-one", previousAttempt: 1 });
    expect(s.state().memory).toMatchObject({ seed: 41, attempt: 2, node: "teaching" });
    s.add({ type: "memory-advanced", runRef: { kind: "memory", id: "memory-one", attempt: 1 }, node: "battle" }); expect(s.state).toThrow(/Stale/);
  });
  it("requires memory completion and final return confirmation before opening Marietta", () => {
    const s = d5Scenario(); s.firstClear(); const world = s.state(); s.enterMemory(); const complete = s.memoryEnd();
    expect(s.state().availableCharacterIds).not.toContain("marietta");
    s.add({ type: "memory-advanced", runRef: { kind: "memory", id: "memory-one", attempt: 1 }, node: "return-pending" });
    s.claim(d5Catalog.data.progression.chapter.storyId, complete.id);
    expect(s.state()).toMatchObject({ clock: world.clock, funds: world.funds, activeRunRef: null });
    expect(s.state().availableCharacterIds).toContain("marietta");
    expect(s.state().inventory).toHaveLength(0);
  });
  it("makes all ten growth events reachable and derives the team milestone just once", () => {
    const s = d5Scenario(); s.depart("early"); const early = s.settle();
    for (const id of ["eustice", "elora", "kororo", "norma"]) s.claim(`event.growth.${id}.lv2`, early.id);
    const clear = s.firstClear();
    for (const id of ["eustice", "elora", "kororo", "norma"]) s.claim(`event.growth.${id}.lv3`, clear.id);
    const milestone = s.state().teamMilestone;
    s.unlock();
    const party = ["kael", "eustice", "elora", "norma", "marietta"];
    s.depart("maintenance-one", party); const one = s.settle(); s.claim("event.growth.marietta.lv2", one.id);
    s.depart("maintenance-two", party); const two = s.settle(); s.claim("event.growth.marietta.lv3", two.id);
    expect(s.state().growthGrants).toHaveLength(10); expect(s.state().teamMilestone).toEqual(milestone);
    const kael = resolveDemoCharacter(d5Catalog.data, s.state().progress, "kael");
    expect(kael.faces[3]).toMatchObject({ quality: "gild", power: 2 }); expect(kael.faces[0].quality).toBe("rust");
  });
  it("rejects duplicated/foreign proof identities and snapshot-only grants", () => {
    const s = d5Scenario(); s.depart("early"); s.settle();
    const duplicate = [...s.entries, s.entries[0]];
    expect(() => projectD5Progress(d5Catalog, duplicate, s.readers)).toThrow(/Duplicate/);
    const campaign = structuredClone(s.state()); campaign.progress.appliedGrowthIds.push("growth.elora.lv2");
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign, run: null }, s.readers)).toThrow(/differs/);
  });
  it("enforces the single run discriminant and does not accept battle payloads without C", () => {
    const s = d5Scenario(); s.depart("early"); const campaign = s.state();
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign, run: null })).toThrow();
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign, run: { kind: "memory", id: "early", attempt: 1, battle: null } })).toThrow();
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign, run: { kind: "expedition", id: "early", state: {} } })).toThrow(/reader is not installed/);
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign, run: null, memory: {} })).toThrow(/Unknown field/);
  });
  it("requires the validated terminal body, not just a plausible settlement summary", () => {
    const s = d5Scenario(); s.depart("return"); s.settle();
    const original = structuredClone(s.entries);
    const last = s.entries.at(-1)!.event;
    if (last.type !== "expedition-settled") throw Error("fixture");
    last.finalRun.run.party[0].hp = 0;
    expect(s.state).toThrow(/sealed expedition terminal/);
    expect(() => projectD5Progress(d5Catalog, original)).toThrow(/reader is not installed/);
  });
  it("does not let leaving memory reseed the checkpoint or mutate present assets", () => {
    const s = d5Scenario(); s.firstClear(); const before = s.state(); const ref = s.enterMemory();
    s.add({ type: "memory-left", runRef: ref });
    expect(s.state()).toMatchObject({ funds: before.funds, clock: before.clock, activeRunRef: null });
    const saved = structuredClone(s.entries);
    s.add({ type: "memory-started", runId: "fresh-seed", chapterId: d5Catalog.data.progression.chapter.id, templateId: d5Catalog.data.progression.chapter.templateId, seed: 100 });
    expect(s.state).toThrow(/reseeding/);
    s.entries.splice(0, s.entries.length, ...saved); s.add({ type: "memory-retried", runId: ref.id, previousAttempt: 1 });
    expect(s.state().memory).toMatchObject({ seed: 41, attempt: 2 });
  });
  it("binds a validated historical battle to the recorded seed", () => {
    const s = d5Scenario(); s.firstClear(); s.enterMemory(); s.memoryEnd();
    const start = s.entries.find(e => e.event.type === "memory-started")!;
    if (start.event.type !== "memory-started") throw Error("fixture");
    // The terminal is still an exact valid fixture, but belongs to a different seed.
    start.event.seed++;
    expect(s.state).toThrow(/historical checkpoint/);
  });
  it("rejects a terminal snapshot whose completion evidence was never committed", () => {
    const s = d5Scenario(); s.firstClear(); const ref = s.enterMemory(); const ended = s.memoryEnd();
    if (ended.event.type !== "memory-ended") throw Error("fixture");
    const battle = ended.event.terminal.finalBattle;
    s.entries.pop();
    expect(() => validateD5Snapshot(d5Catalog, s.entries, { campaign: s.state(), run: { ...ref, battle } }, s.readers)).toThrow(/completion evidence/);
  });
});
