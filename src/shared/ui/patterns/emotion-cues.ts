import { EXPRESSION_EMOTIONS, normalizeEmotion, type CharacterEmotionProfile, type EmotionCue } from "../../domain/presentation/emotion";
import { getExpressionParts } from "./expressions";
import type { RpActor, RpMessage } from "./rp-stage";

export type ResolvedEmotion = EmotionCue & { trigger: string; key: string };

/** Unknown triggers settle to neutral. Player/static portraits never acquire automatic gestures. */
export function resolveEmotionCue(actor: Pick<RpActor, "id" | "portrait" | "emotionProfile">, trigger: string): EmotionCue & { trigger: string } {
  const semantic = normalizeEmotion(trigger);
  const profile: CharacterEmotionProfile | undefined = actor.emotionProfile;
  const special = profile?.specials && Object.hasOwn(profile.specials, trigger) ? profile.specials[trigger] : undefined;
  const selected = (semantic ? profile?.cues[semantic] : special) ?? profile?.cues.neutral;
  const fallbackFace = semantic ? Object.entries(EXPRESSION_EMOTIONS).find(([, value]) => value === semantic)?.[0] ?? "a" : trigger;
  const expression = selected?.expression ?? (getExpressionParts(actor.id, fallbackFace) ? fallbackFace : "a");
  const canAnimate = !!profile && !actor.portrait && actor.id !== "kael";
  return {
    trigger: semantic ?? (special ? trigger : "neutral"), expression,
    emote: canAnimate ? selected?.emote ?? null : null,
    motion: canAnimate ? selected?.motion ?? null : null,
  };
}

/** Replay only derives state. Repeated tokens and lines without tokens retain the same cue key. */
export function deriveActorEmotions(actors: readonly RpActor[], messages: readonly RpMessage[]): Map<string, ResolvedEmotion> {
  const byId = new Map(actors.map(actor => [actor.id, actor]));
  const states = new Map(actors.map(actor => [actor.id, {
    ...resolveEmotionCue(actor, actor.expression ?? "a"), key: `initial:${actor.id}`,
  }]));
  for (const message of messages) {
    if ((message.kind !== "say" && message.kind !== "stage") || !(message.emotion ?? message.expression)) continue;
    const actor = byId.get(message.actorId);
    if (!actor) continue;
    const cue = resolveEmotionCue(actor, message.emotion ?? message.expression!);
    const previous = states.get(actor.id);
    if (previous?.trigger === cue.trigger && previous.expression === cue.expression && !previous.key.startsWith("initial:")) continue;
    states.set(actor.id, {...cue, key: message.id});
  }
  return states;
}
