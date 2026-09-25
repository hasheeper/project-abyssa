import { useCallback, useEffect, useState } from "react";
import type { CommittedBatch, GameSession } from "./session";
import { SceneFeedback, type SceneFeedbackEntry } from "../shared/ui/patterns/SceneFeedback";

/** Read committed before/after states, never infer payments from mounting a page. */
export function estateFeedback(batch: CommittedBatch): SceneFeedbackEntry[] {
  if (!batch.presentable || batch.after.schemaVersion !== 4) return [];
  const before = batch.before.schemaVersion === 4 ? batch.before.snapshot.campaign.facilities : null;
  const after = batch.after.snapshot.campaign.facilities;
  if (!after?.funding) return [];
  const entries: SceneFeedbackEntry[] = [], prefix = `estate:${batch.after.head.saveId}:${batch.after.head.epoch}:${batch.after.head.revision}`;
  const grant = after.funding.totalGranted - (before?.funding?.totalGranted ?? 0);
  if (grant > 0) entries.push({id: `${prefix}:funding`, kind: "notice", tone: "success", message: `公款到账 · +${grant.toLocaleString("en-US")} G`});
  const names = {kitchen: "厨房", greenhouse: "温室药圃", workshop: "工坊", storage: "储藏室", maid: "女仆工作间"};
  if (after.construction && after.construction.id !== before?.construction?.id)
    entries.push({id: `${prefix}:start`, kind: "notice", message: `${names[after.construction.roomId]} · ${after.construction.fromLevel ? "升级" : "修缮"}开工`});
  const completed = before?.construction;
  if (completed && after.levels[completed.roomId] === completed.toLevel)
    entries.push({id: `${prefix}:complete`, kind: "notice", tone: "success", message: `${names[completed.roomId]} · 工程完成 Lv.${completed.toLevel}`});
  return entries;
}

export function EstateFeedback({session}: {session: GameSession}) {
  const [entries, setEntries] = useState<SceneFeedbackEntry[]>([]);
  useEffect(() => session.onCommitted(batch => {
    const notices = estateFeedback(batch);
    if (notices.length) setEntries(current => [...current, ...notices]);
  }), [session]);
  const dismiss = useCallback((id: string) => setEntries(current => current.filter(entry => entry.id !== id)), []);
  return <SceneFeedback dock entries={entries} onDismiss={dismiss}/>;
}
