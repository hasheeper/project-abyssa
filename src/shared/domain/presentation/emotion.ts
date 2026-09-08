/** One authored/LLM trigger; the three visual axes are resolved locally. */
export const EMOTION_LABELS = {
  neutral: "平静", smile: "微笑", joy: "喜悦", sad: "低落", angry: "生气",
  surprised: "惊讶", serious: "认真", closed: "闭目", wry: "戏谑",
  flustered: "窘迫", displeased: "不悦", confident: "自信", confused: "困惑", panicked: "慌乱",
} as const;
export type EmotionId = keyof typeof EMOTION_LABELS;
export const EXPRESSION_EMOTIONS = {
  a: "neutral", b: "smile", c: "joy", d: "sad", e: "angry", f: "surprised", g: "serious",
  h: "closed", i: "wry", j: "flustered", k: "displeased", l: "confident", m: "confused", n: "panicked",
} as const satisfies Record<string, EmotionId>;

export type EmotionMotionId = "nod" | "waver" | "jump" | "shakeLight" | "shakeHeavy";
export type EmotionEmoteId = "blush" | "heart" | "glitter" | "sparkle" | "note" | "sweat" | "sweatdrop" | "anger" | "gloom" | "sleepy" | "dizzy" | "exclaim" | "question" | "idea" | "ellipsis";
export type EmotionCue = {
  expression: string;
  emote: EmotionEmoteId | null;
  motion: { id: EmotionMotionId; amplitude: number; duration: number } | null;
};
export type CharacterEmotionProfile = {
  /** Authoring notes, never dialogue or an LLM prompt repeated per message. */
  direction: string;
  cues: Record<EmotionId, EmotionCue>;
  specials?: Record<string, EmotionCue>;
};

/** Explicit aliases only. Never infer feelings from text, punctuation or a name. */
export function normalizeEmotion(trigger: string): EmotionId | undefined {
  if (Object.hasOwn(EMOTION_LABELS, trigger)) return trigger as EmotionId;
  if (Object.hasOwn(EXPRESSION_EMOTIONS, trigger)) return EXPRESSION_EMOTIONS[trigger as keyof typeof EXPRESSION_EMOTIONS];
  return (Object.keys(EMOTION_LABELS) as EmotionId[]).find(id => EMOTION_LABELS[id] === trigger);
}
