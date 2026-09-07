import type { AtomicEffect, EffectResolutionError } from "../../domain/effects";
import type { ExpeditionState, StatusInstance } from "../../domain/state";
import type { ResolverEmitter } from "./emitter";
import { emitStatusRemoved } from "./state-helpers";
import { targetExists, targetRefKey } from "./targets";

type StatusEffect = Extract<
  AtomicEffect,
  { type: "cleanse" | "apply-status" | "remove-status" | "modify-status" }
>;

export function applyStatusEffect(
  state: ExpeditionState,
  effect: StatusEffect,
  emitter: ResolverEmitter
): EffectResolutionError | null {
  switch (effect.type) {
    case "cleanse": {
      if (!targetExists(state, effect.target)) return "invalid-effect-target";
      const key = targetRefKey(effect.target);
      const removed = state.statuses.filter(
        (status) =>
          status.targetKey === key &&
          !status.tags.includes("unremovable") &&
          (effect.definitionIds?.includes(status.definitionId) ||
            effect.statusTags?.some((tag) => status.tags.includes(tag)) ||
            (!effect.definitionIds && !effect.statusTags))
      );
      state.statuses = state.statuses.filter((status) => !removed.includes(status));
      for (const status of removed) {
        emitStatusRemoved(
          emitter,
          status,
          "cleanse",
          effect.source,
          effect.causeId,
          effect.batchId
        );
      }
      break;
    }

    case "apply-status": {
      if (!targetExists(state, effect.target)) return "invalid-effect-target";
      const targetKey = targetRefKey(effect.target);
      const immune = state.statuses.some(
        (status) =>
          (status.targetKey === targetKey || status.targetKey === "battle") &&
          status.tags.includes(`immune:${effect.status.definitionId}`)
      );
      if (immune) break;
      const existing = state.statuses.find(
        (status) =>
          status.targetKey === targetKey &&
          status.definitionId === effect.status.definitionId
      );
      if (!existing) {
        const status: StatusInstance = {
          ...structuredClone(effect.status),
          kind: "status",
          targetKey,
          stacks: Math.min(effect.status.maxStacks, Math.max(1, effect.status.stacks))
        };
        state.statuses.push(status);
        emitter.emit(
          "status-applied",
          {
            instanceId: status.instanceId,
            definitionId: status.definitionId,
            target: effect.target,
            stacks: status.stacks
          },
          effect.source,
          effect.causeId,
          effect.batchId
        );
        break;
      }

      switch (effect.refresh) {
        case "replace":
          Object.assign(existing, structuredClone(effect.status), { targetKey, kind: "status" });
          existing.stacks = Math.min(existing.maxStacks, Math.max(1, existing.stacks));
          break;
        case "refresh":
          existing.duration = structuredClone(effect.status.duration);
          break;
        case "stack":
          existing.stacks = Math.min(
            existing.maxStacks,
            existing.stacks + Math.max(1, effect.status.stacks)
          );
          if (effect.status.duration) existing.duration = structuredClone(effect.status.duration);
          break;
        case "extend":
          if (existing.duration && effect.status.duration) {
            existing.duration.remaining += effect.status.duration.remaining;
          } else if (effect.status.duration) {
            existing.duration = structuredClone(effect.status.duration);
          }
          break;
      }
      emitter.emit(
        "status-modified",
        {
          instanceId: existing.instanceId,
          stacks: existing.stacks,
          durationRemaining: existing.duration?.remaining ?? null
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "remove-status": {
      const index = state.statuses.findIndex((status) => status.instanceId === effect.instanceId);
      if (index < 0) return "invalid-effect-target";
      const [removed] = state.statuses.splice(index, 1);
      emitStatusRemoved(
        emitter,
        removed!,
        effect.reason ?? "effect",
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    case "modify-status": {
      const status = state.statuses.find((candidate) => candidate.instanceId === effect.instanceId);
      if (!status) return "invalid-effect-target";
      if (effect.stacksDelta) {
        status.stacks = Math.max(
          0,
          Math.min(status.maxStacks, status.stacks + effect.stacksDelta)
        );
      }
      if (effect.durationDelta && status.duration) {
        status.duration.remaining = Math.max(
          0,
          status.duration.remaining + effect.durationDelta
        );
      }
      if (status.stacks <= 0 || (status.duration && status.duration.remaining <= 0)) {
        state.statuses = state.statuses.filter(
          (candidate) => candidate.instanceId !== status.instanceId
        );
        emitStatusRemoved(
          emitter,
          status,
          "effect",
          effect.source,
          effect.causeId,
          effect.batchId
        );
        break;
      }
      emitter.emit(
        "status-modified",
        {
          instanceId: status.instanceId,
          stacks: status.stacks,
          durationRemaining: status.duration?.remaining ?? null
        },
        effect.source,
        effect.causeId,
        effect.batchId
      );
      break;
    }

    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
  return null;
}
