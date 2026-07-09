import type { HTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import type { PanelVariant } from "../types";
import { cx } from "../utils/cx";
import { CharacterSelector } from "./CharacterSelector";
import { Nameplate } from "./Nameplate";
import { RibbonButton } from "./RibbonButton";
import { RpgFrame } from "./RpgFrame";
import { SectionHeader } from "./SectionHeader";
import { StatusPanel } from "./StatusPanel";
import type { StatusPanelData } from "./StatusPanel";

export interface CharacterProfile {
  id: string;
  number: string;
  name: string;
  secondaryName?: string;
  selectorLabel?: string;
  selectorVariant?: PanelVariant;
  disabled?: boolean;
  portraitUrl?: string;
  portraitAlt?: string;
  status: StatusPanelData;
}

export interface CharacterMenuItem {
  id: string;
  label: string;
}

export interface CharacterStatusScreenProps
  extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  characters: CharacterProfile[];
  selectedId?: string;
  defaultSelectedId?: string;
  onSelectedIdChange?: (id: string) => void;
  menuItems?: CharacterMenuItem[];
  activeMenuId?: string;
  defaultActiveMenuId?: string;
  onActiveMenuIdChange?: (id: string) => void;
  title?: string;
  subtitle?: string;
}

const defaultMenuItems: CharacterMenuItem[] = [
  { id: "summary", label: "概要" },
  { id: "equipment", label: "装备" },
  { id: "status", label: "状态" },
  { id: "archive", label: "记录" }
];

export function CharacterStatusScreen({
  characters,
  selectedId,
  defaultSelectedId,
  onSelectedIdChange,
  menuItems = defaultMenuItems,
  activeMenuId,
  defaultActiveMenuId,
  onActiveMenuIdChange,
  title = "STATUS",
  subtitle = "CHARACTER ARCHIVE",
  className,
  ...props
}: CharacterStatusScreenProps) {
  const firstCharacterId = characters.find((character) => !character.disabled)?.id ?? "";
  const [currentId, setCurrentId] = useControllableState({
    value: selectedId,
    defaultValue: defaultSelectedId ?? firstCharacterId,
    onChange: onSelectedIdChange
  });
  const [currentMenuId, setCurrentMenuId] = useControllableState({
    value: activeMenuId,
    defaultValue: defaultActiveMenuId ?? menuItems[0]?.id ?? "",
    onChange: onActiveMenuIdChange
  });
  const currentCharacter =
    characters.find((character) => character.id === currentId) ?? characters[0];

  if (!currentCharacter) {
    return (
      <section className={cx("abyssa-character-screen", className)} {...props}>
        <SectionHeader title={title} subtitle={subtitle} />
        <RpgFrame><p>暂无角色资料。</p></RpgFrame>
      </section>
    );
  }

  return (
    <section className={cx("abyssa-character-screen", className)} {...props}>
      <SectionHeader title={title} subtitle={subtitle} />

      <RpgFrame className="abyssa-character-screen__shell" padding="lg">
        <div className="abyssa-character-screen__layout">
          <CharacterSelector
            className="abyssa-character-screen__selector"
            items={characters.map((character) => ({
              id: character.id,
              number: character.number,
              label: character.selectorLabel ?? character.name,
              variant: character.selectorVariant,
              disabled: character.disabled
            }))}
            value={currentCharacter.id}
            onValueChange={setCurrentId}
          />

          <div className="abyssa-character-screen__portrait-column">
            <RpgFrame className="abyssa-character-screen__portrait" padding="none">
              {currentCharacter.portraitUrl ? (
                <img
                  src={currentCharacter.portraitUrl}
                  alt={currentCharacter.portraitAlt ?? currentCharacter.name}
                />
              ) : (
                <div className="abyssa-character-screen__portrait-placeholder" role="img" aria-label={`${currentCharacter.name}暂无立绘`}>
                  <span>{currentCharacter.number}</span>
                </div>
              )}
            </RpgFrame>
            <Nameplate
              name={currentCharacter.name}
              secondaryName={currentCharacter.secondaryName}
            />
          </div>

          <StatusPanel data={currentCharacter.status} />
        </div>
      </RpgFrame>

      <nav className="abyssa-character-screen__menu" aria-label="角色状态菜单">
        {menuItems.map((item) => (
          <RibbonButton
            key={item.id}
            size="sm"
            variant={item.id === currentMenuId ? "teal" : "dark"}
            selected={item.id === currentMenuId}
            onClick={() => setCurrentMenuId(item.id)}
          >
            {item.label}
          </RibbonButton>
        ))}
      </nav>
    </section>
  );
}
