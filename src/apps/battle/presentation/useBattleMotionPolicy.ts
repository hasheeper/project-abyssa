import { useSyncExternalStore } from "react";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";

const hiddenSnapshot=()=>typeof document!=="undefined"&&document.hidden;
const serverSnapshot=()=>false;
function subscribeVisibility(notify:()=>void) {
  document.addEventListener("visibilitychange",notify);
  return ()=>document.removeEventListener("visibilitychange",notify);
}

/** Ambient scheduling only. Authoritative combat queues/impact timing are not
 * paused or replayed by this policy. One subscriber per battle, no global RAF. */
export function useBattleMotionPolicy({blocked,foregroundBusy}:{blocked:boolean;foregroundBusy:boolean}) {
  const {reduced}=useUiMotion();
  const hidden=useSyncExternalStore(subscribeVisibility,hiddenSnapshot,serverSnapshot);
  const ambientPaused=blocked||hidden||reduced;
  return {ambientPaused,linksPaused:ambientPaused||foregroundBusy,fogThrottled:foregroundBusy};
}

export type BattleMotionPolicy=ReturnType<typeof useBattleMotionPolicy>;
