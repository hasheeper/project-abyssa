import * as v from "../../game-core/contracts";
import type { AirpCard, AirpObjectiveFact, AirpPoolInstance, AirpPoolRole, AirpPoolScene, AirpPoolState, ValidatedD5Catalog } from "../../game-core/contracts";
import { airpActorLocation, airpPhaseIndex, airpPoolActive, airpPoolLocked, airpPoolReadingInstance, checkAirpPoolCapacity, expireAirpPool, poolCooldown, readAirpReturnProof, scheduleAirpPool } from "../../game-core/session";
import { airpAtHome, airpEligible, type AirpReplayInput } from "./airp-boundary";

/** Sole AIRP-3 writer, shared by command execution and strict historical replay. */
export function reduceAirpPoolCommit(catalog: ValidatedD5Catalog, previous: AirpPoolState, input: AirpReplayInput): AirpPoolState {
  const content = catalog.data.airp;
  if (content?.version !== 2) v.invalid("airp", "Pool requires contract 2");
  const state = structuredClone(previous), { head, before, after } = input;
  const phase = airpPhaseIndex(after.clock.day, after.clock.phase), current = input.group[0];
  const effectiveIds = new Set(input.facts.filter(f => !input.retracted.includes(f.id)).map(f => f.id));
  const definition = (i: AirpPoolInstance) => content.cards.find(d => d.id === i.definition.id)!;
  expireAirpPool(content, state, phase, head, current.id);
  function freeze(i: AirpPoolInstance, role: AirpPoolRole, suffix = ""): AirpPoolScene {
    const id = `scene:${v.sha256(v.canonicalJson([i.id, role, suffix])).slice(0, 32)}`;
    const existing = state.scenes.find(s => s.id === id); if (existing) return existing;
    const d = definition(i), slot = role === "offer" && i.variant !== "initial" ? `offer-${i.variant}` as const : role;
    const templateId = d.scenes[slot]; if (!templateId) v.invalid("scene", "No authored scene for this transition");
    const body = structuredClone(content!.scripts[templateId]);
    if (after.clock.phase === "dusk" || after.clock.phase === "night") { body.presentation.stagePreset = "mansion-night"; body.presentation.backgroundId = "mansion.night"; }
    const scene: AirpPoolScene = { id, instanceId: i.id, role, templateId, templateVersion: 1, contentDigest: catalog.ref.digest, sourceHead: { ...head }, phase, source: "handwritten", body, bodyHash: v.sha256(v.canonicalJson(body)) };
    state.scenes.push(scene); return scene;
  }
  function open(i: AirpPoolInstance, role: AirpPoolRole, suffix = "") {
    const scene = freeze(i, role, suffix);
    if (state.reading?.sceneId !== scene.id) state.reading = { sceneId: scene.id, node: 0, choice: null, completed: false, paused: false };
    else state.reading.paused = false;
    return scene;
  }
  function resolve(i: AirpPoolInstance, d: AirpCard, factId: string) {
    if (i.status === "resolved") return;
    i.status = "resolved"; i.resolvedPhase = phase; i.receiptId = `airp-receipt:${v.sha256(i.id).slice(0, 32)}`;
    state.memories.push({ id: `memory:${v.sha256(i.id).slice(0, 32)}`, axis: "bond", phase, source: { ...head }, sourceFactIds: [...new Set([...i.completionFactIds, factId])], topicKeys: [...d.tags], knowledge: { kind: "shared", actorIds: ["kael", ...d.actorIds] }, summary: d.summary });
    poolCooldown(state, d, phase, factId);
  }
  const intent = input.group.find(f => f.kind === "airp");
  if (intent?.kind === "airp") {
    if (intent.payload.version !== 2 || input.group.length !== 1 || !airpAtHome(before)) v.invalid("airp", "Finish the active journey/story first", "command-not-available");
    const command = v.parseAirpPoolCommand(intent.payload.command), i = state.instances.find(i => i.id === command.instanceId);
    if (!i) v.invalid("instance", "Unknown or stale ripple");
    const d = definition(i), form = d.objective.form;
    if (airpPoolLocked(previous) && airpPoolReadingInstance(previous)?.id !== i.id) v.invalid("reading", "Finish or defer the current conversation", "command-not-available");
    const activeScene = state.scenes.find(s => s.id === state.reading?.sceneId);
    const targetReading = command.type === "airp-read" && activeScene?.instanceId === i.id && activeScene.role === "target";
    const actor = (command.type === "airp-visit" || targetReading) && d.objective.form === "liaison" ? d.objective.targetActorId : d.giverId;
    const location = airpActorLocation(content, actor, before.clock.phase, before.availableCharacterIds, true);
    if (!location) v.invalid("actor", "This participant is not reachable now", "command-not-available");
    const reading = state.reading, scene = state.scenes.find(s => s.id === reading?.sceneId);
    const ownScene = scene?.instanceId === i.id;
    if (command.type === "airp-open") {
      if (i.status === "pending" || i.status === "offered") {
        if (i.status === "pending" && form === "sortie" && i.variant !== "reserve") i.variant = after.settlements.filter(t => t.routeId === catalog.data.manor!.maintenanceRouteId).at(-1)?.outcome === "wipe" ? "setback" : "initial";
        i.status = "offered"; i.exposedPhase ??= phase; open(i, "offer");
      }
      else if (i.status === "ready") i.returnSceneId = open(i, form === "sortie" ? i.proof!.outcome === "extracted" ? "return-extracted" : "return-cleared" : "complete").id;
      else if (i.status === "closed" && (i.reason === "missed" || i.reason === "expired-seen")) open(i, i.reason === "missed" ? "aftermath" : "expired");
      else v.invalid("airp", "No conversation to open", "command-not-available");
    } else if (command.type === "airp-visit") {
      if (d.objective.form !== "liaison" || i.status !== "accepted" || command.actorId !== d.objective.targetActorId || command.locationId !== location) v.invalid("visit", "Visit this task's actual target at their current location", "command-not-available");
      if (airpPoolLocked(previous)) v.invalid("visit", "Finish the offer before visiting", "command-not-available");
      i.targetSceneId = open(i, "target").id; i.completionFactIds = [i.accepted!.factId, intent.id];
    } else if (command.type === "airp-read" || command.type === "airp-accept") {
      const node = scene?.body.nodes[reading?.node ?? -1];
      if (!ownScene || !scene || !reading || reading.paused || reading.completed || command.sceneId !== scene.id || command.nodeId !== node?.id) v.invalid("reading", "Stale scene/node", "conflict");
      if (command.type === "airp-accept") {
        if (i.status !== "offered" || scene.role !== "offer" || node.kind !== "choice" || form === "vignette") v.invalid("accept", "Explicit acceptance choice required");
        i.status = "accepted"; i.accepted = { head: { ...head }, factId: intent.id, phase, stance: ({ A: "iron", B: "seasoned", C: "pragmatic" } as const)[command.optionId] }; reading.choice = command.optionId;
      } else if (node.kind === "choice" || node.kind === "branch" && !reading.choice) v.invalid("reading", "Choose an action before continuing");
      if (reading.node < scene.body.nodes.length - 1) reading.node++;
      else {
        reading.completed = true;
        if (scene.role === "offer" && form === "household" && i.status === "accepted") {
          i.status = "ready"; i.completionFactIds = [i.accepted!.factId]; i.returnSceneId = open(i, "complete").id;
        } else if (scene.role === "target") {
          if (form !== "liaison" || i.status !== "accepted" || scene.id !== i.targetSceneId) v.invalid("target", "Unbound conversation");
          i.completionFactIds.push(intent.id); i.status = "ready";
          // Return is a separate deliberate action; keep target reading completed/unlocked.
          state.reading = null;
        } else if (scene.role === "aftermath") i.aftermathRead = true;
      }
    } else if (command.type === "airp-defer") {
      if (i.status !== "offered" || !ownScene || !reading || scene?.role !== "offer") v.invalid("defer", "Only unaccepted offers may be deferred");
      reading.paused = true;
    } else if (command.type === "airp-decline") {
      if (i.status !== "offered") v.invalid("decline", "Only exposed unaccepted offers can be declined");
      i.status = "closed"; i.reason = "declined"; i.closedPhase = phase; poolCooldown(state, d, phase, intent.id); open(i, "declined");
    } else if (command.type === "airp-turn-in" || command.type === "airp-finish") {
      const expected = form === "household" || form === "vignette" ? "airp-finish" : "airp-turn-in";
      if (command.type !== expected) v.invalid("finish", "Wrong completion operation for this form");
      if (i.status !== "resolved") {
        if (!ownScene || !scene || !reading?.completed || reading.paused || (form === "vignette" ? i.status !== "offered" || scene.role !== "offer" : i.status !== "ready" || scene.id !== i.returnSceneId)) v.invalid("finish", "Read the bound completion scene first");
        if (!i.completionFactIds.every(id => effectiveIds.has(id))) v.invalid("proof", "Evidence is no longer effective");
        if (form === "vignette") i.completionFactIds = input.facts.filter(f => f.kind === "airp" && f.payload.command.type === "airp-read" && f.payload.command.sceneId === scene.id && effectiveIds.has(f.id)).map(f => f.id);
        resolve(i, d, intent.id);
      }
    }
  } else if (airpPoolLocked(previous)) v.invalid("reading", "Finish or defer the current ripple conversation", "command-not-available");

  const i = state.instances.find(i => i.status === "accepted" && definition(i).objective.form === "sortie");
  const started = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-started");
  const settled = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-settled");
  if (i) {
    const objective = definition(i).objective;
    if (objective.form !== "sortie") v.invalid("objective", "Expected patrol");
    const spec = objective.spec, o = spec.objective;
    if (started?.kind === "progression" && started.payload.type === "expedition-started" && started.payload.routeId === o.routeId) {
      if (state.scenes.length + 4 + state.instances.filter(x => x.id !== i.id && airpPoolActive(x)).length * 8 > v.AIRP_LIMITS.sceneCount) v.invalid("airp", "Not enough archive capacity for another patrol; export preserves history", "airp-capacity");
      if (i.binding || !input.run || input.run.run.id !== started.payload.runId) v.invalid("binding", "Missing or reused departure");
      const roomInstanceId = input.run.run.roomIds[o.layer - 1]?.[o.roomIndex];
      if (!roomInstanceId || !i.accepted) v.invalid("binding", "Missing target or acceptance");
      i.binding = { instanceId: i.id, definition: i.definition, contentDigest: catalog.ref.digest, acceptedHead: i.accepted.head, acceptedFactId: i.accepted.factId, departureHead: { ...head }, departureFactId: started.id, runId: started.payload.runId, routeId: o.routeId, roomDefinitionId: o.roomDefinitionId, roomInstanceId, evidenceId: o.evidenceId };
      i.carryFactId = null; freeze(i, "departure", started.payload.runId);
    }
    if (i.binding) {
      const b = i.binding;
      const facts = input.facts.flatMap<AirpObjectiveFact>(f => {
        if (f.origin !== "adventure" || f.runRef?.kind !== "expedition" || f.runRef.id !== b.runId || !effectiveIds.has(f.id)) return [];
        const base = { id: f.id, source: f.source, phase: airpPhaseIndex(f.worldTime.day, f.worldTime.phase), origin: "adventure" as const, runId: b.runId, routeId: b.routeId };
        if (f.kind === "journey" && f.payload.events.some(e => e.type === "room-completed" && (e.payload as { roomId?: string }).roomId === b.roomInstanceId)) return [{ ...base, kind: "room-completed", roomInstanceId: b.roomInstanceId, roomDefinitionId: b.roomDefinitionId }];
        if (f.kind === "progression" && f.payload.type === "expedition-settled" && f.payload.terminal.routeId === b.routeId) return [{ ...base, kind: "expedition-settled", terminalId: f.payload.terminal.id, outcome: f.payload.terminal.outcome }];
        return [];
      });
      const found = facts.find(f => f.kind === "room-completed"); i.carryFactId = found?.id ?? null;
      if (found) freeze(i, "found", b.runId);
      if (settled?.kind === "progression" && settled.payload.type === "expedition-settled" && settled.payload.terminal.runId === b.runId) {
        const proof = readAirpReturnProof({ definition: spec, binding: b, head, contentDigest: catalog.ref.digest, facts, effectiveFactIds: effectiveIds });
        if (proof) { i.status = "ready"; i.proof = proof; i.completionFactIds = [...proof.sourceFactIds]; }
        else { i.binding = null; i.carryFactId = null; open(i, "retry", b.runId); }
      }
    }
  }
  const boundary = input.group.some(f => f.kind === "save-created" || f.kind === "airp" || f.kind === "progression" && ["manor-story", "expedition-settled", "story-completed", "phase-advanced"].includes(f.payload.type));
  if (boundary) scheduleAirpPool(content, state, { phase, phaseName: after.clock.phase, head, factId: current.id, eligible: airpEligible(after), availableActorIds: after.availableCharacterIds,
    setback: after.settlements.filter(t => t.routeId === catalog.data.manor!.maintenanceRouteId).at(-1)?.outcome === "wipe" });
  checkAirpPoolCapacity(state); return state;
}
