import { expect, it } from "vitest";
import { shopLootPresentation } from "../content/presentation/shop-loot";
import { pendingAppraisalGroups } from "./journal-appraisal";
import { itemIconCatalog } from "../assets/icons/items/catalog";

it("groups repeated unknown drops without changing owned lots or revealing appraised content", () => {
  const compass = "loot.curio.navigation-compass", nail = "loot.tutorial.barrier-nail";
  const owned = Object.freeze([
    Object.freeze({definitionId: compass, resultId: null}),
    Object.freeze({definitionId: nail, resultId: null}),
    Object.freeze({definitionId: compass, resultId: "known-compass"}),
    Object.freeze({definitionId: compass, resultId: null}),
  ]);
  const groups = pendingAppraisalGroups(owned);
  expect(groups.map(item => [item.id, item.name, item.quantity])).toEqual([
    [compass, "盐封的圆盒", 2], [nail, "发黑的金属钉", 1],
  ]);
  expect(groups[0].icon).toBe(shopLootPresentation[compass].unknownIconUrl);
  expect(groups[0].icon).not.toBe(shopLootPresentation[compass].iconUrl);
  expect(JSON.stringify(groups)).not.toContain("旧航海罗盘");
  expect(JSON.stringify(groups)).not.toContain('"rarity"');
  expect(owned).toHaveLength(4);
  expect(owned[0].resultId).toBeNull();
});

it("removes identified items and retains an unfamiliar saved item with a neutral fallback", () => {
  expect(pendingAppraisalGroups([{definitionId: "loot.tutorial.barrier-nail", resultId: "known"}])).toEqual([]);
  expect(pendingAppraisalGroups([{definitionId: "unavailable-presentation", resultId: null}])).toEqual([
    expect.objectContaining({id: "unavailable-presentation", name: "未鉴定物品", quantity: 1, appearance: "", icon: expect.any(String)}),
  ]);
});

it("keeps generated curios separate from their old template and uses only public names for icons", () => {
  const definitionId = "loot.curio.navigation-compass";
  const loot = ["a", "b", "c", "d"].map(instanceId => ({instanceId, definitionId, resultId: instanceId === "d" ? "known" : null}));
  const generated = {a: {unknownName: "蜡封的锁盒", appearance: "蜡封住了盒沿。"}, b: {unknownName: "生锈的钥匙", appearance: "齿口磨损了。"},
    c: {unknownName: "无法辨认的旧物", appearance: "像是罗盘，又像是怀表，暂时看不清。"}};
  const groups = pendingAppraisalGroups(loot, generated);
  expect(groups.map(item => [item.id, item.name, item.quantity])).toEqual([
    ["a", generated.a.unknownName, 1], ["b", generated.b.unknownName, 1], ["c", generated.c.unknownName, 1],
  ]);
  expect(groups.map(item => item.icon)).toEqual(["locked-box", "key", "swap-bag"].map(id => itemIconCatalog.find(item => item.id === id)!.assetUrl));
  expect(JSON.stringify(groups)).not.toContain("旧航海罗盘");
});
