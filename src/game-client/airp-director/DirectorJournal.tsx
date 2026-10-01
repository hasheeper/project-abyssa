import type { AnyGameRecord } from "../../game-application";
import { directorView, directorTaskGuide, directorSettlementFeedback } from "../../game-runtime/airp-director-view";
import { AIRP_ACTOR_NAMES } from "../../game-runtime/airp-pool-view";
import { JournalDisclosure } from "../JournalPrimitives";
import { journalActions, type JournalEntry } from "../JournalBrowser";
import { JOURNAL_STATUS } from "../journal-format";
import type { GameSession } from "../session";
import { DirectorControls } from "./DirectorControls";
import { DirectorMemory } from "./DirectorMemory";
import { dispatchDirector } from "./dispatch";
import { directorCommissions } from "../../game-runtime/airp-commission-view";
import { gameHref, recordLocator } from "../navigation";

const states: Record<string, string> = {offered: JOURNAL_STATUS.available, accepted: JOURNAL_STATUS.ongoing, "waiting-action": JOURNAL_STATUS.waiting,
  feedback: JOURNAL_STATUS.feedback, ready: JOURNAL_STATUS.wrapUp, resolved: JOURNAL_STATUS.done, closed: JOURNAL_STATUS.closed};
export function directorJournalEntries(record: AnyGameRecord, session: GameSession, busy: boolean, close: () => void): JournalEntry[] {
  const view = directorView(record);
  if (!view) return [];
  const commissions = directorCommissions(record) ?? [];
  const day = view.context.budget.day, scheduled = view.state.days.some(d => d.day === day);
  const result: JournalEntry[] = [{id: "director-today", title: "今日安排", source: `第 ${day} 日`, category: "schedule", place: "洋馆",
    status: scheduled ? JOURNAL_STATUS.scheduled : JOURNAL_STATUS.schedule, group: "current", actionable: !scheduled,
    embeddedActions: true, custom: <DirectorControls/>}];
  for (const e of view.state.events) {
    if (["planned", "cancelled", "reserve"].includes(e.status)) continue;
    const entrance = view.entrances.find(x => x.event.id === e.id), waiting = e.actionPhase !== null && e.role === "action";
    const terminal = e.status === "resolved" || e.status === "closed";
    const commission = commissions.find(c => c.id === e.id);
    const status = commission?.status ?? (e.role === "result" && e.delivery?.status === "pending" ? JOURNAL_STATUS.deliver : states[e.status] ?? e.status);
    const memories = view.state.memories.filter(m => e.readSceneIds.some(id => m.id === `memory:${id}`));
    const settlement = terminal ? directorSettlementFeedback(record, e.id) : [];
    const guide = commission ? [] : directorTaskGuide(e, view.context.capabilities, view.context.authorSources);
    const absent = "对方暂不在约定地点，下一时段再看看。";
    result.push({id: e.id, title: e.card.title, source: AIRP_ACTOR_NAMES[e.card.giverId] ?? "洋馆", category: "commission", status,
      group: terminal ? "archive" : "current", actionable: !!entrance && !waiting, ongoing: !!commission?.active && commission.accepted,
      ...commission ? {
        lead: commission.hint,
        facts: commission.accepted ? [...commission.goal ? [{label: "目标", value: commission.goal}] : [], {label: "路线", value: commission.route}, {label: "地点", value: commission.target}] : undefined,
        paragraphs: [...commission.unreadAcceptance ? [commission.registered ? "接单反馈未读完，任务目标已登记。" : "接单反馈未读完。"] : [],
          ...settlement, ...["delivery", "feedback", "result"].includes(commission.state) && !entrance ? [absent] : []],
      } : {
        lead: guide[0],
        paragraphs: [...guide.slice(1), ...settlement,
          ...terminal ? [] : [waiting ? "任务目标已登记，实际行动后更新进度。" : entrance ? "此刻可以找到对方。" : absent]],
      },
      actions: journalActions(
        commission && ["ready", "registration"].includes(commission.state) && {label: "前往出征整备", href: gameHref("map", recordLocator(record))},
        commission && ["exploring", "return", "settlement", "unbound"].includes(commission.state) && {label: "继续当前远征", href: gameHref("battle", recordLocator(record))},
        commission?.state === "delivery" && entrance && {label: "确认交付", emphasis: "primary", disabled: busy,
          onClick: () => void dispatchDirector(session, {type: "airp-director-deliver", eventId: e.id}).then(batch => {if (batch) close();})},
        entrance && !waiting && {label: "继续这件事", emphasis: commission?.state === "delivery" ? "normal" : "primary", disabled: busy,
          onClick: () => void dispatchDirector(session, {type: "airp-director-open", eventId: e.id}).then(batch => {if (batch) close();})},
      ),
      records: <>
        {!!memories.length && <JournalDisclosure label="已读记录">{memories.map(m => <p key={m.id} className="journal-record__transcript">{m.text}</p>)}</JournalDisclosure>}
        {!!e.readSceneIds.length && <DirectorMemory sceneId={e.readSceneIds.at(-1)!}/>}
      </>});
  }
  return result;
}
