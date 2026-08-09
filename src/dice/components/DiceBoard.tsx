import type { ReactNode } from "react";
import type { Side, SideState } from "../game";
import { Die3D } from "./Die3D";
import { WoodCorners } from "./WoodCorners";

interface DiceBoardProps {
  side: Side;
  state: SideState;
  active: boolean;
  dealer?: boolean;
  stateLabel: string;
  metaLabel?: string;
  diceDisabled: boolean;
  revealAll?: boolean;
  coverAll?: boolean;
  disabledMask?: boolean[];
  onToggleDie?: (index: number) => void;
  children?: ReactNode;
}

export function DiceBoard({ side, state, active, dealer = false, stateLabel, metaLabel, diceDisabled, revealAll = false, coverAll = false, disabledMask, onToggleDie, children }: DiceBoardProps) {
  const opponent = side === "opponent";
  const hasRevealedDice = opponent && (revealAll || state.publicLocked.some(Boolean));
  return (
    <section
      className={`dice-board dice-board--${side} wood-panel`}
      data-active={active ? "true" : "false"}
      data-revealed={hasRevealedDice ? "true" : "false"}
      aria-label={opponent ? "缇比的骰子" : "你的骰子"}
    >
      <WoodCorners />
      <header className="dice-board__header">
        <div className="dice-board__identity">
          <span className="dice-board__identity-copy">
            <span className="dice-board__identity-name">
              <strong>{opponent ? "缇比的骰子" : "你的骰子"}</strong>
              {dealer && <i className="dice-board__dealer" role="img" aria-label={opponent ? "缇比为庄家" : "玩家为庄家"}><span aria-hidden="true">庄</span></i>}
            </span>
            <small>{opponent ? "TIBBY · DEALER DICE" : "PLAYER · YOUR DICE"}</small>
          </span>
        </div>
        <div className="dice-board__state">
          <span>{stateLabel}</span>
          {metaLabel && <output>{metaLabel}</output>}
        </div>
      </header>
      <div className="dice-board__tray">
        <div className="diamond-pattern" />
        <div className="dice-row" aria-label={opponent ? "缇比的五枚骰子" : "你的五枚骰子"}>
          {state.dice.map((value, index) => (
            <Die3D
              key={index}
              side={side}
              index={index}
              value={value}
              lock={state.publicLocked[index] ? "public" : state.privateLocked[index] ? "private" : "none"}
              covered={coverAll || (opponent && !revealAll && !state.publicLocked[index])}
              rolling={state.rolling[index] ?? false}
              rollDuration={state.rollDurations[index] ?? 0.9}
              rotation={state.rotations[index]!}
              disabled={diceDisabled || Boolean(disabledMask?.[index])}
              onToggle={onToggleDie}
            />
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}
