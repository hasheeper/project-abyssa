import { CharacterStatusScreen, type CharacterStatusScreenProps } from "../../shared/ui/patterns/CharacterStatusScreen";
import { StatusPanel } from "../../shared/ui/patterns/StatusPanel";
import { CharacterContentSwap } from "./CharacterContentSwap";
import { useCharacterIntro } from "./useCharacterIntro";
import { useControllableState } from "../../shared/lib/useControllableState";
import { useCharacterChange } from "./useCharacterChange";
import "../../shared/ui/motion/page-board.css";

/** Character-page pilot: the shared screen remains static unless opted in here. */
export function CharacterBoardScreen({ renderTabPanel, characters, selectedId, defaultSelectedId, onSelectedIdChange, ...props }: CharacterStatusScreenProps) {
  const intro = useCharacterIntro();
  const [selection, select] = useControllableState({ value: selectedId, defaultValue: defaultSelectedId ?? "", onChange: onSelectedIdChange });
  const requested = characters.find(character => character.id === selection && !character.disabled) ?? characters.find(character => !character.disabled);
  const change = useCharacterChange(requested, intro.ref);
  return <main ref={intro.ref} className="character-status-app__main"
    data-character-intro={intro.state} data-character-reduced={intro.reduced}
    data-character-change={change.phase} data-character-displayed={change.displayedId}
    aria-busy={change.phase !== "ready" || undefined}>
    <CharacterStatusScreen {...props} characters={characters} selectedId={requested?.id}
      onSelectedIdChange={select} displayedId={change.displayedId}
      renderPortrait={({ character, imageUrl, portrait }) =>
        <CharacterContentSwap key={character.id} className="character-board__portrait-content"
          contentKey={`${character.id}:${imageUrl ?? "placeholder"}`} imageUrl={imageUrl}>
          {portrait}
        </CharacterContentSwap>}
      renderTabPanel={args =>
        <CharacterContentSwap key={args.character.id} className="character-board__panel-content"
          contentKey={`${args.character.id}:${args.menuId}`}>
          {renderTabPanel ? renderTabPanel(args) : <StatusPanel data={args.character.status} />}
        </CharacterContentSwap>}
    />
  </main>;
}
