import type { DemoProgress, ValidatedDemoCatalog } from "../contracts/demo";
import * as v from "../contracts/validation";
import {
  createDemoBattleEngine,
  validateDemoProgress,
  resolveDemoCharacter,
} from "../battle";
import { fromDemoBattle, validateDemoExpedition, validateTerminal, type DemoExpeditionState, type DemoTerminal } from "./demo-expedition";
import { validateSupplies } from "../battle/rules/v2/journey-validation";
import type { DemoSupply } from "../battle";
import { sha256 } from "../contracts/sha256";
import { applyManorTakeover, validateManorProgression, MANOR_STORY_LAST_STEP, type ManorProgression } from "./manor-progression";

export type DemoCampaign = {
  clock: { day: number; phase: "dawn" | "day" | "dusk" | "night" };
  funds: { public: number; party: number; crystals: number };
  progress: DemoProgress;
  supplies: DemoSupply[];
  settlements: DemoTerminal[];
  activeRunRef: { kind: "expedition"; id: string } | null;
  manor?: ManorProgression;
};
export type DemoSnapshot = {
  campaign: DemoCampaign;
  expedition: DemoExpeditionState | null;
};
export function createDemoCampaign(
  catalog: ValidatedDemoCatalog,
  profileId: string,
): DemoSnapshot {
  const profile = v.reference(catalog.data.profiles, profileId, "profileId");
  return {
    campaign: {
      clock: { day: 1, phase: "dawn" },
      funds: { public: 0, party: 0, crystals: 0 },
      progress: validateDemoProgress(catalog.data, profile.progress),
      activeRunRef: null, supplies: [], settlements: [],
      ...(catalog.ref.rulesVersion === 3 ? {manor: {takeover: null, story: null}} : {}),
    },
    expedition: null,
  };
}
export function validateDemoSnapshot(
  catalog: ValidatedDemoCatalog,
  profileId: string,
  raw: unknown,
): DemoSnapshot {
  const profile = v.reference(catalog.data.profiles, profileId, "profileId");
  v.assertJson(raw);
  const s = v.record(raw, "snapshot", ["campaign", "expedition"]),
    c = v.record(s.campaign, "campaign", [
      "clock",
      "funds",
      "progress",
      "activeRunRef", "supplies", "settlements",
      ...(catalog.ref.rulesVersion === 3 ? ["manor"] : []),
    ]);
  const clock = v.record(c.clock, "clock", ["day", "phase"]);
  v.number(clock.day, "day", 1);
  v.choice(clock.phase, ["dawn", "day", "dusk", "night"], "phase");
  const funds = v.record(c.funds, "funds", ["public", "party", "crystals"]);
  Object.values(funds).forEach((n) => v.number(n, "funds"));
  const progress = validateDemoProgress(catalog.data, c.progress);
  // No D5 growth/equipment commands exist yet; a D1 archive cannot invent extra grants.
  if (v.canonicalJson(progress) !== v.canonicalJson(profile.progress))
    v.invalid("progress", "No supported grant explains this progression");
  const supplies = validateSupplies(catalog, c.supplies, 7);
  const settlements = v.list(c.settlements, "settlements", 512).map(x => validateTerminal(catalog, x));
  if (new Set(settlements.map(x => x.runId)).size !== settlements.length || new Set(settlements.map(x => x.id)).size !== settlements.length) v.invalid("settlements", "Duplicate settlement");
  const manor = catalog.ref.rulesVersion === 3 ? validateManorProgression(catalog, c.manor, settlements) : null;
  if (catalog.data.journey) {
    if (funds.party !== settlements.reduce((sum, t) => sum + t.totalGold, manor?.takeover?.gold ?? 0) || funds.public !== 0 || funds.crystals !== 0) v.invalid("funds", "Funds differ from settlement ledger");
    if (clock.day !== 1 + Math.floor(settlements.length / 4) || clock.phase !== ["dawn", "day", "dusk", "night"][settlements.length % 4]) v.invalid("clock", "Clock differs from settlements");
  }
  if (s.expedition === null) {
    if (c.activeRunRef !== null) v.invalid("activeRunRef", "Missing run");
  } else {
    const ref = v.record(c.activeRunRef, "activeRunRef", ["kind", "id"]);
    v.choice(ref.kind, ["expedition"], "run.kind");
    const battle = validateDemoExpedition(catalog, s.expedition);
    if (catalog.data.manor && battle.run.routeId !== (manor?.takeover ? catalog.data.manor.maintenanceRouteId : catalog.data.manor.firstClearRouteId)) v.invalid("route", "Run does not match manor progress");
    if (settlements.some(x => x.runId === battle.run.id)) v.invalid("run", "Settled run remains active");
    if (supplies.some(x => battle.run.supplies.some(y => x.instanceId === y.instanceId || x.definitionId === y.definitionId))) v.invalid("supplies", "Supply is also reserved in run");
    if (
      ref.id !== battle.run.id ||
      v.canonicalJson(progress) !== v.canonicalJson(battle.run.progress)
    )
      v.invalid("activeRunRef", "Run configuration differs");
    battle.run.party.forEach((m) => {
      if (!profile.availableCharacterIds.includes(m.id))
        v.invalid("party", "Unavailable character");
    });
  }
  return structuredClone(raw) as DemoSnapshot;
}
export function startDemoExpedition(
  catalog: ValidatedDemoCatalog,
  profileId: string,
  snapshot: DemoSnapshot,
  input: { runId: string; routeId: string; partyIds: string[]; seed: number; itemIds?: string[] },
): DemoSnapshot {
  const current = validateDemoSnapshot(catalog, profileId, snapshot);
  if (current.expedition)
    v.invalid("run", "Another run is active", "expedition-active");
  if (catalog.data.manor && input.routeId !== (current.campaign.manor?.takeover ? catalog.data.manor.maintenanceRouteId : catalog.data.manor.firstClearRouteId)) v.invalid("routeId", "Route is unavailable for this progress", "content-unavailable");
  const profile = catalog.data.profiles[profileId];
  for (const id of input.partyIds)
    if (!profile.availableCharacterIds.includes(id))
      v.invalid(
        "partyIds",
        "Character is unavailable",
        "unavailable-character",
      );
  const battle = createDemoBattleEngine(catalog).create({
    runId: input.runId,
    routeId: input.routeId,
    partyIds: input.partyIds,
    seed: input.seed,
    progress: current.campaign.progress,
  });
  const selected = v.ids(input.itemIds ?? [], "itemIds", 4);
  for (const id of selected) {
    const def = v.reference(catalog.data.journey?.items ?? {}, id, "itemIds");
    const existing = current.campaign.supplies.find(x => x.definitionId === id);
    const supply: DemoSupply = existing ?? {instanceId: `supply:${sha256(v.canonicalJson([input.runId, id])).slice(0, 32)}`, definitionId: id, source: "supply.demo.allowance", charges: 0};
    supply.charges = def.capacity;
    current.campaign.supplies = current.campaign.supplies.filter(x => x.instanceId !== supply.instanceId);
    battle.run.supplies.push(supply);
  }
  current.expedition = fromDemoBattle(battle);
  current.campaign.activeRunRef = { kind: "expedition", id: input.runId };
  return validateDemoSnapshot(catalog, profileId, current);
}
export function demoCharacterView(
  catalog: ValidatedDemoCatalog,
  profileId: string,
  snapshot: DemoSnapshot,
  id: string,
) {
  const s = validateDemoSnapshot(catalog, profileId, snapshot);
  const member = s.expedition?.run.party.find((m) => m.id === id);
  return {
    available:
      catalog.data.profiles[profileId].availableCharacterIds.includes(id),
    inRun: !!member,
    config:
      member?.config ??
      resolveDemoCharacter(catalog.data, s.campaign.progress, id),
    temporaryRust: member?.temporaryRust ?? [],
  };
}

export function settleDemoExpedition(catalog: ValidatedDemoCatalog, profileId: string, input: DemoSnapshot, runId: string, terminalId: string): DemoSnapshot {
  const snapshot = validateDemoSnapshot(catalog, profileId, input);
  const prior = snapshot.campaign.settlements.find(x => x.runId === runId);
  if (prior) { if (prior.id !== terminalId) v.invalid("terminalRef", "Terminal identity differs"); return snapshot; }
  const run = snapshot.expedition;
  if (!run || run.run.id !== runId || run.node !== "finished" || run.result.id !== terminalId) v.invalid("terminalRef", "No matching terminal result", "command-not-available");
  snapshot.campaign.funds.party += run.result.totalGold;
  snapshot.campaign.supplies.push(...structuredClone(run.result.returnedSupplies));
  snapshot.campaign.settlements.push(structuredClone(run.result));
  if (catalog.data.manor) snapshot.campaign.funds.party += applyManorTakeover(catalog, snapshot.campaign.manor!, run.result);
  const phases = ["dawn", "day", "dusk", "night"] as const;
  const next = (phases.indexOf(snapshot.campaign.clock.phase) + 1) % 4;
  snapshot.campaign.clock.phase = phases[next]; if (next === 0) snapshot.campaign.clock.day++;
  snapshot.campaign.activeRunRef = null; snapshot.expedition = null;
  return validateDemoSnapshot(catalog, profileId, snapshot);
}

/** Story acknowledgements have no gameplay, reward or clock effects. */
export function acknowledgeManorStory(catalog: ValidatedDemoCatalog, profileId: string, input: DemoSnapshot, terminalId: string, step: number, choice: "continue" | "skip"): DemoSnapshot {
  const snapshot = validateDemoSnapshot(catalog, profileId, input), story = snapshot.campaign.manor?.story;
  if (!story || story.terminalId !== terminalId) v.invalid("story", "No matching story", "command-not-available");
  if (story.status !== "pending" || step < story.step) return snapshot;
  if (step !== story.step) v.invalid("story.step", "Story cursor differs", "command-not-available");
  if (choice === "skip") {story.step = MANOR_STORY_LAST_STEP; story.status = "skipped";}
  else if (story.step === MANOR_STORY_LAST_STEP) story.status = "viewed";
  else story.step++;
  return validateDemoSnapshot(catalog, profileId, snapshot);
}
