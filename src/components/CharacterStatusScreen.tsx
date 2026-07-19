import { useId, useState } from "react";
import type { CSSProperties, HTMLAttributes, KeyboardEvent } from "react";
import demonCadreCornerOrnament from "../assets/png2/frame-corner-symmetric.png";
import demonLordCornerOrnament from "../assets/png2/frame-corner-symmetric-red.png";
import heroPartyCornerOrnament from "../assets/png2/frame-corner-symmetric-gold.png";
import demonCadreTopOrnament from "../assets/png2/top.png";
import demonLordTopOrnament from "../assets/png2/top-red.png";
import heroPartyTopOrnament from "../assets/png2/top-gold.png";
import { useControllableState } from "../hooks/useControllableState";
import type { PanelVariant } from "../types";
import { cx } from "../utils/cx";
import { CharacterPortraitSelector } from "./CharacterPortraitSelector";
import { Nameplate } from "./Nameplate";
import { RpgDiamondNodeTrack } from "./RpgDiamondNodeTrack";
import { RpgFrame } from "./RpgFrame";
import { RpgHeader } from "./RpgHeader";
import { RpgTab } from "./RpgTab";
import { StatusPanel } from "./StatusPanel";
import type { StatusPanelAffiliationTone, StatusPanelData } from "./StatusPanel";
import { FrameEdgeWeave } from "./internal/FrameEdgeWeave";

export type CharacterInterfaceTone = StatusPanelAffiliationTone | "auto";

export interface CharacterOutfit {
  id: string;
  label: string;
  displayLabel: string;
  appearanceLabel?: string;
  portraitUrl: string;
  portraitAlt?: string;
}

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
  appearanceLabel?: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  outfits?: CharacterOutfit[];
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
  interfaceTone?: CharacterInterfaceTone;
  defaultInterfaceTone?: CharacterInterfaceTone;
  onInterfaceToneChange?: (tone: CharacterInterfaceTone) => void;
}

const defaultMenuItems: CharacterMenuItem[] = [
  { id: "summary", label: "概要" },
  { id: "equipment", label: "装备" },
  { id: "status", label: "状态" },
  { id: "archive", label: "记录" }
];

const topOrnamentByTone: Record<StatusPanelAffiliationTone, string> = {
  "demon-lord": demonLordTopOrnament,
  "demon-cadre": demonCadreTopOrnament,
  "hero-party": heroPartyTopOrnament
};

const cornerOrnamentByTone: Record<StatusPanelAffiliationTone, string> = {
  "demon-lord": demonLordCornerOrnament,
  "demon-cadre": demonCadreCornerOrnament,
  "hero-party": heroPartyCornerOrnament
};

type CharacterScreenStyle = CSSProperties & {
  "--abyssa-character-corner-image-theme"?: string;
};

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
  interfaceTone,
  defaultInterfaceTone = "auto",
  onInterfaceToneChange,
  className,
  style,
  ...props
}: CharacterStatusScreenProps) {
  const firstCharacterId = characters.find((character) => !character.disabled)?.id ?? "";
  const initialCharacterId = characters.some(
    (character) => character.id === defaultSelectedId && !character.disabled
  )
    ? defaultSelectedId!
    : firstCharacterId;
  const [currentId, setCurrentId] = useControllableState({
    value: selectedId,
    defaultValue: initialCharacterId,
    onChange: onSelectedIdChange
  });
  const firstMenuId = menuItems[0]?.id ?? "";
  const initialMenuId = menuItems.some((item) => item.id === defaultActiveMenuId)
    ? defaultActiveMenuId!
    : firstMenuId;
  const [currentMenuId, setCurrentMenuId] = useControllableState({
    value: activeMenuId,
    defaultValue: initialMenuId,
    onChange: onActiveMenuIdChange
  });
  const [currentInterfaceTone, setCurrentInterfaceTone] = useControllableState<CharacterInterfaceTone>({
    value: interfaceTone,
    defaultValue: defaultInterfaceTone,
    onChange: onInterfaceToneChange
  });
  const [outfitSelections, setOutfitSelections] = useState<Record<string, string>>({});
  const tabUid = useId().replaceAll(":", "");
  const currentCharacter =
    characters.find((character) => character.id === currentId && !character.disabled) ??
    characters.find((character) => !character.disabled);
  const currentMenuIndex = Math.max(
    0,
    menuItems.findIndex((item) => item.id === currentMenuId)
  );
  const characterTone = currentCharacter?.status.affiliation?.tone ?? "hero-party";
  const resolvedInterfaceTone = currentInterfaceTone === "auto" ? characterTone : currentInterfaceTone;
  const topOrnamentUrl = topOrnamentByTone[resolvedInterfaceTone];
  const cornerOrnamentUrl = cornerOrnamentByTone[resolvedInterfaceTone];
  const screenStyle: CharacterScreenStyle = {
    "--abyssa-character-corner-image-theme": `url("${cornerOrnamentUrl}")`,
    ...style
  };
  const currentOutfits = currentCharacter?.outfits ?? [];
  const currentOutfit = currentOutfits.find(
    (outfit) => outfit.id === outfitSelections[currentCharacter?.id ?? ""]
  ) ?? currentOutfits[0];
  const currentPortraitUrl = currentOutfit?.portraitUrl ?? currentCharacter?.portraitUrl;
  const currentPortraitAlt = currentOutfit?.portraitAlt ?? currentCharacter?.portraitAlt ?? currentCharacter?.name;
  const currentAppearanceLabel =
    currentOutfit?.appearanceLabel ??
    currentCharacter?.appearanceLabel ??
    currentOutfit?.label ??
    "原设形态";

  const selectCharacter = (id: string) => {
    setCurrentInterfaceTone("auto");
    setCurrentId(id);
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + menuItems.length) % menuItems.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % menuItems.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = menuItems.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextItem = menuItems[nextIndex];
    if (!nextItem) return;
    setCurrentMenuId(nextItem.id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [nextIndex]?.focus();
  };

  if (!currentCharacter) {
    return (
      <section
        className={cx("abyssa-character-screen", className)}
        style={style}
        {...props}
      >
        <RpgHeader label={title} description={subtitle} />
        <RpgFrame><p>暂无角色资料。</p></RpgFrame>
      </section>
    );
  }

  return (
    <section
      className={cx("abyssa-character-screen", className)}
      data-skin={resolvedInterfaceTone}
      style={screenStyle}
      {...props}
    >
      <div className="abyssa-character-screen__header-row">
        <img
          className="abyssa-character-screen__top-ornament abyssa-character-screen__top-ornament--left"
          src={topOrnamentUrl}
          alt=""
          aria-hidden="true"
          data-tone={resolvedInterfaceTone}
        />
        <RpgHeader label={title} description={subtitle} />
        <img
          className="abyssa-character-screen__top-ornament abyssa-character-screen__top-ornament--right"
          src={topOrnamentUrl}
          alt=""
          aria-hidden="true"
          data-tone={resolvedInterfaceTone}
        />
      </div>

      <RpgFrame className="abyssa-character-screen__shell" padding="lg">
        <FrameEdgeWeave namespace="abyssa-character-screen" />
        <div className="abyssa-character-screen__layout">
          <div
            className="abyssa-character-screen__visual"
            data-has-outfits={currentOutfits.length > 1 || undefined}
          >
            {currentOutfits.length > 1 && (
              <RpgDiamondNodeTrack
                className="abyssa-character-screen__outfit-selector"
                items={currentOutfits.map((outfit) => ({
                  id: outfit.id,
                  label: outfit.label,
                  displayLabel: outfit.displayLabel
                }))}
                value={currentOutfit?.id}
                onValueChange={(outfitId) => {
                  setOutfitSelections((previous) => ({
                    ...previous,
                    [currentCharacter.id]: outfitId
                  }));
                }}
                label="换装选择"
                orientation="vertical"
                selectedVariant="teal"
                watermark={false}
                data-outfits={JSON.stringify(currentOutfits.map((outfit) => ({
                  id: outfit.id,
                  portraitUrl: outfit.portraitUrl,
                  portraitAlt: outfit.portraitAlt
                })))}
              />
            )}

            <div className="abyssa-character-screen__portrait-column">
              <RpgFrame className="abyssa-character-screen__portrait" padding="none">
                {currentPortraitUrl ? (
                  <img
                    src={currentPortraitUrl}
                    alt={currentPortraitAlt}
                  />
                ) : (
                  <div className="abyssa-character-screen__portrait-placeholder" role="img" aria-label={`${currentCharacter.name}暂无立绘`}>
                    <span>{currentCharacter.number}</span>
                  </div>
                )}
                <div className="abyssa-character-screen__appearance" aria-live="polite">
                  <strong>{currentAppearanceLabel}</strong>
                </div>
              </RpgFrame>
              <Nameplate
                name={currentCharacter.name}
                secondaryName={currentCharacter.secondaryName}
              />
            </div>
          </div>

          <div className="abyssa-character-screen__details">
            <div className="abyssa-character-screen__tabs" role="tablist" aria-label="角色档案分类">
              {menuItems.map((item, index) => {
                const selected = index === currentMenuIndex;
                return (
                  <RpgTab
                    key={`${item.id}-${index}`}
                    id={`${tabUid}-tab-${index}`}
                    label={item.label}
                    role="tab"
                    variant={selected ? "teal" : "dark"}
                    selected={selected}
                    aria-selected={selected}
                    aria-controls={`${tabUid}-tabpanel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setCurrentMenuId(item.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  />
                );
              })}
            </div>
            <div
              className="abyssa-character-screen__tabpanel"
              id={`${tabUid}-tabpanel`}
              role="tabpanel"
              aria-labelledby={menuItems.length > 0 ? `${tabUid}-tab-${currentMenuIndex}` : undefined}
              tabIndex={0}
            >
              <StatusPanel data={currentCharacter.status} />
            </div>
          </div>
        </div>
      </RpgFrame>

      <CharacterPortraitSelector
        className="abyssa-character-screen__character-selector"
        items={characters.map((character) => ({
          id: character.id,
          label: character.name,
          number: character.number,
          thumbnailUrl: character.thumbnailUrl ?? character.portraitUrl,
          thumbnailAlt: character.thumbnailAlt ?? `${character.name}头像`,
          tone: character.status.affiliation?.tone,
          disabled: character.disabled
        }))}
        value={currentCharacter.id}
        onValueChange={selectCharacter}
        label="角色头像选择"
        loop
      />
    </section>
  );
}
