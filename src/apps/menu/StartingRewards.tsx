import { useEffect, useMemo, useState } from "react";
import type { createVersionedQueries } from "../../game-runtime/versioned-views";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { supplyArt } from "../../content/presentation/supply-icons";
import { SceneFeedback, type FeedbackReward, type SceneFeedbackEntry } from "../../shared/ui/patterns/SceneFeedback";
import "./starting-rewards.css";

type Reward = NonNullable<ReturnType<ReturnType<typeof createVersionedQueries>["startReward"]>>;
type Props = {reward: Reward; saveId: string; epoch: string; paused: boolean};

/** Presentation only: assets were already granted in the committed start selection.
 * The local hint prevents replay on refresh; it never controls reward ownership. */
export function StartingRewards({reward, saveId, epoch, paused}: Props) {
  const storageKey = `abyssa:start-reward:${saveId}:${epoch}:${reward.id}`;
  const [seen] = useState(() => {
    try { return window.localStorage.getItem(storageKey) !== null; } catch { return false; }
  });
  const [started, setStarted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (seen || started || paused) return;
    setStarted(true);
    try { window.localStorage.setItem(storageKey, JSON.stringify({saveId, epoch, rewardId: reward.id})); } catch { /* Optional display hint. */ }
  }, [seen, started, paused, storageKey, saveId, epoch, reward.id]);
  const entry = useMemo<SceneFeedbackEntry>(() => {
    const rewards: FeedbackReward[] = [
      {id: "gold", kind: "currency", currency: "gold", quantity: reward.gold},
      ...reward.supplies.map(s => ({id: s.instanceId, kind: "item" as const, name: s.definition.name,
        quantity: s.charges, icon: supplyArt[s.definition.kind]?.icon})),
      ...reward.loot.map(item => ({id: item.instanceId, kind: "item" as const,
        name: shopLootPresentation[item.definitionId].unknownName, quantity: shopLootPresentation[item.definitionId].quantity ?? 1, icon: shopLootPresentation[item.definitionId].iconUrl})),
    ];
    return {id: reward.id, kind: "result", title: "教程奖励已获得", rewards, durationMs: 10_000};
  }, [reward]);
  return <div className="menu-starting-rewards" data-no-pan style={{visibility: paused ? "hidden" : undefined}}>
    <SceneFeedback entry={started && !dismissed ? entry : null} edge="left" paused={paused}
      onDismiss={() => setDismissed(true)} />
  </div>;
}
