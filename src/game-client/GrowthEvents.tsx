import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import { AIRP_ACTOR_NAMES } from "../game-runtime/airp-pool-view";
import type { GameSession } from "./session";
import { journalActions, type JournalEntry } from "./JournalBrowser";
import { JOURNAL_STATUS } from "./journal-format";
import { equipmentNames } from "./character-presentation";

type GrowthView = NonNullable<ReturnType<GameSession["runtime"]["queries"]["progression"]>>;
export function growthJournalEntries(view: GrowthView | null, session: GameSession, busy: boolean, equipmentHref: string, onReview?: (id: string) => void): JournalEntry[] {
  if (!view) return [];
  const entries = view.events.map((event): JournalEntry => {
    const meta = growthStories[event.eventId];
    const available = !event.completed && !!(event.basisId || event.session);
    const actionable = available && view.canMove && (view.canBegin || view.activeStoryId === event.session?.id);
    const actor = meta.partnerId === "marietta" ? "玛丽埃塔" : AIRP_ACTOR_NAMES[meta.partnerId ?? ""] ?? "同伴";
    const status = event.completed ? JOURNAL_STATUS.done : !available ? JOURNAL_STATUS.locked
      : !view.canMove ? JOURNAL_STATUS.frozen : event.session ? JOURNAL_STATUS.resume : JOURNAL_STATUS.available;
    const condition = event.kind === "gift" ? "需要一次第三层撤离或五层通关。"
      : event.ownerId === "marietta" ? "开放亲征后参加维护归来；Lv.3 还需 Lv.2 后的新一趟。"
      : event.level === 3 ? "接管庄园，并在 Lv.2 后新出发归来。" : "本人参加第三层撤离或五层通关。";
    const gifts = event.completed && event.kind === "gift" && !!view.inventory.length;
    return {id: event.eventId, title: meta.title, source: actor,
      category: event.kind === "gift" ? "gift" : "companion", status,
      group: event.completed ? "archive" : available ? "current" : "locked", actionable,
      lead: event.completed ? meta.resultText : !available ? undefined : !view.canMove ? "出征期间配置已冻结，归来后可继续片段。"
        : event.session ? "交谈尚未结束，可以从上次停下的地方继续。" : `与${actor}谈谈这次归来。`,
      condition: available || event.completed ? undefined : condition,
      facts: gifts ? [{label: "已收下", value: view.inventory.map(i => equipmentNames[i.definitionId]).join("、")}] : undefined,
      actions: journalActions(
        available && {label: `${event.session ? "继续" : "谈起"} · ${meta.title}`, emphasis: "primary", disabled: busy || !actionable,
          onClick: () => void session.dispatch({type: "begin-story", eventId: event.eventId, basisId: event.basisId!})},
        event.completed && onReview && {label: "回顾片段", name: `回顾${meta.title}`, onClick: () => onReview(event.eventId)},
        gifts && {label: "前往骰装", href: equipmentHref},
      )};
  });
  if (view.teamMilestone) entries.push({id: teamMilestoneStory.eventId, title: teamMilestoneStory.title, source: "小队", category: "milestone",
    status: JOURNAL_STATUS.done, group: "archive", lead: teamMilestoneStory.resultText,
    actions: journalActions(onReview && {label: "回顾「这边交给我」", onClick: () => onReview(teamMilestoneStory.eventId)})});
  return entries;
}
