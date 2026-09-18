import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { AIRP_ACTOR_NAMES } from "../game-runtime/airp-pool-view";
import type { GameSession } from "./session";
import { JournalButton } from "./JournalPrimitives";
import { JournalRecordHeading, type JournalEntry } from "./JournalBrowser";
import { equipmentNames } from "./character-presentation";

type GrowthView = NonNullable<ReturnType<GameSession["runtime"]["queries"]["progression"]>>;
export function growthJournalEntries(view: GrowthView | null, session: GameSession, busy: boolean, equipmentHref: string, onReview?: (id: string) => void): JournalEntry[] {
  if (!view) return [];
  const entries = view.events.map((event): JournalEntry => {
    const meta = growthStories[event.eventId];
    const available = !event.completed && !!(event.basisId || event.session);
    const actionable = available && view.canMove && (view.canBegin || view.activeStoryId === event.session?.id);
    const actor = meta.partnerId === "marietta" ? "玛丽埃塔" : AIRP_ACTOR_NAMES[meta.partnerId ?? ""] ?? "同伴";
    const state = event.completed ? "已完成" : available ? event.session ? "待继续" : "可交谈" : "尚未开放";
    const condition = event.kind === "gift" ? "需要一次第三层撤离或五层通关。"
      : event.ownerId === "marietta" ? "开放亲征后参加维护归来；Lv.3 还需 Lv.2 后的新一趟。"
      : event.level === 3 ? "接管庄园，并在 Lv.2 后新出发归来。" : "本人参加第三层撤离或五层通关。";
    return {id: event.eventId, title: meta.title, meta: `${actor} · ${available && !view.canMove ? "归来后继续" : state}`,
      kind: "story", group: event.completed ? "archive" : available ? "current" : "locked", actionable,
      content: <>
        <JournalRecordHeading title={meta.title} meta={`${actor} · ${event.kind === "gift" ? "整备赠礼" : "同伴片段"} · ${state}`}/>
        {event.completed ? <p>{meta.resultText}</p> : !available ? <p>{condition}</p>
          : !view.canMove ? <p>出征期间配置已冻结，归来后可继续片段。</p>
          : <p>{event.session ? "交谈尚未结束，可以从上次停下的地方继续。" : `与${actor}谈谈这次归来。`}</p>}
        <div className="journal-record__actions">
          {available && <JournalButton emphasis="primary" disabled={busy || !actionable} onClick={() => void session.dispatch({type: "begin-story", eventId: event.eventId, basisId: event.basisId!})}>{`${event.session ? "继续" : "谈起"} · ${meta.title}`}</JournalButton>}
          {event.completed && onReview && <JournalButton aria-label={`回顾${meta.title}`} onClick={() => onReview(event.eventId)}>回顾片段</JournalButton>}
          {event.completed && event.kind === "gift" && !!view.inventory.length && <a href={equipmentHref}>前往骰装</a>}
        </div>
        {event.completed && event.kind === "gift" && !!view.inventory.length && <p className="campaign-journal__note">{view.inventory.map(i => equipmentNames[i.definitionId]).join("、")} · 已收下</p>}
      </>};
  });
  if (view.teamMilestone) entries.push({id: teamMilestoneStory.eventId, title: teamMilestoneStory.title, meta: "小队 · 已完成", kind: "story", group: "archive",
    content: <><JournalRecordHeading title={teamMilestoneStory.title} meta="小队 · 羁绊里程碑"/><p>{teamMilestoneStory.resultText}</p>
      {onReview && <div className="journal-record__actions"><JournalButton onClick={() => onReview(teamMilestoneStory.eventId)}>回顾「这边交给我」</JournalButton></div>}</>});
  return entries;
}
