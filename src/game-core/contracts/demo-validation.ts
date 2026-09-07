import * as v from "./validation";
import { validateDemoJourney } from "./demo-journey-validation";
import { sha256 } from "./sha256";
import { validateManorContent } from "./manor";
import type {
  DemoContent,
  DemoCatalog,
  DemoCatalogRef,
  ValidatedDemoCatalog,
} from "./demo";

const contentKeys = [
  "characters",
  "actions",
  "covenants",
  "growth",
  "equipment",
  "leaderId",
  "initialParty",
  "maxPartySize",
];
const table = (value: unknown, path: string) => {
  const result = v.record(value, path);
  v.list(Object.keys(result), path, 256).forEach((key) => v.id(key, path));
  return result;
};
function definition(value: unknown, key: string, fields: string[]) {
  const r = v.record(value, key, ["id", ...fields]);
  if (r.id !== key) v.invalid(key, "Definition identity mismatch");
  return r;
}
/** Draft modules can explicitly report unimplemented covenant references without becoming executable. */
export function validateDemoContent(
  raw: unknown,
  deferredCovenants: readonly string[] = [],
): DemoContent {
  v.assertJson(raw);
  const c = v.record(raw, "content", contentKeys);
  const chars = table(c.characters, "characters"),
    actions = table(c.actions, "actions"),
    covenants = table(c.covenants, "covenants"),
    growth = table(c.growth, "growth"),
    equipment = table(c.equipment, "equipment");
  for (const [key, value] of Object.entries(actions)) {
    const a = definition(value, key, ["kind"]);
    v.choice(
      a.kind,
      [
        "attack",
        "guard",
        "heal",
        "wild",
        "blank",
        "protect",
        "expensive-heal",
        "cleave-left",
        "cleave-right",
        "bind",
        "guard-all",
        "thread-strike",
      ],
      key,
    );
  }
  const faceIds = new Set<string>();
  for (const [key, value] of Object.entries(chars)) {
    const ch = definition(value, key, [
      "name",
      "maxHp",
      "faction",
      "suits",
      "faces",
      "covenantId",
      ...(Object.hasOwn(v.record(value, key), "release") ? ["release"] : []),
    ]);
    if (ch.release !== undefined) {
      const release = v.record(ch.release, key, ["kind", "deferredCovenantId", "reason"]);
      v.choice(release.kind, ["dossier-only"], key);
      v.id(release.deferredCovenantId, key); v.text(release.reason, key, 160);
      if (ch.covenantId !== null) v.invalid(key, "Deferred covenant is not executable");
    }
    v.text(ch.name, key, 160);
    v.number(ch.maxHp, key, 1, 100);
    v.choice(ch.faction, ["leader", "hero", "sovereign"], key);
    const suits = v.ids(ch.suits, key, 2);
    if (!suits.length) v.invalid(key, "At least one native suit required");
    suits.forEach((s) =>
      v.choice(s, ["earth", "light", "abyss", "beyond"], key),
    );
    const faces = v.list(ch.faces, key, 6);
    if (faces.length !== 6) v.invalid(key, "Exactly six faces required");
    faces.forEach((rawFace, i) => {
      const f = v.record(rawFace, key, [
        "id",
        "slot",
        "name",
        "pip",
        "fate",
        "suit",
        "quality",
        "rust",
        "actionId",
        "power",
      ]);
      const id = v.id(f.id, key);
      if (id !== `face.${key}.0${i + 1}` || f.slot !== i + 1 || faceIds.has(id))
        v.invalid(key, "Invalid face identity or slot");
      faceIds.add(id);
      v.text(f.name, id, 160);
      const pip = v.record(f.pip, id);
      if (pip.kind === "wild") {
        v.record(pip, id, ["kind"]);
        if (key !== c.leaderId || i !== 5)
          v.invalid(id, "Only leader face 6 may have wild pips");
      } else {
        v.record(pip, id, ["kind", "value"]);
        v.choice(pip.kind, ["natural"], id);
        if (v.number(pip.value, id, 1, 6) !== i + 1)
          v.invalid(id, "Native pip must match slot");
      }
      v.choice(f.fate, ["awake", "asleep"], id);
      v.choice(f.suit, suits, id);
      v.choice(f.quality, ["plain", "gild", "rust"], id);
      v.choice(f.rust, ["none", "removable", "permanent"], id);
      if ((f.quality === "rust") !== (f.rust !== "none"))
        v.invalid(id, "Rust provenance mismatch");
      v.reference(actions, f.actionId, id);
      v.number(f.power, id, 0, 100);
    });
    if (
      ch.covenantId !== null &&
      !deferredCovenants.includes(v.id(ch.covenantId, key))
    )
      v.reference(covenants, ch.covenantId, key);
  }
  for (const [key, value] of Object.entries(covenants)) {
    const c = definition(value, key, ["pattern", "effect", "stages"]);
    v.choice(c.pattern, ["flush", "triple", "straight", "two-pair-blank"], key);
    v.choice(
      c.effect,
      ["threat-damage", "healing", "execution-damage", "knives"],
      key,
    );
    const stages = v.list(c.stages, key, 2);
    if (stages.length !== 2) v.invalid(key, "Two covenant stages required");
    for (const raw of stages) {
      const s = v.record(raw, key, ["min", "max"]);
      const min = v.number(s.min, key, 1, 10);
      v.number(s.max, key, min, 10);
    }
  }
  for (const [key, value] of Object.entries(growth)) {
    const g = definition(value, key, ["ownerId", "level", "awaken", "gild"]);
    v.reference(chars, g.ownerId, key);
    v.choice(g.level, [2, 3], key);
    if (g.ownerId === c.leaderId || key !== `growth.${g.ownerId}.lv${g.level}`)
      v.invalid(key, "Invalid personal growth");
    for (const field of ["awaken", "gild"]) {
      const slots = v.list(g[field], key, 6).map((n) => v.number(n, key, 1, 6));
      if (
        new Set(slots).size !== slots.length ||
        (g.level === 3 && slots.length)
      )
        v.invalid(key, "Invalid growth faces");
      for (const slot of slots) {
        const face = (
          chars[g.ownerId as string] as DemoContent["characters"][string]
        ).faces[slot - 1];
        if (field === "gild" && face.rust !== "none")
          v.invalid(key, "Growth cannot overwrite inherent rust");
      }
    }
  }
  for (const [key, value] of Object.entries(equipment)) {
    const e = definition(value, key, ["slot", "replacement", "power", "scope"]);
    v.choice(key, ["equipment.spare-blade", "equipment.emergency-pouch"], key);
    v.choice(e.slot, ["general"], key);
    v.choice(e.replacement, ["attack", "heal"], key);
    v.choice(e.power, [1], key);
    v.choice(e.scope, ["all-native-blanks"], key);
    v.reference(actions, `action.${e.replacement}`, key);
  }
  v.reference(chars, c.leaderId, "leaderId");
  v.choice(c.maxPartySize, [5], "maxPartySize");
  const party = v.ids(c.initialParty, "initialParty", 5);
  if (!party.includes(c.leaderId as string))
    v.invalid("initialParty", "Leader required");
  party.forEach((id) => {
    const ch = v.reference(chars, id, "initialParty") as DemoContent["characters"][string];
    if (ch.release) v.invalid(id, "Dossier-only character cannot join party");
  });
  return v.freezeData(structuredClone(raw) as DemoContent);
}

export function validateDemoCatalog(
  raw: unknown,
  expected?: DemoCatalogRef,
): ValidatedDemoCatalog {
  return validateVersionedDemoCatalog(raw, 2, expected);
}
export function validateManorCatalog(raw: unknown, expected?: DemoCatalogRef): ValidatedDemoCatalog {
  return validateVersionedDemoCatalog(raw, 3, expected);
}
function validateVersionedDemoCatalog(raw: unknown, version: 2 | 3, expected?: DemoCatalogRef): ValidatedDemoCatalog {
  v.assertJson(raw);
  const c = v.record(raw, "catalog", [
    ...contentKeys,
    "catalogId",
    "contentVersion",
    "rulesVersion",
    "enemies",
    "encounters",
    "routes",
    "profiles",
    ...(version === 3 ? ["manor"] : []),
    ...(Object.hasOwn(v.record(raw, "catalog"), "journey") ? ["journey"] : []),
  ]);
  v.id(c.catalogId, "catalogId");
  v.number(c.contentVersion, "contentVersion", 1);
  v.choice(c.rulesVersion, [version], "rulesVersion");
  validateDemoContent(Object.fromEntries(contentKeys.map((k) => [k, c[k]])));
  const enemies = table(c.enemies, "enemies"),
    encounters = table(c.encounters, "encounters"),
    routes = table(c.routes, "routes");
  for (const [key, value] of Object.entries(enemies)) {
    const rawEnemy = v.record(value, key);
    const e = definition(value, key, ["hp", "attack", "bounty", "behavior", ...["name", "artId"].filter(k => Object.hasOwn(rawEnemy, k))]);
    if (e.name !== undefined) v.text(e.name, key, 100);
    if (e.artId !== undefined) v.id(e.artId, key);
    v.number(e.hp, key, 1, 10000);
    v.number(e.attack, key, 0, 100);
    v.number(e.bounty, key, 0, 10000);
    v.choice(e.behavior, ["attack", "charge", "seal", "idle", "repair", "butler", ...(version === 3 ? ["heiress"] : [])], key);
  }
  for (const [key, value] of Object.entries(encounters)) {
    const e = definition(value, key, ["enemyIds"]),
      slots = v.list(e.enemyIds, key, 20);
    if (!slots.length) v.invalid(key, "Empty encounter");
    slots.forEach((id) => v.reference(enemies, id, key));
  }
  for (const [key, value] of Object.entries(routes)) {
    const r = definition(value, key, ["layers"]),
      layers = v.list(r.layers, key, 5);
    if (!layers.length) v.invalid(key, "Empty route");
    for (const layer of layers) {
      const ids = v.list(layer, key, 20);
      if (!ids.length) v.invalid(key, "Empty layer");
      ids.forEach((id) => v.reference(c.journey ? v.record(v.record(c.journey, "journey").rooms, "rooms") : encounters, id, key));
    }
  }
  if (!Object.keys(routes).length)
    v.invalid("routes", "Executable Catalog needs a route");
  for (const [key, rawProfile] of Object.entries(
    table(c.profiles, "profiles"),
  )) {
    const p = definition(rawProfile, key, [
      "progress",
      "availableCharacterIds",
    ]);
    const ids = v.ids(p.availableCharacterIds, key, 6);
    ids.forEach((id) =>
      (() => {
        const ch = v.reference(c.characters as DemoContent["characters"], id, key);
        if (ch.release) v.invalid(key, "Dossier-only character in playable profile");
      })(),
    );
    if (!ids.includes(c.leaderId as string))
      v.invalid(key, "Profile needs leader");
    const progress = v.record(p.progress, key, [
      "appliedGrowthIds",
      "equipment",
    ]);
    const grants = v.ids(progress.appliedGrowthIds, key, 10);
    for (const id of grants) {
      const g = v.reference(c.growth as DemoContent["growth"], id, key);
      if (g.level === 3 && !grants.includes(`growth.${g.ownerId}.lv2`))
        v.invalid(key, "Level 3 requires level 2");
    }
    const instances = new Set<string>(),
      owners = new Set<string>();
    v.list(progress.equipment, key, 2).forEach((raw) => {
      const e = v.record(raw, key, ["instanceId", "definitionId", "ownerId"]),
        instance = v.id(e.instanceId, key),
        owner = v.choice(e.ownerId, ids, key);
      v.reference(c.equipment as Record<string, unknown>, e.definitionId, key);
      const ch = (c.characters as DemoContent["characters"])[owner];
      if (
        instances.has(instance) ||
        owners.has(owner) ||
        !ch.faces.some(
          (f) =>
            (c.actions as DemoContent["actions"])[f.actionId].kind === "blank",
        )
      )
        v.invalid(key, "Invalid equipment allocation");
      instances.add(instance);
      owners.add(owner);
    });
  }
  if (c.journey !== undefined) validateDemoJourney(raw as DemoCatalog);
  if (version === 3) validateManorContent(raw as DemoCatalog);
  const ref: DemoCatalogRef = {
    catalogId: c.catalogId as string,
    contentVersion: c.contentVersion as number,
    rulesVersion: version,
    digest: sha256(v.canonicalJson(raw)),
  };
  if (expected && v.canonicalJson(ref) !== v.canonicalJson(expected))
    v.invalid("contentRef", "Catalog identity differs", "content-mismatch");
  return v.freezeData({ data: structuredClone(raw) as DemoCatalog, ref });
}
