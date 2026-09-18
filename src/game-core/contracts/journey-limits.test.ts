import {expect, it} from "vitest";
import {departureSupplyLimit} from "./journey-limits";

it("uses six slots for the current chapter without expanding earlier releases", () => {
  expect(departureSupplyLimit({rulesVersion:4,contentVersion:12})).toBe(6);
  for (const contentVersion of [1,3,8,10,11]) expect(departureSupplyLimit({rulesVersion:4,contentVersion})).toBe(4);
  expect(departureSupplyLimit({rulesVersion:3,contentVersion:12})).toBe(4);
});
