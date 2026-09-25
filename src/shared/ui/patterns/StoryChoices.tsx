import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useIsPresent, type Variants } from "motion/react";
import { RibbonFrameArt } from "../primitives/RibbonButton";
import { useUiMotion } from "../motion/UiMotionProvider";
import { motionTokens, uiTransition } from "../motion/presets";
import "../styles/components-controls.css";
import "../styles/story-choices.css";

const ROW_HEIGHT = 54, ROW_GAP = 8;

export interface StoryDecision<Id extends string = string> {
  id: string;
  prompt: string;
  options: readonly {id: Id; label: string}[];
}
export interface StoryChoicesProps<Id extends string = string> {
  /** Keep the component mounted; null dismisses the current choice without a second live tree. */
  decision: StoryDecision<Id> | null;
  placement?: "overlay" | "inline";
  disabled?: boolean;
  /** Wait for a covered scene or the outgoing half of a layout handoff. */
  enterBlocked?: boolean;
  /** Success clears/replaces decision; failure rejects and restores the same choices. */
  onChoose: (id: Id) => void | Promise<void>;
  /** Includes the exit: hosts must not advance through a departing choice. */
  onPresentChange?: (present: boolean) => void;
}

/** Presentation only: no story cursor, save access or delayed game commands. */
export function StoryChoices<Id extends string>(props: StoryChoicesProps<Id>) {
  return <AnimatePresence mode="wait">
    {props.decision && <Decision key={props.decision.id} {...props} decision={props.decision}/>}
  </AnimatePresence>;
}

function Decision<Id extends string>({decision, placement = "overlay", disabled = false, enterBlocked = false, onChoose, onPresentChange}: StoryChoicesProps<Id> & {decision: StoryDecision<Id>}) {
  const present = useIsPresent(), {reduced} = useUiMotion();
  const [picked, setPicked] = useState<Id | null>(null), [failed, setFailed] = useState(false);
  const [highlighted, setHighlighted] = useState(decision.options[0]?.id);
  const flight = useRef(false), alive = useRef(true), root = useRef<HTMLElement>(null);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useLayoutEffect(() => {onPresentChange?.(true); return () => onPresentChange?.(false);}, [onPresentChange]);
  const timing = motionTokens.storyChoice;
  const locked = disabled || enterBlocked || !present || picked !== null;
  const selected = picked ?? highlighted;
  const index = Math.max(0, decision.options.findIndex(option => option.id === selected));
  const transition = (ms: number) => uiTransition(reduced ? timing.reducedMs : ms);
  const enter = {...transition(timing.enterMs), ease: [...timing.enterEase] as [number, number, number, number]};
  const confirmExit = {opacity: 0, y: reduced ? 0 : -timing.exitDistancePx, transition: {
    ...transition(timing.confirmExitMs), delay: reduced ? 0 : timing.confirmHoldMs / 1000,
  }};
  async function choose(id: Id) {
    if (locked || flight.current) return;
    flight.current = true; setPicked(id); setHighlighted(id); setFailed(false);
    // Focus stays off the soon-inert button and away from the next story line.
    root.current?.focus({preventScroll: true});
    try { await onChoose(id); }
    catch {
      flight.current = false;
      if (alive.current) {setFailed(true); setPicked(null);}
    }
    // Success retains confirmation until its presence exit actually finishes.
  }
  const itemVariants: Variants = {
    hidden: {opacity: 0, y: reduced ? 0 : timing.distancePx, transition: transition(timing.exitMs)},
    shown: ({index: order}: {index: number}) => ({opacity: 1, y: 0, transition: {
      ...enter, delay: reduced || failed ? 0 : (order + 1) * timing.staggerMs / 1000,
    }}),
    confirm: ({id}: {id: Id}) => ({opacity: id === picked ? 1 : .28, y: 0, transition: transition(timing.exitMs)}),
    exit: ({id}: {id: Id}) => picked === id ? confirmExit : {
      opacity: 0, y: reduced || !picked ? 0 : timing.exitDistancePx, transition: transition(timing.exitMs),
    },
  };
  return <motion.section ref={root} tabIndex={-1} className="story-choices" data-placement={placement} data-decision-id={decision.id}
    data-ui-motion-preset="story-choice" data-ui-motion={reduced ? "reduced" : "full"}
    data-pending={picked !== null || undefined} data-present={present} aria-label={decision.prompt}
    aria-hidden={!present || enterBlocked || undefined} aria-busy={picked !== null || disabled}
    style={{"--choice-row-height": `${ROW_HEIGHT}px`, "--choice-row-gap": `${ROW_GAP}px`,
      "--choice-surface-ms": `${timing.surfaceMs}ms`, "--choice-surface-scale": timing.surfaceScale} as CSSProperties}
    initial="hidden" animate={enterBlocked ? "hidden" : picked ? "confirm" : "shown"} exit="exit"
    onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (locked) {
        if (["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) event.preventDefault();
        return;
      }
      if (event.key === "Enter" && event.repeat) {event.preventDefault(); return;}
      const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!direction && event.key !== "Home" && event.key !== "End") return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      if (!buttons.length) return;
      event.preventDefault(); event.stopPropagation();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : current < 0 ? index : (current + direction + buttons.length) % buttons.length;
      buttons[next].focus({preventScroll: true});
    }}>
    <div inert={locked}>
      <div className="story-choices__list">
        <motion.div className="story-choices__markers" aria-hidden="true" variants={{
          hidden: {opacity: 0},
          shown: {opacity: 1, y: 0, transition: {...enter, delay: reduced ? 0 : timing.staggerMs / 1000}},
          confirm: {opacity: 1, y: 0}, exit: picked ? confirmExit : {opacity: 0, transition: transition(timing.exitMs)},
        }}>
          {(["left", "right"] as const).map(side => <motion.div key={side} className={`story-choices__cursor story-choices__cursor--${side}`}
            initial={false} animate={{y: index * (ROW_HEIGHT + ROW_GAP)}}
            transition={reduced ? {duration: 0} : {
              ...uiTransition(side === "left" ? timing.cursorMs : timing.cursorRightMs),
              ease: [...timing.cursorEase] as [number, number, number, number], delay: side === "right" ? timing.cursorLagMs / 1000 : 0,
            }}><span className="story-choices__gem-seat"><i className="story-choices__gem"/></span></motion.div>)}
        </motion.div>
        {decision.options.map((option, order) => <motion.div key={option.id} className="story-choices__row" data-choice-id={option.id} custom={{index: order, id: option.id}} variants={itemVariants}>
          <button type="button" className="abyssa-ribbon-button story-choices__button" data-size="lg" data-full-width="true" disabled={locked}
            data-highlighted={selected === option.id || undefined} data-selected={picked === option.id || undefined}
            onPointerEnter={event => {
              if (locked || event.pointerType === "touch") return;
              setHighlighted(option.id);
              if (root.current?.contains(document.activeElement)) event.currentTarget.focus({preventScroll: true});
            }} onFocus={() => {if (!locked) setHighlighted(option.id);}}
            onClick={event => {if (event.detail <= 1) void choose(option.id);}}>
            <span className="story-choices__surface" aria-hidden="true"><RibbonFrameArt sideDiamonds={false}/></span>
            <span className="abyssa-ribbon-button__label">{option.label}</span>
          </button>
        </motion.div>)}
      </div>
    </div>
    {failed && <p className="story-choices__error" role="alert">选择未能提交，请重试。</p>}
  </motion.section>;
}
