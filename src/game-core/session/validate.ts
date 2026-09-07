import type { ValidatedCatalog } from "../contracts/catalog-validation";
import * as v from "../contracts/validation";
import { createBattleEngine } from "../battle/engine";
import { EXPEDITION_FIELDS, ENCOUNTER_FIELDS } from "./state";
import type { GameSnapshot, GameExpedition, GameEncounter } from "./state";
import { toExecutionState } from "./projection";
import { validateCampaign } from "./campaign";

function validateMechanics(
  expedition: unknown,
  encounter: unknown,
  checkpoint: boolean,
): void {
  const e = v.record(expedition, "expedition", [
    ...EXPEDITION_FIELDS,
    "lifecycle",
    ...(checkpoint ? [] : ["id", "routeId", "undoStack"]),
  ]);
  v.record(encounter, "encounter", [
    ...ENCOUNTER_FIELDS,
    "turn",
    ...(checkpoint ? [] : ["id", "definitionId"]),
  ]);
  const life = v.record(e.lifecycle, "expedition.lifecycle");
  const type = v.choice(
    life.type,
    ["in-encounter", "exit-choice", "finished"],
    "expedition.lifecycle.type",
  );
  v.record(
    life,
    "expedition.lifecycle",
    type === "finished" ? ["type", "result"] : ["type"],
  );
}

export function validateSnapshot(
  input: unknown,
  catalog: ValidatedCatalog,
): GameSnapshot {
  v.assertJson(input);
  const s = v.record(input, "snapshot", [
    "campaign",
    "expedition",
    "encounter",
  ]);
  const campaign = validateCampaign(s.campaign, catalog);
  if (s.expedition === null || s.encounter === null) {
    if (
      s.expedition !== null ||
      s.encounter !== null ||
      campaign.activeExpeditionId !== null
    )
      v.invalid(
        "snapshot",
        "Inconsistent active expedition reference",
        "invariant-violation",
      );
    return { campaign, expedition: null, encounter: null };
  }
  validateMechanics(s.expedition, s.encounter, false);
  const expedition = s.expedition as GameExpedition,
    encounter = s.encounter as GameEncounter;
  v.id(expedition.id, "expedition.id");
  v.id(encounter.id, "encounter.id");
  const route = v.reference(
    catalog.data.routes,
    expedition.routeId,
    "expedition.routeId",
  );
  if (campaign.activeExpeditionId !== expedition.id)
    v.invalid(
      "campaign.activeExpeditionId",
      "Reference differs from active run",
    );
  if (campaign.appliedSettlements.some((s) => s.expeditionId === expedition.id))
    v.invalid("expedition.id", "Settled expedition is still active");
  if (
    encounter.id !== `${expedition.id}:encounter:${expedition.layer}` ||
    encounter.definitionId !== route.encounters[expedition.layer - 1]
  )
    v.invalid("encounter", "Encounter identity differs from route progress");
  v.list(
    expedition.undoStack,
    "expedition.undoStack",
    v.DATA_LIMITS.checkpoints,
  ).forEach((raw) => {
    const cp = v.record(raw, "checkpoint", [
      "action",
      "expedition",
      "encounter",
    ]);
    v.text(cp.action, "checkpoint.action");
    validateMechanics(cp.expedition, cp.encounter, true);
  });
  const state = createBattleEngine(catalog, expedition.routeId).restore(
    toExecutionState(expedition, encounter),
  );
  const ids = [
    ...campaign.inventory.items,
    ...campaign.inventory.equipment,
    ...state.loadout.items,
    ...state.loadout.equipment,
  ].map((i) => i.instanceId);
  if (new Set(ids).size !== ids.length)
    v.invalid(
      "inventory",
      "An instance is both at home and in the expedition",
      "invariant-violation",
    );
  if (ids.length > campaign.inventory.capacity)
    v.invalid(
      "inventory",
      "Return capacity is not reserved",
      "invariant-violation",
    );
  for (const member of state.party)
    if (!campaign.availableCharacterIds.includes(member.id))
      v.invalid("expedition.party", "Character unavailable in Campaign");
  return structuredClone(input) as GameSnapshot;
}
