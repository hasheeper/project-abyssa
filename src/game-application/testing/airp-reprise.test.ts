import { afterAll, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { repriseFixture } from "./airp-reprise-playthrough";
import { poolTestRuntime, type PoolRecord } from "./airp-pool-playthrough";
import { AIRP_POOL_CATALOG } from "../../game-runtime/airp-context";
import { manorRepriseView } from "../../game-runtime/manor-reprise-view";

const checkpoints: Record<string, PoolRecord> = {};
afterAll(() => { mkdirSync("dist/reports/airp-3", { recursive: true }); writeFileSync("dist/reports/airp-3/reprise-checkpoints.json", JSON.stringify(checkpoints)); });

it.each(["wipe", "extracted"] as const)("classifies an unfinished %s return as Reprise only on its next first-clear departure", async outcome => {
  const f = await repriseFixture(outcome), home = await f.read();
  expect(f.runtime.queries.journey(f.firstDeparture)?.reprise).toBeNull();
  expect(f.runtime.queries.journey(f.source)?.reprise).toBeNull(); // Immutable old version.
  expect(f.runtime.queries.journey(home)?.reprise).toBeNull(); // Still at home.
  expect(home.snapshot.campaign.manor.takeover).toBeNull();
  expect(home.narrative.instances).toHaveLength(0); // Reprise cannot bypass first clear to issue patrols.
  const started = await f.send({ type: "start-expedition", runId: `reprise-${outcome}`, routeId: "old-manor.first-clear",
    partyIds: AIRP_POOL_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], seed: 19 });
  checkpoints[outcome] = started;
  const view = f.runtime.queries.journey(started)!;
  expect(view.maintenance).toBe(false);
  expect(view.reprise).toEqual({ runId: `reprise-${outcome}`, previousTerminalId: f.source.snapshot.campaign.settlements.at(-1)!.id,
    previousOutcome: outcome, previousPartyIds: f.source.snapshot.campaign.settlements.at(-1)!.partyIds });
  const original = structuredClone(started);
  expect((await f.runtime.application.open("pool")).ok).toBe(true);
  expect(await f.read()).toEqual(original); // Queries do not mutate the record or grant memory.
  const restored = poolTestRuntime();
  expect(await restored.runtime.application.restoreSave({ archive: JSON.stringify({ archiveVersion: 4, record: started }), clientRequestId: "restore" })).toMatchObject({ ok: true });
  expect(restored.runtime.queries.journey(await restored.read())!.reprise).toEqual(view.reprise);
  // Negative projection tests; never used as valid fixture or completion evidence.
  const noPast = structuredClone(started); noPast.snapshot.campaign.settlements = [];
  expect(manorRepriseView(AIRP_POOL_CATALOG, noPast)).toBeNull();
  const maintenance = structuredClone(started);
  if (maintenance.snapshot.run?.kind !== "expedition") throw Error();
  maintenance.snapshot.run.state.run.routeId = "old-manor.maintenance";
  expect(manorRepriseView(AIRP_POOL_CATALOG, maintenance)).toBeNull();
  const rolled = await f.send({ type: "battle-command", runRef: { kind: "expedition", id: `reprise-${outcome}` }, command: { type: "roll" } });
  expect(f.runtime.queries.journey(rolled)!.reprise).toBeNull(); // Never interrupt an already-started battle.
}, 180000);
