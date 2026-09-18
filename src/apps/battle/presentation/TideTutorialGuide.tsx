import { useMemo } from "react";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { useSceneReadingProgress } from "../../../game-client/scene-reading-progress";
import { useTutorialStep } from "../../../shared/tutorial";
import { tideTutorialModel } from "./tide-tutorial-model";
import type { TideGuideDraft } from "./guided-tide-model";

export function TideTutorialGuide({view, heldActor, busy, onClose, eventActorId, suppliesOpen, selectedItem, expandKey = 0}: {view: DemoJourneyView; busy: boolean; onClose: () => void; expandKey?: number} & TideGuideDraft) {
  const progress = useSceneReadingProgress(`tide-hints:${view.head.saveId}:${view.tutorial?.attempt}`);
  const step = useMemo(() => {
    const model = !busy && tideTutorialModel(view, heldActor, progress.read, {heldActor, eventActorId, suppliesOpen, selectedItem});
    if (!model) return null;
    return {...model, onDismiss: onClose, collapseOnDismiss: !!view.tutorial?.guide, expandKey,
      protect: ["battle.roll", "battle.reroll", "battle.end-turn", "battle.items", "battle.ledger", "battle.hand", "battle.multiplier", "battle.advance", "battle.event-conditions", "battle.event-rules", "battle.event-result", "battle.event-confirm", "battle.event-observe", ...view.party.flatMap(m => [`battle.health:${m.id}`, `battle.die:${m.id}`]), ...(view.battle?.enemies.flatMap(e => [`battle.intent:${e.id}`, `battle.enemy-health:${e.id}`]) ?? [])],
      action: model.acknowledge ? {label: "actionLabel" in model && typeof model.actionLabel === "string" ? model.actionLabel : "明白了", onSelect: () => progress.write(model.id, 1)} : undefined,
    };
  }, [view, heldActor, busy, onClose, progress, eventActorId, suppliesOpen, selectedItem, expandKey]);
  useTutorialStep(step);
  return null;
}
