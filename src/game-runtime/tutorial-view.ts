import type { D5GameRecord } from "../game-application/versions/d5-contracts";
import type { ValidatedD5Catalog } from "../game-core/contracts";
import { tutorialGuideOperation, tutorialNode } from "../game-core/session/tutorial-guide";
import { canonicalJson } from "../game-core/contracts";
import type { D5JourneyOperation } from "../game-core/session/d5-journey-contracts";

/** O3 consumes this projection; no page infers lesson completion or manufactures a checkpoint. */
export function tutorialView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const spec = catalog.data.tutorial, campaign = record.snapshot.campaign;
  if (!spec || !campaign.tutorial) return null;
  const run = record.snapshot.run?.kind === "expedition" ? record.snapshot.run : null;
  const state = run?.state.tutorial;
  return {
    progress: campaign.tutorial, routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds,
    runRef: state ? { kind: "expedition" as const, id: run!.id } : null,
    stage: state?.stage ?? null, attempt: state?.attempt ?? null,
    story: state?.story ?? null, choices: state?.choices ?? [], readStoryIds: state?.readStoryIds ?? [],
    lessons: state?.lessons ?? [], hintsEnabled: state?.hintsEnabled ?? true,
    encounter: state ? spec.guide ? tutorialNode(catalog, run!.state)?.battle ?? null : run!.state.run.room + 1 : null,
    node: state && spec.guide ? {...tutorialNode(catalog, run!.state)!, kind: run!.state.node} : null,
    guide: state?.guide ? {
      ...state.guide, step: state.guide.mode === "guided" ? spec.guide!.steps[state.guide.cursor] : null,
      operation: tutorialGuideOperation(catalog, run!.state),
      canExit: state.guide.mode === "guided" && ["active", "story"].includes(state.stage),
      canUndo: state.stage === "active" && run!.state.encounter?.phase === "act" && !!run!.state.encounter.formation.length && run!.state.undo.length > 0,
    } : null,
    canBegin: campaign.tutorial.status === "pending" && campaign.opening?.status !== "playing" && campaign.prologue?.status !== "playing" && !campaign.activeRunRef && !campaign.activeStoryId,
    canRetry: state?.stage === "failed", canClaim: state?.stage === "claimable",
    reward: spec.reward,
  };
}

/** UI affordances mirror this projection, without importing validation or rule engines. */
export function tutorialOperationAllowed(view: ReturnType<typeof tutorialView>, operation: D5JourneyOperation) {
  const guide = view?.guide;
  if (!guide || guide.mode === "free") return true;
  if (operation.type === "battle" && operation.command.type === "undo") return guide.canUndo;
  return !!guide.operation && canonicalJson(guide.operation) === canonicalJson(operation);
}
