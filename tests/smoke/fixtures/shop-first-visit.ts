import { shopFixture } from "../../../src/game-application/testing/shop-foundation-fixture";

/** Browser seeds are exported through the real application after real commands. */
export async function shopVisitArchives() {
  const f = shopFixture(), archives: Record<string, string> = {};
  const created = await f.runtime.application.createNewGame({saveId: f.saveId, epoch: "visit-browser", clientRequestId: "create", startAt: "hub"});
  if (!created.ok) throw Error(JSON.stringify(created));
  await f.commit({type: "begin-shop-visit", shopId: "shop.mansion"});
  const advance = () => {
    const p = f.read().snapshot.campaign.shopVisit!;
    return f.commit({type: "advance-shop-visit", shopId: "shop.mansion", phase: p.phase, step: p.step, choice: "continue"});
  };
  const save = async (key: string) => {
    const result = await f.runtime.application.exportSave(f.saveId);
    if (!result.ok) throw Error("fixture export");
    archives[key] = result.archive;
  };
  for (let step = 0; step < 10; step++) await advance();
  await save("blanket");
  for (let step = 10; step < 31; step++) await advance();
  await save("appraisal");
  const quoteVersion = f.runtime.queries.shop(f.read())!.loot!.quoteVersion;
  await f.commit({type: "appraise-shop-visit", shopId: "shop.mansion", quoteVersion});
  for (let step = 0; step < 17; step++) await advance();
  await save("choice");
  return archives;
}
