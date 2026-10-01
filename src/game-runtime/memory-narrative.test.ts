import { expect, it } from "vitest";
import { shopFixture } from "../game-application/testing/shop-foundation-fixture";
import { firstVisitLines } from "../content/presentation/shop-first-visit";
import { narrativeRecord, type NarrativeStep } from "./memory-narrative";

it.each(["A", "B"] as const)("records the actual shop branch %s in five acts, attaches real receipts and restores without writes", async choice => {
  const f = shopFixture();
  const created = await f.runtime.application.createNewGame({ saveId: f.saveId, epoch: "narrative", clientRequestId: "create", startAt: "debug-shop" });
  expect(created.ok).toBe(true);
  const journal = () => {
    const data = f.runtime.queries.memoryJournal(f.read());
    if (data.status !== "ready") throw Error("Journal unavailable");
    return data.entries;
  };
  const shop = () => journal().find(e => e.narrative?.definitionId === "shop.first-visit");
  expect(shop()).toBeUndefined();
  await f.commit({ type: "begin-shop-visit", shopId: "shop.mansion" });
  const advance = async () => {
    const progress = f.read().snapshot.campaign.shopVisit!;
    await f.commit({ type: "advance-shop-visit", shopId: "shop.mansion", phase: progress.phase, step: progress.step,
      choice: progress.phase === "valuation" && progress.step === 17 ? choice : "continue" });
  };
  for (let i = 0; i < 31; i++) await advance();
  const identity = shop()!.id;
  expect(shop()!.narrative!.acts.map(a => a.definitionId)).toEqual(["loot.opening"]);
  expect(JSON.stringify(shop())).not.toContain("秘银线");
  await f.commit({ type: "appraise-shop-visit", shopId: "shop.mansion", quoteVersion: f.runtime.queries.shop(f.read())!.loot!.quoteVersion });
  // The fee receipt unlocks no unread appraisal dialogue or new standalone slice.
  expect(shop()!.narrative!.acts).toHaveLength(1);
  await advance();
  expect(shop()!.narrative!.acts[1].slices[0].steps[0]).toMatchObject({ kind: "receipt", operation: "appraise", moneyDelta: 0 });
  for (let count = 0; count < 70; count++) {
    const progress = f.read().snapshot.campaign.shopVisit!;
    if (progress.status === "completed") break;
    if (progress.phase === "sell") await f.commit({ type: "sell-shop-visit", shopId: "shop.mansion", quoteVersion: f.runtime.queries.shop(f.read())!.loot!.quoteVersion });
    else {
      if (progress.phase === "buy" && choice === "A") {
        const view = f.runtime.queries.shop(f.read())!, product = view.products.find(p => p.delivery === "supply" && (p.purchaseMaximum ?? 0) > 0)!;
        await f.commit({ type: "purchase-product", shopId: view.shopId, productId: product.id, quantity: 1,
          day: view.day!, quoteVersion: view.quoteVersion, scheduleVersion: view.scheduleVersion! });
      }
      await advance();
    }
  }
  const entry = shop()!, acts = entry.narrative!.acts;
  expect(entry.id).toBe(identity);
  expect(acts.map(a => a.definitionId)).toEqual(["loot.opening", "loot.valuation", "nail.disposition", "next.supplies", "shop.message"]);
  expect(acts.every(a => a.replay === "scene" && a.coverage === "complete")).toBe(true);
  const steps: NarrativeStep[] = acts.flatMap(a => a.slices.flatMap(s => s.steps));
  expect(steps.filter(s => s.kind === "choice-result")).toMatchObject([{ optionId: choice, choiceId: "shop.visit.choice" }]);
  const unchosen = firstVisitLines({ phase: "reply", choice: choice === "A" ? "B" : "A" })[0].text;
  expect(entry.blocks.map(b => b.text)).not.toContain(unchosen);
  const sales = steps.filter(s => s.kind === "receipt" && s.operation === "sell");
  expect(sales.reduce((sum, s) => sum + (s.kind === "receipt" ? s.moneyDelta ?? 0 : 0), 0)).toBe(choice === "A" ? 2202 : 1802);
  expect(sales.flatMap(s => s.kind === "receipt" ? s.items ?? [] : []).find(i => i.name.includes("十字"))?.quantity).toBe(11);
  expect(steps.filter(s => s.kind === "receipt" && s.operation === "purchase")).toHaveLength(choice === "A" ? 1 : 0);
  expect(JSON.stringify(narrativeRecord([entry]))).not.toMatch(/options|handoffRef|branches|commands|\{\{user\}\}/);
  const before = f.read();
  expect(acts[2].slices.every(slice => !!slice.presentation.opening)).toBe(true);
  expect(f.read()).toEqual(before);
  const restored = shopFixture(before);
  expect(restored.runtime.queries.memoryJournal(restored.read())).toEqual(f.runtime.queries.memoryJournal(before));
}, 60000);

it("keeps free-start shop dialogue unread until its own reading facts exist", async () => {
  const f = shopFixture();
  await f.runtime.application.createNewGame({ saveId: f.saveId, epoch: "free", clientRequestId: "create", startAt: "hub" });
  const data = f.runtime.queries.memoryJournal(f.read());
  expect(data.status).toBe("ready");
  if (data.status !== "ready") throw Error("Journal unavailable");
  expect(data.entries.map(e => e.narrative?.definitionId)).toEqual(["opening.departure", "opening.return"]);
});
