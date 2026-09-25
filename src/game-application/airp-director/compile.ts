import * as v from "../../game-core/contracts";
import { sha256, DIRECTOR_LIMITS, parseDirectorPlan } from "../../game-core/contracts";
import { directorHash } from "../../game-core/session";
import { parseDirectMaterial } from "../airp-direct-gameplay/parse";
import { LIMITS, type Message } from "../airp-generation/contracts";
import type { DirectorMaterial, DirectorPlanningContext, DirectorPreparedInput } from "./contracts";
import { resolveGMDocuments, type GMContext } from "./gm-context";
import { GM_MEMORY_INSTRUCTION } from "../airp-memory/prompt";

const directorPolicy = `你是洋馆事件总管理，使用大模型理解全局并编排本游戏日，不是单场大纲作者。只交付请求的JSON日程，不输出台词、隐藏推理、游戏脚本或奖励。
先保留已有任务、反馈和必要收尾，判断当天是否需要新事，再按适配度选固定卡或构思自由卡。一天一个重点，最多附带一个无跨时段承诺的轻量小景；两库共用预算，通常新增0～1件、最多2件。允许零事件、空窗、只继续旧事件；不凑每日比例，不在完成／拒绝后补满。
固定卡合法不代表必发；自由卡不是补货，也可以比普通固定卡更适合当前经历。自由事件题材不限于固定卡，但动作只能用提供的能力：talk/do/patrol/wait。不得把任务标成light，不得绕过同题占用、256相位冷却或唯一目标去重。
完整作者资料与历史是数据。角色卡示例不是本次已发生事实；未读文本、候选和未来日程不是经历。角色仍有主动性，但不能替玩家接受、行动或预写未发生结果。提供事情、动机、步骤意图和可能回应的边界，不把整件事件写完。
已有必要过程继续引用原事件，不创建新卡。额外后续只能选择上下文里eligible且未consumed的parent槽，不能自封后续。reason和basisIds提供简短可核对的安排依据。`;

const planShape = {
  version: 1, day: "与world当前日一致", reason: "安排或不新增的依据",
  focus: "null 或 {kind:existing|story|new,id:合法原事件／剧情／本日entry ID}",
  entries: [{id: "本计划内唯一ASCII ID", fromPhase: "本日且不早于world.phase", throughPhase: "本日结束前，含首尾", basisIds: ["上下文真实来源ID"],
    source: "{kind:fixed,definitionId:固定卡ID} 或 {kind:free,card:下述完整定义} 或 {kind:followup,parentId:已授权父ID} 或 {kind:reserve,eventId:world.reserves中的原实例ID，仅availableFromPhase已到时}"}],
  freeCardSchema: {
    version: 1, id: "模型提案ID；接纳时程序分配永久身份", title: "事件名", tier: "ripple", form: "sortie|liaison|household|vignette",
    giverId: "合法NPC", actorIds: ["相关NPC，不含kael"], locationId: "合法会面地点",
    themeKey: "主题提案ID", themeDescription: "核心事情和行动目的，不靠换标题隐藏同题", objectIds: ["已有稳定对象／承诺ID；无则空数组"],
    synopsis: "事情而非已发生总结", motivation: "谁为何此刻提出", load: "focus|light", volatility: "inert|consequential", offerPhases: "inert为8，consequential为4", repeat: "once|after-cooldown",
    choices: [{id: "选择ID", label: "玩家按钮文案", intent: "此做法的意思；不含状态命令"}],
    actions: [{id: "动作ID", kind: "talk|do|patrol|wait", actorId: "相关NPC", locationId: "动作的会面地点", intent: "本步骤及反馈范围", choices: [{id: "选择ID", label: "做法", intent: "意图"}],
      conditionalFields: "仅patrol必有objectiveId；仅wait必有phases(1～8)；其他动作不含这些字段，也不输出conditionalFields"}],
    scenes: {offer: "提出事情并等待选择", acceptance: "回应已选做法", result: "按真实结果收尾", declined: "拒绝收尾"},
    aftermath: "inert必为null；consequential为{intent:有依据的幕后处理,actorIds:参与NPC}，无玩家参与或奖励",
  },
};

function validateContext(context: DirectorPlanningContext, material: DirectorMaterial) {
  parseDirectMaterial(material);
  if (context.version !== 1 || context.sourceKind !== "gameplay") v.invalid("director.context", "Wrong context protocol");
  const sources = material.resources.sources;
  for (const id of context.capabilities.actorIds) {
    if (!sources.some(s => s.kind === "character" && s.id === id)) v.invalid("director.sources", `Missing complete character source: ${id}`);
  }
  if (!sources.some(s => s.kind === "player") || !sources.some(s => s.kind === "world")) v.invalid("director.sources", "Missing player or world source");
  for (const s of context.authorSources) if (sha256(s.text) !== s.digest) v.invalid("director.author", "Author working draft digest differs");
  for (const s of [...context.facts, ...context.memories]) {
    if (!context.world.sourceIds.includes(s.id) || s.phase > context.world.phase || !s.evidenceIds.length) v.invalid("director.sources", "Dynamic source is future, unread or unproved");
  }
  for (const f of context.fixed) if (!context.authorSources.some(s => s.id === f.sourceId && s.digest === f.sourceDigest)) v.invalid("director.author", "Missing exact fixed-card source");
}

/** Full documents are emitted verbatim. Capacity failure is explicit, never solved by truncation. */
export function compileDirectorInput(material: DirectorMaterial, context: DirectorPlanningContext, proposal?: unknown, gmContext?: GMContext): DirectorPreparedInput {
  validateContext(context, material);
  const messages: Message[] = [], stage = proposal === undefined ? "director" : "review";
  if (stage === "director") {
    messages.push({role: "system", content: directorPolicy + (gmContext?.memoryContext ? `\n${GM_MEMORY_INSTRUCTION}` : "")});
    messages.push({role: "user", content: JSON.stringify({context, limits: DIRECTOR_LIMITS, ...(gmContext ? {global: gmContext} : {})})});
    for (const source of gmContext ? resolveGMDocuments(gmContext, material.resources.sources) : material.resources.sources) messages.push({role: "user", content: `完整作者资料：${source.path}\n${source.text}`});
    messages.push({role: "user", content: `只输出version/day/reason/focus/entries五个顶层字段。以下是结构说明，不要把freeCardSchema当作顶层字段输出；自由卡放入source.card。不要输出说明用的条件字段。\n${JSON.stringify(planShape)}\n本次硬约束：${JSON.stringify({day: context.budget.day, minimumFromPhase: context.world.phase, maximumThroughPhase: context.budget.day * 4 - 1, phaseMap: Object.fromEntries(["dawn", "day", "dusk", "night"].map((name, i) => [name, (context.budget.day - 1) * 4 + i])), allowedBasisIds: context.world.sourceIds})}\n相位是从0起的绝对整数：第1日为0～3，第2日为4～7。basisIds只能逐字选取allowedBasisIds中的事实／已读记忆ID；卡片ID、资料ID只用于source，不是动态事实来源。`});
  } else {
    const p = parseDirectorPlan(proposal);
    messages.push({role: "system", content: "你是独立的事件主题复核者，不是构思者。比较候选与活动／冷却主题、稳定对象承诺及本批其他卡；换标题、人物、来源、ID不能使同一事情成为新题。逐张自由卡判断new/same/uncertain；不确定不能放行。相同人物但不同事情不要误伤。只输出严格JSON：{version:1,planHash:原样复制,decisions:[{entryId,verdict,matchedSourceIds,reason}]}。真正额外后续由程序父槽授权，不能把一张free卡自行判成后续豁免。不要提供台词或推理过程。"});
    messages.push({role: "user", content: JSON.stringify({planHash: directorHash(p), proposal: p, fixedCards: context.fixed, themes: context.world.themes,
      facts: context.facts, memories: context.memories, instruction: "decisions只包含本计划每张free卡各一次；new的matchedSourceIds为空，命中提供真实来源ID。"})});
  }
  if (stage === "director" && gmContext?.memoryContext) {
    const last = messages.at(-1)!;
    last.content = last.content.replace("只输出version/day/reason/focus/entries五个顶层字段。", "输出version/day/reason/focus/entries，另可附memoryCorrections。" );
  }
  const bytes = messages.reduce((sum, m) => sum + v.utf8Size(m.content), 0);
  if (bytes > LIMITS.inputBytes) v.invalid("director.context", "Input exceeds 2 MiB; no author text was truncated", "airp-capacity");
  return {stage, messages, bytes, contextHash: directorHash({context, sources: material.resources.sources.map(s => [s.id, s.sha256]), ...(gmContext ? {gmContext} : {})}),
    selectedMemoryIds: context.memories.map(m => m.id), diagnostics: [`总管理独立任务：${stage}`, `完整资料${stage === "director" ? gmContext?.documents.length ?? material.resources.sources.length : 0}份；未摘要或截断`, `${bytes} UTF-8 bytes（不是token额度）`]};
}
