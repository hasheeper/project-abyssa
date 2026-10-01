import type { DirectorJob, DirectorEvent } from "../../game-application/airp-director/contracts";
import type { AirpPoolScene } from "../../game-core/contracts";
import type { NodeJob } from "../../game-application/airp-expedition-play/contracts";
import { actorName, headKey, journalLocation, type JournalRecord, type JournalFact, type JournalBuilder } from "./common";
import type { NarrativeMarker } from "../../content/presentation/narrative-layout";
import { airpExpeditionBackground } from "../../content/presentation/airp-expedition";
import { commissionRouteName } from "../airp-commission-view";

/** A public description of the recorded situation, never the GM's synopsis or intent. */
const directorSummary = (scene: NonNullable<DirectorJob["scene"]>) =>
  `${journalLocation(scene.locationId) ?? "洋馆"}里围绕「${scene.card.title}」的交谈。`;

/** Saved program context supplies the boundaries; writing jobs never supply identities. */
export function directorNarrative(scene: NonNullable<DirectorJob["scene"]>): NarrativeMarker {
  const base = { eventDefinitionId: scene.card.id, surface: "adv" as const };
  if (scene.role === "offer" || scene.role === "acceptance") return { ...base, actId: "invitation", actTitle: "相遇与约定", sliceId: `invitation.${scene.role}` };
  if (scene.role === "action" || scene.role === "feedback") return { ...base, actId: `action.${scene.actionIndex}.${scene.occurrence}`,
    actDefinitionId: scene.card.actions[scene.actionIndex]?.id ?? `action.${scene.actionIndex}`, sliceDefinitionId: scene.role,
    actTitle: "行动与反馈", sliceId: `action.${scene.actionIndex}.${scene.occurrence}.${scene.role}` };
  if (scene.role === "result" || scene.role === "declined") return { ...base, actId: "resolution", actTitle: "事情的结果", sliceId: `resolution.${scene.role}` };
  return { ...base, actId: scene.role, actTitle: "后续谈话", sliceId: scene.role };
}

export function directorJournal(records: readonly JournalRecord[], facts: readonly JournalFact[], out: JournalBuilder) {
  const jobs = new Map<string, DirectorJob>(), events = new Map<string, DirectorEvent>();
  for (const { record } of records) {
    for (const job of record.airpDirector?.jobs ?? []) if (job.kind === "scene") jobs.set(job.id, job);
    for (const event of record.airpDirector?.events ?? []) events.set(event.id, event);
  }
  const cursors = new Map<string, number>(), latest = new Map<string, DirectorJob>();
  for (const item of facts) {
    if (item.fact.kind !== "airp-director") continue;
    const c = item.fact.payload.command;
    if (c.type === "airp-director-read") {
      const job = jobs.get(c.jobId), scene = job?.scene, line = job?.text?.lines[c.cursor];
      if (!job || !scene || !line || c.cursor !== (cursors.get(job.id) ?? 0)) { out.issue("洋馆对话", "部分对话缺少连续的已读原文，暂未完整收录。"); continue; }
      cursors.set(job.id, c.cursor + 1); latest.set(scene.eventId, job);
      const narrative = directorNarrative(scene);
      narrative.complete = scene.role !== "offer" && scene.role !== "action" && c.cursor === job.text!.lines.length - 1
        && job.lowPhase?.complete !== false && !!events.get(scene.eventId)?.readSceneIds.includes(job.id);
      const base = { kind: "director" as const, occurrence: scene.eventId, episode: true, narrative, sceneId: job.id, title: scene.card.title,
        summary: directorSummary(scene), participantIds: scene.actorIds, location: journalLocation(scene.locationId) };
      const stage = { background: { kind: "mansion" as const, locationId: scene.locationId, phase: scene.phase },
        actorId: line.speaker === "narrator" ? undefined : line.speaker, emotion: line.emotion, offstageActorId: "kael" };
      out.add(item, { ...base, lineId: `line:${c.cursor}`, blocks: [{ text: line.text, speaker: actorName(line.speaker, item), stage }] });
      // An attitude is selected before acknowledging the final paragraph. Display it
      // after that paragraph while retaining the selection's own source receipt.
      if (c.cursor === job.text!.lines.length - 1 && job.lowResponse) {
        const response = job.lowResponse;
        const proof = facts.find(f => f.fact.id === response.sourceId && f.fact.kind === "airp-director" && f.fact.payload.command.type === "airp-director-respond" && f.fact.payload.command.jobId === job.id && f.fact.payload.command.index === response.index);
        if (proof && job.lowChoices?.[response.index] === response.text) out.add(proof, { ...base, lineId: "response", order: item.sequence + .5,
          blocks: [{ text: response.text, kind: "choice", choice: { choiceId: `${job.id}:attitude`, optionId: `attitude:${response.index}` }, stage: { background: stage.background, offstageActorId: "kael" } }] });
      }
    } else if (c.type === "airp-director-choose") {
      const job = latest.get(c.eventId), scene = job?.scene;
      const choice = events.get(c.eventId)?.selected.find(s => s.sourceId === item.fact.id && s.id === c.choiceId);
      const narrative = scene && directorNarrative(scene);
      // A GM-covered acceptance has no additional prose. The actual player
      // decision closes that act; a predicted skip by itself never does.
      if (narrative && job && events.get(c.eventId)?.narrativeSkips?.some(skip => skip.decisionFactId === item.fact.id && skip.sourceJobId === job.id)
        && cursors.get(job.id) === job.text?.lines.length) narrative.complete = true;
      if (job && scene && choice && cursors.get(job.id) === job.text?.lines.length && job.lowPhase?.complete !== false) out.add(item, { kind: "director", occurrence: scene.eventId, episode: true, narrative: narrative!, sceneId: job.id, lineId: `choice:${item.fact.id}`, title: scene.card.title,
        summary: directorSummary(scene), participantIds: scene.actorIds,
        blocks: [{ text: choice.label, kind: "choice", choice: { choiceId: `${scene.eventId}:decision`, optionId: choice.id }, stage: { background: { kind: "mansion", locationId: scene.locationId, phase: scene.phase }, offstageActorId: "kael" } }] });
      else out.issue("洋馆对话", "部分行动选择缺少对应的对话来源，暂未收录。");
    }
  }
}

/** AIRP 1 / Pool / online / browser-direct all acknowledge their frozen nodes.
 * Never reuse the live view's 'current node + 1' exposure allowance here. */
export function poolJournal(records: readonly JournalRecord[], facts: readonly JournalFact[], out: JournalBuilder) {
  const scenes = new Map<string, AirpPoolScene>();
  for (const { record } of records) for (const scene of record.narrative?.scenes ?? []) scenes.set(scene.id, scene);
  const choices = new Map<string, "A" | "B" | "C">();
  for (const item of facts) {
    if (item.fact.kind !== "airp") continue;
    const c = item.fact.payload.command;
    if (c.type !== "airp-read" && c.type !== "airp-accept") continue;
    const scene = scenes.get(c.sceneId), node = scene?.body.nodes.find(n => n.id === c.nodeId);
    if (!scene || !node || scene.instanceId !== c.instanceId) { out.issue("早期洋馆对话"); continue; }
    const base = { kind: "airp" as const, occurrence: scene.instanceId, sceneId: scene.id, lineId: node.id, title: scene.body.title };
    if (node.kind === "choice" && c.type === "airp-accept") {
      const selected = node.options.find(o => o.id === c.optionId);
      if (!selected) { out.issue("早期洋馆对话"); continue; }
      choices.set(`${scene.id}:${node.id}`, c.optionId);
      out.add(item, { ...base, blocks: [{ text: selected.label, kind: "choice" }] });
    } else if (c.type === "airp-read" && node.kind !== "choice") {
      const selected = node.kind === "branch" ? choices.get(`${scene.id}:${node.choiceId}`) : null;
      const frames = node.kind === "beat" ? node.frames : selected ? node.variants[selected] : null;
      if (!frames) { out.issue("早期洋馆对话", "部分对话缺少当时的选择，未推测后续分支。"); continue; }
      out.add(item, { ...base, blocks: frames.map(f => ({ text: f.text, speaker: f.kind === "dialogue" ? actorName(f.actorId, item) : undefined })) });
    }
  }
}

export function expeditionJournal(records: readonly JournalRecord[], facts: readonly JournalFact[], out: JournalBuilder) {
  const jobs = new Map<string, { job: NodeJob; planId: string; owner: JournalRecord }>();
  for (const owner of records) for (const [planId, ledger] of Object.entries(owner.record.airpGame?.nodes ?? {})) {
    for (const job of ledger.jobs) jobs.set(`${headKey(owner.record.head)}:${planId}:${job.id}`, { job, planId, owner });
  }
  const byHead = new Map(facts.filter(f => f.fact.kind === "airp-game" && f.fact.payload.kind === "node" && f.fact.payload.world).map(f => [headKey(f.fact.source), f]));
  for (const { job, planId, owner } of jobs.values()) {
    const plan = owner.record.airpGame?.gm.jobs.find(plan => plan.id === planId);
    const frame = plan?.frames.at(-1), slot = frame?.context.rules.slots.find(slot => slot.id === job.node.slotId);
    if (!job.reads.length) continue;
    if (!frame || !slot || !job.frame) { out.issue("远征对话"); continue; }
    const route = commissionRouteName(frame.departure.routeId), link = job.node.link;
    const event = link?.kind === "new-event" ? plan?.prepared?.events.find(e => e.key === link.eventKey) : undefined;
    const commission = link?.kind === "commission" ? frame.context.rules.commissions.find(c => c.eventId === link.eventId) : undefined;
    const title = event?.body.title ?? commission?.title ?? `${route} · 远征途中`;
    const occurrence = `${planId}:${event?.id ?? commission?.eventId ?? "exploration"}`;
    const actTitle = `${slot.layer}层 · ${slot.roomIndex + 1}处${slot.timing === "arrive" ? " · 抵达" : slot.timing === "cleared" ? " · 战斗之后" : " · 离开"}`;
    const narrative: NarrativeMarker = { eventDefinitionId: event?.definitionId ?? commission?.definitionId ?? frame.departure.routeId,
      actId: job.node.id, actTitle, sliceId: job.id, surface: "adv" };
    const base = { kind: "expedition" as const, occurrence, episode: true, narrative, sceneId: job.id, title,
      summary: `${route}探索途中发生的交谈。`, location: route, participantIds: job.node.actorIds };
    const background = { kind: "asset" as const, url: airpExpeditionBackground(frame.departure.routeId) };
    let provenReads = 0;
    for (let i = 0; i < job.reads.length; i++) {
      const item = byHead.get(headKey(job.reads[i])), line = job.text?.lines[i];
      if (!item || !line) { out.issue("远征对话"); break; }
      provenReads++;
      out.add(item, { ...base, lineId: `line:${i}`, blocks: [{ text: line.text, speaker: actorName(line.speaker, item),
        stage: { background, actorId: line.speaker === "narrator" ? undefined : line.speaker, emotion: line.emotion, offstageActorId: "kael" } }] });
    }
    if (job.selected && provenReads === job.text?.lines.length) {
      const item = byHead.get(headKey(job.selected.head));
      if (item && job.text.choices[job.selected.index] === job.selected.text) out.add(item, { ...base, narrative: { ...narrative, complete: true }, lineId: "choice",
        blocks: [{ text: job.selected.text, kind: "choice", choice: { choiceId: `${job.id}:attitude`, optionId: `attitude:${job.selected.index}` }, stage: { background, offstageActorId: "kael" } }] });
    }
  }
}
