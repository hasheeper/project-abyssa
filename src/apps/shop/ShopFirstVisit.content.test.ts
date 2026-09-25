import { expect, it } from "vitest";
import { SHOP_VISIT_LENGTHS } from "../../game-core/contracts";
import { SHOP_FIRST_VISIT, firstVisitReading, shopVisitLines } from "../../content/presentation/shop-first-visit";

it("binds the authored JSON pages to the versioned transaction cursors", () => {
  for (const phase of ["arrival", "valuation", "purchase", "departure"] as const) expect(shopVisitLines[phase]).toHaveLength(SHOP_VISIT_LENGTHS[phase]);
  expect(shopVisitLines["reply-A"]).toHaveLength(2);
  expect(shopVisitLines["reply-B"]).toHaveLength(SHOP_VISIT_LENGTHS.reply);
  expect(JSON.stringify(SHOP_FIRST_VISIT)).not.toMatch(/[\u3040-\u30ff]/);
  expect(SHOP_FIRST_VISIT.player).toEqual({actorId: "kael", nameToken: "{{user}}", authoredSpeech: true});
  expect(SHOP_FIRST_VISIT.nodes.find(node => node.kind === "choice")).toMatchObject({options: [{id: "A", label: "留在店里"}, {id: "B", label: "带回去"}]});
});

it("preserves the first-act callbacks and exact financial dialogue, with only the unsupported contract-token exchange removed", () => {
  expect(shopVisitLines.arrival[2].text).toBe("车轴断了。大件差不多都拖回来了。");
  expect(shopVisitLines.arrival[10].text).toBe("毯子拿回去了。");
  expect(shopVisitLines.valuation[9].text).toBe("十一枚，打包十八枚银币。");
  expect(shopVisitLines.valuation[11].text).toBe("一枚是尝味道的。");
  expect(shopVisitLines.valuation[3].text).toBe("对。熔成银料的话……四枚银币吧。");
  expect(JSON.stringify(SHOP_FIRST_VISIT)).not.toMatch(/契约符|买不起的东西别摆出来|看看又不要钱/);
});

it("keeps earlier dialogue in the log across transactions without leaking the unchosen branch", () => {
  const {lines, cursor} = firstVisitReading({phase: "departure", step: 0, choice: "B"});
  const read = lines.slice(0, cursor + 1).map(line => line.text).join("\n");
  expect(read).toContain("毯子拿回去了");
  expect(read).toContain("镇纸就行");
  expect(read).not.toContain("多谢惠顾。");
  expect(read).not.toContain("要晚五天");
});
