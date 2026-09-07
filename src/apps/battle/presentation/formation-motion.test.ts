import { expect, it } from "vitest";
import { formationSteps } from "./formation-motion";
it("uses adjacent steps with stable instance identities and lands on the committed order", () => {
  expect(formationSteps(["a","b","c","d"],["b","a","d","c"])).toEqual([["b","a","c","d"],["b","a","d","c"]]);
  expect(formationSteps(["a","b"],["a","b"])).toEqual([]);
  expect(formationSteps(["a","b","c"],["c","a","b"])).toEqual([["a","c","b"],["c","a","b"]]);
});
