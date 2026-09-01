import type { ReactNode } from "react";
import { RpgHeader } from "../../../shared/ui/primitives/RpgHeader";
import { FrameEdgeWeave } from "../../../shared/ui/patterns/internal/FrameEdgeWeave";
import {
  BATTLE_UI_SKINS,
  getNextBattleUiSkin,
  resolveBattleUiSkin,
  type BattleUiSkin
} from "../battleUiSkins";
import { BattleFrameCorners, FrameRails } from "./ExpeditionBattleChrome";

export type ExpeditionBattleFrameProps = {
  skin: BattleUiSkin;
  onCycleSkin: () => void;
  children: ReactNode;
};

export function ExpeditionBattleFrame({
  skin,
  onCycleSkin,
  children
}: ExpeditionBattleFrameProps) {
  const definition = resolveBattleUiSkin(skin);
  const skinIndex = BATTLE_UI_SKINS.findIndex((candidate) => candidate.id === skin);
  const nextDefinition = resolveBattleUiSkin(getNextBattleUiSkin(skin));

  return (
    <div className="abyssa-expedition-frame abyssa-scene-panel">
      <button
        type="button"
        className="abyssa-expedition-skin-switch"
        onClick={onCycleSkin}
        aria-label={`切换战斗界面风格，当前${definition.label}，下一项${nextDefinition.label}`}
      >
        <span className="abyssa-expedition-skin-switch__sigil" aria-hidden="true">
          {BATTLE_UI_SKINS.map((candidate) => (
            <i key={candidate.id} data-skin={candidate.id} />
          ))}
        </span>
        <span className="abyssa-expedition-skin-switch__copy">
          <small>UI FRAME</small>
          <strong>{definition.label}</strong>
        </span>
        <span className="abyssa-expedition-skin-switch__index" aria-hidden="true">
          {skinIndex + 1}/{BATTLE_UI_SKINS.length}
        </span>
      </button>

      <header className="abyssa-expedition-frame__header">
        {definition.topOrnamentUrl && (
          <img
            key={`${skin}-top-left`}
            className="abyssa-expedition-frame__top-ornament abyssa-expedition-frame__top-ornament--left"
            src={definition.topOrnamentUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
        <RpgHeader label="裂隙远征" variant="dark" />
        <span>ABYSSAL EXPEDITION</span>
        {definition.topOrnamentUrl && (
          <img
            key={`${skin}-top-right`}
            className="abyssa-expedition-frame__top-ornament abyssa-expedition-frame__top-ornament--right"
            src={definition.topOrnamentUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        )}
      </header>

      <div className="abyssa-expedition-frame__shell">
        <FrameRails />
        {definition.cornerOrnamentUrl && (
          <>
            {definition.edgeWeave && (
              <FrameEdgeWeave namespace="abyssa-expedition-frame" />
            )}
            <BattleFrameCorners imageUrl={definition.cornerOrnamentUrl} skin={skin} />
          </>
        )}
        <div className="abyssa-expedition-frame__brass">
          <div className="abyssa-expedition-frame__board">
            <div className="abyssa-expedition-frame__interior">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
