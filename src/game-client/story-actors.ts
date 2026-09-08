import { getExpressionParts } from "../shared/ui/patterns/expressions";
import { archiveIdentities } from "../content/characters/identities";
import type { RpActor, RpMessage, RpSeat } from "../shared/ui/patterns/rp-stage";
import { isUserChoice, selectedChoiceLine } from "../content/presentation/authored-story";
import type { AuthoredLine, UserChoiceTone } from "../content/presentation/authored-story";
import { isPlayerActor, playerDisplayName, resolvePlayerText, PLAYER_ACTOR_ID } from "../shared/domain/player-identity";
import { CHARACTER_EMOTION_PROFILES } from "../content/presentation/character-emotions";
import { resolveEmotionCue } from "../shared/ui/patterns/emotion-cues";

const spriteBaseUrl = import.meta.env.DEV ? "/src/assets/characters/paper-dolls/" : `${import.meta.env.BASE_URL}character-art/`;
export function storyActors(lines: readonly AuthoredLine[]): RpActor[] {
  const ids = new Set(lines.flatMap(line => isUserChoice(line) ? [PLAYER_ACTOR_ID] : "characterId" in line && line.characterId ? [line.characterId] : []));
  return archiveIdentities.filter(a => ids.has(a.id)).map(a => ({
    id: a.id,
    name: isPlayerActor(a.id) ? playerDisplayName() : a.selectorLabel ?? a.name,
    secondaryName: isPlayerActor(a.id) ? "USER" : a.secondaryName,
    avatar: a.thumbnailUrl,
    spriteBaseUrl,
    portrait: isPlayerActor(a.id) ? a.portraitUrl : undefined,
    expression: lines.find(line => "characterId" in line && line.characterId === a.id)?.expression ?? "a",
    emotionProfile: CHARACTER_EMOTION_PROFILES[a.id],
  }));
}
export function storySlots(lines: readonly AuthoredLine[]): Partial<Record<RpSeat, string>> {
  const ids = [...new Set(lines.flatMap(line => isUserChoice(line) ? [PLAYER_ACTOR_ID] : "characterId" in line && line.characterId ? [line.characterId] : []))];
  return {left: ids[0], right: ids[1]};
}
export function storyMessages(lines: readonly AuthoredLine[], decisions: ReadonlyMap<number, UserChoiceTone> = new Map()): RpMessage[] {
  return lines.flatMap((source, step): RpMessage[] => {
    const line = isUserChoice(source)
      ? decisions.has(step) ? selectedChoiceLine(source, decisions.get(step)!) : null
      : source;
    if (!line) return [];
    if ("characterId" in line && line.characterId) return [{id:line.id,kind:"say",actorId:line.characterId,text:resolvePlayerText(line.text),expression:line.expression,...("emotion" in line && line.emotion ? {emotion:line.emotion} : {})}];
    return [{id:line.id,kind:"narration",text:resolvePlayerText(line.text)}];
  });
}

/** Decode the complete authored expression set before the scene enters. No hidden live scene. */
export function storyAssets(lines: readonly AuthoredLine[], background: string): string[] {
  const urls = new Set([background]);
  for (const actor of storyActors(lines)) {
    if (actor.avatar) urls.add(actor.avatar);
    if (actor.portrait) {urls.add(actor.portrait); continue;}
    urls.add(`${spriteBaseUrl}${actor.id}/base.png`);
    for (const line of lines.filter(line => "characterId" in line && line.characterId === actor.id)) {
      const cue = resolveEmotionCue(actor, "emotion" in line && line.emotion ? line.emotion : line.expression ?? "a");
      const parts = getExpressionParts(actor.id,cue.expression);
      if (cue.emote) for (const suffix of ["", "-still"]) urls.add(`${import.meta.env.DEV ? "/src/assets/emote/" : `${import.meta.env.BASE_URL}emote-art/`}${cue.emote}${suffix}.png`);
      if (!parts) continue;
      for (const part of [`eyes_${parts.eyes}`,`mouth_${parts.mouth}`,...(parts.face === undefined ? [] : [`face_${parts.face}`])]) urls.add(`${spriteBaseUrl}${actor.id}/${part}.png`);
    }
  }
  return [...urls];
}
