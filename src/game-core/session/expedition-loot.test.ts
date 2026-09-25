import { expect, it } from "vitest";
import { lootPockets, retainHalfLoot } from "./expedition-loot";
import type { LootDrop } from "../contracts/loot";

const drop = (id: number, definitionId: string, roomId = "room-1"): LootDrop => ({instanceId: `loot:${id}`, definitionId, roomId, grantId: `grant:${id}`, runId: "run"});
it("banks only completed layers and leaves the current layer at risk", () => {
  const items = [drop(1, "a"), drop(2, "a", "room-2"), drop(3, "b", "room-3")];
  const bags = lootPockets(items, [["room-1"], ["room-2", "room-3"]], [1]);
  expect(bags.banked).toEqual([items[0]]);
  expect(bags.unbanked).toEqual(items.slice(1));
  expect(lootPockets(items, [["room-1"], ["room-2", "room-3"]], [1, 2]).unbanked).toEqual([]);
});
it("retains floor(total lots / 2), fairly halves stacks and never creates or mutates instances", () => {
  const items = [drop(1, "a"), drop(2, "b"), drop(3, "b"), drop(4, "b"), drop(5, "c"), drop(6, "d")];
  const before = structuredClone(items);
  expect(retainHalfLoot(items).map(item => item.instanceId)).toEqual(["loot:1", "loot:2", "loot:3"]);
  for (let length = 0; length <= items.length; length++) {
    const kept = retainHalfLoot(items.slice(0, length));
    expect(kept).toHaveLength(Math.floor(length / 2));
    expect(new Set(kept.map(item => item.instanceId)).size).toBe(kept.length);
  }
  expect(items).toEqual(before);
});
