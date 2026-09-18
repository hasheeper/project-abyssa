import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CurrencyAmount } from "./CurrencyAmount";

afterEach(cleanup);

it("keeps the existing default coin, crystal and formatted amount markup", () => {
  const {container} = render(<>
    <CurrencyAmount value={12345}/>
    <CurrencyAmount value={0} currency="gold" label="小队金币 0"/>
    <CurrencyAmount value={8} currency="crystal"/>
  </>);
  expect(screen.getByLabelText("里拉 12345")).toHaveTextContent("12,345");
  expect(screen.getByLabelText("小队金币 0")).toHaveAttribute("data-currency", "gold");
  expect(screen.getByLabelText("远古晶石 8")).toHaveAttribute("data-currency", "crystal");
  expect(container.querySelectorAll('[data-part="ring"]')).toHaveLength(3);
  expect(container.querySelectorAll('[data-part="mark"]')).toHaveLength(3);
  expect(container.querySelector("[data-icon]")).toBeNull();
});

it("allows an explicit account emblem without changing the currency or amount", () => {
  const {container} = render(<CurrencyAmount value={120} currency="gold" label="公款 120" iconUrl="/crown-coin.svg"/>);
  expect(screen.getByLabelText("公款 120")).toHaveTextContent("120");
  const icon = container.querySelector("i")!;
  expect(icon).toHaveAttribute("data-icon", "custom");
  expect(icon).toHaveAttribute("aria-hidden", "true");
  expect(icon.style.maskImage).toContain("/crown-coin.svg");
  expect(icon.querySelector("[data-part]")).toBeNull();
});
