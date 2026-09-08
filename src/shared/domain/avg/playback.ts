import type { AvgChoice, AvgEffect, AvgFrame, AvgSound, AvgStageCue, AvgStory } from "./story";

export type AvgPlaybackActor = Omit<AvgStageCue, "actorId"> & { characterId: string };
export type AvgPlaybackLine = {
  id: string; text: string; effect?: AvgEffect; sound?: AvgSound; itemId?: string;
  actors?: AvgPlaybackActor[]; holdMs?: number; pages?: AvgPlaybackLine[];
} & ({ kind?: "line"; characterId?: string; emotion?: string } | { kind: "action"; characterId?: undefined });
export type AvgPlaybackBeat = AvgPlaybackLine & { section: number };
export type AvgOptions<T> = { A: T; B: T; C?: T };
export type AvgPlaybackDecision = { id: string; kind: "decision"; section: number; prompt: string; options: AvgOptions<string> };
export type AvgPlaybackEntry = AvgPlaybackBeat | AvgPlaybackDecision | { id: string; kind: "branch"; section: number; choiceId: string; variants: AvgOptions<AvgPlaybackBeat> };
export type AvgSelection = { step: number; choice: AvgChoice };
export const avgOptionKeys = (options: AvgOptions<unknown>): AvgChoice[] => options.C === undefined ? ["A", "B"] : ["A", "B", "C"];

/** Authored JSON and accepted generation output share this presentation boundary. */
export function avgFrameLine(frame: AvgFrame): AvgPlaybackLine {
  return {
    id: frame.id,
    ...(frame.kind === "dialogue" ? { characterId: frame.actorId, text: frame.text, ...(frame.emotion ? { emotion: frame.emotion } : {}) }
      : { kind: "action" as const, text: frame.kind === "direction" ? "" : frame.text }),
    ...(frame.kind === "direction" ? { holdMs: frame.waitMs, actors: [] } : {}),
    ...(frame.stage ? { actors: frame.stage.map(({ actorId, ...cue }) => ({ characterId: actorId, ...cue })) } : {}),
    ...(frame.kind === "chapter" ? { effect: "handoff" as const } : frame.effect ? { effect: frame.effect } : {}), ...(frame.sound ? { sound: frame.sound } : {}),
    ...(frame.itemId ? { itemId: frame.itemId } : {}),
  };
}
export function avgPages(beat: AvgPlaybackBeat): AvgPlaybackBeat[] {
  return [beat, ...(beat.pages ?? []).map((page, index) => ({ ...page, id: `${beat.id}.page.${index + 1}`, section: beat.section }))];
}
export function compileAvgStory(story: AvgStory) {
  const beat = (frames: AvgFrame[], section: number): AvgPlaybackBeat => ({
    ...avgFrameLine(frames[0]), section,
    ...(frames.length > 1 ? { pages: frames.slice(1).map(frame => ({ ...avgFrameLine(frame), id: "" })) } : {}),
  });
  const entries: AvgPlaybackEntry[] = story.nodes.map(node => {
    const section = story.sections.findIndex(s => s.id === node.sectionId) + 1;
    if (node.kind === "beat") return beat(node.frames, section);
    if (node.kind === "choice") return { id: node.id, kind: "decision", section, prompt: node.prompt, options: Object.fromEntries(node.options.map(o => [o.id, o.label])) as AvgOptions<string> };
    return { id: node.id, kind: "branch", section, choiceId: node.choiceId, variants: Object.fromEntries(Object.entries(node.variants).map(([key, frames]) => [key, beat(frames, section)])) as AvgOptions<AvgPlaybackBeat> };
  });
  return {
    entries,
    titles: story.sections.map(section => section.title),
    transcript(step: number, selections: readonly AvgSelection[]): (AvgPlaybackBeat | AvgPlaybackDecision)[] {
      const chosen = new Map(selections.map(s => [entries[s.step]?.id, s.choice]));
      return entries.slice(0, step + 1).flatMap(entry => {
        if (entry.kind !== "branch") return [entry];
        const choice = chosen.get(entry.choiceId), selected = choice ? entry.variants[choice] : undefined;
        return selected ? [selected] : [];
      });
    },
  };
}
