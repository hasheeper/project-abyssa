import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ResolvedEmotion } from "./emotion-cues";
import { Emote } from "./Emote";
import { nod, waver, jump, shakeLight, shakeHeavy } from "./motions";
import type { EmotePlacement } from "./emotes";
import "../styles/emotion-actor.css";
import "../styles/emote.css";

export const EMOTION_CUE_MS = 2300;
const builders = { nod, waver, jump, shakeLight, shakeHeavy };
/** Own transform layer: never competes with entry, depth, crop or dialogue motion. */
export function EmotionActor({characterId, cue, active, hydrate = false, replay = false, delay = 0, placement, children}: {
  characterId: string; cue?: ResolvedEmotion; active: boolean; hydrate?: boolean; replay?: boolean;
  delay?: number; placement?: Partial<EmotePlacement>; children: ReactNode;
}) {
  const beat = useRef<HTMLDivElement>(null);
  const initialKey = useRef(hydrate ? cue?.key : undefined);
  const consumed = useRef<string | undefined>(undefined);
  const [visibleKey, setVisibleKey] = useState<string | null>(null);
  const animation = useRef<Animation | null>(null);
  const emote = cue?.emote, motion = cue?.motion;
  const motionId = motion?.id, amplitude = motion?.amplitude, duration = motion?.duration;
  useEffect(() => {
    if (!active || replay) { setVisibleKey(null); consumed.current = cue?.key; return; }
    if (!cue || !active || replay || initialKey.current === cue.key || consumed.current === cue.key || cue.key.startsWith("initial:")) return;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    // Deferred start survives StrictMode setup/cleanup without eating the only cue.
    const startTimer = setTimeout(() => {
      consumed.current = cue.key;
      if (document.hidden) return;
      setVisibleKey(cue.key);
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduced && motionId && beat.current?.animate) {
        const spec = builders[motionId](amplitude);
        animation.current = beat.current.animate(spec.keyframes, {...spec.options, duration});
      }
      stopTimer = setTimeout(() => setVisibleKey(null), EMOTION_CUE_MS);
    }, delay);
    const hide = () => {
      if (!document.hidden) return;
      consumed.current = cue.key;
      clearTimeout(startTimer); clearTimeout(stopTimer);
      animation.current?.cancel(); setVisibleKey(null);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(startTimer); clearTimeout(stopTimer);
      animation.current?.cancel(); animation.current = null;
      document.removeEventListener("visibilitychange", hide);
    };
  }, [cue?.key, active, replay, delay, emote, motionId, amplitude, duration]);
  return <div ref={beat} className="emotion-actor" data-emotion={cue?.trigger} data-cue-key={cue?.key}>
    {children}
    {active && !replay && visibleKey === cue?.key && emote && <Emote
      key={visibleKey} emoteId={emote} characterId={characterId} className="emotion-actor__bubble"
      placement={placement}
    />}
  </div>;
}
