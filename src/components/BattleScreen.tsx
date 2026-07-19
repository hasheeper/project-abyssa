import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { useControllableState } from "../hooks/useControllableState";
import { cx } from "../utils/cx";
import bookmarkIcon from "../assets/svg/bookmark.svg";
import crossedSwordsIcon from "../assets/svg/crossed-swords.svg";
import slashedShieldIcon from "../assets/svg/slashed-shield.svg";
import swapBagIcon from "../assets/svg/swap-bag.svg";
import holyRoseIcon from "../assets/svg/2-0-pentagram-rose.svg";
import holyCrossIcon from "../assets/svg/6-0-split-cross.svg";
import { Nameplate } from "./Nameplate";
import { Progress } from "./Progress";
import { RpgFrame } from "./RpgFrame";
import { RpgHeader } from "./RpgHeader";
import { FrameEdgeWeave } from "./internal/FrameEdgeWeave";

export type BattleSpritePose = "idle" | "action" | "hurt" | "guard";

export type BattleCommandId = "attack" | "skills" | "items" | "defend";

export type BattleAttackPhase =
  | "anticipate"
  | "hitstop"
  | "impact"
  | "recover";

export type BattleAttackMotionMode = "system" | "full";

export type BattleActionKind = "physical-single" | "holy-aoe";

export interface BattleAttackEvent {
  actorId: string;
  targetId: string;
  damage: number;
}

export interface BattleHolyAttackEvent {
  actorId: string;
  targetIds: string[];
  damageByTarget: Record<string, number>;
}

export interface BattlePlacement {
  /** Horizontal position in stage percent. */
  x: number;
  /** Vertical position in stage percent. */
  y: number;
  scale?: number;
  zIndex?: number;
  /** Horizontal transform origin in sprite percent. Defaults to 50. */
  anchorX?: number;
  /** Vertical transform origin in sprite percent. Defaults to 100. */
  anchorY?: number;
}

export interface BattleSpriteAdjustment {
  /** Pose-specific horizontal adjustment in sprite percent. */
  offsetX?: number;
  /** Pose-specific vertical adjustment in sprite percent. */
  offsetY?: number;
  /** Multiplier applied to the base placement scale. */
  scale?: number;
}

export interface BattleFloatingFeedback {
  id?: string;
  text: string;
  tone?: "damage" | "heal" | "status";
  offsetX?: number;
  offsetY?: number;
}

interface BattleCombatantBase {
  id: string;
  name: string;
  portraitUrl?: string;
  portraitAlt?: string;
  hp: number;
  maxHp: number;
  placement: BattlePlacement;
  disabled?: boolean;
  floatingFeedback?: BattleFloatingFeedback[];
}

export interface BattleAlly extends BattleCombatantBase {
  spriteSheetUrl: string;
  spriteAlt?: string;
  /** Mirror this combat sprite horizontally without changing the atlas crop. */
  flipSprite?: boolean;
  mp: number;
  maxMp: number;
  pose?: BattleSpritePose;
  poseAdjustments?: Partial<Record<BattleSpritePose, BattleSpriteAdjustment>>;
}

export interface BattleEnemy extends BattleCombatantBase {
  spriteUrl: string;
  spriteAlt?: string;
  /** Set to false to render the enemy without allowing target selection. */
  targetable?: boolean;
}

export interface BattleTurnEntry {
  /** Stable key for this occurrence in the turn order. */
  id: string;
  unitId: string;
  side: "ally" | "enemy";
  label: string;
  portraitUrl?: string;
  portraitAlt?: string;
}

export interface BattleScene {
  id: string;
  tone: "order" | "chaos";
  label?: string;
  backgroundUrl: string;
  backgroundAlt?: string;
  backgroundPosition?: string;
}

export interface BattleScreenProps
  extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  scene: BattleScene;
  allies: BattleAlly[];
  enemies: BattleEnemy[];
  turnOrder: BattleTurnEntry[];
  activeActorId?: string;
  selectedCommandId?: BattleCommandId;
  defaultSelectedCommandId?: BattleCommandId;
  onSelectedCommandIdChange?: (id: BattleCommandId) => void;
  selectedTargetId?: string;
  defaultSelectedTargetId?: string;
  onSelectedTargetIdChange?: (id: string) => void;
  /** Damage number shown by the built-in attack cut-in. Defaults to 310. */
  attackDamage?: number;
  /** Fires at the impact frame. Consumers can apply combat-state changes here. */
  onAttack?: (event: BattleAttackEvent) => void;
  /** Damage applied to every living enemy by the built-in holy group spell. */
  holyAttackDamage?: number | Readonly<Record<string, number>>;
  /** Fires once when the holy group spell reaches its impact frame. */
  onHolyAttack?: (event: BattleHolyAttackEvent) => void;
  /** Use `full` for cinematic previews even when the OS requests reduced motion. */
  attackMotionMode?: BattleAttackMotionMode;
  commandsDisabled?: boolean;
  title?: string;
  subtitle?: string;
}

type BattleCustomProperties = CSSProperties & {
  "--abyssa-battle-screen-x"?: string;
  "--abyssa-battle-screen-y"?: string;
  "--abyssa-battle-screen-anchor-x"?: string;
  "--abyssa-battle-screen-anchor-y"?: string;
  "--abyssa-battle-screen-scale"?: number;
  "--abyssa-battle-screen-pose-offset-x"?: string;
  "--abyssa-battle-screen-pose-offset-y"?: string;
  "--abyssa-battle-screen-feedback-x"?: string;
  "--abyssa-battle-screen-feedback-y"?: string;
  "--abyssa-battle-target-nameplate-scale"?: number;
  "--abyssa-battle-actor-lunge-x"?: string;
  "--abyssa-battle-ally-drift-start-x"?: string;
  "--abyssa-battle-ally-drift-x"?: string;
  "--abyssa-battle-enemy-knockback-x"?: string;
  "--abyssa-battle-enemy-drift-x"?: string;
  "--abyssa-battle-camera-x"?: string;
  "--abyssa-battle-camera-y"?: string;
  "--abyssa-battle-camera-tilt"?: string;
  "--abyssa-battle-line-angle"?: string;
  "--abyssa-battle-damage-drift-x"?: string;
  "--abyssa-battle-holy-target-x"?: string;
  "--abyssa-battle-holy-target-y"?: string;
};

interface BattleActionStateBase {
  kind: BattleActionKind;
  phase: BattleAttackPhase;
  actorId: string;
  cameraX: number;
  cameraY: number;
  cameraTilt: number;
  lineAngle: number;
}

interface BattleAttackState extends BattleActionStateBase, BattleAttackEvent {
  kind: "physical-single";
  lungeX: number;
}

interface BattleHolyAttackState
  extends BattleActionStateBase,
    BattleHolyAttackEvent {
  kind: "holy-aoe";
  spellX: number;
  pushDirection: number;
}

type BattleActionState = BattleAttackState | BattleHolyAttackState;

const poseCoordinates: Record<
  BattleSpritePose,
  { row: 0 | 1; column: 0 | 1 }
> = {
  idle: { row: 0, column: 0 },
  action: { row: 0, column: 1 },
  hurt: { row: 1, column: 0 },
  guard: { row: 1, column: 1 }
};

const battleCommands: ReadonlyArray<{
  id: BattleCommandId;
  label: string;
}> = [
  { id: "skills", label: "SKILLS" },
  { id: "items", label: "ITEMS" },
  { id: "defend", label: "DEFEND" },
  { id: "attack", label: "ATTACK" }
];

const commandHudGeometry: Record<BattleCommandId, {
  path: string;
  insetPath: string;
  labelX: number;
  labelY: number;
}> = {
  skills: {
    path: "M282 78 H518 L571 154 L527 225 H464 L400 292 L336 225 H273 L229 154 Z",
    insetPath: "M293 94 H507 L551 155 L516 209 H454 L400 264 L346 209 H284 L249 155 Z",
    labelX: 400,
    labelY: 132
  },
  items: {
    path: "M57 241 H306 L370 310 L306 379 H57 L12 310 Z",
    insetPath: "M69 258 H296 L344 310 L296 362 H69 L35 310 Z",
    labelX: 186,
    labelY: 350
  },
  defend: {
    path: "M494 241 H743 L788 310 L743 379 H494 L430 310 Z",
    insetPath: "M504 258 H731 L765 310 L731 362 H504 L456 310 Z",
    labelX: 614,
    labelY: 350
  },
  attack: {
    path: "M336 395 L400 328 L464 395 H527 L571 466 L518 542 H282 L229 466 L273 395 Z",
    insetPath: "M346 411 L400 356 L454 411 H516 L551 465 L507 526 H293 L249 465 L284 411 Z",
    labelX: 400,
    labelY: 510
  }
};

const commandHudIcons: Record<BattleCommandId, string> = {
  skills: bookmarkIcon,
  items: swapBagIcon,
  defend: slashedShieldIcon,
  attack: crossedSwordsIcon
};

function getPlacementStyle(
  placement: BattlePlacement,
  adjustment?: BattleSpriteAdjustment
): BattleCustomProperties {
  return {
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    zIndex: placement.zIndex,
    "--abyssa-battle-screen-x": `${placement.x}%`,
    "--abyssa-battle-screen-y": `${placement.y}%`,
    "--abyssa-battle-screen-anchor-x": `${placement.anchorX ?? 50}%`,
    "--abyssa-battle-screen-anchor-y": `${placement.anchorY ?? 100}%`,
    "--abyssa-battle-screen-scale":
      (placement.scale ?? 1) * (adjustment?.scale ?? 1),
    "--abyssa-battle-screen-pose-offset-x": `${adjustment?.offsetX ?? 0}%`,
    "--abyssa-battle-screen-pose-offset-y": `${adjustment?.offsetY ?? 0}%`
  };
}

function FloatingFeedback({
  feedback,
  unitId
}: {
  feedback?: BattleFloatingFeedback[];
  unitId: string;
}) {
  if (!feedback?.length) return null;

  return (
    <span className="abyssa-battle-screen__feedback-layer" aria-live="polite">
      {feedback.map((item, index) => {
        const style: BattleCustomProperties = {
          "--abyssa-battle-screen-feedback-x": `${item.offsetX ?? 0}%`,
          "--abyssa-battle-screen-feedback-y": `${item.offsetY ?? 0}%`
        };

        return (
          <span
            key={item.id ?? `${unitId}-feedback-${index}`}
            className="abyssa-battle-screen__feedback"
            data-tone={item.tone ?? "damage"}
            style={style}
          >
            {item.text}
          </span>
        );
      })}
    </span>
  );
}

function BattleTurnOrder({
  entries,
  activeActorId
}: {
  entries: BattleTurnEntry[];
  activeActorId?: string;
}) {
  const activeEntryIndex = entries.findIndex(
    (entry) => entry.unitId === activeActorId
  );
  const currentEntry = entries[activeEntryIndex] ?? entries[0];
  const queue = entries.filter((entry) => entry.id !== currentEntry?.id).slice(0, 7);
  const visibleEntries = currentEntry ? [currentEntry, ...queue] : [];
  const uid = useId().replace(/:/g, "");

  return (
    <div className="abyssa-battle-screen__turn-order">
      <svg className="abyssa-battle-screen__turn-art" viewBox="0 0 1500 210" aria-hidden="true">
        <defs>
          <pattern id={`${uid}-track-pattern`} width="84" height="84" patternUnits="userSpaceOnUse" patternTransform="translate(0 -16)">
            <path d="M42 0 84 42 42 84 0 42Z" fill="rgb(129 181 183 / 7.5%)" />
            <path d="M42 17 67 42 42 67 17 42Z" fill="rgb(255 255 255 / 2.5%)" />
          </pattern>
          <linearGradient id={`${uid}-track-light`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#567779" stopOpacity=".72" />
            <stop offset="55%" stopColor="#3b5051" stopOpacity=".5" />
            <stop offset="100%" stopColor="#283b3c" stopOpacity=".65" />
          </linearGradient>
        </defs>
        <g className="abyssa-battle-screen__turn-track">
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" fill={`url(#${uid}-track-light)`} />
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" fill={`url(#${uid}-track-pattern)`} />
          <path d="M78 69H1422L1450 105 1422 141H78L50 105Z" />
          <path d="M91 79H1416L1437 105 1416 131H91L70 105Z" className="abyssa-battle-screen__turn-track-inset" />
          <path d="M350 78V132M356 78V132" className="abyssa-battle-screen__turn-divider" />
        </g>
        {currentEntry && (
          <BattleTurnToken
            entry={currentEntry}
            x={128}
            y={105}
            radius={60}
            current
            clipId={`${uid}-current`}
          />
        )}
        {queue.map((entry, index) => (
          <BattleTurnToken
            key={entry.id}
            entry={entry}
            x={440 + index * 145}
            y={105}
            radius={42}
            index={index + 1}
            clipId={`${uid}-queue-${index}`}
          />
        ))}
      </svg>
      <ol className="abyssa-battle-screen__turn-list" aria-label="Action order">
        {visibleEntries.map((entry, index) => (
          <li
            key={entry.id}
            className="abyssa-battle-screen__turn-entry"
            data-side={entry.side}
            data-active={index === 0 || undefined}
            aria-current={index === 0 ? "step" : undefined}
          >
            <span className="abyssa-battle-screen__turn-entry-label">{entry.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BattleTurnToken({
  entry,
  x,
  y,
  radius,
  current = false,
  index,
  clipId
}: {
  entry: BattleTurnEntry;
  x: number;
  y: number;
  radius: number;
  current?: boolean;
  index?: number;
  clipId: string;
}) {
  const isEnemy = entry.side === "enemy";
  const main = isEnemy ? "#c9504e" : "#68b5b9";
  const light = isEnemy ? "#e9807e" : "#a5d8da";
  const dark = isEnemy ? "#5b2423" : "#204e50";
  const innerRadius = radius - 13;
  const spikes = `M ${x} ${y - radius - 11} L ${x + 7} ${y - radius + 4} L ${x} ${y - radius + 1} L ${x - 7} ${y - radius + 4} Z M ${x} ${y + radius + 11} L ${x + 7} ${y + radius - 4} L ${x} ${y + radius - 1} L ${x - 7} ${y + radius - 4} Z M ${x - radius - 11} ${y} L ${x - radius + 4} ${y - 7} L ${x - radius + 1} ${y} L ${x - radius + 4} ${y + 7} Z M ${x + radius + 11} ${y} L ${x + radius - 4} ${y - 7} L ${x + radius - 1} ${y} L ${x + radius - 4} ${y + 7} Z`;

  return (
    <g className="abyssa-battle-screen__turn-token" data-side={entry.side} data-current={current || undefined}>
      <defs>
        <clipPath id={clipId}><circle cx={x} cy={y} r={innerRadius} /></clipPath>
      </defs>
      {current ? (
        <><path d={`M ${x - 11} ${y - radius - 31}H ${x + 11}L ${x} ${y - radius - 14}Z`} fill={light} stroke={dark} strokeWidth="2" /><circle cx={x} cy={y - radius - 9} r="2.7" fill={light} /></>
      ) : (
        <text className="abyssa-battle-screen__turn-number" x={x} y={y - radius - 15}>{index}</text>
      )}
      <path d={spikes} fill={main} stroke={dark} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={x} cy={y} r={radius} fill="#111818" stroke={dark} strokeWidth="8" />
      <circle cx={x} cy={y} r={radius} fill="none" stroke={main} strokeWidth="4.5" />
      <circle cx={x} cy={y} r={radius - 4} fill="none" stroke={light} strokeWidth="1.3" opacity=".82" />
      {entry.portraitUrl ? (
        <image href={entry.portraitUrl} x={x - innerRadius} y={y - innerRadius} width={innerRadius * 2} height={innerRadius * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : (
        <><circle cx={x} cy={y} r={innerRadius} fill="#111515" /><circle cx={x - innerRadius * .25} cy={y - innerRadius * .08} r={innerRadius * .09} fill="#ff4743" /><circle cx={x + innerRadius * .25} cy={y - innerRadius * .08} r={innerRadius * .09} fill="#ff4743" /></>
      )}
      <circle cx={x} cy={y} r={innerRadius} fill="none" stroke="#101717" strokeWidth="4" />
      <circle cx={x} cy={y} r={innerRadius - 2} fill="none" stroke={main} strokeWidth="1.3" opacity=".76" />
      <g fill={light}><circle cx={x - radius + 4} cy={y} r="2" /><circle cx={x + radius - 4} cy={y} r="2" /><circle cx={x} cy={y + radius - 4} r="2" /></g>
      {current && <text className="abyssa-battle-screen__turn-current-label" x={x} y={y + radius + 39}>CURRENT</text>}
    </g>
  );
}

function BattleAllySprite({
  ally,
  active,
  attack
}: {
  ally: BattleAlly;
  active: boolean;
  attack?: BattleActionState;
}) {
  const pose: BattleSpritePose = attack ? "action" : ally.pose ?? "idle";
  const coordinates = poseCoordinates[pose];
  const adjustment = ally.poseAdjustments?.[pose];

  const placementStyle = getPlacementStyle(ally.placement, adjustment);
  if (attack?.kind === "physical-single") {
    placementStyle["--abyssa-battle-actor-lunge-x"] = `${attack.lungeX}cqw`;
    placementStyle["--abyssa-battle-ally-drift-start-x"] = `${Math.sign(attack.lungeX) * .45}cqw`;
    placementStyle["--abyssa-battle-ally-drift-x"] = `${Math.sign(attack.lungeX) * 2.4}cqw`;
  } else if (attack?.kind === "holy-aoe") {
    placementStyle["--abyssa-battle-actor-lunge-x"] = `${attack.pushDirection * 3.2}cqw`;
    placementStyle["--abyssa-battle-ally-drift-start-x"] = `${attack.pushDirection * .18}cqw`;
    placementStyle["--abyssa-battle-ally-drift-x"] = `${attack.pushDirection * .9}cqw`;
  }

  return (
    <div
      className="abyssa-battle-screen__ally"
      data-unit-id={ally.id}
      data-active={active || undefined}
      data-disabled={ally.disabled || undefined}
      data-defeated={ally.hp <= 0 || undefined}
      data-sprite-flipped={ally.flipSprite || undefined}
      data-pose={pose}
      data-row={coordinates.row}
      data-column={coordinates.column}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={
        attack && (attack.phase === "impact" || attack.phase === "recover")
          ? true
          : undefined
      }
      style={placementStyle}
    >
      <span className="abyssa-battle-screen__ally-sprite-motion">
        <span className="abyssa-battle-screen__actor-aura" aria-hidden="true" />
        <span className="abyssa-battle-screen__ally-sprite-viewport">
          <img
            className="abyssa-battle-screen__ally-sprite"
            src={ally.spriteSheetUrl}
            alt={ally.spriteAlt ?? ally.name}
            data-pose={pose}
            data-row={coordinates.row}
            data-column={coordinates.column}
            draggable={false}
          />
        </span>
      </span>
      <FloatingFeedback feedback={ally.floatingFeedback} unitId={ally.id} />
    </div>
  );
}

function BattleEnemyTarget({
  enemy,
  selected,
  active,
  onSelect,
  attack,
  interactionDisabled
}: {
  enemy: BattleEnemy;
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  attack?: BattleActionState;
  interactionDisabled: boolean;
}) {
  const unavailable =
    interactionDisabled ||
    enemy.disabled ||
    enemy.targetable === false ||
    enemy.hp <= 0;
  const enemyStyle: BattleCustomProperties = {
    ...getPlacementStyle(enemy.placement),
    "--abyssa-battle-target-nameplate-scale": 1 / (enemy.placement.scale ?? 1)
  };
  if (attack?.kind === "physical-single") {
    enemyStyle["--abyssa-battle-enemy-knockback-x"] = `${Math.sign(attack.lungeX) * 4.5}cqw`;
    enemyStyle["--abyssa-battle-enemy-drift-x"] = `${Math.sign(attack.lungeX) * 5.6}cqw`;
  } else if (attack?.kind === "holy-aoe") {
    enemyStyle["--abyssa-battle-enemy-knockback-x"] = `${attack.pushDirection * 1.8}cqw`;
    enemyStyle["--abyssa-battle-enemy-drift-x"] = `${attack.pushDirection * 2.6}cqw`;
  }

  return (
    <button
      type="button"
      className="abyssa-battle-screen__enemy"
      data-unit-id={enemy.id}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-defeated={enemy.hp <= 0 || undefined}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={
        attack && (attack.phase === "impact" || attack.phase === "recover")
          ? true
          : undefined
      }
      data-interaction-locked={interactionDisabled || undefined}
      style={enemyStyle}
      disabled={unavailable}
      aria-label={`Target ${enemy.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(enemy.id)}
    >
      <span className="abyssa-battle-screen__enemy-health">
        <Progress
          className="abyssa-battle-screen__enemy-hp"
          value={enemy.hp}
          max={enemy.maxHp}
          size="sm"
          label={`${enemy.name} HP`}
        />
      </span>
      {selected && (
        <span className="abyssa-battle-screen__enemy-target-nameplate" aria-live="polite">
          <Nameplate name={enemy.name} secondaryName="TARGET" variant="dark" />
        </span>
      )}
      <span className="abyssa-battle-screen__target-ring" aria-hidden="true" />
      <span className="abyssa-battle-screen__enemy-sprite-motion">
        <img
          className="abyssa-battle-screen__enemy-sprite"
          src={enemy.spriteUrl}
          alt={enemy.spriteAlt ?? enemy.name}
          draggable={false}
        />
      </span>
      {attack?.kind === "physical-single" && (
        <>
          <span className="abyssa-battle-screen__attack-slash" data-slash="one" aria-hidden="true" />
          <span className="abyssa-battle-screen__attack-slash" data-slash="two" aria-hidden="true" />
        </>
      )}
      <FloatingFeedback feedback={enemy.floatingFeedback} unitId={enemy.id} />
    </button>
  );
}

function BattleField({
  scene,
  allies,
  enemies,
  activeActorId,
  selectedTargetId,
  onSelectTarget,
  attack
}: {
  scene: BattleScene;
  allies: BattleAlly[];
  enemies: BattleEnemy[];
  activeActorId?: string;
  selectedTargetId?: string;
  onSelectTarget: (id: string) => void;
  attack?: BattleActionState;
}) {
  const impactActive = Boolean(
    attack && (attack.phase === "impact" || attack.phase === "recover")
  );
  const attackTarget = attack?.kind === "physical-single"
    ? enemies.find((enemy) => enemy.id === attack.targetId)
    : undefined;
  const holyTargets = attack?.kind === "holy-aoe"
    ? enemies.filter((enemy) => attack.targetIds.includes(enemy.id))
    : [];
  const fieldStyle: BattleCustomProperties | undefined = attack
    ? {
        "--abyssa-battle-camera-x": `${attack.cameraX}%`,
        "--abyssa-battle-camera-y": `${attack.cameraY}%`,
        "--abyssa-battle-camera-tilt": `${attack.cameraTilt}deg`,
        "--abyssa-battle-line-angle": `${attack.lineAngle}deg`,
        "--abyssa-battle-damage-drift-x": attack.kind === "physical-single"
          ? `${Math.sign(attack.lungeX) * 1.6}cqw`
          : "0cqw"
      }
    : undefined;

  return (
    <div
      className="abyssa-battle-screen__field"
      data-scene={scene.id}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={impactActive || undefined}
      aria-label={scene.label ?? "Battlefield"}
      style={fieldStyle}
    >
      <div className="abyssa-battle-screen__camera-world">
        <img
          className="abyssa-battle-screen__background"
          src={scene.backgroundUrl}
          alt={scene.backgroundAlt ?? ""}
          style={{ objectPosition: scene.backgroundPosition }}
          draggable={false}
        />
        <span className="abyssa-battle-screen__field-shade" aria-hidden="true" />

        <div className="abyssa-battle-screen__enemy-line">
          {enemies.map((enemy) => (
            <BattleEnemyTarget
              key={enemy.id}
              enemy={enemy}
              selected={enemy.id === selectedTargetId}
              active={enemy.id === activeActorId}
              onSelect={onSelectTarget}
              attack={
                attack && (
                  (attack.kind === "physical-single" && enemy.id === attack.targetId) ||
                  (attack.kind === "holy-aoe" && attack.targetIds.includes(enemy.id))
                )
                  ? attack
                  : undefined
              }
              interactionDisabled={Boolean(attack)}
            />
          ))}
        </div>

        <div className="abyssa-battle-screen__ally-line">
          {allies.map((ally) => (
            <BattleAllySprite
              key={ally.id}
              ally={ally}
              active={ally.id === activeActorId}
              attack={ally.id === attack?.actorId ? attack : undefined}
            />
          ))}
        </div>
      </div>
      <span className="abyssa-battle-screen__attack-vignette" aria-hidden="true" />
      <span className="abyssa-battle-screen__attack-flash" aria-hidden="true" />
      <span className="abyssa-battle-screen__attack-overlay" aria-hidden="true">
        {attack?.kind === "holy-aoe" && (
          <span className="abyssa-battle-screen__holy-spell-layer">
            <span
              className="abyssa-battle-screen__holy-sky-sigil"
              style={{ left: `${attack.spellX}%` }}
            >
              <span
                className="abyssa-battle-screen__holy-sigil-rose"
                style={{
                  WebkitMaskImage: `url(${holyRoseIcon})`,
                  maskImage: `url(${holyRoseIcon})`
                }}
              />
              <span
                className="abyssa-battle-screen__holy-sigil-cross"
                style={{
                  WebkitMaskImage: `url(${holyCrossIcon})`,
                  maskImage: `url(${holyCrossIcon})`
                }}
              />
            </span>
            {holyTargets.map((enemy) => {
              const spellStyle: BattleCustomProperties = {
                "--abyssa-battle-holy-target-x": `${enemy.placement.x}%`,
                "--abyssa-battle-holy-target-y": `${enemy.placement.y}%`
              };
              return (
                <span
                  key={enemy.id}
                  className="abyssa-battle-screen__holy-strike"
                  data-target-id={enemy.id}
                  style={spellStyle}
                >
                  <span className="abyssa-battle-screen__holy-ray" />
                  <span className="abyssa-battle-screen__holy-impact-sigil" />
                  <span className="abyssa-battle-screen__holy-impact-bloom" />
                </span>
              );
            })}
          </span>
        )}
        {attackTarget && (
          <span
            className="abyssa-battle-screen__field-attack-damage"
            style={{
              left: `${attackTarget.placement.x}%`,
              top: `${Math.max(10, attackTarget.placement.y - 42)}%`
            }}
          >
            {attack?.kind === "physical-single" ? attack.damage : null}
          </span>
        )}
        {attack?.kind === "holy-aoe" && holyTargets.map((enemy) => (
          <span
            key={enemy.id}
            className="abyssa-battle-screen__field-attack-damage abyssa-battle-screen__field-holy-damage"
            style={{
              left: `${enemy.placement.x}%`,
              top: `${Math.max(10, enemy.placement.y - 42)}%`
            }}
          >
            {attack.damageByTarget[enemy.id]}
          </span>
        ))}
      </span>
      {!selectedTargetId && <span className="abyssa-battle-screen__no-target">NO TARGET</span>}
    </div>
  );
}

function BattlePartyStatus({
  allies,
  activeActorId
}: {
  allies: BattleAlly[];
  activeActorId?: string;
}) {
  return (
    <div className="abyssa-battle-screen__party-panel">
      <ul
        className="abyssa-battle-screen__party-list"
        aria-label="Party status"
        data-party-size={allies.length}
      >
        {allies.map((ally) => (
          <li
            key={ally.id}
            className="abyssa-battle-screen__status-card"
            data-active={ally.id === activeActorId || undefined}
            data-disabled={ally.disabled || undefined}
            data-defeated={ally.hp <= 0 || undefined}
            style={{
              "--abyssa-battle-party-slot-x": `${(ally.placement.x / 72) * 100}%`
            } as CSSProperties}
          >
            <div className="abyssa-battle-screen__status-art">
              {ally.portraitUrl ? (
                <img
                  src={ally.portraitUrl}
                  alt={ally.portraitAlt ?? `${ally.name} standing portrait`}
                />
              ) : (
                <span aria-hidden="true">{ally.name.slice(0, 1)}</span>
              )}
            </div>
            <div className="abyssa-battle-screen__status-card-content">
              <strong className="abyssa-battle-screen__status-name">
                {ally.name}
              </strong>
              <div className="abyssa-battle-screen__status-resource" data-resource="hp">
                <span className="abyssa-battle-screen__status-resource-label">HP</span>
                <Progress
                  className="abyssa-battle-screen__status-hp"
                  value={ally.hp}
                  max={ally.maxHp}
                  size="sm"
                  label={`${ally.name} HP`}
                />
                <span className="abyssa-battle-screen__status-value">
                  {ally.hp}/{ally.maxHp}
                </span>
              </div>
              <div className="abyssa-battle-screen__status-resource" data-resource="mp">
                <span className="abyssa-battle-screen__status-resource-label">MP</span>
                <Progress
                  className="abyssa-battle-screen__status-mp"
                  value={ally.mp}
                  max={ally.maxMp}
                  size="sm"
                  label={`${ally.name} MP`}
                />
                <span className="abyssa-battle-screen__status-value">
                  {ally.mp}/{ally.maxMp}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {allies.length === 0 && (
        <p className="abyssa-battle-screen__empty-party">NO PARTY MEMBERS</p>
      )}
    </div>
  );
}

function BattleCommandMenu({
  selectedCommandId,
  disabled,
  onSelect
}: {
  selectedCommandId: BattleCommandId;
  disabled: boolean;
  onSelect: (id: BattleCommandId) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const diamondId = `abyssa-command-diamond-${uid}`;
  const sideId = `abyssa-command-side-${uid}`;

  return (
    <nav className="abyssa-battle-screen__commands" aria-label="Battle commands">
      <svg className="abyssa-battle-screen__command-art" viewBox="0 0 800 620" aria-hidden="true">
        <defs>
          <g id={diamondId} className="abyssa-battle-screen__command-filigree">
            <path d="M0-34 8-17 24-9 11 0 24 9 8 17 0 34-8 17-24 9-11 0-24-9-8-17Z" />
            <path d="M0-25C-2-12-10-7-17 0C-10 7-2 12 0 25M0-25C2-12 10-7 17 0C10 7 2 12 0 25M-17 0H17M0-25V25M-9-13 0-4 9-13M-9 13 0 4 9 13" />
            <circle cx="0" cy="0" r="2.6" className="abyssa-battle-screen__command-filigree-fill" />
          </g>
          <g id={sideId} className="abyssa-battle-screen__command-filigree">
            <path d="M-26 0-13-7-4-22 2-9 18-5 7 0 18 5 2 9-4 22-13 7Z" />
            <path d="M-17 0H8M-8-11 0 0-8 11M-14-6-4 0-14 6" />
            <circle cx="-8" cy="0" r="2.2" className="abyssa-battle-screen__command-filigree-fill" />
          </g>
        </defs>
        <g className="abyssa-battle-screen__command-rings">
          <circle cx="400" cy="310" r="207" />
          <circle cx="400" cy="310" r="195" />
          <circle cx="400" cy="310" r="184" />
          <path d="M374 99 400 42 426 99M381 95 400 57 419 95M389 92 400 71 411 92M374 521 400 578 426 521M381 525 400 563 419 525M389 528 400 549 411 528M400 44V102M400 518V576" />
        </g>
        {battleCommands.map((command) => {
          const geometry = commandHudGeometry[command.id];
          const selected = command.id === selectedCommandId;
          return (
            <g
              key={command.id}
              className="abyssa-battle-screen__command-panel"
              data-command={command.id}
              data-selected={selected || undefined}
            >
              <path className="abyssa-battle-screen__command-panel-fill" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-outer" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-middle" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-inner" d={geometry.path} />
              <path className="abyssa-battle-screen__command-panel-inset" d={geometry.insetPath} />
              {command.id === "skills" && <><use href={`#${sideId}`} transform="translate(247 154)" /><use href={`#${sideId}`} transform="translate(553 154) scale(-1 1)" /><use href={`#${diamondId}`} transform="translate(400 257) scale(.85)" /></>}
              {command.id === "items" && <><use href={`#${sideId}`} transform="translate(34 310)" /><use href={`#${diamondId}`} transform="translate(342 310) scale(.88)" /></>}
              {command.id === "defend" && <><use href={`#${diamondId}`} transform="translate(458 310) scale(.88)" /><use href={`#${sideId}`} transform="translate(766 310) scale(-1 1)" /></>}
              {command.id === "attack" && <><use href={`#${diamondId}`} transform="translate(400 363) scale(.85)" /><use href={`#${sideId}`} transform="translate(247 466)" /><use href={`#${sideId}`} transform="translate(553 466) scale(-1 1)" /></>}
              <text className="abyssa-battle-screen__command-panel-label" x={geometry.labelX} y={geometry.labelY}>{command.label}</text>
              <g className="abyssa-battle-screen__command-svg-slot" data-command={command.id} />
            </g>
          );
        })}
        <path className="abyssa-battle-screen__command-jewel" d="M400 294 416 310 400 326 384 310Z" />
        <path className="abyssa-battle-screen__command-jewel-line" d="M400 299 411 310 400 321 389 310Z" />
      </svg>
      {battleCommands.map((command) => (
        <span
          key={command.id}
          className="abyssa-battle-screen__command-icon-slot"
          data-command={command.id}
          data-selected={command.id === selectedCommandId || undefined}
          style={{ "--abyssa-command-icon": `url("${commandHudIcons[command.id]}")` } as CSSProperties}
          aria-hidden="true"
        />
      ))}
      {battleCommands.map((command) => (
        <button
          key={command.id}
          type="button"
          className="abyssa-battle-screen__command-button"
          data-command={command.id}
          data-selected={command.id === selectedCommandId || undefined}
          aria-label={command.label}
          aria-pressed={command.id === selectedCommandId}
          disabled={disabled}
          onClick={() => onSelect(command.id)}
        />
      ))}
    </nav>
  );
}

export function BattleScreen({
  scene,
  allies,
  enemies,
  turnOrder,
  activeActorId,
  selectedCommandId,
  defaultSelectedCommandId = "attack",
  onSelectedCommandIdChange,
  selectedTargetId,
  defaultSelectedTargetId,
  onSelectedTargetIdChange,
  attackDamage = 310,
  onAttack,
  holyAttackDamage = 240,
  onHolyAttack,
  attackMotionMode = "system",
  commandsDisabled = false,
  title = "BATTLE",
  subtitle = "THE GREAT BALANCE",
  className,
  ...props
}: BattleScreenProps) {
  const attackRunRef = useRef(0);
  const attackBusyRef = useRef(false);
  const attackTimersRef = useRef<number[]>([]);
  const [attackState, setAttackState] = useState<BattleActionState>();
  const firstAvailableEnemy = enemies.find(
    (enemy) =>
      enemy.hp > 0 && enemy.targetable !== false && !enemy.disabled
  );
  const validDefaultTarget = enemies.find(
    (enemy) =>
      enemy.id === defaultSelectedTargetId &&
      enemy.hp > 0 &&
      enemy.targetable !== false &&
      !enemy.disabled
  );
  const [currentCommandId, setCurrentCommandId] =
    useControllableState<BattleCommandId>({
      value: selectedCommandId,
      defaultValue: defaultSelectedCommandId,
      onChange: onSelectedCommandIdChange
    });
  const [requestedTargetId, setRequestedTargetId] = useControllableState<string>({
    value: selectedTargetId,
    defaultValue: validDefaultTarget?.id ?? firstAvailableEnemy?.id ?? "",
    onChange: onSelectedTargetIdChange
  });
  const requestedTarget = enemies.find(
    (enemy) =>
      enemy.id === requestedTargetId &&
      enemy.hp > 0 &&
      enemy.targetable !== false &&
      !enemy.disabled
  );
  const currentTargetId = requestedTarget?.id ?? firstAvailableEnemy?.id;
  const activeAlly = allies.find(
    (ally) => ally.id === activeActorId && ally.hp > 0 && !ally.disabled
  );
  const attackActor =
    activeAlly ?? allies.find((ally) => ally.hp > 0 && !ally.disabled);
  const commandMenuDisabled =
    commandsDisabled ||
    allies.length === 0 ||
    (activeActorId !== undefined && !activeAlly);

  const waitForAttackFrame = useCallback((duration: number, runId: number) => {
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        attackTimersRef.current = attackTimersRef.current.filter(
          (activeTimer) => activeTimer !== timer
        );
        resolve(attackRunRef.current === runId);
      }, duration);
      attackTimersRef.current.push(timer);
    });
  }, []);

  useEffect(() => {
    return () => {
      attackRunRef.current += 1;
      attackBusyRef.current = false;
      attackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      attackTimersRef.current = [];
    };
  }, []);

  const runAttack = useCallback(async () => {
    if (
      attackBusyRef.current ||
      commandMenuDisabled ||
      !attackActor ||
      !currentTargetId
    ) {
      return;
    }

    const attackTarget = enemies.find((enemy) => enemy.id === currentTargetId);
    if (!attackTarget) return;

    const direction = Math.sign(
      attackTarget.placement.x - attackActor.placement.x
    ) || 1;
    const deltaX = attackTarget.placement.x - attackActor.placement.x;
    const deltaY = attackTarget.placement.y - attackActor.placement.y;
    const runId = ++attackRunRef.current;
    const baseAttack: Omit<BattleAttackState, "phase"> = {
      kind: "physical-single",
      actorId: attackActor.id,
      targetId: currentTargetId,
      damage: attackDamage,
      lungeX: direction * 11.5,
      cameraX: Math.min(
        88,
        Math.max(12, (attackActor.placement.x + attackTarget.placement.x) / 2)
      ),
      cameraY: Math.min(
        82,
        Math.max(18, (attackActor.placement.y + attackTarget.placement.y) / 2 - 10)
      ),
      cameraTilt: direction * -1.6,
      lineAngle: Math.atan2(deltaY * .61, deltaX) * 180 / Math.PI
    };

    attackBusyRef.current = true;
    setAttackState({ ...baseAttack, phase: "anticipate" });
    if (!(await waitForAttackFrame(100, runId))) return;
    setAttackState({ ...baseAttack, phase: "hitstop" });
    if (!(await waitForAttackFrame(70, runId))) return;
    setAttackState({ ...baseAttack, phase: "impact" });
    onAttack?.({ actorId: attackActor.id, targetId: currentTargetId, damage: attackDamage });
    if (!(await waitForAttackFrame(280, runId))) return;
    setAttackState({ ...baseAttack, phase: "recover" });
    if (!(await waitForAttackFrame(420, runId))) return;
    setAttackState(undefined);
    attackBusyRef.current = false;
  }, [
    attackActor,
    attackDamage,
    commandMenuDisabled,
    currentTargetId,
    enemies,
    onAttack,
    waitForAttackFrame
  ]);

  const runHolyAttack = useCallback(async () => {
    if (attackBusyRef.current || commandMenuDisabled || !attackActor) return;

    const targets = enemies.filter((enemy) => enemy.hp > 0 && !enemy.disabled);
    if (!targets.length) return;

    const spellX = targets.reduce(
      (total, enemy) => total + enemy.placement.x,
      0
    ) / targets.length;
    const targetY = targets.reduce(
      (total, enemy) => total + enemy.placement.y,
      0
    ) / targets.length;
    const damageByTarget = Object.fromEntries(
      targets.map((enemy) => [
        enemy.id,
        typeof holyAttackDamage === "number"
          ? holyAttackDamage
          : holyAttackDamage[enemy.id] ?? 240
      ])
    );
    const targetIds = targets.map((enemy) => enemy.id);
    const runId = ++attackRunRef.current;
    const baseAttack: Omit<BattleHolyAttackState, "phase"> = {
      kind: "holy-aoe",
      actorId: attackActor.id,
      targetIds,
      damageByTarget,
      spellX,
      pushDirection: Math.sign(spellX - attackActor.placement.x) || 1,
      cameraX: Math.min(
        84,
        Math.max(16, (attackActor.placement.x + spellX) / 2)
      ),
      cameraY: Math.min(70, Math.max(24, targetY - 20)),
      cameraTilt: .65,
      lineAngle: 0
    };

    attackBusyRef.current = true;
    setAttackState({ ...baseAttack, phase: "anticipate" });
    if (!(await waitForAttackFrame(220, runId))) return;
    setAttackState({ ...baseAttack, phase: "hitstop" });
    if (!(await waitForAttackFrame(180, runId))) return;
    setAttackState({ ...baseAttack, phase: "impact" });
    onHolyAttack?.({ actorId: attackActor.id, targetIds, damageByTarget });
    if (!(await waitForAttackFrame(330, runId))) return;
    setAttackState({ ...baseAttack, phase: "recover" });
    if (!(await waitForAttackFrame(430, runId))) return;
    setAttackState(undefined);
    attackBusyRef.current = false;
  }, [
    attackActor,
    commandMenuDisabled,
    enemies,
    holyAttackDamage,
    onHolyAttack,
    waitForAttackFrame
  ]);

  const handleCommandSelect = useCallback((id: BattleCommandId) => {
    const wasSelected = currentCommandId === id;
    setCurrentCommandId(id);
    if (id === "attack") void runAttack();
    if (id === "skills" && wasSelected) void runHolyAttack();
  }, [currentCommandId, runAttack, runHolyAttack, setCurrentCommandId]);

  return (
    <section
      className={cx("abyssa-battle-screen", className)}
      data-tone={scene.tone}
      data-scene-tone={scene.tone}
      data-commands-disabled={commandMenuDisabled || undefined}
      data-action-kind={attackState?.kind}
      data-attack-phase={attackState?.phase}
      data-attack-motion={attackMotionMode}
      data-cinematic={attackState ? true : undefined}
      aria-busy={Boolean(attackState)}
      {...props}
    >
      <div className="abyssa-battle-screen__header-row">
        <span
          className="abyssa-battle-screen__header-wing"
          data-side="left"
          aria-hidden="true"
        />
        <RpgHeader
          className="abyssa-battle-screen__header"
          label={title}
          description={subtitle}
          variant="dark"
        />
        <span
          className="abyssa-battle-screen__header-wing"
          data-side="right"
          aria-hidden="true"
        />
      </div>

      <RpgFrame
        className="abyssa-battle-screen__shell"
        padding="none"
        variant="dark"
      >
        <FrameEdgeWeave namespace="abyssa-battle-screen" />
        <BattleTurnOrder entries={turnOrder} activeActorId={activeActorId} />
        <BattleField
          scene={scene}
          allies={allies}
          enemies={enemies}
          activeActorId={activeActorId}
          selectedTargetId={currentTargetId}
          onSelectTarget={setRequestedTargetId}
          attack={attackState}
        />
        <div className="abyssa-battle-screen__hud">
          <BattlePartyStatus allies={allies} activeActorId={activeActorId} />
          <BattleCommandMenu
            selectedCommandId={currentCommandId}
            disabled={commandMenuDisabled || Boolean(attackState)}
            onSelect={handleCommandSelect}
          />
        </div>
      </RpgFrame>
    </section>
  );
}
