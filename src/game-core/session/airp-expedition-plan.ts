import * as v from "../contracts/validation";
import { parseAppraisalSlots } from "../contracts/expedition-appraisal";
import { sha256 } from "../contracts/sha256";
import { DIRECTOR_LIMITS } from "../contracts/airp-director";
import { EXPEDITION_GM_CAPACITY as C, type AcceptedExpeditionPlan, type ExpeditionPlanInput, type ExpeditionPlanProposal, type ExpeditionSharedSchedule } from "../contracts/airp-expedition-plan";
import { expeditionDigest, parseExpeditionEventBody, parseExpeditionPlan, parseExpeditionThemeReview } from "../contracts/airp-expedition-plan-validation";

export const expeditionPlanHash = (value: unknown) => sha256(v.canonicalJson(value));
export const expeditionTaskId = (input: ExpeditionPlanInput) => `expedition-gm:${expeditionPlanHash([input.head.saveId, input.head.epoch, input.departure.runId])}`;
const fail = (message: string): never => v.invalid("expedition.plan", message);
const unique = (values: string[]) => { v.ids(values, "unique"); };
export function validateExpeditionPlanInput(i: ExpeditionPlanInput): void {
  v.assertJson(i); v.choice(i.protocol, [1], "input.protocol");
  v.id(i.head.saveId, "saveId"); v.id(i.head.epoch, "epoch"); v.number(i.head.revision, "revision"); v.number(i.phase, "phase");
  v.id(i.departure.runId, "runId"); v.id(i.departure.routeId, "routeId"); v.text(i.departure.intent, "departure.intent", 4000); expeditionDigest(i.departure.commandHash, "departure.commandHash");
  unique(i.departure.partyIds); unique(i.departure.itemIds); unique(i.sourceIds); v.id(i.capabilityId, "capabilityId");
  if (!i.departure.partyIds.length || !i.sourceIds.length) fail("A confirmed party and real sources are required");
  v.number(i.limits.nodes, "limits.nodes", 1, C.nodes); v.number(i.limits.events, "limits.events", 0, C.events); v.number(i.limits.definitions, "limits.definitions", 0, C.definitions);
  if (i.commissionRewardVersion !== undefined) v.choice(i.commissionRewardVersion, [1], "commissionRewardVersion");
  if (i.appraisalPlanVersion !== undefined) {
    v.choice(i.appraisalPlanVersion, [1], "appraisalPlanVersion");
    for (const s of parseAppraisalSlots(i.appraisalSlots)) if (!i.slots.some(slot => slot.roomDefinitionId === s.roomDefinitionId && slot.timing === "cleared" && s.roomId === `${i.departure.runId}:room:${slot.layer}:${slot.roomIndex + 1}`)) fail("Appraisal slot is outside this departure");
  } else if (i.appraisalSlots !== undefined) fail("Appraisal slots require explicit opt-in");
  unique(i.slots.map(s => s.id)); unique(i.commissions.map(c => c.eventId)); unique(i.fixedEvents.map(e => e.id)); unique(i.itemTemplates.map(t => t.id));
  for (const s of i.slots) {
    v.number(s.layer, "slot.layer", 1); v.number(s.roomIndex, "slot.roomIndex", 0); v.id(s.roomDefinitionId, "slot.roomDefinitionId"); v.choice(s.timing, ["arrive", "cleared", "exit"], "slot.timing");
    unique(s.actorIds); unique(s.actionIds); unique(s.objectiveIds);
    if (!s.actorIds.length || s.actorIds.some(id => !i.departure.partyIds.includes(id))) fail("Slot actors must be confirmed companions");
  }
  for (const c of i.commissions) {
    if (i.commissionRewardVersion === 1 && !i.itemTemplates.some(t => t.id === c.itemTemplateId)) fail("Commission lacks its reward template");
    v.id(c.stepId, "commission.stepId"); v.id(c.definitionId, "commission.definitionId"); v.text(c.title, "commission.title"); unique(c.actorIds); unique(c.basisIds);
    if (c.returnRequired !== true || !c.basisIds.length || c.basisIds.some(id => !i.sourceIds.includes(id)) || !i.slots.some(s => s.id === c.slotId && s.objectiveIds.includes(c.objectiveId))) fail("Commission needs its real step, proved sources and executable objective");
  }
  for (const f of i.fixedEvents) if (expeditionPlanHash(parseExpeditionEventBody(f.body)) !== f.digest || !i.sourceIds.includes(f.sourceId)) fail("Fixed event author definition missing or changed");
  for (const t of i.itemTemplates) {
    expeditionDigest(t.digest, "template.digest"); v.number(t.maxPerRun, "template.maxPerRun", 1, C.definitions); unique(t.fields.map(f => f.key));
    for (const f of t.fields) { v.text(f.label, "field.label"); v.number(f.maxLength, "field.maxLength", 1, 8000); if (f.values !== null) { if (!f.values.length) fail("Template enum is empty"); for (const value of f.values) v.text(value, "field.enum", f.maxLength); } }
  }
  validateShared(i.schedule, i.phase);
}
function validateShared(s: ExpeditionSharedSchedule, phase: number) {
  const b = s.budget;
  if (b.day !== Math.floor(phase / 4) + 1) fail("Shared daily ledger is stale");
  unique(b.publishedIds); unique(b.focusIds); unique(b.lightIds); unique(s.reservations.map(r => r.id)); unique(s.existing.map(e => e.id));
  if (b.focusIds.some(id => !b.publishedIds.includes(id) || b.lightIds.includes(id)) || b.lightIds.some(id => !b.publishedIds.includes(id)) || b.publishedIds.some(id => ![...b.focusIds, ...b.lightIds].includes(id))) fail("Corrupt shared daily ledger");
  for (const r of s.reservations) { v.id(r.ownerId, "reservation.ownerId"); v.number(r.day, "reservation.day", 1); v.choice(r.load, ["focus", "light"], "reservation.load"); v.id(r.themeKey, "reservation.themeKey"); unique(r.objectIds); if (b.publishedIds.includes(r.id)) fail("A published event cannot also hold a reservation"); }
}

/** Whole-plan validation; no silent pruning and no state or inventory mutations. */
export function validateExpeditionPlan(input: ExpeditionPlanInput, raw: unknown, inputHash: string, reviewRaw?: unknown, schedule = input.schedule): AcceptedExpeditionPlan {
  validateExpeditionPlanInput(input); validateShared(schedule, input.phase);
  const p = parseExpeditionPlan(raw), id = expeditionTaskId(input), proposalHash = expeditionPlanHash(p);
  if (p.taskId !== id || p.inputHash !== inputHash) fail("Plan belongs to another frozen task/input");
  if (input.appraisalPlanVersion === 1) {
    if (!p.appraisalItems || p.appraisalItems.length !== input.appraisalSlots!.length || p.appraisalItems.some(item => !input.appraisalSlots!.some(slot => slot.key === item.slotKey))) fail("Every appraisal slot requires exactly one complete item copy");
  } else if (p.appraisalItems !== undefined) fail("Old plans cannot introduce appraisal items");
  if (!p.nodes.length || p.nodes.length > input.limits.nodes || p.events.length > input.limits.events || p.itemDefinitions.length > input.limits.definitions) fail("Plan exceeds configured scope");
  const basis = (ids: string[]) => { if (ids.some(x => !input.sourceIds.includes(x))) fail("Unknown or unread planning source"); };
  basis(p.focus.basisIds);
  const events = p.events.map(e => {
    basis(e.basisIds);
    const f = e.source.kind === "fixed" ? input.fixedEvents.find(f => f.id === (e.source as { definitionId: string }).definitionId) : null;
    if (e.source.kind === "fixed" && !f) fail("Unknown fixed event");
    const body = f?.body ?? (e.source as { body: ReturnType<typeof parseExpeditionEventBody> }).body;
    if (!body.actorIds.length || body.actorIds.some(a => !input.departure.partyIds.includes(a))) fail("New event cast is outside this party");
    const eventId = `expedition-event:${expeditionPlanHash([id, e.key])}`;
    const definitionId = f?.id ?? `expedition-free:${expeditionPlanHash([id, e.key, body])}`;
    if (schedule.uniqueCompletedIds.includes(definitionId)) fail("Unique event already completed");
    return { id: eventId, key: e.key, definitionId, body, basisIds: e.basisIds };
  });
  const ownIds = events.map(e => e.id), foreign = schedule.reservations.filter(r => r.ownerId !== id), today = foreign.filter(r => r.day === schedule.budget.day);
  if (schedule.budget.publishedIds.some(x => ownIds.includes(x))) fail("Already published events cannot be replanned");
  const count = (load: "focus" | "light") => events.filter(e => e.body.load === load).length + today.filter(r => r.load === load).length + schedule.budget[load === "focus" ? "focusIds" : "lightIds"].length;
  if (schedule.budget.publishedIds.length + today.length + events.length > DIRECTOR_LIMITS.dailyNew || count("focus") > DIRECTOR_LIMITS.dailyFocus || count("light") > DIRECTOR_LIMITS.dailyLight) fail("Shared day/reservation capacity exceeded");
  if (events.some(e => e.body.load === "focus") && (input.commissions.length || schedule.busyFocus || schedule.requiredStoryIds.length || schedule.existing.some(e => e.load === "focus"))) fail("Existing commitments already occupy the daily focus");
  if (events.some(e => e.body.load === "light") && schedule.existing.some(e => e.load === "light")) fail("Existing vignette occupies the light slot");
  if (events.length + schedule.existing.filter(e => e.status === "offered").length > DIRECTOR_LIMITS.offered) fail("Shared offered-event backlog exceeded");
  const blocked = [...schedule.themes.filter(t => t.untilPhase === null || input.phase < t.untilPhase), ...foreign.map(r => ({ key: r.themeKey, objectIds: r.objectIds, sourceId: r.id }))].filter(t => !ownIds.includes(t.sourceId));
  for (const [index, e] of events.entries()) {
    if (blocked.some(t => t.key === e.body.themeKey || e.body.objectIds.some(o => t.objectIds.includes(o))) || events.slice(index + 1).some(other => other.definitionId === e.definitionId || other.body.themeKey === e.body.themeKey || e.body.objectIds.some(o => other.body.objectIds.includes(o)))) fail("Theme or stable promise is occupied/cooling down");
    const nodes = p.nodes.filter(n => n.link?.kind === "new-event" && n.link.eventKey === e.key);
    if (e.body.load === "light") {
      if (e.body.needsReturn || nodes.length !== 1 || nodes[0].link?.kind !== "new-event" || nodes[0].link.step !== "scene") fail("A multi-step commitment cannot be relabelled as light");
    } else if (nodes.filter(n => n.link?.kind === "new-event" && n.link.step === "offer").length !== 1 || !nodes.some(n => n.link?.kind === "new-event" && n.link.step === "action")) fail("New focus event requires a player offer and an action step");
  }
  if (input.commissions.length && (p.focus.kind !== "commission" || !input.commissions.some(c => c.eventId === p.focus.id))) fail("Keep the original commission as the trip focus");
  if (p.focus.kind === "commission" && !input.commissions.some(c => c.eventId === p.focus.id) || p.focus.kind === "exploration" && p.focus.id !== null || p.focus.kind === "new-event" && !events.some(e => e.key === p.focus.id && e.body.load === "focus")) fail("Invalid trip focus reference");
  if (events.some(e => e.body.load === "focus") && p.focus.kind !== "new-event") fail("New focus cannot hide under atmosphere");
  const rank = (slotId: string) => { const s = input.slots.find(s => s.id === slotId) ?? fail("Unknown executable room slot"); return s.layer * 10000 + s.roomIndex * 10 + (s.timing === "arrive" ? 0 : s.timing === "cleared" ? 1 : 2); };
  for (const [index, n] of p.nodes.entries()) {
    basis(n.basisIds); const slot = input.slots.find(s => s.id === n.slotId) ?? fail("Unknown executable room slot");
    if (!n.actorIds.length || n.actorIds.some(a => !slot.actorIds.includes(a)) || n.actionIds.some(a => !slot.actionIds.includes(a))) fail("Node contains unavailable actor or action");
    unique(n.prerequisites.map(x => x.nodeId));
    for (const dependency of n.prerequisites) { const prior = p.nodes.slice(0, index).find(x => x.id === dependency.nodeId); if (!prior || rank(prior.slotId) > rank(n.slotId)) fail("Node dependency is cyclic, forward or unreachable"); }
    const requirements = new Map<string, "completed" | "skipped">();
    const requireOutcome = (nodeId: string, outcome: "completed" | "skipped") => {
      const previous = requirements.get(nodeId);
      if (previous && previous !== outcome) fail("Node dependencies require contradictory branch outcomes");
      if (previous) return;
      requirements.set(nodeId, outcome);
      if (outcome === "completed") for (const prerequisite of p.nodes.find(x => x.id === nodeId)!.prerequisites) requireOutcome(prerequisite.nodeId, prerequisite.outcome);
    };
    for (const dependency of n.prerequisites) requireOutcome(dependency.nodeId, dependency.outcome);
    if (n.itemKeys.some(k => !p.itemDefinitions.some(d => d.key === k))) fail("Unknown frozen item definition");
    if (n.link?.kind === "commission") {
      const l = n.link, c = input.commissions.find(c => c.eventId === l.eventId && c.stepId === l.stepId) ?? fail("Node changed the original event/step");
      if (l.role === "objective" && n.slotId !== c.slotId) fail("Node moved the author's objective");
    } else if (n.link?.kind === "new-event") {
      const l = n.link, e = events.find(e => e.key === l.eventKey) ?? fail("Unregistered new event");
      if (n.actorIds.some(a => !e.body.actorIds.includes(a))) fail("Node actor outside event cast");
      if (["offer", "scene"].includes(l.step) && n.stop !== "choice") fail("New event must stop before the player's choice");
      if (!["offer", "scene"].includes(l.step)) {
        const offer = p.nodes.slice(0, index).find(x => x.link?.kind === "new-event" && x.link.eventKey === l.eventKey && x.link.step === "offer");
        if (!offer || rank(offer.slotId) > rank(n.slotId)) fail("New event action requires an earlier offer; runtime must also verify actual acceptance");
      }
    }
  }
  for (const c of input.commissions) if (!p.nodes.some(n => n.link?.kind === "commission" && n.link.eventId === c.eventId && n.link.role === "objective")) fail("Plan omitted the original commission objective");
  for (const ending of p.endings) { basis(ending.basisIds); if (ending.returnEventIds.length !== input.commissions.length || ending.returnEventIds.some(id => !input.commissions.some(c => c.eventId === id))) fail("Endings must retain original return/delivery obligations"); }
  const itemDefinitions = p.itemDefinitions.map(d => {
    const t = input.itemTemplates.find(t => t.id === d.templateId) ?? fail("Unapproved asset template");
    if (p.itemDefinitions.filter(d => d.templateId === t.id).length > t.maxPerRun || Object.keys(d.fields).length !== t.fields.length || t.fields.some(f => typeof d.fields[f.key] !== "string" || !d.fields[f.key].length || d.fields[f.key].length > f.maxLength || f.values && !f.values.includes(d.fields[f.key]))) fail("Asset fields/budget differ from template");
    if (!p.nodes.some(n => n.itemKeys.includes(d.key))) fail("Orphan item definition");
    const value = { id: `expedition-item:${expeditionPlanHash([id, d.key])}`, key: d.key, templateId: t.id, templateDigest: t.digest, fields: d.fields };
    return { ...value, digest: expeditionPlanHash(value) };
  });
  if (input.commissionRewardVersion === 1) {
    if (itemDefinitions.length !== input.commissions.length) fail("Every commission requires exactly one executable quest object");
    for (const c of input.commissions) {
      const items = itemDefinitions.filter(d => d.templateId === c.itemTemplateId);
      const nodes = p.nodes.filter(n => n.itemKeys.some(k => items.some(d => d.key === k)));
      if (items.length !== 1 || nodes.length !== 1 || nodes[0].link?.kind !== "commission" || nodes[0].link.eventId !== c.eventId || nodes[0].link.stepId !== c.stepId || nodes[0].link.role !== "objective" || nodes[0].slotId !== c.slotId || nodes[0].prerequisites.length)
        fail("Quest object must attach once to its unconditional authored objective reward node");
    }
  }
  const free = p.events.filter(e => e.source.kind === "free");
  const review = reviewRaw === undefined ? null : parseExpeditionThemeReview(reviewRaw);
  if (review && (review.proposalHash !== proposalHash || review.decisions.length !== free.length || review.decisions.some(d => !free.some(e => e.key === d.eventKey) || d.verdict !== "new" || d.matchedSourceIds.length))) fail("Free theme review is missing, duplicate or uncertain");
  // No review yet may be prepared, but never adopted. Application enforces this gate too.
  return { id, inputHash, proposalHash, proposal: p, events, itemDefinitions, review,
    reservations: events.map(e => ({ id: e.id, ownerId: id, day: schedule.budget.day, load: e.body.load, themeKey: e.body.themeKey, themeDescription: e.body.themeDescription, objectIds: e.body.objectIds })) };
}
export function expeditionReviewRequired(p: ExpeditionPlanProposal) { return p.events.some(e => e.source.kind === "free"); }
