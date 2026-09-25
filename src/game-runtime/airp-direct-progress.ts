import type { D5GameRecord } from "../game-application";
import { directAttemptCapacityReached, nextDirectStage } from "../game-application/airp-direct-gameplay/reducer";
import { airpAtHome } from "../game-application/versions/airp-boundary";
import type { DirectTask } from "../game-application/airp-direct-gameplay/contracts";
import type { AiConfiguration } from "./airp-configuration";
import { completionUrl } from "../game-infrastructure/airp-direct/provider";
export type { DirectTask, DirectStage, DirectAttempt } from "../game-application/airp-direct-gameplay/contracts";

/** A read-only affordance projection, never a substitute for commit validation. */
export function directProgressFacts(record: D5GameRecord, task: DirectTask) {
  const narrative = record.narrative?.version === 2 ? record.narrative : null;
  const reading = narrative?.reading;
  const generating = task.source === "undecided" || task.source === "requested";
  const canGenerate = generating && !task.read && reading?.sceneId === task.sceneId && reading.node === 0 && !reading.completed && airpAtHome(record.snapshot.campaign);
  const canUpdate = task.source === "browser-direct" && !!task.read && !task.memoryId && narrative?.instances.find(i => i.id === task.instanceId)?.status === "resolved";
  const stage = nextDirectStage(task);
  return {task, saveId: record.head.saveId, epoch: record.head.epoch, generating, canGenerate, canUpdate,
    capacityReached: !!stage && directAttemptCapacityReached(task, stage)};
}
export type DirectProgressFacts = ReturnType<typeof directProgressFacts>;

/** Configuration presence only: never probes an endpoint or claims connectivity. */
export function directConnectionIssue(record: D5GameRecord, task: DirectTask, config: AiConfiguration): string | null {
  const frozen = task.materialHash ? record.airpDirect?.materials[task.materialHash] : undefined;
  const slots = task.source === "browser-direct" ? ["updater"] as const : ["planning", "writing", "updater"] as const;
  for (const slot of slots) {
    const key = config.separate[slot] ? config.keys[slot] : config.commonKey;
    if (!key.trim() || /[\r\n]/.test(key)) return "请在设置中填写并保存本任务的连接。";
    const baseUrl = config.separate[slot] ? config.models[slot].baseUrl : config.baseUrl;
    try {
      const endpoint = completionUrl(baseUrl);
      if (frozen && endpoint !== completionUrl(frozen.models[slot].baseUrl)) return "续跑需要原冻结端点的Key，新设置不会替换本任务。";
    } catch {return "请检查API地址，使用HTTPS或本机接口。";}
    if (!(frozen?.models[slot].model ?? config.models[slot].model).trim()) return "请补充模型ID。";
  }
  if (!frozen && !config.orderId) return "请在AI设置选择预设执行顺序。";
  return null;
}
