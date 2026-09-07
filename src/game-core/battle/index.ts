/** Formal entry: callers explicitly bind validated content and a route. */
export { createBattleEngine } from "./engine";
export type { BattleEngine, BattleStart } from "./engine";
export { parseBattleCommand } from "./parse-command";
export {
  validateLoadout,
  assertLoadoutConservation,
} from "./persistence/validate";
export type * from "./domain/state";
export type * from "./domain/commands";
export type * from "./domain/events";
export type * from "./domain/versions";
export { createDemoBattleEngine } from "./demo-engine";
export { createD5BattleEngine, createD5MemoryEngine, readD5Battle, readD5MemoryBattle } from "./d5-engine";
export { getEffectiveFaceQuality } from "./rules/dice";
export { demoFace } from "./rules/v2/hand";
export type { DemoBattleStart } from "./demo-engine";
export type * from "./domain/demo-state";
export {
  parseDemoBattleCommand,
  validateDemoBattleState,
  validateDemoRunState,
} from "./rules/v2/validation";
export {
  resolveDemoCharacter,
  resolveDemoParty,
  validateDemoProgress,
} from "./rules/v2/configuration";
