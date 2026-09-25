import * as v from "../../game-core/contracts";
import { airpPhaseIndex, directorDay, directorHash, validateDirectorPlan } from "../../game-core/session";
import { airpEligible, type AirpReplayInput } from "../versions/airp-boundary";
import { DIRECTOR_RUNTIME_LIMITS, emptyDirectorState, type DirectorEvent, type DirectorJob, type DirectorState } from "./contracts";
import { parseDirectorIntent } from "./parse";
import { compileDirectorJob, directorStage, reduceDirectorJob } from "./jobs";
import { directorEntrance, directorEventSceneId, ongoingDirectorEvent, projectDirectorContext, projectDirectorScene } from "./context";
import { directorLowFrame } from "./low";
import { acceptLowDraft, readLowWriting } from "../airp-low/output";
import { projectGMContext, selectGMDocuments, resolveGMDocuments } from "./gm-context";
import { admitMemoryCorrections, correctionJson } from "../airp-memory/effective";
import { sceneMemoryContext } from "../airp-memory/d5";
import { coveredAcceptanceForChoice } from "./acceptance-coverage";
import { registeredPatrol, singlePathPatrol } from "./commissions";

function deny(message: string): never {return v.invalid("director", message, "command-not-available");}
const terminal = (e: DirectorEvent, phase: number, reason: DirectorEvent["closeReason"]) => {e.status = "closed"; e.endedPhase = phase; e.closeReason = reason;};
function newJob(id: string, state: DirectorState): DirectorJob {
  if (!state.materialHash) deny("Configure the model connection first");
  return {id, kind: "day", materialHash: state.materialHash, planning: null, scene: null, attempts: [], proposal: null, review: null, acceptedEntries: null, text: null};
}
/** Single writer for content19. The legacy round-robin pool is never invoked here. */
export function reduceDirectorCommit(catalog: v.ValidatedD5Catalog, previous: v.AirpNarrativeState, prior: DirectorState | undefined, input: AirpReplayInput) {
  if (!catalog.data.airpDirector || !prior && input.head.revision !== 0) deny("Missing director state");
  const state = structuredClone(prior ?? emptyDirectorState()), fact = input.group[0];
  const phase = airpPhaseIndex(input.after.clock.day, input.after.clock.phase), day = directorDay(phase);
  const context = (replaces: string[] = []) => {
    const c = projectDirectorContext(catalog, state, input);
    c.world.themes = c.world.themes.filter(t => !replaces.includes(t.sourceId));
    return c;
  };
  const remember = (id: string, text: string, actors: string[], evidenceIds = [fact.id], playerKnows = true) => {
    if (!state.memories.some(m => m.id === id)) state.memories.push({id, phase, text, knownBy: [...new Set([...(playerKnows ? ["kael"] : []), ...actors])], evidenceIds});
  };
  const next = (e: DirectorEvent, compact = false) => {
    state.reading = null;
    if (e.dialogueTurn !== undefined) e.dialogueTurn = 0;
    if (e.role === "acceptance") {
      e.status = e.card.actions.length ? "waiting-action" : "ready"; e.role = e.card.actions.length ? "action" : "result";
      // A single-path patrol is already agreed. Arm its evidence binding, not a new
      // literary pre-departure scene or an automatic departure/imaginary player choice.
      if (compact && e.card.actions[e.actionIndex]?.kind === "patrol" && e.card.actions[e.actionIndex].choices.length === 1) e.actionPhase ??= phase;
    }
    else if (e.role === "feedback") {
      if (e.actionOutcome === "succeeded") e.actionIndex++;
      else e.occurrence++;
      e.actionOutcome = null; e.binding = null; e.actionPhase = null;
      e.status = e.actionIndex < e.card.actions.length ? "waiting-action" : "ready"; e.role = e.status === "ready" ? "result" : "action";
      if (state.commissionVersion === 1 && singlePathPatrol(e)) e.actionPhase = phase;
    } else if (e.role === "result" || e.role === "followup") {
      e.status = "resolved"; e.endedPhase = phase;
      remember(`resolved:${e.id}`, `玩家已确认「${e.card.title}」结果并完成收尾。没有额外资产奖励。`, [e.card.giverId], [...e.evidenceIds, fact.id]);
    }
  };
  const requireEvent = (id: string) => state.events.find(e => e.id === id) ?? deny("Unknown event instance");
  const requireReadable = (e: DirectorEvent) => {if (!directorEntrance(e, context())) deny("Event actor is not reachable now");};
  const requireRead = (e: DirectorEvent) => {requireReadable(e); if (!e.readSceneIds.includes(directorEventSceneId(e))) deny("Read this scene before making its choice");};
  const gmContext = (intent: string) => {
    if ((state.lowContextVersion ?? 0) < 17) return {};
    const gmContext = projectGMContext(catalog, state, input);
    selectGMDocuments(state.lowMaterial!.sources, gmContext, intent);
    resolveGMDocuments(gmContext, state.materials[state.materialHash!].resources.sources);
    return {gmContext};
  };
  const sceneJob = (id: string, e: DirectorEvent): DirectorJob => {
    const scene = projectDirectorScene(catalog, state, e, input);
    const global = gmContext(scene.intent);
    const lowFrame = state.lowMaterial ? directorLowFrame(state.lowMaterial, scene, state.lowContextVersion, state.lowReadVersion === 6 ? 6 : state.lowReadVersion === 5 ? 5 : undefined) : undefined;
    // Keep every world entry already activated for this specific scene as well.
    if (global.gmContext && lowFrame) for (const s of lowFrame.sources) if (!global.gmContext.documents.some(d => d.id === s.id)) global.gmContext.documents.push({id: s.id, sha256: s.sha256});
    return { ...newJob(id, state), kind: "scene", scene, ...global, ...(lowFrame ? { lowFrame, ...(state.lowReadVersion ? { lowReadVersion: state.lowReadVersion } : {}), ...(state.lowContextVersion ? { lowContextVersion: state.lowContextVersion } : {}) } : {}) };
  };
  const openCurrent = (e: DirectorEvent) => {
    const id = directorEventSceneId(e);
    if (!state.jobs.some(j => j.id === id)) {
      const job = sceneJob(id, e); compileDirectorJob(state.materials[job.materialHash], job); state.jobs.push(job);
    }
    state.reading = {eventId: e.id, jobId: id, cursor: state.cursors[id] ?? 0, paused: false};
  };

  if (fact.kind === "airp-director") {
    if (input.group.length !== 1) deny("Director command needs an atomic fact group");
    const command = parseDirectorIntent(fact.payload).command;
    if (command.type === "airp-director-enable-commissions") {
      if (![22, 24, 26, 28].includes(catalog.ref.contentVersion) || input.after.activeRunRef) deny("Commission registration can only upgrade at home");
      state.commissionVersion = 1;
      // Preserve every saved scene/cursor. Old departures are never retroactively bound.
      for (const e of state.events) if (singlePathPatrol(e) && e.selected.length &&
        (e.status === "accepted" && e.role === "acceptance" || e.status === "waiting-action" && e.role === "action")) e.actionPhase ??= phase;
    } else if (command.type === "airp-director-configure") {
      if (state.jobs.some(j => j.attempts.some(a => a.status === "running"))) deny("Cannot replace configuration during a request");
      if (command.residentCast) {
        if (catalog.ref.contentVersion !== 28 || input.after.activeRunRef || state.reading && !state.reading.completed && !state.reading.paused) deny("Resident cast updates require the formal mansion checkpoint");
        for (const id of [...Object.keys(command.residentCast.locations), "household-guidance"]) {
          const source = command.material.resources.sources.find(s => s.id === id);
          const low = command.lowMaterial?.sources.find(s => s.id === id);
          if (!source || !low || source.sha256 !== v.sha256(source.text) || low.sha256 !== source.sha256 || low.text !== source.text || source.kind !== (id === "household-guidance" ? "world" : "character")) deny("Resident cast requires matching full originals and guidance");
        }
        state.residentCast = structuredClone(command.residentCast);
      }
      if (state.residentCast && !command.residentCast) {
        for (const id of [...Object.keys(state.residentCast.locations), "household-guidance"]) if (!command.material.resources.sources.some(s => s.id === id) || command.lowMaterial && !command.lowMaterial.sources.some(s => s.id === id)) deny("Configured residents cannot lose their original sources");
      }
      const key = directorHash(command.material);
      state.materials[key] = command.material; state.materialHash = key;
      if (command.lowMaterial) {
        if (![22, 24, 26, 28].includes(catalog.ref.contentVersion)) deny("Low day scenes require the formal content22 entry");
        state.lowMaterial = structuredClone(command.lowMaterial);
      }
      if (command.lowReadVersion) {
        if (![22, 24, 26, 28].includes(catalog.ref.contentVersion) || !state.lowMaterial) deny("Low reader requires formal Low material");
        state.lowReadVersion = command.lowReadVersion;
      }
      if (command.lowContextVersion) {
        if (![22, 24, 26, 28].includes(catalog.ref.contentVersion) || !state.lowMaterial) deny("Low handoff requires formal Low material");
        state.lowContextVersion = command.lowContextVersion;
      }
    } else if (command.type === "airp-director-prepare-day" || command.type === "airp-director-prepare-replan") {
      const today = state.days.find(d => d.day === day), replan = command.type === "airp-director-prepare-replan";
      const replaces = replan ? state.events.filter(e => today?.entryIds.includes(e.id) && e.publishedPhase === null && ["planned", "cancelled"].includes(e.status)).map(e => e.id) : [];
      if (!airpEligible(input.after) || (replan ? !today || !replaces.length : !!today)) deny("Only an unplanned checkpoint or an unpublished plan remainder can be arranged");
      const priorJobs = state.jobs.filter(j => j.kind === "day" && j.planning?.budget.day === day);
      if (priorJobs.some(j => j.attempts.some(a => a.status === "running")) || priorJobs.length >= 3) deny("Day revision limit or request in flight; original outputs retained");
      const job = newJob(`director-day:${day}:${priorJobs.length + 1}`, state);
      if (replan) job.replaces = replaces;
      job.planning = context(replaces);
      Object.assign(job, gmContext("安排今天的重点与旧事项"));
      compileDirectorJob(state.materials[job.materialHash], job); state.jobs.push(job);
    } else if (command.type === "airp-director-accept-day") {
      const job = state.jobs.find(j => j.id === command.jobId);
      const today = state.days.find(d => d.day === day);
      if (!job?.planning || !job.proposal || job.acceptedEntries === null || (job.replaces ? !today || today.jobId === job.id : !!today)) deny("No validated unaccepted plan for this day");
      if (job.replaces?.some(id => !today!.entryIds.includes(id) || requireEvent(id).publishedPhase !== null || !["planned", "cancelled"].includes(requireEvent(id).status))) deny("Replan cannot rewrite an already published or replaced entry");
      const accepted = validateDirectorPlan({...context(job.replaces), proposal: job.proposal, ...(job.review ? {review: job.review} : {})});
      const ids: string[] = [];
      for (const entry of accepted.entries) {
        const id = `director-event:${directorHash([input.head.saveId, input.head.epoch, job.id, entry.id]).slice(0, 32)}`; ids.push(id);
        const card = structuredClone(entry.card);
        if (entry.origin === "free") card.id = `director-free:${directorHash([job.id, entry.id, card]).slice(0, 32)}`;
        state.events.push({...entry, id, card, status: "planned", publishedPhase: null, expiresPhase: null, endedPhase: null,
          exposed: false, deferredUntil: 0, role: entry.parentId ? "followup" : "offer", actionIndex: 0, occurrence: 0,
          selected: [], evidenceIds: [fact.id], readSceneIds: [], actionPhase: null, actionOutcome: null, binding: null, closeReason: null, followupConsumed: false});
      }
      if (job.replaces) {
        for (const id of job.replaces) requireEvent(id).status = "cancelled";
        today!.entryIds = [...today!.entryIds.filter(id => !job.replaces!.includes(id)), ...ids]; today!.jobId = job.id;
      } else state.days.push({day, jobId: job.id, entryIds: ids});
    } else if (command.type === "airp-director-revalidate-low") {
      const job = state.jobs.find(j => j.id === command.jobId), attempt = job?.attempts.at(-1);
      if (command.readerVersion === 5) {
        if (!job?.lowFrame || job.text || job.attempts.some(a => a.status === "running")) deny("Only an idle unfinished Low scene can continue postprocessing");
        const writing = job.attempts.filter(a => a.stage === "writing").at(-1);
        job.lowReadVersion = 5;
        if (writing?.output && (writing.status === "succeeded" || writing.error === "invalid-output")) {
          job.lowWarnings = acceptLowDraft(writing.output, job.lowFrame, 5).warnings;
          if (writing.status === "failed") job.lowRevalidatedWriting = writing.id;
        }
      } else {
      if (!job?.lowFrame || directorStage(job) !== "writing" || !attempt?.output || attempt.stage !== "writing" || attempt.status !== "failed" || attempt.error !== "invalid-output") deny("No failed stored Low writing to revalidate");
      const read = readLowWriting(attempt.output, job.lowFrame, command.readerVersion);
      job.lowReadVersion = command.readerVersion; job.lowRevalidatedWriting = attempt.id; job.lowWarnings = read.warnings;
      }
    } else if (command.type === "airp-director-reconnect") {
      const job = state.jobs.find(j => j.id === command.jobId), stage = job && directorStage(job);
      const prior = job?.attempts.filter(a => a.stage === stage).at(-1);
      if (!job?.lowFrame || !prior || prior.status !== "failed" || !["writing", "formatting", "scene-plan", "scene-evaluate"].includes(stage!) || job.attempts.some(a => a.status === "running") || (job.connections?.length ?? 0) >= 12) deny("Only a failed Low/scene-GM stage can explicitly change connection");
      (job.connections ??= []).push({ stage: stage as "writing" | "formatting" | "scene-plan" | "scene-evaluate", afterAttemptId: prior.id, config: command.config });
    } else if (command.type === "airp-director-prepare-memory") {
      const source = state.jobs.find(j => j.id === command.jobId && j.kind === "scene");
      if (!source?.scene || !source.text || !state.memories.some(m => m.id === `memory:${source.id}`)) deny("Only a completely read scene can be excerpted");
      const id = `excerpt:${source.id}`;
      if (state.jobs.some(j => j.id === id)) deny("Excerpt task already exists; resume it instead");
      const job = {...newJob(id, state), materialHash: source.materialHash, kind: "memory" as const, scene: source.scene, text: source.text};
      compileDirectorJob(state.materials[job.materialHash], job); state.jobs.push(job);
    } else if (command.type === "airp-director-begin" || command.type === "airp-director-result" || command.type === "airp-director-fail" || command.type === "airp-director-use-format") {
      const index = state.jobs.findIndex(j => j.id === command.jobId), job = state.jobs[index];
      if (!job) deny("Unknown task");
      if (command.type === "airp-director-begin" && job.kind === "scene" && job.scene) {
        const event = requireEvent(job.scene.eventId);
        if (directorEventSceneId(event) !== job.scene.sceneId || ["reserve", "cancelled"].includes(event.status)) deny("This scene has expired or moved to another step");
      }
      state.jobs[index] = reduceDirectorJob(job, state.materials[job.materialHash], command, state.lowMaterial);
      const updated = state.jobs[index], memory = updated.gmContext?.memoryContext;
      if (command.type === "airp-director-result" && memory) {
        const attempt = updated.attempts.find(a => a.id === command.attemptId)!;
        if (attempt.status === "succeeded" && ["director", "scene-evaluate"].includes(attempt.stage)) {
          const context = updated.scene ? sceneMemoryContext(memory, updated.id, updated.scene.actorIds, updated.text!.lines) : memory;
          (updated.memoryCorrections ??= []).push(...admitMemoryCorrections(correctionJson(command.output), context, {jobId: updated.id, attemptId: attempt.id, recordedHead: input.head}));
        }
      }
      const excerpt = state.jobs[index].excerpt;
      if (excerpt) remember(`excerpt:${excerpt.sourceSceneId}`, excerpt.quotes.map(q => q.text).join("\n"), job.scene!.actorIds,
        [...state.memories.find(m => m.id === `memory:${excerpt.sourceSceneId}`)!.evidenceIds, fact.id]);
    } else if (command.type === "airp-director-pause") {
      if (state.reading) state.reading.paused = true;
    } else if (command.type === "airp-director-open") {
      const e = requireEvent(command.eventId); requireReadable(e);
      if (e.actionPhase !== null && e.role === "action") deny("The current action is waiting for game evidence");
      const id = directorEventSceneId(e);
      let job = state.jobs.find(j => j.id === id);
      if (!job && !(e.role === "result" && e.delivery?.status === "pending")) {
        job = sceneJob(id, e);
        compileDirectorJob(state.materials[job.materialHash], job); state.jobs.push(job);
      }
      state.reading = {eventId: e.id, jobId: id, cursor: state.cursors[id] ?? 0, paused: false};
    } else if (command.type === "airp-director-show") {
      const job = state.jobs.find(j => j.id === command.jobId), reading = state.reading;
      if (!job?.text || !reading || reading.paused || reading.jobId !== job.id) deny("No generated scene to display");
      if ((job.lowContextVersion ?? 0) >= 14 && !job.sceneGMEvaluation) deny("Scene GM evaluation is still pending; saved prose is retained");
      const e = requireEvent(reading.eventId); requireReadable(e);
      if (directorEventSceneId(e) !== job.id) deny("Scene no longer current");
      e.exposed = true; state.cursors[job.id] ??= 0;
    } else if (command.type === "airp-director-respond") {
      const reading = state.reading, job = state.jobs.find(j => j.id === command.jobId);
      if (!reading || reading.paused || reading.jobId !== command.jobId || !job?.text || (job.lowContextVersion ?? 0) < 8 || job.lowResponse || reading.cursor !== job.text.lines.length - 1 || state.cursors[job.id] === undefined) deny("No current final-paragraph attitude to select");
      if ((job.lowContextVersion ?? 0) >= 14 && !job.sceneGMEvaluation) deny("Scene GM evaluation is still pending");
      const e = requireEvent(reading.eventId); requireReadable(e);
      if (directorEventSceneId(e) !== job.id) deny("Scene no longer current");
      const text = job.lowChoices?.[command.index]; if (!text) deny("Unknown generated attitude");
      job.lowResponse = { index: command.index, text, sourceId: fact.id }; e.evidenceIds.push(fact.id);
      remember(`attitude:${fact.id}`, `玩家对「${e.card.title}」选定的回应态度：${text}。此记录不是接受、拒绝、交付或任务执行。`, job.scene!.actorIds);
    } else if (command.type === "airp-director-read") {
      const reading = state.reading, job = state.jobs.find(j => j.id === command.jobId);
      if (!reading || reading.paused || reading.jobId !== command.jobId || reading.cursor !== command.cursor || state.cursors[command.jobId] === undefined || !job?.text || command.cursor >= job.text.lines.length) deny("Invalid or duplicate reading cursor");
      if ((job.lowContextVersion ?? 0) >= 14 && !job.sceneGMEvaluation) deny("Scene GM evaluation is still pending");
      const e = requireEvent(reading.eventId); requireReadable(e);
      if (directorEventSceneId(e) !== job.id) deny("Scene no longer current");
      if ((job.lowContextVersion ?? 0) >= 8 && command.cursor === job.text.lines.length - 1 && job.lowChoices?.length && !job.lowResponse) deny("Select a response before completing this scene");
      e.exposed = true; e.evidenceIds.push(fact.id); reading.cursor++; state.cursors[job.id] = reading.cursor;
      if (reading.cursor === job.text.lines.length) {
        e.readSceneIds.push(job.id);
        remember(`memory:${job.id}`, job.text.lines.map(l => `${l.speaker}：${l.text}`).join("\n"), job.scene!.actorIds,
          input.facts.filter(f => f.kind === "airp-director" && f.payload.command.type === "airp-director-read" && f.payload.command.jobId === job.id).map(f => f.id));
        if ((job.lowContextVersion ?? 0) >= 11) {
          if (!job.lowPhase) deny("Missing current dialogue phase decision");
          if (!job.lowPhase.complete) {
            // The response belongs to THIS stage. Do not resolve a task or
            // return to the mansion until a later formatted turn concludes it.
            e.dialogueTurn = (e.dialogueTurn ?? 0) + 1;
            openCurrent(e);
          } else if (e.role !== "offer" && e.role !== "action") {
            next(e, true);
            state.reading = {...reading, completed: true};
          }
        } else if (e.role !== "offer" && e.role !== "action") next(e, (job.lowContextVersion ?? 0) >= 8);
      }
    } else {
      const e = requireEvent(command.eventId);
      if (command.type === "airp-director-deliver") {
        if (![22, 24, 26, 28].includes(catalog.ref.contentVersion) || e.status !== "ready" || e.role !== "result" || !e.delivery) deny("No returned objective awaits delivery");
        requireReadable(e);
        if (e.delivery.status !== "confirmed") {
          if (e.delivery.itemInstanceId) {
            const owned = state.questItems?.find(q => q.item.instanceId === e.delivery!.itemInstanceId);
            if (!owned || owned.status !== "owned" || owned.item.eventId !== e.id || owned.item.runId !== e.delivery.runId) deny("The returned quest item is not owned or has already been handed over");
            owned.status = "delivered"; owned.deliveredFactId = fact.id;
          }
          e.delivery.status = "confirmed"; e.delivery.confirmedFactId = fact.id; e.evidenceIds.push(fact.id);
          remember(`delivery:${e.id}`, `玩家已明确交付「${e.card.title}」的任务目标；${e.delivery.itemInstanceId ? "已从任务物品背包取出并交给委托人。" : "沿用本趟成功带回证据，不额外发放或扣除普通战利品。"}`, [e.card.giverId], [e.delivery.returnFactId, fact.id]);
        }
        const id = directorEventSceneId(e);
        if (!state.jobs.some(j => j.id === id)) {
          const job = sceneJob(id, e);
          compileDirectorJob(state.materials[job.materialHash], job); state.jobs.push(job);
        }
        state.reading = {eventId: e.id, jobId: id, cursor: state.cursors[id] ?? 0, paused: false};
      } else if (command.type === "airp-director-defer") {
        if (e.status !== "offered") deny("Only an unaccepted offer can be deferred");
        requireReadable(e); e.deferredUntil = phase + 1; state.reading = null;
      } else if (command.type === "airp-director-decline") {
        if (e.status !== "offered" || e.role !== "offer") deny("Only an offer may be declined");
        requireRead(e); const interactive = (state.jobs.find(j => j.id === directorEventSceneId(e))?.lowContextVersion ?? 0) >= 11;
        terminal(e, phase, "declined"); e.role = "declined"; state.reading = null;
        remember(`decision:${fact.id}`, `玩家明确拒绝了「${e.card.title}」。没有执行任务。`, [e.card.giverId]);
        if (interactive) { e.dialogueTurn = 0; openCurrent(e); }
      } else if (command.type === "airp-director-choose") {
        requireRead(e);
        const isOffer = e.status === "offered" && e.role === "offer", action = e.card.actions[e.actionIndex];
        if (!isOffer && (e.status !== "waiting-action" || e.role !== "action" || e.actionPhase !== null)) deny("No current choice");
        const choice = (isOffer ? e.card.choices : action.choices).find(c => c.id === command.choiceId);
        if (!choice) deny("Unknown choice");
        const source = state.jobs.find(j => j.id === directorEventSceneId(e)), reading = state.reading;
        const version = source?.lowContextVersion ?? 0;
        const covered = isOffer ? coveredAcceptanceForChoice(state, e, source, choice.id, phase) : null;
        e.selected.push({...choice, sourceId: fact.id}); e.evidenceIds.push(fact.id); state.reading = null;
        remember(`decision:${fact.id}`, `玩家${isOffer ? "接受提议" : "选择本步骤做法"}「${e.card.title}」：${choice.label}。${choice.intent}`, [isOffer ? e.card.giverId : action.actorId]);
        if (isOffer) {
          const compact = version >= 8 && version < 11;
          e.status = compact && !e.card.actions.length ? "ready" : "accepted"; e.role = compact && !e.card.actions.length ? "result" : "acceptance";
          if (version >= 9 && version < 11 && e.card.actions.length === 1 && action.kind === "patrol" && action.choices.length === 1) {
            e.status = "waiting-action"; e.role = "action"; e.actionPhase = phase;
          }
          if (state.commissionVersion === 1 && singlePathPatrol(e)) e.actionPhase = phase;
        }
        else {
          e.actionPhase = phase;
          if (action.kind === "talk" || action.kind === "do") {
            e.actionOutcome = "succeeded"; e.status = "feedback"; e.role = "feedback";
            remember(`action:${fact.id}`, `玩家已执行本步骤的「${choice.label}」，仅限${action.kind === "talk" ? "当面询问／交谈" : "当场行动"}，下一场应反馈此做法；不等于整件任务结束。`, [action.actorId]);
          }
        }
        if (version >= 11) {
          e.dialogueTurn = 0;
          if (covered && e.role === "acceptance") {
            (e.narrativeSkips ??= []).push({...covered, role: "acceptance", sourceJobId: source!.id, decisionFactId: fact.id, phase});
            next(e, true);
            state.reading = {...reading!, completed: true};
          } else if (e.role === "acceptance" || e.role === "feedback") openCurrent(e);
        }
      }
    }
  } else {
    if (fact.kind === "airp" || fact.kind === "airp-direct" || fact.kind === "airp-online") deny("Legacy event writers are disabled in content19");
    if (state.reading && !state.reading.paused) deny("Pause the scene before leaving or advancing time");
    for (const e of state.events) {
      const action = e.card.actions[e.actionIndex];
      if (!registeredPatrol(e) && (e.status !== "waiting-action" || e.actionPhase === null)) continue;
      if (action?.kind === "wait" && e.actionPhase !== null && phase >= e.actionPhase + action.phases) {
        e.status = "feedback"; e.role = "feedback"; e.actionOutcome = "succeeded"; e.evidenceIds.push(fact.id);
        remember(`wait:${fact.id}:${e.id}`, `「${e.card.title}」约定等待的${action.phases}个游戏相位已过去；不自动完成后续行动。`, [action.actorId]);
      }
      if (action?.kind !== "patrol") continue;
      const objective = catalog.data.airpDirector!.capabilities.objectives[action.objectiveId];
      const departure = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-started");
      if (departure?.kind === "progression" && departure.payload.type === "expedition-started" && departure.payload.routeId === objective.routeId && input.run && !e.binding) {
        const roomId = input.run.run.roomIds[objective.layer - 1]?.[objective.roomIndex];
        const reward = input.run.run.commissionRewards?.manifest.find(r => r.eventId === e.id && r.stepId === action.id);
        if (input.run.run.commissionRewards && !reward) deny("Accepted commission is missing its frozen reward placement");
        if (roomId) e.binding = {runId: input.run.run.id, roomId, startFactId: departure.id, ...(reward ? {rewardDefinitionId: reward.definitionId} : {})};
      }
      const settlement = input.group.find(f => f.kind === "progression" && f.payload.type === "expedition-settled");
      if (e.binding && settlement?.kind === "progression" && settlement.payload.type === "expedition-settled" && settlement.payload.terminal.runId === e.binding.runId) {
        const b = e.binding, proof = input.facts.find(f => f.kind === "journey" && f.runRef?.id === b.runId && !input.retracted.includes(f.id) && f.payload.events.some(event => event.type === "room-completed" && (event.payload as {roomId?: string}).roomId === b.roomId));
        const item = settlement.payload.terminal.commissionRewards?.returned.find(i => i.definitionId === b.rewardDefinitionId && i.eventId === e.id && i.stepId === action.id);
        const success = b.rewardDefinitionId ? !!item : !!proof && ["cleared", "extracted"].includes(settlement.payload.terminal.outcome);
        if (item) {
          const inventory = state.questItems ??= [];
          if (inventory.some(q => q.item.instanceId === item.instanceId)) deny("Quest item was already received");
          inventory.push({item: structuredClone(item), status: "owned", receivedFactId: settlement.id, deliveredFactId: null});
        }
        if ([22, 24, 26, 28].includes(catalog.ref.contentVersion) && success) e.delivery = { ...(item ? {itemInstanceId: item.instanceId} : {}), runId: b.runId, returnFactId: settlement.id, status: "pending", confirmedFactId: null };
        e.actionOutcome = success ? "succeeded" : "failed"; e.status = "feedback"; e.role = "feedback";
        if (state.commissionVersion === 1) {
          if (state.reading?.eventId === e.id) state.reading = null;
          if (e.dialogueTurn !== undefined) e.dialogueTurn = 0;
        }
        const evidence = [b.startFactId, ...(proof ? [proof.id] : []), settlement.id]; e.evidenceIds.push(...evidence);
        remember(`action:${settlement.id}:${e.id}`, `「${e.card.title}」本次巡守${success ? "到达目标并成功带回" : "未满足带回目标条件"}；结算结果${settlement.payload.terminal.outcome}。`, [action.actorId], evidence);
        const compact = state.jobs.some(j => j.scene?.eventId === e.id && j.scene.role === "offer" && (j.lowContextVersion ?? 0) >= 9);
        if (success && compact && e.card.actions.length === 1 && action.choices.length === 1) {
          // Return is a program fact. Wait for explicit handover, then narrate its
          // consequence once. The result settlement still receives the actual run.
          e.status = "ready"; e.role = "result"; e.actionIndex = 1;
          e.actionOutcome = null; e.binding = null; e.actionPhase = null;
        }
      }
    }
  }

  // Expiry uses game phases and actual exposure, never request-start or wall clock.
  for (const e of state.events) {
    if (e.status === "planned" && phase > e.throughPhase) {e.status = "cancelled"; continue;}
    if (e.status === "offered" && e.expiresPhase !== null && phase >= e.expiresPhase) {
      if (e.card.volatility === "inert" && !e.exposed) {e.status = "reserve";}
      else {
        terminal(e, phase, e.card.volatility === "consequential" ? "missed" : "expired");
        if (e.card.aftermath) {e.role = "aftermath"; remember(`aftermath:${e.id}`, e.card.aftermath.intent, e.card.aftermath.actorIds, [fact.id], false);}
        else e.readSceneIds.push(directorEventSceneId(e));
      }
      if (state.reading?.eventId === e.id) state.reading = null;
    }
  }
  if (airpEligible(input.after)) for (const e of state.events) {
    if (e.status !== "planned" || phase < e.fromPhase || phase > e.throughPhase) continue;
    const c = context();
    if (c.world.busyFocus || c.world.requiredStoryIds.length || ongoingDirectorEventForActor(state, e)) continue;
    // Re-check location and sources at publication; an internal reservation is not an offer.
    const offered = {...e, status: "offered" as const};
    if (!directorEntrance(offered, c) || e.basisIds.some(id => !c.world.sourceIds.includes(id))) continue;
    let budget = state.budgets.find(b => b.day === day);
    if (!budget) {budget = v.emptyDirectorBudget(day); state.budgets.push(budget);}
    if (budget.publishedIds.length >= 2 || (e.card.load === "focus" ? budget.focusIds.length >= 1 : budget.lightIds.length >= 1)) continue;
    e.status = "offered"; e.publishedPhase = phase; e.expiresPhase = phase + e.card.offerPhases;
    budget.publishedIds.push(e.id); (e.card.load === "focus" ? budget.focusIds : budget.lightIds).push(e.id);
    if (e.parentId) requireEvent(e.parentId).followupConsumed = true;
    if (e.reserveId) requireEvent(e.reserveId).status = "cancelled";
  }
  if (state.events.length > DIRECTOR_RUNTIME_LIMITS.events || state.jobs.filter(j => j.kind === "scene").length > DIRECTOR_RUNTIME_LIMITS.scenes || state.jobs.filter(j => j.kind === "day").length > DIRECTOR_RUNTIME_LIMITS.dayJobs || Object.keys(state.materials).length > DIRECTOR_RUNTIME_LIMITS.materials || v.utf8Size(JSON.stringify(state)) > DIRECTOR_RUNTIME_LIMITS.stateBytes)
    v.invalid("director", "Archive capacity reached; existing evidence is retained, no source text was truncated", "airp-capacity");
  return {narrative: previous, director: state};
}
function ongoingDirectorEventForActor(state: DirectorState, e: DirectorEvent) {
  return state.events.some(other => other.id !== e.id && ongoingDirectorEvent(other) && other.card.giverId === e.card.giverId);
}
