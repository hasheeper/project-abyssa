import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ItemSlot, ItemSlotStatic } from "./ItemSlot";
afterEach(cleanup);

it("releases the gem-band geometry when either slot variant hides rarity", () => {
  render(<><ItemSlot name="食物" icon="/food.svg" showRarity={false}/><ItemSlotStatic name="药水" icon="/potion.svg" showRarity={false}/></>);
  for (const slot of [screen.getByRole("button"),screen.getByRole("img")]) {
    expect(slot).toHaveAttribute("data-show-rarity","false");
    expect(slot.querySelector('[data-layer="rarity"]')).toBeNull();
  }
});
it("retains the default rarity strip for existing inventory consumers", () => {
  render(<ItemSlot name="护符" icon="/ward.svg"/>);
  expect(screen.getByRole("button")).toHaveAttribute("data-show-rarity","true");
  expect(screen.getByRole("button").querySelector('[data-layer="rarity"]')).not.toBeNull();
});
it("uses an explicit interface tone without rarity semantics while preserving the six art layers", () => {
  render(<><ItemSlot name="食物" icon="/food.svg" tone="interface" rarity="mythic"/>
    <ItemSlotStatic name="药水" icon="/potion.svg" tone="interface"/>
    <ItemSlot name="银质钥匙" icon="/key.svg" rarity="silver"/></>);
  for (const slot of [screen.getByRole("button", {name: "食物"}), screen.getByRole("img", {name: "药水"})]) {
    expect(slot).toHaveAttribute("data-tone", "interface");
    expect(slot).not.toHaveAttribute("data-rarity");
    expect(slot).toHaveAttribute("data-show-rarity", "false");
    expect(slot.querySelectorAll("[data-layer]")).toHaveLength(6);
  }
  expect(screen.getByRole("button", {name: /银质钥匙/})).toHaveAttribute("data-rarity", "silver");
});
