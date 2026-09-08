import source from "./scenes/first-morning.json";
import { parseAvgStory } from "../../shared/domain/avg/story";
import { compileAvgStory, avgPages } from "../../shared/domain/avg/playback";

export type { AvgChoice as MorningChoice, AvgEffect as MorningEffect } from "../../shared/domain/avg/story";
export type { AvgPlaybackActor as MorningActor, AvgPlaybackLine as MorningLine, AvgPlaybackBeat as MorningBeat, AvgPlaybackDecision as MorningDecision, AvgSelection as MorningSelection } from "../../shared/domain/avg/playback";
export { avgOptionKeys as morningOptionKeys, avgPages as morningPages } from "../../shared/domain/avg/playback";

/** JSON is the only authored source. This adapter preserves the existing player/save contract. */
export const FIRST_MORNING_STORY = parseAvgStory(source);
const compiled = compileAvgStory(FIRST_MORNING_STORY);
export const FIRST_MORNING_ENTRIES = compiled.entries;
export const FIRST_MORNING_TITLES = compiled.titles;
export const morningTranscript = compiled.transcript;
export const firstMorningAssetsLines = compiled.entries.flatMap(entry => entry.kind === "branch" ? Object.values(entry.variants) : entry.kind === "decision" ? [] : [entry])
  .flatMap(avgPages).flatMap(beat => [beat, ...(beat.actors ?? []).map(actor => ({ id: `${beat.id}.asset.${actor.characterId}`, characterId: actor.characterId, text: "", emotion: actor.emotion }))]);
