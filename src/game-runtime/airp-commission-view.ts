import { ESTATE_AIRP_CATALOG } from "./estate-context";
import { FACILITIES_AIRP_CATALOG } from "./facilities-context";
import type { AnyGameRecord } from "../game-application";
import { registeredPatrol, singlePathPatrol } from "../game-application/airp-director/commissions";
import { AIRP_DIRECTOR_CATALOG } from "./airp-director-context";
import { AIRP_GAME_CATALOG } from "./airp-game-context";
import { SHOP_AIRP_CATALOG } from "./shop-wave-context";

const names: Record<string, string> = {marietta: "玛丽埃塔", abyssa: "艾比希斯", elora: "艾洛拉", eustice: "尤斯缇丝", kororo: "柯萝萝", norma: "诺玛"};
const places: Record<string, string> = {maid: "女仆长室", dining: "餐厅", array: "结界核心", abyssa: "魔王的房间", terrace: "露台", plaza: "小广场", greenhouse: "温室药圃", elora: "艾洛拉的房间", eustice: "尤斯缇丝的房间", kororo: "柯萝萝的房间", norma: "诺玛的房间"};
export const commissionRouteName = (id: string) => ({"old-manor.maintenance": "旧庄园 · 维护巡守", "old-manor.first-clear": "旧庄园 · 首次探索", "tide-reef.ordinary": "潮汐岩窟"})[id] ?? id;
export type CommissionView = {
  id: string; title: string; giver: string; routeId: string; route: string; target: string; goal: string | null;
  active: boolean; accepted: boolean; registered: boolean; matchesRoute: boolean;
  state: "offered" | "registration" | "action" | "ready" | "elsewhere" | "unbound" | "exploring" | "return" | "settlement" | "feedback" | "delivery" | "result" | "complete" | "closed";
  status: string; hint: string; unreadAcceptance: boolean;
};

/** Physical progress uses actual quest instances; legacy runs retain their frozen evidence rules. */
export function directorCommissions(record: AnyGameRecord | null, routeId?: string): CommissionView[] | null {
  if (record?.schemaVersion !== 4 || !record.airpDirector || ![19, 22, 24, 26, 28].includes(record.contentRef.contentVersion)) return null;
  const catalog = record.contentRef.contentVersion === 28 ? ESTATE_AIRP_CATALOG : record.contentRef.contentVersion === 26 ? FACILITIES_AIRP_CATALOG : record.contentRef.contentVersion === 24 ? SHOP_AIRP_CATALOG : record.contentRef.contentVersion === 22 ? AIRP_GAME_CATALOG : AIRP_DIRECTOR_CATALOG;
  const expedition = record.snapshot.run?.kind === "expedition" ? record.snapshot.run.state : null, run = expedition?.run;
  const selectedRoute = routeId ?? run?.routeId;
  return record.airpDirector.events.flatMap(e => {
    if (["planned", "cancelled", "reserve"].includes(e.status)) return [];
    const action = e.card.actions[e.actionIndex]?.kind === "patrol" ? e.card.actions[e.actionIndex] : e.card.actions.find(a => a.kind === "patrol");
    if (action?.kind !== "patrol") return [];
    const objective = catalog.data.airpDirector!.capabilities.objectives[action.objectiveId];
    if (!objective) return [];
    const sourceId = catalog.data.airpDirector!.fixed.find(f => f.card.id === e.card.id)?.sourceId;
    const author = catalog.data.airpDirector!.authorSources.find(s => s.id === sourceId)?.body as {card?: {objective?: {itemLabel?: unknown}}} | undefined;
    const itemLabel = author?.card?.objective?.itemLabel;
    const giver = names[e.card.giverId] ?? e.card.giverId, place = places[e.card.locationId] ?? e.card.locationId;
    const registered = registeredPatrol(e), matchesRoute = !selectedRoute || selectedRoute === objective.routeId;
    const physical = !!e.binding?.rewardDefinitionId;
    const questItem = run?.commissionRewards?.items.find(i => i.eventId === e.id);
    const targetCleared = physical ? !!questItem : !!e.binding && record.facts.some(f => f.kind === "journey" && f.runRef?.id === e.binding!.runId && !record.retractedFactIds.includes(f.id) &&
      f.payload.events.some(event => event.type === "room-completed" && (event.payload as {roomId?: string}).roomId === e.binding!.roomId));
    let state: CommissionView["state"] = "action", status = "待确认行动", hint = `回到${place}找${giver}，确认当前步骤后再出发。`;
    if (e.status === "resolved") { state = "complete"; status = "已完成"; hint = "委托已完成，结果反馈已收尾。"; }
    else if (e.status === "closed") { state = "closed"; status = e.closeReason === "declined" ? "已婉拒" : "已结束"; hint = "本次委托已结束。"; }
    else if (e.status === "offered") { state = "offered"; status = "待接单"; hint = `到${place}找${giver}，明确选择参与后才会随队。`; }
    else if (e.delivery?.status === "pending" && e.status === "ready" && e.role === "result") { state = "delivery"; status = "待交付"; hint = `${e.delivery.itemInstanceId ? `${itemLabel ?? "委托物品"}已在任务背包中。` : "已安全带回。"}到${place}找${giver}，确认交付。`; }
    else if (e.delivery?.status === "confirmed" || e.role === "result") { state = "result"; status = e.delivery ? "已交付 · 待收尾" : "待收尾"; hint = `回到${place}找${giver}，继续结果反馈。`; }
    else if (e.status === "feedback") { state = "feedback"; status = e.actionOutcome === "failed" ? "未带回 · 待反馈" : "已带回 · 待反馈"; hint = `回到${place}找${giver}继续反馈。${e.actionOutcome === "failed" ? "任务保留，反馈后可再次出征。" : "随后完成交付。"}`; }
    else if (run && e.binding?.runId === run.id && expedition?.node === "finished") { state = "settlement"; status = (physical ? !!expedition.result.commissionRewards?.returned.some(i => i.eventId === e.id) : targetCleared && ["cleared", "extracted"].includes(expedition.result.outcome)) ? "目标已带回 · 待结算" : "本趟未带回 · 待结算"; hint = "完成远征结算后，回洋馆找委托人继续。"; }
    else if (run && e.binding?.runId === run.id) { state = targetCleared ? "return" : "exploring"; status = targetCleared ? physical ? "物品已取得 · 待返回" : "目标已达成 · 待返回" : "已随队 · 探索中"; hint = targetCleared ? physical ? `${questItem!.label}已放入委托背包。完成本层并安全返回；团灭会遗失。` : "安全撤回或通关后，再回洋馆交付。" : `完成第${objective.layer}层的目标房间，再安全返回。`; }
    else if (run) { state = "unbound"; status = "未随本趟"; hint = "本趟不会推进这项委托。返回后选择对应路线重新整备。"; }
    else if (!matchesRoute) { state = "elsewhere"; status = "本路线不推进"; hint = `委托保留；需前往${commissionRouteName(objective.routeId)}。`; }
    else if (registered) { state = "ready"; status = "可随队"; hint = "确认出征后随队；完成目标并安全返回，再找委托人交付。"; }
    else if (e.status === "accepted" && singlePathPatrol(e)) { state = "registration"; status = "已接单 · 待登记"; hint = "进入出征准备时会登记目标；确认页可核对本趟委托。"; }
    return [{id: e.id, title: e.card.title, giver, routeId: objective.routeId, route: commissionRouteName(objective.routeId), target: `第${objective.layer}层 · 第${objective.roomIndex + 1}间目标房间`, goal: typeof itemLabel === "string" ? `取回${itemLabel}` : null,
      active: !["resolved", "closed"].includes(e.status), accepted: !["offered", "closed"].includes(e.status), registered, matchesRoute, state, status, hint,
      unreadAcceptance: e.role === "acceptance" && e.status === "accepted"}];
  });
}
