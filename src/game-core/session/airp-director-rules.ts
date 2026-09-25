import * as v from "../contracts/validation";
import { sha256 } from "../contracts/sha256";
import { DIRECTOR_LIMITS, type DirectorAcceptedEntry, type DirectorCapabilities, type DirectorCard, type DirectorDayBudget, type DirectorFixedCard, type DirectorPlanProposal, type DirectorThemeReview, type DirectorWorld } from "../contracts/airp-director";
import { parseDirectorCard, parseDirectorPlan, parseDirectorReview } from "../contracts/airp-director-validation";
import type { AirpPhase } from "../contracts/airp-pool";

const phases: AirpPhase[] = ["dawn", "day", "dusk", "night"];
export const directorDay = (phase: number) => Math.floor(phase / 4) + 1;
export const directorHash = (value: unknown) => sha256(v.canonicalJson(value));
export function directorActorLocation(capabilities: DirectorCapabilities, world: DirectorWorld, actorId: string, phase = world.phase): string | null {
  if (!world.eligible || !world.availableActorIds.includes(actorId) || world.occupiedActorIds.includes(actorId)) return null;
  return capabilities.locations[actorId]?.[phases[phase % 4]] ?? null;
}
export function validateDirectorCapability(card: DirectorCard, c: DirectorCapabilities) {
  const actors = [card.giverId, ...card.actorIds, ...card.actions.map(a => a.actorId)];
  if (actors.some(id => !c.actorIds.includes(id))) v.invalid("director.actors", "Participant is outside the executable cast");
  if ([card.locationId, ...card.actions.map(a => a.locationId)].some(id => !c.locationIds.includes(id))) v.invalid("director.location", "Unknown playable location");
  if (card.objectIds.some(id => !c.objectIds.includes(id))) v.invalid("director.objects", "Unknown stable object or promise");
  for (const a of card.actions) {
    if (!Object.values(c.locations[a.actorId] ?? {}).includes(a.locationId)) v.invalid("director.action.location", "Actor never meets at this location");
    if (a.kind === "patrol") {
      const objective = c.objectives[a.objectiveId];
      if (!objective) v.invalid("director.objective", "No authored executable patrol target");
      if (objective.objectIds.some(id => !card.objectIds.includes(id))) v.invalid("director.objects", "Cannot hide the patrol object's stable identity");
    }
  }
}

/** Validate an entire proposal, never silently delete invalid entries and accept a different plan. */
export function validateDirectorPlan(input: {
  proposal: unknown; capabilities: DirectorCapabilities; world: DirectorWorld;
  fixed: readonly DirectorFixedCard[]; budget: DirectorDayBudget; review?: unknown;
}): { proposal: DirectorPlanProposal; entries: DirectorAcceptedEntry[]; review: DirectorThemeReview | null } {
  const p = parseDirectorPlan(input.proposal), {world: w, capabilities: c, budget: b} = input;
  if (p.day !== directorDay(w.phase) || b.day !== p.day) v.invalid("director.day", "Plan belongs to another game day", "airp-stale-result");
  if (!w.eligible && p.entries.length) v.invalid("director.eligibility", "New events are unavailable now", "command-not-available");
  if (new Set(b.publishedIds).size !== b.publishedIds.length || b.focusIds.some(id => !b.publishedIds.includes(id)) || b.lightIds.some(id => !b.publishedIds.includes(id))) v.invalid("director.budget", "Corrupt daily ledger");
  const entries = p.entries.map<DirectorAcceptedEntry>(entry => {
    if (b.publishedIds.includes(entry.id)) v.invalid("director.entry", "Already published entry cannot be planned again");
    let card: DirectorCard, parentId: string | null = null;
    if (entry.source.kind === "fixed") {
      const fixed = input.fixed.find(f => f.card.id === (entry.source as {definitionId: string}).definitionId);
      if (!fixed) v.invalid("director.fixed", "Unknown author card");
      card = parseDirectorCard(fixed.card);
    } else if (entry.source.kind === "reserve") {
      const source = entry.source;
      const reserve = w.reserves?.find(r => r.eventId === source.eventId);
      if (!reserve || w.phase < reserve.availableFromPhase) v.invalid("director.reserve", "Reserve reissue requires a later game day and its immutable definition");
      card = parseDirectorCard(reserve.card);
    } else if (entry.source.kind === "followup") {
      parentId = entry.source.parentId;
      const followup = w.followups.find(f => f.parentId === parentId);
      if (!followup?.eligible || followup.consumed) v.invalid("director.followup", "Followup needs an eligible, unconsumed parent slot");
      card = parseDirectorCard(followup.card);
      if (card.actions.length || card.form !== "vignette") v.invalid("director.followup", "A followup cannot reissue a task");
    } else card = parseDirectorCard(entry.source.card);
    validateDirectorCapability(card, c);
    if (card.actorIds.some(id => !w.availableActorIds.includes(id))) v.invalid("director.actors", "A story card does not unlock its participants");
    if (entry.basisIds.some(id => !w.sourceIds.includes(id))) v.invalid("director.basis", "Unknown, unread, or invalid planning source");
    if (entry.fromPhase < w.phase || directorDay(entry.fromPhase) !== p.day || directorDay(entry.throughPhase) !== p.day) v.invalid("director.window", "A plan cannot invent past windows or schedule beyond this day");
    if (!Array.from({length: entry.throughPhase - entry.fromPhase + 1}, (_, i) => entry.fromPhase + i).some(phase => directorActorLocation(c, w, card.giverId, phase) === card.locationId)) v.invalid("director.window", "Giver and scene never meet within this window");
    if (!parentId && (w.uniqueCompletedIds.includes(card.id) || card.actions.some(a => a.kind === "patrol" && w.uniqueCompletedIds.includes(a.objectiveId)))) v.invalid("director.unique", "Unique event or objective is already completed");
    const blocked = w.themes.filter(t => t.untilPhase === null || w.phase < t.untilPhase);
    if (blocked.some(t => t.sourceId !== parentId && (t.key === card.themeKey || card.objectIds.some(id => t.objectIds.includes(id))))) v.invalid("director.theme", "Theme or stable promise is occupied or cooling down");
    return {id: entry.id, origin: entry.source.kind, parentId, card, fromPhase: entry.fromPhase, throughPhase: entry.throughPhase, basisIds: [...entry.basisIds], ...(entry.source.kind === "reserve" ? {reserveId: entry.source.eventId} : {})};
  });
  for (let i = 0; i < entries.length; i++) for (const other of entries.slice(i + 1)) {
    const entry = entries[i];
    if (entry.card.id === other.card.id || entry.card.themeKey === other.card.themeKey || entry.card.objectIds.some(id => other.card.objectIds.includes(id))) v.invalid("director.theme", "Two entries cannot reserve the same event or promise");
    if (entry.card.giverId === other.card.giverId && Math.max(entry.fromPhase, other.fromPhase) <= Math.min(entry.throughPhase, other.throughPhase)) v.invalid("director.window", "Overlapping entrances for the same actor");
  }
  const focus = entries.filter(e => e.card.load === "focus"), light = entries.filter(e => e.card.load === "light");
  if (b.publishedIds.length + entries.length > DIRECTOR_LIMITS.dailyNew || b.focusIds.length + focus.length > DIRECTOR_LIMITS.dailyFocus || b.lightIds.length + light.length > DIRECTOR_LIMITS.dailyLight) v.invalid("director.budget", "Shared daily capacity exceeded");
  if (w.existing.filter(e => e.status === "offered").length + entries.length > DIRECTOR_LIMITS.offered) v.invalid("director.backlog", "Unaccepted offers already occupy the available space");
  const existingFocus = w.existing.some(e => e.load === "focus");
  if (light.length && w.existing.some(e => e.load === "light")) v.invalid("director.load", "An existing vignette already occupies the light slot");
  if (focus.length && (w.busyFocus || w.requiredStoryIds.length || existingFocus)) v.invalid("director.load", "Continue existing work before proposing another complex event");
  if (entries.some(e => e.card.form === "sortie") && w.existing.some(e => e.form === "sortie" && e.status !== "offered")) v.invalid("director.sortie", "Only one active patrol commission");
  if (p.focus?.kind === "new" ? focus.length !== 1 || focus[0].id !== p.focus.id : focus.length > 0) v.invalid("director.focus", "New focus must reference exactly its planned entry");
  if (p.focus?.kind === "existing" && !w.existing.some(e => e.id === p.focus!.id && e.load === "focus")) v.invalid("director.focus", "Missing existing focus");
  if (p.focus?.kind === "story" && !w.requiredStoryIds.includes(p.focus.id)) v.invalid("director.focus", "Unknown required story");
  const free = entries.filter(e => e.origin === "free");
  let review: DirectorThemeReview | null = null;
  if (free.length) {
    review = parseDirectorReview(input.review);
    if (review.planHash !== directorHash(p)) v.invalid("director.review", "Review does not cover this immutable plan");
    if (review.decisions.length !== free.length || review.decisions.some(d => !free.some(e => e.id === d.entryId))) v.invalid("director.review", "Every free entry needs one independent decision");
    for (const d of review.decisions) {
      if (d.verdict !== "new" || d.matchedSourceIds.length) v.invalid("director.review", "Duplicate or uncertain proposal cannot be published");
    }
  } else if (input.review !== undefined) {
    review = parseDirectorReview(input.review);
    if (review.planHash !== directorHash(p) || review.decisions.length) v.invalid("director.review", "Unexpected review for a plan without free cards");
  }
  return {proposal: p, entries, review};
}

/** New scene identities follow actual occurrence; attempts keep the same scene ID. */
export function directorSceneId(eventId: string, role: string, actionIndex: number, occurrence: number): string {
  v.id(eventId, "eventId"); v.number(actionIndex, "actionIndex"); v.number(occurrence, "occurrence");
  return `director-scene:${directorHash([eventId, role, actionIndex, occurrence]).slice(0, 32)}`;
}
