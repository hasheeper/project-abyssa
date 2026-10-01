import type { GameSession } from "../session";
import type { DirectorCommand } from "../../game-runtime/airp-director-view";

/** Used by mansion, journal and reader so an existing day's next frame also upgrades. */
export async function dispatchDirector(session: GameSession, command: DirectorCommand) {
  await session.refresh({background: true});
  const nextFrameCommands = ["airp-director-prepare-day", "airp-director-prepare-replan", "airp-director-open", "airp-director-read", "airp-director-choose", "airp-director-decline", "airp-director-deliver"];
  let record = session.getSnapshot().record;
  if (record?.schemaVersion === 4 && record.contentRef.contentVersion === 28 && nextFrameCommands.includes(command.type) && "airpGame" in session.runtime) {
    const configured = await session.runtime.airpGame.forSave(session.locator.saveId, 28, session.locator.epoch).configureDirector();
    if (configured.head.revision !== record.head.revision) {
      await session.refresh({background: true});
      record = session.getSnapshot().record;
    }
  }
  const state = record?.schemaVersion === 4 ? record.airpDirector : undefined;
  if (record?.schemaVersion === 4 && [22, 24, 26, 28].includes(record.contentRef.contentVersion) && state && !state.commissionVersion &&
    !record.snapshot.campaign.activeRunRef && command.type === "airp-director-choose") {
    if (!await session.dispatch({type: "airp-director-enable-commissions"})) return null;
  }
  // Historical save compatibility; formal28 uses the complete resident configuration above.
  if (["airp-director-open", "airp-director-read", "airp-director-choose", "airp-director-decline", "airp-director-deliver"].includes(command.type) &&
    record?.schemaVersion === 4 && [22, 24, 26].includes(record.contentRef.contentVersion) && state?.lowMaterial && state.materialHash &&
    (state.lowContextVersion ?? 0) < 21 && !state.jobs.some(j => j.attempts.some(a => a.status === "running"))) {
    const configured = await session.dispatch({type: "airp-director-configure", material: state.materials[state.materialHash],
      lowMaterial: state.lowMaterial, lowReadVersion: 6, lowContextVersion: 21});
    if (!configured) return null;
  }
  return session.dispatch(command);
}
