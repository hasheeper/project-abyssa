import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { DeparturePreparation } from "./DeparturePreparation";
import type { DepartureSupply } from "./useDepartureLoadout";

afterEach(cleanup);
const items: DepartureSupply[] = [
  {id:"food",kind:"food",name:"食物",capacity:4,storageCapacity:4,free:true,storedCharges:1,availableCharges:4},
  {id:"potion",kind:"potion",name:"药水",capacity:2,storageCapacity:2,free:true,storedCharges:0,availableCharges:2},
  {id:"ward",kind:"ward",name:"护符",capacity:2,storageCapacity:2,free:false,storedCharges:2,availableCharges:2},
  {id:"water",kind:"holy-water",name:"圣水",capacity:2,storageCapacity:2,free:false,storedCharges:1,availableCharges:1},
  {id:"tools",kind:"maintenance-kit",name:"保养工具",capacity:1,storageCapacity:1,free:false,storedCharges:1,availableCharges:1},
  {id:"charm",kind:"lucky-charm",name:"幸运符",capacity:1,storageCapacity:1,free:false,storedCharges:0,availableCharges:0},
  {id:"slip",kind:"divination-slip",name:"卦签",capacity:2,storageCapacity:2,free:false,storedCharges:0,availableCharges:0},
];
function Preparation({lockedReason, stocked = false, itemLimit}: {lockedReason?:string; stocked?:boolean; itemLimit?:number}) {
  const [selectedIds,onChange] = useState(["food","potion"]);
  return <DeparturePreparation items={stocked ? items.map(item => ({...item, availableCharges: Math.max(1, item.availableCharges)})) : items} selectedIds={selectedIds} onChange={onChange} lockedReason={lockedReason} itemLimit={itemLimit}
    funds={{public:0,party:44,crystals:0}} mapHref="/map.html" shopHref="/shop.html" equipmentHref="/character-status.html"/>;
}

it("separates six carry slots, seven inspectable supplies, and real stock versus departure allowance", async () => {
  const user = userEvent.setup(); render(<Preparation/>);
  expect(within(screen.getByRole("list",{name:"出征携带位"})).getAllByRole("listitem")).toHaveLength(6);
  expect(within(screen.getByRole("list",{name:"可选补给"})).getAllByRole("button")).toHaveLength(7);
  expect(screen.queryByText("选择物品 · 查看详情")).toBeNull();
  expect(screen.queryByText("已列入本次出征方案")).toBeNull();
  expect(screen.queryByText("方案带入出征编队，确认出发时领取。")).toBeNull();
  expect(screen.queryByRole("status")).toBeNull();
  expect(within(screen.getByRole("navigation",{name:"整备操作"})).getAllByRole("link")).toHaveLength(3);
  const detail = screen.getByRole("complementary",{name:"补给详情"});
  expect(detail).toHaveTextContent("当前库存1 份出征携带4 份");
  await user.click(screen.getByRole("button",{name:"查看幸运符详情"}));
  expect(detail).toHaveTextContent("增加一次重掷");
  expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
  expect(detail).toHaveTextContent("暂无库存，请先补充");
});

it("uses the warehouse interface artwork and corner counts without nested trays or collapsed empty labels", async () => {
  const user = userEvent.setup();
  const {container} = render(<Preparation/>);
  expect(container.querySelectorAll(".journal-surface")).toHaveLength(0);
  const inset = container.querySelector(".departure-preparation__inventory.manor-utility__inset");
  expect(inset).not.toBeNull();
  expect(inset!.querySelectorAll(".departure-preparation__group")).toHaveLength(2);
  expect(container.querySelectorAll(".manor-utility__inset")).toHaveLength(1);
  expect(container.querySelectorAll(".abyssa-item-slot[data-rarity]")).toHaveLength(0);
  for (const slot of container.querySelectorAll(".abyssa-item-slot")) expect(slot).toHaveAttribute("data-tone", "interface");
  for (const slot of container.querySelectorAll(".abyssa-item-slot:not([data-empty])")) {
    expect([...slot.querySelectorAll("[data-layer]")].map(layer => layer.getAttribute("data-layer")))
      .toEqual(["surface", "halo-a", "halo-b", "glyph-depth", "glyph", "glyph-highlight"]);
  }
  const loadout = screen.getByRole("list", {name: "出征携带位"}), catalogue = screen.getByRole("list", {name: "可选补给"});
  for (const slot of loadout.querySelectorAll(".abyssa-item-slot")) expect(slot).toHaveStyle("--slot-size: 108px");
  for (const slot of catalogue.querySelectorAll(".abyssa-item-slot")) expect(slot).toHaveStyle("--slot-size: 80px");
  const counts = (root: HTMLElement) => [...root.querySelectorAll(".abyssa-item-count")].map(node => node.textContent);
  expect(counts(loadout)).toEqual(["4", "2"]);
  expect(counts(catalogue)).toEqual(["1", "0", "2", "1", "1", "0", "0"]);
  expect(catalogue.querySelectorAll(".departure-preparation__item-name")).toHaveLength(0);
  for (const item of items) {
    expect(within(catalogue).getByRole("button", {name: `查看${item.name}详情`})).toHaveAttribute("title", item.name);
    expect(within(catalogue).queryByText(item.name, {exact: true})).toBeNull();
  }
  expect(container.querySelector(".abyssa-item-slot__badge")).toBeNull();
  expect(screen.getByRole("button", {name: "查看药水详情"})).toHaveAccessibleDescription("库存 0 份，免费配给 2 份，已装入行囊");
  expect(loadout.querySelectorAll(".departure-preparation__item-name")).toHaveLength(6);
  expect(loadout.querySelectorAll('[data-empty] .departure-preparation__item-name')).toHaveLength(4);
  await user.click(screen.getByRole("button", {name: "移出行囊"}));
  expect(counts(loadout)).toEqual(["2"]);
  expect(loadout.querySelectorAll(".departure-preparation__item-name")).toHaveLength(6);
  expect(loadout.querySelectorAll('[data-empty] .departure-preparation__item-name')).toHaveLength(5);
  expect(counts(catalogue)).toEqual(["1", "0", "2", "1", "1", "0", "0"]);
});

it("uses three identifiable icon balances and only one framed footer command", () => {
  const {container} = render(<Preparation/>);
  const funds = screen.getByTestId("campaign-funds");
  for (const label of ["公款 0 G", "小队资金 44 G", "晶石 0"]) {
    expect(within(funds).getByRole("img", {name: label})).toHaveAttribute("tabindex", "0");
  }
  expect(funds.querySelectorAll(".abyssa-currency-amount")).toHaveLength(3);
  expect(funds.querySelectorAll('[data-icon="custom"]')).toHaveLength(1);
  const actions = screen.getByRole("navigation", {name: "整备操作"});
  expect(actions.querySelectorAll(".journal-action__art")).toHaveLength(1);
  expect(within(actions).getByRole("link", {name: "补充物资"})).toHaveAttribute("href", "/shop.html");
  expect(within(actions).getByRole("link", {name: "查看骰装"})).toHaveAttribute("href", "/character-status.html");
  expect(within(actions).getByRole("link", {name: "出征编队"})).toHaveAttribute("href", "/map.html");
  expect(container.querySelectorAll(".departure-preparation__aux-link i[aria-hidden]")).toHaveLength(2);
});

it("adds and removes six real selections and still inspects a seventh item", async () => {
  const user = userEvent.setup(); render(<Preparation stocked/>);
  for (const name of ["护符","圣水","保养工具","幸运符"]) {
    await user.click(screen.getByRole("button",{name:`查看${name}详情`}));
    await user.click(screen.getByRole("button",{name:"加入行囊"}));
  }
  expect(screen.getByLabelText("已选 6 种，最多 6 种")).toBeInTheDocument();
  await user.click(screen.getByRole("button",{name:"查看卦签详情"}));
  expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("行囊已满，请先移出一种");
  await user.click(screen.getByRole("button",{name:"行囊第 1 格：食物"}));
  await user.click(screen.getByRole("button",{name:"移出行囊"}));
  await user.click(screen.getByRole("button",{name:"查看卦签详情"}));
  await user.click(screen.getByRole("button",{name:"加入行囊"}));
  expect(screen.getByRole("button",{name:"行囊第 6 格：卦签"})).toBeInTheDocument();
  expect(screen.queryByRole("button",{name:/行囊第 \d 格：食物/})).toBeNull();
});

it("retains the four-slot limit when an older journey supplies it", () => {
  render(<Preparation itemLimit={4}/>);
  expect(within(screen.getByRole("list", {name:"出征携带位"})).getAllByRole("listitem")).toHaveLength(4);
  expect(screen.getByLabelText("已选 2 种，最多 4 种")).toBeInTheDocument();
});

it("locks carry changes while keeping item details inspectable", async () => {
  const user = userEvent.setup(); render(<Preparation lockedReason="远征期间不能调整行囊"/>);
  expect(screen.getByRole("button",{name:"移出行囊"})).toBeDisabled();
  await user.click(screen.getByRole("button",{name:"查看护符详情"}));
  expect(screen.getByRole("button",{name:"加入行囊"})).toBeDisabled();
  expect(screen.getByRole("complementary",{name:"补给详情"})).toHaveTextContent("抵挡 2 点攻击伤害");
});

it("edits actual selected quantities without changing the warehouse count", async () => {
  function ActualStock() {
    const [quantities, setQuantities] = useState({food: 3});
    return <DeparturePreparation items={[{...items[0], free: false, storedCharges: 8, availableCharges: 4, storageCapacity: 12}]} selectedIds={["food"]} onChange={() => {}}
      quantities={quantities} onQuantity={(_, value) => setQuantities({food: value})} itemLimit={4} funds={{public:0,party:0,crystals:0}} mapHref="/map.html" shopHref="/shop.html" equipmentHref="/character-status.html"/>;
  }
  const user = userEvent.setup(); render(<ActualStock/>);
  await user.click(screen.getByRole("button", {name: "减少食物携带数量"}));
  expect(screen.getByRole("group", {name: "食物携带数量"})).toHaveTextContent("2");
  expect(screen.getByRole("complementary", {name: "补给详情"})).toHaveTextContent("当前库存8 份出征携带2 份");
  expect(screen.getByRole("button", {name: "行囊第 1 格：食物"})).toHaveAccessibleDescription("出征携带 2 份");
  expect(screen.queryByText("免费配给")).toBeNull();
});
