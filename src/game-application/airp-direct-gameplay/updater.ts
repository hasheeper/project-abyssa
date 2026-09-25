import * as v from "../../game-core/contracts";
import type { Message } from "../airp-generation/contracts";
import { DIRECT_LIMITS, type DirectMemory, type NarrativeFlags, type UpdateProposal } from "./contracts";

export type ReadText = {lines: {id: string; speaker: string; text: string}[]; facts: {id: string; text: string}[]; memories: DirectMemory[]; flags: NarrativeFlags};
export function updaterInput(input: ReadText, version: 1 | 2 = 2): Message[] {
  // Version 1 is immutable: old saves must reconstruct the exact paid request.
  const clarification = version === 2 ? "\n标记对象补充定义：careOffered的对象必须明确是玩家本人，正文须有艾洛拉提出照看玩家身体、检查玩家状况或伤口的邀请。检查药箱、搭扣、合页、绷带等物件，接收或摆放物件，打招呼、感谢以及仅仅关心平安，都不算careOffered。不能因为出现‘检查’‘交给我’‘如果愿意’就打标；对象不明确时不提出此标记。正例：‘你若愿意，我可以替你看看手上的伤。’只记录邀请，绝不据此认定伤势。反例：‘交给我后，我会先检查药箱搭扣。’不设置careOffered。摘要描述本场已读内容的历史时点；交付是否完成依只读游戏事实，不把场景末尾的等待误写成新的未交付任务。" : "";
  return [{role: "system", content: "你是已读对白的记录整理器，不创作、不规划、不补充世界设定。只返回严格JSON：{\"summary\":\"已读场景的简洁摘要\",\"supports\":[\"段落ID\"],\"flags\":[{\"key\":\"careOffered或routeCautionMentioned\",\"value\":true,\"supports\":[\"段落ID\"]}]}。summary不超过320字符，不必写满；supports必须非空且来自本场正文。无新变量时flags=[]。careOffered只表示艾洛拉提出照看/检查邀请，绝不表示玩家受伤、接受或已治疗。routeCautionMentioned只表示提到路线提醒，不证明路线状态或清场。只允许false→true，不重复已有true。区分已发生动作、NPC邀请和开放事项；不写玩家未作出的决定。禁止金币、道具、关系数值、任务状态及任何额外字段。只读事实优先于可能失实的正文，不能把侧门撤离总结为全清。" + clarification},
    {role: "user", content: JSON.stringify(input)}];
}
export function parseUpdateProposal(text: string, input: ReadText): UpdateProposal {
  const raw: unknown = JSON.parse(text); v.assertJson(raw);
  const r = v.record(raw, "update", ["summary", "supports", "flags"]);
  const summary = v.text(r.summary, "summary", DIRECT_LIMITS.summaryChars);
  if (!summary.trim()) v.invalid("summary", "Empty narrative summary");
  const supports = (raw: unknown) => {
    const ids = v.ids(raw, "supports", 256);
    if (!ids.length || ids.some(id => !input.lines.some(l => l.id === id))) v.invalid("supports", "Only this read scene's paragraph IDs are valid");
    return ids;
  };
  const flags = v.list(r.flags, "flags", 2).map(raw => {
    const f = v.record(raw, "flag", ["key", "value", "supports"]);
    const key = v.choice(f.key, ["careOffered", "routeCautionMentioned"], "flag.key");
    if (f.value !== true || input.flags[key]) v.invalid("flag", "Only a new false-to-true narrative observation is allowed");
    return {key, value: true as const, supports: supports(f.supports)};
  });
  if (new Set(flags.map(f => f.key)).size !== flags.length) v.invalid("flags", "Duplicate variable update");
  return {summary, supports: supports(r.supports), flags};
}
