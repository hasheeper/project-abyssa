/** Disposable ordinary-expedition preview. No save, tutorial or wallet writes. */
import { itemCount, type LootStack, type LootPocket, type LootOutcome, type LootSettlement } from "../loot/loot-types";
export { itemCount, hasLoot } from "../loot/loot-types";
export type { LootStack, LootPocket, LootOutcome, LootSettlement } from "../loot/loot-types";
export type LootEvent = { id: string; layer: number; kind: "found" | "banked" | "ended"; text: string };
export type LootRun = {
  layer: number;
  maxLayers: number;
  unbanked: LootPocket;
  banked: LootPocket;
  claimed: string[];
  bankedLayers: number[];
  events: LootEvent[];
  settlement: LootSettlement | null;
};
export type LootDrop = { id: string; source: string; rewards: LootPocket };
export const emptyPocket = (): LootPocket => ({ copper: 0, items: [] });
export const layerFactor = (run: LootRun) => [1, 1.25, 1.5, 1.75, 2][run.layer - 1] ?? 2;
export const projectedCopper = (run: LootRun) => Math.round(run.unbanked.copper * layerFactor(run));
export const createLootRun = (): LootRun => ({ layer: 1, maxLayers: 5, unbanked: emptyPocket(), banked: emptyPocket(), claimed: [], bankedLayers: [], events: [], settlement: null });
const copyPocket = (pocket: LootPocket): LootPocket => ({ copper: pocket.copper, items: pocket.items.map(item => ({ ...item })) });

function mergePockets(left: LootPocket, right: LootPocket): LootPocket {
  const items = new Map(left.items.map(item => [item.itemId, item.quantity]));
  right.items.forEach(item => items.set(item.itemId, (items.get(item.itemId) ?? 0) + item.quantity));
  return { copper: left.copper + right.copper, items: [...items].map(([itemId, quantity]) => ({ itemId, quantity })) };
}
function subtractPocket(total: LootPocket, part: LootPocket): LootPocket {
  return { copper: total.copper - part.copper, items: total.items.map(item => ({ ...item, quantity: item.quantity - (part.items.find(kept => kept.itemId === item.itemId)?.quantity ?? 0) })).filter(item => item.quantity > 0) };
}

/** Stable event IDs prevent a kill/treasure callback from granting twice. */
export function collectDrop(run: LootRun, drop: LootDrop): LootRun {
  if (run.settlement || run.bankedLayers.includes(run.layer) || run.claimed.includes(drop.id)) return run;
  if (!Number.isSafeInteger(drop.rewards.copper) || drop.rewards.copper < 0 || drop.rewards.items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) throw new Error("Invalid preview loot quantity");
  return { ...run, unbanked: mergePockets(run.unbanked, drop.rewards), claimed: [...run.claimed, drop.id], events: [...run.events, { id: drop.id, layer: run.layer, kind: "found", text: drop.source }] };
}

export function bankLayer(run: LootRun): LootRun {
  if (run.settlement || run.bankedLayers.includes(run.layer)) return run;
  const payout = { copper: projectedCopper(run), items: run.unbanked.items };
  return { ...run, banked: mergePockets(run.banked, payout), unbanked: emptyPocket(), bankedLayers: [...run.bankedLayers, run.layer], events: [...run.events, { id: `bank:${run.layer}`, layer: run.layer, kind: "banked", text: `本层收获入袋 · ${payout.copper.toLocaleString("en-US")} G · ${itemCount(run.unbanked)} 件道具` }] };
}

export function enterNextLayer(run: LootRun): LootRun {
  if (run.settlement || !run.bankedLayers.includes(run.layer) || run.layer >= run.maxLayers) return run;
  return { ...run, layer: run.layer + 1 };
}

export type RetainItemsPolicy = (items: readonly LootStack[]) => LootStack[];
/**
 * PREVIEW POLICY ONLY: retain floor(total units / 2). Halve each stack, then
 * allocate remaining units to odd stacks in first-acquired order. Replace this
 * policy at the production boundary once odd quantities/unique drops are agreed.
 */
export const previewHalfItems: RetainItemsPolicy = items => {
  const retained = items.map(item => ({ ...item, quantity: Math.floor(item.quantity / 2) }));
  let remaining = Math.floor(items.reduce((sum, item) => sum + item.quantity, 0) / 2) - retained.reduce((sum, item) => sum + item.quantity, 0);
  items.forEach((item, index) => { if (remaining > 0 && item.quantity % 2) { retained[index]!.quantity += 1; remaining -= 1; } });
  return retained.filter(item => item.quantity > 0);
};

/** Settlement is a frozen receipt; reopening it cannot re-award or re-halve. */
export function finishRun(run: LootRun, outcome: LootOutcome, retainItems: RetainItemsPolicy = previewHalfItems): LootRun {
  if (run.settlement) return run;
  const finished = outcome === "cleared" ? bankLayer(run) : run;
  const returned = outcome === "failed"
    ? { copper: Math.floor(finished.banked.copper / 2), items: retainItems(finished.banked.items) }
    : copyPocket(finished.banked);
  return { ...finished, settlement: {
    outcome, layer: finished.layer, banked: copyPocket(finished.banked), unbanked: copyPocket(finished.unbanked), returned,
    lostUnbanked: copyPocket(finished.unbanked), lostBanked: subtractPocket(finished.banked, returned),
  }, events: [...finished.events, { id: "end", layer: finished.layer, kind: "ended", text: outcome === "cleared" ? "远征完成，收获全部带回" : outcome === "failed" ? "远征失败，保留已入袋收获的一半" : "撤离远征，带回全部已入袋收获" }] };
}
