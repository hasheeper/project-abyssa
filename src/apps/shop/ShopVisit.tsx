import { createContext, useContext, useRef, type ReactNode } from "react";
import { Stage } from "../../shared/stage";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { useSceneTransition } from "../../shared/transition";
import { SceneSequence } from "../../shared/presentation/adv/SceneSequence";
import { shopIntroduction } from "../../content/presentation/shop-introduction";
import { ShopIntroduction, shopIntroductionAssets } from "./ShopIntroduction";
import "./shop-visit.css";

export const ShopVisitEntrance = createContext<"standard" | "handoff">("standard");
export const useShopVisitEntrance = () => useContext(ShopVisitEntrance);

/** One canvas across the first conversation and the ordinary counter. */
export function ShopVisit({introduction, busy, onAdvance, onExit, children, copper = false}: {
  introduction: {step: number} | null; busy: boolean;
  onAdvance: (choice: "continue" | "skip") => void; onExit: () => void; children: ReactNode; copper?: boolean;
}) {
  const transition = useSceneTransition();
  const afterIntroduction = useRef(!!introduction);
  const fromBeginning = useRef(introduction?.step === 0);
  return <AbyssaProvider><Stage background="var(--abyssa-shop-backdrop)" canvasClassName="abyssa-shop-stage shop-visit">
    <SceneSequence openingBlocked={transition.isTransitioning} frame={introduction ? {
      id: shopIntroduction.id, kind: "adv", assets: shopIntroductionAssets,
      arrival: fromBeginning.current ? {background: shopIntroduction.background, eyebrow: "WATCHER'S CLIFF · MARKET", title: shopIntroduction.location} : undefined,
      content: <ShopIntroduction step={introduction.step} busy={busy} onAdvance={onAdvance} onExit={onExit} copper={copper}/>,
    } : {id: "shop.counter", kind: "battle", content: <ShopVisitEntrance.Provider value={afterIntroduction.current ? "handoff" : "standard"}>{children}</ShopVisitEntrance.Provider>}}/>
  </Stage></AbyssaProvider>;
}
