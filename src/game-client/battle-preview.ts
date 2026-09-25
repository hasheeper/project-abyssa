import { createBattlePreviewRuntime } from "../game-runtime/battle-preview";
import { GameSession } from "./session";

export async function createBattlePreviewSession(seed = 19) {
  const runtime = createBattlePreviewRuntime(seed);
  const locator = { saveId: "battle-loot-preview", epoch: "preview", expeditionId: "preview-run" };
  const created = await runtime.application.createNewGame({ saveId: locator.saveId, epoch: locator.epoch, clientRequestId: "preview-create", startAt: "hub" });
  if (!created.ok) { runtime.close(); throw Error(created.error.message); }
  const values = new Map<string, string>();
  const session = new GameSession(runtime, locator, {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  });
  try {
    await session.refresh();
    const record = session.getSnapshot().record;
    if (!record) throw Error("预览档案未能载入");
    const journey = runtime.queries.journey(record)!;
    const itemIds = journey.defaultItems.filter(id => journey.items.some(i => i.id === id && i.availableCharges > 0)).slice(0, journey.itemLimit);
    const selection = journey.facilities ? {supplyQuantities: Object.fromEntries(itemIds.map(id => [id, journey.items.find(i => i.id === id)!.availableCharges]))} : {};
    await session.dispatch({ ...selection, type: "start-expedition", runId: locator.expeditionId, routeId: journey.defaultRouteId, partyIds: journey.initialParty, itemIds, seed });
    if (!runtime.queries.journey(session.getSnapshot().record!)?.battle) throw Error(session.getSnapshot().error?.message ?? "预览战斗未能开始");
    return session;
  } catch (error) { session.dispose(); throw error; }
}
