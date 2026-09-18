import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdvStage } from "../shared/presentation/adv/AdvStage";
import { useSceneSequenceBusy } from "../shared/presentation/adv/SceneSequence";
import type { AuthoredLine } from "../content/presentation/authored-story";
import { storyActors, storyMessages, storySlots } from "./story-actors";
import forwardIcon from "../assets/icons/fast-forward-button.svg";
import { RibbonButton } from "../shared/ui/primitives/RibbonButton";
import type { AvgChoice } from "../shared/domain/avg/story";
import type { ActorPerformances } from "../shared/domain/presentation/performance";
import "./first-morning.css";
import "../shared/ui/styles/dialogue.css";
import "../shared/ui/styles/paper-doll.css";
import "../shared/presentation/adv/reading-shell.css";
import "../shared/presentation/adv/reading-controls.css";

type Props = {wide?: boolean; title: string; location: string; background: string; lines: AuthoredLine[]; cursor: number; busy?: boolean; replay?: boolean; offstageActorId?: string; finalLabel?: string; onNext: () => void; onSkip: () => void;
  choice?: {prompt: string; options: {id: AvgChoice; label: string}[]} | null; onChoose?: (choice: AvgChoice) => void; controls?: ReactNode};
/** The same full ADV and reading rail as memory; no additional story modal or card. */
export function StoryReading({title, location, background, lines, cursor, busy = false, replay = false, offstageActorId, finalLabel = "继续", onNext, onSkip, choice, onChoose, wide = false, controls}: Props) {
  const transitioning = useSceneSequenceBusy();
  const locked = busy || transitioning;
  const [revealed, setRevealed] = useState<string | null>(null), [settled, setSettled] = useState<string | null>(null);
  const line = lines[cursor], typing = revealed !== line.id, ready = !typing || settled === line.id;
  const performances: ActorPerformances | undefined = !locked && !replay && "actors" in line
    ? Object.fromEntries((line.actors ?? []).filter(actor=>actor.characterId!==offstageActorId && (actor.motion || actor.aside || actor.still)).map(actor => [actor.characterId,{key:line.id,motion:actor.motion,aside:actor.aside,still:actor.still}])) : undefined;
  const messages = storyMessages(lines.slice(0,cursor+1)).filter(message=>message.kind!=="stage" || message.actorId!==offstageActorId)
    .map(message=>message.kind==="say" && message.actorId===offstageActorId ? {...message,offstage:true} : message);
  const choosing = !!choice && cursor === lines.length - 1 && ready;
  const stage = useRef<HTMLElement>(null);
  useEffect(() => {if (!locked) stage.current?.focus({preventScroll:true});}, [locked]);
  const next = () => {if (locked || choosing) return; if (!ready) setRevealed(line.id); else onNext();};
  const label = choosing ? "请选择行动" : !ready ? "显示全文" : cursor === lines.length - 1 ? finalLabel : "下一句";
  return <main className={`rp-app${wide ? " first-morning" : ""}`} data-layout="adv" data-frame-id={line.id} data-state={ready ? "idle" : "typing"} aria-label={title}>
    <section className="rp-app__stage" aria-label="ADV 对话" ref={stage} tabIndex={0} onClick={next} onKeyDown={e => {
      if (e.target === e.currentTarget && [" ","Enter","ArrowRight"].includes(e.key)) {e.preventDefault(); next();}
    }}>
      <AdvStage actors={storyActors(lines)} messages={messages} initialSlots={storySlots(lines,offstageActorId)} performances={performances} background={background} typing={typing} hydrate replay={replay} onTypingEnd={() => setSettled(line.id)}/>
      {choosing && <section className="first-morning__choices" aria-label={choice!.prompt} onClick={e => e.stopPropagation()}>
        <p className="first-morning__choice-prompt">{choice!.prompt}</p>
        <div className="first-morning__choice-list">{choice!.options.map(option => <RibbonButton key={option.id} className="first-morning__choice" variant="dark" size="lg" fullWidth disabled={locked} onClick={() => onChoose?.(option.id)}>{option.label}</RibbonButton>)}</div>
      </section>}
    </section>
    <footer className="rp-app__bar">
      <div className="rp-app__pager"><span className="rp-app__cell"><span className="rp-app__cell-main">{location}</span><span className="rp-app__cell-label">STORY</span></span></div>
      <button type="button" className="rp-app__cell rp-app__cue" disabled={locked || choosing} onClick={next} aria-label={label}>
        <span className="rp-app__cue-line"><span className="rp-app__cue-word">{Array.from(label).map((char,i)=><span key={i}>{char}</span>)}</span></span>
      </button>
      <nav className="rp-app__tools" aria-label="演出控制">{controls ?? <button type="button" className="rp-app__cell rp-app__tool" aria-label="跳过本段对白" title="跳过本段对白" disabled={locked} onClick={onSkip}>
        <i className="rp-app__cell-main rp-app__tool-icon" aria-hidden="true" style={{maskImage:`url("${forwardIcon}")`,WebkitMaskImage:`url("${forwardIcon}")`}}/><span className="rp-app__cell-label">SKIP</span>
      </button>}</nav>
    </footer>
  </main>;
}
