import { AbyssaProvider } from "../components/AbyssaProvider";
import { CharacterStatusScreen } from "../components/CharacterStatusScreen";
import { demoCharacters } from "../demo/data";

export function App() {
  return (
    <AbyssaProvider className="character-status-app">
      <main className="character-status-app__main">
        <CharacterStatusScreen
          characters={demoCharacters}
          defaultSelectedId="abyssa"
        />
      </main>
    </AbyssaProvider>
  );
}
