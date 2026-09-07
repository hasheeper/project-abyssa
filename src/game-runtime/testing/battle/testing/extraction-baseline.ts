import { createHash } from "node:crypto";
import * as legacy from "../../../legacy-battle";
import type { BattleCommand, ExpeditionState } from "../../../legacy-battle";
import { runDeterministicExpedition } from "./baseline";
import { actScenario } from "./scenario";

/** Full JSON fingerprints include RNG, event cursors, logs and nested undo state. */
function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function commandTrace(initial: ExpeditionState, commands: BattleCommand[]) {
  let state = initial;
  return commands.map((command) => {
    const input = fingerprint(state);
    const transition = legacy.dispatchBattleCommand(state, command);
    if (fingerprint(state) !== input) throw new Error("Command mutated input");
    const sameInput = state === transition.state;
    state = transition.state;
    return { command, sameInput, transition: fingerprint(transition) };
  });
}

/** Existing migration arrangements, frozen before S1 moved production code. */
function oldSaves() {
  const v1 = structuredClone(legacy.dispatchBattleCommand(
    legacy.createExpeditionFromSeed(431), { type: "roll-dice" }
  ).state) as unknown as Record<string, unknown>;
  for (const key of ["mode", "rng", "pendingEffects", "pendingReactions", "eventSequence"]) delete v1[key];
  Object.assign(v1, { phase: "act", status: "active", lastOutcome: null, undoStack: [{ action: "partial-v1-entry" }] });
  const v2 = structuredClone(legacy.createExpeditionFromSeed(433)) as unknown as Record<string, unknown>;
  delete v2.loadout;
  delete v2.loadoutAtStart;
  const rolled = legacy.dispatchBattleCommand(legacy.createExpeditionFromSeed(439), { type: "roll-dice" }).state;
  const v3 = structuredClone(legacy.dispatchBattleCommand(rolled, { type: "toggle-load", dieIndex: 0 }).state) as unknown as Record<string, unknown>;
  const addMirrors = (value: Record<string, unknown>) => {
    const mode = value.mode as { type: string };
    value.phase = mode.type === "awaiting-roll" ? "roll" : mode.type === "player-turn" ? "act" : "enemy";
    value.status = mode.type === "greed" ? "greed" : mode.type === "finished" ? "finished" : "active";
    value.lastOutcome = null;
    const party = value.party as Array<{ id: string; downed: boolean; rustLevel: number }>;
    for (const die of value.dice as Array<Record<string, unknown>>) {
      const owner = party.find((member) => member.id === die.ownerId)!;
      Object.assign(die, { downed: owner.downed, rustLevel: owner.rustLevel });
    }
    for (const enemy of value.enemies as Array<Record<string, unknown>>) enemy.dead = Number(enemy.hp) <= 0;
  };
  addMirrors(v3);
  addMirrors((v3.undoStack as Array<{ state: Record<string, unknown> }>)[0]!.state);
  Object.assign((v3.enemies as Array<Record<string, unknown>>)[0]!, { dead: true, hp: 2, intent: null });
  return [v1, v2, v3].map((state, index) => {
    const input = { schemaVersion: index + 1, rulesVersion: 1, contentVersion: 1, state };
    return { input, migrated: fingerprint(legacy.migrateBattleSaveDto(input)) };
  });
}

/** No update switch: the committed expectation came from pre-migration code. */
export function captureExtractionBaseline() {
  const expeditions = [11, 29, 47, 83, 131].map((seed) => {
    const steps: Array<{ command: string; state: string }> = [];
    const run = runDeterministicExpedition(seed, 500, (command, state) => {
      steps.push({ command, state: fingerprint(state) });
    });
    return { seed, steps, terminalSave: fingerprint(legacy.serializeBattleState(run.state)) };
  });
  const initial = legacy.createExpeditionFromSeed(401);
  let interrupted = initial;
  const opening: BattleCommand[] = [{ type: "roll-dice" }, { type: "begin-enemy-turn" }, { type: "resolve-next-enemy" }];
  for (const command of opening) interrupted = legacy.dispatchBattleCommand(interrupted, command).state;
  const remaining: BattleCommand[] = [];
  if (interrupted.mode.type !== "enemy-turn") throw new Error("Expected an interrupted enemy turn");
  for (let i = interrupted.mode.cursor; i < interrupted.mode.enemyOrder.length; i++) remaining.push({ type: "resolve-next-enemy" });
  remaining.push({ type: "finish-enemy-turn" });
  const steal = actScenario(419).face("norma", { verb: "coin" }, true).build();
  const stealCommand: BattleCommand = { type: "steal-from", actorId: "norma", enemyId: steal.enemies[0]!.id };
  const seeded = legacy.createExpeditionFromSeed(19);
  const raw = legacy.createExpeditionStateFromInput(legacy.mulberry32(19), {});
  return {
    exports: Object.keys(legacy).sort(),
    versions: [legacy.BATTLE_SCHEMA_VERSION, legacy.BATTLE_RULES_VERSION, legacy.BATTLE_CONTENT_VERSION],
    expeditions,
    opening: commandTrace(initial, opening),
    interruptedSave: legacy.serializeBattleState(interrupted),
    resumed: commandTrace(legacy.deserializeBattleState(legacy.serializeBattleState(interrupted)), remaining),
    stealSave: legacy.serializeBattleState(steal),
    stealUndoRedo: commandTrace(steal, [stealCommand, { type: "undo" }, stealCommand]),
    rejected: commandTrace(initial, [{ type: "next-round" }, { type: "toggle-load", dieIndex: -1 }]),
    initialization: {
      seeded, raw,
      seededRoll: fingerprint(legacy.dispatchBattleCommand(seeded, { type: "roll-dice" })),
      rawRoll: fingerprint(legacy.dispatchBattleCommand(raw, { type: "roll-dice" })),
      legacyRoll: fingerprint(legacy.rollDice(seeded, legacy.mulberry32(19)))
    },
    migrations: oldSaves()
  };
}
