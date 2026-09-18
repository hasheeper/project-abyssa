import { describe, expect, it } from "vitest";
import type { AirpHead, AirpInstance, AirpKnowledgeEntry, AirpObjectiveFact, AirpPatrolBinding } from "../contracts";
import { AIRP_LIMITS, measureAirpCapacity, parseAirpCommand, parseAirpSortieDefinition } from "../contracts";
import { airpExpiry, airpPhaseIndex, readAirpReturnProof } from "./airp-readers";
import { assembleAirpContext } from "./airp-context";
import { FIRST_AIRP_ERRAND as definition } from "../../content/gameplay/airp-v1/first-errand";
import { MORNING_DEPARTURE_CATALOG_DATA as catalog } from "../../content/gameplay/demo-v6/content";
import { TIDE_CAVE_CATALOG_DATA } from "../../content/gameplay/demo-v7/content";

const head = (revision: number): AirpHead => ({ saveId: "save.1", epoch: "epoch.1", revision });
const binding: AirpPatrolBinding = {
  instanceId: "ripple.1", definition: { id: definition.id, version: 1 }, contentDigest: "content-digest",
  acceptedHead: head(2), acceptedFactId: "accept", departureHead: head(3), departureFactId: "depart",
  runId: "run.1", routeId: definition.objective.routeId,
  roomDefinitionId: definition.objective.roomDefinitionId, roomInstanceId: "run.1.room.3.0", evidenceId: definition.objective.evidenceId,
};
const facts: AirpObjectiveFact[] = [
  { id: "room", source: head(8), phase: 0, origin: "adventure", runId: binding.runId, routeId: binding.routeId,
    kind: "room-completed", roomDefinitionId: binding.roomDefinitionId, roomInstanceId: binding.roomInstanceId },
  { id: "settle", source: head(9), phase: 1, origin: "adventure", runId: binding.runId, routeId: binding.routeId,
    kind: "expedition-settled", terminalId: "terminal.1", outcome: "extracted" },
];
const live = new Set(["accept", "depart", "room", "settle"]);
const proofInput = () => ({ definition, binding: structuredClone(binding), contentDigest: binding.contentDigest, head: head(10), facts: structuredClone(facts), effectiveFactIds: new Set(live) });

describe("AIRP-1 isolated contracts", () => {
  const refs = { actorIds: Object.keys(catalog.characters), sceneIds: Object.values(definition.scenes), routes: Object.fromEntries(Object.values(catalog.routes).map(route => [route.id, route.layers])) };
  it("binds the authored goal to a real maintenance battle and a reachable third-layer exit", () => {
    for (const candidate of [catalog, TIDE_CAVE_CATALOG_DATA]) {
      const candidateRefs = { ...refs, actorIds: Object.keys(candidate.characters), routes: Object.fromEntries(Object.values(candidate.routes).map(route => [route.id, route.layers])) };
      expect(parseAirpSortieDefinition(definition, candidateRefs)).toEqual(definition);
      const route = candidate.routes[definition.objective.routeId];
      expect(candidate.journey!.rooms[route.layers[2][0]].kind).toBe("battle");
      expect(candidate.journey!.rooms[route.layers[2][1]].kind).toBe("exit");
    }
    expect(definition.reward.kind).toBe("memory-only");
  });
  it.each(["reward", "actor", "room", "deadline", "fallback", "unknown"])("rejects illegal definition: %s", kind => {
    const raw = structuredClone(definition);
    if (kind === "reward") Object.assign(raw.reward, { gold: 100 });
    if (kind === "actor") raw.actorIds = ["kael"];
    if (kind === "room") raw.objective.roomDefinitionId = "room.memory.marietta";
    if (kind === "deadline") Object.assign(raw, { acceptedDeadline: 9 });
    if (kind === "fallback") raw.scenes.retry = "unregistered";
    if (kind === "unknown") Object.assign(raw, { patch: {} });
    expect(() => parseAirpSortieDefinition(raw, refs)).toThrow();
  });
  it("parses intents but refuses supplied rewards, proof and unknown options", () => {
    expect(parseAirpCommand({ type: "airp-turn-in", instanceId: "ripple.1" })).toEqual({ type: "airp-turn-in", instanceId: "ripple.1" });
    expect(() => parseAirpCommand({ type: "airp-turn-in", instanceId: "ripple.1", proof: facts })).toThrow();
    expect(() => parseAirpCommand({ type: "airp-accept", instanceId: "ripple.1", sceneId: "s", nodeId: "n", optionId: "D" })).toThrow();
  });
});

describe("AIRP offer time and observed history", () => {
  const instance: AirpInstance = { id: "ripple.1", definition: { id: definition.id, version: 1 }, createdPhase: 0, offerUntilPhase: 8, offerSceneId: "scene.1", actorIds: ["elora"], status: "pending", exposedPhase: null };
  it("uses the existing four game phases, including the 64-day boundary", () => {
    expect(airpPhaseIndex(1, "dawn")).toBe(0);
    expect(airpPhaseIndex(64, "night")).toBe(255);
    expect(airpPhaseIndex(65, "dawn")).toBe(256);
    expect(() => airpPhaseIndex(0, "dawn")).toThrow();
  });
  it("recycles only unseen inert offers, retaining seen and consequential history", () => {
    expect(airpExpiry(instance, "inert", 7)).toBeNull();
    expect(airpExpiry(instance, "inert", 8)).toBe("reserved");
    expect(airpExpiry({ ...instance, status: "offered", exposedPhase: 1 }, "inert", 8)).toBe("expired-seen");
    expect(airpExpiry(instance, "consequential", 8)).toBe("missed");
  });
  it("never expires an accepted quest using its offer deadline", () => {
    const accepted: AirpInstance = { ...instance, status: "accepted", exposedPhase: 1, acceptedPhase: 1, acceptedHead: head(2), acceptedFactId: "accept", stance: "pragmatic", binding: null };
    expect(airpExpiry(accepted, "consequential", 9999)).toBeNull();
  });
});

describe("AIRP objective reader (normalized replay fixtures, not an integrated quest)", () => {
  it.each(["extracted", "cleared"] as const)("accepts %s only with this run's completed room and settlement", outcome => {
    const input = proofInput(); Object.assign(input.facts[1], { outcome });
    expect(readAirpReturnProof(input)).toMatchObject({ outcome, evidenceId: binding.evidenceId, sourceFactIds: ["accept", "depart", "room", "settle"] });
  });
  it.each(["accept", "depart", "room", "settle"])("ignores a missing/retracted %s source", id => {
    const input = proofInput(); input.effectiveFactIds.delete(id);
    expect(readAirpReturnProof(input)).toBeNull();
  });
  it.each(["old-run", "echo", "foreign-save", "epoch", "future", "pre-departure", "wrong-room", "wipe", "duplicate", "missing-terminal", "content", "definition"])("rejects %s", kind => {
    const input = proofInput();
    if (kind === "old-run") input.facts[0].runId = "old-run";
    if (kind === "echo") input.facts[0].origin = "memory";
    if (kind === "foreign-save") input.facts[0].source.saveId = "save.other";
    if (kind === "epoch") input.facts[0].source.epoch = "epoch.other";
    if (kind === "future") input.facts[0].source.revision = 11;
    if (kind === "pre-departure") input.binding.departureHead = head(2);
    if (kind === "wrong-room") Object.assign(input.facts[0], { roomInstanceId: "another-instance" });
    if (kind === "wipe") Object.assign(input.facts[1], { outcome: "wipe" });
    if (kind === "duplicate") input.facts.push(input.facts[0]);
    if (kind === "missing-terminal") input.facts.pop();
    if (kind === "content") input.contentDigest = "different";
    if (kind === "definition") input.binding.definition.version = 2;
    expect(readAirpReturnProof(input)).toBeNull();
  });
});

describe("AIRP knowledge intersection and reproducible context", () => {
  const entry = (id: string, patch: Partial<AirpKnowledgeEntry> = {}): AirpKnowledgeEntry => ({
    id, axis: "bond", phase: 1, source: head(9), sourceFactIds: ["settle"], topicKeys: ["care.practical"], summary: "本次巡守已安全撤离。",
    knowledge: { kind: "shared", actorIds: ["kael", "elora"] }, ...patch,
  });
  const contextInput = () => ({ head: head(10), task: { instanceId: "ripple.1", sceneId: "scene.return", role: "return" as const, template: { id: "template.return", version: 1 } }, profiles: [{ id: "profile.elora", version: 1 }],
    locus: { phase: 1, locationId: "mansion", actorIds: ["kael", "elora"] }, entries: [entry("shared")], topicKeys: ["care.practical"], requiredEntryIds: ["shared"], effectiveFactIds: new Set(live) });
  it("omits future, foreign, withdrawn, irrelevant and another actor's private facts", () => {
    const input = contextInput();
    input.entries.push(entry("future", { phase: 2 }), entry("foreign", { source: { ...head(9), saveId: "other" } }), entry("withdrawn", { sourceFactIds: ["undo"] }), entry("private", { knowledge: { kind: "shared", actorIds: ["marietta"] } }), entry("unrelated", { topicKeys: ["other"] }));
    expect(assembleAirpContext(input).bond.map(e => e.id)).toEqual(["shared"]);
  });
  it("requires all listeners to know mandatory facts; source validity does not imply knowledge", () => {
    const input = contextInput(); input.locus.actorIds.push("marietta");
    expect(() => assembleAirpContext(input)).toThrow(/Required knowledge/);
    input.requiredEntryIds = [];
    expect(assembleAirpContext(input).bond).toEqual([]);
  });
  it("has stable ordering/hash and does not mutate input or retain aliases", () => {
    const a = contextInput(); a.entries.push(entry("aaa"));
    const b = structuredClone(a); b.entries.reverse(); b.locus.actorIds.reverse();
    const result = assembleAirpContext(a);
    expect(result).toEqual(assembleAirpContext(b));
    result.bond[0].summary = "changed";
    expect(a.entries[0].summary).not.toBe("changed");
  });
  it("keeps mandatory entries and drops optional entries deterministically", () => {
    const input = contextInput(); input.entries.push(...Array.from({ length: 40 }, (_, i) => entry(`older.${i}`)));
    const result = assembleAirpContext(input);
    expect(result.bond).toHaveLength(AIRP_LIMITS.knowledgeEntries);
    expect(result.bond.some(e => e.id === "shared")).toBe(true);
    expect(result.omittedEntryCount).toBe(17);
  });
  it("fails instead of truncating oversized mandatory context", () => {
    const input = contextInput(); input.profiles = [{ id: "x".repeat(AIRP_LIMITS.contextBytes), version: 1 }];
    expect(() => assembleAirpContext(input)).toThrow(/budget/);
  });
});

describe("AIRP archive sizing", () => {
  it("fits all bounded collections with UTF-8 content, including metadata, below 4 MiB", () => {
    const sized = (bytes: number) => "x".repeat(bytes - 2); // JSON string quotes consume two bytes.
    const report = measureAirpCapacity({
      scenes: Array(128).fill(sized(AIRP_LIMITS.sceneBytes)), instances: Array(128).fill(sized(AIRP_LIMITS.instanceBytes)),
      memories: Array(256).fill(sized(AIRP_LIMITS.memoryBytes)), jobs: Array(128).fill(sized(AIRP_LIMITS.jobBytes)), metadata: sized(AIRP_LIMITS.metadataBytes),
    });
    expect(report.totalBytes).toBe(4_063_932);
    expect(report.totalBytes).toBeLessThan(AIRP_LIMITS.narrativeBytes);
  });
  it("rejects a Chinese text overflow and exhausted scene slots without evicting history", () => {
    const archive = { scenes: ["字".repeat(6000)], instances: [], memories: [], jobs: [], metadata: {} };
    expect(() => measureAirpCapacity(archive)).toThrow(/budget/);
    archive.scenes = Array(129).fill("scene");
    expect(() => measureAirpCapacity(archive)).toThrow(/array size/);
    expect(archive.scenes).toHaveLength(129);
  });
});
