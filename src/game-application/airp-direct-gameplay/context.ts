import { usesCreativeProtocol } from "../airp-generation/creative-output";
import * as v from "../../game-core/contracts";
import { airpActorLocation, airpPhaseIndex, readAirpReturnProof } from "../../game-core/session";
import type { AirpReplayInput } from "../versions/airp-boundary";
import { airpAtHome } from "../versions/airp-boundary";
import { emptyNarrativeFlags, type AirpDirectState, type DirectContext, type DirectTask } from "./contracts";
import { directProse } from "./compile";

/** Called only inside the replay reducer, after game fact/settlement validation. */
export function projectDirectContext(catalog: v.ValidatedD5Catalog, state: v.AirpPoolState, direct: AirpDirectState, task: DirectTask, input: AirpReplayInput): DirectContext {
  const content = catalog.data.airp, i = state.instances.find(i => i.id === task.instanceId);
  if (content?.version !== 2 || !i?.proof || !i.accepted || i.definition.id !== catalog.data.airpDirect?.definitionId || !airpAtHome(input.before))
    v.invalid("direct.source", "A proven returned errand is required", "command-not-available");
  const location = airpActorLocation(content, "elora", input.before.clock.phase, input.before.availableCharacterIds, true);
  if (location !== "mansion.common-room") v.invalid("direct.actor", "Elora must be reachable in the common room");
  const phase = airpPhaseIndex(input.before.clock.day, input.before.clock.phase);
  const parentTask = task.task === "followup" ? direct.tasks.find(t => t.instanceId === i.id && t.task === "return") : null;
  const parentMemory = parentTask && direct.memories.find(m => m.id === parentTask.memoryId);
  const parentScene = parentTask && state.scenes.find(s => s.id === parentTask.sceneId);
  const effective = new Set(input.facts.filter(f => !input.retracted.includes(f.id)).map(f => f.id));
  const inheritedParent = parentTask?.context && parentTask.context.head.saveId !== input.head.saveId;
  // Copied return tasks have already passed ancestor replay and safe-boundary validation.
  // Never treat copied source fact IDs as new local quest evidence.
  if (inheritedParent) {
    if (!parentTask.read || !parentMemory || parentTask.source !== "browser-direct") v.invalid("direct.parent", "Unproved ancestor return");
  } else {
    if (!i.binding || !i.proof.sourceFactIds.every(id => effective.has(id))) v.invalid("direct.proof", "Missing or retracted patrol evidence");
    const card = content.cards.find(c => c.id === i.definition.id)!;
    if (card.objective.form !== "sortie") v.invalid("direct.proof", "Expected patrol objective");
    const binding = i.binding;
    const facts = input.facts.flatMap<v.AirpObjectiveFact>(f => {
      if (f.origin !== "adventure" || f.runRef?.id !== binding.runId || !effective.has(f.id)) return [];
      const base = {id: f.id, source: f.source, phase: airpPhaseIndex(f.worldTime.day, f.worldTime.phase), origin: "adventure" as const, runId: binding.runId, routeId: binding.routeId};
      if (f.kind === "journey" && f.payload.events.some(e => e.type === "room-completed" && (e.payload as {roomId?: string}).roomId === binding.roomInstanceId))
        return [{...base, kind: "room-completed", roomInstanceId: binding.roomInstanceId, roomDefinitionId: binding.roomDefinitionId}];
      if (f.kind === "progression" && f.payload.type === "expedition-settled" && f.payload.terminal.routeId === binding.routeId)
        return [{...base, kind: "expedition-settled", terminalId: f.payload.terminal.id, outcome: f.payload.terminal.outcome}];
      return [];
    });
    const proof = readAirpReturnProof({definition: card.objective.spec, binding, head: input.head, contentDigest: catalog.ref.digest, facts, effectiveFactIds: effective});
    if (!proof || v.canonicalJson(proof) !== v.canonicalJson(i.proof)) v.invalid("direct.proof", "Patrol evidence no longer matches");
  }
  const memories = direct.memories.filter(m => m.phase <= phase && m.actorIds.includes("kael") && m.actorIds.includes("elora")
    && direct.tasks.some(t => t.sceneId === m.sceneId && t.read?.bodyHash === m.bodyHash && t.memoryId === m.id)
    && (m.source.saveId !== input.head.saveId || m.readFactIds.every(id => effective.has(id))))
    .sort((a, b) => b.phase - a.phase || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 4);
  if (task.task === "followup" && (!parentMemory || !parentScene || !parentTask?.read || parentScene.bodyHash !== parentMemory.bodyHash || !memories.some(m => m.id === parentMemory.id)))
    v.invalid("direct.parent", "Followup requires the complete read return and its committed memory");
  const parentMaterial = parentTask?.materialHash ? direct.materials[parentTask.materialHash] : null;
  // v5 history is what the player actually read, not the bilingual editorial draft.
  // Keep the legacy path byte-for-byte for pre-v5 frozen contexts/replays.
  const prose = parentMaterial && usesCreativeProtocol(parentMaterial.resources.version) && parentScene
    ? parentScene.body.nodes.flatMap(n => n.kind === "beat" ? n.frames.map(f => `${f.kind === "dialogue" ? f.actorId : "narrator"}：${f.text}`) : []).join("\n")
    : parentTask && parentMaterial ? directProse(parentMaterial, parentTask) : "";
  if (task.task === "followup" && !prose) v.invalid("direct.parent", "Missing complete parent prose");
  const proof = structuredClone(i.proof);
  const tags = content.cards.find(c => c.id === i.definition.id)!.tags;
  const gameMemories = state.memories.filter(m => m.phase <= phase && m.topicKeys.some(key => tags.includes(key))
    && (m.knowledge.kind === "public" || ["kael", "elora"].every(actor => m.knowledge.kind === "shared" && m.knowledge.actorIds.includes(actor)))
    && (m.source.saveId === input.head.saveId ? m.sourceFactIds.every(id => effective.has(id)) : !!inheritedParent));
  const labels = ["玩家已接受艾洛拉取回空药箱的委托。", "玩家携这项委托实际出发巡守。", "本次在约定地点找到了空药箱。",
    proof.outcome === "extracted" ? "本次从侧门成功撤离并带回空药箱；不代表全线清场。" : "本次完成巡路并成功带回空药箱。"];
  return {sourceKind: "gameplay", version: 1, head: {...input.head}, contentDigest: catalog.ref.digest,
    sceneId: task.sceneId, instanceId: task.instanceId, task: task.task, playerName: input.before.playerName ?? "凯尔",
    phase, location, actorIds: ["kael", "elora"], stance: i.accepted.stance, proof,
    facts: proof.sourceFactIds.map((id, index) => ({id, text: labels[index], knownBy: ["kael", "elora"]})),
    gameMemories: structuredClone(gameMemories), memories: structuredClone(memories), flags: structuredClone(direct.flags[i.id] ?? emptyNarrativeFlags()),
    parent: parentMemory && parentScene && prose ? {sceneId: parentScene.id, bodyHash: parentScene.bodyHash, prose, memoryId: parentMemory.id} : null};
}
