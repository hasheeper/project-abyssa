import type { ValidatedD5Catalog } from "../contracts/d5";
import type { TutorialGuideDefinition, TutorialGuideStep } from "../contracts/tutorial-guide";
import type { TutorialGuideState } from "./tutorial-types";
import type { D5ExpeditionState } from "./d5-types";
import type { D5JourneyOperation } from "./d5-journey-contracts";
import type { DemoEvent } from "../battle/domain/demo-state";
import { asDemoBattle, layerReady, roomInstance } from "./demo-expedition";
import { demoActionOptions } from "../battle/rules/v2/combat";
import { demoItemTargets } from "./demo-items-events";
import { sha256 } from "../contracts/sha256";
import * as v from "../contracts/validation";

export function initialTutorialGuide(plan: TutorialGuideDefinition): TutorialGuideState {
  return {version: 1, planId: plan.id, mode: "guided", reason: null, cursor: 0, proofs: [], exitEventId: null};
}
export function tutorialNode(catalog: ValidatedD5Catalog, state: Pick<D5ExpeditionState, "run">) {
  const id = catalog.data.routes[state.run.routeId].layers[state.run.layer - 1][state.run.room];
  return catalog.data.tutorial?.guide?.nodes.find(n => n.roomId === id) ?? null;
}
export function tutorialGuideBasis(state: D5ExpeditionState, step: TutorialGuideStep) {
  return sha256(v.canonicalJson({runId: state.run.id, sequence: state.run.sequence, attempt: state.tutorial!.attempt,
    planId: state.tutorial!.guide!.planId, stepId: step.id, roomId: roomInstance(state.run), result: state.run.eventResults.at(-1) ?? null}));
}

/** A read-only description of the next permitted player command. It never executes it. */
export function tutorialGuideOperation(catalog: ValidatedD5Catalog, state: D5ExpeditionState): D5JourneyOperation | null {
  const t = state.tutorial, guide = t?.guide, plan = catalog.data.tutorial?.guide;
  if (!guide || !plan || guide.mode !== "guided" || t!.stage === "failed") return null;
  const step = plan.steps[guide.cursor], i = step?.input;
  if (!step || !i || tutorialNode(catalog, state)?.roomId !== step.roomId || step.round !== null && step.round !== state.encounter?.round) return null;
  if (i.kind === "automatic") return null;
  if (i.kind === "story") return t!.stage === "story" && t!.story?.id === i.storyId
    ? {type: "tutorial-read", storyId: i.storyId, step: t!.story.step, choice: "continue"} : null;
  if (t!.stage !== "active") return null;
  if (i.kind === "advance") return state.node === "room-complete" && !layerReady(catalog.data, state) ? {type: "advance", roomId: roomInstance(state.run)} : null;
  if (i.kind === "observe-result") return state.node === "room-complete" && state.run.eventResults.some(r => r.roomId === roomInstance(state.run))
    ? {type: "tutorial-observe", planId: plan.id, stepId: step.id, attempt: t!.attempt, basis: tutorialGuideBasis(state, step)} : null;
  if (i.kind === "event") return state.node === "event" && state.run.party.some(m => m.id === i.actorId && m.hp > 0)
    ? {type: "event", roomId: roomInstance(state.run), choice: "attempt", actorId: i.actorId} : null;
  if (i.kind === "item") {
    const item = state.run.supplies.find(s => s.definitionId === i.definitionId);
    const target = item && demoItemTargets(catalog, state, item.instanceId).find(t => t.kind === "member" && t.id === i.actorId);
    return item && target ? {type: "item", instanceId: item.instanceId, target} : null;
  }
  const battle = asDemoBattle(state);
  if (!battle) return null;
  const enc = battle.encounter;
  if (i.kind === "roll") return enc.phase === "roll" ? {type: "battle", command: {type: "roll"}} : null;
  if (enc.phase !== "act" || !enc.formation.length) return null;
  if (i.kind === "end-turn") return {type: "battle", command: {type: "end-turn"}};
  if (i.kind === "reroll") return enc.rerolls > 0 && enc.dice.some(d => !d.loaded && !d.spent && !d.sealed && state.run.party.some(m => m.id === d.ownerId && m.hp > 0)) ? {type: "battle", command: {type: "reroll"}} : null;
  if (i.kind === "fix") {
    const die = enc.dice.find(d => d.ownerId === i.actorId);
    return die && !die.loaded && !die.spent && !die.sealed && die.faceIndex !== null && state.run.party.some(m => m.id === i.actorId && m.hp > 0)
      ? {type: "battle", command: {type: "toggle-load", actorId: i.actorId}} : null;
  }
  if (i.kind === "act") {
    const target = i.target;
    const targetId = target.kind === "member" ? target.id : enc.enemies.filter(e => e.definitionId === target.definitionId)[target.ordinal]?.id;
    return targetId && demoActionOptions(catalog.data, battle, i.actorId).options.some(o => o.choice === i.choice && o.targetId === targetId)
      ? {type: "battle", command: {type: "act", actorId: i.actorId, choice: i.choice, targetId}} : null;
  }
  return null;
}

export function guideEvidence(step: TutorialGuideStep, events: DemoEvent[]) {
  const matches = (event: DemoEvent, rule: TutorialGuideStep["evidence"][number]) => {
    const payload = v.record(event.payload, "guide.event.payload");
    return event.type === rule.type && (rule.actorId === undefined || event.actorId === rule.actorId) && Object.entries(rule.payload ?? {}).every(([key,value]) => payload[key] === value);
  };
  if (!step.evidence.every(rule => events.some(e => matches(e, rule)))) return null;
  return events.filter(e => step.evidence.some(rule => matches(e, rule))).map(e => e.id);
}

export function advanceTutorialGuide(catalog: ValidatedD5Catalog, before: D5ExpeditionState, after: D5ExpeditionState, events: DemoEvent[], required: boolean) {
  const guide = after.tutorial!.guide!, plan = catalog.data.tutorial!.guide!;
  if (guide.mode !== "guided") return;
  const step = plan.steps[guide.cursor], eventIds = guideEvidence(step, events);
  if (!eventIds) { if (required) v.invalid("tutorial.guide.proof", "The real operation did not produce the authored evidence"); return; }
  const node = plan.nodes.find(n => n.roomId === step.roomId)!;
  guide.proofs.push({stepId: step.id, roomId: roomInstance(before.run), encounterId: node.battle ? `${before.run.id}:encounter:${node.battle}` : null, attempt: before.tutorial!.attempt, eventIds});
  guide.cursor++;
  if (guide.cursor === plan.steps.length) { guide.mode = "free"; guide.reason = "completed"; }
}

/** This is only the guide restriction. Ordinary battle/item legality still applies. */
export function tutorialGuideAllows(catalog: ValidatedD5Catalog, state: D5ExpeditionState, operation: D5JourneyOperation) {
  if (!state.tutorial?.guide || state.tutorial.guide.mode === "free") return true;
  if (operation.type === "resume" || operation.type === "tutorial-hints" || operation.type === "tutorial-retry" || operation.type === "tutorial-guide" || operation.type === "battle" && operation.command.type === "undo") return true;
  const expected = tutorialGuideOperation(catalog, state);
  return expected !== null && v.canonicalJson(operation) === v.canonicalJson(expected);
}
