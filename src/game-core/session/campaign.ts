import type { ValidatedCatalog } from "../contracts/catalog-validation";
import type { BattleContext } from "../contracts/catalog";
import * as v from "../contracts/validation";
import { validateLoadout } from "../battle/persistence/validate";
import { createBattleEngine } from "../battle/engine";
import type { CampaignState, GameSnapshot } from "./state";
import { fromExecutionState, activeExecution } from "./projection";

const context = (catalog: ValidatedCatalog): BattleContext => ({
  catalog: catalog.data,
  partyOrder: Object.keys(catalog.data.characters),
  routeId: catalog.data.defaultRouteId,
});

export function validateCampaign(
  input: unknown,
  catalog: ValidatedCatalog,
): CampaignState {
  v.assertJson(input);
  const c = v.record(input, "campaign", [
    "clock",
    "funds",
    "availableCharacterIds",
    "inventory",
    "traits",
    "activeExpeditionId",
    "appliedSettlements",
  ]);
  const clock = v.record(c.clock, "campaign.clock", ["day", "phase"]);
  v.number(clock.day, "campaign.clock.day", 1);
  v.choice(
    clock.phase,
    ["dawn", "day", "dusk", "night"],
    "campaign.clock.phase",
  );
  const funds = v.record(c.funds, "campaign.funds", [
    "public",
    "party",
    "crystals",
  ]);
  for (const key of ["public", "party", "crystals"])
    v.number(funds[key], `campaign.funds.${key}`);
  const available = v.ids(
    c.availableCharacterIds,
    "campaign.availableCharacterIds",
    256,
  );
  available.forEach((id) =>
    v.reference(catalog.data.characters, id, "campaign.availableCharacterIds"),
  );
  const inventory = v.record(c.inventory, "campaign.inventory", [
    "capacity",
    "items",
    "equipment",
  ]);
  v.number(inventory.capacity, "campaign.inventory.capacity", 0, 256);
  const loadout = validateLoadout(
    context(catalog),
    {
      items: inventory.items,
      equipment: inventory.equipment,
      traits: c.traits,
    },
    "campaign.inventory",
  );
  if (
    loadout.items.length + loadout.equipment.length >
    (inventory.capacity as number)
  )
    v.invalid("campaign.inventory", "Inventory capacity exceeded");
  if (c.activeExpeditionId !== null)
    v.id(c.activeExpeditionId, "campaign.activeExpeditionId");
  const settlements = v.list(
    c.appliedSettlements,
    "campaign.appliedSettlements",
  );
  const ids = new Set<string>(),
    expeditions = new Set<string>();
  for (const raw of settlements) {
    const entry = v.record(raw, "campaign.appliedSettlements[]", [
      "id",
      "expeditionId",
      "result",
    ]);
    const id = v.id(entry.id, "settlement.id"),
      exp = v.id(entry.expeditionId, "settlement.expeditionId");
    if (ids.has(id) || expeditions.has(exp))
      v.invalid("campaign.appliedSettlements", "Duplicate settlement");
    ids.add(id);
    expeditions.add(exp);
    const r = v.record(entry.result, "settlement.result", [
      "wiped",
      "baseGold",
      "multiplier",
      "totalGold",
      "deepestLayer",
      "crystal",
    ]);
    v.boolean(r.wiped, "settlement.result.wiped");
    v.boolean(r.crystal, "settlement.result.crystal");
    for (const key of ["baseGold", "totalGold"])
      v.number(r[key], `settlement.result.${key}`);
    v.number(r.multiplier, "settlement.result.multiplier", 0, 1e9, false);
    v.number(
      r.deepestLayer,
      "settlement.result.deepestLayer",
      1,
      catalog.data.balance.MAX_LAYER,
    );
  }
  return structuredClone(input) as CampaignState;
}

export function createCampaign(
  catalog: ValidatedCatalog,
  input: unknown = {},
): GameSnapshot {
  v.assertJson(input);
  const initial = v.record(
    input,
    "initial",
    [],
    ["funds", "clock", "availableCharacterIds", "inventory", "traits"],
  );
  const campaign = validateCampaign(
    {
      clock: initial.clock ?? { day: 1, phase: "dawn" },
      funds: initial.funds ?? { public: 0, party: 0, crystals: 0 },
      availableCharacterIds: initial.availableCharacterIds ?? [
        ...catalog.data.defaultParty,
      ],
      inventory: initial.inventory ?? {
        capacity: 32,
        items: [],
        equipment: [],
      },
      traits: initial.traits ?? [],
      activeExpeditionId: null,
      appliedSettlements: [],
    },
    catalog,
  );
  return { campaign, expedition: null, encounter: null };
}

export type ExpeditionStart = {
  expeditionId: string;
  routeId: string;
  partyIds: string[];
  itemIds: string[];
  equipmentIds: string[];
  seed: number;
};
export function startExpedition(
  snapshot: GameSnapshot,
  catalog: ValidatedCatalog,
  input: ExpeditionStart,
): GameSnapshot {
  if (snapshot.expedition || snapshot.campaign.activeExpeditionId)
    v.invalid(
      "expedition",
      "Another expedition is active",
      "expedition-active",
    );
  if (
    snapshot.campaign.appliedSettlements.some(
      (s) => s.expeditionId === input.expeditionId,
    )
  )
    v.invalid(
      "expeditionId",
      "Expedition identity already used",
      "expedition-id-reused",
    );
  v.id(input.expeditionId, "expeditionId");
  const partyIds = v.ids(input.partyIds, "partyIds", catalog.data.maxPartySize);
  for (const id of partyIds)
    if (!snapshot.campaign.availableCharacterIds.includes(id))
      v.invalid(
        "partyIds",
        "Character is unavailable",
        "unavailable-character",
      );
  const itemIds = v.ids(input.itemIds, "itemIds", 256),
    equipmentIds = v.ids(input.equipmentIds, "equipmentIds", 256);
  const items = itemIds.map(
    (id) =>
      snapshot.campaign.inventory.items.find((i) => i.instanceId === id) ??
      v.invalid("itemIds", "Item not in home inventory", "missing-item"),
  );
  const equipment = equipmentIds.map(
    (id) =>
      snapshot.campaign.inventory.equipment.find((i) => i.instanceId === id) ??
      v.invalid(
        "equipmentIds",
        "Equipment not in home inventory",
        "missing-item",
      ),
  );
  const loadout = {
    items,
    equipment,
    traits: snapshot.campaign.traits.filter((t) =>
      partyIds.includes(t.ownerId),
    ),
  };
  const engine = createBattleEngine(catalog, input.routeId),
    state = engine.create({ seed: input.seed, partyIds, loadout });
  const next = structuredClone(snapshot);
  next.campaign.inventory.items = next.campaign.inventory.items.filter(
    (i) => !itemIds.includes(i.instanceId),
  );
  next.campaign.inventory.equipment = next.campaign.inventory.equipment.filter(
    (i) => !equipmentIds.includes(i.instanceId),
  );
  next.campaign.activeExpeditionId = input.expeditionId;
  return {
    ...next,
    ...fromExecutionState(catalog, input.expeditionId, input.routeId, state),
  };
}

export function settleExpedition(
  snapshot: GameSnapshot,
  catalog: ValidatedCatalog,
  settlementId: string,
  expeditionId: string,
): GameSnapshot {
  if (
    snapshot.campaign.appliedSettlements.some(
      (s) => s.expeditionId === expeditionId,
    )
  )
    v.invalid("expeditionId", "Expedition already settled", "already-settled");
  if (snapshot.expedition?.id !== expeditionId)
    v.invalid("expeditionId", "No matching active expedition", "no-expedition");
  const engine = createBattleEngine(catalog, snapshot.expedition.routeId),
    state = activeExecution(snapshot);
  const completed = engine.complete(state);
  const next = structuredClone(snapshot),
    inventory = next.campaign.inventory;
  // Exhausted items are consumed; equipment (including broken equipment) returns as its same instance.
  inventory.items.push(
    ...state.loadout.items.filter((item) => item.charges > 0),
  );
  inventory.equipment.push(...state.loadout.equipment);
  next.campaign.funds.party += completed.result!.totalGold;
  next.campaign.funds.crystals += completed.result!.crystal ? 1 : 0;
  next.campaign.appliedSettlements.push({
    id: settlementId,
    expeditionId,
    result: completed.result!,
  });
  next.campaign.activeExpeditionId = null;
  next.expedition = null;
  next.encounter = null;
  next.campaign = validateCampaign(next.campaign, catalog);
  return next;
}
