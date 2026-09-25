import { useCallback, useRef, useState } from "react";
import type { ShopDialogueLine } from "../../content/presentation/shop-dialogue";
import { PaperDoll } from "../../shared/ui/patterns/PaperDoll";
import { resolveEmotionCue } from "../../shared/ui/patterns/emotion-cues";
import { RpgDialogue } from "../../shared/ui/primitives/RpgDialogue";
import { Nameplate } from "../../shared/ui/primitives/Nameplate";
import { shopActor, shopSpriteBase } from "./merchant-art";

const calibration = {scale: 1, x: 0, y: 0};

/** The shop window owns the crop; the same AVG primitives own speech and expression. */
export function MerchantWindow({line, turn, ready, typing, onTypingEnd, onAdvance}: {
  line: ShopDialogueLine; turn: number; ready: boolean; typing: boolean;
  onTypingEnd: () => void; onAdvance: () => void;
}) {
  const cue = resolveEmotionCue(shopActor, line.emotion);
  // Arm AVG layer fades only on a later expression change, never at intro completion.
  const [face, setFace] = useState({expression: cue.expression, animate: false});
  if (face.expression !== cue.expression || (!ready && face.animate)) {
    setFace({expression: cue.expression, animate: ready});
  }
  const dialogue = useRef<HTMLElement | null>(null), restoreFocus = useRef(false);
  const dialogueRef = useCallback((node: HTMLElement | null) => {
    if (!node && dialogue.current === document.activeElement) restoreFocus.current = true;
    dialogue.current = node;
    if (node && restoreFocus.current) {restoreFocus.current = false; node.focus({preventScroll: true});}
  }, []);
  return <aside className="new-shop__merchant" aria-label="店主缇比">
    <div className="new-shop__opening">
      <div className="new-shop__interior" aria-hidden="true" />
      <div className="new-shop__actor" data-expression-motion={face.animate || undefined}>
        <PaperDoll characterId={shopActor.id} spriteBaseUrl={shopSpriteBase} expression={cue.expression} calibration={calibration} alt="缇比·奥雷利亚" />
      </div>
      <div className="new-shop__window-depth" aria-hidden="true" />
    </div>
    <div className="new-shop__speech" data-typing={ready && typing}>
      <svg className="new-shop__speech-frame" viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2 2h482q0 12 14 15v114q-14 3-14 17H16q0-13-14-17Z" fill="#1d1812" stroke="#110d09" strokeWidth="5" />
        <path d="M4 4h478q2 12 14 15v110q-13 4-14 17H18q-2-12-14-17Z" stroke="#78613e" strokeWidth="1.5" />
        <path d="M12 12h463q3 10 13 13v98q-10 4-13 15H25q-3-10-13-15Z" stroke="#433523" strokeWidth="1" />
      </svg>
      <Nameplate className="new-shop__nameplate" name="缇比·奥雷利亚" secondaryName="TIBBY AURELIA" />
      {ready && <RpgDialogue key={turn} ref={dialogueRef} name="缇比" text={line.text} showNameplate={false} autoHeight typing={typing} typingSpeed={28}
        tabIndex={0} aria-live="polite" aria-atomic="true" aria-busy={typing}
        onTypingEnd={onTypingEnd} onClick={onAdvance}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || event.repeat || !["Enter", " "].includes(event.key)) return;
          event.preventDefault(); onAdvance();
        }} />}
    </div>
    <div className="new-shop__sill" aria-hidden="true" />
  </aside>;
}
