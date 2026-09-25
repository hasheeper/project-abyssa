import { canonicalJson, sha256, utf8Size, EXPEDITION_GM_CAPACITY } from "../../game-core/contracts";
import { expeditionPlanHash, expeditionTaskId, validateExpeditionPlanInput } from "../../game-core/session";
import type { D5Departure } from "../../game-core/session";
import type { ExpeditionContext, ExpeditionDocument, ExpeditionFrame, ExpeditionJob, ExpeditionRequest } from "./contracts";
import { ExpeditionGMError } from "./contracts";
import { expeditionOutputSchema, EXPEDITION_INSTRUCTION, EXPEDITION_PROMPT_VERSION, EXPEDITION_REVIEW_INSTRUCTION, APPRAISAL_INSTRUCTION, APPRAISAL_PROMPT_VERSION } from "./prompt";
import { GM_MEMORY_INSTRUCTION, memoryCorrectionSchema } from "../airp-memory/prompt";

export const cloneExpedition = <T>(value: T): T => JSON.parse(canonicalJson(value));
const deny = (message: string): never => { throw new ExpeditionGMError("invalid", message); };
export function validateExpeditionContext(context: ExpeditionContext, documents: ExpeditionDocument[], departure: D5Departure) {
  validateExpeditionPlanInput(context.rules);
  if (context.pendingSettlementIds.length) throw new ExpeditionGMError("pending", "Pending settlement blocks dependent expedition planning");
  const d = context.rules.departure;
  if (expeditionPlanHash(departure) !== d.commandHash || departure.runId !== d.runId || departure.routeId !== d.routeId || canonicalJson(departure.partyIds) !== canonicalJson(d.partyIds) || canonicalJson(departure.itemIds) !== canonicalJson(d.itemIds)) deny("Confirmed departure command changed");
  if (new Set(context.sources.map(s => s.id)).size !== context.sources.length || canonicalJson([...context.rules.sourceIds].sort()) !== canonicalJson(context.sources.map(s => s.id).sort())) deny("Incomplete or duplicate source manifest");
  for (const source of context.sources) if (source.digest !== sha256(source.text) || source.phase > context.rules.phase || !source.evidenceIds.length || !source.knownBy.length) deny("Future, unproved or changed source text");
  if (new Set(documents.map(d => d.id)).size !== documents.length) deny("Duplicate author document");
  for (const doc of documents) if (!doc.text.trim() || sha256(doc.text) !== doc.digest || !doc.triggerIds.length || doc.triggerIds.some(id => ![d.routeId, ...context.requiredActorIds, ...context.rules.sourceIds].includes(id))) deny("Author document must be full, intact and explicitly triggered");
  for (const id of context.requiredActorIds) if (!documents.some(d => d.id === id && d.kind === "character")) deny(`Missing complete actor card: ${id}`);
  if (context.rules.appraisalPlanVersion === 1 && !documents.some(d => d.id === "tibby" && d.kind === "character")) deny("鉴定物规划缺少缇比完整角色卡。");
  if (!documents.some(d => d.kind === "world") || !documents.some(d => d.kind === "player")) deny("Complete player and base world documents are required");
  if (context.gmContext) {
    const g = context.gmContext;
    const memoryCheckpoint = g.memoryContext && g.sourceHead.saveId === context.rules.head.saveId && g.sourceHead.epoch === context.rules.head.epoch && g.sourceHead.revision >= context.rules.head.revision;
    if (g.version !== 1 || g.knowledge !== "gm-only-not-common-npc-knowledge" || !memoryCheckpoint && canonicalJson(g.sourceHead) !== canonicalJson(context.rules.head)) deny("Global GM snapshot identity differs");
    for (const ref of g.documents) if (!documents.some(d => d.id === ref.id && d.digest === ref.sha256)) deny("Global GM original document is missing");
    for (const id of g.capabilities.actorIds) if (!documents.some(d => d.kind === "character" && d.id === id)) deny("Global GM requires all resident character originals");
  }
}
function planMessages(frame: ExpeditionFrame) {
  return [{ role: "system" as const, content: frame.instruction }, { role: "user" as const, content: canonicalJson({ taskId: expeditionTaskId(frame.context.rules), inputHash: frame.inputHash, context: frame.context, documents: frame.documents, outputSchema: frame.outputSchema }) }];
}
export function freezeExpeditionFrame(context: ExpeditionContext, documents: ExpeditionDocument[], departure: D5Departure): ExpeditionFrame {
  validateExpeditionContext(context, documents, departure);
  const inputHash = expeditionPlanHash({ context, documents }), frame: ExpeditionFrame = cloneExpedition({ version: 1, context, documents, departure, inputHash, requestHash: "", instruction: context.rules.commissionRewardVersion === 1 ? EXPEDITION_INSTRUCTION + "\n本输入启用委托实物奖励 v1：每个 commissions 条目必须使用其 itemTemplateId 创建恰好一件物品，并通过 itemKeys 唯一挂到该委托的 objective 节点；不得以无新物品为由省略。目标节点不可设置叙事前置依赖。label 使用模板原名，description 安排符合原委托的发现方式，awardWhen 由你在 room-cleared（目标战斗胜利）与 layer-banked（目标层完成）中选择。物品所在房间与层数遵守原 slotId；不要改变已承诺的位置。此处 itemKeys 是可执行的奖励配置，条件满足时由程序生成唯一实物，跳过对白不影响领取；计划本身不发放。委托物品安全返回后才能交付，团灭全部遗失且可重试。不得添加价格、战斗属性、普通掉落或额外交付奖励。" : EXPEDITION_INSTRUCTION, reviewInstruction: EXPEDITION_REVIEW_INSTRUCTION, promptVersion: EXPEDITION_PROMPT_VERSION, outputSchema: expeditionOutputSchema(context.rules, expeditionTaskId(context.rules), inputHash) });
  if (context.gmContext?.memoryContext) {
    frame.promptVersion = "cl-c-gm-memory-19"; frame.instruction += `\n${GM_MEMORY_INSTRUCTION}`;
    const schema = frame.outputSchema as {properties: Record<string, unknown>};
    schema.properties.memoryCorrections = memoryCorrectionSchema(context.gmContext.memoryContext);
  }
  if (context.rules.appraisalPlanVersion === 1) {
    frame.promptVersion = APPRAISAL_PROMPT_VERSION;
    frame.instruction += `\n${APPRAISAL_INSTRUCTION}`;
  }
  const messages = planMessages(frame);
  if (utf8Size(JSON.stringify(messages)) > EXPEDITION_GM_CAPACITY.inputBytes) throw new ExpeditionGMError("capacity", "Complete input exceeds 2MiB; no author source was truncated");
  frame.requestHash = expeditionPlanHash(messages); return frame;
}
export function compileExpeditionRequest(frame: ExpeditionFrame, index: number, proposal?: NonNullable<ExpeditionJob["prepared"]>["proposal"]): ExpeditionRequest {
  validateExpeditionContext(frame.context, frame.documents, frame.departure);
  if (frame.version !== 1 || !["cl-c-gm-1", EXPEDITION_PROMPT_VERSION, "cl-c-gm-memory-19", APPRAISAL_PROMPT_VERSION].includes(frame.promptVersion) || expeditionPlanHash({ context: frame.context, documents: frame.documents }) !== frame.inputHash || expeditionPlanHash(planMessages(frame)) !== frame.requestHash) deny("Frozen expedition request changed");
  const messages = proposal ? [{ role: "system" as const, content: frame.reviewInstruction }, { role: "user" as const, content: canonicalJson({ proposalHash: expeditionPlanHash(proposal), proposal, themes: frame.context.rules.schedule.themes, reservations: frame.context.rules.schedule.reservations, fixedEvents: frame.context.rules.fixedEvents }) }] : planMessages(frame);
  return { taskId: expeditionTaskId(frame.context.rules), frame: index, stage: proposal ? "review" : "plan", requestHash: expeditionPlanHash(messages), messages };
}
/** Own plan reservations can change while metadata is saved, but source world/materials cannot. */
export function expeditionWorldFingerprint(context: ExpeditionContext, documents: ExpeditionDocument[]) {
  const { schedule: _schedule, ...rules } = context.rules;
  return expeditionPlanHash({ ...context, rules, documents });
}
