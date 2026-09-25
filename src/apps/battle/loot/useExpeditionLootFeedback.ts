import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoEvent } from "../../../game-core/battle";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { SceneFeedbackEntry } from "../../../shared/ui/patterns/SceneFeedback";
import { expeditionLootCatalog } from "./expedition-loot-view";
import "../../../shared/ui/styles/scene-feedback.css";

export function expeditionRewardFeedback(event: DemoEvent, view: DemoJourneyView): SceneFeedbackEntry | null {
  if (view.battle?.encounter.memory) return null;
  const p = event.payload as Record<string, unknown>;
  const copper = ["enemy-defeated", "enemy-released"].includes(event.type) ? Number(p.bounty) : event.type === "event-resolved" ? Number(p.reward) : 0;
  if (copper > 0) return {id: event.id, kind: "reward", durationMs: 4000, reward: {id: event.id, kind: "currency", currency: "lira", quantity: copper}};
  if (!["loot-found", "commission-item-found"].includes(event.type) || typeof p.definitionId !== "string") return null;
  const key = typeof p.instanceId === "string" && view.appraisalLoot?.[p.instanceId] ? p.instanceId : p.definitionId;
  const item = expeditionLootCatalog(view)[key];
  if (!item) return null;
  return {id: event.id, kind: "reward", durationMs: 4000, reward: {id: event.id, kind: "item", name: item.name, icon: item.icon, rarity: item.rarity, quantity: view.lootContent?.definitions[p.definitionId]?.quantity ?? 1}};
}

/** Announce committed events when their battle presentation arrives, never on load. */
export function useExpeditionLootFeedback(identity: string) {
  const [entries, setEntries] = useState<SceneFeedbackEntry[]>([]);
  const announced = useRef(new Set<string>());
  useEffect(() => { announced.current.clear(); setEntries([]); }, [identity]);
  const onEventPresented = useCallback((event: DemoEvent, view: DemoJourneyView) => {
    if (event.type === "action-undone" || event.type === "tutorial-retried") { setEntries([]); return; }
    if (announced.current.has(event.id)) return;
    const entry = expeditionRewardFeedback(event, view);
    if (!entry) return;
    announced.current.add(event.id);
    const payload = event.payload as Record<string, unknown>;
    const generated = typeof payload.instanceId === "string" && !!view.appraisalLoot?.[payload.instanceId];
    const groupId = !generated && event.type === "loot-found" && typeof payload.roomId === "string" && typeof payload.definitionId === "string"
      ? `loot:${payload.roomId}:${payload.definitionId}` : entry.id;
    setEntries(current => {
      const previous = current.find(e => e.id === groupId);
      if (previous?.kind === "reward" && previous.reward.kind === "item" && entry.kind === "reward" && entry.reward.kind === "item")
        return current.map(e => e === previous ? {...previous, reward: {...previous.reward, quantity: previous.reward.quantity + entry.reward.quantity}} : e);
      return [...current, {...entry, id: groupId}];
    });
  }, []);
  const dismiss = useCallback((id: string) => setEntries(current => current.filter(entry => entry.id !== id)), []);
  return {entries, onEventPresented, dismiss};
}
