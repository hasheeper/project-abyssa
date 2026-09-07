import type { BattleContext } from "../contracts/catalog";
import type { ValidatedCatalog } from "../contracts/catalog-validation";
import * as v from "../contracts/validation";
import type { BattleState, BattleLoadoutSnapshot } from "./domain/state";
import type { BattleTransition } from "./domain/commands";
import { dispatchBattleCommand } from "./rules/dispatcher";
import { createExpeditionState } from "./rules/expedition";
import {
  createEmptyBattleLoadout,
  createBattleCompletionOutput,
} from "./rules/loadout";
import { createBattleRngState, createRngCursor } from "./persistence/rng";
import { migrateBattleSaveDto } from "./persistence/migrate";
import {
  validateBattleState,
  validateLoadout,
  annotateLegacyEnemies,
} from "./persistence/validate";
import { parseBattleCommand } from "./parse-command";
import {
  getBattlePhase,
  getExpeditionStatus,
  getRoundOutcome,
  canUndo,
} from "./selectors/battle-selectors";
import { getStateFace } from "./rules/dice";
import { evaluateHand } from "./rules/hand";

export type BattleStart = {
  seed: number;
  partyIds: string[];
  loadout?: BattleLoadoutSnapshot;
};

/** A route and Catalog are immutable dependencies; state contains only mechanical facts. */
export function createBattleEngine(catalog: ValidatedCatalog, routeId: string) {
  const route = v.reference(catalog.data.routes, routeId, "routeId");
  const base: BattleContext = {
    catalog: catalog.data,
    routeId,
    partyOrder: catalog.data.defaultParty,
  };
  const contextFor = (state: BattleState): BattleContext => ({
    ...base,
    partyOrder: state.party.map((member) => member.id),
  });
  return {
    contentRef: catalog.ref,
    routeId,
    create(input: unknown): BattleState {
      v.assertJson(input);
      const start = v.record(
        input,
        "$start",
        ["seed", "partyIds"],
        ["loadout"],
      );
      const seed = v.number(start.seed, "$start.seed", 0, 0xffffffff);
      const partyOrder = v.ids(
        start.partyIds,
        "$start.partyIds",
        catalog.data.maxPartySize,
      );
      if (!partyOrder.length || !partyOrder.includes(catalog.data.leaderId))
        v.invalid("$start.partyIds", "Leader required");
      partyOrder.forEach((id) =>
        v.reference(catalog.data.characters, id, "$start.partyIds"),
      );
      const context = { ...base, partyOrder };
      const loadout = validateLoadout(
        context,
        start.loadout ?? createEmptyBattleLoadout(),
      );
      const rng = createBattleRngState(seed),
        combat = createRngCursor(rng.combat);
      const state = createExpeditionState(
        context,
        combat.rng,
        route.name,
        loadout,
      );
      state.rng = { ...rng, combat: combat.snapshot() };
      return validateBattleState(context, state);
    },
    restore(input: unknown): BattleState {
      return validateBattleState(base, input);
    },
    importLegacy(serialized: string): BattleState {
      if (
        catalog.ref.catalogId !== "abyssa.legacy" ||
        catalog.ref.contentVersion !== 1
      )
        v.invalid(
          "catalog",
          "Legacy import requires legacy-v1",
          "content-mismatch",
        );
      const parsed = v.parseJson(serialized);
      try {
        const migrated = migrateBattleSaveDto(
          { ...base, legacy: true },
          parsed,
        ).state;
        return validateBattleState(base, annotateLegacyEnemies(base, migrated));
      } catch (error) {
        if (error instanceof v.DataValidationError) throw error;
        v.invalid(
          "$legacy",
          error instanceof Error ? error.message : "Invalid legacy save",
        );
      }
    },
    dispatch(input: BattleState, commandInput: unknown): BattleTransition {
      const state = validateBattleState(base, input);
      const command = parseBattleCommand(commandInput);
      const context = contextFor(state);
      const result = dispatchBattleCommand(context, state, command);
      if (result.error)
        return { state: input, events: [], error: result.error };
      return { ...result, state: validateBattleState(context, result.state) };
    },
    complete(input: BattleState) {
      const state = validateBattleState(base, input);
      if (state.mode.type !== "finished")
        v.invalid("mode", "Expedition is not finished", "not-finished");
      return createBattleCompletionOutput(state);
    },
    select(input: BattleState) {
      const state = validateBattleState(base, input),
        context = contextFor(state);
      return {
        phase: getBattlePhase(state),
        status: getExpeditionStatus(state),
        outcome: getRoundOutcome(state),
        canUndo: canUndo(state),
        hand: evaluateHand(context, state),
        faces: Object.fromEntries(
          state.dice.map((die) => [
            die.ownerId,
            getStateFace(context, state, die),
          ]),
        ),
      };
    },
  };
}
export type BattleEngine = ReturnType<typeof createBattleEngine>;
