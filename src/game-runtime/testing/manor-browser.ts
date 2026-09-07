/** Read-only probe, bundled only by smoke tests. */
import { createBrowserGameRuntime } from "../browser";
import { FULL_MANOR_CATALOG } from "../full-manor-context";
import { MANOR_CATALOG } from "../manor-context";
import { asDemoBattle } from "../../game-core/session";
import { manorBattlePlan } from "../../game-core/testing/manor-policy";
export async function inspectManor(saveId: string) {
  const runtime = createBrowserGameRuntime();
  try {
    const result = await runtime.application.open(saveId);
    if (!result.ok || result.record.schemaVersion === 1) throw new Error("Manor save required");
    const record = result.record, v = runtime.queries.journey(record)!;
    // The v4 smoke path reads state only; the old v2/v3 policy must not drive it.
    if (record.schemaVersion === 4) return {record, view: v, plan: []};
    const battle = record.snapshot.expedition && asDemoBattle(record.snapshot.expedition);
    return {record, view: v, plan: battle ? manorBattlePlan(record.schemaVersion === 3 ? FULL_MANOR_CATALOG : MANOR_CATALOG, battle, "survival") : []};
  } finally { runtime.close(); }
}
