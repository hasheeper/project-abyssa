import type { ExpeditionState } from "../domain/state";
import {
  BATTLE_CONTENT_VERSION,
  BATTLE_RULES_VERSION,
  BATTLE_SCHEMA_VERSION
} from "../domain/versions";
import { cloneBattleState } from "./clone";

export type BattleSaveDto = {
  schemaVersion: typeof BATTLE_SCHEMA_VERSION;
  rulesVersion: typeof BATTLE_RULES_VERSION;
  contentVersion: typeof BATTLE_CONTENT_VERSION;
  state: ExpeditionState;
};

export function createBattleSaveDto(state: ExpeditionState): BattleSaveDto {
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    rulesVersion: BATTLE_RULES_VERSION,
    contentVersion: BATTLE_CONTENT_VERSION,
    state: cloneBattleState(state)
  };
}

export function serializeBattleState(state: ExpeditionState): string {
  return JSON.stringify(createBattleSaveDto(state));
}
