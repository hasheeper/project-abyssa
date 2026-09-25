import { useCallback, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { CHARACTER_EMOTION_PROFILES } from "../../content/presentation/character-emotions";
import type { ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import { PaperDoll } from "../../shared/ui/patterns/PaperDoll";
import { CHARACTER_EXPRESSIONS } from "../../shared/ui/patterns/expressions";
import { resolveEmotionCue } from "../../shared/ui/patterns/emotion-cues";
import { RpgDialogue } from "../../shared/ui/primitives/RpgDialogue";
import "../../shared/ui/styles/paper-doll.css";
import "./shop-dialogue.css";

const actor = {id: "tibby", emotionProfile: CHARACTER_EMOTION_PROFILES.tibby};
const spriteBaseUrl = import.meta.env.DEV ? "/src/assets/characters/paper-dolls/" : `${import.meta.env.BASE_URL}character-art/`;
const portraitCalibration = {scale: 1, x: 0, y: 0};
export const shopMerchantAssets = [...new Set(["base", ...Object.values(CHARACTER_EXPRESSIONS.tibby)
  .flatMap(parts => [`eyes_${parts.eyes}`, `mouth_${parts.mouth}`])])].map(part => `${spriteBaseUrl}tibby/${part}.png`);

/** One speech identity drives both the AVG typewriter and its layered expression. */
export function ShopMerchantDialogue({line, lineKey, ready, portraitHost, disabled = false, onContinue, continueLabel, continueRef}: {
  line: ShopDialogueLine; lineKey: string; ready: boolean; portraitHost: HTMLDivElement | null;
  disabled?: boolean; onContinue?: () => void; continueLabel?: string; continueRef?: Ref<HTMLButtonElement>;
}) {
  const [reading, setReading] = useState({key: lineKey, complete: false});
  // Reset before committing a revisited line; it must never flash fully written.
  if (reading.key !== lineKey) setReading({key: lineKey, complete: false});
  const typing = ready && (reading.key !== lineKey || !reading.complete);
  const dialogue = useRef<HTMLElement | null>(null), restoreFocus = useRef(false);
  const dialogueRef = useCallback((node: HTMLElement | null) => {
    if (!node && dialogue.current === document.activeElement) restoreFocus.current = true;
    dialogue.current = node;
    if (node && restoreFocus.current) {restoreFocus.current = false; node.focus({preventScroll: true});}
  }, []);
  const cue = resolveEmotionCue(actor, line.emotion);
  function advance() {
    if (!ready || disabled) return;
    if (typing) setReading({key: lineKey, complete: true});
    else onContinue?.();
  }
  return <>
    {portraitHost && createPortal(<PaperDoll characterId="tibby" expression={cue.expression}
      spriteBaseUrl={spriteBaseUrl} calibration={portraitCalibration} alt="缇比·奥雷利亚"/>, portraitHost)}
    <div className="shop-merchant-dialogue" data-continuable={!!onContinue || undefined} data-typing={typing}>
      <RpgDialogue key={lineKey} ref={dialogueRef} name="缇比" showNameplate={false} autoHeight
        text={ready ? line.text : ""} typing={typing} typingSpeed={28} onTypingEnd={() => setReading({key: lineKey, complete: true})}
        aria-live="polite" aria-atomic="true" aria-busy={typing} tabIndex={0}
        onClick={advance} onKeyDown={event => {
          if (event.target !== event.currentTarget || event.repeat || !["Enter", " "].includes(event.key)) return;
          event.preventDefault(); advance();
        }}/>
      {onContinue && <button type="button" className="shop-loot__next" ref={continueRef} disabled={disabled || !ready} onClick={advance}>
        <span>{continueLabel}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>
      </button>}
    </div>
  </>;
}
