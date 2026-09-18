import { expect, it } from "vitest";
import { validateD5Catalog } from "../../game-core/contracts/d5-validation";
import { AIRP_POOL_CATALOG_DATA } from "../../content/gameplay/demo-v9/content";
import { G1_CONTINUATION_SEED, g1Candidate, g1ReachBoss, g1FinishBoss } from "../../game-core/session/testing/tide-guided-g1";
import { replayG1Application } from "./tide-guided-g1-playthrough";

it("replays the frozen G1 tape across export/exact recovery, then claims terminal + 8G once", async () => {
  const catalog = validateD5Catalog(AIRP_POOL_CATALOG_DATA), r = g1Candidate(G1_CONTINUATION_SEED, catalog);
  g1ReachBoss(r);
  const prefix = [...r.trace], boss = g1FinishBoss(r, "crossbow-first");
  const report = await replayG1Application(catalog, [...prefix, ...boss.trace]);
  expect(report).toMatchObject({seed: G1_CONTINUATION_SEED, restoredAt: "T2.R2.guard-bow", sameRequestReroll: true,
    activeCopyRejected: true, staleRestoreRejected: true,
    prematureClaimRejected: true, duplicateClaimRejected: true, originalUntouched: true,
    terminalGold: 36, rewardGold: 8, paidGold: 44, settlements: 1, clock: {day: 1, phase: "day"}});
  expect(report.cargoIds).toEqual(catalog.data.tutorial!.reward.cargoIds);
}, 90_000);
