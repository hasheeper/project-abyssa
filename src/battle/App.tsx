import { AbyssaProvider } from "../components/AbyssaProvider";
import { Stage } from "../stage";
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
