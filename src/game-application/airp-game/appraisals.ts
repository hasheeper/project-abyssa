import type { PublicAppraisal } from "../../game-core/contracts";
import type { D5GameRecord } from "../versions/d5-contracts";

type ItemIdentity = {instanceId: string; definitionId: string; grantId: string; runId?: string; roomId?: string; resultId?: string | null};
/** Resolve the original run, including settled runs. Never use only the latest preparation. */
export function gameAppraisal(record: Pick<D5GameRecord, "airpGame">, item: ItemIdentity) {
  if (!item.runId) return null;
  for (const job of record.airpGame?.gm.jobs ?? []) {
    if (!["accepted", "started"].includes(job.status) || !job.prepared) continue;
    const frame = job.frames.at(-1)!;
    if (frame.departure.runId !== item.runId || frame.context.rules.appraisalPlanVersion !== 1) continue;
    const slot = frame.context.rules.appraisalSlots!.find(s => s.instanceId === item.instanceId && s.baseDefinitionId === item.definitionId && s.grantId === item.grantId && s.roomId === item.roomId);
    const copy = slot && job.prepared.proposal.appraisalItems?.find(c => c.slotKey === slot.key);
    if (slot && copy) return {slot, copy};
  }
  return null;
}
export function publicGameAppraisal(record: Pick<D5GameRecord, "airpGame">, item: ItemIdentity): PublicAppraisal | null {
  const saved = gameAppraisal(record, item);
  if (!saved) return null;
  const {slot, copy} = saved;
  return {unknownName: copy.unknownName, appearance: copy.appearance, selectUnknown: copy.selectUnknown,
    identified: item.resultId ? {name: copy.name, description: copy.description, selectKnown: copy.selectKnown, appraisal: copy.appraisal, sold: copy.sold, rarity: slot.rarity} : null};
}
