import { createExpedition, dispatchBattleCommand, serializeBattleState, type ExpeditionState } from "../legacy-battle";
/** Validated legacy interruption samples, not player data or a production URL backdoor. */
export function interruptionArchive(kind: "cursor" | "next-round" | "clear" | "final-hit" | "wipe") {
  let state = dispatchBattleCommand(createExpedition(() => 0), { type: "roll-dice" }, { rng: () => 0 }).state;
  if (kind === "cursor") {
    state = dispatchBattleCommand(state, { type: "begin-enemy-turn" }).state;
    state = dispatchBattleCommand(state, { type: "resolve-next-enemy" }).state;
  } else if (kind === "next-round") state = dispatchBattleCommand(state, { type: "end-turn" }).state;
  else if (kind === "clear") { for (const enemy of state.enemies) { enemy.hp = 0; enemy.intent = null; } }
  else if (kind === "final-hit") {
    state.layer = 5; state.deepestLayer = 5;
    state.enemies = state.enemies.slice(0, 1); state.enemies[0].hp = 1;
    state.dice[0].loaded = true;
  } else {
    for (const member of state.party) member.hp = 1;
    // Both enemies target the sole standing member; end-turn must produce a wipe.
    for (const member of state.party.slice(1)) { member.hp = 0; member.downed = true; }
    state.enemies[0].intent = { type: "attack", targetId: state.party[0].id, value: 3, title: "测试攻击", description: "中断样本" };
    state.bagGold = 100;
  }
  return serializeBattleState(state as ExpeditionState);
}

/** Empty schema-1 campaign, for legacy compatibility smoke via the normal import UI. */
export async function legacyCampaignArchive() {
  const { MemoryGameStore } = await import("../../game-infrastructure/storage/memory");
  const { createGameRuntime } = await import("../create-runtime");
  const runtime = createGameRuntime(new MemoryGameStore(), {newId: () => "unused", newSeed: () => 19, close() {}});
  const result = await runtime.application.create({protocolVersion: 1, saveId: "legacy-smoke", epoch: "legacy-epoch", clientRequestId: "create"});
  if (!result.ok) throw new Error(result.error.message);
  const archive = await runtime.application.exportSave("legacy-smoke");
  if (!archive.ok) throw new Error(archive.error.message);
  return archive.archive;
}
