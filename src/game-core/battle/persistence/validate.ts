import type { BattleContext } from "../../contracts/catalog";
import * as v from "../../contracts/validation";
import type { BattleLoadoutSnapshot, BattleState } from "../domain/state";
import { collectExpeditionInvariantViolations } from "../domain/invariants";

const stateKeys = [
  "location",
  "layer",
  "deepestLayer",
  "round",
  "layerStartEnemies",
  "lastTossed",
  "stalledRounds",
  "lastEnemyHp",
  "gold",
  "bagGold",
  "handMultiplier",
  "lastLayerSettlement",
  "rerollsRemaining",
  "enemySequence",
  "party",
  "dice",
  "enemies",
  "rng",
  "pendingEffects",
  "pendingReactions",
  "statuses",
  "encounterRules",
  "loadoutAtStart",
  "loadout",
  "eventSequence",
  "log",
  "facts",
  "mode",
  "result",
];
const scopes = [
  "effect",
  "action",
  "round",
  "next-round",
  "layer",
  "expedition",
] as const;

function hand(value: unknown, path: string, partyIds: string[]): void {
  if (value === null) return;
  const h = v.record(value, path, [
    "name",
    "bonus",
    "used",
    "adjustedBonus",
    "qualityModifier",
    "pips",
    "contributors",
  ]);
  v.text(h.name, `${path}.name`, 160);
  v.number(h.bonus, `${path}.bonus`, 0, 10000, false);
  v.number(h.adjustedBonus, `${path}.adjustedBonus`, 0, 10000, false);
  v.number(h.qualityModifier, `${path}.qualityModifier`, -1000, 1000, false);
  v.list(h.used, `${path}.used`, 5).forEach((n) =>
    v.number(n, `${path}.used`, 1, 6),
  );
  v.list(h.pips, `${path}.pips`, 5).forEach((n) => {
    if (n !== "wild") v.number(n, `${path}.pips`, 1, 6);
  });
  for (const id of v.ids(h.contributors, `${path}.contributors`, 5))
    if (!partyIds.includes(id))
      v.invalid(`${path}.contributors`, "Unknown party member");
}

function layerSettlement(value: unknown, path: string, maxLayer: number): void {
  if (value === null) return;
  const s = v.record(value, path, [
    "layer",
    "round",
    "baseGold",
    "handFactor",
    "layerFactor",
    "payout",
    "bagBefore",
    "bagAfter",
    "closingHandName",
    "closingHandBonus",
  ]);
  v.number(s.layer, `${path}.layer`, 1, maxLayer);
  v.number(s.round, `${path}.round`, 1);
  for (const key of ["baseGold", "payout", "bagBefore", "bagAfter"])
    v.number(s[key], `${path}.${key}`);
  for (const key of ["handFactor", "layerFactor", "closingHandBonus"])
    v.number(s[key], `${path}.${key}`, 0, 1e9, false);
  if (s.closingHandName !== null)
    v.text(s.closingHandName, `${path}.closingHandName`, 160);
  if ((s.bagBefore as number) + (s.payout as number) !== s.bagAfter)
    v.invalid(path, "Invalid layer settlement sum", "invariant-violation");
}

export function validateLoadout(
  context: BattleContext,
  input: unknown,
  path = "loadout",
  owners: readonly string[] = context.partyOrder,
): BattleLoadoutSnapshot {
  const loadout = v.record(input, path, ["items", "equipment", "traits"]);
  const instanceIds = new Set<string>();
  for (const [collection, kind] of [
    ["items", "item"],
    ["equipment", "equipment"],
    ["traits", "trait"],
  ] as const) {
    v.list(loadout[collection], `${path}.${collection}`, 256).forEach(
      (raw, i) => {
        const p = `${path}.${collection}[${i}]`;
        const own =
          kind === "item"
            ? ["charges", "maxCharges"]
            : kind === "equipment"
              ? ["slot", "durability", "maxDurability"]
              : [];
        const instance = v.record(raw, p, [
          "kind",
          "instanceId",
          "definitionId",
          "sourceId",
          "ownerId",
          "tags",
          "data",
          ...own,
        ]);
        v.choice(instance.kind, [kind], `${p}.kind`);
        const instanceId = v.id(instance.instanceId, `${p}.instanceId`);
        if (instanceIds.has(instanceId))
          v.invalid(`${p}.instanceId`, "Duplicate instance");
        instanceIds.add(instanceId);
        v.reference(
          context.catalog.effects,
          instance.definitionId,
          `${p}.definitionId`,
        );
        if (
          context.catalog.contentKinds[instance.definitionId as string] !== kind
        )
          v.invalid(`${p}.definitionId`, "Wrong content kind");
        v.id(instance.sourceId, `${p}.sourceId`);
        v.ids(instance.tags, `${p}.tags`, 64);
        if (kind !== "item" || instance.ownerId !== null) {
          const owner = v.id(instance.ownerId, `${p}.ownerId`);
          if (!owners.includes(owner))
            v.invalid(
              `${p}.ownerId`,
              "Owner not in formation",
              "unknown-content",
            );
        }
        if (kind === "item") {
          v.number(instance.maxCharges, `${p}.maxCharges`, 1, 10000);
          v.number(
            instance.charges,
            `${p}.charges`,
            0,
            instance.maxCharges as number,
          );
        } else if (kind === "equipment") {
          v.id(instance.slot, `${p}.slot`);
          v.number(instance.maxDurability, `${p}.maxDurability`, 1, 10000);
          v.number(
            instance.durability,
            `${p}.durability`,
            0,
            instance.maxDurability as number,
          );
        }
      },
    );
  }
  return input as BattleLoadoutSnapshot;
}

export function assertLoadoutConservation(
  start: BattleLoadoutSnapshot,
  current: BattleLoadoutSnapshot,
): void {
  for (const collection of ["items", "equipment", "traits"] as const) {
    if (start[collection].length !== current[collection].length)
      v.invalid(
        `loadout.${collection}`,
        "Carried instance set changed",
        "invariant-violation",
      );
    for (const initial of start[collection]) {
      const now = current[collection].find(
        (item) => item.instanceId === initial.instanceId,
      );
      if (!now)
        v.invalid(
          `loadout.${collection}`,
          "Missing entrusted instance",
          "invariant-violation",
        );
      const before = { ...initial },
        after = { ...now };
      if (before.kind === "item" && after.kind === "item") {
        if (after.charges > before.charges)
          v.invalid("loadout.items", "Charges exceed entrusted amount");
        after.charges = before.charges;
      }
      if (before.kind === "equipment" && after.kind === "equipment") {
        if (after.durability > before.durability)
          v.invalid("loadout.equipment", "Durability exceeds entrusted amount");
        after.durability = before.durability;
      }
      if (v.canonicalJson(before) !== v.canonicalJson(after))
        v.invalid(
          `loadout.${collection}`,
          "Entrusted instance identity changed",
          "invariant-violation",
        );
    }
  }
}

/** Validate all fields before invoking typed invariants; checkpoints are full states too. */
export function validateBattleState(
  context: BattleContext,
  input: unknown,
): BattleState {
  v.assertJson(input);
  function validateOne(
    value: unknown,
    path: string,
    checkpoint: boolean,
  ): void {
    const s = v.record(
      value,
      path,
      checkpoint ? stateKeys : [...stateKeys, "undoStack"],
    );
    v.text(s.location, `${path}.location`, 160);
    for (const key of ["layer", "deepestLayer"])
      v.number(s[key], `${path}.${key}`, 1, context.catalog.balance.MAX_LAYER);
    v.number(s.round, `${path}.round`, 1);
    for (const key of [
      "layerStartEnemies",
      "stalledRounds",
      "lastEnemyHp",
      "gold",
      "bagGold",
      "rerollsRemaining",
      "enemySequence",
      "eventSequence",
    ])
      v.number(s[key], `${path}.${key}`);
    v.number(s.handMultiplier, `${path}.handMultiplier`, 0, 1e9, false);
    const party = v.list(
      s.party,
      `${path}.party`,
      context.catalog.maxPartySize,
    );
    const partyIds = party.map((raw, i) => {
      const p = `${path}.party[${i}]`,
        member = v.record(raw, p, [
          "id",
          "hp",
          "shield",
          "downed",
          "rustLevel",
          "sealedNext",
        ]);
      v.reference(context.catalog.characters, member.id, `${p}.id`);
      v.number(member.hp, `${p}.hp`, 0, context.catalog.balance.MAX_HP);
      v.number(member.shield, `${p}.shield`, 0, 1e9);
      v.number(member.rustLevel, `${p}.rustLevel`, 0, 6);
      v.boolean(member.downed, `${p}.downed`);
      v.boolean(member.sealedNext, `${p}.sealedNext`);
      return member.id as string;
    });
    if (
      !partyIds.length ||
      !partyIds.includes(context.catalog.leaderId) ||
      new Set(partyIds).size !== partyIds.length
    )
      v.invalid(`${path}.party`, "Invalid formation");
    const dice = v.list(s.dice, `${path}.dice`, context.catalog.maxPartySize);
    dice.forEach((raw, i) => {
      const p = `${path}.dice[${i}]`,
        die = v.record(raw, p, [
          "ownerId",
          "faceIndex",
          "sealed",
          "loaded",
          "spent",
        ]);
      if (!partyIds.includes(v.id(die.ownerId, `${p}.ownerId`)))
        v.invalid(`${p}.ownerId`, "Unknown owner");
      if (die.faceIndex !== null)
        v.number(die.faceIndex, `${p}.faceIndex`, 0, 5);
      for (const flag of ["sealed", "loaded", "spent"])
        v.boolean(die[flag], `${p}.${flag}`);
    });
    const enemyIds: string[] = [];
    v.list(s.enemies, `${path}.enemies`, 256).forEach((raw, i) => {
      const p = `${path}.enemies[${i}]`,
        enemy = v.record(raw, p, [
          "id",
          "definitionId",
          "kind",
          "name",
          "art",
          "hp",
          "maxHp",
          "attack",
          "chargeReady",
          "countdown",
          "intent",
          "blocked",
        ]);
      enemyIds.push(v.id(enemy.id, `${p}.id`));
      const definition = v.reference(
        context.catalog.enemies,
        enemy.definitionId,
        `${p}.definitionId`,
      );
      for (const [key, expected] of [
        ["kind", definition.kind],
        ["name", definition.name],
        ["art", definition.art],
        ["maxHp", definition.hp],
      ] as const)
        if (enemy[key] !== expected)
          v.invalid(`${p}.${key}`, "Enemy definition mismatch");
      v.number(enemy.hp, `${p}.hp`, 0, definition.hp);
      v.number(enemy.attack, `${p}.attack`, 0, 1e9);
      v.number(enemy.countdown, `${p}.countdown`, 0, 1e9);
      v.number(enemy.blocked, `${p}.blocked`, 0, 1e9);
      v.boolean(enemy.chargeReady, `${p}.chargeReady`);
      if (enemy.intent !== null) {
        const it = v.record(enemy.intent, `${p}.intent`),
          type = v.choice(
            it.type,
            ["attack", "charge", "seal", "countdown", "summon"],
            `${p}.intent.type`,
          );
        v.record(it, `${p}.intent`, [
          "type",
          "title",
          "description",
          ...(type === "attack"
            ? ["targetId", "value"]
            : type === "seal"
              ? ["targetId"]
              : []),
        ]);
        v.text(it.title, `${p}.intent.title`, 160);
        v.text(it.description, `${p}.intent.description`);
        if (type === "attack" || type === "seal")
          if (!partyIds.includes(v.id(it.targetId, `${p}.intent.targetId`)))
            v.invalid(`${p}.intent.targetId`, "Unknown target");
        if (type === "attack") v.number(it.value, `${p}.intent.value`, 0, 1e9);
      }
    });
    const rng = v.record(s.rng, `${path}.rng`, ["combat", "loot", "flavor"]);
    for (const stream of ["combat", "loot", "flavor"]) {
      const p = `${path}.rng.${stream}`,
        r = v.record(rng[stream], p, ["algorithm", "seed", "cursor"]);
      v.choice(r.algorithm, ["mulberry32"], `${p}.algorithm`);
      v.number(r.seed, `${p}.seed`, 0, 0xffffffff);
      v.number(r.cursor, `${p}.cursor`);
    }
    // The current resolver is synchronous/atomic and never publishes pending queues.
    for (const name of ["pendingEffects", "pendingReactions"])
      if (v.list(s[name], `${path}.${name}`, 256).length)
        v.invalid(
          `${path}.${name}`,
          "Uncommitted effect queues cannot be restored",
          "invariant-violation",
        );
    for (const [collection, kind] of [
      ["statuses", "status"],
      ["encounterRules", "encounter-rule"],
    ] as const) {
      v.list(s[collection], `${path}.${collection}`, 256).forEach((raw, i) => {
        const p = `${path}.${collection}[${i}]`,
          instance = v.record(raw, p, [
            "kind",
            "instanceId",
            "definitionId",
            "sourceId",
            "targetKey",
            "stacks",
            "maxStacks",
            "duration",
            "tags",
            "data",
          ]);
        v.choice(instance.kind, [kind], `${p}.kind`);
        v.id(instance.instanceId, `${p}.instanceId`);
        v.id(instance.sourceId, `${p}.sourceId`);
        v.reference(
          context.catalog.effects,
          instance.definitionId,
          `${p}.definitionId`,
        );
        if (
          context.catalog.contentKinds[instance.definitionId as string] !== kind
        )
          v.invalid(`${p}.definitionId`, "Wrong effect kind");
        const target = v.id(instance.targetKey, `${p}.targetKey`);
        const allowed = [
          "battle",
          ...partyIds.flatMap((id) => [`party-member:${id}`, `die:${id}`]),
          ...enemyIds.flatMap((id) => [`enemy:${id}`, `intent:${id}`]),
          "resource:gold",
          "resource:bag-gold",
          "resource:hand-multiplier",
        ];
        if (!allowed.includes(target))
          v.invalid(`${p}.targetKey`, "Unknown effect target");
        v.number(instance.maxStacks, `${p}.maxStacks`, 1, 10000);
        v.number(
          instance.stacks,
          `${p}.stacks`,
          1,
          instance.maxStacks as number,
        );
        v.ids(instance.tags, `${p}.tags`, 64);
        if (instance.duration !== null) {
          const d = v.record(instance.duration, `${p}.duration`, [
            "scope",
            "remaining",
          ]);
          v.choice(d.scope, scopes, `${p}.duration.scope`);
          v.number(d.remaining, `${p}.duration.remaining`, 1, 10000);
        }
      });
    }
    validateLoadout(
      context,
      s.loadoutAtStart,
      `${path}.loadoutAtStart`,
      partyIds,
    );
    validateLoadout(context, s.loadout, `${path}.loadout`, partyIds);
    assertLoadoutConservation(
      s.loadoutAtStart as BattleLoadoutSnapshot,
      s.loadout as BattleLoadoutSnapshot,
    );
    for (const member of v.ids(s.lastTossed, `${path}.lastTossed`, 5))
      if (!partyIds.includes(member))
        v.invalid(`${path}.lastTossed`, "Unknown tossed member");
    v.list(s.log, `${path}.log`, 10000).forEach((raw, i) => {
      const p = `${path}.log[${i}]`,
        log = v.record(raw, p, ["round", "layer", "tone", "text"]);
      v.number(log.round, `${p}.round`, 0);
      v.number(log.layer, `${p}.layer`, 1, context.catalog.balance.MAX_LAYER);
      v.choice(
        log.tone,
        ["good", "bad", "gold", "purple", "system"],
        `${p}.tone`,
      );
      v.text(log.text, `${p}.text`);
    });
    v.list(s.facts, `${path}.facts`, 10000).forEach((fact, i) =>
      v.text(fact, `${path}.facts[${i}]`),
    );
    const mode = v.record(s.mode, `${path}.mode`),
      type = v.choice(
        mode.type,
        ["awaiting-roll", "player-turn", "enemy-turn", "greed", "finished"],
        `${path}.mode.type`,
      );
    v.record(
      mode,
      `${path}.mode`,
      type === "enemy-turn"
        ? ["type", "enemyOrder", "cursor", "closingHand", "outcome"]
        : ["type"],
    );
    if (type === "enemy-turn") {
      const order = v.ids(mode.enemyOrder, `${path}.mode.enemyOrder`, 256);
      for (const enemy of order)
        if (!enemyIds.includes(enemy))
          v.invalid(`${path}.mode.enemyOrder`, "Unknown queued enemy");
      v.number(mode.cursor, `${path}.mode.cursor`, 0, order.length);
      hand(mode.closingHand, `${path}.mode.closingHand`, partyIds);
      if (mode.outcome !== null)
        v.choice(
          mode.outcome,
          ["continue", "layer-cleared", "wipe"],
          `${path}.mode.outcome`,
        );
    }
    layerSettlement(
      s.lastLayerSettlement,
      `${path}.lastLayerSettlement`,
      context.catalog.balance.MAX_LAYER,
    );
    if (s.result !== null) {
      const r = v.record(s.result, `${path}.result`, [
        "wiped",
        "baseGold",
        "multiplier",
        "totalGold",
        "deepestLayer",
        "crystal",
      ]);
      v.boolean(r.wiped, `${path}.result.wiped`);
      v.boolean(r.crystal, `${path}.result.crystal`);
      v.number(r.baseGold, `${path}.result.baseGold`);
      v.number(r.totalGold, `${path}.result.totalGold`);
      v.number(r.multiplier, `${path}.result.multiplier`, 0, 1e9, false);
      v.number(
        r.deepestLayer,
        `${path}.result.deepestLayer`,
        1,
        context.catalog.balance.MAX_LAYER,
      );
      if (r.totalGold !== s.bagGold || r.deepestLayer !== s.deepestLayer)
        v.invalid(
          `${path}.result`,
          "Result disagrees with run",
          "invariant-violation",
        );
    }
    if (!checkpoint)
      v.list(
        s.undoStack,
        `${path}.undoStack`,
        v.DATA_LIMITS.checkpoints,
      ).forEach((raw, i) => {
        const p = `${path}.undoStack[${i}]`,
          entry = v.record(raw, p, ["action", "state"]);
        v.text(entry.action, `${p}.action`);
        validateOne(entry.state, `${p}.state`, true);
        if (
          v.canonicalJson((entry.state as BattleState).loadoutAtStart) !==
          v.canonicalJson(s.loadoutAtStart)
        )
          v.invalid(
            `${p}.state.loadoutAtStart`,
            "Checkpoint changed entrusted baseline",
          );
        const savedParty = (entry.state as BattleState).party.map((m) => m.id);
        if (savedParty.join("/") !== partyIds.join("/"))
          v.invalid(`${p}.state.party`, "Checkpoint changed formation");
      });
    const state = (checkpoint ? { ...s, undoStack: [] } : s) as BattleState;
    const violations = collectExpeditionInvariantViolations(
      { ...context, partyOrder: partyIds },
      state,
    );
    if (violations.length)
      v.invalid(
        `${path}.${violations[0].path}`,
        violations[0].message,
        "invariant-violation",
      );
  }
  validateOne(input, "$state", false);
  return structuredClone(input) as BattleState;
}

/** Old DTOs predate enemy definition IDs; only known exact templates can be adopted. */
export function annotateLegacyEnemies(
  context: BattleContext,
  input: BattleState,
): BattleState {
  const state = structuredClone(input);
  function annotate(s: Pick<BattleState, "enemies">): void {
    for (const enemy of s.enemies) {
      const definition = Object.values(context.catalog.enemies).find(
        (d) =>
          d.kind === enemy.kind &&
          d.name === enemy.name &&
          d.art === enemy.art &&
          d.hp === enemy.maxHp,
      );
      if (!definition)
        v.invalid(
          "enemies",
          "Legacy enemy has no matching definition",
          "unknown-content",
        );
      enemy.definitionId = definition.id;
    }
  }
  annotate(state);
  for (const checkpoint of state.undoStack) annotate(checkpoint.state);
  return state;
}
