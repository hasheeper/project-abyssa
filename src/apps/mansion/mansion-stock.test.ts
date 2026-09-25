import { describe, expect, it } from "vitest";
import { mansionResourceEntries, mansionNarrativeItems, type StockEquipment, type StockNarrativeView } from "./mansion-stock";
import type { DemoJourneyView } from "../../game-runtime/demo-journey-view";

const supplies: DemoJourneyView["items"] = [
  {id: "item.food", name: "食物", kind: "food", capacity: 3,storageCapacity:3, free: true, storedCharges: 0, availableCharges: 3},
  {id: "item.potion", name: "药水", kind: "potion", capacity: 2,storageCapacity:2, free: false, storedCharges: 2, availableCharges: 2},
];
const equipment: StockEquipment[] = [
  {instanceId: "stored", definitionId: "equipment.spare-blade", location: {kind: "inventory"}, definition: {id: "equipment.spare-blade", slot: "general", scope: "all-native-blanks", replacement: "attack", power: 1}},
  {instanceId: "equipped", definitionId: "equipment.emergency-pouch", location: {kind: "equipped", ownerId: "elora"}, definition: {id: "equipment.emergency-pouch", slot: "general", scope: "all-native-blanks", replacement: "heal", power: 1}},
  {instanceId: "reserved", definitionId: "equipment.spare-blade", location: {kind: "reserved", ownerId: "eustice", runId: "run-1"}},
];

describe("warehouse projection", () => {
  it("shows actual stored quantity even when departure grants a free refill", () => {
    const entries = mansionResourceEntries(supplies, []).fixedEntries;
    expect(entries[0]).toMatchObject({id: "item.food", quantity: 0, type: "基础配给", description: "恢复 1 点生命"});
    expect(entries[1]).toMatchObject({id: "item.potion", quantity: 2, type: "战术补给", description: "恢复 2 点生命"});
    expect(entries[0].note).toBe("出征时补齐所选配给。");
  });
  it("includes owned equipment with real effects and separate stock/equipped/reserved locations", () => {
    const before = structuredClone({supplies, equipment});
    const stock = mansionResourceEntries(supplies, equipment), entries = [...stock.fixedEntries, ...stock.sandboxEntries];
    expect(entries).toHaveLength(5);
    expect(entries[2]).toMatchObject({id: "stored", name: "备用短刃", quantity: 1, ownership: "馆内库存 · 未装备", description: "全部原生空面改为攻击 1"});
    expect(entries[2].status).toBeUndefined();
    expect(entries[3]).toMatchObject({status: "已装备", ownership: "由艾洛拉携带", description: "全部原生空面改为治疗 1"});
    expect(entries[4]).toMatchObject({status: "远征中", ownership: "由尤斯缇丝携带 · 本次远征占用"});
    expect(entries[4].description).toBe("全部原生空面改为攻击 1");
    expect({supplies, equipment}).toEqual(before);
  });
  it("preserves fixed identities/order and puts any other catalogue objects in the open inventory", () => {
    const extended = [...supplies, ...Array.from({length: 12}, (_, index) => ({...supplies[0], id: `new-${index}`}))];
    const stock = mansionResourceEntries(extended.reverse(), []);
    expect(stock.fixedEntries.map(item => item.id)).toEqual(["item.food", "item.potion"]);
    expect(stock.sandboxEntries).toHaveLength(12);
    expect(mansionResourceEntries([], [])).toEqual({fixedEntries: [], sandboxEntries: []});
  });

  it("accepts arbitrary narrative item names only with confirmed carry evidence and removes delivered or lost items", () => {
    const view: StockNarrativeView = {version: 2, entries: ["offered", "accepted", "ready", "resolved", "closed"].map((status, index) => ({
      instance: {id: `commission-${index}`, status, carryFactId: `carry-${index}`},
      card: {objective: {form: "sortie", itemLabel: `未预定义的纪念物${index}`}},
      title: "旧日的约定", objective: "已收好，请带回洋馆。",
    }))};
    const items = mansionNarrativeItems(view);
    expect(items.map(item => item.name)).toEqual(["未预定义的纪念物1", "未预定义的纪念物2"]);
    expect(items.map(item => item.status)).toEqual(["远征中", "待交付"]);
    expect(mansionResourceEntries(supplies, equipment, items).sandboxEntries).toHaveLength(5);
    view.entries[1].instance.carryFactId = null;
    expect(mansionNarrativeItems(view)).toHaveLength(1);
    expect(mansionNarrativeItems({version: 1, instance: {id: "legacy", status: "ready"}, carrying: true, objective: "已带回空药箱。"})[0].name).toBe("空药箱");
    expect(mansionNarrativeItems({version: 1, instance: {id: "legacy", status: "resolved"}, carrying: true, objective: null})).toEqual([]);
    expect(mansionNarrativeItems(null)).toEqual([]);
  });
});
