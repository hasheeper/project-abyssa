import type { ReactNode } from "react";
import bagIcon from "../../../assets/icons/items/backpack.svg";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import {
  ActionDock,
  ActionDockSlot
} from "../../../shared/ui/patterns/action-dock/ActionDock";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { ExpeditionDie3D, getExpeditionDieRotation } from "../ExpeditionDie3D";
import {
  canToggleLoad,
  getGildFaceCount,
  getRustFaceCount,
  type CharacterId,
  type ExpeditionState,
  type HandEvaluation
} from "../view";
import { buildDieFaces } from "./battle-view-model";
import { ExpeditionHandReadout } from "./ExpeditionBattleChrome";
import { PARTY_VISUALS } from "./expedition-visuals";
import type {
  ExpeditionDieVisual,
  PlayerAttackFx,
  PlayerSupportFx
} from "./useExpeditionBattlePresentation";

export type ExpeditionDicePanelProps = {
  engine: ExpeditionState;
  itemPanel?: {open: boolean; onToggle: () => void; content: ReactNode};
  controls?: ReactNode;
  visuals: Record<CharacterId, ExpeditionDieVisual>;
  enemyTurnFx: import("./battle-surface-model").BattleEnemyFx | null;
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
  return <ExpeditionDiceTray
    slots={engine.party.map(member => {
      const dieIndex = engine.dice.findIndex(d => d.ownerId === member.id), die = engine.dice[dieIndex]!;
      return {...die, dieIndex, downed: member.downed,
        rustFaceCount: getRustFaceCount(member.id, member.rustLevel), gildFaceCount: getGildFaceCount(member.id, member.rustLevel),
        faces: buildDieFaces(member.id, member.rustLevel), canToggle: canToggleLoad(engine, dieIndex),
      };
    })}
    awaitingInitialRoll={engine.mode.type === "awaiting-roll"} rerollsRemaining={engine.rerollsRemaining}
    {...{visuals, enemyTurnFx, scoringOwners, interactive, initialRollReady, busy, attackFx, supportFx,
      hand, undoLabel, undoReady, unloadedRemain, onDieToggle, onUndo, onRoll, onReroll, onEndTurn}}
  />;
}

export type ExpeditionDiceSlot = {
  ownerId: string; dieIndex: number; downed: boolean; rustFaceCount: number; gildFaceCount: number;
  eventCheck?: "rolling" | "checking" | "outcome";
  faceIndex: number | null; loaded: boolean; spent: boolean; sealed: boolean; canToggle: boolean;
  faces: readonly import("../ExpeditionDie3D").ExpeditionDieFace[];
};
export type ExpeditionDiceTrayProps = Omit<ExpeditionDicePanelProps, "engine"> & {
  slots: ExpeditionDiceSlot[]; awaitingInitialRoll: boolean; rerollsRemaining: number;
};

// Explain visible states only. The core's hand/contributors remain authoritative.
function handExclusion(die: ExpeditionDiceSlot) {
  if (die.downed) return "力竭";
  if (die.sealed) return "封锁";
  if (die.faceIndex === null) return "未掷";
  if (die.faces[die.faceIndex]?.asleep) return "沉眠";
  return null;
}

function dieHandHint(die: ExpeditionDiceSlot) {
  const excluded = handExclusion(die);
  const face = die.faceIndex === null ? null : die.faces[die.faceIndex];
  const pip = face ? `命数 ${face.wildPip ? "万能" : `${face.pip ?? die.faceIndex! + 1} 点`}，` : "";
  const action = die.spent ? "已使用；" : die.loaded ? "已固定；" : "";
  return `${action}${pip}${excluded ? `${excluded}不参与成牌` : "参与成牌"}`;
}

function handExplanation(slots: ExpeditionDiceSlot[], hand: HandEvaluation | null) {
  const excluded = slots.filter(d => handExclusion(d)).map(d => `${PARTY_VISUALS[d.ownerId].name}（${handExclusion(d)}）`);
  return [
    hand ? `参与判定点数：${hand.pips.join(" / ") || "无"}` : "掷骰后判定牌型",
    hand?.contributors.length ? `成牌：${hand.contributors.map(id => PARTY_VISUALS[id].name).join("、")}` : null,
    excluded.length ? `不计入：${excluded.join("、")}` : null,
    "已使用、已固定仍参与成牌；力竭、封锁、沉眠、未掷不参与。",
    "回合结束时结算，牌型加成累加至倍率。",
  ].filter(Boolean).join("\n");
}

export function ExpeditionDiceTray({slots, awaitingInitialRoll, rerollsRemaining, visuals, enemyTurnFx,
  scoringOwners, interactive, initialRollReady, busy, attackFx, supportFx, hand, undoLabel, undoReady,
  unloadedRemain, onDieToggle, onUndo, onRoll, onReroll, onEndTurn, itemPanel, controls}: ExpeditionDiceTrayProps) {
  return (
    <section className="abyssa-expedition-region abyssa-expedition-dice-panel" aria-label="骰子区域">
      <div className="abyssa-expedition-dice-panel__tray">
        <span className="abyssa-expedition-dice-panel__pattern" aria-hidden="true" />
        <div className="abyssa-expedition-dice-panel__row">
          {slots.map((die, slotIndex) => {
            const {ownerId, dieIndex, rustFaceCount, gildFaceCount} = die;
            const visual = PARTY_VISUALS[ownerId];
            const dieVisual = visuals[ownerId];
            const value = die.faceIndex !== null ? die.faceIndex + 1 : 1;
            const deferDownedVisual = Boolean(
              enemyTurnFx?.intentType === "attack" &&
              enemyTurnFx.targetId === ownerId &&
              enemyTurnFx.lethal &&
              enemyTurnFx.phase === "impact"
            );
            const visuallyDowned = die.downed && !deferDownedVisual;
            const handHint = controls ? undefined : dieHandHint(die);

            return (
              <div
                className="abyssa-expedition-die-slot"
                data-owner={ownerId}
                data-event-check={die.eventCheck}
                data-slot={slotIndex + 1}
                data-downed={visuallyDowned || undefined}
                data-rust-faces={rustFaceCount || undefined}
                data-gild-faces={gildFaceCount || undefined}
                data-sealed={die.sealed || undefined}
                data-loaded={die.loaded || undefined}
                data-spent={die.spent || undefined}
                data-unrolled={die.faceIndex === null || undefined}
                title={handHint}
                style={{ gridColumn: slotIndex + 1 }}
                key={ownerId}
              >
                <ExpeditionDie3D
                  index={slotIndex}
                  value={value}
                  characterName={visual.name}
                  themeColor={visual.themeColor}
                  suit={visual.suit}
                  faces={die.faces}
                  held={die.loaded}
                  scoring={scoringOwners.has(ownerId)}
                  rolling={dieVisual.rolling}
                  rollDuration={dieVisual.rollDuration}
                  rotation={dieVisual.rolling
                    ? dieVisual.rotation
                    : getExpeditionDieRotation(die.faceIndex === null ? null : value)}
                  disabled={
                    die.downed ||
                    !interactive ||
                    !die.canToggle
                  }
                  downed={visuallyDowned}
                  rustFaces={rustFaceCount}
                  gildFaces={gildFaceCount}
                  handHint={handHint}
                  onToggle={() => onDieToggle(dieIndex)}
                />
              </div>
            );
          })}
        </div>
      </div>
      <ActionDock active busy={busy || Boolean(attackFx) || Boolean(supportFx)} alternate={itemPanel && {open: itemPanel.open, label: itemPanel.open ? "返回行动" : "打开道具坞", icon: bagIcon, onToggle: itemPanel.onToggle, panel: itemPanel.content}}
        leading={<IconButton
          className="abyssa-expedition-undo"
          label={undoLabel ? `撤回：${undoLabel}` : "撤回"}
          shape="diamond"
          size="md"
          variant="dark"
          disabled={!!itemPanel?.open || !interactive || !undoReady}
          onClick={onUndo}
        >
          <svg viewBox="0 0 512 512" aria-hidden="true">
            <path d="M248.91 50a205.9 205.9 0 0 1 35.857 3.13c85.207 15.025 152.077 81.895 167.102 167.102 15.023 85.208-24.944 170.917-99.874 214.178-32.782 18.927-69.254 27.996-105.463 27.553-46.555-.57-92.675-16.865-129.957-48.15l30.855-36.768a157.846 157.846 0 0 0 180.566 15.797 157.846 157.846 0 0 0 76.603-164.274A157.848 157.848 0 0 0 276.429 100.4a157.84 157.84 0 0 0-139.17 43.862L185 192H57V64l46.34 46.342C141.758 71.962 194.17 50.03 248.91 50z" />
          </svg>
        </IconButton>}
      >
        {controls ?? <div className="abyssa-expedition-action-controls">
          <DiceActionButton
            label={awaitingInitialRoll ? "ROLL" : "REROLL"}
            disabled={
              awaitingInitialRoll
                ? !initialRollReady
                : !interactive || rerollsRemaining <= 0 || !unloadedRemain
            }
            onClick={awaitingInitialRoll ? onRoll : onReroll}
          />
          <ActionDockSlot
            caption="REROLL"
            label={`重掷剩余 ${rerollsRemaining} 次`}
            value={`×${rerollsRemaining}`}
          />
          <ExpeditionHandReadout hand={hand} explanation={handExplanation(slots, hand)} />
          <DiceActionButton
            label="END TURN"
            primary
            disabled={!interactive}
            onClick={onEndTurn}
          />
        </div>}
      </ActionDock>
    </section>
  );
}
