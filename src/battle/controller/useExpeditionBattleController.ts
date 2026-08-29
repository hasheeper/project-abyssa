import { useCallback, useRef, useState } from "react";
import type {
  BattleCommand,
  BattleTransition
} from "../domain/commands";
import type { CharacterId, ExpeditionState, Rng } from "../domain/state";
import { getTrackedRngSnapshot, mulberry32 } from "../persistence/rng";
import { createExpedition } from "../rules/compatibility";
import { dispatchBattleCommand } from "../rules/dispatcher";

export type TargetingMode =
  | { type: "idle" }
  | { type: "actor"; actorId: CharacterId }
  | { type: "item"; itemInstanceId: string }
  | { type: "ability"; actorId: CharacterId; abilityId: string };

export function getPendingLayerClearEventId(
  result: BattleTransition
): string | null {
  if (result.error) return null;
  return result.events.find(
    (event) => event.type === "layer-cleared" && event.payload.settlement === null
  )?.id ?? null;
}

function createRuntimeRng(): Rng {
  const seed = Math.floor(Math.random() * 0x1_0000_0000);
  return mulberry32(seed);
}

export function useExpeditionBattleController(rng?: Rng) {
  const initialRngRef = useRef<Rng | null>(null);
  if (initialRngRef.current === null) {
    initialRngRef.current = rng ?? createRuntimeRng();
  }

  const [state, setState] = useState<ExpeditionState>(() =>
    createExpedition(initialRngRef.current!)
  );
  const stateRef = useRef(state);
  const rngRef = useRef(initialRngRef.current);
  const compatibilityRngRef = useRef<Rng | null>(null);
  if (rng) {
    rngRef.current = rng;
    compatibilityRngRef.current = getTrackedRngSnapshot(rng) ? null : rng;
  } else {
    compatibilityRngRef.current = null;
  }
  const [targetingMode, setTargetingMode] = useState<TargetingMode>({ type: "idle" });
  const [pendingLayerClearId, setPendingLayerClearId] = useState<string | null>(null);

  const commit = useCallback((next: ExpeditionState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const getState = useCallback(() => stateRef.current, []);

  const transition = useCallback(
    (command: BattleCommand, input: ExpeditionState = stateRef.current): BattleTransition =>
      dispatchBattleCommand(
        input,
        command,
        compatibilityRngRef.current ? { rng: compatibilityRngRef.current } : undefined
      ),
    []
  );

  const commitTransition = useCallback((result: BattleTransition) => {
    if (result.error) return false;
    commit(result.state);
    setPendingLayerClearId(getPendingLayerClearEventId(result));
    return true;
  }, [commit]);

  const dispatch = useCallback(
    (command: BattleCommand): BattleTransition => {
      const result = transition(command);
      commitTransition(result);
      return result;
    },
    [commitTransition, transition]
  );

  const holdActor = useCallback((actorId: CharacterId | null) => {
    setTargetingMode(actorId ? { type: "actor", actorId } : { type: "idle" });
  }, []);

  const targetItem = useCallback((itemInstanceId: string) => {
    setTargetingMode({ type: "item", itemInstanceId });
  }, []);

  const targetAbility = useCallback((actorId: CharacterId, abilityId: string) => {
    setTargetingMode({ type: "ability", actorId, abilityId });
  }, []);

  const cancelTargeting = useCallback(() => {
    setTargetingMode({ type: "idle" });
  }, []);

  const restart = useCallback(() => {
    commit(createExpedition(rngRef.current));
    setTargetingMode({ type: "idle" });
    setPendingLayerClearId(null);
  }, [commit]);

  const acknowledgeLayerClear = useCallback((): BattleTransition => {
    const result = transition({ type: "end-turn" });
    commitTransition(result);
    return result;
  }, [commitTransition, transition]);

  return {
    state,
    getState,
    commit,
    commitTransition,
    transition,
    dispatch,
    targetingMode,
    heldActor: targetingMode.type === "actor" ? targetingMode.actorId : null,
    pendingLayerClearId,
    acknowledgeLayerClear,
    holdActor,
    targetItem,
    targetAbility,
    cancelTargeting,
    restart
  };
}
