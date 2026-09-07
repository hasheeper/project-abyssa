/** Test-only browser probe. Never reachable from a production HTML entry. */
import { createBrowserGameRuntime } from "../browser";
import { battleState } from "../views";
import { getStateFace } from "../battle-view";
export async function inspect(saveId: string) {
  const runtime = createBrowserGameRuntime();
  try {
    const result = await runtime.application.open(saveId);
    if (!result.ok) throw new Error(result.error.message);
    const record = result.record;
    if (record.schemaVersion !== 1) throw new Error("Legacy browser probe requires schema 1");
    const battle = record.snapshot.expedition ? battleState(record) : null;
    return { record, battle, faces: battle?.dice.map(die => getStateFace(battle, die)) ?? [] };
  } finally { runtime.close(); }
}
