import * as v from "./validation";
import { parseAppraisalItems } from "./expedition-appraisal";
import { EXPEDITION_ENDINGS, EXPEDITION_GM_CAPACITY as C, type ExpeditionEventBody, type ExpeditionNodeLink, type ExpeditionPlanProposal, type ExpeditionThemeReview } from "./airp-expedition-plan";

export function expeditionDigest(raw: unknown, path: string): string {
  const text = v.text(raw, path, 64);
  if (!/^[a-f0-9]{64}$/.test(text)) v.invalid(path, "Expected SHA256");
  return text;
}
export function parseExpeditionEventBody(raw: unknown): ExpeditionEventBody {
  const r = v.record(raw, "expedition.event", ["title", "themeKey", "themeDescription", "objectIds", "actorIds", "load", "needsReturn", "repeat"]);
  return { title: v.text(r.title, "event.title", 200), themeKey: v.id(r.themeKey, "event.themeKey"), themeDescription: v.text(r.themeDescription, "event.themeDescription", 4000), objectIds: v.ids(r.objectIds, "event.objectIds", 16), actorIds: v.ids(r.actorIds, "event.actorIds", 5), load: v.choice(r.load, ["focus", "light"], "event.load"), needsReturn: v.boolean(r.needsReturn, "event.needsReturn"), repeat: v.choice(r.repeat, ["once", "after-cooldown"], "event.repeat") };
}
const sources = (raw: unknown, path: string) => { const ids = v.ids(raw, path, 64); if (!ids.length) v.invalid(path, "At least one proved source is required"); return ids; };
function link(raw: unknown): ExpeditionNodeLink {
  if (raw === null) return null;
  const r = v.record(raw, "node.link"), kind = v.choice(r.kind, ["commission", "new-event"], "node.link.kind");
  if (kind === "commission") {
    v.record(r, "node.link", ["kind", "eventId", "stepId", "role"]);
    return { kind, eventId: v.id(r.eventId, "link.eventId"), stepId: v.id(r.stepId, "link.stepId"), role: v.choice(r.role, ["objective", "feedback"], "link.role") };
  }
  v.record(r, "node.link", ["kind", "eventKey", "step"]);
  return { kind, eventKey: v.id(r.eventKey, "link.eventKey"), step: v.choice(r.step, ["offer", "action", "feedback", "result", "scene"], "link.step") };
}
function bounded(raw: unknown) { v.assertJson(raw); if (v.utf8Size(JSON.stringify(raw)) > C.outputBytes) v.invalid("expedition.output", "Output capacity exceeded", "airp-capacity"); }
export function parseExpeditionPlan(raw: unknown): ExpeditionPlanProposal {
  bounded(raw);
  const r = v.record(raw, "expedition.plan", ["protocol", "taskId", "inputHash", "focus", "nodes", "events", "itemDefinitions", "endings"], ["appraisalItems"]);
  const f = v.record(r.focus, "plan.focus", ["kind", "id", "intent", "basisIds"]);
  const nodes = v.list(r.nodes, "plan.nodes", C.nodes).map(item => {
    const n = v.record(item, "plan.node", ["id", "slotId", "intent", "actorIds", "basisIds", "actionIds", "prerequisites", "link", "stop", "itemKeys"]);
    return { id: v.id(n.id, "node.id"), slotId: v.id(n.slotId, "node.slotId"), intent: v.text(n.intent, "node.intent", 4000), actorIds: v.ids(n.actorIds, "node.actorIds", 5), basisIds: sources(n.basisIds, "node.basisIds"), actionIds: v.ids(n.actionIds, "node.actionIds", 8),
      prerequisites: v.list(n.prerequisites, "node.prerequisites", C.nodes).map(item => { const p = v.record(item, "node.prerequisite", ["nodeId", "outcome"]); return { nodeId: v.id(p.nodeId, "prerequisite.nodeId"), outcome: v.choice(p.outcome, ["completed", "skipped"], "prerequisite.outcome") }; }),
      link: link(n.link), stop: v.choice(n.stop, ["choice", "program", "scene-end"], "node.stop"), itemKeys: v.ids(n.itemKeys, "node.itemKeys", C.definitions) };
  });
  const events = v.list(r.events, "plan.events", C.events).map(item => {
    const e = v.record(item, "plan.event", ["key", "basisIds", "source"]), s = v.record(e.source, "event.source"), kind = v.choice(s.kind, ["fixed", "free"], "event.source.kind");
    v.record(s, "event.source", kind === "fixed" ? ["kind", "definitionId"] : ["kind", "body"]);
    const source = kind === "fixed" ? { kind, definitionId: v.id(s.definitionId, "event.definitionId") } : { kind, body: parseExpeditionEventBody(s.body) };
    return { key: v.id(e.key, "event.key"), basisIds: sources(e.basisIds, "event.basisIds"), source };
  });
  const itemDefinitions = v.list(r.itemDefinitions, "plan.itemDefinitions", C.definitions).map(item => {
    const d = v.record(item, "itemDefinition", ["key", "templateId", "fields"]), fields = v.record(d.fields, "itemDefinition.fields");
    return { key: v.id(d.key, "itemDefinition.key"), templateId: v.id(d.templateId, "itemDefinition.templateId"), fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [v.id(key, "field.key"), v.text(value, "field.value", 8000)])) };
  });
  const endings = v.list(r.endings, "plan.endings", 5).map(item => {
    const e = v.record(item, "ending", ["outcome", "intent", "basisIds", "returnEventIds"]);
    return { outcome: v.choice(e.outcome, EXPEDITION_ENDINGS, "ending.outcome"), intent: v.text(e.intent, "ending.intent", 4000), basisIds: sources(e.basisIds, "ending.basisIds"), returnEventIds: v.ids(e.returnEventIds, "ending.returnEventIds", 16) };
  });
  for (const values of [nodes.map(n => n.id), events.map(e => e.key), itemDefinitions.map(d => d.key), endings.map(e => e.outcome)]) if (new Set(values).size !== values.length) v.invalid("plan", "Duplicate local identity");
  if (endings.length !== 5) v.invalid("plan.endings", "All five conditional endings are required");
  return { ...(r.appraisalItems === undefined ? {} : {appraisalItems: parseAppraisalItems(r.appraisalItems)}), protocol: v.choice(r.protocol, [1], "plan.protocol"), taskId: v.id(r.taskId, "plan.taskId"), inputHash: expeditionDigest(r.inputHash, "plan.inputHash"),
    focus: { kind: v.choice(f.kind, ["commission", "exploration", "new-event"], "focus.kind"), id: f.id === null ? null : v.id(f.id, "focus.id"), intent: v.text(f.intent, "focus.intent", 4000), basisIds: sources(f.basisIds, "focus.basisIds") }, nodes, events, itemDefinitions, endings };
}
export function parseExpeditionThemeReview(raw: unknown): ExpeditionThemeReview {
  bounded(raw);
  const r = v.record(raw, "expedition.review", ["protocol", "proposalHash", "decisions"]);
  const decisions = v.list(r.decisions, "review.decisions", C.events).map(item => {
    const d = v.record(item, "decision", ["eventKey", "verdict", "matchedSourceIds", "reason"]);
    return { eventKey: v.id(d.eventKey, "decision.eventKey"), verdict: v.choice(d.verdict, ["new", "same", "uncertain"], "decision.verdict"), matchedSourceIds: v.ids(d.matchedSourceIds, "decision.matchedSourceIds", 96), reason: v.text(d.reason, "decision.reason", 4000) };
  });
  if (new Set(decisions.map(d => d.eventKey)).size !== decisions.length) v.invalid("review", "Duplicate decision");
  return { protocol: v.choice(r.protocol, [1], "review.protocol"), proposalHash: expeditionDigest(r.proposalHash, "review.proposalHash"), decisions };
}
