import type { AirpReplayInput } from "../versions/airp-boundary";
import type { DirectorEvent, DirectorJob, DirectorSceneContext } from "./contracts";

/** No interpretation of generated narration: only committed event/run state and read identities. */
export function directorSceneProgress(e: DirectorEvent, input: AirpReplayInput, readJobs: DirectorJob[], includeReturnParty = false): NonNullable<DirectorSceneContext["progress"]> {
  const effective = input.facts.filter(f => !input.retracted.includes(f.id));
  const ended = [...effective].reverse().find(f => e.evidenceIds.includes(f.id) && f.kind === "progression" && f.payload.type === "expedition-settled");
  const terminal = ended?.kind === "progression" && ended.payload.type === "expedition-settled" ? ended.payload.terminal : null;
  return structuredClone({ status: e.status, actionIndex: e.actionIndex, actionCount: e.card.actions.length,
    actionKind: e.card.actions[e.actionIndex]?.kind ?? null, actionOutcome: e.actionOutcome,
    delivery: e.delivery ?? null,
    runResult: terminal ? { runId: terminal.runId, outcome: terminal.outcome, deepestLayer: terminal.deepestLayer, ...(includeReturnParty ? { partyIds: terminal.partyIds } : {}) } : null,
    readScenes: readJobs.map(j => ({ sceneId: j.id, role: j.scene!.role, actionIndex: j.scene!.actionIndex })),
    evidenceIds: e.evidenceIds.filter(id => effective.some(f => f.id === id)) });
}
