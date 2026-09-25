import { ESTATE_AIRP_CATALOG } from "./estate-context";
import { FACILITIES_AIRP_CATALOG } from "./facilities-context";
import { SHOP_AIRP_CATALOG } from "./shop-wave-context";
import type { AnyGameRecord } from "../game-application";
import { directorEntrance, projectDirectorContext } from "../game-application/airp-director/context";
import { AIRP_DIRECTOR_CATALOG } from "./airp-director-context";
import { AIRP_GAME_CATALOG } from "./airp-game-context";
import { recordMemoryContext } from "../game-application/airp-memory/d5";
export { directorHash } from "../game-core/session";
export { directorStage } from "../game-application/airp-director/jobs";
export { directorTaskGuide, directorTaskBrief } from "../game-application/airp-director/task-guide";
export type { DirectorCommand } from "../game-application/airp-director/contracts";

export function directorSettlementFeedback(record: AnyGameRecord | null, eventId: string): string[] {
  if (record?.schemaVersion !== 4 || !record.airpGame) return [];
  const ledger = record.airpGame.settlement;
  const memory = [...ledger.memories].reverse().find(m => m.scope.eventId === eventId && m.scope.kind === "event");
  if (!memory) return ["本次经历待结算，关系变化和记忆尚未写入。"];
  const receipt = ledger.receipts.find(r => r.memoryId === memory.id);
  const job = receipt && ledger.jobs.find(j => j.id === receipt.taskId);
  const names: Record<string, string> = {marietta: "玛丽埃塔", abyssa: "艾比希斯", elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
  const changes = receipt?.effects.flatMap(e => e.kind === "affinity" && e.delta !== 0 ? [`${names[e.actorId] ?? e.actorId}好感 ${e.delta > 0 ? "+" : ""}${e.delta}`] : []) ?? [];
  return [job?.mode === "program-only" ? "已保存程序事实；本次未评估关系与叙事状态。" : "本次经历与记忆已保存。", ...changes];
}

export function directorView(record: AnyGameRecord | null) {
  if (record?.schemaVersion !== 4 || !record.airpDirector || ![19, 22, 24, 26, 28].includes(record.contentRef.contentVersion)) return null;
  const state = record.airpDirector, campaign = record.snapshot.campaign;
  const context = projectDirectorContext(record.contentRef.contentVersion === 28 ? ESTATE_AIRP_CATALOG : record.contentRef.contentVersion === 26 ? FACILITIES_AIRP_CATALOG : record.contentRef.contentVersion === 24 ? SHOP_AIRP_CATALOG : record.contentRef.contentVersion === 22 ? AIRP_GAME_CATALOG : AIRP_DIRECTOR_CATALOG, state, {head: record.head, before: campaign, after: campaign, facts: record.facts, group: [], retracted: record.retractedFactIds,
    run: record.snapshot.run?.kind === "expedition" ? record.snapshot.run.state : null});
  return {state, context, memoryDiagnostics: recordMemoryContext(record)?.diagnostics, entrances: state.events.flatMap(event => {const entrance = directorEntrance(event, context); return entrance ? [{...entrance, event}] : [];})};
}
