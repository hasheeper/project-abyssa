import type { CharacterDef, EnemyArt, EnemyKind } from "../battle/domain/state";
import type {
  ActionEffectDefinitionRegistry,
  BattleEffectDefinitionRegistry,
} from "../battle/domain/effects";

export type CatalogRef = {
  catalogId: string;
  contentVersion: number;
  rulesVersion: 1;
  digest: string;
};

export type BattleBalance = {
  MAX_HP: number;
  DOWNED_RETURN_HP: number;
  MAX_LAYER: number;
  REROLLS_PER_ROUND: number;
  LAYER_MULTIPLIERS: readonly number[];
  STALL_GRACE_ROUNDS: number;
  FRENZY_ATTACK_BONUS: number;
};

export type EnemyDefinition = {
  id: string;
  kind: EnemyKind;
  name: string;
  art: EnemyArt;
  hp: number;
  attack?: number;
  chargeReady?: boolean;
  countdown?: number;
};

/** One deterministic slot, or a single uniform draw among authored alternatives. */
export type EncounterDefinition = {
  id: string;
  slots: readonly (readonly string[])[];
};
export type RouteDefinition = {
  id: string;
  name: string;
  encounters: readonly string[];
};

export type BattleCatalog = {
  catalogId: string;
  contentVersion: number;
  rulesVersion: 1;
  characters: Record<string, CharacterDef>;
  defaultParty: readonly string[];
  leaderId: string;
  maxPartySize: number;
  balance: BattleBalance;
  enemies: Record<string, EnemyDefinition>;
  encounters: Record<string, EncounterDefinition>;
  routes: Record<string, RouteDefinition>;
  defaultRouteId: string;
  summonEnemyId: string;
  effects: BattleEffectDefinitionRegistry;
  actionEffects: ActionEffectDefinitionRegistry;
  contentKinds: Record<
    string,
    "item" | "equipment" | "trait" | "status" | "encounter-rule" | "action"
  >;
  frenzyWarningId: string;
  frenzyActiveId: string;
};

/** Immutable execution dependency, never serialized or stored as a module-global current value. */
export type BattleContext = {
  catalog: BattleCatalog;
  partyOrder: readonly string[];
  routeId: string;
  /** Only the historical facade omits definition metadata from its schema 4 objects. */
  legacy?: boolean;
};

export type {
  CharacterDef,
  FaceDef,
  EnemyArt,
  EnemyKind,
} from "../battle/domain/state";
export type {
  ActionEffectDefinitionRegistry,
  BattleEffectDefinitionRegistry,
} from "../battle/domain/effects";
