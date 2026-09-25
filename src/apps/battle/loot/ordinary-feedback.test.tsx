import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { ORDINARY_DROPS_CATALOG } from "../../../game-runtime/ordinary-drops-context";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { expeditionRewardFeedback, useExpeditionLootFeedback } from "./useExpeditionLootFeedback";
import { expeditionLootCatalog } from "./expedition-loot-view";

const view = {lootContent: ORDINARY_DROPS_CATALOG.data.loot, items: [], tutorial: null, battle: null} as unknown as DemoJourneyView;
const found = (id: string, definitionId = "loot.salvage.shell", roomId = "run:room:1:1") => ({id, type: "loot-found", actorId: null, payload: {definitionId, roomId}});
it("stacks distinct rewards, merges same-room items, and never replays duplicate events", () => {
  const {result, rerender} = renderHook(({id}) => useExpeditionLootFeedback(id), {initialProps: {id: "run"}});
  act(() => {
    result.current.onEventPresented(found("one"), view);
    result.current.onEventPresented(found("two"), view);
    result.current.onEventPresented(found("two"), view);
    result.current.onEventPresented(found("three", "loot.salvage.mire-gel"), view);
  });
  expect(result.current.entries).toHaveLength(2);
  expect(result.current.entries[0]).toMatchObject({kind: "reward", reward: {name: "螺壳", quantity: 2}});
  expect(result.current.entries[1]).toMatchObject({kind: "reward", reward: {name: "浊泥凝胶", quantity: 1}});
  act(() => result.current.onEventPresented(found("four", "loot.salvage.shell", "run:room:1:2"), view));
  expect(result.current.entries).toHaveLength(3);
  act(() => result.current.dismiss(result.current.entries[0].id));
  act(() => result.current.onEventPresented(found("one"), view));
  expect(result.current.entries).toHaveLength(2);
  rerender({id: "next-run"}); expect(result.current.entries).toEqual([]);
});
it("shares authored item information and hides a curio's identity and quality", () => {
  const items = expeditionLootCatalog(view);
  expect(items["loot.curio.navigation-compass"]).toMatchObject({name: "盐封的圆盒", kind: "appraisal", rarity: "unknown"});
  expect(items["loot.salvage.clock-wheel"]).toMatchObject({name: "完整钟轮", kind: "common", rarity: "silver"});
  expect(Object.keys(items)).toHaveLength(Object.keys(ORDINARY_DROPS_CATALOG.data.loot!.definitions).length);
});

it("notifies tutorial rewards, clears retry leftovers and still excludes memory battles", () => {
  const tutorial = {...view, tutorial: {runRef: {kind: "expedition", id: "tutorial"}}} as DemoJourneyView;
  const {result} = renderHook(() => useExpeditionLootFeedback("tutorial"));
  act(() => {
    result.current.onEventPresented(found("coins", "loot.tutorial.cross-coins"), tutorial);
    result.current.onEventPresented(found("nail", "loot.tutorial.barrier-nail"), tutorial);
  });
  expect(result.current.entries).toHaveLength(2);
  expect(result.current.entries[0]).toMatchObject({kind: "reward", reward: {name: "旧十字币", quantity: 12}});
  expect(result.current.entries[1]).toMatchObject({kind: "reward", reward: {name: "发黑的金属钉", rarity: "unknown"}});
  act(() => result.current.onEventPresented({id: "retry", type: "tutorial-retried", actorId: null, payload: {}}, tutorial));
  expect(result.current.entries).toEqual([]);
  act(() => result.current.onEventPresented(found("coins", "loot.tutorial.cross-coins"), tutorial));
  expect(result.current.entries).toEqual([]);
  act(() => result.current.onEventPresented(found("new-attempt", "loot.tutorial.cross-coins"), tutorial));
  expect(result.current.entries).toHaveLength(1);
  expect(expeditionRewardFeedback(found("memory"), {...view, battle: {encounter: {memory: {}}}} as DemoJourneyView)).toBeNull();
});
