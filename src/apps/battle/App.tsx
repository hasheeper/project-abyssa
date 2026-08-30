import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { Stage } from "../../shared/stage";
import { ExpeditionBattleScreen } from "./ExpeditionBattleScreen";

export function App() {
  return (
    <Stage background="var(--abyssa-battle-backdrop)">
      <AbyssaProvider className="abyssa-expedition-theme">
        <ExpeditionBattleScreen />
      </AbyssaProvider>
    </Stage>
  );
}
