import type { AnyGameRecord } from "../../game-application";
import { directorView, directorTaskGuide, directorSettlementFeedback } from "../../game-runtime/airp-director-view";
import { JournalActionLink, JournalButton } from "../JournalPrimitives";
import { JournalRecordHeading, type JournalEntry } from "../JournalBrowser";
import type { GameSession } from "../session";
import { DirectorControls } from "./DirectorControls";
import { DirectorMemory } from "./DirectorMemory";
import { dispatchDirector } from "./dispatch";
import { directorCommissions } from "../../game-runtime/airp-commission-view";
import { CommissionCard } from "./CommissionList";
import { gameHref, recordLocator } from "../navigation";

const states: Record<string, string> = {offered: "有事相谈", accepted: "已参与", "waiting-action": "待行动", feedback: "有新反馈", ready: "待收尾", resolved: "已结束", closed: "已结束"};
export function directorJournalEntries(record: AnyGameRecord, session: GameSession, busy: boolean, close: () => void): JournalEntry[] {
  const view = directorView(record);
  if (!view) return [];
  const commissions = directorCommissions(record) ?? [];
  const todayMeta = `第 ${view.context.budget.day} 日 · 洋馆`;
  const result: JournalEntry[] = [{id: "director-today", title: "今日安排", kind: "quest", group: "current", meta: todayMeta, actionable: !view.state.days.some(d => d.day === view.context.budget.day),
    content: <><JournalRecordHeading title="今日安排" meta={todayMeta}/><DirectorControls/></>}];
  for (const e of view.state.events) {
    if (["planned", "cancelled", "reserve"].includes(e.status)) continue;
    const entrance = view.entrances.find(x => x.event.id === e.id), waiting = e.actionPhase !== null && e.role === "action";
    const terminal = e.status === "resolved" || e.status === "closed";
    const commission = commissions.find(c => c.id === e.id);
    const status = commission?.status ?? (e.role === "result" && e.delivery?.status === "pending" ? "待交付" : states[e.status] ?? e.status);
    const memories = view.state.memories.filter(m => e.readSceneIds.some(id => m.id === `memory:${id}`));
    result.push({id: e.id, title: e.card.title, kind: "quest", group: terminal ? "archive" : "current", meta: status, actionable: !!entrance && !waiting, ongoing: !!commission?.active && commission.accepted,
      content: <><JournalRecordHeading title={e.card.title} meta={status}/>
        {commission ? <CommissionCard task={commission}/> : directorTaskGuide(e, view.context.capabilities, view.context.authorSources).map((line, i) => <p key={i}>{line}</p>)}
        {terminal && directorSettlementFeedback(record, e.id).map((line, i) => <p key={`settlement:${i}`}>{line}</p>)}
        {!terminal && !commission && <p>{waiting ? "任务目标已登记，实际行动后更新进度。" : entrance ? "此刻可以找到对方。" : "对方暂不在约定地点，下一时段再看看。"}</p>}
        {commission && ["delivery", "feedback", "result"].includes(commission.state) && !entrance && <p>对方暂不在约定地点，下一时段再看看。</p>}
        <div className="journal-record__actions">
          {commission && ["ready", "registration"].includes(commission.state) && <JournalActionLink href={gameHref("map", recordLocator(record))}>前往出征整备</JournalActionLink>}
          {commission && ["exploring", "return", "settlement", "unbound"].includes(commission.state) && <JournalActionLink href={gameHref("battle", recordLocator(record))}>继续当前远征</JournalActionLink>}
          {commission?.state === "delivery" && entrance && <JournalButton emphasis="primary" disabled={busy} onClick={() => void dispatchDirector(session, {type: "airp-director-deliver", eventId: e.id}).then(batch => {if (batch) close();})}>确认交付</JournalButton>}
          {entrance && !waiting && <JournalButton emphasis={commission?.state === "delivery" ? "normal" : "primary"} disabled={busy} onClick={() => void dispatchDirector(session, {type: "airp-director-open", eventId: e.id}).then(batch => {if (batch) close();})}>继续这件事</JournalButton>}
        </div>
        {!!memories.length && <details className="journal-record__history"><summary>已读记录</summary>{memories.map(m => <p key={m.id} style={{whiteSpace: "pre-wrap"}}>{m.text}</p>)}</details>}
        {!!e.readSceneIds.length && <DirectorMemory sceneId={e.readSceneIds.at(-1)!}/>}
      </>});
  }
  return result;
}
