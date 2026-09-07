import type { RuleContext, RuleBattleState, RuleCheckpoint } from "../../domain/rule-state";
import { validateManorEncounter } from "../v3/manor";
import { validateMemoryEncounter } from "../v4/validation";
import type { ValidatedDemoCatalog } from "../../../contracts/demo";
import { demoEncounterId } from "../../../contracts/demo-journey-validation";
import { validateJourneyRun } from "./journey-validation";
import * as v from "../../../contracts/validation";
import type {
  DemoBattleCommand,
  DemoBattleState,
  DemoHand,
} from "../../domain/demo-state";
import { resolveDemoCharacter, validateDemoProgress } from "./configuration";
import { rankHand, HAND_BONUSES } from "../hand";

export function parseDemoBattleCommand(raw: unknown): DemoBattleCommand {
  v.assertJson(raw);
  const c = v.record(raw, "command");
  const type = v.choice(
    c.type,
    [
      "roll",
      "reroll",
      "toggle-load",
      "act",
      "end-turn",
      "resolve-next-enemy",
      "next-round",
      "undo",
    ],
    "command.type",
  );
  if (type === "toggle-load") {
    v.record(c, "command", ["type", "actorId"]);
    return { type, actorId: v.id(c.actorId, "actorId") };
  }
  if (type === "act") {
    v.record(c, "command", ["type", "actorId", "choice", "targetId"]);
    return {
      type,
      actorId: v.id(c.actorId, "actorId"),
      choice: v.choice(
        c.choice,
        ["attack", "guard", "heal", "bind", "guard-all"],
        "choice",
      ),
      targetId: c.targetId === null ? null : v.id(c.targetId, "targetId"),
    };
  }
  v.record(c, "command", ["type"]);
  return { type };
}
function validateHand(raw: unknown, partyIds: string[]): DemoHand | null {
  if (raw === null) return null;
  const h = v.record(raw, "hand", [
    "name",
    "bonus",
    "qualityModifier",
    "adjustedBonus",
    "dice",
    "contributors",
    "wildValue",
    "patterns",
    "hasBlank",
    "covenantOwnerIds",
  ]);
  v.choice(
    h.name,
    [
      "散牌",
      "一对",
      "两对",
      "三条",
      "小顺",
      "同花",
      "葫芦",
      "四条",
      "大顺",
      "快艇",
    ],
    "hand.name",
  );
  v.number(h.bonus, "hand.bonus", 0, 2, false);
  v.number(h.qualityModifier, "hand.quality", -0.5, 0.5, false);
  v.number(h.adjustedBonus, "hand.adjusted", 0, 2.5, false);
  if (h.wildValue !== null) v.number(h.wildValue, "hand.wild", 1, 6);
  v.boolean(h.hasBlank, "hand.hasBlank");
  const patterns = v.record(h.patterns, "patterns", [
    "flush",
    "triple",
    "straight",
    "twoPair",
    "fullHouse",
  ]);
  Object.values(patterns).forEach((n) => v.boolean(n, "pattern"));
  const owners: string[] = [];
  for (const raw of v.list(h.dice, "hand.dice", 5)) {
    const d = v.record(raw, "hand.die", [
      "ownerId",
      "faceId",
      "value",
      "suit",
      "quality",
    ]);
    const id = v.choice(d.ownerId, partyIds, "hand.owner");
    if (owners.includes(id)) v.invalid("hand", "Duplicate owner");
    owners.push(id);
    v.id(d.faceId, "hand.face");
    v.number(d.value, "hand.value", 1, 6);
    v.choice(d.suit, ["earth", "light", "abyss", "beyond"], "hand.suit");
    v.choice(d.quality, ["plain", "gild", "rust"], "hand.quality");
  }
  v.ids(h.contributors, "contributors", 5).forEach((id) =>
    v.choice(id, owners, "contributor"),
  );
  v.ids(h.covenantOwnerIds, "covenantOwners", 5).forEach((id) =>
    v.choice(id, partyIds, "covenantOwner"),
  );
  const hand = raw as DemoHand;
  const counts = new Map<number, number>();
  hand.dice.forEach((d) => counts.set(d.value, (counts.get(d.value) ?? 0) + 1));
  const frequencies = [...counts.values()];
  const expectedPatterns = {
    flush: ["earth", "light", "abyss", "beyond"].some(
      (s) => hand.dice.filter((d) => d.suit === s).length >= 4,
    ),
    triple: frequencies.some((n) => n >= 3),
    straight: [1, 2, 3].some((n) =>
      [0, 1, 2, 3].every((i) => counts.has(n + i)),
    ),
    twoPair:
      frequencies.filter((n) => n >= 2).length >= 2 ||
      frequencies.some((n) => n >= 4),
    fullHouse: frequencies.includes(3) && frequencies.includes(2),
  };
  if (v.canonicalJson(hand.patterns) !== v.canonicalJson(expectedPatterns))
    v.invalid("hand.patterns", "Patterns differ from dice snapshot");
  const used = hand.contributors.map((id) =>
    hand.dice.find((d) => d.ownerId === id)!,
  );
  const rank = rankHand(hand.dice.map((d) => d.value));
  const bonus = hand.name === "同花" ? 0.6 : HAND_BONUSES[hand.name];
  if (
    bonus !== hand.bonus ||
    bonus !== Math.max(rank.bonus, hand.patterns.flush ? 0.6 : 0)
  )
    v.invalid("hand.bonus", "Hand is not the highest base rank");
  if (
    hand.name === "同花"
      ? used.length !== 4 || new Set(used.map((d) => d.suit)).size !== 1
      : v.canonicalJson(used.map((d) => d.value).sort()) !==
        v.canonicalJson(rank.used.sort())
  )
    v.invalid("hand.contributors", "Contributors differ from rank");
  const quality =
    used.reduce(
      (n, d) => n + (d.quality === "gild" ? 1 : d.quality === "rust" ? -1 : 0),
      0,
    ) / 10;
  if (
    hand.qualityModifier !== quality ||
    hand.adjustedBonus !==
      (bonus ? Math.max(0, Math.round((bonus + quality) * 100) / 100) : 0)
  )
    v.invalid("hand.quality", "Quality accounting differs");
  return raw as DemoHand;
}
function validateRun(catalog: RuleContext, raw: unknown) {
    const r = v.record(raw, "run", [
      "id",
      "routeId",
      "contentRef",
      "progress",
      "party",
      "layer",
      "room",
      "encounterSequence",
      "looseGold",
      "handBonus",
      "bankedGold",
      "completedEncounterIds",
      "settledLayers",
      "rng",
      "sequence", "roomIds", "completedRoomIds", "supplies", "foodUses", "layerResults", "eventResults", "revealed", "eventRng",
    ]);
    const runId = v.id(r.id, "run.id");
    if (v.canonicalJson(r.contentRef) !== v.canonicalJson(catalog.ref))
      v.invalid("run.contentRef", "Frozen content differs", "content-mismatch");
    const route = v.reference(catalog.data.routes, r.routeId, "routeId");
    const layer = v.number(r.layer, "layer", 1, route.layers.length),
      room = v.number(r.room, "room", 0, route.layers[layer - 1].length - 1);
    v.number(r.encounterSequence, "encounterSequence", 1);
    v.number(r.sequence, "sequence");
    for (const key of ["looseGold", "bankedGold"])
      v.number(r[key], key, 0, 1e9);
    v.number(r.handBonus, "handBonus", 0, 1e6, false);
    const completed = v.ids(r.completedEncounterIds, "completedEncounters");
    if (completed.some((id) => !id.startsWith(`${runId}:encounter:`)))
      v.invalid("completedEncounters", "Encounter outside run");
    const layers = v
      .list(r.settledLayers, "settledLayers", 5)
      .map((n) => v.number(n, "settledLayer", 1, layer));
    if (new Set(layers).size !== layers.length)
      v.invalid("settledLayers", "Duplicate layer settlement");
    const rng = v.record(r.rng, "rng", ["combat", "loot", "flavor"]);
    for (const stream of Object.values(rng)) {
      const x = v.record(stream, "rng.stream", ["algorithm", "seed", "cursor"]);
      v.choice(x.algorithm, ["mulberry32"], "algorithm");
      v.number(x.seed, "seed", 0, 0xffffffff);
      v.number(x.cursor, "cursor");
    }
    const progress = validateDemoProgress(catalog.data, r.progress),
      partyIds: string[] = [];
    for (const rawMember of v.list(r.party, "party", 5)) {
      const m = v.record(rawMember, "member", [
          "id",
          "config",
          "hp",
          "temporaryRust",
          "pendingSeal",
          "rainyReturn",
        ]),
        id = v.id(m.id, "member.id");
      if (partyIds.includes(id)) v.invalid("party", "Duplicate member");
      partyIds.push(id);
      const expected = resolveDemoCharacter(catalog.data, progress, id);
      if (v.canonicalJson(m.config) !== v.canonicalJson(expected))
        v.invalid(
          "member.config",
          "Frozen configuration differs",
          "configuration-mismatch",
        );
      v.number(m.hp, "hp", 0, expected.maxHp);
      v.boolean(m.pendingSeal, "pendingSeal");
      v.boolean(m.rainyReturn, "rainyReturn");
      for (const faceId of v.ids(m.temporaryRust, "temporaryRust", 6))
        if (
          !expected.faces.some((f) => f.id === faceId && f.quality !== "rust")
        )
          v.invalid("temporaryRust", "Invalid degradation face");
    }
    if (!partyIds.includes(catalog.data.leaderId))
      v.invalid("party", "Leader required");
    validateJourneyRun(catalog, r);
    return {r, runId, route, layer, room, partyIds, completed};
}
export function validateRuleRunState(catalog: RuleContext, raw: unknown): RuleBattleState["run"] {
  v.assertJson(raw); validateRun(catalog, raw);
  return structuredClone(raw) as RuleBattleState["run"];
}

export function validateRuleBattleState(
  catalog: RuleContext,
  raw: unknown,
): RuleBattleState {
  v.assertJson(raw);
  const s = v.record(raw, "state", ["run", "encounter", "undo"]);
  function checkpoint(raw: unknown): RuleCheckpoint {
    const c = v.record(raw, "checkpoint", ["run", "encounter"]);
    const {r, runId, route, layer, room, partyIds, completed} = validateRun(catalog, c.run);
    const memory = catalog.data.rulesVersion === 4 && route.id === catalog.data.combat.memory.routeId;
    const e = v.record(c.encounter, "encounter", [
      "id",
      "definitionId",
      "round",
      "phase",
      "outcome",
      "dice",
      "enemies",
      "formation",
      "enemyOrder",
      "cursor",
      "hand",
      "rerolls",
      "guardBonusIds", "itemsUsed", "extraRerolls",
      ...(memory ? ["memory"] : catalog.ref.rulesVersion >= 3 ? ["manor"] : []),
    ]);
    const encounterId = v.id(e.id, "encounter.id");
    if (!encounterId.startsWith(`${runId}:encounter:`))
      v.invalid("encounter.id", "Wrong run identity");
    if (e.definitionId !== demoEncounterId(catalog.data, route.id, layer, room))
      v.invalid("encounter.definitionId", "Wrong route position");
    v.number(e.round, "round", 1);
    v.choice(e.phase, ["roll", "act", "enemy", "complete"], "phase");
    if (e.outcome !== null) v.choice(e.outcome, ["victory", "wipe"], "outcome");
    if (
      (e.phase === "complete") !== (e.outcome !== null) ||
      completed.includes(encounterId) !== (e.phase === "complete")
    )
      v.invalid("outcome", "Outcome/lifecycle mismatch");
    v.number(e.itemsUsed, "itemsUsed", 0, 2);
    const extra = v.number(e.extraRerolls, "extraRerolls", 0, catalog.data.journey?.items["item.lucky-charm"].capacity ?? 0);
    v.number(e.rerolls, "rerolls", 0, 2 + extra);
    const dice = v.list(e.dice, "dice", 5);
    if (dice.length !== partyIds.length)
      v.invalid("dice", "One die per member required");
    dice.forEach((rawDie, i) => {
      const d = v.record(rawDie, "die", [
        "ownerId",
        "faceIndex",
        "loaded",
        "spent",
        "sealed",
      ]);
      if (d.ownerId !== partyIds[i])
        v.invalid("dice", "Stable party order required");
      if (d.faceIndex !== null) v.number(d.faceIndex, "faceIndex", 0, 5);
      for (const field of ["loaded", "spent", "sealed"])
        v.boolean(d[field], field);
      if ((d.loaded || d.spent) && d.faceIndex === null)
        v.invalid("die", "Unrolled die cannot be used");
      if (
        e.phase === "act" &&
        !d.sealed &&
        (r.party as { hp: number }[])[i].hp > 0 &&
        d.faceIndex === null
      )
        v.invalid("die", "Living unsealed die must have rolled");
    });
    const enemyIds: string[] = [],
      aliveIds: string[] = [];
    for (const rawEnemy of v.list(e.enemies, "enemies", 20)) {
      const enemy = v.record(rawEnemy, "enemy", [
        "id",
        "definitionId",
        "hp",
        "chargeReady",
        "threaded",
        "escaped",
        "boundRound",
        "intent",
        ...(catalog.ref.rulesVersion >= 3 ? ["origin", "disposition"] : []),
      ]);
      const id = v.id(enemy.id, "enemy.id");
      if (enemyIds.includes(id) || !id.startsWith(`${encounterId}:enemy:`))
        v.invalid("enemy.id", "Invalid enemy identity");
      enemyIds.push(id);
      const def = v.reference(
        catalog.data.enemies,
        enemy.definitionId,
        "enemy.definition",
      );
      v.number(enemy.hp, "enemy.hp", 0, def.hp);
      for (const key of ["chargeReady", "threaded", "escaped"])
        v.boolean(enemy[key], key);
      if (enemy.boundRound !== null && enemy.boundRound !== e.round)
        v.invalid("boundRound", "Stun belongs to current round");
      if (
        enemy.hp === 0 &&
        (enemy.intent !== null || enemy.threaded || enemy.boundRound !== null)
      )
        v.invalid("enemy", "Dead enemy retains active effects");
      if ((enemy.hp as number) > 0 && enemy.disposition !== "released") aliveIds.push(id);
      if (enemy.intent !== null) {
        const intent = v.record(enemy.intent, "intent", [
          "kind",
          "targetId",
          "value",
          "blocked",
          ...(catalog.ref.rulesVersion >= 3 ? ["id", ...(Object.hasOwn(v.record(enemy.intent, "intent"), "formula") ? ["formula"] : [])] : []),
          ...(memory && Object.hasOwn(v.record(enemy.intent, "intent"), "operation") ? ["operation"] : []),
        ]);
        v.choice(
          intent.kind,
          ["attack", "charge", "seal", "idle", "repair", ...(catalog.ref.rulesVersion >= 3 ? ["summon"] : [])],
          "intent.kind",
        );
        v.number(intent.value, "intent.value", 0, 100);
        v.number(intent.blocked, "intent.blocked", 0, 10000);
        if (intent.targetId !== null)
          v.choice(intent.targetId, intent.kind === "repair" ? (e.enemies as {id: string}[]).map(x => x.id) : partyIds, "intent.target");
        if (
          ["attack", "seal"].includes(intent.kind as string) &&
          intent.targetId === null
        )
          v.invalid("intent", "Target required");
      }
    }
    if (!enemyIds.length) v.invalid("enemies", "No encounter entities");
    const expectedEnemies =
      catalog.data.encounters[e.definitionId as string].enemyIds;
    if (
      catalog.ref.rulesVersion === 2 && v.canonicalJson(
        (e.enemies as { definitionId: string }[]).map((x) => x.definitionId),
      ) !== v.canonicalJson(expectedEnemies)
    )
      v.invalid("enemies", "Unexpected encounter composition");
    const formation = v.ids(e.formation, "formation", 20);
    if (
      v.canonicalJson([...formation].sort()) !==
      v.canonicalJson(aliveIds.sort())
    )
      v.invalid(
        "formation",
        "Formation must contain exactly the living enemies",
      );
    const order = v.ids(e.enemyOrder, "enemyOrder", 20);
    order.forEach((id) => v.choice(id, enemyIds, "enemyOrder"));
    v.number(e.cursor, "cursor", 0, order.length);
    v.ids(e.guardBonusIds, "guardBonusIds", 5).forEach((id) =>
      v.choice(id, partyIds, "guardBonus"),
    );
    const hand = validateHand(e.hand, partyIds);
    if (
      (e.phase === "roll" || e.phase === "act") &&
      (hand !== null || order.length || e.cursor !== 0)
    )
      v.invalid("phase", "Player phase retains closing state");
    if (
      e.phase === "roll" &&
      (e.dice as { faceIndex: number | null }[]).some(
        (d) => d.faceIndex !== null,
      )
    )
      v.invalid("dice", "Roll phase retains previous faces");
    if (hand)
      for (const d of hand.dice) {
        const member = (r.party as DemoBattleState["run"]["party"]).find(
          (m) => m.id === d.ownerId,
        )!;
        const face = member.config.faces.find((f) => f.id === d.faceId);
        if (
          !face ||
          face.fate !== "awake" ||
          face.suit !== d.suit ||
          (face.pip.kind === "natural"
            ? face.pip.value !== d.value
            : hand.wildValue !== d.value)
        )
          v.invalid("hand.die", "Face definition differs");
        if (
          d.quality !== face.quality &&
          !(d.quality === "rust" && member.temporaryRust.includes(face.id))
        )
          v.invalid("hand.quality", "Invalid historical face quality");
      }
    if (
      hand &&
      (hand.wildValue !== null) !==
        hand.dice.some((d) =>
          (r.party as DemoBattleState["run"]["party"])
            .find((m) => m.id === d.ownerId)!
            .config.faces.some(
              (f) => f.id === d.faceId && f.pip.kind === "wild",
            ),
        )
    )
      v.invalid("hand.wildValue", "Wild assignment has no matching face");
    if (
      e.phase !== "complete" &&
      !(r.party as { hp: number }[]).some((m) => m.hp > 0)
    )
      v.invalid("phase", "Wipe must be complete");
    if (e.phase === "enemy" && e.hand === null)
      v.invalid("hand", "Enemy phase requires closing snapshot");
    if (e.outcome === "victory" && aliveIds.length)
      v.invalid("outcome", "Victory with living enemies");
    if (
      e.outcome === "wipe" &&
      (r.party as { hp: number }[]).some((m) => m.hp > 0)
    )
      v.invalid("outcome", "Wipe with living party");
    if (memory) validateMemoryEncounter(catalog, c as unknown as RuleCheckpoint);
    else if (catalog.ref.rulesVersion >= 3) validateManorEncounter(catalog, c as unknown as RuleCheckpoint);
    return c as unknown as RuleCheckpoint;
  }
  checkpoint({ run: s.run, encounter: s.encounter });
  for (const raw of v.list(s.undo, "undo", 256)) {
    const cp = checkpoint(raw);
    if (
      cp.run.id !== (s.run as { id: string }).id ||
      cp.encounter.id !== (s.encounter as { id: string }).id ||
      cp.encounter.phase !== "act"
    )
      v.invalid("undo", "Checkpoint outside current encounter");
    if (catalog.ref.rulesVersion === 4) {
      const current = s.run as RuleBattleState["run"];
      if (cp.encounter.memory?.defeated || cp.run.contentRef.digest !== current.contentRef.digest || cp.run.routeId !== current.routeId || v.canonicalJson(cp.run.progress) !== v.canonicalJson(current.progress) || cp.run.rng.combat.seed !== current.rng.combat.seed || cp.encounter.round !== (s.encounter as RuleBattleState["encounter"]).round) v.invalid("undo", "Foreign configuration, seed or closed action checkpoint");
    }
  }
  return structuredClone(raw) as RuleBattleState;
}

export function validateDemoRunState(catalog: ValidatedDemoCatalog, raw: unknown): DemoBattleState["run"] {
  v.choice(catalog.ref.rulesVersion, [2, 3], "rulesVersion");
  return validateRuleRunState(catalog, raw) as DemoBattleState["run"];
}
export function validateDemoBattleState(catalog: ValidatedDemoCatalog, raw: unknown): DemoBattleState {
  v.choice(catalog.ref.rulesVersion, [2, 3], "rulesVersion");
  return validateRuleBattleState(catalog, raw) as DemoBattleState;
}
