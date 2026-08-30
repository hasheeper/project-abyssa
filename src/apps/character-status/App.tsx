import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { CharacterStatusScreen } from "../../shared/ui/patterns/CharacterStatusScreen";
import { characterProfiles } from "../../content/characters/profiles";
import { Stage } from "../../shared/stage";

export function App() {
  return (
    <Stage background="var(--abyssa-character-status-backdrop)">
      <AbyssaProvider className="character-status-app">
        <main className="character-status-app__main">
          <CharacterStatusScreen
            characters={characterProfiles}
            defaultSelectedId="abyssa"
          />
        </main>
      </AbyssaProvider>
    </Stage>
  );
}
