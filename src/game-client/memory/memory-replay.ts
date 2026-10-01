import type { AuthoredLine } from "../../content/presentation/authored-story";
import type { ReadingPage } from "../../shared/presentation/adv/ReadingPlayer";
import type { RpMessage } from "../../shared/ui/patterns/rp-stage";
import { mansionSceneBackground } from "../mansion-backgrounds";
import { storyActors } from "../story-actors";
import type { MemoryBlock, MemoryEntry } from "./memory-types";
import { narrativeActBlocks } from "../../game-runtime/memory-narrative";

/** Spoken/staged actors are stable within a scene; initial cast can change per block. */
function sceneActors(blocks: readonly MemoryBlock[]) {
  const ids = new Set<string>(), cast = new Set<string>(), names = new Map<string, string>();
  const lines: AuthoredLine[] = blocks.map((block, index) => {
    const stage = block.stage!;
    if (stage.actorId) {
      ids.add(stage.actorId);
      if (block.speaker && !names.has(stage.actorId)) names.set(stage.actorId, block.speaker);
    }
    for (const actor of stage.actors ?? []) ids.add(actor.characterId);
    for (const id of Object.values(stage.initialSlots ?? {})) cast.add(id);
    return { id: `scene:${index}`, text: block.text, characterId: stage.actorId,
      actors: stage.actors?.map(actor => ({ characterId: actor.characterId })), emotion: stage.emotion };
  });
  for (const characterId of cast) lines.push({ id: `cast:${characterId}`, characterId, text: "" });
  return { ids, actors: storyActors(lines).map(actor => ({ ...actor, name: names.get(actor.id) ?? actor.name })) };
}

/** Uses only the query's proven read blocks, never looks up future script pages. */
export function memoryReplayPages(entry: MemoryEntry, actId?: string): (ReadingPage & { sceneId: string })[] {
  const act = entry.narrative?.acts.find(a => a.id === actId) ?? (actId ? undefined : entry.narrative?.acts.find(a => a.replay === "scene"));
  if (entry.narrative && (!act || act.replay !== "scene")) return [];
  const blocks = act ? narrativeActBlocks(act, entry) : entry.blocks;
  if (!entry.replay || !blocks.length || blocks.some(b => !b.source || !b.stage)) return [];
  const scenes = new Map<string, MemoryBlock[]>();
  for (const block of blocks) {
    const boundary = act?.id ?? block.source!.sceneId;
    const scene = scenes.get(boundary);
    if (scene) scene.push(block);
    else scenes.set(boundary, [block]);
  }
  const casts = new Map([...scenes].map(([id, scene]) => [id, sceneActors(scene)]));
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
    // Initial cast can be visible before its first spoken line.
    const cast = casts.get(boundary)!, initialCast = new Set(Object.values(stage.initialSlots ?? {}));
    const actors = cast.actors.filter(actor => cast.ids.has(actor.id) || initialCast.has(actor.id)).map(actor => ({ ...actor,
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
