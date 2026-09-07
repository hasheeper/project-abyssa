import type { BattleCatalog, CatalogRef } from "./catalog";
import * as v from "./validation";
import { sha256 } from "./sha256";

export type ValidatedCatalog = {
  readonly data: BattleCatalog;
  readonly ref: CatalogRef;
};

function entries(value: unknown, path: string): [string, unknown][] {
  const result = Object.entries(v.record(value, path));
  if (result.length > v.DATA_LIMITS.collection)
    v.invalid(path, "Too many definitions");
  result.forEach(([key]) => v.id(key, path));
  return result;
}

export function validateCatalog(
  input: unknown,
  expectedRef?: CatalogRef,
): ValidatedCatalog {
  v.assertJson(input);
  const c = v.record(input, "$catalog", [
    "catalogId",
    "contentVersion",
    "rulesVersion",
    "characters",
    "defaultParty",
    "leaderId",
    "maxPartySize",
    "balance",
    "enemies",
    "encounters",
    "routes",
    "defaultRouteId",
    "summonEnemyId",
    "effects",
    "actionEffects",
    "contentKinds",
    "frenzyWarningId",
    "frenzyActiveId",
  ]);
  v.id(c.catalogId, "catalogId");
  v.number(c.contentVersion, "contentVersion", 1);
  if (c.rulesVersion !== 1)
    v.invalid("rulesVersion", "Unsupported rules", "unsupported-rules");
  v.number(c.maxPartySize, "maxPartySize", 1, 5);
  const balance = v.record(c.balance, "balance", [
    "MAX_HP",
    "DOWNED_RETURN_HP",
    "MAX_LAYER",
    "REROLLS_PER_ROUND",
    "LAYER_MULTIPLIERS",
    "STALL_GRACE_ROUNDS",
    "FRENZY_ATTACK_BONUS",
  ]);
  v.number(balance.MAX_HP, "balance.MAX_HP", 1, 1000);
  v.number(
    balance.DOWNED_RETURN_HP,
    "balance.DOWNED_RETURN_HP",
    1,
    balance.MAX_HP as number,
  );
  v.number(balance.MAX_LAYER, "balance.MAX_LAYER", 1, 100);
  for (const key of [
    "REROLLS_PER_ROUND",
    "STALL_GRACE_ROUNDS",
    "FRENZY_ATTACK_BONUS",
  ])
    v.number(balance[key], `balance.${key}`, 0, 100);
  const multipliers = v.list(
    balance.LAYER_MULTIPLIERS,
    "balance.LAYER_MULTIPLIERS",
    100,
  );
  if (multipliers.length !== balance.MAX_LAYER)
    v.invalid("balance.LAYER_MULTIPLIERS", "One multiplier per layer required");
  multipliers.forEach((n, i) =>
    v.number(n, `balance.LAYER_MULTIPLIERS[${i}]`, 0, 1000, false),
  );

  const characters = v.record(c.characters, "characters");
  const effects = v.record(c.effects, "effects");
  const actions = v.record(c.actionEffects, "actionEffects");
  const kinds = v.record(c.contentKinds, "contentKinds");
  for (const [key, raw] of entries(characters, "characters")) {
    const path = `characters.${key}`,
      character = v.record(raw, path, ["id", "name", "faces"]);
    if (character.id !== key)
      v.invalid(`${path}.id`, "Definition key differs from ID");
    v.text(character.name, `${path}.name`, 160);
    const faces = v.list(character.faces, `${path}.faces`, 6);
    if (faces.length !== 6)
      v.invalid(`${path}.faces`, "Exactly six faces required");
    faces.forEach((rawFace, i) => {
      const p = `${path}.faces[${i}]`,
        face = v.record(
          rawFace,
          p,
          ["verb", "power", "pip", "label", "quality"],
          ["wildPip", "effectDefinitionIds"],
        );
      v.choice(
        face.verb,
        ["attack", "guard", "heal", "coin", "wild", "blank"],
        `${p}.verb`,
      );
      v.number(face.power, `${p}.power`, 0, 1000);
      v.number(face.pip, `${p}.pip`, 1, 6);
      v.text(face.label, `${p}.label`, 160);
      v.choice(face.quality, ["plain", "rust", "gild", "none"], `${p}.quality`);
      if (face.wildPip !== undefined) v.boolean(face.wildPip, `${p}.wildPip`);
      if (face.effectDefinitionIds !== undefined)
        for (const effect of v.ids(
          face.effectDefinitionIds,
          `${p}.effectDefinitionIds`,
          16,
        ))
          v.reference(actions, effect, `${p}.effectDefinitionIds`);
    });
  }
  v.reference(characters, c.leaderId, "leaderId");
  const party = v.ids(c.defaultParty, "defaultParty", c.maxPartySize as number);
  if (!party.length || !party.includes(c.leaderId as string))
    v.invalid("defaultParty", "Leader required");
  party.forEach((member) => v.reference(characters, member, "defaultParty"));

  for (const [key, raw] of entries(c.enemies, "enemies")) {
    const p = `enemies.${key}`,
      enemy = v.record(
        raw,
        p,
        ["id", "kind", "name", "art", "hp"],
        ["attack", "chargeReady", "countdown"],
      );
    if (enemy.id !== key)
      v.invalid(`${p}.id`, "Definition key differs from ID");
    v.choice(
      enemy.kind,
      ["brute", "charger", "anomaly", "trap", "summoner"],
      `${p}.kind`,
    );
    v.choice(enemy.art, ["sentinel", "amalgam", "choir"], `${p}.art`);
    v.text(enemy.name, `${p}.name`, 160);
    v.number(enemy.hp, `${p}.hp`, 1, 10000);
    for (const field of ["attack", "countdown"])
      if (enemy[field] !== undefined)
        v.number(enemy[field], `${p}.${field}`, 0, 10000);
    if (enemy.chargeReady !== undefined)
      v.boolean(enemy.chargeReady, `${p}.chargeReady`);
  }
  const enemies = c.enemies as Record<string, unknown>;
  v.reference(enemies, c.summonEnemyId, "summonEnemyId");
  for (const [key, raw] of entries(c.encounters, "encounters")) {
    const p = `encounters.${key}`,
      encounter = v.record(raw, p, ["id", "slots"]);
    if (encounter.id !== key)
      v.invalid(`${p}.id`, "Definition key differs from ID");
    const slots = v.list(encounter.slots, `${p}.slots`, 20);
    if (!slots.length)
      v.invalid(`${p}.slots`, "Encounter must contain enemies");
    slots.forEach((rawSlot, i) => {
      const choices = v.ids(rawSlot, `${p}.slots[${i}]`, 20);
      if (!choices.length) v.invalid(`${p}.slots[${i}]`, "Empty slot");
      choices.forEach((enemy) =>
        v.reference(enemies, enemy, `${p}.slots[${i}]`),
      );
    });
  }
  for (const [key, raw] of entries(c.routes, "routes")) {
    const p = `routes.${key}`,
      route = v.record(raw, p, ["id", "name", "encounters"]);
    if (route.id !== key)
      v.invalid(`${p}.id`, "Definition key differs from ID");
    v.text(route.name, `${p}.name`, 160);
    const order = v.list(route.encounters, `${p}.encounters`, 100);
    if (order.length !== balance.MAX_LAYER)
      v.invalid(`${p}.encounters`, "Route length must match rules balance");
    order.forEach((encounter) =>
      v.reference(
        c.encounters as Record<string, unknown>,
        encounter,
        `${p}.encounters`,
      ),
    );
  }
  v.reference(
    c.routes as Record<string, unknown>,
    c.defaultRouteId,
    "defaultRouteId",
  );
  for (const [key, raw] of entries(effects, "effects")) {
    const p = `effects.${key}`,
      effect = v.record(raw, p, ["definitionId", "modifiers", "reactions"]);
    if (effect.definitionId !== key)
      v.invalid(`${p}.definitionId`, "Definition key differs from ID");
    v.choice(
      v.reference(kinds, key, `${p}.kind`),
      ["item", "equipment", "trait", "status", "encounter-rule", "action"],
      `${p}.kind`,
    );
    v.list(effect.modifiers, `${p}.modifiers`, 32).forEach((rawModifier, i) => {
      const mp = `${p}.modifiers[${i}]`,
        modifier = v.record(
          rawModifier,
          mp,
          [
            "priority",
            "window",
            "operation",
            "value",
            "requiredTags",
            "targetKinds",
          ],
          ["redirectTarget"],
        );
      v.number(modifier.priority, `${mp}.priority`, -1000, 1000);
      v.choice(
        modifier.window,
        ["before-damage", "before-heal"],
        `${mp}.window`,
      );
      v.choice(
        modifier.operation,
        ["add", "multiply", "reduce", "prevent", "pierce", "redirect"],
        `${mp}.operation`,
      );
      v.number(modifier.value, `${mp}.value`, -1000, 1000, false);
      v.ids(modifier.requiredTags, `${mp}.requiredTags`, 32);
      v.list(modifier.targetKinds, `${mp}.targetKinds`, 2).forEach((k) =>
        v.choice(k, ["party-member", "enemy"], `${mp}.targetKinds`),
      );
      if (modifier.redirectTarget !== undefined) {
        const target = v.record(
          modifier.redirectTarget,
          `${mp}.redirectTarget`,
          ["kind", "id"],
        );
        v.choice(
          target.kind,
          ["party-member", "enemy"],
          `${mp}.redirectTarget.kind`,
        );
        v.id(target.id, `${mp}.redirectTarget.id`);
        if (target.kind === "party-member")
          v.reference(characters, target.id, `${mp}.redirectTarget.id`);
      }
    });
    // Rules v1 has no built-in reaction handlers. Test-only resolver registries stay outside Catalogs.
    if (v.list(effect.reactions, `${p}.reactions`, 32).length)
      v.invalid(
        `${p}.reactions`,
        "No registered reaction handler for rules v1",
        "unknown-content",
      );
  }
  for (const [key, raw] of entries(actions, "actionEffects")) {
    const p = `actionEffects.${key}`,
      action = v.record(raw, p, ["definitionId", "trigger", "effect"]);
    if (action.definitionId !== key)
      v.invalid(`${p}.definitionId`, "Definition key differs from ID");
    v.reference(effects, key, p);
    if (kinds[key] !== "action") v.invalid(p, "Expected action kind");
    v.choice(action.trigger, ["heal"], `${p}.trigger`);
    const effect = v.record(action.effect, `${p}.effect`, [
      "type",
      "resource",
      "amount",
      "reason",
      "log",
      "fact",
    ]);
    v.choice(effect.type, ["resource-cost"], `${p}.effect.type`);
    v.choice(
      effect.resource,
      ["gold", "bag-gold", "hand-multiplier"],
      `${p}.effect.resource`,
    );
    v.number(effect.amount, `${p}.effect.amount`, 0, 1_000_000);
    v.choice(
      effect.reason,
      [
        "steal",
        "bounty",
        "healing-cost",
        "enemy-effect",
        "settlement",
        "effect",
      ],
      `${p}.effect.reason`,
    );
    v.text(effect.log, `${p}.effect.log`);
    if (effect.fact !== null) v.text(effect.fact, `${p}.effect.fact`);
  }
  for (const [key] of entries(kinds, "contentKinds"))
    v.reference(effects, key, `contentKinds.${key}`);
  for (const key of ["frenzyWarningId", "frenzyActiveId"]) {
    v.reference(effects, c[key], key);
    if (kinds[c[key] as string] !== "status")
      v.invalid(key, "Expected status definition");
  }
  if (c.frenzyWarningId === c.frenzyActiveId)
    v.invalid("frenzyActiveId", "Warning and active status must differ");
  const data = structuredClone(input) as BattleCatalog;
  const ref: CatalogRef = {
    catalogId: data.catalogId,
    contentVersion: data.contentVersion,
    rulesVersion: 1,
    digest: sha256(v.canonicalJson(data)),
  };
  if (expectedRef && v.canonicalJson(ref) !== v.canonicalJson(expectedRef))
    v.invalid(
      "catalog",
      "Content identity does not match release manifest",
      "content-mismatch",
    );
  return v.freezeData({ data, ref });
}
