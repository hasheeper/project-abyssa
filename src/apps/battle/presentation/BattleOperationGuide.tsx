import { useMemo, useState } from "react";
import { useTutorialStep } from "../../../shared/tutorial";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { battleTutorialModel } from "./battle-tutorial-model";

/** Voluntary live help. It does not award the future opening chapter's lesson evidence. */
export function BattleOperationGuide({ view, heldActor, busy, onClose }: {
  view: DemoJourneyView;
  heldActor: string | null;
  busy: boolean;
  onClose: () => void;
}) {
  const [readIntent, setReadIntent] = useState(false);
  const [firstRound] = useState(view.battle?.encounter.round ?? 0);
  const step = useMemo(() => {
    if (busy) return null;
    const model = battleTutorialModel(view, heldActor, readIntent, firstRound);
    if (!model) return null;
    const finished = model.id.endsWith(".next");
    return {
      ...model,
      protect: [
        "battle.roll", "battle.reroll", "battle.end-turn",
        ...view.party.flatMap(m => [`battle.health:${m.id}`, `battle.die:${m.id}`]),
        ...(view.battle?.enemies.flatMap(e => [`battle.intent:${e.id}`, `battle.enemy-health:${e.id}`]) ?? []),
      ],
      onDismiss: onClose,
      action: model.acknowledge ? {
        label: finished ? "自行战斗" : "明白了",
        onSelect: finished ? onClose : () => setReadIntent(true),
      } : undefined,
    };
  }, [view, heldActor, busy, readIntent, firstRound, onClose]);
  useTutorialStep(step);
  return null;
}
