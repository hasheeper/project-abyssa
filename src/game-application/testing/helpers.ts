import { createBattleEngine, type BattleCommand } from "../../game-core/battle";
import { activeExecution } from "../../game-core/session";
import { createGameApplication } from "../service";
import type { GameApplication } from "../service";
import type { GameStorePort, GameRecord } from "../contracts";
import type { GameCommand } from "../parse";
import { LEGACY_VALIDATED_CATALOG as catalog } from "../../game-runtime/legacy-context";
export { catalog };
export const creation = (saveId = "save", epoch = "epoch") => ({
  protocolVersion: 1,
  saveId,
  epoch,
  clientRequestId: "create",
});
export const startCommand: Extract<GameCommand, { type: "start-expedition" }> =
  {
    type: "start-expedition",
    expeditionId: "run",
    routeId: catalog.data.defaultRouteId,
    partyIds: [...catalog.data.defaultParty],
    itemIds: [],
    equipmentIds: [],
    seed: 19,
  };
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export const appFor = (store: GameStorePort) =>
  createGameApplication({ catalog, store });
export async function opened(
  app: GameApplication,
  saveId = "save",
): Promise<GameRecord> {
  const r = await app.open(saveId);
  ensure(r.ok, JSON.stringify(r));
  return r.record;
}
export function request(
  record: GameRecord,
  command: GameCommand,
  clientRequestId = `cmd-${record.head.revision + 1}`,
) {
  return {
    protocolVersion: 1,
    saveId: record.head.saveId,
    clientRequestId,
    expectedHead: record.head,
    command,
  };
}
export async function send(
  app: GameApplication,
  command: GameCommand,
  saveId = "save",
) {
  const r = await app.dispatch(request(await opened(app, saveId), command));
  ensure(r.ok, JSON.stringify(r));
  return r;
}
export async function terminal(
  app: GameApplication,
  saveId = "save",
  rules = catalog,
) {
  for (let i = 0; i < 100; i++) {
    const r = await opened(app, saveId),
      e = r.snapshot.expedition;
    ensure(e, "No expedition");
    if (e.lifecycle.type === "finished") return r;
    const type =
      e.lifecycle.type === "exit-choice"
        ? "leave-expedition"
        : (
            {
              "awaiting-roll": "roll-dice",
              "player-turn": "end-turn",
              "enemy-turn": "next-round",
            } as const
          )[r.snapshot.encounter!.turn!.type];
    let command: BattleCommand = { type };
    if (r.snapshot.encounter?.turn?.type === "player-turn") {
      const engine = createBattleEngine(rules, e.routeId),
        state = activeExecution(r.snapshot);
      const candidates: BattleCommand[] = [
        ...state.dice
          .map((_, dieIndex) => ({ type: "toggle-load" as const, dieIndex }))
          .filter((c) => !state.dice[c.dieIndex].loaded),
        ...state.party.flatMap((p) =>
          state.enemies.map((enemy) => ({
            type: "attack-enemy" as const,
            actorId: p.id,
            enemyId: enemy.id,
          })),
        ),
      ];
      command =
        candidates.find((c) => !engine.dispatch(state, c).error) ?? command;
    }
    await send(
      app,
      { type: "battle-command", expeditionId: e.id, command },
      saveId,
    );
  }
  throw new Error("No terminal in 100 commands");
}
