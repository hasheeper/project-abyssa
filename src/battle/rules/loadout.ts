import type {
  BattleCompletionOutput,
  BattleLoadoutSettlement,
  BattleLoadoutSnapshot,
  ExpeditionState
} from "../domain/state";

export function createEmptyBattleLoadout(): BattleLoadoutSnapshot {
  return { items: [], equipment: [], traits: [] };
}

export function cloneBattleLoadout(
  loadout: BattleLoadoutSnapshot = createEmptyBattleLoadout()
): BattleLoadoutSnapshot {
  return structuredClone(loadout);
}

export function createBattleLoadoutSettlement(
  atStart: BattleLoadoutSnapshot,
  current: BattleLoadoutSnapshot
): BattleLoadoutSettlement {
  const currentItems = new Map(
    current.items.map((instance) => [instance.instanceId, instance] as const)
  );
  const currentEquipment = new Map(
    current.equipment.map((instance) => [instance.instanceId, instance] as const)
  );

  const consumedItems = atStart.items.flatMap((started) => {
    const remaining = currentItems.get(started.instanceId)?.charges ?? 0;
    const chargesSpent = Math.max(0, started.charges - remaining);
    return chargesSpent > 0
      ? [{
          instanceId: started.instanceId,
          definitionId: started.definitionId,
          chargesSpent,
          chargesRemaining: remaining
        }]
      : [];
  });
  const equipmentWear = atStart.equipment.flatMap((started) => {
    const remaining = currentEquipment.get(started.instanceId)?.durability ?? 0;
    const durabilitySpent = Math.max(0, started.durability - remaining);
    return durabilitySpent > 0
      ? [{
          instanceId: started.instanceId,
          definitionId: started.definitionId,
          durabilitySpent,
          durabilityRemaining: remaining,
          broken: remaining === 0
        }]
      : [];
  });

  return { consumedItems, equipmentWear };
}

export function createBattleCompletionOutput(
  state: ExpeditionState
): BattleCompletionOutput {
  return {
    result: structuredClone(state.result),
    loadout: createBattleLoadoutSettlement(state.loadoutAtStart, state.loadout)
  };
}
