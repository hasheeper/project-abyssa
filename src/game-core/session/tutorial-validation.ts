import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5BaseExpeditionState, D5ExpeditionState } from "./d5-types";
import type { TutorialLessonEvidence, TutorialOperation, TutorialRunState } from "./tutorial-types";
import { TUTORIAL_LESSONS } from "./tutorial-types";
import { readTutorialGuide, validateGuidedJourney } from "./tutorial-guide-validation";

export function parseTutorialOperation(raw: unknown): TutorialOperation {
  const op = v.record(raw, "tutorial.operation"), type = v.choice(op.type, ["tutorial-read", "tutorial-retry", "tutorial-hints", "tutorial-guide", "tutorial-observe"], "tutorial.type");
  if (type === "tutorial-guide" || type === "tutorial-observe") {
    v.record(op, "tutorial.operation", ["type", "planId", "attempt", ...(type === "tutorial-guide" ? ["mode"] : ["stepId", "basis"])]);
    const common = {planId: v.id(op.planId, "planId"), attempt: v.number(op.attempt, "attempt", 1, 10000)};
    if (type === "tutorial-guide") return {type, ...common, mode: v.choice(op.mode, ["free"], "mode")};
    const basis = v.text(op.basis, "basis", 64);
    if (!/^[a-f0-9]{64}$/.test(basis)) v.invalid("basis", "Expected a current observation digest");
    return {type, ...common, stepId: v.id(op.stepId, "stepId"), basis};
  }
  if (type === "tutorial-hints") {
    v.record(op, "tutorial.operation", ["type", "enabled"]);
    return { type, enabled: v.boolean(op.enabled, "enabled") };
  }
  if (type === "tutorial-retry") {
    v.record(op, "tutorial.operation", ["type", "attempt", "scope"]);
    return { type, attempt: v.number(op.attempt, "attempt", 1, 9999), scope: v.choice(op.scope, ["encounter", "chapter"], "scope") };
  }
  v.record(op, "tutorial.operation", ["type", "storyId", "step", "choice"]);
  return { type, storyId: v.id(op.storyId, "storyId"), step: v.number(op.step, "step", 0, 100), choice: v.choice(op.choice, ["continue", "A", "B", "C"], "choice") };
}

export function validateTutorialRun(catalog: ValidatedD5Catalog, raw: unknown, base: D5BaseExpeditionState,
  readBase: (raw: unknown) => D5BaseExpeditionState): TutorialRunState<D5BaseExpeditionState> {
  const spec = catalog.data.tutorial!;
  const t = v.record(raw, "tutorial", ["stage", "attempt", "continuationSeed", "hintsEnabled", "story", "choices", "readStoryIds", "lessons", "undoLessons", "entry", "checkpoint", ...(spec.guide ? ["guide", "undoGuides"] : [])]);
  const stage = v.choice(t.stage, ["story", "active", "failed", "claimable"], "tutorial.stage");
  const attempt = v.number(t.attempt, "tutorial.attempt", 1, 10000);
  v.number(t.continuationSeed, "tutorial.seed", 0, 0xffffffff);
  v.boolean(t.hintsEnabled, "tutorial.hintsEnabled");
  if (base.run.progress.appliedGrowthIds.length || base.run.progress.equipment.length || v.canonicalJson(base.run.party.map(m => m.id)) !== v.canonicalJson(spec.partyIds)) v.invalid("tutorial.party", "Opening requires the fixed level-one party");
  const lessons = (value: unknown): TutorialLessonEvidence[] => {
    const rows = v.list(value, "tutorial.lessons", TUTORIAL_LESSONS.length);
    const kinds = new Set<string>();
    rows.forEach(row => {
      const e = v.record(row, "lesson", ["kind", "eventId", "encounterId", "attempt"]);
      const kind = v.choice(e.kind, TUTORIAL_LESSONS, "lesson.kind");
      if (kinds.has(kind)) v.invalid("lesson", "Duplicate lesson proof");
      kinds.add(kind);
      for (const key of ["eventId", "encounterId"]) if (!v.id(e[key], key).startsWith(`${base.run.id}:`)) v.invalid("lesson", "Foreign lesson proof");
      v.number(e.attempt, "lesson.attempt", 1, attempt);
    });
    return rows as TutorialLessonEvidence[];
  };
  lessons(t.lessons);
  const undo = v.list(t.undoLessons, "tutorial.undoLessons");
  if (undo.length !== base.undo.length) v.invalid("tutorial.undo", "Lesson checkpoints must match combat undo");
  undo.forEach(lessons);
  const readStoryIds = v.ids(t.readStoryIds, "tutorial.readStoryIds", 7);
  readStoryIds.forEach(id => v.reference(spec.stories, id, "storyId"));
  const choiceKeys = new Set<string>();
  v.list(t.choices, "tutorial.choices", 1).forEach(row => {
    const c = v.record(row, "tutorial.choice", ["storyId", "step", "choice"]);
    const s = v.reference(spec.stories, c.storyId, "storyId");
    if (s.choiceStep !== c.step || choiceKeys.has(`${c.storyId}:${c.step}`)) v.invalid("tutorial.choice", "Foreign or repeated choice");
    choiceKeys.add(`${c.storyId}:${c.step}`); v.choice(c.choice, ["A", "B", "C"], "choice");
  });
  if (stage === "story") {
    const s = v.record(t.story, "tutorial.story", ["id", "step"]);
    const definition = v.reference(spec.stories, s.id, "storyId");
    v.number(s.step, "step", 0, definition.lastStep);
    const after = spec.guide ? spec.guide.nodes[base.run.room]?.storyAfter : spec.interludeStoryIds[base.run.room];
    const expected = base.node === "finished" ? spec.returnStoryIds : base.node === "battle" && base.run.room === 0 ? [spec.arrivalStoryId] : base.node === "room-complete" ? [after] : [];
    if (!expected.includes(s.id as string)) v.invalid("tutorial.story", "Story does not belong to this room");
  } else if (t.story !== null) v.invalid("tutorial.story", "Inactive story cursor");
  if (stage === "failed" && (base.node !== "battle" || base.encounter.phase !== "complete" || base.encounter.outcome !== "wipe")) v.invalid("tutorial.failed", "A real wipe is required");
  if (base.node === "finished" ? base.result.outcome !== "cleared" || !["story", "claimable"].includes(stage) : stage === "claimable") v.invalid("tutorial.return", "Only a full victory can return");
  if (stage === "claimable" && spec.returnStoryIds.some(id => !readStoryIds.includes(id))) v.invalid("tutorial.return", "Return story has not completed");
  const checkpoint = v.record(t.checkpoint, "tutorial.checkpoint", ["state", "lessons", ...(spec.guide ? ["guide"] : [])]);
  lessons(checkpoint.lessons);
  for (const [kind, value] of [["entry", t.entry], ["checkpoint", checkpoint.state]] as const) {
    const saved = readBase(value);
    const checkpointRoom = spec.guide ? spec.guide.nodes.slice(0, base.run.room + 1).reduce((last, n, i) => n.battle !== null ? i : last, 0) : base.run.room;
    if (saved.node !== "battle" || saved.encounter.phase !== "roll" || saved.encounter.round !== 1 || saved.undo.length || saved.run.id !== base.run.id || saved.run.routeId !== spec.routeId || saved.run.room !== (kind === "entry" ? 0 : checkpointRoom)) v.invalid(`tutorial.${kind}`, "Encounter opening checkpoint required");
  }
  if (spec.guide) {
    validateGuidedJourney(catalog, base, t.continuationSeed);
    const guide = readTutorialGuide(catalog, t.guide, base, attempt);
    const savedGuide = readTutorialGuide(catalog, checkpoint.guide, base, attempt);
    if (savedGuide.cursor > guide.cursor || v.canonicalJson(savedGuide.proofs) !== v.canonicalJson(guide.proofs.slice(0, savedGuide.cursor))) v.invalid("guide.checkpoint", "Checkpoint proofs must be an earlier prefix");
    const undoGuides = v.list(t.undoGuides, "guide.undo");
    if (undoGuides.length !== base.undo.length) v.invalid("guide.undo", "Guide undo must match battle undo");
    undoGuides.forEach(g => readTutorialGuide(catalog, g, base, attempt));
  }
  return structuredClone(raw) as TutorialRunState<D5BaseExpeditionState>;
}

export const tutorialPaused = (state: D5ExpeditionState) => !!state.tutorial && state.tutorial.stage !== "active";
