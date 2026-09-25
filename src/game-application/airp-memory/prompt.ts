/** S3 extension only; the literary preset and old frozen prompts stay intact. */
import type { MemoryContext } from "./contracts";
export function memoryCorrectionSchema(context: MemoryContext) {
  if (!context.targets.length) return {type: "array", maxItems: 0};
  const id = {enum: context.targets.map(t => t.id)}, hash = {type: "string", pattern: "^[a-f0-9]{64}$"};
  const text = {type: "string", minLength: 1, maxLength: 4000};
  const object = (properties: Record<string, unknown>) => ({type: "object", properties, required: Object.keys(properties), additionalProperties: false});
  const target = {targetId: id, expectedHash: hash};
  return {type: "array", maxItems: 16, items: object({reason: {...text, maxLength: 2000}, basisIds: {type: "array", items: {enum: context.evidence.map(e => e.id)}, minItems: 1, uniqueItems: true}, changes: {type: "array", minItems: 1, maxItems: 16, items: {oneOf: [
    object({kind: {const: "replace-summary"}, ...target, text}), object({kind: {const: "merge-summary"}, ...target, duplicateOf: object(target)}), object({kind: {const: "close-thread"}, ...target}),
  ]}}})};
}
export const GM_MEMORY_INSTRUCTION = `【有效记忆更正】
本次JSON顶层可附memoryCorrections数组，无需更正则省略或[]。只处理memoryContext.targets已有摘要与待办，不要求每次都找出错误。
每组：{reason,basisIds,changes:[{kind:"replace-summary"|"merge-summary"|"close-thread",targetId,expectedHash,text?,duplicateOf?}]}。
targetId、expectedHash从targets逐字复制；替换摘要必填text；合并必填duplicateOf:{targetId,expectedHash}，指向保留摘要；关闭不填text。reason简述问题及依据，basisIds只取memoryContext.evidence。相依变更放同组，同时生效或失效；无关变更分组。
只修与已知事实明确不符的摘要，合并同一事实的重复摘要，关闭已解决待办。不改原正文、玩家选择、角色卡、程序状态、数值资产或旧回执；不依据未执行计划改记忆。保留原说话者、事实／角色声称区分和知情范围，不将仅GM知道的秘密写入公共记忆；合并只限知情范围与归属相同的同义摘要。
若依据当前尚未读完正文，basisIds必须含目录中对应的current:证据ID，该组由程序确认读完后生效；仅依据过去已读内容／程序事实可立即生效。当前正文不能证明尚未发生的接单／交付，待选候选不是证据或承诺。
更正不代替本次结束／续写／日度／副本判断，不增加审批轮次。`;
export const SETTLEMENT_MEMORY_INSTRUCTION = `【承接GM有效记忆】
memoryView.targets是当前有效摘要与未解决待办；closed是已关闭事项；diagnostics仅说明更正状态，不是新增结算内容。
沿用有效结果，不重新评判已生效更正，不从历史原文重新打开同一旧待办。只结算本次确已发生的新增事实和发言；过去已读正文仍是正文，角色发言仍是声称，不因出现在历史中就成为事实。
关闭后确有新承诺可新建待办，必须引用本次新证据；不得仅换措辞／ID复活旧来源。当前任务生命周期由程序跟踪，不另记“之后继续当前任务”类待办。`;
