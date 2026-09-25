import {expect, it} from "vitest";
import {render, screen, cleanup} from "@testing-library/react";
import {UiMotionProvider} from "../../../shared/ui/motion/UiMotionProvider";
import {LootLedger} from "./LootLedger";
import {LootSettlementView} from "./LootSettlementView";
import type {LootItemView} from "./loot-item";

const empty = {copper: 0, items: []};
const quest = {copper: 0, items: [{itemId: "case", quantity: 1}]};
const catalog: Record<string, LootItemView> = {case: {id: "case", name: "空药箱", description: "等待交付的委托物品。", icon: "/case.svg", kind: "quest", rarity: "bronze"}};
it("renders the separate quest bag and explains the actual wipe rule", () => {
  render(<LootLedger run={{layer: 3, banked: empty, unbanked: empty, questItems: quest}} catalog={catalog} log={[]} onClose={() => {}}/>);
  expect(screen.getByText("委托物品")).toBeInTheDocument();
  expect(screen.getByText("安全返回后交付 · 团灭遗失")).toBeInTheDocument();
  expect(screen.getAllByText("空药箱").length).toBeGreaterThan(0);
  cleanup();
});
it.each([false, true])("renders returned versus lost quest objects in the real settlement component, lost=%s", lost => {
  render(<UiMotionProvider preference="reduced"><LootSettlementView catalog={catalog} context={{locationName: "旧庄园"}} onConfirm={() => {}}
    receipt={{outcome: lost ? "failed" : "retreated", layer: 3, banked: empty, unbanked: empty, returned: empty, lostBanked: empty, lostUnbanked: empty, questReturned: lost ? empty : quest, questLost: lost ? quest : empty}}/></UiMotionProvider>);
  expect(screen.getByLabelText(lost ? "遗失委托物品" : "带回委托物品", {selector: "section"})).toBeInTheDocument();
  expect(screen.getByText(lost ? /空药箱未能带回/ : "返回洋馆后交给委托人。")).toBeInTheDocument();
  cleanup();
});
