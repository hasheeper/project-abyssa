import type { ValidatedD5Catalog } from "../../contracts/d5";
import type { D5ExpeditionState } from "../d5-types";
import { createD5ExpeditionEngine, type D5JourneyOperation } from "../d5-expedition";
import { initialD5Projection } from "../d5-progress";
import { layerReady, roomInstance, routeComplete } from "../demo-expedition";
import { tutorialGuideOperation } from "../tutorial-guide";
import { tutorialNextOperation } from "./tutorial-driver";
import { g1Snapshot, type G1TraceRow } from "./tide-guided-g1";

export const G2_CONTENT_DIGEST = "ca185efbd0a0645e51d7e2735cab4d69382697f330b06584169d376a7a104f09";
export const G2_STANDARD_OPERATION_DIGEST = "66633183503a6e29d50bb884f316c62329dd4d27f920706b8b941da03607d410";

/** Offline driver only: every transition still goes through the public engine. */
export function g2Next(catalog: ValidatedD5Catalog, state: D5ExpeditionState, choice: "A" | "B" | "C" = "A"): D5JourneyOperation | null {
  const t = state.tutorial!;
  if (t.stage === "claimable" || t.stage === "failed") return null;
  if (t.guide?.mode === "guided") {
    const op = tutorialGuideOperation(catalog, state);
    if (op) return op;
    if (t.stage === "active" && state.encounter && (state.encounter.phase === "enemy" || state.encounter.phase === "complete" || state.encounter.phase === "act" && !state.encounter.formation.length)) return {type: "resume"};
    throw Error(`G2 guide deadlocked at ${catalog.data.tutorial!.guide!.steps[t.guide.cursor]?.id}: ${JSON.stringify(g1Snapshot(state))}`);
  }
  if (t.story) {
    const {id: storyId, step} = t.story;
    return {type: "tutorial-read", storyId, step, choice: catalog.data.tutorial!.stories[storyId].choiceStep === step ? choice : "continue"};
  }
  if (state.node === "event") return {type: "event", roomId: roomInstance(state.run), choice: "skip", actorId: null};
  if (state.node === "room-complete") return layerReady(catalog.data, state) || routeComplete(catalog.data, state) ? {type: "resume"} : {type: "advance", roomId: roomInstance(state.run)};
  return tutorialNextOperation(catalog, state, "tactical");
}

export class G2Recorder {
  readonly engine;
  readonly trace: G1TraceRow[] = [];
  readonly states: D5ExpeditionState[] = [];
  readonly initial: ReturnType<typeof g1Snapshot>;
  state: D5ExpeditionState;
  constructor(readonly catalog: ValidatedD5Catalog, seed = 19) {
    this.engine = createD5ExpeditionEngine(catalog);
    const campaign = initialD5Projection(catalog), spec = catalog.data.tutorial!;
    campaign.prologue!.status = "skipped"; campaign.opening!.status = "viewed";
    this.state = this.engine.create(campaign, {runId: "g2-run", routeId: spec.routeId, partyIds: spec.partyIds, itemIds: spec.itemIds, seed});
    this.initial = g1Snapshot(this.state);
  }
  step(operation: D5JourneyOperation, label = "manual") {
    this.states.push(structuredClone(this.state));
    const before = g1Snapshot(this.state), result = this.engine.dispatch(this.state, operation);
    this.state = result.state;
    this.trace.push({label, operation, before, after: g1Snapshot(this.state), events: result.events});
    return result;
  }
  next(choice: "A" | "B" | "C" = "A") {
    const op = g2Next(this.catalog, this.state, choice);
    if (!op) throw Error("No next G2 operation");
    const t = this.state.tutorial!, label = t.guide!.mode === "guided" ? this.catalog.data.tutorial!.guide!.steps[t.guide!.cursor].id : t.story?.id ?? `free.${this.state.run.room}.${this.trace.length}`;
    return this.step(op, label);
  }
  until(done: (state: D5ExpeditionState) => boolean, choice: "A" | "B" | "C" = "A") {
    for (let i = 0; i < 600; i++) { if (done(this.state)) return this; this.next(choice); }
    throw Error("G2 driver exceeded operation budget");
  }
}
