/** Serialized state shape version. Increment only with a persistence migration. */
export const BATTLE_SCHEMA_VERSION = 4 as const;

/** Rule semantics version used by deterministic traces and replays. */
export const BATTLE_RULES_VERSION = 1 as const;

/** Hand-authored character, enemy and encounter content version. */
export const BATTLE_CONTENT_VERSION = 1 as const;

export type BattleVersionStamp = {
  schemaVersion: typeof BATTLE_SCHEMA_VERSION;
  rulesVersion: typeof BATTLE_RULES_VERSION;
  contentVersion: typeof BATTLE_CONTENT_VERSION;
};
