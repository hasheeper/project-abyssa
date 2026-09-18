import { expect, it } from "vitest";
import { AIRP_POOL_CONTENT } from "../../content/gameplay/airp-v2/content";
import { AIRP_POOL_CATALOG_DATA } from "../../content/gameplay/demo-v9/content";
import { validateD5Catalog, parseAirpCommand, parseAirpPoolCommand } from "../contracts";
import { airpActorLocation, airpPoolActive, airpPoolLocked, checkAirpPoolCapacity, emptyAirpPool, expireAirpPool, poolCooldown, scheduleAirpPool } from "./airp-pool";

const content = AIRP_POOL_CONTENT;
function tick(state = emptyAirpPool(), phase = 0, suffix = "", eligible = true) {
  const head = { saveId: "simulation", epoch: "simulation-epoch", revision: phase }, factId = `boundary:${phase}${suffix}`;
  expireAirpPool(content, state, phase, head, factId);
  scheduleAirpPool(content, state, { phase, phaseName: (["dawn", "day", "dusk", "night"] as const)[phase % 4], head, factId, eligible, availableActorIds: ["elora", "eustice", "norma", "kororo"], setback: false });
  return state;
}
it("registers eight strict cards in four forms and rejects malformed content", () => {
  expect(validateD5Catalog(AIRP_POOL_CATALOG_DATA).ref.contentVersion).toBe(9);
  expect(content.cards).toHaveLength(8);
  for (const mutation of ["actor", "field", "target", "scene"]) {
    const raw = structuredClone(AIRP_POOL_CATALOG_DATA), c = raw.airp!;
    if (c.version !== 2) throw Error();
    if (mutation === "actor") c.cards[0].actorIds = ["missing"];
    if (mutation === "field") Object.assign(c.cards[0], { rewardGold: 999 });
    if (mutation === "target" && c.cards[0].objective.form === "sortie") c.cards[0].objective.spec.objective.layer = 99;
    if (mutation === "scene") c.scripts[c.cards[0].scenes.offer!].player.authoredSpeech = true as false;
    expect(() => validateD5Catalog(raw)).toThrow();
  }
});
it("keeps the v1 command grammar closed", () => {
  const visit = { type: "airp-visit", instanceId: "ripple:x", actorId: "eustice", locationId: "mansion.common-room" };
  expect(() => parseAirpCommand(visit)).toThrow(); expect(parseAirpPoolCommand(visit)).toEqual(visit);
  expect(() => parseAirpPoolCommand({ ...visit, completed: true })).toThrow();
});
it("enforces reachability, phase, unlocked participants and home occupancy", () => {
  const c = structuredClone(content); c.availability.eustice.night = null;
  expect(airpActorLocation(c, "eustice", "night", ["eustice"], true)).toBeNull();
  expect(airpActorLocation(c, "eustice", "day", [], true)).toBeNull();
  expect(airpActorLocation(c, "eustice", "day", ["eustice"], false)).toBeNull();
  expect(airpActorLocation(c, "eustice", "day", ["eustice"], true)).toBe("mansion.common-room");
});
it("schedules once per boundary, with four forms and a daily quota", () => {
  const s = tick(), before = structuredClone(s); tick(s);
  expect(s).toEqual(before); expect(s.instances).toHaveLength(4);
  expect(new Set(s.instances.map(i => content.cards.find(d => d.id === i.definition.id)!.objective.form)).size).toBe(4);
  for (const i of s.instances) { i.status = "closed"; i.reason = "declined"; }
  tick(s, 0, "another"); expect(s.instances).toHaveLength(4);
  expect(tick(emptyAirpPool(), 0, "", false).instances).toHaveLength(0);
});
it("never expires an accepted task and preserves seen versus unseen inert endings", () => {
  const s = tick(); s.instances[0].status = "accepted";
  const seen = s.instances.find(i => i.definition.id === "ripple.elora.fold-cloths")!; seen.status = "offered"; seen.exposedPhase = 0;
  tick(s, 8, "", false);
  expect(s.instances[0].status).toBe("accepted"); expect(seen.reason).toBe("expired-seen");
  expect(s.reserve).toHaveLength(1); expect(s.reserve[0].definition.id).toBe("ripple.kororo.quiet-cup");
  expect(s.cooldowns.some(c => c.themeKey === "house.fold-clean-cloths")).toBe(true);
});
it("creates one public aftermath per missed instance and never a hard penalty", () => {
  const s = tick(); tick(s, 4); tick(s, 4, "another");
  const missed = s.instances.find(i => i.reason === "missed")!;
  expect(s.memories.filter(m => m.axis === "agenda")).toHaveLength(1);
  expect(s.memories[0].knowledge).toEqual({ kind: "public" });
  expect(missed.receiptId).toBeNull(); expect(s.cooldowns[0].untilPhase).toBe(260);
});
it("both consequential definitions produce independent public aftermaths", () => {
  const s = tick(), cloth = s.instances.find(i => i.definition.id === "ripple.elora.fold-cloths")!;
  cloth.status = "closed"; cloth.reason = "declined";
  poolCooldown(s, content.cards.find(d => d.id === cloth.definition.id)!, 0, "decline");
  tick(s, 4); tick(s, 8); tick(s, 8, "recheck");
  expect(s.instances.filter(i => i.reason === "missed").map(i => i.definition.id).sort()).toEqual(["ripple.elora.watch-note", "ripple.norma.drying-cord"]);
  expect(new Set(s.memories.filter(m => m.axis === "agenda").map(m => m.id)).size).toBe(2);
});
it("reoffers reserve definitions with new identities, no earlier than the next game day", () => {
  const s = tick(); const old = s.instances[0]; tick(s, 8); tick(s, 11);
  expect(s.reserve.some(r => r.sourceInstanceId === old.id)).toBe(true);
  for (let p = 12; p < 40; p++) tick(s, p);
  const next = s.instances.find(i => i.definition.id === old.definition.id && i.id !== old.id)!;
  expect(next.createdPhase).toBeGreaterThanOrEqual(12); expect(next.variant).toBe("reserve"); expect(old.reason).toBe("reserved");
});
it("simulates 64 days plus cooldown release: exhaustion, no early repeats, stable bytes", () => {
  function simulation() {
    const s = emptyAirpPool(); let emptyPhases = 0;
    for (let phase = 0; phase <= 272; phase++) {
      tick(s, phase);
      if (!s.instances.some(airpPoolActive)) emptyPhases++;
      // Scheduler-only synthetic terminal policy, NOT a gameplay completion fixture.
      for (const i of s.instances.filter(airpPoolActive)) {
        const d = content.cards.find(d => d.id === i.definition.id)!;
        i.status = "resolved"; i.resolvedPhase = phase; poolCooldown(s, d, phase, `simulated-terminal:${i.id}`);
      }
      expect(s.daily.offers).toBeLessThanOrEqual(4); checkAirpPoolCapacity(s);
    }
    return { s, emptyPhases };
  }
  const a = simulation(); expect(a).toEqual(simulation()); expect(a.emptyPhases).toBeGreaterThan(200);
  for (const d of content.cards) {
    const instances = a.s.instances.filter(i => i.definition.id === d.id);
    expect(instances.length).toBe(d.repeat === "once" ? 1 : 2);
    if (instances[1]) expect(instances[1].createdPhase - instances[0].resolvedPhase!).toBeGreaterThanOrEqual(256);
  }
});
it("ignoring every card remains bounded through 64 days and retains every old identity", () => {
  const s = emptyAirpPool();
  for (let p = 0; p < 256; p++) { tick(s, p); checkAirpPoolCapacity(s); expect(s.instances.filter(airpPoolActive).length).toBeLessThanOrEqual(4); }
  expect(new Set(s.instances.map(i => i.id)).size).toBe(s.instances.length);
  expect(s.instances.length).toBeLessThan(128); expect(s.scenes).toHaveLength(0);
});
it("capacity stops new offers without deleting terminal history", () => {
  const s = emptyAirpPool(); s.scenes = Array.from({ length: 127 }, () => ({} as never));
  tick(s); expect(s.capacityStopped).toBe(true); expect(s.instances).toHaveLength(0); expect(s.scenes).toHaveLength(127);
});
it("a pending return never locks the stage on an already completed offer", () => {
  const s = tick(), i = s.instances[0]; i.status = "ready";
  s.scenes = [{ id: "old-offer", instanceId: i.id, role: "offer" } as never];
  s.reading = { sceneId: "old-offer", node: 0, choice: "B", completed: true, paused: false };
  expect(airpPoolLocked(s)).toBe(false);
  const before = structuredClone(s); tick(s, 2, "return"); expect(s.lastBoundaryId).toBe(before.lastBoundaryId);
  i.returnSceneId = "return-scene"; s.scenes.push({ id: "return-scene", instanceId: i.id, role: "return-extracted" } as never);
  s.reading.sceneId = "return-scene"; expect(airpPoolLocked(s)).toBe(true);
});
