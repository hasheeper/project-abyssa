import type { DirectorCapabilities } from "../../game-core/contracts";
import type { DirectorEvent, DirectorPlanningContext } from "./contracts";

const names: Record<string, string> = {marietta: "玛丽埃塔", abyssa: "艾比希斯", elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
const places: Record<string, string> = {maid: "女仆长室", dining: "餐厅", array: "结界核心", abyssa: "魔王的房间", terrace: "露台", plaza: "小广场", greenhouse: "温室药圃", elora: "艾洛拉的房间", eustice: "尤斯缇丝的房间", kororo: "柯萝萝的房间", norma: "诺玛的房间", tibby: "缇比的杂货铺"};
export type DirectorTaskBrief = {
  objective?: string; description?: string; note?: string;
  steps: {id: string; label: string; text: (string | {key: string})[]; note?: string; current?: boolean}[];
};

/** Concise player itinerary derived from the same executable task as the journal guide. */
export function directorTaskBrief(e: DirectorEvent, capabilities: DirectorCapabilities, sources: DirectorPlanningContext["authorSources"] = []): DirectorTaskBrief {
  const giver = names[e.card.giverId] ?? e.card.giverId, place = places[e.card.locationId] ?? e.card.locationId;
  if (e.status === "resolved") return {steps: [], description: e.delivery?.status === "confirmed" ? "交付与反馈已完成。" : "这段经历已结束。"};
  if (e.status === "closed") return {steps: [], description: e.closeReason === "declined" ? "已谢绝本次委托。" : "这次事件已经结束。"};
  if (e.delivery?.status === "pending") return {steps: [{id:"deliver",label:"交付",text:["向",{key:giver},"确认交付，随后听取反馈。"],current:true}]};
  if (e.delivery?.status === "confirmed") return {steps: [{id:"feedback",label:"反馈",text:["已完成交付，继续与",{key:giver},"交谈。"],current:true}]};
  if (e.role === "result" && e.card.actions.length) return {steps: [{id:"feedback",label:"反馈",text:["在",{key:place},"找",{key:giver},"听取结果。"],current:true}]};
  const action = e.card.actions[e.actionIndex];
  if (!action) return {steps: [], description: "继续交谈，完成这段互动。"};
  if (action.kind === "patrol") {
    const target = capabilities.objectives[action.objectiveId];
    if (!target) return {steps: [], description: action.intent};
    const source = sources.find(s => s.id === e.card.id);
    const item = source ? (JSON.parse(source.text) as {card:{objective:{itemLabel?:string}}}).card.objective.itemLabel : undefined;
    const route = target.routeId.includes("manor") ? "旧庄园" : target.routeId.includes("tide") ? "退潮黑礁" : target.routeId;
    return {objective:item ? `取回${item}` : e.card.title, steps:[
      {id:"depart",label:"出发",text:["从「出击」前往",{key:route},"，完成编队与出征确认。"],current:true},
      {id:"achieve",label:"达成",text:["完成",{key:`第 ${target.layer} 层`},"的任务目标房间。"],note:"安全撤回或通关，才能带回物品。"},
      {id:"deliver",label:"交付",text:["到",{key:place},"找",{key:giver},"，确认交付后听取反馈。"]},
    ], ...(e.actionOutcome === "failed" ? {note:"本趟未能带回目标，可以重新整备出征。"} : {})};
  }
  if (action.kind === "wait") return {steps:[
    {id:"wait",label:"等待",text:[{key:`${action.phases} 个时段`},"后继续。"],current:true},
    {id:"talk",label:"交谈",text:["到",{key:places[action.locationId] ?? action.locationId},"找",{key:names[action.actorId] ?? action.actorId},"听取反馈。"]},
  ]};
  return {objective:action.intent,steps:[
    {id:"talk",label:"前往",text:[{key:places[action.locationId] ?? action.locationId}," · ",{key:names[action.actorId] ?? action.actorId}],current:true},
    {id:"feedback",label:"收尾",text:["完成后向",{key:giver},"听取反馈。"]},
  ]};
}

/** Player guidance comes from executable objectives, never an LLM-invented quest. */
export function directorTaskGuide(e: DirectorEvent, capabilities: DirectorCapabilities, sources: DirectorPlanningContext["authorSources"] = []): string[] {
  const giver = names[e.card.giverId] ?? e.card.giverId, place = places[e.card.locationId] ?? e.card.locationId;
  if (e.status === "resolved") return [`「${e.card.title}」已完成。`, "本次经历结算后写入记忆；物品按实际出征结果结算，不重复发放。"];
  if (e.status === "closed") return [e.closeReason === "declined" ? "你已拒绝这次委托，无需出征或交付。" : "这次事件已经结束。"];
  if (e.delivery?.status === "pending") return [`目标已经带回。回到${place}找${giver}，选择「确认交付」。`, "仅返回洋馆还不算交付；确认后继续听取结果反馈。"];
  if (e.delivery?.status === "confirmed") return [`已向${giver}交付目标，继续本次结果反馈。`];
  if (e.role === "result" && e.card.actions.length) return [`本次行动已有反馈，回到${place}找${giver}继续结果收尾；无需重新接下或执行原任务。`];
  const a = e.card.actions[e.actionIndex];
  if (!a) return ["这是当场互动，无需出征；继续交谈，直到当前阶段自然结束。"];
  if (a.kind === "patrol") {
    const target = capabilities.objectives[a.objectiveId];
    if (!target) return [a.intent];
    const source = sources.find(s => s.id === e.card.id);
    const authored = source ? JSON.parse(source.text) as {card: {objective: {itemLabel?: string}}} : null;
    const goal = authored?.card.objective.itemLabel;
    const route = target.routeId.includes("manor") ? "旧庄园" : target.routeId.includes("tide") ? "潮汐岩窟" : target.routeId;
    return [goal ? `目标：取回${goal}。` : `任务：${e.card.title}。`, `从主菜单「SORTIE／出击」进入${route}，完成编队与出征确认。`,
      `到达第${target.layer}层的任务目标房间并完成该房间。目标达成由实际探索记录判定，不靠选择态度领取。`,
      `达成后安全撤回或通关；回到${place}找${giver}，明确交付后听取结果反馈。`,
      ...(e.actionOutcome === "failed" ? ["本趟未满足带回条件；这段反馈结束后可重新整备出征，任务尚未完成。"] : [])];
  }
  if (a.kind === "wait") return [`等待${a.phases}个游戏时段，再到${places[a.locationId] ?? a.locationId}找${names[a.actorId] ?? a.actorId}听取反馈。`];
  return [`到${places[a.locationId] ?? a.locationId}找${names[a.actorId] ?? a.actorId}。`, a.intent, `按本步骤做法继续，取得反馈后再回到${giver}处收尾。`];
}
