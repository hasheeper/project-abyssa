import { useState } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { Stage } from "../../shared/stage";
import { SceneArrivalTitle } from "../../shared/transition";
import { ExpeditionBattleScreen } from "./ExpeditionBattleScreen";
import type { BattleUiSkin } from "./battleUiSkins";

export function App() {
  const [uiSkin, setUiSkin] = useState<BattleUiSkin>("timber");

  return (
    <Stage
      background="var(--abyssa-battle-backdrop)"
      canvasClassName={`abyssa-battle-stage abyssa-battle-stage--${uiSkin}`}
    >
      <SceneArrivalTitle
        eyebrow="ABYSSAL EXPEDITION · RIFT 01"
        title="混沌领域"
        tone="gold"
      />
      <AbyssaProvider className="abyssa-expedition-theme" data-battle-ui-skin={uiSkin}>
        <ExpeditionBattleScreen uiSkin={uiSkin} onUiSkinChange={setUiSkin} />
      </AbyssaProvider>
    </Stage>
  );
}
