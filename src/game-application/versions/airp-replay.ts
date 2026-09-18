import * as v from "../../game-core/contracts";
import type { AirpFrozenScene, AirpLiveState, AirpObjectiveFact, AirpSceneRole, ValidatedD5Catalog } from "../../game-core/contracts";
import { airpExpiry, airpPhaseIndex, readAirpReturnProof } from "../../game-core/session";
import { airpAtHome, airpEligible, type AirpReplayInput } from "./airp-boundary";
export { airpAtHome, airpEligible } from "./airp-boundary";
import type { AirpNarrativeState, AirpIntent } from "../../game-core/contracts";
import { emptyAirpPool, airpPoolActive, airpPoolLocked } from "../../game-core/session";
import { reduceAirpPoolCommit } from "./airp-pool-replay";

export const emptyAirp = (catalog?: ValidatedD5Catalog): AirpNarrativeState => catalog?.data.airp?.version === 2 ? emptyAirpPool() : ({ version: 1, instance: null, scenes: [], reading: null, carryFactId: null, memories: [], cooldowns: [], lastBoundaryId: null });
export function airpLocked(state: AirpNarrativeState | undefined): boolean {
  if (state?.version === 2) return airpPoolLocked(state);
  return !!state?.reading && !state.reading.paused && (!state.reading.completed || state.instance?.status === "ready" && !!state.instance.returnSceneId);
}
export function airpCopyBlocked(state: AirpNarrativeState | undefined): boolean {
  if (state?.version === 2) return airpPoolLocked(state) || state.instances.some(airpPoolActive);
  return !!state && (airpLocked(state) || state.instance?.status === "accepted" || state.instance?.status === "ready" || state.instance?.status === "offered");
}
export function checkAirpCapacity(state: AirpLiveState): void {
  v.measureAirpCapacity({ scenes: state.scenes, instances: state.instance ? [state.instance] : [], memories: state.memories, jobs: [],
    metadata: { reading: state.reading, carryFactId: state.carryFactId, cooldowns: state.cooldowns, lastBoundaryId: state.lastBoundaryId } });
}

/** Called after the corresponding D5 group has passed deterministic replay. */
export function reduceAirpCommit(catalog: ValidatedD5Catalog, previous: AirpNarrativeState, input: AirpReplayInput): AirpNarrativeState {
  if (catalog.data.airp?.version !== previous.version) v.invalid("narrative.version", "Narrative contract differs from content");
  return previous.version === 2 ? reduceAirpPoolCommit(catalog, previous, input) : reduceFirstAirpCommit(catalog, previous, input);
}
function reduceFirstAirpCommit(catalog: ValidatedD5Catalog, previous: AirpLiveState, input: AirpReplayInput): AirpLiveState {
  const content = catalog.data.airp;
  if (content?.version !== 1) v.invalid("airp", "AIRP contract 1 is unavailable in this content", "content-unavailable");
  const state = structuredClone(previous), definition = content.definition, { head, after, before } = input;
  const phase = airpPhaseIndex(after.clock.day, after.clock.phase);
  const effectiveIds = new Set(input.facts.filter(f => !input.retracted.includes(f.id)).map(f => f.id));
  const current = input.group[0];
  const expire = state.instance && airpExpiry(state.instance, definition.volatility, phase);
  const cooldown = (factId: string) => {
    if (!state.cooldowns.length) state.cooldowns.push({ themeKey: definition.themeKey, sourceFactId: factId, fromPhase: phase, untilPhase: phase + definition.cooldownPhases });
  };
  if (expire && state.instance) {
    state.instance = { id: state.instance.id, definition: state.instance.definition, createdPhase: state.instance.createdPhase, offerUntilPhase: state.instance.offerUntilPhase, offerSceneId: state.instance.offerSceneId, actorIds: state.instance.actorIds,
      exposedPhase: state.instance.exposedPhase, status: "closed", reason: expire, closedPhase: phase, aftermathId: null };
    state.reading = null;
    if (expire !== "reserved") cooldown(current.id);
  }
  function freeze(role: AirpSceneRole, suffix = ""): AirpFrozenScene {
    const instance = state.instance!;
    const id = `scene:${v.sha256(v.canonicalJson([instance.id, role, suffix])).slice(0, 32)}`;
    const existing = state.scenes.find(s => s.id === id);
    if (existing) return existing;
    const body = structuredClone(content!.scripts[definition.scenes[role]]);
    if (after.clock.phase === "dusk" || after.clock.phase === "night") {
      body.presentation.stagePreset = "mansion-night"; body.presentation.backgroundId = "mansion.night";
    }
    const scene: AirpFrozenScene = { id, instanceId: instance.id, role, templateId: body.id, templateVersion: 1, contentDigest: catalog.ref.digest,
      sourceHead: { ...head }, phase, source: "handwritten", body, bodyHash: v.sha256(v.canonicalJson(body)) };
    state.scenes.push(scene); return scene;
  }
  function open(role: AirpSceneRole, suffix = "") {
    const scene = freeze(role, suffix);
    if (state.reading?.sceneId !== scene.id) state.reading = { sceneId: scene.id, node: 0, choice: null, completed: false, paused: false };
    else state.reading.paused = false;
    return scene;
  }
  if (expire === "expired-seen") freeze("expired");
  const airpFact = input.group.find(f => f.kind === "airp");
  if (airpFact?.kind === "airp") {
    const command = v.parseAirpCommand(airpFact.payload.command);
    if (airpFact.payload.version !== 1 || input.group.length !== 1 || !airpAtHome(before) || !before.availableCharacterIds.includes("elora")) v.invalid("airp", "Finish the active journey/story before talking with Elora", "command-not-available");
    let instance = state.instance;
    if (!instance || instance.id !== command.instanceId) v.invalid("airp.instanceId", "Unknown or stale errand");
    const scene = state.scenes.find(s => s.id === state.reading?.sceneId), reading = state.reading;
    if (command.type === "airp-open") {
      if (instance.status === "pending" || instance.status === "offered") {
        if (instance.status === "pending") state.instance = { ...instance, status: "offered", exposedPhase: phase };
        open("offer");
      } else if (instance.status === "ready") {
        const scene = open(instance.proof.outcome === "extracted" ? "return-extracted" : "return-cleared");
        instance.returnSceneId = scene.id;
      } else v.invalid("airp", "No conversation to open", "command-not-available");
    } else if (command.type === "airp-read" || command.type === "airp-accept") {
      const node = scene?.body.nodes[reading?.node ?? -1];
      if (!scene || !reading || reading.paused || reading.completed || command.sceneId !== scene.id || command.nodeId !== node?.id) v.invalid("airp.reading", "Stale scene/node", "conflict");
      if (command.type === "airp-accept") {
        if (instance.status !== "offered" || scene.role !== "offer" || node.kind !== "choice") v.invalid("airp.accept", "Not at the acceptance choice");
        state.instance = { ...instance, status: "accepted", acceptedHead: { ...head }, acceptedFactId: airpFact.id, acceptedPhase: phase,
          stance: ({ A: "iron", B: "seasoned", C: "pragmatic" } as const)[command.optionId], binding: null };
        reading.choice = command.optionId;
      } else if (node.kind === "choice" || node.kind === "branch" && !reading.choice) v.invalid("airp.reading", "An explicit choice is required");
      if (reading.node === scene.body.nodes.length - 1) reading.completed = true;
      else reading.node++;
    } else if (command.type === "airp-defer") {
      if (instance.status !== "offered" || !reading || scene?.role !== "offer") v.invalid("airp.defer", "Only an open unaccepted offer can be deferred");
      reading.paused = true;
    } else if (command.type === "airp-decline") {
      if (instance.status !== "offered") v.invalid("airp.decline", "Only an unaccepted offer can be declined");
      state.instance = { ...instance, status: "closed", closedPhase: phase, reason: "declined", aftermathId: null };
      cooldown(airpFact.id); open("declined");
    } else if (command.type === "airp-turn-in") {
      if (instance.status !== "resolved") {
        if (instance.status !== "ready" || !scene || scene.id !== instance.returnSceneId || !reading?.completed) v.invalid("airp.turn-in", "Read the current return scene before handing in");
        if (!instance.proof.sourceFactIds.every(id => effectiveIds.has(id))) v.invalid("airp.proof", "Objective proof is no longer effective");
        const receiptId = `airp-receipt:${v.sha256(instance.id).slice(0, 32)}`;
        state.instance = { ...instance, status: "resolved", resolvedPhase: phase, receiptId, returnSceneId: scene.id };
        state.memories.push({ id: definition.reward.memoryKey, axis: "bond", phase, source: { ...head }, sourceFactIds: [...instance.proof.sourceFactIds, airpFact.id],
          topicKeys: [...definition.tags], knowledge: { kind: "shared", actorIds: ["kael", "elora"] },
          summary: instance.proof.outcome === "extracted" ? "玩家从侧门撤离并带回空药箱，已交付给艾洛拉。" : "玩家完成本趟巡守并带回空药箱，已交付给艾洛拉。" });
        cooldown(airpFact.id);
      }
    }
  } else if (airpLocked(previous)) {
    v.invalid("airp.reading", "Finish the active errand conversation first", "command-not-available");
  }

  const started = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-started");
  const settled = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-settled");
  let instance = state.instance;
  if (instance?.status === "accepted" && started?.kind === "progression" && started.payload.type === "expedition-started" && started.payload.routeId === definition.objective.routeId) {
    // Reserve departure, found, retry and eventual return before leaving home.
    if (state.scenes.length + 4 > v.AIRP_LIMITS.sceneCount) v.invalid("airp", "Archive scene capacity reached; preserved for export, further patrols require an archive policy", "airp-capacity");
    if (instance.binding || !input.run || input.run.run.id !== started.payload.runId) v.invalid("airp.binding", "Missing or reused departure");
    const o = definition.objective, roomInstanceId = input.run.run.roomIds[o.layer - 1]?.[o.roomIndex];
    if (!roomInstanceId) v.invalid("airp.binding", "Missing target room instance");
    instance.binding = { instanceId: instance.id, definition: instance.definition, contentDigest: catalog.ref.digest, acceptedHead: instance.acceptedHead,
      acceptedFactId: instance.acceptedFactId, departureHead: { ...head }, departureFactId: started.id, runId: started.payload.runId,
      routeId: o.routeId, roomDefinitionId: o.roomDefinitionId, roomInstanceId, evidenceId: o.evidenceId };
    state.carryFactId = null;
    freeze("departure", started.payload.runId);
  }
  instance = state.instance;
  if (instance?.status === "accepted" && instance.binding) {
    const b = instance.binding;
    const objectiveFacts = input.facts.flatMap<AirpObjectiveFact>(f => {
      if (f.origin !== "adventure" || f.runRef?.kind !== "expedition" || f.runRef.id !== b.runId || !effectiveIds.has(f.id)) return [];
      const base = { id: f.id, source: f.source, phase: airpPhaseIndex(f.worldTime.day, f.worldTime.phase), origin: "adventure" as const, runId: b.runId, routeId: b.routeId };
      if (f.kind === "journey" && f.payload.events.some(e => e.type === "room-completed" && (e.payload as { roomId?: string }).roomId === b.roomInstanceId)) return [{ ...base, kind: "room-completed" as const, roomInstanceId: b.roomInstanceId, roomDefinitionId: b.roomDefinitionId }];
      if (f.kind === "progression" && f.payload.type === "expedition-settled" && f.payload.terminal.routeId === b.routeId) return [{ ...base, kind: "expedition-settled" as const, terminalId: f.payload.terminal.id, outcome: f.payload.terminal.outcome }];
      return [];
    });
    const found = objectiveFacts.find(f => f.kind === "room-completed");
    state.carryFactId = found?.id ?? null;
    if (found) freeze("found", b.runId);
    if (settled?.kind === "progression" && settled.payload.type === "expedition-settled" && settled.payload.terminal.runId === b.runId) {
      const proof = readAirpReturnProof({ definition, binding: b, head, contentDigest: catalog.ref.digest, facts: objectiveFacts, effectiveFactIds: effectiveIds });
      if (proof) state.instance = { ...instance, status: "ready", binding: b, proof, returnSceneId: null };
      else { instance.binding = null; state.carryFactId = null; open("retry", b.runId); }
    }
  }
  // One authored card in AIRP-2: terminal instances remain history, never silently respawn.
  if (!state.instance && airpEligible(after) && input.group.some(f => f.kind === "save-created" || f.kind === "progression" && ["manor-story", "expedition-settled", "story-completed", "phase-advanced"].includes(f.payload.type))) {
    const id = `ripple:${v.sha256(v.canonicalJson([head, definition.id])).slice(0, 32)}`;
    state.instance = { id, definition: { id: definition.id, version: definition.version }, createdPhase: phase, offerUntilPhase: phase + definition.offerPhases,
      offerSceneId: "pending", actorIds: [...definition.actorIds], status: "pending", exposedPhase: null };
    // Reserve identity now; freeze actual text/stage at first exposure, not scheduling time.
    state.instance.offerSceneId = `scene:${v.sha256(v.canonicalJson([id, "offer", ""])).slice(0, 32)}`;
    state.lastBoundaryId = current.id;
  }
  checkAirpCapacity(state);
  return state;
}

export function airpCommandPayload(raw: unknown, version: 1 | 2 = 1): AirpIntent {
  const p = v.record(raw, "airp.payload", ["version", "command"]);
  v.choice(p.version, [version], "airp.version");
  return version === 2 ? { version: 2, command: v.parseAirpPoolCommand(p.command) } : { version: 1, command: v.parseAirpCommand(p.command) };
}
