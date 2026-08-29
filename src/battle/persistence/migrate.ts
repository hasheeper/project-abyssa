import { collectExpeditionInvariantViolations } from "../domain/invariants";
import type {
  BattleMode,
  ExpeditionState,
  RoundOutcome
} from "../domain/state";
import {
  BATTLE_CONTENT_VERSION,
  BATTLE_RULES_VERSION,
  BATTLE_SCHEMA_VERSION
} from "../domain/versions";
import type { BattleSaveDto } from "./dto";
import { createBattleRngState } from "./rng";
import {
  FRENZY_ACTIVE_STATUS_ID,
  FRENZY_WARNING_STATUS_ID
} from "../content/effect-definitions";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveLegacyMode(state: UnknownRecord): BattleMode {
  const status = state.status;
  const phase = state.phase;
  if (status === "finished") return { type: "finished" };
  if (status === "greed") return { type: "greed" };
  if (phase === "roll") return { type: "awaiting-roll" };
  if (phase === "act") return { type: "player-turn" };

  const enemies = Array.isArray(state.enemies) ? state.enemies : [];
  const enemyOrder = enemies.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      candidate.dead === true ||
      (typeof candidate.hp === "number" && candidate.hp <= 0) ||
      candidate.intent == null
    ) {
      return [];
    }
    return typeof candidate.id === "string" ? [candidate.id] : [];
  });
  return {
    type: "enemy-turn",
    enemyOrder,
    cursor: 0,
    closingHand: null,
    outcome: isRoundOutcome(state.lastOutcome) ? state.lastOutcome : null
  };
}

function isRoundOutcome(value: unknown): value is RoundOutcome {
  return value === "continue" || value === "layer-cleared" || value === "wipe";
}

function migrateSchemaOne(input: UnknownRecord): UnknownRecord {
  if (!isRecord(input.state)) throw new Error("Battle save v1 is missing state");
  const legacy = structuredClone(input.state);
  const migrated = {
    ...legacy,
    mode: deriveLegacyMode(legacy),
    rng: createBattleRngState(0),
    pendingEffects: [],
    pendingReactions: [],
    statuses: [],
    encounterRules: [],
    eventSequence: 0,
    // A field-whitelist v1 undo entry cannot be upgraded into a complete checkpoint.
    undoStack: []
  } as unknown as ExpeditionState;
  return {
    schemaVersion: 2,
    rulesVersion: BATTLE_RULES_VERSION,
    contentVersion: BATTLE_CONTENT_VERSION,
    state: migrated
  };
}

function migrateSchemaTwo(input: UnknownRecord): UnknownRecord {
  if (!isRecord(input.state)) throw new Error("Battle save v2 is missing state");
  const state = structuredClone(input.state);
  const emptyLoadout = { items: [], equipment: [], traits: [] };
  const statuses = Array.isArray(state.statuses) ? [...state.statuses] : [];
  const round = typeof state.round === "number" ? state.round : 1;
  const enemies = Array.isArray(state.enemies) ? state.enemies : [];
  for (const candidate of enemies) {
    if (!isRecord(candidate) || candidate.dead || typeof candidate.id !== "string") continue;
    const targetKey = `enemy:${candidate.id}`;
    if (candidate.frenzied === true) {
      statuses.push({
        kind: "status",
        instanceId: `frenzy-active:${candidate.id}`,
        definitionId: FRENZY_ACTIVE_STATUS_ID,
        sourceId: candidate.id,
        targetKey,
        stacks: 1,
        maxStacks: 1,
        duration: null,
        tags: ["frenzy", "persistent", "unremovable"],
        data: { enemyId: candidate.id }
      });
    } else if (typeof candidate.frenzyActivatesOnRound === "number") {
      statuses.push({
        kind: "status",
        instanceId: `frenzy-warning:${candidate.id}`,
        definitionId: FRENZY_WARNING_STATUS_ID,
        sourceId: candidate.id,
        targetKey,
        stacks: 1,
        maxStacks: 1,
        duration: {
          scope: "round",
          remaining: Math.max(1, candidate.frenzyActivatesOnRound - round)
        },
        tags: ["frenzy", "warning", "unremovable"],
        data: { enemyId: candidate.id }
      });
    }
  }
  return {
    ...input,
    schemaVersion: 3,
    state: {
      ...state,
      statuses,
      loadoutAtStart: structuredClone(emptyLoadout),
      loadout: structuredClone(emptyLoadout)
    }
  };
}

function migrateStateToCanonicalShape(
  input: UnknownRecord,
  includeUndoStack: boolean
): UnknownRecord {
  const state = structuredClone(input);
  const previousOutcome = state.lastOutcome;
  const rawMode = isRecord(state.mode) ? state.mode : deriveLegacyMode(state);
  state.mode =
    rawMode.type === "enemy-turn"
      ? {
          ...rawMode,
          outcome: isRoundOutcome(rawMode.outcome)
            ? rawMode.outcome
            : isRoundOutcome(previousOutcome)
              ? previousOutcome
              : null
        }
      : { ...rawMode };

  delete state.phase;
  delete state.status;
  delete state.lastOutcome;

  if (Array.isArray(state.enemies)) {
    state.enemies = state.enemies.map((value) => {
      if (!isRecord(value)) return value;
      const enemy = { ...value };
      const defeated =
        enemy.dead === true ||
        (typeof enemy.hp === "number" && enemy.hp <= 0);
      delete enemy.dead;
      delete enemy.frenzied;
      delete enemy.frenzyActivatesOnRound;
      if (defeated) {
        enemy.hp = 0;
        enemy.intent = null;
      }
      return enemy;
    });
  }

  if (Array.isArray(state.dice)) {
    state.dice = state.dice.map((value) => {
      if (!isRecord(value)) return value;
      const die = { ...value };
      delete die.downed;
      delete die.rustLevel;
      return die;
    });
  }

  if (includeUndoStack && Array.isArray(state.undoStack)) {
    state.undoStack = state.undoStack.map((value) => {
      if (!isRecord(value) || !isRecord(value.state)) return value;
      return {
        ...value,
        state: migrateStateToCanonicalShape(value.state, false)
      };
    });
  }
  return state;
}

function migrateSchemaThree(input: UnknownRecord): UnknownRecord {
  if (!isRecord(input.state)) throw new Error("Battle save v3 is missing state");
  return {
    ...input,
    schemaVersion: BATTLE_SCHEMA_VERSION,
    state: migrateStateToCanonicalShape(input.state, true)
  };
}

function assertCurrentDto(value: unknown): asserts value is BattleSaveDto {
  if (!isRecord(value)) throw new Error("Battle save must be an object");
  if (value.schemaVersion !== BATTLE_SCHEMA_VERSION) {
    throw new Error(`Unsupported Battle schema version: ${String(value.schemaVersion)}`);
  }
  if (value.rulesVersion !== BATTLE_RULES_VERSION) {
    throw new Error(`Unsupported Battle rules version: ${String(value.rulesVersion)}`);
  }
  if (value.contentVersion !== BATTLE_CONTENT_VERSION) {
    throw new Error(`Unsupported Battle content version: ${String(value.contentVersion)}`);
  }
  if (!isRecord(value.state)) throw new Error("Battle save is missing state");

  const state = value.state;
  if (
    !Array.isArray(state.party) ||
    !Array.isArray(state.dice) ||
    !Array.isArray(state.enemies) ||
    !Array.isArray(state.undoStack) ||
    !Array.isArray(state.pendingEffects) ||
    !Array.isArray(state.pendingReactions) ||
    !Array.isArray(state.statuses) ||
    !Array.isArray(state.encounterRules) ||
    !isRecord(state.loadoutAtStart) ||
    !Array.isArray(state.loadoutAtStart.items) ||
    !Array.isArray(state.loadoutAtStart.equipment) ||
    !Array.isArray(state.loadoutAtStart.traits) ||
    !isRecord(state.loadout) ||
    !Array.isArray(state.loadout.items) ||
    !Array.isArray(state.loadout.equipment) ||
    !Array.isArray(state.loadout.traits) ||
    !isRecord(state.mode) ||
    !isRecord(state.rng) ||
    !isRecord(state.rng.combat) ||
    !isRecord(state.rng.loot) ||
    !isRecord(state.rng.flavor) ||
    !["awaiting-roll", "player-turn", "enemy-turn", "greed", "finished"].includes(
      String(state.mode.type)
    ) ||
    !state.pendingEffects.every(isRecord) ||
    !state.pendingReactions.every(isRecord)
  ) {
    throw new Error("Battle save has an invalid state shape");
  }

  if (
    "phase" in state ||
    "status" in state ||
    "lastOutcome" in state ||
    state.enemies.some(
      (enemy) =>
        !isRecord(enemy) ||
        "dead" in enemy ||
        "frenzied" in enemy ||
        "frenzyActivatesOnRound" in enemy
    ) ||
    state.dice.some(
      (die) => !isRecord(die) || "downed" in die || "rustLevel" in die
    ) ||
    (state.mode.type === "enemy-turn" &&
      !(
        state.mode.outcome === null ||
        isRoundOutcome(state.mode.outcome)
      ))
  ) {
    throw new Error("Battle save contains non-canonical duplicate state");
  }

  const violations = collectExpeditionInvariantViolations(
    state as unknown as ExpeditionState
  );
  if (violations.length > 0) {
    throw new Error(
      `Battle save violates invariants: ${violations
        .map((violation) => violation.code)
        .join(", ")}`
    );
  }
}

export function migrateBattleSaveDto(input: unknown): BattleSaveDto {
  if (!isRecord(input)) throw new Error("Battle save must be an object");
  let migrated = input;
  if (migrated.schemaVersion === 1) migrated = migrateSchemaOne(migrated);
  if (migrated.schemaVersion === 2) migrated = migrateSchemaTwo(migrated);
  if (migrated.schemaVersion === 3) migrated = migrateSchemaThree(migrated);
  assertCurrentDto(migrated);
  return structuredClone(migrated);
}

export function deserializeBattleState(serialized: string): ExpeditionState {
  const parsed: unknown = JSON.parse(serialized);
  return migrateBattleSaveDto(parsed).state;
}
