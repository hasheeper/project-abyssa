import { useEffect, useRef, useState } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import { useSceneSequenceBusy } from "../shared/presentation/adv/SceneSequence";
import type { AuthoredLine } from "../content/presentation/authored-story";
import { storyActors, storyMessages, storySlots } from "./story-actors";
import forwardIcon from "../assets/icons/fast-forward-button.svg";
import "../shared/ui/styles/dialogue.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";

type Props = {title: string; location: string; background: string; lines: AuthoredLine[]; cursor: number; busy?: boolean; replay?: boolean; finalLabel?: string; onNext: () => void; onSkip: () => void};
/** The same full ADV and reading rail as memory; no additional story modal or card. */
export function StoryReading({title, location, background, lines, cursor, busy = false, replay = false, finalLabel = "继续", onNext, onSkip}: Props) {
  const transitioning = useSceneSequenceBusy();
  const locked = busy || transitioning;
  const [revealed, setRevealed] = useState<string | null>(null), [settled, setSettled] = useState<string | null>(null);
  const line = lines[cursor], typing = revealed !== line.id, ready = !typing || settled === line.id;
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {if (!locked) stage.current?.focus({preventScroll:true});}, [locked]);
  const next = () => {if (locked) return; if (!ready) setRevealed(line.id); else onNext();};
  const label = !ready ? "显示全文" : cursor === lines.length - 1 ? finalLabel : "下一句";
  return <main className="rp-app" data-layout="adv" data-state={ready ? "idle" : "typing"} aria-label={title}>
    <section className="rp-app__stage" aria-label="ADV 对话" ref={stage} tabIndex={0} onClick={next} onKeyDown={e => {
      if (e.target === e.currentTarget && [" ","Enter","ArrowRight"].includes(e.key)) {e.preventDefault(); next();}
    }}>
      <AdvStage actors={storyActors(lines)} messages={storyMessages(lines.slice(0,cursor+1))} initialSlots={storySlots(lines)} background={background} typing={typing} hydrate replay={replay} onTypingEnd={() => setSettled(line.id)}/>
    </section>
    <footer className="rp-app__bar">
      <div className="rp-app__pager"><span className="rp-app__cell"><span className="rp-app__cell-main">{location}</span><span className="rp-app__cell-label">STORY</span></span></div>
      <button type="button" className="rp-app__cell rp-app__cue" disabled={locked} onClick={next} aria-label={label}>
        <span className="rp-app__cue-line"><span className="rp-app__cue-word">{Array.from(label).map((char,i)=><span key={i}>{char}</span>)}</span></span>
      </button>
      <nav className="rp-app__tools" aria-label="演出控制"><button type="button" className="rp-app__cell rp-app__tool" aria-label="跳过本段对白" title="跳过本段对白" disabled={locked} onClick={onSkip}>
        <i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${forwardIcon}")`,WebkitMaskImage:`url("${forwardIcon}")`}}/><span className="rp-app__cell-label">SKIP</span>
      </button></nav>
    </footer>
  </main>;
}
