import { canonicalJson, demoRoom, type ValidatedD5Catalog } from "../../game-core/contracts";
import { airpPhaseIndex, expeditionPlanHash } from "../../game-core/session";
import { check } from "../airp-generation/contracts";
import type { HeadRef } from "../contracts";
import type { D5GameRecord } from "../versions/d5-contracts";
import { sameHead } from "../transaction";
import type { ExpeditionJob } from "../airp-expedition-gm/contracts";
import type { NodeProgram, NodeSource } from "./contracts";
import { nodePosition } from "./context";
import { publicGameAppraisal } from "../airp-game/appraisals";

/** Owner records this association in the SAME root commit as the legacy gameplay calculation. */
export type NodeProgramCommit = { head: HeadRef; before: HeadRef; factIds: string[]; gameplayHead: HeadRef };
export function projectD5NodeProgram(options: { catalog: ValidatedD5Catalog; record: D5GameRecord; plan: ExpeditionJob; commits: NodeProgramCommit[] }): NodeProgram {
  const { catalog, record, plan, commits } = options;
  check([19, 22, 24, 26, 28].includes(catalog.ref.contentVersion) && expeditionPlanHash(record.contentRef) === expeditionPlanHash(catalog.ref), "Use validated content19 or formal content22 adapter");
  const frame = plan.frames.at(-1)!, runId = frame.departure.runId;
  const effective = record.facts.filter(f => f.runRef?.id === runId && !record.retractedFactIds.includes(f.id) && record.commits.some(c => sameHead(c.ref, f.source) && c.factIds.includes(f.id)));
  const mapped = (factId: string) => { const f = effective.find(f => f.id === factId), c = commits.find(c => c.factIds.includes(factId) && f && sameHead(c.gameplayHead, f.source)); check(f && c, "Missing atomic owner/gameplay provenance"); return c; };
  const start = effective.find(f => f.kind === "journey" && f.payload.operation.type === "start"); check(start && start.kind === "journey" && start.payload.operation.type === "start", "No actual departure fact");
  const active = record.snapshot.run, end = [...effective].reverse().find(f => f.kind === "progression" && f.payload.type === "expedition-settled");
  const state = active?.kind === "expedition" && active.id === runId ? active.state : end?.kind === "progression" && end.payload.type === "expedition-settled" ? end.payload.finalRun : null;
  check(state && state.run.routeId === frame.departure.routeId, "No matching real run state");
  const room = demoRoom(catalog.data, state.run.routeId, state.run.layer, state.run.room), timing = state.node === "exit" ? "exit" : state.node === "room-complete" || state.node === "finished" ? "cleared" : "arrive";
  const slotId = `slot:${state.run.layer}:${state.run.room}:${timing}`, party = state.run.party.map(p => p.id), alive = state.run.party.filter(p => p.hp > 0).map(p => p.id);
  const latest = effective.at(-1)!; const phase = airpPhaseIndex(record.snapshot.campaign.clock.day, record.snapshot.campaign.clock.phase);
  const objectiveProgress: NodeProgram["objectiveProgress"] = frame.context.rules.commissions.map(c => {
    const slot = frame.context.rules.slots.find(s => s.id === c.slotId)!;
    const targetRoomId = state.run.roomIds[slot.layer - 1]?.[slot.roomIndex];
    const physical = frame.context.rules.commissionRewardVersion === 1;
    const proof = effective.find(f => f.kind === "journey" && f.payload.events.some(e => physical ? e.type === "commission-item-found" && (e.payload as {eventId?: string}).eventId === c.eventId : e.type === "room-completed" && (e.payload as { roomId?: string }).roomId === targetRoomId));
    return { eventId: c.eventId, objectiveId: c.objectiveId, conditionMet: !!proof, evidenceId: proof?.id ?? null,
      returned: physical ? state.node === "finished" && !!state.result.commissionRewards?.returned.some(i => i.eventId === c.eventId) : !!proof && state.node === "finished" && ["cleared", "extracted"].includes(state.result.outcome),
      delivery: record.airpDirector?.events.find(e => e.id === c.eventId)?.delivery?.status ?? "not-confirmed", noAdditionalReward: true };
  });
  const source: NodeSource = { id: `state:${latest.id}`, head: mapped(latest.id).head, phase, runId, knownBy: party,
    text: canonicalJson({ kind: "actual-current-room", routeId: state.run.routeId, roomDefinitionId: room.id, sceneId: room.sceneId, layer: state.run.layer, room: state.run.room, node: state.node,
      party: state.run.party.map(p => ({ id: p.id, hp: p.hp, maxHp: p.config.maxHp })), supplies: state.run.supplies.map(s => ({ definitionId: s.definitionId, charges: s.charges })), eventClosed: false, objectiveProgress,
      ...(state.node === "finished" ? { actualOutcome: state.result.outcome, unperformedActionsRemainUnperformed: true } : {}),
      ...([22, 24, 26, 28].includes(catalog.ref.contentVersion) ? { actualLoot: (state.run.carriedLoot ?? []).map(drop => ({ instanceId: drop.instanceId, roomId: drop.roomId,
        knownResultId: catalog.data.loot!.definitions[drop.definitionId].initiallyKnown ? catalog.data.loot!.definitions[drop.definitionId].resultId : null,
        ...(frame.context.rules.appraisalPlanVersion === 1 ? (() => { const copy = publicGameAppraisal(record, drop); return copy ? {unknownName: copy.unknownName, appearance: copy.appearance} : {}; })() : {}) })),
        ...(state.run.commissionRewards ? {questItems: state.run.commissionRewards.items, questReturn: state.node === "finished" ? state.result.commissionRewards?.returned : null} : {}),
        lootAuthority: "already-issued-by-program; unidentified items remain unknown; no extra narrative reward" } : {}) }) };
  const actions: NodeProgram["actions"] = [];
  for (const f of effective) {
    if (f.kind !== "journey" || f.payload.operation.type === "start") continue;
    const op = f.payload.operation, base: NodeSource = { id: f.id, head: mapped(f.id).head, phase: airpPhaseIndex(f.worldTime.day, f.worldTime.phase), runId, knownBy: party, text: "" };
    for (const slot of frame.context.rules.slots) {
      const roomId = state.run.roomIds[slot.layer - 1]?.[slot.roomIndex];
      const actionId = op.type === "exit" && op.roomId === roomId && slot.timing === "exit" ? op.choice
        : op.type === "advance" && op.roomId === roomId && slot.timing === "cleared" ? "continue"
        : op.type === "event" && op.roomId === roomId && slot.timing === "arrive" ? op.choice === "skip" ? "event-leave" : "event-enter"
        : slot.timing === "arrive" && f.payload.events.some(e => e.type === "room-completed" && (e.payload as { roomId?: string }).roomId === roomId) ? "continue" : null;
      if (actionId) actions.push({ ...base, slotId: slot.id, actionId, text: canonicalJson({ kind: "actual-program-action", slotId: slot.id, actionId, operation: op.type, eventClosed: false, noAdditionalReward: true }) });
    }
  }
  const terminal = state.node === "finished" ? state.result.outcome : null;
  const {commissionRewards: _rewards, ...playerDeparture} = start.payload.operation.input;
  return { runId, routeId: state.run.routeId, phase, position: nodePosition({ layer: state.run.layer, roomIndex: state.run.room, timing }), slotIds: terminal ? [] : [slotId], actorIds: alive, terminal, sources: [source], objectiveProgress, actions,
    start: { factId: start.id, commandHash: expeditionPlanHash(playerDeparture), beforeHead: mapped(start.id).before },
    events: (record.airpDirector?.events ?? []).map(e => ({ id: e.id, status: ["offered", "accepted", "waiting-action", "feedback", "ready"].includes(e.status) ? e.status === "offered" ? "offered" : "accepted" : "closed" })) };
}
