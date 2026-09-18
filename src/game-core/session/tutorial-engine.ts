import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import type { DemoEvent } from "../battle/domain/demo-state";
import { createBattleRngState } from "../battle/persistence/rng";
import type { D5BaseExpeditionState, D5ExpeditionState } from "./d5-types";
import type { D5JourneyOperation } from "./d5-journey-contracts";
import type { TutorialLesson, TutorialOperation, TutorialRunState } from "./tutorial-types";
import { journeyEvent } from "./demo-expedition";
import { advanceTutorialGuide, initialTutorialGuide, tutorialGuideAllows, tutorialNode } from "./tutorial-guide";

export function beginTutorial(base: D5BaseExpeditionState, catalog: ValidatedD5Catalog, continuationSeed: number): D5ExpeditionState {
  const spec = catalog.data.tutorial!;
  const guide = spec.guide && initialTutorialGuide(spec.guide);
  return { ...base, tutorial: {
    stage: "story", attempt: 1, continuationSeed: spec.guide?.continuationSeed ?? continuationSeed, hintsEnabled: true,
    story: { id: spec.arrivalStoryId, step: 0 }, choices: [], readStoryIds: [], lessons: [], undoLessons: [],
    entry: structuredClone(base), checkpoint: { state: structuredClone(base), lessons: [], ...(guide ? {guide: structuredClone(guide)} : {}) },
    ...(guide ? {guide, undoGuides: []} : {}),
  } };
}

type BaseOperation = Exclude<D5JourneyOperation, TutorialOperation>;
type ResolveBase = (state: D5BaseExpeditionState, operation: BaseOperation) => { state: D5BaseExpeditionState; events: DemoEvent[] };

/** Journey policy only: dice, targets, damage, resources and terminals remain the ordinary rules. */
export function resolveTutorial(catalog: ValidatedD5Catalog, input: D5ExpeditionState, operation: D5JourneyOperation, resolveBase: ResolveBase) {
  const plan = catalog.data.tutorial!.guide;
  if (!plan) return resolveTutorialPolicy(catalog, input, operation, resolveBase);
  const saved = input.tutorial!, guide = saved.guide!;
  if (operation.type === "tutorial-guide") {
    if (operation.planId !== plan.id || operation.attempt !== saved.attempt || guide.mode !== "guided" || !["active", "story"].includes(saved.stage)) v.invalid("tutorial.guide", "Stale or inactive guide", "command-not-available");
    const state = structuredClone(input), g = state.tutorial!.guide!;
    const event = journeyEvent(state, "tutorial-guide-exited", {planId: plan.id, attempt: saved.attempt, stepId: plan.steps[guide.cursor].id});
    g.mode = "free"; g.reason = "exited"; g.exitEventId = event.id;
    return {state, events: [event]};
  }
  if (!tutorialGuideAllows(catalog, input, operation)) v.invalid("tutorial.guide", "Follow the current step or explicitly leave guided mode", "command-not-available");
  if (operation.type === "tutorial-observe") {
    if (guide.mode !== "guided") v.invalid("tutorial.observe", "No active observation step", "command-not-available");
    const state = structuredClone(input);
    const event = journeyEvent(state, "tutorial-observed", {stepId: operation.stepId, basis: operation.basis, attempt: operation.attempt});
    advanceTutorialGuide(catalog, input, state, [event], true);
    return {state, events: [event]};
  }
  const result = resolveTutorialPolicy(catalog, input, operation, resolveBase), t = result.state.tutorial!;
  if (operation.type === "tutorial-retry") {
    t.guide = structuredClone(operation.scope === "chapter" ? initialTutorialGuide(plan) : saved.checkpoint.guide!);
    if (guide.reason === "exited") Object.assign(t.guide, {mode: "free", reason: "exited", exitEventId: guide.exitEventId});
    t.undoGuides = [];
    if (operation.scope === "chapter") t.checkpoint.guide = structuredClone(t.guide);
    return result;
  }
  if (operation.type === "tutorial-hints") return result;
  if (operation.type === "battle" && operation.command.type === "undo") {
    const previous = t.undoGuides!.pop();
    if (!previous) v.invalid("tutorial.undo", "Missing guide checkpoint");
    t.guide = previous;
    // Closing guidance is a user preference, not a retractable combat action.
    if (guide.reason === "exited") Object.assign(t.guide, {mode: "free", reason: "exited", exitEventId: guide.exitEventId});
  } else {
    if (result.state.undo.length > input.undo.length) t.undoGuides!.push(structuredClone(guide));
    else if (!result.state.undo.length) t.undoGuides = [];
    if (operation.type === "advance" && result.state.node === "event") result.events.push(journeyEvent(result.state, "tutorial-node-entered", {roomId: result.state.run.roomIds[0][result.state.run.room], nodeId: tutorialNode(catalog, result.state)!.roomId}));
    if (guide.mode === "guided") {
      const step = plan.steps[guide.cursor];
      if (operation.type !== "resume" || step.input.kind === "automatic") advanceTutorialGuide(catalog, input, result.state, result.events, operation.type !== "resume");
    }
  }
  if (operation.type === "advance" && result.state.node === "battle") t.checkpoint.guide = structuredClone(t.guide!);
  if (operation.type === "tutorial-read" && operation.storyId === catalog.data.tutorial!.arrivalStoryId && result.state.node === "battle") {
    const {tutorial: _, ...base} = result.state;
    t.checkpoint = {state: structuredClone(base), lessons: structuredClone(t.lessons), guide: structuredClone(t.guide!)};
  }
  return result;
}

function resolveTutorialPolicy(catalog: ValidatedD5Catalog, input: D5ExpeditionState, operation: D5JourneyOperation, resolveBase: ResolveBase): {state: D5ExpeditionState; events: DemoEvent[]} {
  const { tutorial: saved, ...original } = input;
  const t = structuredClone(saved!), spec = catalog.data.tutorial!;
  let base: D5BaseExpeditionState = structuredClone(original);
  const local = (type: string, payload: DemoEvent["payload"]) => ({ state: { ...base, tutorial: t }, events: [journeyEvent(base, type, payload)] });
  if (operation.type === "tutorial-guide" || operation.type === "tutorial-observe") v.invalid("tutorial.guide", "This content has no guided command protocol", "content-unavailable");
  if (operation.type === "tutorial-hints") {
    t.hintsEnabled = operation.enabled;
    return local("tutorial-hints-changed", { enabled: operation.enabled });
  }
  if (operation.type === "tutorial-read") {
    const cursor = t.story;
    if (t.stage !== "story" || !cursor || cursor.id !== operation.storyId || cursor.step !== operation.step) v.invalid("tutorial.story", "Stale or inactive story cursor", "command-not-available");
    const definition = spec.stories[cursor.id];
    if (definition.choiceStep === cursor.step) {
      const previous = t.choices.find(c => c.storyId === cursor.id && c.step === cursor.step);
      if (previous ? operation.choice !== previous.choice && operation.choice !== "continue" : operation.choice === "continue") v.invalid("tutorial.choice", "Choose an action; retries retain the original choice");
      if (!previous && operation.choice !== "continue") t.choices.push({ storyId: cursor.id, step: cursor.step, choice: operation.choice });
    } else if (operation.choice !== "continue") v.invalid("tutorial.choice", "This beat has no decision");
    if (cursor.step < definition.lastStep) cursor.step++;
    else {
      if (!t.readStoryIds.includes(cursor.id)) t.readStoryIds.push(cursor.id);
      const returnIndex = spec.returnStoryIds.indexOf(cursor.id);
      const next = returnIndex >= 0 ? spec.returnStoryIds[returnIndex + 1] : undefined;
      t.story = next ? { id: next, step: 0 } : null;
      t.stage = next ? "story" : returnIndex >= 0 ? "claimable" : "active";
    }
    return local("tutorial-story-read", { storyId: operation.storyId, step: operation.step, choice: operation.choice });
  }
  if (operation.type === "tutorial-retry") {
    if (t.stage !== "failed" || operation.attempt !== t.attempt) v.invalid("tutorial.retry", "Retry requires the current failed attempt", "command-not-available");
    const sequence = base.run.sequence;
    base = structuredClone(operation.scope === "chapter" ? t.entry : t.checkpoint.state);
    // Resource/RNG rewind is exact; event identities remain monotonic across attempts.
    base.run.sequence = sequence;
    t.attempt++; t.undoLessons = [];
    t.lessons = operation.scope === "chapter" ? [] : structuredClone(t.checkpoint.lessons);
    t.story = operation.scope === "chapter" ? { id: spec.arrivalStoryId, step: 0 } : null;
    t.stage = t.story ? "story" : "active";
    if (operation.scope === "chapter") t.checkpoint = { state: structuredClone(base), lessons: [] };
    return local("tutorial-retried", { scope: operation.scope, attempt: t.attempt });
  }
  if (t.stage !== "active") v.invalid("tutorial.stage", "Finish the current story or choose retry", "command-not-available");
  if (operation.type === "exit" || operation.type === "event" && !spec.guide) v.invalid("tutorial.route", "This route has no exit or dice-event room");
  if (operation.type === "resume" && base.node === "battle" && base.encounter.phase === "complete" && base.encounter.outcome === "wipe") {
    t.stage = "failed"; t.undoLessons = [];
    return local("tutorial-failed", { attempt: t.attempt, roomId: base.run.roomIds[0][base.run.room] });
  }
  // T1 uses the opening seed; T2 onward keeps the saved continuation seed (authored in v11).
  if (operation.type === "advance" && base.run.room === 0) {
    base.run.rng = createBattleRngState(t.continuationSeed);
    base.run.eventRng = createBattleRngState(spec.guide?.eventSeed ?? ((t.continuationSeed ^ 0x3c6ef372) >>> 0)).combat;
  }
  const result = resolveBase(base, operation), next = result.state;
  if (operation.type === "battle" && operation.command.type === "undo") {
    const prior = t.undoLessons.pop();
    if (!prior) v.invalid("tutorial.undo", "Missing lesson checkpoint");
    t.lessons = prior;
  } else {
    if (next.undo.length > base.undo.length) t.undoLessons.push(structuredClone(t.lessons));
    else if (!next.undo.length) t.undoLessons = [];
    collectLessons(t, base, result.events);
  }
  if (operation.type === "advance" && next.node === "battle") t.checkpoint = { state: structuredClone(next), lessons: structuredClone(t.lessons) };
  const storyAfter = spec.guide ? tutorialNode(catalog, next)?.storyAfter : spec.interludeStoryIds[next.run.room];
  if (base.node === "battle" && next.node === "room-complete" && storyAfter) {
    t.stage = "story"; t.story = { id: storyAfter, step: 0 };
  }
  if (next.node === "finished") {
    if (next.result.outcome !== "cleared") v.invalid("tutorial.result", "Failed attempts cannot settle");
    t.stage = "story"; t.story = { id: spec.returnStoryIds[0], step: 0 };
  }
  return { state: { ...next, tutorial: t }, events: result.events };
}

function collectLessons(t: TutorialRunState<D5BaseExpeditionState>, before: D5BaseExpeditionState, events: DemoEvent[]) {
  for (const event of events) {
    const payload = v.record(event.payload, "tutorial.event");
    const kinds: TutorialLesson[] = [];
    if (event.type === "dice-rolled") {
      if (!payload.reroll) kinds.push("roll");
      else if (before.encounter?.dice.some(d => d.loaded && !d.spent)) kinds.push("reroll");
    }
    if (event.type === "die-fixed" && payload.loaded) kinds.push("fix");
    if (event.type === "action-resolved") kinds.push("action");
    if (event.type === "hand-settled") { kinds.push("end-turn"); if (payload.name !== "散牌") kinds.push("hand"); }
    if (event.type === "guard-applied") kinds.push("guard");
    if (event.type === "healing-applied") kinds.push("heal");
    if (event.type === "item-used") kinds.push("item");
    if (event.type === "covenant-triggered") kinds.push("covenant");
    for (const kind of kinds) if (!t.lessons.some(e => e.kind === kind)) t.lessons.push({ kind, eventId: event.id, encounterId: before.node === "battle" ? before.encounter.id : `${before.run.id}:encounter:${before.run.encounterSequence}`, attempt: t.attempt });
  }
}
