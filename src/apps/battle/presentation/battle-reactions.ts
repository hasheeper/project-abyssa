import { useCallback, useState } from "react";
import type { BattleEvent } from "../view";
import type { DemoEvent } from "../../../game-core/battle";
import { BATTLE_REACTIONS, type BattleReactionKind } from "../../../content/presentation/battle-reactions";

export type BattleReaction = { key: string; actorId: string; kind: BattleReactionKind; text: string };
const kinds: Record<string, BattleReactionKind> = {
  attack: "attack", guard: "guard", "guard-all": "guard", protect: "guard",
  heal: "heal", bind: "bind", blank: "blank", art: "special", steal: "special",
};
export function makeBattleReaction(key: string, actorId: string, kind: BattleReactionKind): BattleReaction | null {
  const lines = BATTLE_REACTIONS[actorId]?.[kind];
  if (!lines) return null;
  // Stable per committed event: rendering/retries never draw from either game or UI RNG.
  let hash = 0;
  for (const char of key) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return { key, actorId, kind, text: lines[(hash >>> 0) % lines.length]! };
}
export function demoBattleReaction(events: readonly DemoEvent[], receiptKey: string): BattleReaction | null {
  for (const event of [...events].reverse()) {
    const p = event.payload as Record<string, unknown>;
    if (!event.actorId) continue;
    if (event.type === "action-resolved") return makeBattleReaction(`${receiptKey}:${event.id}`, event.actorId, kinds[String(p.choice)] ?? "special");
    if (event.type === "event-resolved" && ["strong", "weak", "failed"].includes(String(p.method)))
      return makeBattleReaction(`${receiptKey}:${event.id}`, event.actorId, p.method === "failed" ? "failure" : "success");
  }
  return null;
}
export function legacyBattleReaction(events: readonly BattleEvent[], receiptKey: string): BattleReaction | null {
  const action = [...events].reverse().find(e => e.type === "action-resolved");
  return action?.type === "action-resolved" ? makeBattleReaction(`${receiptKey}:${action.id}`, action.payload.actorId, kinds[action.payload.verb] ?? "special") : null;
}
export function useBattleReaction() {
  const [reaction, setReaction] = useState<BattleReaction | null>(null);
  const observe = useCallback((next: BattleReaction | null) => {
    if (next) setReaction(current => current?.key === next.key ? current : next);
  }, []);
  const clear = useCallback(() => setReaction(null), []);
  return { reaction, observe, clear };
}
