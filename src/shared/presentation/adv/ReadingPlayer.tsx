import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdvStage, type AdvStageProps } from "./AdvStage";
import { RpScene } from "../../ui/patterns/RpScene";
import { StoryChoices, type StoryDecision } from "../../ui/patterns/StoryChoices";
import { InlineFeedback } from "../../ui/patterns/SceneFeedback";
import { useSceneSequenceBusy } from "./SceneSequence";
import { ReadingControls } from "./ReadingControls";
import { useReadingPresentation, type ReadingLayout } from "./useReadingPresentation";
import { useReadingPlayback } from "./useReadingPlayback";
import { useReadingReview, type ReadingChapter } from "./useReadingReview";
import "../../ui/styles/components-core.css";
import "../../ui/styles/paper-doll.css";
import "../../ui/styles/rp.css";
import "./reading-shell.css";
import "./reading-morph.css";
import "./reading-motion.css";

export type ReadingPage = Pick<AdvStageProps, "actors" | "messages" | "background" | "initialSlots" | "performances"> & {id: string};
export type ReadingPlayerProps<Id extends string = string> = {
  sceneId: string; title: string; location: string; pages: ReadingPage[]; history?: ReadingChapter<ReadingPage>[];
  canAdvance: boolean; onNext: () => unknown | Promise<unknown>; onAdvance?: () => unknown | Promise<unknown>;
  finalLabel?: string; busy?: boolean; error?: unknown; instant?: boolean; className?: string; initialLayout?: ReadingLayout;
  decision?: StoryDecision<Id> | null; onChoose?: (id: Id) => void | Promise<void>;
  actions?: ReactNode; feedback?: ReactNode; onEscape?: () => void;
  renderEffect?: (pageId: string, live: boolean) => ReactNode; onInteraction?: () => void;
};

/** Domain-free full-page reader. The host supplies only presented prefixes and ordinary-step authority. */
export function ReadingPlayer<Id extends string>(p: ReadingPlayerProps<Id>) {
  const entering = useSceneSequenceBusy(), presentation = useReadingPresentation(p.initialLayout);
  const {layout, reading, morph, phase} = presentation;
  const review = useReadingReview([...(p.history ?? []).filter(c => c.id !== p.sceneId && c.pages.length), {id: p.sceneId, title: p.title, pages: p.pages}]);
  const page = review.page ?? p.pages.at(-1)!;
  const key = `${p.sceneId}:${review.reviewing ? `review:${review.index}:` : ""}${page.id}`;
  const [revealed, setRevealed] = useState<string | null>(null), [settled, setSettled] = useState<string | null>(null), [choicesPresent, setChoicesPresent] = useState(false);
  const log = reading || layout === "nvl", decision = review.reviewing ? null : p.decision;
  const printable = ["say", "narration", "chapter"].includes(page.messages.at(-1)?.kind ?? "");
  const typing = printable && !reading && !p.instant && !review.reviewing && revealed !== key;
  const ready = !typing || settled === key || !!decision && !page.messages.length;
  const blocked = !!p.busy || entering || !!morph || choicesPresent && !decision && !reading && !review.reviewing;
  const reveal = () => {setRevealed(key);setSettled(key);};
  const playback = useReadingPlayback({key, ready, blocked, boundary: !p.canAdvance || !!decision,
    suspended: reading || review.reviewing || !!morph, error: p.error, reveal, advance: p.onAdvance ?? p.onNext});
  const locked = blocked || playback.pending;
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {if (!locked && !reading) stage.current?.focus({preventScroll:true});}, [locked, reading]);
  const next = () => {
    if (locked || presentation.switching.current) return;
    playback.stop();
    if (reading) {change(layout, false);return;}
    if (review.reviewing) {review.next();return;}
    if (!ready) {reveal();return;}
    if (!decision) void playback.run(p.onNext);
  };
  function change(nextLayout: ReadingLayout, nextReading: boolean) {
    if (locked || presentation.switching.current) return;
    playback.stop(); presentation.changePresentation(nextLayout, nextReading, reveal);
  }
  const reviewingAction = (action: () => void) => {if (!locked) {playback.stop();action();reveal();}};
  const label = reading ? "返回当前对白" : review.reviewing ? review.atEnd ? "返回当前进度" : "重播下一句" : decision && ready ? "请选择行动" : !ready ? "显示全文" : p.canAdvance ? "下一句" : p.finalLabel ?? "继续";
  const choices = <StoryChoices decision={decision && ready && !reading ? decision : null} placement={log ? "inline" : "overlay"}
    disabled={locked || !p.onChoose} enterBlocked={entering || !!morph && phase === "out"}
    onChoose={async id => {playback.stop();await p.onChoose?.(id);}} onPresentChange={setChoicesPresent}/>;
  const performances = !locked && !reading && !review.reviewing && !p.instant ? page.performances : undefined;
  return <main className={`rp-app story-reading ${p.className ?? ""}`} aria-label={p.title} data-layout={log ? "nvl" : "adv"}
    data-frame-id={page.id} data-state={reading || review.reviewing ? "reading" : ready ? "idle" : "typing"}
    data-replaying={review.reviewing || undefined} data-decision={!!decision && ready || undefined} data-morph={morph ?? undefined} data-phase={morph ? phase : undefined}
    onPointerDownCapture={p.onInteraction} onKeyDownCapture={p.onInteraction}>
    <section className="rp-app__stage" aria-label={log ? "NVL 消息流" : "AVG 对话"} ref={stage} tabIndex={0}
      onClick={e => {if (!(e.target as HTMLElement).closest("button") && !reading) next();}}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if ([" ","Enter","ArrowRight"].includes(e.key)) {e.preventDefault();next();}
        if (e.key === "Escape") {e.preventDefault();playback.stop();if (reading) change(layout, false);else if (review.reviewing) review.exit();else p.onEscape?.();}
      }}>
      {log ? <RpScene {...page} performances={performances} hydrate typing={typing} onTypingEnd={() => setSettled(key)} mode={reading || review.reviewing ? "log" : "play"} actions={choices}/>
        : <AdvStage {...page} performances={performances} typing={typing} hydrate replay={p.instant || review.reviewing} onTypingEnd={() => setSettled(key)}/>}
      {!log && choices}
      {p.renderEffect?.(page.id, !reading && !review.reviewing && !locked && !p.instant)}
    </section>
    <ReadingControls layout={layout} reading={reading} reviewing={review.reviewing} auto={playback.auto} skipping={playback.skipping} disabled={locked}
      canReplay={review.canReplay} canPlay={p.canAdvance && !decision && !reading && !review.reviewing} canSkip={!reading && !review.reviewing && (!ready || p.canAdvance && !decision)}
      sceneIndex={review.index} sceneTotal={review.total} location={p.location} label={label} nextDisabled={!!decision && ready && !reading && !review.reviewing}
      onLayout={() => change(layout === "adv" ? "nvl" : "adv", false)} onLog={() => change(layout, !reading)}
      onReplay={() => reviewingAction(review.reviewing ? review.exit : review.replay)} onScene={index => reviewingAction(() => review.go(index))}
      onAuto={() => playback.toggle("auto")} onSkip={() => {if (!p.canAdvance || decision) reveal();else playback.toggle("skip");}} onNext={next}
      actions={<span className="rp-app__scene-actions" onClickCapture={e => {
        if (!locked && !(e.target as HTMLElement).closest("button:disabled")) playback.stop();
      }}>{p.actions}</span>}/>
    {(p.feedback || playback.failure) && <div className="story-reading__feedback">{p.feedback}{playback.failure && <InlineFeedback message={playback.failure}/>}</div>}
  </main>;
}
