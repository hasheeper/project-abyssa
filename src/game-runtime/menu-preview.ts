import { MemoryGameDatabase, MemoryGameStore } from "../game-infrastructure/storage/memory";
import { createGameRuntime } from "./create-runtime";
import { createPlayerRuntime } from "./player-runtime";
import type { AnyGameRecord, AnyReceipt } from "../game-application";
import { FIRST_MORNING_ENTRIES } from "../content/presentation/first-morning";
import { ESTATE_CATALOG } from "./estate-context";

/** DEV menu harness. Everything, including the synthetic save, stays in memory. */
export async function createMenuPreviewRuntime(day = 9) {
  const store = new MemoryGameStore(new MemoryGameDatabase());
  let request = 0;
  const runtime = createGameRuntime(store, { newId: () => `preview-${++request}`, newSeed: () => 19, close() {} });
  const locator = { saveId: "memory-ui-preview", epoch: "preview" };
  const result = await runtime.application.create({ protocolVersion: 1, ...locator, clientRequestId: "create-preview", initial: { clock: { day, phase: "night" } } });
  if (!result.ok) throw new Error("Unable to create menu preview");
  return { runtime, locator };
}

/** DEV-only integration preview: real application commands and the real journal query.
 * The database is isolated in memory, so opening it never touches player saves. */
export async function createMenuBackendPreviewRuntime(includeDeparture: boolean | "skip" | "shop" = false) {
  const database = new MemoryGameDatabase<AnyGameRecord, AnyReceipt>(), store = new MemoryGameStore(database);
  let serial = 0;
  const runtime = createPlayerRuntime(store, { newId: () => `memory-backend:${++serial}`, newSeed: () => 19, close() {} });
  const locator = { saveId: "memory-backend-preview", epoch: "preview" };
  const created = await runtime.application.createNewGame({ ...locator, clientRequestId: "create", startAt: includeDeparture === "shop" ? "debug-shop" : includeDeparture === "skip" ? "hub" : "first-morning", playerName: "林恩" });
  if (!created.ok) throw Error(created.error.message);
  if (includeDeparture === "skip") return {runtime, locator, database, store};
  if (includeDeparture === "shop") {
    const send = async (command: import("../game-application").D5Command) => {
      const result = await runtime.application.dispatch({ protocolVersion: 4, saveId: locator.saveId,
        expectedHead: database.records.get(locator.saveId)!.head, clientRequestId: `shop:${++serial}`, command });
      if (!result.ok) throw Error(result.error.message);
    };
    await send({ type: "begin-shop-visit", shopId: "shop.mansion" });
    for (let count = 0; count < 100; count++) {
      const raw = database.records.get(locator.saveId)!;
      if (raw.schemaVersion !== 4) throw Error("Expected current preview save");
      const progress = raw.snapshot.campaign.shopVisit!;
      if (progress.status === "completed") break;
      if (progress.phase === "appraise" || progress.phase === "sell") await send({
        type: progress.phase === "appraise" ? "appraise-shop-visit" : "sell-shop-visit", shopId: "shop.mansion",
        quoteVersion: runtime.queries.shop(raw)!.loot!.quoteVersion,
      });
      else await send({ type: "advance-shop-visit", shopId: "shop.mansion", phase: progress.phase, step: progress.step,
        choice: progress.phase === "valuation" && progress.step === 17 ? "B" : "continue" });
    }
    return { runtime, locator, database, store };
  }
  // Finish the first two sections using their actual choices and read checkpoints.
  const count = includeDeparture ? FIRST_MORNING_ENTRIES.length : FIRST_MORNING_ENTRIES.findIndex(e => e.section > 2);
  for (let step = 0; step < count; step++) {
    const record = database.records.get(locator.saveId)!;
    const result = await runtime.application.dispatch({ protocolVersion: 4, saveId: locator.saveId, expectedHead: record.head, clientRequestId: `read:${step}`,
      command: { type: "advance-opening", step, choice: FIRST_MORNING_ENTRIES[step].kind === "decision" ? "B" : "continue" } });
    if (!result.ok) throw Error(result.error.message);
  }
  if (includeDeparture) {
    const spec = ESTATE_CATALOG.data.tutorial!;
    const send = async (command: import("../game-application").D5Command) => {
      const result = await runtime.application.dispatch({ protocolVersion: 4, saveId: locator.saveId, expectedHead: database.records.get(locator.saveId)!.head,
        clientRequestId: `depart:${++serial}`, command });
      if (!result.ok) throw Error(result.error.message);
    };
    await send({ type: "start-expedition", runId: "memory-preview-tide", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed: 19 });
    const tutorial = runtime.queries.tutorial(database.records.get(locator.saveId)!)!;
    await send({ type: "tutorial-read", runRef: tutorial.runRef!, storyId: tutorial.story!.id, step: tutorial.story!.step, choice: "continue" });
  }
  return { runtime, locator, database, store };
}
