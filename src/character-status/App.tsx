import { AbyssaProvider } from "../components/AbyssaProvider";
import { CharacterStatusScreen } from "../components/CharacterStatusScreen";
import { demoCharacters } from "../demo/data";
import { Stage } from "../stage";

export function App() {
  return (
    <Stage background="var(--abyssa-character-status-backdrop)">
      <AbyssaProvider className="character-status-app">
        <main className="character-status-app__main">
          <CharacterStatusScreen
            characters={demoCharacters}
            defaultSelectedId="abyssa"
          />
        </main>
      </AbyssaProvider>
    </Stage>
  );
}
