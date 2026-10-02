import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import type { AnyGameRecord, AnyReceipt, D5Command } from "../game-application";
import { createPlayerRuntime } from "./player-runtime";
import { ESTATE_CATALOG } from "./estate-context";

/** DEV-only review of real unlock queries. Player storage is never opened. */
export async function createCodexBackendPreviewRuntime(stage: "unknown" | "seen" | "defeated" = "defeated") {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let serial = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `codex-preview:${++serial}`, newSeed: () => 8267, close() {} });
  const locator = {saveId: "codex-backend-preview", epoch: "preview"};
  const created = await runtime.application.createNewGame({...locator, clientRequestId: "create", startAt: "debug-offline"});
  if (!created.ok) throw Error(created.error.message);
  const read = () => database.records.get(locator.saveId)!;
  const send = async (command: D5Command) => {
    const result = await (command.type === "resume-run" ? runtime.application.resumeEnemyTurn : runtime.application.dispatch)({protocolVersion: 4, saveId: locator.saveId, expectedHead: read().head, clientRequestId: `preview:${++serial}`, command});
    if (!result.ok) throw Error(result.error.message);
  };
  if (stage !== "unknown") await send({type: "start-expedition", runId: "codex-preview-reef", routeId: "tide-reef.ordinary", partyIds: ESTATE_CATALOG.data.initialParty, itemIds: [], seed: 8267});
  if (stage === "defeated") for (let step = 0; step < 80; step++) {
    const record = read(), data = runtime.queries.codex(record);
    if (data.status === "ready" && data.entries.some(e => e.id === "enemy.slime.mire" && e.stage === "defeated")) break;
    if (record.schemaVersion !== 4 || record.snapshot.run?.kind !== "expedition" || record.snapshot.run.state.node !== "battle") throw Error("Missing preview encounter");
    const run = record.snapshot.run, encounter = run.state.encounter!, runRef = {kind: "expedition" as const, id: run.id};
    if (encounter.phase === "enemy" || !encounter.formation.length) { await send({type: "resume-run", runRef}); continue; }
    if (encounter.phase === "roll") { await send({type: "battle-command", runRef, command: {type: "roll"}}); continue; }
    const die = encounter.dice.find(d => !d.loaded && !d.spent && !d.sealed && run.state.run.party.some(p => p.id === d.ownerId && p.hp > 0));
    if (die) { await send({type: "battle-command", runRef, command: {type: "toggle-load", actorId: die.ownerId}}); continue; }
    const battle = runtime.queries.battle(record);
    const attack = battle?.version === 2 ? battle.party.flatMap(member => member.actions.options.filter(option => option.choice === "attack").map(option => ({actorId: member.id, targetId: option.targetId}))).at(0) : undefined;
    await send({type: "battle-command", runRef, command: attack ? {type: "act", actorId: attack.actorId, choice: "attack", targetId: attack.targetId} : {type: "end-turn"}});
  }
  const data = runtime.queries.codex(read());
  if (data.status !== "ready" || stage === "defeated" && !data.defeated) throw Error("Preview did not reach its requested unlock stage");
  return {runtime, locator, database, store};
}
