import type { CSSProperties, HTMLAttributes } from "react";

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

export type BattleCustomProperties = CSSProperties & {
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

export interface BattleActionStateBase {
  kind: BattleActionKind;
  phase: BattleAttackPhase;
  actorId: string;
  cameraX: number;
  cameraY: number;
  cameraTilt: number;
  lineAngle: number;
}

export interface BattleAttackState extends BattleActionStateBase, BattleAttackEvent {
  kind: "physical-single";
  lungeX: number;
}

export interface BattleHolyAttackState
  extends BattleActionStateBase,
    BattleHolyAttackEvent {
  kind: "holy-aoe";
  spellX: number;
  pushDirection: number;
}

export type BattleActionState = BattleAttackState | BattleHolyAttackState;
