import * as v from "./validation";
import { DIRECTOR_LIMITS, type DirectorAction, type DirectorCard, type DirectorChoice, type DirectorPlanProposal, type DirectorThemeReview } from "./airp-director";

function bounded(raw: unknown, bytes: number, path: string) {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > bytes) v.invalid(path, "Director input exceeds archive capacity", "airp-capacity");
}
function choices(raw: unknown, path: string): DirectorChoice[] {
  const result = v.list(raw, path, DIRECTOR_LIMITS.choices).map((item, i) => {
    const p = `${path}.${i}`, r = v.record(item, p, ["id", "label", "intent"]);
    return {id: v.id(r.id, `${p}.id`), label: v.text(r.label, `${p}.label`, 300), intent: v.text(r.intent, `${p}.intent`, 2000)};
  });
  if (!result.length || new Set(result.map(c => c.id)).size !== result.length) v.invalid(path, "Expected distinct player choices");
  return result;
}
function action(raw: unknown, path: string): DirectorAction {
  const r = v.record(raw, path), kind = v.choice(r.kind, ["talk", "do", "patrol", "wait"], `${path}.kind`);
  v.record(r, path, ["id", "actorId", "locationId", "intent", "choices", "kind", ...(kind === "patrol" ? ["objectiveId"] : kind === "wait" ? ["phases"] : [])]);
  const common = {id: v.id(r.id, `${path}.id`), actorId: v.id(r.actorId, `${path}.actorId`), locationId: v.id(r.locationId, `${path}.locationId`), intent: v.text(r.intent, `${path}.intent`, 8000), choices: choices(r.choices, `${path}.choices`)};
  return kind === "patrol" ? {...common, kind, objectiveId: v.id(r.objectiveId, `${path}.objectiveId`)}
    : kind === "wait" ? {...common, kind, phases: v.number(r.phases, `${path}.phases`, 1, 8)} : {...common, kind};
}
export function parseDirectorCard(raw: unknown): DirectorCard {
  bounded(raw, DIRECTOR_LIMITS.definitionBytes, "director.card");
  const r = v.record(raw, "director.card", ["version", "id", "title", "tier", "form", "giverId", "actorIds", "locationId", "themeKey", "themeDescription", "objectIds", "synopsis", "motivation", "load", "volatility", "offerPhases", "repeat", "choices", "actions", "scenes", "aftermath"]);
  const actors = v.ids(r.actorIds, "card.actorIds", DIRECTOR_LIMITS.actors), giverId = v.id(r.giverId, "card.giverId");
  if (!actors.length || !actors.includes(giverId) || actors.includes("kael")) v.invalid("card.actorIds", "Expected NPC participants including giver, without player");
  const actions = v.list(r.actions, "card.actions", DIRECTOR_LIMITS.actions).map((a, i) => action(a, `card.actions.${i}`));
  if (new Set(actions.map(a => a.id)).size !== actions.length || actions.some(a => !actors.includes(a.actorId))) v.invalid("card.actions", "Duplicate action or actor outside cast");
  const scenes = v.record(r.scenes, "card.scenes", ["offer", "acceptance", "result", "declined"]);
  const volatility = v.choice(r.volatility, ["inert", "consequential"], "card.volatility");
  const aftermath = r.aftermath === null ? null : (() => {
    const a = v.record(r.aftermath, "card.aftermath", ["intent", "actorIds"]);
    const actorIds = v.ids(a.actorIds, "aftermath.actorIds", DIRECTOR_LIMITS.actors);
    if (!actorIds.length || actorIds.some(id => !actors.includes(id))) v.invalid("aftermath.actorIds", "Aftermath belongs to admitted NPC cast");
    return {intent: v.text(a.intent, "aftermath.intent", 8000), actorIds};
  })();
  if ((volatility === "consequential") !== !!aftermath) v.invalid("card.aftermath", "Only consequential cards have an admitted aftermath");
  const form = v.choice(r.form, ["sortie", "liaison", "household", "vignette"], "card.form"), load = v.choice(r.load, ["focus", "light"], "card.load");
  if (load === "light" && (actions.length || form !== "vignette")) v.invalid("card.load", "A task cannot be relabelled as a lightweight vignette");
  const patrols = actions.filter(a => a.kind === "patrol");
  if (patrols.length > 1 || (form === "sortie") !== (patrols.length === 1)) v.invalid("card.form", "Sortie binds exactly one authored patrol objective");
  if (form === "liaison" && !actions.some(a => a.kind === "talk" && a.actorId !== giverId)) v.invalid("card.actions", "Liaison needs a real target conversation");
  if (form === "household" && !actions.some(a => a.kind === "do")) v.invalid("card.actions", "Household needs an explicit player action");
  return {
    version: v.choice(r.version, [1], "card.version"), id: v.id(r.id, "card.id"), title: v.text(r.title, "card.title", 200), tier: v.choice(r.tier, ["ripple"], "card.tier"), form,
    giverId, actorIds: actors, locationId: v.id(r.locationId, "card.locationId"),
    themeKey: v.id(r.themeKey, "card.themeKey"), themeDescription: v.text(r.themeDescription, "card.themeDescription", 8000), objectIds: v.ids(r.objectIds, "card.objectIds", 16),
    synopsis: v.text(r.synopsis, "card.synopsis", 8000), motivation: v.text(r.motivation, "card.motivation", 8000), load, volatility,
    offerPhases: v.choice(r.offerPhases, [volatility === "inert" ? 8 : 4], "card.offerPhases"), repeat: v.choice(r.repeat, ["once", "after-cooldown"], "card.repeat"), choices: choices(r.choices, "card.choices"), actions,
    scenes: {offer: v.text(scenes.offer, "scenes.offer", 8000), acceptance: v.text(scenes.acceptance, "scenes.acceptance", 8000), result: v.text(scenes.result, "scenes.result", 8000), declined: v.text(scenes.declined, "scenes.declined", 8000)}, aftermath,
  };
}
export function parseDirectorPlan(raw: unknown): DirectorPlanProposal {
  bounded(raw, DIRECTOR_LIMITS.planBytes, "director.plan");
  const r = v.record(raw, "director.plan", ["version", "day", "reason", "focus", "entries"]);
  const focus = r.focus === null ? null : (() => {
    const f = v.record(r.focus, "plan.focus", ["kind", "id"]);
    return {kind: v.choice(f.kind, ["existing", "story", "new"], "focus.kind"), id: v.id(f.id, "focus.id")};
  })();
  const entries = v.list(r.entries, "plan.entries", DIRECTOR_LIMITS.dailyNew).map((item, i) => {
    const p = `entries.${i}`, e = v.record(item, p, ["id", "fromPhase", "throughPhase", "basisIds", "source"]), s = v.record(e.source, `${p}.source`);
    const kind = v.choice(s.kind, ["fixed", "free", "followup", "reserve"], `${p}.source.kind`);
    v.record(s, `${p}.source`, kind === "fixed" ? ["kind", "definitionId"] : kind === "free" ? ["kind", "card"] : kind === "reserve" ? ["kind", "eventId"] : ["kind", "parentId"]);
    const source = kind === "fixed" ? {kind, definitionId: v.id(s.definitionId, `${p}.definitionId`)} : kind === "free" ? {kind, card: parseDirectorCard(s.card)} : kind === "reserve" ? {kind, eventId: v.id(s.eventId, `${p}.eventId`)} : {kind, parentId: v.id(s.parentId, `${p}.parentId`)};
    const basisIds = v.ids(e.basisIds, `${p}.basisIds`, 64), fromPhase = v.number(e.fromPhase, `${p}.fromPhase`), throughPhase = v.number(e.throughPhase, `${p}.throughPhase`, fromPhase);
    if (!basisIds.length) v.invalid(`${p}.basisIds`, "A plan needs real contextual sources");
    return {id: v.id(e.id, `${p}.id`), fromPhase, throughPhase, basisIds, source};
  });
  if (new Set(entries.map(e => e.id)).size !== entries.length) v.invalid("plan.entries", "Duplicate plan entry");
  return {version: v.choice(r.version, [1], "plan.version"), day: v.number(r.day, "plan.day", 1), reason: v.text(r.reason, "plan.reason", 8000), focus, entries};
}
export function parseDirectorReview(raw: unknown): DirectorThemeReview {
  bounded(raw, DIRECTOR_LIMITS.planBytes, "director.review");
  const r = v.record(raw, "director.review", ["version", "planHash", "decisions"]);
  const decisions = v.list(r.decisions, "review.decisions", DIRECTOR_LIMITS.dailyNew).map(item => {
    const d = v.record(item, "review.decision", ["entryId", "verdict", "matchedSourceIds", "reason"]);
    return {entryId: v.id(d.entryId, "review.entryId"), verdict: v.choice(d.verdict, ["new", "same", "uncertain"], "review.verdict"), matchedSourceIds: v.ids(d.matchedSourceIds, "review.matchedSourceIds", 64), reason: v.text(d.reason, "review.reason", 8000)};
  });
  if (new Set(decisions.map(d => d.entryId)).size !== decisions.length) v.invalid("review.decisions", "Duplicate review entry");
  const planHash = v.text(r.planHash, "review.planHash", 64);
  if (!/^[a-f0-9]{64}$/.test(planHash)) v.invalid("review.planHash", "Expected exact plan hash");
  return {version: v.choice(r.version, [1], "review.version"), planHash, decisions};
}
