import { useContext, useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { SceneTransitionContext, useSceneReady } from "../../shared/transition/TransitionProvider";
import { usePageUiIntro, type PageUiIntroState } from "../../shared/transition/usePageUiIntro";
import { useSceneSequenceBusy } from "../../shared/presentation/adv/SceneSequence";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import { prepareNewShopAssets } from "./entrance-assets";
import { SHOP_REVEAL_MS, shopEntrance, shopEntranceKeys, type ShopEntranceProfile } from "./entrance";

export function useNewShopPreparation() {
  const externalCurtain = useContext(SceneTransitionContext) !== null;
  const {reduced} = useUiMotion();
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [revealed, setRevealed] = useState(false);
  const covered = useSceneReady(status !== "loading");
  useEffect(() => {
    let current = true;
    void prepareNewShopAssets().then(() => {if (current) setStatus("loaded");}, () => {if (current) setStatus("error");});
    return () => {current = false;};
  }, [attempt]);
  useLayoutEffect(() => {
    if (status !== "loaded") return;
    if (externalCurtain || reduced || document.hidden) {setRevealed(true); return;}
    const finish = () => setRevealed(true);
    const timer = window.setTimeout(finish, SHOP_REVEAL_MS);
    const hidden = () => {if (document.hidden) finish();};
    document.addEventListener("visibilitychange", hidden);
    return () => {window.clearTimeout(timer); document.removeEventListener("visibilitychange", hidden);};
  }, [status, externalCurtain, reduced]);
  return {
    ready: status === "loaded" && revealed, status,
    showCover: status === "error" || !covered && !(status === "loaded" && revealed),
    retry: () => {setStatus("loading"); setRevealed(false); setAttempt(current => current + 1);},
  };
}

/** Replay remounts this controller alone; inventory and scene elements keep their identities. */
export function NewShopIntro({root, ready, profile, onState}: {
  root: RefObject<HTMLElement | null>; ready: boolean; profile: ShopEntranceProfile;
  onState: (state: PageUiIntroState) => void;
}) {
  const suspended = useSceneSequenceBusy();
  const intro = usePageUiIntro({ref: root, ready, suspended, durationMs: shopEntrance(profile).durationMs,
    keys: shopEntranceKeys, settleOnFocus: true, inputRootSelector: ".new-shop"});
  useLayoutEffect(() => {
    if (intro.state === "playing") {
      // The controller can be replayed while its DOM stays mounted. Rewind the
      // page-owned CSS tracks too, including a quick replay within one paint.
      const scene = root.current?.closest(".new-shop");
      scene?.getAnimations?.({subtree: true}).forEach(animation => {
        if ((animation as CSSAnimation).animationName?.startsWith("new-shop-")) animation.currentTime = 0;
      });
    }
    onState(intro.state);
  }, [intro.state, onState, root]);
  return null;
}
