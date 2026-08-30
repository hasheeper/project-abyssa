export interface MenuSceneControlsProps {
  characterName: string;
  characterIndex: number;
  characterCount: number;
  backgroundName: string;
  backgroundIndex: number;
  backgroundCount: number;
  onNextCharacter: () => void;
  onNextBackground: () => void;
}

function counter(current: number, total: number) {
  return `${current + 1}/${total}`;
}

/** 左下角陈列控制台：角色与背景都是可扩展的循环选择器。 */
export function MenuSceneControls({
  characterName,
  characterIndex,
  characterCount,
  backgroundName,
  backgroundIndex,
  backgroundCount,
  onNextCharacter,
  onNextBackground
}: MenuSceneControlsProps) {
  return (
    <aside className="menu-scene-controls" aria-label="陈列切换">
      <button
        type="button"
        className="menu-scene-controls__item"
        data-kind="character"
        aria-label={`切换角色，当前${characterName}，${counter(characterIndex, characterCount)}`}
        title="切换角色"
        onClick={onNextCharacter}
      >
        <i className="menu-scene-controls__icon" aria-hidden="true" />
        <span className="menu-scene-controls__counter" aria-hidden="true">
          {counter(characterIndex, characterCount)}
        </span>
        <i className="menu-scene-controls__switch-mark" aria-hidden="true" />
      </button>

      <button
        type="button"
        className="menu-scene-controls__item"
        data-kind="background"
        aria-label={`切换背景，当前${backgroundName}，${counter(backgroundIndex, backgroundCount)}`}
        title="切换背景"
        onClick={onNextBackground}
      >
        <i className="menu-scene-controls__icon" aria-hidden="true" />
        <span className="menu-scene-controls__counter" aria-hidden="true">
          {counter(backgroundIndex, backgroundCount)}
        </span>
        <i className="menu-scene-controls__switch-mark" aria-hidden="true" />
      </button>
    </aside>
  );
}
