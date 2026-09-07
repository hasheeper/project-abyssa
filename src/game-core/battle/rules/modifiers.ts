import type {
  EffectModifier,
  ModifierApplication,
  UnitTargetRef
} from "../domain/effects";

export function compareOrderedSources(
  left: Pick<EffectModifier, "priority" | "sourceId" | "instanceId">,
  right: Pick<EffectModifier, "priority" | "sourceId" | "instanceId">
): number {
  return (
    left.priority - right.priority ||
    left.sourceId.localeCompare(right.sourceId) ||
    left.instanceId.localeCompare(right.instanceId)
  );
}

function appliesTo(
  modifier: EffectModifier,
  window: EffectModifier["window"],
  target: UnitTargetRef,
  tags: readonly string[]
): boolean {
  return (
    modifier.window === window &&
    (modifier.targetKinds.length === 0 || modifier.targetKinds.includes(target.kind)) &&
    modifier.requiredTags.every((tag) => tags.includes(tag))
  );
}

export type ModifiedNumericEffect = {
  raw: number;
  value: number;
  target: UnitTargetRef;
  applications: ModifierApplication[];
};

/** Stable, data-only numeric modifier pipeline. */
export function applyNumericModifiers(
  raw: number,
  window: EffectModifier["window"],
  target: UnitTargetRef,
  tags: readonly string[],
  modifiers: readonly EffectModifier[]
): ModifiedNumericEffect {
  let value = Math.max(0, raw);
  let resolvedTarget = target;
  let penetration = 0;
  const applications: ModifierApplication[] = [];

  const ordered = modifiers
    .filter((modifier) => appliesTo(modifier, window, target, tags));
  ordered.sort(compareOrderedSources);

  for (const modifier of ordered) {
    const before = value;
    switch (modifier.operation) {
      case "add":
        value += modifier.value;
        break;
      case "multiply":
        value *= modifier.value;
        break;
      case "reduce": {
        const reduction = Math.max(0, modifier.value - penetration);
        penetration = Math.max(0, penetration - modifier.value);
        value -= reduction;
        break;
      }
      case "prevent":
        value = 0;
        break;
      case "pierce":
        penetration += Math.max(0, modifier.value);
        break;
      case "redirect":
        if (modifier.redirectTarget) resolvedTarget = modifier.redirectTarget;
        break;
      default: {
        const exhaustive: never = modifier.operation;
        return exhaustive;
      }
    }
    value = Math.max(0, value);
    applications.push({
      instanceId: modifier.instanceId,
      operation: modifier.operation,
      before,
      after: value
    });
  }

  return { raw, value, target: resolvedTarget, applications };
}
