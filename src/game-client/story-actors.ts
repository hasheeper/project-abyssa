import { getExpressionParts } from "../shared/ui/patterns/expressions";
import { archiveIdentities } from "../content/characters/identities";
import type { RpActor, RpMessage, RpSeat } from "../shared/ui/patterns/rp-stage";
import type { AuthoredLine } from "../content/presentation/marietta-memory";

const spriteBaseUrl = import.meta.env.DEV ? "/src/assets/characters/paper-dolls/" : `${import.meta.env.BASE_URL}character-art/`;
export function storyActors(lines: readonly AuthoredLine[]): RpActor[] {
  const ids = new Set(lines.flatMap(line => line.characterId ? [line.characterId] : []));
  return archiveIdentities.filter(a => ids.has(a.id)).map(a => ({
    id: a.id, name: a.selectorLabel ?? a.name, secondaryName: a.secondaryName, spriteBaseUrl,
    portrait: a.id === "kael" ? a.portraitUrl : undefined,
    expression: lines.find(line => line.characterId === a.id)?.expression ?? "a",
  }));
}
export function storySlots(lines: readonly AuthoredLine[]): Partial<Record<RpSeat, string>> {
  const ids = [...new Set(lines.flatMap(line => line.characterId ? [line.characterId] : []))];
  return {left: ids[0], right: ids[1]};
}
export function storyMessages(lines: readonly AuthoredLine[]): RpMessage[] {
  return lines.map(line => line.characterId
    ? {id: line.id, kind: "say", actorId: line.characterId, text: line.text, expression: line.expression}
    : {id: line.id, kind: "narration", text: line.text});
}

/** Decode the complete authored expression set before the scene enters. No hidden live scene. */
export function storyAssets(lines: readonly AuthoredLine[], background: string): string[] {
  const urls = new Set([background]);
  for (const actor of storyActors(lines)) {
    if (actor.portrait) {urls.add(actor.portrait); continue;}
    urls.add(`${spriteBaseUrl}${actor.id}/base.png`);
    for (const line of lines.filter(line => line.characterId === actor.id)) {
      const parts = getExpressionParts(actor.id,line.expression ?? "a");
      if (!parts) continue;
      for (const part of [`eyes_${parts.eyes}`,`mouth_${parts.mouth}`,...(parts.face === undefined ? [] : [`face_${parts.face}`])]) urls.add(`${spriteBaseUrl}${actor.id}/${part}.png`);
    }
  }
  return [...urls];
}
