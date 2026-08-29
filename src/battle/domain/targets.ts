import type { CharacterId } from "./state";

export type BattleResource = "gold" | "bag-gold" | "hand-multiplier";

/** Serializable reference used by commands, effects and events. */
export type TargetRef =
  | { kind: "party-member"; id: CharacterId }
  | { kind: "enemy"; id: string }
  | { kind: "die"; ownerId: CharacterId }
  | { kind: "intent"; enemyId: string }
  | { kind: "resource"; resource: BattleResource }
  | { kind: "battle" };

export type EffectSourceRef =
  | { kind: "character"; id: CharacterId }
  | { kind: "die"; ownerId: CharacterId; faceIndex: number | null }
  | { kind: "enemy"; id: string }
  | { kind: "status"; instanceId: string }
  | { kind: "equipment"; instanceId: string }
  | { kind: "item"; instanceId: string }
  | { kind: "trait"; instanceId: string }
  | { kind: "encounter"; id: string }
  | { kind: "system"; id: string };
