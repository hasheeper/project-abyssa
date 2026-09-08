import type { EmotionMotionId } from "./emotion";

/** Explicit authored reactions use the same motions as the existing emotion system. Entrance belongs to the seat. */
export type ActorMotion = EmotionMotionId;
export type ActorPerformanceCue = { key: string; motion?: ActorMotion; aside?: string; still?: boolean };
export type ActorPerformances = Readonly<Record<string, ActorPerformanceCue>>;
