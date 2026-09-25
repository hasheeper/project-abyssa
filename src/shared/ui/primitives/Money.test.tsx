import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CurrencyAmount } from "./CurrencyAmount";
import { MoneyProvider } from "./Money";

afterEach(cleanup);
it("keeps old-save scaling at the display boundary and leaves crystals unchanged", () => {
  const view = render(<MoneyProvider scale={100}><CurrencyAmount value={49} label="小队资金"/><CurrencyAmount value={2} currency="crystal"/></MoneyProvider>);
  expect(screen.getByLabelText("小队资金 4,900 G")).toBeInTheDocument();
  expect(screen.getByLabelText("远古晶石 2")).toBeInTheDocument();
  view.rerender(<MoneyProvider><CurrencyAmount value={4400} label="小队资金"/></MoneyProvider>);
  expect(screen.getByLabelText("小队资金 4,400 G")).toBeInTheDocument();
});
