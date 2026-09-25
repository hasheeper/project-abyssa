import { useMemo, type ReactNode } from "react";
import { ReadingPlayer, type ReadingPage } from "../shared/presentation/adv/ReadingPlayer";
import type { ReadingChapter } from "../shared/presentation/adv/useReadingReview";
import type { AuthoredLine, UserChoiceTone } from "../content/presentation/authored-story";
import { isUserChoice } from "../content/presentation/authored-story";
import { storyActors, storyMessages, storySlots } from "./story-actors";
import type { AvgChoice } from "../shared/domain/avg/story";
import type { RpActor } from "../shared/ui/patterns/RpScene";
import { usePlayerName } from "../shared/domain/PlayerIdentity";
import "./first-morning.css";

export type StoryReadingProps<Id extends string = AvgChoice> = {
  sceneId?: string; wide?: boolean; title: string; location: string; background: string; lines: AuthoredLine[]; cursor: number;
  busy?: boolean; error?: unknown; replay?: boolean; offstageActorId?: string; finalLabel?: string;
  onNext: () => unknown | Promise<unknown>; onAdvance?: () => unknown | Promise<unknown>; canAdvance?: boolean;
  choice?: {id?: string; prompt: string; options: {id: Id; label: string}[]} | null;
  onChoose?: (choice: Id) => void | Promise<void>; controls?: ReactNode; feedback?: ReactNode; onEscape?: () => void;
  actors?: RpActor[]; decisions?: ReadonlyMap<number, UserChoiceTone>; history?: ReadingChapter<ReadingPage>[];
  renderEffect?: (pageId: string, live: boolean) => ReactNode; onInteraction?: () => void;
};

/** Content adapter only; the complete surface and controls live in shared presentation. */
export function StoryReading<Id extends string = AvgChoice>(p: StoryReadingProps<Id>) {
  const playerName = usePlayerName();
  const pages = useMemo(() => {
    const actors = p.actors ?? storyActors(p.lines, playerName), initialSlots = storySlots(p.lines, p.offstageActorId);
    return p.lines.slice(0, p.cursor + 1).map((line, index): ReadingPage => ({
    id: line.id, actors, background: p.background, initialSlots,
    messages: storyMessages(p.lines.slice(0, index + 1), p.decisions, playerName).filter(m => m.kind !== "stage" || m.actorId !== p.offstageActorId)
      .map(m => m.kind === "say" && m.actorId === p.offstageActorId ? {...m, offstage: true} : m),
    performances: "actors" in line ? Object.fromEntries((line.actors ?? []).filter(a => a.characterId !== p.offstageActorId && (a.motion || a.aside || a.still))
      .map(a => [a.characterId, {key: line.id, motion: a.motion, aside: a.aside, still: a.still}])) : undefined,
  }));
  }, [p.lines, p.cursor, p.actors, p.background, p.offstageActorId, p.decisions, playerName]);
  const line = p.lines[p.cursor], atChoice = !!p.choice && (p.cursor === p.lines.length - 1 || isUserChoice(line));
  return <ReadingPlayer sceneId={p.sceneId ?? p.lines[0].id} title={p.title} location={p.location} pages={pages} history={p.history}
    className={p.wide ? "first-morning" : undefined} busy={p.busy} error={p.error} instant={p.replay || isUserChoice(line)}
    canAdvance={!atChoice && (p.canAdvance ?? p.cursor < p.lines.length - 1)} onNext={p.onNext} onAdvance={p.onAdvance} finalLabel={p.finalLabel}
    decision={atChoice ? {...p.choice!, id: p.choice!.id ?? `${line.id}:${JSON.stringify([p.choice!.prompt, p.choice!.options])}`} : null}
    onChoose={p.onChoose} actions={p.controls} feedback={p.feedback} onEscape={p.onEscape} renderEffect={p.renderEffect} onInteraction={p.onInteraction}/>;
}
