import type { BattleState } from "../battle/domain/state";
import type { ValidatedCatalog } from "../contracts/catalog-validation";
import { createBattleEngine } from "../battle/engine";
import { invalid } from "../contracts/validation";
import { EXPEDITION_FIELDS, ENCOUNTER_FIELDS } from "./state";
import type {
  GameSnapshot,
  GameExpedition,
  GameEncounter,
  ExpeditionMechanics,
  EncounterMechanics,
} from "./state";

function pick<T, K extends keyof T>(state: T, keys: readonly K[]): Pick<T, K> {
  return Object.fromEntries(
    keys.map((key) => [key, structuredClone(state[key])]),
  ) as Pick<T, K>;
}
function split(state: Omit<BattleState, "undoStack">): {
  expedition: ExpeditionMechanics;
  encounter: EncounterMechanics;
} {
  const lifecycle: ExpeditionMechanics["lifecycle"] =
    state.mode.type === "finished"
      ? { type: "finished", result: structuredClone(state.result!) }
      : { type: state.mode.type === "greed" ? "exit-choice" : "in-encounter" };
  return {
    expedition: { ...pick(state, EXPEDITION_FIELDS), lifecycle },
    encounter: {
      ...pick(state, ENCOUNTER_FIELDS),
      turn:
        state.mode.type === "finished" || state.mode.type === "greed"
          ? null
          : structuredClone(state.mode),
    },
  };
}
function flatten(
  expedition: ExpeditionMechanics,
  encounter: EncounterMechanics,
): Omit<BattleState, "undoStack"> {
  const phase = expedition.lifecycle;
  if (phase.type === "in-encounter" && !encounter.turn)
    invalid("encounter.turn", "Active encounter requires a turn");
  if (phase.type !== "in-encounter" && encounter.turn !== null)
    invalid("encounter.turn", "Closed encounter cannot have an active turn");
  return {
    ...pick(expedition, EXPEDITION_FIELDS),
    ...pick(encounter, ENCOUNTER_FIELDS),
    mode:
      phase.type === "finished"
        ? { type: "finished" }
        : phase.type === "exit-choice"
          ? { type: "greed" }
          : structuredClone(encounter.turn!),
    result: phase.type === "finished" ? structuredClone(phase.result) : null,
  };
}

export function toExecutionState(
  expedition: GameExpedition,
  encounter: GameEncounter,
): BattleState {
  return {
    ...flatten(expedition, encounter),
    undoStack: expedition.undoStack.map((checkpoint) => ({
      action: checkpoint.action,
      state: flatten(checkpoint.expedition, checkpoint.encounter),
    })),
  } as BattleState;
}

export function fromExecutionState(
  catalog: ValidatedCatalog,
  expeditionId: string,
  routeId: string,
  input: BattleState,
): { expedition: GameExpedition; encounter: GameEncounter } {
  const state = createBattleEngine(catalog, routeId).restore(input);
  const run = split(state);
  return {
    expedition: {
      ...run.expedition,
      id: expeditionId,
      routeId,
      undoStack: state.undoStack.map((checkpoint) => ({
        action: checkpoint.action,
        ...split(checkpoint.state),
      })),
    },
    encounter: {
      ...run.encounter,
      id: `${expeditionId}:encounter:${state.layer}`,
      definitionId: catalog.data.routes[routeId].encounters[state.layer - 1],
    },
  };
}

export function activeExecution(snapshot: GameSnapshot): BattleState {
  if (!snapshot.expedition || !snapshot.encounter)
    invalid("expedition", "No active expedition", "no-expedition");
  return toExecutionState(snapshot.expedition, snapshot.encounter);
}
