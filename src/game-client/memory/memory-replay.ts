import type { AuthoredLine } from "../../content/presentation/authored-story";
import type { ReadingPage } from "../../shared/presentation/adv/ReadingPlayer";
import type { RpMessage } from "../../shared/ui/patterns/rp-stage";
import { mansionSceneBackground } from "../mansion-backgrounds";
import { storyActors } from "../story-actors";
import type { MemoryEntry } from "./memory-types";
import { narrativeActBlocks } from "../../game-runtime/memory-narrative";

/** Uses only the query's proven read blocks, never looks up future script pages. */
export function memoryReplayPages(entry: MemoryEntry, actId?: string): (ReadingPage & { sceneId: string })[] {
  const act = entry.narrative?.acts.find(a => a.id === actId) ?? (actId ? undefined : entry.narrative?.acts.find(a => a.replay === "scene"));
  if (entry.narrative && (!act || act.replay !== "scene")) return [];
  const blocks = act ? narrativeActBlocks(act, entry) : entry.blocks;
  if (!entry.replay || !blocks.length || blocks.some(b => !b.source || !b.stage)) return [];
  let sceneId = "", messages: RpMessage[] = [];
  return blocks.flatMap((block, index) => {
    const source = block.source!, stage = block.stage!;
    const boundary = act?.id ?? source.sceneId;
    if (sceneId !== boundary) {
      sceneId = boundary; messages = [];
      const opening = act?.slices[0].presentation.opening;
      for (const actor of opening?.actors ?? []) if (Object.values(opening?.initialSlots ?? {}).includes(actor.actorId)) {
        messages.push({ id: `opening:${act!.id}:${actor.actorId}`, kind: "stage", actorId: actor.actorId, emotion: actor.emotion, expression: actor.expression, text: "" });
      }
    }
    const id = `${source.saveId}:${source.epoch}:${source.factId}:${source.lineId}:${index}`;
    const sceneBlocks = act ? blocks : blocks.filter(b => b.source?.sceneId === sceneId);
    const lines: AuthoredLine[] = sceneBlocks.map((b, i) => ({ id: `${sceneId}:${i}`, text: b.text,
      characterId: b.stage?.actorId, actors: b.stage?.actors?.map(a => ({ characterId: a.characterId })), emotion: b.stage?.emotion }));
    // Initial cast can be visible before its first spoken line.
    Object.values(stage.initialSlots ?? {}).forEach(characterId => lines.push({ id: `cast:${characterId}`, characterId, text: "" }));
    const actors = storyActors(lines).map(actor => ({ ...actor,
      name: sceneBlocks.find(b => b.stage?.actorId === actor.id && b.speaker)?.speaker ?? actor.name,
      portrait: stage.portraits?.[actor.id] ?? actor.portrait,
    }));
    const cues: RpMessage[] = (stage.actors ?? []).filter(a => a.characterId !== stage.offstageActorId)
      .map((a, i) => ({ id: `${id}:stage:${i}`, kind: "stage", actorId: a.characterId, emotion: a.emotion, text: "" }));
    const line: RpMessage | null = block.frame?.kind === "direction" ? null
      : block.kind === "choice" ? { id, kind: "narration", text: `当时的选择：${block.text}` }
      : stage.actorId ? { id, kind: "say", actorId: stage.actorId, text: block.text, emotion: stage.emotion, expression: stage.expression, offstage: stage.actorId === stage.offstageActorId }
      : block.frame?.kind === "chapter" ? { id, kind: "chapter", text: block.text }
      : { id, kind: "narration", text: block.speaker ? `${block.speaker}：${block.text}` : block.text };
    messages = [...messages, ...cues, ...(line ? [line] : [])];
    if (!line) return [];
    const performances = block.frame?.stage ? Object.fromEntries(block.frame.stage.map(cue => [cue.actorId, { key: `${id}:${cue.actorId}`, motion: cue.motion, aside: cue.aside, still: cue.still }])) : undefined;
    return [{ id, sceneId, messages, actors, initialSlots: act ? act.slices[0].presentation.opening?.initialSlots : stage.initialSlots,
      performances,
      background: stage.background.kind === "asset" ? stage.background.url : mansionSceneBackground(stage.background.locationId, stage.background.phase) }];
  });
}
