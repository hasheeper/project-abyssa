import type { ActionError, CharacterId, ExpeditionState, Rng } from "./state";
import type { BattleEvent } from "./events";

export type BattleCommand =
  | { type: "roll-dice" }
  | { type: "reroll-dice" }
  | { type: "toggle-load"; dieIndex: number }
  | { type: "attack-enemy"; actorId: CharacterId; enemyId: string }
  | { type: "block-intent"; actorId: CharacterId; enemyId: string }
  | { type: "heal-member"; actorId: CharacterId; targetId: CharacterId }
  | { type: "steal-from"; actorId: CharacterId; enemyId: string }
  | { type: "undo" }
  | { type: "end-turn" }
  | { type: "begin-enemy-turn" }
  | { type: "resolve-next-enemy" }
  | { type: "finish-enemy-turn" }
  | { type: "next-round" }
  | { type: "go-deeper" }
  | { type: "leave-expedition" };

export type BattleError =
  | ActionError
  | "command-not-available";

export type BattleTransition = {
  state: ExpeditionState;
  events: BattleEvent[];
  error: BattleError | null;
};

/** Compatibility-only RNG override. New callers use the serialized streams in state. */
export type BattleDispatchContext = {
  rng?: Rng;
};
