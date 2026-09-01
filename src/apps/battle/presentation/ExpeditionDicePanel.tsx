import { IconButton } from "../../../shared/ui/primitives/IconButton";
import {
  ActionDock,
  ActionDockSlot
} from "../../../shared/ui/patterns/action-dock/ActionDock";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { ExpeditionDie3D } from "../ExpeditionDie3D";
import {
  PARTY_ORDER,
  canToggleLoad,
  getGildFaceCount,
  getRustFaceCount,
  type CharacterId,
  type ExpeditionState,
  type HandEvaluation
} from "../engine";
import { buildDieFaces } from "./battle-view-model";
import { ExpeditionHandReadout } from "./ExpeditionBattleChrome";
import { PARTY_VISUALS } from "./expedition-visuals";
import type {
  EnemyTurnFx,
  ExpeditionDieVisual,
  PlayerAttackFx,
  PlayerSupportFx
} from "./useExpeditionBattlePresentation";

export type ExpeditionDicePanelProps = {
  engine: ExpeditionState;
  visuals: Record<CharacterId, ExpeditionDieVisual>;
  enemyTurnFx: EnemyTurnFx | null;
  scoringOwners: ReadonlySet<CharacterId>;
  interactive: boolean;
  initialRollReady: boolean;
  busy: boolean;
  attackFx: PlayerAttackFx | null;
  supportFx: PlayerSupportFx | null;
  hand: HandEvaluation | null;
  undoLabel: string | null;
  undoReady: boolean;
  unloadedRemain: boolean;
  onDieToggle: (index: number) => void;
  onUndo: () => void;
  onRoll: () => void;
  onReroll: () => void;
  onEndTurn: () => void;
};

export function ExpeditionDicePanel({
  engine,
  visuals,
  enemyTurnFx,
  scoringOwners,
  interactive,
  initialRollReady,
  busy,
  attackFx,
  supportFx,
  hand,
  undoLabel,
  undoReady,
  unloadedRemain,
  onDieToggle,
  onUndo,
  onRoll,
  onReroll,
  onEndTurn
}: ExpeditionDicePanelProps) {
  const awaitingInitialRoll = engine.mode.type === "awaiting-roll";

  return (
    <section className="abyssa-expedition-region abyssa-expedition-dice-panel" aria-label="骰子区域">
      <span className="abyssa-expedition-dice-panel__corners" aria-hidden="true">
        <i data-corner="tl" />
        <i data-corner="tr" />
        <i data-corner="br" />
        <i data-corner="bl" />
      </span>
      <div className="abyssa-expedition-dice-panel__tray">
        <span className="abyssa-expedition-dice-panel__pattern" aria-hidden="true" />
        <div className="abyssa-expedition-dice-panel__row">
          {PARTY_ORDER.map((ownerId, slotIndex) => {
            const dieIndex = engine.dice.findIndex((item) => item.ownerId === ownerId);
            const die = engine.dice[dieIndex]!;
            const member = engine.party.find((item) => item.id === ownerId)!;
            const visual = PARTY_VISUALS[ownerId];
            const dieVisual = visuals[ownerId];
            const value = die.faceIndex !== null ? die.faceIndex + 1 : 1;
            const rustFaceCount = getRustFaceCount(ownerId, member.rustLevel);
            const gildFaceCount = getGildFaceCount(ownerId, member.rustLevel);
            const deferDownedVisual = Boolean(
              enemyTurnFx?.intentType === "attack" &&
              enemyTurnFx.targetId === ownerId &&
              enemyTurnFx.lethal &&
              enemyTurnFx.phase === "impact"
            );
            const visuallyDowned = member.downed && !deferDownedVisual;

            return (
              <div
                className="abyssa-expedition-die-slot"
                data-owner={ownerId}
                data-slot={slotIndex + 1}
                data-downed={visuallyDowned || undefined}
                data-rust-faces={rustFaceCount || undefined}
                data-gild-faces={gildFaceCount || undefined}
                data-sealed={die.sealed || undefined}
                data-loaded={die.loaded || undefined}
                data-spent={die.spent || undefined}
                data-unrolled={die.faceIndex === null || undefined}
                style={{ gridColumn: slotIndex + 1 }}
                key={ownerId}
              >
                <ExpeditionDie3D
                  index={slotIndex}
                  value={value}
                  characterName={visual.name}
                  themeColor={visual.themeColor}
                  suit={visual.suit}
                  faces={buildDieFaces(ownerId, member.rustLevel)}
                  held={die.loaded}
                  scoring={scoringOwners.has(ownerId)}
                  rolling={dieVisual.rolling}
                  rollDuration={dieVisual.rollDuration}
                  rotation={die.faceIndex === null ? { x: -18, y: 28 } : dieVisual.rotation}
                  disabled={
                    member.downed ||
                    !interactive ||
                    !canToggleLoad(engine, dieIndex)
                  }
                  downed={visuallyDowned}
                  rustFaces={rustFaceCount}
                  gildFaces={gildFaceCount}
                  onToggle={() => onDieToggle(dieIndex)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <ActionDock active busy={busy || Boolean(attackFx) || Boolean(supportFx)}>
        <IconButton
          className="abyssa-expedition-undo"
          label={undoLabel ? `撤回：${undoLabel}` : "撤回"}
          shape="diamond"
          size="md"
          variant="dark"
          disabled={!interactive || !undoReady}
          onClick={onUndo}
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path d="M248.91 50a205.9 205.9 0 0 1 35.857 3.13c85.207 15.025 152.077 81.895 167.102 167.102 15.023 85.208-24.944 170.917-99.874 214.178-32.782 18.927-69.254 27.996-105.463 27.553-46.555-.57-92.675-16.865-129.957-48.15l30.855-36.768a157.846 157.846 0 0 0 180.566 15.797 157.846 157.846 0 0 0 76.603-164.274A157.848 157.848 0 0 0 276.429 100.4a157.84 157.84 0 0 0-139.17 43.862L185 192H57V64l46.34 46.342C141.758 71.962 194.17 50.03 248.91 50z" />
          </svg>
        </IconButton>
        <div className="abyssa-expedition-action-controls">
          <DiceActionButton
            label={awaitingInitialRoll ? "ROLL" : "REROLL"}
            disabled={
              awaitingInitialRoll
                ? !initialRollReady
                : !interactive || engine.rerollsRemaining <= 0 || !unloadedRemain
            }
            onClick={awaitingInitialRoll ? onRoll : onReroll}
          />
          <ActionDockSlot
            caption="REROLL"
            label={`重掷剩余 ${engine.rerollsRemaining} 次`}
            value={`×${engine.rerollsRemaining}`}
          />
          <ExpeditionHandReadout hand={hand} />
          <DiceActionButton
            label="END TURN"
            primary
            disabled={!interactive}
            onClick={onEndTurn}
          />
        </div>
      </ActionDock>
    </section>
  );
}
