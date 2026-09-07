import { d5ReplayBasis } from "../game-application/versions/d5-validate";
import type { D5GameRecord, AnyReceipt } from "../game-application";
import type { DemoEvent } from "../game-core/battle";
import type { ValidatedD5Catalog } from "../game-core/contracts";
import type { D5RunRef } from "../game-core/session";
import { d5EventEligibility, fromDemoBattle } from "../game-core/session";

/** Read-only display shape; the record and its v4 identity are never rewritten. */
export function d5EncounterView(record: D5GameRecord) {
  const run = record.snapshot.run;
  return run?.kind === "expedition" ? run.state : run?.battle ? fromDemoBattle(run.battle) : null;
}
export function d5MemoryView(record: D5GameRecord) {
  const campaign = record.snapshot.campaign, memory = campaign.memory;
  const available = !!campaign.manor.takeover && campaign.manor.story?.status !== "pending";
  return { memory, chapterId: "chapter.marietta.memory", available,
    canInherit: available && !!campaign.inheritedChapter && !campaign.chapterCompletion && !campaign.activeRunRef && !campaign.activeStoryId,
    canBegin: available && !campaign.activeRunRef && !campaign.activeStoryId && (!memory || memory.node === "completed"),
    canRetry: !!memory && ["failed", "left"].includes(memory.node) && !campaign.activeStoryId && (!campaign.activeRunRef || campaign.activeRunRef.kind === "memory"),
    completion: campaign.chapterCompletion, claim: campaign.chapterClaim,
    story: campaign.stories.find(s => s.id === campaign.activeStoryId) ?? null,
    deferredStory: campaign.stories.find(s => s.eventId === "story.marietta.return") ?? null,
    runRef: campaign.activeRunRef,
  };
}
/** Claimability is re-derived from committed evidence only; the service revalidates every command. */
export function d5ProgressionView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const campaign = record.snapshot.campaign, spec = catalog.data.progression;
  const starts = new Map<string, number>(d5ReplayBasis(record).baseline?.departures.map(d=>[d.event.runId,d.revision]));
  for (const f of record.facts) if (f.kind === "progression" && f.payload.type === "expedition-started") starts.set(f.payload.runId, f.source.revision);
  const at = record.head.revision + 1;
  const claimable = (eventId: string): string | null => {
    // Prefer the newest settlement so Lv.3 "new departure after the Lv.2 claim" is satisfiable when possible.
    for (const terminal of [...campaign.settlements].reverse()) {
      try { d5EventEligibility(catalog, campaign, starts, eventId, terminal.id, at); return terminal.id; } catch { /* not this basis */ }
    }
    return null;
  };
  const sessions = new Map(campaign.stories.map(s => [s.eventId, s]));
  const events = [...Object.values(spec.growthEvents).map(e => ({ eventId: e.id, kind: "growth" as const, growthId: e.growthId, ownerId: catalog.data.growth[e.growthId].ownerId, level: catalog.data.growth[e.growthId].level }), ), { eventId: spec.gift.eventId, kind: "gift" as const, growthId: null, ownerId: null, level: null }].map(base => {
    const session = sessions.get(base.eventId) ?? null;
    const completed = base.kind === "gift" ? !!campaign.giftGrantId : campaign.progress.appliedGrowthIds.includes(base.growthId!);
    return { ...base, completed, session: session ? { id: session.id, basisId: session.basisId, step: session.step, lastStep: session.lastStep, deferred: session.deferred } : null,
      basisId: completed ? null : session?.basisId ?? claimable(base.eventId) };
  });
  const mansion = !campaign.activeRunRef;
  const occupied = new Set(campaign.inventory.flatMap(i => i.location.kind === "inventory" ? [] : [i.location.ownerId]));
  const applicableOwners = campaign.availableCharacterIds.filter(id => catalog.data.characters[id].faces.some(f => catalog.data.actions[f.actionId].kind === "blank"));
  return {
    events,
    activeStoryId: campaign.activeStoryId,
    canBegin: mansion && !campaign.activeStoryId,
    teamMilestone: campaign.teamMilestone,
    inventory: campaign.inventory.map(i => ({ ...i, definition: catalog.data.equipment[i.definitionId] })),
    canMove: mansion,
    applicableOwners,
    equipTargets: applicableOwners.filter(id => !occupied.has(id)),
  };
}
export function d5VisibleEvents(record: D5GameRecord, ref?: D5RunRef | null) {
  return record.facts.filter(f => !record.retractedFactIds.includes(f.id) && (!ref || f.runRef?.id === ref.id && f.runRef.kind === ref.kind && (ref.kind !== "memory" || f.runRef.kind === "memory" && f.runRef.attempt === ref.attempt))).flatMap(f => {
    const base = { id: f.id, runRef: f.runRef, visibility: f.visibility, worldTime: f.worldTime, source: f.source, origin: f.origin };
    if (f.kind === "combat" || f.kind === "journey") return f.payload.events.map(e => ({ ...base, kind: e.type, actorId: e.actorId, payload: e.payload }));
    if (f.kind === "progression") return [{ ...base, kind: f.payload.type, actorId: null, payload: f.payload as unknown as DemoEvent["payload"] }];
    return [];
  });
}
export function committedDemoEvents(receipt: AnyReceipt): DemoEvent[] {
  return receipt.version === 1 ? [] : receipt.version === 4 ? receipt.combat?.events ?? receipt.journey?.events ?? [] : receipt.events;
}

/** Authored M04 cues are read-only projections of the first matching committed event per attempt. */
export function withMemoryDialogue(record: D5GameRecord, events: ReturnType<typeof d5VisibleEvents>) {
  if (record.contentRef.contentVersion === 3) return events;
  const run = record.snapshot.run;
  if (run?.kind !== "memory" || !run.battle) return events;
  const enc = run.battle.encounter, boss = enc.memory!.bossId;
  let formation = enc.enemies.map(e => e.id);
  const seen = new Set<string>(), ending = new Set(events.filter(e => e.kind === "memory-endurance-depleted").map(e => e.id));
  const protection = (ids: string[]) => { const at = ids.indexOf(boss); return at < 0 ? 0 : Number(at > 0) + Number(at + 1 < ids.length); };
  return events.flatMap(event => {
    const p = event.payload as Record<string, unknown>;
    let key = "", text = "";
    if (event.kind === "memory-advanced" && p.node === "battle" && run.attempt === 1) {key = "opening"; text = "玛丽埃塔：规矩是我立的。";}
    if (event.kind === "formation-reordered") {
      if (p.reason === "memory-intent" && protection(p.after as string[]) > protection(p.before as string[])) {key = "reorder"; text = "玛丽埃塔：归位。";}
      formation = [...p.after as string[]];
    }
    if (event.kind === "damage-applied" && p.targetKind === "party-member" && event.actorId === boss) {key = "judgment"; text = "玛丽埃塔：退下。";}
    if (event.kind === "damage-applied" && p.targetKind === "enemy" && p.hpAfter === 0) {
      const before = protection(formation);
      formation = formation.filter(id => id !== p.targetId);
      if (p.targetId !== boss && before > 0 && protection(formation) === 0 && !ending.has(event.id)) {key = "exposed"; text = "凯尔：这次，前面没有侍偶了。";}
    }
    if (!key || seen.has(key)) return [event];
    seen.add(key);
    return [event, {...event, kind: "memory-dialogue", payload: {text}}];
  });
}
