import { expect, it } from "vitest";
import { facilitiesFixture } from "./facilities-fixture";
import { FACILITIES_CATALOG } from "../../game-runtime/facilities-context";
import { playOrdinaryDrops, settleOrdinaryDrops } from "./ordinary-drops-fixture";
import { shopFixture } from "./shop-foundation-fixture";

it.each(["clear", "extract", "wipe"] as const)("returns only the actual unconsumed supplies after %s", async outcome => {
  const f = await facilitiesFixture(), before = f.read(), runId = `facility-${outcome}`;
  await f.commit({type: "start-expedition", runId, routeId: "tide-reef.ordinary", partyIds: FACILITIES_CATALOG.data.initialParty, itemIds: ["item.food", "item.potion"], supplyQuantities: {"item.food": 1, "item.potion": 1}, seed: 19});
  const fixture = {...f, before, runId, catalog: FACILITIES_CATALOG};
  const {terminal} = await playOrdinaryDrops(fixture, outcome);
  expect(terminal.outcome).toBe(outcome === "clear" ? "cleared" : outcome === "extract" ? "extracted" : "wipe");
  const homeBeforeReturn = f.state().supplies;
  const settled = await settleOrdinaryDrops(fixture);
  for (const returned of terminal.returnedSupplies) {
    expect(f.state().supplies.find(s => s.definitionId === returned.definitionId)!.charges).toBe(homeBeforeReturn.find(s => s.definitionId === returned.definitionId)!.charges + returned.charges);
  }
  expect(f.state().facilities!.reservations).toEqual({});
  expect(await f.runtime.application.dispatch(settled.input)).toMatchObject({ok: true, replayed: true});
  const archive = await f.runtime.application.exportSave(f.saveId); if (!archive.ok) throw Error("export");
  const recovered = shopFixture(); expect(await recovered.runtime.application.restoreSave({archive: archive.archive, clientRequestId: "restore"})).toMatchObject({ok: true});
  expect(recovered.read().snapshot).toEqual(f.read().snapshot);
  if (outcome === "wipe") {
    await f.tick(3); // The return has advanced one phase; waiting completes the first food batch.
    const batch = f.state().facilities!.batches.kitchen!;
    await f.commit({type: "facility-collect", roomId: "kitchen", batchId: batch.id, quantity: 2});
    expect(f.state().supplies.find(s => s.definitionId === "item.food")!.charges).toBeGreaterThan(2);
  }
}, 120_000);
