import { useCallback, useEffect, useState } from "react";
import type { AnyGameRecord } from "../../game-application";
import type { CodexData } from "../../game-runtime/codex-types";
import type { CommittedBatch, GameSession } from "../session";
import { SceneFeedback, type SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";

export function codexFeedback(batch: CommittedBatch, query: (record: AnyGameRecord) => CodexData): SceneFeedbackEntry[] {
  if (!batch.presentable || batch.before.head.saveId !== batch.after.head.saveId || batch.before.head.epoch !== batch.after.head.epoch) return [];
  const before = query(batch.before), after = query(batch.after);
  if (before.status !== "ready" || after.status !== "ready") return [];
  const previous = new Map(before.entries.map(entry => [entry.id, entry.stage]));
  return after.entries.flatMap(entry => {
    const old = previous.get(entry.id) ?? "unknown";
    if (entry.stage === "unknown" || entry.stage === old || old === "defeated") return [];
    const label = entry.stage === "defeated" ? "图鉴补全" : "图鉴收录";
    return [{ id: `codex:${batch.after.head.saveId}:${batch.after.head.epoch}:${batch.after.head.revision}:${entry.id}`,
      kind: "notice" as const, message: `${label} · ${entry.name}` }];
  });
}

export function CodexFeedback({ session }: { session: GameSession }) {
  const [entries, setEntries] = useState<SceneFeedbackEntry[]>([]);
  useEffect(() => session.onCommitted(batch => {
    const notices = codexFeedback(batch, session.runtime.queries.codex);
    if (notices.length) setEntries(current => [...current, ...notices]);
  }), [session]);
  const dismiss = useCallback((id: string) => setEntries(current => current.filter(entry => entry.id !== id)), []);
  return <SceneFeedback dock entries={entries} onDismiss={dismiss}/>;
}
