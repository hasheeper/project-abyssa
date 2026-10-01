import type { D5Fact, D5GameRecord } from "../../game-application/versions/d5-contracts";
import type { ValidatedD5Catalog } from "../../game-core/contracts";
import { sha256 } from "../../game-core/contracts";
import type { MemoryBlock, MemoryEntry, MemoryJournalIssue, MemorySource } from "../memory-journal-types";
import { deriveStageSlots, type NarrativeMarker } from "../../content/presentation/narrative-layout";
import { narrativeSnapshot, narrativeReceiptText, type NarrativeAct, type NarrativeClock, type NarrativeFrame, type NarrativeReceipt, type NarrativeSlice, type NarrativeSnapshot, type NarrativeStep } from "../memory-narrative";

export type JournalRecord = { record: D5GameRecord; catalog: ValidatedD5Catalog };
export type JournalFact = JournalRecord & { fact: D5Fact; sequence: number };
export const headKey = (head: D5GameRecord["head"]) => JSON.stringify([head.saveId, head.epoch, head.revision]);
export const phaseNames = { dawn: "清晨", day: "白昼", dusk: "黄昏", night: "夜晚" };
const residentNames: Record<string, string> = { tibby: "缇比", abyssa: "艾比希斯", alvitr: "阿尔薇特", lenore: "蕾诺尔", vivienne: "薇薇安" };
const places: Record<string, string> = { maid: "女仆长室", dining: "餐厅", array: "结界核心", abyssa: "魔王的房间", terrace: "露台", plaza: "小广场", greenhouse: "温室药圃", elora: "艾洛拉的房间", eustice: "尤斯缇丝的房间", kororo: "柯萝萝的房间", norma: "诺玛的房间", tibby: "缇比的杂货铺", "mansion.common-room": "公共休息室" };
export const journalLocation = (id: string) => places[id];

/** Fact ownership and commit membership matter even for inherited snapshots. */
export function journalFacts(records: readonly JournalRecord[]): JournalFact[] {
  const retracted = new Set(records.flatMap(r => r.record.retractedFactIds));
  const result: JournalFact[] = [];
  for (const owner of records) {
    const { record } = owner;
    const commits = new Map(record.commits.map(c => [headKey(c.ref), new Set(c.factIds)]));
    for (const fact of [...record.facts].sort((a, b) => a.source.revision - b.source.revision)) {
      if (retracted.has(fact.id) || fact.source.saveId !== record.head.saveId || fact.source.epoch !== record.head.epoch || fact.source.revision > record.head.revision || !commits.get(headKey(fact.source))?.has(fact.id)) continue;
      result.push({ ...owner, fact, sequence: result.length });
    }
  }
  return result;
}

export function journalText(text: string, record: D5GameRecord) {
  return text.replaceAll("{{user}}", record.snapshot.campaign.playerName || "你");
}
export function actorName(id: string | undefined, owner: JournalRecord): string | undefined {
  if (!id || id === "narrator" || id === "旁白") return undefined;
  if (id === "kael" || id === "{{user}}" || id === "user") return owner.record.snapshot.campaign.playerName || "你";
  return owner.catalog.data.characters[id]?.name ?? residentNames[id] ?? id;
}

export type JournalFragment = { kind: MemorySource["kind"]; occurrence: string; sceneId: string; lineId: string; title: string; summary?: string; iconKeywords?: MemoryEntry["iconKeywords"]; location?: string; order?: number;
  /** Present in this acknowledged scene, including participants who did not speak. */
  participantIds?: readonly string[];
  /** The opening is two continuous episodes, even across clock checkpoints. */
  episode?: boolean; acquisition?: MemorySource["acquisition"]; narrative?: NarrativeMarker;
  receipts?: readonly Omit<NarrativeReceipt, "kind" | "id" | "source">[];
  blocks: readonly Omit<MemoryBlock, "source">[] };
const identity = (kind: string, parts: unknown[]) => `${kind}:${sha256(JSON.stringify(parts)).slice(0, 32)}`;
function journalClock(item: JournalFact): NarrativeClock | null {
  const time = item.fact.worldTime;
  return time && Number.isInteger(time.day) && time.day >= 1 && Object.hasOwn(phaseNames, time.phase) ? { day: time.day, phase: time.phase } : null;
}
export function createJournalBuilder(journeyId: string) {
  type Recorded = { part: JournalFragment; source: MemorySource; blocks: MemoryBlock[]; time: NarrativeClock | null; position: number };
  const groups = new Map<string, { entry: MemoryEntry; parts: Recorded[] }>();
  const issues: MemoryJournalIssue[] = [];
  const seen = new Set<string>();
  return {
    issues,
    issue(source: string, message = "这部分经历缺少可核对的原文，暂未收录。") {
      if (!issues.some(i => i.source === source)) issues.push({ source, message });
    },
    add(item: JournalFact, part: JournalFragment) {
      if (!part.blocks.some(b => b.text.trim() || b.frame?.kind === "direction") && !part.receipts?.length) return;
      const clock = journalClock(item);
      const day = clock?.day ?? null;
      const phase = clock && phaseNames[clock.phase] || "";
      const id = identity("memory", [journeyId, part.kind, part.occurrence, ...(part.episode ? [] : [day, phase])]);
      const proofKey = JSON.stringify([id, headKey(item.fact.source), part.sceneId, part.lineId]);
      if (seen.has(proofKey)) return;
      seen.add(proofKey);
      let group = groups.get(id);
      if (!group) {
        group = { entry: { id, day, phase, sequence: item.sequence, title: journalText(part.title, item.record), preview: "", actors: [], location: part.location, blocks: [] }, parts: [] };
        groups.set(id, group);
      }
      const entry = group.entry;
      entry.sequence = Math.min(entry.sequence, item.sequence);
      if (part.summary) entry.summary = part.summary;
      if (part.iconKeywords?.length && !entry.iconKeywords) entry.iconKeywords = part.iconKeywords;
      for (const id of part.participantIds ?? []) {
        const name = actorName(id, item);
        if (name && name !== actorName("kael", item) && !entry.actors.includes(name)) entry.actors = [...entry.actors, name];
      }
      const source: MemorySource = { kind: part.kind, ...item.fact.source, factId: item.fact.id, sceneId: part.sceneId, lineId: part.lineId, ...(part.acquisition ? { acquisition: part.acquisition } : {}) };
      const blocks: MemoryBlock[] = [];
      for (const block of part.blocks) {
        const text = journalText(block.text, item.record);
        if (!text.trim() && block.frame?.kind !== "direction") continue;
        const speaker = block.speaker ? journalText(block.speaker, item.record) : undefined;
        blocks.push({ ...block, text, speaker, source, ...(block.frame ? { frame: { ...block.frame,
          ...("text" in block.frame ? { text } : {}), ...(block.frame.stage ? { stage: block.frame.stage.map(cue => ({ ...cue,
            ...(cue.aside ? { aside: journalText(cue.aside, item.record) } : {}), ...(cue.direction ? { direction: journalText(cue.direction, item.record) } : {}) })) } : {}) } } : {}) });
        if (speaker && speaker !== actorName("kael", item) && !entry.actors.includes(speaker)) entry.actors = [...entry.actors, speaker];
      }
      group.parts.push({ part, source, blocks, time: clock, position: part.order ?? item.sequence });
    },
    entries() {
      return [...groups.values()].flatMap(({ entry, parts }) => {
        parts.sort((a, b) => a.position - b.position);
        const acts = new Map<string, NarrativeAct & { slices: NarrativeSlice[] }>();
        const slices = new Map<string, NarrativeSlice & { steps: NarrativeStep[]; blocks: MemoryBlock[]; playable: boolean }>();
        const participants = new Set<string>();
        let initialSlots: { left?: string; right?: string } | undefined, sourceScene = "";
        let stageMessages: { id: string; kind: string; actorId: string; offstage?: boolean }[] = [];
        const faces = new Map<string, { actorId: string; emotion?: string; expression?: string }>();
        for (const { part, source, blocks, time } of parts) {
          part.participantIds?.forEach(id => { if (id !== "narrator") participants.add(id); });
          const marker = part.narrative ?? { actId: "recorded", actTitle: entry.title, sliceId: "recorded" };
          const actId = identity("act", [entry.id, marker.actId]), sliceId = identity("slice", [actId, marker.sliceId]);
          let act = acts.get(actId);
          if (!act) { act = { id: actId, definitionId: marker.actDefinitionId ?? marker.actId, title: marker.actTitle, ...(marker.phaseLabel ? { phaseLabel: marker.phaseLabel } : {}),
            coverage: "unknown", replay: "text", startedAt: time, slices: [] }; acts.set(actId, act); }
          if (part.narrative) act.coverage = marker.complete ? "complete" : act.coverage === "complete" ? "complete" : "partial";
          let slice = slices.get(sliceId);
          if (!slice) { slice = { id: sliceId, definitionId: marker.sliceDefinitionId ?? marker.sliceId, recordedAt: time,
            presentation: { surface: marker.surface ?? (blocks.some(b => b.stage && (b.stage.background.kind === "mansion" || b.stage.background.url)) ? "adv" : "text") }, steps: [], blocks: [], playable: true };
            slices.set(sliceId, slice); act.slices.push(slice); }
          for (const [index, block] of blocks.entries()) {
            const id = identity("frame", [entry.id, headKey(source), source.factId, source.sceneId, source.lineId, index]);
            let snapshot: NarrativeSnapshot | undefined;
            if (block.stage && (block.stage.background.kind === "mansion" || block.stage.background.url)) {
              if (!sourceScene || sourceScene !== source.sceneId) {
                initialSlots = block.stage.initialSlots; stageMessages = []; faces.clear();
              }
              sourceScene = source.sceneId;
              const freezeStage = () => {
                const { slots } = deriveStageSlots(stageMessages, initialSlots);
                return { ...narrativeSnapshot(block.stage!), initialSlots: { ...(slots.left ? { left: slots.left } : {}), ...(slots.right ? { right: slots.right } : {}) }, actors: [...faces.values()] };
              };
              if (!slice.presentation.opening) slice.presentation.opening = freezeStage();
              for (const actor of block.stage.actors ?? []) {
                faces.set(actor.characterId, { actorId: actor.characterId, ...(actor.emotion ? { emotion: actor.emotion } : {}) });
                if (actor.characterId !== block.stage.offstageActorId) stageMessages.push({ id: `${id}:${actor.characterId}`, kind: "stage", actorId: actor.characterId });
              }
              if (block.stage.actorId) {
                const actorId = block.stage.actorId;
                faces.set(actorId, { actorId, ...(block.stage.emotion ? { emotion: block.stage.emotion } : {}), ...(block.stage.expression ? { expression: block.stage.expression } : {}) });
                stageMessages.push({ id, kind: "say", actorId, offstage: actorId === block.stage.offstageActorId });
              }
              snapshot = freezeStage();
            }
            if (!block.stage || block.stage.background.kind === "asset" && !block.stage.background.url) slice.playable = false;
            if (block.stage?.actorId) participants.add(block.stage.actorId);
            block.stage?.actors?.forEach(a => participants.add(a.characterId));
            if (block.kind === "choice") slice.steps.push({ kind: "choice-result", id,
              choiceId: block.choice?.choiceId ?? source.lineId, optionId: block.choice?.optionId ?? identity("selected", [block.text]), label: block.text, source });
            else {
              const frame: NarrativeFrame = block.frame ? { ...block.frame, id, ...("text" in block.frame ? { text: block.text } : {}), source }
                : block.stage?.actorId ? { id, kind: "dialogue", actorId: block.stage.actorId, text: block.text, ...(block.stage.emotion ? { emotion: block.stage.emotion } : {}), source }
                : { id, kind: "narration", text: block.speaker ? `${block.speaker}：${block.text}` : block.text, source };
              if (snapshot) frame.scene = snapshot;
              const previous = slice.steps.at(-1);
              if (previous?.kind === "content") slice.steps[slice.steps.length - 1] = { kind: "content", frames: [...previous.frames, frame] };
              else slice.steps.push({ kind: "content", frames: [frame] });
            }
            slice.blocks.push(block);
          }
          part.receipts?.forEach((receipt, index) => {
            const step: NarrativeReceipt = { ...receipt, kind: "receipt", id: identity("receipt", [entry.id, source.factId, source.lineId, index]), source };
            slice!.steps.push(step);
            slice!.blocks.push({ text: narrativeReceiptText(step), kind: "receipt", source });
          });
        }
        // A transaction can precede the dialogue it belongs to. Publish it only
        // once this slice has real prose or an acknowledged choice.
        const published: NarrativeAct[] = [];
        const transcript: MemoryBlock[] = [];
        for (const act of acts.values()) {
          const visible = act.slices.filter(s => s.steps.some(step => step.kind === "choice-result" || step.kind === "content" && step.frames.some(f => "text" in f && f.text.trim())));
          if (!visible.length) continue;
          const playable = visible.every(s => slices.get(s.id)!.playable && s.presentation.opening);
          published.push({ ...act, replay: playable ? "scene" : "text", slices: visible.map(s => ({ id: s.id, definitionId: s.definitionId, recordedAt: s.recordedAt, presentation: s.presentation, steps: s.steps })) });
          for (const slice of visible) transcript.push(...slices.get(slice.id)!.blocks);
        }
        if (!published.length) return [];
        const narrative = { id: entry.id, ...(parts[0].part.narrative?.eventDefinitionId ? { definitionId: parts[0].part.narrative.eventDefinitionId } : {}),
          title: entry.title, ...(entry.summary ? { summary: entry.summary } : {}), sequence: Math.max(0, Math.floor(entry.sequence)),
          startedAt: parts[0].time, lastRecordedAt: parts.at(-1)!.time, participants: [...participants], acts: published };
        const text = entry.summary ?? transcript.find(b => !b.kind)?.text ?? transcript[0].text;
        const points = Array.from(text.replace(/\s+/g, " ").trim());
        return [{ ...entry, blocks: transcript.filter(b => b.text.trim()), narrative, recordedDays: [...new Set(parts.map(p => p.time?.day ?? null))], preview: points.slice(0, 90).join("") + (points.length > 90 ? "…" : ""),
          ...(published.some(act => act.replay === "scene") ? { replay: "scene" as const } : {}) }];
      }).sort((a, b) => a.sequence - b.sequence);
    },
  };
}
export type JournalBuilder = ReturnType<typeof createJournalBuilder>;
