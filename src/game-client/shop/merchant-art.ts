import { CHARACTER_EMOTION_PROFILES } from "../../content/presentation/character-emotions";

export const shopActor = {id: "tibby", emotionProfile: CHARACTER_EMOTION_PROFILES.tibby};
export const shopSpriteBase = import.meta.env.VITE_PAPER_DOLL_BASE_URL ??
  (import.meta.env.DEV ? "/src/assets/characters/paper-dolls/" : `${import.meta.env.BASE_URL}character-art/`);
