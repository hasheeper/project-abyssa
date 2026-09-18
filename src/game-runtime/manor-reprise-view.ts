import type { D5GameRecord } from "../game-application";
import type { ValidatedD5Catalog } from "../game-core/contracts";

/** Read only validated campaign history. Reprise is an unfinished first clear, never maintenance. */
export function manorRepriseView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const { campaign, run } = record.snapshot, manor = catalog.data.manor;
  if (catalog.ref.contentVersion !== 9 || !manor || campaign.manor.takeover || run?.kind !== "expedition") return null;
  const state = run.state;
  if (state.run.routeId !== manor.firstClearRouteId || state.run.layer !== 1 || state.run.room !== 0 ||
      state.node !== "battle" || state.encounter?.round !== 1 || state.encounter.phase !== "roll") return null;
  const previous = campaign.settlements.filter(t => t.routeId === manor.firstClearRouteId).at(-1);
  if (!previous || (previous.outcome !== "wipe" && previous.outcome !== "extracted")) return null;
  return {
    runId: run.id, previousTerminalId: previous.id, previousOutcome: previous.outcome,
    previousPartyIds: previous.partyIds,
  };
}
export type ManorRepriseView = NonNullable<ReturnType<typeof manorRepriseView>>;
