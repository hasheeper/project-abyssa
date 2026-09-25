import { StoryReading } from "../../game-client/StoryReading";
import { shopIntroduction, copperShopIntroduction } from "../../content/presentation/shop-introduction";
import { storyAssets } from "../../game-client/story-actors";
import { useSceneSequenceBusy } from "../../shared/presentation/adv/SceneSequence";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";

export const shopIntroductionAssets = storyAssets(shopIntroduction.lines, shopIntroduction.background);

/** Shared AVG presentation; only the saved cursor advances the introduction. */
export function ShopIntroduction({step, busy, onAdvance, onExit, copper = false}: {
  step: number; busy: boolean; onAdvance: (choice: "continue" | "skip") => void; onExit: () => void; copper?: boolean;
}) {
  const transitioning = useSceneSequenceBusy();
  const locked = busy || transitioning;
  return <StoryReading wide title={shopIntroduction.title} location={shopIntroduction.location}
    background={shopIntroduction.background} lines={copper ? copperShopIntroduction.lines : shopIntroduction.lines} cursor={step} busy={busy}
    finalLabel="看看柜台" onNext={() => onAdvance("continue")}
    controls={<ReadingTool label="返回洋馆" caption="BACK" glyph="back" disabled={locked} onClick={onExit}/>}/>;
}
