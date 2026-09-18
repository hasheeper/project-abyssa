import {expect, it} from "vitest";
import {CHAPTER_ONE_CATALOG_DATA} from "../../content/gameplay/demo-v12/content";
import {GUIDED_TIDE_CATALOG_DATA} from "../../content/gameplay/demo-v11/content";
import {validateD5Catalog} from "../contracts/d5-validation";
import {initialD5Projection} from "./d5-progress";
import {departureSupplies} from "./d5-economy";
import {validateTerminal} from "./demo-expedition";

it("accepts six current supplies on departure and return, but retains earlier four-slot limits", () => {
  const current = validateD5Catalog(CHAPTER_ONE_CATALOG_DATA), earlier = validateD5Catalog(GUIDED_TIDE_CATALOG_DATA);
  const campaign = initialD5Projection(current), economy = current.data.economy!;
  const ids = Object.keys(current.data.journey!.items);
  campaign.supplies = ids.filter(id => !economy.freeItemIds.includes(id)).map(id => ({
    instanceId:`owned:${id}`,definitionId:id,source:"supply.demo.shop",charges:1,
  }));
  const selected = ids.slice(0,6), before = structuredClone(campaign);
  const supplies = departureSupplies(current,campaign,"six-run",selected);
  expect(supplies.map(s => s.definitionId)).toEqual(selected);
  expect(campaign).toEqual(before);
  expect(() => departureSupplies(current,campaign,"seven-run",ids)).toThrow();
  expect(() => departureSupplies(current,campaign,"duplicate",[ids[0],ids[0]])).toThrow();
  expect(() => departureSupplies(earlier,campaign,"legacy-run",selected)).toThrow();
  const terminal = {id:"six-return",runId:"six-run",routeId:"old-manor.first-clear",outcome:"wipe",
    completion:null,deepestLayer:1,partyIds:current.data.initialParty,bankedGold:0,lostLooseGold:0,
    lostBankedGold:0,totalGold:0,returnedSupplies:supplies,layerResults:[]};
  expect(validateTerminal(current,terminal).returnedSupplies).toHaveLength(6);
  expect(() => validateTerminal(earlier,terminal)).toThrow();
});
