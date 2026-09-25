import * as v from "../../game-core/contracts";
import { airpPhaseIndex } from "../../game-core/session";
import type { D5Command, D5GameRecord } from "../versions/d5-contracts";
import type { AirpGameProof } from "./contracts";
import { settlementDigest } from "../../game-core/contracts";
import { sameHead } from "../transaction";
import { validateSettlementSnapshot } from "../airp-settlement/service";
import { validateExpeditionGMSnapshot } from "../airp-expedition-gm/service";
import { assertNodeProgramMayAdvance, validateNodeSnapshot } from "../airp-expedition-play/service";
import { airpGameHash, currentGamePlan, gameHash, projectGameGm, projectGameNode } from "./projection";
import { shareSettlement } from "../airp-settlement/share";
import { pendingHomeBoundary } from "./home";
import { parseGMShare, validateGMShares } from "./gm-share";
import { registeredPatrol, singlePathPatrol } from "../airp-director/commissions";
import { expeditionAppraisalSlots } from "../../game-core/session";
import { gameAppraisal } from "./appraisals";

export function parseAirpGameProof(raw: unknown): AirpGameProof {
  const p = v.record(raw, "airpGameProof", ["version", "kind", "world", "stateHash"], ["settlement", "gmShare"]);
  if (p.settlement !== undefined) {
    const s = v.record(p.settlement, "settlementShare", ["taskId", "assessment", "state", "locationActorIds", "memory", "read"]);
    v.id(s.taskId, "taskId"); v.choice(s.assessment, ["mechanical", "model", "program-only"], "assessment"); v.parseSettlementState(s.state);
    v.record(s.memory, "memory", ["id", "phase", "scope", "points", "opened", "closed"]);
    if (p.kind !== "settlement" || p.world !== true) v.invalid("settlementShare", "Share requires an atomic settlement commit");
  }
  return { version: v.choice(p.version, [1], "version"), kind: v.choice(p.kind, ["prepare", "gm", "node", "settlement"], "kind"), world: v.boolean(p.world, "world"), stateHash: settlementDigest(p.stateHash, "stateHash"), ...(p.settlement === undefined ? {} : { settlement: structuredClone(p.settlement) as AirpGameProof["settlement"] }), ...(p.gmShare === undefined ? {} : { gmShare: parseGMShare(p.gmShare) }) };
}
export function validateAirpGame(r: D5GameRecord, catalog: v.ValidatedD5Catalog): void {
  if (![22, 24, 26, 28].includes(catalog.ref.contentVersion)) return;
  const proofs = r.facts.filter(f => f.kind === "airp-game"), s = r.airpGame;
  if (s === null && !proofs.length) { validateGMShares(r); return; }
  if (!s || !proofs.length) return v.invalid("airpGame", "Missing formal AIRP state/proof");
  v.record(s, "airpGame", ["version", "worldHead", "material", "preparation", "gm", "nodes", "settlement"]);
  if (s.version !== 1 || airpGameHash(s) !== proofs.at(-1)!.payload.stateHash) v.invalid("airpGame", "AIRP state differs from committed proof");
  const latestWorld = [...r.facts].reverse().find(f => f.kind !== "airp-game" || f.payload.world)!;
  if (!sameHead(s.worldHead, latestWorld.source) || !sameHead(s.settlement.state.head, s.worldHead) || s.settlement.state.phase !== airpPhaseIndex(r.snapshot.campaign.clock.day, r.snapshot.campaign.clock.phase)) v.invalid("airpGame", "World projection differs");
  validateSettlementSnapshot({ head: r.head, worldHead: s.worldHead, ledger: s.settlement, appliedItemOperations: [] });
  for (const proof of proofs) if (proof.payload.settlement) {
    const shared = proof.payload.settlement;
    if (!sameHead(shared.state.head, proof.source) || gameHash(shared) !== gameHash(shareSettlement(s.settlement, shared.taskId))) v.invalid("settlementShare", "Daily handoff differs from the committed assessment");
  }
  if (s.preparation) validateExpeditionGMSnapshot(projectGameGm(r, catalog));
  else if (s.gm.jobs.length || Object.keys(s.nodes).length) v.invalid("airpGame", "Expedition jobs lack preparation");
  for (const job of s.gm.jobs) for (const frame of job.frames) if (frame.context.rules.appraisalPlanVersion === 1 &&
    gameHash(frame.context.rules.appraisalSlots) !== gameHash(expeditionAppraisalSlots(catalog, frame.departure)))
    v.invalid("appraisalSlots", "鉴定物规格与本趟程序掉落不符。");
  for (const [id, nodes] of Object.entries(s.nodes)) {
    const plan = s.gm.jobs.find(j => j.id === id && j.status === "started");
    if (!plan) return v.invalid("airpGame.nodes", "Nodes lack their real started plan");
    validateNodeSnapshot({ ...projectGameNode(r, catalog, plan), ledger: nodes });
  }
  validateGMShares(r);
}
/** Same gate applies to UI, restored pending commands and direct application dispatch. */
export function guardAirpGameCommand(r: D5GameRecord, catalog: v.ValidatedD5Catalog, command: D5Command): void {
  if (![22, 24, 26, 28].includes(catalog.ref.contentVersion)) return;
  if (pendingHomeBoundary(r) && command.type !== "airp-director-pause") v.invalid("airpGame", "请先整理本次反馈或选择仅记程序事实。", "command-not-available");
  if (command.type === "sell-loot" && (command.quantity ?? 1) > 1) {
    const item = r.snapshot.campaign.loot?.find(i => i.instanceId === command.instanceId);
    // A static stack must not consume generated instances that share its economic prototype either.
    if (item && r.snapshot.campaign.loot?.some(i => i.definitionId === item.definitionId && i.resultId === item.resultId && gameAppraisal(r, i)))
      v.invalid("loot.quantity", "特殊鉴定物需要逐件出售。", "command-not-available");
  }
  if (command.type === "start-expedition") {
    const plan = currentGamePlan(r), ticket = plan?.departureTicket;
    const { type: _type, ...departure } = command;
    if (!ticket || plan?.status !== "accepted" || !sameHead(ticket.expectedHead, r.head) || ticket.commandHash !== gameHash({ ...departure, itemIds: departure.itemIds ?? [] })) v.invalid("airpGame", "请先完成本次出征安排。", "command-not-available");
    const tasks = r.airpDirector?.events ?? [];
    if (tasks.some(e => e.status === "accepted" && singlePathPatrol(e) && e.actionPhase === null))
      v.invalid("airpGame", "已接委托尚未登记，请更新出征依据后重新生成安排。", "command-not-available");
    const expected = tasks.flatMap(e => {
      const action = e.card.actions[e.actionIndex];
      if (!registeredPatrol(e) || e.binding || action?.kind !== "patrol") return [];
      const target = catalog.data.airpDirector?.capabilities.objectives[action.objectiveId];
      return target?.routeId === departure.routeId ? [{eventId: e.id, stepId: action.id, objectiveId: action.objectiveId, slotId: `slot:${target.layer}:${target.roomIndex}:cleared`}] : [];
    }).sort((a, b) => a.eventId.localeCompare(b.eventId));
    const included = plan.frames.at(-1)!.context.rules.commissions.map(({eventId, stepId, objectiveId, slotId}) => ({eventId, stepId, objectiveId, slotId})).sort((a, b) => a.eventId.localeCompare(b.eventId));
    if (gameHash(expected) !== gameHash(included)) v.invalid("airpGame", "本趟委托已变化，请更新出征依据后重新生成安排。", "command-not-available");
    if (expected.length && plan.frames.at(-1)!.context.rules.commissionRewardVersion !== 1) v.invalid("airpGame", "这份旧安排尚未包含委托物品，请更新出征依据后重新生成。", "command-not-available");
    return;
  }
  if (!r.airpGame) return;
  if (r.airpGame.settlement.jobs.some(j => j.status !== "applied")) v.invalid("airpGame", "请先完成当前场景结算。", "command-not-available");
  if (r.snapshot.run?.kind !== "expedition") return;
  if (command.type === "undo" || command.type === "battle-command" && command.command.type === "undo") v.invalid("airpGame", "已绑定叙事的副本不能回滚已读经历。", "command-not-available");
  const plan = currentGamePlan(r);
  if (!plan || plan.status !== "started") v.invalid("airpGame", "请恢复已保存的出征交接。", "command-not-available");
  assertNodeProgramMayAdvance(projectGameNode(r, catalog, plan));
}
