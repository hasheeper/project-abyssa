import { describe, expect, it } from "vitest";
import { bankLayer, collectDrop, createLootRun, emptyPocket, enterNextLayer, finishRun, itemCount, previewHalfItems, type LootDrop } from "./loot-model";

const first: LootDrop = { id: "kill:1", source: "候席客", rewards: { copper: 501, items: [{ itemId: "key", quantity: 3 }, { itemId: "box", quantity: 2 }] } };
const second: LootDrop = { id: "chest:2", source: "暗柜", rewards: { copper: 380, items: [{ itemId: "rune", quantity: 3 }, { itemId: "key", quantity: 1 }] } };
const mixed = () => collectDrop(enterNextLayer(bankLayer(collectDrop(createLootRun(), first))), second);

describe("ordinary expedition loot preview", () => {
  it("acquires during play, records the source and protects the acquisition ID", () => {
    const run = collectDrop(createLootRun(), first);
    expect(run.unbanked).toEqual(first.rewards);
    expect(run.banked).toEqual(emptyPocket());
    expect(run.events).toEqual([{ id: first.id, layer: 1, kind: "found", text: first.source }]);
    expect(collectDrop(run, first)).toBe(run);
  });
  it("banks money and items together once; only money receives the layer multiplier", () => {
    const run = mixed();
    const banked = bankLayer(run);
    expect(banked.banked).toEqual({ copper: 976, items: [{ itemId: "key", quantity: 4 }, { itemId: "box", quantity: 2 }, { itemId: "rune", quantity: 3 }] });
    expect(banked.unbanked).toEqual(emptyPocket());
    expect(bankLayer(banked)).toBe(banked);
    expect(collectDrop(banked, { ...second, id: "late" })).toBe(banked);
    expect(enterNextLayer(banked).banked).toEqual(banked.banked);
    expect(enterNextLayer(run)).toBe(run);
  });
  it("retreat loses the current layer and keeps every previously banked item", () => {
    const result = finishRun(mixed(), "retreated").settlement!;
    expect(result.returned).toEqual(first.rewards);
    expect(result.lostUnbanked).toEqual(second.rewards);
    expect(result.lostBanked).toEqual(emptyPocket());
  });
  it("failure loses current-layer loot and halves previously banked money and item count", () => {
    const result = finishRun(mixed(), "failed").settlement!;
    expect(result.returned.copper).toBe(250);
    expect(itemCount(result.returned)).toBe(2);
    expect(result.lostBanked.copper).toBe(251);
    expect(itemCount(result.lostBanked)).toBe(3);
    expect(result.lostUnbanked).toEqual(second.rewards);
  });
  it("clear banks the final layer before creating the receipt", () => {
    const result = finishRun(mixed(), "cleared").settlement!;
    expect(result.returned.copper).toBe(976);
    expect(itemCount(result.returned)).toBe(9);
    expect(result.unbanked).toEqual(emptyPocket());
    expect(result.lostBanked).toEqual(emptyPocket());
    expect(result.lostUnbanked).toEqual(emptyPocket());
  });
  it("clear after an already banked final layer never reapplies the multiplier", () => {
    const run = bankLayer(mixed());
    expect(finishRun(run, "cleared").settlement!.returned).toEqual(run.banked);
  });
  it.each(["failed", "retreated", "cleared"] as const)("empty %s still has a receipt", outcome => {
    const result = finishRun(createLootRun(), outcome).settlement!;
    expect(result.outcome).toBe(outcome);
    expect(result.returned).toEqual(emptyPocket());
  });
  it("ends the run once and ignores late callbacks and attempts to change the result", () => {
    const before = mixed();
    const run = finishRun(before, "failed");
    expect(finishRun(run, "retreated")).toBe(run);
    expect(bankLayer(run)).toBe(run);
    expect(enterNextLayer(run)).toBe(run);
    expect(collectDrop(run, { ...second, id: "late" })).toBe(run);
    expect(before.settlement).toBeNull();
    expect(before.unbanked).toEqual(second.rewards);
    expect(run.settlement!.banked.items[0]).not.toBe(before.banked.items[0]);
  });
  it("does not drop every singleton when the total can return half", () => {
    const items = [{ itemId: "a", quantity: 1 }, { itemId: "b", quantity: 1 }, { itemId: "c", quantity: 3 }];
    expect(previewHalfItems(items)).toEqual([{ itemId: "a", quantity: 1 }, { itemId: "c", quantity: 1 }]);
    expect(previewHalfItems([{ itemId: "a", quantity: 1 }])).toEqual([]);
    expect(items[0]!.quantity).toBe(1);
  });
  it("conserves every item across returned and lost quantities", () => {
    for (let a = 1; a < 8; a++) for (let b = 1; b < 8; b++) {
      const items = [{ itemId: "a", quantity: a }, { itemId: "b", quantity: b }];
      const run = bankLayer(collectDrop(createLootRun(), { ...first, rewards: { copper: 10001, items } }));
      const result = finishRun(run, "failed").settlement!;
      expect(itemCount(result.returned)).toBe(Math.floor((a + b) / 2));
      for (const item of items) expect((result.returned.items.find(x => x.itemId === item.itemId)?.quantity ?? 0) + (result.lostBanked.items.find(x => x.itemId === item.itemId)?.quantity ?? 0)).toBe(item.quantity);
    }
  });
  it("accepts a replacement retention policy without changing presentation", () => {
    expect(finishRun(mixed(), "failed", () => []).settlement!.returned.items).toEqual([]);
  });
  it("rejects fractional/negative incoming quantities", () => {
    expect(() => collectDrop(createLootRun(), { ...first, rewards: { copper: -1, items: [] } })).toThrow();
    expect(() => collectDrop(createLootRun(), { ...first, rewards: { copper: 100, items: [{ itemId: "a", quantity: .5 }] } })).toThrow();
  });
});
