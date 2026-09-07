import * as v from "../contracts/validation";
import { sha256 } from "../contracts/sha256";
import type { ValidatedD5Catalog } from "../contracts/d5";
import { resolveDemoCharacter, validateDemoProgress } from "../battle/rules/v2/configuration";
import { createBattleRngState } from "../battle/persistence/rng";
import { validateTerminal } from "./demo-expedition";
import { applyManorTakeover, MANOR_STORY_LAST_STEP } from "./manor-progression";
import { parseD5ProgressEntry, parseD5RunRef } from "./d5-parse";
import type { D5MemoryBattleState, D5ProgressEntry, D5Projection, D5RunReaders, D5RunRef, D5StorySession } from "./d5-types";
import { departureSupplies, supplyQuote } from "./d5-economy";

const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
export const d5EquipmentId = (grantId: string, definitionId: string) => `equipment:${sha256(v.canonicalJson([grantId, definitionId])).slice(0, 32)}`;
import { memorySupplyId as d5MemorySupplyId } from "../battle/rules/v4/memory";
export { d5MemorySupplyId };
export function initialD5Projection(catalog: ValidatedD5Catalog): D5Projection {
  return {
    clock: { day: 1, phase: "dawn" }, funds: { public: 0, party: 0, crystals: 0 }, supplies: [], settlements: [],
    manor: { takeover: null, story: null }, progress: { appliedGrowthIds: [], equipment: [] }, inventory: [],
    availableCharacterIds: [...catalog.data.initialParty], activeRunRef: null, memory: null, stories: [], activeStoryId: null,
    chapterCompletion: null, chapterClaim: null, growthGrants: [], giftGrantId: null, teamMilestone: null,
  };
}

export function validateD5MemoryBattle(catalog: ValidatedD5Catalog, raw: unknown, readers: D5RunReaders, expectedSeed?: number): D5MemoryBattleState {
  if (!readers.memory) v.invalid("memory.battle", "D5 combat reader is not installed", "content-unavailable");
  const b = readers.memory(catalog, raw), spec = catalog.data.progression.chapter;
  const seed = expectedSeed ?? b.run.rng.combat.seed;
  const expectedRng = createBattleRngState(seed);
  for (const checkpoint of [b, ...b.undo]) {
    for (const stream of ["combat", "loot", "flavor"] as const) {
      if (checkpoint.run.rng[stream].seed !== expectedRng[stream].seed || checkpoint.run.rng[stream].algorithm !== expectedRng[stream].algorithm) v.invalid("memory.seed", "Battle RNG differs from the historical checkpoint");
    }
    if (checkpoint.run.eventRng.seed !== ((seed ^ 0x3c6ef372) >>> 0)) v.invalid("memory.seed", "Event RNG differs from the historical checkpoint");
  }
  if (!same(b.run.contentRef, catalog.ref) || !same(b.run.progress, spec.progress) || !same(b.run.party.map(m => m.id), spec.partyIds)) v.invalid("memory.template", "Historical battle has a foreign configuration");
  if (b.encounter.definitionId !== spec.encounterId || b.run.looseGold !== 0 || b.run.bankedGold !== 0 || b.run.layerResults.length) v.invalid("memory.economy", "Memory cannot accumulate expedition resources");
  for (const member of b.run.party) {
    if (!same(member.config, resolveDemoCharacter(catalog.data, spec.progress, member.id))) v.invalid("memory.template", "Historical face configuration differs");
    v.number(member.hp, "memory.hp", 0, member.config.maxHp);
  }
  if (b.run.supplies.length !== spec.supplies.length) v.invalid("memory.supplies", "Historical supplies missing or duplicated");
  for (const supply of spec.supplies) {
    const local = b.run.supplies.filter(s => s.definitionId === supply.definitionId);
    if (local.length !== 1 || local[0].source !== "memory.marietta.allowance" || local[0].instanceId !== d5MemorySupplyId(b.run.id, supply.definitionId)) v.invalid("memory.supplies", "Supply is not local to this historical run");
    v.number(local[0].charges, "memory.supplies.charges", 0, supply.charges);
  }
  if (b.encounter.enemies.length !== spec.puppetCount + 1 || b.encounter.enemies.filter(e => e.definitionId === spec.bossId).length !== 1 || b.encounter.enemies.filter(e => e.definitionId === spec.puppetId).length !== spec.puppetCount) v.invalid("memory.enemies", "Historical enemy roster differs");
  return b;
}

function memoryVictory(catalog: ValidatedD5Catalog, battle: D5MemoryBattleState): boolean {
  const boss = battle.encounter.enemies.find(e => e.definitionId === catalog.data.progression.chapter.bossId)!;
  const alive = battle.run.party.some(m => m.hp > 0);
  if (battle.encounter.phase !== "complete" || (alive ? boss.hp !== 0 || battle.encounter.outcome !== "victory" : battle.encounter.outcome !== "wipe")) v.invalid("memory.terminal", "Terminal outcome is inconsistent; mutual wipe loses");
  return alive;
}

/** Content-aware validation for receipts that do not carry the previous campaign snapshot. */
export function validateD5EvidenceContent(catalog: ValidatedD5Catalog, entry: D5ProgressEntry, readers: D5RunReaders = {}): void {
  const e = entry.event, spec = catalog.data.progression;
  if (e.type === "supply-purchased") {
    const economy=catalog.data.economy;
    if(!economy || e.shopId!==economy.shopId || e.quoteVersion!==economy.quoteVersion || !economy.prices[e.definitionId]) v.invalid("purchase", "Unknown supply quote");
    v.number(e.quantity,"quantity",1,catalog.data.journey!.items[e.definitionId].capacity);
  } else if(e.type === "memory-inherited") {
    if(e.chapterId!==spec.chapter.id) v.invalid("chapterId","Unknown chapter");
  } else if (e.type === "expedition-started") {
    v.reference(catalog.data.routes, e.routeId, "routeId");
    e.partyIds.forEach(id => v.reference(catalog.data.characters, id, "partyIds"));
    e.itemIds.forEach(id => v.reference(catalog.data.journey!.items, id, "itemIds"));
    validateDemoProgress(catalog.data, e.progress);
  } else if (e.type === "expedition-settled") {
    const t = validateTerminal(catalog, e.terminal);
    if (!readers.expedition) v.invalid("terminal", "D5 expedition reader is not installed", "content-unavailable");
    const finalRun = readers.expedition(catalog, e.finalRun);
    if (finalRun.node !== "finished" || !same(finalRun.result, t) || !same(finalRun.run.contentRef, catalog.ref) || finalRun.run.id !== t.runId) v.invalid("terminal", "Receipt terminal differs from its validated run");
  } else if (e.type === "memory-started") {
    if (e.chapterId !== spec.chapter.id || e.templateId !== spec.chapter.templateId) v.invalid("memory", "Unknown historical template");
  } else if (e.type === "memory-ended") {
    const t = v.record(e.terminal, "memory.terminal", ["id", "runRef", "chapterId", "templateId", "finalBattle"]);
    v.id(t.id, "terminal.id"); const ref = parseD5RunRef(t.runRef);
    if (ref.kind !== "memory" || t.chapterId !== spec.chapter.id || t.templateId !== spec.chapter.templateId) v.invalid("memory", "Invalid memory terminal identity");
    const battle = validateD5MemoryBattle(catalog, t.finalBattle, readers);
    if (battle.run.id !== ref.id || battle.encounter.phase !== "complete") v.invalid("memory", "Receipt has no terminal battle");
    memoryVictory(catalog, battle);
  } else if (e.type === "story-started") {
    if (e.eventId !== spec.chapter.storyId && e.eventId !== spec.gift.eventId) v.reference(spec.growthEvents, e.eventId, "eventId");
  } else if (e.type === "manor-story") v.number(e.step, "step", 0, MANOR_STORY_LAST_STEP);
  else if (e.type === "equipment-moved") {
    for (const id of [e.fromOwnerId, e.toOwnerId]) if (id !== null) v.reference(catalog.data.characters, id, "ownerId");
  }
}

/** Departure revisions by runId; the only extra material eligibility needs beyond the projection. */
export type D5RunStarts = ReadonlyMap<string, number>;

/** One shared eligibility rule for replay and read-only queries. Throws when the event is not claimable. */
export function d5EventEligibility(catalog: ValidatedD5Catalog, state: D5Projection, starts: D5RunStarts, eventId: string, basisId: string, at: number): number {
  const spec = catalog.data.progression;
  if (eventId === spec.chapter.storyId) {
    if (!state.chapterCompletion || state.chapterCompletion.id !== basisId || state.memory?.node !== "return-pending") v.invalid("chapter", "No pending completed chapter");
    return spec.returnLastStep;
  }
  if (state.activeRunRef) v.invalid("activeRunRef", "Operation requires the mansion", "run-active");
  const terminal = state.settlements.find(t => t.id === basisId), start = terminal && starts.get(terminal.runId);
  if (!terminal || start === undefined || terminal.outcome === "wipe" || !(terminal.outcome === "extracted" && terminal.deepestLayer === 3 || terminal.outcome === "cleared" && terminal.deepestLayer === 5)) v.invalid("basisId", "No qualifying ordinary return");
  if (eventId === spec.gift.eventId) {
    if (state.giftGrantId) v.invalid("gift", "Gift already claimed");
    return spec.gift.lastStep;
  }
  const event = v.reference(spec.growthEvents, eventId, "eventId"), growth = catalog.data.growth[event.growthId];
  if (state.progress.appliedGrowthIds.includes(growth.id) || !terminal.partyIds.includes(growth.ownerId)) v.invalid("growth", "Growth already claimed or character did not participate");
  const previous = state.growthGrants.find(g => g.growthId === `growth.${growth.ownerId}.lv2`);
  if (growth.level === 3 && (!state.manor.takeover || !previous || start <= previous.revision)) v.invalid("growth", "Level 3 requires a new departure after the level 2 claim");
  if (growth.ownerId === "marietta" && (!state.chapterClaim || start <= state.chapterClaim.revision || terminal.routeId !== catalog.data.manor!.maintenanceRouteId)) v.invalid("growth", "Marietta requires an unlocked maintenance return");
  if (start >= at) v.invalid("basisId", "Return must precede the event");
  return event.lastStep;
}

/** Replay only committed progression evidence. No UI flag or arbitrary growth array authorizes a grant. */
export function projectD5Progress(catalog: ValidatedD5Catalog, raw: unknown, readers: D5RunReaders = {}): D5Projection {
  const entries = v.list(raw, "progression", 4096).map(parseD5ProgressEntry);
  const state = readers.baseline ? structuredClone(readers.baseline.campaign) : initialD5Projection(catalog), spec = catalog.data.progression;
  const seen = new Set<string>(), runIds = new Set<string>(), runs = new Map<string, { revision: number; event: Extract<D5ProgressEntry["event"], { type: "expedition-started" }>; supplyIds: string[] }>();
  const sessionIds = new Set<string>(), completedEvents = new Set<string>(), terminalIds = new Set<string>();
  for (const departure of readers.baseline?.departures ?? []) {
    runs.set(departure.event.runId, structuredClone(departure)); runIds.add(departure.event.runId);
  }
  state.settlements.forEach(t => terminalIds.add(t.id));
  state.stories.forEach(s => sessionIds.add(s.id));
  if (state.memory) runIds.add(state.memory.id);
  let revision = 0;
  const noRun = () => { if (state.activeRunRef) v.invalid("activeRunRef", "Operation requires the mansion", "run-active"); };
  const memoryRef = (ref: D5RunRef) => {
    if (!state.memory || !same(state.activeRunRef, ref)) v.invalid("runRef", "Stale or foreign memory attempt");
    return state.memory;
  };
  const availableEvent = (eventId: string, basisId: string, at: number): number =>
    d5EventEligibility(catalog, state, new Map([...runs].map(([id, r]) => [id, r.revision])), eventId, basisId, at);
  for (const entry of entries) {
    if (seen.has(entry.id) || entry.revision <= revision) v.invalid("progression", "Duplicate evidence or nonchronological transaction");
    seen.add(entry.id); revision = entry.revision;
    const e = entry.event;
    if (e.type === "supply-purchased") {
      const {total, stored} = supplyQuote(catalog, state, e);
      state.funds.party -= total;
      if (stored) stored.charges += e.quantity;
      else state.supplies.push({instanceId: `purchase:${sha256(entry.id).slice(0, 32)}`, definitionId: e.definitionId, source: "supply.demo.shop", charges: e.quantity});
    } else if (e.type === "expedition-started") {
      noRun();
      if (state.activeStoryId) v.invalid("story", "Finish or defer the active story before departure");
      if (runIds.has(e.runId)) v.invalid("runId", "Run identity reused");
      runIds.add(e.runId);
      const expectedRoute = state.manor.takeover ? catalog.data.manor!.maintenanceRouteId : catalog.data.manor!.firstClearRouteId;
      if (e.routeId !== expectedRoute || !e.partyIds.includes(catalog.data.leaderId) || !e.partyIds.length || e.partyIds.some(id => !state.availableCharacterIds.includes(id))) v.invalid("party", "Unavailable route or party");
      if (!same(validateDemoProgress(catalog.data, e.progress), state.progress)) v.invalid("progress", "Departure does not freeze current configuration");
      const supplyIds = departureSupplies(catalog, state, e.runId, e.itemIds).map(s => s.instanceId);
      state.supplies = state.supplies.filter(s => !e.itemIds.includes(s.definitionId));
      runs.set(e.runId, { revision, event: e, supplyIds });
      state.activeRunRef = { kind: "expedition", id: e.runId };
      for (const item of state.inventory) if (item.location.kind === "equipped" && e.partyIds.includes(item.location.ownerId)) item.location = { kind: "reserved", ownerId: item.location.ownerId, runId: e.runId };
    } else if (e.type === "expedition-settled") {
      const t = validateTerminal(catalog, e.terminal), start = runs.get(t.runId);
      if (!same(state.activeRunRef, { kind: "expedition", id: t.runId }) || !start || t.routeId !== start.event.routeId || !same(t.partyIds, start.event.partyIds) || state.settlements.some(s => s.runId === t.runId) || terminalIds.has(t.id)) v.invalid("terminal", "No unique matching departure");
      if (!readers.expedition) v.invalid("terminal", "D5 expedition reader is not installed", "content-unavailable");
      const finalRun = readers.expedition(catalog, e.finalRun);
      if (finalRun.node !== "finished" || !same(finalRun.result, t) || finalRun.run.id !== t.runId || finalRun.run.routeId !== t.routeId || !same(finalRun.run.contentRef, catalog.ref) || !same(finalRun.run.progress, start.event.progress) || !same(finalRun.run.party.map(m => m.id), start.event.partyIds)) v.invalid("terminal", "No validated terminal run explains this settlement");
      if (t.returnedSupplies.length !== start.supplyIds.length || t.returnedSupplies.some(s => start.supplyIds[start.event.itemIds.indexOf(s.definitionId)] !== s.instanceId)) v.invalid("supplies", "Returned supply is not the reserved instance");
      terminalIds.add(t.id); state.settlements.push(structuredClone(t)); state.supplies.push(...structuredClone(t.returnedSupplies));
      state.funds.party += t.totalGold + applyManorTakeover(catalog.shared, state.manor, t);
      const n = state.settlements.length;
      state.clock = { day: 1 + Math.floor(n / 4), phase: (["dawn", "day", "dusk", "night"] as const)[n % 4] };
      state.activeRunRef = null;
      for (const item of state.inventory) if (item.location.kind === "reserved") {
        if (item.location.runId !== t.runId) v.invalid("equipment", "Reservation belongs to another run");
        item.location = { kind: "equipped", ownerId: item.location.ownerId };
      }
    } else if (e.type === "manor-story") {
      noRun();
      const story = state.manor.story;
      if (!story || story.terminalId !== e.terminalId || story.status !== "pending" || e.step !== story.step) v.invalid("story", "No matching manor story cursor");
      if (e.choice === "skip") { story.step = MANOR_STORY_LAST_STEP; story.status = "skipped"; }
      else if (story.step === MANOR_STORY_LAST_STEP) story.status = "viewed";
      else story.step++;
    } else if (e.type === "memory-inherited") {
      noRun();
      if (!state.inheritedChapter || !state.manor.takeover || state.manor.story?.status === "pending" || state.activeStoryId || state.chapterCompletion || e.chapterId !== spec.chapter.id || runIds.has(e.runId)) v.invalid("memory", "No eligible inherited chapter");
      runIds.add(e.runId);
      state.chapterCompletion = {id:entry.id,terminalId:state.inheritedChapter.terminalId,revision};
      state.memory = {id:e.runId,chapterId:e.chapterId,templateId:spec.chapter.templateId,seed:0,attempt:1,node:"return-pending",step:0};
      state.activeRunRef = {kind:"memory",id:e.runId,attempt:1};
    } else if (e.type === "memory-started") {
      noRun();
      if (state.activeStoryId) v.invalid("story", "Finish or defer the active story before entering memory");
      if (!state.manor.takeover || !state.manor.story || state.manor.story.status === "pending" || e.chapterId !== spec.chapter.id || e.templateId !== spec.chapter.templateId) v.invalid("memory", "First clear and completed return story required");
      if (state.memory && state.memory.node !== "completed") v.invalid("memory", "Resume the existing attempt/checkpoint instead of reseeding");
      if (runIds.has(e.runId)) v.invalid("runId", "Run identity reused");
      runIds.add(e.runId);
      state.memory = { id: e.runId, chapterId: e.chapterId, templateId: e.templateId, seed: e.seed, attempt: 1, node: "present-intro", step: 0 };
      state.activeRunRef = { kind: "memory", id: e.runId, attempt: 1 };
    } else if (e.type === "memory-advanced") {
      const m = memoryRef(e.runRef);
      const next: Partial<Record<typeof m.node, typeof e.node>> = { "present-intro": "history-opening", "history-opening": "teaching", teaching: "battle", "history-complete": "return-pending" };
      if (next[m.node] !== e.node) v.invalid("memory.node", "Cannot skip a battle or a required lifecycle transition");
      m.node = e.node; m.step = 0;
    } else if (e.type === "memory-read") {
      const m = memoryRef(e.runRef);
      if (m.node !== e.node || m.step !== e.step || e.step >= spec.memoryLastSteps[e.node]) v.invalid("memory.step", "Stale or exhausted dialogue cursor");
      m.step++;
    } else if (e.type === "memory-ended") {
      const t = v.record(e.terminal, "memory.terminal", ["id", "runRef", "chapterId", "templateId", "finalBattle"]);
      const ref = parseD5RunRef(t.runRef), m = memoryRef(ref), id = v.id(t.id, "terminal.id");
      if (ref.kind !== "memory" || m.node !== "battle" || t.chapterId !== m.chapterId || t.templateId !== m.templateId || terminalIds.has(id)) v.invalid("memory.terminal", "Terminal has no matching active battle");
      const b = validateD5MemoryBattle(catalog, t.finalBattle, readers, m.seed);
      if (b.run.id !== ref.id || b.encounter.phase !== "complete") v.invalid("memory.terminal", "Battle has not completed");
      const alive = memoryVictory(catalog, b);
      terminalIds.add(id); m.node = alive ? "history-complete" : "failed"; m.step = 0;
      if (alive && !state.chapterCompletion) state.chapterCompletion = { id: entry.id, terminalId: id, revision };
    } else if (e.type === "memory-retried") {
      if (state.activeStoryId) v.invalid("story", "Finish or defer the active story before retrying");
      const m = state.memory;
      if (!m || m.id !== e.runId || m.attempt !== e.previousAttempt || !["failed", "left"].includes(m.node) || state.activeRunRef && !same(state.activeRunRef, { kind: "memory", id: m.id, attempt: m.attempt })) v.invalid("memory", "No matching retry checkpoint");
      m.attempt++; m.node = "teaching"; m.step = 0;
      state.activeRunRef = { kind: "memory", id: m.id, attempt: m.attempt };
    } else if (e.type === "memory-left") {
      const m = memoryRef(e.runRef);
      if (["history-complete", "return-pending", "completed"].includes(m.node)) v.invalid("memory", "Completed result must remain recoverable");
      m.node = "left"; state.activeRunRef = null;
    } else if (e.type === "story-started") {
      const existing = state.stories.find(s => s.eventId === e.eventId);
      if (state.activeStoryId || completedEvents.has(e.eventId) && e.eventId !== spec.chapter.storyId) v.invalid("story", "Another story is active or this event is already completed");
      const lastStep = availableEvent(e.eventId, e.basisId, revision);
      if (existing) {
        if (existing.id !== e.sessionId || existing.basisId !== e.basisId) v.invalid("story", "Resume the saved event session");
        existing.deferred = false;
      } else {
        if (sessionIds.has(e.sessionId)) v.invalid("story", "Session identity reused");
        sessionIds.add(e.sessionId); state.stories.push({ id: e.sessionId, eventId: e.eventId, basisId: e.basisId, step: 0, lastStep, deferred: false });
      }
      state.activeStoryId = e.sessionId;
    } else if (e.type === "story-advanced" || e.type === "story-completed") {
      const s = state.stories.find(s => s.id === e.sessionId);
      if (!s || state.activeStoryId !== s.id) v.invalid("story", "No active story session");
      if (s.eventId !== spec.chapter.storyId) noRun();
      if (e.type === "story-advanced") {
        if (s.step !== e.step) v.invalid("story.step", "Stale story cursor");
        if (e.choice === "later") { s.deferred = true; state.activeStoryId = null; }
        else if (e.choice === "skip") s.step = s.lastStep;
        else if (s.step < s.lastStep) s.step++;
        else v.invalid("story.step", "Complete the event at the final node");
      } else {
        availableEvent(s.eventId, s.basisId, revision);
        if (s.step !== s.lastStep) v.invalid("story", "Event result has not been reached");
        if (s.eventId === spec.chapter.storyId) {
          if (!state.chapterClaim) {
            state.chapterClaim = { id: entry.id, completionId: s.basisId, revision };
            state.availableCharacterIds.push("marietta");
          }
          state.memory!.node = "completed"; state.activeRunRef = null;
        } else if (s.eventId === spec.gift.eventId) {
          state.giftGrantId = entry.id;
          state.inventory = spec.gift.definitionIds.map(definitionId => ({ instanceId: d5EquipmentId(entry.id, definitionId), definitionId, grantId: entry.id, location: { kind: "inventory" } }));
        } else {
          const growthId = spec.growthEvents[s.eventId].growthId;
          state.growthGrants.push({ id: entry.id, growthId, basisId: s.basisId, revision });
          state.progress.appliedGrowthIds.push(growthId);
          if (!state.teamMilestone && state.progress.appliedGrowthIds.filter(id => catalog.data.growth[id].level === 3).length === 2) state.teamMilestone = { growthId: "growth.kael.team-lv3-guard", sourceGrantId: entry.id };
        }
        completedEvents.add(s.eventId); state.stories = state.stories.filter(x => x.id !== s.id); state.activeStoryId = null;
      }
    } else if (e.type === "equipment-moved") {
      noRun();
      const item = state.inventory.find(i => i.instanceId === e.instanceId);
      if (!item || item.location.kind === "reserved" || (item.location.kind === "equipped" ? item.location.ownerId : null) !== e.fromOwnerId || e.toOwnerId === e.fromOwnerId) v.invalid("equipment", "No matching owned item/allocation");
      if (e.toOwnerId !== null) {
        const ch = v.reference(catalog.data.characters, e.toOwnerId, "ownerId");
        if (!state.availableCharacterIds.includes(ch.id) || !ch.faces.some(f => catalog.data.actions[f.actionId].kind === "blank") || state.inventory.some(i => i.location.kind === "equipped" && i.location.ownerId === ch.id)) v.invalid("equipment", "Target is unavailable, inapplicable or occupied");
        item.location = { kind: "equipped", ownerId: ch.id };
      } else item.location = { kind: "inventory" };
    }
    state.progress.equipment = state.inventory.flatMap(i => i.location.kind === "inventory" ? [] : [{ instanceId: i.instanceId, definitionId: i.definitionId, ownerId: i.location.ownerId }]);
  }
  return v.freezeData(state);
}

export function d5StoryFor(state: D5Projection, sessionId: string): D5StorySession | null {
  return state.stories.find(s => s.id === sessionId) ?? null;
}
