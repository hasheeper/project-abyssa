import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { d5VisibleEvents } from "../../../game-runtime/d5-views";
import type { AnyGameRecord } from "../../../game-application";
import { bankLayer, collectDrop, createLootRun, finishRun, type LootRun } from "./loot-model";

/** Placeholder drops keyed by an actual defeated enemy, never by clicking a UI button. */
export function previewDropItem(targetId: string) {
  const hash = [...targetId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ["key", "rune", "box", "ward", "ring"][hash % 5]!;
}

/** Rebuild from live facts so undo/replay and room transitions cannot duplicate items. */
export function deriveLoot(record: AnyGameRecord, view: DemoJourneyView): LootRun {
  const source = view.expedition;
  let run = createLootRun();
  if (record.schemaVersion !== 4) return run;
  // A successful run is automatically settled by GameSession. Its terminal
  // receipt outlives snapshot.run, so a clear must also project from history.
  const terminal = source?.node === "finished" ? source.result : !source ? view.lastSettlement : null;
  const runId = source?.run.id ?? terminal?.runId;
  if (!runId) return run;
  run.maxLayers = view.layerCount;
  for (const [index, fact] of d5VisibleEvents(record, { kind: "expedition", id: runId }).entries()) {
    const p = fact.payload as Record<string, unknown>;
    if (typeof p.layer === "number") run = { ...run, layer: p.layer };
    if ((fact.kind === "enemy-defeated" || fact.kind === "enemy-released") && Number(p.bounty) > 0) {
      const itemId = previewDropItem(String(p.targetId));
      run = collectDrop(run, { id: `${fact.id}:${index}`, source: "战斗拾获", rewards: { copper: Number(p.bounty) || 0, items: [{ itemId, quantity: itemId === "rune" ? 2 : 1 }] } });
    }
    if (fact.kind === "layer-banked") {
      // The ordinary engine owns every money multiplier. Only item banking is previewed.
      const banked = bankLayer(run);
      run = { ...banked, banked: { ...banked.banked, copper: run.banked.copper + Number(p.gold) } };
    }
  }
  run = { ...run, layer: source?.run.layer ?? terminal!.deepestLayer,
    unbanked: { ...run.unbanked, copper: terminal ? terminal.lostLooseGold : source!.run.looseGold },
    banked: { ...run.banked, copper: terminal ? terminal.bankedGold : source!.run.bankedGold } };
  if (terminal) {
    const outcome = terminal.outcome === "wipe" ? "failed" : terminal.outcome === "extracted" ? "retreated" : "cleared";
    run = finishRun(run, outcome);
  }
  return run;
}
