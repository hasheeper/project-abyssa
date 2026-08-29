import { MAX_HP, MAX_LAYER, REROLLS_PER_ROUND } from "../content/balance";
import { CHARACTERS, PARTY_ORDER } from "../content/characters";
import type { CharacterId, ExpeditionState } from "./state";

export type ExpeditionInvariantViolation = {
  code: string;
  path: string;
  message: string;
};

function add(
  violations: ExpeditionInvariantViolation[],
  code: string,
  path: string,
  message: string
) {
  violations.push({ code, path, message });
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

/** Current-engine invariants. Extend this module as canonical state evolves. */
export function collectExpeditionInvariantViolations(
  state: ExpeditionState
): ExpeditionInvariantViolation[] {
  const violations: ExpeditionInvariantViolation[] = [];
  const expectedOwners = [...PARTY_ORDER];
  const partyIds = state.party.map((member) => member.id);
  const dieOwners = state.dice.map((die) => die.ownerId);

  for (const id of duplicates(partyIds)) {
    add(violations, "party.duplicate-id", "party", `Duplicate party id: ${id}`);
  }
  for (const id of duplicates(dieOwners)) {
    add(violations, "dice.duplicate-owner", "dice", `Duplicate die owner: ${id}`);
  }
  for (const id of duplicates(state.enemies.map((enemy) => enemy.id))) {
    add(violations, "enemy.duplicate-id", "enemies", `Duplicate enemy id: ${id}`);
  }

  if (JSON.stringify(partyIds) !== JSON.stringify(expectedOwners)) {
    add(
      violations,
      "party.order",
      "party",
      `Party order must be ${expectedOwners.join(",")}`
    );
  }
  if (JSON.stringify(dieOwners) !== JSON.stringify(expectedOwners)) {
    add(
      violations,
      "dice.order",
      "dice",
      `Die order must be ${expectedOwners.join(",")}`
    );
  }

  const memberById = new Map(state.party.map((member) => [member.id, member]));
  for (const [index, member] of state.party.entries()) {
    const path = `party[${index}]`;
    if (!Number.isInteger(member.hp) || member.hp < 0 || member.hp > MAX_HP) {
      add(violations, "party.hp-range", `${path}.hp`, `Invalid HP: ${member.hp}`);
    }
    if (!Number.isInteger(member.shield) || member.shield < 0) {
      add(
        violations,
        "party.shield-range",
        `${path}.shield`,
        `Invalid shield: ${member.shield}`
      );
    }
    if (member.downed !== (member.hp === 0)) {
      add(
        violations,
        "party.downed-hp",
        path,
        `Downed (${member.downed}) must agree with HP (${member.hp})`
      );
    }
    const maxRust = CHARACTERS[member.id].faces.filter(
      (face) => face.quality === "plain" || face.quality === "gild"
    ).length;
    if (
      !Number.isInteger(member.rustLevel) ||
      member.rustLevel < 0 ||
      member.rustLevel > maxRust
    ) {
      add(
        violations,
        "party.rust-range",
        `${path}.rustLevel`,
        `Invalid rust level: ${member.rustLevel}`
      );
    }
  }

  for (const [index, die] of state.dice.entries()) {
    const path = `dice[${index}]`;
    const member = memberById.get(die.ownerId);
    if (!member) {
      add(
        violations,
        "dice.missing-owner",
        `${path}.ownerId`,
        `Missing party owner: ${die.ownerId}`
      );
      continue;
    }
    const faceCount = CHARACTERS[die.ownerId].faces.length;
    if (
      die.faceIndex !== null &&
      (!Number.isInteger(die.faceIndex) || die.faceIndex < 0 || die.faceIndex >= faceCount)
    ) {
      add(
        violations,
        "dice.face-range",
        `${path}.faceIndex`,
        `Invalid face index: ${die.faceIndex}`
      );
    }
    if ("downed" in die || "rustLevel" in die) {
      add(
        violations,
        "dice.duplicate-owner-state",
        path,
        "Die state must derive downed and rustLevel from its party owner"
      );
    }
    if (member.downed && die.loaded) {
      add(violations, "dice.downed-loaded", path, "A downed die cannot be loaded");
    }
    if (die.sealed && die.loaded) {
      add(violations, "dice.sealed-loaded", path, "A sealed die cannot be loaded");
    }
  }

  const partyIdSet = new Set<CharacterId>(partyIds);
  for (const [index, enemy] of state.enemies.entries()) {
    const path = `enemies[${index}]`;
    if (!Number.isInteger(enemy.hp) || enemy.hp < 0 || enemy.hp > enemy.maxHp) {
      add(violations, "enemy.hp-range", `${path}.hp`, `Invalid HP: ${enemy.hp}`);
    }
    if (!Number.isInteger(enemy.maxHp) || enemy.maxHp <= 0) {
      add(
        violations,
        "enemy.max-hp-range",
        `${path}.maxHp`,
        `Invalid max HP: ${enemy.maxHp}`
      );
    }
    if ("dead" in enemy) {
      add(
        violations,
        "enemy.duplicate-life-state",
        path,
        "Enemy defeat must be derived from hp"
      );
    }
    if (enemy.hp <= 0 && enemy.intent !== null) {
      add(
        violations,
        "enemy.defeated-intent",
        `${path}.intent`,
        "A defeated enemy has an intent"
      );
    }
    if (enemy.intent && "targetId" in enemy.intent && !partyIdSet.has(enemy.intent.targetId)) {
      add(
        violations,
        "enemy.intent-target",
        `${path}.intent.targetId`,
        `Unknown target: ${enemy.intent.targetId}`
      );
    }
    if (!Number.isInteger(enemy.blocked) || enemy.blocked < 0) {
      add(
        violations,
        "enemy.blocked-range",
        `${path}.blocked`,
        `Invalid blocked value: ${enemy.blocked}`
      );
    }
  }

  if (!Number.isInteger(state.layer) || state.layer < 1 || state.layer > MAX_LAYER) {
    add(violations, "run.layer-range", "layer", `Invalid layer: ${state.layer}`);
  }
  if (
    !Number.isInteger(state.deepestLayer) ||
    state.deepestLayer < state.layer ||
    state.deepestLayer > MAX_LAYER
  ) {
    add(
      violations,
      "run.deepest-layer-range",
      "deepestLayer",
      `Invalid deepest layer: ${state.deepestLayer}`
    );
  }
  if (!Number.isInteger(state.round) || state.round < 1) {
    add(violations, "run.round-range", "round", `Invalid round: ${state.round}`);
  }
  if (
    !Number.isInteger(state.rerollsRemaining) ||
    state.rerollsRemaining < 0 ||
    state.rerollsRemaining > REROLLS_PER_ROUND
  ) {
    add(
      violations,
      "run.rerolls-range",
      "rerollsRemaining",
      `Invalid rerolls: ${state.rerollsRemaining}`
    );
  }
  if (state.gold < 0 || state.bagGold < 0 || state.handMultiplier < 0) {
    add(violations, "run.resource-range", "gold", "Battle resources cannot be negative");
  }
  if ("phase" in state || "status" in state || "lastOutcome" in state) {
    add(
      violations,
      "run.duplicate-lifecycle-state",
      "mode",
      "Lifecycle phase, status and outcome must be derived from mode"
    );
  }
  const status =
    state.mode.type === "greed"
      ? "greed"
      : state.mode.type === "finished"
        ? "finished"
        : "active";
  if (status === "finished" && state.result === null) {
    add(violations, "run.finished-result", "result", "A finished run needs a result");
  }
  if (status !== "finished" && state.result !== null) {
    add(
      violations,
      "run.early-result",
      "result",
      "Only a finished run may have a result"
    );
  }
  if (status !== "active" && state.undoStack.length > 0) {
    add(
      violations,
      "run.terminal-undo",
      "undoStack",
      "Non-active states cannot retain undo history"
    );
  }

  if (state.mode.type === "enemy-turn") {
    if (
      !Number.isInteger(state.mode.cursor) ||
      state.mode.cursor < 0 ||
      state.mode.cursor > state.mode.enemyOrder.length
    ) {
      add(
        violations,
        "turn.cursor-range",
        "mode.cursor",
        `Invalid enemy cursor: ${state.mode.cursor}`
      );
    }
    if (duplicates(state.mode.enemyOrder).length > 0) {
      add(
        violations,
        "turn.duplicate-enemy",
        "mode.enemyOrder",
        "Enemy turn queue contains duplicate ids"
      );
    }
    if (
      state.mode.outcome !== null &&
      !["continue", "layer-cleared", "wipe"].includes(state.mode.outcome)
    ) {
      add(
        violations,
        "turn.outcome",
        "mode.outcome",
        `Invalid enemy-turn outcome: ${String(state.mode.outcome)}`
      );
    }
    const enemyIds = new Set(state.enemies.map((enemy) => enemy.id));
    for (const queuedId of state.mode.enemyOrder) {
      if (!enemyIds.has(queuedId)) {
        add(
          violations,
          "turn.unknown-enemy",
          "mode.enemyOrder",
          `Unknown queued enemy: ${queuedId}`
        );
      }
    }
  }

  for (const streamName of ["combat", "loot", "flavor"] as const) {
    const stream = state.rng[streamName];
    if (
      stream.algorithm !== "mulberry32" ||
      !Number.isInteger(stream.seed) ||
      stream.seed < 0 ||
      !Number.isInteger(stream.cursor) ||
      stream.cursor < 0
    ) {
      add(
        violations,
        "rng.stream",
        `rng.${streamName}`,
        `Invalid ${streamName} RNG stream`
      );
    }
  }
  if (!Number.isInteger(state.eventSequence) || state.eventSequence < 0) {
    add(
      violations,
      "event.sequence",
      "eventSequence",
      `Invalid event sequence: ${state.eventSequence}`
    );
  }

  for (const [queueName, queue] of [
    ["pendingEffects", state.pendingEffects],
    ["pendingReactions", state.pendingReactions]
  ] as const) {
    if (duplicates(queue.map((entry) => entry.id)).length > 0) {
      add(
        violations,
        "resolution.duplicate-id",
        queueName,
        `${queueName} contains duplicate ids`
      );
    }
    for (const [index, entry] of queue.entries()) {
      if (!Number.isInteger(entry.depth) || entry.depth < 0) {
        add(
          violations,
          "resolution.depth",
          `${queueName}[${index}].depth`,
          `Invalid resolution depth: ${entry.depth}`
        );
      }
    }
  }

  for (const [loadoutName, loadout] of [
    ["loadoutAtStart", state.loadoutAtStart],
    ["loadout", state.loadout]
  ] as const) {
    const allInstances = [
      ...loadout.items,
      ...loadout.equipment,
      ...loadout.traits
    ];
    if (duplicates(allInstances.map((instance) => instance.instanceId)).length > 0) {
      add(
        violations,
        "loadout.duplicate-instance",
        loadoutName,
        `${loadoutName} contains duplicate instance ids`
      );
    }
    for (const [index, instance] of allInstances.entries()) {
      if (instance.ownerId !== null && !partyIds.includes(instance.ownerId)) {
        add(
          violations,
          "loadout.unknown-owner",
          `${loadoutName}[${index}].ownerId`,
          `Unknown loadout owner: ${instance.ownerId}`
        );
      }
    }
    for (const [index, item] of loadout.items.entries()) {
      if (
        !Number.isInteger(item.charges) ||
        !Number.isInteger(item.maxCharges) ||
        item.maxCharges <= 0 ||
        item.charges < 0 ||
        item.charges > item.maxCharges
      ) {
        add(
          violations,
          "loadout.item-charge-range",
          `${loadoutName}.items[${index}]`,
          `Invalid item charges: ${item.charges}/${item.maxCharges}`
        );
      }
    }
    for (const [index, equipment] of loadout.equipment.entries()) {
      if (
        !Number.isInteger(equipment.durability) ||
        !Number.isInteger(equipment.maxDurability) ||
        equipment.maxDurability <= 0 ||
        equipment.durability < 0 ||
        equipment.durability > equipment.maxDurability
      ) {
        add(
          violations,
          "loadout.equipment-durability-range",
          `${loadoutName}.equipment[${index}]`,
          `Invalid equipment durability: ${equipment.durability}/${equipment.maxDurability}`
        );
      }
    }
  }

  for (const [collectionName, instances] of [
    ["statuses", state.statuses],
    ["encounterRules", state.encounterRules]
  ] as const) {
    if (duplicates(instances.map((instance) => instance.instanceId)).length > 0) {
      add(
        violations,
        "effect.duplicate-instance",
        collectionName,
        `${collectionName} contains duplicate instance ids`
      );
    }
    for (const [index, instance] of instances.entries()) {
      const path = `${collectionName}[${index}]`;
      if (
        !Number.isInteger(instance.stacks) ||
        instance.stacks <= 0 ||
        !Number.isInteger(instance.maxStacks) ||
        instance.maxStacks <= 0 ||
        instance.stacks > instance.maxStacks
      ) {
        add(
          violations,
          "effect.stack-range",
          path,
          `Invalid stacks: ${instance.stacks}/${instance.maxStacks}`
        );
      }
      if (
        instance.duration &&
        (!Number.isInteger(instance.duration.remaining) || instance.duration.remaining <= 0)
      ) {
        add(
          violations,
          "effect.duration-range",
          `${path}.duration.remaining`,
          `Invalid duration: ${instance.duration.remaining}`
        );
      }
    }
  }

  for (const [index, ownerId] of state.lastTossed.entries()) {
    if (!partyIdSet.has(ownerId)) {
      add(
        violations,
        "roll.unknown-owner",
        `lastTossed[${index}]`,
        `Unknown tossed owner: ${ownerId}`
      );
    }
  }
  if (duplicates(state.lastTossed).length > 0) {
    add(violations, "roll.duplicate-owner", "lastTossed", "A die was tossed twice");
  }

  return violations;
}

export function assertExpeditionInvariants(state: ExpeditionState): void {
  const violations = collectExpeditionInvariantViolations(state);
  if (violations.length === 0) return;
  throw new Error(
    `Expedition invariant violations:\n${violations
      .map((violation) => `- [${violation.code}] ${violation.path}: ${violation.message}`)
      .join("\n")}`
  );
}
