import * as v from "../../game-core/contracts";
import { airpPhaseIndex, airpPoolLocked, checkAirpPoolCapacity } from "../../game-core/session";
import { airpAtHome, type AirpReplayInput } from "../versions/airp-boundary";
import { reduceAirpPoolCommit } from "../versions/airp-pool-replay";
import { acceptGeneratedText } from "../airp-generation/scene";
import { readWritingOutput } from "../airp-generation/writing";
import { emptyUsage, hash } from "../airp-generation/contracts";
import { planningPreflight, usesCreativeProtocol, validateCreativeStage } from "../airp-generation/creative-output";
import { DIRECT_LIMITS, DIRECT_STAGES, emptyAirpDirect, emptyNarrativeFlags, type AirpDirectState, type DirectTask } from "./contracts";
import { parseAirpDirectIntent } from "./parse";
import { projectDirectContext } from "./context";
import { checkDirectInputHash, compileDirectInput, directOutput, directProse } from "./compile";
import { parseUpdateProposal, type ReadText } from "./updater";

export const directCopyBlocked = (state: AirpDirectState) => state.tasks.some(t => t.source === "requested" || t.source === "undecided" || t.source === "browser-direct" && !t.memoryId);
export function readTextForUpdate(state: v.AirpPoolState, task: DirectTask): ReadText {
  const scene = state.scenes.find(s => s.id === task.sceneId);
  if (!task.read || !task.context || !scene || scene.bodyHash !== task.read.bodyHash || scene.bodyHash !== task.bodyHash)
    v.invalid("direct.read", "Only the accepted and completely read body can update memory");
  return {lines: scene.body.nodes.flatMap(n => n.kind === "beat" ? n.frames.map(f => ({id: n.id, speaker: f.kind === "dialogue" ? f.actorId : "narrator", text: f.text})) : []),
    facts: [...task.context.facts, {id: task.read.factIds.at(-1)!, text: "这段对白已经完整读完。"},
      ...state.memories.filter(m => m.id === `memory:${v.sha256(task.instanceId).slice(0, 32)}`).map(m => ({id: m.sourceFactIds.at(-1)!, text: "药箱委托已确认交付；后续交谈不再次交付。"}))],
    memories: task.context.memories, flags: task.context.flags};
}
export function nextDirectStage(task: DirectTask) {
  return DIRECT_STAGES.find(stage => !directOutput(task, stage)) ?? null;
}
/** Shared by command validation and the read-only recovery UI. */
export function directAttemptCapacityReached(task: DirectTask, stage: typeof DIRECT_STAGES[number]) {
  return task.attempts.length >= DIRECT_LIMITS.attempts || stage === "formatting" && task.attempts.filter(a => a.stage === stage).length >= 2;
}

/** Single pure writer for direct tasks and their narrative effects, also used during archive replay. */
export function reduceDirectCommit(catalog: v.ValidatedD5Catalog, previous: v.AirpNarrativeState, prior: AirpDirectState | undefined, input: AirpReplayInput) {
  if (!catalog.data.airpDirect || previous.version !== 2 || !prior && input.head.revision !== 0) v.invalid("direct", "Missing direct state or capability");
  const direct = structuredClone(prior ?? emptyAirpDirect()), fact = input.group[0];
  const isDirect = fact.kind === "airp-direct";
  const gate = direct.tasks.find(t => t.sceneId === previous.reading?.sceneId);
  if (!isDirect && gate && (gate.source === "undecided" || gate.source === "requested"))
    v.invalid("direct.source", "Choose generated or handwritten content before continuing", "command-not-available");
  const narrative = isDirect ? structuredClone(previous) : reduceAirpPoolCommit(catalog, previous, input);
  const add = (scene: v.AirpPoolScene, task: "return" | "followup") => {
    if (direct.tasks.some(t => t.sceneId === scene.id)) return;
    direct.tasks.push({id: `direct:${hash([input.head.saveId, input.head.epoch, scene.id]).slice(0, 32)}`, sceneId: scene.id,
      instanceId: scene.instanceId, task, source: "undecided", context: null, materialHash: null, attempts: [], bodyHash: null, read: null, memoryId: null});
    direct.flags[scene.instanceId] ??= emptyNarrativeFlags();
  };
  if (isDirect) {
    if (input.group.length !== 1) v.invalid("direct", "A direct command must have its own transaction");
    const command = parseAirpDirectIntent(fact.payload).command;
    if (command.type === "airp-direct-followup") {
      const instance = narrative.instances.find(i => i.id === command.instanceId);
      const parent = direct.tasks.find(t => t.instanceId === command.instanceId && t.task === "return");
      if (!instance || instance.status !== "resolved" || !parent?.memoryId || parent.source !== "browser-direct" || !airpAtHome(input.before)
        || !input.before.availableCharacterIds.includes("elora") || airpPoolLocked(narrative) || direct.tasks.some(t => t.instanceId === instance.id && t.task === "followup"))
        v.invalid("direct.followup", "Followup requires a resolved errand and its read, summarized return", "command-not-available");
      const parentScene = narrative.scenes.find(s => s.id === parent.sceneId)!;
      const id = `scene:${hash([instance.id, "direct-followup"]).slice(0, 32)}`;
      const body = structuredClone(catalog.data.airpDirect.followup);
      const phase = airpPhaseIndex(input.before.clock.day, input.before.clock.phase);
      body.presentation.stagePreset = phase % 4 >= 2 ? "mansion-night" : "mansion-morning";
      body.presentation.backgroundId = phase % 4 >= 2 ? "mansion.night" : "mansion.first-morning";
      const scene: v.AirpPoolScene = {...parentScene, id, role: "followup", templateId: body.id, sourceHead: {...input.head}, phase, source: "handwritten", body, bodyHash: hash(body)};
      narrative.scenes.push(scene); narrative.reading = {sceneId: id, node: 0, choice: null, completed: false, paused: false}; add(scene, "followup");
    } else {
      const task = direct.tasks.find(t => t.sceneId === command.sceneId), scene = narrative.scenes.find(s => s.id === command.sceneId);
      if (!task || !scene) v.invalid("direct.scene", "No matching direct scene");
      const instance = narrative.instances.find(i => i.id === task.instanceId)!;
      const unread = () => {
        if (task.read || narrative.reading?.sceneId !== scene.id || narrative.reading.node !== 0 || narrative.reading.completed || !airpAtHome(input.before))
          v.invalid("direct.scene", "This scene has started reading or is not active", "airp-stale-result");
      };
      if (command.type === "airp-direct-handwritten") {
        unread();
        if (!["undecided", "requested"].includes(task.source)) v.invalid("direct.source", "The accepted source is immutable");
        task.source = "handwritten";
        for (const attempt of task.attempts) if (attempt.status === "running") {attempt.status = "interrupted"; attempt.error = "cancelled"; attempt.outcomeUnknown = true;}
      } else if (command.type === "airp-direct-prepare") {
        unread();
        if (task.source !== "undecided") v.invalid("direct.prepare", "Task is already frozen");
        if (command.material) {
          if (direct.materials[command.materialHash]) v.invalid("direct.material", "Use the existing material reference without duplicating its bytes");
          direct.materials[command.materialHash] = command.material;
        }
        const material = direct.materials[command.materialHash];
        if (!material) v.invalid("direct.material", "Missing frozen material");
        task.context = projectDirectContext(catalog, narrative, direct, task, input); task.materialHash = command.materialHash;
        compileDirectInput(material, task.context, task, "planning");
        // Validate the writing preset before the first paid request, with a non-persisted outline.
        compileDirectInput(material, task.context, {...task, attempts: [{id: "preflight", stage: "planning", ordinal: 1, inputHash: "", startedAt: 0, endedAt: 0, status: "succeeded", output: usesCreativeProtocol(material.resources.version) ? planningPreflight(material.resources.version) : "预检占位", usage: emptyUsage(), error: null, outcomeUnknown: false}]}, "writing");
        task.source = "requested";
      } else {
        if (!task.context || !task.materialHash || !["requested", "browser-direct"].includes(task.source)
          || task.context.head.saveId !== input.head.saveId || task.context.head.epoch !== input.head.epoch || task.context.contentDigest !== catalog.ref.digest)
          v.invalid("direct.task", "Stale, copied or abandoned task cannot receive a result", "airp-stale-result");
        const material = direct.materials[task.materialHash];
        const effective = new Set(input.facts.filter(f => !input.retracted.includes(f.id)).map(f => f.id));
        const inheritedProof = task.context.parent && direct.tasks.find(t => t.sceneId === task.context!.parent!.sceneId)?.context?.head.saveId !== input.head.saveId;
        if (!inheritedProof && !task.context.proof.sourceFactIds.every(id => effective.has(id))) v.invalid("direct.proof", "Source evidence is no longer valid", "airp-stale-result");
        const stage = command.type === "airp-direct-begin" ? command.stage : task.attempts.find(a => a.id === command.attemptId)?.stage;
        if (!stage) v.invalid("direct.attempt", "Unknown attempt", "airp-stale-result");
        if (stage !== "updater") unread();
        else if (!task.read || instance.status !== "resolved" || task.memoryId || !task.read.factIds.every(id => effective.has(id)))
          v.invalid("direct.read", "Updater requires read evidence and completed delivery; no duplicate updates", "command-not-available");
        const updateInput = stage === "updater" ? readTextForUpdate(narrative, task) : undefined;
        if (command.type === "airp-direct-begin") {
          if (nextDirectStage(task) !== stage || task.attempts.some(a => a.status === "running") || direct.tasks.some(t => t.attempts.some(a => a.id === command.attemptId)))
            v.invalid("direct.attempt", "Wrong stage, duplicate attempt or outstanding request");
          const prior = task.attempts.filter(a => a.stage === stage);
          if (directAttemptCapacityReached(task, stage)) v.invalid("direct.attempt", "Attempt capacity exhausted", "airp-capacity");
          const compiled = compileDirectInput(material, task.context, task, stage, updateInput);
          task.attempts.push({id: command.attemptId, stage, ordinal: prior.length + 1, inputHash: hash(compiled), startedAt: command.at, endedAt: null,
            status: "running", output: null, usage: emptyUsage(), error: null, outcomeUnknown: false});
        } else {
          const attempt = task.attempts.at(-1);
          if (!attempt || attempt.id !== command.attemptId || attempt.status !== "running" || command.at < attempt.startedAt) v.invalid("direct.attempt", "Late, duplicate or stale output", "airp-stale-result");
          const beforeAttempt = {...task, attempts: task.attempts.slice(0, -1)};
          checkDirectInputHash(attempt.inputHash, compileDirectInput(material, task.context, beforeAttempt, stage, updateInput));
          attempt.endedAt = command.at; attempt.usage = command.usage;
          if (command.type === "airp-direct-fail") {
            attempt.status = command.error === "interrupted" || command.error === "cancelled" ? "interrupted" : "failed";
            attempt.error = command.error; attempt.outcomeUnknown = command.outcomeUnknown;
          } else {
            attempt.output = command.output;
            let formatted: ReturnType<typeof acceptGeneratedText> | undefined, proposal: ReturnType<typeof parseUpdateProposal> | undefined;
            try {
              if (!command.output.trim()) throw Error("Empty output");
              if (usesCreativeProtocol(material.resources.version) && (stage === "planning" || stage === "writing")) validateCreativeStage(stage, command.output, directOutput(task, "planning"), undefined, material.resources.version);
              else if (stage === "writing") readWritingOutput(command.output, material.resources.version);
              if (stage === "formatting") formatted = acceptGeneratedText(command.output, directProse(material, task), material.resources.version);
              if (stage === "updater") proposal = parseUpdateProposal(command.output, updateInput!);
            } catch {
              // A malformed paid response is durable evidence too. Keep it for bounded repair.
              attempt.status = "failed"; attempt.error = "invalid-output";
            }
            if (!attempt.error) {
              attempt.status = "succeeded";
              if (formatted) {
                const sectionId = `${task.id}.section`;
                scene.body = {...scene.body, id: task.id, sections: [{id: sectionId, title: scene.body.title}], nodes: formatted.lines.map((line, cursor) => {
                  const id = `${task.id}.${cursor}`;
                  const frame: v.AirpFrame = line.speaker === "narrator" ? {id, kind: "narration", text: line.text} : {id, kind: "dialogue", actorId: line.speaker, emotion: line.emotion, text: line.text};
                  return {id, cursor, sectionId, kind: "beat", frames: [frame]};
                })};
                scene.source = "browser-direct"; scene.sourceHead = {...input.head}; scene.bodyHash = hash(scene.body);
                task.bodyHash = scene.bodyHash; task.source = "browser-direct";
              }
              if (proposal) {
                const id = `direct-memory:${hash([task.id, task.read!.bodyHash]).slice(0, 32)}`;
                if (direct.memories.length >= DIRECT_LIMITS.memories) v.invalid("direct.memory", "Narrative memory capacity reached", "airp-capacity");
                direct.memories.push({...proposal, id, sceneId: scene.id, instanceId: task.instanceId, bodyHash: scene.bodyHash,
                  source: {...task.read!.head}, phase: task.read!.phase, actorIds: ["kael", "elora"], readFactIds: [...task.read!.factIds], committedFactId: fact.id});
                const flags = direct.flags[task.instanceId];
                for (const flag of proposal.flags) flags[flag.key] = true;
                task.memoryId = id;
              }
            }
          }
        }
      }
    }
  } else {
    const scene = narrative.scenes.find(s => s.id === narrative.reading?.sceneId);
    const instance = narrative.instances.find(i => i.id === scene?.instanceId);
    if (scene && instance?.definition.id === catalog.data.airpDirect.definitionId && ["return-cleared", "return-extracted"].includes(scene.role)) add(scene, "return");
    const task = direct.tasks.find(t => t.sceneId === scene?.id);
    if (task?.source === "browser-direct" && !task.read && narrative.reading?.completed && fact.kind === "airp" && fact.payload.command.type === "airp-read") {
      const factIds = input.facts.filter(f => f.kind === "airp" && f.payload.command.type === "airp-read" && f.payload.command.sceneId === scene!.id && !input.retracted.includes(f.id)).map(f => f.id);
      task.read = {head: {...input.head}, phase: airpPhaseIndex(input.before.clock.day, input.before.clock.phase), factIds, bodyHash: scene!.bodyHash};
    }
  }
  if (direct.tasks.length > DIRECT_LIMITS.tasks || Object.keys(direct.materials).length > DIRECT_LIMITS.materials || v.utf8Size(JSON.stringify(direct)) > DIRECT_LIMITS.stateBytes)
    v.invalid("direct", "Direct archive capacity exceeded; full material has not been truncated", "airp-capacity");
  checkAirpPoolCapacity(narrative);
  return {narrative, direct};
}
