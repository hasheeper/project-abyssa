import {earnedAppraisalFixture} from "../../../src/game-application/testing/appraisal-fixture";
import {SHOP_VISIT_LENGTHS} from "../../../src/game-core/contracts/shop-visit";

export async function appraisalArchive() {
  const f = await earnedAppraisalFixture();
  const shop = () => f.runtime.queries.shop(f.raw())!;
  if (shop().firstVisit?.canBegin) await f.send({type: "begin-shop-visit", shopId: shop().shopId});
  for (let step = 0; shop().firstVisit && step < 100; step++) {
    const p = f.raw().snapshot.campaign.shopVisit!, shopId = shop().shopId, quoteVersion = shop().loot!.quoteVersion;
    if (p.phase === "appraise") await f.send({type: "appraise-shop-visit", shopId, quoteVersion});
    else if (p.phase === "sell") await f.send({type: "sell-shop-visit", shopId, quoteVersion});
    else await f.send({type: "advance-shop-visit", shopId, phase: p.phase, step: p.step, choice: p.phase === "valuation" && p.step === SHOP_VISIT_LENGTHS.valuation - 1 ? "A" : "continue"});
    if (step % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (shop().introduction) await f.send({type: "advance-shop-introduction", shopId: shop().shopId, step: shop().introduction!.step, choice: "skip"});
  const item = shop().loot!.items.find(i => i.generatedAppraisal)!;
  const slot = f.packet.context.rules.appraisalSlots!.find(s => s.instanceId === item.instanceId)!;
  const copy = f.proposal.appraisalItems!.find(c => c.slotKey === slot.key)!;
  const exported = await f.runtime.application.exportSave("formal-airp"); if (!exported.ok) throw Error("export failed");
  return {archive: exported.archive, copy, slot, funds: shop().funds};
}
