import type { GameSession } from "../session";
import type { DirectorCommand } from "../../game-runtime/airp-director-view";

/** Used by mansion, journal and reader so an existing day's next frame also upgrades. */
export async function dispatchDirector(session: GameSession, command: DirectorCommand) {
  await session.refresh({background: true});
  const record = session.getSnapshot().record, state = record?.schemaVersion === 4 ? record.airpDirector : undefined;
  if (record?.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion) && state && !state.commissionVersion &&
    !record.snapshot.campaign.activeRunRef && command.type === "airp-director-choose") {
    if (!await session.dispatch({type: "airp-director-enable-commissions"})) return null;
  }
  // The explicit configuration commit only affects NEW frames. Saved writing,
  // postprocessing retries and already-readable scenes retain their original input.
  if (["airp-director-open", "airp-director-read", "airp-director-choose", "airp-director-decline", "airp-director-deliver"].includes(command.type) &&
    record?.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion) && state?.lowMaterial && state.materialHash &&
    (state.lowContextVersion ?? 0) < 21 && !state.jobs.some(j => j.attempts.some(a => a.status === "running"))) {
    const configured = await session.dispatch({type: "airp-director-configure", material: state.materials[state.materialHash],
      lowMaterial: state.lowMaterial, lowReadVersion: 6, lowContextVersion: 21});
    if (!configured) return null;
  }
  return session.dispatch(command);
}
